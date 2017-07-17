import url from 'url';
import { get, pick } from 'lodash';
import { parseKibanaState } from '../../../../../../server/lib/parse_kibana_state';
import { uriEncode } from './uri_encode';
import { getAbsoluteTime } from './get_absolute_time';
import { oncePerServer } from '../../../../server/lib/once_per_server';

function getSavedObjectFn(server) {

  const { callWithRequest } = server.plugins.elasticsearch.getCluster('admin');
  const config = server.config();
  const requestConfig = Object.assign({
    'kibanaApp': config.get('server.basePath') + config.get('xpack.reporting.kibanaApp'),
    'kibanaIndex': config.get('kibana.index'),
    'protocol': server.info.protocol,
    'hostname': config.get('server.host'),
    'port': config.get('server.port'),
  }, config.get('xpack.reporting.kibanaServer'));

  const appTypes = {
    dashboard: {
      getUrlParams: function (id) {
        return {
          pathname: requestConfig.kibanaApp,
          hash: '/dashboard/' + uriEncode.string(id, true),
        };
      },
      searchSourceIndex: 'kibanaSavedObjectMeta.searchSourceJSON',
      stateIndex: 'uiStateJSON',
    },
    visualization: {
      getUrlParams: function (id) {
        return {
          pathname: requestConfig.kibanaApp,
          hash: '/visualize/edit/' + uriEncode.string(id, true),
        };
      },
      searchSourceIndex: 'kibanaSavedObjectMeta.searchSourceJSON',
      stateIndex: 'uiStateJSON',
    },
    search: {
      getUrlParams: function (id) {
        return {
          pathname: requestConfig.kibanaApp,
          hash: '/discover/' + uriEncode.string(id, true),
        };
      },
      searchSourceIndex: 'kibanaSavedObjectMeta.searchSourceJSON',
      stateIndex: 'uiStateJSON',
    }
  };

  function getUrl(type, id, query) {
    const app = appTypes[type];
    if (!app) throw new Error('Unexpected app type: ' + type);

    // modify the global state in the query
    const globalState = parseKibanaState(query, 'global');
    if (globalState.exists) {
      globalState.removeProps('refreshInterval');

      // transform to absolute time
      globalState.set('time', getAbsoluteTime(globalState.get('time')));

      Object.assign(query, globalState.toQuery());
    }

    const urlParams = Object.assign({
      protocol: requestConfig.protocol,
      hostname: requestConfig.hostname,
      port: requestConfig.port,
    }, app.getUrlParams(id));

    // Kibana appends querystrings to the hash, and parses them as such,
    // so we'll do the same internally so kibana understands what we want
    const unencodedQueryString = uriEncode.stringify(query);
    urlParams.hash += '?' + unencodedQueryString;

    return url.format(urlParams);
  }

  function validateType(type) {
    const app = appTypes[type];
    if (!app) throw new Error('Invalid object type: ' + type);
  }

  return function getSavedObject(request, type, id, query) {
    const fields = ['title', 'description'];
    validateType(type);
    const body = {
      index: requestConfig.kibanaIndex,
      type: type,
      id: id
    };

    function parseJsonObjects(source) {
      const searchSourceJson = get(source, appTypes[type].searchSourceIndex, '{}');
      const uiStateJson = get(source, appTypes[type].stateIndex, '{}');
      let searchSource;
      let uiState;

      try {
        searchSource = JSON.parse(searchSourceJson);
      } catch (e) {
        searchSource = {};
      }

      try {
        uiState = JSON.parse(uiStateJson);
      } catch (e) {
        uiState = {};
      }

      return { searchSource, uiState };
    }

    return callWithRequest(request, 'get', body)
      .then(function _getRecord(response) {
        return response._source;
      })
      .then(async function _buildObject(source) {
        const { searchSource, uiState } = parseJsonObjects(source);

        return Object.assign(pick(source, fields), {
          id: body.id,
          type,
          searchSource,
          uiState,
          url: getUrl(type, id, query)
        });
      })
      .catch(() => {
        return {
          id,
          type,
          isMissing: true
        };
      });
  };
}

export const getSavedObjectFactory = oncePerServer(getSavedObjectFn);
