import React from 'react';
import ReactDOM from 'react-dom';
import { Table } from 'plugins/monitoring/components/paginated_table';
import { SORT_ASCENDING } from 'monitoring-constants';
import { ClusterRow } from 'plugins/monitoring/components/cluster/listing/cluster_row';
import { Notifier } from 'ui/notify/notifier';
import { uiModules } from 'ui/modules';

const uiModule = uiModules.get('monitoring/directives', []);
uiModule.directive('monitoringClusterListing', ($injector) => {
  return {
    restrict: 'E',
    scope: { clusters: '=' },
    link: function ($scope, $el) {

      const options = {
        title: null,
        searchPlaceholder: 'Filter Clusters',
        filterFields: ['cluster_name', 'status', 'license.type'],
        // "key" properties are scalars used for sorting
        columns: [
          {
            key: 'cluster_name',
            sort: SORT_ASCENDING,
            title: 'Name'
          },
          {
            key: 'status',
            title: 'Status'
          },
          {
            key: 'elasticsearch.stats.nodes.count.total',
            title: 'Nodes'
          },
          {
            key: 'elasticsearch.stats.indices.count',
            title: 'Indices'
          },
          {
            key: 'elasticsearch.stats.indices.store.size_in_bytes',
            title: 'Data'
          },
          {
            key: 'logstash.count',
            title: 'Logstash'
          },
          {
            key: 'kibana.count',
            title: 'Kibana'
          },
          {
            key: 'license.type',
            title: 'License'
          }
        ]
      };

      const table = ReactDOM.render(<Table
        scope={ $scope }
        template={ ClusterRow }
        options={ options }/>, $el[0]);

      const notify = new Notifier();
      function licenseWarning(message) {
        $scope.$evalAsync(function () {
          notify.warning(message, {
            lifetime: 60000
          });
        });
      }

      const globalState = $injector.get('globalState');
      const kbnUrl = $injector.get('kbnUrl');
      function changeCluster(uuid) {
        $scope.$evalAsync(function () {
          globalState.cluster_uuid = uuid;
          globalState.save();
          kbnUrl.changePath('/overview');
        });
      }

      const showLicenseExpiration = $injector.get('showLicenseExpiration');
      $scope.$watch('clusters', (data) => {
        if (data) {
          data.forEach((cluster) => {
            // these become props for the cluster row
            cluster.changeCluster = changeCluster;
            cluster.licenseWarning = licenseWarning;
            cluster.showLicenseExpiration = showLicenseExpiration;
          });
          table.setData(data);
        }
      });
    }
  };
});
