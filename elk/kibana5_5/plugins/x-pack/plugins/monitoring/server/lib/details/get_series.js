import _ from 'lodash';
import moment from 'moment';
import { checkParam } from '../error_missing_required';
import { metrics } from '../metrics';
import { createQuery } from '../create_query.js';
import { near } from '../calculate_auto';
import { filterPartialBuckets } from '../filter_partial_buckets';
import { pickMetricFields } from '../pick_metric_fields';

// Use the metric object as the source of truth on where to find the UUID
function getUuid(req, metric) {
  if (metric.app === 'kibana') {
    return req.params.kibanaUuid;
  } else if (metric.app === 'logstash') {
    return req.params.logstashUuid;
  }
  return req.params.clusterUuid;
}

export function getSeries(req, indexPattern, metricName, filters) {
  checkParam(indexPattern, 'indexPattern in details/getSeries');

  const metric = metrics[metricName];
  const start = req.payload.timeRange.min;
  const end = req.payload.timeRange.max;

  const params = {
    index: indexPattern,
    size: 0,
    ignoreUnavailable: true,
    body: {
      query: createQuery({
        start,
        end,
        metric,
        uuid: getUuid(req, metric),
        filters
      }),
      aggs: {}
    }
  };
  const min = moment.utc(start).valueOf();
  const max = moment.utc(end).valueOf();
  const duration = moment.duration(max - min, 'ms');
  const config = req.server.config();
  const minIntervalSeconds = config.get('xpack.monitoring.min_interval_seconds');
  const bucketSize = Math.max(minIntervalSeconds, near(100, duration).asSeconds());
  const aggs = {
    check: {
      date_histogram: {
        field: metric.timestampField,
        min_doc_count: 0,
        interval: bucketSize + 's',
        extended_bounds: { min, max }
      },
      aggs: { metric: { } },
      meta: {
        timefilterMin: min,
        timefilterMax: max,
        bucketSize: bucketSize
      }
    }
  };
  aggs.check.aggs.metric[metric.metricAgg] = {
    field: metric.field
  };
  if (metric.derivative) {
    aggs.check.aggs.metric_deriv = {
      derivative: { buckets_path: 'metric', gap_policy: 'skip' }
    };
  }
  if (metric.aggs) {
    _.assign(aggs.check.aggs, metric.aggs);
  }
  params.body.aggs = aggs;

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params)
  .then(function (resp) {
    if (!resp.aggregations)  {
      // dead code here?
      return {
        metric: pickMetricFields(metric),
        data: []
      };
    }
    const aggCheck = resp.aggregations.check;
    const respBucketSize = aggCheck.meta.bucketSize;
    const key = (metric.derivative) ? 'metric_deriv' : 'metric';
    const defaultCalculation = (bucket) => {
      let value =  bucket[key] && bucket[key].value || 0;
      // convert metric_deriv from the bucket size to seconds if units == '/s'
      if (metric.units === '/s') {
        value = value / respBucketSize;
      }
      // negatives suggest derivatives that have been reset (usually due to restarts that reset the count)
      return Math.max(value, 0);
    };

    const calculationFn = metric && metric.calculation || defaultCalculation;
    function calculation(bucket) {
      if (bucket.doc_count > 0) {
        return calculationFn(bucket);
      }
      return null;
    }

    const buckets = aggCheck.buckets;
    const boundsMin = moment.utc(aggCheck.meta.timefilterMin);
    const boundsMax = moment.utc(aggCheck.meta.timefilterMax);
    const data = _.chain(buckets)
    .filter(filterPartialBuckets(boundsMin, boundsMax, respBucketSize))
    // if bucket has a doc count, map it to X/Y coords for charting. Otherwise null makes the line discontinuous
    .map(bucket => {
      return [ bucket.key, calculation(bucket) ]; // jquery flot data format
    })
    .value();
    return {
      metric: pickMetricFields(metric),
      data
    };
  });
};
