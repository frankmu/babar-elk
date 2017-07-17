import { get } from 'lodash';
import { createQuery } from '../create_query';
import { ElasticsearchMetric } from '../metrics/metric_classes';

/**
 * Get statistics about selected Elasticsearch clusters, for the selected {@code product}.
 *
 * @param {Object} req The incoming request
 * @param {Array} clusterUuids The string Cluster UUIDs to fetch details for
 * @param {Date} start Start time to limit the stats
 * @param {Date} end End time to limit the stats
 * @param {String} product The product to limit too ('kibana', 'logstash', 'beats')
 * @return {Promise} Object keyed by the cluster UUIDs to make grouping easier.
 */
export function getHighLevelStats(req, clusterUuids, start, end, product) {
  return fetchHighLevelStats(req, clusterUuids, start, end, product)
  .then(response => handleHighLevelStatsResponse(response, product));
}

/**
 * Fetch the high level stats to report for the {@code product}.
 *
 * @param {Object} req The request object
 * @param {Array} indices The indices to use for the request
 * @param {Array} clusterUuids Cluster UUIDs to limit the request against
 * @param {Date} start Start time to limit the stats
 * @param {Date} end End time to limit the stats
 * @param {String} product The product to limit too ('kibana', 'logstash', 'beats')
 * @return {Promise} Response for the instances to fetch detailed for the product.
 */
export function fetchHighLevelStats(req, clusterUuids, start, end, product) {
  const config = req.server.config();
  const size = config.get('xpack.monitoring.max_bucket_size');
  const params = {
    index: config.get(`xpack.monitoring.${product}.index_pattern`),
    filterPath: [
      'hits.hits._source.cluster_uuid',
      `hits.hits._source.${product}_stats.${product}.version`
    ],
    body: {
      size,
      query: createQuery({
        start,
        end,
        metric: ElasticsearchMetric.getMetricFields(),
        filters: [ { terms: { cluster_uuid: clusterUuids } } ]
      }),
      collapse: {
        // a more ideal field would be the concatenation of the uuid + transport address for duped UUIDs (copied installations)
        field: `${product}_stats.${product}.uuid`
      },
      sort: [
        { 'timestamp': 'desc' }
      ]
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params);
}

/**
 * Determine common, high-level details about the current product (e.g., Kibana) from the {@code response}.
 *
 * @param {Object} response The response from the aggregation
 * @param {String} product The product to limit too ('kibana', 'logstash', 'beats')
 * @return {Object} Object keyed by the cluster UUIDs to make grouping easier.
 */
export function handleHighLevelStatsResponse(response, product) {
  const instances = get(response, 'hits.hits', []);
  const clusterMap = groupInstancesByCluster(instances, product);

  const clusters = {};

  for (const [clusterUuid, cluster] of clusterMap.entries()) {
    const versions = [];

    // remap the versions into something more digestable that won't blowup mappings:
    // versions: [
    //   { version: '5.4.0', count: 2 },
    //   { version: '5.5.0', count: 1 }
    // ]
    for (const [version, count] of cluster.versions.entries()) {
      versions.push({ version, count });
    }

    // map stats for product by cluster so that it can be joined with ES cluster stats
    // {
    //   count: 3,
    //   versions: [
    //     { version: '5.4.0', count: 2 },
    //     { version: '5.5.0', count: 1 }
    //   ]
    // }
    clusters[clusterUuid] = {
      count: cluster.count,
      versions
    };
  }

  return clusters;
}

/**
 * Group the instances (hits) by clusters.
 *
 * @param  {Array} instances Array of hits from the request containing the cluster UUID and version.
 * @param {String} product The product to limit too ('kibana', 'logstash', 'beats')
 * @return {Map} A map of the Cluster UUID to an {@link Object} containing the {@code count} and {@code versions} {@link Map}
 */
function groupInstancesByCluster(instances, product) {
  const clusterMap = new Map();

  // hits are sorted arbitrarily by product UUID
  instances.map(instance => {
    const clusterUuid = get(instance, '_source.cluster_uuid');
    const version = get(instance, `_source.${product}_stats.${product}.version`);

    // put the instance into the right cluster map
    if (clusterUuid) {
      let cluster = clusterMap.get(clusterUuid);

      if (!cluster) {
        cluster = { count: 0, versions: new Map() };
        clusterMap.set(clusterUuid, cluster);
      }

      // keep track of how many instances there are
      cluster.count++;

      if (version) {
        let versionCount = cluster.versions.get(version);
        if (!versionCount) {
          versionCount = 0;
        }
        cluster.versions.set(version, versionCount + 1);
      }
    }
  });

  return clusterMap;
}
