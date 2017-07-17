import 'plugins/reporting/directives/export_config';
import { XPackInfoProvider } from 'plugins/xpack_main/services/xpack_info';
import { NavBarExtensionsRegistryProvider } from 'ui/registry/navbar_extensions';
import { VisualizeConstants } from 'plugins/kibana/visualize/visualize_constants';

function visualizeReportProvider(Private, $location) {
  const xpackInfo = Private(XPackInfoProvider);
  return {
    appName: 'visualize',

    key: 'reporting-visualize',
    label: 'Reporting',
    template: '<export-config object-type="Visualization" enabled-export-type="printablePdf"></export-config>',
    description: 'Visualization Report',
    hideButton: () => (
      $location.path() === VisualizeConstants.LANDING_PAGE_PATH
      || $location.path() === VisualizeConstants.WIZARD_STEP_1_PAGE_PATH
      || $location.path() === VisualizeConstants.WIZARD_STEP_2_PAGE_PATH
      || !xpackInfo.get('features.reporting.printablePdf.showLinks', false)
    ),
    disableButton: () => !xpackInfo.get('features.reporting.printablePdf.enableLinks', false),
    tooltip: () => xpackInfo.get('features.reporting.printablePdf.message'),
    testId: 'topNavReportingLink',
  };
}

NavBarExtensionsRegistryProvider.register(visualizeReportProvider);
