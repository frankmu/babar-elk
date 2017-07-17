import moment from 'moment';
import 'moment-duration-format';
import numeral from 'numeral';
import {
  FORMAT_DURATION_TEMPLATE_SHORT,
  FORMAT_DURATION_TEMPLATE_LONG
} from 'monitoring-constants';

export function formatBytesUsage(used, max) {
  return formatNumber(used, 'bytes') + ' / ' + formatNumber(max, 'bytes');
}

export function formatPercentageUsage(used, max) {
  return formatNumber(used / max, '0.00%');
}

/*
 * Formats a timestamp string
 */
export function formatTimestampToDuration(timestamp) {
  const duration = moment.duration(moment.utc() - moment.utc(timestamp));
  if (moment.utc().diff(timestamp, 'months') >= 1) {
    // time diff is greater than 1 month, show months / days
    return moment.duration(duration).format(FORMAT_DURATION_TEMPLATE_LONG);
  }
  // time diff is less than 1 month, show days / hours / minutes
  return moment.duration(duration).format(FORMAT_DURATION_TEMPLATE_SHORT);
}

export function formatNumber(num, which) {
  if (typeof num === 'undefined' || isNaN(num)) { return 0; }
  if (typeof num !== 'number') { return num; }
  let format = '0,0.0';
  let postfix = '';
  switch (which) {
    case 'time_since':
      return moment(moment() - num).from(moment(), true);
    case 'time':
      return moment(num).format('H:mm:ss');
    case 'int_commas':
      format = '0,0';
      break;
    case 'byte':
      format += 'b';
      break;
    case 'ms':
      postfix = 'ms';
      break;
    default:
      if (which) { format = which; }
  }
  return numeral(num).format(format) + postfix;
};
