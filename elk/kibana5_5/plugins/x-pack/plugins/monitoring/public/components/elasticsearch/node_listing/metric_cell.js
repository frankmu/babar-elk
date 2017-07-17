import { get } from 'lodash';
import React from 'react';
import numeral from 'numeral';
import { OfflineCell } from './offline_cell';

function formatMetric(metric, key) {
  const meta = metric.metric;
  const value = get(metric, key);
  if (!meta.format) { return value; }
  return numeral(value).format(meta.format) + ' ' + meta.units;
}

function slopeArrow(metric) {
  if (metric.slope > 0) {
    return 'up';
  }
  return 'down';
}

export function MetricCell(props) {
  if (props.isOnline) {
    return (
      <td>
        <div className='big inline'>
          { formatMetric(props.metric, 'last') }
        </div>
        <span className={ `big inline fa fa-long-arrow-${slopeArrow(props.metric)}` }></span>
        <div className='inline'>
          <div className='small'>
            { formatMetric(props.metric, 'max') } max
          </div>
          <div className='small'>
            { formatMetric(props.metric, 'min') } min
          </div>
        </div>
      </td>
    );
  }

  return <OfflineCell/>;
};
