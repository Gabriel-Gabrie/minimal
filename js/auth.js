/* ══════════════════════════════════════════════
   AUTH  —  Email / Google / Apple
══════════════════════════════════════════════ */
let _authMode = 'create';

function setAuthMode(mode) {
    _authMode = mode;
    const isCreate = mode === 'create';

    // Headline & subline
    const hl = document.getElementById('auth-headline');
    const sl = document.getElementById('auth-subline');
    if (hl) hl.textContent = isCreate ? 'Create your account' : 'Welcome back';
    if (sl) sl.textContent = isCreate ? 'Free, private, no card required.' : 'Sign in to your account.';

    // CTA
    const cta = document.getElementById('auth-cta-btn');
    if (cta) cta.textContent = isCreate ? 'Create Account' : 'Sign In';

    // Show/hide create-only fields
    const sw = document.getElementById('auth-strength-wrap');
    if (sw) sw.classList.toggle('hidden', !isCreate);

    // Show/hide forgot password (sign-in only)
    const fw = document.getElementById('auth-forgot-wrap');
    if (fw) { fw.classList.toggle('hidden', isCreate); fw.classList.toggle('flex', !isCreate); }

    // Update autocomplete
    const pwEl = document.getElementById('auth-password');
    if (pwEl) pwEl.autocomplete = isCreate ? 'new-password' : 'current-password';

    // Mode switch link
    const switchLbl = document.getElementById('auth-switch-label');
    const switchBtn = document.getElementById('auth-switch-btn');
    if (switchLbl) switchLbl.textContent = isCreate ? 'Already have an account?' : "Don't have an account?";
    if (switchBtn) {
        switchBtn.textContent = isCreate ? 'Sign in' : 'Create one';
        switchBtn.onclick = () => setAuthMode(isCreate ? 'signin' : 'create');
    }

    // Reset strength
    _authCheckStrength();
    _authClearError();
}

