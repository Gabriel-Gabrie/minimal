/* ══════════════════════════════════════════════
   BANK IMPORT  —  CSV + OFX/QFX parser
   Supports: TD, RBC, BMO, Scotiabank, CIBC,
             Tangerine, Simplii, EQ Bank,
             National Bank, Meridian CU,
             and any standard OFX/QFX file
══════════════════════════════════════════════ */

let _importParsed = [];      // [{date, desc, amount, type, isDup, _main, _sub, _incCat, _excluded}]
let _importAccountId = '';   // wallet account to link imported transactions to
let _impStep = 0;            // 0=account, 1=review
let _impFilename = '';
let _impBankName = '';
let _impSelected = new Set(); // indices of selected transactions for batch ops
let _impEditIdx = null;       // index of transaction being edited inline

/* ── File entry point (called from Settings AND Tx tab) ─────── */
function openBankImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
        const raw = ev.target.result;
        try {
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext === 'ofx' || ext === 'qfx') {
                _importParsed = _parseOFX(raw);
                _importParsed._bank = 'OFX / QFX (Standard)';
            } else {
                _importParsed = _parseCSV(raw);
            }
            if (_importParsed.length === 0) {
                showToast('No transactions found in file.', 'rose');
                return;
            }
            _impFilename = file.name;
            _impBankName = _importParsed._bank || 'Unknown Bank';
            _impPrepare();
            _impStep = 0;
            _impSelected = new Set();
            _impEditIdx = null;
            _impRender();
            document.getElementById('bank-import-modal').classList.remove('hidden');
        } catch(err) {
            console.error('Import error:', err);
            showToast('Could not read file: ' + err.message, 'rose');
        }
    };
    reader.onerror = () => showToast('Failed to read file.', 'rose');
    reader.readAsText(file, 'utf-8');
    hideDataModal();
}

/* ── Prepare parsed data ─────────────────────── */
function _impPrepare() {
    const existing = new Set(transactions.map(_txFingerprint));
    const firstMain = Object.keys(expenseCategories).filter(k => k !== 'Income')[0] || '';
    const firstSub = (expenseCategories[firstMain] || [])[0] || '';
    _importParsed.forEach(t => {
        t.isDup = existing.has(_txFingerprint(t));
        if (!t._main) t._main = firstMain;
        if (!t._sub) t._sub = firstSub;
        if (!t._incCat) t._incCat = (expenseCategories['Income'] || incomeCats || [])[0] || 'Other';
        t._excluded = t.isDup; // auto-exclude duplicates
    });
    _importAccountId = '';
}

function _txFingerprint(t) {
    return `${t.date}|${Math.round(t.amount * 100)}|${(t.desc||'').trim().toLowerCase()}`;
}

/* ══════════════════════════════════════════════
   RENDER ENGINE — step-based
══════════════════════════════════════════════ */
function _impRender() {
    const title = document.getElementById('imp-title');
    const subtitle = document.getElementById('imp-subtitle');
    const body = document.getElementById('imp-body');
    const footer = document.getElementById('imp-footer');

    if (_impStep === 0) {
        _impRenderAccountStep(title, subtitle, body, footer);
    } else {
        _impRenderReviewStep(title, subtitle, body, footer);
    }
}

