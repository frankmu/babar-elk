import moment from 'moment';
import { checkParam } from '../error_missing_required';
import { ElasticsearchMetric } from '../metrics/metric_classes';
import { createQuery } from '../create_query.js';
import { near } from '../calculate_auto';
import { getAggItems } from '../lists/get_agg_items';
import { mapResponse } from '../lists/map_response';

/* Run an aggregation on index_stats to get stat data for the selected time
 * range for esIndexPattern. The stat data is built up with passed-in
 * options that are given by the UI client as an array
 * (req.payload.listingMetrics). Every option is a key to a configuration value
 * in server/lib/metrics. Those options are used to build up a query with a
 * bunch of date histograms.
 *
 * After the result comes back from Elasticsearch, we process the date
 * histogram data with mapResponse to transform it into X/Y coordinates
 * for charting. This method is shared by the get_listing_nodes lib.
 */
export function getIndices(req, esIndexPattern, showSystemIndices = false) {
  checkParam(esIndexPattern, 'esIndexPattern in elasticsearch/getIndices');

  const config = req.server.config();
  const listingMetrics = req.payload.listingMetrics || [];

  const min = moment.utc(req.payload.timeRange.min).valueOf();
  const max = moment.utc(req.payload.timeRange.max).valueOf();
  const duration = moment.duration(max - min, 'ms');

  const minIntervalSeconds = config.get('xpack.monitoring.min_interval_seconds');
  const bucketSize = Math.max(minIntervalSeconds, near(100, duration).asSeconds());
  const aggItems = getAggItems({ listingMetrics, bucketSize, min, max });

  const filters = [];
  if (!showSystemIndices) {
    filters.push({
      bool: { must_not: [
        { prefix: { 'index_stats.index': '.' } }
      ] }
    });
  }

  const uuid = req.params.clusterUuid;
  const metricFields = ElasticsearchMetric.getMetricFields();
  const params = {
    index: esIndexPattern,
    size: 0,
    ignoreUnavailable: true,
    body: {
      query: createQuery({
        type: 'index_stats',
        start: min,
        end: max,
        uuid,
        metric: metricFields,
        filters
      }),
      aggs: {
        items: {
          terms: { field: 'index_stats.index', size: config.get('xpack.monitoring.max_bucket_size') },
          aggs: aggItems
        }
      }
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params)
  .then(resp => {
    if (!resp.hits.total) {
      return [];
    }

    // call the mapping
    return mapResponse({
      type: 'indices',
      items: resp.aggregations.items.buckets,
      listingMetrics,
      min,
      max,
      bucketSize
    });
  });
};
