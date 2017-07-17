import { find, get } from 'lodash';
import uiRoutes from 'ui/routes';
import template from './index.html';
import { routeInitProvider } from 'plugins/monitoring/lib/route_init';
import { ajaxErrorHandlersProvider } from 'plugins/monitoring/lib/ajax_error_handler';
import { formatTimestampToDuration } from 'plugins/monitoring/lib/format_number';

function getAlertData($injector) {
  const globalState = $injector.get('globalState');
  const $http = $injector.get('$http');
  const Private = $injector.get('Private');
  const url = `../api/monitoring/v1/clusters/${globalState.cluster_uuid}/alerts`;

  return $http.post(url)
  .then(response => get(response, 'data', []))
  .catch((err) => {
    const ajaxErrorHandlers = Private(ajaxErrorHandlersProvider);
    return ajaxErrorHandlers(err);
  });
}

uiRoutes.when('/alerts', {
  template,
  resolve: {
    clusters(Private) {
      const routeInit = Private(routeInitProvider);
      return routeInit();
    },
    alerts: getAlertData
  },
  controllerAs: 'alerts',
  controller($injector, $scope) {
    $injector.get('timefilter').enabled = false;

    const $route = $injector.get('$route');
    const globalState = $injector.get('globalState');
    $scope.cluster = find($route.current.locals.clusters, { cluster_uuid: globalState.cluster_uuid });

    const setData = (alerts) => {
      this.data = alerts.map(alert => {
        return {
          ...alert,
          since: formatTimestampToDuration(alert.timestamp)
        };
      });
    };
    setData($route.current.locals.alerts);

    const title = $injector.get('title');
    title($scope.cluster, 'Cluster Alerts');

    // poller for getting the latest data from the server
    const $interval = $injector.get('$interval');
    const alertPoller = $interval(() => {
      getAlertData($injector)
      .then(setData);
    }, 10 * 1000); // every 10 seconds
    $scope.$on('$destroy', () => $interval.cancel(alertPoller));
  }
});
