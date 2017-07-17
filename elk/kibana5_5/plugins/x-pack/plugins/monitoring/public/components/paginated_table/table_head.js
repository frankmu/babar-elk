import React from 'react';
import { KuiKeyboardAccessible } from 'ui_framework/components';

export class TableHead extends React.Component {
  createColumnIcon(column) {
    if (column.sort && column.sort !== 0) {
      const iconClassName = column.sort === 1 ? 'fa-sort-amount-asc' : 'fa-sort-amount-desc';
      return <span className={ `fa ${iconClassName}` }></span>;
    }
    return null;
  }

  handleColumnClick(column) {
    if (column.sort !== 0) {
      column.sort = column.sort === 1 ? -1 : 1;
    } else {
      column.sort = 1;
    }
    this.props.setSortCol(column);
  }

  createColumn(column, index) {
    return (
      <th key={ `th-${index}` }>
        <KuiKeyboardAccessible>
          <span onClick={ this.handleColumnClick.bind(this, column) }>
            { column.title } { this.createColumnIcon(column) }
          </span>
        </KuiKeyboardAccessible>
      </th>
    );
  }

  render() {
    return (
      <thead>
        <tr>
          { this.props.columns.map(this.createColumn.bind(this)) }
        </tr>
      </thead>
    );
  }
}
