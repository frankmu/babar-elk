import { identity } from 'lodash';
import { uiModules } from 'ui/modules';
import { XPackInfoProvider } from 'plugins/xpack_main/services/xpack_info';
import { XPackInfoSignatureProvider } from 'plugins/xpack_main/services/xpack_info_signature';

const module = uiModules.get('xpack_main', []);

module.factory('checkXPackInfoChange', ($q, Private) => {
  const xpackInfo = Private(XPackInfoProvider);
  const xpackInfoSignature = Private(XPackInfoSignatureProvider);

  /**
   *  Intercept each network response to look for the kbn-xpack-sig header.
   *  When that header is detected, compare it's value with the value cached
   *  in the browser storage. When the value is new, call `xpackInfo.refresh()`
   *  so that it will pull down the latest x-pack info
   *
   *  @param  {object} response - the angular $http response object
   *  @param  {function} handleResponse - callback, expects to receive the response
   *  @return
   */
  function interceptor(response, handleResponse) {
    const currentSignature = response.headers('kbn-xpack-sig');
    const cachedSignature = xpackInfoSignature.get();

    if (currentSignature && cachedSignature !== currentSignature) {
      // Signature from the server differ from the signature of our
      // cached info, so we need to refresh it.
      xpackInfo.refresh();
    }

    return handleResponse(response);
  }

  return {
    response: (response) => interceptor(response, identity),
    responseError: (response) => interceptor(response, $q.reject)
  };
});

module.config(($httpProvider) => {
  $httpProvider.interceptors.push('checkXPackInfoChange');
});
