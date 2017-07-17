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
 * Swimlane visualization, displaying the behavior of a metric over time across
 * different values of fields in Ml results.
 */

import 'plugins/ml/swimlane/swimlane_controller.js';
import 'plugins/ml/swimlane/swimlane.less';

import { TemplateVisTypeProvider } from 'ui/template_vis_type/template_vis_type';
import { VisSchemasProvider } from 'ui/vis/schemas';
import { uiModules } from 'ui/modules';

const module = uiModules.get('ml/swimlane');
module.run(function ($templateCache) {
  // Load the templates into the cache for quick retrieval.
  $templateCache.put('plugins/ml/swimlane/swimlane.html', require('plugins/ml/swimlane/swimlane.html'));
  $templateCache.put('plugins/ml/swimlane/swimlane_editor.html', require('plugins/ml/swimlane/swimlane_editor.html'));
});

export function SwimlaneVisType(Private, $templateCache) {
  const TemplateVisType = Private(TemplateVisTypeProvider);
  const Schemas = Private(VisSchemasProvider);

  return new TemplateVisType({
    name: 'mlSwimlane',
    title: 'Machine Learning swimlane',
    icon: 'fa-bars',
    description: 'Machine Learning visualization displaying the behavior of a metric over time ' +
      'across Machine Learning jobs, or fields from influencer or record type results, in a swimlane chart.',
    template: $templateCache.get('plugins/ml/swimlane/swimlane.html'),
    params: {
      editor: $templateCache.get('plugins/ml/swimlane/swimlane_editor.html'),
      defaults: {
        interval: { display:'Auto', val:'auto' },
        mode: 'jobs',   // jobs, influencers or records
        viewBy: { field:'job_id', label:'Job ID' },
        showViewByControl: true
      },
      jobViewByOptions: [{ field:'job_id', label:'Job ID' },
                 { field:'job_id', label:'Job description' }],
      influencerViewByOptions: [{ field:'influencer_field_name', label:'Influencer type' }],
      recordViewByOptions: [{ field:'detector_index', label:'detector' }],
      intervalOptions: [{ display:'Auto', val:'auto' },
                { display:'5 minutes', val:'custom', customInterval:'5m' },
                { display:'10 minutes', val:'custom', customInterval:'10m' },
                { display:'30 minutes', val:'custom', customInterval:'30m' },
                { display:'1 hour', val:'h' },
                { display:'3 hours', val:'custom', customInterval:'3h' },
                { display:'12 hours', val:'custom', customInterval:'12h' },
                { display:'1 day', val:'d' }]
    },
    schemas: new Schemas([
      {
        group: 'metrics',
        name: 'metric',
        title: 'Value',
        min: 1,
        max: 1,
        aggFilter: ['count', 'avg', 'sum', 'min', 'max']
      },
      {
        group: 'buckets',
        name: 'viewBy',
        icon: 'fa fa-eye',
        title: 'View by',
        mustBeFirst: true,
        min: 1,
        max: 1,
        aggFilter: 'terms'
      },
      {
        group: 'buckets',
        name: 'secondaryViewBy',
        icon: 'fa fa-eye',
        title: 'Secondary view by',
        min: 0,
        max: 1,
        aggFilter: 'terms'
      },
      {
        group: 'buckets',
        name: 'timeSplit',
        icon: 'fa fa-th',
        title: 'Time field',
        min: 1,
        max: 1,
        aggFilter: 'date_histogram'
      }
    ])
  });
}
