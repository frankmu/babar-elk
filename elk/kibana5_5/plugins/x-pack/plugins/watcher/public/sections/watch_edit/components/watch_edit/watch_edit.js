import { uiModules } from 'ui/modules';
import { Notifier } from 'ui/notify/notifier';
import template from './watch_edit.html';
import 'plugins/watcher/components/kbn_tabs';
import 'plugins/watcher/components/watch_history_item_detail';
import '../watch_edit_detail';
import '../watch_edit_title_bar';
import '../watch_edit_execute_info_panel';
import '../watch_edit_execute_detail';
import '../watch_edit_actions_execute_summary';
import '../watch_edit_watch_execute_summary';
import 'plugins/watcher/services/license';

const app = uiModules.get('xpack/watcher');

app.directive('watchEdit', function ($injector) {
  const watchService = $injector.get('watchService');
  const licenseService = $injector.get('licenseService');
  const kbnUrl = $injector.get('kbnUrl');
  const confirmModal = $injector.get('confirmModal');

  return {
    restrict: 'E',
    template: template,
    scope: {
      watch: '=xpackWatch', // Property names differ due to https://git.io/vSWXV
    },
    bindToController: true,
    controllerAs: 'watchEdit',
    controller: class WatchEditController {
      constructor() {
        this.notifier = new Notifier({ location: 'Watcher' });
        this.selectedTabId = 'edit-watch';
        this.simulateResults = null;

        this.onExecuteDetailsValid();
      }

      onTabSelect = (tabId) => {
        this.selectedTabId = tabId;
      }

      isTabSelected = (tabId) => {
        return this.selectedTabId === tabId;
      }

      onWatchChange = (watch) => {
        this.watch = watch;
      }

      onValid = () => {
        this.isValid = true;
      }

      onInvalid = () => {
        this.isValid = false;
      }

      executeDetailsChange = (executeDetails) => {
        this.executeDetails = executeDetails;
      }

      onExecuteDetailsValid = () => {
        this.isExecuteValid = true;
      }

      onExecuteDetailsInvalid = () => {
        this.isExecuteValid = false;
      }

      onWatchExecute = () => {
        return watchService.executeWatch(this.executeDetails)
        .then((watchHistoryItem) => {
          this.simulateResults = watchHistoryItem;
          this.onTabSelect('simulate-results');
        })
        .catch(e => {
          this.notifier.error(e);
        });
      }

      onWatchSave = () => {
        if (!this.watch.isNew) {
          return this.saveWatch();
        }

        return this.isExistingWatch()
        .then(existingWatch => {
          if (!existingWatch) {
            return this.saveWatch();
          }

          const confirmModalOptions = {
            onConfirm: this.saveWatch,
            confirmButtonText: 'Overwrite Watch'
          };

          const watchNameMessageFragment = existingWatch.name ? ` (name: "${existingWatch.name}")` : '';
          const message = `Watch with ID "${this.watch.id}"${watchNameMessageFragment} already exists. Do you want to overwrite it?`;
          return confirmModal(message, confirmModalOptions);
        })
        .catch(err => this.notifier.error(err));
      }

      isExistingWatch = () => {
        return watchService.loadWatch(this.watch.id)
        .then(existingWatch => {
          return existingWatch;
        })
        .catch(err => {
          return licenseService.checkValidity()
          .then(() => {
            if (err.status === 404) {
              return false;
            }
            throw err;
          });
        });
      }

      saveWatch = () => {
        return watchService.saveWatch(this.watch)
        .then(() => {
          this.notifier.info(`Saved Watch "${this.watch.id}"`);
          this.onClose();
        })
        .catch(err => {
          return licenseService.checkValidity()
          .then(() => this.notifier.error(err));
        });
      }

      onWatchDelete = () => {
        const confirmModalOptions = {
          onConfirm: this.deleteWatch,
          confirmButtonText: 'Delete Watch'
        };

        return confirmModal('This will permanently delete the watch. Are you sure?', confirmModalOptions);
      }

      deleteWatch = () => {
        return watchService.deleteWatch(this.watch.id)
        .then(() => {
          this.notifier.info(`Deleted Watch "${this.watch.id}"`);
          this.onClose();
        })
        .catch(err => {
          return licenseService.checkValidity()
          .then(() => this.notifier.error(err));
        });
      }

      onClose = () => {
        kbnUrl.change('/management/elasticsearch/watcher/watches', {});
      }
    }
  };
});
