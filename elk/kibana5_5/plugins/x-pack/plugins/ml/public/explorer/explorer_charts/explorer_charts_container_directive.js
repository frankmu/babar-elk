/*
 * ELASTICSEARCH CONFIDENTIAL
 *
 * Copyright (c) 2017 Elasticsearch BV. All Rights Reserved.
 *
 * Notice: this software, and all information contained
 * therein, is the exclusive property of Elasticsearch BV
 * and its licensors, if any, and is protected under applicable
 * domestic and foreign law, and international treaties.
 *
 * Reproduction, republication or distribution without the
 * express written consent of Elasticsearch BV is
 * strictly prohibited.
 */

/*
 * AngularJS directive for rendering the containing div for the charts of
 * anomalies in the raw data in the Machine Learning Explorer dashboard.
 */

import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import rison from 'rison-node';

import chrome from 'ui/chrome';
import 'ui/timefilter';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlExplorerChartsContainer', function ($window, timefilter) {

  function link(scope, element) {
    // Create a div for the tooltip.
    $('.ml-explorer-charts-tooltip').remove();
    $('body').append('<div class="ml-explorer-tooltip ml-explorer-charts-tooltip" style="opacity:0">');

    element.on('$destroy', function () {
      scope.$destroy();
    });

    scope.exploreSeries = function (series) {
      // Open the Single Metric dashboard over the same overall bounds and
      // zoomed in  to the same time as the current chart.
      const bounds = timefilter.getActiveBounds();
      const from = bounds.min.toISOString();    // e.g. 2016-02-08T16:00:00.000Z
      const to = bounds.max.toISOString();

      const zoomFrom = moment(scope.plotEarliest).toISOString();
      const zoomTo = moment(scope.plotLatest).toISOString();

      // Pass the detector index and entity fields (i.e. by, over, partition fields)
      // to identify the particular series to view.
      // Initially pass them in the mlTimeSeriesExplorer part of the AppState.
      // TODO - do we want to pass the entities via the filter?
      const entityCondition = {};
      _.each(series.entityFields, (entity) => {
        entityCondition[entity.fieldName] = entity.fieldValue;
      });

      // Use rison to build the URL .
      const _g = rison.encode({
        ml: {
          jobIds: [series.jobId]
        },
        refreshInterval: {
          display: 'Off',
          pause: false,
          value: 0
        },
        time: {
          from: from,
          to: to,
          mode: 'absolute'
        }
      });

      const _a = rison.encode({
        mlTimeSeriesExplorer: {
          zoom: {
            from: zoomFrom,
            to: zoomTo
          },
          detectorIndex: series.detectorIndex,
          entities: entityCondition,
        },
        filters: [],
        query: {
          query_string: {
            analyze_wildcard: true,
            query: '*'
          }
        }
      });

      let path = chrome.getBasePath();
      path += '/app/ml#/timeseriesexplorer';
      path += '?_g=' + _g;
      path += '&_a=' + _a;
      $window.open(path, '_blank');

    };
  }

  return {
  	restrict: 'E',
    scope: {
      seriesToPlot: '=',
      plotEarliest: '=',
      plotLatest: '=',
      selectedEarliest: '=',
      selectedLatest: '=',
      chartsPerRow: '=',
      layoutCellsPerChart: '=',
      tooManyBuckets: '='
    },
    link: link,
    template: require('plugins/ml/explorer/explorer_charts/explorer_charts_container.html')
  };
});
