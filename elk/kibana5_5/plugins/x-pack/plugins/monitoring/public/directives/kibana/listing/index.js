import { capitalize, get, find } from 'lodash';
import numeral from 'numeral';
import React from 'react';
import ReactDOM from 'react-dom';
import { KuiKeyboardAccessible } from 'ui_framework/components';
import { KibanaStatusIcon } from 'plugins/monitoring/components/kibana/status_icon';
import { Table } from 'plugins/monitoring/components/paginated_table';
import { SORT_ASCENDING } from 'monitoring-constants';
import { uiModules } from 'ui/modules';

const uiModule = uiModules.get('monitoring/directives', []);
uiModule.directive('monitoringKibanaListing', function (kbnUrl) {
  const initialTableOptions = {
    title: 'Kibana',
    searchPlaceholder: 'Filter Instances',
    filterFields: ['kibana.name', 'kibana.host', 'kibana.status', 'kibana.transport_address'],
    columns: [
      {
        key: 'kibana.name',
        sortKey: 'kibana.name',
        sort: SORT_ASCENDING,
        title: 'Name'
      },
      {
        key: 'kibana.status',
        sortKey: 'kibana.status',
        title: 'Status'
      },
      {
        key: 'process.memory',
        sortKey: 'process.memory.resident_set_size_in_bytes',
        title: 'Memory Size'
      },
      {
        key: 'os.load',
        sortKey: 'os.load.1m',
        title: 'Load Average'
      },
      {
        key: 'requests.total',
        sortKey: 'requests.total',
        title: 'Requests'
      },
      {
        key: 'response_times',
        sortKey: 'response_times.average',
        title: 'Response Times'
      }
    ]
  };

  return {
    restrict: 'E',
    scope: { rows: '=' },
    link: function (scope, $el) {
      const tableRowTemplate = React.createClass({
        getInitialState: function () {
          return find(scope.rows, { resolver: this.props.resolver }) || null;
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
                      kbnUrl.changePath('/kibana/instances/' + get(this.props, 'kibana.uuid'));
                    });
                  } }>
                    <div>{ this.props.kibana.name }</div>
                  </a>
                </KuiKeyboardAccessible>
                <div className='small'>{ get(this.props, 'kibana.transport_address') }</div>
              </td>
              <td>
                <div title={ `Instance status: ${this.props.kibana.status}` }>
                  <KibanaStatusIcon status={ this.props.kibana.status } availability={ this.props.availability } />&nbsp;
                  { !this.props.availability ? 'Offline' : capitalize(this.props.kibana.status) }
                </div>
              </td>
              <td>
                <div className='big'>
                    { `${numeral(this.props.process.memory.resident_set_size_in_bytes).format('0.00 b')}` }
                </div>
              </td>
              <td>
                <div className='big'>
                  { `${numeral(this.props.os.load['1m']).format('0.00')}` }
                </div>
              </td>
              <td>
                <div className='big'>{ this.props.requests.total }</div>
              </td>
              <td>
                <div>
                  <div>{ this.props.response_times.average && (numeral(this.props.response_times.average).format('0') + ' ms avg') }</div>
                  <div>{ numeral(this.props.response_times.max).format('0') } ms max</div>
                </div>
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
