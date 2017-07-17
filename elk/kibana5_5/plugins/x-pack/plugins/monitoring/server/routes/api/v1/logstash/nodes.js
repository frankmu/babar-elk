import Joi from 'joi';
import Promise from 'bluebird';
import { getClusterStatus } from '../../../../lib/logstash/get_cluster_status';
import { getNodes } from '../../../../lib/logstash/get_nodes';
import { handleError } from '../../../../lib/handle_error';

/*
 * Logstash Nodes route.
 */
export function logstashNodesRoute(server) {
  /**
   * Logtash Nodes request.
   *
   * This will fetch all data required to display the Logstash Nodes page.
   *
   * The current details returned are:
   *
   * - Logstash Cluster Status
   * - Nodes list
   */
  server.route({
    method: 'POST',
    path: '/api/monitoring/v1/clusters/{clusterUuid}/logstash/nodes',
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
      const logstashIndexPattern = config.get('xpack.monitoring.logstash.index_pattern');

      return Promise.props({
        nodes: getNodes(req, logstashIndexPattern),
        clusterStatus: getClusterStatus(req, logstashIndexPattern, 'route-node-listing')
      })
      .then (reply)
      .catch(err => reply(handleError(err, req)));
    }
  });

};
