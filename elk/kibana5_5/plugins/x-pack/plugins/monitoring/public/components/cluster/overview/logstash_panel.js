import React from 'react';
import { formatNumber } from 'plugins/monitoring/lib/format_number';
import { KuiKeyboardAccessible } from 'ui_framework/components';
import { ClusterItemContainer, BytesPercentageUsage } from './helpers';

export function LogstashPanel(props) {
  if (!props.count) {
    return null;
  }

  const goToLogstash = () => props.angularChangeUrl('logstash');
  const goToNodes = () => props.angularChangeUrl('logstash/nodes');

  return (
    <ClusterItemContainer { ...props } url='logstash' title='Logstash'>
      <div className='row'>
        <div className='col-md-4'>
          <dl data-test-subj='logstash_overview'>
            <dt className='cluster-panel__inner-title'>
              <KuiKeyboardAccessible>
                <a className='link' onClick={ goToLogstash } >
                  Overview
                </a>
              </KuiKeyboardAccessible>
            </dt>
            <dd>Events Received: { formatNumber(props.events_in_total, '0.[0]a') }</dd>
            <dd>Events Emitted: { formatNumber(props.events_out_total, '0.[0]a') }</dd>
          </dl>
        </div>
        <div className='col-md-4'>
          <dl>
            <dt className='cluster-panel__inner-title'>
              <KuiKeyboardAccessible>
                <a className='link' onClick={ goToNodes } >
                  Nodes: <span data-test-subj='number_of_logstash_instances'>{ props.count }</span>
                </a>
              </KuiKeyboardAccessible>
            </dt>
            <dd>Uptime: { formatNumber(props.max_uptime, 'time_since') }</dd>
            <dd>
              JVM Heap: <BytesPercentageUsage usedBytes={ props.avg_memory_used } maxBytes={ props.avg_memory } />
            </dd>
          </dl>
        </div>
      </div>
    </ClusterItemContainer>
  );
}
