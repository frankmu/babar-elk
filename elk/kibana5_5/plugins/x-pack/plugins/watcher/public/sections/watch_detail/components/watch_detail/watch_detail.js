import { uiModules } from 'ui/modules';
import moment from 'moment-timezone';
import { Notifier } from 'ui/notify/notifier';
import 'ui/config';
import 'ui/url';
import 'ui/table_info';
import 'plugins/watcher/components/tool_bar_selected_count';
import 'plugins/watcher/services/watch';
import 'plugins/watcher/services/license';

import template from './watch_detail.html';
import '../watch_history';
import '../action_status_table';
import { REFRESH_INTERVALS } from 'plugins/watcher/../common/constants';

const app = uiModules.get('xpack/watcher');

app.directive('watchDetail', function ($injector) {
  const watchService = $injector.get('watchService');
  const licenseService = $injector.get('licenseService');

  const config = $injector.get('config');
  const kbnUrl = $injector.get('kbnUrl');
  const confirmModal = $injector.get('confirmModal');
  const $interval = $injector.get('$interval');

  const $filter = $injector.get('$filter');
  const orderBy = $filter('orderBy');

  moment.tz.setDefault(config.get('dateFormat:tz'));

  return {
    restrict: 'E',
    template: template,
    scope: {
      watch: '=xpackWatch', // Property names differ due to https://git.io/vSWXV
      initialHistoryRange: '=',
      watchHistoryItems: '='
    },
    bindToController: true,
    controllerAs: 'watchDetail',
    controller: class WatchDetailController {
      constructor($scope) {
        this.notifier = new Notifier({ location: 'Watcher' });

        // history settings
        this.isHistoryLoading = false;
        this.historyRange = this.initialHistoryRange;

        this.actionStatusTableSortField = 'id';
        this.actionStatusTableSortReverse = false;

        // Reload watch history periodically
        const refreshInterval = $interval(() => this.loadWatchHistory(), REFRESH_INTERVALS.WATCH_HISTORY);
        $scope.$on('$destroy', () => $interval.cancel(refreshInterval));

        // react to data and UI changes
        $scope.$watchMulti([
          'watchDetail.actionStatusTableSortField',
          'watchDetail.actionStatusTableSortReverse',
        ], this.applySortToActionStatusTable);
      }

      loadWatchHistory = () => {
        return watchService.loadWatchHistory(this.watch.id, this.historyRange)
        .then(watchHistoryItems => {
          this.isHistoryLoading = false;
          this.watchHistoryItems = watchHistoryItems;
        })
        .catch(err => {
          return licenseService.checkValidity()
          .then(() => this.notifier.error(err));
        });
      }

      // update the watch history items when the time range changes
      onHistoryRangeChange = (range) => {
        this.historyRange = range;
        this.isHistoryLoading = true;
        return this.loadWatchHistory();
      };

      /**
       * Action status table methods
       */

      get hasActionStatusTableActions() {
        return this.sortedActionStatuses.length > 0;
      }

      onActionSortChange = (field, reverse) => {
        this.actionStatusTableSortField = field;
        this.actionStatusTableSortReverse = reverse;
      };

      applySortToActionStatusTable = () => {
        this.sortedActionStatuses = orderBy(
          this.watch.watchStatus.actionStatuses,
          this.actionStatusTableSortField,
          this.actionStatusTableSortReverse
        );
      };

      onActionAcknowledge = (actionStatus) => {
        return watchService.acknowledgeWatchAction(this.watch.id, actionStatus.id)
        .then(watchStatus => {
          this.watch.updateWatchStatus(watchStatus);
          this.applySortToActionStatusTable();
        })
        .catch(err => {
          return licenseService.checkValidity()
          .then(() => this.notifier.error(err));
        });
      }

      /**
       * Event handler methods
       */

      onWatchDeactivate = () => {
        return watchService.deactivateWatch(this.watch.id)
        .then(watchStatus => {
          this.watch.updateWatchStatus(watchStatus);
        })
        .catch(err => {
          return licenseService.checkValidity()
          .then(() => this.notifier.error(err));
        });
      };

      onWatchActivate = () => {
        return watchService.activateWatch(this.watch.id)
        .then(watchStatus => {
          this.watch.updateWatchStatus(watchStatus);
        })
        .catch(err => {
          return licenseService.checkValidity()
          .then(() => this.notifier.error(err));
        });
      }

      onWatchDelete = () => {
        const confirmModalOptions = {
          confirmButtonText: 'Delete Watch',
          onConfirm: this.deleteWatch
        };

        return confirmModal('This will permanently delete the watch. Are you sure?', confirmModalOptions);
      }

      deleteWatch = () => {
        return watchService.deleteWatch(this.watch.id)
        .then(() => {
          this.notifier.info(`Deleted Watch "${this.watch.id}"`);
          this.close();
        })
        .catch(err => {
          return licenseService.checkValidity()
          .then(() => this.notifier.error(err));
        });
      }

      close = () => {
        kbnUrl.change('/management/elasticsearch/watcher/watches', {});
      }
    }
  };
});
