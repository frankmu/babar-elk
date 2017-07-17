import { get } from 'lodash';
import { INVALID_LICENSE } from '../../../common/constants';
import { checkParam } from '../error_missing_required';
import { createQuery } from '../create_query';
import { ElasticsearchMetric } from '../metrics/metric_classes';
import { validateMonitoringLicense } from './validate_monitoring_license';

export function getClusters(req, esIndexPattern) {
  checkParam(esIndexPattern, 'esIndexPattern in getClusters');

  const config = req.server.config();
  // Get the params from the POST body for the request
  const start = req.payload.timeRange.min;
  const end = req.payload.timeRange.max;
  const metric = ElasticsearchMetric.getMetricFields();
  const filters = [];
  if (req.params.clusterUuid) {
    filters.push({ term: { cluster_uuid: req.params.clusterUuid } });
  }

  const params = {
    index: esIndexPattern,
    ignore: [404],
    filterPath: [
      'hits.hits._source.cluster_uuid',
      'hits.hits._source.cluster_name',
      'hits.hits._source.version',
      'hits.hits._source.license',
      'hits.hits._source.cluster_stats',
      'hits.hits._source.cluster_state'
    ],
    body: {
      size: config.get('xpack.monitoring.max_bucket_size'),
      query: createQuery({ type: 'cluster_stats', start, end, metric, filters }),
      collapse: {
        field: 'cluster_uuid'
      },
      sort: { timestamp: { order: 'desc' } }
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params)
  .then(response => {
    const hits = get(response, 'hits.hits', []);

    return hits
    .map(hit => {
      const cluster = get(hit, '_source');

      if (cluster) {
        if (!validateMonitoringLicense(cluster.cluster_uuid, cluster.license)) {
          // "invalid" license allow deleted/unknown license clusters to show in UI
          cluster.license = INVALID_LICENSE;
        }
      }

      return cluster;
    })
    .filter(Boolean);
  });
};
