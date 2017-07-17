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
.when('/jobs/new_job/simple/multi_metric/create', {
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
.controller('MlCreateMultiMetricJob', function (
  $scope,
  $route,
  $location,
  $filter,
  $window,
  courier,
  timefilter,
  Private,
  mlJobService,
  mlMultiMetricJobService,
  mlMessageBarService,
  mlESMappingService) {

  timefilter.enabled = true;
  const msgs = mlMessageBarService;
  const MlTimeBuckets = Private(IntervalHelperProvider);

  const aggTypes = Private(AggTypesIndexProvider);
  $scope.courier = courier;

  mlMultiMetricJobService.clearChartData();
  $scope.chartData = mlMultiMetricJobService.chartData;

  const PAGE_WIDTH = angular.element('.multi-metric-job-container').width();
  const BAR_TARGET = (PAGE_WIDTH > 1600) ? 800 : (PAGE_WIDTH / 2);
  const MAX_BARS = BAR_TARGET + (BAR_TARGET / 100) * 100; // 100% larger that bar target
  const REFRESH_INTERVAL_MS = 100;
  const MAX_BUCKET_DIFF = 3;
  const METRIC_AGG_TYPE = 'metrics';
  const EVENT_RATE_COUNT_FIELD = '__ml_event_rate_count__';

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
  $scope.chartStates = {
    eventRate: CHART_STATE.LOADING,
    fields: {}
  };

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
    showJobInput: true,
    showJobFinished: false,
    dirty: false,
    formValid: false,
    bucketSpanValid: true,
    bucketSpanEstimator: { status: 0, message: '' },
    aggTypeOptions: filterAggTypes(aggTypes.byType[METRIC_AGG_TYPE]),
    fields: [],
    splitFields: [],
    timeFields: [],
    splitText: '',
    wizard: {
      step: 0,
      forward: function () {
        wizardStep(1);
      },
      back: function () {
        wizardStep(-1);
      },
    },
    intervals: [{
      title: 'Auto',
      value: 'auto',
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
    eventRateChartHeight: 100,
    chartHeight: 150,
    showFieldCharts: false,
    showAdvanced: false,
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
    fields: {},
    bucketSpan: '5m',
    chartInterval: undefined,
    resultsIntervalSeconds: undefined,
    start: 0,
    end: 0,
    timeField: indexPattern.timeFieldName,
    splitField: '--No split--',
    keyFields: {},
    firstSplitFieldValue: undefined,
    indexPattern: indexPattern,
    query,
    filters,
    jobId: undefined,
    description: undefined,
    mappingTypes: [],
    useDedicatedIndex: false
  };

  $scope.formChange = function () {
    $scope.ui.isFormValid();
    $scope.ui.dirty = true;

    $scope.loadVis();
  };

  $scope.bucketSpanFieldChange = function () {
    $scope.ui.bucketSpanEstimator.status = 0;
    $scope.ui.bucketSpanEstimator.message = '';
    $scope.formChange();
  };

  $scope.splitChange = function () {
    const splitField = $scope.formConfig.splitField;
    $scope.formConfig.firstSplitFieldValue = undefined;

    if (splitField !== '--No split--') {
      $scope.formConfig.keyFields[splitField] = splitField;

      $scope.ui.splitText = 'Data split by ' + splitField;

      mlMultiMetricJobService.getSplitFields($scope.formConfig, 10)
      .then((resp) => {
        if (resp.results.values && resp.results.values.length) {
          $scope.formConfig.firstSplitFieldValue = resp.results.values[0];
        }

        setFieldsChartStates(CHART_STATE.LOADING);
        drawCards(resp.results.values);
        $scope.formChange();
      });
    } else {
      setFieldsChartStates(CHART_STATE.LOADING);
      $scope.ui.splitText = '';
      destroyCards();
      $scope.formChange();
    }
  };

  function wizardStep(step) {
    $scope.ui.wizard.step += step;
  }

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

  function initAgg() {
    _.each($scope.ui.aggTypeOptions, (agg) => {
      if (agg.title === 'Mean') {
        $scope.formConfig.agg.type = agg;
      }
    });
  }

  function loadFields() {
    const type = $scope.formConfig.agg.type;
    let fields = [];
    let categoryFields = [];
    $scope.ui.fields = [];
    type.params.forEach((param) => {
      if (param.name === 'field') {
        fields = getIndexedFields(param, 'number');
      }
      if (param.name === 'customLabel') {
        categoryFields = getIndexedFields(param, ['string', 'ip']);
      }
    });

    $scope.ui.fields.push({
      id: EVENT_RATE_COUNT_FIELD,
      name: 'event rate',
      tooltip: 'System defined field',
      isCountField: true,
      agg: { type: _.findWhere($scope.ui.aggTypeOptions, { title: 'Count' }) }
    });

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

    _.each(categoryFields, (field) => {
      if (field.displayName !== 'type') {
        $scope.ui.splitFields.push(field.displayName);
      }
    });

    if ($scope.ui.fields.length === 1) {
      $scope.formConfig.field = $scope.ui.fields[0];
    }
  }

  $scope.toggleFields = function (field) {
    const key = field.id;

    const f = $scope.formConfig.fields[key];
    if (f === undefined) {
      $scope.formConfig.fields[key] = field;
      $scope.chartStates.fields[key] = CHART_STATE.LOADING;
    } else {
      delete $scope.formConfig.fields[key];
      delete $scope.chartStates.fields[key];
    }
  };

  $scope.toggleKeyFields = function (key) {
    const f = $scope.formConfig.keyFields[key];
    if (f === undefined) {
      $scope.formConfig.keyFields[key] = key;
    } else {
      delete $scope.formConfig.keyFields[key];
    }
  };

  function getIndexedFields(param, fieldTypes) {
    let fields = _.filter(indexPattern.fields.raw, 'aggregatable');

    if (fieldTypes) {
      fields = $filter('fieldType')(fields, fieldTypes);
      fields = $filter('orderBy')(fields, ['type', 'name']);
      fields = _.filter(fields, (f) => f.displayName !== '_type');
    }
    return fields;
  }

  $scope.ui.isFormValid = function () {
    if ($scope.formConfig.agg.type === undefined ||
        $scope.formConfig.timeField === undefined ||
        Object.keys($scope.formConfig.fields).length === 0) {

      $scope.ui.formValid = false;
    } else {
      $scope.ui.formValid = true;
    }
    return $scope.ui.formValid;
  };

  $scope.loadVis = function () {
    const thisLoadTimestamp = Date.now();
    $scope.chartData.lastLoadTimestamp = thisLoadTimestamp;

    setTime();
    $scope.ui.isFormValid();

    $scope.ui.showJobInput = true;
    $scope.ui.showJobFinished = false;

    $scope.ui.dirty = false;

    showSparseDataCheckbox();

    mlMultiMetricJobService.clearChartData();

    // $scope.chartStates.eventRate = CHART_STATE.LOADING;
    setFieldsChartStates(CHART_STATE.LOADING);

    if (Object.keys($scope.formConfig.fields).length) {
      $scope.ui.showFieldCharts = true;
      mlMultiMetricJobService.getLineChartResults($scope.formConfig, thisLoadTimestamp)
      .then((resp) => {
        loadDocCountData(resp.detectors);
      })
      .catch((resp) => {
        msgs.error(resp.message);
        _.each($scope.formConfig.fields, (field, id) => {
          $scope.chartStates.fields[id] = CHART_STATE.NO_RESULTS;
        });
      });
    } else {
      $scope.ui.showFieldCharts = false;
      loadDocCountData([]);
    }

    function loadDocCountData(dtrs) {
      const gridWidth = angular.element('.charts-container').width();
      mlMultiMetricJobService.loadDocCountData($scope.formConfig, gridWidth)
      .then((resp) => {
        if (thisLoadTimestamp === $scope.chartData.lastLoadTimestamp) {
          _.each(dtrs, (dtr, id) => {
            const state = (dtr.line.length) ? CHART_STATE.LOADED : CHART_STATE.NO_RESULTS;
            $scope.chartStates.fields[id] = state;
          });

          $scope.chartData.lastLoadTimestamp = null;
          $scope.$broadcast('render');
          $scope.chartStates.eventRate = (resp.job.bars.length) ? CHART_STATE.LOADED : CHART_STATE.NO_RESULTS;
        }
      })
      .catch((resp) => {
        $scope.chartStates.eventRate = CHART_STATE.NO_RESULTS;
        msgs.error(resp.message);
      });
    }
  };

  function setFieldsChartStates(state) {
    _.each($scope.chartStates.fields, (chart, key) => {
      $scope.chartStates.fields[key] = state;
    });
  }

  function showSparseDataCheckbox() {
    $scope.ui.isCountOrSum = false;
    _.each($scope.formConfig.fields, (fd) => {
      if (fd.agg.type.name === 'count' || fd.agg.type.name === 'sum') {
        $scope.ui.isCountOrSum = true;
      }
    });
  }

  function drawCards(labels) {
    const $frontCard = angular.element('.multi-metric-job-container .detector-container .card-front');
    $frontCard.addClass('card');
    $frontCard.find('.card-title').text(labels[0]);
    const w = $frontCard.width();

    let marginTop = (labels.length > 1) ? 54 : 0;
    $frontCard.css('margin-top', marginTop);

    let backCardTitle = '';
    if (labels.length === 2) {
      // create a dummy label if there are only 2 cards, as the space will be visible
      backCardTitle = $scope.formConfig.fields[Object.keys($scope.formConfig.fields)[0]].agg.type.title;
      backCardTitle += ' ';
      backCardTitle += Object.keys($scope.formConfig.fields)[0];
    }

    angular.element('.card-behind').remove();

    for (let i = 0; i < labels.length; i++) {
      let el = '<div class="card card-behind"><div class="card-title">';
      el += labels[i];
      el += '</div><label>';
      el += backCardTitle;
      el += '</label></div>';

      const $backCard = angular.element(el);
      $backCard.css('width', w);
      $backCard.css('height', 100);
      $backCard.css('display', 'auto');
      $backCard.css('z-index', (9 - i));

      $backCard.insertBefore($frontCard);
    }

    const cardsBehind = angular.element('.card-behind');
    let marginLeft = 0;
    let backWidth = w;

    for (let i = 0; i < cardsBehind.length; i++) {
      cardsBehind[i].style.marginTop = marginTop + 'px';
      cardsBehind[i].style.marginLeft = marginLeft + 'px';
      cardsBehind[i].style.width = backWidth + 'px';

      marginTop -= (10 - (i * (10 / labels.length))) * (10 / labels.length);
      marginLeft += (5 - (i / 2));
      backWidth -= (5 - (i / 2)) * 2;
    }
    let i = 0;
    function fadeCard() {
      if (i < cardsBehind.length) {
        cardsBehind[i].style.opacity = 1;
        window.setTimeout(fadeCard , 60);
        i++;
      }
    }
    fadeCard();
  }

  function destroyCards() {
    angular.element('.card-behind').remove();

    const $frontCard = angular.element('.multi-metric-job-container .detector-container .card-front');
    $frontCard.removeClass('card');
    $frontCard.find('.card-title').text('');
    $frontCard.css('margin-top', 0);
  }

  // force job ids to be lowercase
  $scope.changeJobIDCase = function () {
    if ($scope.formConfig.jobId) {
      $scope.formConfig.jobId = $scope.formConfig.jobId.toLowerCase();
    }
  };

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
      mlMultiMetricJobService.createJob($scope.formConfig)
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
          mlMultiMetricJobService.startDatafeed($scope.formConfig)
          .then(() => {
            $scope.jobState = JOB_STATE.RUNNING;
            refreshCounter = 0;
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
    // the percentage doesn't always reach 100, so periodically check the datafeed status
    // to see if the datafeed has stopped
    const counterLimit = 20 - (refreshInterval / REFRESH_INTERVAL_MS);
    if (refreshCounter >=  counterLimit) {
      refreshCounter = 0;
      mlMultiMetricJobService.checkDatafeedStatus($scope.formConfig)
      .then((status) => {
        if (status === 'stopped') {
          console.log('Stopping poll because datafeed status is: ' + status);
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
      reloadJobSwimlaneData()
      .then(() => {
        reloadDetectorSwimlane()
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
          jobCheck();
        });
      });
    }
  }

  function jobCheck() {
    if ($scope.jobState === JOB_STATE.RUNNING || $scope.jobState === JOB_STATE.STOPPING) {
      refreshInterval = adjustRefreshInterval($scope.chartData.loadingDifference, refreshInterval);
      _.delay(loadCharts, refreshInterval);
    } else {
      _.each($scope.chartData.detectors, (chart) => {
        chart.percentComplete = 100;
      });
    }
    if ($scope.chartData.percentComplete > 0) {
      // fade the bar chart once we have results
      toggleSwimlaneVisibility();
    }
    $scope.$broadcast('render-results');
  }

  function reloadJobSwimlaneData() {
    return mlMultiMetricJobService.loadJobSwimlaneData($scope.formConfig);
  }


  function reloadDetectorSwimlane() {
    return mlMultiMetricJobService.loadDetectorSwimlaneData($scope.formConfig);
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
    mlMultiMetricJobService.indexTimeRange(indexPattern, query)
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
    toggleSwimlaneVisibility();

    window.setTimeout(() => {
      $scope.ui.showJobInput = true;
      $scope.loadVis();
    }, 500);
  };

  function toggleSwimlaneVisibility() {
    if ($scope.jobState === JOB_STATE.NOT_STARTED) {
      angular.element('.swimlane-cells').css('opacity', 0);
      angular.element('.bar').css('opacity', 1);
    } else {
      angular.element('.bar').css('opacity', 0.1);
    }
  }

  $scope.stopJob = function () {
    // setting the status to STOPPING disables the stop button
    $scope.jobState = JOB_STATE.STOPPING;
    mlMultiMetricJobService.stopDatafeed($scope.formConfig);
  };

  function createResultsUrl() {
    const from = moment($scope.formConfig.start).toISOString();
    const to = moment($scope.formConfig.end).toISOString();
    let path = '';
    path += 'ml#/explorer';
    path += `?_g=(ml:(jobIds:!('${$scope.formConfig.jobId}'))`;
    path += `,refreshInterval:(display:Off,pause:!f,value:0),time:(from:'${from}'`;
    path += `,mode:absolute,to:'${to}'`;
    path += '))&_a=(filters:!(),query:(query_string:(analyze_wildcard:!t,query:\'*\')))';

    $scope.resultsUrl = path;
  }

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

  // resize the spilt cards on page resize.
  // when the job starts the 'Analysis running' label appearing can cause a scroll bar to appear
  // which will cause the split cards to look odd
  // TODO - all charts should resize correctly on page resize
  function resize() {
    if ($scope.formConfig.splitField !== '--No split--') {
      let width = angular.element('.card-front').width();
      const cardsBehind = angular.element('.card-behind');
      for (let i = 0; i < cardsBehind.length; i++) {
        cardsBehind[i].style.width = width + 'px';
        width -= (5 - (i / 2)) * 2;
      }
    }
  }

  mlESMappingService.getMappings().then(() => {
    initAgg();
    loadFields();

    $scope.loadVis();
  });

  $scope.$listen(timefilter, 'fetch', $scope.loadVis);

  angular.element(window).resize(() => {
    resize();
  });

  $scope.$on('$destroy', () => {
    globalForceStop = true;
    angular.element(window).off('resize');
  });

}).filter('filterAggTypes', function () {
  return (aggTypes, field) => {
    const output = [];
    _.each(aggTypes, (i) => {
      if (field.id === '__ml_event_rate_count__') {
        if(i.isCountType) {
          output.push(i);
        }
      } else {
        if(!i.isCountType) {
          output.push(i);
        }
      }
    });
    return output;
  };
});
