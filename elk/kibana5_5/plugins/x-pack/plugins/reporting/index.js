import { resolve } from 'path';
import { has } from 'lodash';
import { mirrorPluginStatus } from '../../server/lib/mirror_plugin_status';
import { main as mainRoutes } from './server/routes/main';
import { jobs as jobRoutes } from './server/routes/jobs';

import { phantom } from './server/lib/phantom';
import { createQueueFactory } from './server/lib/create_queue';
import { config as appConfig } from './server/config/config';
import { checkLicenseFactory } from './server/lib/check_license';
import { validateConfig } from './server/lib/validate_config';
import { ExtractError } from './server/lib/extract';
import { createExportTypesRegistryFactory } from './server/lib/create_export_types_registry';

export const reporting = (kibana) => {
  return new kibana.Plugin({
    id: 'reporting',
    configPrefix: 'xpack.reporting',
    publicDir: resolve(__dirname, 'public'),
    require: ['kibana', 'elasticsearch', 'xpack_main'],

    uiExports: {
      navbarExtensions: [
        'plugins/reporting/controls/discover',
        'plugins/reporting/controls/visualize',
        'plugins/reporting/controls/dashboard',
      ],
      hacks: [ 'plugins/reporting/hacks/job_completion_notifier'],
      managementSections: ['plugins/reporting/views/management'],
    },

    config: function (Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
        kibanaApp: Joi.string().regex(/^\//).default('/app/kibana'),
        kibanaServer: Joi.object({
          protocol: Joi.string().valid(['http', 'https']),
          hostname: Joi.string(),
          port: Joi.number().integer()
        }).default(),
        queue: Joi.object({
          indexInterval: Joi.string().default('week'),
          pollInterval: Joi.number().integer().default(3000),
          timeout: Joi.number().integer().default(30000),
          syncSocketTimeout: Joi.number().integer(),
        }).default(),
        generate: Joi.object({
          socketTimeout: Joi.number().integer(),
        }).default(),
        capture: Joi.object({
          zoom: Joi.number().integer().default(2),
          viewport: Joi.object({
            width: Joi.number().integer().default(1950),
            height: Joi.number().integer().default(1200)
          }).default(),
          timeout: Joi.number().integer().default(20000),
          loadDelay: Joi.number().integer().default(3000),
          settleTime: Joi.number().integer().default(1000),
          concurrency: Joi.number().integer().default(appConfig.concurrency),
        }).default(),
        encryptionKey: Joi.string(),
        index: Joi.string().default('.reporting')
      }).default();
    },

    init: async function (server) {
      const createExportTypesRegistry = createExportTypesRegistryFactory(server);
      const exportTypesRegistry = await createExportTypesRegistry(resolve(__dirname, './export_types/*/server/index.js'));
      server.expose('exportTypesRegistry', exportTypesRegistry);

      const config = server.config();
      validateConfig(config, message => server.log(['reporting', 'warning'], message));

      const xpackMainPlugin = server.plugins.xpack_main;
      mirrorPluginStatus(xpackMainPlugin, this);
      const checkLicense = checkLicenseFactory(exportTypesRegistry);
      xpackMainPlugin.status.once('green', () => {
        // Register a function that is called whenever the xpack info changes,
        // to re-compute the license check results for this plugin
        xpackMainPlugin.info.feature(this.id).registerLicenseCheckResultsGenerator(checkLicense);
      });

      function setup() {
        // prepare phantom binary
        return phantom.install(config.get('path.data'))
          .then((phantomPackage) => {
            server.log(['reporting', 'debug'], `Phantom installed at ${phantomPackage.binary}`);

            // intialize and register application components
            server.expose('phantom', phantomPackage);
            server.expose('queue', createQueueFactory(server));

            // Reporting routes
            mainRoutes(server);
            jobRoutes(server);
          })
          .catch((err) => {
            server.log(['reporting', 'error'], err);

            if (!err instanceof ExtractError) {
              this.status.red('Failed to install phantom.js. See kibana logs for more details.');
              return;
            }

            server.log(['reporting', 'error'], err.cause);

            if (['EACCES', 'EEXIST'].includes(err.cause.code)) {
              this.status.red(
                'Insufficient permissions for extracting the phantom.js archive. ' +
                'Make sure the Kibana data directory (path.data) is owned by the same user that is running Kibana.'
              );
            } else {
              this.status.red('Failed to extract the phantom.js archive. See kibana logs for more details.');
            }
          });
      }

      return setup();
    },

    deprecations: function () {
      return [
        (settings, log) => {
          if (has(settings, 'capture.concurrency')) {
            log('Config key "capture.concurrency" is no longer used and is now deprecated. It can be removed entirely.');
          }
        }
      ];
    },
  });
};
