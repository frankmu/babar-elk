import { bindKey, once } from 'lodash';
import { monitoringBulk } from '../kibana_monitoring/lib/monitoring_bulk';

/* Provide a dedicated Elasticsearch client for Monitoring
 * The connection options can be customized for the Monitoring application
 * This allows the app to connect to a decidated monitoring cluster even if
 * Kibana itself is connected to a production cluster.
 */

export function exposeClient(server) {
  const loggingTag = server.config().get('xpack.monitoring.loggingTag');
  const Logger = server.plugins.elasticsearch.ElasticsearchClientLogging;
  const logQueries = Boolean(server.config().get('xpack.monitoring.elasticsearch.logQueries'));

  class MonitoringClientLogging extends Logger {
    constructor() {
      super();

      this.tags = [loggingTag];
      this.logQueries = logQueries;
    }
  }

  let config = Object.assign({}, server.config().get('xpack.monitoring.elasticsearch'));
  let configSource = 'monitoring';

  if (!Boolean(config.url)) {
    config = server.config().get('elasticsearch');
    configSource = 'production';
  }

  config.log = MonitoringClientLogging;
  config.plugins = [monitoringBulk];

  const esPlugin = server.plugins.elasticsearch;
  const cluster = esPlugin.createCluster('monitoring', config);
  server.on('close', bindKey(cluster, 'close'));

  server.log([loggingTag, 'es-client'], `config sourced from: ${configSource} cluster (${config.url})`);
}


export const instantiateClient = once(exposeClient);
