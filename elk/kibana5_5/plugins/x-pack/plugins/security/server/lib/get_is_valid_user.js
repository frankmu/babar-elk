import { assign } from 'lodash';
import { getAuthHeader } from './basic_auth';

export function getIsValidUser(server) {
  return function isValidUser(request, username, password) {
    assign(request.headers, getAuthHeader(username, password));
    return server.plugins.security.getUser(request);
  };
}
