import { get } from 'lodash';
import { checkParam } from '../error_missing_required';
import { getLogstashForClusters } from './get_logstash_for_clusters';

/**
 * Get the cluster status for Logstash instances.
 * The cluster status should only be displayed on cluster-wide pages. Individual Logstash nodes should show the node's status only.
 * Shared functionality between the different routes.
 *
 * @param req {Object} The incoming request.
 * @param logstashIndexPattern {String} The Logstash pattern to query for the current time range.
 * @returns The cluster status object.
 */
export function getClusterStatus(req, logstashIndexPattern) {
  checkParam(logstashIndexPattern, 'logstashIndexPattern in logstash/getClusterStatus');

  const getLogstashForCluster = getLogstashForClusters(req, logstashIndexPattern);
  return getLogstashForCluster([{ cluster_uuid: req.params.clusterUuid }])
  .then(clusterStatus => get(clusterStatus, '[0].stats'));
}
