/* ══════════════════════════════════════════════
   SYNC STATUS INDICATOR
══════════════════════════════════════════════ */

let _syncState = 'synced';         // 'synced' | 'syncing' | 'offline'
let _lastSyncTime = null;          // Timestamp of last successful sync
let _pendingChanges = 0;           // Count of changes waiting to sync
let _isOnline = navigator.onLine;  // Current connection status

/**
 * Initialize sync status indicator.
 * Sets up online/offline listeners and initial state.
 */
function initSyncStatus() {
    _isOnline = navigator.onLine;
    _updateSyncUI();

    // Listen for online/offline events
    window.addEventListener('online', _handleOnline);
    window.addEventListener('offline', _handleOffline);

    // Show sync status button after initialization
    const btn = document.getElementById('sync-status-btn');
    if (btn) btn.classList.remove('hidden');

    // Close dropdown when clicking outside
    document.addEventListener('click', e => {
        const dropdown = document.getElementById('sync-status-dropdown');
        const btn = document.getElementById('sync-status-btn');
        if (dropdown && !dropdown.classList.contains('hidden') &&
            !dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

/**
 * Toggle sync status dropdown visibility.
 */
function toggleSyncStatusDropdown() {
    const dropdown = document.getElementById('sync-status-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
        _updateSyncDropdown();
    }
}

/**
 * Set sync state to 'syncing' (blue pulse).
 * Called when saveData begins.
 */
function setSyncStateSyncing() {
    if (!_isOnline) return; // Don't show syncing if offline
    _syncState = 'syncing';
    _pendingChanges++;
    _updateSyncUI();
}

/**
 * Set sync state to 'synced' (green).
 * Called when Firestore write completes successfully.
 */
function setSyncStateSynced() {
    _syncState = 'synced';
    _lastSyncTime = Date.now();
    _pendingChanges = Math.max(0, _pendingChanges - 1);
    _updateSyncUI();
}

/**
 * Set sync state to 'failed' (show as offline).
 * Called when Firestore write fails.
 */
function setSyncStateFailed() {
    _syncState = 'offline';
    _updateSyncUI();
}

/* ── Event handlers ─────────────────────────────── */

function _handleOnline() {
    _isOnline = true;
    _syncState = 'synced';
    _updateSyncUI();
}

function _handleOffline() {
    _isOnline = false;
    _syncState = 'offline';
    _updateSyncUI();
}

/* ── UI updates ─────────────────────────────────── */

/**
 * Update sync indicator icon and badge based on current state.
 */
function _updateSyncUI() {
    const icon = document.getElementById('sync-status-icon');
    const btn = document.getElementById('sync-status-btn');
    if (!icon || !btn) return;

    // Remove all state classes
    icon.classList.remove('text-emerald-400', 'text-blue-400', 'text-amber-400', 'sync-pulse');

    // Apply state-specific styling
    if (_syncState === 'synced' && _isOnline) {
        icon.classList.add('text-emerald-400');
    } else if (_syncState === 'syncing') {
        icon.classList.add('text-blue-400', 'sync-pulse');
    } else {
        icon.classList.add('text-amber-400');
    }

    // Update dropdown if visible
    const dropdown = document.getElementById('sync-status-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        _updateSyncDropdown();
    }
}

/**
 * Update sync status dropdown content.
 */
function _updateSyncDropdown() {
    const badge = document.getElementById('sync-status-badge');
    const connection = document.getElementById('sync-connection-status');
    const lastTime = document.getElementById('sync-last-time');
    const pending = document.getElementById('sync-pending-count');

    // Update badge
    if (badge) {
        badge.className = 'text-xs font-bold px-2 py-0.5 rounded-full';
        if (_syncState === 'synced' && _isOnline) {
            badge.textContent = 'Synced';
            badge.classList.add('bg-emerald-500/20', 'text-emerald-400');
        } else if (_syncState === 'syncing') {
            badge.textContent = 'Syncing';
            badge.classList.add('bg-blue-500/20', 'text-blue-400');
        } else {
            badge.textContent = 'Offline';
            badge.classList.add('bg-amber-500/20', 'text-amber-400');
        }
    }

    // Update connection status
    if (connection) {
        connection.textContent = _isOnline ? 'Online' : 'Offline';
    }

    // Update last sync time
    if (lastTime) {
        if (!_lastSyncTime) {
            lastTime.textContent = 'Never';
        } else {
            const diff = Date.now() - _lastSyncTime;
            lastTime.textContent = _formatTimeSince(diff);
        }
    }

    // Update pending changes count
    if (pending) {
        pending.textContent = _pendingChanges.toString();
    }
}

/**
 * Format milliseconds since last sync into human-readable text.
 * @param {number} ms - Milliseconds since last sync
 * @returns {string} Human-readable time string
 */
function _formatTimeSince(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}
