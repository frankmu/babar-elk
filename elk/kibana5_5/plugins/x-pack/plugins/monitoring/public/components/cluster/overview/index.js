import React from 'react';
import { ElasticsearchPanel } from './elasticsearch_panel';
import { LicenseText } from './license_text';
import { KibanaPanel } from './kibana_panel';
import { LogstashPanel } from './logstash_panel';
import { AlertsPanel } from './alerts_panel';
import { get } from 'lodash';

export class Overview extends React.Component {
  constructor(props) {
    super(props);
    const cluster = get(props, 'scope.cluster', {});

    this.state = {
      license: cluster.license,
      alerts: cluster.alerts,
      elasticsearch: { ...cluster.elasticsearch },
      ml: cluster.ml, // ML is separate since it is license-conditional
      kibana: cluster.kibana,
      logstash: cluster.logstash
    };
  }

  componentWillMount() {
    this.props.scope.$watch('cluster', (cluster) => {
      cluster = cluster || {};

      this.setState({
        license: cluster.license,
        alerts: cluster.alerts,
        elasticsearch: { ...cluster.elasticsearch },
        ml: cluster.ml,
        kibana: cluster.kibana,
        logstash: cluster.logstash,
      });
    });
  }

  render() {
    const angularChangeUrl = (target) => {
      this.props.scope.$evalAsync(() => {
        this.props.kbnUrl.changePath(target);
      });
    };

    return (
      <div className='monitoring-view'>
        <LicenseText
          license={ this.state.license }
          showLicenseExpiration={ this.props.showLicenseExpiration }
          angularChangeUrl={ angularChangeUrl }
        />

        <div className='page-row'>
          <AlertsPanel alerts={ this.state.alerts } angularChangeUrl={ angularChangeUrl } />
        </div>

        <div className='page-row'>
          <ElasticsearchPanel { ...this.state.elasticsearch } ml={ this.state.ml } angularChangeUrl={ angularChangeUrl } />
        </div>

        <div className='page-row'>
          <KibanaPanel { ...this.state.kibana } angularChangeUrl={ angularChangeUrl } />
        </div>

        <div className='page-row'>
          <LogstashPanel { ...this.state.logstash } angularChangeUrl={ angularChangeUrl } />
        </div>

      </div>
    );
  }
}
