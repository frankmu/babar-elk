import { resolve } from 'path';
import Boom from 'boom';
const graphExploreRoute = require('./server/routes/graphExplore');
const searchProxyRoute = require('./server/routes/searchProxy');
import { checkLicense } from './server/lib/check_license';
import { mirrorPluginStatus } from '../../server/lib/mirror_plugin_status';
import mappings from './mappings.json';

const APP_TITLE = 'Graph';

export const graph = (kibana) => {
    //2.x bootstrap code copied from https://github.com/elastic/timelion/pull/57/files
  let mainFile = 'plugins/graph/app';
  const ownDescriptor = Object.getOwnPropertyDescriptor(kibana, 'autoload');
  const protoDescriptor = Object.getOwnPropertyDescriptor(kibana.constructor.prototype, 'autoload');
  const descriptor = ownDescriptor || protoDescriptor || {};
  if (descriptor.get) {
    // the autoload list has been replaced with a getter that complains about
    // improper access, bypass that getter by seeing if it is defined
    mainFile = 'plugins/graph/app_with_autoload';
  }



  return new kibana.Plugin({
    id: 'graph',
    configPrefix: 'xpack.graph',
    publicDir: resolve(__dirname, 'public'),
    require: ['kibana', 'elasticsearch', 'xpack_main'],
    uiExports: {
      app: {
        title: APP_TITLE,
        order: 9000,
        icon: 'plugins/graph/icon.png',
        description: 'Graph exploration',
        //2.x        main: 'plugins/graph/app',
        main: mainFile, //2.x
        injectVars: function (server, options) {
          const config = server.config();
          return {
            kbnIndex: config.get('kibana.index'),
            esApiVersion: config.get('elasticsearch.apiVersion'),
            esShardTimeout: config.get('elasticsearch.shardTimeout'),
            graphSavePolicy: config.get('xpack.graph.savePolicy'),
            canEditDrillDownUrls: config.get('xpack.graph.canEditDrillDownUrls')
          };
        }
      },
      hacks: ['plugins/graph/hacks/toggle_app_link_in_nav'],
      mappings
    },

    config: function (Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
        canEditDrillDownUrls: Joi.boolean().default(true),
        savePolicy : Joi.string().valid(['config','configAndDataWithConsent','configAndData','none']).default('configAndData'),
      }).default();
    },

    init: function (server, options) {
      const thisPlugin = this;
      const xpackMainPlugin = server.plugins.xpack_main;

      mirrorPluginStatus(xpackMainPlugin, thisPlugin);
      xpackMainPlugin.status.once('green', () => {
        // Register a function that is called whenever the xpack info changes,
        // to re-compute the license check results for this plugin
        xpackMainPlugin.info.feature(thisPlugin.id).registerLicenseCheckResultsGenerator(checkLicense);
      });

      // Add server routes and initalize the plugin here
      const commonRouteConfig = {
        pre: [
          function forbidApiAccess(request, reply) {
            const licenseCheckResults = xpackMainPlugin.info.feature(thisPlugin.id).getLicenseCheckResults();
            if (licenseCheckResults.showAppLink && licenseCheckResults.enableAppLink) {
              reply();
            } else {
              reply(Boom.forbidden(licenseCheckResults.message));
            }
          }
        ]
      };
      graphExploreRoute(server, commonRouteConfig);
      searchProxyRoute(server, commonRouteConfig);
    }
  });
};
