webpackJsonp([2],{

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
	__webpack_require__(2439);
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

/***/ 2439:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	__webpack_require__(962);

	var _chrome = __webpack_require__(1);

	var _chrome2 = _interopRequireDefault(_chrome);

	var _state_hashing = __webpack_require__(368);

	var _routes = __webpack_require__(302);

	var _routes2 = _interopRequireDefault(_routes);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	_routes2.default.enable();
	_routes2.default.when('/', {
	  resolve: {
	    url: function url(AppState, globalState, $window) {
	      var redirectUrl = _chrome2.default.getInjected('redirectUrl');

	      var hashedUrl = (0, _state_hashing.hashUrl)([new AppState(), globalState], redirectUrl);
	      var url = _chrome2.default.addBasePath(hashedUrl);

	      $window.location = url;
	    }
	  }
	});

/***/ }

});
//# sourceMappingURL=stateSessionStorageRedirect.bundle.js.map