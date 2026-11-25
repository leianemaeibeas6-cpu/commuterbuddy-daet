/* =========================================================
   map.js - Interactive map with real-road routes

   Two map providers, chosen automatically:

   1. GOOGLE MAPS (when a key is set in js/config.js)
      - Maps JavaScript API for the map
      - Routes API (Route.computeRoutes) for the road-following
        route line. This replaces the old DirectionsService,
        which Google retired in 2026.

   2. OPENSTREETMAP (no key needed, also the automatic backup)
      - Leaflet for the map
      - OSRM for the road-following route line

   If Google Maps fails to load, the key is rejected, or the
   daily limit is reached, the map switches to OpenStreetMap
   without breaking the page. If road routing fails (offline,
   slow), a straight dashed line is shown instead, like the
   Android version.

   Public API (used by js/pages/routes.js):
     var map = CB.map.create(element, { onSetStart, onSetDest });
     map.showAllPlaces();
     map.showRoute(startIndex, destIndex)  -> Promise<'road'|'straight'|'none'|'cancelled'>
     map.getDirections()                   -> { via, steps: [{ text, meters }] } or null
                                              (the roads the trip passes, from the last road route)
     map.showUser(lat, lng, accuracy, focus);
     map.getProvider()                     -> 'Google Maps' | 'OpenStreetMap' | ''
   ========================================================= */
