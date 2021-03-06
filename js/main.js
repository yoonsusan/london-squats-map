(function (window, $, undefined) {
    "use strict";

    $.freespacemap = function (options, element) {
        this.element = $(element);
        if (!this._create(options)) {
            this.failed = true;
        }
    };

    $.freespacemap.defaults = {
        center: [51.4916, -0.1469],
        leafletApiKey: '781b27aa166a49e1a398cd9b38a81cdf',
        leafletStyleId: '9986',
        zoom: 10,
    };

    $.freespacemap.prototype = {

        map: null,

        style: {
            fillColor: '#000',
            fillOpacity: 1,
            radius: 4,
            color: '#FFF',
            opacity: 1
        },

        _create: function (options) {
            // Add custom options to defaults
            var opts = $.extend(true, {}, $.freespacemap.defaults, options);
            this.options = opts;
            var $window = $(window);
            var instance = this;

            instance._initializeMap();

            return true;
        },

        _initializeMap: function () {
            var instance = this;

            instance.map = L.map('map', {
                center: instance.options.center,
                zoom: instance.options.zoom
            });

            // add tile layer
            L.tileLayer('http://{s}.tile.cloudmade.com/' 
                    + instance.options.leafletApiKey +'/' + instance.options.leafletStyleId
                    + '/256/{z}/{x}/{y}.png', {
                attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery &copy; <a href="http://cloudmade.com">CloudMade</a>',
                maxZoom: 18,
            }).addTo(instance.map);

            $.getJSON('http://newagebeverages.cartodb.com/api/v2/sql?format=GeoJSON&q=SELECT * FROM evicted_squats_london WHERE needs_more_info IS NULL OR needs_more_info = false', function (data) {
                L.geoJson(data, {

                    onEachFeature: function (featureData, layer) {
                        // precompile
                        var source = $('#popup-template').html();
                        var template = Handlebars.compile(source);
                        var content = template({
                            place: featureData
                        });
                        layer.bindPopup(content, {
                            minWidth: 300,
                            maxHeight: 450
                        });
                    },

                    pointToLayer: function (feature, latlng) {
                        return L.circleMarker(latlng, instance.style);
                    },

                }).addTo(instance.map);
            });

        },

        openFeaturePopup: function (cartodbid) {
            var instance = this;
            instance.map.eachLayer(function (layer) {
                // Wrapped in try {} because this will see all layers, even
                // those that do not represent features
                try {
                    if (layer.feature.properties.cartodb_id === cartodbid) {
                        layer.openPopup();
                    }
                }
                catch (e) { }
            });
        }

    };

    $.fn.freespacemap = function (options) {
        var thisCall = typeof options;

        switch (thisCall) {

        // method 
        case 'string':
            var args = Array.prototype.slice.call(arguments, 1);
            var instance = $.data(this[0], 'freespacemap');

            if (!instance) {
                // not setup yet
                return $.error('Method ' + options +
                    ' cannot be called until freespacemap is setup');
            }

            if (!$.isFunction(instance[options]) || options.charAt(0) === "_") {
                return $.error('No such method ' + options + ' for freespacemap');
            }

            // no errors!
            return instance[options].apply(instance, args);
            break;

            // creation 
        case 'object':

            this.each(function () {
                var instance = $.data(this, 'freespacemap');

                if (instance) {
                    // update options of current instance
                    instance.update(options);
                } else {
                    // initialize new instance
                    instance = new $.freespacemap(options, this);

                    // don't attach if instantiation failed
                    if (!instance.failed) {
                        $.data(this, 'freespacemap', instance);
                    }
                }
            });

            break;
        }

        return this;
    };

})(window, jQuery);


function getQueryUrl(query) {
    var baseUrl = 'http://newagebeverages.cartodb.com/api/v2/sql?format=GeoJSON&';
    return baseUrl + 'q=' + query;
}


function addHaveYouSeenList() {
    var query = 'SELECT * ' +
        'FROM evicted_squats_london ' +
        'WHERE needs_more_info = true ' +
        'ORDER BY name_of_squat';

    $.getJSON(getQueryUrl(query), function (data) {
        var source = $('#list-template').html();
        var template = Handlebars.compile(source);
        $('#have-you-seen-list-wrapper').html(template({
            places: data.features,
        }));
    });
}


function showCurrentList(list) {
    var source = $('#current-list-template').html();
    var template = Handlebars.compile(source);
    $('#current-list-wrapper').html(template({
        places: list,
    }));
    $('.view-squat').click(function () {
        $('#map').data('freespacemap').openFeaturePopup($(this).data('cartodbid'));
        return false;
    });
}


function addCurrentList() {
    var query = 'SELECT * ' +
        'FROM evicted_squats_london ' +
        'WHERE (needs_more_info = false OR needs_more_info IS NULL) ' +
            'AND the_geom IS NOT NULL ' +
        'ORDER BY name_of_squat';

    var places = [];
    $.getJSON(getQueryUrl(query), function (data) {
        places = data.features;
        showCurrentList(places);
    });

    $('#current-list-filter-input').keyup(function () {
        var filteredPlaces = places;
        var filterText = $(this).val().toLowerCase();
        if (filterText && filterText !== '') {
            filteredPlaces = _.filter(places, function (place) {
                try {
                    return place.properties.name_of_squat.toLowerCase().indexOf(filterText) >= 0;
                }
                catch (e) {
                    return false;
                }
            });
        }
        showCurrentList(filteredPlaces);
    });
}


function useFullHeight() {
    var availableHeight = $(window).height() - $('header h1').outerHeight() - 40;
    $('main').outerHeight(availableHeight);
    $('#map').outerHeight(availableHeight);
}


Handlebars.registerHelper('urlize', function (text) {
    var urlPattern = /(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([!\/\w\.-]*)*\/?/g;
    var toUrl = function (match) {
        return '<a href="' + match + '" target="_blank">' + match + '</a>';
    };
    result = text.replace(urlPattern, toUrl);
    return new Handlebars.SafeString(result);
});


$(document).ready(function () {
    $('#map').freespacemap({});
    addCurrentList();
    addHaveYouSeenList();
    useFullHeight();
});


$(window).smartresize(useFullHeight);
