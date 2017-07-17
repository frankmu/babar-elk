/*
 * ELASTICSEARCH CONFIDENTIAL
 * _____________________________
 *
 *  [2014] Elasticsearch Incorporated All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Elasticsearch Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Elasticsearch Incorporated
 * and its suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Elasticsearch Incorporated.
 */

import _ from 'lodash';
import moment from 'moment';
import { getValueFromArrayOrString } from '../lib/getValueFromArrayOrString';

export function getTimelineDataFn($rootScope, timefilter, es) {
  const getTimelineData = function (direction, indexPattern, cluster, size, timeRange, data, position, indices) {
    let newPosition = false;
    size = _.isUndefined(size) ? 300 : size;
    data = _.isUndefined(data) ? [] : data;
    position = _.isUndefined(position) ? 0 : position;

    function handleIndexList(indexList) {
      if (_.isUndefined(timeRange)) {
        const bounds = timefilter.getBounds();
        timeRange = {
          gte: bounds.min.valueOf(),
          lte: bounds.max.valueOf(),
          format: 'epoch_millis'
        };
      }

      const header = { index: indexList[position], type: 'cluster_state' };
      const body = {
        size: size,
        from: 0,
        fields: [
          'timestamp',
          'cluster_state.status',
          'cluster_state.state_uuid',
          'cluster_uuid'
        ],
        sort: {
          'timestamp': { order: direction === 'push' ? 'asc' : 'desc' }
        },
        query: {
          filtered: {
            filter: {
              bool: {
                must: [
                  { range: { 'timestamp': timeRange } },
                  { term: { 'cluster_uuid': cluster.cluster_uuid } }
                ]
              }
            }
          }
        }
      };

      const success = function (resp) {
        if (resp && resp.responses[0] && resp.responses[0].hits) {
          let nextTimeRange;
          const hits = resp.responses[0].hits;
          data.push.apply(data, hits.hits);
          $rootScope.$broadcast('updateTimelineData', direction, hits.hits);

          if (hits.hits.length === hits.total) {
            position++;
            newPosition = indexList[position] ? true : false;
          }

          let lte = moment(timeRange.lte).valueOf();
          if (hits.hits.length > 0) {
            lte = moment(getValueFromArrayOrString(hits.hits[hits.hits.length - 1].fields.timestamp)).valueOf();
          }

          if ((hits.total > size && hits.hits.length === size) || newPosition) {
            nextTimeRange = {
              lte: lte,
              gte: timeRange.gte,
              format: 'epoch_millis'
            };
            return getTimelineData(direction, indexPattern, cluster, size, nextTimeRange, data, position, indexList); // call again
          }

          // flip data back to normal order
          return data.reverse();
        }
      };

      const error = function (_resp) {
        position++;
        if (indexList[position]) {
          return getTimelineData(direction, indexPattern, cluster, size, timeRange, data, position, indexList); // call again
        }
        return data.reverse();
      };

      return es.msearch({ body: [header, body] }).then(success, error);
    }

    if (indices) {
      return handleIndexList(indices);
    }

    return indexPattern.toIndexList(moment(timeRange.gte), moment(timeRange.lte)).then(function (indexList) {
      indexList.reverse();
      return handleIndexList(indexList);
    });
  };

  return getTimelineData;
};

