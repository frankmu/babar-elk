import { mapRequests } from './map_requests';
import { mapResponseTimes } from './map_response_times';
import { mapConcurrentConnections } from './map_concurrent_connections';
import moment from 'moment';
import v8 from 'v8';

import _ from 'lodash';

function secondsToMilliseconds(seconds) {
  return seconds * 1000;
}

const snapshotRegex = /-snapshot/i;
// rollup functions are for objects with unpredictable keys (e.g., {'200': 1, '201': 2} + {'200':2} = {'200': 3, '201': 2})
const maxRollup = _.partialRight(_.assign, (latest, prev) => _.max([latest, prev]));
const sumRollup = _.partialRight(_.assign, (latest, prev) => _.sum([latest, prev]));

/**
 * Some components of the {@code event} need to be combined with any previous
 * events that haven't been sent in order to not lose information if the
 * collection interval is faster than the flushing interval.
 *
 * @param event {Object} The current event
 * @param lastOp {Object} The previous event details
 * @return {Object} data combined from `event` and `lastOp`
 */
export function rollupEvent(event, lastOp) {
  const heapStats = v8.getHeapStatistics();
  const requests = mapRequests(event.requests);
  const rollup = _.get(lastOp, 'rollup');
  return {
    concurrent_connections: _.sum([ mapConcurrentConnections(event.concurrents), _.get(rollup, 'concurrent_connections') ]),
    // memory/os stats use the latest event's details
    os: {
      load: {
        '1m': event.osload[0],
        '5m': event.osload[1],
        '15m': event.osload[2]
      },
      memory: {
        total_in_bytes: event.osmem.total,
        free_in_bytes: event.osmem.free,
        used_in_bytes: event.osmem.total - event.osmem.free
      },
      uptime_in_millis: secondsToMilliseconds(event.osup)
    },
    process: {
      event_loop_delay: _.sum([ event.psdelay, _.get(rollup, 'process.event_loop_delay') ]),
      memory: {
        heap: {
          total_in_bytes: event.psmem.heapTotal,
          used_in_bytes: event.psmem.heapUsed,
          size_limit: heapStats.heap_size_limit
        },
        resident_set_size_in_bytes: event.psmem.rss
      },
      uptime_in_millis: secondsToMilliseconds(event.psup)
    },
    requests: {
      disconnects: _.sum([ requests.disconnects, _.get(rollup, 'requests.disconnects') ]),
      total: _.sum([ requests.total, _.get(rollup, 'requests.total') ]),
      status_codes: sumRollup(requests.status_codes, _.get(rollup, 'requests.status_codes'))
    },
    response_times: maxRollup(mapResponseTimes(event.responseTimes), _.get(rollup, 'response_times')),
    timestamp: moment.utc().toISOString()
  };
}

/**
 * Some components of the {@code event} need to be combined with any previous
 * events that haven't been sent in order to not lose information if the
 * collection interval is faster than the flushing interval.
 *
 * @param lastOp {Object} The current, rolled-up event details
 * @param config {Object} HapiJS server.config
 * @param kbnServer {Object} manager of Kibana services - see `src/server/kbn_server` in Kibana core
 * @return {Object} mapped event data
 */
export function mapEvent(lastOp, config, kbnServer) {
  const status = kbnServer.status.toJSON();
  const { host, rollup } = lastOp;
  return {
    kibana: {
      uuid: config.get('server.uuid'),
      name: config.get('server.name'),
      host: host,
      transport_address: `${config.get('server.host')}:${config.get('server.port')}`,
      version: kbnServer.version.replace(snapshotRegex, ''),
      snapshot: snapshotRegex.test(kbnServer.version),
      status: _.get(status, 'overall.state')
    },
    ...rollup
  };
}
