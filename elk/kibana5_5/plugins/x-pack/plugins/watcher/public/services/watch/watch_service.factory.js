import { uiModules } from 'ui/modules';
import { WatchService } from './watch_service';

uiModules.get('xpack/watcher')
.factory('watchService', ($injector) => {
  const $http = $injector.get('$http');
  return new WatchService($http);
});
