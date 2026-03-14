/* ══════════════════════════════════════════════
   APP — Theme, init, Firebase bootstrap, UI helpers
══════════════════════════════════════════════ */

/* ── Theme (light / dark / system) ────────────── */
let _themeMode = 'system'; // 'dark' | 'light' | 'system'

function applyTheme(mode) {
    _themeMode = mode || 'system';
    localStorage.setItem('themeMode', _themeMode);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = _themeMode === 'dark' || (_themeMode === 'system' && prefersDark);
    document.documentElement.classList.toggle('light', !useDark);
    _updateThemePills();
    setTimeout(renderOverview, 0); // re-render chart with theme colours
}

function _updateThemePills() {
    ['dark','light','system'].forEach(m => {
        const el = document.getElementById('theme-pill-' + m);
        if (!el) return;
        const active = m === _themeMode;
        el.className = 'flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ' +
            (active ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300');
    });
}

// Re-apply when system preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (_themeMode === 'system') applyTheme('system');
});

// Apply immediately on script parse (before render)
(function() {
    const saved = localStorage.getItem('themeMode') || 'system';
    _themeMode = saved;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = saved === 'dark' || (saved === 'system' && prefersDark);
    document.documentElement.classList.toggle('light', !useDark);
})();

window.onload = () => {
    // ── Firebase config ─────────────────────────────
    // Replace these placeholder values with your own from
    // Firebase console → Project settings → Your apps → Web
	        const firebaseConfig = {
        apiKey:            "AIzaSyDgNbyezS14jpvZ4oTKjBsgrw2Gr1hObhQ",
        authDomain:        "minimal-easy.firebaseapp.com",
        projectId:         "minimal-easy",
        storageBucket:     "minimal-easy.firebasestorage.app",
        messagingSenderId: "1017317450737",
        appId:             "1:1017317450737:web:b9a2e5b3f658e8a6c41a50"
    };

    // ── Init Firebase ────────────────────────────────
    try {
        firebase.initializeApp(firebaseConfig);
        _fbAuth = firebase.auth();
        _fbDb   = firebase.firestore();

        // Auth state observer — this drives the whole app
        _fbAuth.onAuthStateChanged(async user => {
            if (user) {
                // ── Signed in ──
                await loadFromFirestore(user.uid);
                _updateUserUI(user);
                _showApp();
            } else {
                // ── Signed out ──
                _showAuthScreen();
            }
        });
    } catch(e) {
        // Firebase config not set yet — run in offline/demo mode
        console.warn('Firebase not configured — running in local mode:', e.message);
        loadData();
        _showApp();
    }

    // ── Init PWA install prompt ──────────────────────
    initPWAInstall();

    // ── Init sync status indicator ───────────────────
    initSyncStatus();

    // ── Tabs scroll fade ─────────────────────────────
    const scroller = document.getElementById('tabs-scroller');
    const wrap     = document.getElementById('tabs-fade-wrap');
    if (scroller && wrap) {
        const update = () => {
            const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4;
            wrap.classList.toggle('scrolled-end', atEnd);
        };
        scroller.addEventListener('scroll', update, { passive: true });
        update();
    }
};

function _showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    // Close any open modals that may have been left open
    const dm = document.getElementById('data-modal');
    if (dm) dm.classList.add('hidden');
    const pm = document.getElementById('profile-menu');
    if (pm) pm.classList.add('hidden');
    // Generate any pending recurring transactions
    generateRecurringTransactions();
    // Offset content when demo banner is visible
    _updateDemoBannerPadding();
    switchTab(getLaunchTab());
    checkNotifications();
    if (!localStorage.getItem('tutDone')) tutOpen();
}

function enterDemoMode() {
    _demoMode = true;
    // Load fresh default state — no localStorage, no Firestore
    transactions      = [];
    monthlyBudgets    = {};
    walletAccounts    = [];
    expenseCategories = {...defaultCategories};
    incomeCats        = ["Salary","Freelance","Investments","Gifts","Other"];
    // Show the app
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    document.getElementById('demo-banner').classList.remove('hidden');
    _updateDemoBannerPadding();
    switchTab(0); // always start on Transactions
    // Don't auto-show tutorial for demo — it's implicit
}

function exitDemoMode() {
    _demoMode = false;
    document.getElementById('demo-banner').classList.add('hidden');
    _updateDemoBannerPadding();
    // Clear any changes made in demo mode then go back to auth
    transactions      = [];
    monthlyBudgets    = {};
    walletAccounts    = [];
    expenseCategories = {...defaultCategories};
    incomeCats        = ["Salary","Freelance","Investments","Gifts","Other"];
    _showAuthScreen();
}

function _updateDemoBannerPadding() {
    const banner = document.getElementById('demo-banner');
    const header = document.querySelector('#app-root > header, #app-root .sticky');
    if (!banner || !header) return;
    const h = banner.classList.contains('hidden') ? 0 : banner.offsetHeight;
    header.style.marginTop = h ? h + 'px' : '';
}

function _showAuthScreen() {
    document.getElementById('app-root').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
}

function _updateUserUI(user) {
    const name    = user.displayName || '';
    const email   = user.email || '';
    const photo   = user.photoURL || '';
    const initials = name
        ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
        : email.slice(0,2).toUpperCase();

    // Header mini-avatar
    const imgEl  = document.getElementById('user-avatar-img');
    const initEl = document.getElementById('user-avatar-initials');
    if (photo && imgEl) {
        imgEl.src = photo; imgEl.classList.remove('hidden');
        if (initEl) initEl.classList.add('hidden');
    } else if (initEl) {
        initEl.textContent = initials;
        if (imgEl) imgEl.classList.add('hidden');
    }

    // Profile menu
    const pName   = document.getElementById('profile-name');
    const pEmail  = document.getElementById('profile-email-display');
    const pImgL   = document.getElementById('profile-img-large');
    const pInitL  = document.getElementById('profile-initials-large');
    if (pName)  pName.textContent  = name || email;
    if (pEmail) pEmail.textContent = email;
    if (photo && pImgL) {
        pImgL.src = photo; pImgL.classList.remove('hidden');
        if (pInitL) pInitL.classList.add('hidden');
    } else if (pInitL) {
        pInitL.textContent = initials;
        if (pImgL) pImgL.classList.add('hidden');
    }

    // Sidebar user row (desktop)
    const sName = document.getElementById('sidebar-user-name');
    const sImg  = document.getElementById('sidebar-user-img');
    const sInit = document.getElementById('sidebar-user-initials');
    if (sName) sName.textContent = name || email || 'Account';
    if (photo && sImg) {
        sImg.src = photo; sImg.classList.remove('hidden');
        if (sInit) sInit.classList.add('hidden');
    } else if (sInit) {
        sInit.textContent = initials;
        if (sImg) sImg.classList.add('hidden');
    }
}
