(function () {
    'use strict';
    /* global angular, L */

    var apiPath = 'metadata-api/';

    angular.module('NmdcApp', ['ngRoute', 'ngResource', 'ui.bootstrap'])
        .config(['$routeProvider', function ($routeProvider) {
            $routeProvider
                .when('/', {templateUrl: '_static_content_/partials/search.html'})
                .when('/basket', {templateUrl: '_static_content_/partials/basket.html'})
                .when('/details/:id', {templateUrl: '_static_content_/partials/details.html'})
                .otherwise({redirectTo: '/'});
        }])
        .factory('NmdcUtil', [function () {
            var util = {};
            util.twoDigits = function (x) {
                return x < 10 ? '0' + x : x;
            };
            util.formatDate = function (date) {
                return date.getFullYear() + '-' + util.twoDigits(date.getMonth() + 1) + '-' + util.twoDigits(date.getDate());
            };
            return util;
        }])
        .factory('NmdcModel', ['$http', '$window', 'NmdcUtil', function ($http, $window, Util) {
            var model = {
                ready: false,
                facets: [],
                search: {
                    response: {}, itemsPerPage: 10, currentPage: 0, text: '', coverage: {
                        useGeographicalCoverage: false,
                        beginDate: Util.formatDate(new Date(1800, 0, 1)),
                        endDate: Util.formatDate(new Date()),
                        useTemporalCoverage: false
                    }
                },
                basket: {count: 0, idToItem: {}},
                map: {options: {center: L.latLng(60, 0), zoom: 3}}
            };

            $http.get(apiPath + 'getFacets')
                .success(function (data) {
                    angular.extend(model, data);
                    model.ready = true;
                })
                .error(function (data, status) {
                    $window.alert('Error getting facets.\nStatus: ' + status + '\nMessage: ' + data.message);
                });

            model.basket.clear = function () {
                model.basket.idToItem = {};
                model.basket.count = 0;
            };
            model.basket.add = function (item) {
                if (model.basket.idToItem[item.Entry_ID]) return;
                model.basket.idToItem[item.Entry_ID] = item;
                model.basket.count++;
            };
            model.basket.remove = function (item) {
                if (!model.basket.idToItem[item.Entry_ID]) return;
                delete model.basket.idToItem[item.Entry_ID];
                model.basket.count--;
            };

            return model;
        }])
        .controller('NmdcHeaderController', ['$scope', 'NmdcModel', function ($scope, Model) {
            var ctrl = this;
            $scope.ctrl = ctrl;
            ctrl.model = Model;
        }])
        .controller('NmdcSearchController', ['$scope', '$http', '$window', '$q', 'NmdcModel', function ($scope, $http, $window, $q, Model) {
            var ctrl = this;
            $scope.ctrl = ctrl;
            ctrl.model = Model;

            ctrl.isSearching = false;
            var cancelSearch = function () {};

            ctrl.search = function (isPageSearch) {
                cancelSearch();
                ctrl.isSearching = true;
                var canceller = $q.defer();
                var isCancelled = false;
                cancelSearch = function () {
                    isCancelled = true;
                    canceller.resolve('cancelled');
                };

                function setResponse(response) {
                    ctrl.isSearching = false;
                    Model.search.response = response;
                    if (!isPageSearch) Model.search.currentPage = 0;
                }

                function getQueryString() {
                    var terms = [];
                    Model.facets.forEach(function (facet) {
                        var facetTerms = [];
                        facet.children.forEach(function (child) {
                            if (child.selected) facetTerms.push(facet.name + ':"' + child.value + '"');
                        });
                        if (facetTerms.length > 0) {
                            var facetQuery = facetTerms.join(' OR ');
                            if (facetTerms.length > 1) facetQuery = '(' + facetQuery + ')';
                            terms.push(facetQuery);
                        }
                    });
                    if (Model.search.text) {
                        terms.push('"' + Model.search.text + '"');
                    }
                    return terms.join(' AND ');
                }

                var searchUrl = apiPath + 'search?q=' + getQueryString();
                console.log(searchUrl);
                $http.get(searchUrl, {timeout: canceller.promise})
                    .success(setResponse)
                    .error(function (data, status) {
                        if (isCancelled) return;
                        setResponse({});
                        $window.alert('Error getting search results.\nStatus: ' + status + '\nMessage: ' + data.message);
                    });
            };

            $scope.$watch('ctrl.model.search.currentPage', function (newValue, oldValue) {
                if (newValue === oldValue) return;
                ctrl.search(true);
            });
            $scope.$watchCollection('ctrl.model.search.coverage', function (newValue, oldValue) {
                if (newValue === oldValue) return;
                ctrl.search();
            });

            $scope.$on('$destroy', cancelSearch);
        }])
        .directive('nmdcMap', ['NmdcModel', function (Model) {
            return {
                restrict: 'A',
                link: function (scope, element, attrs) {
                    var map = new L.Map(attrs.id, Model.map.options);
                    map.addLayer(new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '© OpenStreetMap contributors'}));

                    scope.$on('$destroy', function () {
                        Model.map.options.center = map.getCenter();
                        Model.map.options.zoom = map.getZoom();
                    });
                }
            };
        }])
        .controller('NmdcBasketController', ['$scope', '$http', '$window', '$routeParams', 'NmdcModel', function ($scope, $http, $window, $routeParams, Model) {
            var ctrl = this;
            $scope.ctrl = ctrl;
            ctrl.model = Model;
        }])
        .controller('NmdcDetailsController', ['$scope', '$http', '$window', '$routeParams', 'NmdcModel', function ($scope, $http, $window, $routeParams, Model) {
            var ctrl = this;
            $scope.ctrl = ctrl;
            ctrl.model = Model;
            ctrl.id = $routeParams.id;

            $http.get(apiPath + 'getmetadatadetail?doi=' + ctrl.id)
                .success(function (data) {
                    ctrl.details = data.data[0];
                })
                .error(function (data, status) {
                    $window.alert('Error getting metadata details.\nStatus: ' + status + '\nMessage: ' + data.message);
                });
        }]);
}());
