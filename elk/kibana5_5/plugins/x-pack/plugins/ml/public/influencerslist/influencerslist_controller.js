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
 * Angular controller for the Ml influencer list visualization.
 * The controller processes the total score and maximum score aggregations
 * received from Elasticsearch, placing a metricsData object in scope containing
 * the data in the appropriate format for rendering a list of the top influencers
 * by field name and value.
 */
import _ from 'lodash';

import 'plugins/ml/lib/angular_bootstrap_patch';
import 'plugins/ml/filters/abbreviate_whole_number';

import { getSeverity } from 'plugins/ml/util/anomaly_utils';
import { FilterManagerProvider } from 'ui/filter_manager';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.controller('MlInfluencersListController', function ($scope, Private) {

  const filterManager = Private(FilterManagerProvider);

  $scope.$watch('esResponse', function (resp) {

    if (!resp) {
      return;
    }

    console.log('MlInfluencersListController esResponse:', resp);

    // Process the aggregations in the ES response which provide the data for the chart.
    $scope.processAggregations(resp.aggregations);

  });

  $scope.processAggregations = function (aggregations) {

    const dataByViewBy = {};

    if (aggregations) {
      // Retrieve the ids of the configured viewBy aggregations.
      const viewBy1AggId = $scope.vis.aggs.bySchemaName.viewBy1[0].id;   // e.g. for 'influencerFieldName'
      const viewBy2AggId = $scope.vis.aggs.bySchemaName.viewBy2[0].id;   // e.g. for 'influencerFieldValue'

      // Retrieve the 'maxScore' and 'totalScore' metric aggregations.
      const maxScoreAgg = $scope.vis.aggs.bySchemaName.maxScore[0];    // e.g. for max(anomalyScore)
      const totalScoreAgg = $scope.vis.aggs.bySchemaName.totalScore[0];  // e.g. for sum(anomalyScore)

      // Get the buckets of the top-level aggregation
      const buckets = aggregations[viewBy1AggId].buckets;

      // Get the labels for the two metric aggregations, used in the tooltip.
      const maxScoreMetricLabel = maxScoreAgg.makeLabel();
      const totalScoreMetricLabel = totalScoreAgg.makeLabel();

      const compiledTooltip = _.template(
        '<div class="ml-influencers-list-tooltip"><%= influencerFieldName %>: <%= influencerFieldValue %>' +
        '<hr/><%= maxScoreMetricLabel %>: <%= maxScoreValue %>' +
        '<hr/><%= totalScoreMetricLabel %>: <%= totalScoreValue %></div>');

      _.each(buckets, function (bucket) {
        const influencerFieldName = bucket.key;
        const valuesForViewBy = [];

        const bucketsForViewByValue = bucket[viewBy2AggId].buckets;

        _.each(bucketsForViewByValue, function (valueBucket) {
          const maxScorePrecise = maxScoreAgg.getValue(valueBucket);
          const maxScore = parseInt(maxScorePrecise);
          const totalScore = parseInt(totalScoreAgg.getValue(valueBucket));
          const barScore = maxScore !== 0 ? maxScore : 1;
          const maxScoreLabel = maxScore !== 0 ? maxScore : '< 1';
          const totalScoreLabel = totalScore !== 0 ? totalScore : '< 1';
          const severity = getSeverity(maxScore);

          // Store the data for each influencerfieldname in an array to ensure
          // reliable sorting by max score.
          // If it was sorted as an object, the order when rendered using the AngularJS
          // ngRepeat directive could not be relied upon to be the same as they were
          // returned in the ES aggregation e.g. for numeric keys from a mlcategory influencer.
          valuesForViewBy.push({
            'influencerFieldValue':valueBucket.key,
            'maxScorePrecise': maxScorePrecise,
            'barScore': barScore,
            'maxScoreLabel': maxScoreLabel,
            'totalScore': totalScore,
            'severity': severity,
            'tooltip': compiledTooltip({
              'influencerFieldName':influencerFieldName,
              'influencerFieldValue':valueBucket.key,
              'maxScoreMetricLabel':maxScoreMetricLabel,
              'maxScoreValue':maxScoreLabel,
              'totalScoreMetricLabel':totalScoreMetricLabel,
              'totalScoreValue':totalScoreLabel
            })
          });
        });

        dataByViewBy[influencerFieldName] = _.sortBy(valuesForViewBy, 'maxScorePrecise').reverse();
      });
      console.log('MlInfluencersListController processAggregations processed data:', dataByViewBy);

    }

    $scope.metricsData = dataByViewBy;

  };

  // Provide a filter function so filters can be added from expanded table rows.
  $scope.filter = function (field, value, operator) {
    filterManager.add(field, value, operator, $scope.vis.indexPattern.id);
  };

});
