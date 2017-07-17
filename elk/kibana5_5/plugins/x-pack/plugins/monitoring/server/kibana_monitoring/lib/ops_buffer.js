import {
  MONITORING_SYSTEM_API_VERSION, KIBANA_SYSTEM_ID, KIBANA_STATS_TYPE
} from '../../../common/constants';
import { mapEvent, rollupEvent } from './map_event';
import { monitoringBulk } from './monitoring_bulk';

/**
 * Manage the buffer of Kibana Ops events
 * Does the bulk upload to the `admin` cluster, which tags it and forwards it
 * to the monitoring cluster
 * @param kbnServer {Object} manager of Kibana services - see `src/server/kbn_server` in Kibana core
 * @param server {Object} HapiJS server instance
 * @return {Object} the revealed `push` and `flush` modules
 */
export function opsBuffer(kbnServer, server) {
  const config = server.config();
  const interval = config.get('xpack.monitoring.kibana.collection.interval') + 'ms';
  const monitoringTag = config.get('xpack.monitoring.loggingTag');
  const client = server.plugins.elasticsearch.getCluster('admin').createClient({
    plugins: [monitoringBulk]
  });

  let lastOp = null;

  return {
    push(event) {
      lastOp = {
        host: event.host,
        rollup: rollupEvent(event, lastOp)
      };

      server.log(['debug', monitoringTag], 'Received Monitoring event data');
    },
    flush() {
      if (!lastOp) { return; }

      // grab the last operation
      const payload = mapEvent(lastOp, config, kbnServer);
      const body = [
        // Push the time-based information to .monitoring-kibana-*
        { index: { _type: KIBANA_STATS_TYPE } },
        payload
      ];

      // reset lastOp
      lastOp = null;

      server.log(['debug', monitoringTag], 'Sending Monitoring payload to Elasticsearch');

      return client.monitoring.bulk({
        system_id: KIBANA_SYSTEM_ID,
        system_api_version: MONITORING_SYSTEM_API_VERSION,
        interval,
        body
      })
      .catch((err) => {
        server.log(['error', monitoringTag], err);
      });
    }
  };
}
