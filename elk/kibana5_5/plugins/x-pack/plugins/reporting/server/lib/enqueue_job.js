import { get } from 'lodash';
import { events as esqueueEvents } from './esqueue';
import { oncePerServer } from './once_per_server';

function enqueueJobFn(server) {
  const jobQueue = server.plugins.reporting.queue;
  const filterHeaders = server.plugins.elasticsearch.filterHeaders;
  const queueConfig = server.config().get('xpack.reporting.queue');
  const whitelistHeaders = server.config().get('elasticsearch.requestHeadersWhitelist');
  const exportTypesRegistry = server.plugins.reporting.exportTypesRegistry;

  return async function enqueueJob(exportTypeId, jobParams, user, headers, request) {
    const exportType = exportTypesRegistry.getById(exportTypeId);
    const createJob = exportType.createJobFactory(server);
    const payload = await createJob(jobParams, headers, request);

    const defaultHeaders = {
      Authorization: null
    };

    const options = {
      timeout: queueConfig.timeout,
      created_by: get(user, 'username', false),
      headers: Object.assign({}, defaultHeaders, filterHeaders(headers, whitelistHeaders)),
    };

    return new Promise((resolve, reject) => {
      const job = jobQueue.addJob(exportType.jobType, payload, options);

      job.on(esqueueEvents.EVENT_JOB_CREATED, (createdJob) => {
        if (createdJob.id === job.id) {
          server.log(['reporting', 'debug'], `Saved object to process`);
          resolve(job);
        }
      });
      job.on(esqueueEvents.EVENT_JOB_CREATE_ERROR, reject);
    });
  };
}

export const enqueueJobFactory = oncePerServer(enqueueJobFn);
