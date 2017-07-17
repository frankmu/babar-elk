/*
 * Processes Shard Data on Indexes to calculate number of shards per Index
 *  - Count of Total Primary and Replica Shards
 *  - Count of Unassigned Primary and Replica Shards
 *  - Counts of each type of Shards per Index
 */
import { filter, get } from 'lodash';
import { getLatestAggKey, getNodeAttribute } from './node_agg_vals';

function createNewMetric() {
  return {
    status: 'green',
    primary: 0,
    replica: 0,
    unassigned: {
      replica: 0,
      primary: 0
    }
  };
};

function setStats(bucket, metric, ident) {
  const states = filter(bucket.states.buckets, ident);
  states.forEach((state) => {
    metric.primary = state.primary.buckets.reduce((prev, curr) => {
      if (curr.key) { prev += curr.doc_count; }
      return prev;
    }, metric.primary);
    metric.replica = state.primary.buckets.reduce((prev, curr) => {
      if (!curr.key) { prev += curr.doc_count; }
      return prev;
    }, metric.replica);
  });
}

/*
 * Get a default data object to decorate for processing
 */
export function getDefaultDataObject() {
  return {
    nodes: {},
    indices: {
      totals: {
        primary: 0,
        replica: 0,
        unassigned: { replica: 0, primary: 0 }
      }
    }
  };
}

// Mutate "data" with a nodes object having a field for every node
export function normalizeNodeShards(nodes, nodeResolver) {
  return (bucket) => {
    if (bucket.key && bucket.node_transport_address && bucket.node_ids) {
      nodes[bucket.key] = {
        shardCount: bucket.doc_count,
        indexCount: get(bucket, 'index_count.value'),
        name: getLatestAggKey(get(bucket, 'node_names.buckets')),
        transport_address: getLatestAggKey(bucket.node_transport_address.buckets),
        node_ids: bucket.node_ids.buckets.map(b => b.key),
        attributes: {
          data: getNodeAttribute(bucket.node_data_attributes.buckets),
          master: getNodeAttribute(bucket.node_master_attributes.buckets)
        }
      };
      nodes[bucket.key].resolver = nodes[bucket.key][nodeResolver];
    }
  };
}

export function normalizeIndexShards(indices) {
  return (bucket) => {
    const metric = createNewMetric();
    setStats(bucket, metric, { key: 'STARTED' });
    setStats(bucket, metric.unassigned, (b) => b.key !== 'STARTED' && b.key !== 'RELOCATING');
    indices.totals.primary += metric.primary;
    indices.totals.replica += metric.replica;
    indices.totals.unassigned.primary += metric.unassigned.primary;
    indices.totals.unassigned.replica += metric.unassigned.replica;
    if (metric.unassigned.replica) { metric.status = 'yellow'; }
    if (metric.unassigned.primary) { metric.status = 'red'; }
    indices[bucket.key] = metric;
  };
};
