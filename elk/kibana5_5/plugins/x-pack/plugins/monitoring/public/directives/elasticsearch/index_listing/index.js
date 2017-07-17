import numeral from 'numeral';
import { capitalize } from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import { Table } from 'plugins/monitoring/components/paginated_table';
import { SORT_ASCENDING } from 'monitoring-constants';
import { KuiKeyboardAccessible } from 'ui_framework/components';
import { ElasticsearchStatusIcon } from 'plugins/monitoring/components/elasticsearch/status_icon';
import { uiModules } from 'ui/modules';

function showSystemIndicesComponentFactory(scope) {
  return class ShowSystemIndicesComponent extends React.Component {

    constructor(props) {
      super();
      this.state = { showSystemIndices: props.showSystemIndices };
      // method not automatically bound to the component instance because of using ES6 class syntax
      this.toggleShowSystemIndices = this.toggleShowSystemIndices.bind(this);
    }

    // See also directives/shard_allocation/components/tableHead
    toggleShowSystemIndices(e) {
      const isChecked = e.target.checked;
      this.setState({ showSystemIndices: !this.state.showSystemIndices });
      scope.$evalAsync(() => {
        scope.toggleShowSystemIndices(isChecked);
        scope.resetPaging();
      });
    }

    render() {
      return (
        <div className='pull-left filter-member'>
          <input type='checkbox'
            onChange={ this.toggleShowSystemIndices }
            checked={ this.state.showSystemIndices }/>
          &nbsp;
          Show system indices
        </div>
      );
    }

  };
}

function indexRowFactory(scope, kbnUrl) {
  return class IndexRow extends React.Component {

    constructor() {
      super();
      this.changePath = this.changePath.bind(this);
    }

    changePath() {
      scope.$evalAsync(() => {
        kbnUrl.changePath(`/elasticsearch/indices/${this.props.name}`);
      });
    }

    render() {
      const numeralize = value => numeral(value.last).format(value.metric ? value.metric.format : null);
      const unitize = value => `${numeralize(value)} ${value.metric.units}`;

      const name = this.props.name;
      const metrics = this.props.metrics;
      const status = this.props.status;
      const docCount = numeralize(metrics.index_document_count);
      const indexSize = numeralize(metrics.index_size);
      const requestRate = unitize(metrics.index_request_rate_primary);
      const searchRate = unitize(metrics.index_search_request_rate);
      const unassignedShards = numeralize(metrics.index_unassigned_shards);

      return (
        <tr className='big'>
          <td>
            <KuiKeyboardAccessible>
              <a className='link' onClick={ this.changePath }>{ name }</a>
            </KuiKeyboardAccessible>
          </td>
          <td>
            <div title={ `Index status: ${status}` }>
              <ElasticsearchStatusIcon status={ status } />&nbsp;
              { capitalize(status) }
            </div>
          </td>
          <td>
            <div className='big inline'>
              { docCount }
            </div>
          </td>
          <td>
            <div className='big inline'>
              { indexSize }
            </div>
          </td>
          <td>
            <div className='big inline'>
              { requestRate }
            </div>
          </td>
          <td>
            <div className='big inline'>
              { searchRate }
            </div>
          </td>
          <td>
            <div className='big inline'>
              { unassignedShards }
            </div>
          </td>
        </tr>
      );
    }

  };
}

const uiModule = uiModules.get('monitoring/directives', []);
uiModule.directive('monitoringIndexListing', function (kbnUrl) {
  const initialTableOptions = {
    title: 'Indices',
    searchPlaceholder: 'Filter Indices',
    noDataMessage: (
      <div>
        <p>There are no indices that match your selections. Try changing the time range selection.</p>
        <p>If you are looking for system indices (e.g., .kibana), try checking 'Show system indices'.</p>
      </div>
    ),
    filterFields: ['name', 'status'],
    /* "key" should be an object
     *   - unless it's the "name" key
     *   - the key object should have:
     *      - "metric" object
     *      - "last" scalar
     * "sortKey" should be a scalar */
    columns: [
      {
        key: 'name',
        title: 'Name'
      },
      {
        key: 'status',
        sort: SORT_ASCENDING,
        title: 'Status'
      },
      {
        key: 'metrics.index_document_count',
        sortKey: 'metrics.index_document_count.last',
        title: 'Document Count'
      },
      {
        key: 'metrics.index_size',
        sortKey: 'metrics.index_size.last',
        title: 'Data'
      },
      {
        key: 'metrics.index_request_rate_primary',
        sortKey: 'metrics.index_request_rate_primary.last',
        title: 'Index Rate'
      },
      {
        key: 'metrics.index_search_request_rate',
        sortKey: 'metrics.index_search_request_rate.last',
        title: 'Search Rate'
      },
      {
        key: 'metrics.index_unassigned_shards',
        sortKey: 'metrics.index_unassigned_shards.last',
        title: 'Unassigned Shards'
      }
    ]
  };

  return {
    restrict: 'E',
    scope: {
      data: '=',
      showSystemIndices: '=',
      toggleShowSystemIndices: '='
    },
    link(scope, $el) {

      const ShowSystemIndicesComponent = showSystemIndicesComponentFactory(scope);
      const IndexRow = indexRowFactory(scope, kbnUrl);
      const $table = React.createElement(Table, {
        scope,
        options: initialTableOptions,
        filterMembers: [<ShowSystemIndicesComponent showSystemIndices={ scope.showSystemIndices }/>],
        template: IndexRow
      });
      const tableInstance = ReactDOM.render($table, $el[0]);
      scope.resetPaging = () => {
        tableInstance.setCurrPage(0);
      };
      scope.$watch('data', (data) => {
        tableInstance.setData(data);
      });

    }
  };
});
