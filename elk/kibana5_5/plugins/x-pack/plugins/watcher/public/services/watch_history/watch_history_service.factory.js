import { uiModules } from 'ui/modules';
import { WatchHistoryService } from './watch_history_service';

uiModules.get('xpack/watcher')
.factory('watchHistoryService', ($injector) => {
  const $http = $injector.get('$http');
  return new WatchHistoryService($http);
});
