import { version } from '../../../../package.json';

export const kibanaVersion = {
  // Make the version stubbable to improve testability.
  get() {
    return version;
  },
};
