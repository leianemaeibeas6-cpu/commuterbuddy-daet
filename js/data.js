/* =========================================================
   data.js - Places, frequent routes and user types
   Web version of LocationData.java, Place.java and the
   TYPES / DESCRIPTIONS arrays in UserPrefs.java.

   NOTE: Coordinates are approximate (good enough for routes
   and fares). Places added in the web version were located
   using Wikipedia, GCatholic.org plus codes and published
   map pins (see README, Section 10).
   ========================================================= */
(function (CB) {
    'use strict';

    /** Place categories (same as Place.java). */
    var CATEGORY = Object.freeze({
        LANDMARK: 'Landmark',
        TOURIST: 'Tourist Spot',
        FOOD: 'Food',
        BUSINESS: 'Business'
    });

    /** Map center (Daet town proper). */
    var CENTER = Object.freeze({ lat: 14.1122, lng: 122.9556 });

    /**
     * All places. The ORDER MATTERS: a place's position in this list is its ID,
     * which is passed between pages in the URL (like Intent extras in Android).
     */
    var PLACES = Object.freeze([
        {
            name: 'Daet Public Market', category: CATEGORY.LANDMARK, lat: 14.1122, lng: 122.9556,
            description: 'The main public market in the town center. A common pick-up point for tricycles and jeepneys.',
            hint: 'Town center (Poblacion)'
        },
        {
            name: 'Daet Elevated Town Plaza', category: CATEGORY.LANDMARK, lat: 14.1158, lng: 122.9553,
            description: 'Raised public plaza in the heart of Daet, open 24/7. A popular meeting point with gardens and benches.',
            hint: 'Town center (Poblacion)'
        },
        {
            name: 'Camarines Norte Provincial Capitol', category: CATEGORY.LANDMARK, lat: 14.1103, lng: 122.9562,
            description: 'Seat of the provincial government of Camarines Norte.',
            hint: 'Near the town plaza'
        },
        {
            name: 'Old Daet Church (St. John the Baptist Parish)', category: CATEGORY.TOURIST, lat: 14.1124, lng: 122.9563,
            description: 'Built by Franciscan friars in 1611, one of the oldest churches in Camarines Norte and the former cathedral.',
            hint: 'Town center (Poblacion)'
        },
        {
            name: 'Camarines Norte Provincial Hospital', category: CATEGORY.LANDMARK, lat: 14.1150, lng: 122.9520,
            description: 'Major public hospital serving Daet and nearby towns.',
            hint: 'Daet Poblacion area'
        },
        {
            name: 'UCN Main Campus (formerly CNSC)', category: CATEGORY.LANDMARK, lat: 14.1090, lng: 122.9515,
            description: 'University of Camarines Norte main campus, a frequent destination for students.',
            hint: 'Daet Poblacion area'
        },
        {
            name: 'Bagasbas Beach', category: CATEGORY.TOURIST, lat: 14.1358, lng: 122.9866,
            description: "Daet's best-known beach, famous for surfing, kiteboarding and sunsets, with a long beachfront boulevard.",
            hint: 'Bagasbas, Daet'
        },
        {
            name: 'Bagasbas Beachfront Restaurants', category: CATEGORY.FOOD, lat: 14.1352, lng: 122.9862,
            description: 'Restaurants facing the beach, such as Hoogpaan, Catherine\u2019s and Leo\u2019s Cuisine. Great for seafood and sunset views.',
            hint: 'President Cory Aquino Boulevard, Bagasbas'
        },
        {
            name: 'Bagasbas Surf Shops & Rentals', category: CATEGORY.BUSINESS, lat: 14.1364, lng: 122.9871,
            description: 'Surfboard and skimboard rentals and beginner lessons. Bagasbas is a beach break, so it is good for first-timers.',
            hint: 'Bagasbas Beach'
        },
        {
            name: 'Daet Market Food Stalls', category: CATEGORY.FOOD, lat: 14.1124, lng: 122.9558,
            description: 'Carinderias (turo-turo) serving home-cooked Bicolano meals like laing and dishes with gata, plus merienda.',
            hint: 'Inside and around Daet Public Market'
        },
        {
            name: 'Local Pasalubong Shops', category: CATEGORY.BUSINESS, lat: 14.1119, lng: 122.9560,
            description: 'Shops selling local delicacies and souvenirs, including products made from the sweet Formosa pineapple.',
            hint: 'Town center (Poblacion)'
        },

        /* ---------- Added in the web version: must-visit places in Daet ---------- */
        {
            name: 'First Rizal Monument (Rizal Park)', category: CATEGORY.TOURIST, lat: 14.1131, lng: 122.9545,
            description: 'The first monument ever built to honor Jos\u00E9 Rizal, unveiled on December 30, 1898. Now a National Monument.',
            hint: 'Rizal Park, Justo Lukban cor. J.P. Rizal St.'
        },
        {
            name: 'Daet Heritage Center and Museum', category: CATEGORY.TOURIST, lat: 14.1132, lng: 122.9548,
            description: 'Small museum on the history and culture of Daet and Camarines Norte. Open Monday to Friday, 8 AM\u20135 PM.',
            hint: 'Beside Rizal Park'
        },
        {
            name: 'Daet Cathedral (Most Holy Trinity)', category: CATEGORY.TOURIST, lat: 14.1243, lng: 122.9480,
            description: 'Seat of the Diocese of Daet, dedicated in 1984. A large, quiet church compound for visits and Mass.',
            hint: 'Gahonon, Daet'
        },
        {
            name: 'Our Lady of Pe\u00F1afrancia Parish', category: CATEGORY.LANDMARK, lat: 14.1146, lng: 122.9654,
            description: 'Parish church east of the town center, devoted to Our Lady of Pe\u00F1afrancia, patroness of Bicol.',
            hint: 'Moreno District, Gubat'
        },
        {
            name: 'Divine Mercy Parish (Alawihao)', category: CATEGORY.LANDMARK, lat: 14.1049, lng: 122.9261,
            description: 'Peaceful parish church in Barangay Alawihao, west of the town center.',
            hint: 'Alawihao, Daet'
        },
        {
            name: 'Bagasbas Airport', category: CATEGORY.LANDMARK, lat: 14.1294, lng: 122.9806,
            description: 'Small airport near Bagasbas Beach with a 1,150 m runway. It has no scheduled flights.',
            hint: 'Ninoy Aquino Avenue, Bagasbas'
        },
        {
            name: 'Bagasbas Lighthouse Hotel Resort', category: CATEGORY.BUSINESS, lat: 14.1333, lng: 122.9841,
            description: 'Beachfront resort with a pool and restaurant, steps from the surf area of Bagasbas Beach.',
            hint: 'Bagasbas Road, near the boulevard'
        },
        {
            name: 'SM City Daet', category: CATEGORY.BUSINESS, lat: 14.1216, lng: 122.9458,
            description: 'Three-level mall with a supermarket, food court and shops; the first SM mall in Camarines Norte (opened 2021).',
            hint: 'Vinzons Avenue, Lag-on'
        }
    ]);

    /** Index constants (position in PLACES), same as LocationData.java. */
    var IDX = Object.freeze({
        MARKET: 0, PLAZA: 1, CAPITOL: 2, CHURCH: 3, HOSPITAL: 4, CAMPUS: 5, BAGASBAS: 6,
        RIZAL: 11, CATHEDRAL: 13, SM: 18
    });

    /** Frequently used routes as [fromIndex, toIndex]. */
    var ROUTES = Object.freeze([
        [IDX.MARKET, IDX.BAGASBAS],
        [IDX.PLAZA, IDX.BAGASBAS],
        [IDX.MARKET, IDX.CAMPUS],
        [IDX.PLAZA, IDX.CAPITOL],
        [IDX.MARKET, IDX.HOSPITAL],
        [IDX.CAMPUS, IDX.BAGASBAS],
        [IDX.MARKET, IDX.CHURCH],
        [IDX.MARKET, IDX.SM],
        [IDX.PLAZA, IDX.RIZAL],
        [IDX.SM, IDX.BAGASBAS]
    ]);

    /** User types and their descriptions. */
    var USER_TYPES = Object.freeze([
        { name: 'Regular Commuter', description: 'Everyday rider, regular fare', discounted: false },
        { name: 'Student', description: 'Discounted fare (with valid ID)', discounted: true },
        { name: 'PWD', description: 'Person with disability, discounted fare', discounted: true },
        { name: 'Senior Citizen', description: 'Discounted fare (with valid ID)', discounted: true },
        { name: 'Tourist / Visitor', description: 'Visiting Daet, regular fare', discounted: false }
    ]);

    /** "Start -> Destination" label for a route. */
    function routeLabel(startIndex, destIndex) {
        return PLACES[startIndex].name + ' → ' + PLACES[destIndex].name;
    }

    /** True if `value` is a valid index into PLACES. */
    function isValidPlaceIndex(value) {
        return Number.isInteger(value) && value >= 0 && value < PLACES.length;
    }


    /* ---------- Towns reached by jeepney (Daet -> another town) ----------
       Tricycles run only inside Daet. Jeepneys are only for trips between
       Daet and another town. Coordinates are approximate town centers. */
    var DAET_TOWN = 'Daet';
    var DAET_RADIUS_KM = 6.5;     // a free-typed / map-pinned point this close to Daet center counts as Daet
    var TOWNS = Object.freeze([
        { name: 'Talisay', lat: 14.1367, lng: 122.9190, hint: 'Talisay town proper' },
        { name: 'Vinzons', lat: 14.1733, lng: 122.9094, hint: 'Vinzons town proper' },
        { name: 'Mercedes', lat: 14.1103, lng: 123.0103, hint: 'Mercedes town proper' },
        { name: 'Basud', lat: 14.0667, lng: 122.9564, hint: 'Basud town proper' },
        { name: 'Labo', lat: 14.1573, lng: 122.8147, hint: 'Labo town proper' },
        { name: 'Paracale', lat: 14.2833, lng: 122.7833, hint: 'Paracale town proper' },
        { name: 'Jose Panganiban', lat: 14.2933, lng: 122.7036, hint: 'Jose Panganiban town proper' },
        { name: 'Capalonga', lat: 14.3367, lng: 122.4833, hint: 'Capalonga town proper' }
    ]);

    /** Search-able towns as place-like points (category "Town"). */
    var TOWN_POINTS = Object.freeze(TOWNS.map(function (t) {
        return Object.freeze({
            name: t.name + ' (town proper)', category: 'Town', lat: t.lat, lng: t.lng,
            description: 'Jeepney destination from Daet.', hint: t.hint, town: t.name
        });
    }));

    function kmBetween(a, b) {
        var R = 6371.0088, rad = Math.PI / 180;
        var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
        var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * R * Math.asin(Math.sqrt(h));
    }

    /** Which town a point belongs to: 'Daet', a town name, or 'Other'. */
    function townOf(point) {
        if (!point) return 'Other';
        if (point.town) return point.town;
        if (PLACES.indexOf(point) !== -1) return DAET_TOWN;
        var best = { name: 'Other', km: Infinity };
        TOWNS.forEach(function (t) {
            var km = kmBetween(point, t);
            if (km < best.km) best = { name: t.name, km: km };
        });
        if (kmBetween(point, CENTER) <= DAET_RADIUS_KM && best.km > 2.5) return DAET_TOWN;
        return best.km <= 4 ? best.name : 'Other';
    }

    /**
     * Which transport can serve a trip.
     * Tricycle: both ends in Daet.  Jeepney: one end in Daet, the other in another town.
     */
    function transportOptions(a, b) {
        var ta = townOf(a), tb = townOf(b);
        var daetA = ta === DAET_TOWN, daetB = tb === DAET_TOWN;
        var tricycle = daetA && daetB;
        var jeepney = (daetA && !daetB && tb !== 'Other') || (!daetA && daetB && ta !== 'Other');
        var reason = '';
        if (!tricycle && !jeepney) {
            reason = (ta === 'Other' || tb === 'Other')
                ? 'Sa Daet lang at sa mga kalapit na bayan (Daet ↔ ibang bayan) available ang sakayan sa app na ito.'
                : 'Jeepney lang ang biyahe papunta sa ibang bayan, at kailangang Daet ang isang dulo ng biyahe.';
        } else if (tricycle) {
            reason = 'Sa loob ng Daet, tricycle lang ang sakayan (walang jeep).';
        } else {
            reason = 'Papunta sa ibang bayan, jeepney ang sakayan. Hindi umaabot ang tricycle.';
        }
        return { tricycle: tricycle, jeepney: jeepney, reason: reason, from: ta, to: tb };
    }

    /**
     * How well a place matches what the user typed. Only the NAME and the ADDRESS (hint)
     * are searched; the description is never used for searching.
     * Returns -1 (no match) or a rank where a LOWER number is a BETTER match:
     *   0 name starts with the text      3 address starts a word with the text
     *   1 a word in the name starts it   4 address contains the text
     *   2 name contains the text
     */
    function matchRank(point, query) {
        var q = String(query || '').trim().toLowerCase();
        if (!q || !point) return -1;
        var name = String(point.name || '').toLowerCase();
        var address = String(point.hint || '').toLowerCase();
        function wordStart(text) {
            return (' ' + text.replace(/[(),.\-]/g, ' ')).indexOf(' ' + q) !== -1;
        }
        if (name.indexOf(q) === 0) return 0;
        if (wordStart(name)) return 1;
        if (name.indexOf(q) !== -1) return 2;
        if (wordStart(address)) return 3;
        if (address.indexOf(q) !== -1) return 4;
        return -1;
    }

    /** Accepts a place index or a point object; returns a point or null. */
    function resolvePoint(x) {
        if (x && typeof x === 'object' && typeof x.lat === 'number' && typeof x.lng === 'number') return x;
        return isValidPlaceIndex(x) ? PLACES[x] : null;
    }

    CB.data = {
        CATEGORY: CATEGORY,
        CENTER: CENTER,
        PLACES: PLACES,
        IDX: IDX,
        ROUTES: ROUTES,
        USER_TYPES: USER_TYPES,
        routeLabel: routeLabel,
        TOWNS: TOWNS,
        TOWN_POINTS: TOWN_POINTS,
        DAET_TOWN: DAET_TOWN,
        DAET_RADIUS_KM: DAET_RADIUS_KM,
        kmBetween: kmBetween,
        townOf: townOf,
        transportOptions: transportOptions,
        resolvePoint: resolvePoint,
        matchRank: matchRank,
        isValidPlaceIndex: isValidPlaceIndex
    };
})(window.CB = window.CB || {});
