import React from 'react';

export class NoData extends React.Component {
  render() {
    const colSpan = this.props.columns.length;
    const message = this.props.message || 'There are no records that match your query. Try changing the time range selection.';
    return (
      <tbody>
        <tr>
          <td colSpan={ colSpan } className="loading">
            <span>{ message }</span>
          </td>
        </tr>
      </tbody>
    );
  }
}
