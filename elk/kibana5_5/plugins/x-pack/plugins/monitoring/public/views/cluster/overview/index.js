import uiRoutes from 'ui/routes';
import { uiModules } from 'ui/modules';
import { routeInitProvider } from 'plugins/monitoring/lib/route_init';
import template from './index.html';

uiRoutes.when('/overview', {
  template,
  resolve: {
    clusters(Private) {
      // checks license info of all monitored clusters for multi-cluster monitoring usage and capability
      const routeInit = Private(routeInitProvider);
      return routeInit();
    },
    cluster(monitoringClusters, globalState) {
      return monitoringClusters(globalState.cluster_uuid);
    }
  }
});

const uiModule = uiModules.get('monitoring', ['monitoring/directives']);
uiModule.controller('overview', ($injector, $scope) => {
  const timefilter = $injector.get('timefilter');
  timefilter.enabled = true;

  const $route = $injector.get('$route');
  $scope.cluster = $route.current.locals.cluster;

  const title = $injector.get('title');
  title($scope.cluster, 'Overview');

  const $executor = $injector.get('$executor');
  const monitoringClusters = $injector.get('monitoringClusters');
  const globalState = $injector.get('globalState');
  $executor.register({
    execute: () => monitoringClusters(globalState.cluster_uuid),
    handleResponse(cluster) {
      $scope.cluster = cluster;
    }
  });

  $executor.start();

  $scope.$on('$destroy', $executor.destroy);
});
