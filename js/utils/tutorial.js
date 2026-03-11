/* ══════════════════════════════════════════════
   TUTORIAL
══════════════════════════════════════════════ */
const TUT_TOTAL = 7;
let _tutIdx = 0;
let _selectedTemplate = 'student'; // Default template selection

function tutOpen() {
    _tutIdx = 0;
    document.getElementById('tut-modal').classList.remove('hidden');
    _tutSetTrack(0, false);
    _tutRender();
}

function tutSkip() {
    document.getElementById('tut-modal').classList.add('hidden');
    localStorage.setItem('tutDone', '1');
}

function tutFinish() {
    document.getElementById('tut-modal').classList.add('hidden');
    localStorage.setItem('tutDone', '1');
}

function selectTemplate(templateKey) {
    _selectedTemplate = templateKey;
    // Update UI to show selected template
    const cards = document.querySelectorAll('.tut-template-card');
    cards.forEach(card => {
        if (card.dataset.template === templateKey) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

function tutNext() {
    if (_tutIdx < TUT_TOTAL - 1) {
        _tutIdx++;
        _tutSetTrack(_tutIdx, true);
        _tutRender();
    }
}

function tutPrev() {
    if (_tutIdx > 0) {
        _tutIdx--;
        _tutSetTrack(_tutIdx, true);
        _tutRender();
    }
}

function _tutSetTrack(idx, animate) {
    const track = document.getElementById('tut-track');
    if (!track) return;
    if (!animate) track.classList.add('dragging');
    track.style.transform = `translateX(${-idx * 100}%)`;
    if (!animate) {
        // force reflow then re-enable transition
        track.getBoundingClientRect();
        track.classList.remove('dragging');
    }
}

function _tutRender() {
    // Dots
    const dots = document.getElementById('tut-dots-row');
    if (dots) {
        dots.innerHTML = Array.from({length: TUT_TOTAL}, (_, i) =>
            `<div class="tut-dot${i === _tutIdx ? ' active' : ''}"></div>`
        ).join('');
    }

    // Prev button
    const prev = document.getElementById('tut-btn-prev');
    if (prev) {
        prev.style.opacity        = _tutIdx === 0 ? '0' : '1';
        prev.style.pointerEvents  = _tutIdx === 0 ? 'none' : 'auto';
    }

    // Next button — hide on last slide (CTA takes over)
    const next = document.getElementById('tut-btn-next');
    if (next) {
        next.style.opacity        = _tutIdx === TUT_TOTAL - 1 ? '0' : '1';
        next.style.pointerEvents  = _tutIdx === TUT_TOTAL - 1 ? 'none' : 'auto';
    }
}

// ── Natural drag-to-slide with vertical scroll prevention ──
(function() {
    let _sx = 0, _sy = 0, _dx = 0, _axis = null, _dragging = false;
    const getTrack = () => document.getElementById('tut-track');
    const getWrap  = () => document.getElementById('tut-slide-wrap');
    const isOpen   = () => document.getElementById('tut-modal') &&
                           !document.getElementById('tut-modal').classList.contains('hidden');

    document.addEventListener('touchstart', e => {
        if (!isOpen()) return;
        const wrap = getWrap();
        if (!wrap || !wrap.contains(e.target)) return;
        _sx = e.touches[0].clientX;
        _sy = e.touches[0].clientY;
        _dx = 0; _axis = null; _dragging = false;
    }, { passive: true });

    document.addEventListener('touchmove', e => {
        if (!isOpen()) return;
        const wrap = getWrap();
        if (!wrap || !wrap.contains(e.target)) return;
        const dx = e.touches[0].clientX - _sx;
        const dy = e.touches[0].clientY - _sy;

        // Determine axis on first significant move
        if (!_axis && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            _axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
        }
        if (_axis !== 'h') return;

        // Prevent vertical scroll while swiping horizontally
        e.preventDefault();

        _dx = dx;
        _dragging = true;
        const track = getTrack();
        if (!track) return;
        track.classList.add('dragging');
        const base = -_tutIdx * 100;
        const pct  = (_dx / wrap.offsetWidth) * 100;
        // Rubber-band at edges
        const rubberPct = (_tutIdx === 0 && _dx > 0) || (_tutIdx === TUT_TOTAL - 1 && _dx < 0)
            ? pct * 0.25 : pct;
        track.style.transform = `translateX(calc(${base}% + ${rubberPct.toFixed(2)}%))`;
    }, { passive: false });

    document.addEventListener('touchend', e => {
        if (!isOpen() || !_dragging) { _dragging = false; return; }
        const wrap = getWrap();
        const track = getTrack();
        if (!track || !wrap) return;
        track.classList.remove('dragging');
        _dragging = false;

        const threshold = wrap.offsetWidth * 0.28;
        if (_dx < -threshold && _tutIdx < TUT_TOTAL - 1) {
            _tutIdx++;
        } else if (_dx > threshold && _tutIdx > 0) {
            _tutIdx--;
        }
        _tutSetTrack(_tutIdx, true);
        _tutRender();
        _dx = 0; _axis = null;
    }, { passive: true });
})();
