(function () {
    'use strict';
    /* global angular, L */

    var apiPath = 'metadata-api/';

    angular.module('NmdcApp', ['ngAnimate', 'ngRoute', 'ui.bootstrap', 'treeControl'])
        .config(['$routeProvider', function ($routeProvider) {
            $routeProvider
                .when('/', {templateUrl: '_static_content_/partials/search.html'})
                .when('/basket', {templateUrl: '_static_content_/partials/basket.html'})
                .when('/details/:id', {templateUrl: '_static_content_/partials/details.html'})
                .otherwise({redirectTo: '/'});
        }])
        .config(['uibDatepickerConfig', 'uibDatepickerPopupConfig', function (uibDatepickerConfig, uibDatepickerPopupConfig) {
            uibDatepickerConfig.startingDay = 1;
            uibDatepickerConfig.showWeeks = true;
            uibDatepickerConfig.minMode = 'month';
            uibDatepickerPopupConfig.closeText = 'Close';
        }])
        .factory('NmdcUtil', ['$window', '$timeout', function ($window, $timeout) {
            var util = {};
            util.urlParametersToString = function (values) {
                var string = '';
                angular.forEach(values, function (value, key) {
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
            util.normalizeLongitude = function (longitude) {
                longitude = longitude % 360;
                if (longitude < -180) return longitude + 360;
                if (longitude >= 180) return longitude - 360;
                return longitude;
            };
            util.clip = function (x, min, max) {
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
            util.solrEscapeSpecialCharacters = function (text) {
                // https://lucene.apache.org/core/5_3_1/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#Escaping_Special_Characters
                return text.replace(/[\+\-&\|!\(\)\{}\[\]\^"~\*\?:\\\/]/g, '\\$&');
            };
            util.splitSearchText = function (text) {
                var result = [];
                var parts = text.split('"');
                for (var i = 0; i < parts.length; i++) {
                    var part = parts[i];
                    if (i % 2 === 1) {
                        result.push('"' + util.solrEscapeSpecialCharacters(part) + '"');
                    } else {
                        var words = part.split(/\s+/);
                        words.forEach(function (word) { if (word.length > 0) result.push('*' + util.solrEscapeSpecialCharacters(word) + '*'); });
                    }
                }
                return result;
            };

            util.hasMouse = $window.innerWidth >= 768;
            angular.element($window).on('mousemove touchmove touchstart', function setHasMouse(e) {
                e = e.originalEvent;
                var hasMouse = false;
                if (e.type === 'mousemove') {
                    if (e.movementX === 0 && e.movementY === 0) return;
                    hasMouse = true;
                }
                if (util.hasMouse !== hasMouse) {
                    $timeout(function () { util.hasMouse = hasMouse; });
                }
            });

            return util;
        }])
        .filter('nmdcUriComponent', [function () {
            return function (uriComponent) {
                return encodeURIComponent(uriComponent).replace(/%2F/g, '%252F').replace(/%5C/g, '%255C');
            };
        }])
        .filter('nmdcUriDecode', [function () {
            return function (uriComponent) {
                return decodeURIComponent(uriComponent);
            };
        }])
        .factory('NmdcModel', ['$http', '$window','$timeout','$location', function ($http, $window,$timeout,$location) {
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
		    initPage:true ,
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

            function initFacetTree(facet, parent, children, level) {
                children.forEach(function (child) {
                    child.parent = parent;
                    facet.allNodes.push(child);
                    if (level < model.options.facetExpansionLevel) facet.expandedNodes.push(child);
                    if (child.childFacets) initFacetTree(facet, child, child.childFacets, level + 1);
                });
            }

            function init() {
		if ($window.sessionStorage.getItem("nmdcBasket")) {
		    model.basket.idToItem=JSON.parse($window.sessionStorage.getItem("nmdcBasket"));
		    model.basket.count=Object.keys(model.basket.idToItem).length;
		}
		
		//xxxxx
		model.ready = true;
                model.facets.forEach(function (facet) {
                    facet.expanded = defaultExpanded;
                    facet.expandedNodes = [];
                    facet.selectedNodes = [];
                    facet.allNodes = [];
                    initFacetTree(facet, null, facet.children, 0);
                });

		if ($window.sessionStorage.getItem("nmdcSearch")) {
		    var searchState = JSON.parse($window.sessionStorage.getItem("nmdcSearch"));
		    model.search.currentPage=searchState.offset/model.search.itemsPerPage+1;
		    var searchTerms = searchState.q.split("AND");
		    searchTerms.forEach(function (term,i) {
			if (term.charAt(0) == '(') {
			    term = term.trim().slice(1,-1);
			}
			if (term.indexOf("Provider:") >= 0) {
			    term.split(" OR ").forEach(function (t,i) {
				var facetValue = t.trim().slice(10,-1);
				model.facets[1].allNodes.forEach(function (i,j){
				    if (i.value==facetValue) {
					model.facets[1].selectedNodes.push(i);
				    }
				});
			    });
			} else if (term.indexOf("Scientific_Keyword:") >= 0) {
			    term.split(" OR ").forEach(function (t,i) {
				var facetValue =t.slice(20,-1).split(">");
				facetValue.shift();
				var facetLevel = model.facets[0].children[0];
				facetValue.forEach(function (i,j) {
				    facetLevel.childFacets.forEach(function (fi,fj){
					if (fi.value==i) {
					    facetLevel = fi;
					}
				    });
				});
				model.facets[0].selectedNodes.push(facetLevel);
				while (facetLevel.parent) {
				    model.facets[0].expandedNodes.push(facetLevel.parent);
				    facetLevel = facetLevel.parent;
				}
			    });
			} else if (term.indexOf("location_rpt:") >= 0) {

			} else {
			    var searchText = "";
			    term.split("OR").forEach(function (t,i) {
				searchText = searchText +" "+t.trim().slice(1,-1);
			    });
			    model.search.text=searchText.trim();
			}
		    });
		
		//TODO add time parameter
		    if (searchState.beginDate) {
			console.log(searchState.beginDate);
			console.log(Date.parse(searchState.beginDate));
			
			
			//model.search.coverage.temporal.beginDate=Date.parse(searchState.beginDate);
			//model.search.coverage.temporal.endDate=Date.parse(searchState.endDate);
		        // model.search.coverage.temporal.selected = true;
		}
		    
		
		}
	
		model.search.initPage=false;
            }

	    function showProgress() {
		$http.get('/Subsetter/checkNMDCJob',
			  {params: {id: model.basket.jobID}}
			 )
                    .then(function (response) {
			model.basket.log = response.data.log;
			model.basket.lastLog = response.data.log.slice(-1).pop();
			model.basket.progress = response.data.progress;
			model.basket.packing=response.data.running;
			if (response.data.running) {
			    $timeout(showProgress, 500);
			}

			
                }, function (response) {
                    console.log("error",response);
                });
		
	    }
	    
            $http.get(apiPath + 'getFacets')
                .then(function (response) {
                    angular.extend(model, response.data);
                    init();
                }, function (response) {
                    model.facets.error = {title: 'Error getting facets', response: response};
                });

            model.basket.clear = function () {
                model.basket.idToItem = {};
                model.basket.count = 0;
            };
            model.basket.add = function (item) {
                if (model.basket.idToItem[item.Entry_ID]) return;
                model.basket.idToItem[item.Entry_ID] = item;
                model.basket.count++;
		$window.sessionStorage.setItem("nmdcBasket",JSON.stringify(model.basket.idToItem));
            };
	    model.basket.downloadAll = function () {
		$('#packageModal').modal('show')
		model.basket.progressTitle="Zip basket";
		var res = $http.post('/Subsetter/basketZip',model.basket.idToItem);
		res.success(function(data, status, headers, config) {
		    model.basket.jobID=data.id;
		    model.basket.log=[];
		    model.basket.progress = 0;
		    model.basket.packing=true;
		    $timeout(showProgress, 500);
		});
		res.error(function(data, status, headers, config) {
	             console.log("failure message: " + JSON.stringify({data: data}));
		});
            };
	    model.basket.cancelJob = function () {
		$http.get('/Subsetter/cancelJob',
			  {params: {id: model.basket.jobID}}
			 )
                    .then(function (response) {
			console.log("Job cancelled");
                    }, function (response) {
			console.log("error",response);
                    });
	    };
	    model.basket.subset = function () {

		if (model.basket.subsetMap) {
		    model.basket.subsetMap.remove();
		}
		$('#subsetModal').modal('show').on('shown.bs.modal', function(){
		    model.basket.subsetMap.invalidateSize(); //Hack to force leaflet to work in bootstrap modal dialog
		    model.basket.subsetMap.fitBounds(model.basket.mapBounds);
		});

		model.basket.subsetMap = L.map('subsetMap').setView([60.0, 0.0], 6);

		L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
		    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(model.basket.subsetMap);

		var drawnItems = new L.FeatureGroup();

		var subsetItems = new L.FeatureGroup();
		var nonsubsetItems = new L.FeatureGroup();
		
		model.basket.subsetMap.addLayer(subsetItems);
		model.basket.subsetMap.addLayer(nonsubsetItems);
		
		model.basket.subsetMap.addLayer(drawnItems);
		var drawControl = new L.Control.Draw({
		    draw: {
			polyline:false,
			circle:false,
			polygon: false,
			marker: false
		
		    },
		    edit: {
			featureGroup: drawnItems,
			edit:false,
			remove:false
		    }
		});

		//String are for legend, should be a bbter way to achieve this
		var subsetStyle={fillColor:'#ffff00',color: 'green',fillOpacity: 0.0};
		var subsetStyleString="border: 2px solid green";
		var nonSubsetStyle={fillColor:'#ff00ff',color: 'red',fillOpacity: 0.0};
		var nonSubsetStyleString="border: 2px solid red";
		
		
		model.basket.subsetMap.addControl(drawControl);
		Object.keys(model.basket.idToItem).forEach(function (valueID, key) {

		    var value = model.basket.idToItem[valueID]; //Hack for IE
		    
		    var subset = false;
		    if (value.Data_URL_Subtype) {
			var subtypes = value.Data_URL_Subtype.slice(1,-1).split(",");
			subtypes.forEach(function(subtype) {
			    subset = subset || (subtype.trim()==="OPENDAP DATA (DODS)");
			});
		    }

		    //Hack for met.no url types
		    
		    if (value.Data_URL_Type) {
			var types = value.Data_URL_Type.slice(1,-1).split(",");
			types.forEach(function(type) {
			    subset = subset || (type.trim()==="Access to OPeNDAP service");
			});
		    }
		    
		    

		    
		    
		    var marker = value.location_rpt;
                    if (marker) {
                        if (marker.indexOf('POLYGON((') === 0) {
			    var points = [];
			    marker.substring(9, marker.length - 2).split(',').forEach(function (p) {
				var parts = p.split(' ');
				points.push(L.latLng(parseFloat(parts[1]), parseFloat(parts[0])));
                            });
                            var polygon = L.polygon(points);
			    value.subsetAble = subset;
			    value.bounds = polygon.getBounds();
			    
			    if (subset) {
				polygon.setStyle(subsetStyle);
				subsetItems.addLayer(polygon);
			    } else {
				polygon.setStyle(nonSubsetStyle);
				nonsubsetItems.addLayer(polygon);
			    }

                        } else {
			    var parts = marker.split(' ');
			    var point = L.latLng(parseFloat(parts[1]), parseFloat(parts[0]));
			    var pointMarker = L.marker(point)
			    value.subsetAble = subset;
			    value.point =point;
			    if (subset) {
				subsetItems.addLayer(pointMarker);
			    } else {
				nonsubsetItems.addLayer(pointMarker);
			    }
                        }
                    }
		});
		//subsetMap.fitBounds(markerItems.getBounds(,) {maxZoom: Math.min(subsetMap.getZoom(), 3)});
		console.log(subsetItems.getBounds());
		
		if (subsetItems.getBounds().isValid()) {
		    model.basket.mapBounds =subsetItems.getBounds();
		} else if (nonsubsetItems.getBounds().isValid()) {
		    model.basket.mapBounds = nonsubsetItems.getBounds();
		} else {
		    console.log("No items to use for bounds")
		}
		
		
		model.basket.nonSubsetMarkers=nonsubsetItems;
		
		model.basket.alert="";
		model.basket.includeAll=true;
		model.basket.miny="";
		model.basket.maxy="";
		model.basket.minx="";
		model.basket.maxx="";
		

		var legend = L.control({position: 'bottomright'});
		legend.onAdd = function (map) {
		    var div = L.DomUtil.create('div', 'info subsetLegend');
		    div.innerHTML +="<span style=\""+subsetStyleString+"\"></span>Subsettable<br/>";
		    div.innerHTML +="<span style=\""+nonSubsetStyleString+"\"></span>Non Subsettable";
		    return div;
		};

		
		legend.addTo(model.basket.subsetMap);
	    
		
		model.basket.subsetMap.on("draw:created", function (e) {
		    var type = e.layerType;
		    var layer = e.layer;
		    drawnItems.clearLayers();
		    drawnItems.addLayer(layer);

		    var coords = layer.getLatLngs();
		    //Could do this with map/filter but we know there is only four coords
		    var minY = Math.min(coords[0].lat,coords[1].lat,coords[2].lat,coords[3].lat);
		    var maxY = Math.max(coords[0].lat,coords[1].lat,coords[2].lat,coords[3].lat);
		    var minX = Math.min(coords[0].lng,coords[1].lng,coords[2].lng,coords[3].lng);
		    var maxX = Math.max(coords[0].lng,coords[1].lng,coords[2].lng,coords[3].lng);

		    //Fugly hack to force angular to see changes
		    $timeout(function () {
			model.basket.bounds=layer.getBounds();
			model.basket.miny=minY;
			model.basket.maxy=maxY;
			model.basket.minx=minX;
			model.basket.maxx=maxX;
		    });
		});

		
		
	    };
	    model.basket.flip = function() {
		if (!model.basket.includeAll) {
		    model.basket.subsetMap.removeLayer(model.basket.nonSubsetMarkers);
		} else {
		    model.basket.subsetMap.addLayer(model.basket.nonSubsetMarkers);
		}
	    };
	    model.basket.startSubset = function() {
		if (!model.basket.minx
		    || !model.basket.miny
		    || !model.basket.maxx
		    || !model.basket.maxy) {
		    model.basket.alert="Subset bounds not set";
		    return;
		}


		var data = {};
		Object.keys(model.basket.idToItem).forEach(function (valueID, key) {
		    var value = model.basket.idToItem[valueID]; //Hack for IE
		    
		    if (value.subsetAble){ 
			data[value.Entry_ID]=value;
		    } else if (model.basket.includeAll ){

			if (value.bounds) {
			    if (model.basket.bounds.intersects(value.bounds)) {
				data[value.Entry_ID]=value;
			    }
			} else {
			    if (model.basket.bounds.contains(value.point)) {
				data[value.Entry_ID]=value;
			    }
			}
		    }
		});
	
		if (angular.equals(data, {})){
		    model.basket.alert="There are no datasets selected";
		    return;
		}
	
		

		$('#subsetModal').modal('hide');
		
		
		$('#packageModal').modal('show')
		model.basket.progressTitle="Subset basket";
		
		var subsetReq = { basket:data,
				  minX:model.basket.minx,
				  minY:model.basket.miny,
				  maxX:model.basket.maxx,
				  maxY:model.basket.maxy
		}
		var res = $http.post('/Subsetter/basketSubset',subsetReq);
		res.success(function(data, status, headers, config) {
		    model.basket.jobID=data.id;
		    model.basket.log=[];
		    model.basket.progress = 0;
		    model.basket.packing=true;
		    $timeout(showProgress, 500);
		});
		res.error(function(data, status, headers, config) {
	             console.log("failure message: " + JSON.stringify({data: data}));
		});
	    };
	    model.basket.addpage = function (event) {
		model.search.response.results.forEach(model.basket.add);
		if (event.ctrlKey) { //Quick shortcut to jump to basket
		    $location.url('/basket');
		}
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
        .controller('NmdcSearchController', ['$scope', '$http', '$q', '$log','$window', 'NmdcModel', 'NmdcUtil', function ($scope, $http, $q, $log,$window, Model, Util) {
            var ctrl = this;
            $scope.ctrl = ctrl;
            ctrl.model = Model;
            ctrl.util = Util;

            ctrl.typeahead = {
                text: {},
                onSelect: function (facet, node) {
                    ctrl.typeahead.text[facet.name] = '';
                    if (facet.selectedNodes.indexOf(node) < 0) {
                        facet.selectedNodes.push(node);
                        ctrl.search();
                    }
                }
            };

            ctrl.facetTree = {
                options: {
                    nodeChildren: 'childFacets',
                    multiSelection: true,
                    dirSelectable: true
                }
            };

            ctrl.isSearching = false;
            var cancelSearch = function () {};

            ctrl.clearSearchText = function () {
                Model.search.text = '';
                ctrl.search();
            };
            ctrl.search = function (isPageSearch) {
		//console.log("-------Start search function----------")
		
                function getSolrQuery() {
                    var terms = [];
                    Model.facets.forEach(function (facet) {
                        var facetTerms = [];

                        function addFacetTerms(path, node) {
                            if (path.length > 0) path += '>';
                            path += node.value;
                            if (facet.selectedNodes.indexOf(node) >= 0) {
                                facetTerms.push(facet.name + ':"' + path + '"');
                            } else {
                                node.childFacets.forEach(function (child) { addFacetTerms(path, child); });
                            }
                        }

                        facet.children.forEach(function (node) {
                            addFacetTerms('', node);
                        });
                        if (facetTerms.length > 0) {
                            var facetQuery = facetTerms.join(' OR ');
                            if (facetTerms.length > 1) facetQuery = '(' + facetQuery + ')';
                            terms.push(facetQuery);
                        }
                    });
                    if (Model.search.text) {
			console.log("Have text");
                        var words = Util.splitSearchText(Model.search.text);
                        var textTerm = words.join(' OR ');
                        if (words.length > 1) textTerm = '(' + textTerm + ')';
                        terms.push(textTerm);
                    }
                    if (Model.search.coverage.geographical.selected && Model.search.coverage.geographical.coordinates.length > 0) {
                        var coordinates = [];
                        Model.search.coverage.geographical.coordinates.forEach(function (point) { coordinates.push(Util.normalizeLongitude(point.lng) + ' ' + Util.clip(point.lat, -90.0, 90.0));});
                        var first = Model.search.coverage.geographical.coordinates[0];
                        coordinates.push(Util.normalizeLongitude(first.lng) + ' ' + Util.clip(first.lat, -90.0, 90.0));
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
                $log.log(Util.urlParametersToString(queryParameters));

		//yyyy
		//$window.localStorage.setItem("nmdcSearch",JSON.stringify(queryParameters));
		$window.sessionStorage.setItem("nmdcSearch",JSON.stringify(queryParameters));

		
                cancelSearch();
                Model.hasSearched = true;
                ctrl.isSearching = true;
                var canceller = $q.defer();
                var isCancelled = false;
                cancelSearch = function () {
                    isCancelled = true;
                    canceller.resolve('cancelled');
                };

                function setResponseData(data) {
                    ctrl.isSearching = false;
                    ctrl.removeMarker();
                    Util.adaptSearchResults(data.results);
                    Model.search.response = data;
                    delete Model.search.error;
                    if (!isPageSearch) Model.search.currentPage = 1;
                }


		
                $http.get(apiPath + 'search?' + Util.urlParametersToString(queryParameters), {timeout: canceller.promise})
                    .then(function (response) {
                        setResponseData(response.data);
                    }, function (response) {
                        if (isCancelled) return;
                        setResponseData({results: []});
                        Model.search.error = {title: 'Error getting search results', response: response};
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

	     $scope.$watch('ctrl.model.search.initPage', function (newValue, oldValue) {
                console.log("init search")
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
                restrict: 'A',
                scope: {
                    marker: '='
                },
                link: function (scope, element, attrs) {
                    var map = L.map(element[0], Model.map.options);
                    map.addLayer(L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '© OpenStreetMap contributors'}));

                    var itemGroup = L.featureGroup().addTo(map);
                    var markerGroup = L.featureGroup().addTo(map);

                    var drawerOptions = {shapeOptions: {color: '#333333'}, allowIntersection: false};
                    var rectangleDrawer = new L.Draw.Rectangle(map, drawerOptions);
                    var polygonDrawer = new L.Draw.Polygon(map, drawerOptions);

                    var DrawControl = L.Control.extend({
                        options: {position: 'topleft'},
                        onAdd: function (map) {
                            var container = L.DomUtil.create('div', 'nmdc-map-button-container leaflet-bar leaflet-control leaflet-draw-section leaflet-draw-toolbar');

                            var boundingBox = L.DomUtil.create('a', 'nmdc-map-button nmdc-map-button-bounding-box', container);
                            boundingBox.title = 'Use map bounding box';
                            boundingBox.text = 'Box';
                            boundingBox.onclick = wrapInScopeApply(function () { setType('mapBoundingBox', null); });

                            var rectangle = L.DomUtil.create('a', 'nmdc-map-button leaflet-draw-draw-rectangle', container);
                            rectangle.title = 'Use a rectangle';
                            rectangle.onclick = wrapInScopeApply(function () { setType('rectangle', rectangleDrawer); });

                            var polygon = L.DomUtil.create('a', 'nmdc-map-button leaflet-draw-draw-polygon', container);
                            polygon.title = 'Use a polygon';
                            polygon.onclick = wrapInScopeApply(function () { setType('polygon', polygonDrawer); });

                            return container;
                        }
                    });
                    map.addControl(new DrawControl());

                    map.on('moveend', wrapInScopeApply(function () {
                        if (Math.abs(map.getCenter().lng - map.getCenter().wrap().lng) > 1) {
                            map.panTo(map.getCenter().wrap(), {animate: false});
                        }
                        Model.map.options.center = map.getCenter();
                        Model.map.options.zoom = map.getZoom();
                        if (Model.search.coverage.geographical.type === 'mapBoundingBox') {
                            setCoordinates(L.rectangle(map.getBounds()).getLatLngs());
                        }
                    }));

                    map.on('draw:created', wrapInScopeApply(function (e) {
                        var layer = e.layer;
                        addItem(layer);
                        setCoordinates(layer.getLatLngs());
                    }));

                    function addItem(layer) {
                        itemGroup.addLayer(layer);
                        layer.editing.enable();
                        layer.on('edit', wrapInScopeApply(function () {
                            if (Model.search.coverage.geographical.type === 'polygon' && Util.polygonSelfIntersects(layer.getLatLngs())) {
                                itemGroup.clearLayers();
                                addItem(L.polygon(angular.copy(Model.search.coverage.geographical.coordinates)));
                            } else {
                                setCoordinates(layer.getLatLngs());
                            }
                        }));
                    }

                    function setType(type, drawer) {
                        Model.search.coverage.geographical.type = type;
                        Model.search.coverage.geographical.coordinates = [];
                        itemGroup.clearLayers();
                        rectangleDrawer.disable();
                        polygonDrawer.disable();
                        if (drawer) drawer.enable();
                    }

                    function setCoordinates(coordinates) {
                        Model.search.coverage.geographical.coordinates = angular.copy(coordinates);
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
                                    map.fitBounds(markerGroup.getBounds(), {maxZoom: Math.min(map.getZoom(), 3)});
                                }
                            } else {
                                var point = parseCoordinates(marker)[0];
                                markerGroup.addLayer(L.marker(point));
                                if (!Model.search.coverage.geographical.selected) map.setView(point, Math.max(map.getZoom(), 3), {animate: true});
                            }
                        }
                    }

                    function wrapInScopeApply(f) {
                        return function () {
                            var a = arguments;
                            $timeout(function () { f.apply(this, a); });
                        };
                    }

                    function init() {
                        var coordinates = angular.copy(Model.search.coverage.geographical.coordinates);
                        var type = Model.search.coverage.geographical.type;
                        if (type === 'rectangle') addItem(L.rectangle(coordinates));
                        if (type === 'polygon') addItem(L.polygon(coordinates));
                        if (type === 'mapBoundingBox') Model.search.coverage.geographical.coordinates = L.rectangle(map.getBounds()).getLatLngs();
                    }

                    init();
                    scope.util = Util;

                    scope.$watch('marker', function () {
                        updateMarker(scope.marker);
                    });
                    scope.$watch('util.hasMouse', function () {
                        element.find('.nmdc-map-button-container').toggle(Util.hasMouse);
                        if (!Util.hasMouse) setType('mapBoundingBox', null);
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
                '<uib-alert ng-show="nmdcError" type="danger">' +
                '<h4>{{nmdcError.title}}</h4>' +
                '<div ng-show="nmdcError.response.status > 0">' +
                '<div ng-show="nmdcError.response.statusText">{{nmdcError.response.status}} - {{nmdcError.response.statusText}}</div>' +
                '<div ng-hide="nmdcError.response.statusText">Status code: {{nmdcError.response.status}}</div>' +
                '<div style="word-wrap: break-word">{{nmdcError.response.data.message || nmdcError.response.data}}</div>' +
                '</div>' +
                '<div ng-hide="nmdcError.response.status > 0">Could not contact the server.<br>Please check your Internet connection and try again.</div>' +
                '</uib-alert>'
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
        .controller('NmdcDetailsController', ['$sce', '$scope', '$http', '$routeParams', 'NmdcModel', 'NmdcUtil', function ($sce, $scope, $http, $routeParams, Model, Util) {
            var ctrl = this;
            $scope.ctrl = ctrl;
            ctrl.model = Model;
            ctrl.id = $routeParams.id;

            $http({url:apiPath + 'getMetadataDetails?doi=' + ctrl.id, method:'GET', responseType:'text',
transformResponse:[function (response) {
$scope.html = response;
$scope.trustedHtml = $sce.trustAsHtml($scope.html);
ctrl.details=response;

}]
});
   

 
                    




        }]);
}());
