import uiRoutes from 'ui/routes';
import { uiModules } from 'ui/modules';
import template from './index.html';

uiRoutes.when('/no-data', {
  template,
  resolve: {
    clusters: ($injector) => {
      const monitoringClusters = $injector.get('monitoringClusters');
      const kbnUrl = $injector.get('kbnUrl');

      return monitoringClusters()
      .then(clusters => {
        if (clusters.length) {
          kbnUrl.changePath('/home');
          return Promise.reject();
        }
        return Promise.resolve();
      });
    }
  }
})
.otherwise({ redirectTo: '/home' });

const uiModule = uiModules.get('monitoring', [ 'monitoring/directives' ]);
uiModule.controller('noData', ($injector, $scope) => {
  $scope.hasData = false; // control flag to control a redirect
  const timefilter = $injector.get('timefilter');
  timefilter.enabled = true;

  const $executor = $injector.get('$executor');
  timefilter.on('update', () => {
    // re-fetch if they change the time filter
    $executor.run();
  });

  $scope.$watch('hasData', hasData => {
    if (hasData) {
      const kbnUrl = $injector.get('kbnUrl');
      kbnUrl.redirect('/home');
    }
  });

  // Register the monitoringClusters service.
  const monitoringClusters = $injector.get('monitoringClusters');
  $executor.register({
    execute: function () {
      return monitoringClusters();
    },
    handleResponse: function (clusters) {
      if (clusters.length) {
        // use the control flag because we can't redirect from inside here
        $scope.hasData = true;
      }
    }
  });

  // Start the executor
  $executor.start();

  // Destory the executor
  $scope.$on('$destroy', $executor.destroy);
});
