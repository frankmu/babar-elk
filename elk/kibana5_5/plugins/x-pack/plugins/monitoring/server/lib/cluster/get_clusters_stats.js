import { getClusters } from './get_clusters';
import { getClustersState } from './get_clusters_state';

/**
 * This will fetch the cluster stats and cluster state as a single object per cluster.
 *
 * @param  {Object} req The incoming user's request
 * @param  {String} esIndexPattern The Elasticsearch index pattern
 * @return {Promise} A promise containing an array of clusters.
 */
export function getClustersStats(req, esIndexPattern) {
  return getClusters(req, esIndexPattern)
  .then(clusters => getClustersState(req, esIndexPattern, clusters));
}
