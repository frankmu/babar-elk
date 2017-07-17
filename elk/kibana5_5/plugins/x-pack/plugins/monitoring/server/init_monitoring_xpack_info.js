import { once, partialRight } from 'lodash';
import { _xpackInfo } from '../../../server/lib/_xpack_info';

export const initMonitoringXpackInfo = once(partialRight(_xpackInfo, 'monitoring'));
