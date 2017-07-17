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
import moment from 'moment';
import { toLocaleString, detectorToString } from 'plugins/ml/util/string_utils';
import numeral from 'numeral';
import chrome from 'ui/chrome';
import angular from 'angular';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlJobListExpandedRow', function ($location, mlMessageBarService, mlJobService, mlClipboardService) {
  return {
    restrict: 'AE',
    replace: false,
    scope: {},
    template: require('plugins/ml/jobs/jobs_list/expanded_row/expanded_row.html'),
    link: function ($scope, $element) {
      const msgs = mlMessageBarService; // set a reference to the message bar service
      const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
      const DATA_FORMAT = '0.0 b';

      $scope.urlBasePath = chrome.getBasePath();

      $scope.toLocaleString = toLocaleString; // add toLocaleString to the scope to display nicer numbers

      // scope population is inside a function so it can be called later from somewhere else
      $scope.init = function () {
        $scope.job = $scope.$parent.job;
        $scope.jobAudit = $scope.$parent.jobAudit;
        $scope.jobJson = angular.toJson($scope.job, true);
        $scope.jobAuditText = '';
        $scope.datafeedPreview = {
          update: updateDatafeedPreview,
          json: '',
        };

        $scope.detectorToString = detectorToString;

        $scope.ui = {
          currentTab: 0,
          tabs: [
            { index: 0, title: 'Job settings' },
            { index: 1, title: 'Job config' },
            { index: 3, title: 'Counts' },
            { index: 4, title: 'JSON' },
            { index: 5, title: 'Job messages' , showIcon: true },
            { index: 6, title: 'Datafeed preview' },
          ],
          changeTab: function (tab) {
            this.currentTab = tab.index;

            if (tab.index === 5) {
              // when Job Message tab is clicked, load all the job messages for the last month
              // use the promise chain returned from update to scroll to the bottom of the
              // list once it's loaded
              $scope.jobAudit.update()
              .then(() => {
                // auto scroll to the bottom of the message list.
                const div = angular.element('#ml-job-audit-list-' + $scope.job.job_id);
                if (div && div.length) {
                  // run this asynchronously in a timeout to allow angular time to render the contents first
                  window.setTimeout(() => {
                    const table = div.find('table');
                    if (table && table.length) {
                      div[0].scrollTop = table[0].offsetHeight - div[0].offsetHeight + 14;
                    }
                  }, 0);
                }
              });
            } else if (tab.index === 6) {
              updateDatafeedPreview();
            }
          }
        };

        if (typeof $scope.job.datafeed_config !== 'undefined') {
          $scope.ui.tabs.splice(2, 0, { index: 2, title: 'Datafeed' });
        }

        // replace localhost in any of the job's urls with the host in the browser's address bar
        if ($scope.job.location) {
          $scope.job.location = replaceHost($scope.job.location);
        }
        if ($scope.job.endpoints) {
          _.each($scope.job.endpoints, (url, i) => {
            $scope.job.endpoints[i] = replaceHost(url);
          });
        }
      };

      function updateDatafeedPreview() {
        $scope.datafeedPreview.json = '';
        mlJobService.getDatafeedPreview($scope.job.job_id)
        .then((resp) => {
          $scope.datafeedPreview.json = angular.toJson(resp, true);
        })
        .catch((resp) => {
          msgs.error('Datefeed preview could not be loaded', resp);
        });
      }

      // call function defined above.
      $scope.init();

      $scope.copyToClipboard = function (job) {
        const newJob = angular.copy(job);
        const success = mlClipboardService.copy(angular.toJson(newJob));
        if (success) {
          // flash the background color of the json box
          // to show the contents has been copied.
          const el = $element.find('.ml-pre');
          el.css('transition', 'none');
          el.css('background-color', 'aliceblue');
          el.css('color', 'white');
          window.setTimeout(() => {
            el.css('transition', 'background 0.3s linear, color 0.3s linear');
            el.css('background-color', 'white');
            el.css('color', 'inherit');
          }, 1);

        } else {
          msgs.error('Job could not be copied to the clipboard');
        }
      };

      // data values should be formatted with KB, MB etc
      $scope.formatData = function (txt) {
        return numeral(txt).format(DATA_FORMAT);
      };

      // milliseconds should be formatted h m s ms, e.g 3s 44ms
      $scope.formatMS = function (txt) {
        const dur = moment.duration(txt);
        let str = '';
        if (dur._data.days > 0) {
          str += ' ' + dur._data.days + 'd';
        }
        if (dur._data.hours > 0) {
          str += ' ' + dur._data.hours + 'h';
        }
        if (dur._data.minutes > 0) {
          str += ' ' + dur._data.minutes + 'm';
        }
        if (dur._data.seconds > 0) {
          str += ' ' + dur._data.seconds + 's';
        }
        if (dur._data.milliseconds > 0) {
          str += ' ' + Math.ceil(dur._data.milliseconds) + 'ms';
        }
        return str;
      };

      // date values should be formatted with TIME_FORMAT
      $scope.formatDate = function (txt) {
        return moment(txt).format(TIME_FORMAT);
      };


      function replaceHost(url) {
        if (url.match('localhost')) {
          url = url.replace('localhost', $location.host());
        }
        return url;
      }

    },
  };
})
// custom filter to filter out objects from a collection
// used when listing job settings, as id and state are siblings to objects like counts and data_description
.filter('filterObjects', function () {
  return function (input) {
    const tempObj = {};
    _.each(input, (v,i) => {
      if (typeof v !== 'object') {
        tempObj[i] = v;
      }
    });
    return tempObj;
  };
});

