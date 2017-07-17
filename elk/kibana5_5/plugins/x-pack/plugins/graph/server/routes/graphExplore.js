
import Boom from 'boom';
import _ from 'lodash';

module.exports = function (server, commonRouteConfig) {
  const { callWithRequest } = server.plugins.elasticsearch.getCluster('data');

  function graphExplore(req) {
    const payload = req.payload;
    return callWithRequest(req, 'transport.request', {
      'path': '/' + encodeURIComponent(payload.index) + '/_xpack/_graph/_explore',
      body: payload.query,
      method: 'POST',
      query: {}
    });
  }
  server.route({
    path: '/api/graph/graphExplore',
    method: 'POST',
    handler: function (req, reply) {
      graphExplore(req).then(function (resp) {
        reply({
          ok: true,
          resp: resp
        });
      }).catch(function (err) {
        //Extract known reasons for bad choice of field
        const reasons = _.get(err,'body.error.root_cause', []);

        const fieldDataReason = reasons.find(cause => cause.reason.includes('Fielddata is disabled on text fields'));
        if (fieldDataReason) {
          reply(Boom.badRequest(fieldDataReason.reason));
          return;
        }

        const floatDataReason = reasons.find(cause => cause.reason.includes('No support for examining floating point'));
        if (floatDataReason) {
          reply(Boom.badRequest(floatDataReason.reason));
          return;
        }

        const badDiversityFieldReason = reasons.find(cause =>
          cause.reason.includes('Sample diversifying key must be a single valued-field'));
        if (badDiversityFieldReason) {
          reply(Boom.badRequest(badDiversityFieldReason.reason));
          return;
        }

        const badQueryReason = reasons.find(cause => cause.reason.includes('Failed to parse query')
          || cause.type == 'parsing_exception');
        if (badQueryReason) {
          reply(Boom.badRequest(badQueryReason.reason));
          return;
        }

          // Throw generic error
        throw err;
      }).catch(reply);
    },
    config: {
      ...commonRouteConfig
    }
  });

};
