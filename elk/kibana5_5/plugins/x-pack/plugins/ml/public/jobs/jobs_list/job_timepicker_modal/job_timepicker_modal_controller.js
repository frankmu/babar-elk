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
import angular from 'angular';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.controller('MlJobTimepickerModal', function ($scope, $rootScope, $modalInstance, params, mlJobService, mlMessageBarService) {
  const msgs = mlMessageBarService;
  // msgs.clear();
  $scope.saveLock = false;

  const job = angular.copy(params.job);
  $scope.jobId = job.job_id;

  $scope.datafeedId = mlJobService.getDatafeedId(job.job_id);

  $scope.start = '';
  $scope.end = '';

  let lastTime = '';
  if (job.data_counts && job.data_counts.latest_record_timestamp) {
    const time = moment(job.data_counts.latest_record_timestamp);
    lastTime = time.format('YYYY-MM-DD HH:mm:ss');
  }

  let uiEndRadio = '1';
  let uiTo = moment();
  $scope.isNew = true;
  if (job.data_counts && job.data_counts.input_record_count > 0) {
    $scope.isNew = false;

    // if the job previously had an end time set. default to that.
    if (params.startEnd.endTimeMillis !== null) {
      uiEndRadio = '1';
      uiTo = moment(params.startEnd.endTimeMillis);
    }
  }


  $scope.ui = {
    lastTime: lastTime,
    startDateText: '',
    startRadio:    '1',
    endDateText:   '',
    endRadio:      uiEndRadio,
    timepicker: {
      from: '',
      to:   uiTo
    },
    setStartRadio: function (i) {
      $scope.ui.startRadio = i;
    },
  };

  function extractForm() {
    if ($scope.ui.startRadio === '0') {
      $scope.start = 'now';
    }
    else if ($scope.ui.startRadio === '1') {
      $scope.start = '0';
    }
    else if ($scope.ui.startRadio === '2') {
      $scope.start = moment($scope.ui.timepicker.from).unix() * 1000;
    }

    if ($scope.ui.endRadio === '0') {
      $scope.end = undefined;
    } else if ($scope.ui.endRadio === '1') {
      $scope.end = moment($scope.ui.timepicker.to).unix() * 1000;
    }
  }

  $scope.save = function () {
    $scope.saveLock = true;

    extractForm();

    let doStartCalled = false;
    // in 10s call the function to start the datafeed.
    // if the job has already opened and doStart has already been called, nothing will happen.
    // However, if the job is still waiting to be opened, the datafeed can be started anyway.
    window.setTimeout(doStart, 10000);

    // Attempt to open the job first.
    // If it's already open, ignore the 409 error
    mlJobService.openJob($scope.jobId)
    .then(() => {
      doStart();
    })
    .catch((resp) => {
      if (resp.statusCode === 409) {
        doStart();
      } else {
        if (resp.statusCode === 500) {
          if (doStartCalled === false) {
            // doStart hasn't been called yet, this 500 has returned before 10s,
            // so it's not due to a timeout
            msgs.error(`Could not open ${$scope.jobId}`, resp);
          }
        } else {
          msgs.error(`Could not open ${$scope.jobId}`, resp);
        }
        $scope.saveLock = false;
      }
    });

    // start the datafeed
    function doStart() {
      if (doStartCalled === false) {
        doStartCalled = true;
        mlJobService.startDatafeed($scope.datafeedId, $scope.jobId, $scope.start, $scope.end)
        .then(() => {
          $rootScope.$broadcast('jobsUpdated');
        })
        .catch((resp) => {
          $scope.saveLock = false;
          msgs.error(resp.message);
        });
      }
    }

    $modalInstance.close();
    window.setTimeout(() => {
      $rootScope.$broadcast('jobsUpdated');
    }, 500);
  };

  $scope.cancel = function () {
    // msgs.clear();
    $modalInstance.dismiss('cancel');
  };
});
