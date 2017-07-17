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
import moment from 'moment';

import { parseInterval } from 'ui/utils/parse_interval';

import { labelDuplicateDetectorDescriptions } from 'plugins/ml/util/anomaly_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.service('mlJobService', function ($rootScope, $http, $q, es, ml, mlMessageBarService) {
  const msgs = mlMessageBarService;
  let jobs = [];
  let datafeedIds = {};
  this.currentJob = undefined;
  this.jobs = [];

  // Provide ready access to widely used basic job properties.
  // Note these get populated on a call to either loadJobs or getBasicJobInfo.
  this.basicJobs = {};
  this.jobDescriptions = {};
  this.detectorsByJob = {};
  this.customUrlsByJob = {};
  this.jobStats = {
    activeNodes: { label: 'Active ML Nodes', value: 0, show: true },
    total: { label: 'Total jobs', value: 0, show: true },
    open: { label: 'Open jobs', value: 0, show: true },
    closed: { label: 'Closed jobs', value: 0, show: true },
    failed: { label: 'Failed jobs', value: 0, show: false },
    activeDatafeeds: { label: 'Active datafeeds', value: 0, show: true }
  };
  this.jobUrls = {};

  // private function used to check the job saving response
  function checkSaveResponse(resp, origJob) {
    if (resp) {
      if (resp.job_id) {
        if (resp.job_id === origJob.job_id) {
          console.log('checkSaveResponse(): save successful');
          return true;
        }
      } else {
        if (resp.errorCode) {
          console.log('checkSaveResponse(): save failed', resp);
          return false;
        }
      }
    } else {
      console.log('checkSaveResponse(): response is empty');
      return false;
    }
  }

  this.getBlankJob = function () {
    return {
      job_id: '',
      description: '',
      analysis_config: {
        bucket_span: '5m',
        influencers:[],
        detectors :[]
      },
      data_description : {
        time_field:      '',
        time_format:     '', // 'epoch',
        field_delimiter: '',
        quote_character: '"',
        format:         'delimited'
      }
    };
  };

  this.loadJobs = function () {
    const deferred = $q.defer();
    jobs = [];
    datafeedIds = {};

    ml.jobs()
      .then((resp) => {
        console.log('loadJobs query response:', resp);

        // make deep copy of jobs
        angular.copy(resp.jobs, jobs);

        // load jobs stats
        ml.jobStats()
          .then((statsResp) => {
            // merge jobs stats into jobs
            for (let i = 0; i < jobs.length; i++) {
              const job = jobs[i];
              // create empty placeholders for stats and datafeed objects
              job.data_counts = {};
              job.model_size_stats = {};
              job.datafeed_config = {};

              for (let j = 0; j < statsResp.jobs.length; j++) {
                if (job.job_id === statsResp.jobs[j].job_id) {
                  const jobStats = angular.copy(statsResp.jobs[j]);

                  job.state = jobStats.state;
                  job.data_counts = jobStats.data_counts;
                  job.model_size_stats = jobStats.model_size_stats;
                  if (jobStats.node) {
                    job.node = jobStats.node;
                  }
                  if (jobStats.open_time) {
                    job.open_time = jobStats.open_time;
                  }
                }
              }
            }
            this.loadDatafeeds()
            .then((datafeedsResp) => {
              for (let i = 0; i < jobs.length; i++) {
                for (let j = 0; j < datafeedsResp.datafeeds.length; j++) {
                  if (jobs[i].job_id === datafeedsResp.datafeeds[j].job_id) {
                    jobs[i].datafeed_config = datafeedsResp.datafeeds[j];

                    datafeedIds[jobs[i].job_id] = datafeedsResp.datafeeds[j].datafeed_id;
                  }
                }
              }
              processBasicJobInfo(this, jobs);
              this.jobs = jobs;
              createJobStats(this.jobs, this.jobStats);
              createJobUrls(this.jobs, this.jobUrls);
              deferred.resolve({ jobs: this.jobs });
            });
          })
          .catch((err) => {
            error(err);
          });
      }).catch((err) => {
        error(err);
      });

    function error(err) {
      console.log('MlJobsList error getting list of jobs:', err);
      msgs.error('Jobs list could not be retrieved');
      msgs.error('', err);
      deferred.reject({ jobs, err });
    }
    return deferred.promise;
  };

  this.refreshJob = function (jobId) {
    const deferred = $q.defer();
    ml.jobs({ jobId })
      .then((resp) => {
        console.log('refreshJob query response:', resp);
        const newJob = {};
        if (resp.jobs && resp.jobs.length) {
          angular.copy(resp.jobs[0], newJob);

          // load jobs stats
          ml.jobStats({ jobId })
            .then((statsResp) => {
              // merge jobs stats into jobs
              for (let j = 0; j < statsResp.jobs.length; j++) {
                if (newJob.job_id === statsResp.jobs[j].job_id) {
                  const statsJob = statsResp.jobs[j];
                  newJob.state = statsJob.state;
                  newJob.data_counts = {};
                  newJob.model_size_stats = {};
                  angular.copy(statsJob.data_counts, newJob.data_counts);
                  angular.copy(statsJob.model_size_stats, newJob.model_size_stats);
                  if (newJob.node) {
                    angular.copy(statsJob.node, newJob.node);
                  }

                  if (statsJob.open_time) {
                    newJob.open_time = statsJob.open_time;
                  }
                }
              }

              // replace the job in the jobs array
              for (let i = 0; i < jobs.length; i++) {
                if (jobs[i].job_id === newJob.job_id) {
                  jobs[i] = newJob;
                }
              }

              const datafeedId = this.getDatafeedId(jobId);

              this.loadDatafeeds(datafeedId)
              .then((datafeedsResp) => {
                for (let i = 0; i < jobs.length; i++) {
                  for (let j = 0; j < datafeedsResp.datafeeds.length; j++) {
                    if (jobs[i].job_id === datafeedsResp.datafeeds[j].job_id) {
                      jobs[i].datafeed_config = datafeedsResp.datafeeds[j];

                      datafeedIds[jobs[i].job_id] = datafeedsResp.datafeeds[j].datafeed_id;
                    }
                  }
                }
                this.jobs = jobs;
                createJobStats(this.jobs, this.jobStats);
                createJobUrls(this.jobs, this.jobUrls);
                deferred.resolve({ jobs: this.jobs });
              });
            })
            .catch((err) => {
              error(err);
            });
        }
      }).catch((err) => {
        error(err);
      });

    function error(err) {
      console.log('MlJobsList error getting list of jobs:', err);
      msgs.error('Jobs list could not be retrieved');
      msgs.error('', err);
      deferred.reject({ jobs, err });
    }
    return deferred.promise;
  };

  this.loadDatafeeds = function (datafeedId) {
    const deferred = $q.defer();
    const datafeeds = [];
    const sId = (datafeedId !== undefined) ? { datafeed_id: datafeedId } : undefined;

    ml.datafeeds(sId)
      .then((resp) => {
        // console.log('loadDatafeeds query response:', resp);

        // make deep copy of datafeeds
        angular.copy(resp.datafeeds, datafeeds);

        // load datafeeds stats
        ml.datafeedStats()
          .then((statsResp) => {
            // merge datafeeds stats into datafeeds
            for (let i = 0; i < datafeeds.length; i++) {
              const datafeed = datafeeds[i];
              for (let j = 0; j < statsResp.datafeeds.length; j++) {
                if (datafeed.datafeed_id === statsResp.datafeeds[j].datafeed_id) {
                  datafeed.state = statsResp.datafeeds[j].state;
                }
              }
            }
            deferred.resolve({ datafeeds });
          })
          .catch((err) => {
            error(err);
          });
      }).catch((err) => {
        error(err);
      });

    function error(err) {
      console.log('loadDatafeeds error getting list of datafeeds:', err);
      msgs.error('datafeeds list could not be retrieved');
      msgs.error('', err);
      deferred.reject({ jobs, err });
    }
    return deferred.promise;
  };



  this.updateSingleJobCounts = function (jobId) {
    const deferred = $q.defer();
    console.log('mlJobService: update job counts and state for ' + jobId);
    ml.jobStats({ jobId })
      .then((resp) => {
        console.log('updateSingleJobCounts controller query response:', resp);
        if (resp.jobs && resp.jobs.length) {
          const newJob = {};
          angular.copy(resp.jobs[0], newJob);

          // replace the job in the jobs array
          for (let i = 0; i < jobs.length; i++) {
            if (jobs[i].job_id === jobId) {
              const job = jobs[i];
              job.state = newJob.state;
              job.data_counts = newJob.data_counts;
              if (newJob.model_size_stats) {
                job.model_size_stats = newJob.model_size_stats;
              }
              if (newJob.node) {
                job.node = newJob.node;
              }
              if (newJob.open_time) {
                job.open_time = newJob.open_time;
              }
            }
          }

          const datafeedId = this.getDatafeedId(jobId);

          this.loadDatafeeds(datafeedId)
          .then((datafeedsResp) => {
            for (let i = 0; i < jobs.length; i++) {
              for (let j = 0; j < datafeedsResp.datafeeds.length; j++) {
                if (jobs[i].job_id === datafeedsResp.datafeeds[j].job_id) {
                  jobs[i].datafeed_config = datafeedsResp.datafeeds[j];

                  datafeedIds[jobs[i].job_id] = datafeedsResp.datafeeds[j].datafeed_id;
                }
              }
            }
            createJobStats(this.jobs, this.jobStats);
            createJobUrls(this.jobs, this.jobUrls);
            deferred.resolve({ jobs: this.jobs });
          })
          .catch((err) => {
            error(err);
          });
        } else {
          deferred.resolve({ jobs: this.jobs });
        }

      }).catch((err) => {
        error(err);
      });

    function error(err) {
      console.log('updateSingleJobCounts error getting job details:', err);
      msgs.error('Job details could not be retrieved for ' + jobId);
      msgs.error('', err);
      deferred.reject({ jobs, err });
    }

    return deferred.promise;
  };

  this.updateAllJobCounts = function () {
    const deferred = $q.defer();
    console.log('mlJobService: update all jobs counts and state');
    ml.jobStats().then((resp) => {
      console.log('updateAllJobCounts controller query response:', resp);
      let newJobsAdded = false;
      for (let d = 0; d < resp.jobs.length; d++) {
        const newJob = {};
        let jobExists = false;
        angular.copy(resp.jobs[d], newJob);

        // update parts of the job
        for (let i = 0; i < jobs.length; i++) {
          const job = jobs[i];
          if (job.job_id === resp.jobs[d].job_id) {
            jobExists = true;
            job.state = newJob.state;
            job.data_counts = newJob.data_counts;
            if (newJob.model_size_stats) {
              job.model_size_stats = newJob.model_size_stats;
            }
            if (newJob.node) {
              job.node = newJob.node;
            }
            if (newJob.open_time) {
              job.open_time = newJob.open_time;
            }
          }
        }

        // a new job has been added, add it to the list
        if (!jobExists) {
          // add it to the same index position as it's found in jobs.
          jobs.splice(d, 0, newJob);
          newJobsAdded = true;
        }
      }

      this.loadDatafeeds()
        .then((datafeedsResp) => {
          for (let i = 0; i < jobs.length; i++) {
            for (let j = 0; j < datafeedsResp.datafeeds.length; j++) {
              if (jobs[i].job_id === datafeedsResp.datafeeds[j].job_id) {
                jobs[i].datafeed_config = datafeedsResp.datafeeds[j];

                datafeedIds[jobs[i].job_id] = datafeedsResp.datafeeds[j].datafeed_id;
              }
            }
          }
          this.jobs = jobs;

          // if after adding missing jobs, the retrieved number of jobs still differs from
          // the local copy, reload the whole list from scratch. some non-running jobs may have
          // been deleted by a different user.
          if (newJobsAdded || resp.jobs.length !== jobs.length) {
            console.log('updateAllJobCounts: number of jobs differs. reloading all jobs');
            this.loadJobs().then(() => {
              deferred.resolve({ jobs: this.jobs, listChanged: true });
            })
            .catch((err) => {
              error(err);
            });
          } else {
            createJobStats(this.jobs, this.jobStats);
            createJobUrls(this.jobs, this.jobUrls);
            deferred.resolve({ jobs: this.jobs, listChanged: false });
          }
        })
        .catch((err) => {
          error(err);
        });
    })
    .catch((err) => {
      error(err);
    });

    function error(err) {
      console.log('updateAllJobCounts error getting list job details:', err);
      msgs.error('Job details could not be retrieved');
      msgs.error('', err);
      deferred.reject({ jobs, err });
    }

    return deferred.promise;
  };

  this.checkState = function () {
    const runningJobs = [];
    _.each(jobs, (job) => {
      if (job.datafeed_config && job.datafeed_config.state === 'started') {
        runningJobs.push(job);
      }
    });

    console.log('mlJobService: check state for ' + runningJobs.length + ' running jobs');
    _.each(runningJobs, (job) => {
      this.updateSingleJobCounts(job.job_id);
    });
  };

  this.updateSingleJobDatafeedState = function (jobId) {
    const deferred = $q.defer();

    const datafeedId = this.getDatafeedId(jobId);

    ml.datafeedStats({ datafeedId })
    .then((resp) => {
      // console.log('updateSingleJobCounts controller query response:', resp);
      const datafeeds = resp.datafeeds;
      let state = 'UNKNOWN';
      if (datafeeds && datafeeds.length) {
        state = datafeeds[0].state;
      }
      deferred.resolve(state);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });

    return deferred.promise;
  };

  this.saveNewJob = function (job) {
    // run then and catch through the same check
    const func = function (resp) {
      console.log('Response for job query:', resp);
      const success = checkSaveResponse(resp, job);
      return { success, job, resp };
    };

    // return the promise chain
    return ml.addJob({ jobId: job.job_id, job })
      .then(func).catch(func);
  };

  this.deleteJob = function (job, statusIn) {
    const deferred = $q.defer();
    const status = statusIn || { deleteDatafeed: 0, deleteJob: 0, errorMessage: '' };

    // chain of endpoint calls to delete a job.
    // if job is datafeed, stop and delete datafeed first
    if (job.datafeed_config && Object.keys(job.datafeed_config).length) {
      const datafeedId = this.getDatafeedId(job.job_id);
      // stop datafeed
      ml.forceDeleteDatafeed({ datafeedId: datafeedId })
      .then(() => {
        status.deleteDatafeed = 1;
        deleteJob();
      })
      .catch((resp) => {
        status.deleteDatafeed = -1;
        status.deleteJob = -1;
        deleteFailed(resp, 'Delete datafeed');
      });
    } else {
      deleteJob();
    }

    function deleteJob() {
      ml.forceDeleteJob({ jobId: job.job_id })
      .then(() => {
        status.deleteJob = 1;
        deferred.resolve({ success: true });
      })
      .catch((resp) => {
        status.deleteJob = -1;
        deleteFailed(resp, 'Delete job');
      });
    }

    function deleteFailed(resp, txt) {
      if (resp.statusCode === 500) {
        status.errorMessage = txt;
      }
      deferred.reject({ success: false });
    }

    return deferred.promise;
  };

  this.cloneJob = function (job) {
    // create a deep copy of a job object
    // also remove items from the job which are set by the server and not needed
    // in the future this formatting could be optional
    const tempJob = angular.copy(job);

    // remove all of the items which should not be copied
    // such as counts, state and times
    delete tempJob.state;
    delete tempJob.job_version;
    delete tempJob.data_counts;
    delete tempJob.create_time;
    delete tempJob.finished_time;
    delete tempJob.last_data_time;
    delete tempJob.model_size_stats;
    delete tempJob.node;
    delete tempJob.average_bucket_processing_time_ms;
    delete tempJob.model_snapshot_id;
    delete tempJob.open_time;

    delete tempJob.data_description.time_format;
    delete tempJob.data_description.format;

    delete tempJob.analysis_config.use_per_partition_normalization;

    _.each(tempJob.analysis_config.detectors, (d) => {
      delete d.detector_index;
    });

    // remove parts of the datafeed config which should not be copied
    if (tempJob.datafeed_config) {
      delete tempJob.datafeed_config.datafeed_id;
      delete tempJob.datafeed_config.job_id;
      delete tempJob.datafeed_config.state;
      delete tempJob.datafeed_config.frequency;
    }

    return tempJob;
  };

  this.updateJob = function (jobId, job) {
    // return the promise chain
    return ml.updateJob({ jobId, job })
      .then((resp) => {
        console.log('update job', resp);
        return { success: true };
      }).catch((err) => {
        msgs.error('Could not update job: ' + jobId);
        console.log('update job', err);
        return { success: false, message: err.message };
      });
  };

  // find a job based on the id
  this.getJob = function (jobId) {
    const job = _.find(jobs, (j) => {
      return j.job_id === jobId;
    });

    return job;
  };

  // use elastic search to load the start and end timestamps
  // add them to our own promise object and return that rather than the search results object
  this.jobTimeRange = function (jobId) {
    const deferred = $q.defer();
    const obj = { success: true, start: { epoch:0, string:'' }, end: { epoch:0, string:'' } };

    es.search({
      index: '.ml-anomalies-' + jobId,
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
              }
            ]
          }
        },
        'aggs': {
          'earliest': {
            'min': {
              'field': 'timestamp'
            }
          },
          'latest': {
            'max': {
              'field': 'timestamp'
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

  // use elasticsearch to load basic information on jobs, as used by various result
  // dashboards in the Ml plugin. Returned response contains a jobs property,
  // which is an array of objects containing id, description, bucketSpanSeconds, detectors
  // and detectorDescriptions properties, plus a customUrls key if custom URLs
  // have been configured for the job.
  this.getBasicJobInfo = function () {
    const deferred = $q.defer();
    const obj = { success: true, jobs: [] };

    ml.jobs()
      .then((resp) => {
        if (resp.jobs && resp.jobs.length > 0) {
          obj.jobs = processBasicJobInfo(this, resp.jobs);
        }
        deferred.resolve(obj);
      })
      .catch((resp) => {
        console.log('getBasicJobInfo error getting list of jobs:', resp);
        deferred.reject(resp);
      });

    return deferred.promise;
  };

  // Obtains the list of fields by which record level results may be viewed for all
  // the jobs that have been created. Essentially this is the list of unique 'by',
  // 'over' and 'partition' fields that have been defined across all the detectors for
  // a job, although for detectors with both 'by' and 'over' fields, the 'by' field name
  // is not returned since this field is not added to the top-level record fields.
  // Returned response contains a fieldsByJob property, with job ID keys
  // against an array of the field names by which record type results may be viewed
  // for that job.
  // Contains an addition '*' key which holds an array of the
  // unique fields across all jobs.
  this.getJobViewByFields = function () {
    const deferred = $q.defer();
    const obj = { success: true, fieldsByJob: { '*':[] } };

    ml.jobs()
      .then(function (resp) {
        if (resp.jobs && resp.jobs.length > 0) {
          _.each(resp.jobs, (jobObj) => {
            // Add the list of distinct by, over and partition fields for each job.
            const fieldsForJob = [];

            const analysisConfig = jobObj.analysis_config;
            const detectors = analysisConfig.detectors || [];
            _.each(detectors, (detector) => {
              if (_.has(detector, 'partition_field_name')) {
                fieldsForJob.push(detector.partition_field_name);
              }
              if (_.has(detector, 'over_field_name')) {
                fieldsForJob.push(detector.over_field_name);
              }
              // For jobs with by and over fields, don't add the 'by' field as this
              // field will only be added to the top-level fields for record type results
              // if it also an influencer over the bucket.
              if (_.has(detector, 'by_field_name') && !(_.has(detector, 'over_field_name'))) {
                fieldsForJob.push(detector.by_field_name);
              }
            });

            obj.fieldsByJob[jobObj.job_id] = _.uniq(fieldsForJob);
            obj.fieldsByJob['*'] = _.union(obj.fieldsByJob['*'], obj.fieldsByJob[jobObj.job_id]);
          });

          // Sort fields alphabetically.
          _.each(obj.fieldsByJob, (fields, jobId)=> {
            obj.fieldsByJob[jobId] = _.sortBy(fields, (field) => {
              return field.toLowerCase();
            });
          });
        }

        deferred.resolve(obj);

      })
      .catch((resp) => {
        console.log('getJobViewByFields error getting list of viewBy fields:', resp);
        deferred.reject(resp);
      });

    return deferred.promise;
  };

  // use elasticsearch to obtain the definition of the category with the
  // specified ID from the given index and job ID.
  // Returned response contains four properties - categoryId, regex, examples
  // and terms (space delimited String of the common tokens matched in values of the category).
  this.getCategoryDefinition = function (index, jobId, categoryId) {
    const deferred = $q.defer();
    const obj = { success: true, categoryId: categoryId, terms: null, regex: null, examples: [] };


    es.search({
      index: index,
      size: 1,
      body: {
        'query': {
          'bool': {
            'filter': [
              { 'term': { 'job_id': jobId } },
              { 'term': { 'category_id': categoryId } }
            ]
          }
        }
      }
    })
    .then((resp) => {
      if (resp.hits.total !== 0) {
        const source = _.first(resp.hits.hits)._source;
        obj.categoryId = source.category_id;
        obj.regex = source.regex;
        obj.terms = source.terms;
        obj.examples = source.examples;
      }
      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  // use elastic search to load the datafeed state data
  // endTimeMillis is used to prepopulate the datafeed start modal
  // when a job has previously been set up with an end time
  this.jobDatafeedState = function (jobId) {
    const deferred = $q.defer();
    const obj = { startTimeMillis:null, endTimeMillis:null };

    es.search({
      index: '.ml-anomalies-' + jobId,
      size: 1,
      body: {
        'query': {
          'bool': {
            'filter': [
              {
                'type': {
                  'value': 'datafeedState'
                }
              }
            ]
          }
        },
        '_source': ['endTimeMillis', 'startTimeMillis']
      }
    })
    .then((resp) => {
      if (resp.hits.total !== 0) {
        _.each(resp.hits.hits, (hit)=> {
          const _source = hit._source;

          if (_.has(_source, 'startTimeMillis')) {
            obj.startTimeMillis = _source.startTimeMillis[0];
          }

          if (_.has(_source, 'endTimeMillis')) {
            obj.endTimeMillis = _source.endTimeMillis[0];
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

  // search for audit messages, jobId is optional.
  // without it, all jobs will be listed.
  // fromRange should be a string formatted in ES time units. e.g. 12h, 1d, 7d
  this.getJobAuditMessages = function (fromRange, jobId) {
    const deferred = $q.defer();
    const messages = [];

    let jobFilter = {};
    // if no jobId specified, load all of the messages
    if (jobId !== undefined) {
      jobFilter = {
        'bool': {
          'should': [
            {
              'term': {
                'job_id': '' // catch system messages
              }
            },
            {
              'term': {
                'job_id': jobId // messages for specified jobId
              }
            }
          ]
        }
      };
    }

    let timeFilter = {};
    if (fromRange !== undefined && fromRange !== '') {
      timeFilter = {
        'range': {
          'timestamp': {
            'gte': 'now-' + fromRange,
            'lte': 'now'
          }
        }
      };
    }

    es.search({
      index: '.ml-notifications',
      ignore_unavailable: true,
      size: 1000,
      body:
      {
        sort : [
          { 'timestamp' : { 'order' : 'asc' } },
          { 'job_id' : { 'order' : 'asc' } }
        ],
        'query': {
          'bool': {
            'filter': [
              {
                'bool': {
                  'must_not': {
                    'term': {
                      'level': 'activity'
                    }
                  }
                }
              },
              jobFilter,
              timeFilter
            ]
          }
        }
      }
    })
    .then((resp) => {
      if (resp.hits.total !== 0) {
        _.each(resp.hits.hits, (hit) => {
          messages.push(hit._source);
        });
      }
      deferred.resolve({ messages });
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  // search highest, most recent audit messages for all jobs for the last 24hrs.
  this.getAuditMessagesSummary = function () {
    const deferred = $q.defer();
    const aggs = [];

    es.search({
      index: '.ml-notifications',
      ignore_unavailable: true,
      size: 0,
      body: {
        'query': {
          'bool': {
            'filter': {
              'range': {
                'timestamp': {
                  'gte': 'now-1d'
                }
              }
            }
          }
        },
        'aggs': {
          'levelsPerJob': {
            'terms': {
              'field': 'job_id',
            },
            'aggs': {
              'levels': {
                'terms': {
                  'field': 'level',
                },
                'aggs': {
                  'latestMessage': {
                    'terms': {
                      'field': 'message.raw',
                      'size': 1,
                      'order': {
                        'latestMessage': 'desc'
                      }
                    },
                    'aggs': {
                      'latestMessage': {
                        'max': {
                          'field': 'timestamp'
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
      if (resp.hits.total !== 0 &&
        resp.aggregations &&
        resp.aggregations.levelsPerJob &&
        resp.aggregations.levelsPerJob.buckets &&
        resp.aggregations.levelsPerJob.buckets.length) {
        _.each(resp.aggregations.levelsPerJob.buckets, (agg) => {
          aggs.push(agg);
        });
      }
      deferred.resolve({ messagesPerJob: aggs });
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  // search to load a few records to extract the time field
  this.searchTimeFields = function (index, type, field) {
    const deferred = $q.defer();
    const obj = { time: '' };

    es.search({
      method: 'GET',
      index: index,
      type: type,
      size: 1,
      _source: field,
    })
    .then((resp) => {
      if (resp.hits.total !== 0 && resp.hits.hits.length) {
        const hit = resp.hits.hits[0];
        if (hit._source && hit._source[field]) {
          obj.time = hit._source[field];
        }
      }
      deferred.resolve(obj);
    })
    .catch((resp) => {
      deferred.reject(resp);
    });
    return deferred.promise;
  };

  this.searchPreview = function (indices, types, job) {
    const deferred = $q.defer();

    if (job.datafeed_config) {
      const data = {
        index:indices,
        // removed for now because it looks like kibana are now escaping the & and it breaks
        // it was done this way in the first place because you can't sent <index>/<type>/_search through
        // kibana's proxy. it doesn't like type
        // '&type': types.join(',')
      };
      const body = {};

      let query = { 'match_all': {} };
      // if query is set, add it to the search, otherwise use match_all
      if (job.datafeed_config.query) {
        query = job.datafeed_config.query;
      }
      body.query = query;

      // if aggs or aggregations is set, add it to the search
      const aggregations = job.datafeed_config.aggs || job.datafeed_config.aggregations;
      if (aggregations && Object.keys(aggregations).length) {
        body.size = 0;
        body.aggregations = aggregations;

        // add script_fields if present
        const scriptFields = job.datafeed_config.script_fields;
        if (scriptFields && Object.keys(scriptFields).length) {
          body.script_fields = scriptFields;
        }

      } else {
        // if aggregations is not set and retrieveWholeSource is not set, add all of the fields from the job
        body.size = 10;

        // add script_fields if present
        const scriptFields = job.datafeed_config.script_fields;
        if (scriptFields && Object.keys(scriptFields).length) {
          body.script_fields = scriptFields;
        }


        const fields = {};

        // get fields from detectors
        if (job.analysis_config.detectors) {
          _.each(job.analysis_config.detectors, (dtr) => {
            if (dtr.by_field_name) {
              fields[dtr.by_field_name] = {};
            }
            if (dtr.field_name) {
              fields[dtr.field_name] = {};
            }
            if (dtr.over_field_name) {
              fields[dtr.over_field_name] = {};
            }
            if (dtr.partition_field_name) {
              fields[dtr.partition_field_name] = {};
            }
          });
        }

        // get fields from influencers
        if (job.analysis_config.influencers) {
          _.each(job.analysis_config.influencers, (inf) => {
            fields[inf] = {};
          });
        }

        // get fields from categorizationFieldName
        if (job.analysis_config.categorization_field_name) {
          fields[job.analysis_config.categorization_field_name] = {};
        }

        // get fields from summary_count_field_name
        if (job.analysis_config.summary_count_field_name) {
          fields[job.analysis_config.summary_count_field_name] = {};
        }

        // get fields from time_field
        if (job.data_description.time_field) {
          fields[job.data_description.time_field] = {};
        }

        // console.log('fields: ', fields);
        const fieldsList = Object.keys(fields);
        if (fieldsList.length) {
          body._source = fieldsList;
        }
      }

      data.body = body;

      es.search(data)
      .then((resp) => {
        deferred.resolve(resp);
      })
      .catch((resp) => {
        deferred.reject(resp);
      });
    }

    return deferred.promise;
  };

  this.openJob = function (jobId) {
    return ml.openJob({ jobId });
  };

  this.closeJob = function (jobId) {
    return ml.closeJob({ jobId });
  };


  this.saveNewDatafeed = function (datafeedConfig, jobId) {
    const datafeedId = 'datafeed-' + jobId;
    datafeedConfig.job_id = jobId;

    return ml.addDatafeed({
      datafeedId,
      datafeedConfig
    });
  };

  this.updateDatafeed = function (datafeedId, datafeedConfig) {
    return ml.updateDatafeed({ datafeedId, datafeedConfig })
    .then((resp) => {
      console.log('update datafeed', resp);
      return { success: true };
    }).catch((err) => {
      msgs.error('Could not update datafeed: ' + datafeedId);
      console.log('update datafeed', err);
      return { success: false, message: err.message };
    });
  };

  this.deleteDatafeed = function () {

  };

  // start the datafeed for a given job
  // refresh the job state on start success
  this.startDatafeed = function (datafeedId, jobId, start, end) {
    const deferred = $q.defer();

    // if the end timestamp is a number, add one ms to it to make it
    // inclusive of the end of the data
    if (_.isNumeric(end)) {
      end++;
    }

    ml.startDatafeed({
      datafeedId,
      start,
      end
    })
    .then((resp) => {
      deferred.resolve(resp);

    }).catch((err) => {
      console.log('MlJobsList error starting datafeed:', err);
      msgs.error('Could not start datafeed for ' + jobId, err);
      deferred.reject(err);
    });
    return deferred.promise;
  };

  // stop the datafeed for a given job
  // refresh the job state on stop success
  this.stopDatafeed = function (datafeedId, jobId) {
    const deferred = $q.defer();
    ml.stopDatafeed({
      datafeedId
    })
      .then((resp) => {
        deferred.resolve(resp);

      }).catch((err) => {
        console.log('MlJobsList error stoping datafeed:', err);
        if (err.statusCode === 500) {
          msgs.error('Could not stop datafeed for ' + jobId);
          msgs.error('Request may have timed out and may still be running in the background.');
        } else {
          msgs.error('Could not stop datafeed for ' + jobId, err);
        }
        deferred.reject(err);
      });
    return deferred.promise;
  };

  // call the _mappings endpoint for a given ES server
  // returns an object of indices and their types
  this.getESMappings = function () {
    const deferred = $q.defer();
    let mappings = {};

    // load mappings and aliases
    es.indices.get({ index: '*', feature:['_mappings','_aliases'] })
      .then((resp) => {
        _.each(resp, (index, indexName) => {
          // switch the 'mappings' for 'types' for consistency.
          if (index.mappings !== index.types) {
            Object.defineProperty(index, 'types',
              Object.getOwnPropertyDescriptor(index, 'mappings'));
            delete index.mappings;
          }
          // if an index has any aliases, create a copy of the index and give it the name
          // of the alias
          if (index.aliases && Object.keys(index.aliases).length) {
            _.each(index.aliases, (alias, aliasName) => {
              const indexCopy = angular.copy(resp[indexName]);
              indexCopy.isAlias = true;
              indexCopy.aliases = {};
              resp[aliasName] = indexCopy;
            });
          }
        });
        mappings = resp;

        // remove the * mapping type
        _.each(mappings, (m) => {
          _.each(m.types, (t, i) => {
            if(i === '*') {
              delete m.types[i];
            }
          });
        });

        deferred.resolve(mappings);
      })
      .catch((resp) => {
        deferred.reject(resp);
      });

    return deferred.promise;
  };

  this.validateDetector = function (detector) {
    const deferred = $q.defer();
    if (detector) {
      ml.validateDetector({ detector })
        .then((resp) => {
          deferred.resolve(resp);
        })
        .catch((resp) => {
          deferred.reject(resp);
        });
    } else {
      deferred.reject({});
    }
    return deferred.promise;
  };

  this.getDatafeedId = function (jobId) {
    let datafeedId = datafeedIds[jobId];
    if (datafeedId === undefined) {
      datafeedId = 'datafeed-' + jobId;
    }
    return datafeedId;
  };

  this.getDatafeedPreview = function (jobId) {
    const datafeedId = this.getDatafeedId(jobId);
    return ml.datafeedPreview({ datafeedId });
  };

  function processBasicJobInfo(mlJobService, jobsList) {
    // Process the list of job data obtained from the jobs endpoint to return
    // an array of objects containing the basic information (id, description, bucketSpan, detectors
    // and detectorDescriptions properties, plus a customUrls key if custom URLs
    // have been configured for the job) used by various result dashboards in the ml plugin.
    // The key information is stored in the mlJobService object for quick access.
    const processedJobsList = [];
    let detectorDescriptionsByJob = {};
    const detectorsByJob = {};
    const customUrlsByJob = {};

    // use cloned copy of jobs list so not to alter the original
    const jobsListCopy = _.cloneDeep(jobsList);

    _.each(jobsListCopy, (jobObj) => {
      const analysisConfig = jobObj.analysis_config;
      const bucketSpan = parseInterval(analysisConfig.bucket_span);

      const job = {
        id:jobObj.job_id,
        bucketSpanSeconds: bucketSpan.asSeconds()
      };

      if (_.has(jobObj, 'description') && /^\s*$/.test(jobObj.description) === false) {
        job.description = jobObj.description;
      } else {
        // Just use the id as the description.
        job.description = jobObj.job_id;
      }

      job.detectorDescriptions = [];
      job.detectors = [];
      const detectors = _.get(analysisConfig, 'detectors', []);
      _.each(detectors, (detector)=> {
        if (_.has(detector, 'detector_description')) {
          job.detectorDescriptions.push(detector.detector_description);
          job.detectors.push(detector);
        }
      });


      if (_.has(jobObj, 'custom_settings.custom_urls')) {
        job.customUrls = [];
        _.each(jobObj.custom_settings.custom_urls, (url) => {
          if (_.has(url, 'url_name') && _.has(url, 'url_value')) {
            job.customUrls.push(url);
          }
        });
        // Only add an entry for a job if customUrls have been defined.
        if (job.customUrls.length > 0) {
          customUrlsByJob[job.id] = job.customUrls;
        }
      }

      mlJobService.jobDescriptions[job.id] = job.description;
      detectorDescriptionsByJob[job.id] = job.detectorDescriptions;
      detectorsByJob[job.id] = job.detectors;
      mlJobService.basicJobs[job.id] = job;
      processedJobsList.push(job);
    });

    detectorDescriptionsByJob = labelDuplicateDetectorDescriptions(detectorDescriptionsByJob);
    _.each(detectorsByJob, (dtrs, jobId) => {
      _.each(dtrs, (dtr, i) => {
        dtr.detector_description = detectorDescriptionsByJob[jobId][i];
      });
    });
    mlJobService.detectorsByJob = detectorsByJob;
    mlJobService.customUrlsByJob = customUrlsByJob;

    return processedJobsList;
  }

  // Loop through the jobs list and create basic stats
  // stats are displayed along the top of the Jobs Management page
  function createJobStats(jobsList, jobStats) {

    jobStats.activeNodes.value = 0;
    jobStats.total.value = 0;
    jobStats.open.value = 0;
    jobStats.closed.value = 0;
    jobStats.failed.value = 0;
    jobStats.activeDatafeeds.value = 0;

    // object to keep track of nodes being used by jobs
    const mlNodes = {};
    let failedJobs = 0;

    _.each(jobsList, (job) => {
      if (job.state === 'opened') {
        jobStats.open.value++;
      } else if (job.state === 'closed') {
        jobStats.closed.value++;
      } else if (job.state === 'failed') {
        failedJobs++;
      }

      if (job.datafeed_config.state === 'started') {
        jobStats.activeDatafeeds.value++;
      }

      if (job.node && job.node.name) {
        mlNodes[job.node.name] = {};
      }
    });

    jobStats.total.value = jobsList.length;

    // // Only show failed jobs if it is non-zero
    if (failedJobs) {
      jobStats.failed.value = failedJobs;
      jobStats.failed.show = true;
    } else {
      jobStats.failed.show = false;
    }

    jobStats.activeNodes.value = Object.keys(mlNodes).length;
  }

  function createJobUrls(jobsList, jobUrls) {
    _.each(jobsList, (job) => {
      if (job.data_counts) {
        const from = moment(job.data_counts.earliest_record_timestamp).toISOString();
        const to = moment(job.data_counts.latest_record_timestamp).toISOString();
        let path = `?_g=(ml:(jobIds:!('${job.job_id}'))`;
        path += `,refreshInterval:(display:Off,pause:!f,value:0),time:(from:'${from}'`;
        path += `,mode:absolute,to:'${to}'`;
        path += '))&_a=(filters:!(),query:(query_string:(analyze_wildcard:!t,query:\'*\')))';

        if (jobUrls[job.job_id]) {
          jobUrls[job.job_id].url = path;
        } else {
          jobUrls[job.job_id] = { url: path };
        }
      }
    });
  }

});
