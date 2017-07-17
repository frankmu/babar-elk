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

import d3 from 'd3';

/*
 * Creates a mask over sections of the context chart and swimlane
 * which fall outside the extent of the selection brush used for zooming.
 */
// eslint-disable-next-line kibana-custom/no-default-export
export default function ContextChartMask(contextGroup, data, drawBounds, swimlaneHeight) {
  this.contextGroup = contextGroup;
  this.data = data;
  this.drawBounds = drawBounds;
  this.swimlaneHeight = swimlaneHeight;
  this.mask  = this.contextGroup.append('g').attr('class','mask');

  // Create groups for the left and right sides of the mask.
  this.leftGroup = this.mask.append('g').attr('class','left-mask');
  this.rightGroup = this.mask.append('g').attr('class','right-mask');

  // Create polygons to provide opacity over the left and right sections of the mask.
  this.leftPolygon = this.leftGroup.append('polygon');
  this.rightPolygon = this.leftGroup.append('polygon');

  // Create the path elements for the bounded area and values line.
  if (this.drawBounds === true) {
    this.leftGroup.append('path')
      .attr('class', 'left area bounds');
    this.rightGroup.append('path')
      .attr('class', 'right area bounds');
  }
  this.leftGroup.append('path')
    .attr('class', 'left values-line');
  this.rightGroup.append('path')
    .attr('class', 'right values-line');

  this._x = null;
  this._y = null;
}

ContextChartMask.prototype.style = function (prop, val) {
  this.leftGroup.style(prop, val);
  this.rightGroup.style(prop, val);
  return this;
};

ContextChartMask.prototype.x = function (f) {
  if (f == null) {
    return this._x;
  }
  this._x = f;
  return this;
};

ContextChartMask.prototype.y = function (f) {
  if (f == null) {
    return this._y;
  }
  this._y = f;
  return this;
};

ContextChartMask.prototype.redraw = function () {
  const yDomain = this._y.domain();
  const minY = yDomain[0];
  const maxY = yDomain[1];
  const xDomain = this._x.domain();
  const minX = xDomain[0];
  const maxX = xDomain[1];

  const that = this;

  const leftData = this.data.filter(function (d) {
    return d.date < that.from;
  });

  const rightData = this.data.filter(function (d) {
    return d.date > that.to;
  });

  // Render the bounds area and values line.
  if (this.drawBounds === true) {
    const boundedArea = d3.svg.area()
      .x(function (d) { return that._x(d.date) || 1; })
      .y0(function (d) { return that._y(Math.min(maxY, Math.max(d.lower, minY))); })
      .y1(function (d) { return that._y(Math.max(minY, Math.min(d.upper, maxY))); });
    this.leftGroup.select('.left.area.bounds')
      .attr('d', boundedArea(leftData));
    this.rightGroup.select('.right.area.bounds')
      .attr('d', boundedArea(rightData));
  }

  const valuesLine = d3.svg.line()
    .x(function (d) { return that._x(d.date); })
    .y(function (d) { return that._y(d.value); });

  this.leftGroup.select('.left.values-line')
        .attr('d', valuesLine(leftData));

  this.rightGroup.select('.right.values-line')
    .attr('d', valuesLine(rightData));

  // Configure the coordinates of the left and right polygons (which provide opacity).
  // y extends to the scale min plus the swimlane height.
  const leftPoly = {
    l: this._x(minX),
    t: this._y(minY) + this.swimlaneHeight,
    r: this._x(this.from),
    b: this._y(maxY)
  };
  const rightPoly = {
    l: this._x(this.to),
    t: this._y(minY) + this.swimlaneHeight,
    r: this._x(maxX),
    b: this._y(maxY)
  };
  this.leftPolygon.attr('points', '' + leftPoly.l + ',' + leftPoly.t + '  ' + leftPoly.r + ',' + leftPoly.t +
    '  ' + leftPoly.r + ',' + leftPoly.b + '  ' + leftPoly.l + ',' + leftPoly.b);
  this.rightPolygon.attr('points', '' + rightPoly.l + ',' + rightPoly.t + '  ' + rightPoly.r + ',' + rightPoly.t +
    '  ' + rightPoly.r + ',' + rightPoly.b + '  ' + rightPoly.l + ',' + rightPoly.b);
  return this;
};

ContextChartMask.prototype.reveal = function (extent) {
  this.from = extent[0];
  this.to = extent[1];
  this.redraw();
  return this;
};
