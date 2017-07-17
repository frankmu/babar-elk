import Promise from 'bluebird';
import Joi from 'joi';
import { getClusterStats } from '../../../../lib/cluster/get_cluster_stats';
import { getClusterStatus } from '../../../../lib/cluster/get_cluster_status';
import { getShardStats } from '../../../../lib/elasticsearch/get_shard_stats';
import { calculateClusterShards } from '../../../../lib/cluster/calculate_cluster_shards';
import { getMlJobs } from '../../../../lib/elasticsearch/get_ml_jobs';
import { handleError } from '../../../../lib/handle_error';

export function mlJobRoutes(server) {
  server.route({
    method: 'POST',
    path: '/api/monitoring/v1/clusters/{clusterUuid}/elasticsearch/ml_jobs',
    config: {
      validate: {
        params: Joi.object({
          clusterUuid: Joi.string().required()
        }),
        payload: Joi.object({
          timeRange: Joi.object({
            min: Joi.date().required(),
            max: Joi.date().required()
          }).required()
        })
      }
    },
    handler: (req, reply) => {
      const config = server.config();
      const esIndexPattern = config.get('xpack.monitoring.elasticsearch.index_pattern');

      return getClusterStats(req, esIndexPattern)
      .then(cluster => {
        return Promise.props({
          clusterStatus: getClusterStatus(cluster),
          shardStats: getShardStats(req, esIndexPattern, cluster), // for unassigned shards count in status bar
          rows: getMlJobs(req, esIndexPattern)
        });
      })
      .then(calculateClusterShards) // also for unassigned shards count in status bar
      .then(reply)
      .catch(err => reply(handleError(err, req)));
    }
  });
};
