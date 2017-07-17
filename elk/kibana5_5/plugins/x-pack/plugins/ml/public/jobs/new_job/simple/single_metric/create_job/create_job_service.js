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
import angular from 'angular';
import 'ui/timefilter';

import { parseInterval } from 'ui/utils/parse_interval';

import { calculateDatafeedFrequencyDefaultSeconds } from 'plugins/ml/util/job_utils';
import { calculateTextWidth } from 'plugins/ml/util/string_utils';
import { getQueryFromSavedSearch } from 'plugins/ml/jobs/new_job/simple/components/utils/simple_job_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.service('mlSingleMetricJobService', function (
  $q,
  es,
  timefilter,
  Private,
  mlJobService,
  mlSingleMetricJobSearchService) {

  this.chartData = {
    line: [],
    model: [],
    swimlane: [],
    hasBounds: false,
    percentComplete: 0,
    loadingDiffernce: 0,
    highestValue: 0,
    chartTicksMargin: { width: 30 }
  };
  this.job = {};

  this.getLineChartResults = function (formConfig) {
    const deferred = $q.defer();

    this.chartData.line = [];
    this.chartData.model = [];
    this.chartData.swimlane = [];
    this.chartData.hasBounds = false;
    this.chartData.percentComplete = 0;
    this.chartData.loadingDifference = 0;
    this.chartData.eventRateHighestValue = 0;

    const obj = {
      success: true,
      results: {}
    };

    const searchJson = getSearchJsonFromConfig(formConfig);

    es.search(searchJson)
    .then((resp) => {

      const aggregationsByTime = _.get(resp, ['aggregations', 'times', 'buckets'], []);
      let highestValue = 0;

      _.each(aggregationsByTime, (dataForTime) => {
        const time = dataForTime.key;
        let value = _.get(dataForTime, ['field_value', 'value']);
        if (value === undefined && formConfig.field === null) {
          value = dataForTime.doc_count;
        }
        if (!isFinite(value)) {
          value = 0;
        }
        if (value > highestValue) {
          highestValue = value;
        }

        obj.results[time] = {
          actual: value,
        };
      });

      this.chartData.line = processLineChartResults(obj.results);

      this.chartData.highestValue = Math.ceil(highestValue);
      this.chartData.chartTicksMargin.width = calculateTextWidth(this.chartData.highestValue, true);

      deferred.resolve(this.chartData.line);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });

    return deferred.promise;
  };

  function processLineChartResults(data, formConfig) {
    // for count, scale the model upper and lower by the
    // ratio of chart interval to bucketspan.
    // this will force the model bounds to be drawn in the correct location
    let scale = 1;
    if (formConfig &&
      (formConfig.agg.type.mlName === 'count' ||
      formConfig.agg.type.mlName === 'high_count' ||
      formConfig.agg.type.mlName === 'low_count' ||
      formConfig.agg.type.mlName === 'distinct_count')) {
      const chartIntervalSeconds = formConfig.chartInterval.getInterval().asSeconds();
      const bucketSpan = parseInterval(formConfig.bucketSpan);
      if (bucketSpan !== null) {
        scale =  chartIntervalSeconds / bucketSpan.asSeconds();
      }
    }

    const lineData = [];
    _.each(data, (dataForTime, t) => {
      const time = +t;
      const date = new Date(time);
      lineData.push({
        date: date,
        time: time,
        lower: (dataForTime.modelLower * scale),
        value: dataForTime.actual,
        upper: (dataForTime.modelUpper * scale)
      });
    });

    return lineData;
  }

  function processSwimlaneResults(bucketScoreData, init) {
    // create a dataset in format used by the model plot chart.
    // create empty swimlane dataset
    // i.e. array of Objects with keys date (JavaScript date), value, lower and upper.
    const swimlaneData = [];
    _.each(bucketScoreData, (dataForTime, t) => {
      const time = +t;
      const date = new Date(time);
      swimlaneData.push({
        date: date,
        time: time,
        value: init ? 0 : dataForTime.anomalyScore,
        color: ''
      });
    });
    return swimlaneData;
  }

  function getSearchJsonFromConfig(formConfig) {
    const interval = formConfig.chartInterval.getInterval().asMilliseconds() + 'ms';
    const query = getQueryFromSavedSearch(formConfig);

    const json = {
      'index': formConfig.indexPattern.id,
      'size': 0,
      'body': {
        'query': {},
        'aggs': {
          'times': {
            'date_histogram': {
              'field': formConfig.timeField,
              'interval': interval,
              'min_doc_count': 1
            }
          }
        }
      }
    };

    query.bool.must.push({
      'range': {
        [formConfig.timeField]: {
          'gte': formConfig.start,
          'lte': formConfig.end,
          'format': formConfig.format
        }
      }
    });

    json.body.query = query;

    if (formConfig.field !== null) {
      json.body.aggs.times.aggs = {
        'field_value':{
          [formConfig.agg.type.name]: { field: formConfig.field.name }
        }
      };
    }

    return json;
  }

  function getJobFromConfig(formConfig) {
    const mappingTypes = formConfig.mappingTypes;

    const job = mlJobService.getBlankJob();
    job.data_description.time_field = formConfig.timeField;

    let func = formConfig.agg.type.mlName;
    if (formConfig.isSparseData) {
      if (formConfig.agg.type.name === 'count') {
        func = func.replace(/count/, 'non_zero_count');
      } else if(formConfig.agg.type.name === 'sum') {
        func = func.replace(/sum/, 'non_null_sum');
      }
    }
    const dtr = {
      function: func
    };

    let query = {
      match_all: {}
    };
    if (formConfig.query.query_string.query !== '*' || formConfig.filters.length) {
      query = getQueryFromSavedSearch(formConfig);
    }

    if (formConfig.field && formConfig.field.id) {
      dtr.field_name = formConfig.field.id;
    }
    job.analysis_config.detectors.push(dtr);
    job.analysis_config.bucket_span = formConfig.bucketSpan;

    delete job.data_description.field_delimiter;
    delete job.data_description.quote_character;
    delete job.data_description.time_format;
    delete job.data_description.format;

    const bucketSpanSeconds = parseInterval(formConfig.bucketSpan).asSeconds();

    job.datafeed_config = {
      query: query,
      types: mappingTypes,
      query_delay: '60s',
      frequency: calculateDatafeedFrequencyDefaultSeconds(bucketSpanSeconds) + 's',
      indices: [formConfig.indexPattern.id],
      scroll_size: 1000
    };

    job.job_id = formConfig.jobId;
    job.description = formConfig.description;

    job.model_plot_config =  {
      enabled: true
    };

    if (formConfig.useDedicatedIndex) {
      job.results_index_name = job.job_id;
    }

    // Use the original es agg type rather than the ML version
    // e.g. count rather than high_count
    const aggType = formConfig.agg.type.name;
    const interval = bucketSpanSeconds * 1000;

    switch (aggType) {
      case 'count':
        job.analysis_config.summary_count_field_name = 'doc_count';

        job.datafeed_config.aggregations = {
          buckets: {
            date_histogram: {
              field: formConfig.timeField,
              interval: interval
            },
            aggregations: {
              [formConfig.timeField]: {
                max: {
                  field: formConfig.timeField
                }
              }
            }
          }
        };
        break;
      case 'avg':
      case 'sum':
      case 'min':
      case 'max':
        job.analysis_config.summary_count_field_name = 'doc_count';

        job.datafeed_config.aggregations = {
          buckets: {
            date_histogram: {
              field: formConfig.timeField,
              interval: ((interval / 100) * 10) // use 10% of bucketSpan to allow for better sampling
            },
            aggregations: {
              [dtr.field_name]: {
                [aggType]: {
                  field: formConfig.field.name
                }
              },
              [formConfig.timeField]: {
                max: {
                  field: formConfig.timeField
                }
              }
            }
          }
        };
        break;
      case 'cardinality':
        job.analysis_config.summary_count_field_name = 'dc_' + dtr.field_name;

        job.datafeed_config.aggregations = {
          buckets: {
            date_histogram: {
              field: formConfig.timeField,
              interval: interval
            },
            aggregations: {
              [formConfig.timeField]: {
                max: {
                  field: formConfig.timeField
                }
              },
              [job.analysis_config.summary_count_field_name]: {
                [aggType]: {
                  field: formConfig.field.name
                }
              }
            }
          }
        };

        // finally, modify the detector before saving
        dtr.function = 'non_zero_count';
        // add a description using the original function name rather 'non_zero_count'
        // as the user may not be aware it's been changed
        dtr.detector_description = `${func} (${dtr.field_name})`;
        delete dtr.field_name;

        break;
      default:
        break;
    }

    console.log('auto created job: ', job);

    return job;
  }

  function createJobForSaving(job) {
    const newJob = angular.copy(job);
    delete newJob.datafeed_config;
    return newJob;
  }

  this.createJob = function (formConfig) {
    const deferred = $q.defer();

    this.job = getJobFromConfig(formConfig);
    const job = createJobForSaving(this.job);

    // DO THE SAVE
    mlJobService.saveNewJob(job)
    .then((resp) => {
      if (resp.success) {
        deferred.resolve(this.job);
      } else {
        deferred.reject(resp);
      }
    });

    return deferred.promise;
  };

  this.startDatafeed = function (formConfig) {
    const datafeedId = mlJobService.getDatafeedId(formConfig.jobId);
    return mlJobService.startDatafeed(datafeedId, formConfig.jobId, formConfig.start, formConfig.end);
  };

  this.stopDatafeed = function (formConfig) {
    const datafeedId = mlJobService.getDatafeedId(formConfig.jobId);
    return mlJobService.stopDatafeed(datafeedId, formConfig.jobId);
  };

  this.checkDatafeedState = function (formConfig) {
    return mlJobService.updateSingleJobDatafeedState(formConfig.jobId);
  };

  this.loadModelData = function (formConfig) {
    const deferred = $q.defer();

    let start = formConfig.start;

    if (this.chartData.model.length > 5) {
      // only load the model since the end of the last time we checked
      // but discard the last 5 buckets in case the model has changed
      start = this.chartData.model[this.chartData.model.length - 5].time;
      for (let i = 0; i < 5; i++) {
        this.chartData.model.pop();
      }
    }

    mlSingleMetricJobSearchService.getModelPlotOutput(
      formConfig.indexPattern.id,
      formConfig.jobId,
      start,
      formConfig.end,
      formConfig.resultsIntervalSeconds + 's',
      formConfig.agg.type.mlModelPlotAgg
    )
    .then(data => {
      this.chartData.model = this.chartData.model.concat(processLineChartResults(data.results, formConfig));

      const lastBucket = this.chartData.model[this.chartData.model.length - 1];
      const time = (lastBucket !== undefined) ? lastBucket.time : formConfig.start;

      const pcnt = ((time -  formConfig.start + formConfig.resultsIntervalSeconds) / (formConfig.end - formConfig.start) * 100);
      this.chartData.percentComplete = Math.round(pcnt);

      deferred.resolve(this.chartData);
    })
    .catch(() => {
      deferred.reject(this.chartData);
    });

    return deferred.promise;
  };

  this.loadSwimlaneData = function (formConfig) {
    const deferred = $q.defer();

    mlSingleMetricJobSearchService.getScoresByBucket(
      formConfig.indexPattern.id,
      formConfig.jobId,
      formConfig.start,
      formConfig.end,
      formConfig.resultsIntervalSeconds + 's'
    )
    .then(data => {
      this.chartData.swimlane = processSwimlaneResults(data.results);
      this.chartData.swimlaneInterval = formConfig.resultsIntervalSeconds * 1000;
      deferred.resolve(this.chartData);
    })
    .catch(() => {
      deferred.resolve(this.chartData);
    });

    return deferred.promise;
  };

  this.indexTimeRange = function (indexPattern, query) {
    const deferred = $q.defer();
    const obj = { success: true, start: { epoch:0, string:'' }, end: { epoch:0, string:'' } };

    es.search({
      index: indexPattern.id,
      size: 0,
      body: {
        query,
        aggs: {
          earliest: {
            min: {
              field: indexPattern.timeFieldName
            }
          },
          latest: {
            max: {
              field: indexPattern.timeFieldName
            }
          }
        }
      }
    })
    .then((resp) => {
      if (resp.aggregations && resp.aggregations.earliest && resp.aggregations.latest) {
        obj.start.epoch = resp.aggregations.earliest.value;
        obj.start.string = resp.aggregations.earliest.value_as_string;

        obj.end.epoch = resp.aggregations.latest.value;
        obj.end.string = resp.aggregations.latest.value_as_string;
      }
      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });

    return deferred.promise;
  };
});
