import { isPlainObject } from 'lodash';
import Promise from 'bluebird';
import { checkParam } from '../error_missing_required';
import { getSeries } from './get_series';

export function getMetrics(req, indexPattern, filters = []) {
  checkParam(indexPattern, 'indexPattern in details/getMetrics');

  const config = req.server.config();
  const metrics = req.payload.metrics || [];
  return Promise.map(metrics, metric => {
    // metric names match the literal metric name, but they can be supplied in groups or individually
    let metricNames;

    if (isPlainObject(metric)) {
      metricNames = metric.keys;

      if (metric.config) {
        metricNames = metricNames.concat(config.get(metric.config));
      }
    } else {
      metricNames = [ metric ];
    }

    return Promise.map(metricNames, metricName => {
      return getSeries(req, indexPattern, metricName, filters);
    });
  })
  .then(rows => {
    const data = {};
    metrics.forEach((key, index) => {
      // keyName must match the value stored in the html template
      const keyName = isPlainObject(key) ? key.name : key;
      data[keyName] = rows[index];
    });
    return data;
  });
};
