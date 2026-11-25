/* =========================================================
   pwa.js - Progressive Web App features
   Emerging technology: the website can be installed on a
   phone's home screen like the Android app and keeps
   working offline thanks to a service worker cache.
   ========================================================= */
(function (CB) {
    'use strict';

    var deferredPrompt = null;
    var initialized = false;

    function canUseServiceWorker() {
        var local = ['localhost', '127.0.0.1'].indexOf(window.location.hostname) !== -1;
        return 'serviceWorker' in navigator && (window.location.protocol === 'https:' || local);
    }

    function isStandalone() {
        return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
            window.navigator.standalone === true;
    }

    function isIos() {
        return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    }

    function setInstallVisible(visible) {
        document.querySelectorAll('[data-install-card]').forEach(function (el) {
            el.hidden = !visible;
        });
    }

    function setOfflineStatus(text, ready) {
        document.querySelectorAll('[data-offline-status]').forEach(function (el) {
            el.textContent = text;
            el.classList.toggle('is-ready', !!ready);
        });
    }

    function registerServiceWorker() {
        if (!canUseServiceWorker()) {
            setOfflineStatus('Offline mode turns on when the app is opened online (HTTPS).', false);
            return;
        }
        navigator.serviceWorker.register('service-worker.js').then(function () {
            return navigator.serviceWorker.ready;
        }).then(function () {
            setOfflineStatus('Ready to use offline', true);
        }).catch(function () {
            setOfflineStatus('Offline mode is not available in this browser.', false);
        });
    }

    function promptInstall() {
        if (!deferredPrompt) {
            if (isIos()) {
                CB.ui.toast('On iPhone: tap Share, then “Add to Home Screen”.', 'info', 5000);
            } else {
                CB.ui.toast('Use your browser menu and choose “Install app” or “Add to Home screen”.', 'info', 5000);
            }
            return;
        }
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
            if (choice.outcome === 'accepted') CB.ui.toast('Installing Commuter Buddy…', 'success');
            deferredPrompt = null;
        });
    }

    function init() {
        if (initialized) return;
        initialized = true;

        registerServiceWorker();

        // Show the install card when the browser says the app is installable,
        // or on iPhone/iPad where installing is done manually.
        setInstallVisible(!isStandalone() && isIos());

        window.addEventListener('beforeinstallprompt', function (event) {
            event.preventDefault();
            deferredPrompt = event;
            setInstallVisible(true);
        });

        window.addEventListener('appinstalled', function () {
            deferredPrompt = null;
            setInstallVisible(false);
            CB.ui.toast('Commuter Buddy was added to your home screen.', 'success');
        });

        document.addEventListener('click', function (event) {
            var btn = event.target.closest('[data-install]');
            if (btn) promptInstall();
        });
    }

    CB.pwa = { init: init, isStandalone: isStandalone };
})(window.CB = window.CB || {});
