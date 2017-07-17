import { Notifier } from 'ui/notify/notifier';
import { uiModules } from 'ui/modules';
import { PathProvider } from 'plugins/xpack_main/services/path';
import { CONFIG_SHOW_BANNER, CONFIG_ALLOW_REPORT } from 'monitoring-constants';

function renderBanner($injector) {
  const config = $injector.get('config');
  const notify = new Notifier('X-Pack');
  const directive = {
    template: (`
      <h3>Welcome to X-Pack!</h3>
      <p>
        Sharing your cluster statistics with us helps us improve. Your data is never shared with anyone.
        <span ng-switch="welcome.allowReport">
          <span ng-switch-when="true">
            Not interested? <a ng-click="welcome.toggleOpt({ allowReport: false })">Opt out here</a>.
          </span>
          <span ng-switch-default>
            <a ng-click="welcome.toggleOpt({ allowReport: true })">Opt in here</a>.
          </span>
        </span>
      </p>
    `),
    controllerAs: 'welcome',
    controller() {
      this.allowReport = config.get(CONFIG_ALLOW_REPORT, true); // initialize

      this.toggleOpt = ({ allowReport }) => {
        this.allowReport = allowReport;
        config.set(CONFIG_ALLOW_REPORT, allowReport);
      };
    }
  };

  notify.directive(directive, {
    type: 'banner',
    lifetime: Infinity,
    actions: [{
      text: 'Dismiss',
      callback() {
        return config.set(CONFIG_SHOW_BANNER, false);
      }
    }]
  });
}

function customBanner($injector, _renderBanner = renderBanner) {
  const reportStats = $injector.get('reportStats');
  // exit if the server config has phone home disabled
  if (!reportStats) {
    return;
  }

  // no banner for non-logged in users
  const Private = $injector.get('Private');
  if (Private(PathProvider).isLoginOrLogout()) { return; }

  const config = $injector.get('config');
  if (config.get(CONFIG_SHOW_BANNER, true)) {
    return _renderBanner($injector);
  }
}

uiModules.get('monitoring/hacks').run(customBanner);
