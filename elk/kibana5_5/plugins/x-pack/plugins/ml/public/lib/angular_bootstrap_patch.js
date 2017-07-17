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

// the version of angular bootstrap ui included in kibana is old
// and doesn't allow html or templates to be used as the content of popovers
// we have to manually add this functionality as a custom directive
import 'ui-bootstrap';
import angular from 'angular';
angular.module('ui.bootstrap.popover')
  .directive('popoverHtmlUnsafePopup', function ($compile) {
    let template = '<div class="popover {{placement}}" ng-class="{ in: isOpen(), fade: animation() }">';
    template += '<div class="arrow"></div>';
    template += '<div class="popover-inner">';
    template += '<h3 class="popover-title" bind-html-unsafe="title" ng-show="title"></h3>';
    template += '<div class="popover-content" bind-html-unsafe="content" ></div>';
    template += '</div></div>';
    return {
      restrict: 'EA',
      replace: true,
      scope: {
        title: '@',
        content: '@',
        placement: '@',
        animation: '&',
        isOpen: '&'
      },
      template: template,
      link: function (scope, element) {
        // The content of the popup is added as a string and does not run through angular's templating system.
        // therefore {{stuff}} substitutions don't happen.
        // we have to manually apply the template, compile it with this scope and then set it as the html
        scope.$apply();
        const cont = $compile(scope.content)(scope);
        element.find('.popover-content').html(cont);

        // function to force the popover to close
        scope.closePopover = function () {
          scope.$parent.$parent.isOpen = false;
          scope.$parent.$parent.$applyAsync();
          element.remove();
        };
      }
    };
  })
  .directive('popoverHtmlUnsafe', ['$tooltip', function ($tooltip) {
    return $tooltip('popoverHtmlUnsafe', 'popover', 'click');
  }]);
