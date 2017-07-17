import _ from 'lodash';
import routes from 'ui/routes';
import { toggle, toggleSort } from 'plugins/security/lib/util';
import { isRoleEnabled } from 'plugins/security/lib/role';
import template from 'plugins/security/views/management/roles.html';
import 'plugins/security/services/shield_role';
import { checkLicenseError } from 'plugins/security/lib/check_license_error';
import { GateKeeperProvider } from 'plugins/xpack_main/services/gate_keeper';
import { ROLES_PATH, EDIT_ROLES_PATH } from './management_urls';

routes.when(ROLES_PATH, {
  template,
  resolve: {
    tribeRedirect(Private) {
      const gateKeeper = Private(GateKeeperProvider);
      gateKeeper.redirectAndNotifyIfTribe();
    },

    roles(ShieldRole, kbnUrl, Promise, Private) {
      // $promise is used here because the result is an ngResource, not a promise itself
      return ShieldRole.query().$promise
      .catch(checkLicenseError(kbnUrl, Promise, Private))
      .catch(_.identity); // Return the error if there is one
    }
  },
  controller($scope, $route, $q, Notifier, confirmModal) {
    $scope.roles = $route.current.locals.roles;
    $scope.forbidden = !_.isArray($scope.roles);
    $scope.selectedRoles = [];
    $scope.sort = { orderBy: 'name', reverse: false };
    $scope.editRolesHref = `#${EDIT_ROLES_PATH}`;
    $scope.getEditRoleHref = (role) => `#${EDIT_ROLES_PATH}/${role}`;

    const notifier = new Notifier();

    $scope.deleteRoles = () => {
      const doDelete = () => {
        $q.all($scope.selectedRoles.map((role) => role.$delete()))
          .then(() => notifier.info('The role(s) have been deleted.'))
          .then(() => {
            $scope.selectedRoles.map((role) => {
              const i = $scope.roles.indexOf(role);
              $scope.roles.splice(i, 1);
            });
            $scope.selectedRoles.length = 0;
          });
      };
      const confirmModalOptions = {
        confirmButtonText: 'Delete role(s)',
        onConfirm: doDelete
      };
      confirmModal(`
        Are you sure you want to delete the selected role(s)? This action is irreversible!`,
        confirmModalOptions
      );
    };

    $scope.toggleAll = () => {
      if ($scope.allSelected()) {
        $scope.selectedRoles.length = 0;
      } else {
        $scope.selectedRoles = getActionableRoles().slice();
      }
    };

    $scope.allSelected = () => {
      const roles = getActionableRoles();
      return roles.length && roles.length === $scope.selectedRoles.length;
    };

    $scope.isRoleEnabled = isRoleEnabled;

    $scope.toggle = toggle;
    $scope.includes = _.includes;
    $scope.toggleSort = toggleSort;

    function getActionableRoles() {
      return $scope.roles.filter((role) => !role.metadata._reserved);
    }
  }
});
