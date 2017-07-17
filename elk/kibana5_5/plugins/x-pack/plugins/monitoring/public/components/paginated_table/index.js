import _ from 'lodash';
import React from 'react';
import { TableHead } from './table_head';
import { TableBody } from './table_body';
import { Pagination } from './pagination';

const make = React.DOM;

export const Table = React.createClass({
  displayName: 'Table',

  getInitialState: function () {
    let sortColObj = null;
    if (this.props.options.columns) {
      // caller sets `sort` field to 1 (asc) or -1 (desc)
      const columnWithSort = _.find(this.props.options.columns, (col) => Math.abs(col.sort) === 1);
      sortColObj = columnWithSort || _.first(this.props.options.columns);
    }
    return {
      itemsPerPage: 20,
      pageIdx: 0,
      sortColObj: sortColObj,
      filter: '',
      title: 'Kb Paginated Table!',
      template: null,
      tableData: null,
      filterMembers: this.props.filterMembers || []
    };
  },

  setData: function (data) {
    if (data) {
      // no length check so if the results is an empty set it clears the loading message
      this.setState({ tableData: data });
    }
  },

  setSortCol: function (colObj) {
    if (colObj) {
      if (this.state.sortColObj && colObj !== this.state.sortColObj) {
        this.state.sortColObj.sort = 0;
      }
      this.setState({ sortColObj: colObj });
    }
  },

  setFilter: function (str) {
    str = str || '';
    this.setState({ filter: str, pageIdx: 0 });
  },

  setItemsPerPage: function (num) {
    // Must be all;
    if (_.isNaN(+num)) {
      num = 0;
    }
    this.setState({
      itemsPerPage: num,
      pageIdx: 0
    });
  },

  setCurrPage: function (idx) {
    this.setState({ pageIdx: idx });
  },

  getFilteredData() {
    const data = this.state.tableData;
    const filter = this.state.filter;

    if (!filter) {
      return data;
    }

    const getFilterValueString = (obj) => {
      const filterFields = this.props.options.filterFields || [];
      const valueSet = filterFields.map((field) => _.get(obj, field));
      return valueSet.join(' ').toLowerCase();
    };

    return data.filter((obj) => _.includes(getFilterValueString(obj), filter.toLowerCase()));
  },

  render: function () {
    const isLoading = (this.state.tableData === null);
    if (isLoading) {
      return (
        <div className='paginated-table loading'>
          <span className='fa fa-spinner fa-pulse'></span>
          <span>Loading Data...</span>
        </div>
      );
    }

    // Make the Title Bar
    const $title = make.h3({ className: 'pull-left title' }, this.props.options.title);
    const that = this;
    const $filter = make.input({
      type: 'text',
      className: 'pull-left filter-input filter-member filter-member-first',
      placeholder: this.props.options.searchPlaceholder,
      onKeyUp: function (evt) {
        that.setFilter(evt.target.value);
      }
    });
    const filteredTableData = this.getFilteredData();
    const viewingCount = Math.min(filteredTableData.length, this.state.itemsPerPage);
    const $count = make.div({ className: 'pull-left filter-member' }, `${viewingCount} of ${this.state.tableData.length}`);
    let titleClasses = 'title-bar';
    if (this.props.options.title == null) {
      titleClasses += ' no-title';
    }

    const $titleBar = make.div({ className: titleClasses },
      $title, $filter, $count, ...this.state.filterMembers, make.div({ className: 'clearfix' }));

    // Make the Table
    const $tableHead = React.createFactory(TableHead);
    const $tableBody = React.createFactory(TableBody);
    const $table = make.table({ key: 'table', className: 'table monitoring-view-listing-table' },
      $tableHead({
        key: 'table.head',
        setSortCol: this.setSortCol,
        columns: this.props.options.columns,
        sortColObj: this.state.sortColObj
      }),
      $tableBody({
        key: 'table.body',
        tableData: filteredTableData,
        columns: this.props.options.columns,
        noDataMessage: this.props.options.noDataMessage,
        sortColObj: this.state.sortColObj,
        pageIdx: this.state.pageIdx,
        itemsPerPage: this.state.itemsPerPage,
        template: this.props.template
      }));

    // Footer
    const $pagination = React.createElement(Pagination, {
      dataLength: filteredTableData.length,
      itemsPerPage: this.state.itemsPerPage,
      pageIdx: this.state.pageIdx,
      setCurrPage: this.setCurrPage,
      setItemsPerPage: this.setItemsPerPage
    });


    // Finally wrap it all up and add it to a wrapping div
    return React.createElement('div', { className: 'paginated-table' },
      $titleBar,
      $table,
      $pagination);
  }
});
