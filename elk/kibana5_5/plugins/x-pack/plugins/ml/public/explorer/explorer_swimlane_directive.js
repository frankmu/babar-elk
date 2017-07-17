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
 * AngularJS directive for rendering Explorer dashboard swimlanes.
 */

import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';

import { getSeverityColor } from 'plugins/ml/util/anomaly_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlExplorerSwimlane', function ($compile, mlExplorerDashboardService) {

  function link(scope, element) {

    // Re-render the swimlane whenever the underlying data changes.
    const swimlaneDataChangeListener = function (swimlaneType) {
      if (swimlaneType === scope.swimlaneType) {
        render();
        checkForSelection();
      }
    };

    mlExplorerDashboardService.addSwimlaneDataChangeListener(swimlaneDataChangeListener);

    element.on('$destroy', function () {
      mlExplorerDashboardService.removeSwimlaneDataChangeListener(swimlaneDataChangeListener);
      scope.$destroy();
    });

    function render() {
      if (scope.swimlaneData === undefined) {
        return;
      }

      const lanes = scope.swimlaneData.laneLabels;
      const startTime = scope.swimlaneData.earliest;
      const endTime = scope.swimlaneData.latest;
      const stepSecs = scope.swimlaneData.interval;
      const points = scope.swimlaneData.points;

      function colorScore(value) {
        return getSeverityColor(value);
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

      // Clear selection if clicking away from a cell.
      $swimlanes.click(function ($event) {
        const $target = $($event.target);
        if (!$target.hasClass('sl-cell') && !$target.hasClass('sl-cell-inner') &&
            $('.sl-cell-inner.sl-cell-inner-selected', '.ml-explorer-swimlane').length > 0) {
          clearSelection();
        }
      });

      function cellClick($event, laneLabel, bucketScore, index, time) {

        let $target = $($event.target);
        // if the edge of the outer cell has been clicked by accident, find the inner cell.
        if ($target.hasClass('sl-cell')) {
          $target = $target.find('.sl-cell-inner');
        }

        if ($target && bucketScore > 0 && $target.hasClass('sl-cell-inner-selected') === false) {
          selectCell($target, laneLabel, time, bucketScore);
        } else {
          clearSelection();
        }
      }

      function cellMouseover($event, laneLabel, bucketScore, index, time) {
        if (bucketScore === undefined) {
          return;
        }

        const displayScore = (bucketScore > 1 ? parseInt(bucketScore) : '< 1');

        // Display date using same format as Kibana visualizations.
        const formattedDate = moment(time * 1000).format('MMMM Do YYYY, HH:mm');
        let contents = formattedDate + '<br/><hr/>';
        if (scope.swimlaneData.fieldName !== undefined) {
          contents += scope.swimlaneData.fieldName + ': ' + laneLabel + '<br/><hr/>';
        }
        contents += ('Max anomaly score: ' + displayScore);

        const x = $event.pageX;
        const y = $event.pageY;
        const offset = 5;
        $('<div class="ml-explorer-swimlane-tooltip ml-explorer-tooltip">' + contents + '</div>').css({
          'position': 'absolute',
          'display': 'none',
          'z-index': 1,
          'top': y + offset,
          'left': x + offset
        }).appendTo('body').fadeIn(200);

        // Position the tooltip.
        const $win = $(window);
        const winHeight = $win.height();
        const yOffset = window.pageYOffset;
        const tooltipWidth = $('.ml-explorer-swimlane-tooltip').outerWidth(true);
        const tooltipHeight = $('.ml-explorer-swimlane-tooltip').outerHeight(true);

        $('.ml-explorer-swimlane-tooltip').css('left', x + offset + tooltipWidth > $win.width() ? x - offset - tooltipWidth : x + offset);
        $('.ml-explorer-swimlane-tooltip').css('top', y + tooltipHeight < winHeight + yOffset ? y : y - tooltipHeight);
      }

      function cellMouseleave() {
        $('.ml-explorer-swimlane-tooltip').remove();
      }

      _.each(lanes, function (lane) {
        const rowScope = scope.$new();
        rowScope.cellClick = cellClick;
        rowScope.cellMouseover = cellMouseover;
        rowScope.cellMouseleave = cellMouseleave;

        const $lane = $('<div>', {
          'class': 'lane',
        });

        const label = lane;
        $lane.append($('<div>', {
          'class': 'lane-label',
          'css': {
            'width': laneLabelWidth + 'px'
          },
          html: label
        }));

        const $cellsContainer = $('<div>', {
          'class': 'cells-container'
        });
        $lane.append($cellsContainer);

        // TODO - mark if zoomed in to bucket width?
        let time = startTime;
        for (let i = 0; i < numBuckets; i++) {
          const $cell = $('<div>', {
            'class': 'sl-cell ',
            css: {
              'width': cellWidth + 'px'
            },
            'data-lane-label': lane,
            'data-time': time,

          });

          let color = 'none';
          let bucketScore = 0;
          for (let j = 0; j < points.length; j++) {
            // this may break if detectors have the duplicate descriptions
            if (points[j].value > 0 && points[j].laneLabel === lane && points[j].time === time) {
              bucketScore = points[j].value;
              color = colorScore(bucketScore);
              $cell.append($('<div>', {
                'class': 'sl-cell-inner',
                css: {
                  'background-color': color
                }
              }));
              $cell.attr({ 'data-score': bucketScore });
            }
          }

          const safeLaneTxt = lane.replace(/(['])/g, '\\$1');
          const cellClickTxt = 'cellClick($event, \'' + safeLaneTxt + '\', ' +
            bucketScore + ', ' + i + ', ' + time + ')';
          $cell.attr({ 'ng-click': cellClickTxt });

          if (bucketScore > 0) {
            const cellMouseoverTxt = 'cellMouseover($event, \'' + safeLaneTxt + '\', ' +
              bucketScore + ', ' + i + ', ' + time + ')';
            const cellMouseleaveTxt = 'cellMouseleave()';
            $cell.attr({
              'ng-mouseover': cellMouseoverTxt,
              'ng-mouseleave': cellMouseleaveTxt
            });
          }

          $cellsContainer.append($cell);

          time += stepSecs;
        }

        $swimlanes.append($lane);

        $compile($lane)(rowScope);
      });

      const $laneTimes = $('<div>', {
        'class': 'time-tick-labels'
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

    function checkForSelection() {
      // Check for selection in the AppState and reselect the corresponding swimlane cell
      // if the time range and lane label are still in view.
      const selectionState = scope.appState.mlExplorerSwimlane;
      const selectedType = _.get(selectionState, 'selectedType', undefined);
      const viewBy = _.get(selectionState, 'viewBy', '');
      if (scope.swimlaneType !== selectedType && selectedType !== undefined) {
        $('.lane-label', element).addClass('lane-label-masked');
        $('.sl-cell-inner', element).addClass('sl-cell-inner-masked');
      }

      if ((scope.swimlaneType !== selectedType) ||
        (scope.swimlaneData.fieldName !== undefined && scope.swimlaneData.fieldName !== viewBy)) {
        // Not this swimlane which was selected.
        return;
      }

      let cellToSelect = undefined;
      const selectedLane = _.get(selectionState, 'selectedLane', '');
      const selectedTime = _.get(selectionState, 'selectedTime', -1);

      const lanes = scope.swimlaneData.laneLabels;
      const startTime = scope.swimlaneData.earliest;
      const endTime = scope.swimlaneData.latest;

      if (lanes.indexOf(selectedLane) > -1 && selectedTime >= startTime && selectedTime <= endTime) {
        // Locate matching cell - look for exact time, otherwise closest before.
        const $swimlanes = element.find('#swimlanes');
        const laneCells = $('div[data-lane-label="' + selectedLane + '"]', $swimlanes);
        if (laneCells.length === 0) {
          return;
        }

        let previousCell = laneCells[0];
        cellToSelect = laneCells[0];
        for (let i = 0; i < laneCells.length; i++) {
          const cell = laneCells[i];
          const cellTime = $(cell).attr('data-time');
          if (cellTime === selectedTime) {
            cellToSelect = cell;
            break;
          } else {
            if (cellTime > selectedTime) {
              // Select previous as long as it has a score.
              const previousScore = +$(previousCell).attr('data-score');
              cellToSelect = previousScore !== undefined ? previousCell : cell;
              break;
            }

          }
          cellToSelect = cell;   // Ensures last cell is selected if selection is most recent in list.
          previousCell = cell;
        }
      }

      if (cellToSelect !== undefined && $(cellToSelect).attr('data-score') !== undefined) {
        const $target = $(cellToSelect).find('.sl-cell-inner');
        selectCell($target, selectedLane, selectedTime, +$(cellToSelect).attr('data-score'));
      }
      else {
        // Clear selection from state as previous selection is no longer applicable.
        clearSelection();
      }

    }

    function selectCell($target, laneLabel, time, bucketScore) {
      $('.lane-label', '.ml-explorer-swimlane').addClass('lane-label-masked');
      $('.sl-cell-inner', '.ml-explorer-swimlane').addClass('sl-cell-inner-masked');
      $('.sl-cell-inner.sl-cell-inner-selected', '.ml-explorer-swimlane').removeClass('sl-cell-inner-selected');

      $target.removeClass('sl-cell-inner-masked');
      $target.addClass('sl-cell-inner-selected');

      $('.lane-label').filter(function () {
        return $(this).text() === laneLabel;
      }).removeClass('lane-label-masked');

      if (scope.swimlaneType === 'viewBy') {
        // If selecting a cell in the 'view by' swimlane, indicate the corresponding time in the Overall swimlane.
        const overallSwimlane = $('ml-explorer-swimlane[swimlane-type="overall"]');
        const overallCell = $('div[data-time="' + time + '"]', overallSwimlane).find('.sl-cell-inner');
        overallCell.addClass('sl-cell-inner-selected');
      }

      scope.appState.mlExplorerSwimlane.selectedType = scope.swimlaneType;
      scope.appState.mlExplorerSwimlane.selectedLane = laneLabel;
      scope.appState.mlExplorerSwimlane.selectedTime = time;
      scope.appState.save();

      mlExplorerDashboardService.fireSwimlaneCellClick({
        fieldName: scope.swimlaneData.fieldName,
        laneLabel: laneLabel,
        time: time,
        interval: scope.swimlaneData.interval,
        score: bucketScore
      });
    }

    function clearSelection() {
      $('.lane-label', '.ml-explorer-swimlane').removeClass('lane-label-masked');
      $('.sl-cell-inner', '.ml-explorer-swimlane').removeClass('sl-cell-inner-masked');
      $('.sl-cell-inner.sl-cell-inner-selected', '.ml-explorer-swimlane').removeClass('sl-cell-inner-selected');

      delete scope.appState.mlExplorerSwimlane.selectedType;
      delete scope.appState.mlExplorerSwimlane.selectedLane;
      delete scope.appState.mlExplorerSwimlane.selectedTime;
      scope.appState.save();

      mlExplorerDashboardService.fireSwimlaneCellClick({});
    }
  }

  const template = '<div id=\'swimlanes\'></div>';
  return {
    scope: {
      swimlaneType: '@',
      swimlaneData: '=',
      selectedJobIds: '=',
      chartWidth: '=',
      appState: '='
    },
    link: link,
    template: template
  };
});
