angular.module('ConfirmationModal', [])
    .constant('YES_NO', {yes: true, no: true, ok: false, cancel: false})
    .constant('OK', {yes: false, no: false, ok: true, cancel: false})
    .constant('OK_CANCEL', {yes: false, no: false, ok: true, cancel: true})
    .service('$ConfirmationModal', ['$uibModal', 'YES_NO', 'OK', 'OK_CANCEL', function ($uibModal, YES_NO, OK, OK_CANCEL) {


        this.open = function (title, message, type, size) {
            var type = type || OK;
            var modalSize = size || 'sm';
            var modalInstance = $uibModal.open({
                templateUrl: '../modals/confirmationModal.html',
                controller: 'confirmationModalController',
//                size: modalSize, // sm, lg
                backdrop: 'static',
                keyboard: true,
                resolve: {
                    title: function () {
                        return title;
                    },
                    message: function () {
                        return message;
                    },
                    type: function () {
                        return type;
                    }
                }
            });
            return modalInstance;

        };

    }]);

angular.module('ConfirmationModal')
    .controller("confirmationModalController", ['$scope', '$uibModalInstance', 'title', 'message', 'type', 'YES_NO', 'OK', 'OK_CANCEL', function ($scope, $uibModalInstance, title, message, type, YES_NO, OK, OK_CANCEL) {

        $scope.data = {};
        $scope.data.title = title;
        $scope.data.message = message;
        if (type === 'YES_NO')
            $scope.data.buttons = YES_NO;
        else if (type === 'OK')
            $scope.data.buttons = OK;
        else if (type === 'OK_CANCEL')
            $scope.data.buttons = OK_CANCEL;
        else
            $scope.data.buttons = OK;

        $scope.yesClicked = function () {
            $uibModalInstance.close(true);
        };

        $scope.noClicked = function () {
            $uibModalInstance.close(false);
        };

        $scope.closeDialog = function () {
            $uibModalInstance.dismiss('cancel');

        };


    }]);


