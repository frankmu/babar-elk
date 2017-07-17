import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { fromCallback } from 'bluebird';
import driver from '@elastic/node-phantom-simple';
import { unzip, bunzip2 } from '../extract/index';
import { PHANTOM_MAX_LOAD_TIMEOUT } from '../../../common/constants';
import { transformFn } from './transform_fn';
import { getPhantomBinaryPath } from './get_phantom_binary_path';

const version = '2.1.1';
const basename = 'phantomjs-' + version;
const sourcePath = getPhantomBinaryPath();

const noop = function () {};

export const phantom = {
  install(installPath = sourcePath) {
    return new Promise((resolve, reject) => {
      const phantomPackage = _getPackage(installPath);

      try {
        fs.accessSync(phantomPackage.binary, fs.X_OK);
        resolve(phantomPackage);
      } catch (accessErr) {
        // error here means the binary does not exist, so install it
        const phantomSource = _getPackage(sourcePath);
        const fileType = phantomSource.ext.substring(1);
        const filepath = phantomSource.dir + '/' + phantomSource.base;
        let unpacker;

        switch (fileType) {
          case 'bz2':
            unpacker = bunzip2(filepath, phantomPackage.dir);
            break;
          case 'zip':
            unpacker = unzip(filepath, phantomPackage.dir);
            break;
          default:
            throw new Error(`Unable to unpack filetype: ${fileType}`);
        }

        unpacker.then(function () {
          try {
            fs.chmodSync(phantomPackage.binary, '755');
            resolve(phantomPackage);
          } catch (chmodErr) {
            reject(chmodErr);
          }
        })
        .catch(function (err) {
          reject(err);
        });
      }
    });
  },

  create(options) {
    return new Phantom(options);
  }
};

function Phantom(options) {
  const logger = options.logger || noop;

  const phantomOptions = _getPhantomOptions(options);
  const ready = fromCallback(cb => driver.create(phantomOptions, cb))
  .then(browser => {
    if (!browser) throw new Error('Phantom driver failed to initialize');
    this.browser = browser;
    return fromCallback(cb => this.browser.createPage(cb));
  })
  .then(page => {
    if (!page) throw new Error('Phantom driver failed to create the page instance');
    this.page = page;
    this.page.onConsoleMessage = (msg) => logger(msg, ['phantomConsole']);
  })
  .catch(err => {
    const message = err.toString();

    if (message.includes('Phantom immediately exited with: 126')) {
      throw new Error('Cannot execute phantom binary, incorrect format');
    }

    if (message.includes('Phantom immediately exited with: 127')) {
      throw new Error('You must install fontconfig and freetype for Reporting to work');
    }

    throw err;
  });

  return _createPhantomInstance(ready, this, {
    timeout: options.timeout
  });
}

