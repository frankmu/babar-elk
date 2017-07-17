import 'moment-duration-format';
import { get } from 'lodash';
import { getMoment } from 'plugins/watcher/../common/lib/get_moment';
import { WatchStatus } from '../watch_status';

export class WatchHistoryItem {
  constructor(props = {}) {
    this.id = props.id;
    this.watchId = props.watchId;
    this.details = props.details;
    this.startTime = getMoment(props.startTime);
    this.watchStatus = WatchStatus.fromUpstreamJSON(get(props, 'watchStatus'));
  }

  static fromUpstreamJSON(upstreamHistory) {
    return new WatchHistoryItem(upstreamHistory);
  }
}
