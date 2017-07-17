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
 * Angular controller for the Ml Connections map visualization.
 */
import rison from 'rison-node';
import _ from 'lodash';
import moment from 'moment';
import chrome from 'ui/chrome';
import 'ui/courier';

import 'plugins/ml/components/paginated_table';
import 'plugins/ml/filters/abbreviate_whole_number';
import 'plugins/ml/filters/format_value';
import 'plugins/ml/services/job_service';
import 'plugins/ml/components/job_select_list';
import 'plugins/ml/services/results_service';
import {
  labelDuplicateDetectorDescriptions,
  getEntityFieldName,
  getEntityFieldValue,
  showActualForFunction,
  showTypicalForFunction,
  getSeverity
} from 'plugins/ml/util/anomaly_utils';
import { escapeForElasticsearchQuery } from 'plugins/ml/util/string_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.controller('MlConnectionsMapController', function (
  $scope,
  $route,
  $location,
  $window,
  globalState,
  timefilter,
  courier,
  mlJobService,
  mlResultsService,
  mlJobSelectService) {
  $scope.detectorsByJob = {};
  $scope.numberHits = -1;

  $scope.selectedNode = null;
  $scope.selectedLink = null;

  if (globalState.ml === undefined) {
    globalState.ml = {};
    globalState.save();
  }

  $scope.getSelectedJobIds = function () {
    const selectedJobs = _.filter($scope.vis.params.jobs, function (job) { return job.selected; });
    return _.map(selectedJobs, function (job) {return job.id;});
  };

  $scope.setViewBy = function (viewBy) {
    $scope.vis.params.viewBy = viewBy;

    // Updates the 'View by' field stored in the editable vis (i.e. if viewing
    // in the Kibana Visualize tab) before refreshing the data.
    const editableVis = $scope.vis.getEditableVis();
    if (editableVis) {
      const editableVisState = editableVis.getState();
      editableVisState.params.viewBy = $scope.vis.params.viewBy;
      editableVis.setState(editableVisState);
    }

    $scope.refresh();
  };

  $scope.setThreshold = function (threshold) {
    $scope.vis.params.threshold = threshold;

    // Updates the 'View by' field stored in the editable vis (i.e. if viewing
    // in the Kibana Visualize tab) before refreshing the data.
    const editableVis = $scope.vis.getEditableVis();
    if (editableVis) {
      const editableVisState = editableVis.getState();
      editableVisState.params.threshold = $scope.vis.params.threshold;
      editableVis.setState(editableVisState);
    }

    $scope.refresh();
  };

  $scope.initializeVis = function () {
    // Load the job info needed by the visualization, then do the first load.
    mlJobService.getBasicJobInfo($scope.vis.indexPattern.id)
    .then(function (resp) {
      if (resp.jobs.length > 0) {
        // Set any jobs passed in the URL as selected, otherwise check any saved in the Vis.
        let selectedJobIds = [];
        if (globalState.ml.jobId !== undefined) {
          selectedJobIds = _.get(globalState.ml, 'jobIds');
        } else {
          selectedJobIds = $scope.getSelectedJobIds();
        }
        const selectAll = ((selectedJobIds.length === 1 && selectedJobIds[0] === '*') || selectedJobIds.length === 0);

        const jobs = [];
        const detectorsByJob = {};
        _.each(resp.jobs, function (job) {
          jobs.push({ id:job.id, selected: selectAll || (_.indexOf(selectedJobIds, job.id) > -1) });
          detectorsByJob[job.id] = job.detectorDescriptions;
        });

        $scope.vis.params.jobs = jobs;

        // Make the list of jobs available to the editor panel.
        const editableVis = $scope.vis.getEditableVis();
        if (editableVis) {
          const editableVisState = editableVis.getState();
          editableVisState.params.jobs = jobs;
          editableVis.setState(editableVisState);
        }

        $scope.detectorsByJob = labelDuplicateDetectorDescriptions(detectorsByJob);

        $scope.refresh();
      }
    }).catch(function (resp) {
      console.log('Connections map - error getting job info from elasticsearch:', resp);
    });
  };

  $scope.refresh = function () {
    $scope.selectedNode = null;
    $scope.selectedLink = null;
    $scope.summaryRecords = {};
    $scope.categoryExamplesByJob = {};

    const bounds = timefilter.getActiveBounds();
    $scope.timeRangeLabel = bounds.min.format('MMMM Do YYYY, HH:mm') + ' to ' + bounds.max.format('MMMM Do YYYY, HH:mm');

    const selectedJobIds = $scope.getSelectedJobIds();
    mlResultsService.getRecordInfluencers($scope.vis.indexPattern.id, selectedJobIds,
        $scope.vis.params.threshold.val, bounds.min.valueOf(), bounds.max.valueOf(), 500)
    .then(function (resp) {
      $scope.numberHits = resp.records.length;

      // Find the different influencerFieldNames.
      const influencerFieldNames = [];
      _.each(resp.records, function (record) {
        const influencers = _.get(record, 'influencers', []);
        _.each(influencers, function (influencer) {
          if (_.indexOf(influencerFieldNames, influencer.influencer_field_name) === -1) {
            influencerFieldNames.push(influencer.influencer_field_name);
          }
        });
      });

      const viewByOptions = [{ field:'ml-detector', label:'detector' }];
      _.each(influencerFieldNames, function (influencerFieldName) {
        viewByOptions.push({ field:influencerFieldName, label:influencerFieldName });
      });
      $scope.vis.type.params.viewByOptions = viewByOptions;

      // Set the selected 'View by' option back to detector if the old
      // selection is not applicable for the new data.
      const selectOption = _.find($scope.vis.type.params.viewByOptions, function (option) {
        return option.field === $scope.vis.params.viewBy.field;
      });
      if (selectOption !== undefined) {
        $scope.vis.params.viewBy = selectOption;
      } else {
        $scope.vis.params.viewBy = $scope.vis.type.params.viewByOptions[0];
      }

      if ($scope.vis.params.viewBy.field === 'ml-detector') {
        processForDetectors(resp.records);
      } else {
        processForInfluencers(resp.records, $scope.vis.params.viewBy.field);
      }

      $scope.$broadcast('render');

    }).catch(function (resp) {
      console.log('Connections map - error getting records from elasticsearch:', resp);
    });

  };

  $scope.showNodeAnomalies = function (node) {

    const bounds = timefilter.getActiveBounds();
    const selectedJobIds = $scope.getSelectedJobIds();

    if (node.fieldName === 'ml-detector') {
      // Get the corresponding job ID and detector index.
      let selectedJobId = '';
      let selectedDetectorIndex = -1;

      const detectorsForSelectedJobs = _.pick($scope.detectorsByJob, selectedJobIds);
      _.each(detectorsForSelectedJobs, function (detectorDescriptions, jobId) {
        const detectorIndex = _.indexOf(detectorDescriptions, node.fieldValue);
        if (detectorIndex >= 0) {
          selectedJobId = jobId;
          selectedDetectorIndex = detectorIndex;
        }
      });

      mlResultsService.getRecordsForDetector($scope.vis.indexPattern.id, selectedJobId, selectedDetectorIndex, true, null, null,
          $scope.vis.params.threshold.val, bounds.min.valueOf(), bounds.max.valueOf(), 500)
      .then(function (resp) {
        setSummaryTableRecords(resp.records, 'entity');
      });

    } else {
      mlResultsService.getRecordsForInfluencer($scope.vis.indexPattern.id, selectedJobIds, [node],
          $scope.vis.params.threshold.val, bounds.min.valueOf(), bounds.max.valueOf(), 500)
      .then(function (resp) {
        setSummaryTableRecords(resp.records, 'detector');
      });
    }
  };

  $scope.showLinkAnomalies = function (link) {

    const bounds = timefilter.getActiveBounds();
    const selectedJobIds = $scope.getSelectedJobIds();

    let detectorNode = null;
    if (link.inner.fieldName === 'ml-detector') {
      detectorNode = link.inner;
    } else {
      if (link.outer.fieldName === 'ml-detector') {
        detectorNode = link.outer;
      }
    }

    let influencer1 = null;
    if (link.inner.fieldName !== 'ml-detector') {
      influencer1 = link.inner;
    } else {
      if (link.outer.fieldName !== 'ml-detector') {
        influencer1 = link.outer;
      }
    }

    if (detectorNode !== null) {
      // Get the corresponding job ID and detector index.
      let selectedJobId = '';
      let selectedDetectorIndex = -1;

      const detectorsForSelectedJobs = _.pick($scope.detectorsByJob, selectedJobIds);
      _.each(detectorsForSelectedJobs, function (detectorDescriptions, jobId) {
        const detectorIndex = _.indexOf(detectorDescriptions, detectorNode.fieldValue);
        if (detectorIndex >= 0) {
          selectedJobId = jobId;
          selectedDetectorIndex = detectorIndex;
        }
      });

      link.detector = detectorNode.fieldValue;
      link.influencer1FieldName = influencer1.fieldName;
      link.influencer1FieldValue = influencer1.fieldValue;
      mlResultsService.getRecordsForDetector($scope.vis.indexPattern.id, selectedJobId, selectedDetectorIndex,
          true, influencer1.fieldName, influencer1.fieldValue,
          $scope.vis.params.threshold.val, bounds.min.valueOf(), bounds.max.valueOf(), 500)
      .then(function (resp) {
        setSummaryTableRecords(resp.records, 'detector');
      });
    } else {
      link.influencer1FieldName = influencer1.fieldName;
      link.influencer1FieldValue = influencer1.fieldValue;
      link.influencer2FieldName = link.outer.fieldName;
      link.influencer2FieldValue = link.outer.fieldValue;

      mlResultsService.getRecordsForInfluencer($scope.vis.indexPattern.id, selectedJobIds, [link.inner, link.outer],
          $scope.vis.params.threshold.val, bounds.min.valueOf(), bounds.max.valueOf(), 500)
      .then(function (resp) {
        setSummaryTableRecords(resp.records, 'detector');
      });
    }

  };

  $scope.getExamplesForCategory = function (jobId, categoryId) {
    return _.get($scope.categoryExamplesByJob, [jobId, categoryId], []);
  };

  $scope.viewInExplorer = function (nodes) {
    // Open the Explorer dashboard to show results for specified node(s).
    const bounds = timefilter.getActiveBounds();
    const from = bounds.min.toISOString();    // e.g. 2016-02-08T16:00:00.000Z
    const to = bounds.max.toISOString();

    // Build the query to pass to the Explorer dashboard.
    let query = '*';
    if (nodes.length > 0) {
      query = '';
      _.each(nodes, function (node, i) {
        if (node.fieldName !== 'ml-detector') {
          if (query.length > 0 && i > 0) {
            query += ' AND ';
          }

          const escapedFieldName = escapeForElasticsearchQuery(node.fieldName);
          const escapedFieldValue = escapeForElasticsearchQuery(node.fieldValue);
          query += escapedFieldName + ':' + escapedFieldValue;
        }
      });

      // use rison's url encoder because it escapes quote characters correctly
      query = rison.encode_uri(query);
    }

    const selectedJobIds = $scope.getSelectedJobIds();
    let jobIdParam = '*';
    const allSelected = ((selectedJobIds.length === 1 && selectedJobIds[0] === '*') || selectedJobIds.length === 0);
    if (!allSelected) {
      jobIdParam = selectedJobIds.join();
    }

    let path = chrome.getBasePath() + '/app/ml#/explorer?_g=(' +
      'ml:(jobIds:!(\'' + jobIdParam + '\'))' +
      ',refreshInterval:(display:Off,pause:!f,value:0)' +
      ',time:(from:\'' + from + '\',mode:absolute,to:\'' + to + '\'))' +
      '&_a=(filters:!(),query:(query_string:(analyze_wildcard:!t,query:' + query + ')))';


    // Pass the selected job(s) and threshold as search parameters in the URL.
    path += '&minSeverity=' + $scope.vis.params.threshold.display;

    $window.open(path, '_blank');
  };

  // Refresh the data when the time range is altered.
  $scope.$listen(timefilter, 'fetch', $scope.refresh);

  // When inside a dashboard in the Ml plugin, listen for changes to job selection.
  mlJobSelectService.listenJobSelectionChange($scope, function (event, selections) {
    const selectAll = ((selections.length === 1 && selections[0] === '*') || selections.length === 0);
    _.each($scope.vis.params.jobs, function (job) {
      job.selected = (selectAll || _.indexOf(selections, job.id) !== -1);
    });

    $scope.refresh();

  });

  // Extend Vis setState so that we can refresh the data when the visualization
  // params (threshold, job IDs) are altered in the Kibana Visualize tab.
  const savedVis = $route.current.locals.savedVis;
  if (savedVis !== undefined) {
    const vis = savedVis.vis;
    const visSetState = vis.setState;
    vis.setState = function () {
      visSetState.apply(this, arguments);
      $scope.refresh();
    };
  }

  // Retrieve the index pattern for a saved vis, or load the default for a new vis.
  if ($scope.vis.indexPattern) {
    $scope.initializeVis();
  } else {
    // TODO - move the default index pattern into an editor setting?
    courier.indexPatterns.get('.ml-anomalies-*')
    .then(function (indexPattern) {
      $scope.vis.indexPattern = indexPattern;
      $scope.initializeVis();
    }).catch(function (resp) {
      console.log('Connections map - error loading .ml-anomalies-* index pattern:', resp);
    });
  }


  function processForDetectors(records) {
    // Produce an object in the following form:
    //    const dataset = {
    //        'Unusual bytes': [ {field: 'uri', value: 'login.php', score: 75, scoreForAllValues: 120}, {..} ] ,
    //        'Freq rare URI': [ {field: 'status', value: 404, score: 95, scoreForAllValues: 95}, {..} ],
    //        'High count URI': [ {field: 'uri', value: 'login.php', score: 75, scoreForAllValues: 174}, {..}]
    //    };
    // where score = sum(record_score) of records with
    //    (influencer/detector name, influencer/detector value, influencer) triple
    // and scoreForAllValues = sum(record_score) of records with (influencer/detector name, influencer) pair
    // These are used to calculate the 'strength' of the connection.

    console.log('Connections map processForDetectors() passed:', records);

    const dataset = {};
    $scope.maxNormProbByField = { 'ml-detector':{} };

    _.each(records, function (record) {
      const detectorDesc = $scope.detectorsByJob[record.job_id][record.detector_index];
      const maxNormProbByDetector = $scope.maxNormProbByField['ml-detector'];
      maxNormProbByDetector[detectorDesc] =
        Math.max(_.get(maxNormProbByDetector, detectorDesc, 0), record.record_score);
      const key = detectorDesc;
      let connections = [];
      if (_.has(dataset, key)) {
        connections = dataset[key];
      } else {
        dataset[key] = connections;
      }

      const influencers = record.influencers;
      _.each(influencers, function (influencer) {
        const fieldName = influencer.influencer_field_name;
        _.each(influencer.influencer_field_values, function (fieldValue) {

          const connection = _.findWhere(connections, { field: fieldName, value:fieldValue });
          if (connection === undefined) {
            connections.push({
              field: fieldName,
              value: fieldValue,
              score: record.record_score
            });
          } else {
            connection.score = connection.score + record.record_score;
          }

          const maxNormProbByFieldName = ($scope.maxNormProbByField[fieldName] || {});
          maxNormProbByFieldName[fieldValue] = Math.max(_.get(maxNormProbByFieldName, fieldValue, 0), record.record_score);
          $scope.maxNormProbByField[fieldName] = maxNormProbByFieldName;
        });
      });
    });

    _.each(dataset, function (connections) {

      _.each(connections, function (connection) {
        const detectorFieldNameList = _.where(connections, { field: connection.field });
        connection.scoreForAllValues = _.reduce(detectorFieldNameList, function (memo, conn) { return memo + conn.score; }, 0);
      });
    });

    console.log('processForDetectors() built dataset:', dataset);

    $scope.chartData = dataset;
  }


  function processForInfluencers(records, influencerFieldName) {
    // Produce an object in the following form:
    //    const dataset = {
    //        200: [ {field: 'uri', value: 'login.php', score: 75, scoreForAllValues: 120}, {..} ] ,
    //        301: [ {field: 'ml-detector', value: 'Freq rare URI', score: 95, scoreForAllValues: 95}, {..} ],
    //        404: [ {field: 'uri', value: 'login.php', score: 75, scoreForAllValues: 174}, {..}]
    //    };
    // where score = sum(record_score) of records with
    //    (influencer/detector name, influencer/detector value, influencer) triple
    // and scoreForAllValues = sum(record_score) of records with (influencer/detector name, influencer) pair
    // These are used to calculate the 'strength' of the connection.

    console.log('Connections map processForInfluencers() passed:', records);

    const dataset = {};
    $scope.maxNormProbByField = { 'ml-detector':{} };

    _.each(records, function (record) {
      const influencers = record.influencers;

      const dataForFieldName = _.find(influencers, function (influencer) {
        return influencer.influencer_field_name === influencerFieldName;
      });

      if (dataForFieldName !== undefined) {
        // Filter influencers for those not for the specified influencer_field_name.
        const dataForOtherFieldNames = _.filter(influencers, function (influencer) {
          return influencer.influencer_field_name !== influencerFieldName;
        });

        const influencerFieldValues = dataForFieldName.influencer_field_values;
        _.each(influencerFieldValues, function (fieldValue) {
          const key = fieldValue;
          let connections = [];
          if (_.has(dataset, key)) {
            connections = dataset[key];
          } else {
            dataset[key] = connections;
          }

          let maxNormProbByFieldName = ($scope.maxNormProbByField[influencerFieldName] || {});
          maxNormProbByFieldName[fieldValue] = Math.max(_.get(maxNormProbByFieldName, fieldValue, 0), record.record_score);
          $scope.maxNormProbByField[influencerFieldName] = maxNormProbByFieldName;

          _.each(dataForOtherFieldNames, function (influencer) {
            _.each(influencer.influencer_field_values, function (fValue) {
              const fName = influencer.influencer_field_name;
              const connection = _.findWhere(connections, { field: fName, value:fValue });
              if (connection === undefined) {
                connections.push({
                  field: fName,
                  value: fValue,
                  score: record.record_score
                });
              } else {
                connection.score = connection.score + record.record_score;
              }

              maxNormProbByFieldName = ($scope.maxNormProbByField[fName] || {});
              maxNormProbByFieldName[fieldValue] = Math.max(_.get(maxNormProbByFieldName, fieldValue, 0), record.record_score);
              $scope.maxNormProbByField[fName] = maxNormProbByFieldName;
            });
          });

          // Add connection for the detector.
          const detectorDesc = $scope.detectorsByJob[record.job_id][record.detector_index];
          const detectorConnection = _.findWhere(connections, { field: 'ml-detector', value:detectorDesc });
          if (detectorConnection === undefined) {
            connections.push({
              field: 'ml-detector',
              value: detectorDesc,
              score: record.record_score
            });
          } else {
            detectorConnection.score = detectorConnection.score + record.record_score;
          }

          const maxNormProbByDetector = $scope.maxNormProbByField['ml-detector'];
          maxNormProbByDetector[detectorDesc] =
            Math.max(_.get(maxNormProbByDetector, detectorDesc, 0), record.record_score);
        });
      }
    });

    _.each(dataset, function (connections) {

      _.each(connections, function (connection) {
        const forFieldNameList = _.where(connections, { field: connection.field });
        connection.scoreForAllValues = _.reduce(forFieldNameList, function (memo, conn) { return memo + conn.score; }, 0);
      });
    });

    console.log('processForInfluencers() built dataset:', dataset);

    $scope.chartData = dataset;
  }

  // Aggregates by 'entity' or 'detector', to show a summary of anomalies for the selected
  // node or link, including details of the record with the maximum record score.
  function setSummaryTableRecords(records, aggregateBy) {

    let summaryRecords = [];
    const categoryIdsByJobId = {};

    _.each(records, function (record) {
      const detectorDesc = $scope.detectorsByJob[record.job_id][record.detector_index];
      const entityFieldName = getEntityFieldName(record);
      const entityFieldValue = getEntityFieldValue(record);

      let summary = (aggregateBy === 'entity' && entityFieldName !== undefined) ?
          _.findWhere(summaryRecords, { 'entityFieldName':entityFieldName, 'entityFieldValue':entityFieldValue }) :
            _.findWhere(summaryRecords, { 'detectorDescription':detectorDesc });
      if (summary === undefined) {
        summary = {
          'detectorDescription':detectorDesc,
          'entityFieldName': entityFieldName,
          'entityFieldValue':entityFieldValue,
          'count': 1,
          'sumScore': record.record_score,
          'maxScoreRecord': record
        };
        summaryRecords.push(summary);
      } else {
        summary.count = summary.count + 1;
        summary.sumScore = summary.sumScore + record.record_score;
        if (record.record_score > summary.maxScoreRecord.record_score) {
          summary.maxScoreRecord = record;
          summary.entityFieldName = getEntityFieldName(record);
          summary.entityFieldValue = getEntityFieldValue(record);
        }
      }
    });

    // Only show top 5 by max record score.
    summaryRecords = _.take(summaryRecords, 5);

    const compiledTooltip = _.template('<div class="ml-connections-map-score-tooltip">maximum score: <%= maxScoreValue %>' +
        '<hr/>total score: <%= totalScoreValue %></div>');
    _.each(summaryRecords, function (summary) {
      // Calculate scores used in the summary visual.
      const maxScoreRecord = summary.maxScoreRecord;
      const maxScore = parseInt(maxScoreRecord.record_score);
      const totalScore = parseInt(summary.sumScore);
      const barScore = maxScore !== 0 ? maxScore : 1;
      const maxScoreLabel = maxScore !== 0 ? maxScore : '< 1';
      const totalScoreLabel = totalScore !== 0 ? totalScore : '< 1';

      summary.barScore = barScore;
      summary.maxScoreLabel = maxScoreLabel;
      summary.totalScore = totalScore;
      summary.severity = getSeverity(maxScoreRecord.record_score);
      summary.tooltip = compiledTooltip({
        'maxScoreValue':maxScoreLabel,
        'totalScoreValue':totalScoreLabel
      });

      const stringTime = maxScoreRecord[$scope.vis.indexPattern.timeFieldName];
      summary.anomalyTime = moment(stringTime).format('MMM Do YYYY, HH:mm:ss');

      // Store metric information.
      const functionDescription = _.get(maxScoreRecord, 'function_description', '');
      if (showActualForFunction (functionDescription) === true) {
        if (!_.has(maxScoreRecord, 'causes')) {
          summary.actual = maxScoreRecord.actual;
        } else {
          const causes = maxScoreRecord.causes;
          if (causes.length === 1) {
            // If only one 'cause', move value to top level.
            const cause = _.first(causes);
            summary.actual = cause.actual;
          }
        }
      }
      if (showTypicalForFunction (functionDescription) === true) {
        if (!_.has(maxScoreRecord, 'causes')) {
          summary.typical = maxScoreRecord.typical;
        } else {
          const causes = maxScoreRecord.causes;
          if (causes.length === 1) {
            // If only one 'cause', move value to top level.
            const cause = _.first(causes);
            summary.typical = cause.typical;
          }
        }
      }

      if (_.has(maxScoreRecord, 'mlcategory')) {
        if (!_.has(categoryIdsByJobId, maxScoreRecord.job_id)) {
          categoryIdsByJobId[maxScoreRecord.job_id] = [];
        }
        categoryIdsByJobId[maxScoreRecord.job_id].push(maxScoreRecord.mlcategory);
      }

      // Store causes information for analyses with by and over fields.
      if (_.has(maxScoreRecord, 'causes')) {
        const causes = maxScoreRecord.causes;
        // TODO - when multiconstiate supported for population analyses, look in each cause
        //    for a 'correlatedByFieldValue' field, and if so, add to causes scope object.
        if (causes.length === 1) {
          // Metrics will already have been placed at the top level.
          // If cause has byFieldValue, move it to a top level fields for display.
          const cause = _.first(causes);
          if (_.has(cause, 'by_field_name')) {
            summary.singleCauseByFieldName = cause.by_field_name;
            summary.singleCauseByFieldValue = cause.by_field_value;
          }
        } else {
          summary.causes = _.map(causes, function (cause) {
            // Get the 'entity field name/value' to display in the cause -
            // For by and over, use byFieldName/Value (overFieldName/Value are in the top level fields)
            // For just an 'over' field - the overFieldName/Value appear in both top level and cause.
            const simplified = {
              entityName: (_.has(cause, 'by_field_name') ? cause.by_field_name : cause.over_field_name),
              entityValue: (_.has(cause, 'by_field_value') ? cause.by_field_value : cause.over_field_value)
            };
            if (showActualForFunction (functionDescription) === true) {
              simplified.actual = cause.actual;
            }
            if (showTypicalForFunction (functionDescription) === true) {
              simplified.typical = cause.typical;
            }
            return simplified;
          });
        }

      }
    });

    if (!_.isEmpty(categoryIdsByJobId)) {
      // Load examples for any mlcategory anomalies.
      $scope.categoryExamplesByJob = {};
      _.each(categoryIdsByJobId, function (categoryIds, jobId) {
        mlResultsService.getCategoryExamples($scope.vis.indexPattern.id, jobId, categoryIds, 10)
        .then(function (resp) {
          $scope.categoryExamplesByJob[jobId] = resp.examplesByCategoryId;
        }).catch(function (resp) {
          console.log('Connections map - error getting category examples from Elasticsearch:', resp);
        });
      });
    }

    $scope.summaryRecords = summaryRecords;
  }
});
