import { get, find } from 'lodash';
import { verifyMonitoringLicense } from './verify_monitoring_license';
import { INVALID_LICENSE } from '../../common/constants';

export function alertsClustersAggregation(req, clusters, checkLicense) {
  const verification = verifyMonitoringLicense(req.server);

  if (!verification.enabled) {
    // return metadata detailing that alerts is disabled because of the monitoring cluster license
    return Promise.resolve({ alertsMeta: verification });
  }

  const config = req.server.config();
  const params = {
    index: config.get('xpack.monitoring.cluster_alerts.index'),
    ignoreUnavailable: true,
    filterPath: 'aggregations',
    body: {
      size: 0,
      query: {
        bool: {
          must_not: [
            {
              exists: { field: 'resolved_timestamp' }
            }
          ]
        }
      },
      aggs: {
        group_by_cluster: {
          terms: {
            field: 'metadata.cluster_uuid',
            size: 10
          },
          aggs: {
            group_by_severity: {
              range: {
                field: 'metadata.severity',
                ranges: [
                  {
                    key: 'low',
                    to: 1000
                  },
                  {
                    key: 'medium',
                    from: 1000,
                    to: 2000
                  },
                  {
                    key: 'high',
                    from: 2000
                  }
                ]
              }
            }
          }
        }
      }
    }
  };

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('monitoring');
  return callWithRequest(req, 'search', params)
  .then((result) => {
    const buckets = get(result.aggregations, 'group_by_cluster.buckets');
    const meta = { alertsMeta: { enabled: true } };

    return clusters.reduce((reClusters, cluster) => {
      let alerts;

      const license = cluster.license || INVALID_LICENSE;
      // check the license type of the production cluster for alerts feature support
      const prodLicenseInfo = checkLicense(license.type, license.status === 'active', 'production');
      if (prodLicenseInfo.clusterAlerts.enabled) {
        const bucket = find(buckets, { key: cluster.cluster_uuid });
        let severities = {};
        if (bucket) {
          if (bucket.doc_count > 0) {
            const lowGroup = find(bucket.group_by_severity.buckets, { key: 'low' }) || {};
            const mediumGroup = find(bucket.group_by_severity.buckets, { key: 'medium' }) || {};
            const highGroup = find(bucket.group_by_severity.buckets, { key: 'high' }) || {};
            severities = {
              low: lowGroup.doc_count || 0,
              medium: mediumGroup.doc_count || 0,
              high: highGroup.doc_count || 0
            };
          }

          alerts = Object.assign({}, { count: bucket.doc_count }, severities);
        }
      } else {
        // add metadata to the cluster's alerts object detailing that alerts are disabled because of the prod cluster license
        alerts = {
          clusterMeta: {
            enabled: false,
            message: `Cluster [${cluster.cluster_name}] license type [${license.type}] does not support Cluster Alerts` }
        };
      }

      return Object.assign(reClusters, { [cluster.cluster_uuid]: alerts });
    }, meta);
  });
}
