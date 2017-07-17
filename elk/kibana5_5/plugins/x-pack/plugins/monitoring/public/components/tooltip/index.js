import React from 'react';
import { Tooltip as PuiTooltip } from 'pui-react-tooltip';
import { OverlayTrigger as PuiOverlayTrigger } from 'pui-react-overlay-trigger';

export class Tooltip extends React.Component {
  render() {
    const tooltip = (
      <PuiTooltip>{ this.props.text }</PuiTooltip>
    );

    return (
      <PuiOverlayTrigger
        placement={ this.props.placement }
        trigger={ this.props.trigger }
        overlay={ tooltip }
      >
        <span className='overlay-trigger'>
          <span className='monitoring-tooltip__trigger'>
            { this.props.children}
          </span>
        </span>
      </PuiOverlayTrigger>
    );
  }
};

Tooltip.defaultProps = {
  placement: 'top',
  trigger: 'click'
};