/* ── STEP 0: Account selection ─────────────────────── */
function _impRenderAccountStep(title, subtitle, body, footer) {
    title.textContent = 'Link Account';
    subtitle.textContent = _impFilename;

    const newCount = _importParsed.filter(t => !t.isDup).length;
    const dupCount = _importParsed.filter(t => t.isDup).length;
    const accounts = walletAccounts;

    let html = '<div class="px-5 py-4">';

    // Stats banner
    html += `<div class="flex items-center gap-3 bg-zinc-900 rounded-2xl px-4 py-3 mb-5">
        <div class="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-lg shrink-0">🏦</div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-medium">${_impBankName}</p>
            <p class="text-[11px] text-zinc-500 mt-0.5">${_importParsed.length} transactions found</p>
        </div>
        <div class="text-right shrink-0">
            <p class="text-sm font-bold text-emerald-400">${newCount} new</p>
            ${dupCount > 0 ? `<p class="text-[11px] text-zinc-600">${dupCount} duplicate${dupCount > 1 ? 's' : ''}</p>` : ''}
        </div>
    </div>`;

    // Account selection
    html += `<p class="text-[9px] font-black tracking-[.14em] text-zinc-600 uppercase mb-2 px-1">Which account are these from?</p>`;

    if (accounts.length === 0) {
        // No accounts — show prompt to create one
        html += `<div class="bg-zinc-900 rounded-2xl p-5 text-center mb-3">
            <div class="text-3xl mb-3">💳</div>
            <p class="text-sm font-medium mb-1">No accounts yet</p>
            <p class="text-xs text-zinc-500 leading-relaxed mb-4">Create a spending account to link these transactions to,<br>or skip to import without linking.</p>
            <button onclick="_impCreateAccount()" class="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-3 rounded-2xl text-sm transition-all mb-2">Create Account</button>
        </div>`;
    } else {
        // Account list
        html += `<div class="space-y-1.5 mb-3">`;
        accounts.forEach(a => {
            const sel = _importAccountId === a.id;
            const typeLabel = { spending: 'Spending', saving: 'Saving', debt: 'Debt' }[a.type] || '';
            html += `<button onclick="_impSelectAccount('${a.id}')"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${sel ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : 'bg-zinc-900 active:bg-zinc-800'}">
                <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">${a.icon || '🏦'}</div>
                <div class="flex-1 min-w-0 text-left">
                    <p class="text-sm font-medium truncate">${a.name}</p>
                    <p class="text-[11px] text-zinc-500 mt-0.5">${typeLabel}</p>
                </div>
                ${sel ? '<svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>`;
        });
        html += `</div>`;
        // Create new account link
        html += `<button onclick="_impCreateAccount()" class="flex items-center gap-2 px-4 py-2.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create new account
        </button>`;
    }

    html += '</div>';
    body.innerHTML = html;

    // Footer
    footer.classList.remove('hidden');
    footer.innerHTML = `<div class="flex gap-3">
        <button onclick="_impSkipAccount()" class="flex-1 py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold text-zinc-400 transition-colors">Skip</button>
        <button onclick="_impNext()" class="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-sm font-semibold text-white transition-all shadow-lg shadow-emerald-500/20 ${_importAccountId ? '' : 'opacity-40'}" ${_importAccountId ? '' : 'id="imp-next-disabled"'}>Review Transactions</button>
    </div>`;
}

function _impSelectAccount(id) {
    _importAccountId = id;
    _impRender();
}

function _impSkipAccount() {
    _importAccountId = '';
    _impStep = 1;
    _impRender();
}

function _impCreateAccount() {
    closeBankImport();
    switchTab(4);
    setTimeout(() => showWalletAddModal(), 100);
}

function _impNext() {
    if (_impStep === 0 && !_importAccountId) return;
    _impStep = 1;
    _impRender();
}

function _impBack() {
    _impStep = 0;
    _impEditIdx = null;
    _impRender();
}

