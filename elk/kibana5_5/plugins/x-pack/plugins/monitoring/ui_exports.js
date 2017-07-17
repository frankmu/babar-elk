/**
 * Configuration of dependency objects for the UI, which are needed for the
 * Monitoring UI app (injectVars) and views and data for outside the monitoring
 * app (injectDefaultVars and hacks)
 * @return {Object} data per Kibana plugin uiExport schema
 */
export const uiExports = {
  app: {
    title: 'Monitoring',
    order: 9002,
    description: 'Monitoring for Elastic Stack',
    icon: 'plugins/monitoring/icons/monitoring.svg',
    main: 'plugins/monitoring/monitoring',
    injectVars(server) {
      const config = server.config();
      return {
        maxBucketSize: config.get('xpack.monitoring.max_bucket_size'),
        minIntervalSeconds: config.get('xpack.monitoring.min_interval_seconds'),
        kbnIndex: config.get('kibana.index'),
        esApiVersion: config.get('elasticsearch.apiVersion'),
        esShardTimeout: config.get('elasticsearch.shardTimeout'),
        showLicenseExpiration: config.get('xpack.monitoring.show_license_expiration'),
        showCgroupMetricsElasticsearch: config.get('xpack.monitoring.ui.container.elasticsearch.enabled'),
        showCgroupMetricsLogstash: config.get('xpack.monitoring.ui.container.logstash.enabled')
      };
    },
  },
  injectDefaultVars(server) {
    const config = server.config();
    return {
      statsReportUrl: config.get('xpack.monitoring.stats_report_url'),
      reportStats: config.get('xpack.monitoring.report_stats'),
      monitoringUiEnabled: config.get('xpack.monitoring.ui.enabled')
    };
  },
  hacks: [
    'plugins/monitoring/hacks/welcome_banner',
    'plugins/monitoring/hacks/phone_home_trigger',
    'plugins/monitoring/hacks/toggle_app_link_in_nav'
  ]
};
