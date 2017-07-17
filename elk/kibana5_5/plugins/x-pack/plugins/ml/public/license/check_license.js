/*
 * ELASTICSEARCH CONFIDENTIAL
 *
 * Copyright (c) 2017 Elasticsearch BV. All Rights Reserved.
 *
 * Notice: this software, and all information contained
 * therein, is the exclusive property of Elasticsearch BV
 * and its licensors, if any, and is protected under applicable
 * domestic and foreign law, and international treaties.
 *
 * Reproduction, republication or distribution without the
 * express written consent of Elasticsearch BV is
 * strictly prohibited.
 */

import { XPackInfoProvider } from 'plugins/xpack_main/services/xpack_info';
import { Notifier } from 'ui/notify/notifier';
import { notify } from 'ui/notify';
import _ from 'lodash';

import chrome from 'ui/chrome';

export function checkLicense(Private, Promise, kbnBaseUrl) {
  const xpackInfo = Private(XPackInfoProvider);
  const licenseAllowsToShowThisPage = xpackInfo.get('features.ml.isAvailable');
  if (!licenseAllowsToShowThisPage) {
    const message = xpackInfo.get('features.ml.message');
    let queryString = `?${Notifier.QS_PARAM_LOCATION}=Machine Learning&`;
    queryString += `${Notifier.QS_PARAM_LEVEL}=error&${Notifier.QS_PARAM_MESSAGE}=${message}`;
    const url = `${chrome.addBasePath(kbnBaseUrl)}#${queryString}`;

    window.location.href = url;
    return Promise.halt();
  }

  const licenseHasExpired = xpackInfo.get('features.ml.hasExpired', false);

  // If the license has expired ML app will still work for 7 days and then
  // the job management endpoints (e.g. create job, start datafeed) will be restricted.
  // Therefore we need to keep the app enabled but show an info banner to the user.
  if(licenseHasExpired) {
    const message = xpackInfo.get('features.ml.message');
    const exists = _.find(notify._notifs, (item) => item.content === message);
    if (!exists) {
      // Only show the banner once with no countdown
      notify.info(message, { lifetime: 0 });
    }
  }

  return Promise.resolve();
}
