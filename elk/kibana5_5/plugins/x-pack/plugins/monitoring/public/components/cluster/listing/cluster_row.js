import React from 'react';
import numeral from 'numeral';
import moment from 'moment';
import { capitalize, get } from 'lodash';
import { KuiKeyboardAccessible } from 'ui_framework/components';
import { Tooltip } from 'plugins/monitoring/components/tooltip';
import { AlertsIndicator } from './alerts_indicator';

export class ClusterRow extends React.Component {

  changeCluster() {
    return () => this.props.changeCluster(this.props.cluster_uuid);
  }

  handleClickIncompatibleLicense() {
    return () => {
      this.props.licenseWarning(
`You can't view the "${this.props.cluster_name}" cluster because the
Basic license does not support multi-cluster monitoring.

Need to monitor multiple clusters? [Get a license with full functionality](https://www.elastic.co/subscriptions/xpack)
to enjoy multi-cluster monitoring.`
      );
    };
  }

  handleClickInvalidLicense() {
    return () => {
      this.props.licenseWarning(
`You can't view the "${this.props.cluster_name}" cluster because the
license information is invalid.

Need a license? [Get a free Basic license](https://register.elastic.co/xpack_register)
or get a license with [full functionality](https://www.elastic.co/subscriptions/xpack)
to enjoy multi-cluster monitoring.`
      );
    };
  }

  getClusterAction() {
    if (this.props.isSupported) {
      return (
        <span>
          <KuiKeyboardAccessible>
            <a className='clusterName link' onClick={ this.changeCluster() }>
              { this.props.cluster_name }
            </a>
          </KuiKeyboardAccessible>
        </span>
      );
    }

    // not supported because license is basic/not compatible with multi-cluster
    if (this.props.license) {
      return (
        <KuiKeyboardAccessible>
          <a className='clusterName link' onClick={ this.handleClickIncompatibleLicense() }>
            { this.props.cluster_name }
          </a>
        </KuiKeyboardAccessible>
      );
    }

    // not supported because license is invalid
    return (
      <KuiKeyboardAccessible>
        <a className='clusterName link' onClick={ this.handleClickInvalidLicense() }>
          { this.props.cluster_name }
        </a>
      </KuiKeyboardAccessible>
    );
  }

  getLicenseInfo() {
    if (this.props.license) {
      const licenseExpiry = () => {
        if (this.props.license.expiry_date_in_millis < moment().valueOf()) {
          // license is expired
          return <div className="expires expired">Expired</div>;
        }

        // license is fine
        return (
          <div className="expires">
            Expires { moment(this.props.license.expiry_date_in_millis).format('D MMM YY') }
          </div>
        );
      };

      return (
        <div>
          <div className="license">
            { capitalize(this.props.license.type) }
          </div>
          { this.props.showLicenseExpiration ? licenseExpiry() : null }
        </div>
      );
    }

    // there is no license!
    return (
      <KuiKeyboardAccessible>
        <div className='license link' onClick={ this.handleClickInvalidLicense() }>
          N/A
        </div>
      </KuiKeyboardAccessible>
    );
  }

  /*
   * helper for avoiding TypeError for nested properties
   */
  path(path) {
    return get(this.props, path);
  }

  render() {
    const classes = ['big'];
    const isSupported = this.props.isSupported;
    const isClusterSupportedFactory = () => {
      return (props) => {
        if (isSupported) {
          return <span>{ props.children }</span>;
        }
        return <span>-</span>;
      };
    };
    const IsClusterSupported = isClusterSupportedFactory(isSupported);

    if (!isSupported) {
      classes.push('basic');
    }

    /*
     * This checks if alerts feature is supported via monitoring cluster
     * license. If the alerts feature is not supported because the prod cluster
     * license is basic, IsClusterSupported makes the status col hidden
     * completely
     */
    const IsAlertsSupported = (props) => {
      if (props.cluster.alerts.alertsMeta.enabled) {
        return <span>{ props.children }</span>;
      }
      return (
        <Tooltip
          text={ props.cluster.alerts.alertsMeta.message }
          placement='bottom'
          trigger='hover'
        >
          <span>N/A</span>
        </Tooltip>
      );
    };

    return (
      <tr className={ classes.join(' ') }>
        <td>
          { this.getClusterAction() }
        </td>
        <td>
          <IsClusterSupported>
            <IsAlertsSupported cluster={ this.props }>
              <AlertsIndicator alerts={ this.props.alerts } />
            </IsAlertsSupported>
          </IsClusterSupported>
        </td>
        <td>
          <IsClusterSupported>
            { numeral(this.path('elasticsearch.cluster_stats.nodes.count.total')).format('0,0') }
          </IsClusterSupported>
        </td>
        <td>
          <IsClusterSupported>
            { numeral(this.path('elasticsearch.cluster_stats.indices.count')).format('0,0') }
          </IsClusterSupported>
        </td>
        <td>
          <IsClusterSupported>
            { numeral(this.path('elasticsearch.cluster_stats.indices.store.size_in_bytes')).format('0,0[.]0 b') }
          </IsClusterSupported>
        </td>
        <td>
          <IsClusterSupported>
            { numeral(this.path('logstash.count')).format('0,0') }
          </IsClusterSupported>
        </td>
        <td>
          <IsClusterSupported>
            { numeral(this.path('kibana.count')).format('0,0') }
          </IsClusterSupported>
        </td>
        <td key="License" className="license">
          { this.getLicenseInfo() }
        </td>
      </tr>
    );
  }

}
