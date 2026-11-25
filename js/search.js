/* =========================================================
   search.js - Type-to-search place boxes (From / To)
   Replaces the old drop-down lists. The user can TYPE any
   place; suggestions come from:
     1. Recent searches (shown when the box is empty/focused)
     2. Commuter Buddy places and jeepney towns (works offline).
        Only the place NAME and ADDRESS are searched (not the description),
        and name matches come first (typing "SM" lists SM City Daet first).
     3. Google Places Autocomplete (when a Google Maps key works)
        or OpenStreetMap Nominatim (no key, automatic backup)

   Usage:
     var box = CB.search.attach(inputEl, { onSelect: function (point) {...} });
     box.getPoint() / box.setPoint(point) / box.clear()
   A "point" is { name, lat, lng, category, hint }.
   ========================================================= */
(function (CB) {
    'use strict';

    var MIN_REMOTE_CHARS = 3;
    var DEBOUNCE_MS = 450;
    var NOMINATIM = 'https://nominatim.openstreetmap.org/';
    var USER_RADIUS_KM = 10;   // "From" box: places within this distance of the user's location

    /* ---------- Search area (scope) ----------
       'daet' : the "To" box. Only places inside the municipality of Daet.
       'user' : the "From" box. Only places around the user's location (when known);
                otherwise it falls back to Daet. */
    function makeScope(kind) {
        var pos = kind === 'user' && CB.geo && CB.geo.lastPosition ? CB.geo.lastPosition() : null;
        var center = pos ? { lat: pos.lat, lng: pos.lng } : CB.data.CENTER;
        var radius = pos ? USER_RADIUS_KM : (CB.data.DAET_RADIUS_KM || 6.5);
        var dLat = radius / 111;
        var dLng = radius / (111 * Math.cos(center.lat * Math.PI / 180));
        function contains(p) {
            return !!p && isFinite(p.lat) && isFinite(p.lng) && CB.fare.straightKm(center, p) <= radius;
        }
        return {
            nearUser: !!pos,
            center: center,
            radius: radius,
            viewbox: [center.lng - dLng, center.lat + dLat, center.lng + dLng, center.lat - dLat].join(','),
            bounds: { south: center.lat - dLat, west: center.lng - dLng, north: center.lat + dLat, east: center.lng + dLng },
            contains: contains,
            label: pos ? 'Near your location' : 'sa Daet',
            message: pos ? '"Only nearby locations can be used as starting points."' : '"Only locations within Daet can be searched."',
            pool: function () {
                var all = pos ? CB.data.PLACES.concat(CB.data.TOWN_POINTS) : CB.data.PLACES;
                return all.filter(contains);
            }
        };
    }

    var uid = 0;

    function localPool(scope) {
        return (scope || makeScope('daet')).pool();
    }

    /** Places whose NAME or ADDRESS matches, best match first. The description is not searched. */
    function localMatches(q, scope) {
        return localPool(scope).map(function (p, i) {
            return { p: p, rank: CB.data.matchRank(p, q), i: i };
        }).filter(function (m) { return m.rank !== -1; }).sort(function (a, b) {
            return a.rank - b.rank || a.i - b.i;
        }).map(function (m) { return m.p; });
    }

    /* ---------- Remote providers ---------- */
    function googleMaps() {
        return (CB.map && CB.map.whenGoogle) ? CB.map.whenGoogle() : Promise.resolve(null);
    }

    function googleSuggest(q, scope) {
        scope = scope || makeScope('daet');
        return googleMaps().then(function (gm) {
            if (!gm) return null;
            return gm.importLibrary('places').then(function (lib) {
                if (!lib.AutocompleteSuggestion) return null;
                return lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                    input: q,
                    includedRegionCodes: ['ph'],
                    locationRestriction: scope.bounds
                }).then(function (res) {
                    return (res.suggestions || []).filter(function (s) { return s.placePrediction; }).slice(0, 5).map(function (s) {
                        var pp = s.placePrediction;
                        return {
                            source: 'Google',
                            name: pp.mainText ? pp.mainText.text : pp.text.text,
                            hint: pp.secondaryText ? pp.secondaryText.text : '',
                            prediction: pp
                        };
                    });
                });
            });
        }).catch(function () { return null; });
    }

    function googleResolve(item) {
        var place = item.prediction.toPlace();
        return place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] }).then(function () {
            var loc = place.location;
            return {
                name: place.displayName || item.name,
                hint: place.formattedAddress || item.hint,
                lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
                lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
                category: 'Place'
            };
        });
    }

    function nominatimRaw(q, signal, limit, scope) {
        var url = NOMINATIM + 'search?format=jsonv2&limit=' + (limit || 5) + '&countrycodes=ph&viewbox=' + scope.viewbox +
            '&bounded=1&q=' + encodeURIComponent(q);
        return fetch(url, signal ? { signal: signal } : undefined).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        }).then(function (list) {
            return (list || []).map(function (it) {
                var parts = String(it.display_name || '').split(',');
                var name = (it.name || parts[0] || q).trim();
                var hint = parts.slice(1, 3).join(',').trim();
                return {
                    source: 'OpenStreetMap',
                    name: name,
                    hint: hint,
                    point: { name: name, lat: parseFloat(it.lat), lng: parseFloat(it.lon), category: 'Place', hint: hint }
                };
            }).filter(function (it) { return isFinite(it.point.lat) && isFinite(it.point.lng); });
        });
    }

    function dedupe(list) {
        var seen = {};
        return list.filter(function (it) {
            var k = it.point.lat.toFixed(4) + ',' + it.point.lng.toFixed(4);
            if (seen[k]) return false;
            seen[k] = true;
            return true;
        });
    }

    /** Finds places by text, only inside the scope (Daet municipality, or around the user). */
    function nominatimSuggest(q, signal, limit, scope) {
        scope = scope || makeScope('daet');
        function inside(list) { return dedupe(list.filter(function (it) { return scope.contains(it.point); })); }
        return nominatimRaw(q, signal, limit, scope).then(function (a) {
            a = inside(a);
            if (a.length || !/daet/i.test(scope.label)) return a;
            return nominatimRaw(q + ', Daet', signal, limit, scope).then(inside);
        });
    }

    /** "14.1234, 122.9876" typed straight into the box. */
    function parseCoords(q) {
        var m = String(q).trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
        if (!m) return null;
        var lat = parseFloat(m[1]), lng = parseFloat(m[2]);
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        return { name: 'Pinned location (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')', lat: lat, lng: lng,
            category: 'Pinned on map', hint: lat.toFixed(4) + ', ' + lng.toFixed(4) };
    }

    /** Resolves a typed text to a single point (or null): coordinates, an exact local name, then online search. */
    function resolveText(q, signal, scope) {
        scope = scope || makeScope('daet');
        q = String(q || '').trim();
        if (!q) return Promise.resolve(null);
        var coords = parseCoords(q);
        if (coords) return Promise.resolve(scope.contains(coords) ? coords : null);
        var lower = q.toLowerCase();
        var local = localMatches(q, scope)[0];
        if (local && local.name.toLowerCase() === lower) return Promise.resolve(local);
        if (!navigator.onLine || !window.fetch) return Promise.resolve(local || null);
        return googleSuggest(q, scope).then(function (g) {
            if (g && g.length) return googleResolve(g[0]).catch(function () { return null; });
            return null;
        }).then(function (gp) {
            if (gp && scope.contains(gp)) return gp;
            return nominatimSuggest(q, signal, 1, scope).then(function (r) { return r.length ? r[0].point : (local || null); });
        }).catch(function () { return local || null; });
    }

    /** Name for a spot picked on the map. */
    function reverse(lat, lng) {
        var fallback = 'Pinned location (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')';
        if (!navigator.onLine || !window.fetch) return Promise.resolve(fallback);
        var url = NOMINATIM + 'reverse?format=jsonv2&zoom=18&lat=' + lat + '&lon=' + lng;
        return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
            if (!d) return fallback;
            var parts = String(d.display_name || '').split(',');
            var name = (d.name || parts[0] || '').trim();
            return name ? name + (parts[1] ? ', ' + parts[1].trim() : '') : fallback;
        }).catch(function () { return fallback; });
    }

    /* ---------- The combobox ---------- */
    function attach(input, options) {
        options = options || {};
        uid++;
        var listId = 'combo-list-' + uid;
        var wrapper = input.closest('.field') || input.parentElement;
        wrapper.classList.add('combo');

        var list = document.createElement('ul');
        list.className = 'combo-list';
        list.id = listId;
        list.setAttribute('role', 'listbox');
        list.hidden = true;
        input.insertAdjacentElement('afterend', list);

        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', listId);
        input.setAttribute('autocomplete', 'off');

        function sc() { return makeScope(options.scope || 'daet'); }
        var point = null;
        var items = [];
        var active = -1;
        var timer = null;
        var requestId = 0;
        var controller = null;

        function close() {
            list.hidden = true;
            input.setAttribute('aria-expanded', 'false');
            active = -1;
        }

        function render(sections) {
            items = [];
            var html = '';
            sections.forEach(function (sec) {
                if (!sec.items.length) return;
                html += '<li class="combo-heading" role="presentation">' + CB.ui.escapeHtml(sec.title) + '</li>';
                sec.items.forEach(function (it) {
                    var idx = items.push(it) - 1;
                    html += '<li class="combo-item" role="option" id="' + listId + '-' + idx + '" data-i="' + idx + '">' +
                        '<span class="combo-item__name">' + CB.ui.escapeHtml(it.name) + '</span>' +
                        '<small>' + CB.ui.escapeHtml(it.hint || it.category || '') + '</small></li>';
                });
            });
            var typed = input.value.trim();
            if (typed.length >= 2) {
                var sidx = items.push({ source: 'Search', name: 'Search for“' + typed + '” ' + sc().label, hint: 'Search for "' + typed + '"', query: typed }) - 1;
                html += '<li class="combo-heading" role="presentation">Wala sa listahan?</li>' +
                    '<li class="combo-item combo-item--search" role="option" id="' + listId + '-' + sidx + '" data-i="' + sidx + '">' +
                    '<span class="combo-item__name">' + CB.ui.escapeHtml(items[sidx].name) + '</span>' +
                    '<small>' + CB.ui.escapeHtml(items[sidx].hint) + '</small></li>';
            }
            if (!html) html = '<li class="combo-empty" role="presentation">Walang nahanap. Subukan ang ibang pangalan.</li>';
            list.innerHTML = html;
            list.hidden = false;
            input.setAttribute('aria-expanded', 'true');
            active = -1;
        }

        function recentSections() {
            var scope = sc();
            var recent = CB.storage.recent.places().filter(scope.contains);
            var inRecent = function (p) { return recent.some(function (r) { return r.name === p.name; }); };
            var popular = scope.pool().filter(function (p) { return CB.data.PLACES.indexOf(p) !== -1; }).slice(0, 6).filter(function (p) { return !inRecent(p); });
            return [
                { title: 'Recent searches', items: recent.map(function (p) { return Object.assign({ source: 'Recent' }, p); }) },
                { title: scope.nearUser ? 'Places near you' : 'Places in Daet', items: popular.map(function (p) { return Object.assign({ source: 'Local' }, p); }) }
            ];
        }

        // browse = true when the box is just focused/tapped (not typed in): show recent searches
        function show(browse) {
            var q = input.value.trim();
            if (!q || (browse && point)) {
                render(recentSections());
                return;
            }
            var scope = sc();
            var local = localMatches(q, scope).slice(0, 6).map(function (p) { return Object.assign({ source: 'Local' }, p); });
            var recent = CB.storage.recent.places().filter(function (p) {
                return scope.contains(p) && CB.data.matchRank(p, q) !== -1 &&
                    !local.some(function (l) { return l.name === p.name; });
            }).map(function (p) { return Object.assign({ source: 'Recent' }, p); });
            render([{ title: 'Recent searches', items: recent }, { title: 'Places', items: local }]);
            scheduleRemote(q, local.length + recent.length);
        }

        function scheduleRemote(q, localCount) {
            clearTimeout(timer);
            if (q.length < MIN_REMOTE_CHARS || !navigator.onLine) return;
            var mine = ++requestId;
            timer = setTimeout(function () {
                if (controller) controller.abort();
                controller = window.AbortController ? new AbortController() : null;
                var scope = sc();
                googleSuggest(q, scope).then(function (g) {
                    if (g) return g;
                    return nominatimSuggest(q, controller && controller.signal, 5, scope);
                }).then(function (more) {
                    if (mine !== requestId || input.value.trim() !== q || list.hidden) return;
                    more = (more || []).filter(function (m) {
                        return !items.some(function (it) { return it.name.toLowerCase() === m.name.toLowerCase(); });
                    });
                    if (!more.length) return;
                    var current = {};
                    var sections = [];
                    var byTitle = [
                        { title: 'Recent searches', items: items.filter(function (i) { return i.source === 'Recent'; }) },
                        { title: 'Places', items: items.filter(function (i) { return i.source === 'Local'; }) },
                        { title: more[0].source === 'Google' ? 'Google Maps' : 'More places (OpenStreetMap)', items: more }
                    ];
                    render(byTitle);
                }).catch(function () { /* offline or blocked: local results stay */ });
            }, DEBOUNCE_MS);
        }

        function setActive(i) {
            var nodes = list.querySelectorAll('.combo-item');
            if (!nodes.length) return;
            active = (i + nodes.length) % nodes.length;
            nodes.forEach(function (n, k) { n.classList.toggle('is-active', k === active); });
            input.setAttribute('aria-activedescendant', nodes[active].id);
            nodes[active].scrollIntoView({ block: 'nearest' });
        }

        function choose(item) {
            close();
            var done = function (p) {
                point = p;
                input.value = p.name;
                CB.ui.setFieldError(input, '');
                CB.storage.recent.addPlace(p);
                if (options.onSelect) options.onSelect(p);
            };
            if (item.source === 'Search') {
                resolveTyped().then(function (p) {
                    if (p) done(p);
                    else CB.ui.toast('Hindi mahanap ang “' + item.query + '”. ' + sc().message, 'error');
                });
            } else if (item.source === 'Google') {
                googleResolve(item).then(function (p) {
                    if (!sc().contains(p)) { CB.ui.toast(sc().message, 'error'); return; }
                    done(p);
                }).catch(function () {
                    CB.ui.toast('Hindi ma-load ang lugar na iyon. Subukan ang iba.', 'error');
                });
            } else if (item.point) {
                done(item.point);
            } else {
                done({ name: item.name, lat: item.lat, lng: item.lng, category: item.category, hint: item.hint,
                    description: item.description, town: item.town });
            }
        }

        var resolving = null;
        /** Looks up whatever is typed in the box (used when nothing was picked from the list). */
        function resolveTyped() {
            if (point) return Promise.resolve(point);
            var q = input.value.trim();
            if (!q) return Promise.resolve(null);
            if (resolving && resolving.q === q) return resolving.promise;
            input.setAttribute('aria-busy', 'true');
            var promise = resolveText(q, null, sc()).then(function (p) {
                input.removeAttribute('aria-busy');
                resolving = null;
                if (p && input.value.trim() === q) {
                    point = p;
                    input.value = p.name;
                    CB.ui.setFieldError(input, '');
                    CB.storage.recent.addPlace(p);
                    if (options.onSelect) options.onSelect(p);
                }
                return point;
            });
            resolving = { q: q, promise: promise };
            return promise;
        }

        input.addEventListener('focus', function () { show(true); });
        // Tapping a box that already has focus should also open the suggestions / recent searches
        input.addEventListener('click', function () { if (list.hidden) show(true); });
        input.addEventListener('input', function () {
            point = null;          // typed text no longer matches a chosen place
            show();
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) show(true); else setActive(active + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
            else if (e.key === 'Escape') { close(); }
            else if (e.key === 'Enter' && !list.hidden) {
                var pick = items[active >= 0 ? active : 0];
                if (pick && (active >= 0 || input.value.trim())) { e.preventDefault(); choose(pick); }
            }
        });
        list.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep focus in the input
        list.addEventListener('click', function (e) {
            var li = e.target.closest('[data-i]');
            if (li) choose(items[parseInt(li.getAttribute('data-i'), 10)]);
        });
        input.addEventListener('blur', function () {
            setTimeout(function () {
                close();
                // Exact local name typed without clicking: accept it
                if (!point && input.value.trim()) {
                    var q = input.value.trim().toLowerCase();
                    var exact = localPool(sc()).filter(function (p) { return p.name.toLowerCase() === q; })[0];
                    if (exact) choose(Object.assign({ source: 'Local' }, exact));
                    else if (q.length >= 3) resolveTyped();   // not in any list: find it on the map
                }
            }, 120);
        });
        document.addEventListener('click', function (e) { if (!wrapper.contains(e.target)) close(); });

        return {
            getPoint: function () { return point; },
            setPoint: function (p, silent) {
                point = p || null;
                input.value = p ? p.name : '';
                if (p) CB.ui.setFieldError(input, '');
                if (p && !silent && options.onSelect) options.onSelect(p);
            },
            clear: function () { point = null; input.value = ''; },
            resolve: resolveTyped,
            focus: function () { input.focus(); }
        };
    }

    CB.search = { attach: attach, reverse: reverse, localMatches: localMatches, nominatim: nominatimSuggest, resolveText: resolveText, scope: makeScope };
})(window.CB = window.CB || {});
