import queue from 'queue';
import { oncePerServer } from '../../../../server/lib/once_per_server';
import { screenshot } from './screenshot';
import { createTaggedLogger } from '../../../../server/lib/create_tagged_logger';


function getScreenshotFn(server) {
  const config = server.config();

  const logger = createTaggedLogger(server, ['reporting', 'debug']);

  const phantomPath = server.plugins.reporting.phantom.binary;
  const captureSettings = config.get('xpack.reporting.capture');
  const screenshotSettings = { basePath: config.get('server.basePath'), imagePath: config.get('path.data') };
  const captureConcurrency = captureSettings.concurrency;
  logger(`Screenshot concurrency: ${captureConcurrency}`);

  // init the screenshot module
  const ss = screenshot(phantomPath, captureSettings, screenshotSettings, logger);

  // create the process queue
  const screenshotQueue = queue({ concurrency: captureConcurrency });

  return function getScreenshot(objUrl, type, headers) {
    return new Promise(function (resolve, reject) {
      screenshotQueue.push(function (cb) {
        return ss.capture(objUrl, {
          headers
        })
        .then((result) => {
          resolve(result);
          cb();
        }, (err) => {
          screenshotQueue.end(err);
          reject(err);
          cb();
        });
      });

      if (!screenshotQueue.running) screenshotQueue.start();
    });
  };
}

export const getScreenshotFactory = oncePerServer(getScreenshotFn);
