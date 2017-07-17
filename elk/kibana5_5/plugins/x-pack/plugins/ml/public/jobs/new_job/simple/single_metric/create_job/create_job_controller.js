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

import _ from 'lodash';
import 'ui/courier';

import 'plugins/kibana/visualize/styles/main.less';
import { AggTypesIndexProvider } from 'ui/agg_types/index';
import { parseInterval } from 'ui/utils/parse_interval';

import dateMath from '@elastic/datemath';
import moment from 'moment';
import angular from 'angular';

import uiRoutes from 'ui/routes';
import { checkLicense } from 'plugins/ml/license/check_license';
import { checkCreateJobsPrivilege } from 'plugins/ml/privilege/check_privilege';
import { IntervalHelperProvider } from 'plugins/ml/util/ml_time_buckets';
import { filterAggTypes } from 'plugins/ml/jobs/new_job/simple/single_metric/create_job/filter_agg_types';
import { isJobIdValid } from 'plugins/ml/util/job_utils';

uiRoutes
.defaults(/dashboard/, {
  requireDefaultIndex: true
})
.when('/jobs/new_job/simple/single_metric/create', {
  template: require('./create_job.html'),
  resolve: {
    CheckLicense: checkLicense,
    privileges: checkCreateJobsPrivilege,
    indexPattern: (courier, $route) => courier.indexPatterns.get($route.current.params.index),
    savedSearch: (courier, $route, savedSearches) => savedSearches.get($route.current.params.savedSearchId)
  }
});

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module
.controller('MlCreateSingleMetricJob', function (
  $scope,
  $route,
  $location,
  $filter,
  $q,
  $window,
  courier,
  timefilter,
  Private,
  mlJobService,
  mlSingleMetricJobService,
  mlMessageBarService,
  mlESMappingService) {

  timefilter.enabled = true;
  const msgs = mlMessageBarService;
  const MlTimeBuckets = Private(IntervalHelperProvider);

  const aggTypes = Private(AggTypesIndexProvider);
  $scope.courier = courier;

  $scope.index = $route.current.params.index;
  $scope.chartData = mlSingleMetricJobService.chartData;

  const PAGE_WIDTH = angular.element('.single-metric-job-container').width();
  const BAR_TARGET = (PAGE_WIDTH > 2000) ? 1000 : (PAGE_WIDTH / 2);
  const MAX_BARS = BAR_TARGET + (BAR_TARGET / 100) * 100; // 100% larger than bar target
  const REFRESH_INTERVAL_MS = 100;
  const MAX_BUCKET_DIFF = 3;
  const METRIC_AGG_TYPE = 'metrics';

  const jobProgressChecks = {
    25: false,
    50: false,
    75: false,
  };

  const CHART_STATE = {
    NOT_STARTED: 0,
    LOADING: 1,
    LOADED: 2,
    NO_RESULTS: 3
  };

  const JOB_STATE = {
    NOT_STARTED: 0,
    RUNNING: 1,
    FINISHED: 2,
    STOPPING: 3
  };

  let refreshCounter = 0;

  $scope.JOB_STATE = JOB_STATE;
  $scope.jobState = $scope.JOB_STATE.NOT_STARTED;

  $scope.CHART_STATE = CHART_STATE;
  $scope.chartState = CHART_STATE.NOT_STARTED;

  // flag to stop all results polling if the user navigates away from this page
  let globalForceStop = false;

  let indexPattern = $route.current.locals.indexPattern;
  let query = {
    query_string: {
      analyze_wildcard: true,
      query: '*'
    }
  };
  let filters = [];
  const savedSearch = $route.current.locals.savedSearch;
  const searchSource = savedSearch.searchSource;

  let pageTitle = `index pattern ${indexPattern.id}`;

  if (indexPattern.id === undefined &&
    savedSearch.id !== undefined) {
    indexPattern = searchSource.get('index');
    const q = searchSource.get('query');
    if(q !== undefined) {
      query = q;
    }

    const fs = searchSource.get('filter');
    if(fs.length) {
      filters = fs;
    }

    pageTitle = `saved search ${savedSearch.title}`;
  }

  $scope.ui = {
    indexPatternId: indexPattern.id,
    pageTitle: pageTitle,
    showJobInput: false,
    showJobFinished: false,
    dirty: true,
    formValid: false,
    bucketSpanValid: true,
    bucketSpanEstimator: { status: 0, message: '' },
    aggTypeOptions: filterAggTypes(aggTypes.byType[METRIC_AGG_TYPE]),
    fields: [],
    timeFields: [],
    intervals: [{
      title: 'Auto',
      value: 'auto',
      /*enabled: function (agg) {
        // not only do we need a time field, but the selected field needs
        // to be the time field. (see #3028)
        return agg.fieldIsTimeField();
      }*/
    }, {
      title: 'Millisecond',
      value: 'ms'
    }, {
      title: 'Second',
      value: 's'
    }, {
      title: 'Minute',
      value: 'm'
    }, {
      title: 'Hourly',
      value: 'h'
    }, {
      title: 'Daily',
      value: 'd'
    }, {
      title: 'Weekly',
      value: 'w'
    }, {
      title: 'Monthly',
      value: 'M'
    }, {
      title: 'Yearly',
      value: 'y'
    }, {
      title: 'Custom',
      value: 'custom'
    }],
    chartHeight: 310,
    showAdvanced: false,
    resultsUrl: '',
    validation: {
      checks: { jobId: { valid: true } },
    },
    isCountOrSum: false
  };

  $scope.formConfig = {
    agg: {
      type: undefined
    },
    field: null,
    bucketSpan: '5m',
    chartInterval: undefined,
    resultsIntervalSeconds: undefined,
    start: 0,
    end: 0,
    timeField: indexPattern.timeFieldName,
    indexPattern: undefined,
    query,
    filters,
    jobId: undefined,
    description: undefined,
    mappingTypes: [],
    useDedicatedIndex: false
  };

  $scope.aggChange = function () {
    loadFields();
    $scope.ui.isFormValid();
    $scope.ui.dirty = true;
    mlESMappingService.getMappings();

    $scope.ui.isCountOrSum = ($scope.formConfig.agg.type.name === 'count' || $scope.formConfig.agg.type.name === 'sum');
  };

  $scope.fieldChange = function () {
    $scope.ui.isFormValid();
    $scope.ui.dirty = true;
  };

  $scope.bucketSpanFieldChange = function () {
    $scope.ui.isFormValid();
    $scope.ui.bucketSpanEstimator.status = 0;
    $scope.ui.bucketSpanEstimator.message = '';

    $scope.ui.bucketSpanValid = true;
    if(parseInterval($scope.formConfig.bucketSpan) === null) {
      $scope.ui.bucketSpanValid = false;
    }
  };

  function setTime() {
    $scope.ui.bucketSpanValid = true;
    $scope.formConfig.start = dateMath.parse(timefilter.time.from).valueOf();
    $scope.formConfig.end = dateMath.parse(timefilter.time.to).valueOf();
    $scope.formConfig.format = 'epoch_millis';

    if(parseInterval($scope.formConfig.bucketSpan) === null) {
      $scope.ui.bucketSpanValid = false;
    }

    const bounds = timefilter.getActiveBounds();
    $scope.formConfig.chartInterval = new MlTimeBuckets();
    $scope.formConfig.chartInterval.setBarTarget(BAR_TARGET);
    $scope.formConfig.chartInterval.setMaxBars(MAX_BARS);
    $scope.formConfig.chartInterval.setInterval('auto');
    $scope.formConfig.chartInterval.setBounds(bounds);

    adjustIntervalDisplayed($scope.formConfig.chartInterval);

    $scope.ui.isFormValid();
    $scope.ui.dirty = true;
  }

  // ensure the displayed interval is never smaller than the bucketSpan
  // otherwise the model plot bounds can be drawn in the wrong place.
  // this only really affects small jobs when using sum
  function adjustIntervalDisplayed(interval) {
    let makeTheSame = false;
    const intervalSeconds = interval.getInterval().asSeconds();
    const bucketSpan = parseInterval($scope.formConfig.bucketSpan);

    if (bucketSpan.asSeconds() > intervalSeconds) {
      makeTheSame = true;
    }

    if ($scope.formConfig.agg.type !== undefined) {
      const mlName = $scope.formConfig.agg.type.mlName;
      if (mlName === 'count' ||
        mlName === 'low_count' ||
        mlName === 'high_count' ||
        mlName === 'distinct_count') {
        makeTheSame = true;
      }
    }

    if (makeTheSame) {
      interval.setInterval(bucketSpan);
    }
  }

  function loadFields() {
    const type = $scope.formConfig.agg.type;
    let fields = [];
    type.params.forEach((param) => {
      if (param.name === 'field') {
        fields = getIndexedFields(param);
      }
    });

    $scope.ui.fields = [];
    _.each(fields, (field, i) => {
      // if the field name contains bad characters which break elasticsearch aggregations
      // use a dummy name.
      // e.g. field_0, field_1
      const id = field.displayName.match(/^[a-zA-Z0-9-_]+$/) ?
        field.displayName :
        `field_${i}`;

      const f = {
        id,
        name: field.displayName,
        tooltip: field.displayName,
        agg: { type }
      };
      $scope.ui.fields.push(f);
    });

    if ($scope.ui.fields.length === 1 ||
      ($scope.formConfig.field === null && type.name === 'cardinality')) {
      $scope.formConfig.field = $scope.ui.fields[0];
    }
  }

  function getIndexedFields(param) {
    let fields = _.filter(indexPattern.fields.raw, 'aggregatable');
    const fieldTypes = param.filterFieldTypes;

    if (fieldTypes) {
      fields = $filter('fieldType')(fields, fieldTypes);
      fields = $filter('orderBy')(fields, ['type', 'name']);
      fields = _.filter(fields, (f) => f.displayName !== '_type');
    }
    return fields;
  }

  $scope.ui.isFormValid = function () {
    if ($scope.formConfig.agg.type === undefined ||
        $scope.formConfig.timeField === undefined) {

      $scope.ui.formValid = false;
    } else {
      $scope.ui.formValid = true;
    }
    return $scope.ui.formValid;
  };

  $scope.loadVis = function () {
    setTime();
    $scope.ui.isFormValid();

    if ($scope.ui.formValid) {

      $scope.ui.showJobInput = true;
      $scope.ui.showJobFinished = false;

      $scope.formConfig.indexPattern = indexPattern;
      $scope.ui.dirty = false;

      $scope.chartState = CHART_STATE.LOADING;

      mlSingleMetricJobService.getLineChartResults($scope.formConfig)
      .then((resp) => {
        $scope.chartState = (resp.length) ? CHART_STATE.LOADED : CHART_STATE.NO_RESULTS;
      })
      .catch((resp) => {
        msgs.error(resp.message);
        $scope.chartState = CHART_STATE.NO_RESULTS;
      })
      .finally(() => {
        $scope.$broadcast('render');
      });
    }
  };

  // force job ids to be lowercase
  $scope.changeJobIDCase = function () {
    if ($scope.formConfig.jobId) {
      $scope.formConfig.jobId = $scope.formConfig.jobId.toLowerCase();
    }
  };

  let ignoreModel = false;
  let refreshInterval = REFRESH_INTERVAL_MS;
  // function for creating a new job.
  // creates the job, opens it, creates the datafeed and starts it.
  // the job may fail to open, but the datafeed should still be created
  // if the job save was successful.
  $scope.createJob = function () {
    if (validateJobId($scope.formConfig.jobId)) {
      msgs.clear();
      $scope.formConfig.mappingTypes = mlESMappingService.getTypesFromMapping($scope.formConfig.indexPattern.id);
      // create the new job
      mlSingleMetricJobService.createJob($scope.formConfig)
      .then((job) => {
        // if save was successful, open the job
        mlJobService.openJob(job.job_id)
        .then(() => {
          // if open was successful create a new datafeed
          saveNewDatafeed(job, true);
        })
        .catch((resp) => {
          msgs.error('Could not open job: ', resp);
          msgs.error('Job created, creating datafeed anyway');
          // if open failed, still attempt to create the datafeed
          // as it may have failed because we've hit the limit of open jobs
          saveNewDatafeed(job, false);
        });

      })
      .catch((resp) => {
        // save failed
        msgs.error('Save failed: ', resp.resp);
      });
    }

    // save new datafeed internal function
    // creates a new datafeed and attempts to start it depending
    // on startDatafeedAfterSave flag
    function saveNewDatafeed(job, startDatafeedAfterSave) {
      mlJobService.saveNewDatafeed(job.datafeed_config, job.job_id)
      .then(() => {

        if (startDatafeedAfterSave) {
          mlSingleMetricJobService.startDatafeed($scope.formConfig)
          .then(() => {
            $scope.jobState = JOB_STATE.RUNNING;
            refreshCounter = 0;
            ignoreModel = false;
            refreshInterval = REFRESH_INTERVAL_MS;
            // create the interval size for querying results.
            // it should not be smaller than the bucket_span
            $scope.formConfig.resultsIntervalSeconds = $scope.formConfig.chartInterval.getInterval().asSeconds();
            const bucketSpanSeconds = parseInterval($scope.formConfig.bucketSpan).asSeconds();
            if ($scope.formConfig.resultsIntervalSeconds < bucketSpanSeconds) {
              $scope.formConfig.resultsIntervalSeconds = bucketSpanSeconds;
            }

            createResultsUrl();

            loadCharts();
          })
          .catch((resp) => {
            // datafeed failed
            msgs.error('Could not start datafeed: ', resp);
          });
        }
      })
      .catch((resp) => {
        msgs.error('Save datafeed failed: ', resp);
      });
    }
  };

  function loadCharts() {
    let forceStop = globalForceStop;
    // the percentage doesn't always reach 100, so periodically check the datafeed state
    // to see if the datafeed has stopped
    const counterLimit = 20 - (refreshInterval / REFRESH_INTERVAL_MS);
    if (refreshCounter >=  counterLimit) {
      refreshCounter = 0;
      mlSingleMetricJobService.checkDatafeedState($scope.formConfig)
      .then((state) => {
        if (state === 'stopped') {
          console.log('Stopping poll because datafeed state is: ' + state);
          $scope.$broadcast('render-results');
          forceStop = true;
        }
        run();
      });
    } else {
      run();
    }

    function run() {
      refreshCounter++;
      reloadSwimlane()
      .then(() => {
        if (forceStop === false && $scope.chartData.percentComplete < 100) {
          // if state has been set to stopping (from the stop button), leave state as it is
          if ($scope.jobState === JOB_STATE.STOPPING) {
            $scope.jobState = JOB_STATE.STOPPING;
          } else {
            // otherwise assume the job is running
            $scope.jobState = JOB_STATE.RUNNING;
          }
        } else {
          $scope.jobState = JOB_STATE.FINISHED;
        }

        if (ignoreModel) {
          jobCheck();
        } else {

          // check to see if the percentage is past a threshold for reloading the full model
          let fullModelRefresh = false;
          _.each(jobProgressChecks, (c, i) => {
            if (jobProgressChecks[i] === false && $scope.chartData.percentComplete >= i) {
              jobProgressChecks[i] = true;
              fullModelRefresh = true;
            }
          });
          // the full model needs to be refreshed
          if (fullModelRefresh) {
            $scope.chartData.model = [];
          }

          reloadModelChart()
          .catch(() => {
            // on the 10th model load failure, set ignoreNodel to true to stop trying to load it.
            if (refreshCounter % 10 === 0) {
              console.log('Model has failed to load 10 times. Stop trying to load it.');
              ignoreModel = true;
            }
          })
          .finally(() => {
            jobCheck();
          });
        }
      });
    }
  }

  function jobCheck() {
    let isLastRun = false;
    if ($scope.jobState === JOB_STATE.RUNNING || $scope.jobState === JOB_STATE.STOPPING) {
      refreshInterval = adjustRefreshInterval($scope.chartData.loadingDifference, refreshInterval);
      _.delay(loadCharts, refreshInterval);
    } else {
      $scope.chartData.percentComplete = 100;
      isLastRun = true;
    }

    if (isLastRun && !ignoreModel) {
      // at the very end of the job, reload the full model just in case there are
      // any jitters in the chart caused by previously loading the model mid job.
      $scope.chartData.model = [];
      reloadModelChart().finally(() => {
        $scope.$broadcast('render-results');
      });
    } else {
      $scope.$broadcast('render-results');
    }
  }

  function reloadModelChart() {
    return mlSingleMetricJobService.loadModelData($scope.formConfig);
  }


  function reloadSwimlane() {
    return mlSingleMetricJobService.loadSwimlaneData($scope.formConfig);
  }

  function adjustRefreshInterval(loadingDifference, currentInterval) {
    const INTERVAL_INCREASE_MS = 100;
    const MAX_INTERVAL = 10000;
    let interval = currentInterval;

    if (interval < MAX_INTERVAL) {
      if (loadingDifference < MAX_BUCKET_DIFF) {
        interval = interval + INTERVAL_INCREASE_MS;
      } else {
        if ((interval - INTERVAL_INCREASE_MS) >= REFRESH_INTERVAL_MS) {
          interval = interval - INTERVAL_INCREASE_MS;
        }
      }
    }
    return interval;
  }

  $scope.setFullTimeRange = function () {
    mlSingleMetricJobService.indexTimeRange(indexPattern, query)
    .then((resp) => {
      timefilter.time.from = moment(resp.start.epoch).toISOString();
      timefilter.time.to = moment(resp.end.epoch).toISOString();
    })
    .catch((resp) => {
      msgs.error(resp.message);
    });
  };

  $scope.resetJob = function () {
    $scope.jobState = JOB_STATE.NOT_STARTED;
    angular.element('.model-chart, .swimlane').css('opacity', 0);

    _.each(jobProgressChecks, (c, i) => {
      jobProgressChecks[i] = false;
    });

    window.setTimeout(() => {
      $scope.ui.showJobInput = true;
      $scope.loadVis();
    }, 500);

  };

  $scope.stopJob = function () {
    // setting the state to STOPPING disables the stop button
    $scope.jobState = JOB_STATE.STOPPING;
    mlSingleMetricJobService.stopDatafeed($scope.formConfig);
  };

  function createResultsUrl() {
    const from = moment($scope.formConfig.start).toISOString();
    const to = moment($scope.formConfig.end).toISOString();
    let path = '';
    path += 'ml#/timeseriesexplorer';
    path += `?_g=(ml:(jobIds:!('${$scope.formConfig.jobId}'))`;
    path += `,refreshInterval:(display:Off,pause:!f,value:0),time:(from:'${from}'`;
    path += `,mode:absolute,to:'${to}'`;
    path += '))&_a=(filters:!(),query:(query_string:(analyze_wildcard:!t,query:\'*\')))';

    $scope.resultsUrl = path;
  }

  $scope.$listen(timefilter, 'fetch', $scope.loadVis);

  $scope.$on('$destroy', () => {
    globalForceStop = true;
  });

  function validateJobId(jobId) {
    let valid = true;
    const checks = $scope.ui.validation.checks;

    _.each(checks, (item) => {
      item.valid = true;
    });

    if (_.isEmpty(jobId)) {
      checks.jobId.valid = false;
    } else if (isJobIdValid(jobId) === false) {
      checks.jobId.valid = false;
      let msg = 'Job name can contain lowercase alphanumeric (a-z and 0-9), hyphens or underscores; ';
      msg += 'must start and end with an alphanumeric character';
      checks.jobId.message = msg;
    }

    _.each(checks, (item) => {
      if (item.valid === false) {
        valid = false;
      }
    });

    return valid;
  }

});
