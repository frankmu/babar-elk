import { Watch } from '../../../models/watch';
import { licensePreRoutingFactory } from'../../../lib/license_pre_routing_factory';

export function registerNewRoute(server) {
  const licensePreRouting = licensePreRoutingFactory(server);

  server.route({
    path: '/api/watcher/watch',
    method: 'GET',
    handler: (request, reply) => {
      const newWatch = Watch.fromDefault();
      reply({ watch: newWatch.downstreamJSON });
    },
    config: {
      pre: [ licensePreRouting ]
    }
  });
}
