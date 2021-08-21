(function () {
    'use strict';

    angular.module('QueueMonitorModule',
        ["ngAnimate", "ngSanitize", "ngTouch", "ui.bootstrap", 'ui.grid', 'ui.grid.resizeColumns', 'tmh.dynamicLocale',
            'ui.grid.moveColumns', 'ui.grid.autoResize', 'ui.grid.saveState', 'formly', 'formlyBootstrap', 'UCLocale', 'HttpInterceptorModule'])

        .config(['tmhDynamicLocaleProvider', function (tmhDynamicLocaleProvider) {
            tmhDynamicLocaleProvider.localeLocationPattern('../../../i18n/ng-locales/angular-locale_{{locale}}.js');
        }])

        .filter('shortDuration', [function () {
            return function (secs) {
                if (angular.isString(secs)) {
                    if (secs === '')
                        return '';
                    secs = parseInt(secs);
                }
                if (!angular.isNumber(secs)) {
                    return secs;
                }
                var hhStr;
                var hh = Math.floor(secs / 3600);
                if (hh)
                    hhStr = hh + ':';
                else
                    hhStr = '';
                var rem = secs % 3600;
                var mm = Math.floor(rem / 60);
                var ss = rem % 60;
                if (ss < 10)
                    ss = '0' + ss;
                return hhStr + mm + ':' + ss;
            };
        }])
        .filter('durationToSeconds', [function () {
            return function (hhmmss) {
                var arr = hhmmss.split(':');
                if (angular.isArray(arr)) {
                    var duration = 0;
                    if (arr.length == 3) {
                        duration += parseInt(arr[0]) * 3600;
                        arr.shift();
                    }
                    if (arr.length == 2) {
                        duration += parseInt(arr[0]) * 60;
                        arr.shift();
                    }
                    duration += parseInt(arr[0]);
                    return duration;
                }
                else
                    return 0;
            }
        }])
        .directive('resize', ['$log', '$rootScope', '$window', '$timeout', function ($log, $rootScope, $window, $timeout) {
            return function (scope, element) {
                var w = angular.element($window);
                scope.getWindowDimensions = function () {
                    return {
                        innerHeight: $window.innerHeight,
                        innerWidth: $window.innerWidth,
                        top: $window.screenTop ? $window.screenTop : $window.screenY,
                        left: $window.screenLeft ? $window.screenLeft : $window.screenX
                    };
                };
                scope.$watch(scope.getWindowDimensions, function (newValue, oldValue) {
                    $rootScope.$broadcast('WINDOW_RESIZE', {
                        height: newValue.innerHeight,
                        width: newValue.innerWidth,
                        top: newValue.top,
                        left: newValue.left
                    });

                }, true);

                w.bind('resize', function () {
                    $timeout(function () {
                        scope.$apply();
                    }, 0);
                });
            }
        }])
        .service('$QueueMonitor', QueueMonitorService)
        .controller('QueueMonitorCtrl', QueueMonitorCtrl)
        .config(config)
        .run(run);

    config.$inject = [];
    function config() {

    }

    run.$inject = ['formlyConfig'];
    function run(formlyConfig) {

        formlyConfig.setType({
            name: 'qm_grid',
            template: '<div ui-grid="model[options.key]" ui-grid-resize-columns ui-grid-move-columns ui-grid-save-state style="height: 95vh;"></div>',
            wrapper: ['bootstrapLabel', 'bootstrapHasError']
        });
    }

    QueueMonitorService.$inject = ['$log'];
    function QueueMonitorService($log) {

        var service = {};

        // public variables

        // public methods

        return service;


    };

    QueueMonitorCtrl.$inject = ['$rootScope', '$log', '$window', '$filter', '$interval', 'UCServices', 'UCLocaleService'];

    function QueueMonitorCtrl($rootScope, $log, $window, $filter, $interval, UCServices, UCLocaleService) {
        var queueMonitorCtrl = this;


        queueMonitorCtrl.callParent = undefined;
        queueMonitorCtrl.status = undefined;
        queueMonitorCtrl.thresholds = undefined;

        queueMonitorCtrl.model = {};

        queueMonitorCtrl.model.qmGridOptions = {
            enableFiltering: false,
            enableHiding: false,
            enableGridMenu: true,
            gridMenuShowHideColumns: true,
            onRegisterApi: function (gridApi) {
                queueMonitorCtrl.gridApi = gridApi;

                queueMonitorCtrl.gridApi.colResizable.on.columnSizeChanged(null, function (colDef, deltaChange) {
                    queueMonitorCtrl.saveState();
                });

                queueMonitorCtrl.gridApi.colMovable.on.columnPositionChanged(null, function (colDef, originalPosition, newPosition) {
                    queueMonitorCtrl.saveState();
                });

                queueMonitorCtrl.gridApi.core.on.columnVisibilityChanged(null, function (changedColumn) {
                    if (!queueMonitorCtrl.restoringState)
                        queueMonitorCtrl.saveState();
                });

            }
        };

        queueMonitorCtrl.model.qmGridOptions.columnDefs = [];
        queueMonitorCtrl.model.qmGridOptions.data = [];
        queueMonitorCtrl.fields = [
            {
                key: 'qmGridOptions',
                type: 'qm_grid',
                templateOptions: {
                    label: ''
                }
            }
        ];

        queueMonitorCtrl.setupColumnDefs = function () {
            queueMonitorCtrl.model.qmGridOptions.columnDefs = [
                {
                    field: 'Name',
                    displayName: UCLocaleService.getPhrase("Column.Name"),
                    cellTemplate: '<div class="ui-grid-cell-contents"><span ng-class="{\'fa fa-moon-o\': row.entity.NightMode}"></span><span> {{COL_FIELD}}</span></div>',
                },
                {
                    field: 'LoggedIn',
                    cellClass: function (grid, row, col, rowRenderIndex, colRenderIndex) {
                        if (row.entity.TooFewAgents)
                            return row.entity.TooFewAgents.color;
                    },
                    type: 'number',
                    displayName: UCLocaleService.getPhrase("Agents"),
                    cellTemplate: '<div class="ui-grid-cell-contents"><span>{{COL_FIELD}}</span></div>',
                },
                {
                    field: 'Available',
                    type: 'number',
                    displayName: UCLocaleService.getPhrase("State.Ready"),
                    cellTemplate: '<div class="ui-grid-cell-contents"><span>{{COL_FIELD}}</span></div>'
                },
                {
                    field: 'OnACall',
                    type: 'number',
                    displayName: UCLocaleService.getPhrase("State.Busy"),
                    cellTemplate: '<div class="ui-grid-cell-contents"><span>{{COL_FIELD}}</span></div>'
                },
                {
                    field: 'InQueue',
                    cellClass: function (grid, row, col, rowRenderIndex, colRenderIndex) {
                        if (row.entity.TooManyCalls)
                            return row.entity.TooManyCalls.color
                    },
                    type: 'number',
                    displayName: UCLocaleService.getPhrase("Waiting"),
                    cellTemplate: '<div class="ui-grid-cell-contents">{{COL_FIELD}}</div>'
                },
                {
                    field: 'longestWaitTime',
                    cellClass: function (grid, row) {
                        if (row.entity.TooLongWait)
                            return row.entity.TooLongWait.color
                    },
                    displayName: UCLocaleService.getPhrase("LongestWait"),
                    cellTemplate: '<div class="ui-grid-cell-contents">{{COL_FIELD | shortDuration}}</div>'
                },
            ];
        };

        queueMonitorCtrl.saveState = function () {
            $log.info("saveState");
            queueMonitorCtrl.callParent("SAVE_STATE", angular.toJson(queueMonitorCtrl.gridApi.saveState.save()));

        }

        queueMonitorCtrl.restoreState = function (theState) {
            $log.info("restoreState", theState);
            if (theState) {
                queueMonitorCtrl.restoringState = true;

                queueMonitorCtrl.winState = theState;
                if (queueMonitorCtrl.gridApi && queueMonitorCtrl.gridApi.saveState)
                    queueMonitorCtrl.gridApi.saveState.restore(null, theState);

                queueMonitorCtrl.restoringState = false;
            }

        }

        var lastTimeReceivedMessage;

        function applyQueueThresholds(queueRow) {
            if (queueMonitorCtrl.thresholds.TooManyCalls.enabled) {
                var thresholdObj = null;
                if (queueMonitorCtrl.thresholds.TooManyCalls.thresholds[1].display && queueRow.InQueue > queueMonitorCtrl.thresholds.TooManyCalls.thresholds[1].value) {
                    thresholdObj = {
                        type: '2',
                        color: queueMonitorCtrl.thresholds.TooManyCalls.thresholds[1].color
                    };
                }
                else if (queueRow.InQueue > queueMonitorCtrl.thresholds.TooManyCalls.thresholds[0].value) {
                    thresholdObj = {
                        type: '1',
                        color: queueMonitorCtrl.thresholds.TooManyCalls.thresholds[0].color
                    };
                }
                if (thresholdObj)
                    queueRow["TooManyCalls"] = thresholdObj;
                else
                    queueRow["TooManyCalls"] = undefined;
            }
            else
                queueRow["TooManyCalls"] = undefined;


            if (queueMonitorCtrl.thresholds.TooFewAgents.enabled) {
                var thresholdObj = null;
                if (queueMonitorCtrl.thresholds.TooFewAgents.thresholds[1].display && queueRow.LoggedIn < queueMonitorCtrl.thresholds.TooFewAgents.thresholds[1].value) {
                    thresholdObj = {
                        type: '1',
                        color: queueMonitorCtrl.thresholds.TooFewAgents.thresholds[1].color
                    };
                }
                else if (queueRow.LoggedIn < queueMonitorCtrl.thresholds.TooFewAgents.thresholds[0].value) {
                    thresholdObj = {
                        type: '2',
                        color: queueMonitorCtrl.thresholds.TooFewAgents.thresholds[0].color
                    };
                }
                if (thresholdObj)
                    queueRow["TooFewAgents"] = thresholdObj;
                else
                    queueRow["TooFewAgents"] = undefined;
            }
            else
                queueRow["TooFewAgents"] = undefined;

            if (queueMonitorCtrl.thresholds.TooLongWait.enabled) {
                $log.info("--queueRow.longestWaitTime", queueRow.longestWaitTime);
                var thresholdObj = null;
                if (queueMonitorCtrl.thresholds.TooLongWait.thresholds[1].display && queueRow.longestWaitTime > queueMonitorCtrl.thresholds.TooLongWait.thresholds[1].value) {
                    thresholdObj = {
                        type: '2',
                        color: queueMonitorCtrl.thresholds.TooLongWait.thresholds[1].color
                    };
                }
                else if (queueRow.longestWaitTime > queueMonitorCtrl.thresholds.TooLongWait.thresholds[0].value) {
                    thresholdObj = {
                        type: '1',
                        color: queueMonitorCtrl.thresholds.TooLongWait.thresholds[0].color
                    };
                }
                if (thresholdObj)
                    queueRow["TooLongWait"] = thresholdObj;
                else
                    queueRow["TooLongWait"] = undefined;
            }
            else
                queueRow["TooLongWait"] = undefined;

        }

        function processDataItem(queue) {
            if (queue.InQueue) {
                queue.startTime = new Date().getTime();
                var duration = $filter('durationToSeconds')(queue.LongestWaitTime);
                $log.info("queue.LongestWaitTime", queue.LongestWaitTime, "duration", duration);
                if (duration) {
                    queue.startTime = queue.startTime - duration * 1000;
                    queue.longestWaitTime = duration;
                }
                else
                    queue.longestWaitTime = 0;

            }
            else {
                queue.longestWaitTime = '';
            }

            return queue;
        }

        $interval(function () {
            var refresh = false;
            angular.forEach(queueMonitorCtrl.model.qmGridOptions.data, function (queue) {
                if (queue.InQueue) {
                    var currentTime = new Date().getTime();
                    queue.longestWaitTime = Math.floor((currentTime - queue.startTime) / 1000);
                    applyQueueThresholds(queue);
                    refresh = true;
                }
            });
            if (refresh)
                queueMonitorCtrl.model.qmGridOptions.data = angular.copy(queueMonitorCtrl.model.qmGridOptions.data);
        }, 1000);

        function messageFromParent(data) {

            lastTimeReceivedMessage = new Date().getTime();

            if (data && data.type !== 'KeepAlive')
                $log.info("QueueMonitorCtrl", data);

            if (data.type === 'data') {
                if (data.data) {

                    var arrTempStatus = [];
                    angular.forEach(data.data.status, function (queue) {
                        arrTempStatus.push(processDataItem(queue));
                    })


                    // build the threshold alarms
                    try {
                        queueMonitorCtrl.thresholds = data.data.thresholds;
                        $log.debug('queueMonitorCtrl.thresholds', queueMonitorCtrl.thresholds);

                        angular.forEach(arrTempStatus, function (queueRow) {
                            applyQueueThresholds(queueRow);
                        });
                    }
                    catch (err) {

                    }

                    $log.debug('queueMonitorCtrl.model.qmGridOptions.data', arrTempStatus);
                    queueMonitorCtrl.model.qmGridOptions.data = arrTempStatus;

                    queueMonitorCtrl.readyToDisplay = true;

                    $rootScope.$applyAsync();
                }
            }
            else if (data.type === 'QueueMonitor') {
                var newData = angular.copy(queueMonitorCtrl.model.qmGridOptions.data);
                angular.forEach(data.data.status, function (queueRow) {
                    var foundQueue = newData.find(function (item) {
                        return item.ID === queueRow.ID;
                    })
                    $log.info("foundQueue", foundQueue);
                    if (foundQueue) {
                        processDataItem(queueRow);
                        applyQueueThresholds(queueRow);

                        angular.copy(queueRow, foundQueue);
                    }
                });
                queueMonitorCtrl.model.qmGridOptions.data = newData;
                $rootScope.$applyAsync();
            }
            else if (data.type === 'thresholds') {
                $log.info("Apply new thresholds");
                queueMonitorCtrl.thresholds = data.data;

                var newData = angular.copy(queueMonitorCtrl.model.qmGridOptions.data);
                angular.forEach(newData, function (queueRow) {
                    applyQueueThresholds(queueRow)
                });
                queueMonitorCtrl.model.qmGridOptions.data = newData;
                $rootScope.$applyAsync();
            }
            else if (data.type === 'RESTORE_STATE') {
                queueMonitorCtrl.restoreState(data.data);
            } else if (data.type === 'Init') {
                UCServices.address = data.data.address;
                console.debug("set address to", UCServices.address);
            }
        }

        $rootScope.getPhrase = function (key) {
            return UCLocaleService.getPhrase(key);
        };

        queueMonitorCtrl.windowLoaded = function () {
            $log.info("QueueMonitor window loaded");

            var ua = navigator.userAgent.toLowerCase();
            if ((ua.indexOf('msie') >= 0) || (navigator.appVersion.toLowerCase().indexOf('trident/') >= 0)) {
                // for IE
                queueMonitorCtrl.callParent = window.opener.callBackToQueueMonitorLauncher;
            }
            else {
                // for all others
                queueMonitorCtrl.callParent = window.callBackToQueueMonitorLauncher;
            }

            var locale = window.navigator.language || window.navigator.userLanguage;
            if (!locale) {
                $log.error("Locale empty, defaulting to en-us");
                locale = 'en-US';
            }
            locale = locale.toLocaleLowerCase();
            $log.info("Using browser locale", locale);

            UCLocaleService.setPath("../../../i18n/locales/");
            UCLocaleService.loadLocale(locale).then(
                function (data) {
                    $log.info("loadLocale success");
                    queueMonitorCtrl.setupColumnDefs();
                    // let parent know we are ready and send callback for parent to communicate with us
                    queueMonitorCtrl.callParent('READY', messageFromParent);
                },
                function (error) {
                    $log.error("loadLocale", error);
                    queueMonitorCtrl.callParent('ERROR', "LOCALE_LOAD_ERROR");
                }
            );
            

        }

        $rootScope.$on('WINDOW_RESIZE', function (event, args) {
            queueMonitorCtrl.callParent("RESIZE", angular.toJson(args));
        });


        $interval(function () {
            var currentTime = new Date().getTime();
            if ((currentTime - lastTimeReceivedMessage) >= 15000) {
                $log.error("No Communication from parent");
                try {
                    queueMonitorCtrl.communicationLost = true;
                    $window.close();
                }
                catch (err) {
                }
            }
            else
                queueMonitorCtrl.communicationLost = false;

        }, 5000);
    }


})();