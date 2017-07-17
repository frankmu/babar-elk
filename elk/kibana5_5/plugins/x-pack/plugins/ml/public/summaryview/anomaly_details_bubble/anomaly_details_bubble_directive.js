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
import _ from 'lodash';
import $ from 'jquery';
import d3 from 'd3';
import { getSeverity, getSeverityColor } from 'plugins/ml/util/anomaly_utils';
import 'plugins/ml/filters/abbreviate_whole_number';
import 'plugins/ml/filters/format_value';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlAnomalyDetailsBubble', function ($location, mlJobService, mlAnomalyRecordDetailsService, mlSwimlaneService) {
  return {
    restrict: 'AE',
    replace: false,
    // scope: {},
    template: require('plugins/ml/summaryview/anomaly_details_bubble/anomaly_details_bubble.html'),
    link: function ($scope) {
      $scope.title = 'Highest anomaly per detector';
      $scope.service = mlAnomalyRecordDetailsService;

      $scope.openExplorer = function () {
        mlSwimlaneService.openExplorer();
      };

      $scope.expandInfluencers = function () {
        $scope.service.expandInfluencers();
      };
    }
  };
})
.service('mlAnomalyRecordDetailsService', function ($q, $timeout, es, timefilter, mlJobService, mlSwimlaneSearchService) {

  const ML_RESULTS_INDEX_ID = '.ml-anomalies-*';
  // number of records loaded once when the page opens
  const RECORD_COUNT = 1000;

  let selectedJobIds = {};
  let bucketInterval = null;
  let bounds = timefilter.getActiveBounds();
  let times = [];
  const timesFormated = {};
  let allRecordResults;

  const highestRecords = {
    JOB:        {},
    MONITOR:    {},
    DETECTOR:   {},
    INF_VALUE:  {},
    INSPECTOR:  {}
  };

  const that = this;
  this.type = {
    MONITOR:   0,
    JOB:       1,
    DETECTOR:  2,
    INF_TYPE:  3,
    INF_VALUE: 4,
    INSPECTOR: 5,
    EVENTRATE: 6
  };

  this.visible = false;
  this.recordsPerDetector = null;
  this.targetTop = 0;
  this.$target;
  this.arrowTop = 0;
  this.bubbleHeight = 0;
  this.recordListHeight = 0;
  this.bubbleTop = 0;
  this.navBarHeight = 0;
  this.laneLabel = '';
  this.$bubble;
  this.$bubbleHeading;
  this.$arrow;
  this.cardColor = '#FFFFFF';
  this.bucketTime = 0;
  this.bucketTimeFormated = '';
  this.showTopInfluencers = true;
  this.influencersExpanded = true;
  this.$lockedCell = null;
  this.topInfluencerTab = 0;
  this.recordLimit = 3;
  this.initialised = false;
  this.changeTab = function (i) {
    this.topInfluencerTab = i;
    if (i === 1) {
      drawBubbleChart();
    }
  };
  this.topInfluencerList = [];
  this.topInfluencerForPage = [];

  this.topInfluencers = {
    MONITOR:   {},
    JOB:       {},
    DETECTOR:  {},
    INF_TYPE:  {},
    INF_VALUE: {}
  };

  this.inspectorTopInfluencers = {
    MONITOR:   {},
    JOB:       {},
    DETECTOR:  {},
    INF_TYPE:  {},
    INF_VALUE: {}
  };

  this.setSelectedJobIds = function (jobs) {
    selectedJobIds = jobs;
  };
  this.setBucketInterval = function (b) {
    bucketInterval = b;
  };
  this.getBucketInterval = function () {
    return bucketInterval;
  };
  this.setTimes = function (timesIn) {
    _.each(timesIn, (t) => {
      const time = +t;
      if (times[time] === undefined) {
        times.push(+t);
        timesFormated[time] = moment((time) * 1000).format('MMMM Do YYYY, HH:mm:ss');
      }
    });
  };

  this.clearTimes = function () {
    times = [];
  };
  this.getTimes = function () {
    return times;
  };
  this.setBounds = function (b) {
    bounds = b;
  };

  this.load = function () {
    refresh();
  };

  this.hide = function () {
    this.visible = false;
  };

  function clearHighestRecords() {
    highestRecords.MONITOR = {};
    highestRecords.JOB = {};
    highestRecords.DETECTOR = {};
    highestRecords.INF_TYPE = {};
    highestRecords.INF_VALUE = {};
  }

  this.clearTopInfluencers = function () {
    this.topInfluencers.MONITOR = {};
    this.topInfluencers.JOB = {};
    this.topInfluencers.DETECTOR = {};
    this.topInfluencers.INF_TYPE = {};
    this.topInfluencers.INF_VALUE = {};
  };

  this.clearInspectorTopInfluencers = function () {
    this.inspectorTopInfluencers.MONITOR = {};
    this.inspectorTopInfluencers.JOB = {};
    this.inspectorTopInfluencers.DETECTOR = {};
    this.inspectorTopInfluencers.INF_TYPE = {};
    this.inspectorTopInfluencers.INF_VALUE = {};
  };

  this.toggleLock = function ($target) {
    if (this.$lockedCell === null && $target !== undefined) {
      $target.html($('<i>', {
        'class': 'fa fa-thumb-tack pin',
      }));
      this.$lockedCell = $target;
    } else {
      if (this.$lockedCell) {
        this.$lockedCell.empty();
      }

      this.$lockedCell = null;
    }
  };
  this.isLocked = function () {
    return this.$lockedCell !== null;
  };

  function refresh() {
    clearHighestRecords();
    that.clearTopInfluencers();

    // load records for the page
    mlSwimlaneSearchService.getRecords(ML_RESULTS_INDEX_ID, selectedJobIds,
        bounds.min.valueOf(), bounds.max.valueOf(), RECORD_COUNT)
    .then((resp) => {
      console.log('anomaly bubble refresh data:', resp);

      allRecordResults = resp.records;
      const bucketedResults = bucketResults(allRecordResults, times, bucketInterval.asSeconds());
      processRecordResults(bucketedResults, highestRecords);

      // init position
      that.visible = true;

      if (that.$bubble === undefined) {
        that.$bubble = $('.anomaly-details-bubble');
        that.$bubbleHeading = that.$bubble.find('.heading');
        that.$arrow = that.$bubble.find('.arrow');
        that.$recordList = that.$bubble.find('.record-list');
        that.navBarHeight = $('kbn-top-nav').height();
      }
      that.position(true);

    }).catch((resp) => {
      console.log('SummaryView visualization - error getting scores by influencer data from elasticsearch:', resp);
    });
  }

  // load top influencers for the page
  this.loadTopInfluencersForPage = function () {
    loadTopInfluencersForPage(selectedJobIds, (bounds.min.valueOf() / 1000), (bounds.max.valueOf() / 1000));
  };

  function bucketResults(data, rTimes, interval) {
    const recordsPerTimeInterval = {};

    _.each(data, (record) => {
      if (record.time === undefined) {
        record.time = moment(record.timestamp).unix();
      }
    });

    data = _.sortBy(data, 'time');

    _.each(data, (record) => {
      if (record.detectorText === undefined) {
        record.detector = mlJobService.detectorsByJob[record.job_id][record.detector_index];
        record.detectorText = record.detector.detector_description;
      }

      for (let i = 0; i < rTimes.length; i++) {
        const t = +rTimes[i];
        let found = false;

        if (recordsPerTimeInterval[t] === undefined) {
          recordsPerTimeInterval[t] = [];
        }

        if (record.time >= t && record.time < (t + interval)) {
          recordsPerTimeInterval[t].push(record);
          found = true;
        }

        if (found) {
          break;
        }
      }
    });
    return recordsPerTimeInterval;
  }

  function processRecordResults(recordsPerTimeInterval, highestRecordsIn) {

    const tempHighestRecordPerBucket = {};
    const tempHighestRecordPerInfluencer = {};
    const tempHighestRecordPerInfluencerType = {};
    const tempMonitorHighestRecordPerBucket = {};
    const tempDetectorHighestRecordPerBucket = {};

    _.each(recordsPerTimeInterval, (bucket, t) => {
      bucket = _.sortBy(bucket, 'record_score').reverse();

      tempHighestRecordPerBucket[t] = {};
      tempMonitorHighestRecordPerBucket[t] = { 'All jobs': [] };

      const highestJobCounts = {};
      const highestMonitorCounts = {};
      const highestDetectorCounts = {};
      const highestInfluencerCounts = {};
      const highestInfluencerTypeCounts = {};

      _.each(bucket, (record) => {
        buildDescription(record);

        // If only a single cause, copy values to the top level for display.
        if (_.get(record, 'causes', []).length === 1) {
          const cause = _.first(record.causes);
          record.actual = cause.actual;
          record.typical = cause.typical;
        }

        const jobId = record.job_id;
        if (highestJobCounts[jobId] === undefined) {
          highestJobCounts[jobId] = {};
        }

        if (highestJobCounts[jobId][record.detectorText] === undefined) {
          highestJobCounts[jobId][record.detectorText] = [];
        }
        if (highestMonitorCounts[record.detectorText] === undefined) {
          highestMonitorCounts[record.detectorText] = [];
        }
        if (highestDetectorCounts[record.detectorText] === undefined) {
          highestDetectorCounts[record.detectorText] = {};
          highestDetectorCounts[record.detectorText][record.detectorText] = [];
        }

        highestJobCounts[jobId][record.detectorText].push(record);
        highestMonitorCounts[record.detectorText].push(record);
        highestDetectorCounts[record.detectorText][record.detectorText].push(record);

        tempHighestRecordPerBucket[t][jobId] = highestJobCounts[jobId];

        _.each(record.influencers, (inf) => {
          if (highestInfluencerTypeCounts[inf.influencer_field_name] === undefined) {
            highestInfluencerTypeCounts[inf.influencer_field_name] = {};
          }
          if (highestInfluencerTypeCounts[inf.influencer_field_name][record.detectorText] === undefined) {
            highestInfluencerTypeCounts[inf.influencer_field_name][record.detectorText] = [];
          }
          highestInfluencerTypeCounts[inf.influencer_field_name][record.detectorText].push(record);

          _.each(inf.influencer_field_values, (infVal) => {
            if (highestInfluencerCounts[infVal] === undefined) {
              highestInfluencerCounts[infVal] = {};
            }
            if (highestInfluencerCounts[infVal][record.detectorText] === undefined) {
              highestInfluencerCounts[infVal][record.detectorText] = [];
            }
            if (_.indexOf(highestInfluencerCounts[infVal][record.detectorText], record) === -1) {
              highestInfluencerCounts[infVal][record.detectorText].push(record);
            }
          });
        });
      });

      tempHighestRecordPerInfluencer[t] = highestInfluencerCounts;
      tempHighestRecordPerInfluencerType[t] = highestInfluencerTypeCounts;
      tempMonitorHighestRecordPerBucket[t]['All jobs'] = highestMonitorCounts;
      tempDetectorHighestRecordPerBucket[t] = highestDetectorCounts;
    });


    highestRecordsIn.JOB =  tempHighestRecordPerBucket;
    highestRecordsIn.MONITOR =  tempMonitorHighestRecordPerBucket;
    highestRecordsIn.DETECTOR =  tempDetectorHighestRecordPerBucket;
    highestRecordsIn.INF_VALUE =  tempHighestRecordPerInfluencer;
    highestRecordsIn.INF_TYPE =  tempHighestRecordPerInfluencerType;

    // console.log(highestRecordsIn);
  }

  this.createInspectorRecords = function (swimlaneSubType, recordJobIds, swimlaneTimeRange, rTimes) {
    const newResults = [];
    _.each(allRecordResults, (res) => {
      if (res.time >= swimlaneTimeRange.start && res.time < (swimlaneTimeRange.end + swimlaneTimeRange.interval)) {
        // if JOB type, only use the one supplied job id. otherwise, search through all job ids
        if (that.type[swimlaneSubType] !== that.type.JOB ||
          (that.type[swimlaneSubType] === that.type.JOB && res.job_id === recordJobIds[0])) {
          newResults.push(res);
        }
      }
    });

    const bucketedResults = bucketResults(newResults, rTimes, swimlaneTimeRange.interval);
    const tempHighestRecords = {};
    processRecordResults(bucketedResults, tempHighestRecords);
    // the INSPECTOR type can contain data for any other type
    highestRecords.INSPECTOR = tempHighestRecords[swimlaneSubType];
  };

  function buildDescription(record) {
    const description = getSeverity(record.record_score) + ' anomaly in ';//+ record.detectorText;
    let descriptionExtra = '';

    if (_.has(record, 'partition_field_name') && (record.partition_field_name !== record.entity_name)) {
      descriptionExtra += ' detected in ' + record.partition_field_name;
      descriptionExtra += ' ';
      descriptionExtra += record.partition_field_value;
    }
    if (_.has(record, 'by_field_value')) {
      descriptionExtra += ' for ' + record.by_field_name;
      descriptionExtra += ' ';
      descriptionExtra += record.by_field_value;
    } else if (_.has(record, 'over_field_value')) {
      descriptionExtra += ' for ' + record.over_field_name;
      descriptionExtra += ' ';
      descriptionExtra += record.over_field_value;
    }

    if (_.has(record, 'entity_name')) {
      descriptionExtra += ' found for ' + record.entity_name;
      descriptionExtra += ' ';
      descriptionExtra += record.entity_value;
    }



    record.description = description;
    record.descriptionExtra = descriptionExtra;
    record.score = (record.record_score < 1) ? '<1' : Math.floor(record.record_score);
    // record.severityLabel = getSeverity(record.record_score);
    record.cardColor = getSeverityColor(record.record_score);
    // $scope.description = description;

    // Check for a correlated_by_field_value in the source which will be present for multivariate analyses
    // where the record is anomalous due to relationship with another 'by' field value.
    if (_.has(record, 'correlated_by_field_value')) {
      let mvDescription = 'multivariate correlations found in ';
      mvDescription += record.by_field_name;
      mvDescription += '; ';
      mvDescription += record.by_field_value;
      mvDescription += ' is considered anomalous given ';
      mvDescription += record.correlated_by_field_value;
      record.multiVariateDescription = mvDescription;
    }

  }

  this.position = function (scrolling) {
    const doc = document.documentElement;
    const scrollTop = (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0);
    this.arrowTop = this.targetTop + this.navBarHeight + 10 - scrollTop;

    if (this.$target !== undefined) {
      if (this.$target.parent().hasClass('cells-container-inspector')) {
        this.arrowTop += $('#swimlane-inspector').position().top;
      }
    } else {
      // nothing has been hovered over, default to the monitor swimlane
      this.arrowTop = 259;
    }

    if (this.arrowTop < 5) {
      this.arrowTop = -10000;
    }

    const navBarHeight = this.navBarHeight + 40;

    if (scrollTop > navBarHeight) {
      this.bubbleTop = scrollTop - navBarHeight;
      this.bubbleHeight = doc.offsetHeight - 10;

    } else {
      this.bubbleTop = 0;
      this.bubbleHeight = doc.offsetHeight - navBarHeight - 10 + scrollTop;
    }

    if (scrolling && this.$bubble !== undefined) {
      this.$bubble.css({
        'top': this.bubbleTop,
        'height': this.bubbleHeight
      });
      this.$arrow.css({
        'top': this.arrowTop,
      });
      let height = 473;
      if (!this.influencersExpanded) {
        height = 73;
      }
      if (!this.showTopInfluencers) {
        height = 45;
      }
      this.$recordList.css({
        'height': this.bubbleHeight - this.$bubbleHeading.height() - height,
      });
    }
  };

  window.onscroll = function () {
    that.position(true);
  };
  // window.onscroll = _.debounce(function() {
  //   that.position(true);
  // }, 100);

  this.hover = function (time, laneLabel, bucketScore, top, target, swimlaneType, inspector) {
    this.initialised = true;

    if (this.$lockedCell === null) {
      const type = this.type[swimlaneType];
      this.recordLimit = 3;

      this.$target = $(target);

      if (bucketScore !== undefined) {
        this.targetTop = top;
        if (type === this.type.JOB) {
          this.laneLabel = mlJobService.jobDescriptions[laneLabel];
        } else {
          this.laneLabel = laneLabel;
        }
        this.bucketScore = (+bucketScore < 1) ? '<1' : Math.floor(bucketScore);
        this.cardColor = (target && target.lastChild) ? target.lastChild.style.backgroundColor : '#FFFFFF';
        this.bucketTime = time;
        this.bucketTimeFormated = timesFormated[time];

        if (highestRecords[swimlaneType] && highestRecords[swimlaneType][time]) {
          this.recordsPerDetector = highestRecords[swimlaneType][time][laneLabel];
          this.visible = true;
        } else {
          this.recordsPerDetector = {};
        }
      } else {
         // this.records = {};
      }

      // display top influencers
      if (type === this.type.MONITOR || type === this.type.INF_TYPE) {
        loadTopInfluencers(that.topInfluencers, laneLabel, selectedJobIds, swimlaneType, time, (time + bucketInterval.asSeconds()));
        this.showTopInfluencers = true;
        this.visible = true;

      } else if (type === this.type.JOB) {

        loadTopInfluencers(that.topInfluencers, laneLabel, [laneLabel], swimlaneType, time, (time + bucketInterval.asSeconds()));
        this.showTopInfluencers = true;
        this.visible = true;

      } else if (type === this.type.INSPECTOR) {
        // inspector
        // console.log(laneLabel, [laneLabel], swimlaneType, time, (time+bucketInterval.asSeconds()) , inspector);

        const parentType = this.type[inspector.swimlaneType];

        if (parentType === this.type.MONITOR || parentType === this.type.INF_TYPE) {
          loadTopInfluencers(that.inspectorTopInfluencers,
            laneLabel,
            inspector.selectedJobIds,
            inspector.swimlaneType,
            time, time + inspector.timeRange.interval);
          this.showTopInfluencers = true;
          this.visible = true;

        } else if (parentType === this.type.JOB) {
          loadTopInfluencers(that.inspectorTopInfluencers,
            laneLabel,
            [laneLabel],
            inspector.swimlaneType,
            time,
            time + inspector.timeRange.interval);
          this.showTopInfluencers = true;
          this.visible = true;
        } else if (parentType === this.type.INF_VALUE || parentType === this.type.DETECTOR) {
          this.showTopInfluencers = false;
          this.recordLimit = 50;
        } else {
          this.showTopInfluencers = false;
        }

      } else if (type === this.type.INF_VALUE || type === this.type.DETECTOR) {
        this.showTopInfluencers = false;
        this.recordLimit = 50;
      } else {
        this.showTopInfluencers = false;
      }

      if (this.$recordList) {
        this.$recordList.scrollTop(0);
      }
      this.position(true);
    }
  };

  function loadTopInfluencers(topInfluencers, laneLabel, jobIds, swimlaneType, earliestMs, latestMs) {
    if (topInfluencers[swimlaneType][laneLabel] === undefined || topInfluencers[swimlaneType][laneLabel][earliestMs] === undefined) {

      // placeholder to stop loading if the previous results aren't back yet
      if (topInfluencers[swimlaneType][laneLabel] === undefined) {
        topInfluencers[swimlaneType][laneLabel] = {};
      }
      topInfluencers[swimlaneType][laneLabel][earliestMs] = null;

      mlSwimlaneSearchService.getTopInfluencers(ML_RESULTS_INDEX_ID, laneLabel, jobIds, swimlaneType,
          earliestMs, latestMs, 0, that.type)
      .then((resp) => {
        processTopInfluencersResults(topInfluencers, resp.results, earliestMs, laneLabel, swimlaneType);

        // console.log(topInfluencers);
        drawTopInfluencers(topInfluencers[swimlaneType][laneLabel][earliestMs]);

      }).catch((resp)  => {
        console.log('SummaryView visualization - error getting scores by influencer data from elasticsearch:', resp);
      });
    } else if (topInfluencers[swimlaneType][laneLabel][earliestMs] === null) {
      // console.log('loadTopInfluencers(): still loading top influencers')
    } else {
      drawTopInfluencers(topInfluencers[swimlaneType][laneLabel][earliestMs]);

    }
  }



  function processTopInfluencersResults(topInfluencers, results, time, laneLabel, swimlaneType) {
    // console.log('processTopInfluencersResults():', results);
    const list = _.uniq(_.union(results.topMax, results.topSum), false, (item) => { return item.id; });
    topInfluencers[swimlaneType][laneLabel][time] = list;
  }

  function drawTopInfluencers(inf) {
    that.topInfluencerList = inf;
    if (that.topInfluencerTab !== 0) {
      drawBubbleChart();
    }
  }

  function loadTopInfluencersForPage(jobIds, earliestMs, latestMs) {

    const swimlaneType = that.type.JOB;
    mlSwimlaneSearchService.getTopInfluencers(ML_RESULTS_INDEX_ID, '', jobIds, swimlaneType,
        earliestMs, latestMs, 0, that.type)
    .then((resp) => {

      const list = _.uniq(_.union(resp.results.topMax, resp.results.topSum), false, (item) => { return item.id; });
      that.topInfluencerForPage = list;
    }).catch((resp) => {
      console.log('loadTopInfluencersForPage - error getting scores by influencer data from elasticsearch:', resp);
    });
  }

  this.expandInfluencers = function () {
    this.influencersExpanded = !this.influencersExpanded;
    this.position(true);
  };

  function drawBubbleChart() {
    const influencers = { 'children':[] };

    _.each(that.topInfluencerList, (point) => {
      influencers.children.push({ 'label':point.id, 'value': point.sum, 'color': point.max });
    });

    const width = $('.ml-anomaly-details-margin').width() - 20;
    const height = width - 25;
    const radius = Math.min(width, height) / 2;
    const diameter = (radius * 2);
    const margin = {
      top:    0,
      right:  0,
      bottom: 0,
      left:   0
    };

    const $topInfluencersContainer = $('#top-influencers-bubble-chart');
    $topInfluencersContainer.empty();

    if (influencers.children.length) {
      const chartContainerElement = d3.select($topInfluencersContainer.get(0));
      const svg = chartContainerElement.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g');

      const circleG = svg
        .append('g')
        .attr('class', 'circles')
        .attr('transform', () => {
          return 'translate(' + (margin.left) + ',' + (margin.top) + ')';
        });

      const bubble = d3.layout.pack()
        .sort(null)
        .size([diameter, diameter])
        .padding(radius * 0.1);

      const circles = circleG.selectAll('.circle')
        .data(bubble.nodes(influencers)
          .filter((d) => {
            return !d.children;
          }))
        .enter().append('g')
        .attr('class', 'fadable circle')
        .attr('transform', (d) => {
          if (isNaN(d.x)) {
            return 'translate(0, 0)';
          } else {
            return 'translate(' + d.x + ',' + d.y + ')';
          }
        });

      circles.append('circle')
        .attr('r', (d) => {
          return (isNaN(d.r) ? 0 : d.r);
        })
        .style('fill', colorScore);

      circles.append('text')
        .attr('dy', '0em')
        .style('text-anchor', 'middle')
        .text((d) => {
          return d.label;
        });

      circles.append('text')
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text((d) => {
          return Math.floor(d.color);
        });
    }
  }

  const colors = ['#FFFFFF', '#d2e9f7', '#8bc8fb', '#ffdd00', '#ff7e00', '#ff5300', '#fe1d1d'];
  d3.scale.linear()
    .domain([0, 1, 3, 25, 50, 75, 100])
    .range(colors);


  function colorScore(d) {
    return getSeverityColor(d.color);
  }


});
