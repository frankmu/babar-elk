import { get } from 'lodash';

import { parseNext } from '../../lib/parse_next';

export function initLoginView(server, uiExports, xpackMainPlugin) {
  const config = server.config();
  const cookieName = config.get('xpack.security.cookieName');
  const login = uiExports.apps.byId.login;

  server.route({
    method: 'GET',
    path: '/login',
    handler(request, reply) {

      const xpackInfo = xpackMainPlugin && xpackMainPlugin.info;
      const licenseCheckResults = xpackInfo && xpackInfo.isAvailable() && xpackInfo.feature('security').getLicenseCheckResults();
      const showLogin = get(licenseCheckResults, 'showLogin');

      const isUserAlreadyLoggedIn = !!request.state[cookieName];
      if (isUserAlreadyLoggedIn || !showLogin) {
        const basePath = config.get('server.basePath');
        const url = get(request, 'raw.req.url');
        const next = parseNext(url, basePath);
        return reply.redirect(next);
      }
      return reply.renderAppWithDefaultConfig(login);
    },
    config: {
      auth: false
    }
  });
}