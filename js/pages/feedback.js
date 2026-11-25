/* =========================================================
   feedback.js - Anonymous trip feedback
   Web version of FeedbackActivity.java: trip selection,
   3 star ratings, actual fare and comment, input validation,
   a photo captcha (AI reads the vehicle number, see ocr.js),
   saving to localStorage, summary + recent list.
   ========================================================= */
(function (CB) {
    'use strict';

    var type = CB.ui.initPage('feedback');
    if (!type) return;

    // The feedback form is for telling us what the driver REALLY charged, even if it is far above
    // the official fare (e.g. P1,000), so there is no "500" limit. This is only a typing-error guard.
    var MAX_ACTUAL_FARE = 99999;
    var SHOWN = 10;
    var RATINGS = [
        { name: 'routeRating', label: 'Route information was accurate' },
        { name: 'fareRating', label: 'Estimated fare was accurate' },
        { name: 'overallRating', label: 'Overall trip experience' }
    ];
    var STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';

    var discounted = CB.storage.prefs.isDiscounted(type);
    var anonId = CB.storage.prefs.getAnonId();
    var anonName = CB.storage.prefs.getAnonName();
    var params = CB.ui.getTripParams();

    var form = document.getElementById('feedback-form');
    var startInput = document.getElementById('start');
    var destInput = document.getElementById('dest');
    var transportNote = document.getElementById('transport-note');
    var actualInput = document.getElementById('actual');
    var commentInput = document.getElementById('comment');
    var ratingError = document.getElementById('rating-error');
    var specialBox = document.getElementById('special');
    var currentEstimate = 0;

    /* ---------- Setup ---------- */
    document.getElementById('anon-text').innerHTML =
        'Submitting anonymously as <strong>' + CB.ui.escapeHtml(anonName) + '</strong> · ' + CB.ui.escapeHtml(type);

    var startBox = CB.search.attach(startInput, { onSelect: function () { updateEstimate(); } });
    var destBox = CB.search.attach(destInput, { onSelect: function () { updateEstimate(); } });
    startBox.setPoint(CB.ui.toPoint(params.start), true);
    destBox.setPoint(CB.ui.toPoint(params.dest), true);
    CB.ui.setTransport(form, params.transport);

    document.getElementById('ratings').innerHTML = RATINGS.map(function (r) {
        var stars = '';
        for (var v = 5; v >= 1; v--) {
            var id = r.name + '-' + v;
            stars += '<input type="radio" name="' + r.name + '" id="' + id + '" value="' + v + '">' +
                '<label for="' + id + '" title="' + v + ' star' + (v > 1 ? 's' : '') + '">' +
                '<span class="sr-only">' + v + ' star' + (v > 1 ? 's' : '') + '</span>' +
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_PATH + '"/></svg></label>';
        }
        return '<fieldset class="rating" id="fs-' + r.name + '">' +
            '<legend>' + r.label + '</legend><div class="stars">' + stars + '</div></fieldset>';
    }).join('');

    /* ---------- updateEstimate() in Android ---------- */
    function updateEstimate() {
        var a = startBox.getPoint();
        var b = destBox.getPoint();
        var box = document.getElementById('estimate-box');
        transportNote.hidden = true;
        currentEstimate = 0;
        if (!a || !b || a === b || (a.lat === b.lat && a.lng === b.lng)) {
            box.textContent = !a || !b ? 'Type and pick your start and destination' : 'Choose two different places';
            box.classList.add('is-empty');
            return;
        }
        // Tricycle inside Daet, jeepney only Daet <-> another town
        var allowed = CB.data.transportOptions(a, b);
        document.getElementById('t-tricycle').disabled = !allowed.tricycle;
        document.getElementById('t-jeepney').disabled = !allowed.jeepney;
        transportNote.textContent = allowed.reason;
        transportNote.hidden = false;
        if (!allowed.tricycle && !allowed.jeepney) {
            box.textContent = 'Walang sakayan para sa biyahe na ito';
            box.classList.add('is-empty');
            return;
        }
        if (CB.ui.getTransport(form) === CB.fare.TRICYCLE && !allowed.tricycle) CB.ui.setTransport(form, CB.fare.JEEPNEY);
        if (CB.ui.getTransport(form) === CB.fare.JEEPNEY && !allowed.jeepney) CB.ui.setTransport(form, CB.fare.TRICYCLE);

        function draw(trip) {
            currentEstimate = trip.fare;
            box.classList.remove('is-empty');
            box.innerHTML = '<span class="estimate-box__label">App&rsquo;s estimated fare: <strong>' +
                CB.fare.peso(trip.fare) + '</strong></span>' +
                '<span class="estimate-box__meta">' + (trip.approximate ? '≈ ' : '') + CB.fare.formatKm(trip.km) +
                ' by ' + trip.transport.toLowerCase() + (trip.special ? ' · special trip' : '') + '</span>';
        }
        var transport = CB.ui.getTransport(form);
        specialBox.disabled = transport !== CB.fare.TRICYCLE;   // a special trip only exists for tricycles
        var special = CB.ui.getSpecial(form);
        var trip = CB.roads.estimateNow(a, b, transport, discounted, { night: CB.fare.isNight(), special: special });
        if (!trip) return;
        draw(trip);
        if (trip.approximate) {
            CB.roads.distanceKm(a, b).then(function (km) {
                if (!km || startBox.getPoint() !== a || destBox.getPoint() !== b) return;
                draw(CB.fare.estimateTrip(a, b, transport, discounted, { km: km, night: CB.fare.isNight(), special: special }));
            });
        }
    }

    /* ---------- Validation ---------- */
    function getRating(name) {
        var checked = form.querySelector('input[name="' + name + '"]:checked');
        return checked ? parseInt(checked.value, 10) : 0;
    }

    function validate() {
        var errors = [];
        var s = startBox.getPoint();
        var d = destBox.getPoint();

        // 1. Trip (both places typed and picked, and a ride exists for them)
        CB.ui.setFieldError(startInput, '');
        if (!s) {
            CB.ui.setFieldError(startInput, 'Type and pick your starting place from the suggestions.');
            errors.push(startInput);
        }
        if (!d) {
            CB.ui.setFieldError(destInput, 'Type and pick your destination from the suggestions.');
            errors.push(destInput);
        } else if (s && (s === d || (s.lat === d.lat && s.lng === d.lng))) {
            CB.ui.setFieldError(destInput, 'Please choose the start and destination of your trip.');
            errors.push(destInput);
        } else if (s) {
            var allowed = CB.data.transportOptions(s, d);
            var tr = CB.ui.getTransport(form);
            if ((tr === CB.fare.TRICYCLE && !allowed.tricycle) || (tr === CB.fare.JEEPNEY && !allowed.jeepney)) {
                CB.ui.setFieldError(destInput, allowed.reason);
                errors.push(destInput);
            } else {
                CB.ui.setFieldError(destInput, '');
            }
        }

        // 2. Ratings (all three required)
        var missing = RATINGS.filter(function (r) {
            var empty = getRating(r.name) === 0;
            document.getElementById('fs-' + r.name).classList.toggle('has-error', empty);
            return empty;
        });
        ratingError.textContent = missing.length ? 'Please give all three ratings.' : '';
        if (missing.length) errors.push(form.querySelector('input[name="' + missing[0].name + '"]'));

        // 3. Actual fare (required, a whole number of pesos; can be higher than the estimate)
        var actual = actualInput.value.trim().replace(/,/g, '');
        if (!/^\d+$/.test(actual) || +actual < 1 || +actual > MAX_ACTUAL_FARE) {
            CB.ui.setFieldError(actualInput, 'Enter the amount you were charged as a whole number of pesos (at least 1).');
            errors.push(actualInput);
        } else {
            CB.ui.setFieldError(actualInput, '');
        }

        // 4. Comment (required, 3 to 300 characters)
        var comment = commentInput.value.trim();
        if (comment.length < 3) {
            CB.ui.setFieldError(commentInput, 'Please write a short comment (at least 3 characters).');
            errors.push(commentInput);
        } else if (comment.length > CB.storage.feedback.MAX_COMMENT) {
            CB.ui.setFieldError(commentInput, 'Please keep your comment under ' + CB.storage.feedback.MAX_COMMENT + ' characters.');
            errors.push(commentInput);
        } else {
            CB.ui.setFieldError(commentInput, '');
        }

        return errors;
    }

    /* ---------- submit() in Android: validate, ask the user to confirm, then save ----------
       The confirmation is a PHOTO CAPTCHA (Machine Learning): the commuter photographs the number
       on the vehicle, an on-device AI reads it, and the commuter types it. Feedback is accepted only
       when the typed number matches what the AI read from the photo. */
    var dialog = document.getElementById('confirm-dialog');
    var rodeBox = document.getElementById('confirm-rode');
    var confirmError = document.getElementById('confirm-error');
    var confirmButton = document.getElementById('confirm-submit');
    var photoInput = document.getElementById('captcha-photo');
    var pickButton = document.getElementById('captcha-pick');
    var resultBox = document.getElementById('captcha-result');
    var thumb = document.getElementById('captcha-thumb');
    var statusEl = document.getElementById('captcha-status');
    var numberInput = document.getElementById('captcha-number');

    // photo.state: 'none' | 'reading' | 'ready' (AI read numbers) | 'unreadable' (AI found no number) | 'manual' (AI unavailable)
    var photo = { state: 'none', numbers: [], token: 0, url: '' };

    function setPhotoStatus(kind, message) {
        statusEl.className = 'captcha__status' + (kind ? ' captcha__status--' + kind : '');
        statusEl.textContent = message;
    }

    function resetCaptcha() {
        photo.token++;                       // ignore any AI result still on its way
        if (photo.url) URL.revokeObjectURL(photo.url);
        photo = { state: 'none', numbers: [], token: photo.token, url: '' };
        photoInput.value = '';
        thumb.removeAttribute('src');
        resultBox.hidden = true;
        setPhotoStatus('', '');
        numberInput.value = '';
        document.getElementById('captcha-pick-label').textContent = 'Take a photo';
        confirmButton.disabled = false;
    }

    function openConfirm() {
        var transport = CB.ui.getTransport(form);
        var isTrike = transport === CB.fare.TRICYCLE;
        var a = startBox.getPoint();
        var b = destBox.getPoint();
        document.getElementById('confirm-text').textContent =
            'Please confirm that you rode a ' + transport.toLowerCase() + ' from ' + a.name + ' to ' + b.name + '.';
        document.getElementById('confirm-rode-label').textContent =
            'Yes, I rode the ' + transport.toLowerCase() + ' on this trip.';
        document.getElementById('confirm-username').textContent = anonName;
        document.getElementById('confirm-id-shown').textContent = anonId;
        document.getElementById('captcha-title').textContent =
            'Photo captcha: the ' + (isTrike ? 'tricycle' : 'jeepney') + ' number';
        document.getElementById('captcha-number-label').textContent = isTrike
            ? 'Type the tricycle number you photographed'
            : 'Type the digits of the jeepney plate number you photographed';
        resetCaptcha();
        rodeBox.checked = false;
        confirmError.textContent = '';
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    }

    function closeConfirm() {
        photo.token++;
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    function onPhotoChosen() {
        var file = photoInput.files && photoInput.files[0];
        if (!file) return;
        confirmError.textContent = '';
        if (!/^image\//.test(file.type) || file.size > 25 * 1024 * 1024) {
            confirmError.textContent = 'Please choose a photo (an image under 25 MB).';
            photoInput.value = '';
            return;
        }
        if (photo.url) URL.revokeObjectURL(photo.url);
        var mine = ++photo.token;
        photo.url = URL.createObjectURL(file);
        photo.state = 'reading';
        photo.numbers = [];
        thumb.src = photo.url;
        resultBox.hidden = false;
        setPhotoStatus('busy', 'The AI is reading the number… (the first time can take a little while)');
        document.getElementById('captcha-pick-label').textContent = 'Retake photo';
        confirmButton.disabled = true;

        CB.ocr.read(file).then(function (res) {
            if (mine !== photo.token) return;           // a newer photo or a closed dialog
            confirmButton.disabled = false;
            if (res.ok && res.numbers.length) {
                photo.state = 'ready';
                photo.numbers = res.numbers;
                setPhotoStatus('ok', 'The AI found a number in your photo. Now type the number you see on the vehicle.');
            } else if (res.ok) {
                photo.state = 'unreadable';
                setPhotoStatus('error', 'The AI could not read a number in this photo. Retake it closer, in good light, with the number facing the camera.');
            } else if (res.reason === 'image') {
                photo.state = 'none';
                setPhotoStatus('error', 'This photo could not be opened. Please try another photo.');
            } else {
                // The AI could not be loaded (for example no internet the first time): manual fallback
                photo.state = 'manual';
                setPhotoStatus('warn', 'The AI could not load right now, so your number cannot be checked automatically. You can still type the number; this feedback will be marked "not AI-verified".');
            }
        });
    }

    function checkCaptcha() {
        // Returns { ok, verified } or { ok: false, message }
        if (photo.state === 'none') return { ok: false, message: 'Take a photo of the number on the ' + CB.ui.getTransport(form).toLowerCase() + ' first.' };
        if (photo.state === 'reading') return { ok: false, message: 'Please wait. The AI is still reading your photo.' };
        if (photo.state === 'unreadable') return { ok: false, message: 'The AI could not read a number in your photo. Please retake it.' };
        var typed = numberInput.value.replace(/\D/g, '');
        if (typed.length < CB.ocr.MIN_DIGITS) {
            numberInput.focus();
            return { ok: false, message: 'Type the number you see on the vehicle (digits only).' };
        }
        if (photo.state === 'manual') return { ok: true, verified: false };
        if (!CB.ocr.matches(typed, photo.numbers)) {
            numberInput.focus();
            return { ok: false, message: 'The number you typed does not match the photo. Check the number, or retake a clearer photo.' };
        }
        return { ok: true, verified: true };
    }

    function submit(event) {
        event.preventDefault();
        var errors = validate();
        if (errors.length) {
            errors[0].focus();
            CB.ui.toast('Please check the highlighted fields.', 'error');
            return;
        }
        openConfirm();
    }

    function save(verified) {
        var a = startBox.getPoint();
        var b = destBox.getPoint();
        var result = CB.storage.feedback.add({
            anonId: anonId,
            userType: type,
            route: a.name + ' → ' + b.name,
            transport: CB.ui.getTransport(form),
            special: CB.ui.getSpecial(form),
            verified: verified,
            routeRating: getRating('routeRating'),
            fareRating: getRating('fareRating'),
            overallRating: getRating('overallRating'),
            estimatedFare: currentEstimate,
            actualFare: parseInt(actualInput.value.replace(/,/g, ''), 10),
            comment: commentInput.value.trim(),
            timestamp: Date.now()
        });

        if (!result.ok) {
            CB.ui.toast('Something went wrong. Please try again.', 'error');
            return;
        }
        CB.ui.toast(result.saved
            ? 'Thank you! Your feedback was submitted as ' + anonName + '.'
            : 'Submitted, but your browser blocked saving, so it will be lost when you close this page.',
            result.saved ? 'success' : 'error', 4500);

        // Clear ratings, fare and comment; keep the trip selection
        form.querySelectorAll('.stars input').forEach(function (input) { input.checked = false; });
        actualInput.value = '';
        commentInput.value = '';
        updateCounter();
        refreshList();
    }

    confirmButton.addEventListener('click', function () {
        if (!rodeBox.checked) {
            confirmError.textContent = 'Please tick the box to confirm that you rode this trip.';
            return;
        }
        var check = checkCaptcha();
        if (!check.ok) {
            confirmError.textContent = check.message;
            return;
        }
        closeConfirm();
        save(check.verified);
        resetCaptcha();
    });
    document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);
    document.getElementById('confirm-close').addEventListener('click', closeConfirm);
    dialog.addEventListener('close', function () { photo.token++; });
    rodeBox.addEventListener('change', function () { confirmError.textContent = ''; });
    pickButton.addEventListener('click', function () { photoInput.click(); });
    photoInput.addEventListener('change', onPhotoChosen);
    numberInput.addEventListener('input', function () {
        numberInput.value = numberInput.value.replace(/\D/g, '');
        confirmError.textContent = '';
    });

    /* ---------- refreshList() in Android ---------- */
    function starsHtml(value) {
        return '<span class="star-text" aria-label="' + value.toFixed(1) + ' out of 5">' +
            CB.ui.stars(Math.round(value)) + '</span>';
    }

    function renderSummary(stats) {
        var summary = document.getElementById('summary');
        if (!stats) {
            summary.hidden = true;
            return;
        }
        function bar(label, value) {
            return '<li><span>' + label + '</span>' +
                '<span class="bar"><i style="width:' + (value / 5 * 100).toFixed(0) + '%"></i></span>' +
                '<b>' + value.toFixed(1) + '</b></li>';
        }
        var note = stats.withActual
            ? 'The estimate matched the fare paid in <strong>' + Math.round(stats.matchRate * stats.withActual) +
              ' of ' + stats.withActual + '</strong> trip' + (stats.withActual > 1 ? 's' : '') + ' with a reported fare.'
            : 'No actual fares reported yet.';

        summary.innerHTML =
            '<div class="summary__overall">' +
                '<strong>' + stats.overall.toFixed(1) + '</strong>' + starsHtml(stats.overall) +
                '<small>Overall rating</small>' +
            '</div>' +
            '<ul class="summary__bars">' +
                bar('Route', stats.route) + bar('Fare', stats.fare) + bar('Overall', stats.overall) +
            '</ul>' +
            '<p class="summary__note">' + note + '</p>';
        summary.hidden = false;
    }

    function feedbackItem(f) {
        var fareNote = '';
        if (f.actualFare > 0) {
            var match = f.actualFare === f.estimatedFare;
            fareNote = '<p class="fare-note ' + (match ? 'fare-note--match' : 'fare-note--diff') + '">' +
                (match
                    ? 'Paid ' + CB.fare.peso(f.actualFare) + ' — matched the estimate'
                    : 'Estimated ' + CB.fare.peso(f.estimatedFare) + ', actually paid ' + CB.fare.peso(f.actualFare)) +
                '</p>';
        }
        return '<li class="feedback-item">' +
            '<div class="feedback-item__head">' +
                '<span class="feedback-item__avatar" aria-hidden="true">an</span>' +
                '<div class="feedback-item__who"><strong>' + CB.ui.escapeHtml(f.username) + '</strong>' +
                    '<small>' + (f.userType ? CB.ui.escapeHtml(f.userType) + ' · ' : '') + CB.ui.formatDate(f.timestamp) + '</small></div>' +
                starsHtml(f.overallRating) +
            '</div>' +
            '<p class="feedback-item__route">' + CB.ui.escapeHtml(f.route) + ' <span>(' + CB.ui.escapeHtml(f.transport) +
                (f.special ? ' · Special trip' : '') + ')</span>' +
                (f.verified ? ' <span class="badge badge--success" title="The commuter\'s photo of the vehicle number was checked by AI">Ride verified</span>' : '') + '</p>' +
            '<p class="feedback-item__ratings">Route ' + f.routeRating + '★ · Fare ' + f.fareRating +
                '★ · Overall ' + f.overallRating + '★</p>' +
            fareNote +
            (f.comment ? '<blockquote class="feedback-item__comment">“' + CB.ui.escapeHtml(f.comment) + '”</blockquote>' : '') +
        '</li>';
    }

    function refreshList() {
        var all = CB.storage.feedback.getAll();
        var n = all.length;
        document.getElementById('review-count').textContent = n + ' review' + (n === 1 ? '' : 's');
        document.getElementById('feedback-empty').hidden = n > 0;
        renderSummary(CB.storage.feedback.stats(all));
        document.getElementById('feedback-list').innerHTML = all.slice(0, SHOWN).map(feedbackItem).join('');
    }

    function updateCounter() {
        document.getElementById('comment-count').textContent =
            commentInput.value.length + ' / ' + CB.storage.feedback.MAX_COMMENT;
    }

    /* ---------- Events ---------- */
    form.addEventListener('change', function (event) {
        if (event.target.name === 'transport' || event.target.name === 'special') {
            CB.ui.setFieldError(destInput, '');
            updateEstimate();
        }
        if (event.target.closest('.rating')) {
            event.target.closest('.rating').classList.remove('has-error');
            if (!form.querySelector('.rating.has-error')) ratingError.textContent = '';
        }
    });
    actualInput.addEventListener('input', function () { CB.ui.setFieldError(actualInput, ''); });
    commentInput.addEventListener('input', updateCounter);
    form.addEventListener('submit', submit);

    updateEstimate();
    updateCounter();
    refreshList();
})(window.CB);
