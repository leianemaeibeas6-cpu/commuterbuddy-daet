/* =========================================================
   storage.js - Client-side data storage
   Web version of UserPrefs.java and FeedbackStore.java.
   Android used SharedPreferences; the web app uses
   localStorage (data stays on the user's own device).

   If localStorage is blocked (e.g. some private browsing
   modes), the app keeps working with in-memory storage and
   shows a notice that data will not be saved.
   ========================================================= */
(function (CB) {
    'use strict';

    var KEYS = Object.freeze({
        USER_TYPE: 'cb_user_type',
        ANON_ID: 'cb_anon_id',
        FEEDBACK: 'cb_feedback',
        RECENT: 'cb_recent',
        ROAD_CACHE: 'cb_road_cache'
    });

    var MAX_FEEDBACK = 200;      // keep storage small
    var MAX_COMMENT = 300;

    /* ---------- Safe localStorage wrapper ---------- */
    var memoryStore = {};
    var persistent = (function testStorage() {
        try {
            var k = '__cb_test__';
            window.localStorage.setItem(k, '1');
            window.localStorage.removeItem(k);
            return true;
        } catch (e) {
            return false;
        }
    })();

    function getRaw(key) {
        if (!persistent) return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
        try {
            return window.localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function setRaw(key, value) {
        if (!persistent) {
            memoryStore[key] = value;
            return true;
        }
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch (e) {
            // Quota exceeded or storage disabled: fall back to memory
            memoryStore[key] = value;
            return false;
        }
    }

    function getJson(key, fallback) {
        var raw = getRaw(key);
        if (raw === null) return fallback;
        try {
            return JSON.parse(raw);
        } catch (e) {
            // Corrupted data: start fresh instead of breaking the app
            return fallback;
        }
    }

    /* ---------- User preferences (UserPrefs.java) ---------- */
    var prefs = {
        getUserType: function () {
            var type = getRaw(KEYS.USER_TYPE) || '';
            return prefs.isValidType(type) ? type : '';
        },

        setUserType: function (type) {
            if (!prefs.isValidType(type)) return false;
            return setRaw(KEYS.USER_TYPE, type);
        },

        isValidType: function (type) {
            return CB.data.USER_TYPES.some(function (t) { return t.name === type; });
        },

        isDiscounted: function (type) {
            var match = CB.data.USER_TYPES.filter(function (t) { return t.name === type; })[0];
            return !!(match && match.discounted);
        },

        /** Random 6-digit ID number, stable per browser, no personal data. e.g. "482915" */
        getAnonId: function () {
            var id = getRaw(KEYS.ANON_ID);
            if (id && /^\d{6}$/.test(id)) return id;

            var value = new Uint32Array(1);
            if (window.crypto && window.crypto.getRandomValues) {
                window.crypto.getRandomValues(value);
            } else {
                value[0] = Math.floor(Math.random() * 4294967296);
            }
            id = String(100000 + (value[0] % 900000));   // 100000-999999, never starts with 0
            setRaw(KEYS.ANON_ID, id);
            return id;
        },

        /** Anonymous username shown with the feedback, e.g. "anon-482915" */
        getAnonName: function () {
            return 'anon-' + prefs.getAnonId();
        }
    };

    /* ---------- Feedback (FeedbackStore.java + FeedbackItem.java) ---------- */
    function clampRating(n) {
        n = Number(n);
        return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0;
    }

    /** Returns a clean feedback object, or null if the data is not valid. */
    function sanitize(item) {
        if (!item || typeof item !== 'object') return null;
        var anonId = String(item.anonId || '').slice(0, 12);
        var clean = {
            anonId: anonId,
            username: anonId && /^\d{6}$/.test(anonId) ? 'anon-' + anonId : 'anon',
            userType: String(item.userType || '').slice(0, 40),
            route: String(item.route || '').slice(0, 160),
            transport: CB.fare.isValidTransport(item.transport) ? item.transport : '',
            special: item.special === true && item.transport === CB.fare.TRICYCLE,
            verified: item.verified === true,       // true = the AI matched the vehicle number photo
            routeRating: clampRating(item.routeRating),
            fareRating: clampRating(item.fareRating),
            overallRating: clampRating(item.overallRating),
            estimatedFare: Math.max(0, parseInt(item.estimatedFare, 10) || 0),
            actualFare: Math.max(0, parseInt(item.actualFare, 10) || 0),
            comment: String(item.comment || '').slice(0, MAX_COMMENT),
            timestamp: Number(item.timestamp) || 0
        };
        if (!clean.route || !clean.transport || !clean.routeRating ||
            !clean.fareRating || !clean.overallRating || !clean.timestamp) {
            return null;
        }
        return clean;
    }

    var feedback = {
        MAX_COMMENT: MAX_COMMENT,

        /** All saved feedback, newest first. Invalid entries are skipped. */
        getAll: function () {
            var list = getJson(KEYS.FEEDBACK, []);
            if (!Array.isArray(list)) return [];
            return list.map(sanitize).filter(Boolean).sort(function (a, b) {
                return b.timestamp - a.timestamp;
            });
        },

        /** Saves one feedback item. Returns { ok, saved } where saved=false means memory only. */
        add: function (item) {
            var clean = sanitize(item);
            if (!clean) return { ok: false, saved: false };
            var list = feedback.getAll().reverse();     // oldest first for storage
            list.push(clean);
            if (list.length > MAX_FEEDBACK) list = list.slice(list.length - MAX_FEEDBACK);
            var saved = setRaw(KEYS.FEEDBACK, JSON.stringify(list));
            return { ok: true, saved: saved && persistent };
        },

        /** Averages and counts for the summary card. */
        stats: function (list) {
            list = list || feedback.getAll();
            var n = list.length;
            if (!n) return null;
            var sum = { route: 0, fare: 0, overall: 0 };
            var withActual = 0;
            var matched = 0;
            list.forEach(function (f) {
                sum.route += f.routeRating;
                sum.fare += f.fareRating;
                sum.overall += f.overallRating;
                if (f.actualFare > 0) {
                    withActual++;
                    if (f.actualFare === f.estimatedFare) matched++;
                }
            });
            return {
                count: n,
                route: sum.route / n,
                fare: sum.fare / n,
                overall: sum.overall / n,
                withActual: withActual,
                matchRate: withActual ? matched / withActual : null
            };
        }
    };

    /* ---------- Recent searches (places and trips) ---------- */
    var MAX_RECENT = 8;

    function cleanPoint(p) {
        if (!p || typeof p !== 'object') return null;
        var lat = Number(p.lat), lng = Number(p.lng);
        var name = String(p.name || '').slice(0, 120);
        if (!name || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        return { name: name, lat: lat, lng: lng, category: String(p.category || 'Place').slice(0, 30),
            hint: String(p.hint || '').slice(0, 120), description: String(p.description || '').slice(0, 200),
            town: p.town ? String(p.town).slice(0, 40) : undefined };
    }

    function readRecent() {
        var data = getJson(KEYS.RECENT, {});
        if (!data || typeof data !== 'object') data = {};
        return {
            places: (Array.isArray(data.places) ? data.places : []).map(cleanPoint).filter(Boolean),
            trips: (Array.isArray(data.trips) ? data.trips : []).map(function (t) {
                if (!t) return null;
                var a = cleanPoint(t.start), b = cleanPoint(t.dest);
                if (!a || !b || !CB.fare.isValidTransport(t.transport)) return null;
                return { start: a, dest: b, transport: t.transport, timestamp: Number(t.timestamp) || 0 };
            }).filter(Boolean)
        };
    }

    function samePoint(a, b) {
        return Math.abs(a.lat - b.lat) < 0.0002 && Math.abs(a.lng - b.lng) < 0.0002;
    }

    var recent = {
        places: function () { return readRecent().places; },
        trips: function () { return readRecent().trips; },
        addPlace: function (point) {
            var p = cleanPoint(point);
            if (!p) return;
            var data = readRecent();
            data.places = [p].concat(data.places.filter(function (x) { return !samePoint(x, p); })).slice(0, MAX_RECENT);
            setRaw(KEYS.RECENT, JSON.stringify(data));
        },
        addTrip: function (start, dest, transport) {
            var a = cleanPoint(start), b = cleanPoint(dest);
            if (!a || !b || !CB.fare.isValidTransport(transport)) return;
            var data = readRecent();
            data.trips = [{ start: a, dest: b, transport: transport, timestamp: Date.now() }].concat(
                data.trips.filter(function (t) {
                    return !(samePoint(t.start, a) && samePoint(t.dest, b) && t.transport === transport);
                })).slice(0, MAX_RECENT);
            setRaw(KEYS.RECENT, JSON.stringify(data));
        },
        clear: function () { setRaw(KEYS.RECENT, JSON.stringify({ places: [], trips: [] })); }
    };

    /* ---------- Small cache for road distances ---------- */
    var cache = {
        get: function (k) {
            var all = getJson(KEYS.ROAD_CACHE, {});
            return all && typeof all === 'object' ? all[k] : undefined;
        },
        set: function (k, value) {
            var all = getJson(KEYS.ROAD_CACHE, {});
            if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
            all[k] = Math.round(value * 1000) / 1000;
            var keys = Object.keys(all);
            if (keys.length > 150) keys.slice(0, keys.length - 150).forEach(function (old) { delete all[old]; });
            setRaw(KEYS.ROAD_CACHE, JSON.stringify(all));
        }
    };

    CB.storage = {
        isPersistent: function () { return persistent; },
        recent: recent,
        cache: cache,
        prefs: prefs,
        feedback: feedback
    };
})(window.CB = window.CB || {});
