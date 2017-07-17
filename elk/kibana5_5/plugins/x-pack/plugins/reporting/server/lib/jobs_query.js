import { get, set } from 'lodash';
import { badRequest } from 'boom';
import { QUEUE_DOCTYPE } from '../../common/constants';
import { oncePerServer } from './once_per_server';
import { getUserFactory } from './get_user';

const defaultSize = 10;

function jobsQueryFn(server) {
  const getUser = getUserFactory(server);
  const index = server.config().get('xpack.reporting.index');
  const { callWithRequest, errors:esErrors } = server.plugins.elasticsearch.getCluster('admin');

  function execQuery(type, body, request) {
    const defaultBody = {
      search: {
        _source : {
          excludes: [ 'output.content' ]
        },
        sort: [
          { created_at: { order: 'desc' } }
        ],
        size: defaultSize,
      }
    };

    const query = {
      index: `${index}-*`,
      type: QUEUE_DOCTYPE,
      body: Object.assign(defaultBody[type] || {}, body)
    };

    return callWithRequest(request, type, query)
    .catch((err) => {
      if (err instanceof esErrors['401']) return;
      if (err instanceof esErrors['403']) return;
      if (err instanceof esErrors['404']) return;
      throw err;
    });
  }

  function getHits(query) {
    return query.then((res) => get(res, 'hits.hits', []));
  }

  return {
    list(jobTypes, request, page = 0, size = defaultSize) {
      const showAll = get(request, 'query.all', false);
      const filters = [
        { terms: { jobtype: jobTypes } },
      ];

      return getUser(request)
      .then((user) => {
        const body = {
          size,
          from: size * page,
        };

        if (!showAll && !user) {
          throw badRequest(
            `Failed to get the current user's reports because there is no user associated with this request`
          );
        }

        if (!showAll) {
          const username = get(user, 'username');
          filters.push({ term: { created_by: username } });
        }

        set(body, 'query', {
          constant_score: {
            filter: {
              bool: {
                must: filters
              }
            }
          }
        });

        return getHits(execQuery('search', body, request));
      });
    },

    listCompletedSince(jobTypes, request, size = defaultSize, sinceInMs) {
      return getUser(request)
      .then((user) => {
        const filters = [
          { range: { completed_at: { gt: sinceInMs, format: 'epoch_millis' } } },
          { terms: { jobtype: jobTypes } },
        ];
        if (user) {
          const username = get(user, 'username');
          filters.push({ term: { created_by: username } });
        }

        const body = {
          size,
          sort: { completed_at: 'asc' },
          query: {
            constant_score: {
              filter: {
                bool: {
                  must: filters
                }
              }
            }
          },
        };

        return getHits(execQuery('search', body, request));
      });
    },

    count(jobTypes, request) {
      const showAll = get(request, 'query.all', false);
      const filters = [
        { terms: { jobtype: jobTypes } },
      ];

      return getUser(request)
      .then((user) => {
        const body = {};

        if (!showAll) {
          const username = get(user, 'username');
          filters.push({ term: { created_by: username } });
        }

        set(body, 'query', {
          constant_score: {
            filter: {
              bool: {
                must: filters
              }
            }
          }
        });

        return execQuery('count', body, request)
        .then((doc) => {
          if (!doc) return 0;
          return doc.count;
        });
      });
    },

    get(request, id, opts = {}) {
      if (!id) return Promise.resolve();

      return getUser(request)
      .then(() => {
        if (!id) return;

        const body = {
          query: {
            constant_score: {
              filter: {
                bool: {
                  filter: [
                    { term: { _id: id } },
                  ],
                }
              }
            }
          },
          size: 1,
        };

        if (opts.includeContent) {
          body._source = {
            excludes: []
          };
        }

        return getHits(execQuery('search', body, request))
        .then((hits) => {
          if (hits.length !== 1) return;
          return hits[0];
        });
      });
    }
  };
}

export const jobsQueryFactory = oncePerServer(jobsQueryFn);
