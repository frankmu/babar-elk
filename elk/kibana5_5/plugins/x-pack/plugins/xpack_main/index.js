import { join, resolve } from 'path';
import { XPACK_INFO_API_DEFAULT_POLL_FREQUENCY_IN_MILLIS } from '../../server/lib/constants';
import { mirrorPluginStatus } from '../../server/lib/mirror_plugin_status';
import { requireAllAndApply } from '../../server/lib/require_all_and_apply';
import { replaceInjectedVars } from './server/lib/replace_injected_vars';
import { setupXPackMain } from './server/lib/setup_xpack_main';
import { xpackInfo } from '../../server/lib/xpack_info';

export const xpackMain = (kibana) => {
  return new kibana.Plugin({
    id: 'xpack_main',
    configPrefix: 'xpack.xpack_main',
    publicDir: resolve(__dirname, 'public'),
    require: ['elasticsearch'],

    config: function (Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
        xpack_api_polling_frequency_millis: Joi.number().default(XPACK_INFO_API_DEFAULT_POLL_FREQUENCY_IN_MILLIS),
      }).default();
    },

    uiExports: {
      hacks: [
        'plugins/xpack_main/hacks/check_xpack_info_change',
      ],
      replaceInjectedVars
    },

    init: function (server) {
      const elasticsearchPlugin = server.plugins.elasticsearch;
      mirrorPluginStatus(elasticsearchPlugin, this, 'yellow', 'red');
      elasticsearchPlugin.status.on('green', () => setupXPackMain(server, this, xpackInfo));

      return requireAllAndApply(join(__dirname, 'server', 'routes', '**', '*.js'), server);
    }
  });
};
