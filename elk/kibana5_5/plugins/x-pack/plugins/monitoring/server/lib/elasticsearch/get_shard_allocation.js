import _ from 'lodash';
import { checkParam } from '../error_missing_required';
import { createQuery } from '../create_query';
import { ElasticsearchMetric } from '../metrics/metric_classes';

export function getShardAllocation(req, esIndexPattern, filters, lastState, showSystemIndices = false) {
  checkParam(esIndexPattern, 'esIndexPattern in elasticsearch/getShardAllocation');

  filters.push({
    term: { state_uuid: _.get(lastState, 'cluster_state.state_uuid') }
  });

  if (!showSystemIndices) {
    filters.push({
      bool: { must_not: [
        { prefix: { 'shard.index': '.' } }
      ] }
    });
  }


  const config = req.server.config();
  const uuid = req.params.clusterUuid;
  const metric = ElasticsearchMetric.getMetricFields();
  const params = {
    index: esIndexPattern,
    body: {
      size: config.get('xpack.monitoring.max_bucket_size'),
      query: createQuery({ type: 'shards', uuid, metric, filters })
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params)
  .then((resp) => {
    const hits = _.get(resp, 'hits.hits');
    if (!hits) { return []; }
    // map into object with shard and source properties
    return hits.map(doc => _.merge(doc._source.shard, {
      resolver: _.get(doc, `_source.source_node[${config.get('xpack.monitoring.node_resolver')}]`)
    }));
  });
};
