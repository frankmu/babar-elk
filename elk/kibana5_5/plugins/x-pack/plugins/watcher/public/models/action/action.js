import { get } from 'lodash';

export class Action {
  constructor(props = {}) {
    this.id = get(props, 'id');
    this.type = get(props, 'type');
  }

  static fromUpstreamJSON(upstreamAction) {
    return new Action(upstreamAction);
  }
};
