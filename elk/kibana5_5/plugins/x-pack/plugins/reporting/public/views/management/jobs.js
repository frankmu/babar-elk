import 'angular-paging';
import 'plugins/reporting/services/job_queue';
import 'plugins/reporting/less/main.less';
import 'plugins/reporting/services/feature_check';

import routes from 'ui/routes';
import template from 'plugins/reporting/views/management/jobs.html';

const jobPollingDelay = 5000;
const pageSize = 10;

function getJobs(reportingJobQueue, showAll, page = 0) {
  return reportingJobQueue.list(page, showAll)
  .then((jobs) => {
    return reportingJobQueue.total(showAll)
    .then((total) => {
      const mappedJobs = mapJobs(jobs);
      return {
        jobs: mappedJobs,
        total: total,
        pages: Math.ceil(total / pageSize),
      };
    });
  })
  .catch(() => {
    return {
      jobs: [],
      total: 0,
      pages: 1,
    };
  });
}

function mapJobs(jobs) {
  return jobs.map((job) => {
    return {
      id: job._id,
      type: job._source.jobtype,
      object_type: job._source.payload.type,
      object_title: job._source.payload.title,
      created_by: job._source.created_by,
      created_at: job._source.created_at,
      started_at: job._source.started_at,
      completed_at: job._source.completed_at,
      status: job._source.status,
      content_type: job._source.output ? job._source.output.content_type : false
    };
  });
}

routes.when('/management/kibana/reporting', {
  template,
  controllerAs: 'jobsCtrl',
  controller($scope, $route, $window, $interval, reportingJobQueue, reportingFeatureCheck) {
    this.loading = false;
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.reportingJobs = [];
    this.shieldEnabled = reportingFeatureCheck.shield();
    this.showMine = true;

    const toggleLoading = () => {
      this.loading = !this.loading;
    };

    const updateJobs = () => {
      const showAll = !this.shieldEnabled || !this.showMine;

      return getJobs(reportingJobQueue, showAll, this.currentPage - 1)
      .then((jobs) => {
        this.reportingJobs = jobs;
      });
    };

    const updateJobsLoading = () => {
      toggleLoading();
      updateJobs().then(toggleLoading);
    };

    // pagination logic
    this.setPage = (page) => {
      this.currentPage = page;
    };

    // job list updating
    const int = $interval(() => updateJobs(), jobPollingDelay);

    // control handlers
    this.download = (jobId) => {
      $window.open(`../api/reporting/jobs/download/${jobId}`);
    };

    // fetch and show job error details
    this.showError = (jobId) => {
      reportingJobQueue.getContent(jobId)
      .then((doc) => {
        this.errorMessage = {
          job_id: jobId,
          message: doc.content,
        };
      });
    };

    $scope.$watch('jobsCtrl.currentPage', updateJobsLoading);
    $scope.$watch('jobsCtrl.showMine', (newVal, oldVal) => {
      if (newVal !== oldVal) {
        if (this.currentPage === 1) {
          // if already on the first page, update the job list
          updateJobsLoading();
        } else {
          // otherwise let the currentPage watcher update the list
          this.currentPage = 1;
        }
      }
    });
    $scope.$on('$destroy', () => $interval.cancel(int));
  }
});
