import React from 'react';
import moment from 'moment-timezone';
import { capitalize } from 'lodash';
import { KuiKeyboardAccessible } from 'ui_framework/components';

export function LicenseText(props) {
  const formatDateLocal = input => moment.tz(input, moment.tz.guess()).format('LL');
  const goToLicense = () => props.angularChangeUrl('/license');

  if (props.license && props.showLicenseExpiration) {
    return (
      <div className='page-row'>
        <div className='page-row-text'>
          Your { capitalize(props.license.type) } license will expire
          on <KuiKeyboardAccessible>
            <a className='link' onClick={ goToLicense } >
              { formatDateLocal(props.license.expiry_date) }
            </a>
          </KuiKeyboardAccessible>.
        </div>
      </div>
    );
  }

  return null;
}
