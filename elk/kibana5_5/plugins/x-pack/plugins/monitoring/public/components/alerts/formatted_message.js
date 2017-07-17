import React from 'react';
import { KuiKeyboardAccessible } from 'ui_framework/components';

export function FormattedMessage({ prefix, suffix, message, metadata, angularChangeUrl }) {
  const goToLink = () => {
    if (metadata && metadata.link) {
      angularChangeUrl(`/${metadata.link}`);
    }
  };
  const formattedMessage = (() => {
    if (metadata.link) {
      return (
        <KuiKeyboardAccessible>
          <a className='alert-message__clickable' onClick={ goToLink } >
            { message }
          </a>
        </KuiKeyboardAccessible>
      );
    }
    return message;
  })();

  // suffix and prefix don't contain spaces
  const formattedPrefix = prefix ? `${prefix} ` : null;
  const formattedSuffix = suffix ? ` ${suffix}` : null;
  return (
    <span>
      { formattedPrefix }
      { formattedMessage }
      { formattedSuffix }
    </span>
  );
}
