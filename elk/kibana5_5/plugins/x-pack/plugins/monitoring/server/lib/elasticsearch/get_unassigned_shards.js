import { get, set } from 'lodash';

// Methods for calculating metrics for
// - Number of Primary Shards
// - Number of Replica Shards
// - Unassigned Primary Shards
// - Unassigned Replica Shards
export function getUnassignedShards(indexShardStats) {
  const returned = {};
  let unassignedShards = 0;

  unassignedShards += get(indexShardStats, 'unassigned.primary');
  unassignedShards += get(indexShardStats, 'unassigned.replica');

  // create an object in the format of a metric so it can be put into listing
  set(returned, 'metrics.index_unassigned_shards.last', unassignedShards);
  set(returned, 'metrics.index_unassigned_shards.metric.units', '');

  return returned;
};
