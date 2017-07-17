import { uiModules } from 'ui/modules';
import template from './watch_history_range_filter.html';

const app = uiModules.get('xpack/watcher');

app.directive('watchHistoryRangeFilter', function () {
  return {
    restrict: 'E',
    replace: true,
    template: template,
    scope: {
      historyRange: '=',
      onRangeChange: '=',
    },
    controllerAs: 'watchHistoryRangeFilter',
    bindToController: true,
    controller: class WatchHistoryRangeFilterController {
      constructor() {
        // avoid parent state mutation, since we have no one-way binding
        this.range = this.historyRange;
      }
    }
  };
});
