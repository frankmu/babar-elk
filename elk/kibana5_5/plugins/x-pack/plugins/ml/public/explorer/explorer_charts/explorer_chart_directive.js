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
 * AngularJS directive for rendering a chart of anomalies in the raw data in
 * the Machine Learning Explorer dashboard.
 */

import _ from 'lodash';
import $ from 'jquery';
import d3 from 'd3';
import angular from 'angular';
import moment from 'moment';
import numeral from 'numeral';

import { getSeverityWithLow } from 'plugins/ml/util/anomaly_utils';
import 'plugins/ml/filters/format_value';
import 'plugins/ml/services/results_service';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlExplorerChart', function (mlResultsService, formatValueFilter) {

  function link(scope, element) {
    console.log('ml-explorer-chart directive link series config:', scope.seriesConfig);
    const config = scope.seriesConfig;

    const ML_RESULTS_INDEX_ID = '.ml-anomalies-*';
    const ML_TIME_FIELD_NAME = 'timestamp';
    const ANOMALIES_MAX_RESULTS = 500;

    let svgWidth = 0;
    let vizWidth = 0;
    const chartHeight = 170;
    const LINE_CHART_ANOMALY_RADIUS = 7;

    // Left margin is adjusted later for longest y-axis label.
    const margin = { top: 10, right: 0, bottom: 30, left: 60 };
    const svgHeight = chartHeight + margin.top + margin.bottom;
    const chartLimits = { max: 0, min: 0 };

    let lineChartXScale = null;
    let lineChartYScale = null;
    let lineChartGroup;
    let lineChartValuesLine = null;

    // Counter to keep track of what data sets have been loaded.
    let awaitingCount = 2;

    // finish() function, called after each data set has been loaded and processed.
    // The last one to call it will trigger the page render.
    function finish() {
      awaitingCount--;
      if (awaitingCount === 0) {
        scope.chartData = processChartData();
        init();
        drawLineChart();
      }
    }

    // Query 1 - load the raw metric data.
    const datafeedQuery = _.get(config, 'datafeedConfig.query', null);
    mlResultsService.getMetricData(config.datafeedConfig.indices,
      config.datafeedConfig.types, config.entityFields, datafeedQuery,
      config.metricFunction, config.metricFieldName, config.timeField,
      scope.plotEarliest, scope.plotLatest, config.interval
      )
    .then((resp) => {
      // TODO - if query returns no results e.g. source data has been deleted,
      // display a message saying 'No data between earliest/latest'.
      scope.metricData = resp.results;
      finish();
    });

    // Query 2 - load the anomalies.
    // Criteria to return the records for this series are the detector_index plus
    // the specific combination of 'entity' fields i.e. the partition / by / over fields.
    let criteria = [];
    criteria.push({ fieldName: 'detector_index', fieldValue: config.detectorIndex });
    criteria = criteria.concat(config.entityFields);

    mlResultsService.getRecordsForCriteria(ML_RESULTS_INDEX_ID, [config.jobId], criteria,
      0, scope.plotEarliest, scope.plotLatest, ANOMALIES_MAX_RESULTS)
    .then((resp) => {
      scope.anomalyRecords = resp.records;
      finish();
    });

    element.on('$destroy', function () {
      scope.$destroy();
    });

    function init() {
      const $el = angular.element('.ml-explorer-chart-container');
      const data = scope.chartData;

      // Clear any existing elements from the visualization,
      // then build the svg elements for the chart.
      const chartElement = d3.select(element.get(0));
      chartElement.select('svg').remove();

      svgWidth = $el.width();

      const svg = chartElement.append('svg')
        .attr('width',  svgWidth)
        .attr('height', svgHeight);

      // Set the size of the left margin according to the width of the largest y axis tick label.
      lineChartYScale = d3.scale.linear().range([chartHeight, 0]);
      const yAxis = d3.svg.axis().scale(lineChartYScale).orient('left')
        .innerTickSize(-vizWidth).outerTickSize(0).tickPadding(10);

      chartLimits.max = d3.max(data, (d) => d.value);
      chartLimits.min = d3.min(data, (d) => d.value);
      if (chartLimits.max === chartLimits.min) {
        chartLimits.max = d3.max(data, (d) => {
          if (d.typical) {
            return Math.max(d.value, d.typical);
          } else {
            // If analysis with by and over field, and more than one cause,
            // there will be no actual and typical value.
            // TODO - produce a better visual for population analyses.
            return d.value;
          }
        });
        chartLimits.min = d3.min(data, (d) => {
          if (d.typical) {
            return Math.min(d.value, d.typical);
          } else {
            // If analysis with by and over field, and more than one cause,
            // there will be no actual and typical value.
            // TODO - produce a better visual for population analyses.
            return d.value;
          }
        });
      }

      // add padding of 5% of the difference between max and min
      // to the upper and lower ends of the y-axis
      let padding = 0;
      if (chartLimits.max !== chartLimits.min) {
        padding = (chartLimits.max - chartLimits.min) * 0.05;
      } else {
        padding = chartLimits.max * 0.05;
      }
      chartLimits.max += padding;
      chartLimits.min -= padding;

      lineChartYScale = lineChartYScale.domain([
        chartLimits.min,
        chartLimits.max
      ]);

      let maxYAxisLabelWidth = 0;
      const tempLabelText = svg.append('g')
        .attr('class', 'temp-axis-label tick');
      tempLabelText.selectAll('text.temp.axis').data(lineChartYScale.ticks())
        .enter()
        .append('text')
        .text(d => lineChartYScale.tickFormat()(d))
        .each(function () {
          maxYAxisLabelWidth = Math.max(this.getBBox().width + yAxis.tickPadding(), maxYAxisLabelWidth);
        })
      .remove();
      d3.select('.temp-axis-label').remove();

      margin.left = (Math.max(maxYAxisLabelWidth, 40));
      vizWidth  = svgWidth  - margin.left - margin.right;

      // Set the x axis domain to match the request plot range.
      // This ensures ranges on different charts will match, even when there aren't
      // data points across the full range, and the selected anomalous region is centred.
      lineChartXScale = d3.time.scale()
        .range([0, vizWidth])
        .domain([scope.plotEarliest, scope.plotLatest]);

      lineChartValuesLine = d3.svg.line()
        .x(d => lineChartXScale(d.date))
        .y(d => lineChartYScale(d.value))
        .defined(d => d.value !== null);

      lineChartGroup = svg.append('g')
        .attr('class', 'line-chart')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    }

    function drawLineChart() {
      const data = scope.chartData;

      // Add border round plot area.
      lineChartGroup.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('height', chartHeight)
        .attr('width', vizWidth)
        .style('stroke', '#cccccc')
        .style('fill', 'none')
        .style('stroke-width', 1);

      drawLineChartAxes();
      drawLineChartHighlightedSpan();
      drawLineChartPaths(data);
      drawLineChartMarkers(data);
    }

    function drawLineChartAxes() {
      const xAxis = d3.svg.axis().scale(lineChartXScale).orient('bottom')
        .innerTickSize(-chartHeight).outerTickSize(0).tickPadding(10);
      const yAxis = d3.svg.axis().scale(lineChartYScale).orient('left')
        .innerTickSize(-vizWidth).outerTickSize(0).tickPadding(10);
      const axes = lineChartGroup.append('g');

      axes.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + chartHeight + ')')
        .call(xAxis);

      axes.append('g')
        .attr('class', 'y axis')
        .call(yAxis);
    }

    function drawLineChartHighlightedSpan() {
      // Draws a rectangle which highlights the time span that has been selected for view.
      // Note depending on the overall time range and the bucket span, the selected time
      // span may be longer than the range actually being plotted.
      const rectStart = Math.max(scope.selectedEarliest, scope.plotEarliest);
      const rectEnd = Math.min(scope.selectedLatest, scope.plotLatest);
      const rectWidth = lineChartXScale(rectEnd) - lineChartXScale(rectStart);

      lineChartGroup.append('rect')
        .attr('class', 'selected-interval')
        .attr('x', lineChartXScale(new Date(rectStart)))
        .attr('y', 1)
        .attr('width', rectWidth)
        .attr('height', chartHeight - 1);
    }

    function drawLineChartPaths(data) {
      lineChartGroup.append('path')
        .attr('class', 'values-line')
        .attr('d', lineChartValuesLine(data));
    }

    function drawLineChartMarkers(data) {
      // Render circle markers for the points.
      // These are used for displaying tooltips on mouseover.
      const dots = lineChartGroup.append('g')
        .attr('class', 'chart-markers')
        .selectAll('.metric-value')
        .data(data);

      // Remove dots that are no longer needed i.e. if number of chart points has decreased.
      dots.exit().remove();
      // Create any new dots that are needed i.e. if number of chart points has increased.
      dots.enter().append('circle')
        .attr('r', LINE_CHART_ANOMALY_RADIUS)
        .on('mouseover', function (d) {
          showLineChartTooltip(d, this);
        })
        .on('mouseout', hideLineChartTooltip);

      // Update all dots to new positions.
      dots.attr('cx', function (d) { return lineChartXScale(d.date); })
        .attr('cy', function (d) { return lineChartYScale(d.value); })
        .attr('class', function (d) {
          let markerClass = 'metric-value';
          if (_.has(d, 'anomalyScore')) {
            markerClass += ' anomaly-marker ';
            markerClass += getSeverityWithLow(d.anomalyScore);
          }
          return markerClass;
        });

    }

    function showLineChartTooltip(marker, circle) {
      // Show the time and metric values in the tooltip.
      // Uses date, value, upper, lower and anomalyScore (optional) marker properties.
      const formattedDate = moment(marker.date).format('MMMM Do YYYY, HH:mm');
      let contents = formattedDate + '<br/><hr/>';

      // TODO - need better formatting for small decimals.
      if (_.has(marker, 'anomalyScore')) {
        const score = parseInt(marker.anomalyScore);
        const displayScore = (score > 0 ? score : '< 1');
        contents += ('anomaly score: ' + displayScore);
        if (_.has(marker, 'actual')) {
          // Display the record actual in preference to the chart value, which may be
          // different depending on the aggregation interval of the chart.
          contents += ('<br/>actual: ' + formatValueFilter(marker.actual, config.functionDescription));
          contents += ('<br/>typical: ' + formatValueFilter(marker.typical, config.functionDescription));
        } else {
          contents += ('<br/>value: ' + numeral(marker.value).format('0,0.[00]'));
          if (_.has(marker, 'byFieldName') && _.has(marker, 'numberOfCauses')) {
            const numberOfCauses = marker.numberOfCauses;
            const byFieldName = marker.byFieldName;
            if (numberOfCauses < 10) {
              // If numberOfCauses === 1, won't go into this block as actual/typical copied to top level fields.
              contents += `<br/> ${numberOfCauses} unusual ${byFieldName} values`;
            } else {
              // Maximum of 10 causes are stored in the record, so '10' may mean more than 10.
              contents += `<br/> ${numberOfCauses}+ unusual ${byFieldName} values`;
            }
          }
        }
      } else {
        contents += ('value: ' + numeral(marker.value).format('0,0.[00]'));
      }

      const tooltipDiv = d3.select('.ml-explorer-charts-tooltip');
      tooltipDiv.transition()
        .duration(200)
        .style('opacity', .9);
      tooltipDiv.html(contents);

      // Position the tooltip.
      const pos = $(circle).position();
      const x = pos.left;
      const y = pos.top;
      const parentWidth = $('.ml-explorer').width();
      const tooltipWidth = tooltipDiv.node().offsetWidth;
      if (x + tooltipWidth + LINE_CHART_ANOMALY_RADIUS + 10 < parentWidth) {
        tooltipDiv.style('left', (x + (LINE_CHART_ANOMALY_RADIUS * 2) + 4) + 'px')
          .style('top', (y - 0) + 'px');
      } else {
        tooltipDiv.style('left', x - (tooltipWidth + LINE_CHART_ANOMALY_RADIUS) + 'px')
          .style('top', (y - 0) + 'px');
      }
    }

    function hideLineChartTooltip() {
      const tooltipDiv = d3.select('.ml-explorer-charts-tooltip');
      tooltipDiv.transition()
        .duration(500)
        .style('opacity', 0);
    }

    function processChartData() {
      // Return dataset in format used by the chart.
      // i.e. array of Objects with keys date (JavaScript date), value,
      //    plus anomalyScore for points with anomaly markers.
      const chartData = [];
      if (scope.metricData === undefined || _.keys(scope.metricData).length === 0) {
        return chartData;
      }

      _.each(scope.metricData, (value, time) => {
        chartData.push(
          {
            date: new Date(+time),
            value: value
          });
      });

      // Iterate through the anomaly records, adding anomalyScore properties
      // to the chartData entries for anomalous buckets.
      _.each(scope.anomalyRecords, (record) => {

        // Look for a chart point with the same time as the record.
        // If none found, find closest time in chartData set.
        const recordTime = record[ML_TIME_FIELD_NAME];
        let chartPoint;
        for (let i = 0; i < chartData.length; i++) {
          if (chartData[i].date.getTime() === recordTime) {
            chartPoint = chartData[i];
            break;
          }
        }

        if (chartPoint === undefined) {
          // Find nearest point in time.
          // loop through line items until the date is greater than bucketTime
          // grab the current and prevous items in the and compare the time differences
          let foundItem;
          for (let i = 0; i < chartData.length; i++) {
            const itemTime = chartData[i].date.getTime();
            if ((itemTime > recordTime) && (i > 0)) {
              const item = chartData[i];
              const prevousItem = (i > 0 ? chartData[i - 1] : null);

              const diff1 = Math.abs(recordTime - prevousItem.date.getTime());
              const diff2 = Math.abs(recordTime - itemTime);

              // foundItem should be the item with a date closest to bucketTime
              if (prevousItem === null || diff1 > diff2) {
                foundItem = item;
              } else {
                foundItem = prevousItem;
              }
              break;
            }
          }

          chartPoint = foundItem;
        }

        if (chartPoint === undefined) {
          // In case there is a record with a time after that of the last chart point, set the score
          // for the last chart point to that of the last record, if that record has a higher score.
          const lastChartPoint = chartData[chartData.length - 1];
          const lastChartPointScore = lastChartPoint.anomalyScore || 0;
          if (record.record_score > lastChartPointScore) {
            chartPoint = lastChartPoint;
          }
        }

        if (chartPoint !== undefined) {
          chartPoint.anomalyScore = record.record_score;

          if (_.has(record, 'actual')) {
            chartPoint.actual = record.actual;
            chartPoint.typical = record.typical;
          } else {
            const causes = _.get(record, 'causes', []);
            if (causes.length > 0) {
              chartPoint.byFieldName = record.by_field_name;
              chartPoint.numberOfCauses = causes.length;
              if (causes.length === 1) {
                // If only a single cause, copy actual and typical values to the top level.
                const cause = _.first(record.causes);
                chartPoint.actual = cause.actual;
                chartPoint.typical = cause.typical;
              }
            }
          }
        }


      });

      return chartData;
    }

  }

  return {
  	restrict: 'E',
    scope: {
      seriesConfig: '=',
      plotEarliest: '=',
      plotLatest: '=',
      selectedEarliest: '=',
      selectedLatest: '='
    },
    link: link
  };
});
