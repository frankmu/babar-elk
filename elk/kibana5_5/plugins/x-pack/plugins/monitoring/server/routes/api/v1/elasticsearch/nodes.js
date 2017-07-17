import { get, isUndefined } from 'lodash';
import Promise from 'bluebird';
import Joi from 'joi';
import { getClusterStats } from '../../../../lib/cluster/get_cluster_stats';
import { getClusterStatus } from '../../../../lib/cluster/get_cluster_status';
import { calculateClusterShards } from '../../../../lib/cluster/calculate_cluster_shards';
import { getNodes } from '../../../../lib/elasticsearch/get_nodes';
import { getShardStats } from '../../../../lib/elasticsearch/get_shard_stats';
import { calculateNodeType } from '../../../../lib/elasticsearch/calculate_node_type';
import { getNodeTypeClassLabel } from '../../../../lib/elasticsearch/get_node_type_class_label';
import { getDefaultNodeFromId } from '../../../../lib/elasticsearch/get_default_node_from_id';
import { handleError } from '../../../../lib/handle_error';

export function nodesRoutes(server) {
  server.route({
    method: 'POST',
    path: '/api/monitoring/v1/clusters/{clusterUuid}/elasticsearch/nodes',
    config: {
      validate: {
        params: Joi.object({
          clusterUuid: Joi.string().required()
        }),
        payload: Joi.object({
          timeRange: Joi.object({
            min: Joi.date().required(),
            max: Joi.date().required()
          }).required(),
          listingMetrics: Joi.array().required()
        })
      }
    },
    handler: (req, reply) => {
      const config = server.config();
      const esIndexPattern = config.get('xpack.monitoring.elasticsearch.index_pattern');

      return getClusterStats(req, esIndexPattern)
      .then(cluster => {
        return Promise.props({
          cluster,
          clusterStatus: getClusterStatus(cluster),
          listing: getNodes(req, esIndexPattern),
          shardStats: getShardStats(req, esIndexPattern, cluster)
        });
      })
      // Add the index status to each index from the shardStats
      .then((body) => {
        const clusterState = get(body, 'cluster.cluster_state', { nodes: {} });

        body.nodes = body.listing.nodes;
        body.rows = body.listing.rows;

        body.rows.forEach((row) => {
          const resolver = row.name;
          const shardStats = body.shardStats.nodes[resolver];
          let node = body.nodes[resolver];

          // Add some extra metrics
          row.metrics.shard_count = shardStats && shardStats.shardCount || 0;
          row.metrics.index_count = shardStats && shardStats.indexCount || 0;

          // copy some things over from nodes to row
          row.resolver = resolver;
          row.online = !isUndefined(clusterState.nodes[row.resolver]);
          if (!node) {
            // workaround for node indexed with legacy agent
            node = getDefaultNodeFromId(resolver);
          }
          node.type = calculateNodeType(node, get(clusterState, 'master_node'));
          row.node = node;
          delete row.name;

          // set type for labeling / iconography
          const { nodeType, nodeTypeLabel, nodeTypeClass } = getNodeTypeClassLabel(row.node);
          row.node.type = nodeType;
          row.node.nodeTypeLabel = nodeTypeLabel;
          row.node.nodeTypeClass = nodeTypeClass;
        });

        delete body.listing;
        delete body.cluster;

        return body;
      })
      // Send the response
      .then(calculateClusterShards)
      .then(reply)
      .catch(err => reply(handleError(err, req)));
    }
  });

};
