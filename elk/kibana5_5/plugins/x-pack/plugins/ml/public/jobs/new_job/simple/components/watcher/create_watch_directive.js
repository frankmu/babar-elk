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

import chrome from 'ui/chrome';
import _ from 'lodash';
import { parseInterval } from 'ui/utils/parse_interval';

import template from './create_watch.html';
import emailBody from './email.html';
import { watch } from './watch.js';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlCreateWatch', function (mlPostSaveService, $q, $http, es) {
  return {
    restrict: 'AE',
    replace: false,
    scope: {
      bucketSpan: '='
    },
    template,
    link: function ($scope) {

      mlPostSaveService.registerCreateWatch(createWatch);
      $scope.status = mlPostSaveService.status;
      $scope.STATUS = mlPostSaveService.STATUS;

      $scope.id = '';
      $scope.includeEmail = false;
      $scope.email = '';
      $scope.interval = '20m';
      $scope.watcherEditURL = '';
      $scope.threshold = { display:'critical', val:75 };
      $scope.ui = {
        thresholdOptions: [
          { display:'critical', val:75 },
          { display:'major', val:50 },
          { display:'minor', val:25 },
          { display:'warning', val:0 }
        ],
        setThreshold: (t) => {
          $scope.threshold = t;
        },
        emailEnabled: false
      };

      // make the interval 2 times the bucket span
      if ($scope.bucketSpan) {
        const interval = parseInterval($scope.bucketSpan);
        let bs = interval.asMinutes() * 2;
        if (bs < 1) {
          bs = 1;
        }
        $scope.interval = `${bs}m`;
      }

      // load elasticsearch settings to see if email has been configured
      es.cluster.getSettings({
        includeDefaults: true,
        filterPath: '**.xpack.notification'
      }).then((resp) => {
        if (_.has(resp, 'defaults.xpack.notification.email')) {
          $scope.ui.emailEnabled = true;
        }
      });

      const compiledEmailBody = _.template(emailBody);

      const emailSection = {
        send_email: {
          throttle_period_in_millis: 900000, // 15m
          email: {
            profile: 'standard',
            to: [],
            subject: 'ML Watcher Alert',
            body: {
              html: compiledEmailBody({
                serverAddress: chrome.getAppUrl()
              })
            }
          }
        }
      };

      // generate a random number between min and max
      function randomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
      }

      function createWatch(jobId) {
        const deferred = $q.defer();
        $scope.status.watch = mlPostSaveService.STATUS.SAVING;
        if (jobId !== undefined) {
          const id = `ml-${jobId}`;
          $scope.id = id;

          // set specific properties of the the watch
          // watch.trigger.schedule.interval = $scope.interval;
          watch.input.search.request.body.query.bool.filter[0].term.job_id = jobId;
          watch.input.search.request.body.query.bool.filter[1].range.timestamp.gte = `now-${$scope.interval}`;
          watch.input.search.request.body.aggs.bucket_results.filter.range.anomaly_score.gte = $scope.threshold.val;

          if ($scope.includeEmail && $scope.email !== '') {
            const emails = $scope.email.split(',');
            emailSection.send_email.email.to = emails;
            // add email section to watch
            watch.actions.send_email =  emailSection.send_email;
          }

          // set the trigger interval to be a random number between 60 and 120 seconds
          // this is to avoid all watches firing at once if the server restarts
          // and the watches synchronise
          const triggerInterval = randomNumber(60, 120);
          watch.trigger.schedule.interval = `${triggerInterval}s`;

          const watchModel = {
            id,
            upstreamJSON: {
              id,
              watch
            }
          };

          if (id !== '') {
            saveWatch(watchModel)
            .then(() => {
              $scope.status.watch = mlPostSaveService.STATUS.SAVED;
              $scope.watcherEditURL = `${chrome.getBasePath()}/app/kibana#/management/elasticsearch/watcher/watches/watch/${id}/edit?_g=()`;
              deferred.resolve();
            })
            .catch(() => {
              $scope.status.watch = mlPostSaveService.STATUS.SAVE_FAILED;
              deferred.reject();
            });
          }
        } else {
          $scope.status.watch = mlPostSaveService.STATUS.SAVE_FAILED;
          deferred.reject();
        }
        return deferred.promise;
      }

      function saveWatch(watchModel) {
        const basePath = chrome.addBasePath('/api/watcher');
        const url = `${basePath}/watch/${watchModel.id}`;

        return $http.put(url, watchModel.upstreamJSON)
        .catch(e => {
          throw e.data.message;
        });
      }
    }
  };
});
