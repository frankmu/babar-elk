import { capitalize } from 'lodash';
import React from 'react';
import { Tooltip } from 'plugins/monitoring/components/tooltip';
import { FormattedMessage } from 'plugins/monitoring/components/alerts/formatted_message';
import { SeverityIcon } from 'plugins/monitoring/components/alerts/severity_icon';
import { mapSeverity } from 'plugins/monitoring/components/alerts/map_severity';
import { KuiKeyboardAccessible } from 'ui_framework/components';
import { formatTimestampToDuration } from 'plugins/monitoring/lib/format_number';
import { formatDateTimeLocal } from 'monitoring-formatting';

export function AlertsPanel({ alerts, angularChangeUrl }) {
  const goToAlerts = () => angularChangeUrl('/alerts');

  if (!alerts || !alerts.length) {
    // no-op
    return null;
  }

  // enclosed component for accessing angularChangeUrl
  function TopAlertItem({ item, index }) {
    return (
      <div key={ `alert-item-${index}` } className='kuiMenuItem'>
        <div className='kuiEvent'>
          <div className='kuiEventSymbol'>
            <Tooltip text={ `${capitalize(mapSeverity(item.metadata.severity))} severity alert` } placement='bottom' trigger='hover'>
              <SeverityIcon severity={ item.metadata.severity } />
            </Tooltip>
          </div>

          <div className='kuiEventBody'>
            <div className='kuiEventBody__message'>
              <FormattedMessage
                prefix={ item.prefix }
                suffix={ item.suffix }
                message={ item.message }
                metadata={ item.metadata }
                angularChangeUrl={ angularChangeUrl }
              />
            </div>

            <div className='kuiEventBody__metadata'>
              Last checked { formatDateTimeLocal(item.update_timestamp) } (since { formatTimestampToDuration(item.timestamp) } ago)
            </div>
          </div>
        </div>
      </div>
    );
  }

  const topAlertItems = alerts.map((item, index) => <TopAlertItem item={ item } key={ `top-alert-item-${index}` } index={ index } />);

  return (
    <div>
      <h2 className='kuiSubTitle kuiVerticalRhythm'>
        Top Cluster Alerts
      </h2>
      <div className='kuiMenu kuiMenu--contained kuiVerticalRhythm'>
        { topAlertItems }
      </div>
      <p className='kuiText kuiVerticalRhythm'>
        <KuiKeyboardAccessible>
          <a className='kuiLink' onClick={ goToAlerts } >
            View all { alerts.total } alerts
          </a>
        </KuiKeyboardAccessible>
      </p>
    </div>
  );
}
