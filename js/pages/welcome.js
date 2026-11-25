/* =========================================================
   welcome.js - First screen: choose a user type
   Web version of UserTypeActivity.java
   ========================================================= */
(function (CB) {
    'use strict';

    // Small icon for each user type (same order as CB.data.USER_TYPES)
    var TYPE_ICONS = [
        '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
        '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
        '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v6h5l2 6"/><path d="M8.5 10.5a6 6 0 1 0 7.5 8.4"/>',
        '<circle cx="11" cy="4.5" r="2"/><path d="M11 7l-1 6 3 3v5"/><path d="M10 13l-3 8"/><path d="M15 10v11"/><path d="M9 9l-2 3"/>',
        '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><circle cx="12" cy="13.5" r="3"/>'
    ];

    var ALLOWED_NEXT = /^(home|routes|fares|places|feedback)\.html(\?[\w=&%.\-]*)?$/;

    /** Only allow redirects to our own pages (prevents open-redirect tricks). */
    function getNextPage() {
        var next = new URLSearchParams(window.location.search).get('next') || '';
        return ALLOWED_NEXT.test(next) ? next : 'home.html';
    }

    function render(list, saved) {
        list.insertAdjacentHTML('beforeend', CB.data.USER_TYPES.map(function (t, i) {
            var id = 'type-' + i;
            return '<div class="type-option">' +
                '<input type="radio" name="userType" id="' + id + '" value="' + CB.ui.escapeHtml(t.name) + '"' +
                    (t.name === saved ? ' checked' : '') + '>' +
                '<label for="' + id + '">' +
                    '<span class="type-option__icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + TYPE_ICONS[i] + '</svg></span>' +
                    '<span class="type-option__text"><strong>' + CB.ui.escapeHtml(t.name) + '</strong>' +
                        '<small>' + CB.ui.escapeHtml(t.description) + '</small></span>' +
                    (t.discounted ? '<span class="badge badge--success">Discount</span>' : '') +
                    '<span class="type-option__check" aria-hidden="true"></span>' +
                '</label>' +
            '</div>';
        }).join(''));
    }

    function init() {
        var form = document.getElementById('type-form');
        var list = document.getElementById('type-list');
        var button = document.getElementById('btn-continue');
        var error = document.getElementById('type-error');
        var saved = CB.storage.prefs.getUserType();

        render(list, saved);
        button.disabled = !saved;
        if (saved) button.textContent = 'Continue as ' + saved;

        list.addEventListener('change', function (event) {
            if (event.target.name !== 'userType') return;
            error.textContent = '';
            button.disabled = false;
            button.textContent = 'Continue as ' + event.target.value;
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var checked = form.querySelector('input[name="userType"]:checked');
            if (!checked) {
                error.textContent = 'Please choose who is commuting today.';
                return;
            }
            CB.storage.prefs.setUserType(checked.value);
            window.location.href = getNextPage();
        });

        CB.ui.setupNetworkBanner();
        CB.pwa.init();
    }

    init();
})(window.CB);
