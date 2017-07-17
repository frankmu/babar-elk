import { uiModules } from 'ui/modules';
import template from './flot_chart.html';
import './flot_chart.less';
import $ from 'jquery-flot'; // webpackShim

const app = uiModules.get('xpack/watcher');

app.directive('flotChart', function () {
  return {
    restrict: 'E',
    replace: true,
    template: template,
    scope: {

      // See https://github.com/flot/flot/blob/master/API.md#data-format
      data: '=',

      // See https://github.com/flot/flot/blob/master/API.md#plot-options
      options: '='
    },
    controllerAs: 'flotChart',
    bindToController: true,
    link: ($scope, element) => {
      $.plot(element, $scope.flotChart.data, $scope.flotChart.options);
    },
    controller: class FlotChartController {
      constructor() {}
    }
  };
});
