import _ from 'lodash';
import React from 'react';
import { getLastValue } from './get_last_value';
import { TimeseriesContainer } from './timeseries_container';
import { HorizontalLegend } from './horizontal_legend';
import { getValuesForSeriesIndex, getValuesByX } from './get_values_for_legend';

export class TimeseriesVisualization extends React.Component {

  constructor() {
    super();

    // 17ms, which is roughly 60fps
    const debounceMillis = 17;
    this.debouncedUpdateLegend = _.debounce(this.updateLegend, debounceMillis);
    this.debouncedUpdateLegend = this.debouncedUpdateLegend.bind(this);

    this.toggleFilter = this.toggleFilter.bind(this);

    this.state = {
      values: {},
      seriesToShow: [],
      ignoreVisabilityUpdates: false
    };
  }

  filterLegend(id) {
    if (!_.has(this.state.values, id)) {
      return [];
    }

    const notAllShown = _.keys(this.state.values).length !== this.state.seriesToShow.length;
    const isCurrentlyShown = _.includes(this.state.seriesToShow, id);
    const seriesToShow = [];

    if (notAllShown && isCurrentlyShown) {
      this.setState({
        ignoreVisabilityUpdates: false,
        seriesToShow: Object.keys(this.state.values)
      });
    } else {
      seriesToShow.push(id);
      this.setState({
        ignoreVisabilityUpdates: true,
        seriesToShow: [id]
      });
    }

    return seriesToShow;
  }

  toggleFilter(_event, id) {
    const seriesToShow = this.filterLegend(id);

    if (_.isFunction(this.props.onFilter)) {
      this.props.onFilter(seriesToShow);
    }
  }

  getLastValues(props) {
    props = props || this.props;
    const values = {};

    props.series.forEach((row) => {
      // we need a valid identifier
      if (!row.id) {
        row.id = row.label;
      }
      values[row.id] = getLastValue(row.data);
    });

    return values;
  }

  updateLegend(pos, item) {
    const values = {};

    if (pos) {
      // callback
      const setValueCallback = (seriesId, value) => {
        values[seriesId] = value;
      };

      if (item) {
        getValuesForSeriesIndex(this.props.series, item.dataIndex, setValueCallback);
      } else {
        getValuesByX(this.props.series, pos.x, setValueCallback);
      }
    } else {
      _.assign(values, this.getLastValues());
    }

    this.setState({ values });
  }


  componentWillReceiveProps(props) {
    const values = this.getLastValues(props);
    const currentKeys = _.keys(this.state.values);
    const keys = _.keys(values);
    const diff = _.difference(keys, currentKeys);
    const nextState = { values: values };

    if (diff.length && !this.state.ignoreVisabilityUpdates) {
      nextState.seriesToShow = keys;
    }

    this.setState(nextState);
  }

  render() {
    const className = 'rhythm_chart';
    const style = {
      flexDirection: 'column' // for legend position = bottom
    };

    return (
      <div className={ className }>
        <div style={ style } className='rhythm_chart__content'>
          <div className='rhythm_chart__visualization'>
            <TimeseriesContainer
              seriesToShow={ this.state.seriesToShow }
              updateLegend={ this.debouncedUpdateLegend }
              { ...this.props }
            />
          </div>
          <HorizontalLegend
            seriesFilter={ this.state.seriesToShow }
            seriesValues={ this.state.values }
            onToggle={ this.toggleFilter }
            { ...this.props }
          />
        </div>
      </div>
    );
  }
}

TimeseriesVisualization.defaultProps = {
  legend: true
};
