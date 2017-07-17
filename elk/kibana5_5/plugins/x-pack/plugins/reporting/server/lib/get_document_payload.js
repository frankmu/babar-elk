import { events } from './esqueue/constants/events';
import { oncePerServer } from './once_per_server';

function getDocumentPayloadFn(server) {
  const jobQueue = server.plugins.reporting.queue;
  const exportTypesRegistry = server.plugins.reporting.exportTypesRegistry;
  const deprecationLog = message => server.log(['reporting', 'deprecation', 'warning'], message);

  function encodeContent(content, jobType) {
    if (!jobType) {
      return content;
    }

    const exportType = exportTypesRegistry.get(item => item.jobType === jobType);
    switch (exportType.jobContentEncoding) {
      case 'base64':
        return new Buffer(content, 'base64');
      default:
        return content;
    }
  }

  function getPayloadOutput(output, jobType) {
    const statusCode = 200;
    const content = encodeContent(output.content, jobType);
    const contentType = output.content_type;
    return { content, statusCode, contentType };
  }

  function getFailureOutput(output) {
    const statusCode = 500;
    const content = {
      message: 'Report generation failed',
      reason: output.content,
    };
    const contentType = 'text/json';
    return { content, statusCode, contentType };
  }

  function sendIncomplete(status) {
    const statusCode = 503;
    const content = status;
    const contentType = 'text/json';
    return { content, statusCode, contentType };
  }

  return function getDocumentPayload(doc, opts) {
    const { status, output, jobtype: jobType } = doc._source;

    return new Promise((resolve, reject) => {
      if (status === 'completed') {
        return resolve(getPayloadOutput(output, jobType));
      }

      if (status === 'failed') {
        return reject(getFailureOutput(output));
      }

      if (!opts.sync) {
        // not faking sync, send a 503 indicating that the report isn't completed yet
        return reject(sendIncomplete(status));
      }

      // force a synchronous style response, wait for report completion
      return getDocumentPayloadSync(doc, jobType).then(resolve, reject);
    });
  };

  function getDocumentPayloadSync(doc, jobType) {
    deprecationLog(`Use of the 'sync' parameter will be removed in the next major version`);

    return new Promise((resolve, reject) => {
      // faking sync, wait for the job to be completed
      function completeHandler(completed) {
        // if the completed job matches this job
        if (completed.job.id === doc._id) {
          // remove event listener
          cleanupListeners();
          resolve(getPayloadOutput(completed.output, jobType));
        }
      };

      function errorHandler(failed) {
        if (failed.job.id === doc._id) {
          // remove event listener
          cleanupListeners();
          reject(getFailureOutput(failed.output));
        }
      };

      function cleanupListeners() {
        jobQueue.removeListener(events.EVENT_WORKER_COMPLETE, completeHandler);
        jobQueue.removeListener(events.EVENT_WORKER_JOB_FAIL, errorHandler);
      }

      jobQueue.on(events.EVENT_WORKER_COMPLETE, completeHandler);
      jobQueue.on(events.EVENT_WORKER_JOB_FAIL, errorHandler);
    });
  };
}

export const getDocumentPayloadFactory = oncePerServer(getDocumentPayloadFn);

