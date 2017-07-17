import { capitalize } from 'lodash';
import numeral from 'numeral';
import React from 'react';
import ReactDOM from 'react-dom';
import { KuiKeyboardAccessible } from 'ui_framework/components';
import { Table } from 'plugins/monitoring/components/paginated_table';
import { MachineLearningJobStatusIcon } from 'plugins/monitoring/components/elasticsearch/ml_job_listing/status_icon';
import { SORT_ASCENDING } from 'monitoring-constants';
import { LARGE_ABBREVIATED, LARGE_BYTES } from '../../../../common/formatting';
import { uiModules } from 'ui/modules';

function jobRowFactory(scope, kbnUrl) {
  return class JobRow extends React.Component {
    constructor(props) {
      super(props);
      this.goToNode = this.goToNode.bind(this);
    }
    goToNode() {
      scope.$evalAsync(() => {
        kbnUrl.changePath(`/elasticsearch/nodes/${this.props.node.id}`);
      });
    }
    getNode() {
      if (this.props.node) {
        return (
          <KuiKeyboardAccessible>
            <a className='link' onClick={ this.goToNode }>
              { this.props.node.name }
            </a>
          </KuiKeyboardAccessible>
        );
      }
      return 'N/A';
    }
    render() {
      return (
        <tr className='big'>
          <td>{ this.props.job_id }</td>
          <td>
            <MachineLearningJobStatusIcon status={ this.props.state } />&nbsp;
            { capitalize(this.props.state) }
          </td>
          <td>{ numeral(this.props.data_counts.processed_record_count).format(LARGE_ABBREVIATED) }</td>
          <td>{ numeral(this.props.model_size_stats.model_bytes).format(LARGE_BYTES) }</td>
          <td>
            { this.getNode() }
          </td>
        </tr>
      );
    }
  };
}

const uiModule = uiModules.get('monitoring/directives', []);
uiModule.directive('monitoringMlListing', $injector => {
  const initialTableOptions = {
    title: 'Jobs',
    searchPlaceholder: 'Filter Jobs',
    filterFields: [ 'job_id', 'state', 'node.name' ],
    columns: [
      {
        key: 'job_id',
        sortKey: 'job_id',
        title: 'Job ID'
      },
      {
        key: 'state',
        sortKey: 'state',
        sort: SORT_ASCENDING,
        title: 'State'
      },
      {
        key: 'data_counts.processed_record_count',
        sortKey: 'data_counts.processed_record_count',
        title: 'Processed Records'
      },
      {
        key: 'model_size_stats.model_bytes',
        sortKey: 'model_size_stats.model_bytes',
        title: 'Model Size'
      },
      {
        key: 'node.name',
        sortKey: 'node.name',
        title: 'Node'
      }
    ],
    noDataMessage: 'There are no Machine Learning Jobs that match your filter or time range. Try changing the filter or time range.'
  };

  return {
    restrict: 'E',
    scope: { rows: '=' },
    link(scope, $el) {
      const kbnUrl = $injector.get('kbnUrl');
      const JobRow = jobRowFactory(scope, kbnUrl);
      const $table = React.createElement(Table, {
        scope,
        options: initialTableOptions,
        template: JobRow
      });
      const tableInstance = ReactDOM.render($table, $el[0]);
      scope.$watch('rows', tableInstance.setData);
    }
  };
});
