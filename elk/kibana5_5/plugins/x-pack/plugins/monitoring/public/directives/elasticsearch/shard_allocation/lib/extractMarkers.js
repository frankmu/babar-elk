/**
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
import { getValueFromArrayOrString } from './getValueFromArrayOrString';

function markerMaker(count, time, timestamp) {
  return {
    count: count,
    time: time,
    display: moment.utc(timestamp).startOf('day').format('MMM D')
  };
}

export function extractMarkers(data) {
  // data has to be sorted by time and may contain duplicates
  let total = 0;
  let currentMarker = null;
  const markers = _.reduce(data, function (memo, item) {
    const timestamp = getValueFromArrayOrString(item.fields.timestamp);
    const time = moment.utc(timestamp).startOf('day').format('YYYY-MM-DD');
    if (!currentMarker) {
      // first marker
      currentMarker = markerMaker(0, time, timestamp);
    }
    else if (currentMarker.time !== time) {
      memo.push(currentMarker);
      currentMarker = markerMaker(total, time, timestamp);
    }
    total++;
    return memo;
  }, []);

  if (currentMarker) {
    markers.push(currentMarker);
  }

  return markers;
};
