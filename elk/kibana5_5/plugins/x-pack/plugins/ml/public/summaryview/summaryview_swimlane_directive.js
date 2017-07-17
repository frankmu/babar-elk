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
 * Swimlane showing record score by detector.
 */

import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import 'ui/timefilter';

import { getSeverityColor } from 'plugins/ml/util/anomaly_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlSummaryViewSwimlane', function (
  $compile,
  $timeout,
  timefilter,
  mlJobService,
  mlAnomalyRecordDetailsService,
  mlSwimlaneInspectorService,
  mlSwimlaneSelectionService) {

  const SWIMLANE_TYPES = mlAnomalyRecordDetailsService.type;

  function link(scope, element) {
    let rendered = false;

    scope.$on('render',function () {
      if (!rendered) {
        rendered = true;
        render();
      }
    });

    element.on('$destroy', function () {
      scope.$destroy();
    });

    scope.toggleRow = function () {
      scope.expanded = !scope.expanded;
    };

    if (scope.chartData !== undefined) {
      // render();
    }

    function render() {
      if (scope.chartData === undefined) {
        return;
      }

      const INSPECTOR_MODE = (SWIMLANE_TYPES[scope.swimlaneType] === SWIMLANE_TYPES.INSPECTOR);

      let lanes = scope.chartData.laneLabels;
      const startTime = scope.chartData.earliest;
      const endTime = scope.chartData.latest;
      const stepSecs = scope.chartData.interval;
      const points = scope.chartData.points;

      function colorScore(d) {
        return getSeverityColor(d.value);
      }

      scope.chartWidth = scope.$parent.chartWidth;
      if (INSPECTOR_MODE) {
        scope.chartWidth = $(scope.containerId).width() - 70;
      }

      const numBuckets = parseInt((endTime - startTime) / stepSecs);
      const cellHeight = 30;
      const height = (lanes.length + 1) * cellHeight - 10;
      const laneLabelWidth = 170;

      element.css('height', (height + 20) + 'px');
      const $swimlanes = element.find('#swimlanes');
      $swimlanes.empty();

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

      const $cellsMarkerContainer = $('<div>', {
        'class': 'cells-marker-container'
      });

      const cells = [];
      let timeStepped = startTime;
      for (let i = 0; i < numBuckets; i++) {
        let html = '<div class=\'floating-time-label\'>';
        html += (moment.unix(timeStepped).format('MMM DD HH:mm'));
        html += '</div><i class=\'fa fa-caret-down\'></i>';

        const $cell = $('<div>', {
          'class': 'sl-cell',
          css: {
            'width': cellWidth + 'px'
          },
          html: html
        });
        $cellsMarkerContainer.append($cell);
        cells.push($cell);
        timeStepped += stepSecs;
      }
      scope.laneMarkers = scope.$parent.laneMarkers;
      scope.laneMarkers.push({ swimlaneType: scope.swimlaneType, lane: cells });
      $swimlanes.append($cellsMarkerContainer);

      function cellHover($event, laneLabel, bucketScore, index, t, swimlaneType) {

        if (!mlAnomalyRecordDetailsService.isLocked()) {
          const isInspector = SWIMLANE_TYPES[scope.swimlaneType] === SWIMLANE_TYPES.INSPECTOR;
          if ((!mlSwimlaneInspectorService.controls.visible || (mlSwimlaneInspectorService.controls.visible && isInspector))
            && !mlSwimlaneSelectionService.selection.active) {
            _.each(scope.lanes, function (l) {
              for (let j = 0; j < l.length; j++) {
                l[j].removeClass('sl-cell-hover');
              }
              l[index].addClass('sl-cell-hover');
            });

            _.each(scope.laneMarkers, function (l) {
              const lane = l.lane;
              for (let j = 0; j < lane.length; j++) {
                lane[j].removeClass('sl-cell-hover sl-cell-active-hover');
              }
              if (l.swimlaneType === swimlaneType) {
                lane[index].addClass('sl-cell-active-hover');
              } else {
                lane[index].addClass('sl-cell-hover');
              }
            });

            const target = $event.currentTarget;
            // only display records if the cell has a colored card inside it
            if (target.children.length) {
              const top = target.parentElement.offsetTop;

              let inspector = {};
              if (isInspector) {
                inspector = {
                  swimlaneType: mlSwimlaneInspectorService.getSwimlaneType(),
                  timeRange: mlSwimlaneInspectorService.getTimeRange(),
                  selectedJobIds: mlSwimlaneInspectorService.getSelectedJobIds(),
                };
              }

              // if hovering over eventrate, force the record for Monitor to be displayed.
              if (SWIMLANE_TYPES[swimlaneType] === SWIMLANE_TYPES.EVENTRATE) {
                swimlaneType = 'MONITOR';
              }

              mlAnomalyRecordDetailsService.hover(t, laneLabel, bucketScore, top, target, swimlaneType, inspector);
            }
          }
        }
      }

      function cellClick($event, laneLabel, bucketScore, index, t, swimlaneType) {

        let $target = $($event.target);
        // if the edge of the outer cell has been clicked by accident, find the inner cell.
        if ($target.hasClass('sl-cell')) {
          $target = $target.find('.sl-cell-inner');
        }
        if ($target) {
          const isEmptyCell = ($event.currentTarget.children.length === 0);
          // don't toggle the lock if the inspector is still visible
          // or allow toggle if inspector is visible and you're clicking on a card in the inspector.
          if (!mlSwimlaneInspectorService.controls.visible ||
            (mlSwimlaneInspectorService.controls.visible && SWIMLANE_TYPES[swimlaneType] === SWIMLANE_TYPES.INSPECTOR)) {
            // if cell is empty, only toggle disable lock by passing undefined
            mlAnomalyRecordDetailsService.toggleLock(isEmptyCell ? undefined : $target);
          }
          // force the hover event on the target, so the disable click highlights the current card
          // placed in a 1ms timeout because the inspector's mouse up event must must happen first
          // and that is in a 0ms timeout.
          $timeout(function () {
            cellHover($event, laneLabel, bucketScore, index, t, swimlaneType);
          }, 1);
        }
      }

      scope.lanes = scope.$parent.lanes;

      // if job, sort lanes based on job description
      if (SWIMLANE_TYPES[scope.swimlaneType] === SWIMLANE_TYPES.JOB) {
        lanes = lanes.sort(function (a, b) {
          return mlJobService.jobDescriptions[a] > mlJobService.jobDescriptions[b];
        });
      }
      _.each(lanes, function (lane) {
        const rowScope = scope.$new();
        scope.$parent.lanes[lane] = [];

        rowScope.showExpansion = false;
        rowScope.expandRow = function () {
          rowScope.showExpansion = !rowScope.showExpansion;
        };

        rowScope.cellHover = cellHover;
        rowScope.cellClick = cellClick;
        rowScope.startDrag = mlSwimlaneSelectionService.startDrag;

        rowScope.detectorPerJobChartData = scope.$parent.detectorPerJobChartData;
        rowScope.selectedJobIds = [lane];

        const $lane = $('<div>', {
          'class': 'lane',
        })
        .data('jobIds', scope.selectedJobIds);

        let label = lane;
        let isBucketWidth = false;
        // for job types and inpector for job types, mark whether the cell width is the same as the bucketSpanSeconds
        // ie, the lowest level we can zoom to
        if (SWIMLANE_TYPES[rowScope.swimlaneType] === SWIMLANE_TYPES.JOB ||
          (SWIMLANE_TYPES[rowScope.swimlaneType] === SWIMLANE_TYPES.INSPECTOR &&
            SWIMLANE_TYPES[mlSwimlaneInspectorService.getSwimlaneType()] === SWIMLANE_TYPES.JOB)) {
          label = mlJobService.jobDescriptions[lane];
          isBucketWidth = (mlJobService.basicJobs[lane].bucketSpanSeconds === stepSecs);
        } else if (SWIMLANE_TYPES[rowScope.swimlaneType] === SWIMLANE_TYPES.DETECTOR ||
          (SWIMLANE_TYPES[rowScope.swimlaneType] === SWIMLANE_TYPES.INSPECTOR &&
            SWIMLANE_TYPES[mlSwimlaneInspectorService.getSwimlaneType()] === SWIMLANE_TYPES.DETECTOR)) {
          let parentJobId;
          // find the job id based on the detector's description
          _.each(mlJobService.detectorsByJob, function (dtrs, jobId) {
            const descriptions = _.map(dtrs, function (dtr) {return dtr.detector_description;});
            if (_.indexOf(descriptions, lane) !== -1) {
              parentJobId = jobId;
            }
          });

          if (parentJobId !== undefined) {
            isBucketWidth = (mlJobService.basicJobs[parentJobId].bucketSpanSeconds === stepSecs);
          }
        }

        if (!INSPECTOR_MODE) {
          let html = '';
          if (rowScope.expansionDirective) {
            html = '<span ng-click="expandRow()">';
            html += '<i class=\'fa discover-table-open-icon\' ';
            html += 'ng-class=\'{ "fa-caret-down": showExpansion, "fa-caret-right": !showExpansion }\'>';
            html += '</i></span> ';
          }
          $lane.append($('<div>', {
            'class': 'lane-label',
            'css': {
              'width': laneLabelWidth + 'px'
            },
            'ng-class': '{ \'lane-label-expanded\': showExpansion }',
            html: html + label
          }));
        }

        const $cellsContainer = $('<div>', {
          'class': 'cells-container' + (INSPECTOR_MODE ? ' cells-container-inspector' : '')
        });
        $lane.append($cellsContainer);

        // used to keep a reference to the hover functions for MONITOR swimlane
        // triggered by the event rate chart.
        rowScope.hoverFuncs = [];

        let time = startTime;
        for (let i = 0; i < numBuckets; i++) {
          const $cell = $('<div>', {
            'class': 'sl-cell ' + (isBucketWidth ? 'sl-cell-lowest' : ''),
            css: {
              'width': cellWidth + 'px'
            },
            'data-lane-label': lane,
            'data-time': time,

          });
          rowScope.lanes[lane].push($cell);

          let color = 'none';
          let bucketScore = 0;
          for (let j = 0; j < points.length; j++) {

            if (points[j].value > 0 && points[j].laneLabel === lane && points[j].time === time) { // this may break if detectors have the duplicate descriptions
              bucketScore = points[j];
              color = colorScore(bucketScore);
              $cell.append($('<div>', {
                'class': 'sl-cell-inner',
                css: {
                  'background-color': color
                }
              }));
            }
          }

          let cellHoverTxt = 'cellHover($event, \'' + lane + '\', ';
          cellHoverTxt += bucketScore.value + ', ' + i + ', ' + time + ', \'' + rowScope.swimlaneType + '\')';
          let cellClickTxt = 'cellClick($event, \'' + lane + '\', ';
          cellClickTxt += bucketScore.value + ', ' + i + ', ' + time + ', \'' + rowScope.swimlaneType + '\')';
          let startDragTxt = 'startDrag($event, \'' + lane + '\', ';
          startDragTxt += i + ', ' + time + ', \'' + rowScope.swimlaneType + '\')';

          $cell.attr({
            'ng-mouseover': cellHoverTxt,
            'ng-click': cellClickTxt,
            'ng-mousedown': startDragTxt,
          });
          $cellsContainer.append($cell);

          // for monitor swimlane, create a closure to lock in the hover settings for each cell.
          // triggered when hovering over the same timestamp in the eventrate chart
          if (SWIMLANE_TYPES[rowScope.swimlaneType] === SWIMLANE_TYPES.MONITOR) {
            rowScope.hoverFuncs[i] = (function ($eventIn, laneIn, bucketScoreValueIn, iIn, timeIn, swimlaneTypeIn) {
              return function (swimlaneTypeOverride) {
                cellHover($eventIn, laneIn, bucketScoreValueIn, iIn, timeIn, (swimlaneTypeOverride || swimlaneTypeIn));
              };
            }({ currentTarget: $cell[0] }, lane, bucketScore.value, i, time, rowScope.swimlaneType));
          }

          time += stepSecs;
        }

        $swimlanes.append($lane);

        if (rowScope.expansionDirective) {

          const $laneExp = $('<div>', {
            'class': 'lane-expansion',
            'ng-show': 'showExpansion'
          });

          $laneExp.append($('<div>', { 'class': 'title', 'text':'Detectors for ' + label }));

          let html = '<ml-summary-view-swimlane chart-data=\'detectorPerJobChartData["' + lane + '"]\' ';
          html += 'swimlane-type="DETECTOR" selected-job-ids="selectedJobIds"  chart-width="chartWidth" ';
          html += 'container-id="swimlanes" expanded="true" style="width: 100%; height: 250px;"></ml-summary-view-swimlane>';
          $laneExp.append($(html));

          $swimlanes.append($laneExp);

          $compile($laneExp)(rowScope);
        }

        $compile($lane)(rowScope);
      });

      const $laneTimes = $('<div>', {
        'class': 'time-tick-labels' + (INSPECTOR_MODE ? ' time-tick-labels-inspector' : '')
      });
      _.each(timeTickLabels, function (label, i) {
        $laneTimes.append($('<span>', {
          'class': 'tick-label',
          'text': label,
          'css': {
            'margin-left': (i * cellWidth * cellsPerTick) + 'px'
          }
        }));
      });

      $swimlanes.append($laneTimes);
    }
  }

  let template = '<div ng-show=\'chartTitle!==undefined\' class=\'title\'><i ng-click=\'toggleRow()\' ';
  template += 'class=\'fa expand-arrow\' ng-class=\"{ \'fa-caret-down\': expanded, \'fa-caret-right\': !expanded }\">';
  template += ' </i>{{chartTitle}}</div><div><div id=\'swimlanes\' ng-show=\'expanded\'></div></div>';
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
    template: template
  };
})
.service('mlSwimlaneSelectionService', function ($timeout, mlSwimlaneInspectorService, mlAnomalyRecordDetailsService) {
  const SWIMLANE_TYPES = mlAnomalyRecordDetailsService.type;

  const selection = {
    firstX: -1,
    offsetX: 0,
    secondX: -1,
    width: -1,
    active: false,
    startCell: null,
    endCell: null,
    startTime: 0,
    endTime: 0,
    interval: 0,
    laneLabel: '',
    swimlaneType: '',
    laneIndex: 0,
    isBackwards: false,
  };

  let $lane = null;
  const $highlight = $('<div>', {
    'class': 'selection'
  });
  let cellWidth = 0;
  const $window = $(window);
  const SELECTION_WIDTH_MINIMUM = 5;

  function startDrag($event, laneLabel, index, time, swimlaneType) {

    // no dragging in the inspector
    if (SWIMLANE_TYPES[swimlaneType] === SWIMLANE_TYPES.INSPECTOR) {
      return;
    }

    document.body.focus();
    $highlight.remove();

    selection.startCell = getCell($event.target);
    selection.laneLabel = laneLabel;
    selection.swimlaneType = swimlaneType;
    selection.laneIndex = index;
    selection.endCell = null;

    cellWidth = selection.startCell.offsetWidth;

    $lane = $(selection.startCell.parentNode.parentNode);

    $window.one('mouseup', stopDrag);
    $lane.on('mousemove', mouseMove);

    selection.offsetX = $('.global-nav').width();

    selection.firstX = $event.clientX;
    // remove the offset caused by the kibana navigation menu
    selection.firstX -= selection.offsetX;

    $highlight.css({
      'left': selection.firstX + 'px',
      'width': '0px'
    });

  }

  function stopDrag() {
    // placed in a timeout to allow mouse click events to finish first
    $timeout(function () {
      mlSwimlaneInspectorService.hide();
      if (selection.active) {
        selection.endCell = selection.startCell;

        if (selection.isBackwards) {
          const numberOfCells = Math.floor((selection.width +
            (cellWidth - (selection.firstX -  selection.startCell.offsetLeft))) / cellWidth);
          for (let i = 0; i < numberOfCells; i++) {
            if (selection.startCell.previousSibling) {
              selection.startCell = selection.startCell.previousSibling;
            }
          }
        } else {
          const numberOfCells = Math.floor((selection.width + (selection.firstX -  selection.startCell.offsetLeft)) / cellWidth);
          for (let i = 0; i < numberOfCells; i++) {
            if (selection.endCell.nextSibling) {
              selection.endCell = selection.endCell.nextSibling;
            }
          }
        }
        calculateTimeRange();

        if (!isNaN(selection.startTime) && !isNaN(selection.endTime) && !isNaN(selection.interval)) {
          const timeRange = { start: selection.startTime, end: selection.endTime, interval: selection.interval };

          mlSwimlaneInspectorService.show(timeRange, selection.laneLabel, $lane, $highlight, selection.swimlaneType, $lane.data('jobIds'));
          mlAnomalyRecordDetailsService.toggleLock();
          mlAnomalyRecordDetailsService.clearInspectorTopInfluencers();
        } else {
          $highlight.remove();
        }
      }

      selection.active = false;
      if ($lane) {
        $lane.off('mousemove');
      }
      $lane = null;
    }, 0);
  }

  function mouseMove($event) {
    if (!selection.active && $lane) {
      selection.active = true;
      $lane.append($highlight);
    }

    selection.secondX = $event.clientX;
    // remove the offset caused by the kibana navigation menu
    selection.secondX -= selection.offsetX;

    // selecting backwards
    if (selection.secondX < selection.firstX) {
      selection.isBackwards = true;
      selection.width = selection.firstX - selection.secondX;

      $highlight.css({
        'left':  (selection.secondX) + 'px',
        'width': (selection.width) + 'px'
      });
    } else {
      selection.isBackwards = false;
      selection.width = selection.secondX - selection.firstX;
      $highlight.css('width', (selection.width) + 'px');
    }

    // if the selection width is below the minimum, remove the selection and deactivate
    // this stop accidental single pixel selections made by moving the mouse slghtly when clicking
    if (selection.width < SELECTION_WIDTH_MINIMUM) {
      $highlight.remove();
      selection.active = false;
    }
  }

  function calculateTimeRange() {
    const interval = mlAnomalyRecordDetailsService.getBucketInterval().asSeconds();
    selection.interval = interval;

    selection.startTime = (+selection.startCell.dataset.time);
    selection.endTime = (+selection.endCell.dataset.time) + interval;
  }

  function getCell($target) {
    if ($target.className === 'sl-cell-inner') {
      return $target.parentNode;
    } else {
      return $target;
    }
  }

  function hide() {
    $highlight.remove();
  }

  this.startDrag = startDrag;
  this.stopDrag = stopDrag;
  this.selection = selection;
  this.hide = hide;
});
