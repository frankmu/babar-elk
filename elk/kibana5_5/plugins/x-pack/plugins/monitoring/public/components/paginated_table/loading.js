import React from 'react';

export class Loading extends React.Component {
  render() {
    const colSpan = this.props.columns.length;
    return (
      <tbody>
        <tr>
          <td colSpan={ colSpan } className="loading">
            <span className="fa fa-spinner fa-pulse"></span>
            <span>Loading data...</span>
          </td>
        </tr>
      </tbody>
    );
  }
}
