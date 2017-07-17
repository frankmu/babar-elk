import _ from 'lodash';
import numeral from 'numeral';
import React from 'react';
import ReactDOM from 'react-dom';
import { KuiKeyboardAccessible } from 'ui_framework/components';
import { Table } from 'plugins/monitoring/components/paginated_table';
import { SORT_ASCENDING } from 'monitoring-constants';
import { uiModules } from 'ui/modules';
import { formatNumber } from '../../../lib/format_number';

const uiModule = uiModules.get('monitoring/directives', []);
uiModule.directive('monitoringLogstashNodeListing', function (kbnUrl) {
  const initialTableOptions = {
    title: 'Nodes',
    searchPlaceholder: 'Filter Nodes',
    filterFields: ['logstash.name', 'logstash.host', 'logstash.http_address'],
    columns: [
      {
        key: 'logstash.name',
        sortKey: 'logstash.name',
        sort: SORT_ASCENDING,
        title: 'Name'
      },
      {
        key: 'jvm.mem.heap_used_percent',
        sortKey: 'jvm.mem.heap_used_percent',
        title: 'JVM Heap Used'
      },
      {
        key: 'process.cpu.percent',
        sortKey: 'process.cpu.percent',
        title: 'CPU Usage'
      },
      {
        key: 'events.out',
        sortKey: 'events.out',
        title: 'Events Ingested'
      },
      {
        key: 'logstash.version',
        title: 'Version'
      },
      {
        key: 'jvm.uptime_in_millis',
        sortKey: 'jvm.uptime_in_millis',
        title: 'Uptime'
      },
      {
        key: 'reloads',
        title: 'Config Reloads'
      }
    ]
  };

  return {
    restrict: 'E',
    scope: { rows: '=' },
    link: function (scope, $el) {
      const tableRowTemplate = React.createClass({
        getInitialState: function () {
          return _.find(scope.rows, { resolver: this.props.resolver }) || null;
        },
        componentWillReceiveProps: function (newProps) {
          this.setState(newProps);
        },
        render: function () {
          return (
            <tr key={ `row-${this.props.resolver}` } className='big'>
              <td>
                <KuiKeyboardAccessible>
                  <a className='link' onClick={ () => {
                    scope.$evalAsync(() => {
                      kbnUrl.changePath('/logstash/node/' + _.get(this.props, 'logstash.uuid'));
                    });
                  } }>
                    <div>{ this.props.logstash.name }</div>
                  </a>
                </KuiKeyboardAccessible>
                <div className="small">{ _.get(this.props, 'logstash.http_address') }</div>
              </td>
              <td>
                <div className='big'>
                  { `${numeral(this.props.jvm.mem.heap_used_percent)}%` }
                </div>
              </td>
              <td>
                <div className='big'>
                  { `${numeral(this.props.process.cpu.percent)}%` }
                </div>
              </td>
              <td>
                <div className='big'>{ formatNumber(this.props.events.out, '0.[0]a') }</div>
              </td>
              <td>
                <div className='big'>
                  { this.props.logstash.version }
                </div>
              </td>
              <td>
                <div className='big'>
                  { formatNumber(this.props.jvm.uptime_in_millis, 'time_since') }
                </div>
              </td>
              <td>
                <div>{ this.props.reloads.successes } successes</div>
                <div>{ this.props.reloads.failures } failures</div>
              </td>
            </tr>
          );
        }
      });

      const $table = React.createElement(Table, {
        options: initialTableOptions,
        template: tableRowTemplate
      });
      const tableInstance = ReactDOM.render($table, $el[0]);
      scope.$watch('rows', function (rows) {
        tableInstance.setData(rows);
      });
    }
  };
});
