/* ══════════════════════════════════════════════
   TUTORIAL — Interactive Walk-through
   Spotlights real UI elements and guides the user
   step-by-step through budgets, wallet, transactions,
   overview, and settings.
══════════════════════════════════════════════ */

let _tutStep = -1;
let _tutCleanup = null;

/* ── Step definitions ─────────────────────── */
const _TUT = [

    /* 0 — Welcome */
    {
        type: 'modal',
        title: 'Welcome to Minimal',
        body: "Let\u2019s walk through the app together.\nThis quick tour shows you the basics.",
        btn: "Let\u2019s start",
        icon: 'sprout'
    },

    /* 1 — Tap Budgets tab */
    {
        type: 'action',
        target: '#tab-2',
        title: 'Create a Budget',
        body: 'Tap the Budgets tab to plan\nyour monthly spending.',
        pos: 'bottom'
    },

    /* 2 — Budget screen explained */
    {
        type: 'info',
        target: '#budgets-list',
        title: 'Set Spending Limits',
        body: 'Each section has categories you can budget.\nTap any item to set a monthly limit.\nProgress bars glow green \u2192 amber \u2192 red.',
        pos: 'top',
        delay: 400,
        pad: 12
    },

    /* 3 — Navigate to Wallet */
    {
        type: 'info',
        target: function () {
            var el = document.getElementById('wallet-empty');
            return (el && !el.classList.contains('hidden')) ? el
                : document.getElementById('wallet-accounts-list');
        },
        title: 'Your Wallet',
        body: 'Add your real accounts here \u2014\nspending, saving, and debt.\nTrack balances and transfers between them.',
        pos: 'top',
        delay: 400,
        before: function () { switchTab(3); },
        pad: 12
    },

    /* 4 — Tap the FAB */
    {
        type: 'action',
        target: '#fab-main',
        title: 'Add a Transaction',
        body: 'Tap the + button to log\nincome, expenses, or transfers.',
        pos: 'top'
    },

    /* 5 — Tap Expense option */
    {
        type: 'action',
        target: function () {
            var btns = document.querySelectorAll('#fab-options > button');
            return btns.length ? btns[btns.length - 1] : null;
        },
        title: 'Choose a Type',
        body: 'Tap Expense to record a purchase.',
        pos: 'left',
        delay: 350
    },

    /* 6 — Transaction form explained */
    {
        type: 'info',
        target: function () {
            return document.querySelector('#add-modal .modal-panel');
        },
        title: 'Log It',
        body: 'Enter the amount, pick a category,\nadd a note, then save.',
        pos: 'top',
        delay: 400,
        raise: '#add-modal',
        after: function () { hideModal(); closeFab(); }
    },

    /* 7 — Tap Overview tab */
    {
        type: 'action',
        target: '#tab-0',
        title: 'Your Dashboard',
        body: 'Tap Overview to see your\nspending at a glance.',
        pos: 'bottom',
        delay: 300
    },

    /* 8 — Overview explained */
    {
        type: 'info',
        target: '#screen-0',
        title: 'Overview',
        body: "See this month\u2019s spending chart,\npace indicator, top categories,\nand recent transactions.",
        pos: 'top',
        delay: 400,
        pad: 16
    },

    /* 9 — Settings (info only — spotlight avatar) */
    {
        type: 'info',
        target: '#user-avatar-btn',
        title: 'Settings',
        body: 'Tap your profile icon to access\nsettings \u2014 themes, data export,\ncategory management, and more.',
        pos: 'bottom',
        pad: 6
    },

    /* 10 — Done */
    {
        type: 'modal',
        title: "You\u2019re all set!",
        body: "Start tracking your finances.\nReplay this tour anytime from Settings.",
        btn: "Let\u2019s go!",
        icon: 'check'
    }
];


/* ══════════════════════════════════════════════
   PUBLIC API
══════════════════════════════════════════════ */

function tutOpen() {
    _tutStep = -1;
    var el = document.getElementById('tut-overlay');
    if (el) el.classList.remove('hidden');
    _tutAdvance();
}

function tutSkip() { _tutEnd(); }

function tutFinish() { _tutEnd(); }


