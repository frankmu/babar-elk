import { opsBuffer } from './lib/ops_buffer';
import { get } from 'lodash';

/**
 * Establish a handler of Ops events (from `even-better`)
 * Puts the event data into a buffer
 * @param kbnServer {Object} manager of Kibana services - see `src/server/kbn_server` in Kibana core
 * @param server {Object} HapiJS server instance
 */
export function initKibanaMonitoring(kbnServer, server) {
  const config = server.config();
  const monitoringTag = config.get('xpack.monitoring.loggingTag');

  const { callWithInternalUser } = server.plugins.elasticsearch.getCluster('admin');
  callWithInternalUser('transport.request', {
    method: 'GET',
    path: '/_xpack'
  })
  .then((res) => {
    const isEnabledInAdminCluster = !!get(res, 'features.monitoring.enabled');
    if (isEnabledInAdminCluster) {
      const buffer = opsBuffer(kbnServer, server);
      const onOps = event => buffer.push(event);
      let monitor;
      let opsHandler;
      const init = () => {
        monitor = server.plugins['even-better'].monitor;
        monitor.on('ops', onOps);
        opsHandler = setInterval(() => buffer.flush(), config.get('xpack.monitoring.kibana.collection.interval'));
      };
      const cleanup = () => {
        if (monitor) {
          monitor.removeListener('ops', onOps);
          clearInterval(opsHandler);
        }
      };

      server.plugins.elasticsearch.status.on('green', init);
      server.plugins.elasticsearch.status.on('red', cleanup);

      // `process` is a NodeJS global, and is always available without using require/import
      process.on('SIGHUP', () => {
        server.log(['info', monitoringTag], 'Re-initializing Kibana Monitoring due to SIGHUP');
        /* This timeout is a temporary stop-gap until collecting stats is not bound to even-better
         * and collecting stats is not interfered by logging configuration reloading
         * Related to https://github.com/elastic/x-pack-kibana/issues/1301
         */
        setTimeout(() => {
          cleanup();
          init();
          server.log(['info', monitoringTag], 'Re-initialized Kibana Monitoring due to SIGHUP');
        }, 5 * 1000); // wait 5 seconds to avoid race condition with reloading logging configuration
      });
    }
  })
  .catch(() => {
    server.log(['warning', monitoringTag], 'Unable to retrieve X-Pack info. Kibana monitoring will be disabled.');
  });
}
