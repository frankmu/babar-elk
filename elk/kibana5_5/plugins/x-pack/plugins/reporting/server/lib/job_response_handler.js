import boom from 'boom';
import { oncePerServer } from './once_per_server';
import { jobsQueryFactory } from './jobs_query';
import { getDocumentPayloadFactory } from './get_document_payload';

function jobResponseHandlerFn(server) {
  const jobsQuery = jobsQueryFactory(server);
  const getDocumentPayload = getDocumentPayloadFactory(server);

  return function jobResponseHandler(validJobTypes, request, reply, params, opts = {}) {
    const { docId } = params;
    jobsQuery.get(request, docId, { includeContent: !opts.excludeContent })
    .then((doc) => {
      if (!doc) return reply(boom.notFound());

      const { jobtype: jobType } = doc._source;
      if (!validJobTypes.includes(jobType)) {
        return reply(boom.unauthorized(`Sorry, you are not authorized to download ${jobType} reports`));
      }

      return getDocumentPayload(doc, { sync: opts.sync })
      .then((output) => {
        const response = reply(output.content);
        response.type(output.contentType);
      })
      .catch((err) => {
        // 503 here means that the document is still pending and we are not faking
        // a synchronous response inside getDocumentPayload
        if (err.statusCode === 503) {
          // Boom 3.x hijacks the reply object
          // since we need to add headers to the response, we can't use it here
          // Boom 4.2.0+ is required to work completely, and without the header
          const response = reply(err.content);
          response.type(err.contentType);
          response.code(err.statusCode);

          // The Retry-After header is added to tell the client to check back later
          // to see if the document is ready. We use it to indicate that the client
          // should poll for a completed (or failed) state after a delay
          // see https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.37
          response.header('Retry-After', 30);
          return;
        }

        if (err.statusCode === 500) {
          return reply(boom.badImplementation(err.content))
          .type(err.contentType);
        }

        reply(boom.badImplementation());
      });
    });
  };
}

export const jobResponseHandlerFactory = oncePerServer(jobResponseHandlerFn);
