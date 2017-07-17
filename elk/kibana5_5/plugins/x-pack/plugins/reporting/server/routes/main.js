import boom from 'boom';
import { has } from 'lodash';
import { API_BASE_URL } from '../../common/constants';
import { enqueueJobFactory } from '../lib/enqueue_job';
import { getUserFactory } from '../lib/get_user';
import { reportingFeaturePreRoutingFactory } from '../lib/reporting_feature_pre_routing';
import { userPreRoutingFactory } from '../lib/user_pre_routing';
import { jobResponseHandlerFactory } from '../lib/job_response_handler';
import rison from 'rison-node';
import querystring from 'querystring';

const mainEntry = `${API_BASE_URL}/generate`;
const API_TAG = 'api';

export function main(server) {
  const config = server.config();
  const socketTimeout = config.get('xpack.reporting.generate.socketTimeout');
  const DOWNLOAD_BASE_URL = config.get('server.basePath') + `${API_BASE_URL}/jobs/download`;
  const { errors:esErrors } = server.plugins.elasticsearch.getCluster('admin');

  const enqueueJob = enqueueJobFactory(server);
  const reportingFeaturePreRouting = reportingFeaturePreRoutingFactory(server);
  const userPreRouting = userPreRoutingFactory(server);
  const jobResponseHandler = jobResponseHandlerFactory(server);

  const getUser = getUserFactory(server);

  function getConfig(getFeatureId) {
    const preRouting = [ userPreRouting ];
    if (getFeatureId) {
      preRouting.push(reportingFeaturePreRouting(getFeatureId));
    }

    return {
      timeout: { socket: socketTimeout },
      tags: [API_TAG],
      pre: preRouting,
    };
  }

  function getStaticFeatureConfig(featureId) {
    return getConfig(() => featureId);
  }

  // show error about method to user
  server.route({
    path: `${mainEntry}/{p*}`,
    method: 'GET',
    handler: (request, reply) => {
      const err = boom.methodNotAllowed('GET is not allowed');
      err.output.headers.allow = 'POST';
      reply(err);
    },
    config: getConfig(),
  });

  function createLegacyPdfRoute({ path, objectType }) {
    const exportTypeId = 'printablePdf';
    server.route({
      path: path,
      method: 'POST',
      handler: async (request, reply) => {
        try {
          const savedObjectId = request.params.savedId;
          const queryString = querystring.stringify(request.query);

          await handler(exportTypeId, {
            objectType,
            savedObjectId,
            queryString
          }, request, reply);
        } catch (err) {
          handleError(exportTypeId, reply, err);
        }
      },
      config: getStaticFeatureConfig(exportTypeId),
    });
  }

  createLegacyPdfRoute({
    path: `${mainEntry}/visualization/{savedId}`,
    objectType: 'visualization',
  });

  createLegacyPdfRoute({
    path: `${mainEntry}/search/{savedId}`,
    objectType: 'search',
  });

  createLegacyPdfRoute({
    path: `${mainEntry}/dashboard/{savedId}`,
    objectType: 'dashboard'
  });

  server.route({
    path: `${mainEntry}/{exportType}`,
    method: 'POST',
    handler: async (request, reply) => {
      const exportType = request.params.exportType;
      try {
        const jobParams = rison.decode(request.query.jobParams);
        await handler(exportType, jobParams, request, reply);
      } catch (err) {
        handleError(exportType, reply, err);
      }
    },
    config: getConfig(request => request.params.exportType),
  });

  async function handler(exportTypeId, jobParams, request, reply) {
    const user = await getUser(request);
    const headers = request.headers;

    const job = await enqueueJob(exportTypeId, jobParams, user, headers, request);

    const syncResponse = has(request.query, 'sync');
    if (syncResponse) {
      // we're assuming that the route itself has already done the authorization check
      // so we're just manually grabbing the exportType itself from the registry and passing in the jobType.
      // Not ideal, but since this code will be going away in 6.0, this seems sufficient
      const exportType = server.plugins.reporting.exportTypesRegistry.getById(exportTypeId);
      jobResponseHandler([exportType.jobType], request, reply, { docId: job.id }, { sync: true });
      return;
    }

    // return the queue's job information
    const jobJson = job.toJSON();

    const response = reply({
      path: `${DOWNLOAD_BASE_URL}/${jobJson.id}`,
      job: jobJson,
    });
    response.type('application/json');
  }

  function handleError(exportType, reply, err) {
    if (err instanceof esErrors['401']) return reply(boom.unauthorized(`Sorry, you aren't authenticated`));
    if (err instanceof esErrors['403']) return reply(boom.forbidden(`Sorry, you are not authorized to create ${exportType} reports`));
    if (err instanceof esErrors['404']) return reply(boom.wrap(err, 404));
    reply(err);
  }
}
