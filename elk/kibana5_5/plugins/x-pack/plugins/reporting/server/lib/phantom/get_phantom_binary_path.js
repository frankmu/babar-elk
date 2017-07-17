import path from 'path';

/**
 * Returns the location where the phantom binaries will be installed by gulp.
 * @returns {String}
 */
export function getPhantomBinaryPath() {
  return path.resolve(__dirname, '..', '..', '..', '..', '..', '.phantom');
}
