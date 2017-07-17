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
 * ml-job-select-list directive for rendering a multi-select control for selecting
 * one or more jobs from the list of configured jobs.
 */

import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import d3 from 'd3';
import { isTimeSeriesViewJob } from 'plugins/ml/util/job_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlJobSelectList', function (mlJobService, mlJobSelectService, timefilter) {
  return {
    restrict: 'AE',
    replace: true,
    transclude: true,
    template: require('plugins/ml/components/job_select_list/job_select_list.html'),
    controller: function ($scope) {
      $scope.jobs = [];
      $scope.selectableJobs = [];
      $scope.noJobsCreated = undefined;
      $scope.applyTimeRange = true;

      mlJobService.loadJobs()
        .then((resp) => {
          if (resp.jobs.length > 0) {
            $scope.noJobsCreated = false;
            const jobs = [];
            _.each(resp.jobs, (job) => {
              jobs.push({
                id:job.job_id,
                disabled: !($scope.timeSeriesOnly === false || isTimeSeriesViewJob(job) === true),
                running: (job.datafeed_config && job.datafeed_config.state === 'started'),
                timeRange: {
                  to: job.data_counts.latest_record_timestamp,
                  from: job.data_counts.earliest_record_timestamp,
                  fromPx: 0,
                  widthPx: 0,
                  label: ''
                }
              });
            });
            normalizeTimes(jobs);
            $scope.jobs = jobs;

            $scope.selectableJobs = _.filter(jobs, job => !job.disabled);

            const selectStar = ($scope.selections.length === 1 && $scope.selections[0] === '*');
            if ($scope.singleSelection === true) {
              // Page controller should check for these, rectify and notify, but just in case.
              if ($scope.selections.length > 1) {
                $scope.selections.splice(1);
              }
              if (selectStar === true && $scope.selections.length === 1) {
                $scope.selections = [$scope.jobs[0].id];
              }

            } else {
              if (selectStar === true) {
                // Replace the '*' selection with the complete list of job IDs.
                $scope.selections = _.map($scope.jobs, job => job.id);
              }
            }
          } else {
            $scope.noJobsCreated = true;
          }
        }).catch((resp) => {
          console.log('mlJobSelectList controller - error getting job info from ES:', resp);
        });

      $scope.apply = function () {
        if ($scope.selections.length === $scope.jobs.length) {
          mlJobSelectService.broadcastJobSelectionChange(['*']);
        } else {
          mlJobSelectService.broadcastJobSelectionChange($scope.selections);
        }

        // if the apply time range checkbox is ticked,
        // find the min and max times for all selected jobs
        // and apply them to the timefilter
        if ($scope.applyTimeRange) {
          const selectedJobs = _.filter($scope.jobs, job => _.includes($scope.selections, job.id));
          const times = [];
          _.each(selectedJobs, (job) => {
            if (job.timeRange.from !== undefined) {
              times.push(job.timeRange.from);
            }
            if (job.timeRange.to !== undefined) {
              times.push(job.timeRange.to);
            }
          });
          if (times.length) {
            const min = _.min(times);
            const max = _.max(times);
            timefilter.time.from = moment(min).toISOString();
            timefilter.time.to = moment(max).toISOString();
          }
        }
        $scope.closePopover();
      };

      $scope.toggleSelection = function (jobId) {
        const idx = $scope.selections.indexOf(jobId);
        if (idx > -1) {
          $scope.selections.splice(idx, 1);
        } else {
          $scope.selections.push(jobId);
        }
      };

      $scope.toggleAllSelection = function () {
        if ($scope.selections.length === $scope.selectableJobs.length) {
          $scope.selections = [];
        } else {
          $scope.selections = _.map($scope.selectableJobs, job => job.id);
        }
      };

      $scope.isSelected = function (jobId) {
        return (_.includes($scope.selections, jobId) || ($scope.selections.length === 1 && $scope.selections[0] === '*'));
      };

      function normalizeTimes(jobs) {
        const min = _.min(jobs, job => +job.timeRange.from);
        const max = _.max(jobs, job => +job.timeRange.to);

        const gantScale = d3.scale.linear().domain([min.timeRange.from, max.timeRange.to]).range([1, 299]);

        _.each(jobs, (job) => {
          if (job.timeRange.to !== undefined && job.timeRange.from !== undefined) {
            job.timeRange.fromPx = gantScale(job.timeRange.from);
            job.timeRange.widthPx = gantScale(job.timeRange.to) - job.timeRange.fromPx;

            job.timeRange.toMoment = moment(job.timeRange.to);
            job.timeRange.fromMoment = moment(job.timeRange.from);

            let label = job.timeRange.fromMoment.format('MMM Do YYYY, HH:mm');
            label += ' to ';
            label += job.timeRange.toMoment.format('MMM Do YYYY, HH:mm');

            job.timeRange.label = label;
          }
        });

      }

      $scope.useTimeRange = function (job) {
        timefilter.time.from = job.timeRange.fromMoment.toISOString();
        timefilter.time.to = job.timeRange.toMoment.toISOString();
      };
    },
    link: function (scope, element, attrs) {
      scope.timeSeriesOnly = false;
      if (attrs.timeseriesonly !== undefined && attrs.timeseriesonly === 'true') {
        scope.timeSeriesOnly = true;
      }

      if (attrs.singleSelection !== undefined && attrs.singleSelection === 'true') {
        scope.singleSelection = true;
      }

      // List of jobs to select is passed to the directive in the 'selected' attribute.
      // '*' is passed to indicate 'All jobs'.
      scope.selections = (attrs.selected ? attrs.selected.split(' ') : []);

      // Giving the parent div focus fixes checkbox tick UI selection on IE.
      $('.ml-select-list', element).focus();
    }
  };
});
