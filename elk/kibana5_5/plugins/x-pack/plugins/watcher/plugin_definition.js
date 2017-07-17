import { resolve } from 'path';
import { registerHistoryRoutes } from './server/routes/api/history';
import { registerWatchesRoutes } from './server/routes/api/watches';
import { registerWatchRoutes } from './server/routes/api/watch';
import { registerLicenseChecker } from './server/lib/register_license_checker';
import { PLUGIN } from './common/constants';

export const pluginDefinition = {
  id: PLUGIN.ID,
  configPrefix: 'xpack.watcher',
  publicDir: resolve(__dirname, 'public'),
  require: ['kibana', 'elasticsearch', 'xpack_main'],
  uiExports: {
    managementSections: [
      'plugins/watcher/sections/testbed',
      'plugins/watcher/sections/watch_detail',
      'plugins/watcher/sections/watch_edit',
      'plugins/watcher/sections/watch_list',
      'plugins/watcher/sections/watch_history_item',
    ]
  },
  init: function (server) {
    registerLicenseChecker(server);

    registerHistoryRoutes(server);
    registerWatchesRoutes(server);
    registerWatchRoutes(server);
  }
};