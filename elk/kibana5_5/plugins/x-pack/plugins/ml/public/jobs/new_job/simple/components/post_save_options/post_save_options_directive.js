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

import template from './post_save_options.html';

import { XPackInfoProvider } from 'plugins/xpack_main/services/xpack_info';
import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlPostSaveOptions', function (mlPostSaveService, Private) {
  return {
    restrict: 'AE',
    replace: false,
    scope: {
      jobId: '=',
      bucketSpan: '='
    },
    template,
    link: function ($scope) {

      mlPostSaveService.reset();
      const xpackInfo = Private(XPackInfoProvider);
      $scope.watcherEnabled = xpackInfo.get('features.watcher.isAvailable', false);
      $scope.status = mlPostSaveService.status;
      $scope.STATUS = mlPostSaveService.STATUS;

      $scope.runInRealtime = false;
      $scope.createWatch = false;

      $scope.clickRunInRealtime = function () {
        $scope.createWatch = (!$scope.runInRealtime) ? false : $scope.createWatch;
      };

      $scope.apply = function () {
        mlPostSaveService.apply($scope.jobId, $scope.runInRealtime, $scope.createWatch);
      };
    }
  };
}).service('mlPostSaveService', function (mlJobService, mlMessageBarService, $q) {
  const msgs = mlMessageBarService;
  this.STATUS = {
    SAVE_FAILED: -1,
    SAVING: 0,
    SAVED: 1,
  };

  this.status = {
    realtimeJob: null,
    watch: null
  };

  this.externalCreateWatch;
  this.startRealtimeJob = function (jobId) {
    const deferred = $q.defer();
    this.status.realtimeJob = this.STATUS.SAVING;

    const datafeedId = mlJobService.getDatafeedId(jobId);

    mlJobService.openJob(jobId)
    .finally(() => {
      mlJobService.startDatafeed(datafeedId, jobId, 0, undefined)
      .then(() => {
        this.status.realtimeJob = this.STATUS.SAVED;
        deferred.resolve();
      }).catch((resp) => {
        msgs.error('Could not start datafeed: ', resp);
        this.status.realtimeJob = this.STATUS.SAVE_FAILED;
        deferred.reject();
      });
    });

    return deferred.promise;
  };

  this.registerCreateWatch = function (createWatchFunc) {
    if (typeof createWatchFunc === 'function') {
      this.externalCreateWatch = createWatchFunc;
    }
  };

  this.createWatch = function (jobId) {
    return this.externalCreateWatch(jobId);
  };

  this.reset = function () {
    this.status.realtimeJob = null;
    this.status.watch = null;
  };

  this.apply = function (jobId, runInRealtime, createWatch) {
    if (runInRealtime) {
      this.startRealtimeJob(jobId)
      .then(() => {
        if (createWatch) {
          this.createWatch(jobId);
        }
      });
    }
  };
});
