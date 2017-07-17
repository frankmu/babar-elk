import { once, partial } from 'lodash';
import { injectXPackInfoSignature } from './inject_xpack_info_signature';

const registerPreResponseHandlerSingleton = once((server, info) => {
  server.ext('onPreResponse', partial(injectXPackInfoSignature, info));
});

/**
 * Setup the X-Pack Main plugin. This is fired every time that the Elasticsearch plugin becomes Green.
 *
 * This will ensure that X-Pack is installed on the Elasticsearch cluster, as well as trigger the initial
 * polling for _xpack/info.
 *
 * @param server {Object} The Kibana server object.
 * @param xpackMainPlugin {Object} The X-Pack Main plugin object.
 * @return {Promise} Never {@code null}.
 */
export function setupXPackMain(server, xpackMainPlugin, xpackInfo) {
  return xpackInfo(server)
  .then(info => {
    server.expose('info', info);
    registerPreResponseHandlerSingleton(server, info);
  })
  .then(() => xpackMainPlugin.status.green('Ready'))
  .catch(reason => {
    let errorMessage = reason;

    if ((reason instanceof Error) && reason.status === 400) {
      errorMessage = 'X-Pack plugin is not installed on Elasticsearch cluster';
    }

    server.expose('info', reason.info);

    xpackMainPlugin.status.red(errorMessage);
  });
}