/* ── STEP 1: Transaction review ────────────────────── */
function _impRenderReviewStep(title, subtitle, body, footer) {
    const newTxs = _importParsed.filter(t => !t._excluded);
    const exclCount = _importParsed.filter(t => t._excluded).length;
    const dupCount = _importParsed.filter(t => t.isDup).length;

    title.textContent = 'Review Transactions';
    const acct = walletAccounts.find(a => a.id === _importAccountId);
    subtitle.textContent = acct ? `→ ${acct.icon || '🏦'} ${acct.name}` : _impFilename;

    let html = '';

    // Toolbar
    html += `<div class="px-5 py-2.5 border-b border-zinc-800 flex items-center gap-2">
        <button onclick="_impBack()" class="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div class="flex-1 flex items-center gap-2 text-xs min-w-0">
            <span class="text-emerald-400 font-bold">${newTxs.length} importing</span>
            ${exclCount > 0 ? `<span class="text-zinc-600">${exclCount} excluded</span>` : ''}
        </div>
        <button onclick="_impBatchMenu()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-400 hover:text-white transition-colors shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            Batch
        </button>
    </div>`;

    // Batch action panel (hidden by default)
    html += `<div id="imp-batch-panel" class="hidden border-b border-zinc-800 bg-zinc-900/60 px-5 py-3 space-y-2">
        <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold tracking-widest text-zinc-600 uppercase shrink-0 w-16">Category</span>
            <select id="imp-batch-main" onchange="_impBatchMainChange(this)" class="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500">
                <option value="">Select section…</option>
            </select>
            <select id="imp-batch-sub" onchange="_impBatchSubChange(this)" class="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500">
                <option value="">—</option>
            </select>
        </div>
        <div class="flex gap-2">
            <button onclick="_impBatchSetType('expense')" class="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-400 font-medium transition-colors">All → Expense</button>
            <button onclick="_impBatchSetType('income')" class="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-400 font-medium transition-colors">All → Income</button>
        </div>
        <div class="flex gap-2">
            <button onclick="_impExcludeDups()" class="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-400 font-medium transition-colors">${dupCount > 0 ? `Exclude ${dupCount} Duplicate${dupCount > 1 ? 's' : ''}` : 'No duplicates'}</button>
            <button onclick="_impIncludeAll()" class="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-400 font-medium transition-colors">Include All</button>
        </div>
    </div>`;

    // Transaction list grouped by date
    const byDate = {};
    _importParsed.forEach((t, i) => {
        const d = t.date || 'unknown';
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push({ t, i });
    });

    html += `<div class="px-5 py-3">`;
    Object.keys(byDate).sort().reverse().forEach(date => {
        let dateLabel;
        try {
            dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        } catch(e) { dateLabel = date; }

        html += `<p class="text-[10px] font-black tracking-widest text-zinc-600 uppercase px-1 py-2 mt-1">${dateLabel}</p>`;

        byDate[date].forEach(({ t, i }) => {
            const isExcl = t._excluded;
            const isInc = t.type === 'income';
            const isExp = t.type === 'expense';
            const emoji = isExcl ? '🚫' : isInc ? '💰' : '💸';
            const sign = isInc ? '+' : '\u2212';
            const amtCls = isExcl ? 'text-zinc-600 line-through' : isInc ? 'text-emerald-400' : 'text-zinc-200';
            const catLabel = isInc ? (t._incCat || 'Income') : `${t._main || ''} · ${t._sub || ''}`;

            // Editing this row?
            if (_impEditIdx === i) {
                html += _impEditRowHtml(t, i);
            } else {
                html += `<div class="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${isExcl ? 'opacity-40' : 'active:bg-zinc-800'} cursor-pointer" onclick="_impTapRow(${i})">
                    <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">${emoji}</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium leading-snug truncate ${isExcl ? 'line-through' : ''}">${_escHtml(t.desc)}</p>
                        <p class="text-[11px] text-zinc-500 mt-0.5 truncate">${isExcl ? (t.isDup ? 'Duplicate' : 'Excluded') : catLabel}</p>
                    </div>
                    <span class="${amtCls} font-semibold text-sm tabular-nums shrink-0">${sign}$${t.amount.toFixed(2)}</span>
                </div>`;
            }
        });
    });
    html += `</div>`;

    body.innerHTML = html;

    // Populate batch selectors
    const bm = document.getElementById('imp-batch-main');
    if (bm && bm.options.length <= 1) {
        Object.keys(expenseCategories).filter(k => k !== 'Income').forEach(m => {
            bm.innerHTML += `<option value="${m}">${mainEmojis[m] || '📁'} ${m}</option>`;
        });
    }

    // Footer
    footer.classList.remove('hidden');
    footer.innerHTML = `<button onclick="confirmBankImport()" ${newTxs.length === 0 ? 'disabled' : ''}
        class="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-3.5 rounded-2xl transition-all text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">
        ${newTxs.length === 0 ? 'No transactions to import' : `Import ${newTxs.length} Transaction${newTxs.length > 1 ? 's' : ''}`}
    </button>`;
}

