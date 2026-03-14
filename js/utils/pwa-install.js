/* ══════════════════════════════════════════════
   PWA INSTALL
══════════════════════════════════════════════ */

let _deferredPrompt = null;
let _installShown = false;

/* ── Initialize PWA install prompt ───────────────── */
function initPWAInstall() {
    // Check if user has already dismissed the banner
    if (localStorage.getItem('installBannerDismissed') === '1') {
        return;
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return;
    }

    // Detect iOS Safari (no beforeinstallprompt support)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true;

    if (isIOS && !isStandalone) {
        // iOS Safari - show banner after 30s with Safari-specific instructions
        setTimeout(() => {
            _showIOSInstallInstructions();
        }, 30000);
        return;
    }

    // Listen for beforeinstallprompt event (Chrome, Edge, etc.)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        _deferredPrompt = e;

        // Show banner after 30 seconds if not already shown
        if (!_installShown) {
            setTimeout(() => {
                _showInstallBanner();
            }, 30000);
        }
    });

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
        _deferredPrompt = null;
        _hideInstallBanner();
    });
}

/* ── Show install banner ───────────────────── */
function _showInstallBanner() {
    if (_installShown) return;
    _installShown = true;

    const banner = document.getElementById('install-banner');
    if (banner) {
        banner.classList.remove('hidden');
    }
}

/* ── Hide install banner ───────────────────── */
function _hideInstallBanner() {
    const banner = document.getElementById('install-banner');
    if (banner) {
        banner.classList.add('hidden');
    }
}

/* ── Show iOS-specific install instructions ──────── */
function _showIOSInstallInstructions() {
    if (_installShown) return;
    _installShown = true;

    const banner = document.getElementById('install-banner');
    if (!banner) return;

    // Update banner content for iOS Safari
    const contentDiv = banner.querySelector('div.flex-1');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <span class="text-xs font-semibold text-black">📱 Add Minimal to your home screen</span>
            <p class="text-[10px] text-black/70 mt-0.5">Tap <svg class="inline w-3 h-3 mx-0.5" fill="currentColor" viewBox="0 0 50 50"><path d="M30.3 13.7L25 8.4l-5.3 5.3-1.4-1.4L25 5.6l6.7 6.7-1.4 1.4z"/><path d="M24 7h2v21h-2z"/><path d="M18.5 29.5h13c3 0 5.5 2.5 5.5 5.5s-2.5 5.5-5.5 5.5h-13c-3 0-5.5-2.5-5.5-5.5s2.5-5.5 5.5-5.5z"/></svg> Share → Add to Home Screen</p>
        `;
    }

    // Hide install button for iOS (can't programmatically trigger)
    const installBtn = document.getElementById('install-banner-install-btn');
    if (installBtn) {
        installBtn.classList.add('hidden');
    }

    banner.classList.remove('hidden');
}

/* ── Handle install button click ────────────────── */
function handleInstallClick() {
    if (!_deferredPrompt) return;

    _deferredPrompt.prompt();

    _deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            _hideInstallBanner();
        }
        _deferredPrompt = null;
    });
}

/* ── Dismiss install banner permanently ────────── */
function dismissInstallBanner() {
    localStorage.setItem('installBannerDismissed', '1');
    _hideInstallBanner();
}