(function (CB) {
    'use strict';

    var ROUTE_COLOR = '#1565C0';
    var ROUTE_TIMEOUT_MS = 8000;
    var GOOGLE_LOAD_TIMEOUT_MS = 12000;

    /* =====================================================
       Shared helpers
       ===================================================== */

    function popupHtml(place, index, label, withActions) {
        var html = '<div class="map-popup">' +
            (label ? '<span class="map-popup__label">' + label + '</span>' : '') +
            '<strong>' + CB.ui.escapeHtml(place.name) + '</strong>' +
            '<small>' + CB.ui.escapeHtml(place.category || 'Place') + (place.hint ? ' · ' + CB.ui.escapeHtml(place.hint) : '') + '</small>';
        if (withActions && index >= 0) {
            html += '<div class="map-popup__actions">' +
                '<button type="button" data-popup-action="start" data-index="' + index + '">Set as start</button>' +
                '<button type="button" data-popup-action="dest" data-index="' + index + '">Set as destination</button>' +
                '</div>';
        }
        return html + '</div>';
    }

    /** Wires the "Set as start / destination" buttons inside a popup element. */
    function bindPopupActions(node, options, onDone) {
        if (!node) return;
        node.querySelectorAll('[data-popup-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var index = parseInt(btn.getAttribute('data-index'), 10);
                var action = btn.getAttribute('data-popup-action');
                if (onDone) onDone();
                if (action === 'start' && options.onSetStart) options.onSetStart(index);
                if (action === 'dest' && options.onSetDest) options.onSetDest(index);
            });
        });
    }

    function showUnavailable(el, message) {
        el.classList.add('map--unavailable');
        el.innerHTML =
            '<div class="map-fallback">' + CB.ui.icon('routes') +
            '<strong>Map unavailable</strong><p>' + message + '</p></div>';
    }

    /** Rejects if `promise` takes longer than `ms`. */
    function withTimeout(promise, ms) {
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () { reject(new Error('timeout')); }, ms);
            promise.then(function (v) { clearTimeout(timer); resolve(v); },
                function (e) { clearTimeout(timer); reject(e); });
        });
    }

    /* =====================================================
       Directions ("dadaanan"): the roads the trip passes
       ===================================================== */

    var COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

    function compass(bearing) {
        if (typeof bearing !== 'number') return '';
        return COMPASS[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
    }

    function turnWord(modifier) {
        switch (modifier) {
            case 'left': return 'Turn left';
            case 'right': return 'Turn right';
            case 'slight left': return 'Keep slightly left';
            case 'slight right': return 'Keep slightly right';
            case 'sharp left': return 'Turn sharply left';
            case 'sharp right': return 'Turn sharply right';
            case 'uturn': return 'Make a U-turn';
            default: return 'Continue straight';
        }
    }

    /** Turns one OSRM step into a short English instruction. */
    function osrmStepText(step, startName, destName) {
        var m = step.maneuver || {};
        var road = step.name || step.ref || '';
        var onto = road ? ' onto ' + road : '';
        switch (m.type) {
            case 'depart':
                return 'Start at ' + startName + ' and head ' + (compass(m.bearing_after) || 'out') +
                    (road ? ' on ' + road : '');
            case 'arrive':
                return 'Arrive at ' + destName;
            case 'new name':
                return 'Continue' + (road ? ' onto ' + road : '');
            case 'continue':
                return (!m.modifier || m.modifier === 'straight') ? 'Continue' + (road ? ' on ' + road : '') : turnWord(m.modifier) + onto;
            case 'merge':
                return 'Merge' + onto;
            case 'roundabout':
            case 'rotary':
            case 'roundabout turn':
                return 'At the roundabout, take ' + (m.exit ? 'exit ' + m.exit : 'the exit') + onto;
            case 'exit roundabout':
            case 'exit rotary':
                return 'Exit the roundabout' + onto;
            default: // turn, end of road, fork, on/off ramp, notification
                return turnWord(m.modifier) + onto;
        }
    }

    /** Picks the 1-2 longest named roads, in travel order, for a "Via ..." summary. */
    function viaSummary(named) {
        var totals = {};
        var order = [];
        named.forEach(function (item) {
            if (!item.name) return;
            if (!(item.name in totals)) { totals[item.name] = 0; order.push(item.name); }
            totals[item.name] += item.meters;
        });
        var top = order.slice().sort(function (a, b) { return totals[b] - totals[a]; }).slice(0, 2);
        var main = order.filter(function (name) { return top.indexOf(name) !== -1; });
        return main.join(' and ');
    }

    /** Directions from an OSRM route object. */
    function osrmDirections(route, startName, destName) {
        var steps = [];
        var named = [];
        (route.legs || []).forEach(function (leg) {
            (leg.steps || []).forEach(function (step) {
                var type = step.maneuver && step.maneuver.type;
                if (type !== 'depart' && type !== 'arrive' && step.distance < 1) return; // skip zero-length steps
                steps.push({ text: osrmStepText(step, startName, destName), meters: type === 'arrive' ? 0 : step.distance });
                named.push({ name: step.name || '', meters: step.distance || 0 });
            });
        });
        return steps.length ? { via: viaSummary(named), steps: steps } : null;
    }

    /** Directions from a Google Routes API route (fields: legs, description). */
    function googleDirections(route, destName) {
        var steps = [];
        (route.legs || []).forEach(function (leg) {
            (leg.steps || []).forEach(function (step) {
                var nav = step.navigationInstruction || {};
                var text = step.instructions || nav.instructions || '';
                if (text) steps.push({ text: String(text).replace(/\s+/g, ' ').trim(), meters: step.distanceMeters || 0 });
            });
        });
        if (!steps.length) return null;
        steps.push({ text: 'Arrive at ' + destName, meters: 0 });
        return { via: route.description || '', steps: steps };
    }

    /* =====================================================
       Provider 1: OpenStreetMap (Leaflet + OSRM)
       ===================================================== */

    var TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    var TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
    var OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';

    /** Road route from OSRM. Resolves with { coords: [[lat,lng],...], directions }. */
    function fetchOsrmRoute(a, b) {
        if (!navigator.onLine || !window.fetch) return Promise.reject(new Error('offline'));
        var controller = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (controller) controller.abort(); }, ROUTE_TIMEOUT_MS);
        var url = OSRM_URL + a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=full&geometries=geojson&steps=true';

        return fetch(url, controller ? { signal: controller.signal } : undefined)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                var route = data && data.routes && data.routes[0];
                if (!route || !route.geometry || !route.geometry.coordinates.length) throw new Error('No route');
                return {
                    coords: route.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }),
                    meters: route.distance || 0,
                    directions: osrmDirections(route, a.name, b.name)
                };
            })
            .finally(function () { clearTimeout(timer); });
    }

    /** Returns an engine object, or null if Leaflet is not available. */
    function createLeafletEngine(el, options) {
        if (typeof window.L === 'undefined') {
            showUnavailable(el, 'The map needs an internet connection the first time it loads. Fares and route details still work.');
            return null;
        }

        function pin(type) {
            return L.divIcon({
                className: 'map-pin map-pin--' + type,
                html: '<span></span>',
                iconSize: [28, 28],
                iconAnchor: [14, 28],
                popupAnchor: [0, -26]
            });
        }

        var center = CB.data.CENTER;
        var map = L.map(el, { scrollWheelZoom: false }).setView([center.lat, center.lng], 14);
        map.on('click', function (e) {
            map.scrollWheelZoom.enable();
            if (options.onMapClick && e.latlng) options.onMapClick(e.latlng.lat, e.latlng.lng);
        });
        map.on('mouseout', function () { map.scrollWheelZoom.disable(); });

        var tileErrors = 0;
        L.tileLayer(TILE_URL, { subdomains: 'abcd', maxZoom: 19, attribution: TILE_ATTRIBUTION })
            .on('tileerror', function () {
                tileErrors++;
                if (tileErrors === 4) CB.ui.toast('Some map tiles could not load. Check your connection.', 'error');
            })
            .addTo(map);

        var placesLayer = L.layerGroup().addTo(map);
        var routeLayer = L.layerGroup().addTo(map);
        var userLayer = L.layerGroup().addTo(map);
        var routeRequest = 0;
        var withActions = !!(options.onSetStart || options.onSetDest);

        map.on('popupopen', function (e) {
            bindPopupActions(e.popup.getElement(), options, function () { map.closePopup(); });
        });

        var api = {
            provider: 'OpenStreetMap',
            directions: null,
            distanceKm: 0,

            showPoint: function (point, kind) {
                routeRequest++;
                placesLayer.clearLayers();
                routeLayer.clearLayers();
                L.marker([point.lat, point.lng], { icon: pin(kind), title: point.name })
                    .bindPopup(popupHtml(point, -1, kind === 'start' ? 'Start' : 'Destination')).addTo(routeLayer);
                map.setView([point.lat, point.lng], 16);
            },

            showAllPlaces: function () {
                routeRequest++;
                routeLayer.clearLayers();
                placesLayer.clearLayers();
                CB.data.PLACES.forEach(function (p, i) {
                    L.marker([p.lat, p.lng], { icon: pin('place'), title: p.name })
                        .bindPopup(popupHtml(p, i, '', withActions))
                        .addTo(placesLayer);
                });
                map.setView([center.lat, center.lng], 14);
            },

            showRoute: function (startRef, destRef) {
                var a = CB.data.resolvePoint(startRef);
                var b = CB.data.resolvePoint(destRef);
                var requestId = ++routeRequest;
                api.directions = null;
                api.distanceKm = 0;

                placesLayer.clearLayers();
                routeLayer.clearLayers();
                L.marker([a.lat, a.lng], { icon: pin('start'), title: 'Start: ' + a.name })
                    .bindPopup(popupHtml(a, -1, 'Start')).addTo(routeLayer);
                L.marker([b.lat, b.lng], { icon: pin('dest'), title: 'Destination: ' + b.name })
                    .bindPopup(popupHtml(b, -1, 'Destination')).addTo(routeLayer);

                var straight = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
                    color: ROUTE_COLOR, weight: 4, opacity: 0.8, dashArray: '8 10'
                }).addTo(routeLayer);
                map.fitBounds(L.latLngBounds([[a.lat, a.lng], [b.lat, b.lng]]), { padding: [60, 60], maxZoom: 16 });

                return fetchOsrmRoute(a, b).then(function (result) {
                    if (requestId !== routeRequest) return 'cancelled';
                    api.directions = result.directions;
                    api.distanceKm = result.meters / 1000;
                    routeLayer.removeLayer(straight);
                    var road = L.polyline(result.coords, { color: ROUTE_COLOR, weight: 6, opacity: 0.9 }).addTo(routeLayer);
                    map.fitBounds(road.getBounds(), { padding: [50, 50], maxZoom: 16 });
                    return 'road';
                }).catch(function () {
                    return requestId === routeRequest ? 'straight' : 'cancelled';
                });
            },

            showUser: function (lat, lng, accuracy, focus) {
                userLayer.clearLayers();
                if (accuracy && accuracy < 3000) {
                    L.circle([lat, lng], {
                        radius: accuracy, color: ROUTE_COLOR, weight: 1, fillColor: ROUTE_COLOR, fillOpacity: 0.08
                    }).addTo(userLayer);
                }
                L.marker([lat, lng], { icon: pin('user'), title: 'You are here', zIndexOffset: 1000 })
                    .bindPopup('<div class="map-popup"><strong>You are here</strong><small>Approximate location</small></div>')
                    .addTo(userLayer);
                if (focus) map.setView([lat, lng], 15);
            }
        };
        return api;
    }

    /* =====================================================
       Provider 2: Google Maps (Maps JavaScript API + Routes API)
       ===================================================== */

    var googlePromise = null;
    var googleAuthFailed = false;
    var authFailureHandlers = [];

    // Google calls this global function when the API key is invalid,
    // not allowed for this website, or over its limit.
    window.gm_authFailure = function () {
        googleAuthFailed = true;
        authFailureHandlers.forEach(function (fn) { fn(); });
    };

    /** Loads the Maps JavaScript API once. Resolves when google.maps.importLibrary is ready. */
    function loadGoogleMaps(apiKey) {
        if (googlePromise) return googlePromise;
        googlePromise = withTimeout(new Promise(function (resolve, reject) {
            if (!navigator.onLine) {
                reject(new Error('offline'));
                return;
            }
            window.__cbGoogleMapsReady = function () { resolve(); };
            var script = document.createElement('script');
            script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) +
                '&v=weekly&loading=async&language=en&region=PH&callback=__cbGoogleMapsReady';
            script.async = true;
            script.onerror = function () { reject(new Error('Google Maps could not load')); };
            document.head.appendChild(script);
        }), GOOGLE_LOAD_TIMEOUT_MS);
        return googlePromise;
    }

    function getLatLng(point) {
        return {
            lat: typeof point.lat === 'function' ? point.lat() : point.lat,
            lng: typeof point.lng === 'function' ? point.lng() : point.lng
        };
    }

    /** Builds the Google Maps engine. Resolves with an engine object. */
    function createGoogleEngine(el, options) {
        var gm = window.google.maps;
        return Promise.all([
            gm.importLibrary('maps'),
            gm.importLibrary('marker'),
            gm.importLibrary('routes'),
            gm.importLibrary('core')
        ]).then(function (libs) {
            var Map = libs[0].Map;
            var InfoWindow = libs[0].InfoWindow;
            var Polyline = libs[0].Polyline;
            var Circle = libs[0].Circle;
            var AdvancedMarkerElement = libs[1].AdvancedMarkerElement;
            var Route = libs[2].Route;
            var LatLngBounds = libs[3].LatLngBounds;

            var center = CB.data.CENTER;
            el.classList.add('map--google');
            var map = new Map(el, {
                center: center,
                zoom: 14,
                mapId: CB.config.GOOGLE_MAP_ID || 'DEMO_MAP_ID',
                gestureHandling: 'cooperative',
                mapTypeControl: false,
                streetViewControl: false,
                clickableIcons: false
            });

            map.addListener('click', function (e) {
                if (options.onMapClick && e.latLng) options.onMapClick(e.latLng.lat(), e.latLng.lng());
            });

            var infoWindow = new InfoWindow();
            var placeMarkers = [];
            var routeItems = [];      // markers + polylines of the current route
            var userItems = [];
            var routeRequest = 0;
            var withActions = !!(options.onSetStart || options.onSetDest);

            function pinElement(type) {
                var node = document.createElement('div');
                node.className = 'map-pin map-pin--' + type + ' map-pin--google';
                node.innerHTML = '<span></span>';
                return node;
            }

            function addMarker(list, position, type, title, popupContent) {
                var marker = new AdvancedMarkerElement({
                    map: map,
                    position: position,
                    title: title,
                    content: pinElement(type),
                    gmpClickable: true,
                    zIndex: type === 'user' ? 1000 : null
                });
                if (popupContent) {
                    marker.addEventListener('gmp-click', function () {
                        var node = document.createElement('div');
                        node.innerHTML = popupContent;
                        bindPopupActions(node, options, function () { infoWindow.close(); });
                        infoWindow.setContent(node);
                        infoWindow.open({ anchor: marker, map: map });
                    });
                }
                list.push(marker);
                return marker;
            }

            function clear(list) {
                list.forEach(function (item) {
                    if (typeof item.setMap === 'function') item.setMap(null);
                    else item.map = null;
                });
                list.length = 0;
            }

            function fitTo(points) {
                var bounds = new LatLngBounds();
                points.forEach(function (p) { bounds.extend(getLatLng(p)); });
                map.fitBounds(bounds, 60);
            }

            var api = {
                provider: 'Google Maps',
                directions: null,
                distanceKm: 0,

                showPoint: function (point, kind) {
                    routeRequest++;
                    infoWindow.close();
                    clear(placeMarkers);
                    clear(routeItems);
                    addMarker(routeItems, { lat: point.lat, lng: point.lng }, kind, point.name,
                        popupHtml(point, -1, kind === 'start' ? 'Start' : 'Destination'));
                    map.setCenter({ lat: point.lat, lng: point.lng });
                    map.setZoom(16);
                },

                showAllPlaces: function () {
                    routeRequest++;
                    infoWindow.close();
                    clear(routeItems);
                    clear(placeMarkers);
                    CB.data.PLACES.forEach(function (p, i) {
                        addMarker(placeMarkers, { lat: p.lat, lng: p.lng }, 'place', p.name,
                            popupHtml(p, i, '', withActions));
                    });
                    map.setCenter(center);
                    map.setZoom(14);
                },

                showRoute: function (startRef, destRef) {
                    var a = CB.data.resolvePoint(startRef);
                    var b = CB.data.resolvePoint(destRef);
                    var origin = { lat: a.lat, lng: a.lng };
                    var destination = { lat: b.lat, lng: b.lng };
                    var requestId = ++routeRequest;
                    api.directions = null;
                    api.distanceKm = 0;

                    infoWindow.close();
                    clear(placeMarkers);
                    clear(routeItems);
                    addMarker(routeItems, origin, 'start', 'Start: ' + a.name, popupHtml(a, -1, 'Start'));
                    addMarker(routeItems, destination, 'dest', 'Destination: ' + b.name, popupHtml(b, -1, 'Destination'));

                    // Dashed straight line while the road route loads (and as a fallback)
                    var straight = new Polyline({
                        map: map,
                        path: [origin, destination],
                        strokeOpacity: 0,
                        icons: [{
                            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeColor: ROUTE_COLOR, scale: 3 },
                            offset: '0',
                            repeat: '14px'
                        }]
                    });
                    routeItems.push(straight);
                    fitTo([origin, destination]);

                    if (!navigator.onLine) return Promise.resolve('straight');

                    // Routes API: road-following route (replaces the retired DirectionsService)
                    return withTimeout(Route.computeRoutes({
                        origin: origin,
                        destination: destination,
                        travelMode: 'DRIVING',
                        fields: ['path', 'legs', 'description', 'distanceMeters']
                    }), ROUTE_TIMEOUT_MS).then(function (response) {
                        if (requestId !== routeRequest) return 'cancelled';
                        var route = response && response.routes && response.routes[0];
                        if (!route) throw new Error('No route');
                        try { api.directions = googleDirections(route, b.name); } catch (e) { api.directions = null; }
                        api.distanceKm = (route.distanceMeters || 0) / 1000;

                        straight.setMap(null);
                        route.createPolylines().forEach(function (line) {
                            line.setOptions({ strokeColor: ROUTE_COLOR, strokeWeight: 6, strokeOpacity: 0.9 });
                            line.setMap(map);
                            routeItems.push(line);
                        });
                        if (route.path && route.path.length) fitTo(route.path);
                        return 'road';
                    }).catch(function () {
                        return requestId === routeRequest ? 'straight' : 'cancelled';
                    });
                },

                showUser: function (lat, lng, accuracy, focus) {
                    clear(userItems);
                    var position = { lat: lat, lng: lng };
                    if (accuracy && accuracy < 3000) {
                        userItems.push(new Circle({
                            map: map, center: position, radius: accuracy,
                            strokeColor: ROUTE_COLOR, strokeWeight: 1, fillColor: ROUTE_COLOR, fillOpacity: 0.08
                        }));
                    }
                    addMarker(userItems, position, 'user', 'You are here',
                        '<div class="map-popup"><strong>You are here</strong><small>Approximate location</small></div>');
                    if (focus) {
                        map.setCenter(position);
                        map.setZoom(15);
                    }
                }
            };
            return api;
        });
    }

    /* =====================================================
       Public: create a map (chooses the provider)
       ===================================================== */

    function create(el, options) {
        options = options || {};
        if (!el) return null;

        var apiKey = (CB.config && CB.config.GOOGLE_MAPS_API_KEY || '').trim();

        // No Google key: use OpenStreetMap directly
        if (!apiKey) {
            var leaflet = createLeafletEngine(el, options);
            return leaflet ? wrap(Promise.resolve(leaflet)) : null;
        }

        // Google key: try Google Maps, fall back to OpenStreetMap on any problem
        var container = el;
        var lastView = { type: 'all' };

        function freshContainer() {
            var next = document.createElement('div');
            next.className = 'map';
            next.id = container.id;
            container.replaceWith(next);
            container = next;
            return next;
        }

        function useOpenStreetMap(reason) {
            if (reason) CB.ui.toast(reason + ' Showing the OpenStreetMap version instead.', 'error', 5000);
            return createLeafletEngine(freshContainer(), options);
        }

        var enginePromise = loadGoogleMaps(apiKey)
            .then(function () {
                if (googleAuthFailed) throw new Error('auth');
                return createGoogleEngine(container, options);
            })
            .catch(function () {
                return useOpenStreetMap(navigator.onLine ? 'Google Maps could not load.' : '');
            });

        var facade = wrap(enginePromise, function (view) { lastView = view; });

        // Key rejected after the map appeared: swap to OpenStreetMap and redraw the same view
        authFailureHandlers.push(function () {
            enginePromise.then(function (engine) {
                if (!engine || engine.provider !== 'Google Maps') return;
                var fallback = useOpenStreetMap('Google Maps did not accept the API key (or its daily limit was reached).');
                facade._swap(Promise.resolve(fallback), lastView);
                if (options.onProviderChange) options.onProviderChange();
            });
        });

        return facade;
    }

    /**
     * Wraps an engine promise so pages can call map methods right away;
     * calls wait until the map is ready.
     */
    function wrap(enginePromise, onView) {
        var current = enginePromise;
        var engineNow = null;
        current.then(function (e) { engineNow = e; });

        function remember(view) { if (onView) onView(view); }

        var facade = {
            showAllPlaces: function () {
                remember({ type: 'all' });
                current.then(function (e) { if (e) e.showAllPlaces(); });
            },
            showRoute: function (s, d) {
                remember({ type: 'route', start: s, dest: d });
                return current.then(function (e) { return e ? e.showRoute(s, d) : 'none'; });
            },
            showPoint: function (point, kind) {
                remember({ type: 'point', point: point, kind: kind });
                current.then(function (e) { if (e) e.showPoint(point, kind); });
            },
            getDistanceKm: function () {
                return engineNow ? engineNow.distanceKm : 0;
            },
            showUser: function (lat, lng, accuracy, focus) {
                current.then(function (e) { if (e) e.showUser(lat, lng, accuracy, focus); });
            },
            getProvider: function () {
                return engineNow ? engineNow.provider : '';
            },
            getDirections: function () {
                return engineNow ? engineNow.directions : null;
            },
            _swap: function (nextPromise, view) {
                current = nextPromise;
                engineNow = null;
                current.then(function (e) {
                    engineNow = e;
                    if (!e) return;
                    if (view && view.type === 'route') e.showRoute(view.start, view.dest);
                    else if (view && view.type === 'point') e.showPoint(view.point, view.kind);
                    else e.showAllPlaces();
                });
            }
        };
        return facade;
    }

    /** Resolves with google.maps once the Maps API is loaded and accepted, otherwise with null. */
    function whenGoogle() {
        var apiKey = (CB.config && CB.config.GOOGLE_MAPS_API_KEY || '').trim();
        if (!apiKey) return Promise.resolve(null);
        return loadGoogleMaps(apiKey).then(function () {
            return googleAuthFailed ? null : window.google.maps;
        }).catch(function () { return null; });
    }

    CB.map = { create: create, whenGoogle: whenGoogle };
})(window.CB = window.CB || {});
