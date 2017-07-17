import { uiModules } from 'ui/modules';
import { ajaxErrorHandlersProvider } from 'plugins/monitoring/lib/ajax_error_handler';

const uiModule = uiModules.get('monitoring/clusters');
uiModule.service('monitoringClusters', ($injector) => {
  return (clusterUuid) => {
    const timefilter = $injector.get('timefilter');
    const { min, max } = timefilter.getBounds();

    // append clusterUuid if the parameter is given
    let url = '../api/monitoring/v1/clusters';
    if (clusterUuid) {
      url += `/${clusterUuid}`;
    }

    const $http = $injector.get('$http');
    return $http.post(url, {
      timeRange: {
        min: min.toISOString(),
        max: max.toISOString()
      }
    })
    .then(response => response.data)
    .then(data => {
      if (clusterUuid) {
        return data[0]; // return single cluster
      }
      return data; // return set of clusters
    })
    .catch(err => {
      const Private = $injector.get('Private');
      const ajaxErrorHandlers = Private(ajaxErrorHandlersProvider);
      return ajaxErrorHandlers(err);
    });
  };
});
