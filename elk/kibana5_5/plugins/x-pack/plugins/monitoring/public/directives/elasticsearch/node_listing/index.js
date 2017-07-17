import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import { MetricCell } from 'plugins/monitoring/components/elasticsearch/node_listing/metric_cell';
import { OfflineCell } from 'plugins/monitoring/components/elasticsearch/node_listing/offline_cell';
import { NodeStatusIcon } from 'plugins/monitoring/components/elasticsearch/node/status_icon';
import { Tooltip } from 'plugins/monitoring/components/tooltip';
import { KuiKeyboardAccessible } from 'ui_framework/components';
import { extractIp } from 'plugins/monitoring/lib/extract_ip';
import { Table } from 'plugins/monitoring/components/paginated_table';
import { SORT_ASCENDING } from 'monitoring-constants';
import { uiModules } from 'ui/modules';

function nodeRowFactory(scope, createRow, kbnUrl, showCgroupMetricsElasticsearch) {
  function checkOnline(status) {
    return status === 'Online';
  }

  return class NodeRow extends React.Component {

    constructor(props) {
      super();
      const rowData = _.find(scope.rows, { resolver: props.resolver });
      this.state = createRow(rowData);
      this.goToNode = this.goToNode.bind(this);
    }

    componentWillReceiveProps(newProps) {
      if (!_.isEqual(newProps, this.props)) {
        const rowData = _.find(scope.rows, { resolver: newProps.resolver });
        this.setState(createRow(rowData));
      }
    }

    goToNode() {
      scope.$evalAsync(() => {
        kbnUrl.changePath(`/elasticsearch/nodes/${this.state.resolver}`);
      });
    }

    render() {
      const isOnline = checkOnline(this.state.status);

      const cpuComponents = (() => {
        if (showCgroupMetricsElasticsearch) {
          return [
            <MetricCell key="cpuCol1" isOnline={ isOnline } metric={ this.state.metrics.node_cgroup_quota }></MetricCell>,
            <MetricCell key="cpuCol2" isOnline={ isOnline } metric={ this.state.metrics.node_cgroup_throttled }></MetricCell>
          ];
        }
        return [
          <MetricCell key="cpuCol1" isOnline={ isOnline } metric={ this.state.metrics.node_cpu_utilization }></MetricCell>,
          <MetricCell key="cpuCol2" isOnline={ isOnline } metric={ this.state.metrics.node_load_average }></MetricCell>
        ];
      })();

      return (
        <tr className='big'>
          <td>
            <Tooltip text={ this.state.node.nodeTypeLabel } trigger='hover' placement='bottom'>
              <span className={ `fa ${this.state.node.nodeTypeClass}` }></span>
            </Tooltip>
            &nbsp;
            <KuiKeyboardAccessible>
              <a className='link' onClick={ this.goToNode }>
                { this.state.node.name }
              </a>
            </KuiKeyboardAccessible>
            <div className='small'>{ extractIp(this.state.node.transport_address) }</div>
          </td>
          <td>
            <div title={ `Node status: ${this.state.status}` }>
              <NodeStatusIcon status={ this.state.status } />&nbsp;
              { this.state.status }
            </div>
          </td>
          { cpuComponents }
          <MetricCell isOnline={ isOnline } metric={ this.state.metrics.node_jvm_mem_percent }></MetricCell>
          <MetricCell isOnline={ isOnline } metric={ this.state.metrics.node_free_space }></MetricCell>
          { (() => {
            if (isOnline) {
              return (
                <td>
                  <div className='big inline'>
                    { this.state.metrics.shard_count }
                  </div>
                </td>
              );
            }
            return <OfflineCell/>;
          })() }
        </tr>
      );
    }

  };
}

// change the node to actually display the name
const uiModule = uiModules.get('monitoring/directives', []);
uiModule.directive('monitoringNodesListing', ($injector) => {
  const showCgroupMetricsElasticsearch = $injector.get('showCgroupMetricsElasticsearch');
  const cpuColumns = (() => {
    if (showCgroupMetricsElasticsearch) {
      return [
        {
          key: 'metrics.node_cgroup_quota',
          sortKey: 'metrics.node_cgroup_quota.last',
          title: 'CPU Usage'
        },
        {
          key: 'metrics.node_cgroup_throttled',
          sortKey: 'metrics.node_cgroup_throttled.last',
          title: 'CPU Throttling'
        },
      ];
    }
    return [
      {
        key: 'metrics.node_cpu_utilization',
        sortKey: 'metrics.node_cpu_utilization.last',
        title: 'CPU Usage'
      },
      {
        key: 'metrics.node_load_average',
        sortKey: 'metrics.node_load_average.last',
        title: 'Load Average'
      },
    ];
  })();

  const initialTableOptions = {
    title: 'Nodes',
    searchPlaceholder: 'Filter Nodes',
    filterFields: ['nodeName', 'status', 'type', 'transport_address'],
    columns: [
      {
        key: 'nodeName',
        sortKey: 'nodeName',
        sort: SORT_ASCENDING,
        title: 'Name'
      },
      {
        key: 'status',
        sortKey: 'online',
        title: 'Status'
      },
      ...cpuColumns,
      {
        key: 'metrics.node_jvm_mem_percent',
        sortKey: 'metrics.node_jvm_mem_percent.last',
        title: 'JVM Memory'
      },
      {
        key: 'metrics.node_free_space',
        sortKey: 'metrics.node_free_space.last',
        title: 'Disk Free Space'
      },
      {
        key: 'metrics.shard_count',
        title: 'Shards'
      }
    ]
  };

  return {
    restrict: 'E',
    scope: {
      cluster: '=',
      rows: '='
    },
    link(scope, $el) {

      function createRow(rowData) {
        if (!rowData) {
          return null;
        }

        return {
          nodeName: _.get(rowData, 'node.name'),
          status: rowData.online ? 'Online' : 'Offline',
          ...rowData
        };
      }

      const kbnUrl = $injector.get('kbnUrl');
      const NodeRow = nodeRowFactory(scope, createRow, kbnUrl, showCgroupMetricsElasticsearch);
      const $table = React.createElement(Table, {
        scope,
        options: initialTableOptions,
        template: NodeRow
      });
      const tableInstance = ReactDOM.render($table, $el[0]);
      scope.$watch('rows', (rows) => {
        tableInstance.setData(rows.map((rowData) => createRow(rowData)));
      });

    }
  };
});