function _togglePwVis(inputId, svgId) {
    const el  = document.getElementById(inputId);
    const svg = document.getElementById(svgId);
    if (!el) return;
    const show = el.type === 'password';
    el.type = show ? 'text' : 'password';
    // swap icon: open eye ↔ eye-off
    if (svg) svg.innerHTML = show
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

function _authCheckStrength() {
    if (_authMode !== 'create') return;
    const pass  = document.getElementById('auth-password')?.value  || '';
    const bars  = [0,1,2,3].map(i => document.getElementById('auth-str-' + i));
    const label = document.getElementById('auth-strength-label');
    if (!bars[0]) return;

    let score = 0;
    if (pass.length >= 8)           score++;
    if (/[A-Z]/.test(pass))         score++;
    if (/[0-9]/.test(pass))         score++;
    if (/[^A-Za-z0-9]/.test(pass))  score++;

    const colors = ['bg-rose-500', 'bg-amber-400', 'bg-amber-400', 'bg-emerald-500'];
    const lbls   = ['Too short',   'Weak',         'Good',         'Strong'];
    const lblCls = ['text-rose-400','text-amber-400','text-amber-400','text-emerald-400'];
    const color  = pass.length === 0 ? 'bg-zinc-800' : colors[Math.max(0, score - 1)];

    bars.forEach((b, i) => {
        if (!b) return;
        b.className = 'flex-1 h-1 rounded-full transition-all duration-300 ' +
            (i < score ? color : 'bg-zinc-800');
    });
    if (label) {
        label.textContent = pass.length === 0 ? '' : lbls[Math.max(0, score - 1)];
        label.className   = 'text-[11px] h-3 transition-colors ' +
            (pass.length === 0 ? 'text-zinc-600' : lblCls[Math.max(0, score - 1)]);
    }
}

function _authStrength() {
    const pass = document.getElementById('auth-password')?.value || '';
    const wrap = document.getElementById('auth-strength-wrap');
    if (!wrap || wrap.classList.contains('hidden')) return;

    const hasLen = pass.length >= 8;
    const hasNum = /[0-9]/.test(pass);
    const hasSym = /[^a-zA-Z0-9]/.test(pass);
    // Score 0-3
    const score = (hasLen ? 1 : 0) + ((hasNum || hasSym) ? 1 : 0) + (hasLen && hasNum && hasSym ? 1 : 0);
    const COLORS = ['#ef4444','#f59e0b','#10b981'];
    const MSGS   = ['Too short — need at least 8 characters','Add a number or symbol to strengthen it','Strong password ✓'];
    for (let i = 1; i <= 3; i++) {
        const el = document.getElementById('pbar-' + i);
        if (el) el.style.background = (i <= score && pass.length) ? COLORS[score-1] : '';
    }
    const msgEl = document.getElementById('auth-strength-msg');
    if (msgEl && pass.length) {
        msgEl.textContent = MSGS[score-1] || MSGS[0];
        msgEl.style.color = COLORS[score-1] || COLORS[0];
    } else if (msgEl) {
        msgEl.textContent = 'Min. 8 characters + a number or symbol';
        msgEl.style.color = '';
    }
}

function _authShowSpinner(show) {
    const s = document.getElementById('auth-spinner');
    const b = document.getElementById('auth-cta-btn');
    if (s) s.classList.toggle('hidden', !show);
    if (b) b.disabled = show;
}

function _authShowError(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function _authClearError() {
    const el = document.getElementById('auth-error');
    if (el) el.classList.add('hidden');
}

function _authErrMsg(code) {
    const map = {
        'auth/invalid-email':           'Please enter a valid email address.',
        'auth/user-not-found':           'No account found with that email.',
        'auth/wrong-password':           'Incorrect password. Try again.',
        'auth/email-already-in-use':     'An account with that email already exists.',
        'auth/weak-password':            'Password should be at least 6 characters.',
        'auth/too-many-requests':        'Too many attempts. Please try again later.',
        'auth/popup-closed-by-user':     'Sign-in popup was closed. Please try again.',
        'auth/cancelled-popup-request':  '',
        'auth/operation-not-supported-in-this-environment':
                                         'Please serve this file over HTTPS (or localhost) to use social sign-in.',
    };
    return map[code] || 'Something went wrong. Please try again.';
}

async function authEmailAction() {
    if (!_fbAuth) { _authShowError('Firebase not configured yet. See setup instructions in the source.'); return; }
    const email = (document.getElementById('auth-email')?.value || '').trim();
    const pass  =  document.getElementById('auth-password')?.value || '';
    if (!email || !pass) { _authShowError('Please fill in your email and password.'); return; }

    if (_authMode === 'create') {
        // Password strength check
        if (pass.length < 8) { _authShowError('Password must be at least 8 characters.'); return; }
        if (!/[0-9]/.test(pass) && !/[^a-zA-Z0-9]/.test(pass)) {
            _authShowError('Add a number or symbol to strengthen your password.'); return;
        }
    }

    _authClearError();
    _authShowSpinner(true);
    try {
        if (_authMode === 'create') {
            await _fbAuth.createUserWithEmailAndPassword(email, pass);
        } else {
            await _fbAuth.signInWithEmailAndPassword(email, pass);
        }
    } catch(e) {
        _authShowSpinner(false);
        _authShowError(_authErrMsg(e.code));
    }
}

async function authGoogle() {
    if (!_fbAuth) { _authShowError('Firebase not configured yet.'); return; }
    _authClearError();
    _authShowSpinner(true);
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await _fbAuth.signInWithPopup(provider);
    } catch(e) {
        _authShowSpinner(false);
        const msg = _authErrMsg(e.code);
        if (msg) _authShowError(msg);
    }
}

async function authApple() {
    if (!_fbAuth) { _authShowError('Firebase not configured yet.'); return; }
    _authClearError();
    _authShowSpinner(true);
    try {
        const provider = new firebase.auth.OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        await _fbAuth.signInWithPopup(provider);
    } catch(e) {
        _authShowSpinner(false);
        if (e.code === 'auth/operation-not-allowed') {
            _authShowError('Apple Sign-In requires a registered domain and Apple Developer account. See setup instructions.');
        } else {
            const msg = _authErrMsg(e.code);
            if (msg) _authShowError(msg);
        }
    }
}

async function authForgotPassword() {
    if (!_fbAuth) return;
    const email = (document.getElementById('auth-email')?.value || '').trim();
    if (!email) { _authShowError('Enter your email above first.'); return; }
    try {
        await _fbAuth.sendPasswordResetEmail(email);
        _authShowError(''); // clear
        const el = document.getElementById('auth-error');
        if (el) {
            el.textContent = 'Password reset email sent!';
            el.classList.remove('hidden');
            el.style.color = '#10b981';
        }
    } catch(e) {
        _authShowError(_authErrMsg(e.code));
    }
}

function authSignOut() {
    hideProfileMenu();
    if (_fbAuth) _fbAuth.signOut();
}

/* ── Profile menu ────────────────────────────── */
function showProfileMenu() {
    document.getElementById('profile-menu').classList.remove('hidden');
}

function hideProfileMenu(e) {
    const menu = document.getElementById('profile-menu');
    if (!e || e.target === menu) menu.classList.add('hidden');
}

// Allow Enter key to submit auth form
document.addEventListener('keydown', e => {
    const auth = document.getElementById('auth-screen');
    if (!auth || auth.style.display === 'none') return;
    if (e.key === 'Enter') authEmailAction();
});
