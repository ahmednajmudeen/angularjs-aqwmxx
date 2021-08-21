angular.module('ReturnCallDetailModal', ['formly', 'formlyBootstrap'])

    .run(['formlyConfig', 'formlyValidationMessages', function (formlyConfig, formlyValidationMessages) {

        /*
         formlyConfig.setType({
         name: 'typeahead',
         template: '<input type="text" ng-model="model[options.key]" uib-typeahead="item for item in to.options | filter:$viewValue | limitTo:5" class="form-control" autocomplete="off">',
         wrapper: ['bootstrapLabel', 'bootstrapHasError'],
         });

         formlyConfig.removeChromeAutoComplete = true;

         formlyConfig.setWrapper([
         {
         types: ['typeahead'],
         template: [
         '<formly-transclude></formly-transclude>',
         '<div class="validation"',
         '  ng-if="options.validation.errorExistsAndShouldBeVisible"',
         '  ng-messages="fc.$error">',
         '  <div ng-message="{{::name}}" ng-repeat="(name, message) in ::options.validation.messages">',
         '    {{message(fc.$viewValue, fc.$modelValue, this)}}',
         '  </div>',
         '</div>'
         ].join(' ')
         }
         ]);

         */

        formlyValidationMessages.messages.required = 'to.label + " is required"';

    }])

    .service('$ReturnCallDetailModal', ['$uibModal', function ($uibModal) {

        var service = {};

        service.open = open;
        service.callEvent = callEvent;

        service.event = undefined;
        service.callObj = undefined;

        function open(dialMode, numberDialed) {
            var modalInstance = $uibModal.open({
                templateUrl: 'returnCallDetail.html',
                controller: 'ReturnCallDetailController as returnCallDetailCtrl',
                backdrop: 'static',
                keyboard: false,
                resolve: {
                    dialMode: function () {
                        return dialMode;
                    },
                    numberDialed: function () {
                        return numberDialed;
                    }
                }
            });
            return modalInstance;

        };

        function callEvent(event, callObj) {
            service.event = event;
            service.callObj = callObj;
        }

        return service;

    }]);

