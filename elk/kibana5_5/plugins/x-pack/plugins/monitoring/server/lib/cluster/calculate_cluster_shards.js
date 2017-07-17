export function calculateClusterShards(body) {
  const indices = body.shardStats.indices;

  body.clusterStatus.unassignedShards = indices.totals.unassigned.replica + indices.totals.unassigned.primary;
  body.clusterStatus.totalShards = body.clusterStatus.totalShards + body.clusterStatus.unassignedShards;

  return body;
}
