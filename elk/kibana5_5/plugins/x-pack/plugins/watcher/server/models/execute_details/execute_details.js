import { Watch } from '../watch';
import { omit, isUndefined } from 'lodash';

export class ExecuteDetails {
  constructor(props) {
    this.triggerData = props.triggerData;
    this.ignoreCondition = props.ignoreCondition;
    this.alternativeInput = props.alternativeInput;
    this.actionModes = props.actionModes;
    this.recordExecution = props.recordExecution;
    this.watch = Watch.fromDownstreamJSON(props.watch);
  }

  get upstreamJSON() {
    const triggerData = {
      triggered_time: this.triggerData.triggeredTime,
      scheduled_time: this.triggerData.scheduledTime
    };

    const result = {
      trigger_data: omit(triggerData, isUndefined),
      ignore_condition: this.ignoreCondition,
      alternative_input: this.alternativeInput,
      action_modes: this.actionModes,
      record_execution: this.recordExecution,
      watch: this.watch.upstreamJSON.watch
    };

    return omit(result, isUndefined);
  }

  // generate ExecuteDetails object from kibana response
  static fromDownstreamJSON(downstreamWatch) {
    return new ExecuteDetails(downstreamWatch);
  }
};

