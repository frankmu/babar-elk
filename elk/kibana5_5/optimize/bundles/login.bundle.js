webpackJsonp([7],{

/***/ 0:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	/**
	 * Test entry file
	 *
	 * This is programatically created and updated, do not modify
	 *
	 * context: {"env":"development","urlBasePath":"/wvm","sourceMaps":"#cheap-source-map","kbnVersion":"5.5.0","buildNum":8467}
	 * includes code from:
	 *  - console@kibana
	 *  - dev_mode@kibana
	 *  - elasticsearch@kibana
	 *  - graph@5.5.0
	 *  - grokdebugger@5.5.0
	 *  - kbn_doc_views@kibana
	 *  - kbn_vislib_vis_types@kibana
	 *  - kibana@kibana
	 *  - markdown_vis@kibana
	 *  - metrics@kibana
	 *  - ml@5.5.0
	 *  - monitoring@5.5.0
	 *  - region_map@kibana
	 *  - reporting@5.5.0
	 *  - searchprofiler@5.5.0
	 *  - security@5.5.0
	 *  - spy_modes@kibana
	 *  - state_session_storage_redirect@kibana
	 *  - status_page@kibana
	 *  - table_vis@kibana
	 *  - tagcloud@kibana
	 *  - tests_bundle@kibana
	 *  - tilemap@5.5.0
	 *  - timelion@kibana
	 *  - watcher@5.5.0
	 *  - xpack_main@5.5.0
	 *
	 */

	__webpack_require__(1);
	__webpack_require__(3787);
	__webpack_require__(2854);
	__webpack_require__(2864);
	__webpack_require__(2865);
	__webpack_require__(2866);
	__webpack_require__(2869);
	__webpack_require__(2875);
	__webpack_require__(2876);
	__webpack_require__(2879);
	__webpack_require__(2881);
	__webpack_require__(2882);
	__webpack_require__(2884);
	__webpack_require__(2885);
	__webpack_require__(2401);
	__webpack_require__(2402);
	__webpack_require__(2307);
	__webpack_require__(2403);
	__webpack_require__(1).bootstrap();

/***/ },

/***/ 962:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	// Kibana UI Framework
	__webpack_require__(963);

	// All Kibana styles inside of the /styles dir
	var context = __webpack_require__(964);
	context.keys().forEach(function (key) {
	  return context(key);
	});

/***/ },

/***/ 963:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 964:
/***/ function(module, exports, __webpack_require__) {

	var map = {
		"./base.less": 965,
		"./callout.less": 966,
		"./config.less": 967,
		"./control_group.less": 968,
		"./dark-theme.less": 969,
		"./dark-variables.less": 970,
		"./hintbox.less": 971,
		"./input.less": 972,
		"./list-group-menu.less": 973,
		"./local_search.less": 974,
		"./navbar.less": 975,
		"./pagination.less": 976,
		"./sidebar.less": 977,
		"./spinner.less": 978,
		"./table.less": 979,
		"./theme.less": 980,
		"./truncate.less": 981
	};
	function webpackContext(req) {
		return __webpack_require__(webpackContextResolve(req));
	};
	function webpackContextResolve(req) {
		return map[req] || (function() { throw new Error("Cannot find module '" + req + "'.") }());
	};
	webpackContext.keys = function webpackContextKeys() {
		return Object.keys(map);
	};
	webpackContext.resolve = webpackContextResolve;
	module.exports = webpackContext;
	webpackContext.id = 964;


/***/ },

/***/ 965:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 966:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 967:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 968:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 969:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 970:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 971:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 972:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 973:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 974:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 975:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 976:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 977:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 978:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 979:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 980:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 981:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ },

