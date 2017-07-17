/**
 * Controller for Index Listing
 */
import { find, partial } from 'lodash';
import uiRoutes from 'ui/routes';
import { uiModules } from 'ui/modules';
import { routeInitProvider } from 'plugins/monitoring/lib/route_init';
import { ajaxErrorHandlersProvider } from 'plugins/monitoring/lib/ajax_error_handler';
import template from './index.html';

function getPageData($injector) {
  const $http = $injector.get('$http');
  const globalState = $injector.get('globalState');
  const url = `../api/monitoring/v1/clusters/${globalState.cluster_uuid}/elasticsearch/indices`;
  const features = $injector.get('features');
  const showSystemIndices = features.isEnabled('showSystemIndices', false);
  const timefilter = $injector.get('timefilter');
  const timeBounds = timefilter.getBounds();

  return $http.post(url, {
    showSystemIndices,
    timeRange: {
      min: timeBounds.min.toISOString(),
      max: timeBounds.max.toISOString()
    },
    listingMetrics: [
      'index_document_count',
      'index_size',
      'index_search_request_rate',
      'index_request_rate_primary'
    ]
  })
  .then(response => response.data)
  .catch((err) => {
    const Private = $injector.get('Private');
    const ajaxErrorHandlers = Private(ajaxErrorHandlersProvider);
    return ajaxErrorHandlers(err);
  });
}

uiRoutes.when('/elasticsearch/indices', {
  template,
  resolve: {
    clusters: function (Private) {
      const routeInit = Private(routeInitProvider);
      return routeInit();
    },
    pageData: getPageData
  }
});

const uiModule = uiModules.get('monitoring', [ 'monitoring/directives' ]);
uiModule.controller('indices', ($injector, $scope) => {
  const timefilter = $injector.get('timefilter');
  timefilter.enabled = true;

  const $route = $injector.get('$route');
  const globalState = $injector.get('globalState');
  $scope.cluster = find($route.current.locals.clusters, { cluster_uuid: globalState.cluster_uuid });
  $scope.pageData = $route.current.locals.pageData;

  const callPageData = partial(getPageData, $injector);

  // Control whether system indices shown in the index listing
  // shown by default, and setting is stored in localStorage
  const features = $injector.get('features');
  $scope.showSystemIndices = features.isEnabled('showSystemIndices', false);
  $scope.toggleShowSystemIndices = (isChecked) => {
    // flip the boolean
    $scope.showSystemIndices = isChecked;
    // preserve setting in localStorage
    features.update('showSystemIndices', isChecked);
    // update the page
    callPageData().then((pageData) => $scope.pageData = pageData);
  };

  const title = $injector.get('title');
  title($scope.cluster, 'Elasticsearch - Indices');

  const $executor = $injector.get('$executor');
  $executor.register({
    execute: () => callPageData(),
    handleResponse: (pageData) => $scope.pageData = pageData
  });

  $executor.start();

  $scope.$on('$destroy', $executor.destroy);
});
