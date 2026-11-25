/* =========================================================
   geo.js - Location-based service (Geolocation API)
   Emerging technology: finds the user's GPS position and
   the nearest Commuter Buddy pick-up point, so a commuter
   can start a trip from "where I am now".
   Works only on HTTPS (or localhost) and with permission.
   ========================================================= */
(function (CB) {
    'use strict';

    var FAR_FROM_DAET_KM = 25;
    var last = null;   // last known position { lat, lng, accuracy }

    function isSupported() {
        return 'geolocation' in navigator;
    }

    function friendlyError(err) {
        if (!err || typeof err.code !== 'number') return 'Could not get your location.';
        switch (err.code) {
            case 1: return 'Location permission was denied. Allow location access in your browser settings to use this.';
            case 2: return 'Your location is not available right now. Try again near a window or turn on GPS.';
            case 3: return 'Getting your location took too long. Please try again.';
            default: return 'Could not get your location.';
        }
    }

    /** Resolves with { lat, lng, accuracy } or rejects with a friendly Error message. */
    function locate() {
        return new Promise(function (resolve, reject) {
            if (!isSupported()) {
                reject(new Error('This browser does not support location services.'));
                return;
            }
            if (window.isSecureContext === false) {
                reject(new Error('Location only works when the app is opened over HTTPS.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(function (pos) {
                last = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
                resolve(last);
            }, function (err) {
                reject(new Error(friendlyError(err)));
            }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
        });
    }

    /** Nearest place in the list to a position: { index, place, km, farFromDaet }. */
    function nearestPlace(lat, lng) {
        var here = { lat: lat, lng: lng };
        var best = null;
        CB.data.PLACES.forEach(function (p, i) {
            var km = CB.fare.straightKm(here, p);
            if (!best || km < best.km) best = { index: i, place: p, km: km };
        });
        best.farFromDaet = best.km > FAR_FROM_DAET_KM;
        return best;
    }

    /** If location permission was already granted, quietly remember where the user is (no prompt). */
    function warm() {
        if (last || !isSupported() || !navigator.permissions || !navigator.permissions.query) return;
        navigator.permissions.query({ name: 'geolocation' }).then(function (st) {
            if (st.state === 'granted') locate().catch(function () {});
        }).catch(function () {});
    }

    CB.geo = {
        lastPosition: function () { return last; },
        warm: warm,
        isSupported: isSupported,
        locate: locate,
        nearestPlace: nearestPlace
    };
})(window.CB = window.CB || {});