function _createPhantomInstance(ready, ph, phantomOptions) {
  const validateInstance = () => {
    if (ph.page === false || ph.browser === false) throw new Error('Phantom instance is closed');
  };

  const configurePage = (pageOptions) => {
    const RESOURCE_TIMEOUT = 5000;

    return ready.then(() => {
      return fromCallback(cb => ph.page.set('resourceTimeout', RESOURCE_TIMEOUT, cb))
      .then(() => {
        if (pageOptions.zoom) return fromCallback(cb => ph.page.set('zoomFactor', pageOptions.zoom, cb));
      })
      .then(() => {
        if (pageOptions.headers) return fromCallback(cb => ph.page.set('customHeaders', pageOptions.headers, cb));
      });
    });
  };

  return {
    open(url, pageOptions) {
      return ready.then(() => {
        validateInstance();

        return configurePage(pageOptions)
        .then(() => fromCallback(cb => ph.page.open(url, cb)))
        .then(status => {
          if (status !== 'success') throw new Error('URL open failed. Is the server running?');
          if (pageOptions.waitForSelector) {
            return this.waitForSelector(pageOptions.waitForSelector, PHANTOM_MAX_LOAD_TIMEOUT)
            .catch(err => {
              const message = (err.message) ? err.message : err.toString();

              if (message.includes('Timeout exceeded')) {
                throw new Error(`Kibana took too long to load - ${message}`);
              }

              throw err;
            });
          }
        });
      });
    },

    setScrollPosition(position) {
      return fromCallback(cb => ph.page.set('scrollPosition', position, cb));
    },

    setViewport(size) {
      return fromCallback(cb => ph.page.set('viewportSize', size, cb));
    },

    evaluate(fn, ...args) {
      return ready.then(() => {
        validateInstance();

        const uniqId = [
          randomBytes(6).toString('base64'),
          randomBytes(9).toString('base64'),
          randomBytes(6).toString('base64'),
        ].join('-');

        return _injectPromise(ph.page)
        .then(() => {
          return fromCallback(cb => {
            ph.page.evaluate(transformFn(evaluateWrapper), transformFn(fn).toString(), uniqId, args, cb);

            // The original function is passed here as a string, and eval'd in phantom's context.
            // It's then executed in phantom's context and the result is attached to a __reporting
            // property on window. Promises can be used, and the result will be handled in the next
            // block. If the original function does not return a promise, its result is passed on.
            function evaluateWrapper(userFnStr, cbIndex, origArgs) {
              // you can't pass a function to phantom, so we pass the string and eval back into a function
              let userFn;
              eval('userFn = ' + userFnStr); // eslint-disable-line no-eval

              // keep a record of the resulting execution for future calls (used when async)
              window.__reporting = window.__reporting || {};
              window.__reporting[cbIndex] = undefined;

              // used to format the response consistently
              function done(err, res) {
                if (window.__reporting[cbIndex]) {
                  return;
                }

                const isErr = err instanceof Error;
                if (isErr) {
                  const keys = Object.getOwnPropertyNames(err);
                  err = keys.reduce(function copyErr(obj, key) {
                    obj[key] = err[key];
                    return obj;
                  }, {});
                }

                return window.__reporting[cbIndex] = {
                  err: err,
                  res: res,
                };
              }

              try {
                // execute the original function
                const res = userFn.apply(this, origArgs);

                if (res && typeof res.then === 'function') {
                  // handle async resolution via Promises
                  res.then((val) => {
                    done(null, val);
                  }, (err) => {
                    if (!(err instanceof Error)) {
                      err = new Error(err || 'Unspecified error');
                    }
                    done(err);
                  });
                  return '__promise__';
                } else {
                  // if not given a promise, execute as sync
                  return done(null, res);
                }
              } catch (err) {
                // any error during execution should be dealt with
                return done(err);
              }
            }
          })
          .then((res) => {
            // if the response is not a promise, pass it along
            if (res !== '__promise__') {
              return res;
            }

            // promise response means async, so wait for its resolution
            return this.waitFor(function (cbIndex) {
              // resolves when the result object is no longer undefined
              return !!window.__reporting[cbIndex];
            }, true, uniqId)
            .then(() => {
              // once the original promise is resolved, pass along its value
              return fromCallback(cb => {
                ph.page.evaluate(function (cbIndex) {
                  return window.__reporting[cbIndex];
                }, uniqId, cb);
              });
            });
          })
          .then((res) => {
            if (res.err) {
              // Make long/normal stack traces work
              res.err.name = res.err.name || 'Error';

              if (!res.err.stack) {
                res.err.stack = res.err.toString();
              }

              res.err.stack.replace(/\n*$/g, '\n');

              if (res.err.stack) {
                res.err.toString = function () {
                  return this.name + ': ' + this.message;
                };
              }

              return Promise.reject(res.err);
            }

            return res.res;
          });
        });
      });
    },

    wait(timeout) {
      return ready.then(() => {
        validateInstance();

        return new Promise(resolve => setTimeout(resolve, timeout));
      });
    },

    waitFor(fn, value, ...args) {
      return ready.then(() => {
        validateInstance();

        const timeout = phantomOptions.timeout || 10000;
        return this.waitForTime(fn, value, timeout, ...args);
      });
    },

    waitForSelector(selector, timeout = phantomOptions.timeout) {
      return ready.then(() => {
        validateInstance();

        return this.waitForTime(function (cssSelector) {
          return !!document.querySelector(cssSelector);
        }, true, timeout, selector);
      });
    },

    waitForTime(fn, value, timeout, ...args) {
      const INTERVAL_TIME = 250;

      if (typeof value === 'undefined') return ready.then(() => Promise.resolve());
      if (timeout < INTERVAL_TIME) timeout = INTERVAL_TIME;

      return ready.then(() => {
        validateInstance();

        return new Promise((resolve, reject) => {
          const self = this;
          const start = Date.now();

          (function waitForCheck() {
            if ((Date.now() - start) > timeout) {
              return reject(new Error(`Timeout exceeded (${timeout})`));
            }

            return self.evaluate(fn, ...args)
            .then(res => {
              if (res === value) {
                return resolve();
              }

              setTimeout(waitForCheck, INTERVAL_TIME);
            })
            .catch(err => {
              reject(err);
            });
          }());
        });
      });
    },

    async screenshot(screenshotPath, position) {
      const { boundingClientRect, scroll = { x: 0, y: 0 } } = position;

      await ready;
      validateInstance();

      const zoomFactor = await fromCallback(cb => ph.page.get('zoomFactor', cb));
      const previousClipRect = await fromCallback(cb => ph.page.get('clipRect', cb));

      const clipRect = {
        top: (boundingClientRect.top * zoomFactor) + scroll.y,
        left: (boundingClientRect.left * zoomFactor) + scroll.x,
        height: boundingClientRect.height * zoomFactor,
        width: boundingClientRect.width * zoomFactor
      };

      await fromCallback(cb => ph.page.set('clipRect', clipRect, cb));
      await fromCallback(cb => ph.page.render(screenshotPath, cb));

      await fromCallback(cb => ph.page.set('clipRect', previousClipRect, cb));
    },

    destroy() {
      return ready.then(() => {
        validateInstance();

        return fromCallback(cb => ph.browser.exit(cb))
        .then(() => {
          ph.browser = false;
          ph.page = false;
        });
      });
    }
  };
}

