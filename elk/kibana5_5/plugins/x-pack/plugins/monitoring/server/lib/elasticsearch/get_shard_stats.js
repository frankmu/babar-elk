import { get, forEach } from 'lodash';
import { checkParam } from '../error_missing_required';
import { createQuery } from '../create_query';
import { calculateNodeType } from './calculate_node_type';
import { ElasticsearchMetric } from '../metrics/metric_classes';
import { getDefaultDataObject, normalizeIndexShards, normalizeNodeShards } from './normalize_shard_objects';

export function getShardStats(req, esIndexPattern, cluster) {
  checkParam(esIndexPattern, 'esIndexPattern in elasticsearch/getShardStats');

  const config = req.server.config();
  const nodeResolver = config.get('xpack.monitoring.node_resolver');
  const uuid = req.params.clusterUuid;
  const aggSize = 10;
  const metric = ElasticsearchMetric.getMetricFields();
  const maxBucketSize = config.get('xpack.monitoring.max_bucket_size');
  const params = {
    index: esIndexPattern,
    ignore: [404],
    size: 0,
    body: {
      sort: { timestamp: { order: 'desc' } },
      query: createQuery({
        type: 'shards',
        uuid,
        metric,
        filters: [ { term: { state_uuid: get(cluster, 'cluster_state.state_uuid') } } ]
      }),
      aggs: {
        indices: {
          terms: {
            field: 'shard.index',
            size: maxBucketSize
          },
          aggs: {
            states: {
              terms: { field: 'shard.state', size: aggSize },
              aggs: { primary: { terms: { field: 'shard.primary', size: aggSize } } }
            }
          }
        },
        nodes: {
          terms: {
            field: `source_node.${nodeResolver}`,
            size: maxBucketSize
          },
          aggs: {
            index_count: { cardinality: { field: 'shard.index' } },
            node_names: {
              terms: { field: 'source_node.name', size: aggSize },
              aggs: { max_timestamp: { max: { field: 'timestamp' } } }
            },
            node_transport_address: {
              terms: { field: 'source_node.transport_address', size: aggSize },
              aggs: { max_timestamp: { max: { field: 'timestamp' } } }
            },
            node_data_attributes: { terms: { field: 'source_node.attributes.data', size: aggSize } },
            node_master_attributes: { terms: { field: 'source_node.attributes.master', size: aggSize } },
            // for doing a join on the cluster state to determine if node is current master
            node_ids: { terms: { field: 'source_node.uuid', size: aggSize } }
          },
        }
      }
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params)
  .then((resp) => {
    const data = getDefaultDataObject();

    if (resp && resp.hits && resp.hits.total !== 0) {
      resp.aggregations.indices.buckets.forEach(normalizeIndexShards(data.indices));
      resp.aggregations.nodes.buckets.forEach(normalizeNodeShards(data.nodes, nodeResolver));
    }

    forEach(data.nodes, node => {
      node.type = calculateNodeType(node, get(cluster, 'cluster_state.master_node'));
    });

    return data;
  });
};
