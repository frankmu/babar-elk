import React from 'react';
import { includes, isFunction } from 'lodash';
import { KuiKeyboardAccessible } from 'ui_framework/components';

export class HorizontalLegend extends React.Component {
  constructor() {
    super();
    this.formatter = this.formatter.bind(this);
    this.createSeries = this.createSeries.bind(this);
  }

  /**
   * @param {Number} value The value to format and show in the horizontal
   * legend. A null means no data for the time bucket and will be formatted as
  * 'N/A'
   */
  formatter(value) {
    if (value === null) {
      return 'N/A';
    }
    if (isFunction(this.props.tickFormatter)) {
      return this.props.tickFormatter(value);
    }
    return value;
  }

  createSeries(row) {
    const formatter = row.tickFormatter || this.formatter;
    const value = formatter(this.props.seriesValues[row.id]);
    const classes = ['col-md-4 col-xs-6 rhythm_chart__legend-item'];
    const key = row.id;

    if (!includes(this.props.seriesFilter, row.id)) {
      classes.push('disabled');
    }
    if (!row.label || row.legend === false) {
      return (
        <div key={ key } style={ { display: 'none' } }/>
      );
    }

    return (
      <KuiKeyboardAccessible key={ key } >
        <div className={ classes.join(' ') } onClick={ event => this.props.onToggle(event, row.id) } >
          <span className='rhythm_chart__legend-label'>
            <span className='fa fa-circle rhythm_chart__legend-indicator' style={ { color: row.color } }/>
            { row.label }
          </span>
          <span className='rhythm_chart__legend-value'>{ value }</span>
        </div>
      </KuiKeyboardAccessible>
    );
  }

  render() {
    const rows = this.props.series.map(this.createSeries);

    return (
      <div className='rhythm_chart__legend-horizontal'>
        <div className='row rhythm_chart__legend-series'>
          { rows }
        </div>
      </div>
    );
  }
}
