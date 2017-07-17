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
 * Angular controller for the container for the anomaly charts in the
 * Machine Learning Explorer dashboard.
 * The controller processes the data required to draw each of the charts
 * and manages the layout of the charts in the containing div.
 */

import _ from 'lodash';
import $ from 'jquery';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');
import { explorerChartConfigBuilder } from './explorer_chart_config_builder';
import { isTimeSeriesViewDetector } from 'plugins/ml/util/job_utils';

module.controller('MlExplorerChartsContainerController', function ($scope, timefilter, Private,
  mlJobService, mlExplorerDashboardService) {

  $scope.allSeriesRecords = [];   // Complete list of series.
  $scope.recordsForSeries = [];   // Series for plotting.

  const $chartContainer = $('.explorer-charts');
  const FUNCTION_DESCRIPTIONS_TO_PLOT = ['mean', 'min', 'max', 'sum', 'count', 'distinct_count'];
  const CHART_MAX_POINTS = 500;

  const anomalyDataChangeListener = function (anomalyRecords, earliestMs, latestMs) {
    $scope.allSeriesRecords = processRecordsForDisplay(anomalyRecords);

    // Calculate the number of charts per row, depending on the width available, to a max of 4.
    const chartsContainerWidth = $chartContainer.width();
    const chartsPerRow = Math.min(Math.max(Math.floor(chartsContainerWidth / 550), 1), 4);

    $scope.chartsPerRow = chartsPerRow;
    $scope.layoutCellsPerChart = 12 / $scope.chartsPerRow;

    // Build the data configs of the anomalies to be displayed.
    // TODO - implement paging?
    // For now just take first 6 (or 8 if 4 charts per row).
    const maxSeriesToPlot = Math.max(chartsPerRow * 2, 6);
    const recordsToPlot = $scope.allSeriesRecords.slice(0, maxSeriesToPlot);
    $scope.seriesToPlot = buildDataConfigs(recordsToPlot);

    // Calculate the time range of the charts, which is a function of the chart width and max job bucket span.
    $scope.tooManyBuckets = false;
    const chartRange = calculateChartRange(earliestMs, latestMs,
      Math.floor(chartsContainerWidth / chartsPerRow), recordsToPlot);

    $scope.plotEarliest = chartRange.min;
    $scope.plotLatest = chartRange.max;

    $scope.selectedEarliest = earliestMs;
    $scope.selectedLatest = latestMs;
  };

  mlExplorerDashboardService.addAnomalyDataChangeListener(anomalyDataChangeListener);

  $scope.$on('$destroy', () => {
    mlExplorerDashboardService.removeAnomalyDataChangeListener(anomalyDataChangeListener);
  });

  function processRecordsForDisplay(anomalyRecords) {
    // Aggregate the anomaly data by detector, and entity (by/over/partition).
    if (anomalyRecords.length === 0) {
      return [];
    }

    // Aggregate by job, detector, and analysis fields (partition, by, over).
    const aggregatedData = {};
    _.each(anomalyRecords, (record) => {
      // Only plot charts for metric functions, and for detectors which don't use categorization
      // or scripted fields which can be very difficult or impossible to invert to a reverse search.
      const job = mlJobService.getJob(record.job_id);
      if (isTimeSeriesViewDetector(job, record.detector_index) === false ||
        _.indexOf(FUNCTION_DESCRIPTIONS_TO_PLOT, record.function_description) === -1) {
        return;
      }
      const jobId = record.job_id;
      if (!_.has(aggregatedData, jobId)) {
        aggregatedData[jobId] = {};
      }
      const detectorsForJob = aggregatedData[jobId];

      const detectorIndex = record.detector_index;
      if (!_.has(detectorsForJob, detectorIndex)) {
        detectorsForJob[detectorIndex] = {};
      }

      // TODO - work out how best to display results from detectors with just an over field.
      const firstFieldName = record.partition_field_name || record.by_field_name || record.over_field_name;
      const firstFieldValue = record.partition_field_value || record.by_field_value || record.over_field_value;
      if (firstFieldName !== undefined) {
        const groupsForDetector = detectorsForJob[detectorIndex];

        if (!_.has(groupsForDetector, firstFieldName)) {
          groupsForDetector[firstFieldName] = {};
        }
        const valuesForGroup = groupsForDetector[firstFieldName];
        if (!_.has(valuesForGroup, firstFieldValue)) {
          valuesForGroup[firstFieldValue] = {};
        }

        const dataForGroupValue = valuesForGroup[firstFieldValue];

        let isSecondSplit = false;
        if (record.partition_field_name !== undefined) {
          const splitFieldName = record.over_field_name || record.by_field_name;
          if (splitFieldName !== undefined) {
            isSecondSplit = true;
          }
        }

        if (isSecondSplit === false) {
          if (!_.has(dataForGroupValue, 'maxScoreRecord')) {
            dataForGroupValue.maxScore = record.record_score;
            dataForGroupValue.maxScoreRecord = record;
          } else {
            if (record.record_score > dataForGroupValue.maxScore) {
              dataForGroupValue.maxScore = record.record_score;
              dataForGroupValue.maxScoreRecord = record;
            }
          }
        } else {
          // Aggregate another level for the over or by field.
          const secondFieldName = record.over_field_name || record.by_field_name;
          const secondFieldValue = record.over_field_value || record.by_field_value;

          if (!_.has(dataForGroupValue, secondFieldName)) {
            dataForGroupValue[secondFieldName] = {};
          }

          const splitsForGroup = dataForGroupValue[secondFieldName];
          if (!_.has(splitsForGroup, secondFieldValue)) {
            splitsForGroup[secondFieldValue] = {};
          }

          const dataForSplitValue = splitsForGroup[secondFieldValue];
          if (!_.has(dataForSplitValue, 'maxScoreRecord')) {
            dataForSplitValue.maxScore = record.record_score;
            dataForSplitValue.maxScoreRecord = record;
          } else {
            if (record.record_score > dataForSplitValue.maxScore) {
              dataForSplitValue.maxScore = record.record_score;
              dataForSplitValue.maxScoreRecord = record;
            }
          }
        }
      } else {
        // Detector with no partition or by field.
        const dataForDetector = detectorsForJob[detectorIndex];
        if (!_.has(dataForDetector, 'maxScoreRecord')) {
          dataForDetector.maxScore = record.record_score;
          dataForDetector.maxScoreRecord = record;
        } else {
          if (record.record_score > dataForDetector.maxScore) {
            dataForDetector.maxScore = record.record_score;
            dataForDetector.maxScoreRecord = record;
          }
        }
      }

    });

    console.log('explorer charts aggregatedData is:', aggregatedData);
    let recordsForSeries = [];
    // Convert to an array of the records with the highest record_score per unique series.
    _.each(aggregatedData, (detectorsForJob) => {
      _.each(detectorsForJob, (groupsForDetector) => {
        if (_.has(groupsForDetector, 'maxScoreRecord')) {
          // Detector with no partition / by field.
          recordsForSeries.push(groupsForDetector.maxScoreRecord);
        } else {
          _.each(groupsForDetector, (valuesForGroup) => {
            _.each(valuesForGroup, (dataForGroupValue) => {
              if (_.has(dataForGroupValue, 'maxScoreRecord')) {
                recordsForSeries.push(dataForGroupValue.maxScoreRecord);
              } else {
                // Second level of aggregation for partition and by/over.
                _.each(dataForGroupValue, (splitsForGroup) => {
                  _.each(splitsForGroup, (dataForSplitValue) => {
                    recordsForSeries.push(dataForSplitValue.maxScoreRecord);
                  });
                });
              }
            });
          });
        }
      });
    });
    recordsForSeries = (_.sortBy(recordsForSeries, 'record_score')).reverse();

    return recordsForSeries;
  }

  function buildDataConfigs(anomalyRecords) {
    // Build the chart configuration for each anomaly record.
    const seriesConfigs = [];
    const configBuilder = Private(explorerChartConfigBuilder);

    _.each(anomalyRecords, (record) => {
      const config = configBuilder.buildConfig(record);
      seriesConfigs.push(config);
    });

    return seriesConfigs;
  }

  function calculateChartRange(earliestMs, latestMs, chartWidth, recordsToPlot) {
    // Calculate the time range for the charts.
    // Fit in as many points in the available container width plotted at the job bucket span.
    const midpointMs = Math.ceil((earliestMs + latestMs) / 2);
    const maxBucketSpanMs = Math.max.apply(null, _.pluck($scope.seriesToPlot, 'bucketSpanSeconds')) * 1000;

    const pointsToPlotFullSelection = Math.ceil((latestMs - earliestMs) / maxBucketSpanMs);

    // Optimally space points 5px apart.
    const optimumPointSpacing = 5;
    const optimumNumPoints = chartWidth / optimumPointSpacing;

    // Increase actual number of points if we can't plot the selected range
    // at optimal point spacing.
    const plotPoints = Math.max(optimumNumPoints, pointsToPlotFullSelection);
    const halfPoints = Math.ceil(plotPoints / 2);
    let chartRange =  { min: midpointMs - (halfPoints * maxBucketSpanMs),
      max: midpointMs + (halfPoints * maxBucketSpanMs) };

    if (plotPoints > CHART_MAX_POINTS) {
      $scope.tooManyBuckets = true;
      // For each series being plotted, display the record with the highest score if possible.
      const maxTimeSpan = maxBucketSpanMs * CHART_MAX_POINTS;
      let minMs = recordsToPlot[0][$scope.timeFieldName];
      let maxMs = recordsToPlot[0][$scope.timeFieldName];

      _.each(recordsToPlot, (record) => {
        const diffMs = maxMs - minMs;
        if (diffMs < maxTimeSpan) {
          const recordTime = record[$scope.timeFieldName];
          if (recordTime < minMs) {
            if (maxMs - recordTime <= maxTimeSpan) {
              minMs = recordTime;
            }
          }

          if (recordTime > maxMs) {
            if (recordTime - minMs <= maxTimeSpan) {
              maxMs = recordTime;
            }
          }
        }
      });

      if ((maxMs - minMs) < maxTimeSpan) {
        // Expand out to cover as much as the requested time span as possible.
        minMs = Math.max(earliestMs, maxMs - maxTimeSpan);
        maxMs = Math.min(latestMs, minMs + maxTimeSpan);
      }

      chartRange = { min: minMs, max: maxMs };
    }

    return chartRange;
  }

});
