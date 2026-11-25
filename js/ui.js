/* =========================================================
   ui.js - Shared user-interface helpers
   - Renders the header and bottom navigation on every page
     (web version of BottomNavHelper.java)
   - Reads/writes trip data in the URL (web version of
     Intent extras: ?start=0&dest=6&transport=Tricycle)
   - Toast messages, online/offline banner, small utilities
   ========================================================= */
(function (CB) {
    'use strict';

    /* ---------- Icons (inline SVG, stroke-based) ---------- */
    var ICONS = {
        home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
        routes: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
        fares: '<circle cx="12" cy="12" r="9"/><path d="M9.5 17V7h3.25a3 3 0 0 1 0 6H9.5"/><path d="M8 9.5h8"/><path d="M8 11.5h8"/>',
        places: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
        feedback: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
        wifiOff: '<path d="M2 8.8a16 16 0 0 1 5.3-3.1"/><path d="M22 8.8a16 16 0 0 0-9.8-3.7"/><path d="M5 12.5a11 11 0 0 1 3.6-2.2"/><path d="M19 12.5a11 11 0 0 0-2.4-1.7"/><path d="M8.5 16.1a6 6 0 0 1 7 0"/><path d="M12 20h.01"/><path d="M3 3l18 18"/>'
    };

    function icon(name, extraClass) {
        return '<svg class="icon ' + (extraClass || '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
            (ICONS[name] || '') + '</svg>';
    }

    var BRAND_MARK = '<svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true">' +
        '<rect width="48" height="48" rx="12" fill="#1565C0"/>' +
        '<path d="M24 38s-10-8.6-10-16a10 10 0 0 1 20 0c0 7.4-10 16-10 16z" fill="#fff"/>' +
        '<circle cx="24" cy="22" r="4.2" fill="#FF8F00"/></svg>';

    /* ---------- Navigation (same 5 tabs as the Android bottom bar) ---------- */
    var NAV = [
        { key: 'home', label: 'Home', href: 'home.html' },
        { key: 'routes', label: 'Routes', href: 'routes.html' },
        { key: 'fares', label: 'Fares', href: 'fares.html' },
        { key: 'places', label: 'Places', href: 'places.html' },
        { key: 'feedback', label: 'Feedback', href: 'feedback.html' }
    ];

    function navLinks(active, linkClass) {
        return NAV.map(function (item) {
            var isActive = item.key === active;
            return '<a class="' + linkClass + (isActive ? ' is-active' : '') + '" href="' + item.href + '"' +
                (isActive ? ' aria-current="page"' : '') + '>' +
                icon(item.key) + '<span>' + item.label + '</span></a>';
        }).join('');
    }

    function renderChrome(active) {
        var header = document.getElementById('app-header');
        var bottom = document.getElementById('bottom-nav');
        var type = CB.storage.prefs.getUserType() || 'Choose type';

        if (header) {
            header.innerHTML =
                '<div class="container header-inner">' +
                    '<a class="brand" href="home.html" aria-label="Commuter Buddy home">' + BRAND_MARK +
                        '<span class="brand-text"><strong>Commuter Buddy</strong><small>Daet, Camarines Norte</small></span>' +
                    '</a>' +
                    '<nav class="top-nav" aria-label="Main navigation">' + navLinks(active, 'top-nav__link') + '</nav>' +
                    '<a class="user-chip" href="index.html?change=1" title="Change user type">' +
                        icon('user') + '<span>' + escapeHtml(type) + '</span></a>' +
                '</div>';
        }
        if (bottom) {
            bottom.innerHTML = navLinks(active, 'bottom-nav__link');
        }
    }

    /* ---------- Toast messages ---------- */
    var toastTimer = null;

    function toast(message, variant, duration) {
        var el = document.getElementById('toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toast';
            el.className = 'toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.className = 'toast toast--' + (variant || 'info') + ' is-visible';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            el.classList.remove('is-visible');
        }, duration || 3200);
    }

    /* ---------- Online / offline banner ---------- */
    function setupNetworkBanner() {
        var banner = document.createElement('div');
        banner.className = 'net-banner';
        banner.setAttribute('role', 'status');
        banner.innerHTML = icon('wifiOff') +
            '<span>You’re offline. Saved pages, fares and feedback still work; the live map needs internet.</span>';
        document.body.insertBefore(banner, document.body.firstChild);

        function update() {
            banner.classList.toggle('is-visible', !navigator.onLine);
        }
        window.addEventListener('online', function () {
            update();
            toast('You’re back online.', 'success');
        });
        window.addEventListener('offline', update);
        update();
    }

    function setupStorageNotice() {
        if (CB.storage.isPersistent()) return;
        toast('Your browser is blocking storage, so your choices will not be saved after you close this page.', 'error', 6000);
    }

    /* ---------- Trip data in the URL (Intent extras) ---------- */
    function parseIndex(value) {
        if (value === null || value === '' || !/^\d+$/.test(value)) return null;
        var n = parseInt(value, 10);
        return CB.data.isValidPlaceIndex(n) ? n : null;
    }

    /** A custom (typed / map-picked) point stored in the URL as slat, slng, sname (or dlat, dlng, dname). */
    function parseCustomPoint(params, prefix) {
        var lat = parseFloat(params.get(prefix + 'lat'));
        var lng = parseFloat(params.get(prefix + 'lng'));
        var name = (params.get(prefix + 'name') || '').trim().slice(0, 120);
        if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !name) return null;
        return { name: name, lat: lat, lng: lng, category: 'Place', hint: '' };
    }

    /**
     * Reads ?start=&dest=&transport= (place numbers) or custom points
     * (slat/slng/sname, dlat/dlng/dname). start/dest are a place index or a point object.
     */
    function getTripParams() {
        var params = new URLSearchParams(window.location.search);
        var start = parseIndex(params.get('start'));
        var dest = parseIndex(params.get('dest'));
        var startPoint = start === null ? parseCustomPoint(params, 's') : null;
        var destPoint = dest === null ? parseCustomPoint(params, 'd') : null;
        var transport = params.get('transport');
        var hasStart = start !== null || !!startPoint;
        var hasDest = dest !== null || !!destPoint;

        return {
            start: startPoint || (start === null ? CB.data.IDX.MARKET : start),
            dest: destPoint || (dest === null ? CB.data.IDX.BAGASBAS : dest),
            transport: CB.fare.isValidTransport(transport) ? transport : CB.fare.TRICYCLE,
            hasTrip: hasStart && hasDest
        };
    }

    function addPointParams(params, ref, indexKey, prefix) {
        if (typeof ref === 'number') {
            params.set(indexKey, ref);
        } else if (ref && typeof ref === 'object') {
            var idx = CB.data.PLACES.indexOf(ref);
            if (idx !== -1) {
                params.set(indexKey, idx);
            } else {
                params.set(prefix + 'lat', ref.lat.toFixed(5));
                params.set(prefix + 'lng', ref.lng.toFixed(5));
                params.set(prefix + 'name', ref.name);
            }
        }
    }

    function tripUrl(page, start, dest, transport) {
        var params = new URLSearchParams();
        addPointParams(params, start, 'start', 's');
        addPointParams(params, dest, 'dest', 'd');
        params.set('transport', transport);
        return page + '?' + params.toString();
    }

    /** Point (object) for a place index or point. */
    function toPoint(ref) {
        return CB.data.resolvePoint(ref);
    }

    /* ---------- Form helpers ---------- */
    function fillPlaceSelect(select, selectedIndex) {
        select.innerHTML = CB.data.PLACES.map(function (p, i) {
            return '<option value="' + i + '">' + escapeHtml(p.name) + '</option>';
        }).join('');
        select.value = String(selectedIndex);
    }

    function getTransport(form) {
        var checked = form.querySelector('input[name="transport"]:checked');
        return checked ? checked.value : CB.fare.TRICYCLE;
    }

    /** Day / Night switch: 'day' or 'night'. Default follows the clock (night fare hours). */
    function getNight(form) {
        var checked = form.querySelector('input[name="daynight"]:checked');
        return checked ? checked.value === 'night' : CB.fare.isNight();
    }

    function setNight(form, night) {
        var input = form.querySelector('input[name="daynight"][value="' + (night ? 'night' : 'day') + '"]');
        if (input) input.checked = true;
    }

    /** "Special trip" switch (tricycle only). Returns true when it is ticked and usable. */
    function getSpecial(form) {
        var box = form.querySelector('input[name="special"]');
        return !!(box && box.checked && !box.disabled);
    }

    function setTransport(form, value) {
        var input = form.querySelector('input[name="transport"][value="' + value + '"]');
        if (input) input.checked = true;
    }

    /** Shows or clears an inline error message linked to a field. */
    function setFieldError(field, message) {
        var wrapper = field.closest('.field') || field.parentElement;
        var error = wrapper.querySelector('.field-error');
        if (!error) return;
        error.textContent = message || '';
        wrapper.classList.toggle('has-error', !!message);
        if (field.setAttribute) field.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    /* ---------- Small utilities ---------- */
    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(timestamp) {
        try {
            return new Date(timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
            return new Date(timestamp).toDateString();
        }
    }

    function stars(n) {
        return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    }

    /** Sends users who have not picked a user type to the first screen (like the Android launcher). */
    function requireUserType(currentPage) {
        var type = CB.storage.prefs.getUserType();
        if (!type) {
            window.location.replace('index.html?next=' + encodeURIComponent(currentPage));
            return null;
        }
        return type;
    }

    /** Common setup for every inner page. Returns the user type (or null while redirecting). */
    function initPage(pageKey) {
        var type = requireUserType(pageKey + '.html' + window.location.search);
        if (!type) return null;
        renderChrome(pageKey);
        setupNetworkBanner();
        setupStorageNotice();
        if (CB.pwa) CB.pwa.init();
        return type;
    }

    CB.ui = {
        ICONS: ICONS,
        icon: icon,
        BRAND_MARK: BRAND_MARK,
        renderChrome: renderChrome,
        toast: toast,
        getTripParams: getTripParams,
        toPoint: toPoint,
        tripUrl: tripUrl,
        fillPlaceSelect: fillPlaceSelect,
        getTransport: getTransport,
        getNight: getNight,
        getSpecial: getSpecial,
        setNight: setNight,
        setTransport: setTransport,
        setFieldError: setFieldError,
        escapeHtml: escapeHtml,
        formatDate: formatDate,
        stars: stars,
        initPage: initPage,
        setupNetworkBanner: setupNetworkBanner
    };
})(window.CB = window.CB || {});
