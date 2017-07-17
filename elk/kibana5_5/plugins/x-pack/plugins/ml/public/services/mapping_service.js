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

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.service('mlESMappingService', function ($q, mlJobService) {

  this.indices = {};

  this.getMappings = function () {
    const deferred = $q.defer();

    mlJobService.getESMappings()
    .then(indices => {
      this.indices = indices;
      deferred.resolve(indices);

    }).catch(err => {
      console.log('getMappings:', err);
    });

    return deferred.promise;
  };

  this.getTypesFromMapping = function (index) {
    let types = [];
    let ind = index.trim();

    if (ind.match(/\*/g)) {
      // use a regex to find all the indices that match the name
      ind = ind.replace(/\*/g, '.*');
      const reg = new RegExp('^' + ind + '$');
      const tempTypes = {};

      _.each(this.indices, (idx, key) => {
        if (key.match(reg)) {
          _.each(idx.types, (t, tName) => {
            tempTypes[tName] = {};
          });
        }
      });
      types = Object.keys(tempTypes);
    } else {
      types = Object.keys(this.indices[index].types);
    }

    return types;
  };

  // using the field name, find out what mapping type it is from
  this.getMappingTypeFromFieldName = function (index, fieldName) {
    let found = false;
    let type = '';
    let ind = index.trim();

    if (ind.match(/\*/g)) {
      // use a regex to find all the indices that match the name
      ind = ind.replace(/\*/g, '.+');
      const reg = new RegExp('^' + ind + '$');

      _.each(this.indices, (idx, key) => {
        if (key.match(reg)) {
          _.each(idx.types, (t, tName) => {
            if (!found && t && _.has(t.properties, fieldName)) {
              found = true;
              type = tName;
            }
          });
        }
      });
    } else {
      _.each(this.indices[index].types, (t, tName) => {
        if (!found && t && _.has(t.properties, fieldName)) {
          found = true;
          type = tName;
        }
      });
    }

    return type;
  };
});
