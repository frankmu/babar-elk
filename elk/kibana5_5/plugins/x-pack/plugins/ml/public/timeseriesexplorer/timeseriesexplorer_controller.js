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
 * Angular controller for the Machine Learning Time Series Explorer dashboard, which
 * displays the anomalies in a single time series. The controller makes multiple queries
 * to Elasticsearch to obtain the data to populate all the components in the view.
 */

import _ from 'lodash';
import moment from 'moment';

import 'plugins/ml/components/anomalies_table';
import 'plugins/ml/services/job_service';
import 'plugins/ml/services/results_service';

import { notify } from 'ui/notify';
import uiRoutes from 'ui/routes';
import 'ui/timefilter';
import { parseInterval } from 'ui/utils/parse_interval';
import { checkLicense } from 'plugins/ml/license/check_license';
import { checkGetJobsPrivilege } from 'plugins/ml/privilege/check_privilege';
import {
  isTimeSeriesViewJob,
  isTimeSeriesViewDetector,
  isModelPlotEnabled } from 'plugins/ml/util/job_utils';
import { refreshIntervalWatcher } from 'plugins/ml/util/refresh_interval_watcher';
import { IntervalHelperProvider } from 'plugins/ml/util/ml_time_buckets';

uiRoutes
.when('/timeseriesexplorer/?', {
  template: require('./timeseriesexplorer.html'),
  resolve : {
    CheckLicense: checkLicense,
    privileges: checkGetJobsPrivilege
  }
});

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.controller('MlTimeSeriesExplorerController', function ($scope, $route, $timeout, $compile,
  Private, $q, es, timefilter, globalState, AppState, mlJobService, mlResultsService,
  mlJobSelectService, mlTimeSeriesSearchService, mlAnomaliesTableService) {

  // TODO - move the index pattern into a setting?
  $scope.indexPatternId = '.ml-anomalies-*';
  $scope.timeFieldName = 'timestamp';
  timefilter.enabled = true;

  const CHARTS_POINT_TARGET = 500;
  const ANOMALIES_MAX_RESULTS = 500;
  const TimeBuckets = Private(IntervalHelperProvider);

  $scope.jobPickerSelections = [];
  $scope.selectedJob;
  $scope.detectors = [];
  $scope.loading = true;
  $scope.loadCounter = 0;
  $scope.hasResults = false;
  $scope.modelPlotEnabled = false;

  if (globalState.ml === undefined) {
    globalState.ml = {};
    globalState.save();
  }

  $scope.initializeVis = function () {
    // Initialize the AppState in which to store the zoom range.
    const stateDefaults = {
      mlTimeSeriesExplorer: {}
    };
    $scope.appState = new AppState(stateDefaults);

    $scope.jobs = [];

    // Load the job info needed by the visualization, then do the first load.
    mlJobService.loadJobs()
    .then((resp) => {
      if (resp.jobs.length > 0) {
        const timeSeriesJobIds = [];
        _.each(resp.jobs, (job) => {
          if (isTimeSeriesViewJob(job) === true) {
            timeSeriesJobIds.push(job.job_id);
            const bucketSpan = parseInterval(job.analysis_config.bucket_span);
            $scope.jobs.push({
              id:job.job_id, selected: false,
              bucketSpanSeconds: bucketSpan.asSeconds()
            });
          }
        });

        // Select any job set in the global state (i.e. passed in the URL).
        const stateJobIds = _.get(globalState.ml, 'jobIds', []);
        const selectedJobIds = _.filter(stateJobIds, (jobId) => {
          return (timeSeriesJobIds.indexOf(jobId) > -1) && jobId !== '*';
        });

        const invalidIds = _.difference(stateJobIds, selectedJobIds);
        if (invalidIds.length > 0 && invalidIds.indexOf('*') === -1) {
          const warningText = invalidIds.length === 1 ? `Requested job ${invalidIds} cannot be viewed in this dashboard` :
             `Requested jobs ${invalidIds} cannot be viewed in this dashboard`;
          notify.warning(warningText, { lifetime: 30000 });
        }

        if (selectedJobIds.length > 1 || invalidIds.indexOf('*') !== -1) {
          notify.warning('Only one job may be viewed at a time in this dashboard', { lifetime: 30000 });
        }

        if (selectedJobIds.length === 0 && $scope.jobs.length > 0) {
          selectedJobIds.push($scope.jobs[0].id);
        }

        if (selectedJobIds.length > 0) {
          loadForJobId(selectedJobIds[0]);
        }
      } else {
        $scope.loading = false;
      }

    }).catch((resp) => {
      console.log('Time series explorer - error getting job info from elasticsearch:', resp);
    });
  };

  $scope.refresh = function () {

    if ($scope.selectedJob === undefined) {
      return;
    }

    $scope.loading = true;
    $scope.hasResults = false;
    delete $scope.chartDetails;
    delete $scope.contextChartData;
    delete $scope.focusChartData;

    // Counter to keep track of what data sets have been loaded.
    $scope.loadCounter++;
    let awaitingCount = 3;

    // finish() function, called after each data set has been loaded and processed.
    // The last one to call it will trigger the page render.
    function finish(counterVar) {
      awaitingCount--;
      if (awaitingCount === 0 && (counterVar === $scope.loadCounter)) {

        if ($scope.contextChartData && $scope.contextChartData.length) {
          $scope.hasResults = true;
        } else {
          $scope.hasResults = false;
        }
        $scope.loading = false;

        // Tell the results container directives to render.
        // Need to use $timeout to ensure the broadcast happens after the child scope is updated with the new data.
        if ($scope.contextChartData && $scope.contextChartData.length) {
          $timeout(() => {
            $scope.$broadcast('render');
          }, 0);
        }

      }
    }

    const bounds = timefilter.getActiveBounds();

    const detectorIndex = +$scope.detectorId;
    $scope.modelPlotEnabled = isModelPlotEnabled($scope.selectedJob);

    // Only filter on the entity if the field has a value.
    const nonBlankEntities = _.filter($scope.entities, (entity) => { return entity.fieldValue.length > 0; });
    $scope.criteriaFields = [{
      'fieldName':'detector_index',
      'fieldValue':detectorIndex }
    ].concat(nonBlankEntities);

    // Calculate the aggregation interval for the context chart.
    // Context chart swimlane will display bucket anomaly score at the same interval.
    $scope.contextAggregationInterval = calculateAggregationInterval(bounds, CHARTS_POINT_TARGET, CHARTS_POINT_TARGET);
    console.log('aggregationInterval for context data (s):', $scope.contextAggregationInterval.asSeconds());

    // Query 1 - load metric data at low granularity across full time range.
    // Pass a counter flag into the finish() function to make sure we only process the results
    // for the most recent call to the load the data in cases where the job selection and time filter
    // have been altered in quick succession (such as from the job picker with 'Apply time range').
    const counter = $scope.loadCounter;
    mlTimeSeriesSearchService.getMetricData($scope.selectedJob, detectorIndex, nonBlankEntities,
      bounds.min.valueOf(), bounds.max.valueOf(), $scope.contextAggregationInterval.expression)
    .then((resp) => {
      const fullRangeChartData = processMetricPlotResults(resp.results);
      $scope.contextChartData = fullRangeChartData;

      console.log('Time series explorer context chart data set:', $scope.contextChartData);

      // Set zoomFrom/zoomTo attributes in scope which will result in the metric chart automatically
      // selecting the specified range in the context chart, and so loading that date range in the focus chart.
      if ($scope.contextChartData.length) {
        const focusRange = calculateInitialFocusRange();
        $scope.zoomFrom = focusRange[0];
        $scope.zoomTo = focusRange[1];
      }

      finish(counter);
    }).catch((resp) => {
      console.log('Time series explorer - error getting metric data from elasticsearch:', resp);
    });

    // Query 2 - load max record score at same granularity as context chart
    // across full time range for use in the swimlane.
    mlTimeSeriesSearchService.getRecordMaxScoreByTime($scope.selectedJob.job_id,
      $scope.criteriaFields, bounds.min.valueOf(), bounds.max.valueOf(),
      $scope.contextAggregationInterval.expression)
    .then((resp) => {
      const fullRangeRecordScoreData = processRecordScoreResults(resp.results);
      $scope.swimlaneData = fullRangeRecordScoreData;
      console.log('Time series explorer swimlane anomalies data set:', $scope.swimlaneData);

      finish(counter);
    }).catch((resp) => {
      console.log('Time series explorer - error getting bucket anomaly scores from elasticsearch:', resp);
    });

    // Query 3 - load details on the chart used in the chart title (charting function and entity(s)).
    mlTimeSeriesSearchService.getChartDetails($scope.selectedJob, detectorIndex, $scope.entities,
      bounds.min.valueOf(), bounds.max.valueOf())
    .then((resp) => {
      $scope.chartDetails = resp.results;
      finish(counter);
    }).catch((resp) => {
      console.log('Time series explorer - error getting entity counts from elasticsearch:', resp);
    });

    // Populate the entity input datalists with the values from the top records by score
    // for the selected detector across the full time range. No need to pass through finish().
    mlResultsService.getRecordsForCriteria($scope.indexPatternId, [$scope.selectedJob.job_id],
       [{ 'fieldName':'detector_index','fieldValue':detectorIndex }], 0,
       bounds.min.valueOf(), bounds.max.valueOf(), ANOMALIES_MAX_RESULTS)
    .then((resp) => {
      if (resp.records && resp.records.length > 0) {
        const firstRec = resp.records[0];

        _.each($scope.entities, (entity) => {
          if (firstRec.partition_field_name === entity.fieldName) {
            entity.fieldValues = _.chain(resp.records).pluck('partition_field_value').uniq().value();
          }
          if (firstRec.over_field_name === entity.fieldName) {
            entity.fieldValues = _.chain(resp.records).pluck('over_field_value').uniq().value();
          }
          if (firstRec.by_field_name === entity.fieldName) {
            entity.fieldValues = _.chain(resp.records).pluck('by_field_value').uniq().value();
          }
        });
      }

    });
  };

  $scope.refreshFocusData = function (fromDate, toDate) {

    // Counter to keep track of what data sets have been loaded.
    let awaitingCount = 2;

    // finish() function, called after each data set has been loaded and processed.
    // The last one to call it will trigger the page render.
    function finish() {
      awaitingCount--;
      if (awaitingCount === 0) {
        processDataForFocusAnomalies($scope.focusChartData, $scope.anomalyRecords);
        console.log('Time series explorer focus chart data set:', $scope.focusChartData);

        // Tell the results container directives to render the focus chart.
        // Need to use $timeout to ensure the broadcast happens after the child scope is updated with the new data.
        $timeout(() => {
          if ($scope.focusChartData && $scope.focusChartData.length) {
            $scope.$broadcast('renderFocusChart');
            $scope.$broadcast('renderTable');
          } else {
            $scope.$broadcast('renderFocusChart');
            $scope.$broadcast('renderTable');
          }

          $scope.loading = false;
        }, 0);

      }
    }

    const detectorIndex = +$scope.detectorId;
    const nonBlankEntities = _.filter($scope.entities, (entity) => { return entity.fieldValue.length > 0; });

    // Calculate the aggregation interval for the focus chart.
    const bounds = { min: moment(fromDate), max: moment(toDate) };
    $scope.focusAggregationInterval = calculateAggregationInterval(bounds, CHARTS_POINT_TARGET, CHARTS_POINT_TARGET);
    console.log('aggregationInterval for focus data (s):', $scope.focusAggregationInterval.asSeconds());

    // Query 1 - load metric data across selected time range.
    mlTimeSeriesSearchService.getMetricData($scope.selectedJob, detectorIndex, nonBlankEntities,
      bounds.min.valueOf(), bounds.max.valueOf(), $scope.focusAggregationInterval.expression)
    .then((resp) => {
      $scope.focusChartData = processMetricPlotResults(resp.results);
      finish();
    }).catch((resp) => {
      console.log('Time series explorer - error getting metric data from elasticsearch:', resp);
    });

    // Query 2 - load records across selected time range.
    mlResultsService.getRecordsForCriteria($scope.indexPatternId, [$scope.selectedJob.job_id],
      $scope.criteriaFields, 0, bounds.min.valueOf(), bounds.max.valueOf(), ANOMALIES_MAX_RESULTS)
    .then((resp) => {
      // Sort in descending time order before storing in scope.
      $scope.anomalyRecords = _.chain(resp.records).sortBy((record) => {
        return record[$scope.timeFieldName];
      }).reverse().value();
      console.log('Time series explorer anomalies:', $scope.anomalyRecords);
      finish();
    });
  };

  $scope.saveSeriesPropertiesAndRefresh = function () {
    $scope.appState.mlTimeSeriesExplorer.detectorIndex = +$scope.detectorId;
    $scope.appState.mlTimeSeriesExplorer.entities = {};
    _.each($scope.entities, (entity) => {
      $scope.appState.mlTimeSeriesExplorer.entities[entity.fieldName] = entity.fieldValue;
    });
    $scope.appState.save();

    $scope.refresh();
  };

  // Refresh the data when the time range is altered.
  $scope.$listen(timefilter, 'fetch', $scope.refresh);

  // Add a watcher for auto-refresh of the time filter to refresh all the data.
  const refreshWatcher = Private(refreshIntervalWatcher);
  refreshWatcher.init(() => {
    $scope.refresh();
  });

  // Add a listener for filter changes triggered from the anomalies table.
  const filterChangeListener = function (field, value, operator) {
    const entity = _.find($scope.entities, { fieldName:field });
    if (entity !== undefined) {
      if (operator === '+' && entity.fieldValue !== value) {
        entity.fieldValue = value;
        $scope.saveSeriesPropertiesAndRefresh();
      } else if (operator === '-' && entity.fieldValue === value) {
        entity.fieldValue = '';
        $scope.saveSeriesPropertiesAndRefresh();
      }
    }
  };

  mlAnomaliesTableService.addFilterChangeListener(filterChangeListener);

  $scope.$on('$destroy', () => {
    refreshWatcher.cancel();
    mlAnomaliesTableService.removeFilterChangeListener(filterChangeListener);
  });

  // When inside a dashboard in the ML plugin, listen for changes to job selection.
  mlJobSelectService.listenJobSelectionChange($scope, (event, selections) => {
    // Clear the detectorIndex and entities.
    if (selections.length > 0) {
      delete $scope.appState.mlTimeSeriesExplorer.detectorIndex;
      delete $scope.appState.mlTimeSeriesExplorer.entities;
      $scope.appState.save();

      loadForJobId(selections[0]);
    }
  });

  $scope.$on('contextChartSelected', function (event, selection) {
    // Save state of zoom (adds to URL) if it is different to the default.
    if ($scope.contextChartData === undefined || $scope.contextChartData.length === 0) {
      return;
    }

    const defaultRange = calculateDefaultFocusRange();
    if (selection.from.getTime() !== defaultRange[0].getTime() || selection.to.getTime() !== defaultRange[1].getTime()) {
      const zoomState = { from: selection.from.toISOString(), to: selection.to.toISOString() };
      $scope.appState.mlTimeSeriesExplorer.zoom = zoomState;
    } else {
      delete $scope.appState.mlTimeSeriesExplorer.zoom;
    }
    $scope.appState.save();

    if ($scope.focusChartData === undefined ||
      ($scope.zoomFrom.getTime() !== selection.from.getTime()) ||
      ($scope.zoomTo.getTime() !== selection.to.getTime())) {
      $scope.refreshFocusData(selection.from, selection.to);
    }

    $scope.zoomFrom = selection.from;
    $scope.zoomTo = selection.to;

  });

  function loadForJobId(jobId) {
    // Validation that the ID is for a time series job must already have been performed.
    // Check if the job was created since the page was first loaded.
    let jobPickerSelectedJob = _.find($scope.jobs, { 'id': jobId });
    if (jobPickerSelectedJob === undefined) {
      const newJobs = [];
      _.each(mlJobService.jobs, (job) => {
        if (isTimeSeriesViewJob(job) === true) {
          const bucketSpan = parseInterval(job.analysis_config.bucket_span);
          newJobs.push({ id:job.job_id, selected: false, bucketSpanSeconds: bucketSpan.asSeconds() });
        }
      });
      $scope.jobs = newJobs;
      jobPickerSelectedJob = _.find(newJobs, { 'id': jobId });
    }

    $scope.selectedJob = mlJobService.getJob(jobId);
    $scope.jobPickerSelections = [jobPickerSelectedJob];

    // Read the detector index and entities out of the AppState.
    const jobDetectors = $scope.selectedJob.analysis_config.detectors;
    const viewableDetectors = [];
    _.each(jobDetectors, (dtr, index) => {
      if (isTimeSeriesViewDetector($scope.selectedJob, index)) {
        viewableDetectors.push({ index: '' + index, detector_description: dtr.detector_description });
      }
    });
    $scope.detectors = viewableDetectors;

    // Check the supplied index is valid.
    const appStateDtrIdx = $scope.appState.mlTimeSeriesExplorer.detectorIndex;
    let detectorIndex = appStateDtrIdx !== undefined ? appStateDtrIdx : +(viewableDetectors[0].index);
    if (_.find(viewableDetectors, { 'index': '' + detectorIndex }) === undefined) {
      const warningText = `Requested detector index ${detectorIndex} is not valid for job ${$scope.selectedJob.job_id}`;
      notify.warning(warningText, { lifetime: 30000 });
      detectorIndex = +(viewableDetectors[0].index);
      $scope.appState.mlTimeSeriesExplorer.detectorIndex = detectorIndex;
      $scope.appState.save();
    }

    // Store the detector index as a string so it can be used as ng-model in a select control.
    $scope.detectorId = '' + detectorIndex;

    const detector = jobDetectors[detectorIndex];
    const entities = [];
    const entitiesState = $scope.appState.mlTimeSeriesExplorer.entities || {};
    const partitionFieldName = _.get(detector, 'partition_field_name');
    const overFieldName = _.get(detector, 'over_field_name');
    const byFieldName = _.get(detector, 'by_field_name');
    if (partitionFieldName !== undefined) {
      const partitionFieldValue = _.get(entitiesState, partitionFieldName, '');
      entities.push({ fieldName: partitionFieldName, fieldValue: partitionFieldValue });
    }
    if (overFieldName !== undefined) {
      const overFieldValue = _.get(entitiesState, overFieldName, '');
      entities.push({ fieldName: overFieldName, fieldValue: overFieldValue });
    }

    // For jobs with by and over fields, don't add the 'by' field as this
    // field will only be added to the top-level fields for record type results
    // if it also an influencer over the bucket.
    // TODO - metric data can be filtered by this field, so should only exclude
    // from filter for the anomaly records.
    if (byFieldName !== undefined && overFieldName === undefined) {
      const byFieldValue = _.get(entitiesState, byFieldName, '');
      entities.push({ fieldName: byFieldName, fieldValue: byFieldValue });
    }

    $scope.entities = entities;

    globalState.ml.jobIds = [jobId];
    globalState.save();

    $scope.refresh();
  }

  function calculateInitialFocusRange() {
    // Get the time span of data in the context chart.
    const earliestDataDate = _.first($scope.contextChartData).date;
    const latestDataDate = _.last($scope.contextChartData).date;

    // Calculate the 'auto' zoom duration which shows data at bucket span granularity.
    // Get the minimum bucket span of selected jobs.
    // TODO - only look at jobs for which data has been returned?
    const bucketSpanSeconds =  _.find($scope.jobs, { 'id': $scope.selectedJob.job_id }).bucketSpanSeconds;
    $scope.autoZoomDuration = (bucketSpanSeconds * 1000) * (CHARTS_POINT_TARGET - 1);

    // Check for a zoom parameter in the globalState (URL).
    const zoomState = $scope.appState.mlTimeSeriesExplorer.zoom;
    if (zoomState !== undefined) {
      const zoomFrom = moment(zoomState.from, 'YYYY-MM-DDTHH:mm:ss.SSSZ', true);
      const zoomTo = moment(zoomState.to, 'YYYY-MM-DDTHH:mm:ss.SSSZ', true);
      if (zoomFrom.isValid() && zoomTo.isValid &&
        zoomFrom.isBetween(earliestDataDate, latestDataDate, null, '[]') &&
        zoomTo.isBetween(earliestDataDate, latestDataDate, null, '[]')) {
        return [zoomFrom.toDate(), zoomTo.toDate()];
      }
    }

    return calculateDefaultFocusRange();
  }

  function calculateDefaultFocusRange() {
    // Returns the range that shows the most recent data at bucket span granularity.

    // Calculate the 'auto' zoom duration which shows data at bucket span granularity.
    // Get the minimum bucket span of selected jobs.
    // TODO - only look at jobs for which data has been returned?
    const bucketSpanSeconds =  _.find($scope.jobs, { 'id': $scope.selectedJob.job_id }).bucketSpanSeconds;
    $scope.autoZoomDuration = (bucketSpanSeconds * 1000) * (CHARTS_POINT_TARGET - 1);

    const earliestDataDate = _.first($scope.contextChartData).date;
    const latestDataDate = _.last($scope.contextChartData).date;
    const latestMsToLoad = latestDataDate.getTime() + $scope.contextAggregationInterval.asMilliseconds();
    const earliestMsToLoad = Math.max(earliestDataDate.getTime(), latestMsToLoad - $scope.autoZoomDuration);

    return [new Date(earliestMsToLoad), new Date(latestMsToLoad)];
  }

  function calculateAggregationInterval(bounds, bucketsTarget) {
    // Aggregation interval used in queries should be a function of the time span of the chart
    // and the bucket span of the selected job(s).
    const barTarget = (bucketsTarget !== undefined ? bucketsTarget : 100);
    // Use a maxBars of 10% greater than the target.
    const maxBars = Math.floor(1.1 * barTarget);
    const buckets = new TimeBuckets();
    buckets.setInterval('auto');
    buckets.setBounds(bounds);
    buckets.setBarTarget(Math.floor(barTarget));
    buckets.setMaxBars(maxBars);
    let aggInterval = buckets.getInterval();

    // Set the interval back to the job bucket span if the auto interval is smaller.
    const bucketSpanSeconds =  _.find($scope.jobs, { 'id': $scope.selectedJob.job_id }).bucketSpanSeconds;
    const secs = aggInterval.asSeconds();
    if (secs < bucketSpanSeconds) {
      buckets.setInterval(bucketSpanSeconds + 's');
      aggInterval = buckets.getInterval();
    }

    console.log('calculateAggregationInterval() barTarget,maxBars,returning:', bucketsTarget, maxBars,
      (bounds.max.diff(bounds.min)) / aggInterval.asMilliseconds());

    return aggInterval;
  }

  function processMetricPlotResults(metricPlotData) {
    // Return dataset in format used by the single metric chart.
    // i.e. array of Objects with keys date (JavaScript date) and value,
    // plus lower and upper keys if model plot is enabled for the series.
    const metricPlotChartData = [];
    if ($scope.modelPlotEnabled === true) {
      _.each(metricPlotData, (dataForTime, time) => {
        metricPlotChartData.push({
          date: new Date(+time),
          lower: dataForTime.modelLower,
          value: dataForTime.actual,
          upper: dataForTime.modelUpper
        });
      });
    } else {
      _.each(metricPlotData, (dataForTime, time) => {
        metricPlotChartData.push({
          date: new Date(+time),
          value: dataForTime.actual
        });
      });
    }

    return metricPlotChartData;
  }

  function processRecordScoreResults(scoreData) {
    // Return dataset in format used by the swimlane.
    // i.e. array of Objects with keys date (JavaScript date) and score.
    const bucketScoreData = [];
    _.each(scoreData, (dataForTime, time) => {
      bucketScoreData.push(
        {
          date: new Date(+time),
          score: dataForTime.score,
        });
    });

    return bucketScoreData;
  }

  function processDataForFocusAnomalies(chartData, anomalyRecords) {
    // Combine the data from the two sets to add anomalyScore properties
    // to the chartData entries for anomalous buckets.

    // Iterate through the anomaly records, adding anomalyScore properties
    // to the chartData entries for anomalous buckets.
    _.each(anomalyRecords, (record) => {

      // Look for a chart point with the same time as the record.
      // If none found, find closest time in chartData set.
      const recordTime = record[$scope.timeFieldName];
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
          if (itemTime > recordTime) {
            const item = chartData[i];
            const prevousItem = chartData[i - 1];

            const diff1 = Math.abs(recordTime - prevousItem.date.getTime());
            const diff2 = Math.abs(recordTime - itemTime);

            // foundItem should be the item with a date closest to bucketTime
            if (prevousItem === undefined || diff1 > diff2) {
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
        chartPoint.function = record.function;

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

  $scope.initializeVis();

});
