import { getActionType } from '../../../common/lib/get_action_type';

export class Action {
  constructor(props) {
    this.actionJson = props.actionJson;

    this.id = props.id;
  }

  get type() {
    return getActionType(this.actionJson);
  }

  get downstreamJSON() {
    const result = {
      id: this.id,
      type: this.type
    };

    return result;
  }

  static fromUpstreamJSON(json) {
    if (!json.id) {
      throw new Error('json argument must contain an id property');
    }
    if (!json.actionJson) {
      throw new Error('json argument must contain an actionJson property');
    }

    return new Action(json);
  }

  /*
  json.actionJson should have the following structure:
  NOTE: The structure will actually vary considerably from type to type.
  {
    "logging": {
      ...
    }
  }
  */
};
