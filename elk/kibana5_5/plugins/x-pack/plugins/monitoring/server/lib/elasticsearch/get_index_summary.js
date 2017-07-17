import _ from 'lodash';
import { checkParam } from '../error_missing_required';
import { createQuery } from '../create_query.js';
import { ElasticsearchMetric } from '../metrics/metric_classes';

export function handleResponse(resp) {
  const sourceIndexStats = _.get(resp, 'hits.hits[0]._source.index_stats');
  return {
    documents: _.get(sourceIndexStats, 'primaries.docs.count', 0),
    dataSize: _.get(sourceIndexStats, 'total.store.size_in_bytes', 0)
  };
}

export function getIndexSummary(req, esIndexPattern) {
  checkParam(esIndexPattern, 'esIndexPattern in elasticsearch/getIndexSummary');

  // Get the params from the POST body for the request
  const end = req.payload.timeRange.max;
  const uuid = req.params.clusterUuid;

  // Build up the Elasticsearch request
  const metric = ElasticsearchMetric.getMetricFields();
  const filters = [{
    term: { 'index_stats.index': req.params.id }
  }];
  const params = {
    index: esIndexPattern,
    ignore: [404],
    body: {
      size: 1,
      sort: { timestamp: { order: 'desc' } },
      query: createQuery({ type: 'index_stats', end, uuid, metric, filters })
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params)
  .then(handleResponse);
};
