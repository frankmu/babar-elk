import { get } from 'lodash';
import { createQuery } from '../create_query';
import { ElasticsearchMetric } from '../metrics/metric_classes';

export function getClusterLicense(req, clusterUuid) {
  const config = req.server.config();
  const clusterCheckParams = {
    index: config.get('xpack.monitoring.elasticsearch.index_pattern'),
    filterPath: 'hits.hits._source.license',
    body: {
      size: 1,
      sort: { timestamp: { order: 'desc' } },
      query: createQuery({
        type: 'cluster_stats',
        uuid: clusterUuid,
        metric: ElasticsearchMetric.getMetricFields()
      })
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', clusterCheckParams)
  .then(response => {
    return get(response, 'hits.hits[0]._source.license', {});
  });
}
