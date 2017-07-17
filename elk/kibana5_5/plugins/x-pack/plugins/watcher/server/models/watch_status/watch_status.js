import { get, map, forEach, max } from 'lodash';
import { getMoment } from '../../../common/lib/get_moment';
import { ActionStatus } from '../action_status';
import { ACTION_STATES, WATCH_STATES, WATCH_STATE_COMMENTS } from '../../../common/constants';

function getActionStatusTotals(watchStatus) {
  const result = {};

  forEach(ACTION_STATES, state => {
    result[state] = 0;
  });
  forEach(watchStatus.actionStatuses, (actionStatus) => {
    result[actionStatus.state] = result[actionStatus.state] + 1;
  });

  return result;
}

export class WatchStatus {
  constructor(props) {
    this.id = props.id;
    this.watchStatusJson = props.watchStatusJson;

    this.isActive = Boolean(get(this.watchStatusJson, 'state.active'));
    this.lastChecked = getMoment(get(this.watchStatusJson, 'last_checked'));
    this.lastMetCondition = getMoment(get(this.watchStatusJson, 'last_met_condition'));

    const actionStatusesJson = get(this.watchStatusJson, 'actions', {});
    this.actionStatuses = map(actionStatusesJson, (actionStatusJson, id) => {
      const json = { id, actionStatusJson };
      return ActionStatus.fromUpstreamJSON(json);
    });
  }

  get state() {
    const totals = getActionStatusTotals(this);
    let result = WATCH_STATES.OK;

    const firingTotal = totals[ACTION_STATES.FIRING] +
      totals[ACTION_STATES.ACKNOWLEDGED] +
      totals[ACTION_STATES.THROTTLED];

    if (firingTotal > 0) {
      result = WATCH_STATES.FIRING;
    }

    if (totals[ACTION_STATES.ERROR] > 0) {
      result = WATCH_STATES.ERROR;
    }

    if (!this.isActive) {
      result = WATCH_STATES.DISABLED;
    }

    return result;
  }

  get comment() {
    const totals = getActionStatusTotals(this);
    const totalActions = this.actionStatuses.length;
    let result = WATCH_STATE_COMMENTS.OK;

    if ((totals[ACTION_STATES.THROTTLED] > 0) &&
      (totals[ACTION_STATES.THROTTLED] < totalActions)) {
      result = WATCH_STATE_COMMENTS.PARTIALLY_THROTTLED;
    }

    if ((totals[ACTION_STATES.THROTTLED] > 0) &&
      (totals[ACTION_STATES.THROTTLED] === totalActions)) {
      result = WATCH_STATE_COMMENTS.THROTTLED;
    }

    if ((totals[ACTION_STATES.ACKNOWLEDGED] > 0) &&
      (totals[ACTION_STATES.ACKNOWLEDGED] < totalActions)) {
      result = WATCH_STATE_COMMENTS.PARTIALLY_ACKNOWLEDGED;
    }

    if ((totals[ACTION_STATES.ACKNOWLEDGED] > 0) &&
      (totals[ACTION_STATES.ACKNOWLEDGED] === totalActions)) {
      result = WATCH_STATE_COMMENTS.ACKNOWLEDGED;
    }

    if (totals[ACTION_STATES.ERROR] > 0) {
      result = WATCH_STATE_COMMENTS.FAILING;
    }

    if (!this.isActive) {
      result = WATCH_STATE_COMMENTS.OK;
    }

    return result;
  }

  get lastFired() {
    const actionStatus = max(this.actionStatuses, 'lastExecution');
    if (actionStatus) {
      return actionStatus.lastExecution;
    }
  }

  // generate object to send to kibana
  get downstreamJSON() {
    const json = {
      id: this.id,
      state: this.state,
      comment: this.comment,
      isActive: this.isActive,
      lastChecked: this.lastChecked,
      lastMetCondition: this.lastMetCondition,
      lastFired: this.lastFired,
      actionStatuses: map(this.actionStatuses, actionStatus => actionStatus.downstreamJSON)
    };

    return json;
  }

  // generate object from elasticsearch response
  static fromUpstreamJSON(json) {
    if (!json.id) {
      throw new Error('json argument must contain an id property');
    }
    if (!json.watchStatusJson) {
      throw new Error('json argument must contain a watchStatusJson property');
    }

    return new WatchStatus(json);
  }

  /*
  json.watchStatusJson should have the following structure:
  {
    "state": {
      "active": true,
      "timestamp": "2017-03-01T19:05:49.400Z"
    },
    "actions": {
      "log-me-something": {
        "ack": {
          "timestamp": "2017-03-01T20:56:58.442Z",
          "state": "acked"
        },
        "last_execution": {
          "timestamp": "2017-03-01T20:55:49.679Z",
          "successful": true
        },
        "last_successful_execution": {
          "timestamp": "2017-03-01T20:55:49.679Z",
          "successful": true
        }
      }
    },
    "version": 15,
    "last_checked": "2017-03-02T14:25:31.139Z",
    "last_met_condition": "2017-03-02T14:25:31.139Z"
  }
  */

};
