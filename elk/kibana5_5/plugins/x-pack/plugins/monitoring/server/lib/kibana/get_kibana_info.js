import { get, merge } from 'lodash';
import { calculateAvailability } from '../calculate_availability';

export function handleResponse(resp) {
  const source = get(resp, 'hits.hits[0]._source.kibana_stats');
  const timestamp = get(source, 'timestamp');
  const kibana = get(source, 'kibana');
  const availability = { availability: calculateAvailability(timestamp) };
  const freeMemory = { os_memory_free: get(source, 'os.memory.free_in_bytes') };
  return merge(kibana, availability, freeMemory);
}

export function getKibanaInfo(req, uuid) {
  const config = req.server.config();
  const params = {
    index: config.get('xpack.monitoring.kibana.index_pattern'),
    ignore: [404],
    body: {
      size: 1,
      query: {
        term: {
          'kibana_stats.kibana.uuid': uuid
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