/***/ 3787:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _url = __webpack_require__(239);

	var _lodash = __webpack_require__(2840);

	__webpack_require__(962);

	__webpack_require__(4500);

	var _chrome = __webpack_require__(1);

	var _chrome2 = _interopRequireDefault(_chrome);

	var _parse_next = __webpack_require__(3789);

	var _login = __webpack_require__(3790);

	var _login2 = _interopRequireDefault(_login);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	var messageMap = {
	  SESSION_EXPIRED: 'Your session has expired. Please log in again.'
	};

	_chrome2.default.setVisible(false).setRootTemplate(_login2.default).setRootController('login', function ($http, $window, secureCookies, loginState) {
	  var basePath = _chrome2.default.getBasePath();
	  var next = (0, _parse_next.parseNext)($window.location.href, basePath);
	  var isSecure = !!$window.location.protocol.match(/^https/);
	  var self = this;

	  function setupScope() {
	    var defaultLoginMessage = 'Login is currently disabled because the license could not be determined. ' + 'Please check that Elasticsearch is running, then refresh this page.';

	    self.allowLogin = loginState.allowLogin;
	    self.loginMessage = loginState.loginMessage || defaultLoginMessage;
	    self.infoMessage = (0, _lodash.get)(messageMap, (0, _url.parse)($window.location.href, true).query.msg);
	    self.isDisabled = !isSecure && secureCookies;
	    self.isLoading = false;
	    self.submit = function (username, password) {
	      self.isLoading = true;
	      self.error = false;
	      $http.post('./api/security/v1/login', { username: username, password: password }).then(function () {
	        return $window.location.href = next;
	      }, function () {
	        setupScope();
	        self.error = true;
	        self.isLoading = false;
	      });
	    };
	  }

	  setupScope();
	});

/***/ },

/***/ 3789:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.parseNext = parseNext;

	var _url = __webpack_require__(239);

	function parseNext(href) {
	  var basePath = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

	  var _parse = (0, _url.parse)(href, true),
	      query = _parse.query,
	      hash = _parse.hash;

	  if (!query.next) {
	    return basePath + '/';
	  }

	  // validate that `next` is not attempting a redirect to somewhere
	  // outside of this Kibana install

	  var _parse2 = (0, _url.parse)(query.next),
	      protocol = _parse2.protocol,
	      hostname = _parse2.hostname,
	      port = _parse2.port,
	      pathname = _parse2.pathname;

	  if (protocol || hostname || port) {
	    return basePath + '/';
	  }
	  if (!String(pathname).startsWith(basePath)) {
	    return basePath + '/';
	  }

	  return query.next + (hash || '');
	}

/***/ },

/***/ 3790:
/***/ function(module, exports) {

	module.exports = "<div class=\"container\" ng-class=\"{error: !!login.error}\">\n  <div class=\"logo-container\">\n    <div class=\"kibanaWelcomeLogo\"></div>\n  </div>\n\n  <div class=\"form-container\">\n    <form class=\"login-form\" ng-submit=\"login.submit(username, password)\">\n      <div ng-show=\"login.error\" class=\"form-group error-message\">\n        <label class=\"control-label\">Oops! Error. Try again.</label>\n      </div>\n\n      <div class=\"form-group inner-addon left-addon\">\n        <i class=\"fa fa-user fa-lg fa-fw\"></i>\n        <input type=\"text\" ng-disabled=\"login.isDisabled || !login.allowLogin\" ng-model=\"username\" class=\"form-control\" id=\"username\" placeholder=\"Username\" autofocus data-test-subj=\"loginUsername\" />\n      </div>\n\n      <div class=\"form-group inner-addon left-addon\">\n        <i class=\"fa fa-lock fa-lg fa-fw\"></i>\n        <input type=\"password\" ng-disabled=\"login.isDisabled|| !login.allowLogin\" ng-model=\"password\" class=\"form-control\" id=\"password\" placeholder=\"Password\" data-test-subj=\"loginPassword\"/>\n      </div>\n\n      <div class=\"form-group\">\n        <button\n          type=\"submit\"\n          ng-disabled=\"login.isDisabled || !login.allowLogin || !username || !password || login.isLoading\"\n          class=\"loginButton\"\n          data-test-subj=\"loginSubmit\"\n        >\n          Log in\n        </button>\n      </div>\n    </form>\n  </div>\n\n  <div ng-if=\"login.infoMessage\" class=\"info-container\">\n    {{login.infoMessage}}\n  </div>\n\n  <div ng-if=\"!login.allowLogin\" class=\"warning-container\">\n    {{login.loginMessage}}\n  </div>\n\n  <div ng-if=\"login.isDisabled\" class=\"warning-container\">\n    Logging in requires a secure connection. Please contact your administrator.\n  </div>\n</div>\n"

/***/ },

/***/ 4500:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ }

});
//# sourceMappingURL=login.bundle.js.map