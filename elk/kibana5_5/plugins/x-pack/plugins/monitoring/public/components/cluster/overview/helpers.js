import React from 'react';
import { formatBytesUsage, formatPercentageUsage } from 'plugins/monitoring/lib/format_number';

export function HealthStatusIndicator(props) {
  return (
    <span>
      Health: { props.children }
    </span>
  );
}

export function ClusterItemContainer(props) {
  const urlIconMap = {
    elasticsearch: 'cluster-overview-icon__elasticsearch',
    kibana: 'cluster-overview-icon__kibana',
    logstash: 'cluster-overview-icon__logstash'
  };
  const iconClassNames = [ 'cluster-overview-icon', urlIconMap[props.url] ];

  return (
    <div className='kuiPanel kuiPanel--withHeader kuiVerticalRhythm'>
      <div className='kuiPanelHeader'>
        <div className="kuiPanelHeaderSection">
          <div className={ iconClassNames.join(' ') }></div>
          <div className="kuiPanelHeader__title">
            <h2 className='kuiSubTitle'>
              { props.title }
            </h2>
          </div>
        </div>

        <div className="kuiPanelHeaderSection">
          <div className="kuiText">
            { props.statusIndicator }
          </div>
        </div>
      </div>

      <div className='kuiPanelBody'>
        { props.children }
      </div>
    </div>
  );
}

export function BytesUsage({ usedBytes, maxBytes }) {
  if (usedBytes && maxBytes) {
    return (
      <span>
        { formatBytesUsage(usedBytes, maxBytes) }
        &nbsp;
        ({ formatPercentageUsage(usedBytes, maxBytes) })
      </span>
    );
  }

  return null;
}

export function BytesPercentageUsage({ usedBytes, maxBytes }) {
  if (usedBytes && maxBytes) {
    return (
      <span>
        { formatPercentageUsage(usedBytes, maxBytes) }
        &nbsp;
        ({ formatBytesUsage(usedBytes, maxBytes) })
      </span>
    );
  }

  return null;
}
