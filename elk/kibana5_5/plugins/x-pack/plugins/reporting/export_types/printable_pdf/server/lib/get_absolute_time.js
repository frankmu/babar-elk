import { get } from 'lodash';
import datemath from '@elastic/datemath';

export function getAbsoluteTime(time) {
  const mode = get(time, 'mode');
  const timeFrom = get(time, 'from');
  const timeTo = get(time, 'to');
  const roundToEnd = true;

  if (!mode || !timeFrom || !timeTo) return time;
  if (mode === 'absolute') return time;

  const output = { mode: 'absolute' };
  output.from = datemath.parse(timeFrom);
  output.to = datemath.parse(timeTo, roundToEnd);
  return output;
}