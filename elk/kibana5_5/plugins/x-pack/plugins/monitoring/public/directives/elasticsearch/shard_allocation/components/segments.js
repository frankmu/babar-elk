/**
 * ELASTICSEARCH CONFIDENTIAL
 * _____________________________
 *
 *  [2014] Elasticsearch Incorporated All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Elasticsearch Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Elasticsearch Incorporated
 * and its suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Elasticsearch Incorporated.
 */

import _ from 'lodash';
import React from 'react';

export const Segments = React.createClass({
  displayName: 'Segments',
  getInitialState: function () {
    return { colors: this.props.scope.colors || [], total: this.props.scope.total };
  },
  componentWillMount: function () {
    const self = this;
    this.props.scope.$watch('colors', function (val) {
      self.setState({ colors: val });
    });
    this.props.scope.$watch('total', function (val) {
      self.setState({ total: val });
    });
  },
  createSegment: function (data) {
    const className = 'segment ' + data.status;
    const width = ((data.count / this.state.total) * 100) + '%';
    return (
      <div
        className={ className }
        style={ { width: width } }></div>
    );
  },
  render: function () {
    return (<div>{ _.map(this.state.colors, (row) => this.createSegment(row)) }</div>);
  }
});

