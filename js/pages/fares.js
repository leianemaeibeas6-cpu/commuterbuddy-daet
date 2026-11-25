/* =========================================================
   fares.js - Fares screen
   Web version of FareActivity.java: live fare calculator,
   discount toggle, and a table of common routes.
   ========================================================= */
(function (CB) {
    'use strict';

    var type = CB.ui.initPage('fares');
    if (!type) return;

    var params = CB.ui.getTripParams();
    var form = document.getElementById('fare-form');
    var startInput = document.getElementById('start');
    var destInput = document.getElementById('dest');
    var discountBox = document.getElementById('discount');
    var transportNote = document.getElementById('transport-note');
    var specialBox = document.getElementById('special');

    CB.geo && CB.geo.warm && CB.geo.warm();
    var startBox = CB.search.attach(startInput, { scope: 'user', onSelect: function () { recalc(); } });
    var destBox = CB.search.attach(destInput, { scope: 'daet', onSelect: function () { recalc(); } });
    startBox.setPoint(CB.ui.toPoint(params.start), true);
    destBox.setPoint(CB.ui.toPoint(params.dest), true);
    CB.ui.setTransport(form, params.transport);
    CB.ui.setNight(form, CB.fare.isNight());
    discountBox.checked = CB.storage.prefs.isDiscounted(type);

    function setCompare(id, amount, active) {
        var el = document.getElementById(id);
        el.querySelector('strong').textContent = amount;
        el.classList.toggle('is-active', active);
    }

    function showEmpty(message) {
        document.getElementById('fare-value').textContent = '—';
        document.getElementById('fare-meta').textContent = message;
        document.getElementById('fare-group').textContent = '';
        setCompare('compare-regular', '—', false);
        setCompare('compare-discount', '—', false);
    }

    var requestId = 0;

    /* ---------- recalc() in Android ---------- */
    function recalc() {
        var a = startBox.getPoint();
        var b = destBox.getPoint();
        var discounted = discountBox.checked;
        var night = CB.ui.getNight(form);
        var special = false;

        CB.ui.setFieldError(destInput, '');
        transportNote.hidden = true;
        document.getElementById('btn-swap').disabled = false;

        if (!a || !b) {
            showEmpty('Mag-type o pumili ng From at To');
            refreshTable(CB.fare.TRICYCLE, discounted, night, false, null, null);
            return;
        }
        if (a === b || (a.lat === b.lat && a.lng === b.lng)) {
            CB.ui.setFieldError(destInput, 'Choose two different places.');
            showEmpty('Choose two different places');
            return;
        }

        // Tricycle inside Daet, jeepney only Daet <-> another town
        var allowed = CB.data.transportOptions(a, b);
        document.getElementById('t-tricycle').disabled = !allowed.tricycle;
        document.getElementById('t-jeepney').disabled = !allowed.jeepney;
        transportNote.textContent = allowed.reason;
        transportNote.hidden = false;
        if (!allowed.tricycle && !allowed.jeepney) {
            showEmpty('Walang fare para sa biyahe na ito. Makikita pa rin ang mapa at dadaanan.');
            document.getElementById('link-map').href = CB.ui.tripUrl('routes.html', a, b, CB.fare.TRICYCLE);
            return;
        }
        if (CB.ui.getTransport(form) === CB.fare.TRICYCLE && !allowed.tricycle) CB.ui.setTransport(form, CB.fare.JEEPNEY);
        if (CB.ui.getTransport(form) === CB.fare.JEEPNEY && !allowed.jeepney) CB.ui.setTransport(form, CB.fare.TRICYCLE);
        var transport = CB.ui.getTransport(form);

        // A special trip only exists for tricycles
        specialBox.disabled = transport !== CB.fare.TRICYCLE;
        special = CB.ui.getSpecial(form);

        var trip = CB.roads.estimateNow(a, b, transport, discounted, { night: night, special: special });
        render(trip, transport, discounted);
        history.replaceState(null, '', CB.ui.tripUrl('fares.html', a, b, transport));
        document.getElementById('link-map').href = CB.ui.tripUrl('routes.html', a, b, transport);
        document.getElementById('link-rate').href = CB.ui.tripUrl('feedback.html', a, b, transport);
        refreshTable(transport, discounted, night, special, a, b);

        // Get the real road distance, then update the fare
        var mine = ++requestId;
        if (trip.approximate) {
            CB.roads.distanceKm(a, b).then(function (km) {
                if (!km || mine !== requestId) return;
                render(CB.fare.estimateTrip(a, b, transport, discounted, { km: km, night: night, special: special }), transport, discounted);
            });
        }
    }

    function render(trip, transport, discounted) {
        if (!trip) return;
        document.getElementById('fare-label').textContent = trip.special
            ? 'Estimated fare (special trip, whole tricycle)' : 'Estimated fare (solo ride)';
        document.getElementById('fare-value').textContent = CB.fare.peso(trip.fare);
        document.getElementById('fare-meta').textContent = (trip.approximate
            ? 'About ' + CB.fare.formatKm(trip.km) + ' (straight line, approx.)'
            : CB.fare.formatKm(trip.km) + ' by road') +
            ' · ~' + trip.minutes + ' min by ' + transport.toLowerCase() + ' · ' + (trip.special ? 'Special trip · ' : '') + (trip.night ? 'Night' : 'Day') + ' fare';
        document.getElementById('fare-group').innerHTML = trip.special
            ? 'One price for the whole tricycle. No student / PWD / senior discount on special trips.'
            : '<strong>' + trip.persons + ' persons:</strong> ' + CB.fare.peso(trip.groupFare) +
              ' total (' + CB.fare.peso(trip.fare) + ' each)';
        setCompare('compare-regular', CB.fare.peso(trip.regularFare), !discounted || trip.special);
        setCompare('compare-discount', CB.fare.peso(trip.discountedFare), discounted && !trip.special);
    }

    /* ---------- refreshTable() in Android ---------- */
    function refreshTable(transport, discounted, night, special, currentStart, currentDest) {
        document.getElementById('table-mode').textContent =
            'Tricycle · ' + (special ? 'Special trip' : discounted ? 'Discounted' : 'Regular') + ' · ' + (night ? 'Night' : 'Day');

        var cur = currentStart && currentDest ? [currentStart.lat, currentStart.lng, currentDest.lat, currentDest.lng].join() : '';
        document.getElementById('fare-table-body').innerHTML = CB.data.ROUTES.map(function (r) {
            var trip = CB.roads.estimateNow(r[0], r[1], CB.fare.TRICYCLE, discounted, { night: night, special: special });
            var p = CB.data.PLACES;
            var isCurrent = cur === [p[r[0]].lat, p[r[0]].lng, p[r[1]].lat, p[r[1]].lng].join();
            return '<tr' + (isCurrent ? ' class="is-current"' : '') + '>' +
                '<td data-label="Route"><button type="button" class="table-route" data-start="' + r[0] + '" data-dest="' + r[1] + '">' +
                    CB.ui.escapeHtml(CB.data.routeLabel(r[0], r[1])) + '</button></td>' +
                '<td data-label="Distance">' + (trip.approximate ? '≈ ' : '') + CB.fare.formatKm(trip.km) + '</td>' +
                '<td data-label="Fare"><strong>' + CB.fare.peso(trip.fare) + '</strong></td>' +
            '</tr>';
        }).join('');

        // Load real road distances for the table, then redraw once
        if (!refreshTable.warming) {
            refreshTable.warming = true;
            CB.roads.warm(CB.data.ROUTES, function () { refreshTable.warming = false; recalc(); });
            setTimeout(function () { refreshTable.warming = false; }, 15000);
        }
    }

    /* ---------- Fare rules (rendered from fare.js so they always match) ---------- */
    function renderRules() {
        var R = CB.fare.RULES;
        var p = CB.fare.peso;
        document.getElementById('fare-rules').innerHTML =
            '<div class="guide-item"><h3>Fare</h3><ul>' +
                '<li>Jeepney between Daet and another town (Talisay &rarr; Daet, Daet &rarr; Talisay and others): <strong>' + p(R.JEEPNEY_FLAT) + '</strong> flat</li>' +
                '<li>Tricycle minimum fare (first ' + R.BASE_KM + ' km): <strong>' + p(R.BASE_REGULAR) + '</strong> regular, <strong>' + p(R.BASE_DISCOUNTED) + '</strong> Student / PWD / Senior</li>' +
                '<li>Additional <strong>+' + p(R.EXTRA_PER_KM) + '</strong> for every 1 km after that</li>' +
                '<li>Night fare (' + R.NIGHT_START + ':00 to 0' + R.NIGHT_END + ':00): +' + p(R.NIGHT_SURCHARGE) +
                    ' per passenger, so it is higher than the exact fare (' + p(R.BASE_REGULAR + R.NIGHT_SURCHARGE) + ' regular, ' +
                    p(R.BASE_DISCOUNTED + R.NIGHT_SURCHARGE) + ' Student / PWD / Senior for the first ' + R.BASE_KM + ' km)</li>' +
                '<li>Special trip (whole tricycle, not shared): <strong>' + p(R.SPECIAL_BASE) + '</strong> for the first ' + R.BASE_KM +
                    ' km, then +' + p(R.SPECIAL_EXTRA_PER_KM) + ' per km. Higher than the exact fare, one price for the whole tricycle, no discount</li>' +
                '<li>Student, PWD and senior citizen rates need a valid ID</li></ul></div>' +
            '<div class="guide-item"><h3>Solo or group</h3><ul>' +
                '<li>Fare is per passenger</li>' +
                '<li>A group of ' + CB.fare.GROUP_SIZE + ' pays ' + CB.fare.GROUP_SIZE + ' &times; the solo fare</li></ul></div>' +
            '<div class="guide-item"><h3>Where each ride goes</h3><ul>' +
                '<li>Tricycle: inside Daet only</li>' +
                '<li>Jeepney: only from Daet to another town (Talisay, Vinzons, Mercedes, Basud, Labo and more)</li></ul></div>' +
            '<div class="guide-item"><h3>Distance</h3><ul>' +
                '<li>Distance follows the real road route</li>' +
                '<li>Fares are rounded up to the next peso</li>' +
                '<li>Travel time assumes ' + R.TRICYCLE_KMH + ' km/h (tricycle) and ' + R.JEEPNEY_KMH + ' km/h (jeepney)</li></ul></div>';
    }

    /* ---------- Events ---------- */
    form.addEventListener('change', function (event) {
        if (event.target.name === 'transport' || event.target.name === 'daynight' || event.target.name === 'special' ||
            event.target === discountBox) recalc();
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    document.getElementById('btn-swap').addEventListener('click', function () {
        var a = startBox.getPoint();
        var b = destBox.getPoint();
        startBox.setPoint(b, true);
        destBox.setPoint(a, true);
        recalc();
    });

    document.getElementById('fare-table-body').addEventListener('click', function (event) {
        var btn = event.target.closest('[data-start]');
        if (!btn) return;
        startBox.setPoint(CB.data.PLACES[parseInt(btn.getAttribute('data-start'), 10)], true);
        destBox.setPoint(CB.data.PLACES[parseInt(btn.getAttribute('data-dest'), 10)], true);
        CB.ui.setTransport(form, CB.fare.TRICYCLE);
        recalc();
        if (window.innerWidth < 1024) {
            document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    renderRules();
    recalc();
})(window.CB);
