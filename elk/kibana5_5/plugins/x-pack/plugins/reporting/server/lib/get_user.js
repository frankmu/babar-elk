import { get } from 'lodash';
import { oncePerServer } from './once_per_server';

function getUserFn(server) {
  return function getUser(request) {
    const securityGetUser = get(server.plugins, 'security.getUser', function () {});
    return Promise.resolve(securityGetUser(request));
  };
}

export const getUserFactory = oncePerServer(getUserFn);
