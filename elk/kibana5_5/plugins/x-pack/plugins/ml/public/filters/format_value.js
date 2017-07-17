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
 * AngularJS filter generally used for formatting 'typical' and 'actual' values
 * from machine learning results. For detectors which use the time_of_week or time_of_day
 * functions, the filter converts the raw number, which is the number of seconds since
 * midnight, into a human-readable date/time format.
 */

import _ from 'lodash';
import moment from 'moment';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.filter('formatValue', function () {

  function formatValue(value, fx) {
    // If the analysis function is time_of_week/day, format as day/time.
    if (fx === 'time_of_week') {
      const d = new Date();
      const i = parseInt(value);
      d.setTime(i * 1000);
      return moment(d).format('ddd hh:mm');
    } else if (fx === 'time_of_day') {
      const d = new Date();
      const i = parseInt(value);
      d.setTime(i * 1000);
      return moment(d).format('hh:mm');
    } else {
      return value;
    }
  }

  return function (value, fx) {
    // actual and typical values in results will be arrays.
    // Unless the array is multi-valued (as it will be for multi-variate analyses),
    // simply return the formatted single value.
    if (Array.isArray(value)) {
      if (value.length === 1) {
        return formatValue(value[0], fx);
      } else {
        return _.map(value, function (val) { return formatValue(val, fx); });
      }
    } else {
      return formatValue(value, fx);
    }
  };
});
