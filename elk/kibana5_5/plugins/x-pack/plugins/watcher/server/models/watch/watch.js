import { pick, get, set, has, isEmpty, cloneDeep, map } from 'lodash';
import { Action } from '../action';
import { WatchStatus } from '../watch_status';
import defaultWatch from './default_watch.json';

export class Watch {
  constructor(props) {
    this.id = props.id;
    this.watchJson = props.watchJson;
    this.watchStatusJson = props.watchStatusJson;
    this.watch = props.watch;
    this.name = props.name;
    this.isSystemWatch = props.isSystemWatch;

    if (this.watchStatusJson) {
      this.watchStatus = WatchStatus.fromUpstreamJSON({
        id: this.id,
        watchStatusJson: this.watchStatusJson
      });
    }

    const actionsJson = get(this.watchJson, 'actions', {});
    this.actions = map(actionsJson, (actionJson, id) => {
      return Action.fromUpstreamJSON({ id, actionJson });
    });
  }

  // generate object to send to kibana
  get downstreamJSON() {
    const json = {
      id: this.id,
      name: this.name,
      watch: this.watch,
      isSystemWatch: this.isSystemWatch,
      watchStatus: this.watchStatus ? this.watchStatus.downstreamJSON : undefined,
      actions: map(this.actions, (action) => action.downstreamJSON)
    };

    return json;
  }

  // generate object to send to elasticsearch
  get upstreamJSON() {
    const watch = this.watch;

    if (!isEmpty(this.name)) {
      set(watch, 'metadata.name', this.name);
    }

    return {
      id: this.id,
      watch
    };
  }

  // generate Watch object from kibana response
  static fromDownstreamJSON(downstreamWatch) {
    const opts = {
      id: downstreamWatch.id,
      name: downstreamWatch.name,
      watch: downstreamWatch.watch
    };

    return new Watch(opts);
  }

  // generate Watch object from elasticsearch response
  static fromUpstreamJSON(json) {
    if (!json.id) {
      throw new Error('json argument must contain a id property');
    }
    if (!json.watchJson) {
      throw new Error('json argument must contain a watchJson property');
    }
    if (!json.watchStatusJson) {
      throw new Error('json argument must contain a watchStatusJson property');
    }

    const id = json.id;
    const watchJson = pick(json.watchJson, [
      'trigger',
      'input',
      'condition',
      'actions',
      'metadata',
      'transform',
      'throttle_period',
      'throttle_period_in_millis'
    ]);
    const watchStatusJson = json.watchStatusJson;

    const watch = cloneDeep(watchJson);

    const isSystemWatch = has(watch, 'metadata.xpack');
    const name = get(watch, 'metadata.name');
    if (has(watch, 'metadata.name')) {
      delete watch.metadata.name;
    }

    if (isEmpty(watch.metadata)) {
      delete watch.metadata;
    }

    const opts = { id, watch, name, isSystemWatch, watchJson, watchStatusJson };
    return new Watch(opts);
  }

  static fromDefault() {
    const watchJson = defaultWatch;
    const watch = defaultWatch;

    const opts = { watchJson, watch };
    return new Watch(opts);
  }
};
