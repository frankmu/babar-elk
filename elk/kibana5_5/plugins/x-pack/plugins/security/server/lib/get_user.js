import { getClient } from './get_client_shield';

export function getUserProvider(server) {
  const callWithRequest = getClient(server).callWithRequest;

  server.expose('getUser', (request) => {
    const xpackInfo = server.plugins.xpack_main.info;
    if (xpackInfo && xpackInfo.isAvailable() && !xpackInfo.feature('security').isEnabled()) {
      return Promise.resolve(null);
    }
    return callWithRequest(request, 'shield.authenticate');
  });
};
