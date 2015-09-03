(function () {
    'use strict';
    /* global angular, L */

    var apiPath = 'metadata-api/';

    angular.module('NmdcApp', ['ngAnimate', 'ngRoute', 'ui.bootstrap'])
        .config(['$routeProvider', function ($routeProvider) {
            $routeProvider
                .when('/', {templateUrl: '_static_content_/partials/search.html'})
                .when('/basket', {templateUrl: '_static_content_/partials/basket.html'})
                .when('/details/:id', {templateUrl: '_static_content_/partials/details.html'})
                .otherwise({redirectTo: '/'});
        }])
        .config(['datepickerConfig', 'datepickerPopupConfig', function (datepickerConfig, datepickerPopupConfig) {
            datepickerConfig.startingDay = 1;
            datepickerConfig.showWeeks = true;
            datepickerConfig.minMode = 'month';
            datepickerPopupConfig.closeText = 'Close';
        }])
        .factory('NmdcUtil', [function () {
            var util = {};
            util.urlParametersToString = function (values) {
                var string = '';
                angular.forEach(values, function(value, key) {
                    if (string.length > 0) string += '&';
                    string += key + '=' + encodeURIComponent(value);
                });
                return string;
            };
            util.twoDigits = function (x) {
                return x < 10 ? '0' + x : x;
            };
            util.formatDate = function (date) {
                return date.getFullYear() + '-' + util.twoDigits(date.getMonth() + 1) + '-' + util.twoDigits(date.getDate());
            };
            util.formatDateSearch = function (date) {
                var str = date.toISOString();
                return str.substring(0, str.length - 5) + 'Z';
            };
            util.longTrafo = function (lat) {
                if (Math.abs(lat) >= 180.0) {
                    if (lat > 0) {
                        return -180.0 + lat % 180.0;
                    }
                    else {
                        return 180.0 + lat % 180.0;
                    }
                }
                else {
                    return lat;
                }
            };
            util.clip = function(x, min, max) {
                return Math.max(Math.min(x, max), min);
            };
            util.relativeCCW = function (x1, y1, x2, y2, px, py) {
                x2 -= x1;
                y2 -= y1;
                px -= x1;
                py -= y1;
                var ccw = px * y2 - py * x2;
                if (ccw === 0) {
                    ccw = px * x2 + py * y2;
                    if (ccw > 0) {
                        px -= x2;
                        py -= y2;
                        ccw = px * x2 + py * y2;
                        if (ccw < 0) {
                            ccw = 0;
                        }
                    }
                }
                return ccw < 0 ? -1 : (ccw > 0 ? 1 : 0);
            };
            util.linesIntersect = function (x1, y1, x2, y2, x3, y3, x4, y4) {
                return util.relativeCCW(x1, y1, x2, y2, x3, y3) * util.relativeCCW(x1, y1, x2, y2, x4, y4) < 0 &&
                    util.relativeCCW(x3, y3, x4, y4, x1, y1) * util.relativeCCW(x3, y3, x4, y4, x2, y2) < 0;
            };
            util.latLngLinesIntersect = function (a1, a2, b1, b2) {
                return util.linesIntersect(a1.lng, a1.lat, a2.lng, a2.lat, b1.lng, b1.lat, b2.lng, b2.lat);
            };
            util.polygonSelfIntersects = function (coordinates) {
                var n = coordinates.length;
                for (var i = 0; i < n; i++) {
                    for (var j = i + 1; j < n; j++) {
                        if (util.latLngLinesIntersect(coordinates[i], coordinates[(i + 1) % n], coordinates[j], coordinates[(j + 1) % n])) {
                            return true;
                        }
                    }
                }
                return false;
            };
            util.stringToArrayIfPossible = function (text) {
                if (text && text.charAt(0) === '[' && text.charAt(text.length - 1) === ']') {
                    return text.substring(1, text.length - 1).split(/\s*,\s*/);
                } else {
                    return text;
                }
            };
            util.adaptSearchResults = function (results) {
                results.forEach(function (result) {
                    result.Data_URL = util.stringToArrayIfPossible(result.Data_URL);
                });
            };
            return util;
        }])
        .filter('nmdcUriComponent', [function () {
            return function (uriComponent) {
                return encodeURIComponent(uriComponent).replace(/%2F/g, '%252F').replace(/%5C/g, '%255C');
            };
        }])
        .factory('NmdcModel', ['$http', '$window', function ($http, $window) {

            var defaultExpanded = $window.innerWidth >= 768;

            var model = {
                ready: false,
                options: {facetExpansionLevel: 1},
                facets: [],
                hasSearched: false,
                search: {
                    queryParameters: {q: '', offset: 0},
                    response: {},
                    itemsPerPage: 10,
                    currentPage: 1,
                    text: '',
                    coverage: {
                        geographical: {
                            expanded: defaultExpanded,
                            selected: false,
                            operation: 'IsWithin',
                            type: 'mapBoundingBox',
                            coordinates: []
                        },
                        temporal: {
                            expanded: defaultExpanded,
                            selected: false,
                            operation: 'IsWithin',
                            beginDate: new Date(1980, 0, 1),
                            endDate: new Date()
                        }
                    }
                },
                basket: {count: 0, idToItem: {}},
                map: {options: {center: L.latLng(60, 0), zoom: 3}}
            };

            function expandFacets(facets, level) {
                if (facets && level > 0) {
                    facets.forEach(function (facet) {
                        facet.expanded = true;
                        expandFacets(facet.children, level - 1);
                    });
                }
            }

            function init() {
                model.ready = true;
                expandFacets(model.facets, model.options.facetExpansionLevel);
                model.facets.forEach(function (facet) { facet.expanded = defaultExpanded; });
            }

            $http.get(apiPath + 'getFacets')
                .success(function (data) {
                    angular.extend(model, data);
                    init();
                })
                .error(function (data, status) {
                    model.facets.error = {header: 'Error getting facets', status: status, response: data};
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
        .controller('NmdcSearchController', ['$scope', '$http', '$q', '$log', 'NmdcModel', 'NmdcUtil', function ($scope, $http, $q, $log, Model, Util) {
            var ctrl = this;
            $scope.ctrl = ctrl;
            ctrl.model = Model;
            ctrl.util = Util;

            ctrl.isSearching = false;
            var cancelSearch = function () {};

            ctrl.clearSearchText = function () {
                Model.search.text = '';
                ctrl.search();
            };
            ctrl.search = function (isPageSearch) {
                function getSolrQuery() {
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
                        var words = Model.search.text.replace(/"/g, '').split(/ +/)
                            .filter(function (word) { return word.length > 0; })
                            .map(function (word) { return '*"' + word + '"*'; });
                        var textTerm = words.join(' OR ');
                        if (words.length > 1) textTerm = '(' + textTerm + ')';
                        terms.push(textTerm);
                    }
                    if (Model.search.coverage.geographical.selected && Model.search.coverage.geographical.coordinates.length > 0) {
                        var coordinates = [];
                        Model.search.coverage.geographical.coordinates.forEach(function (point) { coordinates.push(ctrl.util.longTrafo(point.lng) + ' ' + ctrl.util.clip(point.lat, -90.0, 90.0));});
                        var first = Model.search.coverage.geographical.coordinates[0];
                        coordinates.push(ctrl.util.longTrafo(first.lng) + ' ' + ctrl.util.clip(first.lat, -90.0, 90.0));
                        terms.push('location_rpt:"' + Model.search.coverage.geographical.operation + '(POLYGON((' + coordinates.join(',') + ')))"');
                    }
                    return terms.join(' AND ');
                }

                function getQueryParameters() {
                    var parameters = {};
                    parameters.q = getSolrQuery();
                    parameters.offset = (Model.search.currentPage - 1) * Model.search.itemsPerPage;
                    if (Model.search.coverage.temporal.selected && (Model.search.coverage.temporal.beginDate !== null || Model.search.coverage.temporal.endDate !== null)) {
                        if (Model.search.coverage.temporal.beginDate !== null) {
                            parameters.beginDate = Util.formatDateSearch(Model.search.coverage.temporal.beginDate);
                        }
                        if (Model.search.coverage.temporal.endDate !== null) {
                            parameters.endDate = Util.formatDateSearch(Model.search.coverage.temporal.endDate);
                        }
                        if (Model.search.coverage.temporal.operation === 'IsWithin') {
                            parameters.dateSearchMode = 'isWithin';
                        }
                    }
                    return parameters;
                }

                var queryParameters = getQueryParameters();
                if (angular.equals(Model.search.queryParameters, queryParameters)) return;
                Model.search.queryParameters = queryParameters;
                $log.log(queryParameters);

                cancelSearch();
                Model.hasSearched = true;
                ctrl.isSearching = true;
                var canceller = $q.defer();
                var isCancelled = false;
                cancelSearch = function () {
                    isCancelled = true;
                    canceller.resolve('cancelled');
                };

                function setResponse(response) {
                    ctrl.isSearching = false;
                    ctrl.removeMarker();
                    Util.adaptSearchResults(response.results);
                    Model.search.response = response;
                    delete Model.search.error;
                    if (!isPageSearch) Model.search.currentPage = 1;
                }

                $http.get(apiPath + 'search?' + Util.urlParametersToString(queryParameters), {timeout: canceller.promise})
                    .success(setResponse)
                    .error(function (data, status) {
                        if (isCancelled) return;
                        setResponse({});
                        Model.search.error = {header: 'Error getting search results', status: status, response: data};
                    });
            };

            ctrl.date = {
                begin: {opened: false},
                end: {opened: false},
                open: function (which, event) {
                    event.preventDefault();
                    event.stopPropagation();
                    ctrl.date[which].opened = true;
                }
            };

            ctrl.addMarker = function (item) {
                ctrl.marker = item.location_rpt;
            };
            ctrl.removeMarker = function () {
                delete ctrl.marker;
            };

            $scope.$watch('ctrl.model.search.currentPage', function (newValue, oldValue) {
                if (newValue === oldValue) return;
                ctrl.search(true);
            });
            $scope.$watch('ctrl.model.search.coverage', function (newValue, oldValue) {
                if (newValue === oldValue) return;
                ctrl.search();
            }, true);
            $scope.$on('$destroy', cancelSearch);
        }])
        .directive('nmdcMap', ['$timeout', 'NmdcModel', 'NmdcUtil', function ($timeout, Model, Util) {
            return {
                restrict: 'E',
                scope: {
                    marker: '='
                },
                template: '<div id="nmdc-map"></div>',
                link: function (scope, element, attrs) {
                    var map = L.map('nmdc-map', Model.map.options);
                    map.addLayer(L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '© OpenStreetMap contributors'}));

                    var itemGroup = L.featureGroup().addTo(map);
                    var markerGroup = L.featureGroup().addTo(map);

                    var drawerOptions = {shapeOptions: {color: '#333333'}, allowIntersection: false};
                    var rectangleDrawer = new L.Draw.Rectangle(map, drawerOptions);
                    var polygonDrawer = new L.Draw.Polygon(map, drawerOptions);

                    var DrawControl = L.Control.extend({
                        options: {position: 'topleft'},
                        onAdd: function (map) {
                            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-draw-section leaflet-draw-toolbar');

                            var boundingBox = L.DomUtil.create('a', 'nmdc-map-button nmdc-map-button-bounding-box', container);
                            boundingBox.title = 'Use map bounding box';
                            boundingBox.text = 'Box';
                            boundingBox.onclick = function () { setType('mapBoundingBox', null); };

                            var rectangle = L.DomUtil.create('a', 'nmdc-map-button leaflet-draw-draw-rectangle', container);
                            rectangle.title = 'Use a rectangle';
                            rectangle.onclick = function () { setType('rectangle', rectangleDrawer); };

                            var polygon = L.DomUtil.create('a', 'nmdc-map-button leaflet-draw-draw-polygon', container);
                            polygon.title = 'Use a polygon';
                            polygon.onclick = function () { setType('polygon', polygonDrawer); };

                            return container;
                        }
                    });
                    map.addControl(new DrawControl());

                    map.on('moveend', function () {
                        Model.map.options.center = map.getCenter();
                        Model.map.options.zoom = map.getZoom();
                        if (Model.search.coverage.geographical.type === 'mapBoundingBox') {
                            setCoordinates(L.rectangle(map.getBounds()).getLatLngs());
                        }
                    });

                    map.on('draw:created', function (e) {
                        var layer = e.layer;
                        addItem(layer);
                        setCoordinates(layer.getLatLngs());
                    });

                    function addItem(layer) {
                        itemGroup.addLayer(layer);
                        layer.editing.enable();
                        layer.on('edit', function () {
                            if (Model.search.coverage.geographical.type === 'polygon' && Util.polygonSelfIntersects(layer.getLatLngs())) {
                                $timeout(function () {
                                    itemGroup.clearLayers();
                                    addItem(L.polygon(angular.copy(Model.search.coverage.geographical.coordinates)));
                                }, 0, false);
                            } else {
                                setCoordinates(layer.getLatLngs());
                            }
                        });
                    }

                    function setType(type, drawer) {
                        scope.$apply(function () {
                            Model.search.coverage.geographical.type = type;
                            Model.search.coverage.geographical.coordinates = [];
                        });
                        itemGroup.clearLayers();
                        rectangleDrawer.disable();
                        polygonDrawer.disable();
                        if (drawer) drawer.enable();
                    }

                    function setCoordinates(coordinates) {
                        scope.$apply(function () {
                            Model.search.coverage.geographical.coordinates = angular.copy(coordinates);
                        });
                    }

                    function parseCoordinates(coordinates) {
                        var result = [];
                        coordinates.split(',').forEach(function (p) {
                            var parts = p.split(' ');
                            result.push(L.latLng(parseFloat(parts[1]), parseFloat(parts[0])));
                        });
                        return result;
                    }

                    function updateMarker(marker) {
                        markerGroup.clearLayers();
                        if (marker) {
                            if (marker.indexOf('POLYGON((') === 0) {
                                var polygon = L.polygon(parseCoordinates(marker.substring(9, marker.length - 2)));
                                markerGroup.addLayer(polygon);
                                if (!Model.search.coverage.geographical.selected) {
                                    map.fitBounds(markerGroup.getBounds(), {maxZoom: Math.max(map.getZoom(), 4)});
                                }
                            } else {
                                var point = parseCoordinates(marker)[0];
                                markerGroup.addLayer(L.marker(point));
                                if (!Model.search.coverage.geographical.selected) map.setView(point, Math.max(map.getZoom(), 4), {animate: true});
                            }
                        }
                    }

                    function init() {
                        var coordinates = angular.copy(Model.search.coverage.geographical.coordinates);
                        var type = Model.search.coverage.geographical.type;
                        if (type === 'rectangle') addItem(L.rectangle(coordinates));
                        if (type === 'polygon') addItem(L.polygon(coordinates));
                        if (type === 'mapBoundingBox') Model.search.coverage.geographical.coordinates = L.rectangle(map.getBounds()).getLatLngs();
                    }

                    init();

                    scope.$watch('marker', function () {
                        $timeout(function () { updateMarker(scope.marker); }, 0, false);
                    });
                    scope.$on('$destroy', function () {
                        map.remove();
                    });
                }
            };
        }])
        .directive('nmdcError', [function () {
            return {
                restrict: 'A',
                scope: {nmdcError: '='},
                template:
                '<alert ng-show="nmdcError" type="danger">' +
                '<h4>{{nmdcError.header}}</h4>' +
                '<div><strong>Status:</strong> {{nmdcError.status}}</div>' +
                '<div><strong>Message:</strong> {{nmdcError.response.message}}</div>' +
                '</alert>'
            };
        }])
        .directive('nmdcExpansion', [function () {
            return {
                restrict: 'E',
                transclude: true,
                scope: {
                    expandable: '='
                },
                template: '<a class="nmdc-expansion" href="" ng-click="expandable.expanded = !expandable.expanded">' +
                '<span class="nmdc-expansion-icon" ng-hide="expandable.expanded">+</span>' +
                '<span class="nmdc-expansion-icon" ng-show="expandable.expanded">−</span>' +
                '<ng-transclude></ng-transclude>' +
                '</a>'
            };
        }])
        .directive('nmdcAddClassWhenAtTop', ['$window', function ($window) {
            return {
                restrict: 'A',
                link: function (scope, element, attrs) {
                    function onScroll() {
                        var boundingClientRect = element.parent()[0].getBoundingClientRect().top;
                        element.toggleClass(attrs.nmdcAddClassWhenAtTop, boundingClientRect < 0);
                    }

                    angular.element($window).on('scroll', onScroll);
                    scope.$on('$destroy', function () { angular.element($window).off('scroll', onScroll); });
                }
            };
        }])
        .controller('NmdcBasketController', ['$scope', 'NmdcModel', 'NmdcUtil', function ($scope, Model, Util) {
            var ctrl = this;
            $scope.ctrl = ctrl;
            ctrl.util = Util;
            ctrl.model = Model;
        }])
        .controller('NmdcDetailsController', ['$scope', '$http', '$routeParams', 'NmdcModel', 'NmdcUtil', function ($scope, $http, $routeParams, Model, Util) {
            var ctrl = this;
            $scope.ctrl = ctrl;
            ctrl.model = Model;
            ctrl.id = $routeParams.id;

            $http.get(apiPath + 'search?q="' + ctrl.id + '"')
                .success(function (data) {
                    Util.adaptSearchResults(data.results);
                    ctrl.details = data.results[0];
                })
                .error(function (data, status) {
                    ctrl.error = {header: 'Error getting metadata details', status: status, response: data};
                });
        }]);
}());
