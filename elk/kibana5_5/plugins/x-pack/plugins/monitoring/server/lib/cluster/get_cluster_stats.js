import { notFound } from 'boom';
import { getClustersStats } from './get_clusters_stats';

/**
 * This will fetch the cluster stats and cluster state as a single object for the cluster specified by the {@code req}.
 *
 * @param  {Object} req The incoming user's request
 * @param  {String} esIndexPattern The Elasticsearch index pattern
 * @return {Promise} A promise containing a single cluster.
 */
export function getClusterStats(req, esIndexPattern) {
  if (!req.params.clusterUuid) {
    throw notFound('clusterUuid not specified');
  }

  return getClustersStats(req, esIndexPattern)
  .then(clusters => {
    if (!clusters || clusters.length === 0) {
      throw notFound('cluster not found');
    }

    return clusters[0];
  });
}
