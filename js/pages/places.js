/* =========================================================
   places.js - Places screen
   Web version of PlacesActivity.java: search, category
   filter chips, and place cards with "View on map" and
   "Get fare" shortcuts.
   ========================================================= */
(function (CB) {
    'use strict';

    var type = CB.ui.initPage('places');
    if (!type) return;

    var ALL = 'All';
    var C = CB.data.CATEGORY;
    var CATEGORIES = [ALL, C.TOURIST, C.LANDMARK, C.FOOD, C.BUSINESS];
    var CATEGORY_CLASS = {};
    CATEGORY_CLASS[C.TOURIST] = 'cat--tourist';
    CATEGORY_CLASS[C.LANDMARK] = 'cat--landmark';
    CATEGORY_CLASS[C.FOOD] = 'cat--food';
    CATEGORY_CLASS[C.BUSINESS] = 'cat--business';

    var selectedCategory = ALL;
    var searchInput = document.getElementById('search');
    var chipsEl = document.getElementById('chips');
    var listEl = document.getElementById('places-list');
    var emptyEl = document.getElementById('places-empty');
    var countEl = document.getElementById('results-count');
    var market = CB.data.PLACES[CB.data.IDX.MARKET];

    /* ---------- Chips (buildChips() / updateChips() in Android) ---------- */
    function renderChips() {
        chipsEl.innerHTML = CATEGORIES.map(function (cat) {
            var count = cat === ALL ? CB.data.PLACES.length :
                CB.data.PLACES.filter(function (p) { return p.category === cat; }).length;
            var active = cat === selectedCategory;
            return '<button type="button" class="chip' + (active ? ' is-active' : '') + '" data-category="' +
                CB.ui.escapeHtml(cat) + '" aria-pressed="' + active + '">' +
                CB.ui.escapeHtml(cat) + ' <span class="chip__count">' + count + '</span></button>';
        }).join('');
    }

    /* ---------- Trip shortcut (openTrip() in Android) ---------- */
    function tripLink(page, destIndex) {
        var start = destIndex === CB.data.IDX.MARKET ? CB.data.IDX.PLAZA : CB.data.IDX.MARKET;
        return CB.ui.tripUrl(page, start, destIndex, CB.fare.TRICYCLE);
    }

    function placeCard(p) {
        var index = CB.data.PLACES.indexOf(p);
        var km = (CB.roads.cached(market, p)) || CB.fare.straightKm(market, p);
        var distance = index === CB.data.IDX.MARKET ? 'Town center' :
            km < 0.15 ? 'Beside the market' : '≈ ' + CB.fare.formatKm(km) + ' from the market';

        return '<article class="place-card">' +
            '<div class="place-card__top">' +
                '<span class="badge ' + CATEGORY_CLASS[p.category] + '">' + CB.ui.escapeHtml(p.category) + '</span>' +
                '<span class="place-card__distance">' + distance + '</span>' +
            '</div>' +
            '<h2 class="place-card__name">' + CB.ui.escapeHtml(p.name) + '</h2>' +
            '<p class="place-card__desc">' + CB.ui.escapeHtml(p.description) + '</p>' +
            '<p class="place-card__hint">' + CB.ui.icon('places') + '<span>' + CB.ui.escapeHtml(p.hint) + '</span></p>' +
            '<div class="place-card__actions">' +
                '<a class="btn btn--ghost btn--sm" href="' + tripLink('routes.html', index) + '">View on map</a>' +
                '<a class="btn btn--outline btn--sm" href="' + tripLink('fares.html', index) + '">Get fare</a>' +
            '</div>' +
        '</article>';
    }

    /* ---------- applyFilter() in Android ---------- */
    function applyFilter() {
        var q = searchInput.value.trim().toLowerCase();
        var results = CB.data.PLACES.filter(function (p) {
            var catOk = selectedCategory === ALL || p.category === selectedCategory;
            // Search by name and address only (the description is shown, but not searched)
            var textOk = !q || CB.data.matchRank(p, q) !== -1;
            return catOk && textOk;
        });
        if (q) {
            results = results.map(function (p, i) { return { p: p, r: CB.data.matchRank(p, q), i: i }; })
                .sort(function (a, b) { return a.r - b.r || a.i - b.i; })
                .map(function (x) { return x.p; });
        }

        listEl.innerHTML = results.map(placeCard).join('');
        localCount = results.length;
        emptyEl.hidden = results.length > 0 || moreBusy || moreCount > 0;
        countEl.textContent = results.length === 1 ? '1 place' : results.length + ' places';
        if (q) countEl.textContent += ' for “' + searchInput.value.trim() + '”';
    }

    /* ---------- Places NOT in our list (OpenStreetMap) ---------- */
    var moreEl = document.getElementById('more-places');
    var moreListEl = document.getElementById('more-list');
    var moreStatusEl = document.getElementById('more-status');
    var localCount = 0, moreCount = 0, moreBusy = false, moreTimer = null, moreReq = 0, moreCtl = null;

    function onlineCard(p) {
        var link = function (page) { return CB.ui.tripUrl(page, CB.data.IDX.MARKET, p, CB.fare.TRICYCLE); };
        return '<article class="place-card">' +
            '<div class="place-card__top"><span class="badge">Other place</span></div>' +
            '<h2 class="place-card__name">' + CB.ui.escapeHtml(p.name) + '</h2>' +
            (p.hint ? '<p class="place-card__hint">' + CB.ui.icon('places') + '<span>' + CB.ui.escapeHtml(p.hint) + '</span></p>' : '') +
            '<div class="place-card__actions">' +
                '<a class="btn btn--ghost btn--sm" href="' + link('routes.html') + '">View on map</a>' +
                '<a class="btn btn--outline btn--sm" href="' + link('fares.html') + '">Get fare</a>' +
            '</div></article>';
    }

    function clearMore() {
        clearTimeout(moreTimer);
        if (moreCtl) moreCtl.abort();
        moreReq++; moreBusy = false; moreCount = 0;
        moreEl.hidden = true; moreListEl.innerHTML = ''; moreStatusEl.textContent = '';
    }

    function searchMore() {
        var q = searchInput.value.trim();
        clearMore();
        // Category filters only apply to our own list
        if (q.length < 3 || selectedCategory !== ALL || !window.fetch) return;
        if (!navigator.onLine) {
            moreEl.hidden = false;
            moreStatusEl.textContent = 'You are offline. Connect to the internet to find places outside our list.';
            return;
        }
        var mine = ++moreReq;
        moreBusy = true;
        moreEl.hidden = false;
        moreStatusEl.textContent = 'Searching for more places…';
        emptyEl.hidden = true;
        moreTimer = setTimeout(function () {
            moreCtl = window.AbortController ? new AbortController() : null;
            CB.search.nominatim(q, moreCtl && moreCtl.signal, 8).then(function (found) {
                if (mine !== moreReq) return;
                // skip anything already in our list (same name, or within ~100 m)
                found = found.map(function (f) { return f.point; }).filter(function (pt) {
                    return !CB.data.PLACES.concat(CB.data.TOWN_POINTS || []).some(function (l) {
                        return l.name.toLowerCase() === pt.name.toLowerCase() || CB.fare.straightKm(l, pt) < 0.1;
                    });
                });
                moreBusy = false; moreCount = found.length;
                moreListEl.innerHTML = found.map(onlineCard).join('');
                moreStatusEl.textContent = found.length ? found.length + (found.length === 1 ? ' more place' : ' more places') + ' found online' : '';
                moreEl.hidden = !found.length;
                emptyEl.hidden = localCount > 0 || found.length > 0;
            }).catch(function (err) {
                if (mine !== moreReq || (err && err.name === 'AbortError')) return;
                moreBusy = false;
                moreStatusEl.textContent = 'Could not search online right now.';
                moreEl.hidden = false;
                emptyEl.hidden = localCount > 0;
            });
        }, 500);
    }

    chipsEl.addEventListener('click', function (event) {
        var chip = event.target.closest('[data-category]');
        if (!chip) return;
        selectedCategory = chip.getAttribute('data-category');
        renderChips();
        applyFilter();
        searchMore();
    });

    searchInput.addEventListener('input', function () { applyFilter(); searchMore(); });

    document.getElementById('btn-clear').addEventListener('click', function () {
        searchInput.value = '';
        selectedCategory = ALL;
        renderChips();
        applyFilter();
        clearMore();
        searchInput.focus();
    });

    renderChips();
    applyFilter();
})(window.CB);
