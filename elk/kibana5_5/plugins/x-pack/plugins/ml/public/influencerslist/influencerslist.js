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
 * Ml visualization displaying a list of the top influencers for the
 * selected Ml job(s).
 * Progress bar style components are used to show the maximum and total
 * anomaly score by influencer field name and value.
 */

import 'plugins/ml/influencerslist/influencerslist_controller.js';
import 'plugins/ml/influencerslist/influencerslist.less';

import { TemplateVisTypeProvider } from 'ui/template_vis_type/template_vis_type';
import { VisSchemasProvider } from 'ui/vis/schemas';

export function InfluencersListVisType(Private) {
  const TemplateVisType = Private(TemplateVisTypeProvider);
  const Schemas = Private(VisSchemasProvider);

  // Return a new instance describing this visualization.
  return new TemplateVisType({
    name: 'mlInfluencersList',
    title: 'Influencers list',
    icon: 'fa-list',
    description: 'Machine Learning visualization designed to display a list of the ' +
      'top influencers by maximum and total anomaly score across Machine Learning jobs.',
    template: require('plugins/ml/influencerslist/influencerslist.html'),
    params: {
      editor: require('plugins/ml/influencerslist/influencerslist_editor.html'),
    },
    schemas: new Schemas([
      {
        group: 'metrics',
        name: 'totalScore',
        title: 'Total score',
        mustBeFirst: true,
        min: 1,
        max: 1,
        aggFilter: ['count', 'avg', 'sum', 'min', 'max']
      },
      {
        group: 'metrics',
        name: 'maxScore',
        title: 'Max score (0 to 100)',
        min: 1,
        max: 1,
        aggFilter: ['count', 'avg', 'sum', 'min', 'max']
      },
      {
        group: 'buckets',
        name: 'viewBy1',
        icon: 'fa fa-eye',
        title: 'First split by',
        mustBeFirst: true,
        min: 1,
        max: 1,
        aggFilter: 'terms'
      },
      {
        group: 'buckets',
        name: 'viewBy2',
        icon: 'fa fa-eye',
        title: 'Second split by',
        min: 1,
        max: 1,
        aggFilter: 'terms'
      }
    ])
  });
}
