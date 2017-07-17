import { uiModules } from 'ui/modules';

const module = uiModules.get('reporting/job_queue');

module.service('reportingFeatureCheck', ($injector) => {
  return {
    shield() {
      return $injector.has('ShieldUser');
    }
  };
});
