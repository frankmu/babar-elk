export function injectXPackInfoSignature(info, request, reply) {

  function addSignatureHeader(response, signature) {
    if (signature) {
      response.headers['kbn-xpack-sig'] = signature;
    }
    return reply.continue();
  }

  // If we're returning an error response, refresh xpack info
  // from Elastisearch in case the error is due to a change in
  // license information in Elasticsearch
  if (request.response instanceof Error) {
    return info.refreshNow()
    .then((refreshedInfo) => {
      const signature = refreshedInfo.getSignature();
      // Note: request.response.output is used instead of request.response
      // because evidently HAPI does not allow headers to be set on the latter
      // in case of error responses.
      return addSignatureHeader(request.response.output, signature);
    });
  } else {
    const signature = info.getSignature();
    return addSignatureHeader(request.response, signature);
  }
};
