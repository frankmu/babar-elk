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
 * Angular controller for the Machine Learning Explorer dashboard. The controller makes
 * multiple queries to Elasticsearch to obtain the data to populate all the components
 * in the view.
 */

import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';

import 'plugins/ml/components/anomalies_table';
import 'plugins/ml/components/influencers_list';
import 'plugins/ml/components/job_select_list';
import 'plugins/ml/services/job_service';
import 'plugins/ml/services/results_service';

import { FilterBarQueryFilterProvider } from 'ui/filter_bar/query_filter';
import { parseInterval } from 'ui/utils/parse_interval';

import { notify } from 'ui/notify';
import uiRoutes from 'ui/routes';
import { checkLicense } from 'plugins/ml/license/check_license';
import { checkGetJobsPrivilege } from 'plugins/ml/privilege/check_privilege';
import { refreshIntervalWatcher } from 'plugins/ml/util/refresh_interval_watcher';
import { IntervalHelperProvider } from 'plugins/ml/util/ml_time_buckets';

uiRoutes
.when('/explorer/?', {
  template: require('./explorer.html'),
  resolve : {
    CheckLicense: checkLicense,
    privileges: checkGetJobsPrivilege
  }
});

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.controller('MlExplorerController', function ($scope, $timeout, AppState, Private, timefilter,
  globalState, mlJobService, mlResultsService, mlJobSelectService, mlExplorerDashboardService) {

  // TODO - move the index pattern into a setting?
  $scope.indexPatternId = '.ml-anomalies-*';
  $scope.timeFieldName = 'timestamp';
  $scope.loading = true;
  $scope.loadCounter = 0;
  $scope.showNoSelectionMessage = true;     // User must select a swimlane cell to view anomalies.
  timefilter.enabled = true;

  if (globalState.ml === undefined) {
    globalState.ml = {};
    globalState.save();
  }

  const TimeBuckets = Private(IntervalHelperProvider);
  const queryFilter = Private(FilterBarQueryFilterProvider);

  let resizeTimeout = null;

  const $mlExplorer = $('.ml-explorer');
  const MAX_INFLUENCER_FIELD_NAMES = 10;
  const MAX_DISPLAY_FIELD_VALUES = 10;
  const VIEW_BY_JOB_LABEL = 'job ID';

  $scope.getSelectedJobIds = function () {
    const selectedJobs = _.filter($scope.jobs, (job) => { return job.selected; });
    return _.map(selectedJobs, function (job) {return job.id;});
  };

  $scope.viewBySwimlaneOptions = [];
  $scope.viewBySwimlaneData = { 'fieldName': '', 'laneLabels':[],
    'points':[], 'interval': 3600 };

  $scope.initializeVis = function () {
    // Initialize the AppState in which to store filters.
    const stateDefaults = {
      filters: [],
      mlExplorerSwimlane: {}
    };
    $scope.appState = new AppState(stateDefaults);
    $scope.jobs = [];

    // Load the job info needed by the dashboard, then do the first load.
    // Calling loadJobs() ensures the full datafeed config is available for building the charts.
    mlJobService.loadJobs().then((resp) => {
      if (resp.jobs.length > 0) {
        _.each(resp.jobs, (job) => {
          const bucketSpan = parseInterval(job.analysis_config.bucket_span);
          $scope.jobs.push({ id:job.job_id, selected: false, bucketSpanSeconds: bucketSpan.asSeconds() });
        });

        // Select any jobs set in the global state (i.e. passed in the URL).
        const selectedJobIds = _.get(globalState.ml, 'jobIds', []);
        $scope.setSelectedJobs(selectedJobIds);
      } else {
        $scope.loading = false;
      }

    }).catch((resp) => {
      console.log('Explorer - error getting job info from elasticsearch:', resp);
    });

    mlExplorerDashboardService.init();
  };

  $scope.loadAnomaliesTable = function (jobIds, influencers, earliestMs, latestMs) {
    mlResultsService.getRecordsForInfluencer($scope.indexPatternId, jobIds, influencers,
      0, earliestMs, latestMs, 500)
    .then((resp) => {
      // Sort in descending time order before storing in scope.
      $scope.anomalyRecords = _.chain(resp.records).sortBy(function (record) { return record[$scope.timeFieldName]; }).reverse().value();
      console.log('Explorer anomalies table data set:', $scope.anomalyRecords);

      // Need to use $timeout to ensure the broadcast happens after the child scope is updated with the new data.
      $timeout(function () {
        $scope.$broadcast('renderTable');
      }, 0);
    });
  };

  $scope.loadAnomaliesForCharts = function (jobIds, influencers, earliestMs, latestMs) {
    // Load the top anomalies (by record_score) which will be diplayed in the charts.
    // TODO - combine this with loadAnomaliesTable() if the table is being retained.
    mlResultsService.getRecordsForInfluencer($scope.indexPatternId, jobIds, influencers,
      0, earliestMs, latestMs, 500)
    .then((resp) => {
      $scope.anomalyChartRecords = resp.records;
      console.log('Explorer anomaly charts data set:', $scope.anomalyChartRecords);

      mlExplorerDashboardService.fireAnomalyDataChange($scope.anomalyChartRecords, earliestMs, latestMs);

      // Need to use $timeout to ensure the broadcast happens after the child scope is updated with the new data.
      // TODO - do we need this as the way to re-render the charts?
      $timeout(function () {
        $scope.$broadcast('renderCharts');
      }, 0);
    });
  };

  $scope.setSelectedJobs = function (selections) {
    let previousSelected = 0;
    if ($scope.selectedJobs !== undefined) {
      previousSelected = $scope.selectedJobs.length;
    }

    // Validate selections.
    // Check for any new jobs created since the page was first loaded.
    for (let i = 0; i < selections.length; i++) {
      if (_.find($scope.jobs, { 'id': selections[i] }) === undefined) {
        const newJobs = [];
        _.each(mlJobService.jobs, (job) => {
          const bucketSpan = parseInterval(job.analysis_config.bucket_span);
          newJobs.push({ id:job.job_id, selected: false, bucketSpanSeconds: bucketSpan.asSeconds() });
        });
        $scope.jobs = newJobs;
        break;
      }
    }

    // Check and warn for any jobs that do not exist.
    let validSelections = selections.slice(0);
    let selectAll = ((selections.length === 1 && selections[0] === '*') || selections.length === 0);
    if (selectAll === false) {
      const invalidIds = _.filter(selections, (id) => {
        return _.find($scope.jobs, { 'id': id }) === undefined;
      });
      if (invalidIds.length > 0) {
        const warningText = invalidIds.length === 1 ? `Requested job ${invalidIds} does not exist` :
            `Requested jobs ${invalidIds} do not exist`;
        notify.warning(warningText, { lifetime: 30000 });
      }
      validSelections = _.difference(selections, invalidIds);
    }

    selectAll = ((validSelections.length === 1 && validSelections[0] === '*') || validSelections.length === 0);

    $scope.selectedJobs = [];
    const selectedJobIds = [];
    _.each($scope.jobs, (job) => {
      job.selected = (selectAll || _.indexOf(validSelections, job.id) !== -1);
      if (job.selected) {
        $scope.selectedJobs.push(job);
        selectedJobIds.push(job.id);
      }
    });

    globalState.ml.jobIds = validSelections;
    globalState.save();

    // Clear viewBy from the state if we are moving from single
    // to multi selection, or vice-versa.
    if ((previousSelected <= 1 && selectedJobIds.length > 1) ||
      (selectedJobIds.length === 1 && previousSelected > 1)) {
      delete $scope.appState.mlExplorerSwimlane.viewBy;
    }
    $scope.appState.save();

    clearSelectedAnomalies();
    loadOverallData();
  };

  $scope.setSwimlaneViewBy = function (viewByFieldName) {
    $scope.swimlaneViewByFieldName = viewByFieldName;

    // Save the 'view by' field name to the AppState so that it can restored from the URL.
    $scope.appState.mlExplorerSwimlane.viewBy = viewByFieldName;
    $scope.appState.save();

    loadViewBySwimlane([]);
    clearSelectedAnomalies();
  };

  // Refresh all the data when the time range is altered.
  $scope.$listen(timefilter, 'fetch', () => {
    loadOverallData();
    clearSelectedAnomalies();
  });

  // Add a watcher for auto-refresh of the time filter to refresh all the data.
  const refreshWatcher = Private(refreshIntervalWatcher);
  refreshWatcher.init(() => {
    loadOverallData();
    // TODO - would be better to only clear and reload the selected anomalies
    // if the previous selection was no longer applicable.
    clearSelectedAnomalies();
  });

  // Listen for changes to job selection.
  mlJobSelectService.listenJobSelectionChange($scope, function (event, selections) {
    // Clear swimlane selection from state.
    delete $scope.appState.mlExplorerSwimlane.selectedType;
    delete $scope.appState.mlExplorerSwimlane.selectedLane;
    delete $scope.appState.mlExplorerSwimlane.selectedTime;
    delete $scope.appState.mlExplorerSwimlane.selectedInterval;

    $scope.setSelectedJobs(selections);
  });

  // Redraw the swimlane when the window resizes or the global nav is toggled.
  $(window).resize(() => {
    if (resizeTimeout !== null) {
      $timeout.cancel(resizeTimeout);
    }
    // Only redraw 500ms after last resize event.
    resizeTimeout = $timeout(redrawOnResize, 500);
  });

  const navListener = $scope.$on('globalNav:update', () => {
    // Run in timeout so that content pane has resized after global nav has updated.
    $timeout(function () {
      redrawOnResize();
    }, 300);
  });

  function redrawOnResize() {
    $scope.swimlaneWidth = getSwimlaneContainerWidth();
    $scope.$apply();

    mlExplorerDashboardService.fireSwimlaneDataChange('overall');
    mlExplorerDashboardService.fireSwimlaneDataChange('viewBy');
  }

  // Refresh the data when the dashboard filters are updated.
  $scope.$listen(queryFilter, 'update', function () {
    // TODO - add in filtering functionality.
    console.log('explorer_controller queryFilter update, filters:', queryFilter.getFilters());
  });

  $scope.initializeVis();

  $scope.showViewBySwimlane = function () {
    return $scope.viewBySwimlaneData !== null && $scope.viewBySwimlaneData.laneLabels && $scope.viewBySwimlaneData.laneLabels.length > 0;
  };

  // Listener for click events in the swimlane and load corresponding anomaly data.
  // Empty cellData is passed on clicking outside a cell with score > 0.
  const swimlaneCellClickListener = function (cellData) {
    if (_.keys(cellData).length === 0) {
      // Swimlane deselection - clear anomalies section.
      if ($scope.viewByLoadedForTimeFormatted) {
        // Reload 'view by' swimlane over full time range.
        loadViewBySwimlane([]);
      }
      clearSelectedAnomalies();
    } else {
      let jobIds = [];
      const influencers = [];

      // Time range for charts should be maximum time span at job bucket span, centred on the selected cell.
      const bounds = timefilter.getActiveBounds();
      const earliestMs = cellData.time !== undefined ? cellData.time * 1000 : bounds.min.valueOf();
      const latestMs = cellData.time !== undefined ? ((cellData.time  + cellData.interval) * 1000) - 1 : bounds.max.valueOf();

      if (cellData.fieldName === undefined) {
        // Click is in one of the cells in the Overall swimlane - reload the 'view by' swimlane
        // to show the top 'view by' values for the selected time.
        loadViewBySwimlaneForSelectedTime(earliestMs, latestMs);
        $scope.viewByLoadedForTimeFormatted = moment(earliestMs).format('MMMM Do YYYY, HH:mm');
      }

      if (cellData.fieldName === VIEW_BY_JOB_LABEL) {
        jobIds.push(cellData.laneLabel);
      } else {
        jobIds = $scope.getSelectedJobIds();

        if (cellData.fieldName !== undefined) {
          influencers.push({ fieldName: $scope.swimlaneViewByFieldName, fieldValue: cellData.laneLabel });
        }
      }

      $scope.loadAnomaliesTable(jobIds, influencers, earliestMs, latestMs);
      $scope.loadAnomaliesForCharts(jobIds, influencers, earliestMs, latestMs);
      $scope.showNoSelectionMessage = false;
    }
  };

  mlExplorerDashboardService.addSwimlaneCellClickListener(swimlaneCellClickListener);

  $scope.$on('$destroy', () => {
    mlExplorerDashboardService.removeSwimlaneCellClickListener(swimlaneCellClickListener);
    refreshWatcher.cancel();
    // Cancel listening for updates to the global nav state.
    navListener();
  });

  function loadViewBySwimlaneOptions() {
    // Obtain the list of 'View by' fields per job.
    $scope.swimlaneViewByFieldName = null;
    let viewByOptions = [];   // Unique influencers for the selected job(s).

    const selectedJobIds = $scope.getSelectedJobIds();
    const fieldsByJob = { '*':[] };
    _.each(mlJobService.jobs, (job) => {
      // Add the list of distinct by, over, partition and influencer fields for each job.
      let fieldsForJob = [];

      const analysisConfig = job.analysis_config;
      const detectors = analysisConfig.detectors || [];
      _.each(detectors, (detector) => {
        if (_.has(detector, 'partition_field_name')) {
          fieldsForJob.push(detector.partition_field_name);
        }
        if (_.has(detector, 'over_field_name')) {
          fieldsForJob.push(detector.over_field_name);
        }
        // For jobs with by and over fields, don't add the 'by' field as this
        // field will only be added to the top-level fields for record type results
        // if it also an influencer over the bucket.
        if (_.has(detector, 'by_field_name') && !(_.has(detector, 'over_field_name'))) {
          fieldsForJob.push(detector.by_field_name);
        }
      });

      const influencers = analysisConfig.influencers || [];
      fieldsForJob = fieldsForJob.concat(influencers);
      if (selectedJobIds.indexOf(job.job_id) !== -1) {
        viewByOptions = viewByOptions.concat(influencers);
      }

      fieldsByJob[job.job_id] = _.uniq(fieldsForJob);
      fieldsByJob['*'] = _.union(fieldsByJob['*'], fieldsByJob[job.job_id]);
    });

    $scope.fieldsByJob = fieldsByJob;   // Currently unused but may be used if add in view by detector.
    viewByOptions = _.chain(viewByOptions).uniq().sortBy((fieldname) => { return fieldname.toLowerCase(); }).value();
    viewByOptions.push(VIEW_BY_JOB_LABEL);
    $scope.viewBySwimlaneOptions = viewByOptions;

    if ($scope.appState.mlExplorerSwimlane.viewBy !== undefined &&
      $scope.viewBySwimlaneOptions.indexOf($scope.appState.mlExplorerSwimlane.viewBy) !== -1) {
      // Set the swimlane viewBy to that stored in the state (URL) if set.
      $scope.swimlaneViewByFieldName = $scope.appState.mlExplorerSwimlane.viewBy;
    } else {
      if (selectedJobIds.length > 1) {
        // If more than one job selected, default to job ID.
        $scope.swimlaneViewByFieldName = VIEW_BY_JOB_LABEL;
      } else {
        // For a single job, default to the first partition, over,
        // by or influencer field of the first selected job.
        const firstSelectedJob = _.find(mlJobService.jobs, (job) => {
          return job.job_id === selectedJobIds[0];
        });

        const firstJobInfluencers = firstSelectedJob.analysis_config.influencers || [];
        _.each(firstSelectedJob.analysis_config.detectors,(detector) => {

          if (_.has(detector, 'partition_field_name') &&
              firstJobInfluencers.indexOf(detector.partition_field_name) !== -1) {
            $scope.swimlaneViewByFieldName = detector.partition_field_name;
            return false;
          }

          if (_.has(detector, 'over_field_name') &&
              firstJobInfluencers.indexOf(detector.over_field_name) !== -1) {
            $scope.swimlaneViewByFieldName = detector.over_field_name;
            return false;
          }

          // For jobs with by and over fields, don't add the 'by' field as this
          // field will only be added to the top-level fields for record type results
          // if it also an influencer over the bucket.
          if (_.has(detector, 'by_field_name') && !(_.has(detector, 'over_field_name')) &&
              firstJobInfluencers.indexOf(detector.by_field_name) !== -1) {
            $scope.swimlaneViewByFieldName = detector.by_field_name;
            return false;
          }
        });

        if ($scope.swimlaneViewByFieldName === null) {
          if (firstJobInfluencers.length > 0) {
            $scope.swimlaneViewByFieldName = firstJobInfluencers[0];
          } else {
            // No influencers for first selected job - set to first available option.
            $scope.swimlaneViewByFieldName = $scope.viewBySwimlaneOptions.length > 0 ? $scope.viewBySwimlaneOptions[0] : null;
          }
        }

      }

      $scope.appState.mlExplorerSwimlane.viewBy = $scope.swimlaneViewByFieldName;
      $scope.appState.save();
    }

    loadViewBySwimlane([]);

  }

  function loadOverallData() {
    // Loads the overall data components i.e. the overall swimlane and influencers list.

    if ($scope.selectedJobs === undefined) {
      return;
    }

    $scope.loading = true;
    $scope.hasResults = false;

    // Counter to keep track of what data sets have been loaded.
    $scope.loadCounter++;
    let awaitingCount = 2;

    // finish() function, called after each data set has been loaded and processed.
    // The last one to call it will trigger the page render.
    function finish(counterVar) {
      awaitingCount--;
      if (awaitingCount === 0 && (counterVar === $scope.loadCounter)) {

        if ($scope.overallSwimlaneData.points && $scope.overallSwimlaneData.points.length > 0) {
          $scope.hasResults = true;

          // Trigger loading of the 'view by' swimlane -
          // only load once the overall swimlane so that we can match the time span.
          loadViewBySwimlaneOptions();
        } else {
          $scope.hasResults = false;
        }
        $scope.loading = false;

        // Tell the result components directives to render.
        // Need to use $timeout to ensure the broadcast happens after the child scope is updated with the new data.
        $timeout(function () {
          $scope.$broadcast('render');
          mlExplorerDashboardService.fireSwimlaneDataChange('overall');
        }, 0);
      }
    }

    $scope.swimlaneBucketInterval = calculateSwimlaneBucketInterval();
    console.log('Explorer swimlane bucketInterval:', $scope.swimlaneBucketInterval);

    const bounds = timefilter.getActiveBounds();
    const selectedJobIds = $scope.getSelectedJobIds();

    // Query 1 - load list of top influencers.
    // Pass a counter flag into the finish() function to make sure we only process the results
    // for the most recent call to the load the data in cases where the job selection and time filter
    // have been altered in quick succession (such as from the job picker with 'Apply time range').
    const counter = $scope.loadCounter;
    mlResultsService.getTopInfluencers($scope.indexPatternId, selectedJobIds,
      bounds.min.valueOf(), bounds.max.valueOf(), MAX_INFLUENCER_FIELD_NAMES, MAX_DISPLAY_FIELD_VALUES)
    .then((resp) => {
      // TODO - sort the influencers keys so that the partition field(s) are first.
      $scope.influencersData = resp.influencers;
      console.log('Explorer top influencers data set:', $scope.influencersData);
      finish(counter);
    });

    // Query 2 - load 'overall' scores by time - using max of bucket_influencer anomaly_score.
    // Pass the interval in seconds as the swimlane relies on a fixed number of seconds between buckets
    // which wouldn't be the case if e.g. '1M' was used.
    mlResultsService.getBucketInfluencerMaxScoreByTime($scope.indexPatternId, selectedJobIds,
      bounds.min.valueOf(), bounds.max.valueOf(), $scope.swimlaneBucketInterval.asSeconds() + 's')
    .then((resp) => {
      processOverallResults(resp.results);
      console.log('Explorer overall swimlane data set:', $scope.overallSwimlaneData);
      finish(counter);
    });

  }

  function loadViewBySwimlane(fieldValues) {
    // finish() function, called after each data set has been loaded and processed.
    // The last one to call it will trigger the page render.
    function finish() {
      console.log('Explorer view by swimlane data set:', $scope.viewBySwimlaneData);
      // Fire event to indicate swimlane data has changed.
      // Need to use $timeout to ensure this happens after the child scope is updated with the new data.
      $timeout(function () {
        mlExplorerDashboardService.fireSwimlaneDataChange('viewBy');
      }, 0);
    }

    if ($scope.selectedJobs === undefined ||
        $scope.swimlaneViewByFieldName === undefined  || $scope.swimlaneViewByFieldName === null) {
      $scope.viewBySwimlaneData = { 'fieldName': '', 'laneLabels':[], 'points':[], 'interval': 3600 };
      finish();
    } else {
      const bounds = timefilter.getActiveBounds();
      const selectedJobIds = $scope.getSelectedJobIds();

      // load scores by influencer/jobId value and time.
      // Pass the interval in seconds as the swimlane relies on a fixed number of seconds between buckets
      // which wouldn't be the case if e.g. '1M' was used.
      const interval = $scope.swimlaneBucketInterval.asSeconds() + 's';
      if ($scope.swimlaneViewByFieldName !== VIEW_BY_JOB_LABEL) {
        mlResultsService.getInfluencerValueMaxScoreByTime($scope.indexPatternId, selectedJobIds, $scope.swimlaneViewByFieldName,
          fieldValues, bounds.min.valueOf(), bounds.max.valueOf(), interval, MAX_DISPLAY_FIELD_VALUES)
        .then((resp) => {
          processViewByResults(resp.results);
          finish();
        });
      } else {
        const jobIds = (fieldValues !== undefined && fieldValues.length > 0) ? fieldValues : selectedJobIds;
        mlResultsService.getScoresByBucket($scope.indexPatternId, jobIds,
          bounds.min.valueOf(), bounds.max.valueOf(), interval, MAX_DISPLAY_FIELD_VALUES)
        .then((resp) => {
          processViewByResults(resp.results);
          finish();
        });

      }
    }
  }

  function loadViewBySwimlaneForSelectedTime(earliestMs, latestMs) {
    const selectedJobIds = $scope.getSelectedJobIds();

    // Find the top field values for the selected time, and then load the 'view by'
    // swimlane over the full time range for those specific field values.
    if ($scope.swimlaneViewByFieldName !== VIEW_BY_JOB_LABEL) {
      mlResultsService.getTopInfluencers($scope.indexPatternId, selectedJobIds,
        earliestMs, latestMs, MAX_INFLUENCER_FIELD_NAMES, MAX_DISPLAY_FIELD_VALUES)
      .then((resp) => {
        const topFieldValues = [];
        const topInfluencers = resp.influencers[$scope.swimlaneViewByFieldName];
        _.each(topInfluencers, (influencerData) => {
          if (influencerData.maxAnomalyScore > 0) {
            topFieldValues.push(influencerData.influencerFieldValue);
          }
        });
        loadViewBySwimlane(topFieldValues);
      });
    } else {
      mlResultsService.getScoresByBucket($scope.indexPatternId, selectedJobIds,
        earliestMs, latestMs, $scope.swimlaneBucketInterval.asSeconds() + 's', MAX_DISPLAY_FIELD_VALUES)
      .then((resp) => {
        loadViewBySwimlane(_.keys(resp.results));
      });
    }
  }

  function clearSelectedAnomalies() {
    $scope.anomalyChartRecords = {};
    $scope.anomalyRecords = [];
    $scope.showNoSelectionMessage = true;
    $scope.viewByLoadedForTimeFormatted = null;
  }

  function calculateSwimlaneBucketInterval() {
    // Bucketing interval should be the maximum of the chart related interval (i.e. time range related)
    // and the max bucket span for the jobs shown in the chart.
    const bounds = timefilter.getActiveBounds();
    const buckets = new TimeBuckets();
    buckets.setInterval('auto');
    buckets.setBounds(bounds);

    const intervalSeconds = buckets.getInterval().asSeconds();

    // if the swimlane cell widths are too small they will not be visible
    // calculate how many buckets will be drawn before the swimlanes are actually rendered
    // and increase the interval to widen the cells if they're going to be smaller than 8px
    // this has to be done at this stage so all searches use the same interval
    const numBuckets = parseInt(((bounds.max.valueOf() - bounds.min.valueOf()) / 1000) / intervalSeconds);
    const swimlaneWidth = getSwimlaneContainerWidth();
    const cellWidth = Math.floor(swimlaneWidth / numBuckets);
    $scope.swimlaneWidth = swimlaneWidth;

    // if the cell width is going to be less than 8px, double the interval
    if (cellWidth < 8) {
      buckets.setInterval((intervalSeconds * 2) + 's');
    }

    const selectedJobs = _.filter($scope.jobs, job => job.selected);
    const maxBucketSpanSeconds = _.reduce(selectedJobs, (memo, job) => Math.max(memo, job.bucketSpanSeconds) , 0);
    if (maxBucketSpanSeconds > intervalSeconds) {
      buckets.setInterval(maxBucketSpanSeconds + 's');
      buckets.setBounds(bounds);
    }

    return buckets.getInterval();
  }

  function getSwimlaneContainerWidth() {
    // swimlane width is 5 sixths of the window, minus 170 for the lane labels, minus 50 padding
    return(($mlExplorer.width() / 6) * 5) - 170 - 50;
  }

  function processOverallResults(scoresByTime) {
    const bounds = timefilter.getActiveBounds();
    const boundsMin = Math.floor(bounds.min.valueOf() / 1000);
    const boundsMax = Math.floor(bounds.max.valueOf() / 1000);
    const dataset = { 'laneLabels':['Overall'], 'points':[],
      'interval': $scope.swimlaneBucketInterval.asSeconds(), earliest: boundsMin, latest: boundsMax };

    if (_.keys(scoresByTime).length > 0) {
      // Store the earliest and latest times of the data returned by the ES aggregations,
      // These will be used for calculating the earliest and latest times for the swimlane charts.
      dataset.earliest = Number.MAX_VALUE;
      dataset.latest = 0;

      _.each(scoresByTime, (score, timeMs) => {
        const time = timeMs / 1000;
        dataset.points.push({ 'laneLabel':'Overall', 'time': time, 'value': score });

        dataset.earliest = Math.min(time, dataset.earliest);
        dataset.latest = Math.max((time + dataset.interval), dataset.latest);
      });

      // Adjust the earliest back to the first bucket at or before the start time in the time picker,
      // and the latest forward to the end of the bucket at or after the end time in the time picker.
      // Due to the way the swimlane sections are plotted, the chart buckets
      // must coincide with the times of the buckets in the data.
      const bucketIntervalSecs = $scope.swimlaneBucketInterval.asSeconds();
      if (dataset.earliest > boundsMin) {
        dataset.earliest = dataset.earliest - (Math.ceil((dataset.earliest - boundsMin) / bucketIntervalSecs) * bucketIntervalSecs);
      }
      if (dataset.latest < boundsMax) {
        dataset.latest = dataset.latest + (Math.ceil((boundsMax - dataset.latest) / bucketIntervalSecs) * bucketIntervalSecs);
      }
    }

    $scope.overallSwimlaneData = dataset;
  }

  function processViewByResults(scoresByInfluencerAndTime) {
    const dataset = { 'fieldName': $scope.swimlaneViewByFieldName, 'laneLabels':[],
      'points':[], 'interval': $scope.swimlaneBucketInterval.asSeconds() };

    // Set the earliest and latest to be the same as the overall swimlane.
    dataset.earliest = $scope.overallSwimlaneData.earliest;
    dataset.latest = $scope.overallSwimlaneData.latest;

    _.each(scoresByInfluencerAndTime, (influencerData, influencerFieldValue) => {
      dataset.laneLabels.push(influencerFieldValue);

      _.each(influencerData, (anomalyScore, timeMs) => {
        const time = timeMs / 1000;
        dataset.points.push({ 'laneLabel': influencerFieldValue, 'time': time, 'value': anomalyScore });
      });
    });

    $scope.viewBySwimlaneData = dataset;
  }

});
