webpackJsonp([8],{

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
	__webpack_require__(3791);
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

/***/ 3791:
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var _chrome = __webpack_require__(1);

	var _chrome2 = _interopRequireDefault(_chrome);

	__webpack_require__(4501);

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

	_chrome2.default.setVisible(false).setRootController('logout', function ($http, $window) {
	  $window.sessionStorage.clear();
	  var url = './login' + $window.location.search;
	  $http.post('./api/security/v1/logout', {}).then(function () {
	    return $window.location.href = url;
	  });
	});

/***/ },

/***/ 4501:
/***/ function(module, exports) {

	// removed by extract-text-webpack-plugin

/***/ }

});
//# sourceMappingURL=logout.bundle.js.map