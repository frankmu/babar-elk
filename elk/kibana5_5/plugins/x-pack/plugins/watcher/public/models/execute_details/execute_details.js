export class ExecuteDetails {
  constructor(props = {}, models = {}) {
    this.triggeredTime = props.triggeredTime;
    this.scheduledTime = props.scheduledTime;
    this.ignoreCondition = props.ignoreCondition;
    this.alternativeInput = props.alternativeInput;
    this.actionModes = props.actionModes;
    this.recordExecution = props.recordExecution;
    this.watch = models.watch;
  }

  get upstreamJSON() {
    const triggerData = {
      triggeredTime: this.triggeredTime,
      scheduledTime: this.scheduledTime,
    };

    return {
      triggerData: triggerData,
      ignoreCondition: this.ignoreCondition,
      alternativeInput: this.alternativeInput,
      actionModes: this.actionModes,
      recordExecution: this.recordExecution,
      watch: this.watch.upstreamJSON
    };
  }
};
