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

import _ from 'lodash';

export function getQueryFromSavedSearch(formConfig) {
  const must = [];
  const mustNot = [];

  must.push(formConfig.query);

  _.each(formConfig.filters, (f) => {
    if(f.meta.disabled === false) {
      if(f.meta.negate) {
        mustNot.push(f.query);
      } else {
        must.push(f.query);
      }
    }
  });

  return {
    bool: {
      must,
      must_not: mustNot
    }
  };
}
