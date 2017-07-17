import _ from 'lodash';
import { SavedWorkspaceProvider } from './saved_workspace';
import { Scanner } from 'ui/utils/scanner';
import { uiModules } from 'ui/modules';
import chrome from 'ui/chrome';

// bring in the factory
import { SavedObjectRegistryProvider } from 'ui/saved_objects/saved_object_registry';


export function SavedWorkspacesProvider(es, kbnUrl, Private, Promise, kbnIndex) {

  const SavedWorkspace = Private(SavedWorkspaceProvider);
  const scanner = new Scanner(es, {
    index: kbnIndex,
    type: SavedWorkspace.type
  });

  this.type = SavedWorkspace.type;
  this.Class = SavedWorkspace;


  this.loaderProperties = {
    name: 'Graph workspace',
    noun: 'Graph workspace',
    nouns: 'Graph workspaces'
  };

  // Returns a single dashboard by ID, should be the name of the workspace
  this.get = function (id) {
    // Returns a promise that contains a workspace which is a subclass of docSource
    return (new SavedWorkspace(id)).init();
  };

  this.urlFor = function (id) {
    return chrome.addBasePath(kbnUrl.eval('/app/graph#/workspace/{{id}}', { id }));
  };

  this.delete = function (ids) {
    ids = !_.isArray(ids) ? [ids] : ids;
    return Promise.map(ids, function (id) {
      return (new SavedWorkspace(id)).delete();
    });
  };

  this.scanAll = function (queryString, pageSize = 1000) {
    return scanner.scanAndMap(queryString, {
      pageSize,
      docCount: Infinity
    }, (hit) => this.mapHits(hit));
  };

  this.mapHits = function (hit) {
    const source = hit._source;
    source.id = hit._id;
    source.url = this.urlFor(hit._id);
    source.icon = 'fa-share-alt';// looks like a graph
    return source;
  };

  this.find = function (searchString, size = 100) {
    let body;
    if (searchString) {
      body = {
        query: {
          simple_query_string: {
            query: searchString + '*',
            fields: ['title^3', 'description'],
            default_operator: 'AND'
          }
        }
      };
    } else {
      body = { query: { match_all: {} } };
    }

    return es.search({
      index: kbnIndex,
      type: SavedWorkspace.type,
      body: body,
      size: size
    })
    .then((resp) => {
      return {
        total: resp.hits.total,
        hits: resp.hits.hits.map((hit) => this.mapHits(hit))
      };
    });
  };
}
// This is the only thing that gets injected into controllers
uiModules.get('app/graph').service('savedGraphWorkspaces',  function (Private) {
  return Private(SavedWorkspacesProvider);
});

SavedObjectRegistryProvider.register(SavedWorkspacesProvider);