angular.module('ReturnCallDetailModal')
    .controller("ReturnCallDetailController",
        ['$scope', '$uibModalInstance', '$log', '$window', '$http', '$interval', '$ReturnCallDetailModal', 'UCLocaleService', 'dialMode', 'numberDialed',
            function ($scope, $uibModalInstance, $log, $window, $http, $interval, $ReturnCallDetailModal, UCLocaleService, dialMode, numberDialed) {

                var returnCallDetailCtrl = this;

                returnCallDetailCtrl.model = {
                    comment: undefined,
                    state: 'Attempted',
                    delete: undefined,
                };

                returnCallDetailCtrl.callInProgress = dialMode;
                returnCallDetailCtrl.callObj = undefined;
                returnCallDetailCtrl.connectedDuration = undefined;
                returnCallDetailCtrl.connectedStartTime = undefined;
                returnCallDetailCtrl.disableHangup = false;
                returnCallDetailCtrl.event = undefined;
                returnCallDetailCtrl.image = undefined;
                returnCallDetailCtrl.numberDialed = numberDialed;

                returnCallDetailCtrl.fields = [
                    {
                        type: "textarea",
                        key: "comment",
                        templateOptions: {
                            placeholder: UCLocaleService.getPhrase("EnterNotes"),
                            label: UCLocaleService.getPhrase("CallbackNotes"),
                            rows: 2,
//                            cols: 15,
                            required: true,
                        }
                    },
                    {
                        "key": "state",
                        "type": "radio",
                        "templateOptions": {
                            "label": UCLocaleService.getPhrase("CallbackStatus"),
                            "options": [
                                {
                                    "name": UCLocaleService.getPhrase("CallWasAttempted"),
                                    "value": "Attempted"
                                },
                                {
                                    "name": UCLocaleService.getPhrase("CallWasReturned"),
                                    "value": "Returned"
                                },
                            ]
                        }
                    },
                    {
                        type: "checkbox",
                        hideExpression: '(model.state !== "Returned") && (model.state !== "Attempted")',
                        key: "delete",
                        templateOptions: {
                            label: UCLocaleService.getPhrase("RemoveAbandonedCall"),
                        }
                    }
                ];

                function calcConnectedDuration() {
                    if (returnCallDetailCtrl.connectedStartTime) {
                        var duration = new Date().getTime() - returnCallDetailCtrl.connectedStartTime;
                        returnCallDetailCtrl.connectedDuration = Math.floor(duration / 1000);
                    }
                }

                var cancelEverySecondInterval;

                function startConnectedDurationTimer() {

                    cancelEverySecondInterval = $interval(function () {
                        calcConnectedDuration();
                    }, 1000);

                }

                function killConnectedDurationTimer() {
                    if (cancelEverySecondInterval) {
                        $interval.cancel(cancelEverySecondInterval)
                        cancelEverySecondInterval = null;
                    }

                }

                var stopCallObjWatcher;
                if (returnCallDetailCtrl.numberDialed) {
                    // watch for changes in '$ReturnCallDetailModal.callObj'
                    stopCallObjWatcher = $scope.$watch(
                        function () {
                            return ( $ReturnCallDetailModal.event );
                        },
                        function (newValue, oldValue) {
                            $log.debug("**event", newValue, oldValue);


                            $scope.$applyAsync(
                                function ($scope) {

                                    returnCallDetailCtrl.callObj = $ReturnCallDetailModal.callObj;
                                    returnCallDetailCtrl.event = $ReturnCallDetailModal.event;

                                    if (returnCallDetailCtrl.callObj) {

                                        if (returnCallDetailCtrl.callObj.CalledName) {
                                            returnCallDetailCtrl.calledName = returnCallDetailCtrl.callObj.CalledName;
                                        }

                                        if (returnCallDetailCtrl.callObj.CalledID) {
                                            returnCallDetailCtrl.calledID = returnCallDetailCtrl.callObj.CalledID;
                                        }
                                    }

                                    if (returnCallDetailCtrl.event === 'Dialtone' || returnCallDetailCtrl.event === 'Dialing') {
                                        returnCallDetailCtrl.callInProgress = true;

                                        returnCallDetailCtrl.connectedDuration = undefined;
                                        returnCallDetailCtrl.connectedStartTime = undefined;
                                        var image = 'fa fa-th';
                                        if (returnCallDetailCtrl.event === 'Dialing')
                                            image += ' animated flash ringing';
                                        returnCallDetailCtrl.image = image;
                                    } else if (returnCallDetailCtrl.event === 'Ringback') {
                                        returnCallDetailCtrl.callInProgress = true;

                                        returnCallDetailCtrl.connectedStartTime = undefined;
                                        returnCallDetailCtrl.image = 'fa fa-phone animated flash ringing';
                                    } else if (returnCallDetailCtrl.event === 'Connected') {
                                        returnCallDetailCtrl.callInProgress = true;

                                        returnCallDetailCtrl.connectedStartTime = new Date().getTime();
                                        returnCallDetailCtrl.image = 'fa fa-phone call-connected';
                                        calcConnectedDuration();

                                        startConnectedDurationTimer();

                                    } else if (returnCallDetailCtrl.event === 'CallRemoved') {
                                        returnCallDetailCtrl.image = null;
                                        returnCallDetailCtrl.callInProgress = false;

                                        killConnectedDurationTimer();

                                    }
                                }
                            );
                        }
                    );
                }

                returnCallDetailCtrl.onHangup = function () {
                    returnCallDetailCtrl.disableHangup = true;
                    $scope.hangup(returnCallDetailCtrl.callObj ? returnCallDetailCtrl.callObj.Handle : 0).then(
                        function (data) {

                        },
                        function (error) {
                            returnCallDetailCtrl.disableHangup = false;
                        }
                    )
                };


                returnCallDetailCtrl.closeDialog = function () {
                    killConnectedDurationTimer();

                    $uibModalInstance.close('cancel');
                };

                returnCallDetailCtrl.saveDialog = function () {
                    killConnectedDurationTimer();

                    $uibModalInstance.close({
                        comment: returnCallDetailCtrl.model.comment,
                        state: returnCallDetailCtrl.model.state,
                        delete: returnCallDetailCtrl.model.delete,
                    });
                };


                $scope.$on("$destroy", function () {
                    try {
                        if (stopCallObjWatcher)
                            stopCallObjWatcher();
                        killConnectedDurationTimer();

                    } catch (e) {

                    }
                });


            }
        ]);



