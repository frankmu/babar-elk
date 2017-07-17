import _ from 'lodash';
import { uiModules } from 'ui/modules';
import template from './index.html';

function createCrumb(url, label) {
  return { url, label };
}

const uiModule = uiModules.get('plugins/monitoring/directives', []);
uiModule.directive('monitoringMain', (license) => {
  return {
    restrict: 'E',
    transclude: true,
    template,
    link: function (scope, _el, attrs) {
      scope.name = attrs.name; // name of current page
      scope.product = attrs.product; // undefined, elasticsearch, or kibana
      scope.instance = attrs.instance; // undefined or name of index or instance (e.g., node)
      scope.resolver = attrs.resolver; // undefined or id of index or instance (e.g., node)
      scope.page = attrs.page; // undefined or the tab for an instance
      const productIsIn = (checkKey) => scope.product === checkKey;

      if (scope.product) {
        scope.inElasticsearch = productIsIn('elasticsearch');
        scope.inKibana = productIsIn('kibana');
        scope.inLogstash = productIsIn('logstash');
      } else {
        scope.product = false;
        scope.inOverview = scope.name === 'overview';
        scope.inAlerts = scope.name === 'alerts';
        scope.inListing = scope.name === 'listing' || scope.name === 'no-data';
      }

      // hide tabs for some pages (force to select a cluster before drill-in)
      const noTabs = ['no-data'];
      scope.allowTabs = !_.contains(noTabs, scope.name);

      // hide clusters tab for basic license
      scope.allowClusterTab = !license.isBasic();

      scope.isActive = function (testPath) {
        return scope.name === testPath;
      };

      let breadcrumbs = [];
      if (!scope.inListing) {
        breadcrumbs = [ createCrumb('#/home', 'Clusters') ];

        const clusterName = _.get(scope, 'cluster.cluster_name');
        if (!scope.inOverview && clusterName) {
          breadcrumbs.push(createCrumb('#/overview', clusterName));
        }

        // Elasticsearch crumbs
        if (scope.inElasticsearch) {
          if (scope.instance) {
            breadcrumbs.push(createCrumb('#/elasticsearch', 'Elasticsearch'));
            if (scope.name === 'indices') {
              breadcrumbs.push(createCrumb('#/elasticsearch/indices', 'Indices'));
            } else if (scope.name === 'nodes') {
              breadcrumbs.push(createCrumb('#/elasticsearch/nodes', 'Nodes'));
            } else if (scope.name === 'ml') {
              breadcrumbs.push(createCrumb('#/elasticsearch/ml_jobs', 'Jobs'));
            }
            breadcrumbs.push(createCrumb(null, scope.instance));
          } else {
            // don't link to Overview when we're possibly on Overview or its sibling tabs
            breadcrumbs.push(createCrumb(null, 'Elasticsearch'));
          }
        }

        // Kibana crumbs
        if (scope.inKibana) {
          if (scope.instance) {
            breadcrumbs.push(createCrumb('#/kibana', 'Kibana'));
            breadcrumbs.push(createCrumb('#/kibana/instances', 'Instances'));
          } else {
            // don't link to Overview when we're possibly on Overview or its sibling tabs
            breadcrumbs.push(createCrumb(null, 'Kibana'));
          }
        }

        // Logstash crumbs
        if (scope.inLogstash) {
          if (scope.instance) {
            breadcrumbs.push(createCrumb('#/logstash', 'Logstash'));
            if (scope.name === 'nodes') {
              breadcrumbs.push(createCrumb('#/logstash/nodes', 'Nodes'));
            }
            breadcrumbs.push(createCrumb(null, scope.instance));
          } else {
            // don't link to Overview when we're possibly on Overview or its sibling tabs
            breadcrumbs.push(createCrumb(null, 'Logstash'));
          }
        }
      }
      scope.breadcrumbs = breadcrumbs.filter(Boolean);

      // Show ML tab?
      scope.isMlSupported = () => {
        return license.mlIsSupported();
      };
    }
  };
});
