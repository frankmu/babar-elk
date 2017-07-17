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

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.service('mlSingleMetricJobSearchService', function ($q, es) {

  this.getScoresByBucket = function (index, jobId, earliestMs, latestMs, interval) {
    const deferred = $q.defer();
    const obj = {
      success: true,
      results: {}
    };

    es.search({
      index: '.ml-anomalies-*',
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': [{
              'query_string': {
                'query': 'result_type:bucket'
              }
            }, {
              'bool': {
                'must': [{
                  'range': {
                    'timestamp': {
                      'gte': earliestMs,
                      'lte': latestMs,
                      'format': 'epoch_millis'
                    }
                  }
                }, {
                  'query_string': {
                    'query': 'job_id:' + jobId
                  }
                }]
              }
            }]
          }
        },
        'aggs': {
          'times': {
            'date_histogram': {
              'field': 'timestamp',
              'interval': interval,
              'min_doc_count': 1
            },
            'aggs': {
              'anomalyScore': {
                'max': {
                  'field': 'anomaly_score'
                }
              }
            }
          }
        }
      }
    })
    .then((resp) => {
      const aggregationsByTime = _.get(resp, ['aggregations', 'times', 'buckets'], []);
      _.each(aggregationsByTime, (dataForTime) => {
        const time = dataForTime.key;
        obj.results[time] = {
          'anomalyScore': _.get(dataForTime, ['anomalyScore', 'value']),
        };
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };



  this.getModelPlotOutput = function (index, jobId, earliestMs, latestMs, interval, aggType) {
    const deferred = $q.defer();
    const obj = {
      success: true,
      results: {}
    };

    es.search({
      index: '.ml-anomalies-*',
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': [{
              'query_string': {
                'query': 'result_type:model_plot'
              }
            }, {
              'bool': {
                'must': [{
                  'range': {
                    'timestamp': {
                      'gte': earliestMs,
                      'lte': latestMs,
                      'format': 'epoch_millis'
                    }
                  }
                }, {
                  'query_string': {
                    'query': 'job_id:' + jobId
                  }
                }]
              }
            }]
          }
        },
        'aggs': {
          'times': {
            'date_histogram': {
              'field': 'timestamp',
              'interval': interval,
              'min_doc_count': 1
            },
            'aggs': {
              'actual': {
                'avg': {
                  'field': 'actual'
                }
              },
              'modelUpper': {
                [aggType.max]: {
                  'field': 'model_upper'
                }
              },
              'modelLower': {
                [aggType.min]: {
                  'field': 'model_lower'
                }
              }
            }
          }
        }
      }
    })
    .then((resp) => {
      const aggregationsByTime = _.get(resp, ['aggregations', 'times', 'buckets'], []);
      _.each(aggregationsByTime, (dataForTime) => {
        const time = dataForTime.key;
        let modelUpper = _.get(dataForTime, ['modelUpper', 'value']);
        let modelLower = _.get(dataForTime, ['modelLower', 'value']);

        if (modelUpper !== undefined && isFinite(modelUpper)) {
          modelUpper = modelUpper.toFixed(4);
        } else {
          modelUpper = 0;
        }
        if (modelLower !== undefined && isFinite(modelLower)) {
          modelLower = modelLower.toFixed(4);
        } else {
          modelLower = 0;
        }

        obj.results[time] = {
          actual: _.get(dataForTime, ['actual', 'value']),
          modelUpper: modelUpper,
          modelLower: modelLower
        };
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });

    return deferred.promise;
  };


});