/* ══════════════════════════════════════════════
   INTERNALS
══════════════════════════════════════════════ */

function _tutEnd() {
    _tutCleanupStep();
    var ov = document.getElementById('tut-overlay');
    if (ov) {
        ov.classList.add('hidden');
        ov.style.clipPath = '';
    }
    _tutHideSpot();
    localStorage.setItem('tutDone', '1');
}

function _tutAdvance() {
    _tutCleanupStep();
    _tutStep++;
    if (_tutStep >= _TUT.length) { _tutEnd(); return; }
    _tutRenderStep();
}

function _tutCleanupStep() {
    if (_tutCleanup) { _tutCleanup(); _tutCleanup = null; }
}

function _tutRenderStep() {
    var step = _TUT[_tutStep];
    if (!step) return;
    if (step.before) step.before();

    var go = function () {
        if (step.type === 'modal') { _tutModal(step); return; }

        var el = (typeof step.target === 'function')
            ? step.target()
            : document.querySelector(step.target);

        if (!el) { _tutAdvance(); return; }
        _tutSpot(el, step);
    };

    step.delay ? setTimeout(go, step.delay) : go();
}


/* ── Modal card ───────────────────────────── */

function _tutModal(step) {
    _tutHideSpot();
    var ov = document.getElementById('tut-overlay');
    if (ov) ov.style.clipPath = '';

    var card = document.getElementById('tut-card');
    if (!card) return;
    card.classList.remove('hidden');

    /* Swap icon */
    var iconWrap = document.getElementById('tut-card-icon');
    if (iconWrap) {
        if (step.icon === 'check') {
            iconWrap.innerHTML =
                '<svg width="72" height="72" viewBox="0 0 72 72" fill="none">' +
                '<circle cx="36" cy="36" r="32" stroke="rgba(16,185,129,.15)" stroke-width="1"/>' +
                '<circle cx="36" cy="36" r="22" fill="rgba(16,185,129,.10)" stroke="#10b981" stroke-width="1.5"/>' +
                '<polyline points="26,36 33,43 47,28" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
                '</svg>';
        } else {
            iconWrap.innerHTML =
                '<svg width="72" height="72" viewBox="0 0 72 72" fill="none">' +
                '<circle cx="36" cy="36" r="32" stroke="rgba(16,185,129,.15)" stroke-width="1"/>' +
                '<circle cx="36" cy="36" r="22" stroke="rgba(16,185,129,.25)" stroke-width="1"/>' +
                '<path d="M36 50 Q36 34 26 26 Q36 25 46 34 Q46 44 36 50Z" fill="rgba(16,185,129,.5)"/>' +
                '<path d="M36 50 Q36 34 46 26 Q49 36 42 45Z" fill="rgba(16,185,129,.3)"/>' +
                '<line x1="36" y1="50" x2="36" y2="58" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>' +
                '</svg>';
        }
    }

    document.getElementById('tut-card-title').textContent = step.title;
    document.getElementById('tut-card-body').textContent = step.body;
    document.getElementById('tut-card-btn').textContent = step.btn || 'Next';

    _tutCleanup = function () {
        card.classList.add('hidden');
        if (step.after) step.after();
    };
}


/* ── Spotlight ────────────────────────────── */

