import { uiModules } from 'ui/modules';
import template from './watch_history_item.html';

import 'plugins/watcher/components/watch_history_item_detail';
import '../watch_history_item_watch_summary';
import '../watch_history_item_actions_summary';

const app = uiModules.get('xpack/watcher');

app.directive('watchHistoryItem', function () {
  return {
    restrict: 'E',
    template: template,
    scope: {
      watch: '=xpackWatch', // Property names differ due to https://git.io/vSWXV
      watchHistoryItem: '=',
    },
    bindToController: true,
    controllerAs: 'watchHistoryItem',
    controller: class WatchHistoryItemController {
    }
  };
});
