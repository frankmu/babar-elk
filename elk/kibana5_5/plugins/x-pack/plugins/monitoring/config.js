import { XPACK_INFO_API_DEFAULT_POLL_FREQUENCY_IN_MILLIS } from '../../server/lib/constants';

/**
 * User-configurable settings for xpack.monitoring via configuration schema
 * @param {Object} Joi - HapiJS Joi module that allows for schema validation
 * @return {Object} config schema
 */
export const config = (Joi) => {
  const { array, boolean, number, object, string } = Joi;
  const DEFAULT_REQUEST_HEADERS = [ 'authorization' ];

  return object({
    enabled: boolean().default(true),
    ui: object({
      enabled: boolean().default(true),
      container: object({
        elasticsearch: object({
          enabled: boolean().default(false)
        }).default(),
        logstash: object({
          enabled: boolean().default(false)
        }).default()
      }).default()
    }).default(),
    // deprecated; will be removed in 6.0
    chart: object({
      elasticsearch: object({
        index: object({
          index_memory: array().items(string().valid(
            'index_mem_doc_values',
            'index_mem_fixed_bit_set',
            'index_mem_norms',
            'index_mem_points',
            'index_mem_stored_fields',
            'index_mem_term_vectors',
            'index_mem_terms',
            'index_mem_versions',
            'index_mem_writer',
            'index_mem_fielddata',
            'index_mem_query_cache',
            'index_mem_request_cache'
          )).max(3).unique().single().default([
            'index_mem_terms',
            'index_mem_points'
          ])
        }).default(),
        node: object({
          index_memory: array().items(string().valid(
            'node_index_mem_doc_values',
            'node_index_mem_fixed_bit_set',
            'node_index_mem_norms',
            'node_index_mem_points',
            'node_index_mem_stored_fields',
            'node_index_mem_term_vectors',
            'node_index_mem_terms',
            'node_index_mem_versions',
            'node_index_mem_writer',
            'node_index_mem_fielddata',
            'node_index_mem_query_cache',
            'node_index_mem_request_cache'
          )).max(3).unique().single().default([
            'node_index_mem_terms',
            'node_index_mem_points'
          ])
        }).default()
      }).default()
    }).default(),
    loggingTag: string().default('monitoring-ui'),
    index_pattern: string().default('.monitoring-*-2-*,.monitoring-*-6-*'),
    kibana: object({
      index_pattern: string().default('.monitoring-kibana-2-*,.monitoring-kibana-6-*'),
      collection: object({
        enabled: boolean().default(true),
        interval: number().default(10000)
      }).default()
    }).default(),
    logstash: object({
      index_pattern: string().default('.monitoring-logstash-2-*,.monitoring-logstash-6-*')
    }).default(),
    cluster_alerts: object({
      enabled: boolean().default(true),
      index: string().default('.monitoring-alerts-2,.monitoring-alerts-6')
    }).default(),
    xpack_api_polling_frequency_millis: number().default(XPACK_INFO_API_DEFAULT_POLL_FREQUENCY_IN_MILLIS),
    missing_intervals: number().default(12),
    max_bucket_size: number().default(10000),
    min_interval_seconds: number().default(10),
    show_license_expiration: boolean().default(true),
    report_stats: boolean().default(true),
    node_resolver: string().regex(/^(?:transport_address|name|uuid)$/).default('uuid'),
    stats_report_url: Joi.when('$dev', { // `when` can't be deconstructed
      is: true,
      then: string().default('../api/monitoring/v1/phone-home'),
      otherwise: string().default('https://marvel-stats.elasticsearch.com/appdata/marvelOpts')
    }),
    agent: object({
      interval: string().regex(/[\d\.]+[yMwdhms]/).default('10s')
    }).default(),
    elasticsearch: object({
      customHeaders: object().default({}),
      index_pattern: string().default('.monitoring-es-2-*,.monitoring-es-6-*'),
      logQueries: boolean().default(false),
      requestHeadersWhitelist: array().items().single().default(DEFAULT_REQUEST_HEADERS),
      url: string().uri({ scheme: ['http', 'https'] }), // if empty, use Kibana's connection config
      username: string(),
      password: string(),
      requestTimeout: number().default(30000),
      pingTimeout: number().default(30000),
      ssl: object({
        verificationMode: string().valid('none', 'certificate', 'full').default('full'),
        certificateAuthorities: array().single().items(string()),
        certificate: string(),
        key: string(),
        keyPassphrase: string()
      }).default(),
      apiVersion: string().default('master'),
      engineVersion: string().valid('^6.0.0').default('^6.0.0')
    }).default()
  }).default();
};
