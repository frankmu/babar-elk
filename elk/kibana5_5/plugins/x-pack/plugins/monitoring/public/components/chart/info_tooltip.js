import React from 'react';

export function InfoTooltip({ series }) {
  const tableRows = series.map((item, index) => {
    // 2+ dataseries in the chart
    if (series.length > 1) {
      return (
        <tr key={ `chart-tooltip-${index}` }>
          <td className='monitoring-chart-tooltip__label'>{ item.metric.label }</td>
          <td className='monitoring-chart-tooltip__value'>{ item.metric.description }</td>
        </tr>
      );
    }

    // 1 dataseries in the chart
    return (
      <tr key={ `chart-tooltip-${index}` }>
        <td className='monitoring-chart-tooltip__value'>{ item.metric.description }</td>
      </tr>
    );
  });

  return (
    <table>
      <tbody>
        { tableRows }
      </tbody>
    </table>
  );
}
