/* =========================================================
   fare.js - Fare estimates based on ROAD distance
   Web version of FareCalculator.java.

   FARE RULES (Daet)
   - Minimum fare:  Regular P20  |  Student / PWD / Senior P15
     (covers the first BASE_KM kilometers)
   - Additional:    +P2 for every 1 km after the base distance
     (a started kilometer counts as a full kilometer)
   - Day / Night:   a night surcharge is added from NIGHT_START
     to NIGHT_END (edit NIGHT_SURCHARGE below). A night fare is
     always HIGHER than the exact day fare (P20 regular / P15
     Student-PWD-Senior).
   - Special trip:  the whole tricycle is booked for you (not
     shared). It is always HIGHER than the exact fare, has no
     student / PWD / senior discount, and is one price for the
     whole tricycle, not per passenger (edit SPECIAL_* below).
   - Solo vs group: fares are per passenger, so a group of N
     pays N x the per-person fare.
   - Fares are rounded up to the next peso.
   - Jeepney (Daet <-> another town, e.g. Daet to Talisay, and
     Talisay to Daet): flat JEEPNEY_FLAT (P15), whatever the
     distance and whichever direction.

   DISTANCE
   The distance comes from the real road route (Google Routes /
   OSRM). The old "straight line x 1.25" guess was removed. Only
   when no road route can be loaded (offline) the plain
   straight-line distance is shown, clearly marked as approximate.
   ========================================================= */
(function (CB) {
    'use strict';

    var TRICYCLE = 'Tricycle';
    var JEEPNEY = 'Jeepney';
    var TRANSPORTS = Object.freeze([TRICYCLE, JEEPNEY]);
    var GROUP_SIZE = 4;

    // ---- Editable constants ----
    var RULES = Object.freeze({
        BASE_REGULAR: 20,            // minimum fare, regular
        BASE_DISCOUNTED: 15,         // minimum fare, Student / PWD / Senior
        JEEPNEY_FLAT: 15,            // jeepney, Daet <-> another town: flat P15 (no per-km, no night extra)
        BASE_KM: 2.0,                // distance covered by the minimum fare
        EXTRA_PER_KM: 2,             // +P2 per 1 km after the base distance
        NIGHT_START: 20,             // 8:00 PM (24-hour clock)
        NIGHT_END: 5,                // 5:00 AM
        NIGHT_SURCHARGE: 5,          // TODO: confirm the real night rate (pesos per passenger)
        SPECIAL_BASE: 50,            // TODO: confirm. Special trip, first BASE_KM km (whole tricycle)
        SPECIAL_EXTRA_PER_KM: 5,     // TODO: confirm. Special trip, +P per km after the base distance
        TRICYCLE_KMH: 20,
        JEEPNEY_KMH: 25
    });

    var EARTH_RADIUS_KM = 6371.0088;

    function toRad(deg) {
        return deg * Math.PI / 180;
    }

    /** Straight-line distance in km between two {lat, lng} points (Haversine formula). */
    function straightKm(a, b) {
        var dLat = toRad(b.lat - a.lat);
        var dLng = toRad(b.lng - a.lng);
        var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
    }

    function isValidTransport(value) {
        return TRANSPORTS.indexOf(value) !== -1;
    }

    /** True when the given Date (default: now) falls in the night-fare hours. */
    function isNight(date) {
        var h = (date || new Date()).getHours();
        return RULES.NIGHT_START > RULES.NIGHT_END
            ? (h >= RULES.NIGHT_START || h < RULES.NIGHT_END)
            : (h >= RULES.NIGHT_START && h < RULES.NIGHT_END);
    }

    /**
     * Fare in whole pesos (rounded up). Per PASSENGER, except a special trip,
     * which is one price for the whole tricycle.
     */
    function fare(transport, km, discounted, night, special) {
        // Jeepney to another town (Daet <-> Talisay and others) is a flat fare, both directions
        if (transport === JEEPNEY) return RULES.JEEPNEY_FLAT;
        if (special) {
            var sf = RULES.SPECIAL_BASE;       // special trips have no discount
            if (km > RULES.BASE_KM) sf += Math.ceil(km - RULES.BASE_KM) * RULES.SPECIAL_EXTRA_PER_KM;
            if (night) sf += RULES.NIGHT_SURCHARGE;
            return Math.ceil(sf);
        }
        var f = discounted ? RULES.BASE_DISCOUNTED : RULES.BASE_REGULAR;
        if (km > RULES.BASE_KM) f += Math.ceil(km - RULES.BASE_KM) * RULES.EXTRA_PER_KM;
        if (night) f += RULES.NIGHT_SURCHARGE;
        return Math.ceil(f);
    }

    /** Estimated travel time in minutes (includes ~2 min for waiting/boarding). */
    function minutes(transport, km) {
        var kmh = transport === JEEPNEY ? RULES.JEEPNEY_KMH : RULES.TRICYCLE_KMH;
        return Math.max(3, Math.round(km / kmh * 60) + 2);
    }

    /**
     * Full estimate for a trip.
     * `from` / `to`: a place index or a point { name, lat, lng }.
     * options: { km: road distance in km (omit to use the straight-line fallback),
     *            night: boolean (default: based on the clock),
     *            special: boolean, special trip (tricycle only; the whole tricycle is booked),
     *            persons: group size (default 4) }
     * Returns null for invalid trips (same place, bad transport, or the
     * transport does not serve that trip).
     */
    function estimateTrip(from, to, transport, discounted, options) {
        options = options || {};
        var a = CB.data.resolvePoint(from);
        var b = CB.data.resolvePoint(to);
        if (!a || !b || !isValidTransport(transport)) return null;
        if (a === b || (a.lat === b.lat && a.lng === b.lng)) return null;

        var allowed = CB.data.transportOptions(a, b);
        if (transport === TRICYCLE && !allowed.tricycle) return null;
        if (transport === JEEPNEY && !allowed.jeepney) return null;

        var hasRoad = typeof options.km === 'number' && options.km > 0;
        var km = hasRoad ? options.km : straightKm(a, b);
        var night = options.night === undefined ? isNight() : !!options.night;
        var persons = options.persons || GROUP_SIZE;
        var special = !!options.special && transport === TRICYCLE;

        var solo = fare(transport, km, discounted, night, special);
        return {
            start: a,
            dest: b,
            transport: transport,
            discounted: !!discounted && !special,
            special: special,
            night: night,
            km: km,
            approximate: !hasRoad,       // true = straight-line fallback, not a road distance
            minutes: minutes(transport, km),
            fare: solo,                  // solo ride, per person
            persons: persons,
            groupFare: special ? solo : solo * persons,   // special trip: one price for the whole tricycle
            regularFare: fare(transport, km, false, night, special),
            discountedFare: fare(transport, km, true, night, special),
            dayFare: fare(transport, km, discounted, false, special),
            nightFare: fare(transport, km, discounted, true, special)
        };
    }

    function peso(amount) {
        return '₱' + amount;
    }

    function formatKm(km) {
        return km.toFixed(1) + ' km';
    }

    CB.fare = {
        TRICYCLE: TRICYCLE,
        JEEPNEY: JEEPNEY,
        TRANSPORTS: TRANSPORTS,
        GROUP_SIZE: GROUP_SIZE,
        RULES: RULES,
        straightKm: straightKm,
        isNight: isNight,
        isValidTransport: isValidTransport,
        fare: fare,
        minutes: minutes,
        estimateTrip: estimateTrip,
        peso: peso,
        formatKm: formatKm
    };
})(window.CB = window.CB || {});
