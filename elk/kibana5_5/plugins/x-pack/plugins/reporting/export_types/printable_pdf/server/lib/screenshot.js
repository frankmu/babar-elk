import path from 'path';
import getPort from 'get-port';
import Puid from 'puid';
import { phantom } from '../../../../server/lib/phantom/index';

const puid = new Puid();
const noop = function () {};

class Screenshot {
  constructor(phantomPath, captureSettings, screenshotSettings, logger) {
    this.phantomPath = phantomPath;
    this.captureSettings = captureSettings;
    this.screenshotSettings = screenshotSettings;
    this.logger = logger || noop;
  }

  async capture(url, opts) {
    this.logger(`fetching screenshot of ${url}`);
    opts = Object.assign({ basePath: this.screenshotSettings.basePath }, opts);

    const phantomInstance = await createPhantom(this.phantomPath, this.captureSettings, this.logger);

    try {
      const itemSelector = '[data-shared-item]';
      const itemsCountAttribute = 'data-shared-items-count';

      await loadUrl(phantomInstance, url, itemSelector, itemsCountAttribute, this.captureSettings, opts);

      const isTimepickerEnabled = await getElementDoesExist(phantomInstance, '[data-shared-timefilter=true]');

      const attributes = { title: 'data-title', description: 'data-description' };
      const elementsPositionAndAttributes = await getElementsPositionAndAttributes(phantomInstance, itemSelector, attributes);

      const screenshots = [];
      for (const item of elementsPositionAndAttributes) {
        const filepath = getTargetFile(this.screenshotSettings.imagePath);
        await phantomInstance.screenshot(filepath, item.position);
        screenshots.push({
          filepath: filepath,
          title: item.attributes.title,
          description: item.attributes.description
        });
      }
      this.logger(`Screenshots saved to ${screenshots.map(s => s.filepath)}`);
      return { isTimepickerEnabled, screenshots };
    } catch (err) {
      this.logger(err);
      throw err;
    } finally {
      phantomInstance.destroy();
    }
  }
}

function createPhantom(phantomPath, captureSettings, logger) {
  const { timeout } = captureSettings;

  return Promise.resolve(getPort())
  .then(port => {
    return phantom.create({
      ignoreSSLErrors: true,
      phantomPath: phantomPath,
      bridgePort: port,
      timeout,
      logger
    });
  });
}

