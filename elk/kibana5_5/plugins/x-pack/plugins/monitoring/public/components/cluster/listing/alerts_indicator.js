import React from 'react';
import { Tooltip } from 'plugins/monitoring/components/tooltip';
import { SeverityIcon }  from 'plugins/monitoring/components/alerts/severity_icon';

const HIGH_SEVERITY = 1999;
const MEDIUM_SEVERITY = 999;
const LOW_SEVERITY = 0;
const STATUS_OK = -2;

export function AlertsIndicator({ alerts }) {
  if (alerts && alerts.count > 0) {
    const severity = (() => {
      if (alerts.high > 0) { return HIGH_SEVERITY; }
      if (alerts.medium > 0) { return MEDIUM_SEVERITY; }
      return LOW_SEVERITY;
    })();
    const icon = <SeverityIcon severity={ severity } />;
    const tooltipText = (() => {
      switch (severity) {
        case HIGH_SEVERITY:
          return 'There are some critical cluster issues that require your immediate attention!';
        case MEDIUM_SEVERITY:
          return 'There are some issues that might have impact on your cluster.';
        default:
          // might never show
          return 'There are some low-severity cluster issues';
      }
    })();

    return (
      <Tooltip text={ tooltipText } placement='bottom' trigger='hover'>
        { icon }
      </Tooltip>
    );
  }

  return (
    <Tooltip text='Cluster status is clear!' placement='bottom' trigger='hover'>
      <SeverityIcon severity={ STATUS_OK } />
    </Tooltip>
  );
}
