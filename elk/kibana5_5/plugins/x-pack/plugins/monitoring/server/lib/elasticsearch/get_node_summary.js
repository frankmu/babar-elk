import _ from 'lodash';
import { checkParam } from '../error_missing_required';
import { createQuery } from '../create_query.js';
import { ElasticsearchMetric } from '../metrics/metric_classes';

export function getNodeSummary(req, esIndexPattern) {
  checkParam(esIndexPattern, 'esIndexPattern in elasticsearch/getNodeSummary');

  // Get the params from the POST body for the request
  const config = req.server.config();
  const end = req.payload.timeRange.max;
  const uuid = req.params.clusterUuid;

  // Build up the Elasticsearch request
  const metric = ElasticsearchMetric.getMetricFields();
  const filters = [{
    term: { [`source_node.${config.get('xpack.monitoring.node_resolver')}`]: req.params.resolver }
  }];
  const params = {
    index: esIndexPattern,
    ignore: [404],
    body: {
      size: 1,
      sort: { timestamp: { order: 'desc' } },
      query: createQuery({ type: 'node_stats', end, uuid, metric, filters })
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params)
  .then((resp) => {
    const summary = { documents: 0, dataSize: 0, freeSpace: 0, node: { attributes: {} } };
    const nodeStats = _.get(resp, 'hits.hits[0]._source.node_stats');
    if (nodeStats) {
      summary.documents = _.get(nodeStats, 'indices.docs.count');
      summary.dataSize = _.get(nodeStats, 'indices.store.size_in_bytes');
      summary.freeSpace = _.get(nodeStats, 'fs.total.available_in_bytes');
      summary.usedHeap = _.get(nodeStats, 'jvm.mem.heap_used_percent');

      const nodes = resp.hits.hits.map(hit => hit._source.source_node);
      // using [0] value because query results are sorted desc per timestamp
      summary.node = {
        resolver: nodes[0][config.get('xpack.monitoring.node_resolver')],
        node_ids: nodes.map(node => node.uuid),
        name: nodes[0].name,
        transport_address: nodes[0].transport_address,
        ip: nodes[0].ip,
        attributes: nodes[0].attributes
      };
    }
    return summary;
  });
};
