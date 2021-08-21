(function () {
    'use strict';

    angular
        .module('HttpInterceptorModule', [])

        .service("UCServices", UCServices)

        .factory("httpInterceptor", httpInterceptor)

        .config(config);

    config.$inject = ['$httpProvider'];

    function config($httpProvider) {
        $httpProvider.defaults.useXDomain = true;
        $httpProvider.defaults.withCredentials = true;

        $httpProvider.interceptors.push('httpInterceptor');
    }

    UCServices.$inject = [];

    function UCServices() {
        var service = {};

        service.address = undefined;

        return service;

    }

    httpInterceptor.$inject = ['UCServices'];

    function httpInterceptor(UCServices) {
        return {
            'request': function (config) {
                if (/^\/api\//.test(config.url) || /^\/ucapi\//.test(config.url) || /^\/uc\//.test(config.url)) {
//                        console.debug("method", config.method, "url", config.url);
                    if (config.method === "GET") {
                        if (config.url.indexOf('?') < 0) {
                            var version = +new Date();
                            version = "?v=" + version.toString().substr(-5);
                            config.url += version;
                        }
                    }
                    if (UCServices.address) {
                        config.url = UCServices.address + config.url;
                    }
                }
                return config;

            },
        };
    }

})();
