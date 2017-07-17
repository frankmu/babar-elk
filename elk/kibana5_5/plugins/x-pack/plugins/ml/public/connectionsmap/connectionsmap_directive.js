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
 * Angular directive for rendering the Ml Connections map for displaying connections
 * between detectors and influencers.
 */

import _ from 'lodash';
import d3 from 'd3';

import { getSeverity } from 'plugins/ml/util/anomaly_utils';

import { uiModules } from 'ui/modules';
const module = uiModules.get('apps/ml');

module.directive('mlConnectionsMap', function () {

  function link(scope, element) {

    scope.$on('render',function () {
      renderMap();
    });

    scope.$watch('selectedNode', function (newNode, oldNode) {
      if (oldNode !== null) {
        for (let i = 0; i < oldNode.relatedNodes.length; i++) {
          d3.select('#' + oldNode.relatedNodes[i]).classed('selected', false);
          d3.select('#' + oldNode.relatedNodes[i] + '-txt').classed('selected', false);
        }

        for (let i = 0; i < oldNode.relatedLinks.length; i++) {
          d3.select('#' + oldNode.relatedLinks[i]).classed('selected', false);
        }
      }

      if (newNode !== null) {
        for (let i = 0; i < newNode.relatedNodes.length; i++) {
          d3.select('#' + newNode.relatedNodes[i]).classed('selected', true);
          d3.select('#' + newNode.relatedNodes[i] + '-txt').classed('selected', true);
        }

        for (let i = 0; i < newNode.relatedLinks.length; i++) {
          d3.select('#' + newNode.relatedLinks[i]).classed('selected', true);
        }
      }
    });

    function renderMap() {
      if (scope.numberHits < 1) {
        return;
      }

      const diameter = 780;
      const innerNodeWidth = 150;
      const innerNodeHeight = 25;
      const outerMarkerRadius = 6;
      const outerLabelWidth = 150;
      const groupArcWidth = 30;

      const outer = d3.map();
      const inner = [];
      const links = [];

      const outerId = [ 0 ];

      // Cut the chart data down to only show the top n inner nodes by
      // record score according to the diameter of the chart.
      // Sort items so as not to rely on Object keys iterator order.
      const numberInnerNodes = Math.floor((diameter - (2 * groupArcWidth)) / innerNodeHeight);
      const chartKeys = _.keys(scope.chartData);
      let scoresByKey = _.map(chartKeys, function (key) {
        const obj = {};
        obj.fieldName = key;
        obj. score = _.get(scope.maxNormProbByField, [scope.vis.params.viewBy.field, key], -1);
        return obj;
      });

      scoresByKey = _(scoresByKey).chain().sortBy('score').reverse().take(numberInnerNodes).value();
      const displayData = _.pick(scope.chartData, _.pluck(scoresByKey, 'fieldName'));

      _.each(displayData, function (connections, key) {

        const innerObj = {
          fieldName: scope.vis.params.viewBy.field,
          fieldValue : key,
          id : 'i' + inner.length,
          relatedLinks : []
        };
        innerObj.relatedNodes = [ innerObj.id ];
        inner.push(innerObj);

        _.each(connections, function (d1) {
          const outerKey = d1.field + ':' + d1.value;
          let outerObj = outer.get(outerKey);

          if (outerObj == null) {
            outerObj = {
              fieldName: d1.field,
              fieldValue : d1.value,
              id : 'o' + outerId[0],
              relatedLinks : []
            };
            outerObj.relatedNodes = [ outerObj.id ];
            outerId[0] = outerId[0] + 1;

            outer.set(outerKey, outerObj);
          }

          // Create the links.
          const linkObj = {
            id : 'l-' + innerObj.id + '-' + outerObj.id,
            inner : innerObj,
            outer : outerObj,
            strength: d1.score / d1.scoreForAllValues
          };
          links.push(linkObj);

          // Update list of links and connected nodes.
          innerObj.relatedNodes.push(outerObj.id);
          innerObj.relatedLinks.push(linkObj.id);
          outerObj.relatedNodes.push(innerObj.id);
          outerObj.relatedLinks.push(linkObj.id);
        });
      });

      const data = {
        inner : inner,
        outer : outer.values(),
        fields : [],
        links : links
      };

      // Sort the outer nodes by field name and field value.
      data.outer = _(data.outer).chain().sortBy(function (outerNode) {
        return outerNode.fieldValue.toLowerCase();
      }).sortBy(function (outerNode) {
        return outerNode.fieldName.toLowerCase();
      }).value();


      // Set up the data for the 'field' arcs on the outer rim which identify
      // the different field names of the outer nodes.
      // Needs to be in format e.g.
      // [ {name:'status', startAngle: 45 * (pi/180), endAngle: 90 * (pi/180)},
      //   {name:'uri', startAngle: 90 * (pi/180), endAngle: 145 * (pi/180)}]
      let fieldNames = _(outer.values()).chain().pluck('fieldName').unique().value();
      fieldNames = _.sortBy(fieldNames, function (fieldName) {
        return fieldName.toLowerCase();
      });
      data.fields = _.map(fieldNames, function (fieldName) {
        return {
          fieldName:fieldName,
          fieldLabel:fieldName !== 'ml-detector' ? fieldName : 'detector',
          nodes:[]
        };
      });

      const il = data.inner.length;

      const innerY = d3.scale.linear().domain([ 0, il ]).range([ -(il * innerNodeHeight) / 2, (il * innerNodeHeight) / 2 ]);

      const mid = (data.outer.length / 2.0);

      // Calculate the domain for the outer node angles.
      let startAngle = (180 / Math.PI) *
        Math.asin(((innerNodeWidth / 2) + outerMarkerRadius + 10) / ((diameter / 2) - (outerLabelWidth + groupArcWidth)));
      if (data.outer.length < 3) {
        startAngle = 90;
      }

      const outerX = d3.scale.linear().domain([ 0, mid, mid, data.outer.length ])
        .range([ startAngle, 180 - startAngle, 180 + startAngle, 360 - startAngle ]);

      // Position the outer and inner nodes.
      data.outer = data.outer.map(function (d, i) {
        d.x = outerX(i);
        d.y = (diameter / 2) - (outerLabelWidth + groupArcWidth + outerMarkerRadius);
        return d;
      });

      data.inner = data.inner.map(function (d, i) {
        d.x = -(innerNodeWidth / 2);
        d.y = innerY(i);
        return d;
      });

      // Position the field name arcs according to the positions of the
      // first nodes in each group.
      // The outerNode 'x' attribute holds the angle of rotation (in degrees).
      _.each(data.outer, function (outerNode) {
        const group = _.findWhere(data.fields, { fieldName: outerNode.fieldName });
        group.nodes.push(outerNode);
      });

      data.fields = _.map(data.fields, function (d, i) {
        d.startX = _.first(d.nodes).x;
        if (i < data.fields.length - 1) {
          const nextGroup = (data.fields)[i + 1];
          d.endX = _.first(nextGroup.nodes).x;
        } else {
          d.endX = 360 - startAngle + 6;
        }

        d.startAngle = (d.startX - 2) * (Math.PI / 180);  // 5 degree padding, then convert from degs to radians
        d.endAngle = (d.endX - 3) * (Math.PI / 180);      // 5 degree padding, then convert from degs to radians

        return d;
      });

      // Extend group arcs to cover the full circle.
      _.first(data.fields).startAngle = 0.5 * (Math.PI / 180);
      _.last(data.fields).endAngle = 359.5 * (Math.PI / 180);

      // Projection for outer node x coordinate to work with one edge being in normal space
      // and the other edge is in radial space.
      function projectX(x) {
        return ((x - 90) / 180 * Math.PI) - (Math.PI / 2);
      }

      const diagonal = d3.svg.diagonal().source(function (d) {
        return {
          'x' : d.outer.y * Math.cos(projectX(d.outer.x)),
          'y' : -d.outer.y * Math.sin(projectX(d.outer.x))
        };
      }).target(function (d) {
        return {
          'x' : d.inner.y + innerNodeHeight / 2,
          'y' : d.outer.x > 180 ? d.inner.x : d.inner.x + innerNodeWidth
        };
      }).projection(function (d) {
        return [ d.y, d.x ];
      });

      const mapContainerElement = d3.select(element.get(0));
      mapContainerElement.selectAll('*').remove();

      const svg = mapContainerElement.append('svg')
        .attr('width', diameter)
        .attr('height', diameter)
        .append('g')
        .attr('transform', 'translate(' + diameter / 2 + ',' + diameter / 2 + ')');


      // Add the arcs to identify the groups of detectors and influencer field names.

      // The arc generator, for the groups.
      const colorscale = d3.scale.category10();
      const arc = d3.svg.arc()
        .innerRadius(diameter / 2 - groupArcWidth)
        .outerRadius(diameter / 2);

      const indicatorArc = d3.svg.arc()
        .innerRadius(diameter / 2 - (groupArcWidth + outerLabelWidth + (2 * outerMarkerRadius)))
        .outerRadius(diameter / 2 - groupArcWidth);

      // Add a group per influencer type / detectors.
      const group = svg.selectAll('.group')
        .data(data.fields)
        .enter().append('g')
        .attr('class', 'group_node');
      group.append('title').text(function (d) {
        return d.fieldLabel + ': ' + d.nodes.length + (d.nodes.length === 1 ? ' value' : ' values');
      });

      // Add the group arcs.
      group.append('path')
          .attr('id', function (d, i) { return 'group' + i; })
          .attr('d', arc)
          .style('fill', function (d, i) { return colorscale(i); });

      group.append('path')
        .attr('d', indicatorArc)
        .attr('class', 'group_indicator');


      // Add a text label.
      const groupText = group.append('text')
        .attr('x', 6)
        .attr('dy', 20)
        .attr('text-anchor', 'start');
      groupText.append('textPath')
        .attr('xlink:href', function (d, i) { return '#group' + i; })
        .text(function (d) {
          return d.fieldLabel.length < ((180 / Math.PI) * (d.endAngle - d.startAngle)) ? d.fieldLabel : '';
        });


      // Add the connections between the inner and outer nodes.
      // The line thickness is related to the 'strength' of the connection.
      const linkThicknessScale = d3.scale.linear()
        .domain([0, 1])
        .range([2, 6]);

      svg.append('g')
        .attr('class', 'links')
        .selectAll('.link')
        .data(data.links)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('id', function (d) { return d.id; })
        .attr('d', diagonal)
        .attr('stroke-width', function (d) {
          return linkThicknessScale(d.strength);
        })
        .on('mouseover', mouseoverLink)
        .on('mouseout', mouseoutLink)
        .on('click', clickLink);


      // Outer nodes
      const onode = svg.append('g').selectAll('.outer_node')
        .data(data.outer)
        .enter()
        .append('g')
        .attr('class', 'outer_node')
        .attr('transform', function (d) {
          return 'rotate(' + (d.x - 90) + ') translate(' + d.y + ', 0)';
        })
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        .on('click', clickNode);

      onode.append('circle').attr('id', function (d) {
        return d.id;
      })
      .attr('r', outerMarkerRadius)
      .attr('class', function (d) {
        const maxNormProb = _.get(scope.maxNormProbByField, [d.fieldName, d.fieldValue]);
        if (maxNormProb < 3 && maxNormProb >= 0) {
          return 'low';
        } else {
          return getSeverity(maxNormProb);
        }
      });

      onode.append('circle').attr('r', outerMarkerRadius).attr('visibility', 'hidden');

      onode.append('text').attr('id', function (d) {
        return d.id + '-txt';
      }).attr('dy', '.31em').attr('text-anchor', function (d) {
        return d.x < 180 ? 'start' : 'end';
      }).attr('transform', function (d) {
        return d.x < 180 ? 'translate(8)' : 'rotate(180)translate(-8)';
      }).text(function (d) {
        return d.fieldValue;
      })
      .each(function (d) {
        // Crop long labels, and show the full field name and value in a tooltip.
        cropLabels(this, d, outerLabelWidth);
      })
      .append('title').text(function (d) {
        return (d.fieldName !== 'ml-detector' ? d.fieldName : 'detector') + ':' + d.fieldValue;
      });

      // Inner nodes
      const inode = svg.append('g').selectAll('.inner_node')
        .data(data.inner)
        .enter()
        .append('g')
        .attr('class', 'inner_node')
        .attr('transform', function (d) {
          return 'translate(' + d.x + ',' + d.y + ')';
        })
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        .on('click', clickNode);

      inode.append('rect').attr('width', innerNodeWidth).attr('height', innerNodeHeight - 4).attr('id', function (d) {
        return d.id;
      })
      .attr('class', function (d) {
        // TODO - add low severity into anomalyUtils for scores < 3.
        const maxNormProb = _.get(scope.maxNormProbByField, [d.fieldName, d.fieldValue]);
        if (maxNormProb < 3 && maxNormProb >= 0) {
          return 'low';
        } else {
          return getSeverity(maxNormProb);
        }
      })
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('transform', 'translate(0, 3)');

      inode.append('text').attr('id', function (d) {
        return d.id + '-txt';
      })
      .attr('text-anchor', 'middle')
      .attr('transform', 'translate(' + innerNodeWidth / 2 + ', ' + innerNodeHeight * .75 + ')')
      .text(function (d) {
        return d.fieldValue;
      })
      .each(function (d) {
        // Crop long labels, and show the full field name and value in a tooltip.
        cropLabels(this, d, innerNodeWidth);
      })
      .append('title').text(function (d) {
        return (scope.vis.params.viewBy.label + ':' + d.fieldValue);
      });


      function cropLabels(el, d, length) {
        // Note getComputedTextLength() relies on the node being visible,
        // so set container visibility:hidden when no data, rather than display:none.
        const self = d3.select(el);
        let textLength = self.node().getComputedTextLength();
        let text = self.text();
        while (textLength > length) {
          text = text.slice(0, -1);
          self.text(text + '...');
          textLength = self.node().getComputedTextLength();
        }
      }

      function mouseover(d) {
        // Bring related links to front.
        d3.selectAll('.links .link').sort(function (a) {
          return d.relatedLinks.indexOf(a.id);
        });

        for (let i = 0; i < d.relatedNodes.length; i++) {
          d3.select('#' + d.relatedNodes[i]).classed('highlight', true);
          d3.select('#' + d.relatedNodes[i] + '-txt').classed('highlight', true);
        }

        for (let i = 0; i < d.relatedLinks.length; i++) {
          d3.select('#' + d.relatedLinks[i]).classed('highlight', true);
        }
      }

      function mouseout(d) {
        for (let i = 0; i < d.relatedNodes.length; i++) {
          d3.select('#' + d.relatedNodes[i]).classed('highlight', false);
          d3.select('#' + d.relatedNodes[i] + '-txt').classed('highlight', false);
        }

        for (let i = 0; i < d.relatedLinks.length; i++) {
          d3.select('#' + d.relatedLinks[i]).classed('highlight', false);
        }

        if (scope.selectedNode !== null) {
          d3.selectAll('.links .link').sort(function (a) {
            return scope.selectedNode.relatedLinks.indexOf(a.id);
          });
        }

        if (scope.selectedLink !== null) {
          d3.selectAll('.links .link').sort(function (a) {
            return (scope.selectedLink.id === a.id ? 1 : 0);
          });
        }
      }

      function mouseoverLink(d) {
        // Bring link to front.
        d3.selectAll('.links .link').sort(function (a) {
          return (d.id === a.id ? 1 : 0);
        });

        setLinkClass(d, 'highlight', true);
      }

      function mouseoutLink(d) {
        setLinkClass(d, 'highlight', false);

        if (scope.selectedNode !== null) {
          d3.selectAll('.links .link').sort(function (a) {
            return scope.selectedNode.relatedLinks.indexOf(a.id);
          });
        }

        if (scope.selectedLink !== null) {
          d3.selectAll('.links .link').sort(function (a) {
            return (scope.selectedLink.id === a.id ? 1 : 0);
          });
        }
      }

      function clickNode(d) {
        scope.selectedNode = d;
        scope.selectedLink = null;
        scope.showNodeAnomalies(d);
      }

      function clickLink(d) {
        scope.selectedNode = null;
        scope.selectedLink = d;
        scope.showLinkAnomalies(d);
      }

      function setLinkClass(d, name, value) {
        d3.select('#' + d.id).classed(name, value);
        d3.select('#' + d.inner.id).classed(name, value);
        d3.select('#' + d.inner.id + '-txt').classed(name, value);
        d3.select('#' + d.outer.id).classed(name, value);
        d3.select('#' + d.outer.id + '-txt').classed(name, value);
      }

      scope.$watch('selectedLink', function (newLink, oldLink) {
        if (oldLink !== null) {
          setLinkClass(oldLink, 'selected', false);
        }

        if (newLink !== null) {
          setLinkClass(newLink, 'selected', true);
        }
      });

    }
  }

  return {
    link: link
  };
});
