import { get } from 'lodash';
import { createQuery } from '../create_query';
import { ElasticsearchMetric } from '../metrics/metric_classes';

/**
 * Get a list of Cluster UUIDs that exist within the specified timespan.
 *
 * @param {Object} req The incoming request
 * @param {Date} start The start date to look for clusters
 * @param {Date} end The end date to look for clusters
 * @return {Array} Array of strings; one per Cluster UUID.
 */
export function getClusterUuids(req, start, end) {
  return fetchClusterUuids(req, start, end)
  .then(handleClusterUuidsResponse);
}

/**
 *
 * @param {Object} req The incoming request
 * @param {Date} start The start date to look for clusters
 * @param {Date} end The end date to look for clusters
 * @return {Promise} Object response from the aggregation.
 */
export function fetchClusterUuids(req, start, end) {
  const config = req.server.config();
  const size = config.get('xpack.monitoring.max_bucket_size');
  const params = {
    index: config.get('xpack.monitoring.elasticsearch.index_pattern'),
    ignoreUnavailable: true,
    filterPath: 'aggregations.cluster_uuids.buckets.key',
    body: {
      size: 0, // return no hits, just aggregation buckets
      query: createQuery({ type: 'cluster_stats', start, end, metric: ElasticsearchMetric.getMetricFields() }),
      aggs: {
        cluster_uuids: {
          terms: {
            field: 'cluster_uuid',
            size
          }
        }
      }
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params);
}

/**
 * Convert the aggregation response into an array of Cluster UUIDs.
 *
 * @param {Object} response The aggregation response
 * @return {Array} Strings; each representing a Cluster's UUID.
 */
export function handleClusterUuidsResponse(response) {
  const uuidBuckets = get(response, 'aggregations.cluster_uuids.buckets', []);

  return uuidBuckets.map(uuidBucket => uuidBucket.key);
}
