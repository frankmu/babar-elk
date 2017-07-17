import { get } from 'lodash';
import 'plugins/reporting/services/document_control';
import 'plugins/reporting/services/export_types';
import './export_config.less';
import template from 'plugins/reporting/directives/export_config/export_config.html';
import { Notifier } from 'ui/notify/notifier';
import { uiModules } from 'ui/modules';
import url from 'url';

const module = uiModules.get('xpack/reporting');

module.directive('exportConfig', (reportingDocumentControl, reportingExportTypes, $location) => {
  const reportingNotifier = new Notifier({ location: 'Reporting' });

  return {
    restrict: 'E',
    scope: {},
    require: ['?^dashboardApp', '?^visualizeApp', '?^discoverApp'],
    controllerAs: 'exportConfig',
    template,
    link($scope, $el, $attr, controllers) {
      const exportTypeId = $attr.enabledExportType;
      $scope.exportConfig.exportType = reportingExportTypes.getById(exportTypeId);
      $scope.exportConfig.isDirty = () => controllers.some(ctrl => get(ctrl, 'appStatus.dirty', false));
      $scope.exportConfig.objectType = $attr.objectType;
      $scope.exportConfig.link = url.resolve($location.absUrl(), reportingDocumentControl.getPath($scope.exportConfig.exportType));
    },
    controller($document) {
      this.export = (type) => {
        reportingDocumentControl.create(type)
        .then(() => {
          reportingNotifier.info(`${this.objectType} generation has been queued. You can track its progress under Management.`);
        })
        .catch((err) => {
          if (err.message === 'not exportable') {
            return reportingNotifier.warning('Only saved dashboards can be exported. Please save your work first.');
          }

          reportingNotifier.error(err);
        });
      };

      this.copyToClipboard = selector => {
        // Select the text to be copied. If the copy fails, the user can easily copy it manually.
        const copyTextarea = $document.find(selector)[0];
        copyTextarea.select();

        try {
          const isCopied = document.execCommand('copy');
          if (isCopied) {
            reportingNotifier.info('URL copied to clipboard.');
          } else {
            reportingNotifier.info('URL selected. Press Ctrl+C to copy.');
          }
        } catch (err) {
          reportingNotifier.info('URL selected. Press Ctrl+C to copy.');
        }
      };
    }
  };
});
