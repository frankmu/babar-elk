import uiRoutes from 'ui/routes';
import uiChrome from 'ui/chrome';
import template from './index.html';

uiRoutes.when('/access-denied', {
  template,
  controllerAs: 'accessDenied',
  controller($window, kbnUrl, kbnBaseUrl) {
    this.goToKibana = () => {
      $window.location.href = uiChrome.getBasePath() + kbnBaseUrl;
    };

    this.retry = () => {
      return kbnUrl.redirect('/home');
    };
  }
});
