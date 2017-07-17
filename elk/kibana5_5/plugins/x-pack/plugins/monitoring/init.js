import Promise from 'bluebird';
import { join } from 'path';
import { requireAllAndApply } from '../../server/lib/require_all_and_apply';
import { esHealthCheck } from './server/es_client/health_check';
import { instantiateClient } from './server/es_client/instantiate_client';
import { initKibanaMonitoring } from './server/kibana_monitoring';
import { initMonitoringXpackInfo } from './server/init_monitoring_xpack_info';
import { checkLicenseGenerator } from './server/cluster_alerts/check_license';

/**
 * Initialize the Kibana Monitoring plugin by starting up asynchronous server
 * tasks, based on user-defined configuration
 * - webserver route handling
 * - monitoring cluster health checker
 * - instantiation of an elasticsearch-js client exposed as a server plugin object
 * - start kibana ops monitoring loop
 * - start monitoring cluster x-pack license and features check loop
 * @param monitoringPlugin {Object} Monitoring UI plugin
 * @param server {Object} HapiJS server instance
 */
export const init = (monitoringPlugin, server) => {
  const xpackMainPlugin = server.plugins.xpack_main;
  xpackMainPlugin.status.once('green', async () => {
    const config = server.config();
    const uiEnabled = config.get('xpack.monitoring.ui.enabled');
    const reportStats = config.get('xpack.monitoring.report_stats');
    const features = [];

    if (uiEnabled || reportStats) {
      // Instantiate the dedicated ES client
      features.push(instantiateClient(server));

      if (uiEnabled) {
        const xpackApiPollingFrequency = config.get('xpack.monitoring.xpack_api_polling_frequency_millis');
        const xpackInfo = await initMonitoringXpackInfo(server, xpackApiPollingFrequency, 'monitoring');
        // route handlers depend on xpackInfo (exposed as server.plugins.monitoring.info)
        server.expose('info', xpackInfo);
        server.plugins.monitoring.info.feature('monitoring').registerLicenseCheckResultsGenerator(checkLicenseGenerator);

        // Require all routes needed for UI
        features.push(requireAllAndApply(join(__dirname, 'server', 'routes', '**', '*.js'), server));
      } else {
        // Require only routes needed for stats reporting
        features.push(requireAllAndApply(join(__dirname, 'server', 'routes', '**', 'phone_home.js'), server));
      }

      // Make sure the Monitoring index is created and ready
      features.push(esHealthCheck(monitoringPlugin, server).start());
    }

    // Send Kibana server ops to the monitoring bulk api
    if (config.get('xpack.monitoring.kibana.collection.enabled')) {
      features.push(initKibanaMonitoring(monitoringPlugin.kbnServer, server));
    }

    Promise.all(features);
  });
};
