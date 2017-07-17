import { get, forEach } from 'lodash';
import Promise from 'bluebird';
import Joi from 'joi';
import { getClusterStats } from '../../../../lib/cluster/get_cluster_stats';
import { getClusterStatus } from '../../../../lib/cluster/get_cluster_status';
import { calculateClusterShards } from '../../../../lib/cluster/calculate_cluster_shards';
import { getIndexSummary } from '../../../../lib/elasticsearch/get_index_summary';
import { getShardStats } from '../../../../lib/elasticsearch/get_shard_stats';
import { getShardAllocation } from '../../../../lib/elasticsearch/get_shard_allocation';
import { getMetrics } from '../../../../lib/details/get_metrics';
import { handleError } from '../../../../lib/handle_error';

export function indexRoutes(server) {

  server.route({
    method: 'POST',
    path: '/api/monitoring/v1/clusters/{clusterUuid}/elasticsearch/indices/{id}',
    config: {
      validate: {
        params: Joi.object({
          clusterUuid: Joi.string().required(),
          id: Joi.string().required()
        }),
        payload: Joi.object({
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
      const id = req.params.id;
      const collectShards = req.payload.shards;
      const config = req.server.config();
      const esIndexPattern = config.get('xpack.monitoring.elasticsearch.index_pattern');

      return getClusterStats(req, esIndexPattern)
      .then(cluster => {
        const showSystemIndices = true; // hardcode to true, because this could be a system index
        let shards;
        if (collectShards) {
          shards = getShardAllocation(req, esIndexPattern, [{ term: { 'shard.index': id } }], cluster, showSystemIndices);
        }
        return Promise.props({
          clusterStatus: getClusterStatus(cluster),
          indexSummary:  getIndexSummary(req, esIndexPattern),
          metrics: getMetrics(req, esIndexPattern, [{ term: { 'index_stats.index': id } }]),
          shards,
          shardStats: getShardStats(req, esIndexPattern, cluster)
        });
      })
      .then(calculateClusterShards)
      .then(body => {
        const shardStats = body.shardStats.indices[id];
        // check if we need a legacy workaround for Monitoring 2.0 node data
        if (shardStats) {
          body.indexSummary.unassignedShards = shardStats.unassigned.primary + shardStats.unassigned.replica;
          body.indexSummary.totalShards = shardStats.primary + shardStats.replica + body.indexSummary.unassignedShards;
          body.indexSummary.status = shardStats.status;
          body.indexSummary.shardStats = shardStats;
        } else {
          body.indexSummary.status = 'Not Available';
          body.indexSummary.totalShards = 'N/A';
          body.indexSummary.unassignedShards = 'N/A';
          body.indexSummary.documents = 'N/A';
          body.indexSummary.dataSize = 'N/A';
        }
        const shardNodes = get(body, 'shardStats.nodes');
        body.nodes = {};
        forEach(shardNodes, (shardNode, resolver) => {
          body.nodes[resolver] = shardNode;
        });
        return body;
      })
      .then(reply)
      .catch(err => reply(handleError(err, req)));
    }
  });

};
