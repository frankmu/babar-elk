import React from 'react';
import { get, capitalize } from 'lodash';
import { formatNumber } from 'plugins/monitoring/lib/format_number';
import { KuiKeyboardAccessible } from 'ui_framework/components';
import { ElasticsearchStatusIcon } from 'plugins/monitoring/components/elasticsearch/status_icon';
import { ClusterItemContainer, HealthStatusIndicator, BytesUsage, BytesPercentageUsage } from './helpers';

export class ElasticsearchPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      primaries: 'N/A',
      replicas: 'N/A'
    };
  }

  componentWillReceiveProps(nextProps) {
    const shards = get(nextProps, 'cluster_stats.indices.shards', {});
    const total = get(shards, 'total', 0);
    let primaries = get(shards, 'primaries', 'N/A');
    let replicas = 'N/A';

    // we subtract primaries from total to get replica count, so if we don't know primaries, then
    //  we cannot know replicas (because we'd be showing the wrong number!)
    if (primaries !== 'N/A') {
      primaries = formatNumber(primaries, 'int_commas');
      replicas = formatNumber(total - primaries, 'int_commas');
    }

    this.setState({
      primaries,
      replicas
    });
  }

  showMlJobs() {
    // if license doesn't support ML, then `ml === null`
    if (this.props.ml) {
      return <dd>Jobs: { this.props.ml.jobs }</dd>;
    }
    return null;
  }

  render() {
    const clusterStats = this.props.cluster_stats || {};
    const nodes = clusterStats.nodes;
    const indices = clusterStats.indices;

    const statusIndicator = (
      <HealthStatusIndicator>
        <ElasticsearchStatusIcon status={ clusterStats.status } />&nbsp;
        { capitalize(clusterStats.status) }
      </HealthStatusIndicator>
    );

    const goToElasticsearch = () => this.props.angularChangeUrl('elasticsearch');
    const goToNodes = () => this.props.angularChangeUrl('elasticsearch/nodes');
    const goToIndices = () => this.props.angularChangeUrl('elasticsearch/indices');

    return (
      <ClusterItemContainer { ...this.props } statusIndicator={ statusIndicator } url='elasticsearch' title='Elasticsearch'>
        <div className='row'>
          <div className='col-md-4'>
            <dl data-test-subj='elasticsearch_overview' data-overview-status={ this.props.status }>
              <dt className='cluster-panel__inner-title'>
                <KuiKeyboardAccessible>
                  <a className='link' onClick={ goToElasticsearch } >
                    Overview
                  </a>
                </KuiKeyboardAccessible>
              </dt>
              <dd>Version: { get(nodes, 'versions[0]') || 'N/A' }</dd>
              <dd>Uptime: { formatNumber(get(nodes, 'jvm.max_uptime_in_millis'), 'time_since') }</dd>
              { this.showMlJobs() }
            </dl>
          </div>
          <div className='col-md-4'>
            <dl>
              <dt className='cluster-panel__inner-title'>
                <KuiKeyboardAccessible>
                  <a className='link' onClick={ goToNodes } >
                    Nodes: <span data-test-subj='number_of_elasticsearch_nodes'>
                      { formatNumber(get(nodes, 'count.total'), 'int_commas') }
                    </span>
                  </a>
                </KuiKeyboardAccessible>
              </dt>
              <dd>
                Disk Available: <BytesUsage
                  usedBytes={ get(nodes, 'fs.available_in_bytes') }
                  maxBytes={ get(nodes, 'fs.total_in_bytes') }
                />
              </dd>
              <dd>
                JVM Heap: <BytesPercentageUsage
                  usedBytes={ get(nodes, 'jvm.mem.heap_used_in_bytes') }
                  maxBytes={ get(nodes, 'jvm.mem.heap_max_in_bytes') }
                />
              </dd>
            </dl>
          </div>
          <div className='col-md-4'>
            <dl>
              <dt className='cluster-panel__inner-title'>
                <KuiKeyboardAccessible>
                  <a className='link' onClick={ goToIndices  } >
                    Indices: { formatNumber(get(indices, 'count'), 'int_commas') }
                  </a>
                </KuiKeyboardAccessible>
              </dt>
              <dd>Documents: { formatNumber(get(indices, 'docs.count'), 'int_commas') }</dd>
              <dd>Disk Usage: { formatNumber(get(indices, 'store.size_in_bytes'), 'bytes') }</dd>
              <dd>Primary Shards: { this.state.primaries }</dd>
              <dd>Replica Shards: { this.state.replicas }</dd>
            </dl>
          </div>
        </div>
      </ClusterItemContainer>
    );
  }
};
