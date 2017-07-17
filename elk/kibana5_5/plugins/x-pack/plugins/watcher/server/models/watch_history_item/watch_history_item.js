import { getMoment } from '../../../common/lib/get_moment';
import { get, cloneDeep } from 'lodash';
import { WatchStatus } from '../watch_status';

export class WatchHistoryItem {
  constructor(props) {
    this.id = props.id;
    this.watchId = props.watchId;
    this.watchHistoryItemJson = props.watchHistoryItemJson;
    this.includeDetails = Boolean(props.includeDetails);

    this.details = cloneDeep(this.watchHistoryItemJson);
    this.startTime = getMoment(get(this.watchHistoryItemJson, 'result.execution_time'));

    const watchStatusJson = get(this.watchHistoryItemJson, 'status') || get(this.watchHistoryItemJson, '_status');
    this.watchStatus = WatchStatus.fromUpstreamJSON({ id: this.watchId, watchStatusJson });
  }

  get downstreamJSON() {
    return {
      id: this.id,
      watchId: this.watchId,
      details: this.includeDetails ? this.details : null,
      startTime: this.startTime.toISOString(),
      watchStatus: this.watchStatus.downstreamJSON
    };
  }

  // generate object from elasticsearch response
  static fromUpstreamJSON(json, opts) {
    if (!json.id) {
      throw new Error('json argument must contain a id property');
    }
    if (!json.watchId) {
      throw new Error('json argument must contain a watchId property');
    }
    if (!json.watchHistoryItemJson) {
      throw new Error('json argument must contain a watchHistoryItemJson property');
    }

    const props = { ...json, ...opts };
    return new WatchHistoryItem(props);
  }
}
