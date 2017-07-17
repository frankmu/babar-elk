import { get, merge } from 'lodash';
import Promise from 'bluebird';
import Joi from 'joi';
import { getClusterStats } from '../../../../lib/cluster/get_cluster_stats';
import { getClusterStatus } from '../../../../lib/cluster/get_cluster_status';
import { calculateClusterShards } from '../../../../lib/cluster/calculate_cluster_shards';
import { getNodeSummary } from '../../../../lib/elasticsearch/get_node_summary';
import { getShardStats } from '../../../../lib/elasticsearch/get_shard_stats';
import { getShardAllocation } from '../../../../lib/elasticsearch/get_shard_allocation';
import { getDefaultNodeFromId } from '../../../../lib/elasticsearch/get_default_node_from_id';
import { calculateNodeType } from '../../../../lib/elasticsearch/calculate_node_type';
import { getNodeTypeClassLabel } from '../../../../lib/elasticsearch/get_node_type_class_label';
import { getMetrics } from '../../../../lib/details/get_metrics';
import { handleError } from '../../../../lib/handle_error';

export function nodeRoutes(server) {
  server.route({
    method: 'POST',
    path: '/api/monitoring/v1/clusters/{clusterUuid}/elasticsearch/nodes/{resolver}',
    config: {
      validate: {
        params: Joi.object({
          clusterUuid: Joi.string().required(),
          resolver: Joi.string().required()
        }),
        payload: Joi.object({
          showSystemIndices: Joi.boolean().default(false), // show/hide system indices in shard allocation table
          timeRange: Joi.object({
            min: Joi.date().required(),
            max: Joi.date().required()
          }).required(),
          metrics: Joi.array().required(),
          shards: Joi.boolean().default(true)
        })
      }
    },
    handler: (req, reply) => {
      const resolver = req.params.resolver;
      const showSystemIndices = req.payload.showSystemIndices;
      const collectShards = req.payload.shards;
      const config = server.config();
      const esIndexPattern = config.get('xpack.monitoring.elasticsearch.index_pattern');

      return getClusterStats(req, esIndexPattern)
      .then(cluster => {
        const configResolver = `source_node.${config.get('xpack.monitoring.node_resolver')}`;
        let shards;
        if (collectShards) {
          shards = getShardAllocation(req, esIndexPattern, [{ term: { [configResolver]: resolver } }], cluster, showSystemIndices);
        }
        return Promise.props({
          clusterStatus: getClusterStatus(cluster),
          nodeSummary: getNodeSummary(req, esIndexPattern),
          metrics: getMetrics(req, esIndexPattern, [{ term: { [configResolver]: resolver } }]),
          shards,
          shardStats: getShardStats(req, esIndexPattern, cluster),
          nodes: {},
          cluster
        });
      })
      .then(calculateClusterShards)
      .then(body => {
        const clusterState = get(body, 'cluster.cluster_state', { nodes: {} });
        let nodeDetail = body.nodeSummary.node;
        if (!nodeDetail) {
          // workaround for node indexed with legacy agent
          nodeDetail = getDefaultNodeFromId(resolver);
        }
        nodeDetail.type = calculateNodeType(nodeDetail, get(clusterState, 'master_node'));
        body.nodes[resolver] = nodeDetail;

        // set type for labeling / iconography
        const { nodeType, nodeTypeLabel, nodeTypeClass } = getNodeTypeClassLabel(nodeDetail);
        nodeDetail.type = nodeType;
        nodeDetail.nodeTypeLabel = nodeTypeLabel;
        nodeDetail.nodeTypeClass = nodeTypeClass;

        body.nodeSummary.totalShards = get(body, `shardStats.nodes['${resolver}'].shardCount`);
        body.nodeSummary.indexCount = get(body, `shardStats.nodes['${resolver}'].indexCount`);

        // combine data from different sources into 1 object
        body.nodeSummary = merge(body.nodeSummary, nodeDetail);

        body.nodeSummary.status = 'Online';
        // If this node is down
        if (!clusterState.nodes[body.nodeSummary.resolver]) {
          body.nodeSummary.documents = 'N/A';
          body.nodeSummary.dataSize = 'N/A';
          body.nodeSummary.freeSpace = 'N/A';
          body.nodeSummary.documents = 'N/A';
          body.nodeSummary.indexCount = 'N/A';
          body.nodeSummary.totalShards = 'N/A';
          body.nodeSummary.status = 'Offline';
        }
        delete body.clusterState;
        return body;
      })
      .then(reply)
      .catch(err => reply(handleError(err, req)));
    }
  });

};
