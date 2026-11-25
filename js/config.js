/* =========================================================
   config.js - App settings

   GOOGLE MAPS
   Paste your Google Maps API key between the quotes below.
   - Works with a free "Maps Demo Key" or a standard key.
   - The key needs: Maps JavaScript API + Routes API.
   - Leave it empty ('') to use the free OpenStreetMap map
     with OSRM road routing instead (no key needed).
   - If the key is wrong, blocked, or reaches its daily limit,
     the app switches to OpenStreetMap automatically.

   GOOGLE_MAP_ID: 'DEMO_MAP_ID' is Google's test map style and
   is fine for class demos. For a long-term public site, create
   your own Map ID in Google Cloud (Map Management) and paste it.
   ========================================================= */
(function (CB) {
    'use strict';

    CB.config = Object.freeze({
        GOOGLE_MAPS_API_KEY: 'AIzaSyASrIa9maYkfWyNwh8xb8Mfp5pF8CYAt-E',
        GOOGLE_MAP_ID: 'DEMO_MAP_ID'
    });
})(window.CB = window.CB || {});
