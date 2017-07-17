/*
 * ELASTICSEARCH CONFIDENTIAL
 *
 * Copyright (c) 2017 Elasticsearch BV. All Rights Reserved.
 *
 * Notice: this software, and all information contained
 * therein, is the exclusive property of Elasticsearch BV
 * and its licensors, if any, and is protected under applicable
 * domestic and foreign law, and international treaties.
 *
 * Reproduction, republication or distribution without the
 * express written consent of Elasticsearch BV is
 * strictly prohibited.
 */

/*
 * Performs a number of checks during initialization of the Ml plugin,
 * such as that Elasticsearch is running, and that the Ml searches, visualizations
 * and dashboards exist in the Elasticsearch kibana index.
 */

import Promise from 'bluebird';
import elasticsearch from 'elasticsearch';

const NoConnections = elasticsearch.errors.NoConnections;

// eslint-disable-next-line kibana-custom/no-default-export
export default function (plugin, server) {
  const config = server.config();

  // Use the admin cluster for managing the .kibana index.
  const { callWithInternalUser } = server.plugins.elasticsearch.getCluster('admin');
  const REQUEST_DELAY = config.get('elasticsearch.healthCheck.delay');

  plugin.status.yellow('Waiting for Elasticsearch');

  function waitForPong(callWithInternalUsr, url) {
    return callWithInternalUser('ping').catch(function (err) {
      if (!(err instanceof NoConnections)) {
        throw err;
      }
      plugin.status.red(`Unable to connect to Elasticsearch at ${url}.`);

      return Promise.delay(REQUEST_DELAY).then(waitForPong.bind(null, callWithInternalUsr, url));
    });
  }

  function check() {
    const healthCheck =
      waitForPong(callWithInternalUser, config.get('elasticsearch.url'));

    return healthCheck
    .then(() => {
      // ML plugin is good to go.
      plugin.status.green('Ready');
      stopChecking();
    })
    .catch(err => plugin.status.red(err));

  }

  let timeoutId = null;

  function scheduleCheck(ms) {
    if (timeoutId) {
      return;
    }

    const myId = setTimeout(() => {
      check().finally(() => {
        if (timeoutId === myId) startorRestartChecking();
      });
    }, ms);

    timeoutId = myId;
  }

  function startorRestartChecking() {
    scheduleCheck(stopChecking() ? REQUEST_DELAY : 1);
  }

  function stopChecking() {
    if (!timeoutId) {
      return false;
    }
    clearTimeout(timeoutId);
    timeoutId = null;
    return true;
  }

  return {
    run: check,
    start: startorRestartChecking,
    stop: stopChecking,
    isRunning: () => { return !!timeoutId; },
  };

};
