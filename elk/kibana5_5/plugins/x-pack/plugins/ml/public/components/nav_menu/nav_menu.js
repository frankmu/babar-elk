import _ from 'lodash';
import template from './nav_menu.html';
import chrome from 'ui/chrome';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlNavMenu', () => {
  return {
    restrict: 'E',
    transclude: true,
    template,
    link: function (scope, el, attrs) {

      // Tabs
      scope.name = attrs.name;

      scope.showTabs = false;
      if (scope.name === 'jobs' ||
          scope.name === 'timeseriesexplorer' ||
          scope.name === 'explorer') {
        scope.showTabs = true;
      }
      scope.isActiveTab = function (path) {
        return scope.name === path;
      };

      // Breadcrumbs
      const crumbNames = {
        jobs: { label: 'Job Management', url: '#/jobs' },
        new_job: { label: 'Create New Job', url: '#/jobs/new_job' },
        single_metric: { label: 'Single Metric Job', url: '#/jobs/new_job/simple/single_metric' },
        multi_metric: { label: 'Multi Metric job', url: '#/jobs/new_job/simple/multi_metric' },
        advanced: { label: 'Advanced Job Configuration', url: '#/jobs/new_job/advanced' },
        explorer: { label: 'Anomaly Explorer', url: '#/explorer' },
        timeseriesexplorer: { label: 'Single Metric Viewer', url: '#/timeseriesexplorer' },
      };

      const breadcrumbs = [{ label: 'Machine Learning', url: '#/' }];

      // get crumbs from url
      const crumbs = chrome.getBreadcrumbs();
      _.each(crumbs, (crumb) => {
        breadcrumbs.push(crumbNames[crumb]);
      });
      scope.breadcrumbs = breadcrumbs.filter(Boolean);
    }
  };
});
