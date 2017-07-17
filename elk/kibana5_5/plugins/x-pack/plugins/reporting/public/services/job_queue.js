import url from 'url';
import { set } from 'lodash';
import { XPackInfoProvider } from 'plugins/xpack_main/services/xpack_info';
import { Notifier } from 'ui/notify/notifier';
import { uiModules } from 'ui/modules';
import { addSystemApiHeader } from 'ui/system_api';

const module = uiModules.get('xpack/reporting');

module.service('reportingJobQueue', ($http, kbnUrl, Private) => {
  const xpackInfo = Private(XPackInfoProvider);
  const baseUrl = '../api/reporting/jobs';
  const genericNotifier = new Notifier({ location: 'Reporting' });

  function licenseAllowsToShowThisPage() {
    return xpackInfo.get('features.reporting.showLinks')
      && xpackInfo.get('features.reporting.enableLinks');
  }

  function notifyAndRedirectToManagementOverviewPage() {
    genericNotifier.error(xpackInfo.get('features.reporting.message'));
    kbnUrl.redirect('/management');
    return Promise.reject();
  }

  function showError(err) {
    if (!licenseAllowsToShowThisPage()) {
      return notifyAndRedirectToManagementOverviewPage();
    }
    const msg = err.statusText || 'Request failed';
    genericNotifier.error(msg);
    throw err;
  }

  return {
    list(page = 0, showAll = false) {
      const urlObj = {
        pathname: `${baseUrl}/list`,
        query: { page }
      };

      if (showAll) {
        set(urlObj, 'query.all',  true);
      }

      const headers = addSystemApiHeader({});
      return $http.get(url.format(urlObj), { headers })
      .catch(showError)
      .then((res) => res.data);
    },

    total(showAll = false) {
      const urlObj = { pathname: `${baseUrl}/count` };

      if (showAll) {
        set(urlObj, 'query.all',  true);
      }

      const headers = addSystemApiHeader({});
      return $http.get(url.format(urlObj), { headers })
      .then((res) => res.data)
      .catch(showError);
    },

    getContent(jobId) {
      const urlObj = { pathname: `${baseUrl}/output/${jobId}` };
      return $http.get(url.format(urlObj))
      .then((res) => res.data)
      .catch(showError);
    }
  };
});
