/* =========================================================
   home.js - Home screen / main menu
   Web version of MainActivity.java
   ========================================================= */
(function (CB) {
    'use strict';

    function renderQuickFare(type) {
        var discounted = CB.storage.prefs.isDiscounted(type);
        var regular = CB.fare.fare(CB.fare.TRICYCLE, 0, false, false);
        var discount = CB.fare.fare(CB.fare.TRICYCLE, 0, true, false);

        document.getElementById('quick-fare').textContent = CB.fare.peso(discounted ? discount : regular);
        document.getElementById('quick-fare-type').textContent = discounted ? 'discounted' : 'regular';
        document.getElementById('quick-fare-both').textContent =
            'Regular ' + CB.fare.peso(regular) + ' · Student/PWD/Senior ' + CB.fare.peso(discount);
    }

    function renderFrequentRoutes(type) {
        var discounted = CB.storage.prefs.isDiscounted(type);
        var list = document.getElementById('home-routes');
        document.getElementById('frequent-mode').textContent =
            'Tricycle · ' + (discounted ? 'Discounted' : 'Regular');

        list.innerHTML = CB.data.ROUTES.map(function (r) {
            var trip = CB.roads.estimateNow(r[0], r[1], CB.fare.TRICYCLE, discounted, { night: false });
            var href = CB.ui.tripUrl('routes.html', r[0], r[1], CB.fare.TRICYCLE);
            return '<li><a class="route-item" href="' + href + '">' +
                '<span class="route-item__places">' +
                    '<span class="route-item__from">' + CB.ui.escapeHtml(trip.start.name) + '</span>' +
                    '<span class="route-item__to">' + CB.ui.escapeHtml(trip.dest.name) + '</span>' +
                '</span>' +
                '<span class="route-item__meta">' +
                    '<strong>' + CB.fare.peso(trip.fare) + '</strong>' +
                    '<small>' + (trip.approximate ? '≈ ' : '') + CB.fare.formatKm(trip.km) + '</small>' +
                '</span>' +
            '</a></li>';
        }).join('');
    }

    var type = CB.ui.initPage('home');
    if (!type) return;

    document.getElementById('greeting').textContent = 'Hello, ' + type + '!';
    renderQuickFare(type);
    renderFrequentRoutes(type);
    CB.roads.warm(CB.data.ROUTES, function () { renderFrequentRoutes(type); });
})(window.CB);
