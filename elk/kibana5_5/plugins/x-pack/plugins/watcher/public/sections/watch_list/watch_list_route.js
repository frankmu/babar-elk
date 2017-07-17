import routes from 'ui/routes';
import { management } from 'ui/management';
import { Notifier } from 'ui/notify/notifier';
import template from './watch_list_route.html';
import './components/watch_list';
import 'plugins/watcher/services/license';

routes
.when('/management/elasticsearch/watcher/', {
  redirectTo: '/management/elasticsearch/watcher/watches/'
});

routes
.when('/management/elasticsearch/watcher/watches/', {
  template: template,
  controller: class WatchListRouteController {
    constructor($injector) {
      const $route = $injector.get('$route');
      this.watches = $route.current.locals.watches;
    }
  },
  controllerAs: 'watchListRoute',
  resolve: {
    watches: ($injector) => {
      const watchesService = $injector.get('watchesService');
      const licenseService = $injector.get('licenseService');
      const kbnUrl = $injector.get('kbnUrl');
      const notifier = new Notifier({ location: 'Watcher' });

      return watchesService.getWatchList()
      .catch(err => {
        return licenseService.checkValidity()
        .then(() => {
          if (err.status === 403) {
            return null;
          }

          notifier.error(err);
          kbnUrl.redirect('/management');
          return Promise.reject();
        });
      });
    },
    checkLicense: ($injector) => {
      const licenseService = $injector.get('licenseService');
      return licenseService.checkValidity();
    }
  }
});

routes.defaults(/\/management/, {
  resolve: {
    watcherManagementSection: ($injector) => {
      const licenseService = $injector.get('licenseService');
      const watchesSection = management.getSection('elasticsearch/watcher');

      if (licenseService.showLinks) {
        watchesSection.show();
      } else {
        watchesSection.hide();
      }

      if (licenseService.enableLinks) {
        watchesSection.enable();
        watchesSection.tooltip = '';
      } else {
        watchesSection.disable();
        watchesSection.tooltip = licenseService.message;
      }
    }
  }
});