/* ── Edit row inline ───────────────────────────── */
function _impEditRowHtml(t, idx) {
    const isInc = t.type === 'income';
    const isExp = t.type === 'expense';
    const isExcl = t._excluded;

    const catOpts = Object.keys(expenseCategories).filter(k => k !== 'Income').map(m =>
        `<option value="${m}" ${t._main === m ? 'selected' : ''}>${mainEmojis[m] || '📁'} ${m}</option>`
    ).join('');

    const subOpts = (expenseCategories[t._main] || []).map(s =>
        `<option value="${s}" ${t._sub === s ? 'selected' : ''}>${s}</option>`
    ).join('') + '<option value="__new__">✚ New…</option>';

    const incOpts = (expenseCategories['Income'] || incomeCats || []).map(ic =>
        `<option value="${ic}" ${t._incCat === ic ? 'selected' : ''}>${ic}</option>`
    ).join('');

    return `<div class="bg-zinc-900 rounded-2xl px-4 py-3 mb-1 ring-1 ring-emerald-500/30">
        <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">${isExcl ? '🚫' : isInc ? '💰' : '💸'}</div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium leading-snug truncate">${_escHtml(t.desc)}</p>
                <p class="text-[11px] text-zinc-500 mt-0.5">$${t.amount.toFixed(2)}</p>
            </div>
            <button onclick="_impCloseEdit()" class="w-7 h-7 rounded-lg bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-colors shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
        </div>
        <!-- Type pills -->
        <div class="flex gap-1.5 mb-3">
            <button onclick="_impSetType(${idx},'expense')" class="flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${isExp && !isExcl ? 'bg-zinc-700 text-white' : 'bg-zinc-800/60 text-zinc-500'}">Expense</button>
            <button onclick="_impSetType(${idx},'income')" class="flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${isInc && !isExcl ? 'bg-zinc-700 text-white' : 'bg-zinc-800/60 text-zinc-500'}">Income</button>
            <button onclick="_impToggleExclude(${idx})" class="flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${isExcl ? 'bg-zinc-700 text-white' : 'bg-zinc-800/60 text-zinc-500'}">Exclude</button>
        </div>
        <!-- Category selectors -->
        ${!isExcl ? (isExp ? `<div class="flex gap-2">
            <select onchange="_impEditMain(${idx},this)" class="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500">${catOpts}</select>
            <select onchange="_impEditSub(${idx},this)" class="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500">${subOpts}</select>
        </div>` : `<div>
            <select onchange="_impEditInc(${idx},this)" class="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500">${incOpts}</select>
        </div>`) : ''}
    </div>`;
}

function _impTapRow(idx) {
    _impEditIdx = (_impEditIdx === idx) ? null : idx;
    _impRender();
}

function _impCloseEdit() {
    _impEditIdx = null;
    _impRender();
}

function _impSetType(idx, type) {
    _importParsed[idx].type = type;
    _importParsed[idx]._excluded = false;
    _impRender();
}

function _impToggleExclude(idx) {
    _importParsed[idx]._excluded = !_importParsed[idx]._excluded;
    _impRender();
}

function _impEditMain(idx, sel) {
    const t = _importParsed[idx];
    t._main = sel.value;
    t._sub = (expenseCategories[t._main] || [])[0] || '';
    _impRender();
}

function _impEditSub(idx, sel) {
    const t = _importParsed[idx];
    if (sel.value === '__new__') {
        const name = prompt(`New category under "${t._main}":`);
        if (!name || !name.trim()) { _impRender(); return; }
        const trimmed = name.trim();
        if (!expenseCategories[t._main]) expenseCategories[t._main] = [];
        if (!expenseCategories[t._main].includes(trimmed)) {
            expenseCategories[t._main].push(trimmed);
            saveData();
        }
        t._sub = trimmed;
    } else {
        t._sub = sel.value;
    }
    _impRender();
}

function _impEditInc(idx, sel) {
    _importParsed[idx]._incCat = sel.value;
}

/* ── Batch operations ──────────────────────────── */
function _impBatchMenu() {
    const panel = document.getElementById('imp-batch-panel');
    if (panel) panel.classList.toggle('hidden');
}

function _impBatchMainChange(sel) {
    if (!sel.value) return;
    const sub = document.getElementById('imp-batch-sub');
    if (sub) {
        sub.innerHTML = '<option value="">—</option>' + (expenseCategories[sel.value] || []).map(s =>
            `<option value="${s}">${s}</option>`
        ).join('') + '<option value="__new__">✚ New…</option>';
    }
    // Apply to all non-excluded expenses
    _importParsed.forEach(t => {
        if (t._excluded || t.type !== 'expense') return;
        t._main = sel.value;
        t._sub = (expenseCategories[sel.value] || [])[0] || '';
    });
    _impRender();
}

