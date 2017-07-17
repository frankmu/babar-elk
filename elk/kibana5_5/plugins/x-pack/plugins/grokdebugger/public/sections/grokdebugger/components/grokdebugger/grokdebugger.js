import { uiModules } from 'ui/modules';
import template from './grokdebugger.html';
import { Notifier } from 'ui/notify/notifier';
import { GrokdebuggerRequest } from 'plugins/grokdebugger/models/grokdebugger_request';
import 'plugins/grokdebugger/services/grokdebugger';
import './grokdebugger.less';
import '../event_input';
import '../event_output';
import '../pattern_input';
import '../custom_patterns_input';
import { isEmpty, trim } from 'lodash';

const app = uiModules.get('xpack/grokdebugger');

app.directive('grokdebugger', function ($injector) {
  const grokdebuggerService = $injector.get('grokdebuggerService');

  return {
    restrict: 'E',
    template: template,
    bindToController: true,
    controllerAs: 'grokdebugger',
    controller: class GrokdebuggerController {
      constructor() {
        this.structuredEvent = {};
        this.grokdebuggerRequest = new GrokdebuggerRequest();
        this.notifier = new Notifier({ location: 'GrokDebugger' });
      }

      onSimulateClick = () => {
        return grokdebuggerService.simulate(this.grokdebuggerRequest)
        .then(simulateResponse => {
          this.structuredEvent = simulateResponse.structuredEvent;
          // this error block is for responses which are 200, but still contain
          // a grok debugger error like pattern not matched.
          if (!isEmpty(simulateResponse.error)) {
            this.notifier.error(simulateResponse.error);
          }
        })
        .catch(e => {
          // this error is for 4xx and 5xx responses
          this.notifier.error(e);
        });
      }

      onCustomPatternsChange = (customPatterns) => {
        this.grokdebuggerRequest.customPatterns = customPatterns;
      }

      onRawEventChange = (rawEvent) => {
        this.grokdebuggerRequest.rawEvent = rawEvent;
      }

      onPatternChange = (pattern) => {
        this.grokdebuggerRequest.pattern = pattern;
      }

      get isSimulateEnabled() {
        return !(isEmpty(trim(this.grokdebuggerRequest.rawEvent)) ||
          isEmpty(trim(this.grokdebuggerRequest.pattern)));
      }
    }
  };
});
