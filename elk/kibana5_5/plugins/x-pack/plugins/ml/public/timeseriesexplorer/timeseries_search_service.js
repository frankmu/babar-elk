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

import { isModelPlotEnabled } from 'plugins/ml/util/job_utils';
import { buildConfigFromDetector } from 'plugins/ml/util/chart_config_builder';
import { escapeForElasticsearchQuery } from 'plugins/ml/util/string_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.service('mlTimeSeriesSearchService', function ($q, $timeout, es, mlResultsService) {

  const ML_RESULTS_INDEX_ID = '.ml-anomalies-*';

  this.getMetricData = function (job, detectorIndex, entityFields, earliestMs, latestMs, interval) {
    // For now only use model plot data if there is only one detector.
    // TODO - expand to multiple detectors by mapping detectorIndex to model_plot model_feature field.
    if (isModelPlotEnabled(job) && job.analysis_config.detectors.length === 1) {
      // Extract the partition, by, over fields on which to filter.
      const criteriaFields = [];
      const detector = job.analysis_config.detectors[detectorIndex];
      if (_.has(detector, 'partition_field_name')) {
        const partitionEntity = _.find(entityFields, { 'fieldName': detector.partition_field_name });
        if (partitionEntity !== undefined) {
          criteriaFields.push(
            { fieldName: 'partition_field_name', fieldValue: partitionEntity.fieldName },
            { fieldName: 'partition_field_value', fieldValue: partitionEntity.fieldValue });
        }
      }

      if (_.has(detector, 'over_field_name')) {
        const overEntity = _.find(entityFields, { 'fieldName': detector.over_field_name });
        if (overEntity !== undefined) {
          criteriaFields.push(
            { fieldName: 'over_field_name', fieldValue: overEntity.fieldName },
            { fieldName: 'over_field_value', fieldValue: overEntity.fieldValue });
        }
      }

      if (_.has(detector, 'by_field_name')) {
        const byEntity = _.find(entityFields, { 'fieldName': detector.by_field_name });
        if (byEntity !== undefined) {
          criteriaFields.push(
            { fieldName: 'by_field_name', fieldValue: byEntity.fieldName },
            { fieldName: 'by_field_value', fieldValue: byEntity.fieldValue });
        }
      }

      return this.getModelPlotOutput(job.job_id, criteriaFields, earliestMs, latestMs, interval);
    } else {
      const deferred = $q.defer();
      const obj = {
        success: true,
        results: {}
      };

      const chartConfig = buildConfigFromDetector(job, detectorIndex);

      mlResultsService.getMetricData(chartConfig.datafeedConfig.indices,
        chartConfig.datafeedConfig.types, entityFields, chartConfig.datafeedConfig.query,
        chartConfig.metricFunction, chartConfig.metricFieldName, chartConfig.timeField,
        earliestMs, latestMs, interval
        )
      .then((resp) => {
        _.each(resp.results, (value, time) => {
          obj.results[time] = {
            'actual': value
          };
        });

        deferred.resolve(obj);
      })
      .catch((resp) => {
        deferred.reject(resp);
      });

      return deferred.promise;
    }

  };

  this.getModelPlotOutput = function (jobId, criteriaFields, earliestMs, latestMs, interval) {
    const deferred = $q.defer();
    const obj = {
      success: true,
      results: {}
    };

    // Build the criteria to use in the bool filter part of the request.
    // Add criteria for the job ID and time range.
    const boolCriteria = [];
    boolCriteria.push({
      'term' : { 'job_id' : jobId }
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

    // Add in term queries for each of the specified criteria.
    _.each(criteriaFields, (criteria) => {
      const condition = { 'term': {} };
      condition.term[criteria.fieldName] = criteria.fieldValue;
      boolCriteria.push(condition);
    });

    es.search({
      index: ML_RESULTS_INDEX_ID,
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': [{
              'query_string': {
                'query': 'result_type:model_plot',
                'analyze_wildcard': true
              }
            }, {
              'bool': {
                'must': boolCriteria
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
                'max': {
                  'field': 'model_upper'
                }
              },
              'modelLower': {
                'min': {
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
        obj.results[time] = {
          'actual': _.get(dataForTime, ['actual', 'value']),
          'modelUpper': _.get(dataForTime, ['modelUpper', 'value']),
          'modelLower': _.get(dataForTime, ['modelLower', 'value'])
        };
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });

    return deferred.promise;
  };

  // Queries Elasticsearch to obtain the max record score over time for the specified job,
  // criteria, time range, and aggregation interval.
  // criteriaFields parameter must be an array, with each object in the array having 'fieldName'
  // 'fieldValue' properties.
  this.getRecordMaxScoreByTime = function (jobId, criteriaFields, earliestMs, latestMs, interval) {
    const deferred = $q.defer();
    const obj = {
      success: true,
      results: {}
    };

    // Build the criteria to use in the bool filter part of the request.
    const mustCriteria = [];
    const shouldCriteria = [];
    mustCriteria.push({
      'range': {
        'timestamp': {
          'gte': earliestMs,
          'lte': latestMs,
          'format': 'epoch_millis'
        }
      }
    });

    mustCriteria.push({ 'term': { 'job_id': jobId } });

    _.each(criteriaFields, (criteria) => {
      if (criteria.fieldValue.length !== 0) {
        // Add a query string query for each entity field, wrapping the value
        // in quotes to do a phrase match. This is the best approach when the
        // field in the source data could be mapped as text or keyword.
        // a term query could only be used if we knew it was mapped as keyword.
        mustCriteria.push({
          'query_string': {
            'query': escapeForElasticsearchQuery(criteria.fieldName) + ':\"' + criteria.fieldValue + '\"',
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
        emptyFieldCondition.bool.must[0].term[criteria.fieldName] = '';
        shouldCriteria.push(emptyFieldCondition);
        shouldCriteria.push({
          'bool':{
            'must_not': [
              {
                'exists' : { 'field' : criteria.fieldName }
              }
            ]
          }
        });
      }

    });

    es.search({
      index: ML_RESULTS_INDEX_ID,
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': [{
              'query_string': {
                'query': 'result_type:record',
                'analyze_wildcard': true
              }
            }, {
              'bool': {
                'must': mustCriteria
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
              'recordScore': {
                'max': {
                  'field': 'record_score'
                }
              }
            }
          }
        }
      }
    })
    .then((resp) => {
      console.log('Time series search service getRecordMaxScoreByTime() resp:', resp);

      const aggregationsByTime = _.get(resp, ['aggregations', 'times', 'buckets'], []);
      _.each(aggregationsByTime, (dataForTime) => {
        const time = dataForTime.key;
        obj.results[time] = {
          'score': _.get(dataForTime, ['recordScore', 'value']),
        };
      });

      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  // Builds chart detail information (charting function description and entity counts) used
  // in the title area of the time series chart.
  // Queries Elasticsearch if necessary to obtain the distinct count of entities
  // for which data is being plotted.
  this.getChartDetails = function (job, detectorIndex, entityFields, earliestMs, latestMs) {
    const deferred = $q.defer();
    const obj = { success: true, results:{ functionLabel: '', entityData: { entities: [] } } };

    const chartConfig = buildConfigFromDetector(job, detectorIndex);
    let functionLabel = chartConfig.metricFunction;
    if (chartConfig.metricFieldName !== undefined) {
      functionLabel += ' ';
      functionLabel += chartConfig.metricFieldName;
    }
    obj.results.functionLabel = functionLabel;

    // Build the aggregations for any blank entityField objects with blank values
    // so we can obtain the number of distinct entity values over the specified time.
    const aggs = {};
    _.each(entityFields, (entity) => {
      if (entity.fieldValue.length === 0) {
        aggs[entity.fieldName] = { 'cardinality' : { 'field': entity.fieldName } };
      }
    });

    if (_.keys(aggs).length === 0) {
      obj.results.entityData.count = 1;
      obj.results.entityData.entities = entityFields;
      deferred.resolve(obj);
    } else {
      // Build the criteria to use in the bool filter part of the request.
      // Add criteria for the time range and the datafeed config query.
      const mustCriteria = [];
      mustCriteria.push(chartConfig.datafeedConfig.query);

      const timeRangeCriteria = { 'range':{} };
      timeRangeCriteria.range[chartConfig.timeField] = {
        'gte': earliestMs,
        'lte': latestMs,
        'format': 'epoch_millis'
      };
      mustCriteria.push(timeRangeCriteria);

      mustCriteria.push({ 'terms' : { '_type' : chartConfig.datafeedConfig.types } });

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
        'aggs': aggs
      };

      es.search({
        index: chartConfig.datafeedConfig.indices,
        body: searchBody
      })
      .then((resp) => {
        const aggregations = resp.aggregations;
        const entityFieldNames = _.keys(aggs);
        _.each(entityFieldNames, (fieldName) => {
          obj.results.entityData.entities.push({ fieldName: fieldName, count: aggregations[fieldName].value });
        });

        deferred.resolve(obj);
      })
      .catch((resp) => {
        deferred.reject(resp);
      });
    }

    return deferred.promise;
  };


});
