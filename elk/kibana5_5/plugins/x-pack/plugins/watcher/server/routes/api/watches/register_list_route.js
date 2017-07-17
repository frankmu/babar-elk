import { get } from 'lodash';
import { callWithRequestFactory } from '../../../lib/call_with_request_factory';
import { fetchAllFromScroll } from '../../../lib/fetch_all_from_scroll';
import { INDEX_NAMES, ES_SCROLL_SETTINGS } from '../../../../common/constants';
import { Watch } from '../../../models/watch';
import { isEsErrorFactory } from '../../../lib/is_es_error_factory';
import { wrapEsError, wrapUnknownError } from '../../../lib/error_wrappers';
import { licensePreRoutingFactory } from'../../../lib/license_pre_routing_factory';

function fetchWatches(callWithRequest) {
  const params = {
    index: INDEX_NAMES.WATCHES,
    scroll: ES_SCROLL_SETTINGS.KEEPALIVE,
    body: {
      size: ES_SCROLL_SETTINGS.PAGE_SIZE,
    },
    ignore: [404]
  };

  return callWithRequest('search', params)
  .then(response => fetchAllFromScroll(response, callWithRequest));
}

export function registerListRoute(server) {
  const isEsError = isEsErrorFactory(server);
  const licensePreRouting = licensePreRoutingFactory(server);

  server.route({
    path: '/api/watcher/watches',
    method: 'GET',
    handler: (request, reply) => {
      const callWithRequest = callWithRequestFactory(server, request);

      return fetchWatches(callWithRequest)
      .then(hits => {
        const watches = hits.map(hit => {
          const id = get(hit, '_id');
          const watchJson = get(hit, '_source');
          const watchStatusJson = get(watchJson, 'status') || get(watchJson, '_status');

          return Watch.fromUpstreamJSON({
            id,
            watchJson,
            watchStatusJson
          });
        });

        reply({
          watches: watches.map(watch => watch.downstreamJSON)
        });
      })
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
