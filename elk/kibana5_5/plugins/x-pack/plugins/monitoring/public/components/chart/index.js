import React from 'react';
import { first, get } from 'lodash';
import numeral from 'numeral';
import { getColor } from './get_color';
import { TimeseriesVisualization } from './timeseries_visualization';

export class MonitoringTimeseries extends React.Component {
  constructor() {
    super();

    this.formatTicks = this.formatTicks.bind(this);

    this.state = {
      dataset: []
    };
  }

  componentWillMount() {
    this.props.scope.$watch('series', (series) => {
      this.setState({
        dataset: series.map((s, index) => {
          return {
            ...this.props.options, // xaxis min/max
            color: getColor(s.metric.app, index),
            data: s.data,
            label: s.metric.label
          };
        })
      });
    });
  }

  formatTicks(val) {
    const series = first(this.props.scope.series);
    const format = get(series, '.metric.format', '0,0.0');
    const units = get(series, '.metric.units', '');
    let formatted = numeral(val).format(format);

    // numeral write 'B' as the actual size (e.g., 'MB')
    if (units !== 'B' && units !== '') {
      formatted += ' ' + units;
    }

    return formatted;
  }

  render() {
    return (
      <TimeseriesVisualization
        series={ this.state.dataset }
        tickFormatter={ this.formatTicks }
        onBrush={ this.props.onBrush }
      />
    );
  }
}
