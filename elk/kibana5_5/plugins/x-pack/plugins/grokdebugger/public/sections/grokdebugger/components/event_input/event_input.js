import { uiModules } from 'ui/modules';
import template from './event_input.html';
import './event_input.less';
import 'ace';

const app = uiModules.get('xpack/grokdebugger');

app.directive('eventInput', function () {
  return {
    restrict: 'E',
    template: template,
    scope: {
      rawEvent: '=',
      onChange: '='
    },
    bindToController: true,
    controllerAs: 'eventInput',
    controller: class EventInputController {
      constructor($scope) {
        $scope.$watch('eventInput.rawEvent', () => {
          this.onChange(this.rawEvent);
        });
        $scope.aceLoaded = (editor) => {
          this.editor = editor;
          editor.getSession().setUseWrapMode(true);
          editor.setOptions({
            highlightActiveLine: false,
            highlightGutterLine: false,
            showLineNumbers: false
          });
          editor.$blockScrolling = Infinity;
        };
      }
    }
  };
});
