import { callWithRequestFactory } from '../../../lib/call_with_request_factory';
import { Watch } from '../../../models/watch';
import { isEsErrorFactory } from '../../../lib/is_es_error_factory';
import { wrapEsError, wrapUnknownError } from '../../../lib/error_wrappers';
import { licensePreRoutingFactory } from'../../../lib/license_pre_routing_factory';

function saveWatch(callWithRequest, watch) {
  return callWithRequest('watcher.putWatch', {
    id: watch.id,
    body: watch.watch
  });
}

export function registerSaveRoute(server) {

  const isEsError = isEsErrorFactory(server);
  const licensePreRouting = licensePreRoutingFactory(server);

  server.route({
    path: '/api/watcher/watch/{id}',
    method: 'PUT',
    handler: (request, reply) => {
      const callWithRequest = callWithRequestFactory(server, request);

      const watch = Watch.fromDownstreamJSON(request.payload);

      return saveWatch(callWithRequest, watch.upstreamJSON)
      .then(reply)
      .catch(err => {

        // Case: Error from Elasticsearch JS client
        if (isEsError(err)) {
          return reply(wrapEsError(err));
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
