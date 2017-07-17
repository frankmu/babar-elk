import boom from 'boom';
import { has } from 'lodash';
import { API_BASE_URL } from '../../common/constants';
import { jobsQueryFactory } from '../lib/jobs_query';
import { reportingFeaturePreRoutingFactory } from'../lib/reporting_feature_pre_routing';
import { userPreRoutingFactory } from '../lib/user_pre_routing';
import { jobResponseHandlerFactory } from '../lib/job_response_handler';

const mainEntry = `${API_BASE_URL}/jobs`;
const API_TAG = 'api';

export function jobs(server) {
  const config = server.config();
  const socketTimeout = config.get('xpack.reporting.generate.socketTimeout');
  const jobsQuery = jobsQueryFactory(server);
  const reportingFeaturePreRouting = reportingFeaturePreRoutingFactory(server);
  const userPreRouting = userPreRoutingFactory(server);
  const jobResponseHandler = jobResponseHandlerFactory(server);

  const managementPreRouting = reportingFeaturePreRouting(() => 'management');

  // list jobs in the queue, paginated
  server.route({
    path: `${mainEntry}/list`,
    method: 'GET',
    handler: (request, reply) => {
      const page = parseInt(request.query.page) || 0;
      const size = Math.min(100, parseInt(request.query.size) || 10);

      const results = jobsQuery.list(request.pre.management.jobTypes, request, page, size);
      reply(results);
    },
    config: {
      pre: [
        { method: managementPreRouting, assign: 'management' }
      ],
    }
  });

  // list all completed jobs since a specified time
  server.route({
    path: `${mainEntry}/list_completed_since`,
    method: 'GET',
    handler: (request, reply) => {
      const size = Math.min(100, parseInt(request.query.size) || 10);
      const sinceInMs = Date.parse(request.query.since) || null;

      const results = jobsQuery.listCompletedSince(request.pre.management.jobTypes, request, size, sinceInMs);
      reply(results);
    },
    config: {
      pre: [
        { method: managementPreRouting, assign: 'management' }
      ],
    }
  });

  // return the count of all jobs in the queue
  server.route({
    path: `${mainEntry}/count`,
    method: 'GET',
    handler: (request, reply) => {
      const results = jobsQuery.count(request.pre.management.jobTypes, request);
      reply(results);
    },
    config: {
      pre: [
        { method: managementPreRouting, assign: 'management' }
      ],
    }
  });

  // return the raw output from a job
  server.route({
    path: `${mainEntry}/output/{docId}`,
    method: 'GET',
    handler: (request, reply) => {
      const { docId } = request.params;

      jobsQuery.get(request, docId, { includeContent: true })
      .then((doc) => {
        if (!doc) {
          return reply(boom.notFound());
        }

        const { jobtype: jobType } = doc._source;
        if (!request.pre.management.jobTypes.includes(jobType)) {
          return reply(boom.unauthorized(`Sorry, you are not authorized to download ${jobType} reports`));
        }

        reply(doc._source.output);
      });
    },
    config: {
      timeout: { socket: socketTimeout },
      pre: [
        { method: managementPreRouting, assign: 'management' }
      ],
    }
  });

  // trigger a download of the output from a job
  server.route({
    path: `${mainEntry}/download/{docId}`,
    method: 'GET',
    handler: (request, reply) => {
      const { docId } = request.params;
      const syncResponse = has(request.query, 'sync');
      jobResponseHandler(request.pre.management.jobTypes, request, reply, { docId }, { sync: syncResponse });
    },
    config: {
      pre: [
        userPreRouting,
        { method: managementPreRouting, assign: 'management' },
      ],
      tags: [API_TAG],
    },
  });
};
