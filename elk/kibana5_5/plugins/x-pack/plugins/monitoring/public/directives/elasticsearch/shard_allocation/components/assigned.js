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

import { get, sortBy } from 'lodash';
import React from 'react';
import { Shard } from './shard';
import { calculateClass } from '../lib/calculateClass';
import { generateQueryAndLink } from '../lib/generateQueryAndLink';
import { KuiKeyboardAccessible } from 'ui_framework/components';

function sortByName(item) {
  if (item.type === 'node') {
    return [ !item.master, item.name];
  }
  return [ item.name ];
}

export const Assigned = React.createClass({
  createShard: function (shard, index) {
    const type = shard.primary ? 'primary' : 'replica';
    const additionId = shard.state === 'UNASSIGNED' ? Math.random() : '';
    const key = `${shard.index}.${shard.node}.${type}.${shard.state}.${shard.shard}${additionId}-${index}`;
    return (
      <Shard shard={ shard } key={ key }/>
    );
  },
  createChild: function (data) {
    const key = data.id;
    const classes = ['child'];
    const shardStats = get(this.props.shardStats.indices, key);
    if (shardStats) {
      classes.push(shardStats.status);
    }

    const that = this;
    const changeUrl = function () {
      that.props.changeUrl(generateQueryAndLink(data));
    };

    const name = (
      <KuiKeyboardAccessible>
        <a onClick={ changeUrl } className='link'>
          <span>{ data.name }</span>
        </a>
      </KuiKeyboardAccessible>
    );
    let master;
    if (data.node_type === 'master') {
      master = (
        <span className="fa fa-star"></span>
      );
    }
    const shards = sortBy(data.children, 'shard').map(this.createShard);
    return (
      <div className={ calculateClass(data, classes.join(' ')) } key={ key }>
        <div className='title'>{ name }{ master }</div>
        { shards }
      </div>
    );
  },
  render: function () {
    const data = sortBy(this.props.data, sortByName).map(this.createChild);
    return (
      <td>
        <div className='children'>
          { data }
        </div>
      </td>
    );
  }
});
