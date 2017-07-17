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
 * stacked bar chart showing event rate for each job.
 */

import _ from 'lodash';
import $ from 'jquery';
import d3 from 'd3';
import moment from 'moment';
import angular from 'angular';
import 'ui/timefilter';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlSummaryViewEventRate', function (
  $compile,
  $timeout,
  timefilter,
  mlJobService) {

  function link(scope, element) {
    let rendered = false;

    scope.$on('render',() => {
      if (!rendered) {
        rendered = true;
        render();
      }
    });

    element.on('$destroy', function () {
      scope.$destroy();
    });

    function render() {
      if (scope.chartData === undefined) {
        return;
      }

      let lanes = Object.keys(scope.chartData.data);

      const times = scope.chartData.times;
      const startTime = scope.chartData.earliest;
      const endTime = scope.chartData.latest;
      const stepSecs = scope.chartData.interval;
      let totalMax = 0;
      _.each(scope.chartData.max, (jobMax) => {
        totalMax += jobMax;
      });


      const data = {};
      _.each(times, (t) => {
        data[t] = {};
        _.each(scope.chartData.data, (job, jobId) => {
          if (job[t] !== undefined) {
            data[t][jobId] = job[t];
          }
        });
      });

      scope.chartWidth = scope.$parent.chartWidth;
      const numBuckets = parseInt((endTime - startTime) / stepSecs);

      const height = 100;

      const eventRateScale = d3.scale.linear().domain([0, totalMax]).range([0, height]);

      element.css('height', (height + 20) + 'px');

      const $eventrate = element.find('#eventrate');
      const $eventrateLegend = element.find('#eventrate-legend');
      $eventrate.empty();

      // console.log('chart',scope.chartWidth);
      const cellWidth = Math.floor(scope.chartWidth / numBuckets);
      let cellsPerTick = 1;
      if (cellWidth < 100) {
        const numTickLabels = scope.chartWidth / 100;
        cellsPerTick = Math.max(Math.floor(numBuckets / numTickLabels), 2);
      }

      const timeTickLabels = [];
      for (let i = 0; i < numBuckets; i += cellsPerTick) {
        timeTickLabels.push(moment.unix(startTime + (i * stepSecs)).format('MMM DD HH:mm'));
      }

      scope.$parent.lanes[scope.swimlaneType] = [];
      scope.lanes = scope.$parent.lanes;
      scope.laneMarkers = scope.$parent.laneMarkers;

      let monitorCellsContainer;

      function cellHover($event, index) {
        if (monitorCellsContainer === undefined) {
          monitorCellsContainer = angular.element('ml-summary-view-swimlane[swimlane-type="MONITOR"] .cells-container');
        }
        if (monitorCellsContainer !== undefined) {
          monitorCellsContainer.scope().hoverFuncs[index](scope.swimlaneType);
        }
      }
      scope.cellHover = cellHover;

      const color = d3.scale.category10();
      const jobColors = {};


      // dish out colurs before sorting by description so that the
      // naturally first job (the largest event count) has is blue.
      // because it looks nicer
      _.each(lanes, (job, id) => {
        jobColors[job] = color(id);
      });

      // sort jobs by description
      lanes = lanes.sort((a, b) => {
        return mlJobService.jobDescriptions[a] > mlJobService.jobDescriptions[b];
      });

      _.each(lanes, (job) => {
        // jobColors[job] = color(id);
        const desc = mlJobService.jobDescriptions[job];
        const $job = $('<div>', {
          'class': 'job',
          'data-tooltip': desc,
          html: '<div class="bullet" style="background-color:' + jobColors[job] + '"></div>' + desc
        });
        $eventrateLegend.append($job);
      });

      const $cellsMarkerContainer = $('<div>', {
        'class': 'cells-marker-container'
      });

      const cells = [];
      let time = startTime;
      for (let i = 0; i < numBuckets; i++) {
        const $cell = $('<div>', {
          'class': 'sl-cell',
          css: {
            'width': cellWidth + 'px'
          },
          html: '<div class="floating-time-label">' + (moment.unix(time).format('MMM DD HH:mm')) + '</div><i class="fa fa-caret-down"></i>'
        });
        $cellsMarkerContainer.append($cell);
        cells.push($cell);
        time += stepSecs;
      }
      scope.laneMarkers.push({ swimlaneType: scope.swimlaneType, lane: cells });
      $eventrate.append($cellsMarkerContainer);

      const $cellsContainer = $('<div>', {
        'class': 'cells-container'
      });
      $eventrate.append($cellsContainer);

      time = startTime;
      for (let i = 0; i < numBuckets; i++) {
        const $cell = $('<div>', {
          'class': 'sl-cell',
          css: {
            'width': cellWidth + 'px'
          },
          'data-lane-label': scope.swimlaneType,
          'data-time': time,

        });

        $cell.attr({
          'ng-mouseover': 'cellHover($event, ' + i + ', ' + time + ')',
        });
        $cellsContainer.append($cell);
        time += stepSecs;
        scope.lanes[scope.swimlaneType].push($cell);
      }

      const barWidth = (cellWidth * numBuckets) / times.length;

      _.each(times, (t) => {
        const $col = $('<div>', {
          'class': 'col',
          css: {
            'width': barWidth + 'px',
            'height': height + 'px'
          },
          'data-time': t
        });

        const d = data[t];
        if (d !== undefined) {
          let lastH = 0;
          _.each(d, (job, jobId) => {
            let h = eventRateScale(job);
            h = Math.round((h * 100)) / 100;
            const $jobBar = $('<div>', {
              'class': 'job-bar',
              css: {
                'width': (barWidth - 1) + 'px',
                'height': h + 'px',
                'top': height - lastH - h + 'px',
                'background-color': jobColors[jobId],
              },
              'data-time': t
            });
            $col.append($jobBar);
            lastH += h;
          });
        }

        $eventrate.append($col);
      });

      const $laneTimes = $('<div>', {
        'class': 'time-tick-labels'
      });
      _.each(timeTickLabels, (label, i) => {
        $laneTimes.append($('<span>', {
          'class': 'tick-label',
          'text': label,
          'css': {
            'margin-left': (i * cellWidth * cellsPerTick) + 'px'
          }
        }));
      });

      $eventrate.append($laneTimes);

      $compile($eventrate)(scope);
      $compile($eventrateLegend)(scope);
    }
  }

  return {
    scope: {
      chartTitle: '@',
      chartData: '=',
      expansionDirective: '@',
      expansionChartData: '=',
      swimlaneType: '@',
      containerId: '@',
      selectedJobIds: '=',
      expanded: '=',
      chartWidth: '@',
    },
    link: link,
    template: '<div><div id="eventrate-legend"></div><div id="eventrate"></div></div>'
  };
});
