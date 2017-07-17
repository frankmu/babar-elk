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

import { parseInterval } from 'ui/utils/parse_interval';

import 'plugins/ml/lib/bower_components/JSON.minify/minify.json';
import 'ui/courier';

import uiRoutes from 'ui/routes';
import { checkLicense } from 'plugins/ml/license/check_license';
import { checkCreateJobsPrivilege } from 'plugins/ml/privilege/check_privilege';

uiRoutes
.when('/jobs/new_job/advanced', {
  template: require('./new_job.html'),
  resolve : {
    CheckLicense: checkLicense,
    privileges: checkCreateJobsPrivilege
  }
})
.when('/jobs/new_job/advanced/:jobId', {
  template: require('./new_job.html'),
  resolve : {
    CheckLicense: checkLicense,
    privileges: checkCreateJobsPrivilege
  }
});

import { sortByKey } from 'plugins/ml/util/string_utils';
import {
  isJobIdValid,
  calculateDatafeedFrequencyDefaultSeconds as juCalculateDatafeedFrequencyDefaultSeconds
} from 'plugins/ml/util/job_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.controller('MlNewJob',
function (
  $scope,
  $route,
  $location,
  $modal,
  $timeout,
  courier,
  es,
  Private,
  timefilter,
  esServerUrl,
  mlJobService,
  mlMessageBarService,
  mlDatafeedService,
  mlConfirmModalService) {


  timefilter.enabled = false; // remove time picker from top of page
  const MODE = {
    NEW: 0,
    EDIT: 1,
    CLONE: 2
  };
  // ui model, used to store and control job data that wont be posted to the server.
  const msgs = mlMessageBarService;
  const mlConfirm = mlConfirmModalService;
  msgs.clear();

  $scope.job = {};
  $scope.mode = MODE.NEW;
  $scope.saveLock = false;
  $scope.indices = {};
  $scope.types = {};
  $scope.properties = {};
  $scope.dateProperties = {};
  $scope.catProperties = {};
  $scope.maximumFileSize;
  $scope.mlElasticDataDescriptionExposedFunctions = {};
  $scope.elasticServerInfo = {};

  $scope.ui = {
    pageTitle: 'Create a new job',
    wizard: {
      step:                 1,
      stepHovering:         0,
      CHAR_LIMIT:           500,
      dataLocation:         'ES',
      indexInputType:       'LIST',
      dataPreview:          '',
      dataReady:            false,
      setDataLocation: function (loc) {
        $scope.ui.wizard.dataLocation = loc;
        wizardStep(1);
      },
      forward: function () {
        wizardStep(1);
      },
      back: function () {
        wizardStep(-1);
      },
    },
    currentTab: 0,
    tabs: [
      { index: 0, title: 'Job Details' },
      { index: 1, title: 'Analysis Configuration' },
      { index: 2, title: 'Data Description' },
      { index: 3, title: 'Datafeed' },
      { index: 4, title: 'Edit JSON' },
      { index: 5, title: 'Data Preview', hidden: true },
    ],
    validation: {
      tabs: [
        { index: 0, valid: true, checks: { jobId: { valid: true } } },
        { index: 1, valid: true, checks: {
          detectors: { valid: true }, influencers: { valid: true }, categorizationFilters: { valid: true }, bucketSpan: { valid: true }
        } },
        { index: 2, valid: true, checks: { timeField: { valid: true }, timeFormat: { valid:true } } },
        { index: 3, valid: true, checks: { isDatafeed:{ valid: true }, hasAccessToIndex: { valid: true } } },
        { index: 4, valid: true, checks: {} },
        { index: 5, valid: true, checks: {} },
      ],
      setTabValid: function (tab, valid) {
        $scope.ui.validation.tabs[tab].valid = valid;
      }
    },
    jsonText: '',
    changeTab: changeTab,
    influencers: [],
    allInfluencers: allInfluencers,
    customInfluencers: [],
    tempCustomInfluencer: '',
    inputDataFormat:[
      { value: 'delimited',     title: 'Delimited' },
      { value: 'json',          title: 'JSON' },
    ],
    fieldDelimiterOptions:[
      { value: '\t',      title: 'tab' },
      { value: ' ',       title: 'space' },
      { value: ',',       title: ',' },
      { value: ';',       title: ';' },
      { value: 'custom',  title: 'custom' }
    ],
    selectedFieldDelimiter: ',',
    customFieldDelimiter: '',
    esServerOk: 0,
    indexTextOk: false,
    indices: {},
    types: {},
    isDatafeed: false,
    useDedicatedIndex: false,

    datafeed: {
      queryText:             '{"match_all":{}}',
      queryDelayText:        '',
      queryDelayDefault:     '60s',
      frequencyText:         '',
      frequencyDefault:      '',
      scrollSizeText:        '',
      scrollSizeDefault:     1000,
      indicesText:           '',
      typesText:             '',
    },
    saveStatus: {
      job:     0,
    },
    sortByKey: sortByKey,
  };

  function init() {
    // load the jobs list for job id validation later on
    mlJobService.loadJobs();

    // check to see whether currentJob is set.
    // if it is, this isn't a new job, it's either a clone or an edit.
    if (mlJobService.currentJob) {
      // try to get the jobId from the url.
      // if it's set, this is a job edit
      const jobId = $route.current.params.jobId;

      // make a copy of the currentJob object. so we don't corrupt the real job
      $scope.job = mlJobService.cloneJob(mlJobService.currentJob);

      if (jobId) {
        $scope.mode = MODE.EDIT;
        console.log('Editing job', mlJobService.currentJob);
        $scope.ui.pageTitle = 'Editing Job ' + $scope.job.job_id;
      } else {
        $scope.mode = MODE.CLONE;
        $scope.ui.wizard.step = 2;
        console.log('Cloning job', mlJobService.currentJob);
        $scope.ui.pageTitle = 'Clone Job from ' + $scope.job.job_id;
        $scope.job.job_id = '';
        setDatafeedUIText();
        setFieldDelimiterControlsFromText();
        $scope.ui.wizard.indexInputType = 'TEXT';

        // if the datafeedConfig doesn't exist, assume we're cloning from a job with no datafeed
        if (!$scope.job.datafeed_config) {
          $scope.ui.wizard.dataLocation = 'NONE';

          $scope.ui.influencers = angular.copy($scope.job.analysis_config.influencers);
        }

        if ($scope.job.results_index_name === 'shared') {
          delete $scope.job.results_index_name;
        } else {
          $scope.ui.useDedicatedIndex = true;
          $scope.job.results_index_name = '';
        }
      }

      // clear the current job
      mlJobService.currentJob = undefined;

    } else {
      $scope.mode = MODE.NEW;
      console.log('Creating new job');
      $scope.job = mlJobService.getBlankJob();
    }

    calculateDatafeedFrequencyDefaultSeconds();
    showDataPreviewTab();
  }

  function changeTab(tab) {
    $scope.ui.currentTab = tab.index;
    if (tab.index === 4) {
      createJSONText();
    } else if (tab.index === 5) {
      if ($scope.ui.wizard.dataLocation === 'ES') {
        loadDataPreview();
      }
    }
  }

  function wizardStep(step) {
    $scope.ui.wizard.step += step;
    if ($scope.ui.wizard.step === 1) {
      if ($scope.ui.wizard.dataLocation === 'NONE') {
        // no data option was selected. jump to wizard step 2
        $scope.ui.wizard.forward();
        return;
      }
    } else if ($scope.ui.wizard.step === 2) {
      if ($scope.ui.wizard.dataLocation === 'ES') {
        $scope.ui.isDatafeed = true;
        $scope.ui.tabs[2].hidden = true;

        $scope.job.data_description.format = 'json';

        delete $scope.job.data_description.time_format;
        delete $scope.job.data_description.format;

        if ($scope.timeFieldSelected()) {
          const time = $scope.job.data_description.time_field;
          if (time && $scope.dateProperties[time]) {
            $scope.job.data_description.time_field = time;
          }
        }
      }
    }

    showDataPreviewTab();
  }

  $scope.save = function () {
    console.log('save() job: ', $scope.job);
    msgs.clear();
    getDelimiterSelection();
    getDatafeedSelection();

    const jobValid = validateJob();

    if (jobValid.valid) {
      // if basic validation passes
      // refresh jobs list to check that the job id doesn't already exist.
      mlJobService.loadJobs()
      .then(() => {
        // check that the job id doesn't already exist
        const tempJob = mlJobService.getJob($scope.job.job_id);
        if (tempJob) {
          const tab = $scope.ui.validation.tabs[0];
          tab.valid = false;
          tab.checks.jobId.valid = false;
          tab.checks.jobId.message = '\'' + $scope.job.job_id + '\' already exists, please choose a different name';
          changeTab({ index:0 });
        } else {
          checkInfluencers();
        }

        function checkInfluencers() {
          // check that they have chosen some influencers
          if ($scope.job.analysis_config.influencers &&
             $scope.job.analysis_config.influencers.length) {
            saveFunc();
          } else {
            // if there are no influencers set, open a confirmation
            mlConfirm.open({
              message: 'You have not chosen any influencers, do you want to continue?',
              title: 'No Influencers'
            }).then(saveFunc)
              .catch(function () {
                changeTab({ index:1 });
              });
          }
        }

        function createJobForSaving(job) {
          const newJob = angular.copy(job);
          delete newJob.datafeed_config;
          return newJob;
        }

        function saveFunc() {

          if ($scope.ui.useDedicatedIndex) {
            // if the dedicated index checkbox has been ticked
            // and the user hasn't added a custom value for it
            // in the JSON, use the job id.
            if ($scope.job.results_index_name === '') {
              $scope.job.results_index_name = $scope.job.job_id;
            }
          } else {
            // otherwise delete it, just to be sure.
            delete $scope.job.results_index_name;
          }

          $scope.saveLock = true;
          $scope.ui.saveStatus.job = 1;
          openSaveStatusWindow();

          const job = createJobForSaving($scope.job);

          mlJobService.saveNewJob(job)
            .then((result) => {
              if (result.success) {
                // TODO - re-enable the refreshing of the index pattern fields once there is a
                // resolution to https://github.com/elastic/kibana/issues/9466
                // In the meantime, to prevent the aggregatable and searchable properties of any
                // fields configured in the job (i.e. influencer, by, over, partition field_name/value)
                // but not present in any results being set back to false by Kibana's call to the
                // field stats API, comment out the call to refreshFields().
                // The user will have to hit the 'Refresh field List' button in Kibana's Index Patterns
                // management page for the .ml-anomalies-* index pattern for any new fields.
                //
                // After the job has been successfully created the Elasticsearch
                // mappings should be fully set up, but the Kibana mappings then
                // need to be refreshed to reflect the Elasticsearch mappings for
                // any new analytical fields that have been configured in the job.
                //courier.indexPatterns.get('.ml-anomalies-*')
                //.then((indexPattern) => {
                //  indexPattern.refreshFields()
                //  .then(() => {
                //    console.log('refreshed fields for index pattern .ml-anomalies-*');
                //    wait for mappings refresh before continuing on with the post save stuff
                msgs.info('New Job \'' + result.resp.job_id + '\' added');
                // update status
                $scope.ui.saveStatus.job = 2;

                // save successful, attempt to open the job
                mlJobService.openJob($scope.job.job_id)
                .then(() => {
                  if ($scope.job.datafeed_config) {
                    // open job successful, create a new datafeed
                    mlJobService.saveNewDatafeed($scope.job.datafeed_config, $scope.job.job_id)
                    .then(() => {
                      $scope.saveLock = false;
                    })
                    .catch((resp) => {
                      msgs.error('Could not start datafeed: ', resp);
                      $scope.saveLock = false;
                    });
                  } else {
                    // no datafeed, so save is complete
                    $scope.saveLock = false;
                  }
                })
                .catch((resp) => {
                  msgs.error('Could not open job: ', resp);
                  msgs.error('Job created, creating datafeed anyway');
                  $scope.saveLock = false;
                });

                 // });
              //  });
              } else {
                // save failed, unlock the buttons and tell the user
                $scope.ui.saveStatus.job = -1;
                $scope.saveLock = false;
                msgs.error('Save failed: ' + result.resp.message);
              }
            }).catch((result) => {
              $scope.ui.saveStatus.job = -1;
              $scope.saveLock = false;
              msgs.error('Save failed: ' + result.resp.message);
            });
        }
      })
      .catch(() => {
        msgs.error('Save failed');
        console.log('save(): job validation failed. Jobs list could not be loaded.');
      });
    }
    else {
      msgs.error(jobValid.message);
      console.log('save(): job validation failed');
    }
  };

  $scope.cancel = function () {
    mlConfirm.open({
      message:'Are you sure you want to cancel job creation?',
      title: 'Are you sure?'
    })
      .then(() => {
        msgs.clear();
        $location.path('jobs');
      });
  };

  // called after loading ES data when cloning a job
  $scope.cloneJobDataDescriptionCallback = function () {
    extractCustomInfluencers();
  };

  $scope.indexSelected = function () {
    if ($scope.ui.wizard.indexInputType === 'TEXT') {
      // if the user is entering index text manually, check that the text isn't blank
      // and a match to an index has been made resulting in some fields.
      return ($scope.ui.datafeed.indicesText.length && Object.keys($scope.properties).length) ? true : false;
    } else {
      return Object.keys($scope.indices).length ? true : false;
    }
  };

  $scope.timeFieldSelected = function () {
    return ($scope.job.data_description.time_field === '') ? false : true;
  };

  $scope.jsonTextChange = function () {
    try {
      // the json text may contain comments which are illegal in json and so causes problems
      // for the parser, minifying first strips these out
      const minfiedJson = JSON.minify($scope.ui.jsonText);
      // create the job from the json text.
      $scope.job = JSON.parse(minfiedJson);
      $scope.changeJobIDCase();

      // in case influencers have been added into the json. treat them as custom if unrecognised
      extractCustomInfluencers();

      setFieldDelimiterControlsFromText();
      setDatafeedUIText();

      // if results_index_name exists, tick the dedicated index checkbox
      if ($scope.job.results_index_name !== undefined) {
        $scope.ui.useDedicatedIndex = true;
      } else {
        $scope.ui.useDedicatedIndex = false;
      }
    } catch (e) {
      console.log('JSON could not be parsed');
      // a better warning should be used.
      // colour the json text area red and display a warning somewhere. possibly in the message bar.
    }
  };

  // force job ids to be lowercase
  $scope.changeJobIDCase = function () {
    if ($scope.job.job_id) {
      $scope.job.job_id = $scope.job.job_id.toLowerCase();
    }
  };

  // called when the datafeed tickbox is toggled.
  // creates or destroys the datafeed section in the config
  $scope.datafeedChange = function () {
    if ($scope.ui.isDatafeed) {
      $scope.job.datafeed_config = {};
      $scope.ui.tabs[2].hidden = true;
      calculateDatafeedFrequencyDefaultSeconds();
    } else {
      delete $scope.job.datafeed_config;
      $scope.ui.tabs[2].hidden = false;
      $scope.job.data_description.format = 'json';
    }

    showDataPreviewTab();
  };

  $scope.setDedicatedIndex = function () {
    if ($scope.ui.useDedicatedIndex) {
      $scope.job.results_index_name = '';
    } else {
      delete $scope.job.results_index_name;
    }
  };

  // general function to remove an analysisConfig property from the config if it's an empty string
  $scope.generalAnalysisConfigFieldNameChange = function (name) {
    if ($scope.job.analysis_config[name].trim() === '') {
      delete $scope.job.analysis_config[name];
    }
  };

  function clear(obj) {
    Object.keys(obj).forEach(function (key) { delete obj[key]; });
    if (Array.isArray(obj)) {
      obj.length = 0;
    }
  }

  // triggered when the user changes the JSON text
  // reflect the changes in the UI
  function setDatafeedUIText() {
    if ($scope.job.datafeed_config && Object.keys($scope.job.datafeed_config).length) {
      const datafeedConfig = $scope.job.datafeed_config;

      $scope.ui.isDatafeed = true;
      $scope.ui.tabs[2].hidden = true;
      $scope.ui.wizard.dataLocation = 'ES';
      showDataPreviewTab();

      const queryDelayDefault = $scope.ui.datafeed.queryDelayDefault;
      let queryDelay = datafeedConfig.query_delay;
      if ($scope.ui.datafeed.queryDelayDefault === datafeedConfig.query_delay) {
        queryDelay = '';
      }

      const frequencyDefault = $scope.ui.datafeed.frequencyDefault;
      let freq = datafeedConfig.frequency;
      if ($scope.ui.datafeed.frequencyDefault === datafeedConfig.frequency) {
        freq = '';
      }

      const scrollSizeDefault = $scope.ui.datafeed.scrollSizeDefault;
      let scrollSize = datafeedConfig.scroll_size;
      if ($scope.ui.datafeed.scrollSizeDefault === datafeedConfig.scroll_size) {
        scrollSize = '';
      }


      clear($scope.types);
      _.each(datafeedConfig.types, function (type) {
        $scope.types[type] = $scope.ui.types[type];
      });

      clear($scope.indices);
      _.each(datafeedConfig.indices, function (index) {
        $scope.indices[index] = $scope.ui.indices[index];
      });

      $scope.ui.datafeed = {
        queryText:         angular.toJson(datafeedConfig.query, true),
        queryDelayText:    queryDelay,
        queryDelayDefault: queryDelayDefault,
        frequencyText:     freq,
        frequencyDefault:  frequencyDefault,
        scrollSizeText:    scrollSize,
        scrollSizeDefault: scrollSizeDefault,
        indicesText:       datafeedConfig.indices.join(','),
        typesText:         datafeedConfig.types.join(','),
      };

      // load the mappings from the configured server
      // via the functions exposed in the elastic data controller
      if (typeof $scope.mlElasticDataDescriptionExposedFunctions.extractFields === 'function') {
        $scope.mlElasticDataDescriptionExposedFunctions.getMappings().then(() => {
          $scope.mlElasticDataDescriptionExposedFunctions.extractFields({ types: $scope.types });
        });
      }

    } else {
      $scope.ui.isDatafeed = false;
      $scope.ui.tabs[2].hidden = false;
    }
  }

  // work out the default frequency based on the bucket_span
  function calculateDatafeedFrequencyDefaultSeconds() {
    const bucketSpan = parseInterval($scope.job.analysis_config.bucket_span);
    if (bucketSpan !== null) {
      $scope.ui.datafeed.frequencyDefault = juCalculateDatafeedFrequencyDefaultSeconds(bucketSpan.asSeconds()) + 's';
    }
  }

  // scope version of the above function
  $scope.calculateDatafeedFrequencyDefaultSeconds = calculateDatafeedFrequencyDefaultSeconds;


  function setFieldDelimiterControlsFromText() {
    if ($scope.job.data_description && $scope.job.data_description.field_delimiter) {

      // if the data format has not been set and fieldDelimiter exists,
      // assume the format is delimited
      if ($scope.job.data_description.format === undefined) {
        $scope.job.data_description.format = 'delimited';
      }

      const fieldDelimiter = $scope.job.data_description.field_delimiter;
      $scope.ui.selectedFieldDelimiter = 'custom';
      $scope.ui.customFieldDelimiter = '';
      let isCustom = true;
      for (let i = 0; i < $scope.ui.fieldDelimiterOptions.length - 1; i++) {
        if ($scope.ui.fieldDelimiterOptions[i].value === fieldDelimiter) {
          isCustom = false;
          $scope.ui.selectedFieldDelimiter = $scope.ui.fieldDelimiterOptions[i].value;
        }
      }
      if (isCustom) {
        $scope.ui.customFieldDelimiter = fieldDelimiter;
      }
    }
  }

  function getDelimiterSelection() {
    if ($scope.job.data_description.format === 'delimited') {
      const selectedFieldDelimiter = $scope.ui.selectedFieldDelimiter;
      if (selectedFieldDelimiter === 'custom') {
        $scope.job.data_description.field_delimiter = $scope.ui.customFieldDelimiter;
      }
      else {
        $scope.job.data_description.field_delimiter = selectedFieldDelimiter;
      }
    } else {
      delete $scope.job.data_description.field_delimiter;
      delete $scope.job.data_description.quote_character;
    }
  }

  // create the datafeedConfig section of the job config
  function getDatafeedSelection() {
    if ($scope.ui.isDatafeed) {
      const df = $scope.ui.datafeed;

      if (df.queryText === '') {
        df.queryText = '{"match_all":{}}';
      }
      let query = df.queryText;
      try {
        query = JSON.parse(query);
      } catch (e) {
        console.log('getDatafeedSelection(): could not parse query JSON');
      }

      let indices = [];
      if (df.indicesText) {
        indices = df.indicesText.split(',');
        for (let i = 0; i < indices.length; i++) {
          indices[i] = indices[i].trim();
        }
      }

      let types = [];
      if (df.typesText) {
        types = df.typesText.split(',');
        for (let i = 0; i < types.length; i++) {
          types[i] = types[i].trim();
        }
      }

      // create datafeedConfig if it doesn't already exist
      if (!$scope.job.datafeed_config) {
        $scope.job.datafeed_config = {};
      }

      const config = $scope.job.datafeed_config;

      config.query =       query;
      config.query_delay = ((df.queryDelayText === '' || df.queryDelayText === null || df.queryDelayText === undefined) ?
        df.queryDelayDefault : df.queryDelayText);
      config.frequency =   ((df.frequencyText === '' || df.frequencyText === null || df.frequencyText === undefined) ?
        df.frequencyDefault : df.frequencyText);
      config.scroll_size = ((df.scrollSizeText === '' || df.scrollSizeText === null || df.scrollSizeText === undefined) ?
        df.scrollSizeDefault : df.scrollSizeText);
      config.indices =     indices;
      config.types =       types;
    }
  }

  function getCustomUrlSelection() {
    // if no custom urls have been created, delete the whole custom settings item
    if ($scope.job.custom_settings && $scope.job.custom_settings.custom_urls) {
      if ($scope.job.custom_settings.custom_urls.length === 0) {
        delete $scope.job.custom_settings;
      }
    }
  }

  function getCategorizationFilterSelection() {
    // if no filters have been created, delete the filter array
    if ($scope.job.analysis_config && $scope.job.analysis_config.categorization_filters) {
      if ($scope.job.analysis_config.categorization_filters.length === 0) {
        delete $scope.job.analysis_config.categorization_filters;
      }
    }
  }

  function createJSONText() {
    getDelimiterSelection();
    getDatafeedSelection();
    getCustomUrlSelection();
    getCategorizationFilterSelection();
    $scope.ui.jsonText = angular.toJson($scope.job, true);
  }

  // add new custom URL
  $scope.addCustomUrl = function () {
    if (!$scope.job.custom_settings) {
      $scope.job.custom_settings = {};
    }
    if (!$scope.job.custom_settings.custom_urls) {
      $scope.job.custom_settings.custom_urls = [];
    }

    $scope.job.custom_settings.custom_urls.push({ url_name: '', url_value: '' });
  };

  // remove selected custom URL
  $scope.removeCustomUrl = function (index) {
    $scope.job.custom_settings.custom_urls.splice(index, 1);
  };

  // add new categorization filter
  $scope.addCategorizationFilter = function () {
    if ($scope.job.analysis_config) {
      if (!$scope.job.analysis_config.categorization_filters) {
        $scope.job.analysis_config.categorization_filters = [];
      }

      $scope.job.analysis_config.categorization_filters.push('');
    }
  };

  // remove selected categorization filter
  $scope.removeCategorizationFilter = function (index) {
    if ($scope.job.analysis_config && $scope.job.analysis_config.categorization_filters) {
      $scope.job.analysis_config.categorization_filters.splice(index, 1);
    }
  };


  $scope.influencerChecked = function (inf) {
    return (_.contains($scope.job.analysis_config.influencers, inf));
  };

  $scope.toggleInfluencer = function (inf) {
    const influencers = $scope.job.analysis_config.influencers;
    if ($scope.influencerChecked(inf)) {
      for (let i = 0; i < influencers.length; i++) {
        if (influencers[i] === inf) {
          $scope.job.analysis_config.influencers.splice(i, 1);
        }
      }
    } else {
      $scope.job.analysis_config.influencers.push(inf);
    }
  };

  $scope.addCustomInfluencer = function () {
    if ($scope.ui.tempCustomInfluencer !== '') {
      $scope.ui.customInfluencers.push($scope.ui.tempCustomInfluencer);
      $scope.ui.tempCustomInfluencer = '';
    }
  };

  // look at the difference between loaded ES influencers and the ones in the current job.
  // unrecognised influencers must have been added by the user.
  function extractCustomInfluencers() {
    const allInfluencersList = $scope.ui.influencers;
    $scope.ui.customInfluencers = _.difference($scope.job.analysis_config.influencers, allInfluencersList);
    console.log('extractCustomInfluencers: ', $scope.ui.customInfluencers);
  }

  // function used to check that all required fields are filled in
  function validateJob() {
    let valid = true;
    let message = 'Fill in all required fields';

    const tabs = $scope.ui.validation.tabs;
    // reset validations
    _.each(tabs, function (tab) {
      tab.valid = true;
      for (const check in tab.checks) {
        if (tab.checks.hasOwnProperty(check)) {
          tab.checks[check].valid = true;
          tab.checks[check].message = '';
        }
      }
    });

    const job = $scope.job;
    if (job) {
      // tab 0 - Job Details
      // job already exists check happens in save function
      // as users may wish to continue and overwrite existing job
      if (_.isEmpty(job.job_id)) {
        tabs[0].checks.jobId.valid = false;
      } else if (isJobIdValid(job.job_id) === false) {
        tabs[0].checks.jobId.valid = false;
        let msg = 'Job name can contain lowercase alphanumeric (a-z and 0-9), hyphens or underscores; ';
        msg += 'must start and end with an alphanumeric character';
        tabs[0].checks.jobId.message = msg;
      }

      // tab 1 - Analysis Configuration
      if (job.analysis_config.categorization_filters) {
        let v = true;
        _.each(job.analysis_config.categorization_filters, function (d) {
          try {
            new RegExp(d);
          } catch (e) {
            v = false;
          }

          if (job.analysis_config.categorization_field_name === undefined || job.analysis_config.categorization_field_name === '') {
            tabs[1].checks.categorizationFilters.message = 'categorizationFieldName must be set to allow filters';
            v = false;
          }

          if (d === '' || v === false) {
            tabs[1].checks.categorizationFilters.valid = false;
            valid = false;
          }
        });
      }


      if (job.analysis_config.detectors.length === 0) {
        tabs[1].checks.detectors.valid = false;
      } else {
        _.each(job.analysis_config.detectors, function (d) {
          if (_.isEmpty(d.function)) {
            valid = false;
          }
        });
      }

      if (job.analysis_config.influencers &&
         job.analysis_config.influencers.length === 0) {
        // tabs[1].checks.influencers.valid = false;
      }

      if (job.analysis_config.bucket_span === '' ||
         job.analysis_config.bucket_span === undefined) {
        tabs[1].checks.bucketSpan.message = 'bucket_span must be set';
        tabs[1].checks.bucketSpan.valid = false;
      } else {
        const bucketSpan = parseInterval(job.analysis_config.bucket_span);
        if (bucketSpan === null) {
          tabs[1].checks.bucketSpan.message = job.analysis_config.bucket_span + ' is not a valid time interval format. e.g. 10m, 1h';
          tabs[1].checks.bucketSpan.valid = false;
        }
      }

      // tab 3 - Datafeed
      if (job.datafeed_config.types.length > 0) {
        const loadedTypes = Object.keys($scope.ui.types);
        if (loadedTypes.length === 0) {
          message = 'Could not find index. You may not have the correct permissions';
          tabs[3].checks.hasAccessToIndex.valid = false;
          tabs[3].checks.hasAccessToIndex.message = message;
        }
      }

    } else {
      valid = false;
    }

    // for each tab, set its validity based on its contained checks
    _.each(tabs, function (tab) {
      _.each(tab.checks, function (item) {
        if (item.valid === false) {
          // set tab valid state to false
          tab.valid = false;
          // set overall valid state to false
          valid = false;
        }
      });
    });

    return {
      valid,
      message
    };
  }

  function openSaveStatusWindow() {
    $modal.open({
      template: require('plugins/ml/jobs/new_job/advanced/save_status_modal/save_status_modal.html'),
      controller: 'MlSaveStatusModal',
      backdrop: 'static',
      keyboard: false,
      size: 'sm',
      resolve: {
        params: function () {
          return {
            pscope:           $scope,
            openDatafeed:    function () {
              mlDatafeedService.openJobTimepickerWindow($scope.job);
            }
          };
        }
      }
    });
  }

  // using the selected indices and types, perform a search
  // on the ES server and display the results in the Data preview tab
  function loadDataPreview() {
    createJSONText();
    $scope.ui.wizard.dataPreview = '';

    const indices = Object.keys($scope.indices);
    const types = Object.keys($scope.types);
    const job = $scope.job;
    if (indices.length) {
      mlJobService.searchPreview(indices, types, job)
      .then(function (resp) {
        $scope.ui.wizard.dataPreview = angular.toJson(resp, true);
      })
      .catch(function (resp) {
        $scope.ui.wizard.dataPreview = angular.toJson(resp, true);
      });
    }
  }

  function showDataPreviewTab() {
    let hidden = true;
    // if this is a datafeed job, make the Data Preview tab available
    if ($scope.ui.isDatafeed) {
      hidden = false;
    }

    // however, if cloning a datafeedless, don't display the preview tab
    if ($scope.ui.wizard.dataLocation === 'NONE' && $scope.mode === MODE.CLONE) {
      hidden = true;
    }

    $scope.ui.tabs[5].hidden = hidden;
    $scope.$applyAsync();
  }

  // combine all influencers into a sorted array
  function allInfluencers() {
    let influencers = $scope.ui.influencers.concat($scope.ui.customInfluencers);
    // deduplicate to play well with ng-repeat
    influencers = _.uniq(influencers);

    return _.sortBy(influencers, (inf) => inf);
  }

  init();

});
