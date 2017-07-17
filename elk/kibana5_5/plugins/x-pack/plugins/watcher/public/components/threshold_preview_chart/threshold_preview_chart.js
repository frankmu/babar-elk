import moment from 'moment';
import { set, first, last, isNumber } from 'lodash';
import { uiModules } from 'ui/modules';
import { TimeBucketsProvider } from 'ui/time_buckets';
import 'plugins/watcher/components/flot_chart';
import template from './threshold_preview_chart.html';
import './threshold_preview_chart.less';
import { COLORS, LINE_WIDTHS, MARGINS } from './constants';

const app = uiModules.get('xpack/watcher');

app.directive('thresholdPreviewChart', function ($injector) {
  const config = $injector.get('config');
  const Private = $injector.get('Private');
  const TimeBuckets = Private(TimeBucketsProvider);

  function getXAxisDateFormatFor(series) {
    const timeBounds = {
      min: first(series)[0],
      max: last(series)[0]
    };

    const timeBuckets = new TimeBuckets();
    timeBuckets.setBounds(timeBounds);
    timeBuckets.setInterval('auto');
    return timeBuckets.getScaledDateFormat();
  }

  moment.tz.setDefault(config.get('dateFormat:tz'));

  return {
    restrict: 'E',
    replace: true,
    template: template,
    scope: {
      // A single series (array) of (x, y) points
      // - Format: [ [ xTimestamp1, yValue1 ], [ xTimestamp2, yValue2 ], ... ]
      // - Units for timestamp values (xTimestamp1, xTimestamp2, etc.) are ms-since-epoch
      // - Timestamp values are assumed to be in UTC timezone
      // - Series array must be sorted in ascending order of timestamp values
      series: '=',

      // A single y-axis value
      thresholdValue: '='
    },
    controllerAs: 'thresholdPreviewChart',
    bindToController: true,
    controller: class ThresholdPreviewChartController {
      constructor() {
        this.data = [ this.series ];
        this.options = {};

        // Make it an area chart
        set(this.options, 'series.lines.show', true);
        set(this.options, 'series.lines.fill', true);

        // Set series line color
        set(this.options, 'colors', [ COLORS.SERIES_LINE ]);

        // Set area fill color
        set(this.options, 'series.lines.fillColor', COLORS.AREA_FILL);
        set(this.options, 'grid.aboveData', true);

        // Draw threshold line, if threshold value is provided
        if (this.thresholdValue && isNumber(this.thresholdValue)) {
          const thresholdLine = {
            yaxis: {
              from: this.thresholdValue,
              to: this.thresholdValue
            },
            color: COLORS.THRESHOLD_LINE,
            lineWidth: LINE_WIDTHS.THRESHOLD_LINE
          };
          set(this.options, 'grid.markings', [ thresholdLine ]);
        }

        // Tell flot that x-axis values are timestamps and set the time format
        set(this.options, 'xaxis.mode', 'time');
        set(this.options, 'xaxis.tickFormatter', (val) => moment(val).format(getXAxisDateFormatFor(this.series)));

        // Hide y-axis ticks (these are the lines in the chart background that go across the chart by default)
        set(this.options, 'yaxis.tickLength', 0);

        // Setup borders
        set(this.options, 'grid.borderWidth', { top: 0, right: 0, bottom: 2, left: 2 });
        set(this.options, 'grid.borderColor', COLORS.CHART_BORDER);

        // Put some distance between axes and their labels
        set(this.options, 'grid.labelMargin', MARGINS.AXES_LABELS);
      }

      get isDataExists() {
        return Boolean(this.series);
      }
    }
  };
});
