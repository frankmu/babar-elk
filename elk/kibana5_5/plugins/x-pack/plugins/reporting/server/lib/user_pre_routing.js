import { getUserFactory } from './get_user';
import { oncePerServer } from './once_per_server';

function userPreRoutingFn(server) {
  const getUser = getUserFactory(server);

  return function userPreRouting(request, reply) {
    reply(getUser(request));
  };
}

export const userPreRoutingFactory = oncePerServer(userPreRoutingFn);

