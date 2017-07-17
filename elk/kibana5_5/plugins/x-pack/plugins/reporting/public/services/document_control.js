import chrome from 'ui/chrome';
import rison from 'rison-node';
import { uiModules } from 'ui/modules';

uiModules.get('xpack/reporting')
.service('reportingDocumentControl', function (Private, $http) {
  const mainEntry = '/api/reporting/generate';
  const reportPrefix = chrome.addBasePath(mainEntry);

  const getJobParams = (exportType) => {
    const jobParamsProvider = Private(exportType.JobParamsProvider);
    return jobParamsProvider();
  };

  this.getPath = (exportType) => {
    const jobParams = getJobParams(exportType);
    return `${reportPrefix}/${exportType.id}?jobParams=${rison.encode(jobParams)}`;
  };

  this.create = (exportType) => {
    const path = this.getPath(exportType);
    return $http.post(path, {});
  };
});
