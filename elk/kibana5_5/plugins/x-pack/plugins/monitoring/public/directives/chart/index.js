import React from 'react';
import ReactDOM from 'react-dom';
import moment from 'moment';
import { uiModules } from 'ui/modules';
import { set } from 'lodash';
import { getTitle } from './get_title';
import { getUnits } from './get_units';
import { MonitoringTimeseries } from 'plugins/monitoring/components/chart';
import { InfoTooltip } from 'plugins/monitoring/components/chart/info_tooltip';
import { Tooltip } from 'pui-react-tooltip';
import { OverlayTrigger } from 'pui-react-overlay-trigger';
import { KuiInfoButton } from 'ui_framework/components';

const uiModule = uiModules.get('plugins/monitoring/directives', []);
uiModule.directive('monitoringChart', (timefilter) => {
  return {
    restrict: 'E',
    scope: {
      series: '='
    },
    link(scope, $elem) {

      const series = scope.series;
      const dataSize = series.reduce((prev, current) => {
        return prev + current.data.length;
      }, 0);
      const options = {};
      if (dataSize !== 0) {
        const bounds = timefilter.getBounds();
        set(options, 'xaxis.min', bounds.min.valueOf());
        set(options, 'xaxis.max', bounds.max.valueOf());
      }

      const units = getUnits(series);

      function onBrush({ xaxis, _yaxis }) {
        scope.$evalAsync(() => {
          timefilter.time.from = moment(xaxis.from);
          timefilter.time.to = moment(xaxis.to);
          timefilter.time.mode = 'absolute';
        });
      }

      ReactDOM.render(
        <div className='monitoring-chart__container'>
          <h2 className='monitoring-chart__title'>
            { getTitle(series) }{ units ? ` (${units})` : '' }
            <OverlayTrigger
              placement='left'
              trigger='click'
              overlay={ <Tooltip><InfoTooltip series={ series }/></Tooltip> }
            >
              <span className='monitoring-chart-tooltip__trigger overlay-trigger'>
                <KuiInfoButton />
              </span>
            </OverlayTrigger>
          </h2>
          <MonitoringTimeseries scope={ scope } options={ options } onBrush={ onBrush }/>
        </div>,
        $elem[0]
      );

    }
  };
});
