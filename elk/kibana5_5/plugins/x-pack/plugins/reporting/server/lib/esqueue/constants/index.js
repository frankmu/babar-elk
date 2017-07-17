import { events } from './events';
import { statuses } from './statuses';
import { defaultSettings } from './default_settings';

export const constants = Object.assign({}, events, statuses, defaultSettings);
