import { uiModules } from 'ui/modules';
import template from './pattern_input.html';
import './pattern_input.less';

const app = uiModules.get('xpack/grokdebugger');

app.directive('patternInput', function () {
  return {
    restrict: 'E',
    template: template,
    scope: {
      pattern: '=',
      onChange: '='
    },
    bindToController: true,
    controllerAs: 'patternInput',
    controller: class PatternInputController {
      constructor($scope) {
        $scope.$watch('patternInput.pattern', () => {
          this.onChange(this.pattern);
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
