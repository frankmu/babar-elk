import Promise from 'bluebird';
import elasticsearch from 'elasticsearch';
import { kibanaVersion } from './kibana_version';
import { ensureNotTribe } from './ensure_not_tribe';
import { ensureEsVersion } from './ensure_es_version';

const NoConnections = elasticsearch.errors.NoConnections;
const NO_INDEX = 'no_index';
const INITIALIZING = 'initializing';
const READY = 'ready';

export function esHealthCheck(monitoringPlugin, server) {
  const { callWithInternalUser } = server.plugins.elasticsearch.getCluster('monitoring');
  const config = server.config();
  const REQUEST_DELAY = config.get('elasticsearch.healthCheck.delay');
  function getHealth() {
    return callWithInternalUser('cluster.health', {
      timeout: '5s',
      index: config.get('xpack.monitoring.index_pattern'),
      ignore: [408]
    })
    .then(resp => {
      // if "timed_out" === true then elasticsearch could not
      // find any idices matching our filter within 5 seconds
      if (!resp || resp.timed_out) {
        return NO_INDEX;
      }

      // "red" status means shards are not ready for queries
      if (resp.status === 'red') {
        return INITIALIZING;
      }

      return READY;
    });
  }

  function waitForPong() {
    return callWithInternalUser('ping')
    .catch(err => {
      if (!(err instanceof NoConnections)) { throw err; }

      const elasticsearchUrl = config.get('xpack.monitoring.elasticsearch.url') || config.get('elasticsearch.url');
      monitoringPlugin.status.red(`Unable to connect to Elasticsearch at ${elasticsearchUrl}.`);
      return Promise.delay(REQUEST_DELAY).then(waitForPong);
    });
  }

  function waitForShards() {
    return getHealth()
    .then(health => {
      if (health === NO_INDEX) {
        // UI will show a "waiting for data" screen
      }
      if (health === INITIALIZING) {
        monitoringPlugin.status.red('Elasticsearch is still initializing the Monitoring indices');
        return Promise.delay(REQUEST_DELAY)
        .then(waitForShards);
      }
      // otherwise we are g2g
      monitoringPlugin.status.green('Ready');
    });
  }

  let timeoutId = null;

  function check() {
    return waitForPong()
    .then(() => {
      // execute version and tribe checks in parallel
      // but always report the version check result first
      const versionPromise = ensureEsVersion(server, kibanaVersion.get());
      const tribePromise = ensureNotTribe(callWithInternalUser);
      return versionPromise.then(() => tribePromise);
    })
    .then(waitForShards)
    .catch(err => monitoringPlugin.status.red(err));
  }

  function scheduleCheck(ms) {
    if (timeoutId) { return; }
    const myId = setTimeout(() => {
      check().finally(() => {
        if (timeoutId === myId) { startOrRestartChecking(); }
      });
    }, ms);
    timeoutId = myId;
  }

  function stopChecking() {
    if (!timeoutId) { return false; }
    clearTimeout(timeoutId);
    timeoutId = null;
    return true;
  }

  function startOrRestartChecking() {
    scheduleCheck(stopChecking() ? REQUEST_DELAY : 1);
  }


  return {
    start() {
      monitoringPlugin.status.yellow('Waiting for Monitoring Health Check');
      startOrRestartChecking();
    }
  };
};
