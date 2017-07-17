import routes from 'ui/routes';
import 'ui/url';
import { Notifier } from 'ui/notify/notifier';
import template from './watch_edit_route.html';
import 'plugins/watcher/services/watch';
import './components/watch_edit';
import { updateWatchSections } from 'plugins/watcher/lib/update_management_sections';
import 'plugins/watcher/services/license';

routes
.when('/management/elasticsearch/watcher/watches/watch/:id/edit')
.when('/management/elasticsearch/watcher/watches/new-watch')
.defaults(/management\/elasticsearch\/watcher\/watches\/(new-watch|watch\/:id\/edit)/, {
  template: template,
  controller: class WatchEditRouteController {
    constructor($injector) {
      const $route = $injector.get('$route');
      this.watch = $route.current.locals.watch;
    }
  },
  controllerAs: 'watchEditRoute',
  resolve: {
    watchTabs: ($injector) => {
      const $route = $injector.get('$route');
      const watchId = $route.current.params.id;
      updateWatchSections(watchId);
    },
    watch: function ($injector) {
      const $route = $injector.get('$route');
      const watchService = $injector.get('watchService');
      const licenseService = $injector.get('licenseService');
      const kbnUrl = $injector.get('kbnUrl');

      const notifier = new Notifier({ location: 'Watcher' });

      const watchId = $route.current.params.id;

      if (!watchId) {
        return watchService.newWatch()
        .catch(err => {
          return licenseService.checkValidity()
          .then(() => {
            if (err.status !== 403) {
              notifier.error(err);
            }

            kbnUrl.redirect('/management/elasticsearch/watcher/watches');
            return Promise.reject();
          });
        });
      }

      return watchService.loadWatch(watchId)
      .catch(err => {
        return licenseService.checkValidity()
        .then(() => {
          if (err.status !== 403) {
            notifier.error(err);
          }

          kbnUrl.redirect('/management/elasticsearch/watcher/watches');
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
