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

export function jobRoutes(server, commonRouteConfig) {
  const callWithRequest = getClient(server).callWithRequest;

  server.route({
    method: 'GET',
    path: '/api/ml/anomaly_detectors',
    handler(request, reply) {
      return callWithRequest(request, 'ml.jobs')
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'GET',
    path: '/api/ml/anomaly_detectors/{jobId}',
    handler(request, reply) {
      const jobId = request.params.jobId;
      return callWithRequest(request, 'ml.jobs', { jobId })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'GET',
    path: '/api/ml/anomaly_detectors/_stats',
    handler(request, reply) {
      return callWithRequest(request, 'ml.jobStats')
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'GET',
    path: '/api/ml/anomaly_detectors/{jobId}/_stats',
    handler(request, reply) {
      const jobId = request.params.jobId;
      return callWithRequest(request, 'ml.jobStats', { jobId })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'PUT',
    path: '/api/ml/anomaly_detectors/{jobId}',
    handler(request, reply) {
      const jobId = request.params.jobId;
      const body = request.payload;
      return callWithRequest(request, 'ml.addJob', { jobId, body })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'POST',
    path: '/api/ml/anomaly_detectors/{jobId}/_update',
    handler(request, reply) {
      const jobId = request.params.jobId;
      const body = request.payload;
      return callWithRequest(request, 'ml.updateJob', { jobId, body })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'POST',
    path: '/api/ml/anomaly_detectors/{jobId}/_open',
    handler(request, reply) {
      const jobId = request.params.jobId;
      return callWithRequest(request, 'ml.openJob', { jobId })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'POST',
    path: '/api/ml/anomaly_detectors/{jobId}/_close',
    handler(request, reply) {
      const jobId = request.params.jobId;
      return callWithRequest(request, 'ml.closeJob', { jobId })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'DELETE',
    path: '/api/ml/anomaly_detectors/{jobId}',
    handler(request, reply) {
      const options = {
        jobId: request.params.jobId
      };
      const force = request.query.force;
      if (force !== undefined) {
        options.force = force;
      }
      return callWithRequest(request, 'ml.deleteJob', options)
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'UPDATE',
    path: '/api/ml/anomaly_detectors/{jobId}',
    handler(request, reply) {
      const jobId = request.params.jobId;
      return callWithRequest(request, 'ml.deleteJob', { jobId })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

  server.route({
    method: 'POST',
    path: '/api/ml/anomaly_detectors/_validate/detector',
    handler(request, reply) {
      const body = request.payload;
      return callWithRequest(request, 'ml.validateDetector', { body })
      .then(resp => reply(resp))
      .catch(resp => reply(wrapError(resp)));
    },
    config: {
      ...commonRouteConfig
    }
  });

}
