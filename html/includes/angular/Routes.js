var OCEM = angular.module('RideOrDie', ['ngRoute', 'ui.bootstrap', 'ui.mask','firebase', 'google-maps'.ns()]);

OCEM.controller('indexCtlr', ['$scope','$http','$firebase', indexCtrl]);


OCEM.config(['$routeProvider', '$locationProvider',
    function($routeProvider, $locationProvider) {
        $locationProvider.html5Mode(true);
        $routeProvider
        .when('/', {
            templateUrl: '/partials/Index',
            controller: 'indexCtlr'
        })
        .otherwise({
            redirectTo: '/'
        });
  }]);

OCEM.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.interceptors.push(function() {
        return {
            request: function(request) {
                if (request.method === 'GET') {
                    if (request.url.indexOf('.') === -1) {
                        var sep = request.url.indexOf('?') === -1 ? '?' : '&';
                        request.url = request.url + sep + 'cacheBust=' + new Date().getTime();
                    }
                }
                return request;
            }
        };
    });
}])


function indexCtrl($scope, $http, $firebase) {
    $scope.url = '/data/durham-bike-lanes.geojson';
    var addedListener = false;
    var wasLoaded = false;
    var count = 0;

    $scope.map = {
        center: {latitude: 35.9886, longitude: -78.9072},
        zoom: 12,
        events: {
            tilesloaded: function (map) {
                $scope.$apply(function () {
                    $scope.mapInstance = map;
                    if (!addedListener) {
                        map.data.addListener('addfeature', function (event) {
                            event.feature.setProperty("severity", "0");
                            event.feature.setProperty("severityCount", "0");
                            count++;
                        });
                    }
                    if (!wasLoaded) {
                        map.data.loadGeoJson($scope.url);

                        $scope.dataSet = [];
                        var ref = new Firebase("https://rideordie.firebaseio.com/");
                        ref.once('value', function(snapshot){
                            var dataarray = snapshot.val();
                            $scope.highestWrecks = 0;
                            dataarray.forEach(function(item){
                                if(item.city.toString() == 'Durham') {
                                    map.data.forEach(function(feature) {
                                        feature.getGeometry().getArray().forEach(function(coord) {
                                            var dist = calcCrow(coord.lat(), coord.lng(), item.location.latitude, item.location.longitude);
                                            if (dist < 0.04572) { //150 feet
                                                console.log("Coord: " + coord.lat() + ", " + coord.lng() + "Coord2: " + item.location.latitude + ", " + item.location.longitude +" - Distance: " + dist);
                                                feature.setProperty("severityCount", parseFloat(feature.getProperty('severityCount'))+1);
                                                if (parseFloat(feature.getProperty('severityCount')) > $scope.highestWrecks) {
                                                    $scope.highestWrecks = parseFloat(feature.getProperty('severityCount'));
                                                }
                                                $scope.dataSet.push(item);
                                            }
                                        });
                                    });
                                }
                            });
                            map.data.forEach(function(feature) {
                                feature.setProperty("severity", parseFloat((feature.getProperty('severityCount'))/$scope.highestWrecks));

                            });
                            $scope.$apply();
                            console.log($scope.highestWrecks);
                            console.log($scope.dataSet);
                        });


                        wasLoaded = true;
                    }
                    setInterval(updateMap($scope.mapInstance), 5000);
                });
            }
        }
    }
}

function updateMap(mapInstance) {
    mapInstance.data.setStyle(function(feature) {
        if (feature.getProperty('severityCount') && parseFloat(feature.getProperty('severityCount')) == 0) {
            color = "green";
        } else if (feature.getProperty('severityCount')) {
            color = getColor(parseFloat(feature.getProperty('severity')));
        }
        return /** @type {google.maps.Data.StyleOptions} */({
            fillColor: color,
            strokeColor: color,
            strokeWeight: 3
        });
    });

    mapInstance.set('styles', [
        {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [
                { color: '#CCCCCC' },
                { weight: .2 }
            ]
        }
    ]);
}

function getColor(value){
    //value from 0 to 1
    var hue=(((1-value)*120)-40);
    if (hue < 0)
        hue = 0;
    return ["hsl(",hue,",100%,50%)"].join("");
}

function getSeverity(dataItem, highestWrecks) {
    if (dataItem)
    return 0;
}

//This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
function calcCrow(lat1, lon1, lat2, lon2)
{
    var R = 6371; // km
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lon2-lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d;
}

// Converts numeric degrees to radians
function toRad(Value)
{
    return Value * Math.PI / 180;
}