function _getPhantomOptions(options = {}) {
  return {
    parameters: {
      'load-images': true,
      'ssl-protocol': 'any',
      'ignore-ssl-errors': (options.ignoreSSLErrors != null) ? options.ignoreSSLErrors : true,
    },
    path: options.phantomPath || 'phantomjs',
    bridge: { port: options.bridgePort || 0 },
  };
}

function _injectPromise(page) {
  function checkForPromise() {
    return fromCallback(cb => {
      page.evaluate(function hasPromise() {
        return (typeof window.Promise !== 'undefined');
      }, cb);
    });
  }

  return checkForPromise()
  .then(hasPromise => {
    if (hasPromise) return;

    const nodeModules = path.resolve(__dirname, '..', '..', '..', '..', '..', 'node_modules');
    const promisePath = path.join(nodeModules, 'bluebird', 'js', 'browser', 'bluebird.js');
    return fromCallback(cb => page.injectJs(promisePath, cb))
    .then(status => {
      if (status !== true) {
        return Promise.reject('Failed to load Promise library');
      }
    })
    .then(checkForPromise)
    .then(hasPromiseLoaded => {
      if (hasPromiseLoaded !== true) {
        return Promise.reject('Failed to inject Promise');
      }
    });
  });
}

function _getPackage(installPath) {
  // Code borrowed heavily from phantomjs's install script
  // https://github.com/Medium/phantomjs/blob/v1.9.19/install.js

  const platform = process.env.PHANTOMJS_PLATFORM || process.platform;
  const arch = process.env.PHANTOMJS_ARCH || process.arch;
  let suffix;
  let binary;

  if (platform === 'linux' && arch === 'x64') {
    binary = path.join(basename + '-linux-x86_64', 'bin', 'phantomjs');
    suffix = 'linux-x86_64.tar.bz2';
  } else if (platform === 'linux' && arch === 'ia32') {
    binary = path.join(basename + '-linux-i686', 'bin', 'phantomjs');
    suffix = 'linux-i686.tar.bz2';
  } else if (platform === 'darwin' || platform === 'openbsd' || platform === 'freebsd') {
    binary = path.join(basename + '-macosx', 'bin', 'phantomjs');
    suffix = 'macosx.zip';
  } else if (platform === 'win32') {
    binary = path.join(basename + '-windows', 'bin', 'phantomjs.exe');
    suffix = 'windows.zip';
  } else {
    const msg = 'Unsupported platform: ' + platform + ' ' + arch;
    throw new Error(msg);
  }

  const filename = basename + '-' + suffix;
  const parsed = path.parse(path.join(installPath, filename));
  parsed.binary = path.join(installPath, binary);
  return parsed;
}