function loadUrl(phantomInstance, url, elementSelector, itemsCountAttribute, captureSettings, opts) {
  const { timeout, viewport, zoom, loadDelay, settleTime } = captureSettings;
  const waitForSelector = '.application';

  return phantomInstance.open(url, {
    headers: opts.headers,
    waitForSelector,
    timeout,
    zoom,
  })
  .then(() => {
    return phantomInstance.evaluate(function (basePath) {
      // inject custom CSS rules
      function injectCSS(cssPath) {
        const node = document.createElement('link');
        node.rel = 'stylesheet';
        node.href = cssPath;
        document.getElementsByTagName('head')[0].appendChild(node);
      };

      injectCSS(basePath + '/plugins/reporting/styles/reporting-overrides.css');
    }, opts.basePath);
  })
  .then(() => {
    // the dashboard is using the `itemsCountAttribute` attribute to let us
    // know how many items to expect since gridster incrementally adds panels
    // we have to use this hint to wait for all of them
    return phantomInstance.waitForSelector(`${elementSelector},[${itemsCountAttribute}]`);
  })
  .then(() => {
    // returns the value of the `itemsCountAttribute` if it's there, otherwise
    // we just count the number of `elementSelector`
    return phantomInstance.evaluate(function (selector, countAttribute) {
      const elementWithCount = document.querySelector(`[${countAttribute}]`);
      if (elementWithCount) {
        return parseInt(elementWithCount.getAttribute(countAttribute));
      }

      return document.querySelectorAll(selector).length;
    }, elementSelector, itemsCountAttribute);
  })
  .then(async (visCount) => {
    // waiting for all of the visualizations to be in the DOM
    await phantomInstance.waitFor(function (selector) {
      return document.querySelectorAll(selector).length;
    }, visCount, elementSelector);
    return visCount;
  })
  .then((visCount) => {
    // we set the viewport of PhantomJS based on the number of visualizations
    // so that when we position them with fixed-positioning below, they're all visible
    return phantomInstance.setViewport({
      width: viewport.width,
      height: viewport.height * visCount
    });
  })
  .then(() => {
    function positionElements(selector, height, width) {
      const visualizations = document.querySelectorAll(selector);
      const visCount = visualizations.length;

      for (let i = 0; i < visCount; i++) {
        const visualization = visualizations[i];
        const style = visualization.style;
        style.position = 'fixed';
        style.top = `${height * i}px`;
        style.left = 0;
        style.width = `${width}px`;
        style.height = `${height}px`;
        style.zIndex = 1;
        style.backgroundColor = 'inherit';
      }
    }

    return phantomInstance.evaluate(positionElements, elementSelector, viewport.height / zoom, viewport.width / zoom);
  })
  .then(() => {
    // since we're currently using fixed positioning, we set the scroll position
    // to make sure that when we grab the element positioning information that
    // it's now skewed by a scroll that we aren't using
    return phantomInstance.setScrollPosition({ top: 0, left: 0 });
  })
  .then(() => {
    // this is run in phantom
    function listenForComplete(selector, visLoadDelay, visLoadTimeout, visSettleTime) {
      // wait for visualizations to finish loading
      const visualizations = document.querySelectorAll(selector);
      const visCount = visualizations.length;
      const renderedTasks = [];

      // used when visualizations have a render-count attribute
      function waitForRenderCount(visualization) {
        return new Promise(function (resolve, reject) {
          const CHECK_DELAY = 300;
          const start = Date.now();
          let lastRenderCount = 0;

          (function checkRenderCount() {
            const renderCount = parseInt(visualization.getAttribute('render-counter'));

            // if the timeout has exceeded, abort and reject
            if ((start + visLoadTimeout) < Date.now()) {
              return reject(new Error('Visualization took too long to load'));
            }

            // vis has rendered at least once
            if (renderCount > 0) {
              // resolve once the current and previous render count match
              if (renderCount === lastRenderCount) {
                return resolve();
              }

              // if they don't match, wait for the visualization to settle and try again
              lastRenderCount = renderCount;
              return setTimeout(checkRenderCount, visSettleTime);
            }

            setTimeout(checkRenderCount, CHECK_DELAY);
          }());
        });
      }

      // timeout resolution, used when visualizations don't have a render-count attribute
      function waitForRenderDelay() {
        return new Promise(function (resolve) {
          setTimeout(resolve, visLoadDelay);
        });
      }

      for (let i = 0; i < visCount; i++) {
        const visualization = visualizations[i];
        const renderCounter = visualization.getAttribute('render-counter');

        if (renderCounter !== 'disabled') {
          renderedTasks.push(waitForRenderCount(visualization));
        } else {
          renderedTasks.push(waitForRenderDelay());
        }
      }

      return Promise.all(renderedTasks);
    }

    return phantomInstance.evaluate(listenForComplete, elementSelector, loadDelay, timeout, settleTime);
  });
};

function getElementDoesExist(phantomInstance, timefilterSelector) {
  return phantomInstance.evaluate(function (selector) {
    return document.querySelector(selector) !== null;
  }, timefilterSelector);
}

function getElementsPositionAndAttributes(phantomInstance, elementsSelector, elementAttributes) {
  return phantomInstance.evaluate(function (selector, attributes) {
    const elements = document.querySelectorAll(selector);

    // NodeList isn't an array, just an iterator, unable to use .map/.forEach
    const results = [];
    for (const element of elements) {
      results.push({
        position: {
          boundingClientRect: element.getBoundingClientRect(),
          scroll: {
            x: window.scrollX,
            y: window.scrollY
          }
        },
        attributes: Object.keys(attributes).reduce((result, key) => {
          const attribute = attributes[key];
          result[key] = element.getAttribute(attribute);
          return result;
        }, {})
      });
    }
    return results;

  }, elementsSelector, elementAttributes);
}

export function screenshot(phantomPath, captureSettings, screenshotSettings, logger) {
  return new Screenshot(phantomPath, captureSettings, screenshotSettings, logger);
}

function getTargetFile(imagePath) {
  return path.join(imagePath, `screenshot-${puid.generate()}.png`);
}
