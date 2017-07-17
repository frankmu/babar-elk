import { once } from 'lodash';
import { _xpackInfo } from './_xpack_info';

export const xpackInfo = once(_xpackInfo);
