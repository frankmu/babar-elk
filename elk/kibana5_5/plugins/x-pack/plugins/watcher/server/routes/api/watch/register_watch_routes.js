import { registerDeleteRoute } from './register_delete_route';
import { registerExecuteRoute } from './register_execute_route';
import { registerNewRoute } from './register_new_route';
import { registerLoadRoute } from './register_load_route';
import { registerSaveRoute } from './register_save_route';
import { registerHistoryRoute } from './register_history_route';
import { registerActivateRoute } from './register_activate_route';
import { registerDeactivateRoute } from './register_deactivate_route';
import { registerActionRoutes } from './action';

export function registerWatchRoutes(server) {
  registerDeleteRoute(server);
  registerExecuteRoute(server);
  registerNewRoute(server);
  registerLoadRoute(server);
  registerSaveRoute(server);
  registerHistoryRoute(server);
  registerActivateRoute(server);
  registerDeactivateRoute(server);
  registerActionRoutes(server);
}
