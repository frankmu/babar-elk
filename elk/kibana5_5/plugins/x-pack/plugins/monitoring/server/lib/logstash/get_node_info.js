import { get, merge } from 'lodash';
import { calculateAvailability } from './../calculate_availability';

export function handleResponse(resp) {
  const source = get(resp, 'hits.hits[0]._source.logstash_stats');
  const timestamp = get(source, 'timestamp');
  const logstash = get(source, 'logstash');
  const availability = { availability: calculateAvailability(timestamp) };
  const events = { events: get(source, 'events') };
  const reloads = { reloads: get(source, 'reloads') };
  const queueType = { queue_type: get(source, 'queue.type') };
  return merge(logstash, availability, events, reloads, queueType);
}

export function getNodeInfo(req, uuid) {
  const config = req.server.config();
  const params = {
    index: config.get('xpack.monitoring.logstash.index_pattern'),
    ignore: [404],
    body: {
      size: 1,
      query: {
        term: {
          'logstash_stats.logstash.uuid': uuid
        }
      },
      sort: [
        { timestamp: { order: 'desc' } }
      ]
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params)
  .then(handleResponse);
}
