import moment from 'moment';
import datemath from '@elastic/datemath';
import { parseKibanaState } from '../../../../../../server/lib/parse_kibana_state';

export function getTimeFilterRange(query = {}) {
  if (!query._g) {
    return;
  }

  const globalState = parseKibanaState(query, 'global');
  const time = globalState.get('time');
  if (!time) {
    return;
  }

  const from = moment(datemath.parse(time.from).toISOString()).format('llll');
  const to = moment(datemath.parse(time.to).toISOString()).format('llll');
  return { from, to };
}
