import Joi from 'joi';
import { alertsClusterSearch } from '../../../../cluster_alerts/alerts_cluster_search';
import { checkLicense } from '../../../../cluster_alerts/check_license';
import { getClusterLicense } from '../../../../lib/cluster/get_cluster_license';

/*
 * Cluster Alerts route.
 */
export function clusterAlertsRoute(server) {
  server.route({
    method: 'POST',
    path: '/api/monitoring/v1/clusters/{clusterUuid}/alerts',
    config: {
      validate: {
        params: Joi.object({
          clusterUuid: Joi.string().required()
        })
      }
    },
    handler(req, reply) {
      const clusterUuid = req.params.clusterUuid;

      return getClusterLicense(req, clusterUuid)
      .then(license => alertsClusterSearch(req, { cluster_uuid: clusterUuid, license }, checkLicense))
      .then(reply);
    }
  });
};
