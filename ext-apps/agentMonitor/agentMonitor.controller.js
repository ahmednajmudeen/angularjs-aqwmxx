(function () {
    'use strict';

    angular.module('AgentMonitorModule',
        ["ngAnimate", "ngSanitize", "ngTouch", "ui.bootstrap", 'ui.grid', 'ui.grid.resizeColumns', 'tmh.dynamicLocale',
            'ui.grid.moveColumns', 'ui.grid.autoResize', 'ui.grid.saveState', 'formly', 'formlyBootstrap', 'AgentUtilsModule', 'UCLocale', 'HttpInterceptorModule'])

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
                } else
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
        .service('$AgentMonitor', AgentMonitorService)
        .controller('AgentMonitorCtrl', AgentMonitorCtrl)
        .config(config)
        .run(run);

    config.$inject = [];

    function config() {

    }

    run.$inject = ['formlyConfig'];

    function run(formlyConfig) {

        formlyConfig.setType({
            name: 'am_grid',
            template: '<div ui-grid="model[options.key]" ui-grid-resize-columns ui-grid-move-columns ui-grid-save-state style="height: 95vh;"></div>',
            wrapper: ['bootstrapLabel', 'bootstrapHasError']
        });
    }

    AgentMonitorService.$inject = ['$log'];

    function AgentMonitorService($log) {

        var service = {};

        // public variables

        // public methods

        return service;


    };

    AgentMonitorCtrl.$inject = ['$rootScope', '$log', '$window', '$document', '$filter', '$timeout', '$interval', '$AgentUtils', 'UCServices', 'UCLocaleService'];

    function AgentMonitorCtrl($rootScope, $log, $window, $document, $filter, $timeout, $interval, $AgentUtils, UCServices, UCLocaleService) {
        var agentMonitorCtrl = this;


        agentMonitorCtrl.callParent = undefined;
        agentMonitorCtrl.status = undefined;
        agentMonitorCtrl.thresholds = undefined;

        agentMonitorCtrl.model = {};

        agentMonitorCtrl.model.qmGridOptions = {
            enableFiltering: false,
            enableHiding: false,
            enableGridMenu: true,
            gridMenuShowHideColumns: true,
            onRegisterApi: function (gridApi) {
                agentMonitorCtrl.gridApi = gridApi;

                agentMonitorCtrl.gridApi.colResizable.on.columnSizeChanged(null, function (colDef, deltaChange) {
                    agentMonitorCtrl.saveState();
                });

                agentMonitorCtrl.gridApi.colMovable.on.columnPositionChanged(null, function (colDef, originalPosition, newPosition) {
                    agentMonitorCtrl.saveState();
                });

                agentMonitorCtrl.gridApi.core.on.columnVisibilityChanged(null, function (changedColumn) {
                    if (!agentMonitorCtrl.restoringState)
                        agentMonitorCtrl.saveState();
                });

                $timeout(function () {
                    agentMonitorCtrl.restoreState(agentMonitorCtrl.winState);
                }, 100);
            }
        };

        agentMonitorCtrl.saveState = function () {
            agentMonitorCtrl.callParent("SAVE_STATE", angular.toJson(agentMonitorCtrl.gridApi.saveState.save()));

        }

        agentMonitorCtrl.restoreState = function (theState) {
            $log.info("restoreState");
            if (theState) {
                agentMonitorCtrl.restoringState = true;

                agentMonitorCtrl.winState = theState;
                if (agentMonitorCtrl.gridApi && agentMonitorCtrl.gridApi.saveState)
                    agentMonitorCtrl.gridApi.saveState.restore(null, theState);

                agentMonitorCtrl.restoringState = false;
            }

        }

        $rootScope.membershipPopoverContents = function (rowEntity) {
            var memberShipArr = [];
            if (!agentMonitorCtrl.queues)
                return '';

            angular.forEach(rowEntity.Membership, function (item) {
                if (agentMonitorCtrl.queues[item])
                    memberShipArr.push(agentMonitorCtrl.queues[item]);
                else
                    memberShipArr.push('Queue_' + item);
            });
            memberShipArr.sort();
            return memberShipArr.join(', ');

        }

        agentMonitorCtrl.model.qmGridOptions.data = [];
        agentMonitorCtrl.fields = [
            {
                key: 'qmGridOptions',
                type: 'am_grid',
                templateOptions: {
                    label: ''
                }
            }
        ];
        agentMonitorCtrl.model.qmGridOptions.columnDefs = [];

        agentMonitorCtrl.setupColumnDefs = function () {
            agentMonitorCtrl.model.qmGridOptions.columnDefs = [
                {
                    field: 'Name',
                    displayName: UCLocaleService.getPhrase("Column.Name"),
                    cellTemplate: '<div class="ui-grid-cell-contents">' +
                        '<span>{{COL_FIELD}}</span>' +
                        '<span class="pull-right badge info-badge" ng-if="row.entity.membershipCount" style="margin-left:0.2em";font-size:85% ' +
                        'uib-popover="{{grid.appScope.$root.membershipPopoverContents(row.entity)}}"' +
                        'popover-trigger="\'mouseenter focus outsideClick\'"' +
                        'popover-placement="bottom-left"' +
                        'popover-append-to-body="true">{{row.entity.membershipCount}}</span>' +
                        '</div>',
                },
                {
                    field: 'extension',
                    type: 'number',
                    displayName: UCLocaleService.getPhrase("Name.Ext"),
                    cellTemplate: '<div class="ui-grid-cell-contents"><span> {{COL_FIELD}}</span></div>',
                },
                {
                    field: 'state',
                    displayName: UCLocaleService.getPhrase("Status"),
                    cellTemplate: '<div class="ui-grid-cell-contents"><i ng-class="row.entity.stateImage"></i> {{COL_FIELD}}</div>',
                    cellClass: function (grid, row) {
                        return row.entity.stateColorCell;
                    },
                },
            ];
        };

        var lastTimeReceivedMessage;


        function processDataItem(item, state) {
            if (state) {
                item.state = state.label;
                item.stateImage = state.image;
                item.stateColor = state.color;
                item.stateColorCell = state.colorCell;
                if (item.State === 'Busy') {
                    item.state += (': ' + item.Queue);
                }
            } else {

                // assuming a break state
                var breakState = $AgentUtils.statesDisplay['OffDuty'];
                if (item.State === 'CALLBACK_ACTIVITY') {
                    item.state = "Callback activity";
                    item.State = item.state;
                } else
                    item.state = item.State;

                item.stateImage = breakState.image;
                item.stateColor = breakState.color;
                item.stateColorCell = breakState.colorCell;
                item.state += (': ' + item.Queue);
//                state = item.State;

            }

            if (item.State !== 'Out') {
                if (item.Membership)
                    item.membershipCount = item.Membership.length;

                if (item.Duration)
                    item.state += (' (' + item.Duration + ')');


                item.startTime = new Date().getTime();
                if (item.Elapsed) {
                    item.startTime = item.startTime - item.Elapsed * 1000;
                }

            }


            return item;
        }

        function messageFromParent(data) {
            if (data && data.type !== 'KeepAlive')
                $log.info("AgentMonitorCtrl", data);

            lastTimeReceivedMessage = new Date().getTime();

            if (data.type === 'data') {
                if (data.data) {

                    agentMonitorCtrl.queues = data.data.queues;
                    $log.info("agentMonitorCtrl.queues", agentMonitorCtrl.queues);

                    var statesDisplay = $AgentUtils.statesDisplay;
                    var arrTempStatus = [];
                    angular.forEach(data.data.status, function (item) {
                        arrTempStatus.push(processDataItem(item, statesDisplay[item.State]));
                    });

                    agentMonitorCtrl.model.qmGridOptions.data = arrTempStatus;

                    agentMonitorCtrl.readyToDisplay = true;

                    $rootScope.$applyAsync();
                }
            } else if (data.type === 'AgentMonitor') {
                if (data.data) {

                    var newData = [];
                    angular.copy(agentMonitorCtrl.model.qmGridOptions.data, newData);
                    var statesDisplay = $AgentUtils.statesDisplay;
                    angular.forEach(data.data.status, function (item) {

                        var updatedItem = processDataItem(item, statesDisplay[item.State]);
                        $log.info("updatedItem", angular.copy(updatedItem));
                        var index = -1;
                        for (var i = 0; i < newData.length; i++) {
                            var agent = newData[i];
                            $log.info("agent before update", angular.copy(agent));
                            if (item.ID === agent.ID) {
                                angular.copy(updatedItem, agent);
                                $log.info("agent after update", angular.copy(agent));

                                break;
                            }
                        }
                    });
                    agentMonitorCtrl.model.qmGridOptions.data = newData;
//                    agentMonitorCtrl.gridApi.grid.refreshRows();

                }
            } else if (data.type === 'RESTORE_STATE') {
                agentMonitorCtrl.restoreState(data.data);
            } else if (data.type === 'Init') {
                UCServices.address = data.data.address;
                console.debug("set address to", UCServices.address);
            }
        }

        $rootScope.getPhrase = function (key) {
            return UCLocaleService.getPhrase(key);
        };

        agentMonitorCtrl.windowLoaded = function () {
            $log.info("AgentMonitor window loaded");

            var ua = navigator.userAgent.toLowerCase();
            if ((ua.indexOf('msie') >= 0) || (navigator.appVersion.toLowerCase().indexOf('trident/') >= 0)) {
                // for IE
                agentMonitorCtrl.callParent = window.opener.callBackToAgentMonitorLauncher;
            } else {
                // for all others
                agentMonitorCtrl.callParent = window.callBackToAgentMonitorLauncher;
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
                    $AgentUtils.init();
                    agentMonitorCtrl.setupColumnDefs();
                    // let parent know we are ready and send callback for parent to communicate with us
                    agentMonitorCtrl.callParent('READY', messageFromParent);
                },
                function (error) {
                    $log.error("loadLocale", error);
                    agentMonitorCtrl.callParent('ERROR', "LOCALE_LOAD_ERROR");
                }
            );

        }

        $rootScope.$on('WINDOW_RESIZE', function (event, args) {
            agentMonitorCtrl.callParent("RESIZE", angular.toJson(args));
        });


        $interval(function () {
            var currentTime = new Date().getTime();
            angular.forEach(agentMonitorCtrl.model.qmGridOptions.data, function (agent) {
                if (agent.State !== 'Out') {
                    agent.elapsed = Math.floor((currentTime - agent.startTime) / 1000);
                    agent.duration = $filter('shortDuration')(agent.elapsed);
                    var state = $AgentUtils.statesDisplay[agent.State];
                    if (state)
                        agent.state = state.label;
                    else
                        agent.state = agent.State;
                    if (agent.State === 'Busy')
                        agent.state += (': ' + agent.Queue);
                    agent.state += ' (' + agent.duration + ')';
                }
            })
        }, 1000);


        $interval(function () {
            var currentTime = new Date().getTime();
            if ((currentTime - lastTimeReceivedMessage) >= 15000) {
                $log.error("No Communication from parent");
                try {
                    agentMonitorCtrl.communicationLost = true;
                    $window.close();
                } catch (err) {
                }
            } else
                agentMonitorCtrl.communicationLost = false;

        }, 5000);

    }


})();