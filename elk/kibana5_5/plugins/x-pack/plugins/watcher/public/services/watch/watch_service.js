import chrome from 'ui/chrome';
import { ROUTES } from '../../../common/constants';
import { Watch } from 'plugins/watcher/models/watch';
import { WatchStatus } from 'plugins/watcher/models/watch_status';
import { WatchHistoryItem } from 'plugins/watcher/models/watch_history_item';

export class WatchService {
  constructor($http) {
    this.$http = $http;
    this.basePath = chrome.addBasePath(ROUTES.API_ROOT);
  }

  newWatch() {
    return this.$http.get(`${this.basePath}/watch`)
    .then(response => {
      return Watch.fromUpstreamJSON(response.data.watch);
    });
  }

  loadWatch(id) {
    return this.$http.get(`${this.basePath}/watch/${id}`)
    .then(response => {
      return Watch.fromUpstreamJSON(response.data.watch);
    });
  }

  /**
   * @param watchId string ID of watch
   * @param startTime string Relative representation of start time of watch
   *   history, e.g. "now-1h"
   * @return Promise Array of watch history items
   */
  loadWatchHistory(watchId, startTime) {
    let url = `${this.basePath}/watch/${watchId}/history`;
    if (startTime) {
      url += `?startTime=${startTime}`;
    }

    return this.$http.get(url)
    .then(response => response.data.watchHistoryItems)
    .then(watchHistoryItems => watchHistoryItems.map(WatchHistoryItem.fromUpstreamJSON));
  }

  saveWatch(watchModel) {
    const url = `${this.basePath}/watch/${watchModel.id}`;

    return this.$http.put(url, watchModel.upstreamJSON)
    .catch(e => {
      throw e.data.message;
    });
  }

  /**
   * @param id string ID of watch to delete
   * @return Promise
   */
  deleteWatch(id) {
    return this.$http.delete(`${this.basePath}/watch/${id}`)
    .catch(e => {
      throw e.data.message;
    });
  }

  /**
   * @param id string ID of watch to deactivate
   * @return Promise
   */
  deactivateWatch(id) {
    const url = `${this.basePath}/watch/${id}/deactivate`;
    return this.$http.put(url)
    .then(response => {
      return WatchStatus.fromUpstreamJSON(response.data.watchStatus);
    })
    .catch(e => {
      throw e.data.message;
    });
  }

  /**
   * @param id string ID of watch to activate
   * @return Promise
   */
  activateWatch(id) {
    const url = `${this.basePath}/watch/${id}/activate`;
    return this.$http.put(url)
    .then(response => {
      return WatchStatus.fromUpstreamJSON(response.data.watchStatus);
    })
    .catch(e => {
      throw e.data.message;
    });
  }

  /**
   * @param watchId string ID of watch whose action is being acknowledged
   * @param actionId string ID of watch action to acknowledge
   * @return Promise updated WatchStatus object
   */
  acknowledgeWatchAction(watchId, actionId) {
    const url = `${this.basePath}/watch/${watchId}/action/${actionId}/acknowledge`;
    return this.$http.put(url)
    .then(response => {
      return WatchStatus.fromUpstreamJSON(response.data.watchStatus);
    })
    .catch(e => {
      throw e.data.message;
    });
  }

  /**
   * @param executeDetailsModel ExecuteDetailsModel instance with options on how to execute the watch
   * @return Promise which returns a populated WatchHistoryItem on success
   */
  executeWatch(executeDetailsModel) {
    return this.$http.put(`${this.basePath}/watch/execute`, executeDetailsModel.upstreamJSON)
    .then(response => {
      return WatchHistoryItem.fromUpstreamJSON(response.data.watchHistoryItem);
    })
    .catch(e => {
      throw e.data.message;
    });
  }
}
