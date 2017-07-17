/*
 * ELASTICSEARCH CONFIDENTIAL
 *
 * Copyright (c) 2017 Elasticsearch BV. All Rights Reserved.
 *
 * Notice: this software, and all information contained
 * therein, is the exclusive property of Elasticsearch BV
 * and its licensors, if any, and is protected under applicable
 * domestic and foreign law, and international treaties.
 *
 * Reproduction, republication or distribution without the
 * express written consent of Elasticsearch BV is
 * strictly prohibited.
 */

import { getClient } from '../get_client_ml';
import { wrapError } from '../errors';

export function dataFeedRoutes(server, commonRouteConfig) {
  const callWithRequest = getClient(server).callWithRequest;

  server.route({
    method: 'GET',
    path: '/api/ml/datafeeds',
    handler(request, reply) {
      return callWithRequest(request, 'ml.datafeeds')
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'GET',
    path: '/api/ml/datafeeds/{datafeedId}',
    handler(request, reply) {
      const datafeedId = request.params.datafeedId;
      return callWithRequest(request, 'ml.datafeeds', { datafeedId })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'GET',
    path: '/api/ml/datafeeds/_stats',
    handler(request, reply) {
      return callWithRequest(request, 'ml.datafeedStats')
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'GET',
    path: '/api/ml/datafeeds/{datafeedId}/_stats',
    handler(request, reply) {
      const datafeedId = request.params.datafeedId;
      return callWithRequest(request, 'ml.datafeedStats', { datafeedId })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'PUT',
    path: '/api/ml/datafeeds/{datafeedId}',
    handler(request, reply) {
      const datafeedId = request.params.datafeedId;
      const body = request.payload;
      return callWithRequest(request, 'ml.addDatafeed', { datafeedId, body })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'POST',
    path: '/api/ml/datafeeds/{datafeedId}/_update',
    handler(request, reply) {
      const datafeedId = request.params.datafeedId;
      const body = request.payload;
      return callWithRequest(request, 'ml.updateDatafeed', { datafeedId, body })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'DELETE',
    path: '/api/ml/datafeeds/{datafeedId}',
    handler(request, reply) {
      const options = {
        datafeedId: request.params.datafeedId
      };
      const force = request.query.force;
      if (force !== undefined) {
        options.force = force;
      }
      return callWithRequest(request, 'ml.deleteDatafeed', options)
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'POST',
    path: '/api/ml/datafeeds/{datafeedId}/_start',
    handler(request, reply) {
      const datafeedId = request.params.datafeedId;
      const start = request.payload.start;
      const end = request.payload.end;
      return callWithRequest(request, 'ml.startDatafeed', { datafeedId, start, end })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'POST',
    path: '/api/ml/datafeeds/{datafeedId}/_stop',
    handler(request, reply) {
      const datafeedId = request.params.datafeedId;
      return callWithRequest(request, 'ml.stopDatafeed', { datafeedId })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'GET',
    path: '/api/ml/datafeeds/{datafeedId}/_preview',
    handler(request, reply) {
      const datafeedId = request.params.datafeedId;
      return callWithRequest(request, 'ml.datafeedPreview', { datafeedId })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

}
