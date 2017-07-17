
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

require('ui/chrome');
require('plugins/kibana/kibana');
require('plugins/tilemap/vis_type_enhancers/update_tilemap_settings');
require('plugins/kbn_vislib_vis_types/kbn_vislib_vis_types');
require('plugins/markdown_vis/markdown_vis');
require('plugins/metrics/kbn_vis_types');
require('plugins/region_map/region_map_vis');
require('plugins/table_vis/table_vis');
require('plugins/tagcloud/tag_cloud_vis');
require('plugins/timelion/vis');
require('plugins/dev_mode/vis_debug_spy_panel');
require('plugins/spy_modes/table_spy_mode');
require('plugins/spy_modes/req_resp_stats_spy_mode');
require('plugins/reporting/controls/discover');
require('plugins/reporting/controls/visualize');
require('plugins/reporting/controls/dashboard');
require('plugins/reporting/views/management');
require('plugins/security/views/management');
require('plugins/watcher/sections/testbed');
require('plugins/watcher/sections/watch_detail');
require('plugins/watcher/sections/watch_edit');
require('plugins/watcher/sections/watch_list');
require('plugins/watcher/sections/watch_history_item');
require('plugins/searchprofiler/app');
require('plugins/grokdebugger/sections/grokdebugger');
require('plugins/console/console');
require('plugins/kbn_doc_views/kbn_doc_views');
require('plugins/security/views/nav_control');
require('plugins/xpack_main/hacks/check_xpack_info_change');
require('plugins/graph/hacks/toggle_app_link_in_nav');
require('plugins/monitoring/hacks/welcome_banner');
require('plugins/monitoring/hacks/phone_home_trigger');
require('plugins/monitoring/hacks/toggle_app_link_in_nav');
require('plugins/reporting/hacks/job_completion_notifier');
require('plugins/security/hacks/on_session_timeout');
require('plugins/security/hacks/on_unauthorized_response');
require('plugins/searchprofiler/register');
require('plugins/ml/hacks/toggle_app_link_in_nav');
require('plugins/grokdebugger/sections/grokdebugger/register');
require('plugins/console/hacks/register');
require('plugins/kibana/dev_tools/hacks/hide_empty_tools');
require('plugins/timelion/lib/panel_registry');
require('plugins/timelion/panels/timechart/timechart');
require('ui/chrome').bootstrap(/* xoxo */);