function _impBatchSubChange(sel) {
    if (!sel.value) return;
    const bm = document.getElementById('imp-batch-main');
    const main = bm ? bm.value : '';
    if (!main) return;

    if (sel.value === '__new__') {
        const name = prompt(`New category under "${main}":`);
        if (!name || !name.trim()) { _impRender(); return; }
        const trimmed = name.trim();
        if (!expenseCategories[main]) expenseCategories[main] = [];
        if (!expenseCategories[main].includes(trimmed)) {
            expenseCategories[main].push(trimmed);
            saveData();
        }
        _importParsed.forEach(t => {
            if (t._excluded || t.type !== 'expense' || t._main !== main) return;
            t._sub = trimmed;
        });
    } else {
        _importParsed.forEach(t => {
            if (t._excluded || t.type !== 'expense' || t._main !== main) return;
            t._sub = sel.value;
        });
    }
    _impRender();
}

function _impBatchSetType(type) {
    _importParsed.forEach(t => {
        if (t._excluded) return;
        t.type = type;
    });
    _impRender();
}

function _impExcludeDups() {
    _importParsed.forEach(t => { if (t.isDup) t._excluded = true; });
    _impRender();
}

function _impIncludeAll() {
    _importParsed.forEach(t => { t._excluded = false; });
    _impRender();
}

/* ── Close / Confirm ───────────────────────────── */
function closeBankImport() {
    document.getElementById('bank-import-modal').classList.add('hidden');
    _importParsed = [];
    _impEditIdx = null;
    _impStep = 0;
}

function confirmBankImport() {
    const toImport = _importParsed.filter(t => !t._excluded);
    if (toImport.length === 0) { closeBankImport(); return; }

    const linkedAccId = _importAccountId || '';
    let idBase = Date.now();

    toImport.slice().reverse().forEach((t, idx) => {
        const tx = { id: idBase + idx + 1, amount: t.amount, date: t.date, desc: t.desc };
        if (t.type === 'income') {
            tx.type = 'income';
            tx.mainCategory = t._incCat || incomeCats[0] || 'Other';
            tx.subCategory = '';
        } else {
            tx.type = 'expense';
            tx.mainCategory = t._main || '';
            tx.subCategory = t._sub || '';
        }
        if (linkedAccId) {
            tx.walletAccountId = linkedAccId;
            _updateAccountBalances(tx, false);
        }
        transactions.unshift(tx);
    });

    saveData();
    renderAll();
    closeBankImport();
    showToast(`Imported ${toImport.length} transaction${toImport.length > 1 ? 's' : ''}`, 'emerald');
}

function _escHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ════════════════════════════════════════════
   OFX / QFX PARSER
   Handles SGML (OFX v1) and XML (OFX v2)
════════════════════════════════════════════ */
function _parseOFX(raw) {
    const txns = [];
    const text = raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const isXML = /<\?xml/i.test(text) || /<OFX[>\s]/i.test(text);

    if (isXML) {
        const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
        let m;
        while ((m = blockRe.exec(text)) !== null) _ofxBlock(m[1], txns);
        return txns;
    }

    const body = text.slice(text.indexOf('<'));
    const blockRe2 = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let m2;
    while ((m2 = blockRe2.exec(body)) !== null) _ofxBlock(m2[1], txns);

    if (txns.length === 0) {
        const lines = body.split('\n');
        let cur = null;
        const emitCur = () => {
            if (!cur || !cur.TRNAMT) return;
            const amt = parseFloat(cur.TRNAMT.replace(/[^\d.\-]/g,''));
            const date = _ofxDate(cur.DTPOSTED || cur.DTUSER || '');
            if (!isNaN(amt) && amt !== 0 && date) {
                const desc = [cur.NAME, cur.MEMO].filter(Boolean)
                    .filter((v,i,a)=>a.indexOf(v)===i).join(' – ') || 'Transaction';
                txns.push({ date, desc, amount: Math.abs(amt),
                    type: amt < 0 ? 'expense' : 'income', raw: `${amt}|${desc}` });
            }
        };
        for (const line of lines) {
            const tag = line.match(/^<([A-Z]+)>(.*)/i);
            if (!tag) continue;
            const [, k, v] = tag;
            if (k.toUpperCase() === 'STMTTRN') { emitCur(); cur = {}; continue; }
            if (!cur) continue;
            cur[k.toUpperCase()] = v.trim();
        }
        emitCur();
    }
    return txns;
}

