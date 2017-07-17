/*
 * ELASTICSEARCH CONFIDENTIAL
 *
 * Copyright (c) 2017 Elasticsearch BV. All Rights Reserved.
 *
 * Notice: this software, and all information contained
 * therein, is the exclusive property of Elasticsearch BV
 * and its licensors, if any, and is protected under applicable
 * domestic and foreign law, and international treaties.
 *
 * Reproduction, republication or distribution without the
 * express written consent of Elasticsearch BV is
 * strictly prohibited.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.ElasticsearchShield = factory();
  }
}(this, function () {
  return function addMlApi(Client, config, components) {
    const ca = components.clientAction.factory;

    Client.prototype.ml = components.clientAction.namespaceFactory();
    const ml = Client.prototype.ml.prototype;

    /**
     * Perform a [ml.authenticate](Retrieve details about the currently authenticated user) request
     *
     * @param {Object} params - An object with parameters used to carry out this action
     */
    ml.jobs = ca({
      urls: [
        {
          fmt: '/_xpack/ml/anomaly_detectors/<%=jobId%>',
          req: {
            jobId: {
              type: 'list'
            }
          }
        },
        {
          fmt: '/_xpack/ml/anomaly_detectors/',
        }
      ],
      method: 'GET'
    });

    ml.jobStats = ca({
      urls: [
        {
          fmt: '/_xpack/ml/anomaly_detectors/<%=jobId%>/_stats',
          req: {
            jobId: {
              type: 'list'
            }
          }
        },
        {
          fmt: '/_xpack/ml/anomaly_detectors/_stats',
        }
      ],
      method: 'GET'
    });

    ml.addJob = ca({
      urls: [
        {
          fmt: '/_xpack/ml/anomaly_detectors/<%=jobId%>',
          req: {
            jobId: {
              type: 'string'
            }
          }
        }
      ],
      needBody: true,
      method: 'PUT'
    });

    ml.openJob = ca({
      urls: [
        {
          fmt: '/_xpack/ml/anomaly_detectors/<%=jobId%>/_open',
          req: {
            jobId: {
              type: 'string'
            }
          }
        }
      ],
      method: 'POST'
    });

    ml.closeJob = ca({
      urls: [
        {
          fmt: '/_xpack/ml/anomaly_detectors/<%=jobId%>/_close',
          req: {
            jobId: {
              type: 'string'
            }
          }
        }
      ],
      method: 'POST'
    });

    ml.deleteJob = ca({
      urls: [{
        fmt: '/_xpack/ml/anomaly_detectors/<%=jobId%>',
        req: {
          jobId: {
            type: 'string'
          }
        }
      }, {
        fmt: '/_xpack/ml/anomaly_detectors/<%=jobId%>?force=true',
        req: {
          jobId: {
            type: 'string'
          },
          force: {
            type: 'boolean'
          }
        }
      }],
      method: 'DELETE'
    });

    ml.updateJob = ca({
      urls: [
        {
          fmt: '/_xpack/ml/anomaly_detectors/<%=jobId%>/_update',
          req: {
            jobId: {
              type: 'string'
            }
          }
        }
      ],
      needBody: true,
      method: 'POST'
    });

    ml.datafeeds = ca({
      urls: [
        {
          fmt: '/_xpack/ml/datafeeds/<%=datafeedId%>',
          req: {
            datafeedId: {
              type: 'list'
            }
          }
        },
        {
          fmt: '/_xpack/ml/datafeeds/',
        }
      ],
      method: 'GET'
    });

    ml.datafeedStats = ca({
      urls: [
        {
          fmt: '/_xpack/ml/datafeeds/<%=datafeedId%>/_stats',
          req: {
            datafeedId: {
              type: 'list'
            }
          }
        },
        {
          fmt: '/_xpack/ml/datafeeds/_stats',
        }
      ],
      method: 'GET'
    });

    ml.addDatafeed = ca({
      urls: [
        {
          fmt: '/_xpack/ml/datafeeds/<%=datafeedId%>',
          req: {
            datafeedId: {
              type: 'string'
            }
          }
        }
      ],
      needBody: true,
      method: 'PUT'
    });

    ml.updateDatafeed = ca({
      urls: [
        {
          fmt: '/_xpack/ml/datafeeds/<%=datafeedId%>/_update',
          req: {
            datafeedId: {
              type: 'string'
            }
          }
        }
      ],
      needBody: true,
      method: 'POST'
    });

    ml.deleteDatafeed = ca({
      urls: [{
        fmt: '/_xpack/ml/datafeeds/<%=datafeedId%>',
        req: {
          datafeedId: {
            type: 'string'
          }
        }
      },{
        fmt: '/_xpack/ml/datafeeds/<%=datafeedId%>?force=true',
        req: {
          datafeedId: {
            type: 'string'
          },
          force: {
            type: 'boolean'
          }
        }
      }],
      method: 'DELETE'
    });

    ml.startDatafeed = ca({
      urls: [
        {
          fmt: '/_xpack/ml/datafeeds/<%=datafeedId%>/_start?&start=<%=start%>&end=<%=end%>',
          req: {
            datafeedId: {
              type: 'string'
            },
            start: {
              type: 'string'
            },
            end: {
              type: 'string'
            }
          }
        },
        {
          fmt: '/_xpack/ml/datafeeds/<%=datafeedId%>/_start?&start=<%=start%>',
          req: {
            datafeedId: {
              type: 'string'
            },
            start: {
              type: 'string'
            }
          }
        }
      ],
      method: 'POST'
    });

    ml.stopDatafeed = ca({
      urls: [
        {
          fmt: '/_xpack/ml/datafeeds/<%=datafeedId%>/_stop',
          req: {
            datafeedId: {
              type: 'string'
            }
          }
        }
      ],
      method: 'POST'
    });

    ml.validateDetector = ca({
      url: {
        fmt: '/_xpack/ml/anomaly_detectors/_validate/detector'
      },
      needBody: true,
      method: 'POST'
    });

    ml.datafeedPreview = ca({
      url: {
        fmt: '/_xpack/ml/datafeeds/<%=datafeedId%>/_preview',
        req: {
          datafeedId: {
            type: 'string'
          }
        }
      },
      method: 'GET'
    });

    ml.privilegeCheck = ca({
      url: {
        fmt: '/_xpack/security/user/_has_privileges'
      },
      needBody: true,
      method: 'POST'
    });

  };
}));
