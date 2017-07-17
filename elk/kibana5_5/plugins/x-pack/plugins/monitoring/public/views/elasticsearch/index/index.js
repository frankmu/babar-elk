/**
 * Controller for single index detail
 */
import { find } from 'lodash';
import uiRoutes from 'ui/routes';
import { uiModules } from 'ui/modules';
import { routeInitProvider } from 'plugins/monitoring/lib/route_init';
import { ajaxErrorHandlersProvider } from 'plugins/monitoring/lib/ajax_error_handler';
import template from './index.html';

uiRoutes.when('/elasticsearch/indices/:index', {
  template,
  resolve: {
    clusters: function (Private) {
      const routeInit = Private(routeInitProvider);
      return routeInit();
    },
    pageData: getPageData
  }
});

function getPageData($injector) {
  const $http = $injector.get('$http');
  const $route = $injector.get('$route');
  const globalState = $injector.get('globalState');
  const url = `../api/monitoring/v1/clusters/${globalState.cluster_uuid}/elasticsearch/indices/${$route.current.params.index}`;
  const timefilter = $injector.get('timefilter');
  const timeBounds = timefilter.getBounds();

  return $http.post(url, {
    timeRange: {
      min: timeBounds.min.toISOString(),
      max: timeBounds.max.toISOString()
    },
    metrics: [
      'index_search_request_rate',
      {
        name: 'index_request_rate',
        keys: [
          'index_request_rate_total',
          'index_request_rate_primary'
        ]
      },
      'index_size',
      {
        name: 'index_mem',
        keys: [ 'index_mem_overall' ],
        config: 'xpack.monitoring.chart.elasticsearch.index.index_memory'
      },
      'index_document_count',
      {
        name: 'index_segment_count',
        keys: [
          'index_segment_count_primaries',
          'index_segment_count_total'
        ]
      }
    ]
  })
  .then(response => response.data)
  .catch((err) => {
    const Private = $injector.get('Private');
    const ajaxErrorHandlers = Private(ajaxErrorHandlersProvider);
    return ajaxErrorHandlers(err);
  });
}

const uiModule = uiModules.get('monitoring', []);
uiModule.controller('esIndex', ($injector, $scope) => {
  const timefilter = $injector.get('timefilter');
  timefilter.enabled = true;

  const $route = $injector.get('$route');
  const globalState = $injector.get('globalState');
  $scope.cluster = find($route.current.locals.clusters, { cluster_uuid: globalState.cluster_uuid });
  $scope.pageData = $route.current.locals.pageData;
  $scope.indexName = $route.current.params.index;

  const title = $injector.get('title');
  title($scope.cluster, `Elasticsearch - Indices - ${$scope.indexName} - Overview`);

  const $executor = $injector.get('$executor');
  $executor.register({
    execute: () => getPageData($injector),
    handleResponse: (response) => $scope.pageData = response
  });

  $executor.start();

  $scope.$on('$destroy', $executor.destroy);
});
