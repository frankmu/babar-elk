import { uiModules } from 'ui/modules';
import uiChrome from 'ui/chrome';
import { PathProvider } from 'plugins/xpack_main/services/path';
import 'plugins/monitoring/services/clusters';
import { PhoneHome } from './phone_home';

function phoneHomeStart($injector) {
  const Private = $injector.get('Private');
  // no phone home for non-logged in users
  if (Private(PathProvider).isLoginOrLogout()) { return; }

  const sender = new PhoneHome($injector, uiChrome.getBasePath());
  sender.start();
}

uiModules.get('monitoring/hacks').run(phoneHomeStart);
