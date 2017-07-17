/*
 * ELASTICSEARCH CONFIDENTIAL
 *
 * Copyright © 2016 Elasticsearch BV. All Rights Reserved.
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

import 'ui/courier';
import 'plugins/kibana/visualize/styles/main.less';
import 'plugins/kibana/visualize/wizard/wizard.less';

import uiRoutes from 'ui/routes';
import { checkLicense } from 'plugins/ml/license/check_license';
import { checkCreateJobsPrivilege } from 'plugins/ml/privilege/check_privilege';

uiRoutes
.when('/jobs/new_job/simple/multi_metric/step/1', {
  template: require('./step_1.html'),
  resolve: {
    CheckLicense: checkLicense,
    privileges: checkCreateJobsPrivilege,
    indexPatternIds: courier => courier.indexPatterns.getIds()
  }
});

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.controller('MlNewJobMultiStep1', function (
  $scope,
  $route,
  timefilter) {

  timefilter.enabled = false; // remove time picker from top of page

  $scope.indexPattern = {
    selection: null,
    list: $route.current.locals.indexPatternIds
  };

  $scope.step2WithSearchUrl = (hit) => {
    return '#/jobs/new_job/simple/multi_metric/create?savedSearchId=' + encodeURIComponent(hit.id);
  };
  $scope.makeUrl = (pattern) => {
    if (!pattern) return;
    return '#/jobs/new_job/simple/multi_metric/create?index=' + encodeURIComponent(pattern);
  };
});
