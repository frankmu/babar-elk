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
import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('jobSelectButton', function () {

  function link(scope) {
    scope.selectJobBtnJobIdLabel = '';
    scope.unsafeHtml = '';

    scope.createUnsafeHtml = function () {
      if (scope.selectedJobs) {
        let txt = '<ml-job-select-list ';
        if (scope.timeseriesonly) {
          txt += 'timeseriesonly="true" ';
        }
        if (scope.singleSelection) {
          txt += 'single-selection="true" ';
        }
        txt += 'selected="';
        txt += _.map(scope.selectedJobs, job => job.id).join(' ');
        txt += '"></ml-job-select-list>';
        scope.unsafeHtml = txt;
      }
    };
  }

  return {
    scope: {
      selectedJobs: '=',
      timeseriesonly: '=',
      singleSelection: '='
    },
    link: link,
    replace: true,
    template: require('plugins/ml/components/job_select_list/job_select_button.html')
  };
});
