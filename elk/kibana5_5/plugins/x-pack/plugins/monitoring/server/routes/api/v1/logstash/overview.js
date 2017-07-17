import Joi from 'joi';
import Promise from 'bluebird';
import { getClusterStatus } from '../../../../lib/logstash/get_cluster_status';
import { getMetrics } from '../../../../lib/details/get_metrics';
import { handleError } from '../../../../lib/handle_error';

/*
 * Logstash Overview route.
 */
export function logstashOverviewRoute(server) {
  /**
   * Logstash Overview request.
   *
   * This will fetch all data required to display the Logstash Overview page.
   *
   * The current details returned are:
   *
   * - Logstash Cluster Status
   * - Metrics
   */
  server.route({
    method: 'POST',
    path: '/api/monitoring/v1/clusters/{clusterUuid}/logstash',
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
          metrics: Joi.array().required()
        })
      }
    },
    handler: (req, reply) => {
      const config = server.config();
      const logstashIndexPattern = config.get('xpack.monitoring.logstash.index_pattern');

      return Promise.props({
        metrics: getMetrics(req, logstashIndexPattern),
        clusterStatus: getClusterStatus(req, logstashIndexPattern, 'route-logstash-overview')
      })
      .then (reply)
      .catch(err => reply(handleError(err, req)));
    }
  });
};
