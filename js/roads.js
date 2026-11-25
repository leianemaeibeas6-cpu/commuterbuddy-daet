/* =========================================================
   roads.js - Real road distance between two points
   Replaces the old "straight-line x 1.25" guess.

   Uses OSRM (free road routing). Results are cached on the
   device, so a route that was loaded once also works offline.
   The Routes page uses the distance of the route drawn on the
   map itself (Google Routes API or OSRM) and saves it here too.
   ========================================================= */
(function (CB) {
    'use strict';

    var OSRM = 'https://router.project-osrm.org/route/v1/driving/';
    var TIMEOUT_MS = 8000;
    var memory = {};
    var pending = {};

    function key(a, b) {
        function r(n) { return n.toFixed(4); }
        return r(a.lat) + ',' + r(a.lng) + '>' + r(b.lat) + ',' + r(b.lng);
    }

    /** Distance in km if already known (this session or saved on the device), else undefined. */
    function cached(from, to) {
        var a = CB.data.resolvePoint(from), b = CB.data.resolvePoint(to);
        if (!a || !b) return undefined;
        var k = key(a, b);
        if (memory[k]) return memory[k];
        var saved = CB.storage.cache.get(k);
        if (typeof saved === 'number' && saved > 0) {
            memory[k] = saved;
            return saved;
        }
        return undefined;
    }

    function remember(from, to, km) {
        var a = CB.data.resolvePoint(from), b = CB.data.resolvePoint(to);
        if (!a || !b || !(km > 0)) return;
        var k = key(a, b);
        memory[k] = km;
        CB.storage.cache.set(k, km);
        CB.storage.cache.set(key(b, a), km);   // same road back
        memory[key(b, a)] = km;
    }

    /** Resolves with the road distance in km, or null if it cannot be loaded. */
    function distanceKm(from, to) {
        var a = CB.data.resolvePoint(from), b = CB.data.resolvePoint(to);
        if (!a || !b) return Promise.resolve(null);
        var hit = cached(a, b);
        if (hit) return Promise.resolve(hit);
        if (!navigator.onLine || !window.fetch) return Promise.resolve(null);

        var k = key(a, b);
        if (pending[k]) return pending[k];
        var controller = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (controller) controller.abort(); }, TIMEOUT_MS);
        var url = OSRM + a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=false';

        pending[k] = fetch(url, controller ? { signal: controller.signal } : undefined)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                var route = data && data.routes && data.routes[0];
                if (!route || !(route.distance > 0)) return null;
                var km = route.distance / 1000;
                remember(a, b, km);
                return km;
            })
            .catch(function () { return null; })
            .then(function (km) {
                clearTimeout(timer);
                delete pending[k];
                return km;
            });
        return pending[k];
    }

    /** Trip estimate using the best distance known right now (road if cached, else straight line). */
    function estimateNow(from, to, transport, discounted, options) {
        var opts = Object.assign({}, options || {});
        var km = cached(from, to);
        if (km) opts.km = km;
        return CB.fare.estimateTrip(from, to, transport, discounted, opts);
    }

    /** Loads road distances for many pairs, then calls onDone() once (if anything new arrived). */
    function warm(pairs, onDone) {
        var jobs = pairs.filter(function (p) { return !cached(p[0], p[1]); });
        if (!jobs.length) return;
        Promise.all(jobs.map(function (p) { return distanceKm(p[0], p[1]); })).then(function (list) {
            if (list.some(Boolean) && onDone) onDone();
        });
    }

    CB.roads = {
        cached: cached,
        remember: remember,
        distanceKm: distanceKm,
        estimateNow: estimateNow,
        warm: warm
    };
})(window.CB = window.CB || {});
