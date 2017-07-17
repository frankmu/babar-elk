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

/*
 * Ml visualization for displaying a map of connections between the influencers
 * and detectors in anomalies. Influencers and detectors are 'connected' if they
 * occur together in an anomaly record.
 */

import 'plugins/ml/connectionsmap/connectionsmap_controller.js';
import 'plugins/ml/connectionsmap/connectionsmap_directive.js';
import 'plugins/ml/connectionsmap/connectionsmap.less';

import { TemplateVisTypeProvider } from 'ui/template_vis_type/template_vis_type';

export function ConnectionsMapVisType(Private) {
  const TemplateVisType = Private(TemplateVisTypeProvider);

  // Return a new instance describing this visualization.
  return new TemplateVisType({
    name : 'mlConnectionsMap',
    title : 'Connections map',
    icon : 'fa-link',
    description : 'Machine Learning visualization for displaying connections between ' +
      'the detectors and influencers of anomalies. Influencers and detectors are connected ' +
      'if they occur together in an anomaly record.',
    requiresSearch : false, // Uses searches created in the visualization controller.
    indexPattern: '.ml-anomalies-*',
    template : require('plugins/ml/connectionsmap/connectionsmap.html'),
    params : {
      editor : require('plugins/ml/connectionsmap/connectionsmap_editor.html'),
      defaults: {
        viewBy: { field:'ml-detector', label:'detector' },
        jobs: [],
        threshold: { display:'minor', val:25 },
      },
      viewByOptions: [{ field:'ml-detector', label:'detector' }],
      thresholdOptions: [{ display:'critical', val:75 },
                         { display:'major', val:50 },
                         { display:'minor', val:25 },
                         { display:'warning', val:0 }]
    }
  });
}
