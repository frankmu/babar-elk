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
 * Service for firing and registering for events in the
 * anomalies table component.
 */

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.service('mlAnomaliesTableService', function () {

  const listeners = {
    'anomalyRecordMouseenter': [],
    'anomalyRecordMouseleave': [],
    'filterChange': []
  };

  this.fireAnomalyRecordMouseenter = function (record) {
    listeners.anomalyRecordMouseenter.forEach(function (listener) {
      listener(record);
    });
  };

  this.addAnomalyRecordMouseenterListener = function (listener) {
    listeners.anomalyRecordMouseenter.push(listener);
  };

  this.removeAnomalyRecordMouseenterListener = function (listener) {
    const index = listeners.anomalyRecordMouseenter.indexOf(listener);
    if (index > -1) {
      listeners.anomalyRecordMouseenter.splice(index, 1);
    }
  };

  this.fireAnomalyRecordMouseleave = function (record) {
    listeners.anomalyRecordMouseleave.forEach(function (listener) {
      listener(record);
    });
  };

  this.addAnomalyRecordMouseleaveListener = function (listener) {
    listeners.anomalyRecordMouseleave.push(listener);
  };

  this.removeAnomalyRecordMouseleaveListener = function (listener) {
    const index = listeners.anomalyRecordMouseleave.indexOf(listener);
    if (index > -1) {
      listeners.anomalyRecordMouseleave.splice(index, 1);
    }
  };

  this.fireFilterChange = function (field, value, operator) {
    listeners.filterChange.forEach(function (listener) {
      listener(field, value, operator);
    });
  };

  this.addFilterChangeListener = function (listener) {
    listeners.filterChange.push(listener);
  };

  this.removeFilterChangeListener = function (listener) {
    const index = listeners.filterChange.indexOf(listener);
    if (index > -1) {
      listeners.filterChange.splice(index, 1);
    }
  };

});
