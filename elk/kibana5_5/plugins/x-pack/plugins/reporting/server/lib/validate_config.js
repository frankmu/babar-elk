import crypto from 'crypto';

export function validateConfig(config, log) {
  const encryptionKey = config.get('xpack.reporting.encryptionKey');
  if (encryptionKey === null || encryptionKey === undefined) {
    log('Generating a random key for xpack.reporting.encryptionKey. To prevent pending reports from failing on ' +
      'restart, please set xpack.reporting.encryptionKey in kibana.yml');
    config.set('xpack.reporting.encryptionKey', crypto.randomBytes(16).toString('hex'));
  }

  // queue.syncSocketTimeout was replaced by generate.socketTimeout
  const syncSocketTimeout = config.get('xpack.reporting.queue.syncSocketTimeout');
  if (syncSocketTimeout != null) {
    log('xpack.reporting.queue.syncSocketTimeout has been deprecated.');
  }

  // generate.socketTimeout is depricated and going away in 6.0
  const socketTimeout = config.get('xpack.reporting.generate.socketTimeout');
  if (socketTimeout) {
    log('The "&sync" parameter and xpack.reporting.generate.socketTimeout setting have been deprecated ' +
      'and will be removed in 6.0.');
  }
}
