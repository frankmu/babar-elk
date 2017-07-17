import { get } from 'lodash';

/**
 * Get statistics for all selected Elasticsearch clusters.
 *
 * @param {Object} req The incoming request
 * @param {Array} clusterUuids The string Cluster UUIDs to fetch details for
 * @return {Promise} Array of the Elasticsearch clusters.
 */
export function getElasticsearchStats(req, clusterUuids) {
  return fetchElasticsearchStats(req, clusterUuids)
  .then(handleElasticsearchStats);
}

/**
 * Fetch the Elasticsearch stats.
 *
 * @param {Object} req The request object
 * @param {Array} clusterUuids Cluster UUIDs to limit the request against
 * @return {Promise} Response for the aggregations to fetch detaild for the product.
 */
export function fetchElasticsearchStats(req, clusterUuids) {
  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  const config = req.server.config();
  const params = {
    index: config.get('xpack.monitoring.elasticsearch.index_pattern'),
    filterPath: [
      'hits.hits._source.cluster_uuid',
      'hits.hits._source.timestamp',
      'hits.hits._source.cluster_name',
      'hits.hits._source.version',
      'hits.hits._source.license',
      'hits.hits._source.cluster_stats',
      'hits.hits._source.stack_stats'
    ],
    body: {
      size: config.get('xpack.monitoring.max_bucket_size'),
      query: {
        bool: {
          filter: [
            /*
             * Note: Unlike most places, we don't care about the old _type: cluster_stats because it would NOT
             * have the license in it (that used to be in the .monitoring-data-2 index in cluster_info)
             */
            { term: { type: 'cluster_stats' } },
            { terms: { cluster_uuid: clusterUuids } }
          ]
        }
      },
      collapse: { field: 'cluster_uuid' },
      sort: { timestamp: { order: 'desc' } }
    }
  };

  return callWithRequest(req, 'search', params);
}

/**
 * Extract the cluster stats for each cluster.
 *
 * @return {Array} The Elasticsearch clusters.
 */
export function handleElasticsearchStats(response) {
  const clusters = get(response, 'hits.hits', []);

  return clusters.map(cluster => cluster._source);
}
