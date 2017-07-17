import _ from 'lodash';
import { filterPartialBuckets } from '../filter_partial_buckets';
import { pickMetricFields } from '../pick_metric_fields';
import { metrics } from '../metrics';

function createDataObject(x, y) {
  return { x, y };
}

// TODO refactor metric classes to give every metric a calculation fn?
function mapChartData(metric) {
  return (bucket) => {
    const _createDataObject = _.partial(createDataObject, bucket.key);

    if (metric.calculation) {
      return _createDataObject(metric.calculation(bucket));
    }

    const bucketMetricDeriv = bucket.metric_deriv;
    if (metric.derivative && bucketMetricDeriv) {
      return _createDataObject(
        bucketMetricDeriv.normalized_value || bucketMetricDeriv.value || 0
      );
    }

    const bucketMetricValue = _.get(bucket, 'metric.value');
    if (bucketMetricValue) {
      return _createDataObject(bucketMetricValue);
    }

    return _createDataObject(null);

  };
}

function calcSlope(data) {
  const length = data.length;
  const xSum = data.reduce((prev, curr) => { return prev + curr.x; }, 0);
  const ySum = data.reduce((prev, curr) => { return prev + curr.y; }, 0);
  const xySum = data.reduce((prev, curr) => { return prev + (curr.y * curr.x); }, 0);
  const xSqSum = data.reduce((prev, curr) => { return prev + (curr.x * curr.x); }, 0);
  const numerator = (length * xySum) - (xSum * ySum);
  const denominator = (length * xSqSum) - (xSum * ySum);
  const slope = numerator / denominator;
  return slope || null; // convert possible NaN to `null` for JSON-friendliness
}

/*
 * Calculation rules per type
 */
function calculateMetrics(type, partialBucketFilter) {
  // Rich statistics calculated only for nodes. Indices only needs lastVal
  let minVal;
  let maxVal;
  let slope;
  let lastVal;

  const calculators = {

    nodes: function (buckets, metric) {
      const results = _.chain(buckets)
      .filter(partialBucketFilter) // buckets with whole start/end time range
      .map(mapChartData(metric)) // calculate metric as X/Y
      .value();

      minVal = _.min(_.pluck(results, 'y'));
      maxVal = _.max(_.pluck(results, 'y'));
      slope = calcSlope(results);
      lastVal = _.last(_.pluck(results, 'y'));

      return { minVal, maxVal, slope, lastVal };
    },

    indices: function (buckets, metric) {
      // just find the last whole bucket
      let currentBucket;
      let idx = buckets.length - 1;
      while (idx > -1) {
        currentBucket = buckets[idx];
        if (currentBucket.doc_count > 0 && partialBucketFilter(currentBucket)) {
          // found the last whole bucket
          break;
        }
        idx -= 1;
      }

      // the y-val can't be undefined, or else table column sorting won't work
      lastVal = mapChartData(metric)(currentBucket).y || 0;

      return { minVal, maxVal, slope, lastVal };
    }

  };

  return calculators[type];
}

function reduceMetrics(options) {
  const { item, type, min, max, bucketSize } = options;
  const partialBucketFilter = filterPartialBuckets(min, max, bucketSize, { ignoreEarly: true });
  const metricCalculator = calculateMetrics(type, partialBucketFilter);

  const reducers = {

    nodes(metricName) {
      const metric = metrics[metricName];
      const buckets = item[metricName].buckets;
      const { minVal, maxVal, slope, lastVal } = metricCalculator(buckets, metric);
      return {
        metric: pickMetricFields(metric),
        min: minVal,
        max: maxVal,
        slope: slope,
        last: lastVal
      };
    },

    indices(metricName) {
      const metric = metrics[metricName];
      const buckets = item[metricName].buckets;
      const { lastVal } = metricCalculator(buckets, metric);
      return {
        metric: pickMetricFields(metric),
        last: lastVal
      };
    }

  };

  return reducers[type];
}

function getMappedMetrics(options) {
  const reducer = reduceMetrics(options);
  return options.listingMetrics.reduce((mapped, metricName) => {
    // add the new metric to the set and return
    return {
      [metricName]: { ...reducer(metricName) },
      ...mapped
    };
  }, {});
}

export function mapResponse(options) {
  return options.items.map((item) => {
    return {
      name: item.key,
      metrics: getMappedMetrics({ item, ...options })
    };
  });
};
