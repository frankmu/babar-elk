import { get } from 'lodash';
import { callWithRequestFactory } from '../../../lib/call_with_request_factory';
import { isEsErrorFactory } from '../../../lib/is_es_error_factory';
import { wrapEsError, wrapUnknownError } from '../../../lib/error_wrappers';
import { licensePreRoutingFactory } from'../../../lib/license_pre_routing_factory';
import { WatchStatus } from '../../../models/watch_status';

function activateWatch(callWithRequest, watchId) {
  return callWithRequest('watcher.activateWatch', {
    id: watchId
  });
}

export function registerActivateRoute(server) {

  const isEsError = isEsErrorFactory(server);
  const licensePreRouting = licensePreRoutingFactory(server);

  server.route({
    path: '/api/watcher/watch/{watchId}/activate',
    method: 'PUT',
    handler: (request, reply) => {
      const callWithRequest = callWithRequestFactory(server, request);

      const { watchId } = request.params;

      return activateWatch(callWithRequest, watchId)
      .then(hit => {
        const watchStatusJson = get(hit, 'status') || get(hit, '_status');
        const json = {
          id: watchId,
          watchStatusJson: watchStatusJson
        };

        const watchStatus = WatchStatus.fromUpstreamJSON(json);
        reply({ watchStatus: watchStatus.downstreamJSON });
      })
      .catch(err => {

        // Case: Error from Elasticsearch JS client
        if (isEsError(err)) {
          const statusCodeToMessageMap = {
            404: `Watch with id = ${watchId} not found`
          };
          return reply(wrapEsError(err, statusCodeToMessageMap));
        }

        // Case: default
        reply(wrapUnknownError(err));
      });
    },
    config: {
      pre: [ licensePreRouting ]
    }
  });
}
