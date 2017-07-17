/*
 * ELASTICSEARCH CONFIDENTIAL
 *
 * Copyright (c) 2017 Elasticsearch BV. All Rights Reserved.
 *
 * Notice: this software, and all information contained
 * therein, is the exclusive property of Elasticsearch BV
 * and its licensors, if any, and is protected under applicable
 * domestic and foreign law, and international treaties.
 *
 * Reproduction, republication or distribution without the
 * express written consent of Elasticsearch BV is
 * strictly prohibited.
 */

 // custom TimeBuckets which inherits from the standrd kibana TimeBuckets
 // this adds the ability to override the barTarget and maxBars settings
 // allowing for a more granular visualization interval without having to
 // modify the global settings stored in the kibana config

import _ from 'lodash';
import moment from 'moment';

import { TimeBucketsCalcAutoIntervalProvider } from 'plugins/ml/util/ml_calc_auto_interval';
import { TimeBucketsCalcEsIntervalProvider } from 'ui/time_buckets/calc_es_interval';

import { TimeBucketsProvider } from 'ui/time_buckets';
export function IntervalHelperProvider(Private, timefilter, config) {

  const calcAuto = Private(TimeBucketsCalcAutoIntervalProvider);
  const calcEsInterval = Private(TimeBucketsCalcEsIntervalProvider);

  _.class(TimeBuckets).inherits(Private(TimeBucketsProvider));

  function TimeBuckets() {
    this.barTarget = config.get('histogram:barTarget');
    this.maxBars = config.get('histogram:maxBars');

    // return TimeBuckets.Super.call(this);
  }

  TimeBuckets.prototype.setBarTarget = function (bt) {
    this.barTarget = bt;
  };

  TimeBuckets.prototype.setMaxBars = function (mb) {
    this.maxBars = mb;
  };

  TimeBuckets.prototype.getInterval = function () {
    const self = this;
    const duration = self.getDuration();
    return decorateInterval(maybeScaleInterval(readInterval()));

    // either pull the interval from state or calculate the auto-interval
    function readInterval() {
      const interval = self._i;
      if (moment.isDuration(interval)) return interval;
      return calcAuto.near(self.barTarget, duration);
    }

    // check to see if the interval should be scaled, and scale it if so
    function maybeScaleInterval(interval) {
      if (!self.hasBounds()) return interval;

      const maxLength = self.maxBars;
      const approxLen = duration / interval;
      let scaled;

      // If the number of buckets we got back from using the barTarget is less than
      // maxBars, than use the lessThan rule to try and get closer to maxBars.
      if (approxLen > maxLength) {
        scaled = calcAuto.lessThan(maxLength, duration);
      } else {
        return interval;
      }

      if (+scaled === +interval) return interval;

      decorateInterval(interval);
      return _.assign(scaled, {
        preScaled: interval,
        scale: interval / scaled,
        scaled: true
      });
    }

    // append some TimeBuckets specific props to the interval
    function decorateInterval(interval) {
      const esInterval = calcEsInterval(interval);
      interval.esValue = esInterval.value;
      interval.esUnit = esInterval.unit;
      interval.expression = esInterval.expression;
      interval.overflow = duration > interval ? moment.duration(interval - duration) : false;

      const prettyUnits = moment.normalizeUnits(esInterval.unit);
      if (esInterval.value === 1) {
        interval.description = prettyUnits;
      } else {
        interval.description = esInterval.value + ' ' + prettyUnits + 's';
      }

      return interval;
    }
  };

  return TimeBuckets;
}