function _ofxBlock(block, out) {
    const get = tag => {
        const r = new RegExp(`<${tag}>([^<\n]+)`,'i');
        return (r.exec(block)?.[1] || '').trim();
    };
    const amtStr = get('TRNAMT');
    const date = _ofxDate(get('DTPOSTED') || get('DTUSER'));
    const name = get('NAME'); const memo = get('MEMO');
    const desc = [name, memo].filter(Boolean)
        .filter((v,i,a)=>a.indexOf(v)===i).join(' – ') || 'Transaction';
    const amount = parseFloat(amtStr.replace(/[^\d.\-]/g,''));
    if (!isNaN(amount) && amount !== 0 && date) {
        out.push({ date, desc, amount: Math.abs(amount),
            type: amount < 0 ? 'expense' : 'income', raw: `${amtStr}|${desc}` });
    }
}

function _ofxDate(s) {
    const d = s.replace(/[^\d]/g,'').slice(0,8);
    if (d.length < 8) return null;
    return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}

/* ════════════════════════════════════════════
   CSV PARSER + BANK DETECTOR
════════════════════════════════════════════ */
function _parseCSV(raw) {
    const lines = raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n');
    if (lines.length < 2) throw new Error('File has fewer than 2 rows.');

    let headerIdx = 0;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const low = lines[i].toLowerCase();
        if (low.includes('date') || low.includes('posted') || low.includes('transaction')) {
            headerIdx = i; break;
        }
    }

    _csvDelim = _detectDelimiter(lines[headerIdx]);
    const header = _csvRow(lines[headerIdx]).map(h => h.toLowerCase().trim());
    const rows = lines.slice(headerIdx + 1).map(_csvRow).filter(r => r.some(v => v.trim()));
    const bank = _detectBank(header, lines.slice(0, headerIdx));
    const parsed = bank.parse(header, rows);
    parsed._bank = bank.name;
    return parsed;
}

let _csvDelim = ',';
function _detectDelimiter(headerLine) {
    const tabs = (headerLine.match(/\t/g) || []).length;
    const semis = (headerLine.match(/;/g) || []).length;
    const commas = (headerLine.match(/,/g) || []).length;
    if (tabs > commas && tabs > semis) return '\t';
    if (semis > commas && semis > tabs) return ';';
    return ',';
}
function _csvRow(line) {
    const delim = _csvDelim;
    const out = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQ && line[i+1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === delim && !inQ) { out.push(cur); cur = ''; }
        else cur += ch;
    }
    out.push(cur);
    return out.map(v => v.trim());
}

