/* =========================================================
   ocr.js - Machine Learning: read the vehicle number from a photo

   Used by the Feedback "photo captcha". The commuter takes a
   photo of the number painted on the tricycle (body number)
   and an AI model reads the digits. The commuter then TYPES
   the number, and the feedback is accepted only when the typed
   number matches what the AI read: proof that the commuter
   really was beside that vehicle.

   HOW IT WORKS
   - Model: Tesseract (LSTM neural-network OCR) running through
     Tesseract.js, which compiles it to WebAssembly. It runs
     INSIDE the browser: the photo never leaves the phone and
     is never saved or uploaded.
   - The library (about 3 MB) and the English model are loaded
     only the first time a commuter opens the captcha, then kept
     by the browser for offline use.
   - Before reading, the photo is shrunk, turned to grey and its
     contrast is stretched. It is read twice (normal and
     inverted) so both dark-on-light and light-on-dark numbers
     work. Only the digits 0-9 are allowed.

   If the AI cannot be loaded (for example no internet the very
   first time), read() returns { ok: false, reason: 'engine' }
   and the Feedback page falls back to a manual confirmation.
   ========================================================= */
(function (CB) {
    'use strict';

    var LIB_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    var LOAD_TIMEOUT_MS = 40000;
    var MAX_SIDE = 1400;            // longest side of the photo given to the AI (pixels)
    var MIN_CONFIDENCE = 35;        // ignore words the AI is not sure about (0-100)
    var MIN_DIGITS = 2;
    var MAX_DIGITS = 8;

    var libPromise = null;
    var workerPromise = null;

    function withTimeout(promise, ms, label) {
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () { reject(new Error(label + ' timed out')); }, ms);
            promise.then(function (v) { clearTimeout(timer); resolve(v); },
                function (e) { clearTimeout(timer); reject(e); });
        });
    }

    function loadLibrary() {
        if (window.Tesseract) return Promise.resolve(window.Tesseract);
        if (!libPromise) {
            libPromise = new Promise(function (resolve, reject) {
                var script = document.createElement('script');
                script.src = LIB_URL;
                script.async = true;
                script.crossOrigin = 'anonymous';
                script.onload = function () { window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract missing')); };
                script.onerror = function () { reject(new Error('Could not load Tesseract.js')); };
                document.head.appendChild(script);
            }).catch(function (err) { libPromise = null; throw err; });
        }
        return libPromise;
    }

    function getWorker() {
        if (!workerPromise) {
            workerPromise = loadLibrary().then(function (T) {
                return T.createWorker('eng').then(function (worker) {
                    return worker.setParameters({
                        tessedit_char_whitelist: '0123456789',
                        tessedit_pageseg_mode: (T.PSM && T.PSM.SPARSE_TEXT) || '11',
                        user_defined_dpi: '300'
                    }).then(function () { return worker; });
                });
            }).catch(function (err) { workerPromise = null; throw err; });
        }
        return workerPromise;
    }

    /* ---------- Photo to canvas ---------- */
    function loadBitmap(file) {
        if (window.createImageBitmap) {
            return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () {
                return createImageBitmap(file);
            }).catch(function () { return loadImageElement(file); });
        }
        return loadImageElement(file);
    }

    function loadImageElement(file) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Not an image')); };
            img.src = url;
        });
    }

    /** Grey, contrast-stretched copy of the photo (and an inverted copy). */
    function makeVariants(source) {
        var w = source.width || source.naturalWidth;
        var h = source.height || source.naturalHeight;
        if (!w || !h) throw new Error('Empty image');
        var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));

        var base = document.createElement('canvas');
        base.width = cw;
        base.height = ch;
        var ctx = base.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, cw, ch);
        var img = ctx.getImageData(0, 0, cw, ch);
        var d = img.data;

        var grey = new Uint8Array(cw * ch);
        var hist = new Uint32Array(256);
        for (var i = 0, p = 0; i < d.length; i += 4, p++) {
            var g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
            grey[p] = g;
            hist[g]++;
        }
        // Stretch between the 2nd and 98th percentile so faded paint becomes clear
        var total = grey.length, acc = 0, lo = 0, hi = 255;
        for (var a = 0; a < 256; a++) { acc += hist[a]; if (acc >= total * 0.02) { lo = a; break; } }
        acc = 0;
        for (var b = 255; b >= 0; b--) { acc += hist[b]; if (acc >= total * 0.02) { hi = b; break; } }
        if (hi - lo < 20) { lo = 0; hi = 255; }
        var range = hi - lo;

        function paint(invert) {
            var canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            var c = canvas.getContext('2d');
            var out = c.createImageData(cw, ch);
            for (var q = 0, o = 0; q < grey.length; q++, o += 4) {
                var v = Math.max(0, Math.min(255, (grey[q] - lo) * 255 / range));
                if (invert) v = 255 - v;
                out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
                out.data[o + 3] = 255;
            }
            c.putImageData(out, 0, 0);
            return canvas;
        }
        return [paint(false), paint(true)];
    }

    /* ---------- Reading the digits ---------- */

    /** Every group of MIN_DIGITS..MAX_DIGITS digits in a piece of text. Pure function. */
    function extractNumbers(text) {
        return String(text || '').split(/\D+/).filter(function (t) {
            return t.length >= MIN_DIGITS && t.length <= MAX_DIGITS;
        });
    }

    function numbersFromResult(data) {
        var found = [];
        var words = (data && data.words) || [];
        if (words.length) {
            words.forEach(function (w) {
                if (w.confidence >= MIN_CONFIDENCE) found = found.concat(extractNumbers(w.text));
            });
        } else {
            found = extractNumbers(data && data.text);
        }
        return found;
    }

    /**
     * Reads the numbers in a photo (a File or Blob).
     * Resolves { ok: true, numbers: ['123', ...] }  (numbers may be empty: nothing readable), or
     *          { ok: false, reason: 'engine' | 'image' }.
     */
    function read(file) {
        var variants;
        return loadBitmap(file).then(function (bitmap) {
            variants = makeVariants(bitmap);
            if (bitmap.close) bitmap.close();
        }).catch(function () {
            throw { reason: 'image' };
        }).then(function () {
            return withTimeout(getWorker(), LOAD_TIMEOUT_MS, 'AI engine').catch(function () {
                throw { reason: 'engine' };
            });
        }).then(function (worker) {
            var numbers = [];
            return variants.reduce(function (chain, canvas) {
                return chain.then(function () {
                    return worker.recognize(canvas).then(function (res) {
                        numbers = numbers.concat(numbersFromResult(res.data));
                    });
                });
            }, Promise.resolve()).then(function () {
                return { ok: true, numbers: numbers.filter(function (n, i) { return numbers.indexOf(n) === i; }) };
            });
        }).catch(function (err) {
            return { ok: false, reason: (err && err.reason) || 'engine' };
        });
    }

    /** Typed number (digits only) must equal a number the AI read from the photo. */
    function matches(typed, numbers) {
        var t = String(typed || '').replace(/\D/g, '');
        return t.length >= MIN_DIGITS && (numbers || []).indexOf(t) !== -1;
    }

    CB.ocr = {
        MIN_DIGITS: MIN_DIGITS,
        MAX_DIGITS: MAX_DIGITS,
        read: read,
        matches: matches,
        extractNumbers: extractNumbers
    };
})(window.CB = window.CB || {});
