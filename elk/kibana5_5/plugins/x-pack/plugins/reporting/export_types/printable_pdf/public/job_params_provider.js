import url from 'url';
import {
  getUnhashableStatesProvider,
  unhashUrl,
} from 'ui/state_management/state_hashing';

export function JobParamsProvider(Private) {
  const getUnhashableStates = Private(getUnhashableStatesProvider);

  const appTypes = {
    discover: {
      getParams: (path) => path.match(/\/discover\/(.+)/),
      objectType: 'search',
    },
    visualize: {
      getParams: (path) => path.match(/\/visualize\/edit\/(.+)/),
      objectType: 'visualization',
    },
    dashboard: {
      getParams: (path) => path.match(/\/dashboard\/(.+)/),
      objectType: 'dashboard'
    },
  };

  function parseFromUrl(urlWithHashes) {
    // We need to convert the hashed states in the URL back into their original RISON values,
    // because this URL will be sent to the API.
    const urlWithStates = unhashUrl(urlWithHashes, getUnhashableStates());
    const appUrlWithStates = urlWithStates.split('#')[1];

    const { pathname, query } = url.parse(appUrlWithStates, false);
    const pathParams = pathname.match(/\/([a-z]+)?(\/?.*)/);

    const appTypeKey = pathParams[1];
    const appType = appTypes[appTypeKey];

    // if the doc type is unknown, return an empty object, causing other checks to be falsy
    if (!appType) {
      throw new Error(`Unknown docType of ${appType}`);
    }

    const params = appType.getParams(pathname);
    if (params.length < 2) {
      throw new Error('Unable to parseUrl to determine object name');
    }

    const objectId = params[1];

    return {
      savedObjectId: objectId,
      objectType: appType.objectType,
      queryString: encodeURIComponent(query)
    };
  }

  return function jobParams() {
    return parseFromUrl(window.location.href);
  };
}
