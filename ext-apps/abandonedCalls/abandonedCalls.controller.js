(function () {
    'use strict';

    angular.module('AbandonedCallsModule',
        ["ngAnimate", "ngSanitize", "ngTouch", "ui.bootstrap", 'ui.grid', 'ui.grid.resizeColumns', 'tmh.dynamicLocale',
            'ui.grid.moveColumns', 'ui.grid.autoResize', 'ui.grid.saveState', 'formly', 'formlyBootstrap', 'ReturnCallDetailModal', 'ConfirmationModal', 'UCLocale', 'HttpInterceptorModule'])

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
        .directive('resize', ['$rootScope', '$log', '$timeout', '$window', function ($rootScope, $log, $timeout, $window) {
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
        .service('$AbandonedCalls', AbandonedCallsService)
        .controller('AbandonedCallsCtrl', AbandonedCallsCtrl)
        .config(config)
        .run(run);

    config.$inject = ['formlyConfigProvider'];

    function config(formlyConfigProvider) {
        if (!DebugInfoEnabled) {
            try {
                formlyConfigProvider.extras.removeChromeAutoComplete = true;
                formlyConfigProvider.extras.explicitAsync = true;
                formlyConfigProvider.disableWarnings = true;

            } catch (err) {

            }
        }
    }

    run.$inject = ['formlyConfig'];

    function run(formlyConfig) {

        if (!DebugInfoEnabled) {
            try {
                apiCheck.globalConfig.disabled = true;
            } catch (err) {
            }
        }

    }

    AbandonedCallsService.$inject = ['$log'];

    function AbandonedCallsService($log) {

        var service = {};

        // public variables

        // public methods

        return service;


    };

    AbandonedCallsCtrl.$inject = ['$rootScope', '$log', '$window', '$http', '$q', '$filter', '$interval', '$ReturnCallDetailModal', '$ConfirmationModal', 'UCServices', 'UCLocaleService'];

    function AbandonedCallsCtrl($rootScope, $log, $window, $http, $q, $filter, $interval, $ReturnCallDetailModal, $ConfirmationModal, UCServices, UCLocaleService) {
        var abandonedCallsCtrl = this;


        abandonedCallsCtrl.callParent = undefined;
        abandonedCallsCtrl.status = undefined;
        abandonedCallsCtrl.thresholds = undefined;
        abandonedCallsCtrl.showDetails = false;
        abandonedCallsCtrl.hide_for_ie = false;

        var ua = navigator.userAgent.toLowerCase();
        abandonedCallsCtrl.is_ie = ((ua.indexOf('msie') >= 0) || (navigator.appVersion.toLowerCase().indexOf('trident/') >= 0));

        function toDateString(dateTime) {
            var encodedDateTime;
            if (dateTime && angular.isDefined(dateTime))
                encodedDateTime = dateTime.toISOString();
            else
                encodedDateTime = null;
            return encodedDateTime;
        };

        //
        // set up form for abandoned calls list
        abandonedCallsCtrl.abandonedCalls = [];


        abandonedCallsCtrl.callDetails = [];

        function processDetailsItem(item) {
            var stateTime_m = moment(item.StateTime);
            item.stateTimeDateObj = stateTime_m.toDate();

            var startOfToday = moment().startOf('day');
            var stateTimeStartOfDay = stateTime_m.clone().startOf('day');
            var daysDiff = stateTimeStartOfDay.diff(startOfToday, 'days', true);
            var stateTime;
            if (daysDiff <= -7)
                stateTime = $filter('date')(item.stateTimeDateObj, 'mediumDate') + ' ' + $filter('date')(item.stateTimeDateObj, 'shortTime');
            else
                stateTime = stateTime_m.calendar();
            item.stateTime = stateTime;
            item.comment = item.Comment;
            return item;
        }


        function showCallbackDetails(rowEntity) {
            $http.post('/ucapi/agent/GetCallbackDetails', {"callId": rowEntity.CallID}).then(
                function (response) {

                    abandonedCallsCtrl.showDetailsRowEntity = rowEntity;
                    abandonedCallsCtrl.showDetails = true;

                    var callbackStatesArr = response.data.Data.map(function (item) {
                        return processDetailsItem(item);
                    });
                    abandonedCallsCtrl.callDetails = callbackStatesArr.reverse();


                },
                function (error) {
                    $log.error('GetCallbackDetails', error);
                }
            )

        }


        // end details view setup

        function updateCallDetail(callID, obj) {
            var deferred = $q.defer();

            var dataObj = {};
            if (!angular.isDefined(obj.state)) {
                $log.error("No 'state' specified in parm obj");
                deferred.reject(false);
                return;
            }
            dataObj.CallID = callID;
            dataObj.State = obj.state;
            dataObj.Comment = obj.comment;
            dataObj.Extension = abandonedCallsCtrl.extension;
            dataObj.StateTime = toDateString(new Date());

            $log.info('updateCallDetail, dataObj', dataObj);

            $http.post('/ucapi/agent/AddCallbackDetails', {detail: dataObj}).then(
                function (response) {
                    deferred.resolve(true);
                    if (abandonedCallsCtrl.showDetails)
                        showCallbackDetails(abandonedCallsCtrl.showDetailsRowEntity);
                },
                function (error) {
                    deferred.reject(error);
                }
            )
            return deferred.promise;

        }

        function dial(rowEntity) {

            updateCallDetail(rowEntity.CallID, {state: 'InProgress'});

            var number = rowEntity.CallerID;
            abandonedCallsCtrl.callParent("DIAL", number);

            if (abandonedCallsCtrl.is_ie)
                abandonedCallsCtrl.hide_for_ie = true;

            var promise = $ReturnCallDetailModal.open(true, number);
            promise.result.then(
                function (data) {

                    abandonedCallsCtrl.hide_for_ie = false;

                    var deleteAfterUpdate = data.delete;
                    if (data === 'cancel') {
                        // reset back to old state
                        updateCallDetail(rowEntity.CallID, {state: 'Attempted', comment: 'Aborted callback'});
                    } else {
                        // use old state if one not specified
                        if (!data.state)
                            data.state = rowEntity.CallbackStatus;

                        updateCallDetail(rowEntity.CallID, data).then(
                            function (data) {
                                if (deleteAfterUpdate)
                                    updateCallDetail(rowEntity.CallID, {state: 'Deleted'});
                            },
                            function (error) {

                            }
                        )
                    }
                }
            );

        }

        abandonedCallsCtrl.dial = function (rowEntity) {
            $log.info("dial", rowEntity);

            if (rowEntity.callbackStatus === 'InProgress') {

                var promise = $ConfirmationModal.open(
                    undefined,
                    UCLocaleService.getPhrase("DialCallInProgressWarning"),
                    "YES_NO");
                promise.result.then(
                    function (data) {
                        if (data)
                            dial(rowEntity);
                    }
                )

            } else
                dial(rowEntity);

        };

        abandonedCallsCtrl.clearStatus = function (rowEntity) {
            var promise = $ConfirmationModal.open(
                UCLocaleService.getPhrase("ClearCallbackStatus"),
                UCLocaleService.getPhrase("ClearCallbackStatus.msg"),
                "YES_NO");

            promise.result.then(
                function (data) {
                    if (data) {
                        updateCallDetail(rowEntity.CallID, {state: 'Pending'});
                    }
                }
            )
        };

        abandonedCallsCtrl.delete = function (rowEntity) {
            var promise = $ConfirmationModal.open(
                UCLocaleService.getPhrase("RemoveAbandonedCall.title"),
                UCLocaleService.getPhrase("RemoveAbandonedCall"),
                "YES_NO");

            promise.result.then(
                function (data) {
                    if (data) {
                        updateCallDetail(rowEntity.CallID, {state: 'Deleted'});
                    }
                }
            )
        };

        $rootScope.getPhrase = function (key) {
            return UCLocaleService.getPhrase(key);
        };


        $rootScope.displayComment = function (rowEntity) {
            return rowEntity.comment;
        }

        abandonedCallsCtrl.edit = function (rowEntity) {
            $log.info("edit", rowEntity);
            var number = rowEntity.CallerID;

            if (abandonedCallsCtrl.is_ie)
                abandonedCallsCtrl.hide_for_ie = true;

            var promise = $ReturnCallDetailModal.open(false);
            promise.result.then(
                function (data) {
                    abandonedCallsCtrl.hide_for_ie = false;

                    var deleteAfterUpdate = data.delete;
                    if (data !== 'cancel') {
                        if (!data.state)
                            data.state = rowEntity.CallbackStatus;

                        updateCallDetail(rowEntity.CallID, data).then(
                            function (data) {
                                if (deleteAfterUpdate)
                                    updateCallDetail(rowEntity.CallID, {state: 'Deleted'});
                            },
                            function (error) {

                            }
                        )
                    }
                }
            );

        }

        $rootScope.hangup = function (callID) {
            $log.info("hangup", callID);

            var dataParm = {
                'callId': callID
            };

            var deferred = $q.defer();

            $http.post('/ucapi/device/Hangup', dataParm).then(
                function (response) {
                    deferred.resolve(response.data.Data);
                },
                function (error) {
                    deferred.reject(error);
                }
            )
            return deferred.promise;

        }

        abandonedCallsCtrl.saveState = function () {

        };

        abandonedCallsCtrl.restoreState = function (theState) {
            if (theState) {
                abandonedCallsCtrl.restoringState = true;

                abandonedCallsCtrl.winState = theState;

                abandonedCallsCtrl.restoringState = false;
            }

        };

        var lastEntryShown = null;
        abandonedCallsCtrl.toggleCollapsed = function (item) {
            item.isCollapsed = !item.isCollapsed;
            if (item.isCollapsed) {
                if (lastEntryShown && lastEntryShown !== item) {
                    lastEntryShown.isCollapsed = false;
                }
                lastEntryShown = item;
                showCallbackDetails(item);
            }
        };


        var lastTimeReceivedMessage;

        function processListItem(item) {
            var arrivalTime_m = moment(item.ArrivalTime);
            item.arrivalDateObj = arrivalTime_m.toDate();
//            console.debug(item.arrivalDateObj);

            var startOfToday = moment().startOf('day');
            var arrivalTimeStartOfDay = arrivalTime_m.clone().startOf('day');
            var daysDiff = arrivalTimeStartOfDay.diff(startOfToday, 'days', true);
            if (daysDiff == 0)
                item.isToday = true;
            else if (daysDiff == 1)
                item.isYesterday = true;


            var arrivalTime;
            if (daysDiff <= -7)
                arrivalTime = $filter('date')(item.arrivalDateObj, 'mediumDate') + ' ' + $filter('date')(item.arrivalDateObj, 'shortTime');
            else
                arrivalTime = arrivalTime_m.calendar();
            item.arrivalTime = arrivalTime;

            item.finalStatus = UCLocaleService.getPhrase("FinalStatus." + item.FinalStatus);

            item.callbackStatus = item.CallbackStatus;
            if (item.CallbackStatus === 'Pending') {
                item.callbackStatus = '';
            }
            if (item.callbackStatus === 'Returned') {
                item.callbackStatusImage = "fa fa-check fa-fw";
            }
            else if (item.callbackStatus === 'InProgress')
                item.callbackStatusImage = "fa fa-phone fa-fw";
            else
                item.callbackStatusImage = null;

            if (item.LastCallback) {
                item.comment = item.LastCallback.Comment;
                item.name = item.LastCallback.Name;
                item.extension = item.LastCallback.Extension;
            }

            item.duration = $filter('durationToSeconds')(item.WaitTime);

            if (item.callbackStatus === 'Returned') {
                item.acStatusClass = 'ac_returned';
            } else if (item.isToday)
                item.acStatusClass = 'ac_today';
            else if (item.isYesterday)
                item.acStatusClass = 'ac_yesterday';
            else
                item.acStatusClass = 'ac_old';


            return item;
        }

        function sendNewAbandonedCallCount() {
            var numAbandonedCalls = 0;
            for (var i = 0; i < abandonedCallsCtrl.abandonedCalls.length; i++) {
                var item = abandonedCallsCtrl.abandonedCalls[i];
                if (item.callbackStatus !== 'Returned')
                    numAbandonedCalls++;
            }
            abandonedCallsCtrl.callParent('NumAbandonedCalls', numAbandonedCalls);

        }

        function messageFromParent(data) {
            lastTimeReceivedMessage = new Date().getTime();

            if (data && data.type !== 'KeepAlive')
                $log.info("AbandonedCallsCtrl", data);


            if (data.type === 'AbandonedCalls') {

                var abandonedCallsDataArr = data.data.map(function (item) {
                    return processListItem(item);
                });
                abandonedCallsCtrl.abandonedCalls = $filter('orderBy')(abandonedCallsDataArr, ['arrivalDateObj']);

                abandonedCallsCtrl.readyToDisplay = true;

                $rootScope.$applyAsync();

                sendNewAbandonedCallCount();
            } else if (data.type === 'CallEvent') {
                $ReturnCallDetailModal.callEvent(data.data.event, data.data.callObj);
            } else if (data.type === 'AlertAdd') {
                abandonedCallsCtrl.abandonedCalls.push(processListItem(data.data));

                sendNewAbandonedCallCount();

            } else if (data.type === 'AlertChange') {
                for (var i = 0; i < abandonedCallsCtrl.abandonedCalls.length; i++) {
                    var item = abandonedCallsCtrl.abandonedCalls[i];
                    if (item.CallID === data.data.CallID) {
                        $log.info("found item to change", item);
                        abandonedCallsCtrl.abandonedCalls[i] = processListItem(data.data);
                        abandonedCallsCtrl.abandonedCalls = $filter('orderBy')(abandonedCallsCtrl.abandonedCalls, ['arrivalDateObj']);
                        $log.info("new item in list", abandonedCallsCtrl.abandonedCalls[i]);
                        break;
                    }
                }
                sendNewAbandonedCallCount();
            } else if (data.type === 'AlertDelete') {
                for (var i = 0; i < abandonedCallsCtrl.abandonedCalls.length; i++) {
                    var item = abandonedCallsCtrl.abandonedCalls[i];
                    if (item.CallID === data.data.CallID) {
                        abandonedCallsCtrl.abandonedCalls.splice(i, 1);
                        break;
                    }
                }
                sendNewAbandonedCallCount();
            } else if (data.type === 'RESTORE_STATE') {
                abandonedCallsCtrl.restoreState(data.state);
            } else if (data.type === 'Init') {
                abandonedCallsCtrl.extension = data.data.extension;
                abandonedCallsCtrl.callParent('GetAbandonedCalls', {});

                UCServices.address = data.data.address;
                console.debug("set address to", UCServices.address);
            }

        }

        abandonedCallsCtrl.windowLoaded = function () {
            $log.info("AbandonedCalls window loaded");

            var ua = navigator.userAgent.toLowerCase();
            if ((ua.indexOf('msie') >= 0) || (navigator.appVersion.toLowerCase().indexOf('trident/') >= 0)) {
                // for IE
                abandonedCallsCtrl.callParent = window.opener.callBackToAbandonedCallsLauncher;
            } else {
                // for all others
                abandonedCallsCtrl.callParent = window.callBackToAbandonedCallsLauncher;
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
                    // let parent know we are ready and send callback for parent to communicate with us
                    abandonedCallsCtrl.callParent('READY', messageFromParent);
                },
                function (error) {
                    $log.error("loadLocale", error);
                    abandonedCallsCtrl.callParent('ERROR', "LOCALE_LOAD_ERROR");
                }
            );

        };

        $rootScope.$on('WINDOW_RESIZE', function (event, args) {
            console.log("WINDOW_RESIZE", angular.toJson(args));
            abandonedCallsCtrl.callParent("RESIZE", angular.toJson(args));
        });

        $interval(function () {
            var currentTime = new Date().getTime();
            if ((currentTime - lastTimeReceivedMessage) >= 15000) {
                $log.error("No Communication from parent");
                try {
                    abandonedCallsCtrl.communicationLost = true;
                    $window.close();
                } catch (err) {
                }
            } else
                abandonedCallsCtrl.communicationLost = false;

        }, 5000);


    }


})();