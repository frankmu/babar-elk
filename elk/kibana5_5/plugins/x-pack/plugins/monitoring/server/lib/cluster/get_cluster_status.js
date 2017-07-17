import { get } from 'lodash';

export function getClusterStatus(cluster) {
  const clusterStats = get(cluster, 'cluster_stats', {});
  const clusterNodes = get(clusterStats, 'nodes', {});
  const clusterIndices = get(clusterStats, 'indices', {});

  return {
    status: get(cluster, 'cluster_state.status', 'unknown'),
    // index-based stats
    indicesCount: get(clusterIndices, 'count', 0),
    totalShards: get(clusterIndices, 'shards.total', 0),
    documentCount: get(clusterIndices, 'docs.count', 0),
    dataSize: get(clusterIndices, 'store.size_in_bytes', 0),
    // node-based stats
    nodesCount: get(clusterNodes, 'count.total', 0),
    upTime: get(clusterNodes, 'jvm.max_uptime_in_millis', 0),
    version: get(clusterNodes, 'versions', null),
    memUsed: get(clusterNodes, 'jvm.mem.heap_used_in_bytes', 0),
    memMax: get(clusterNodes, 'jvm.mem.heap_max_in_bytes', 0)
  };
}
