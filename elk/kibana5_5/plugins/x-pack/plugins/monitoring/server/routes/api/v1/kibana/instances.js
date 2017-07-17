import Joi from 'joi';
import Promise from 'bluebird';
import { get } from 'lodash';
import { getKibanas } from '../../../../lib/kibana/get_kibanas';
import { getKibanasForClusters } from '../../../../lib/kibana/get_kibanas_for_clusters';
import { handleError } from '../../../../lib/handle_error';
import { getMetrics } from '../../../../lib/details/get_metrics';

const getKibanaClusterStatus = function (req, kbnIndexPattern) {
  const getKibanaForCluster = getKibanasForClusters(req, kbnIndexPattern);
  return getKibanaForCluster([{ cluster_uuid: req.params.clusterUuid }])
  .then(clusterStatus => get(clusterStatus, '[0].stats'));
};

/*
 * Kibana routes
 */
export function kibanaInstancesRoutes(server) {
  /**
   * Kibana overview and listing
   */
  server.route({
    method: 'POST',
    path: '/api/monitoring/v1/clusters/{clusterUuid}/kibana',
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
          metrics: Joi.array().optional(),
          instances: Joi.boolean().default(true)
        })
      }
    },
    handler: (req, reply) => {
      const config = server.config();
      const kbnIndexPattern = config.get('xpack.monitoring.kibana.index_pattern');

      return Promise.props({
        metrics: req.payload.metrics ? getMetrics(req, kbnIndexPattern) : {},
        kibanas: req.payload.instances ? getKibanas(req, kbnIndexPattern) : [],
        clusterStatus: getKibanaClusterStatus(req, kbnIndexPattern)
      })
      .then (reply)
      .catch(err => reply(handleError(err, req)));
    }
  });
};
