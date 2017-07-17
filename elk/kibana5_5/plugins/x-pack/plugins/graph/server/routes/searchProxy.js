module.exports = function (server, commonRouteConfig) {

  server.route({
    path: '/api/graph/searchProxy',
    method: 'POST',
    handler: function (req, reply) {
      const { callWithRequest } = server.plugins.elasticsearch.getCluster('data');

      callWithRequest(req, 'search', req.payload).then(function (resp) {
        reply({
          ok: true,
          resp:resp
        });
      }).catch(reply);


    },
    config: {
      ...commonRouteConfig
    }
  });


};
