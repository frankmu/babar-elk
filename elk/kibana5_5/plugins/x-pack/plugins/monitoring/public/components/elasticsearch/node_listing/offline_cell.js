import React from 'react';

export function OfflineCell(props) {
  return (
    <td key={ props.key }>
      <div className='big offline'>
        N/A
      </div>
    </td>
  );
}
