import { uiModules } from 'ui/modules';
import template from './section_collapser.html';
import './section_collapser.less';

const app = uiModules.get('xpack/watcher');

app.directive('sectionCollapser', function () {
  return {
    restrict: 'E',
    replace: true,
    transclude: true,
    template: template,
    scope: {
      sectionId: '@',
      isCollapsed: '=',
      onCollapse: '=',
      onExpand: '='
    },
    controllerAs: 'sectionCollapser',
    bindToController: true,
    controller: class SectionCollapserController {
      toggle = () => {
        if (this.isCollapsed) {
          this.onExpand(this.sectionId);
        } else {
          this.onCollapse(this.sectionId);
        }
      }
    }
  };
});
