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
 * Angular controller for the Ml swimlane visualization.
 */
import _ from 'lodash';
import $ from 'jquery';
import angular from 'angular';
import moment from 'moment';

// Flot includes removed from here.
// If this viz is resurrected, the swimlane will need to be rewritten
// with a new library. Probably D3.

import chrome from 'ui/chrome';
import 'ui/courier';
import 'ui/timefilter';

import { labelDuplicateDetectorDescriptions } from 'plugins/ml/util/anomaly_utils';
import { sortByKey } from 'plugins/ml/util/string_utils';
import 'plugins/ml/services/ml_api_service';
import 'plugins/ml/services/job_service';
import 'plugins/ml/components/job_select_list';
import './swimlane_influencers/swimlane_influencers_directive';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.controller('MlSwimlaneController', function ($scope,
 $route,
 $window,
 $location,
 courier,
 mlJobService,
 mlJobSelectService) {

  // Obtain the descriptions for each job and detector.
  $scope.jobDescriptions = {};
  $scope.detectorsByJob = {};
  $scope.fieldsByJob = {};
  mlJobService.getBasicJobInfo($scope.vis.indexPattern.id)
  .then(function (resp) {
    if (resp.jobs.length > 0) {
      const descriptions = {};
      const detectorsByJob = {};
      _.each(resp.jobs, function (job) {
        descriptions[job.id] = job.description;
        detectorsByJob[job.id] = job.detectorDescriptions;
      });

      $scope.jobDescriptions = descriptions;
      $scope.detectorsByJob = labelDuplicateDetectorDescriptions(detectorsByJob);
      console.log('Swimlane detectorsByJob:', detectorsByJob);
    }
  }).catch(function (resp) {
    console.log('Swimlane - error getting job info from ES:', resp);
  });

  // Obtain the list of 'View by' fields per job for record type results.
  mlJobService.getJobViewByFields()
  .then(function (resp) {
    if (resp.fieldsByJob) {
      $scope.fieldsByJob = resp.fieldsByJob;
      console.log('Swimlane fieldsByJob:', $scope.fieldsByJob);

      // Update the record 'View by' options with the fields for the currently selected job(s).
      let selectedJobIds = ['*'];
      if (_.has($location.search(), 'jobId')) {
        const jobIdParam = $location.search().jobId;
        if (_.isArray(jobIdParam) === true) {
          selectedJobIds = jobIdParam;
        } else {
          selectedJobIds = [jobIdParam];
        }
      }

      let fields = [];
      _.each(selectedJobIds, function (job) {
        fields = _.union(fields, $scope.fieldsByJob[job]);
      });
      _.each(fields, function (field) {
        $scope.vis.type.params.recordViewByOptions.push({ field:field, label:field });
      });
    }
  }).catch(function (resp) {
    console.log('Swimlane - error getting job viewBy fields:', resp);
  });


  $scope.$watch('esResponse', function (resp) {

    if (!resp) {
      $scope._previousHoverPoint = null;
      return;
    }

    if (resp.hits.total !== 0) {
      // Remove ng-hide from the parent div as that has display:none,
      // resulting in the flot chart labels falling inside the chart area on first render.
      $('ml-swimlane').closest('.ng-hide').removeClass('ng-hide');
    }

    console.log('MlSwimlaneController esResponse:', resp);

    // Process the aggregations in the ES response.
    $scope.processAggregations(resp.aggregations);

    syncViewControls();

    // Tell the swimlane directive to render.
    $scope.$emit('render');

  });

  mlJobSelectService.listenJobSelectionChange($scope, function (event, selections) {
    const selectedJobIds = selections.length > 0 ? selections : ['*'];

    // Update the record 'View by' options with the fields for the currently selected job(s).
    let fields = [];
    _.each(selectedJobIds, function (job) {
      fields = _.union(fields, $scope.fieldsByJob[job]);
    });

    // Sort fields alphabetically.
    const sortedFields = _.sortBy(fields, function (field) {
      return field.toLowerCase();
    });

    const recordViewByOptions = _.slice($scope.vis.type.params.recordViewByOptions, 0, 1); // Retain the detector value.
    _.each(sortedFields, function (field) {
      recordViewByOptions.push({ 'field':field, 'label':field });
    });
    $scope.vis.type.params.recordViewByOptions = recordViewByOptions;

    if ($scope.vis.params.mode === 'records') {
      // Set the selected 'View by' option back to detector if the old
      // selection is not applicable for the selected job(s).
      const selectOption = _.find($scope.vis.type.params.recordViewByOptions, function (option) {
        return option.field === $scope.vis.params.viewBy.field;
      });
      if (selectOption !== undefined) {
        $scope.vis.params.viewBy = selectOption;
      } else {
        $scope.vis.params.viewBy = $scope.vis.type.params.recordViewByOptions[0];
        $scope.updateViewState();
      }
    }


  });

  $scope.$on('swimlaneClick', function (event, data) {
    // Active in jobs or influencers mode,
    // open the Explorer dashboard, passing query and time range.

    // Add hour either side of time span if duration < 1 day.
    const fromMoment = moment(data.time);
    const toMoment = moment(data.time).add(data.durationMs, 'ms');
    if (data.durationMs < 86400000) {
      fromMoment.subtract(1, 'h');
      toMoment.add(1, 'h');
    }
    const from = fromMoment.toISOString();  // e.g. 2016-02-08T16:00:00.000Z
    const to = toMoment.toISOString();

    // Build the query to pass to the Explorer dashboard.

    // If showing influencer types, we want to drilldown to show all values
    // of that influencerFieldName. For bucket_time drilldown to show all (*).
    let query = '*';
    if ($scope.vis.params.mode === 'influencers' && data.value !== 'bucket_time') {
      const fieldName = ($scope.vis.params.mode === 'influencers' ? data.value : data.field);
      const fieldValue = ($scope.vis.params.mode === 'influencers' ? '*' : data.value);
      query = encodeURIComponent(fieldName) + ':';
      if (data.value.match(/\s/g)) {
        query += ('"' + data.value + '"');
      } else {
        query += encodeURIComponent(fieldValue);
      }
    }

    const dash = $route.current.locals.dash;
    if (dash) {
      // If used inside a dashboard, 'AND' the drilldown condition onto the
      // dashboard-level query i.e. the string entered into the query bar.
      const dashboardFilters = dash.searchSource.get('filter');
      const queryBarFilter = _.find(dashboardFilters, function (filter) {
        return filter.query && filter.query.query_string && !filter.meta;
      });

      if (queryBarFilter) {
        const queryString = _.get(queryBarFilter, 'query.query_string.query', '*');
        if (queryString !== '*') {
          query = (query !== '*' ? (encodeURIComponent(queryString) + ' AND ' + query) : encodeURIComponent(queryString));
        }
      }
    }

    let path = chrome.getBasePath() + '/app/ml#/anomalyexplorer?_g=(refreshInterval:(display:Off,pause:!f,value:0),' +
      'time:(from:\'' + from + '\',mode:absolute,to:\'' + to + '\'))' +
      '&_a=(filters:!(),query:(query_string:(analyze_wildcard:!t,query:\'' + query + '\')))';

    // Pass the selected job(s) as search parameters in the URL.
    let selectedJobIds = [];
    if ($scope.vis.params.mode === 'jobs') {
      selectedJobIds.push(data.value);
    } else {
      if (_.has($location.search(), 'jobId')) {
        const jobIdParam = $location.search().jobId;
        if (_.isArray(jobIdParam) === true) {
          selectedJobIds = jobIdParam;
        } else {
          selectedJobIds = [jobIdParam];
        }
      }
    }
    _.each(selectedJobIds, function (jobId) {
      path += '&jobId=';
      path += jobId;
    });

    // If clicking on a bar with warning severity, pass a minimum severity parameter in the URL,
    // as components in the Explorer dashboard may default to only show minor and above.
    if (data.score < 25) {
      path += '&minSeverity=warning';
    }

    $window.open(path, '_blank');
  });

  $scope.processAggregations = function (aggregations) {

    const dataByViewBy = {};

    if (aggregations && $scope.vis.aggs.bySchemaName.viewBy !== undefined
      && $scope.vis.aggs.bySchemaName.timeSplit !== undefined) {
      // Retrieve the visualization aggregations.
      const metricsAgg = $scope.vis.aggs.bySchemaName.metric[0];
      const viewByAgg = $scope.vis.aggs.bySchemaName.viewBy[0];
      let secondaryViewByAgg = null;
      if ($scope.vis.aggs.bySchemaName.secondaryViewBy) {
        secondaryViewByAgg = $scope.vis.aggs.bySchemaName.secondaryViewBy[0];
      }
      const timeAgg = $scope.vis.aggs.bySchemaName.timeSplit[0];
      const timeAggId = timeAgg.id;

      if (!secondaryViewByAgg) {
        // Get the buckets of the viewBy aggregation.
        const buckets = aggregations[viewByAgg.id].buckets;
        _.each(buckets, function (bucket) {
          // There will be 1 bucket for each 'view by' value.
          const viewByValue = bucket.key;
          const timesForViewBy = {};
          dataByViewBy[viewByValue] = timesForViewBy;

          const bucketsForViewByValue = bucket[timeAggId].buckets;

          _.each(bucketsForViewByValue, function (valueBucket) {
            // time is the 'valueBucket' key.
            timesForViewBy[valueBucket.key] = {
              value: metricsAgg.getValue(valueBucket)
            };
          });
        });
      } else {
        // Go down an extra level to the buckets of the secondary viewBy aggregation.
        const secondaryAggId = secondaryViewByAgg.id;

        // Just support detectorIndex-jobId.
        const isDetector = ((viewByAgg.getFieldDisplayName() === 'detector_index') &&
            (secondaryViewByAgg.getFieldDisplayName() === 'job_id'));

        const buckets = aggregations[viewByAgg.id].buckets;
        _.each(buckets, function (bucket) {

          const bucketsForViewByValue = bucket[secondaryAggId].buckets;
          _.each(bucketsForViewByValue, function (secondaryBucket) {
            let secondaryViewByValue = secondaryBucket.key;
            if (isDetector === true) {
              console.log('+++ swimlane_controller, isDetector=true, $scope.detectorsByJob:', $scope.detectorsByJob);
              // Obtain detectorDescription from map job_id (secondary bucket key) and detector_index (first bucket key).
              secondaryViewByValue = $scope.detectorsByJob[secondaryBucket.key][bucket.key];
            }

            const timesForViewBy = {};
            dataByViewBy[secondaryViewByValue] = timesForViewBy;

            const bucketsForSecondaryViewByValue = secondaryBucket[timeAggId].buckets;
            _.each(bucketsForSecondaryViewByValue, function (valueBucket) {
              // time is the 'valueBucket' key.
              timesForViewBy[valueBucket.key] = {
                value: metricsAgg.getValue(valueBucket)
              };
            });

          });
        });
      }

      console.log('processAggregations processed data:', dataByViewBy);
    }

    $scope.metricsData = dataByViewBy;

  };

  function syncViewControls() {
    // Synchronize the View By or Interval controls to match the aggregations run in the view,
    // e.g. if being edited via the Kibana Visualization tab sidebar

    if ($scope.vis.aggs.length === 0) {
      return;
    }

    // Update the scope 'View By' field.
    if ($scope.vis.aggs.bySchemaName.viewBy !== undefined) {
      const viewByAgg = $scope.vis.aggs.bySchemaName.viewBy[0];
      console.log('syncViewControls viewByAgg:', viewByAgg);
      const aggViewByField = viewByAgg.getFieldDisplayName();
      if ($scope.isShowingJobDescription() && aggViewByField === 'job_id') {
        // Leave selection as Job Description, as otherwise would switch back to jobID.
      } else {
        if ($scope.vis.params.mode === 'jobs') {
          $scope.vis.params.viewBy = _.findWhere($scope.vis.type.params.jobViewByOptions, { field: aggViewByField });
        } else if ($scope.vis.params.mode === 'influencers') {
          $scope.vis.params.viewBy = _.findWhere($scope.vis.type.params.influencerViewByOptions, { field: aggViewByField });
        } else {
          $scope.vis.params.viewBy = _.findWhere($scope.vis.type.params.recordViewByOptions, { field: aggViewByField });
        }
      }
    }


    // Update the scope 'interval' field.
    if ($scope.vis.aggs.bySchemaName.timeSplit !== undefined) {
      const timeAgg = $scope.vis.aggs.bySchemaName.timeSplit[0];
      let aggInterval = _.get(timeAgg, ['params', 'interval', 'val']);
      if (aggInterval === 'custom') {
        aggInterval = _.get(timeAgg, ['params', 'customInterval']);
      }

      let scopeInterval = $scope.vis.params.interval.val;
      if (scopeInterval && scopeInterval === 'custom') {
        scopeInterval = $scope.vis.params.interval.customInterval;
      }

      let setToInterval = _.findWhere($scope.vis.type.params.intervalOptions, { val: aggInterval });
      if (!setToInterval) {
        setToInterval = _.findWhere($scope.vis.type.params.intervalOptions, { customInterval: aggInterval });
      }
      if (!setToInterval) {
        // e.g. if running inside the Kibana Visualization tab will need to add an extra option in.
        setToInterval = {};

        if (_.get(timeAgg, ['params', 'interval', 'val']) !== 'custom') {
          setToInterval.val = _.get(timeAgg, ['params', 'interval', 'val']);
          setToInterval.display = 'Custom: ' + _.get(timeAgg, ['params', 'interval', 'val']);
        } else {
          setToInterval.val = 'custom';
          setToInterval.customInterval = _.get(timeAgg, ['params', 'customInterval']);
          setToInterval.display = 'Custom: ' + _.get(timeAgg, ['params', 'customInterval']);
        }

        $scope.vis.type.params.intervalOptions.push(setToInterval);
      }


      // Set the flags which indicate if the interval has been scaled.
      // e.g. if requesting points at 5 min interval would result in too many buckets being returned.
      const timeBucketsInterval = timeAgg.buckets.getInterval();
      setToInterval.scaled = timeBucketsInterval.scaled;
      setToInterval.scale = timeBucketsInterval.scale;
      setToInterval.description = timeBucketsInterval.description;

      $scope.vis.params.interval = setToInterval;
    }
  }

  $scope.updateViewState = function () {
    // Set up the visualization in response to a change in the View By or Interval controls.
    setupVisualization()
    .then(function () {
      // Re-run the dashboard search.
      return courier.fetch();
    })
    .catch(function (error) {
      console.log('Error updating swimlane visualization with new view state.', error);
    });
  };

  $scope.isShowingJobDescription = function () {
    return ($scope.vis.params.viewBy && $scope.vis.params.viewBy.label === 'Job description');
  };

  function setupVisualization() {
    // Set the params of the bucket aggregations to the selected 'view by' and 'interval' fields.
    // For example of setting state of visualization see setupVisualization() in discover.js.
    if ($scope.vis) {
      const visState = $scope.vis.getState();

      const secondaryAgg = {
        'id': 4,
        'schema': 'secondaryViewBy',
        'type': 'terms',
        'params': {
          'field':'job_id',
          'order':'desc',
          'orderBy':'1',
          'size': 10
        }
      };

      const isDetector = ($scope.vis.params.viewBy.field === 'detector_index');
      if (isDetector === true) {
        if (visState.aggs.length === 3) {
          // Add in a secondaryViewBy aggregation for 'job_id'.
          visState.aggs.splice(2, 0, secondaryAgg);
        }
      } else {
        if (visState.aggs.length === 4) {
          // Remove the secondaryViewBy aggregation
          visState.aggs.splice(2, 1);
        }
      }

      // Set the field of the 'viewBy' aggregation.
      if ($scope.vis.aggs.bySchemaName.viewBy !== undefined) {
        visState.aggs[1].params.field = $scope.vis.params.viewBy.field;
      }

      // Set the aggregation interval of the 'timeSplit' aggregation.
      if ($scope.vis.aggs.bySchemaName.timeSplit !== undefined) {
        const timeAgg = _.last(visState.aggs);
        timeAgg.params.interval = $scope.vis.params.interval.val;
        if ($scope.vis.params.interval.val === 'custom') {
          timeAgg.params.customInterval = $scope.vis.params.interval.customInterval;
        }
      }

      $scope.vis.setState(visState);

      // Update the viewBy field name and time interval of the 'editable vis'
      // e.g. if visualization is being viewed in the Kibana Visualize view, need
      // to update the configurations for the aggregations in the editor sidebar.
      const editableVis = $scope.vis.getEditableVis();
      if (editableVis) {
        const editableVisState = editableVis.getState();
        if ($scope.vis.aggs.bySchemaName.viewBy !== undefined) {
          editableVisState.aggs[1].params.field = $scope.vis.params.viewBy.field;
        }

        if (isDetector === true) {
          if (editableVisState.aggs.length === 3) {
            // Add in a secondaryViewBy aggregation for 'job_id'.
            editableVisState.aggs.splice(2, 0, secondaryAgg);
          }
        } else {
          if (editableVisState.aggs.length === 4) {
            // Remove the secondaryViewBy aggregation
            editableVisState.aggs.splice(2, 1);
          }
        }

        if ($scope.vis.aggs.bySchemaName.timeSplit !== undefined) {
          const editableTimeAgg = _.last(editableVisState.aggs);
          editableTimeAgg.params.interval = $scope.vis.params.interval.val;
          if ($scope.vis.params.interval.val === 'custom') {
            editableTimeAgg.params.customInterval = $scope.vis.params.interval.customInterval;
          }
        }

        editableVis.setState(editableVisState);
      }

      return Promise.resolve($scope.vis);
    }

  }

})
.directive('mlSwimlane', function ($location, $compile, timefilter) {

  function link(scope, element) {

    scope._previousHoverPoint = null;
    scope._influencerHoverScope = null;

    scope.$on('render',function () {
      renderSwimlane();
    });

    function renderSwimlane() {

      let chartData = scope.metricsData || [];
      const allSeries = [];
      const isJobDescription = scope.isShowingJobDescription();

      // Create a series for each severity color band, with a 'low warning' level for scores < 3.
      const colorBands = ['#d2e9f7', '#8bc8fb', '#ffdd00', '#ff7e00', '#fe5050'];
      const seriesLabels = ['low_warning','warning','minor','major','critical'];
      _.each(colorBands, function (color, i) {
        const series = {};
        series.label = seriesLabels[i];
        series.color = color;
        series.points = { fillColor: color, show: true, radius: 5, symbol: drawChartSymbol,  lineWidth: 1 };
        series.data = [];
        series.shadowSize = 0;
        allSeries.push(series);
      });

      // Sort the lane labels in reverse so that the order is a-z from the top.
      chartData = sortByKey(chartData, true);
      const laneIds = _.keys(chartData);

      let laneIndex = 0;
      _.each(chartData, function (bucketsForViewByValue, viewByValue) {

        laneIndex = laneIds.indexOf(viewByValue);

        _.each(bucketsForViewByValue, function (dataForTime, time) {
          const value = dataForTime.value;

          // Map value to the index of the series for that severity.
          // Use the usual four colour bands for values between 0 and 100,
          // plus an additional 'low warning' series for scores < 3.
          let seriesIndex = value < 3 ? 0 : (Math.floor(parseInt(value) / 25) + 1);
          seriesIndex = seriesIndex > 4 ? 4 : seriesIndex;

          const pointData = new Array();
          pointData[0] = moment(Number(time));
          pointData[1] = laneIndex + 0.5;
          // Store the score in an additional object property for each point.
          pointData[2] = { score: value };

          allSeries[seriesIndex].data.push(pointData);

        });
      });

      // Extract the bounds of the time filter so we can set the x-axis min and max.
      // If no min/max supplied, Flot will automatically set them according to the data values.
      const bounds = timefilter.getActiveBounds();
      let earliest = null;
      let latest = null;
      if (bounds && scope.vis.aggs.bySchemaName.timeSplit !== undefined) {
        const timeAgg = scope.vis.aggs.bySchemaName.timeSplit[0];
        const aggInterval = timeAgg.buckets.getInterval();

        // Elasticsearch aggregation returns points at start of bucket,
        // so set the x-axis min to the start of the aggregation interval.
        earliest = moment(bounds.min).startOf(aggInterval.description).valueOf();
        latest = moment(bounds.max).valueOf();
      }

      const options = {
        xaxis: {
          mode: 'time',
          timeformat: '%d %b %H:%M',
          tickFormatter: function (v, axis) {
            // TODO - check if Kibana has functionality for displaying times in browser or UTC timezone.
            // moment.format() will use browser timezone.
            // Only show time if tick spacing is less than a day.
            const tickGap = (axis.max - axis.min) / 10000;  // Approx 10 ticks, convert to sec.
            if (tickGap < 86400) {
              return moment(v).format('MMM D HH:mm');
            } else {
              return moment(v).format('MMM D YYYY');
            }
          },
          min: _.isUndefined(earliest) ? null : earliest,
          max: _.isUndefined(latest) ? null : latest,
          color: '#d5d5d5'
        },
        yaxis: {
          min: 0,
          color: null,
          tickColor: null,
          tickLength: 0,
        },
        grid: {
          backgroundColor: null,
          borderWidth: 1,
          hoverable: true,
          clickable: true,
          borderColor: '#cccccc',
          color: null,
        },
        legend : {
          show: false
        },
        selection: {
          mode: 'x',
          color: '#bbbbbb'
        }
      };

      // Set the alternate lane marking color depending on whether Kibana dark theme is being used.
      // Note we currently don't respond to the 'Use dark theme' Options toggle, only on refresh.
      const alternateLaneColor = element.closest('.theme-dark').length === 0 ? '#f5f5f5' : '#4a4a4a';

      options.yaxis.max = laneIds.length;
      options.yaxis.ticks = [];
      options.grid.markings = [];

      let yaxisMarking;
      _.each(laneIds, function (labelId, i) {
        // Get the label of the 'viewBy' field corresponding to the field ID.
        let labelText = labelId;
        if (isJobDescription) {
          labelText = scope.jobDescriptions[labelId];
        }

        // Crop y-axis 'viewBy' labels over 30 chars of more.
        labelText = (labelText.length < 28 ? labelText : labelText.substring(0, 25) + '...');
        const tick = [i + 0.5, labelText];
        options.yaxis.ticks.push(tick);

        // Set up marking effects for each lane.
        if (i > 0) {
          yaxisMarking = {};
          yaxisMarking.from = i;
          yaxisMarking.to = i + 0.03;
          const marking = { yaxis: yaxisMarking, color: '#d5d5d5' };
          options.grid.markings.push(marking);
        }

        if (i % 2 !== 0) {
          yaxisMarking = {};
          yaxisMarking.from = i + 0.03;
          yaxisMarking.to = i + 1;
          const marking = { yaxis: yaxisMarking, color: alternateLaneColor };
          options.grid.markings.push(marking);
        }
      });

      // Adjust height of element according to the number of lanes, allow for height of axis labels.
      // TODO - use CSS properties, rather than hardcoded numbers.
      element.height((laneIds.length * 32) + 50);

      // Draw the plot.
      const plot = $.plot(element, allSeries, options);

      // Add tooltips to the y-axis labels to display the full 'viewBy' field
      // - useful for cases where a long text value has been cropped.
      // NB. requires z-index set in CSS so that hover is picked up on label.
      const yAxisLabelDivs = $('.flot-y-axis', angular.element(element)).find('.flot-tick-label');
      _.each(laneIds, function (labelId, i) {
        let labelText = labelId;
        if (isJobDescription) {
          labelText = scope.jobDescriptions[labelId];
        }

        $(yAxisLabelDivs[i]).attr('title', labelText);
      });


      // Show tooltips on point hover.
      element.unbind('plothover');
      element.bind('plothover', function (event, pos, item) {
        if (item) {
          if (scope.vis.params.mode === 'jobs' || scope.vis.params.mode === 'influencers') {
            element.addClass('ml-swimlane-point-over');
          }

          if (scope._previousHoverPoint !== item.dataIndex) {
            scope._previousHoverPoint = item.dataIndex;
            $('.ml-swimlane-tooltip').remove();
            if (scope._influencerHoverScope) {
              scope._influencerHoverScope.$destroy();
            }

            const lIndex = item.series.data[item.dataIndex][1] - 0.5;
            const laneLabel = laneIds[lIndex];
            showTooltip(item, laneLabel);
          }
        } else {
          if (scope.vis.params.mode === 'jobs' || scope.vis.params.mode === 'influencers') {
            element.removeClass('ml-swimlane-point-over');
          }
          $('.ml-swimlane-tooltip').remove();
          scope._previousHoverPoint = null;
          if (scope._influencerHoverScope) {
            scope._influencerHoverScope.$destroy();
          }
        }
      });

      // Set the timefilter if the user selects a range on the chart.
      element.unbind('plotselected');
      element.bind('plotselected', function (event, ranges) {
        let zoomFrom = ranges.xaxis.from;
        let zoomTo = ranges.xaxis.to;

        // Aggregation returns points at start of bucket, so make sure the time
        // range zoomed in to covers the full aggregation interval.
        const timeAgg = scope.vis.aggs.bySchemaName.timeSplit[0];
        const aggIntervalMs = timeAgg.buckets.getInterval().asMilliseconds();

        // Add a bit of extra padding before start time.
        zoomFrom = zoomFrom - (aggIntervalMs / 4);
        zoomTo = zoomTo + aggIntervalMs;

        timefilter.time.from = moment.utc(zoomFrom);
        timefilter.time.to = moment.utc(zoomTo);
        timefilter.time.mode = 'absolute';
      });

      element.unbind('plotclick');
      // Trigger swimlaneClick events for jobs and influencers to drilldown
      // to showing record level results in the Explorer dashboard.
      if (scope.vis.params.mode === 'jobs' || scope.vis.params.mode === 'influencers') {
        element.bind('plotclick', function (event, pos, item) {
          plot.unhighlight();

          if (item) {
            // Trigger a click event, passing on the point time span and lane field/value.
            if (!plot.getSelection()) {
              const timeAgg = scope.vis.aggs.bySchemaName.timeSplit[0];
              const bucketInterval = timeAgg.buckets.getInterval();  // A moment duration.
              const lIndex = item.datapoint[1] - 0.5;
              const fieldValue = laneIds[lIndex];
              const dataModel = item.series.data[item.dataIndex][2];

              const clickData = { 'time':item.datapoint[0],
                'durationMs':bucketInterval.asMilliseconds(),
                'field': scope.vis.params.viewBy.field,
                'value': fieldValue,
                'severity': item.series.label,
                'score': dataModel.score };

              plot.highlight(item.series, item.datapoint);
              scope.$emit('swimlaneClick', clickData);
            }
          }
        });
      }
    }

    function drawChartSymbol(ctx, x, y, radius) {
      const size = radius * Math.sqrt(Math.PI) / 2;
      ctx.rect(x - size, y - 14, size + size, 28);
    }

    function showTooltip(item, laneLabel) {
      const pointTime = item.datapoint[0];
      const dataModel = item.series.data[item.dataIndex][2];
      const score = parseInt(dataModel.score);
      const metricsAgg = scope.vis.aggs.bySchemaName.metric[0];
      const metricLabel = metricsAgg.makeLabel();
      const displayScore = (score > 0 ? score : '< 1');

      // TODO - check if Kibana has functionality for displaying times in browser or UTC timezone.
      // Refer to GitHub ticket -  https://github.com/elastic/kibana/issues/1600, currently unresolved.
      // Display date using same format as Kibana visualizations.
      const formattedDate = moment(pointTime).format('MMMM Do YYYY, HH:mm');
      let contents = formattedDate + '<br/><hr/>';
      if (scope.isShowingJobDescription() === true) {
        // Additionally display job ID.
        contents += ('Job ID: ' + laneLabel + '<br/>');
      }

      contents += (metricLabel + ': ' + displayScore);

      const x = item.pageX;
      const y = item.pageY;
      const offset = 5;
      $('<div class="ml-swimlane-tooltip">' + contents + '</div>').css({
        'position': 'absolute',
        'display': 'none',
        'z-index': 1,
        'top': y + offset,
        'left': x + offset
      }).appendTo('body').fadeIn(200);

      if (scope.vis.params.mode === 'influencers' && laneLabel !== 'bucket_time') {

        // Display top influencer field values in the tooltip
        // using the ml-swimlane-influencers directive.

        // Store the attributes required for querying elasticsearch in the child scope.
        const timeAgg = scope.vis.aggs.bySchemaName.timeSplit[0];
        const bucketInterval = timeAgg.buckets.getInterval();
        const latestMs = pointTime + bucketInterval.asMilliseconds() - 1;

        scope._influencerHoverScope = scope.$new();
        scope._influencerHoverScope.indexPattern = scope.vis.indexPattern;
        scope._influencerHoverScope.influencerFieldName = laneLabel;
        scope._influencerHoverScope.earliestMs = pointTime;
        scope._influencerHoverScope.latestMs = latestMs;
        scope._influencerHoverScope.itemPageX = x;
        scope._influencerHoverScope.itemPageY = y;

        // Add the list of selected jobs to the child scope.
        if (_.has($location.search(), 'jobId')) {
          const jobIdParam = $location.search().jobId;
          if (_.isArray(jobIdParam) === true) {
            scope._influencerHoverScope.selectedJobIds = jobIdParam;
          } else {
            if (jobIdParam !== '*') {
              scope._influencerHoverScope.selectedJobIds = [jobIdParam];
            }
          }
        }

        // Compile the contents to link the ml-swimlane-influencers directive to the child scope.
        const $topInfluencersContent = $('<br/><hr/><ml-swimlane-influencers/>');
        $('.ml-swimlane-tooltip').addClass('influencers-mode');
        $('.ml-swimlane-tooltip').append($topInfluencersContent);
        $compile($('.ml-swimlane-tooltip'))(scope._influencerHoverScope);
      }

      // Position the tooltip.
      const $win = $(window);
      const winHeight = $win.height();
      const yOffset = window.pageYOffset;
      const width = $('.ml-swimlane-tooltip').outerWidth(true);
      const height = $('.ml-swimlane-tooltip').outerHeight(true);

      $('.ml-swimlane-tooltip').css('left', x + offset + width > $win.width() ? x - offset - width : x + offset);
      $('.ml-swimlane-tooltip').css('top', y + height < winHeight + yOffset ? y : y - height);

    }
  }

  return {
    link: link
  };
});
