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


import moment from 'moment';
import $ from 'jquery';
import _ from 'lodash';
import { IntervalHelperProvider } from 'plugins/ml/util/ml_time_buckets';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlSwimlaneInspector', function (
  $location,
  $window,
  mlSwimlaneInspectorService,
  mlSwimlaneSelectionService,
  mlSwimlaneService) {
  return {
    restrict: 'AE',
    replace: false,
    scope: {},
    template: require('plugins/ml/summaryview/swimlane_inspector/swimlane_inspector.html'),
    link: function ($scope) {
      $scope.controls = mlSwimlaneInspectorService.controls;
      $scope.controls.scope = $scope;

      $scope.chartData = mlSwimlaneInspectorService.chartData;

      $scope.lanes = {};
      $scope.laneMarkers = [];

      $scope.applyZoom = function () {
        mlSwimlaneInspectorService.hide();
        mlSwimlaneInspectorService.applyZoom();
      };

      $scope.openExplorer = function () {
        mlSwimlaneService.openExplorer(mlSwimlaneInspectorService.getTimeRange());
      };

      $scope.close = function () {
        mlSwimlaneInspectorService.hide();
        mlSwimlaneSelectionService.hide();
      };

    },
  };
})
.service('mlSwimlaneInspectorService', function ($q, $timeout, $rootScope, $compile, es, Private,
  timefilter, mlJobService, mlResultsService, mlAnomalyRecordDetailsService, mlSwimlaneSearchService) {
  const TimeBuckets = Private(IntervalHelperProvider);

  const swimlanesHTML = require('plugins/ml/summaryview/swimlane_inspector/swimlanes.html');

  const ML_RESULTS_INDEX_ID = '.ml-anomalies-*';

  const controls = {
    visible: false,
    top: 0,
    left: 0,
    width: 900,
    arrowLeft: '50%',
    inspectorChartData: {},
    topInfluencerList: {},
    showTopInfluencerList: false,
    scope: null,
    labels: {
      laneLabel: '',
      start: '',
      end: ''
    },
  };
  this.controls = controls;
  let laneLabel = '';
  let swimlaneType = '';
  let timeRange = {};
  let $swimlanes;
  let selectedJobIds;
  let times = [];

  this.getSwimlaneType = function () {
    return swimlaneType;
  };
  this.getTimeRange = function () {
    return timeRange;
  };
  this.getSelectedJobIds = function () {
    return selectedJobIds;
  };

  this.show = function (timeRangeIn, laneLabelIn, $laneIn, $target, swimlaneTypeIn, selectedJobIdsIn) {
    $swimlanes = $('#swimlane-inspector .swimlanes');
    $swimlanes.empty();

    laneLabel = laneLabelIn;
    swimlaneType = swimlaneTypeIn;
    timeRange = timeRangeIn;
    selectedJobIds = selectedJobIdsIn;

    controls.labels.laneLabel = mlJobService.jobDescriptions[laneLabel];
    controls.labels.start = moment.unix(timeRange.start).format('MMM DD HH:mm');
    controls.labels.end = moment.unix(timeRange.end).format('MMM DD HH:mm');

    controls.visible = true;
    position($target);
    loadSwimlane();
    loadTopInfluencersForRange();
  };

  this.hide = function () {
    // if clicking on a card outside of the inspector, unlock any locked cards in the inspector
    // before the inspector closes
    if (controls.visible && mlAnomalyRecordDetailsService.isLocked()) {
      mlAnomalyRecordDetailsService.toggleLock(false);
    }
    controls.visible = false;
  };

  this.applyZoom = function () {
    timefilter.time.from = moment(timeRange.start * 1000).toISOString();
    timefilter.time.to = moment(timeRange.end * 1000).toISOString();
  };

  function position($target) {
    const pos = $target.position();
    const width = $target.width();
    const bubbleMarginWidth = $('.ml-anomaly-details-margin').width();
    const appWidth = $('.application').width();

    const selection = {
      top: pos.top,
      left: pos.left,
      width: width,
      center: pos.left + (width / 2)
    };
    controls.top = selection.top + 20;
    controls.left = selection.center - (controls.width / 2);

    const leftBorder = 8;
    const rightBorder = bubbleMarginWidth + 8;
    if (controls.left < leftBorder) {

      controls.left = leftBorder;
      controls.arrowLeft = selection.center - leftBorder + 'px';

    } else if ((controls.left + controls.width) > (appWidth - rightBorder)) {

      controls.left = appWidth - controls.width - rightBorder;
      const diff = (appWidth - rightBorder) - (controls.left + controls.width);
      controls.arrowLeft = selection.center - controls.left  + diff + 'px';

    } else {
      controls.arrowLeft = '50%';
    }
  }

  function loadSwimlane() {
    const type = mlAnomalyRecordDetailsService.type[swimlaneType];
    const types = mlAnomalyRecordDetailsService.type;
    let interval = calculateBucketInterval();
    let recordJobIds;

    function fin() {
      mlAnomalyRecordDetailsService.setTimes(times);
      mlAnomalyRecordDetailsService.createInspectorRecords(swimlaneType, recordJobIds, timeRange, times);
    }

    if (type === types.MONITOR) {
      // MONITOR
      recordJobIds = selectedJobIds;
      loadResults(mlResultsService.getScoresByBucket, recordJobIds, interval, (results) => {
        processJobResults(results, laneLabel);
        processMonitorResults(controls.inspectorChartData);
        fin();
      });
    } else if (type === types.JOB) {
      // JOB
      const job = mlJobService.basicJobs[laneLabel];
      interval = calculateBucketInterval(job.bucketSpanSeconds);

      recordJobIds = [laneLabel];
      loadResults(mlResultsService.getScoresByBucket, recordJobIds, interval, (results) => {
        processJobResults(results, laneLabel);
        fin();
      });
    } else if (type === types.DETECTOR) {
      // DETECTOR
      recordJobIds = selectedJobIds;
      const job = mlJobService.basicJobs[recordJobIds[0]];
      interval = calculateBucketInterval(job.bucketSpanSeconds);

      loadResults(mlSwimlaneSearchService.getScoresByDetector, recordJobIds, interval, (results) => {
        processDetectorResults(results, laneLabel);
        fin();
      });
    } else if (type === types.INF_TYPE) {
      // INFLUENCER TYPE
      recordJobIds = selectedJobIds;
      loadResults(mlSwimlaneSearchService.getScoresByInfluencerType, recordJobIds, interval, (results) => {
        processInfluencerResults(results.influencerTypes, laneLabel);
        fin();
      });
    } else if (type === types.INF_VALUE) {
      // INFLUENCER TYPE
      recordJobIds = selectedJobIds;
      loadResults(mlSwimlaneSearchService.getScoresByInfluencerValue, recordJobIds, interval, (results) => {
        processInfluencerResults(results.influencerValues, laneLabel);
        fin();
      });
    }

  }

  function loadResults(func, jobIds, interval, callback) {

    func(ML_RESULTS_INDEX_ID, jobIds,
      (timeRange.start * 1000), (timeRange.end * 1000), interval.expression, 10)
    .then((resp) => {
      console.log('Swimlane inspector data:', resp);

      callback(resp.results);
      displaySwimlane();

    }).catch((resp) => {
      console.log('Swimlane inspector  - error getting scores by influencer data from elasticsearch:', resp);
    });
  }

  function displaySwimlane() {
    $timeout(() => {
      controls.scope.lanes = {};
      controls.scope.laneMarkers = [];
      $compile($swimlanes.html(swimlanesHTML))(controls.scope);
      controls.scope.$broadcast('render');
    }, 0);
  }

  function processMonitorResults(jobChartData) {
    const dataset = {
      laneLabels:['Monitor'],
      points:[],
      earliest: Number.MAX_VALUE,
      latest:  0,
      interval: jobChartData.interval
    };

    const points = jobChartData.points;
    const maxScoresPerBucket = {};

    _.each(points, (point) => {
      if (maxScoresPerBucket[point.time] === undefined) {
        maxScoresPerBucket[point.time] = 0;
      }
      if (point.value > maxScoresPerBucket[point.time]) {
        maxScoresPerBucket[point.time] = point.value;
      }

      dataset.earliest = Math.min(point.time, dataset.earliest);
      dataset.latest = Math.max((point.time + dataset.interval), dataset.latest);

    });

    _.each(maxScoresPerBucket, (bucket, time) => {
      dataset.points.push({
        laneLabel: 'Monitor',
        time: +time,
        value: bucket
      });
    });

    calculateDatasetTimeRange(dataset);

    console.log('SummaryView monitor swimlane dataset:', dataset);
    controls.inspectorChartData = dataset;
  }

  function processJobResults(dataByJob) {
    const dataset = { 'laneLabels':[], 'points':[], 'interval': timeRange.interval };
    const timeObjs = {};

    dataset.earliest = Number.MAX_VALUE;
    dataset.latest = 0;

    // Use job ids as lane labels.
    _.each(dataByJob, (jobData, jobId) => {
      dataset.laneLabels.push(jobId);

      _.each(jobData, (normProb, timeMs) => {
        const time = timeMs / 1000;
        dataset.points.push({ 'laneLabel':jobId, 'time': time, 'value': normProb });

        dataset.earliest = Math.min(time, dataset.earliest);
        dataset.latest = Math.max((time + dataset.interval), dataset.latest);

        if (timeObjs[time] === undefined) {
          timeObjs[time] = {};
        }
      });
    });
    times = Object.keys(timeObjs);
    times = times.sort();

    calculateDatasetTimeRange(dataset);

    console.log('SummaryView jobs swimlane dataset:', dataset);
    controls.inspectorChartData = dataset;
  }


  function processDetectorResults(dataByJob, lLabel) {
    const dataset = { 'laneLabels':[], 'points':[], 'interval': timeRange.interval };
    const timeObjs = {};

    dataset.earliest = Number.MAX_VALUE;
    dataset.latest = 0;

    // Get the descriptions of the detectors to use as lane labels.
    _.each(dataByJob, (jobData, jobId) => {
      _.each(jobData, (detectorData, detectorIndex) => {
        const detectorDesc = mlJobService.detectorsByJob[jobId][detectorIndex].detector_description;
        // If a duplicate detector description has been used across jobs append job ID.
        const ll = _.indexOf(dataset.laneLabels, detectorDesc) === -1 ?
            detectorDesc : detectorDesc + ' (' + jobId + ')';
        if (ll === lLabel) {
          dataset.laneLabels.push(lLabel);

          _.each(detectorData, (normProb, timeMs) => {
            const time = timeMs / 1000;
            dataset.points.push({ 'laneLabel':lLabel, 'time': time, 'value': normProb });

            dataset.earliest = Math.min(time, dataset.earliest);
            dataset.latest = Math.max((time + dataset.interval), dataset.latest);

            if (timeObjs[time] === undefined) {
              timeObjs[time] = {};
            }
          });
        }
      });
    });

    times = Object.keys(timeObjs);
    times = times.sort();

    calculateDatasetTimeRange(dataset);

    console.log('SummaryView detector swimlane dataset:', dataset);
    controls.inspectorChartData = dataset;
  }

  function processInfluencerResults(dataByInfluencer) {
    const dataset = { 'laneLabels':[], 'points':[], 'interval': timeRange.interval };
    const timeObjs = {};

    dataset.earliest = Number.MAX_VALUE;
    dataset.latest = 0;

    _.each(dataByInfluencer, (influencerData, influencerFieldValue) => {
      if (influencerFieldValue === laneLabel) {
        dataset.laneLabels.push(influencerFieldValue);

        _.each(influencerData, (anomalyScore, timeMs) => {
          const time = timeMs / 1000;
          dataset.points.push({ 'laneLabel':influencerFieldValue, 'time': time, 'value': anomalyScore });

          dataset.earliest = Math.min(time, dataset.earliest);
          dataset.latest = Math.max((time + dataset.interval), dataset.latest);

          if (timeObjs[time] === undefined) {
            timeObjs[time] = {};
          }
        });
      }
    });


    times = Object.keys(timeObjs);
    times = times.sort();

    calculateDatasetTimeRange(dataset);

    console.log('SummaryView influencer swimlane dataset:', dataset);
    controls.inspectorChartData = dataset;
  }

  function calculateBucketInterval(bucketSpanSeconds) {
    // Bucketing interval should be the maximum of the chart related interval (i.e. time range related)
    // and the max bucket span for the jobs shown in the chart.
    // const bounds = timefilter.getActiveBounds();
    const bounds = {
      min: moment(timeRange.start * 1000),
      max: moment(timeRange.end * 1000)
    };

    const buckets = new TimeBuckets();
    buckets.setInterval('auto');
    buckets.setBounds(bounds);

    if (timeRange.interval > buckets.getInterval().asSeconds()) {
      timeRange.interval = buckets.getInterval().asSeconds();
    }
    if (bucketSpanSeconds > timeRange.interval) {
      buckets.setInterval(timeRange.interval + 's');
    }

    const interval = buckets.getInterval();
    timeRange.interval = interval.asSeconds();
    return interval;
  }

  function calculateDatasetTimeRange(dataset) {
    // Adjust the earliest back to the first bucket at or before the range start time,
    // and the latest forward to the end of the bucket at or after the range end time.
    // Due to the way the swimlane sections are plotted, the chart buckets
    // must coincide with the times of the buckets in the data.
    let earliest = dataset.earliest;
    let latest = dataset.latest;

    const boundsMin = timeRange.start;
    const boundsMax = timeRange.end;
    if (earliest > boundsMin) {
      earliest = earliest - (Math.ceil((earliest - boundsMin) / timeRange.interval) * timeRange.interval);
    }
    if (latest < boundsMax) {
      latest = latest + (Math.ceil((boundsMax - latest) / timeRange.interval) * timeRange.interval);
    }

    dataset.earliest = earliest;
    dataset.latest = latest;
  }

  function loadTopInfluencersForRange() {
    controls.topInfluencerList = {};
    controls.showTopInfluencerList = false;

    mlSwimlaneSearchService.getTopInfluencers(ML_RESULTS_INDEX_ID, laneLabel, selectedJobIds, swimlaneType,
        timeRange.start, timeRange.end, 0, mlAnomalyRecordDetailsService.type)
    .then((resp) => {

      const list = _.uniq(_.union(resp.results.topMax, resp.results.topSum), false, (item) => { return item.id; });
      controls.topInfluencerList = list;
      controls.showTopInfluencerList = Object.keys(list).length ? true : false;

    }).catch((resp) => {
      console.log('SummaryView visualization - error getting scores by influencer data from elasticsearch:', resp);
    });
  }

});
