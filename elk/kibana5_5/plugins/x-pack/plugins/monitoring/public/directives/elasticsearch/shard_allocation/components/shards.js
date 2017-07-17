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

import { sortBy } from 'lodash';
import React from 'react';
import { calculateClass } from '../lib/calculateClass';

function sortByShard(shard) {
  if (shard.node) {
    return shard.shard;
  }
  return [!shard.primary, shard.shard];
}

const Shard = React.createClass({
  displayName: 'Shard',
  render: function () {
    const shard = this.props.shard;
    return (<div className={ calculateClass(shard, 'shard') }>{ shard.shard }</div>);
  }
});

export const Shards = React.createClass({
  createShard: function (shard) {
    const type = shard.primary ? 'primary' : 'replica';
    const additionId = shard.state === 'UNASSIGNED' ? Math.random() : '';
    const key = shard.index + '.' + shard.node + '.' + type + '.' + shard.state + '.' + shard.shard + additionId;
    return (<Shard shard={ shard } key={ key }></Shard>);
  },
  render: function () {
    const shards = sortBy(this.props.shards, sortByShard).map(this.createShard);
    return (<div className='shards'>{ shards }</div>);
  }
});
