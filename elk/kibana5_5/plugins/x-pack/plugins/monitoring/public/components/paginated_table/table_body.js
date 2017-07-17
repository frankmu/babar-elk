import _ from 'lodash';
import React from 'react';
import { Loading } from './loading';
import { NoData } from './no_data';

const make = React.DOM;

export const TableBody = React.createClass({
  displayName: 'TableBody',
  render: function () {
    if (!this.props.tableData) {
      return React.createFactory(Loading)({ columns: this.props.columns });
    }
    if (!this.props.tableData.length) {
      return React.createFactory(NoData)({
        columns: this.props.columns,
        message: this.props.noDataMessage
      });
    }

    // Sort the Data
    const sortColumn = this.props.sortColObj;
    const sortedData = this.props.tableData.sort(function (a, b) {
      const aVal = _.get(a, sortColumn.sortKey || sortColumn.key);
      const bVal = _.get(b, sortColumn.sortKey || sortColumn.key);
      // caller sets `sort` field to 1 (asc) or -1 (desc)
      const sortDir = sortColumn.sort > 0 ? (aVal < bVal) : (aVal > bVal);
      return sortDir ? -1 : 1;
    });

    // Paginate the Data
    const start = this.props.pageIdx * this.props.itemsPerPage;
    const end = start + (this.props.itemsPerPage || sortedData.length);
    const paginatedData = sortedData.slice(start, end);
    const template = React.createFactory(this.props.template);

    const createRow = function (data, idx) {
      // each child in the array needs a unique "key" prop
      data.key = `paginated-table-row-${idx}`;
      return template(data, idx);
    };

    // Draw the data
    return make.tbody({ className: 'tbody' }, paginatedData.map(createRow));
  }
});
