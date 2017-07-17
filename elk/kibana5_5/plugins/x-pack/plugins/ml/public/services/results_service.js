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

// Service for carrying out Elasticsearch queries to obtain data for the
// Ml Results dashboards.
import _ from 'lodash';

import { escapeForElasticsearchQuery } from 'plugins/ml/util/string_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.service('mlResultsService', function ($q, es) {

  // Obtains the maximum bucket anomaly scores by job ID and time.
  // Pass an empty array or ['*'] to search over all job IDs.
  // Returned response contains a results property, with a key for job
  // which has results for the specified time range.
  this.getScoresByBucket = function (index, jobIds, earliestMs, latestMs, interval, maxResults) {
    const deferred = $q.defer();
    const obj = {
      success: true,
      results: {}
    };

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
          'analyze_wildcard': false,
          'query': jobIdFilterStr
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
            'filter': [{
              'query_string': {
                'query': 'result_type:bucket',
                'analyze_wildcard': false
              }
            }, {
              'bool': {
                'must': boolCriteria
              }
            }]
          }
        },
        'aggs': {
          'jobId': {
            'terms': {
              'field': 'job_id',
              'size': maxResults !== undefined ? maxResults : 5,
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
      console.log('getScoresByBucket() resp:', resp);

      const dataByJobId = _.get(resp, ['aggregations', 'jobId', 'buckets'], []);
      _.each(dataByJobId, (dataForJob) => {
        const jobId = dataForJob.key;

        const resultsForTime = {};

        const dataByTime = _.get(dataForJob, ['byTime', 'buckets'], []);
        _.each(dataByTime, (dataForTime) => {
          const value = _.get(dataForTime, ['anomalyScore', 'value']);
          if (value !== undefined) {
            const time = dataForTime.key;
            resultsForTime[time] = _.get(dataForTime, ['anomalyScore', 'value']);
          }
        });
        obj.results[jobId] = resultsForTime;
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };


  // Obtains the top influencers, by maximum influencer score, for the specified index, time range and job ID(s).
  // Pass an empty array or ['*'] to search over all job IDs.
  // Returned response contains an influencers property, with a key for each of the influencer field names,
  // whose value is an array of objects containing influencerFieldValue, maxAnomalyScore and sumAnomalyScore keys.
  this.getTopInfluencers = function (index, jobIds, earliestMs, latestMs, maxFieldNames, maxFieldValues) {
    const deferred = $q.defer();
    const obj = { success: true, influencers: {} };

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
          'analyze_wildcard':false,
          'query':jobIdFilterStr
        }
      });
    }

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
                  'analyze_wildcard': false
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
          'influencerFieldNames': {
            'terms': {
              'field': 'influencer_field_name',
              'size': 5,
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
              'influencerFieldValues': {
                'terms': {
                  'field': 'influencer_field_value',
                  'size': maxFieldValues !== undefined ? maxFieldValues : 10,
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
              }
            }
          }
        }
      }
    })
    .then((resp) => {
      const fieldNameBuckets = _.get(resp, ['aggregations', 'influencerFieldNames', 'buckets'], []);
      _.each(fieldNameBuckets, (nameBucket) => {
        const fieldName = nameBucket.key;
        const fieldValues = [];

        const fieldValueBuckets = _.get(nameBucket, ['influencerFieldValues', 'buckets'], []);
        _.each(fieldValueBuckets, (valueBucket) => {
          const fieldValueResult = {
            'influencerFieldValue': valueBucket.key,
            'maxAnomalyScore': valueBucket.maxAnomalyScore.value,
            'sumAnomalyScore': valueBucket.sumAnomalyScore.value
          };
          fieldValues.push(fieldValueResult);
        });

        obj.influencers[fieldName] = fieldValues;
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  // Obtains the top influencer field values, by maximum anomaly score, for a
  // particular index, field name and job ID(s).
  // Pass an empty array or ['*'] to search over all job IDs.
  // Returned response contains a results property, which is an array of objects
  // containing influencerFieldValue, maxAnomalyScore and sumAnomalyScore keys.
  this.getTopInfluencerValues = function (index, jobIds, influencerFieldName, earliestMs, latestMs, maxResults) {
    const deferred = $q.defer();
    const obj = { success: true, results: [] };

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
          'analyze_wildcard':false,
          'query':jobIdFilterStr
        }
      });
    }

    es.search({
      index: index,
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': 'result_type:influencer AND influencer_field_name:' +
                    escapeForElasticsearchQuery(influencerFieldName),
                  'analyze_wildcard': false
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
          'influencerFieldValues': {
            'terms': {
              'field': 'influencer_field_value',
              'size': maxResults !== undefined ? maxResults : 2,
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
          }
        }
      }
    })
    .then((resp) => {
      const buckets = _.get(resp, ['aggregations', 'influencerFieldValues', 'buckets'], []);
      _.each(buckets, (bucket) => {
        const result = {
          'influencerFieldValue': bucket.key,
          'maxAnomalyScore': bucket.maxAnomalyScore.value,
          'sumAnomalyScore': bucket.sumAnomalyScore.value };
        obj.results.push(result);
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  // Obtains the maximum bucket influencer score by time for the specified job ID(s).
  // Pass an empty array or ['*'] to search over all job IDs.
  // Returned response contains a results property as an object of max score by time.
  this.getBucketInfluencerMaxScoreByTime = function (index, jobIds, earliestMs, latestMs, interval) {
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
          'analyze_wildcard':false,
          'query':jobIdFilterStr
        }
      });
    }

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
                  'analyze_wildcard': false
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
          'byTime': {
            'date_histogram': {
              'field': 'timestamp',
              'interval': interval,
              'min_doc_count': 1
            },
            'aggs': {
              'maxAnomalyScore': {
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
      const dataByTime = _.get(resp, ['aggregations', 'byTime', 'buckets'], []);
      _.each(dataByTime, (dataForTime) => {
        const value = _.get(dataForTime, ['maxAnomalyScore', 'value']);
        if (value !== undefined) {
          obj.results[dataForTime.key] = value;
        }
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  // Obtains the maximum score by influencer_field_value and by time for the specified job ID(s)
  // (pass an empty array or ['*'] to search over all job IDs), and specified influencer field
  // values (pass an empty array to search over all field values).
  // Returned response contains a results property with influencer field values keyed
  // against max score by time.
  this.getInfluencerValueMaxScoreByTime = function (index, jobIds, influencerFieldName, influencerFieldValues,
    earliestMs, latestMs, interval, maxResults) {
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
          'analyze_wildcard':false,
          'query':jobIdFilterStr
        }
      });
    }

    if (influencerFieldValues && influencerFieldValues.length > 0) {
      let influencerFilterStr = '';
      _.each(influencerFieldValues, (value, i) => {
        if (i > 0) {
          influencerFilterStr += ' OR ';
        }
        influencerFilterStr += 'influencer_field_value:';
        influencerFilterStr += escapeForElasticsearchQuery(value);
      });
      boolCriteria.push({
        'query_string': {
          'analyze_wildcard':false,
          'query':influencerFilterStr
        }
      });
    }

    es.search({
      index: index,
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': 'result_type:influencer AND influencer_field_name:' +
                    escapeForElasticsearchQuery(influencerFieldName),
                  'analyze_wildcard': false
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
          'influencerFieldValues': {
            'terms': {
              'field': 'influencer_field_value',
              'size': maxResults !== undefined ? maxResults : 10,
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
              'byTime': {
                'date_histogram': {
                  'field': 'timestamp',
                  'interval': interval,
                  'min_doc_count': 1
                },
                'aggs': {
                  'maxAnomalyScore': {
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
      const fieldValueBuckets = _.get(resp, ['aggregations', 'influencerFieldValues', 'buckets'], []);
      _.each(fieldValueBuckets, (valueBucket) => {
        const fieldValue = valueBucket.key;
        const fieldValues = {};

        const timeBuckets = _.get(valueBucket, ['byTime', 'buckets'], []);
        _.each(timeBuckets, (timeBucket) => {
          const time = timeBucket.key;
          const score = timeBucket.maxAnomalyScore.value;
          fieldValues[time] = score;
        });

        obj.results[fieldValue] = fieldValues;
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };


  // Obtains the categorization examples for the categories with the specified IDs
  // from the given index and job ID.
  // Returned response contains two properties - jobId and
  // examplesByCategoryId (list of examples against categoryId).
  this.getCategoryExamples = function (index, jobId, categoryIds, maxExamples) {
    const deferred = $q.defer();
    const obj = { success: true, jobId: jobId, examplesByCategoryId:{} };

    es.search({
      index: index,
      size: 500,  // Matches size of records in anomaly summary table.
      body: {
        'query': {
          'bool': {
            'filter': [
              { 'term': { 'job_id': jobId } },
              { 'terms': { 'category_id': categoryIds } }
            ]
          }
        }
      }
    })
    .then((resp) => {
      if (resp.hits.total !== 0) {
        _.each(resp.hits.hits, (hit) => {
          if (maxExamples) {
            obj.examplesByCategoryId[hit._source.category_id] =
              _.slice(hit._source.examples, 0, Math.min(hit._source.examples.length, maxExamples));
          } else {
            obj.examplesByCategoryId[hit._source.category_id] = hit._source.examples;
          }

        });
      }
      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };


  // Queries Elasticsearch to obtain record level results containing the influencers
  // for the specified job(s), record score threshold, and time range.
  // Pass an empty array or ['*'] to search over all job IDs.
  // Returned response contains a records property, with each record containing
  // only the fields job_id, detector_index, record_score and influencers.
  this.getRecordInfluencers = function (index, jobIds, threshold, earliestMs, latestMs, maxResults) {
    const deferred = $q.defer();
    const obj = { success: true, records: [] };

    // Build the criteria to use in the bool filter part of the request.
    // Adds criteria for the existence of the nested influencers field, time range,
    // record score, plus any specified job IDs.
    const boolCriteria = [];
    boolCriteria.push({
      'nested': {
        'path': 'influencers',
        'query': {
          'bool': {
            'must': [
              {
                'exists' : { 'field' : 'influencers' }
              }
            ]
          }
        }
      }
    });

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
          'gte': threshold,
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
          'analyze_wildcard':false,
          'query':jobIdFilterStr
        }
      });
    }

    es.search({
      index: index,
      size: maxResults !== undefined ? maxResults : 100,
      body: {
        '_source': ['job_id', 'detector_index', 'influencers', 'record_score'],
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': 'result_type:record',
                  'analyze_wildcard': false
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
      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };


  // Queries Elasticsearch to obtain the record level results containing the specified influencer(s),
  // for the specified job(s), time range, and record score threshold.
  // influencers parameter must be an array, with each object in the array having 'fieldName'
  // 'fieldValue' properties.
  // Pass an empty array or ['*'] to search over all job IDs.
  this.getRecordsForInfluencer = function (index, jobIds, influencers, threshold, earliestMs, latestMs, maxResults) {
    const deferred = $q.defer();
    const obj = { success: true, records: [] };

    // Build the criteria to use in the bool filter part of the request.
    // Add criteria for the time range, record score, plus any specified job IDs.
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
          'gte': threshold,
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
          'analyze_wildcard':false,
          'query':jobIdFilterStr
        }
      });
    }

    // Add a nested query to filter for each of the specified influencers.
    _.each(influencers, (influencer) => {
      boolCriteria.push({
        'nested': {
          'path': 'influencers',
          'query': {
            'bool': {
              'must': [
                {
                  'match': {
                    'influencers.influencer_field_name': influencer.fieldName
                  }
                },
                {
                  'match': {
                    'influencers.influencer_field_values': influencer.fieldValue
                  }
                }
              ]
            }
          }
        }
      });
    });

    es.search({
      index: index,
      size: maxResults !== undefined ? maxResults : 100,
      body: {
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': 'result_type:record',
                  'analyze_wildcard': false
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
      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };


  // Queries Elasticsearch to obtain the record level results for the specified job and detector,
  // time range, record score threshold, and whether to only return results containing influencers.
  // An additional, optional influencer field name and value may also be provided.
  this.getRecordsForDetector = function (index, jobId, detectorIndex, checkForInfluencers,
    influencerFieldName, influencerFieldValue, threshold, earliestMs, latestMs, maxResults) {
    const deferred = $q.defer();
    const obj = { success: true, records: [] };

    // Build the criteria to use in the bool filter part of the request.
    // Add criteria for the time range, record score, plus any specified job IDs.
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

    boolCriteria.push({ 'term': { 'job_id': jobId } });
    boolCriteria.push({ 'term': { 'detector_index': detectorIndex } });

    boolCriteria.push({
      'range': {
        'record_score': {
          'gte': threshold,
        }
      }
    });

    // Add a nested query to filter for the specified influencer field name and value.
    if (influencerFieldName && influencerFieldValue) {
      boolCriteria.push({
        'nested': {
          'path': 'influencers',
          'query': {
            'bool': {
              'must': [
                {
                  'match': {
                    'influencers.influencer_field_name': influencerFieldName
                  }
                },
                {
                  'match': {
                    'influencers.influencer_field_values': influencerFieldValue
                  }
                }
              ]
            }
          }
        }
      });
    } else {
      if (checkForInfluencers === true) {
        boolCriteria.push({
          'nested': {
            'path': 'influencers',
            'query': {
              'bool': {
                'must': [
                  {
                    'exists' : { 'field' : 'influencers' }
                  }
                ]
              }
            }
          }
        });
      }
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
                  'query': 'result_type:record',
                  'analyze_wildcard': false
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
      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  // Queries Elasticsearch to obtain all the record level results for the specified job(s), time range,
  // and record score threshold.
  // Pass an empty array or ['*'] to search over all job IDs.
  // Returned response contains a records property, which is an array of the matching results.
  this.getRecords = function (index, jobIds, threshold, earliestMs, latestMs, maxResults) {
    return this.getRecordsForInfluencer(index, jobIds, [], threshold, earliestMs, latestMs, maxResults);
  };

  // Queries Elasticsearch to obtain the record level results matching the given criteria,
  // for the specified job(s), time range, and record score threshold.
  // criteriaFields parameter must be an array, with each object in the array having 'fieldName'
  // 'fieldValue' properties.
  // Pass an empty array or ['*'] to search over all job IDs.
  this.getRecordsForCriteria = function (index, jobIds, criteriaFields, threshold, earliestMs, latestMs, maxResults) {
    const deferred = $q.defer();
    const obj = { success: true, records: [] };

    // Build the criteria to use in the bool filter part of the request.
    // Add criteria for the time range, record score, plus any specified job IDs.
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
          'gte': threshold,
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
          'analyze_wildcard':false,
          'query':jobIdFilterStr
        }
      });
    }

    // Add in term queries for each of the specified criteria.
    _.each(criteriaFields, (criteria) => {
      const condition = { 'term': {} };
      condition.term[criteria.fieldName] = criteria.fieldValue;
      boolCriteria.push(condition);
    });

    es.search({
      index: index,
      size: maxResults !== undefined ? maxResults : 100,
      body: {
        'query': {
          'bool': {
            'filter': [
              {
                'query_string': {
                  'query': 'result_type:record',
                  'analyze_wildcard': false
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
      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };


  // Queries Elasticsearch to obtain metric aggregation results.
  // index can be a String, or String[], of index names to search.
  // types smust be a String[] of types to search.
  // entityFields parameter must be an array, with each object in the array having 'fieldName'
  //  and 'fieldValue' properties.
  // Extra query object can be supplied, or pass null if no additional query
  // to that built from the supplied entity fields.
  // Returned response contains a results property containing the requested aggregation.
  this.getMetricData = function (index, types, entityFields, query,
    metricFunction, metricFieldName, timeFieldName, earliestMs, latestMs, interval) {
    const deferred = $q.defer();
    const obj = { success: true, results: {} };

    // Build the criteria to use in the bool filter part of the request.
    // Add criteria for the types, time range, entity fields,
    // plus any additional supplied query.
    const mustCriteria = [];
    const shouldCriteria = [];

    mustCriteria.push({ 'terms' : { '_type' : types } });

    const timeRangeCriteria = { 'range':{} };
    timeRangeCriteria.range[timeFieldName] = {
      'gte': earliestMs,
      'lte': latestMs,
      'format': 'epoch_millis'
    };
    mustCriteria.push(timeRangeCriteria);

    if (query) {
      mustCriteria.push(query);
    }

    _.each(entityFields, (entity) => {
      if (entity.fieldValue.length !== 0) {
        // Add a query string query for each entity field, wrapping the value
        // in quotes to do a phrase match. This is the best approach when the
        // field in the source data could be mapped as text or keyword.
        // a term query could only be used if we knew it was mapped as keyword.
        mustCriteria.push({
          'query_string': {
            'query': escapeForElasticsearchQuery(entity.fieldName) + ':\"' + entity.fieldValue + '\"',
            'analyze_wildcard': false
          }
        });
      } else {
        // Add special handling for blank entity field values, checking for either
        // an empty string or the field not existing.
        const emptyFieldCondition = {
          'bool':{
            'must':[
              {
                'term':{
                }
              }
            ]
          }
        };
        emptyFieldCondition.bool.must[0].term[entity.fieldName] = '';
        shouldCriteria.push(emptyFieldCondition);
        shouldCriteria.push({
          'bool':{
            'must_not': [
              {
                'exists' : { 'field' : entity.fieldName }
              }
            ]
          }
        });
      }

    });

    const searchBody = {
      'query': {
        'bool': {
          'must': mustCriteria
        }
      },
      'size': 0,
      '_source': {
        'excludes': []
      },
      'aggs': {
        'byTime': {
          'date_histogram': {
            'field': timeFieldName,
            'interval': interval,
            'min_doc_count': 1
          }

        }
      }
    };

    if (shouldCriteria.length > 0) {
      searchBody.query.bool.should = shouldCriteria;
      searchBody.query.bool.minimum_should_match = shouldCriteria.length / 2;
    }

    if (metricFieldName !== undefined) {
      searchBody.aggs.byTime.aggs = {};

      const metricAgg = {};
      metricAgg[metricFunction] = { 'field': metricFieldName };
      searchBody.aggs.byTime.aggs.metric = metricAgg;
    }

    es.search({
      index: index,
      body: searchBody
    })
    .then((resp) => {
      const dataByTime = _.get(resp, ['aggregations', 'byTime', 'buckets'], []);
      _.each(dataByTime, (dataForTime) => {
        if (metricFunction === 'count') {
          obj.results[dataForTime.key] = dataForTime.doc_count;
        } else {
          const value = _.get(dataForTime, ['metric', 'value']);
          if (value !== undefined) {
            obj.results[dataForTime.key] = value;
          }
        }
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

});
