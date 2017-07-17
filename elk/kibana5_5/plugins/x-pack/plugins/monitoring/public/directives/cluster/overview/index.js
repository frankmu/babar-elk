import React from 'react';
import ReactDOM from 'react-dom';
import { Overview } from 'plugins/monitoring/components/cluster/overview';
import { uiModules } from 'ui/modules';

const uiModule = uiModules.get('monitoring/directives', []);
uiModule.directive('monitoringClusterOverview', function (kbnUrl, showLicenseExpiration) {
  return {
    restrict: 'E',
    scope: { cluster: '=' },
    link(scope, $el) {
      ReactDOM.render((
        <Overview
          scope={ scope }
          kbnUrl={ kbnUrl }
          showLicenseExpiration={ showLicenseExpiration }
        ></Overview>
      ), $el[0]);
    }
  };
});
