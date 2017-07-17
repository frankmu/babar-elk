import React from 'react';
import { mapSeverity } from './map_severity';

export function SeverityIcon({ severity }) {
  const mappedSeverity = mapSeverity(severity);
  const icon = (() => {
    switch(mappedSeverity) {
      case 'ok': return 'alert-green.svg'; // used for cluster listing row when cluster has no alerts
      case 'low': return 'alert-blue.svg';
      case 'medium': return 'alert-yellow.svg';
      default: return 'alert-red.svg';
    }
  })();

  return (
    <img src={ `../plugins/monitoring/icons/${icon}` } />
  );
}
