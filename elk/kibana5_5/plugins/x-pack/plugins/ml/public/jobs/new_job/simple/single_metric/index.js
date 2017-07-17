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

import './styles/main.less';
import './wizard/wizard';
import './create_job';

import 'plugins/kibana/discover/saved_searches/saved_searches';
import { SavedObjectRegistryProvider } from 'ui/saved_objects/saved_object_registry';
import { savedSearchProvider } from 'plugins/kibana/discover/saved_searches/saved_search_register';

import uiRoutes from 'ui/routes';

uiRoutes
.when('/jobs/new_job/simple/single_metric', {
  redirectTo: '/jobs/new_job/simple/single_metric/step/1'
});

SavedObjectRegistryProvider.register(savedSearchProvider);
