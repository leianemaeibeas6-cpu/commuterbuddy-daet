/* =========================================================
   routes.js - Routes screen
   Web version of RouteActivity.java:
   TYPE the start and destination (or tap the map), and the
   route is detected and drawn automatically with the road
   distance, time, solo + group fare and a landmark hint.
   Recent searches, frequent routes dialog and "Use my
   location" (Geolocation) are included.
   ========================================================= */
(function (CB) {
    'use strict';

    var type = CB.ui.initPage('routes');
    if (!type) return;

    var discounted = CB.storage.prefs.isDiscounted(type);
    var params = CB.ui.getTripParams();

    var form = document.getElementById('route-form');
    var startInput = document.getElementById('start');
    var destInput = document.getElementById('dest');
    var tripCard = document.getElementById('trip-card');
    var geoStatus = document.getElementById('geo-status');
    var locateBtn = document.getElementById('btn-locate');
    var transportNote = document.getElementById('transport-note');
    var lastFocused = destInput;

    /* ---------- Setup ---------- */
    CB.ui.setTransport(form, params.transport);
    CB.ui.setNight(form, CB.fare.isNight());

    var startBox = CB.search.attach(startInput, { scope: 'user', onSelect: function () { update(); } });
    var destBox = CB.search.attach(destInput, { scope: 'daet', onSelect: function () { update(); } });
    CB.geo.warm();
    startInput.addEventListener('focus', function () { lastFocused = startInput; });
    destInput.addEventListener('focus', function () { lastFocused = destInput; });

    var map = CB.map.create(document.getElementById('map'), {
        onSetStart: function (index) {
            startBox.setPoint(CB.data.PLACES[index]);
        },
        onSetDest: function (index) {
            destBox.setPoint(CB.data.PLACES[index]);
        },
        // Tap anywhere on the map to pick a start / destination
        onMapClick: function (lat, lng) { pickFromMap(lat, lng); },
        // Google Maps key failed and the map switched to OpenStreetMap: refresh the trip note
        onProviderChange: function () {
            if (!tripCard.hidden) update();
        }
    });
    if (map) map.showAllPlaces();

    function pickFromMap(lat, lng) {
        // Fill the empty box first; if both are filled, use the box the user touched last
        var target = !startBox.getPoint() ? startBox : !destBox.getPoint() ? destBox :
            (lastFocused === startInput ? startBox : destBox);
        var scope = CB.search.scope(target === startBox ? 'user' : 'daet');
        if (!scope.contains({ lat: lat, lng: lng })) { CB.ui.toast(scope.message, 'error'); return; }
        var temp = { name: 'Pinned location', lat: lat, lng: lng, category: 'Pinned on map', hint: lat.toFixed(4) + ', ' + lng.toFixed(4) };
        target.setPoint(temp, true);
        CB.search.reverse(lat, lng).then(function (name) {
            temp.name = name;
            target.setPoint(temp);
        });
    }

    function selected() {
        return {
            start: startBox.getPoint(),
            dest: destBox.getPoint(),
            transport: CB.ui.getTransport(form),
            night: CB.ui.getNight(form),
            special: false      // set in update() once the transport is known
        };
    }

    /* ---------- Directions: the roads the trip passes (dadaanan) ---------- */
    var directionsEl = document.getElementById('trip-directions');

    function formatMeters(m) {
        if (!m) return '';
        return m < 1000 ? (Math.round(m / 10) * 10 || 10) + ' m' : (m / 1000).toFixed(1) + ' km';
    }

    function renderDirections(directions) {
        if (!directions || !directions.steps || !directions.steps.length) {
            directionsEl.hidden = true;
            return;
        }
        var count = directions.steps.length;
        document.getElementById('directions-count').textContent = count + ' step' + (count === 1 ? '' : 's');
        var via = document.getElementById('directions-via');
        via.hidden = !directions.via;
        via.innerHTML = directions.via ? 'Via <strong>' + CB.ui.escapeHtml(directions.via) + '</strong>' : '';
        document.getElementById('directions-list').innerHTML = directions.steps.map(function (step, i) {
            var last = i === count - 1;
            return '<li class="direction' + (i === 0 ? ' direction--start' : '') + (last ? ' direction--end' : '') + '">' +
                '<span class="direction__text">' + CB.ui.escapeHtml(step.text) + '</span>' +
                (step.meters ? '<span class="direction__dist">' + formatMeters(step.meters) + '</span>' : '') +
            '</li>';
        }).join('');
        directionsEl.hidden = false;
    }

    /* ---------- Transport rules: tricycle inside Daet, jeepney Daet <-> other town ---------- */
    function applyTransportRules(a, b) {
        var allowed = CB.data.transportOptions(a, b);
        var trike = document.getElementById('t-tricycle');
        var jeep = document.getElementById('t-jeepney');
        trike.disabled = !allowed.tricycle;
        jeep.disabled = !allowed.jeepney;
        if (!allowed.tricycle && !allowed.jeepney) {
            transportNote.textContent = allowed.reason;
            transportNote.hidden = false;
            return false;
        }
        if (CB.ui.getTransport(form) === CB.fare.TRICYCLE && !allowed.tricycle) CB.ui.setTransport(form, CB.fare.JEEPNEY);
        if (CB.ui.getTransport(form) === CB.fare.JEEPNEY && !allowed.jeepney) CB.ui.setTransport(form, CB.fare.TRICYCLE);
        transportNote.textContent = allowed.reason;
        transportNote.hidden = false;
        return true;
    }

    function resetTransportRules() {
        document.getElementById('t-tricycle').disabled = false;
        document.getElementById('t-jeepney').disabled = false;
        transportNote.hidden = true;
    }

    /* ---------- Trip card ---------- */
    function renderTrip(trip) {
        document.getElementById('trip-title').textContent = trip.start.name + ' → ' + trip.dest.name;
        document.getElementById('trip-distance').textContent = trip.approximate
            ? '≈ ' + CB.fare.formatKm(trip.km) + ' (straight line)'
            : CB.fare.formatKm(trip.km) + ' by road';
        document.getElementById('trip-time').textContent = '~' + trip.minutes + ' min by ' + trip.transport.toLowerCase();
        document.getElementById('trip-fare').innerHTML = CB.fare.peso(trip.fare) +
            (trip.special ? ' <span class="badge badge--accent">Special trip</span>' :
                discounted ? ' <span class="badge badge--success">Discounted</span>' : '') +
            ' <span class="badge badge--plain">' + (trip.night ? 'Night' : 'Day') + '</span>';
        document.getElementById('trip-group').innerHTML = trip.special
            ? '<strong>Whole tricycle:</strong> one price, not per passenger' +
              ' · <span>Day ' + CB.fare.peso(trip.dayFare) + ' / Night ' + CB.fare.peso(trip.nightFare) + '</span>'
            : '<strong>' + trip.persons + ' persons:</strong> ' + CB.fare.peso(trip.groupFare) + ' total (' +
              CB.fare.peso(trip.fare) + ' each)' +
              ' · <span>Day ' + CB.fare.peso(trip.dayFare) + ' / Night ' + CB.fare.peso(trip.nightFare) + ' each</span>';
        document.getElementById('trip-landmark').innerHTML = CB.ui.icon('places') +
            '<span>Near destination: ' + CB.ui.escapeHtml(trip.dest.hint || trip.dest.name) + '</span>';
        document.getElementById('link-fare').href = CB.ui.tripUrl('fares.html', trip.start, trip.dest, trip.transport);
        document.getElementById('link-rate').href = CB.ui.tripUrl('feedback.html', trip.start, trip.dest, trip.transport);
    }

    /* ---------- update(): runs automatically whenever From, To, transport or time changes ---------- */
    var lastKey = '';

    function update() {
        var s = selected();
        CB.ui.setFieldError(destInput, '');
        CB.ui.setFieldError(startInput, '');

        if (!s.start || !s.dest) {
            tripCard.hidden = true;
            resetTransportRules();
            lastKey = '';
            if (map && (s.start || s.dest)) map.showPoint(s.start || s.dest, s.start ? 'start' : 'dest');
            return;
        }
        if (s.start === s.dest || (s.start.lat === s.dest.lat && s.start.lng === s.dest.lng)) {
            CB.ui.setFieldError(destInput, 'Please choose two different places.');
            tripCard.hidden = true;
            return;
        }
        if (!applyTransportRules(s.start, s.dest)) {
            // No tricycle/jeepney fare for this trip, but the map and directions still work
            showDirectionsOnly(s);
            return;
        }
        fareLinksHidden(false);
        s.transport = CB.ui.getTransport(form);
        // A special trip only exists for tricycles
        document.getElementById('special').disabled = s.transport !== CB.fare.TRICYCLE;
        s.special = CB.ui.getSpecial(form);
        showRoute(s);
    }

    /* ---------- Directions only: places outside our fare area (no sakayan / fare) ---------- */
    function fareLinksHidden(hidden) {
        document.getElementById('link-fare').hidden = hidden;
        document.getElementById('link-rate').hidden = hidden;
    }

    function showDirectionsOnly(s) {
        var note = document.getElementById('trip-note');
        var km = CB.fare.straightKm(s.start, s.dest);
        document.getElementById('trip-title').textContent = s.start.name + ' → ' + s.dest.name;
        document.getElementById('trip-distance').textContent = '≈ ' + CB.fare.formatKm(km) + ' (straight line)';
        document.getElementById('trip-time').textContent = '—';
        document.getElementById('trip-fare').textContent = 'No fare estimate';
        document.getElementById('trip-group').textContent = 'No tricycle/jeepney fare is listed for this route, but you can still view the map and route.';
        document.getElementById('trip-landmark').innerHTML = CB.ui.icon('places') +
            '<span>Near destination: ' + CB.ui.escapeHtml(s.dest.hint || s.dest.name) + '</span>';
        fareLinksHidden(true);
        directionsEl.hidden = true;
        note.textContent = map ? 'Drawing the route…' : 'Map unavailable.';
        tripCard.hidden = false;
        history.replaceState(null, '', CB.ui.tripUrl('routes.html', s.start, s.dest, s.transport));

        var key = ['d', s.start.lat, s.start.lng, s.dest.lat, s.dest.lng].join('|');
        if (key === lastKey || !map) return;
        lastKey = key;
        CB.storage.recent.addTrip(s.start, s.dest, s.transport);
        renderRecent();
        map.showRoute(s.start, s.dest).then(function (result) {
            if (lastKey !== key || result === 'cancelled') return;
            if (result === 'road') {
                var rk = map.getDistanceKm();
                if (rk > 0) document.getElementById('trip-distance').textContent = CB.fare.formatKm(rk) + ' by road';
                renderDirections(map.getDirections());
                note.textContent = 'The blue line follows the real roads (' + map.getProvider() + ' routing). Fare is not available for this trip.';
            } else {
                note.textContent = 'Road routing is unavailable right now, so only a straight-line guide is shown.';
            }
        });
    }

    /* ---------- Show route (showRoute() in Android) ---------- */
    function showRoute(s) {
        var opts = { night: s.night, special: s.special };
        var trip = CB.roads.estimateNow(s.start, s.dest, s.transport, discounted, opts);
        if (!trip) return;

        renderTrip(trip);
        var note = document.getElementById('trip-note');
        directionsEl.hidden = true;
        note.textContent = map ? 'Drawing the route…' : 'Map unavailable. Trip details are still accurate.';
        tripCard.hidden = false;

        // Keep the URL in sync so the trip can be bookmarked or shared
        history.replaceState(null, '', CB.ui.tripUrl('routes.html', s.start, s.dest, s.transport));
        var key = [s.start.lat, s.start.lng, s.dest.lat, s.dest.lng, s.transport].join('|');   // fare options don't change the map route
        if (key !== lastKey) {
            lastKey = key;
            CB.storage.recent.addTrip(s.start, s.dest, s.transport);
            renderRecent();
        }

        if (map) {
            map.showRoute(s.start, s.dest).then(function (result) {
                if (result === 'road') {
                    var km = map.getDistanceKm();
                    if (km > 0) {
                        CB.roads.remember(s.start, s.dest, km);
                        var exact = CB.fare.estimateTrip(s.start, s.dest, s.transport, discounted, { km: km, night: s.night, special: s.special });
                        if (exact) renderTrip(exact);
                    }
                    renderDirections(map.getDirections());
                    note.textContent = 'The blue line follows the real roads (' + map.getProvider() +
                        ' routing). Distance and fare use this road distance.';
                } else if (result === 'straight') {
                    // No road route: try the saved/online road distance, else keep the straight-line guide
                    CB.roads.distanceKm(s.start, s.dest).then(function (km) {
                        if (km) {
                            var exact = CB.fare.estimateTrip(s.start, s.dest, s.transport, discounted, { km: km, night: s.night, special: s.special });
                            if (exact) renderTrip(exact);
                            note.textContent = 'Showing a straight-line guide on the map, but the distance and fare use the road distance.';
                        } else {
                            note.textContent = 'Road routing is unavailable right now, so the distance is a straight-line guide (approximate).';
                        }
                    });
                } else if (result === 'none') {
                    note.textContent = 'Map unavailable. Trip details are still accurate.';
                }
            });
        }
    }

    /* ---------- Recent searches ---------- */
    var recentCard = document.getElementById('recent-card');
    var recentList = document.getElementById('recent-list');

    function renderRecent() {
        var trips = CB.storage.recent.trips();
        recentCard.hidden = !trips.length;
        recentList.innerHTML = trips.map(function (t, i) {
            return '<li><button type="button" class="route-item" data-recent="' + i + '">' +
                '<span class="route-item__places">' +
                    '<span class="route-item__from">' + CB.ui.escapeHtml(t.start.name) + '</span>' +
                    '<span class="route-item__to">' + CB.ui.escapeHtml(t.dest.name) + '</span>' +
                '</span>' +
                '<span class="route-item__meta"><small>' + CB.ui.escapeHtml(t.transport) + ' · ' + CB.ui.formatDate(t.timestamp) + '</small></span>' +
            '</button></li>';
        }).join('');
    }

    recentList.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-recent]');
        if (!btn) return;
        var t = CB.storage.recent.trips()[parseInt(btn.getAttribute('data-recent'), 10)];
        if (!t) return;
        startBox.setPoint(t.start, true);
        destBox.setPoint(t.dest, true);
        CB.ui.setTransport(form, t.transport);
        update();
    });

    document.getElementById('btn-clear-recent').addEventListener('click', function () {
        CB.storage.recent.clear();
        renderRecent();
    });

    /* ---------- Geolocation: start from where the user is ---------- */
    function setGeoStatus(message, variant) {
        geoStatus.hidden = !message;
        geoStatus.textContent = message || '';
        geoStatus.className = 'geo-status' + (variant ? ' geo-status--' + variant : '');
    }

    if (!CB.geo.isSupported()) locateBtn.hidden = true;

    locateBtn.addEventListener('click', function () {
        locateBtn.disabled = true;
        locateBtn.querySelector('span').textContent = 'Locating…';
        setGeoStatus('Finding your location…');

        CB.geo.locate().then(function (pos) {
            var nearest = CB.geo.nearestPlace(pos.lat, pos.lng);
            if (map) map.showUser(pos.lat, pos.lng, pos.accuracy, !nearest.farFromDaet);

            if (nearest.farFromDaet) {
                setGeoStatus('You seem to be about ' + Math.round(nearest.km) + ' km from Daet, so your start point was not changed.', 'warn');
                return;
            }
            var here = { name: 'My location', lat: pos.lat, lng: pos.lng, category: 'Your location',
                hint: 'Near ' + nearest.place.name };
            startBox.setPoint(here);
            setGeoStatus('Start set to your current location (near ' + nearest.place.name + ').', 'success');
        }).catch(function (err) {
            setGeoStatus(err.message, 'error');
        }).finally(function () {
            locateBtn.disabled = false;
            locateBtn.querySelector('span').textContent = 'Use my location';
        });
    });

    /* ---------- Frequent routes dialog (showFrequentRoutes() in Android) ---------- */
    var dialog = document.getElementById('frequent-dialog');
    var search = document.getElementById('frequent-search');
    var list = document.getElementById('frequent-list');
    var empty = document.getElementById('frequent-empty');

    function renderFrequent() {
        var q = search.value.trim().toLowerCase();
        var html = '';

        CB.data.ROUTES.forEach(function (r) {
            var label = CB.data.routeLabel(r[0], r[1]);
            if (q && label.toLowerCase().indexOf(q) === -1) return;
            // Frequent routes are inside Daet, so they are tricycle trips
            var trip = CB.roads.estimateNow(r[0], r[1], CB.fare.TRICYCLE, discounted, { night: CB.ui.getNight(form) });
            if (!trip) return;
            html += '<li><button type="button" class="route-item" data-start="' + r[0] + '" data-dest="' + r[1] + '">' +
                '<span class="route-item__places">' +
                    '<span class="route-item__from">' + CB.ui.escapeHtml(trip.start.name) + '</span>' +
                    '<span class="route-item__to">' + CB.ui.escapeHtml(trip.dest.name) + '</span>' +
                '</span>' +
                '<span class="route-item__meta"><strong>' + CB.fare.peso(trip.fare) + '</strong>' +
                '<small>' + CB.fare.formatKm(trip.km) + '</small></span>' +
            '</button></li>';
        });
        list.innerHTML = html;
        empty.hidden = html !== '';
    }

    function openDialog() {
        search.value = '';
        renderFrequent();
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        search.focus();
    }

    function closeDialog() {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    document.getElementById('btn-frequent').addEventListener('click', openDialog);
    document.getElementById('frequent-close').addEventListener('click', closeDialog);
    search.addEventListener('input', renderFrequent);

    // Close when clicking the dark backdrop
    dialog.addEventListener('click', function (event) {
        if (event.target === dialog) closeDialog();
    });

    list.addEventListener('click', function (event) {
        var item = event.target.closest('[data-start]');
        if (!item) return;
        startBox.setPoint(CB.data.PLACES[parseInt(item.getAttribute('data-start'), 10)], true);
        destBox.setPoint(CB.data.PLACES[parseInt(item.getAttribute('data-dest'), 10)], true);
        CB.ui.setTransport(form, CB.fare.TRICYCLE);
        closeDialog();
        update();
    });

    /* ---------- Other events ---------- */
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        // Anything typed that was not picked from the list is looked up on the map
        Promise.all([startBox.resolve(), destBox.resolve()]).then(function () {
            var s = selected();
            if (!s.start) { CB.ui.setFieldError(startInput, startInput.value.trim() ? 'This location cannot be found. ' + CB.search.scope('user').message : 'Enter a starting location.'); startInput.focus(); return; }
            if (!s.dest) { CB.ui.setFieldError(destInput, destInput.value.trim() ? 'his location cannot be found. Only destinations within Daet are allowed.' : 'Enter a destination.'); destInput.focus(); return; }
            update();
        });
    });

    document.getElementById('btn-swap').addEventListener('click', function () {
        var a = startBox.getPoint();
        var b = destBox.getPoint();
        startBox.setPoint(b, true);
        destBox.setPoint(a, true);
        update();
    });

    // Changing transport or day/night updates an open trip automatically
    form.addEventListener('change', function (event) {
        if (event.target.name === 'transport' || event.target.name === 'daynight' || event.target.name === 'special') update();
    });

    // Opened from another page with a trip (like Intent extras) -> show it right away
    if (params.hasTrip) {
        startBox.setPoint(CB.ui.toPoint(params.start), true);
        destBox.setPoint(CB.ui.toPoint(params.dest), true);
        update();
    }
    renderRecent();
})(window.CB);