function _tutSpot(el, step) {
    document.getElementById('tut-card').classList.add('hidden');

    var ov   = document.getElementById('tut-overlay');
    var ring = document.getElementById('tut-ring');
    var tip  = document.getElementById('tut-tip');
    if (!ov || !ring || !tip) return;

    /* Measure target */
    var pad = step.pad || 8;
    var r   = el.getBoundingClientRect();
    var x1  = r.left - pad, y1 = r.top - pad;
    var x2  = r.right + pad, y2 = r.bottom + pad;

    /* Clip a rectangular hole in the overlay */
    ov.style.clipPath =
        'polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ' +
        x1 + 'px ' + y1 + 'px, ' +
        x1 + 'px ' + y2 + 'px, ' +
        x2 + 'px ' + y2 + 'px, ' +
        x2 + 'px ' + y1 + 'px, ' +
        x1 + 'px ' + y1 + 'px)';

    /* Raise parent element if needed (e.g. modals) */
    var raiseEl = step.raise ? document.querySelector(step.raise) : null;
    if (raiseEl) raiseEl.style.zIndex = '10000';

    /* Position ring */
    ring.classList.remove('hidden');
    ring.style.left   = x1 + 'px';
    ring.style.top    = y1 + 'px';
    ring.style.width  = (x2 - x1) + 'px';
    ring.style.height = (y2 - y1) + 'px';

    /* Tooltip content */
    tip.classList.remove('hidden');
    document.getElementById('tut-tip-title').textContent = step.title || '';
    document.getElementById('tut-tip-body').textContent  = step.body || '';

    /* Step counter (non-modal steps only) */
    var stepEl = document.getElementById('tut-tip-step');
    var total  = _TUT.filter(function (s) { return s.type !== 'modal'; }).length;
    var cur    = _TUT.slice(0, _tutStep + 1).filter(function (s) { return s.type !== 'modal'; }).length;
    stepEl.textContent = cur + ' / ' + total;

    /* Next button for info steps, hidden for action steps */
    var btn = document.getElementById('tut-tip-btn');
    if (step.type === 'info') {
        btn.classList.remove('hidden');
        btn.textContent = step.btn || 'Next';
    } else {
        btn.classList.add('hidden');
    }

    /* Position tooltip */
    _tutPosTip(tip, r, step.pos || 'bottom', pad);

    /* For action steps: listen for target click */
    if (step.type === 'action') {
        var handler = function () {
            el.removeEventListener('click', handler, true);
            setTimeout(_tutAdvance, 100);
        };
        el.addEventListener('click', handler, true);

        _tutCleanup = function () {
            el.removeEventListener('click', handler, true);
            _tutHideSpot();
            if (raiseEl) raiseEl.style.zIndex = '';
            if (step.after) step.after();
        };
    } else {
        _tutCleanup = function () {
            _tutHideSpot();
            if (raiseEl) raiseEl.style.zIndex = '';
            if (step.after) step.after();
        };
    }
}


/* ── Hide ring + tooltip ──────────────────── */

function _tutHideSpot() {
    var ring = document.getElementById('tut-ring');
    var tip  = document.getElementById('tut-tip');
    if (ring) ring.classList.add('hidden');
    if (tip)  tip.classList.add('hidden');
}


/* ── Position tooltip near target ─────────── */

function _tutPosTip(tip, rect, pos, pad) {
    var gap   = 16;
    var arrow = document.getElementById('tut-tip-arrow');

    /* Reset */
    tip.style.left   = '';
    tip.style.right  = '';
    tip.style.top    = '';
    tip.style.bottom = '';
    if (arrow) arrow.className = 'tut-arrow';

    var vw = window.innerWidth;
    var vh = window.innerHeight;

    if (pos === 'bottom') {
        tip.style.top  = (rect.bottom + pad + gap) + 'px';
        tip.style.left = Math.max(16, Math.min(vw - 276, rect.left + rect.width / 2 - 130)) + 'px';
        if (arrow) arrow.classList.add('tut-arrow-up');
    } else if (pos === 'top') {
        tip.style.bottom = (vh - rect.top + pad + gap) + 'px';
        tip.style.left   = Math.max(16, Math.min(vw - 276, rect.left + rect.width / 2 - 130)) + 'px';
        if (arrow) arrow.classList.add('tut-arrow-down');
    } else if (pos === 'left') {
        tip.style.right = (vw - rect.left + pad + gap) + 'px';
        tip.style.top   = Math.max(16, rect.top + rect.height / 2 - 40) + 'px';
        if (arrow) arrow.classList.add('tut-arrow-right');
    } else if (pos === 'right') {
        tip.style.left = (rect.right + pad + gap) + 'px';
        tip.style.top  = Math.max(16, rect.top + rect.height / 2 - 40) + 'px';
        if (arrow) arrow.classList.add('tut-arrow-left');
    }
}


/* ── Button handlers ──────────────────────── */

function _tutTipBtn()  { _tutAdvance(); }
function _tutCardBtn() { _tutAdvance(); }