function _normDate(s) {
    s = (s || '').trim().replace(/['"]/g,'');
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var dtm = s.match(/^(\d{4}-\d{2}-\d{2})[T\s]\d{1,2}:\d{2}/);
    if (dtm) return dtm[1];
    var dtm2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\d{1,2}:\d{2}/);
    if (dtm2) return `${dtm2[3]}-${dtm2[1].padStart(2,'0')}-${dtm2[2].padStart(2,'0')}`;
    if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    let m;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (m) { const yr = parseInt(m[3]) > 50 ? '19'+m[3] : '20'+m[3]; return `${yr}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`; }
    m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m) { const mo = _moNum(m[1]); if (mo) return `${m[3]}-${mo}-${m[2].padStart(2,'0')}`; }
    m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
    if (m) { const mo = _moNum(m[2]); if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`; }
    m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (m) { const mo = _moNum(m[2]); if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`; }
    m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})\/(\d{4})$/);
    if (m) { const mo = _moNum(m[1]); if (mo) return `${m[3]}-${mo}-${m[2].padStart(2,'0')}`; }
    m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
    if (m) { const mo = _moNum(m[2]); const yr = parseInt(m[3]) > 50 ? '19'+m[3] : '20'+m[3]; if (mo) return `${yr}-${mo}-${m[1].padStart(2,'0')}`; }
    return null;
}
function _moNum(s) {
    const M = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
               jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    return M[s.slice(0,3).toLowerCase()] || null;
}
function _amt(s) {
    return parseFloat((s||'').replace(/[$,\s"]/g,'').replace(/[^\d.\-]/g,'')) || 0;
}

/* ════════════════════════════════════════════
   BANK DETECTOR
════════════════════════════════════════════ */
function _detectBank(h, metaLines) {
    const has  = (...keys) => keys.every(k => h.some(col => col.includes(k)));
    const col  = k => h.findIndex(c => c.includes(k));
    const meta = metaLines.join(' ').toLowerCase();

    // ── RBC ─ "account type" + "cad$" / "usd$"
    if (has('account type') && (has('cad$') || has('usd$'))) return {
        name: 'RBC Royal Bank',
        parse(h, rows) {
            const iDate = col('transaction date'), iD1 = col('description 1'),
                  iD2 = col('description 2'),
                  iAmt = h.findIndex(c => c.includes('cad$') || c.includes('usd$'));
            return rows.map(r => {
                const amount = _amt(r[iAmt]);
                const desc = [r[iD1], r[iD2]].filter(Boolean).join(' ').trim() || 'Transaction';
                return { date: _normDate(r[iDate]), desc, amount: Math.abs(amount),
                         type: amount < 0 ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── BMO ─ "date posted" / "transaction amount"
    if (has('date posted') || (has('transaction amount') && has('description'))) return {
        name: 'BMO Bank of Montreal',
        parse(h, rows) {
            const iDate = col('date posted') !== -1 ? col('date posted') : col('date'),
                  iAmt = col('transaction amount'), iDesc = col('description');
            return rows.map(r => {
                const amount = _amt(r[iAmt]);
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: amount < 0 ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Scotiabank ─ "withdrawals" + "deposits"
    if (has('withdrawals') && has('deposits')) return {
        name: 'Scotiabank',
        parse(h, rows) {
            const iDate = col('date'), iDesc = col('description'),
                  iWith = col('withdrawals'), iDep = col('deposits');
            return rows.map(r => {
                const w = _amt(r[iWith]), d = _amt(r[iDep]);
                const amount = w || d;
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: w ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Meridian Credit Union
    if (has('account name') || (has('description1') && has('description2'))) return {
        name: 'Meridian Credit Union',
        parse(h, rows) {
            const iDate = col('date');
            const iDesc1 = h.findIndex(c => c.includes('description1'));
            const iDesc2 = h.findIndex(c => c.includes('description2'));
            const iAmt = col('amount');
            return rows.map(r => {
                const amount = _amt(r[iAmt]);
                const d1 = (r[iDesc1] || '').trim();
                const d2 = (r[iDesc2] || '').trim();
                const skipD2 = /^other reference/i.test(d2) || /^confirmation/i.test(d2) || !d2;
                const desc = skipD2 ? (d1 || 'Transaction') : (d1 + ' – ' + d2);
                return { date: _normDate(r[iDate]), desc: desc || 'Transaction',
                         amount: Math.abs(amount), type: amount < 0 ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Meridian / CIBC debit+credit split + balance
    if (has('date') && has('description') && (has('debit') || has('credit')) && has('balance')) {
        return {
            name: 'Meridian Credit Union / CIBC',
            parse(h, rows) {
                const iDate = col('date'), iDesc = col('description'),
                      iDebit = col('debit'), iCredit = col('credit');
                return rows.map(r => {
                    const debit = _amt(r[iDebit]), credit = _amt(r[iCredit]);
                    const amount = debit || credit;
                    return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                             amount: Math.abs(amount), type: debit ? 'expense' : 'income', raw: r.join(',') };
                }).filter(t => t.date && t.amount > 0);
            }
        };
    }

    // ── CIBC ─ date, description, debit, credit
    if (has('date') && has('description') && has('debit') && has('credit')) return {
        name: 'CIBC / Simplii Financial',
        parse(h, rows) {
            const iDate = col('date'), iDesc = col('description'),
                  iDebit = col('debit'), iCredit = col('credit');
            return rows.map(r => {
                const debit = _amt(r[iDebit]), credit = _amt(r[iCredit]);
                const amount = debit || credit;
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: debit ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── TD
    if (has('date') && has('description') && (has('debit') || has('credit')) && h.length <= 5) return {
        name: 'TD Bank',
        parse(h, rows) {
            const iDate = col('date'), iDesc = col('description'),
                  iDebit = col('debit'), iCredit = col('credit');
            return rows.map(r => {
                const debit = _amt(r[iDebit]), credit = _amt(r[iCredit]);
                const amount = debit || credit;
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: debit ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Simplii Financial
    if (has('funds out') || has('funds in') || has('transaction details')) return {
        name: 'Simplii Financial',
        parse(h, rows) {
            const iDate = col('date'),
                  iDesc = col('transaction details') !== -1 ? col('transaction details') : col('description'),
                  iOut = h.findIndex(c => c.includes('funds out')),
                  iIn = h.findIndex(c => c.includes('funds in'));
            return rows.map(r => {
                const out = _amt(r[iOut]), inn = _amt(r[iIn]);
                const amount = out || inn;
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: out ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Tangerine
    if (has('transaction') || (has('name') && has('memo') && has('amount'))) return {
        name: 'Tangerine Bank',
        parse(h, rows) {
            const iDate = col('date'),
                  iDesc = h.findIndex(c => c.includes('name') || c.includes('description')),
                  iMemo = col('memo'), iAmt = col('amount');
            return rows.map(r => {
                const amount = _amt(r[iAmt]);
                const desc = [r[iDesc], r[iMemo]].filter(v => v && v.trim())
                    .filter((v,i,a) => a.indexOf(v) === i).join(' – ').trim() || 'Transaction';
                return { date: _normDate(r[iDate]), desc, amount: Math.abs(amount),
                         type: amount < 0 ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── EQ Bank
    if (has('date') && has('description') && has('amount') && !has('balance')) return {
        name: 'EQ Bank',
        parse(h, rows) {
            const iDate = col('date'), iDesc = col('description'), iAmt = col('amount');
            return rows.map(r => {
                const amount = _amt(r[iAmt]);
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: amount < 0 ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── National Bank (French headers)
    if (has('débit') || has('crédit') || has('date de transaction') || has('numero')) return {
        name: 'National Bank',
        parse(h, rows) {
            const iDate = h.findIndex(c => c.includes('date')),
                  iDesc = h.findIndex(c => c.includes('description')),
                  iDebit = h.findIndex(c => c.includes('débit') || c.includes('debit')),
                  iCredit = h.findIndex(c => c.includes('crédit') || c.includes('credit'));
            return rows.map(r => {
                const debit = _amt(r[iDebit]), credit = _amt(r[iCredit]);
                const amount = debit || credit;
                return { date: _normDate(r[iDate]), desc: r[iDesc] || 'Transaction',
                         amount: Math.abs(amount), type: debit ? 'expense' : 'income', raw: r.join(',') };
            }).filter(t => t.date && t.amount > 0);
        }
    };

    // ── Generic fallback
    return {
        name: 'Unknown Bank',
        parse(h, rows) {
            const iDate = h.findIndex(c => c.includes('date') || c.includes('posted'));
            const iDesc = h.findIndex(c => c.includes('description') || c.includes('details') || c.includes('memo') || c.includes('payee') || c.includes('name') || c.includes('reference') || c.includes('narrative'));
            const iAmt = h.findIndex(c => c.includes('amount') || c.includes('cad') || c.includes('usd') || c.includes('value') || c.includes('sum'));
            const iDebit = h.findIndex(c => c.includes('debit') || c.includes('withdrawal') || c.includes('out'));
            const iCredit = h.findIndex(c => c.includes('credit') || c.includes('deposit') || c.includes('in'));
            if (iDate === -1) throw new Error('Could not find a date column. Columns found: ' + h.join(', '));
            if (iAmt === -1 && iDebit === -1 && iCredit === -1)
                throw new Error('Could not find amount, debit, or credit columns. Columns found: ' + h.join(', '));
            return rows.map(r => {
                let amount, type;
                if (iAmt !== -1) {
                    amount = _amt(r[iAmt]);
                    type = amount < 0 ? 'expense' : 'income';
                    amount = Math.abs(amount);
                } else {
                    const d = iDebit !== -1 ? _amt(r[iDebit]) : 0;
                    const cr = iCredit !== -1 ? _amt(r[iCredit]) : 0;
                    amount = d || cr; type = d ? 'expense' : 'income';
                }
                const desc = iDesc !== -1 ? (r[iDesc] || 'Transaction') : 'Transaction';
                return { date: _normDate(r[iDate]), desc, amount: Math.abs(amount), type, raw: r.join(',') };
            }).filter(t => t && t.date && t.amount > 0);
        }
    };
}
