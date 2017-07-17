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
import 'ui/timefilter';

import { getSeverity } from 'plugins/ml/util/anomaly_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.service('mlSwimlaneSearchService', function ($q, $timeout, es) {

  // Obtains the record level record_score values by detector ID
  // for a particular job ID(s).
  // Pass an empty array or ['*'] to search over all job IDs.
  // Returned response contains a results property, which contains a
  // three level aggregation of values by job Id, detector index, and time (epoch ms).
  this.getScoresByDetector = function (index, jobIds, earliestMs, latestMs, interval, maxResults) {
    // TODO - move into results_service.js.
    const deferred = $q.defer();
    const obj = { success: true, results: {} };

    // Build the criteria to use in the bool filter part of the request.
    // Adds criteria for the time range plus any specified job IDs.
    const boolCriteria = [];
    boolCriteria.push({
      'range': {
        'timestamp': {
          'gte': earliestMs,
          'lte': latestMs,
          'format': 'epoch_millis'
        }
      }
    });
    if (jobIds && jobIds.length > 0 && !(jobIds.length === 1 && jobIds[0] === '*')) {
      let jobIdFilterStr = '';
      _.each(jobIds, (jobId, i) => {
        if (i > 0) {
          jobIdFilterStr += ' OR ';
        }
        jobIdFilterStr += 'job_id:';
        jobIdFilterStr += jobId;
      });
      boolCriteria.push({
        'query_string': {
          'analyze_wildcard':true,
          'query':jobIdFilterStr
        }
      });
    }

    // TODO - remove hardcoded aggregation interval.
    es.search({
      index: index,
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': 'result_type:record',
                  'analyze_wildcard': true
                }
              },
              {
                'bool': {
                  'must': boolCriteria
                }
              }
            ]
          }
        },
        'aggs': {
          'jobId': {
            'terms': {
              'field': 'job_id',
              'size': maxResults !== undefined ? maxResults : 5,
              'order': {
                'recordScore': 'desc'
              }
            },
            'aggs': {
              'recordScore': {
                'max': {
                  'field': 'record_score'
                }
              },
              'detector_index': {
                'terms': {
                  'field': 'detector_index',
                  'size': maxResults !== undefined ? maxResults : 5,
                  'order': {
                    'recordScore': 'desc'
                  }
                },
                'aggs': {
                  'recordScore': {
                    'max': {
                      'field': 'record_score'
                    }
                  },
                  'byTime': {
                    'date_histogram': {
                      'field': 'timestamp',
                      'interval': interval,
                      'min_doc_count': 1,
                      'extended_bounds': {
                        'min': earliestMs,
                        'max': latestMs
                      }
                    },
                    'aggs': {
                      'recordScore': {
                        'max': {
                          'field': 'record_score'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
    .then((resp) => {
      console.log('getScoresByDetector() resp:', resp);
      // Process the three levels for aggregation for jobId, detectorId, time.
      const dataByJobId = _.get(resp, ['aggregations', 'jobId', 'buckets'], []);
      _.each(dataByJobId, (dataForJob) => {
        const resultsForJob = {};
        const jobId = dataForJob.key;

        const dataByDetectorId = _.get(dataForJob, ['detector_index', 'buckets'], []);
        _.each(dataByDetectorId, (dataForDetector) => {
          const resultsForDetectorId = {};
          const detectorId = dataForDetector.key;

          const dataByTime = _.get(dataForDetector, ['byTime', 'buckets'], []);
          _.each(dataByTime, (dataForTime) => {
            const value = _.get(dataForTime, ['recordScore', 'value']);
            if (value !== undefined) {
              resultsForDetectorId[dataForTime.key] = value;
            }
          });
          resultsForJob[detectorId] = resultsForDetectorId;
        });

        obj.results[jobId] = resultsForJob;

      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };


  // Obtains the record level record_score values by detector ID
  // for a particular job ID(s).
  // Pass an empty array or ['*'] to search over all job IDs.
  // Returned response contains a results property, which contains a
  // three level aggregation of values by job Id, detector index, and time (epoch ms).
  this.getScoresByInfluencerType = function (index, jobIds, earliestMs, latestMs, interval, maxResults) {
    // TODO - move into results_service.js.
    const deferred = $q.defer();
    const obj = { success: true, results: {} };

    // Build the criteria to use in the bool filter part of the request.
    // Adds criteria for the time range plus any specified job IDs.
    const boolCriteria = [];
    boolCriteria.push({
      'range': {
        'timestamp': {
          'gte': earliestMs,
          'lte': latestMs,
          'format': 'epoch_millis'
        }
      }
    });
    if (jobIds && jobIds.length > 0 && !(jobIds.length === 1 && jobIds[0] === '*')) {
      let jobIdFilterStr = '';
      _.each(jobIds, (jobId, i) => {
        if (i > 0) {
          jobIdFilterStr += ' OR ';
        }
        jobIdFilterStr += 'job_id:';
        jobIdFilterStr += jobId;
      });
      boolCriteria.push({
        'query_string': {
          'analyze_wildcard':true,
          'query':jobIdFilterStr
        }
      });
    }

    // TODO - remove hardcoded aggregation interval.
    es.search({
      index: index,
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': 'result_type:bucket_influencer',
                  'analyze_wildcard': true
                }
              },
              {
                'bool': {
                  'must': boolCriteria
                }
              }
            ]
          }
        },
        'aggs': {
          'influencerFieldName': {
            'terms': {
              'field': 'influencer_field_name',
              'size': maxResults !== undefined ? maxResults : 10,
              'order': {
                'anomalyScore': 'desc'
              }
            },
            'aggs': {
              'anomalyScore': {
                'max': {
                  'field': 'anomaly_score'
                }
              },
              'byTime': {
                'date_histogram': {
                  'field': 'timestamp',
                  'interval': interval,
                  'min_doc_count': 1,
                  'extended_bounds': {
                    'min': earliestMs,
                    'max': latestMs
                  }
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
        }
      }
    })
    .then((resp) => {
      console.log('getScoresByInfluencer() resp:', resp);
      obj.results.influencerTypes = {};

      const influencerTypeResults = {};

      const dataByInfluencerTypeValue = _.get(resp, ['aggregations', 'influencerFieldName', 'buckets'], []);
      _.each(dataByInfluencerTypeValue, (dataForInfluencer) => {
        const resultsForInfluencer = {};
        const influencerFieldType = dataForInfluencer.key;

        const dataByTime = _.get(dataForInfluencer, ['byTime', 'buckets'], []);
        _.each(dataByTime, (dataForTime) => {
          const value = _.get(dataForTime, ['anomalyScore', 'value']);
          if (value !== undefined) {
            resultsForInfluencer[dataForTime.key] = value;
          }
        });

        influencerTypeResults[influencerFieldType] = resultsForInfluencer;
      });

      obj.results.influencerTypes = influencerTypeResults;

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  this.getScoresByInfluencerValue = function (index, jobIds, earliestMs, latestMs, interval, maxResults) {
    // TODO - move into results_service.js.
    const deferred = $q.defer();
    const obj = { success: true, results: {} };

    // Build the criteria to use in the bool filter part of the request.
    // Adds criteria for the time range plus any specified job IDs.
    const boolCriteria = [];
    boolCriteria.push({
      'range': {
        'timestamp': {
          'gte': earliestMs,
          'lte': latestMs,
          'format': 'epoch_millis'
        }
      }
    });
    if (jobIds && jobIds.length > 0 && !(jobIds.length === 1 && jobIds[0] === '*')) {
      let jobIdFilterStr = '';
      _.each(jobIds, (jobId, i) => {
        if (i > 0) {
          jobIdFilterStr += ' OR ';
        }
        jobIdFilterStr += 'job_id:';
        jobIdFilterStr += jobId;
      });
      boolCriteria.push({
        'query_string': {
          'analyze_wildcard':true,
          'query':jobIdFilterStr
        }
      });
    }

    // TODO - remove hardcoded aggregation interval.
    es.search({
      index: index,
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': 'result_type:influencer',
                  'analyze_wildcard': true
                }
              },
              {
                'bool': {
                  'must': boolCriteria
                }
              }
            ]
          }
        },
        'aggs': {
          'influencerFieldValue': {
            'terms': {
              'field': 'influencer_field_value',
              'size': maxResults !== undefined ? maxResults : 10,
              'order': {
                'anomalyScore': 'desc'
              }
            },
            'aggs': {
              'anomalyScore': {
                'max': {
                  'field': 'influencer_score'
                }
              },
              'byTime': {
                'date_histogram': {
                  'field': 'timestamp',
                  'interval': interval,
                  'min_doc_count': 1,
                  'extended_bounds': {
                    'min': earliestMs,
                    'max': latestMs
                  }
                },
                'aggs': {
                  'anomalyScore': {
                    'max': {
                      'field': 'influencer_score'
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
    .then((resp) => {
      console.log('getScoresByInfluencer() resp:', resp);
      obj.results.influencerValues = {};

      const influencerValueResults = {};

      // Process the two levels for aggregation for influencerFieldValue and time.
      const dataByInfluencerFieldValue = _.get(resp, ['aggregations', 'influencerFieldValue', 'buckets'], []);
      _.each(dataByInfluencerFieldValue, (dataForInfluencer) => {
        const resultsForInfluencer = {};
        const influencerFieldValue = dataForInfluencer.key;

        const dataByTime = _.get(dataForInfluencer, ['byTime', 'buckets'], []);
        _.each(dataByTime, (dataForTime) => {
          const value = _.get(dataForTime, ['anomalyScore', 'value']);
          if (value !== undefined) {
            resultsForInfluencer[dataForTime.key] = value;
          }
        });

        influencerValueResults[influencerFieldValue] = resultsForInfluencer;
      });

      obj.results.influencerValues = influencerValueResults;

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

      // Queries Elasticsearch to obtain the record level results for
  // the specified job(s) and time range.
  // Pass an empty array or ['*'] to search over all job IDs.
  this.getRecords = function (index, jobIds, earliestMs, latestMs, maxResults) {
    const deferred = $q.defer();
    const obj = { success: true, records: [] };

    // Build the criteria to use in the bool filter part of the request.
    // Adds criteria for the time range, record score,  plus any specified job IDs.
    const boolCriteria = [];
    boolCriteria.push({
      'range': {
        'timestamp': {
          'gte': earliestMs,
          'lte': latestMs,
          'format': 'epoch_millis'
        }
      }
    });

    boolCriteria.push({
      'range': {
        'record_score': {
          'gte': 0//($scope.vis.params.threshold || 0),
        }
      }
    });

    if (jobIds && jobIds.length > 0 && !(jobIds.length === 1 && jobIds[0] === '*')) {
      let jobIdFilterStr = '';
      _.each(jobIds, (jobId, i) => {
        if (i > 0) {
          jobIdFilterStr += ' OR ';
        }
        jobIdFilterStr += 'job_id:';
        jobIdFilterStr += jobId;
      });
      boolCriteria.push({
        'query_string': {
          'analyze_wildcard':true,
          'query':jobIdFilterStr
        }
      });
    }

    es.search({
      index: index,
      size: maxResults !== undefined ? maxResults : 100,
      body: {
        '_source': [
          'job_id',
          'timestamp',
          'detector_index',
          'influencers',
          'record_score',
          'actual',
          'typical',
          'by_field_name',
          'by_field_value',
          'function',
          'function_description',
          'probability',
          'partition_field_value',
          'partition_field_name',
          'over_field_name',
          'over_field_value',
          'causes',
          'is_interim',
          'entity_name',
          'entity_value',
          'correlated_by_field_value'
        ],
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': 'result_type:record',
                  'analyze_wildcard': true
                }
              },
              {
                'bool': {
                  'must': boolCriteria
                }
              }
            ]
          }
        },
        'sort' : [
          { 'record_score' : { 'order' : 'desc' } }
        ],
      }
    })
    .then((resp) => {
      if (resp.hits.total !== 0) {
        _.each(resp.hits.hits, (hit) => {
          obj.records.push(hit._source);
        });
      }
      // console.log('records!!!!!', obj)
      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  this.getTopInfluencers = function (index, laneLabel, jobIds, swimlaneType, earliestMs, latestMs, maxResults, type) {
    const deferred = $q.defer();
    const obj = { success: true, results: [] };

    // Build the criteria to use in the bool filter part of the request.
    // Adds criteria for the time range, record score,  plus any specified job IDs.
    const boolCriteria = [];
    boolCriteria.push({
      'range': {
        'timestamp': {
          'gte': (earliestMs * 1000),
          'lte': (latestMs * 1000),
          'format': 'epoch_millis'
        }
      }
    });

    // boolCriteria.push({
    //   'range': {
    //     'maxAnomalyScore': {
    //       'gte': 0
    //     }
    //   }
    // });

    if (jobIds && jobIds.length > 0 && !(jobIds.length === 1 && jobIds[0] === '*')) {
      let jobIdFilterStr = '';
      _.each(jobIds, (jobId, i) => {
        if (i > 0) {
          jobIdFilterStr += ' OR ';
        }
        jobIdFilterStr += 'job_id:';
        jobIdFilterStr += jobId;
      });
      boolCriteria.push({
        'query_string': {
          'analyze_wildcard':true,
          'query':jobIdFilterStr
        }
      });
    }

    const resutsSize = 20;
    let query = 'result_type:influencer';
    if (type[swimlaneType] === type.INF_TYPE) {
      query +=  ' AND influencer_field_name:' + laneLabel;
    }

    es.search({
      index: index,
      size: maxResults !== undefined ? maxResults : 100,
      body: {
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': query,
                  'analyze_wildcard': true
                }
              },
              {
                'bool': {
                  'must': boolCriteria
                }
              }
            ]
          }
        },
        'aggs': {
          'maxInfluencerFieldValues': {
            'terms': {
              'field': 'influencer_field_value',
              'size': resutsSize,
              'order': {
                'maxAnomalyScore': 'desc'
              }
            },
            'aggs': {
              'maxAnomalyScore': {
                'max': {
                  'field': 'influencer_score'
                }
              },
              'sumAnomalyScore': {
                'sum': {
                  'field': 'influencer_score'
                }
              }
            }
          },
          'sumInfluencerFieldValues': {
            'terms': {
              'field': 'influencer_field_value',
              'size': resutsSize,
              'order': {
                'sumAnomalyScore': 'desc'
              }
            },
            'aggs': {
              'sumAnomalyScore': {
                'sum': {
                  'field': 'influencer_score'
                }
              },
              'maxAnomalyScore': {
                'max': {
                  'field': 'influencer_score'
                }
              }
            }
          }
        }
      }
    })
    .then((resp) => {
      // console.log('Detector swimlane searchTopInfluencers() resp:', resp);
      const results = {
        topMax: [],
        topSum: []
      };

      // Process the two levels for aggregation for influencerFieldValue and time.
      let buckets = _.get(resp, ['aggregations', 'maxInfluencerFieldValues', 'buckets'], []);
      _.each(buckets, (dataForInfluencer) => {
        const key = dataForInfluencer.key;
        const max = +_.get(dataForInfluencer, ['maxAnomalyScore', 'value'], 0);
        const sum = +_.get(dataForInfluencer, ['sumAnomalyScore', 'value'], 0);
        results.topMax.push({
          id: key,
          max: Math.floor(max),
          sum: Math.floor(sum),
          severity: getSeverity(max)
        });
      });

      buckets = _.get(resp, ['aggregations', 'sumInfluencerFieldValues', 'buckets'], []);
      _.each(buckets, (dataForInfluencer) => {
        const key = dataForInfluencer.key;
        const max = +_.get(dataForInfluencer, ['maxAnomalyScore', 'value'], 0);
        const sum = +_.get(dataForInfluencer, ['sumAnomalyScore', 'value'], 0);
        results.topSum.push({
          id: key,
          max: Math.floor(max),
          sum: Math.floor(sum),
          severity: getSeverity(max)
        });
      });

      obj.results = results;
      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  this.getEventRate = function (index, jobIds, earliestMs, latestMs, interval, maxResults) {
    // TODO - move into results_service.js.
    const deferred = $q.defer();
    const obj = { success: true, results: {} };

    // Build the criteria to use in the bool filter part of the request.
    // Adds criteria for the time range plus any specified job IDs.
    const boolCriteria = [];
    boolCriteria.push({
      'range': {
        'timestamp': {
          'gte': earliestMs,
          'lte': latestMs,
          'format': 'epoch_millis'
        }
      }
    });
    if (jobIds && jobIds.length > 0 && !(jobIds.length === 1 && jobIds[0] === '*')) {
      let jobIdFilterStr = '';
      _.each(jobIds, (jobId, i) => {
        if (i > 0) {
          jobIdFilterStr += ' OR ';
        }
        jobIdFilterStr += 'job_id:';
        jobIdFilterStr += jobId;
      });
      boolCriteria.push({
        'query_string': {
          'analyze_wildcard':true,
          'query':jobIdFilterStr
        }
      });
    }

    // TODO - remove hardcoded aggregation interval.
    es.search({
      index: index,
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': 'result_type:bucket',
                  'analyze_wildcard': true
                }
              },
              {
                'bool': {
                  'must': boolCriteria
                }
              }
            ]
          }
        },
        'aggs': {
          'times': {
            'date_histogram': {
              'field': 'timestamp',
              'interval': interval,
              'min_doc_count': 1,
              'extended_bounds': {
                'min': earliestMs,
                'max': latestMs
              }
            },
            'aggs': {
              'jobs': {
                'terms': {
                  'field': 'job_id',
                  'size': maxResults !== undefined ? maxResults : 10,
                  'order': {
                    'sumEventCount': 'desc'
                  }
                },
                'aggs': {
                  'sumEventCount': {
                    'sum': {
                      'field': 'event_count'
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
    .then((resp) => {
      console.log('getEventRate() resp:', resp);

      // Process the two levels for aggregation for influencerFieldValue and time.
      const dataByTimeBucket = _.get(resp, ['aggregations', 'times', 'buckets'], []);
      _.each(dataByTimeBucket, (dataForTime) => {
        let time = dataForTime.key;
        time = time / 1000;

        const jobs = _.get(dataForTime, ['jobs', 'buckets'], []);
        _.each(jobs, (dataForJob) => {
          const jobId = dataForJob.key;
          let jobResults = obj.results[jobId];
          if (jobResults === undefined) {
            jobResults = obj.results[jobId] = {};
          }
          jobResults[time] = _.get(dataForJob, ['sumEventCount', 'value'], []);
        });
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };


});
