import Boom from 'boom';

export function handleError(err, req) {
  const config = req.server.config();
  const loggingTag = config.get('xpack.monitoring.loggingTag');
  const statusCode = err.isBoom ? err.output.statusCode : err.statusCode;
  req.log([loggingTag, 'error'], err);

  if (statusCode === 401 || statusCode === 403) {
    let message;
    /* 401 is changed to 403 because in user perception, they HAVE provided
     * crendentials for the API.
     * They should see the same message whether they're logged in but
     * insufficient permissions, or they're login is valid for the production
     * connection but not the monitoring connection
     */
    if (statusCode === 401) {
      message = 'Invalid authentication for monitoring cluster';
    } else {
      message = 'Insufficient user permissions for monitoring data';
    }
    return Boom.forbidden(message);
  }

  if (err.isBoom) { return err; }
  const msg = err.msg || err.message;
  if (msg === 'Not Found') { return Boom.notFound(); }
  return Boom.badRequest(msg);
}
