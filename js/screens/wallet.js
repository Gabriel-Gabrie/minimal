/* ══════════════════════════════════════════════
   WALLET — Account Management
══════════════════════════════════════════════ */

let _walletType = 'spending';
let _walletEditId = null;
let _walletDetailId = null;
let _walletSelectedIcon = null;
let _walletSelectedColour = null;

const WALLET_DEFAULTS = {
    spending: [
        { name: 'Chequing',  icon: '🏦' },
        { name: 'Cash',      icon: '💵' },
        { name: 'Spending',  icon: '💳' },
    ],
    saving: [
        { name: 'Savings',        icon: '🐷' },
        { name: 'Emergency Fund', icon: '🛟' },
        { name: 'Downpayment',    icon: '🏠' },
        { name: 'Tuition',        icon: '🎓' },
    ],
    debt: [
        { name: 'Car Loan',      icon: '🚗' },
        { name: 'Visa',          icon: '💳' },
        { name: 'Mastercard',    icon: '💳' },
        { name: 'Personal Debt', icon: '🤝' },
    ],
};

const WALLET_ICONS = ['🏦','💳','💵','🐷','🛟','🏠','🏛️','🤝','🚗','💰','📈','🎓','✈️','💎','🛒','📱','🎮','🏥','👶','🐕','🎯','⚡','🌐','🔑'];

const WALLET_COLOURS = [
    '#10b981','#06b6d4','#3b82f6','#8b5cf6','#ec4899',
    '#f59e0b','#ef4444','#14b8a6','#6366f1','#f97316',
    '#84cc16','#a855f7',
];

function _walletFmt(n) {
    const v = parseFloat(n) || 0;
    const neg = v < 0;
    const abs = Math.abs(v);
    const str = abs >= 1000 ? abs.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : abs.toFixed(2);
    return (neg ? '-$' : '$') + str;
}

function _walletDateLabel(ds) {
    const today = getCurrentDateEST();
    const d = new Date(today); d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);
    if (ds === today)     return 'Today';
    if (ds === yesterday) return 'Yesterday';
    const [y, mo, day] = ds.split('-').map(Number);
    return new Date(y, mo - 1, day).toLocaleDateString('default', { weekday:'short', month:'short', day:'numeric' });
}

/* ── Render wallet page ─────────────────────── */
function renderWallet() {
    const listEl  = document.getElementById('wallet-accounts-list');
    const emptyEl = document.getElementById('wallet-empty');
    const addBtn  = document.getElementById('wallet-add-btn-wrap');
    if (!listEl) return;

    const spending = walletAccounts.filter(a => a.type === 'spending');
    const saving   = walletAccounts.filter(a => a.type === 'saving');
    const debt     = walletAccounts.filter(a => a.type === 'debt');

    // Net worth calculation
    const totalAssets = walletAccounts
        .filter(a => a.type !== 'debt')
        .reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    const totalDebts = walletAccounts
        .filter(a => a.type === 'debt')
        .reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    const netWorth = totalAssets - totalDebts;

    document.getElementById('wallet-net-worth').textContent = _walletFmt(netWorth);
    document.getElementById('wallet-net-worth').className = `text-3xl font-semibold tracking-tighter ${netWorth >= 0 ? '' : 'text-rose-400'}`;
    document.getElementById('wallet-total-assets').textContent = _walletFmt(totalAssets);
    document.getElementById('wallet-total-debts').textContent = _walletFmt(totalDebts);

    if (!walletAccounts.length) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('hidden');
        addBtn.classList.add('hidden');
        return;
    }
    emptyEl.classList.add('hidden');
    addBtn.classList.remove('hidden');

    let html = '';

    const sections = [
        { key: 'spending', label: 'Spending Accounts', items: spending, icon: '💳' },
        { key: 'saving',   label: 'Saving Accounts',   items: saving,   icon: '🐷' },
        { key: 'debt',     label: 'Debt Accounts',     items: debt,     icon: '🏛️' },
    ];

    sections.forEach(sec => {
        if (!sec.items.length) return;
        html += `<div>
            <div class="flex items-center gap-2 mb-2.5">
                <span class="text-sm">${sec.icon}</span>
                <span class="text-[9px] font-black tracking-[.14em] text-zinc-500 uppercase">${sec.label}</span>
                <div class="flex-1 h-px bg-zinc-800"></div>
            </div>
            <div class="space-y-2">`;

        sec.items.forEach((acc, accIdx) => {
            const colour = acc.colour || '#10b981';
            const isDebt = acc.type === 'debt';
            const balLabel = isDebt ? 'Left to pay' : (acc.type === 'saving' ? 'Saved' : 'Balance');
            const balVal   = parseFloat(acc.balance) || 0;
            const goalVal  = parseFloat(acc.goal) || 0;
            const hasGoal  = goalVal > 0;
            const pct = hasGoal ? Math.min((isDebt ? (1 - balVal / goalVal) : (balVal / goalVal)) * 100, 100) : -1;
            const defaultBadge = acc.isDefault ? `<span class="ml-auto text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full" style="background:${colour}20;color:${colour}">Default</span>` : '';

            html += `<div onclick="openWalletDetail('${acc.id}')" class="text-left bg-zinc-900 rounded-2xl p-4 hover:bg-zinc-800/80 transition-colors active:scale-[.99] cursor-pointer">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style="background:${colour}20">
                            <span>${acc.icon || '🏦'}</span>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <span class="font-semibold text-sm truncate">${acc.name}</span>
                                ${defaultBadge}
                            </div>
                            <div class="text-[11px] text-zinc-500 mt-0.5">${balLabel}</div>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="font-semibold text-sm tabular-nums ${isDebt ? 'text-rose-400' : ''}">${isDebt ? '-' : ''}${_walletFmt(balVal)}</div>
                            ${hasGoal ? `<div class="text-[10px] text-zinc-600 mt-0.5">${isDebt ? 'of ' + _walletFmt(goalVal) + ' paid' : 'of ' + _walletFmt(goalVal)}</div>` : ''}
                        </div>
                    </div>`;

            if (hasGoal && pct >= 0) {
                html += `<div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                    <div class="h-full rounded-full progress-bar" style="width:${Math.max(pct,0)}%;background:${colour}"></div>
                </div>`;
            }
            html += `</div>`;
        });

        html += `</div></div>`;
    });

    listEl.innerHTML = html;
}

/* ── Show add account modal ─────────────────── */
function showWalletAddModal() {
    _walletEditId = null;
    _walletType = 'spending';
    document.getElementById('wallet-modal-title').textContent = 'Add Account';
    document.getElementById('wallet-save-btn').textContent = 'Save Account';
    document.getElementById('wallet-name').value = '';
    document.getElementById('wallet-balance').value = '';
    document.getElementById('wallet-goal').value = '';
    document.getElementById('wallet-default').checked = false;
    _walletSelectedIcon = '🏦';
    _walletSelectedColour = '#10b981';
    _renderWalletModalType();
    document.getElementById('wallet-modal').classList.remove('hidden');
}

function hideWalletModal() {
    document.getElementById('wallet-modal').classList.add('hidden');
}

/* ── Set wallet account type ────────────────── */
function setWalletType(t) {
    _walletType = t;
    _renderWalletModalType();
}

function _renderWalletModalType() {
    const types = ['spending','saving','debt'];
    types.forEach(t => {
        const btn = document.getElementById('wtype-' + t);
        if (t === _walletType) {
            btn.className = 'flex flex-col items-center gap-1 py-3.5 transition-colors bg-emerald-500 text-white';
        } else {
            btn.className = 'flex flex-col items-center gap-1 py-3.5 transition-colors text-zinc-500';
        }
    });

    // Labels for debt vs non-debt
    const isDebt = _walletType === 'debt';
    document.getElementById('wallet-balance-label').textContent = isDebt ? 'Left to Pay' : 'Current Balance';
    document.getElementById('wallet-goal-label').textContent = isDebt ? 'Starting Debt' : 'Goal Amount';
    document.getElementById('wallet-balance').placeholder = isDebt ? '0.00' : '0.00';
    document.getElementById('wallet-goal').placeholder = isDebt ? '0.00' : '0.00';

    // Render defaults grid
    _renderWalletDefaults();
    // Render icon/colour pickers
    _renderWalletIconPicker();
    _renderWalletColourPicker();
}

function _renderWalletDefaults() {
    const grid = document.getElementById('wallet-defaults-grid');
    const defs = WALLET_DEFAULTS[_walletType] || [];
    grid.innerHTML = defs.map(d =>
        `<button onclick="_pickWalletDefault('${d.name}','${d.icon}')"
            class="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors active:scale-95">
            <span class="text-sm">${d.icon}</span>
            <span class="text-xs font-semibold text-zinc-300">${d.name}</span>
        </button>`
    ).join('') + `<button onclick="_pickWalletDefault('','')"
        class="flex items-center gap-2 px-3 py-2 bg-zinc-800/60 hover:bg-zinc-700 rounded-xl transition-colors active:scale-95 border border-dashed border-zinc-700">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span class="text-xs font-semibold text-zinc-500">Custom</span>
    </button>`;
}

function _pickWalletDefault(name, icon) {
    if (name) {
        document.getElementById('wallet-name').value = name;
        _walletSelectedIcon = icon;
        _renderWalletIconPicker();
    } else {
        document.getElementById('wallet-name').value = '';
        document.getElementById('wallet-name').focus();
    }
}

function _renderWalletIconPicker() {
    const grid = document.getElementById('wallet-icon-grid');
    grid.innerHTML = WALLET_ICONS.map(ic => {
        const sel = ic === _walletSelectedIcon;
        return `<button onclick="_selectWalletIcon('${ic}')"
            class="w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${sel ? 'ring-2 ring-emerald-500 bg-emerald-500/15 scale-110' : 'bg-zinc-800 hover:bg-zinc-700'}">${ic}</button>`;
    }).join('');
}

function _selectWalletIcon(ic) {
    _walletSelectedIcon = ic;
    _renderWalletIconPicker();
}

function _renderWalletColourPicker() {
    const grid = document.getElementById('wallet-colour-grid');
    grid.innerHTML = WALLET_COLOURS.map(c => {
        const sel = c === _walletSelectedColour;
        return `<button onclick="_selectWalletColour('${c}')"
            class="w-9 h-9 rounded-full transition-all ${sel ? 'ring-2 ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'}"
            style="background:${c};${sel ? 'ring-color:' + c : ''}"></button>`;
    }).join('');
}

function _selectWalletColour(c) {
    _walletSelectedColour = c;
    _renderWalletColourPicker();
}

/* ── Save account ───────────────────────────── */
function saveWalletAccount() {
    const name = document.getElementById('wallet-name').value.trim();
    if (!name) { document.getElementById('wallet-name').focus(); return; }

    const balance   = parseFloat(document.getElementById('wallet-balance').value) || 0;
    const goal      = parseFloat(document.getElementById('wallet-goal').value) || 0;
    const isDefault = document.getElementById('wallet-default').checked;

    // Clear other defaults of same type if this is set as default
    if (isDefault) {
        walletAccounts.forEach(a => {
            if (a.type === _walletType && (!_walletEditId || a.id !== _walletEditId)) {
                a.isDefault = false;
            }
        });
    }

    if (_walletEditId) {
        // Edit existing
        const acc = walletAccounts.find(a => a.id === _walletEditId);
        if (acc) {
            acc.name = name;
            acc.type = _walletType;
            acc.icon = _walletSelectedIcon;
            acc.colour = _walletSelectedColour;
            acc.balance = balance;
            acc.goal = goal;
            acc.isDefault = isDefault;
        }
    } else {
        // New account
        walletAccounts.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
            name,
            type: _walletType,
            icon: _walletSelectedIcon,
            colour: _walletSelectedColour,
            balance,
            goal,
            isDefault,
            createdAt: new Date().toISOString(),
        });
    }

    // Sync dynamic budget sections when saving/debt account changes
    if (_walletType === 'saving' || _walletType === 'debt') {
        const secType = _walletType === 'saving' ? 'Saving' : 'Debt';
        // If editing and name changed, rename in all monthly budgets
        if (_walletEditId && _walletEditOldName) {
            const oldName = _walletEditOldName;
            if (oldName !== name) {
                Object.keys(monthlyBudgets).forEach(mk => {
                    if (monthlyBudgets[mk][secType] && monthlyBudgets[mk][secType][oldName] !== undefined) {
                        monthlyBudgets[mk][secType][name] = monthlyBudgets[mk][secType][oldName];
                        delete monthlyBudgets[mk][secType][oldName];
                    }
                });
            }
        } else {
            // New account: add to existing month budgets
            Object.keys(monthlyBudgets).forEach(mk => {
                if (!monthlyBudgets[mk][secType]) monthlyBudgets[mk][secType] = {};
                if (monthlyBudgets[mk][secType][name] === undefined) {
                    monthlyBudgets[mk][secType][name] = 0;
                }
            });
        }
    }

    saveData();
    hideWalletModal();
    renderWallet();
    renderBudgets();
    showToast(_walletEditId ? 'Account updated' : 'Account added', 'emerald');
}

/* ── Account detail ─────────────────────────── */
function openWalletDetail(id) {
    const acc = walletAccounts.find(a => a.id === id);
    if (!acc) return;
    _walletDetailId = id;

    const colour = acc.colour || '#10b981';
    const isDebt = acc.type === 'debt';

    document.getElementById('wd-icon').textContent = acc.icon || '🏦';
    document.getElementById('wd-icon-wrap').style.background = colour + '20';
    document.getElementById('wd-name').textContent = acc.name;

    const badge = document.getElementById('wd-type-badge');
    const typeLabels = { spending: 'Spending', saving: 'Saving', debt: 'Debt' };
    badge.textContent = typeLabels[acc.type] || acc.type;
    const badgeColours = { spending: '#10b981', saving: '#06b6d4', debt: '#ef4444' };
    const bc = badgeColours[acc.type] || '#10b981';
    badge.style.background = bc + '20';
    badge.style.color = bc;

    // Stats
    const stats = document.getElementById('wd-stats');
    const bal = parseFloat(acc.balance) || 0;
    const goal = parseFloat(acc.goal) || 0;
    if (isDebt) {
        stats.innerHTML = `
            <div class="bg-zinc-900 rounded-2xl p-4">
                <p class="text-[9px] font-black tracking-[.1em] text-zinc-600 uppercase mb-2">Left to Pay</p>
                <p class="text-[15px] font-semibold tracking-tight text-rose-400 leading-none">${_walletFmt(bal)}</p>
            </div>
            <div class="bg-zinc-900 rounded-2xl p-4">
                <p class="text-[9px] font-black tracking-[.1em] text-zinc-600 uppercase mb-2">Starting Debt</p>
                <p class="text-[15px] font-semibold tracking-tight leading-none">${_walletFmt(goal)}</p>
            </div>`;
    } else {
        stats.innerHTML = `
            <div class="bg-zinc-900 rounded-2xl p-4">
                <p class="text-[9px] font-black tracking-[.1em] text-zinc-600 uppercase mb-2">Balance</p>
                <p class="text-[15px] font-semibold tracking-tight text-emerald-400 leading-none">${_walletFmt(bal)}</p>
            </div>
            <div class="bg-zinc-900 rounded-2xl p-4">
                <p class="text-[9px] font-black tracking-[.1em] text-zinc-600 uppercase mb-2">${acc.type === 'saving' ? 'Goal' : 'Goal'}</p>
                <p class="text-[15px] font-semibold tracking-tight leading-none">${goal > 0 ? _walletFmt(goal) : '—'}</p>
            </div>`;
    }

    // Progress
    const progWrap = document.getElementById('wd-progress-wrap');
    if (goal > 0 && (acc.type === 'saving' || acc.type === 'debt')) {
        progWrap.classList.remove('hidden');
        let pct;
        if (isDebt) {
            pct = goal > 0 ? Math.max(0, Math.min(((goal - bal) / goal) * 100, 100)) : 0;
            document.getElementById('wd-progress-label').textContent = 'Paid Off';
        } else {
            pct = goal > 0 ? Math.min((bal / goal) * 100, 100) : 0;
            document.getElementById('wd-progress-label').textContent = 'Progress';
        }
        document.getElementById('wd-progress-pct').textContent = Math.round(pct) + '%';
        document.getElementById('wd-progress-pct').style.color = colour;
        document.getElementById('wd-progress-bar').style.width = pct + '%';
        document.getElementById('wd-progress-bar').style.background = colour;
    } else {
        progWrap.classList.add('hidden');
    }

    // Transactions linked to this account (top 3 recent, overview-style)
    const txList  = document.getElementById('wd-tx-list');
    const txEmpty = document.getElementById('wd-tx-empty');
    const linked = transactions.filter(t =>
        (t.type === 'transfer' && (t.fromAccountId === id || t.toAccountId === id)) ||
        ((t.type === 'expense' || t.type === 'income') && t.walletAccountId === id)
    ).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    if (linked.length) {
        txEmpty.classList.add('hidden');
        txList.innerHTML = linked.map(t => {
            let emoji, amtCls, sign, title, dateLbl;
            dateLbl = _walletDateLabel(t.date);
            if (t.type === 'transfer') {
                const isOutgoing = t.fromAccountId === id;
                const otherAcc = _getAccById(isOutgoing ? t.toAccountId : t.fromAccountId);
                const otherName = otherAcc ? otherAcc.name : '?';
                emoji  = '🔄';
                amtCls = isOutgoing ? 'text-rose-400' : 'text-emerald-400';
                sign   = isOutgoing ? '\u2212' : '+';
                title  = t.desc || (isOutgoing ? '→ ' + otherName : '← ' + otherName);
            } else {
                const isInc = t.type === 'income';
                const iconKey = t.mainCategory + ':' + (t.subCategory || '');
                emoji  = itemIcons[iconKey] || mainEmojis[t.mainCategory] || (isInc ? '💰' : '💸');
                amtCls = isInc ? 'text-emerald-400' : 'text-zinc-200';
                sign   = isInc ? '+' : '\u2212';
                title  = t.desc || (t.mainCategory + (t.subCategory ? ' · ' + t.subCategory : ''));
            }
            return `<div class="flex items-center gap-3 py-2">
                <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">${emoji}</div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium leading-snug truncate">${title}</p>
                    <p class="text-[11px] text-zinc-600 mt-0.5">${dateLbl}</p>
                </div>
                <span class="${amtCls} font-semibold text-sm tabular-nums">${sign}$${parseFloat(t.amount).toFixed(2)}</span>
            </div>`;
        }).join('');
    } else {
        txList.innerHTML = '';
        txEmpty.classList.remove('hidden');
    }

    document.getElementById('wallet-detail-modal').classList.remove('hidden');
}

function walletDetailBackdrop(e) {
    if (e.target === e.currentTarget) {
        document.getElementById('wallet-detail-modal').classList.add('hidden');
    }
}

let _walletEditOldName = null;

function editWalletAccount() {
    const acc = walletAccounts.find(a => a.id === _walletDetailId);
    if (!acc) return;
    document.getElementById('wallet-detail-modal').classList.add('hidden');

    _walletEditId = acc.id;
    _walletEditOldName = acc.name;
    _walletType = acc.type;
    _walletSelectedIcon = acc.icon || '🏦';
    _walletSelectedColour = acc.colour || '#10b981';

    document.getElementById('wallet-modal-title').textContent = 'Edit Account';
    document.getElementById('wallet-save-btn').textContent = 'Update Account';
    document.getElementById('wallet-name').value = acc.name;
    document.getElementById('wallet-balance').value = acc.balance || '';
    document.getElementById('wallet-goal').value = acc.goal || '';
    document.getElementById('wallet-default').checked = !!acc.isDefault;

    _renderWalletModalType();
    document.getElementById('wallet-modal').classList.remove('hidden');
}

function deleteWalletAccount() {
    const acc = walletAccounts.find(a => a.id === _walletDetailId);
    if (!acc) return;
    if (!confirm('Delete this account? This cannot be undone.')) return;

    // Clean up budget data for saving/debt accounts
    if (acc.type === 'saving' || acc.type === 'debt') {
        const secType = acc.type === 'saving' ? 'Saving' : 'Debt';
        Object.keys(monthlyBudgets).forEach(mk => {
            if (monthlyBudgets[mk][secType]) {
                delete monthlyBudgets[mk][secType][acc.name];
                if (Object.keys(monthlyBudgets[mk][secType]).length === 0) {
                    delete monthlyBudgets[mk][secType];
                }
            }
        });
    }

    walletAccounts = walletAccounts.filter(a => a.id !== _walletDetailId);
    saveData();
    document.getElementById('wallet-detail-modal').classList.add('hidden');
    renderWallet();
    renderBudgets();
    showToast('Account deleted', 'rose');
}

function openEditTx(idx) {
    const t = transactions[idx];
    if (!t) return;
    _editingTxIdx = idx;
    document.getElementById('add-modal').classList.remove('hidden');
    document.getElementById('date').value = t.date;
    document.getElementById('amount').value = parseFloat(t.amount).toFixed(2);
    document.getElementById('desc').value = t.desc || '';
    // Restore exclude state
    const exclCb = document.getElementById('tx-exclude');
    if (exclCb) exclCb.checked = !!t.excluded;
    setType(t.type === 'transfer' ? 'transfer' : (t.type === 'expense' || t.excluded ? 'expense' : t.type));
    updateExcludeUI();
    // After setType populates selects, set values
    if (t.type === 'transfer') {
        setTimeout(() => {
            const fromSel = document.getElementById('transfer-from');
            const toSel   = document.getElementById('transfer-to');
            if (fromSel) fromSel.value = t.fromAccountId || '';
            // Re-populate to options based on from selection
            _populateTransferAccounts();
            if (fromSel) fromSel.value = t.fromAccountId || '';
            if (toSel) {
                // Rebuild to options excluding selected from
                const fromId = fromSel.value;
                toSel.innerHTML = walletAccounts
                    .filter(a => a.id !== fromId)
                    .map(a => `<option value="${a.id}">${a.icon || '🏦'} ${a.name}</option>`)
                    .join('');
                toSel.value = t.toAccountId || '';
            }
            _updateTransferBudgetInfo();
        }, 0);
        const saveBtn = document.getElementById('save-transaction-btn');
        if (saveBtn) saveBtn.textContent = 'Update Transfer';
    } else if (t.type === 'expense' && !t.excluded) {
        document.getElementById('main-cat').value = t.mainCategory || '';
        updateSubOptions();
        setTimeout(() => {
            document.getElementById('sub-cat').value = t.subCategory || '';
        }, 0);
        // Restore expense account
        const expAccSel = document.getElementById('expense-account');
        if (expAccSel && t.walletAccountId) expAccSel.value = t.walletAccountId;
    } else if (t.type === 'income') {
        document.getElementById('income-cat').value = t.mainCategory || '';
        // Restore income account
        setTimeout(() => {
            const incAccSel = document.getElementById('income-account');
            if (incAccSel && t.walletAccountId) {
                incAccSel.value = t.walletAccountId;
                _onIncomeAccountChange();
            }
        }, 0);
    }
    if (t.type !== 'transfer') {
        const saveBtn = document.getElementById('save-transaction-btn');
        if (saveBtn) saveBtn.textContent = t.type === 'income' ? 'Update Income' : 'Update Expense';
    }
}

function addTransaction() {
    const amount  = parseFloat(document.getElementById('amount').value);
    if (!amount || amount <= 0) return alert("Enter amount");
    const date    = document.getElementById('date').value;
    const desc    = document.getElementById('desc').value.trim();
    const exclude = !!(document.getElementById('tx-exclude')?.checked);

    let trans = { type: currentType, amount, date, desc };

    if (currentType === 'transfer') {
        const fromId = document.getElementById('transfer-from')?.value;
        const toId   = document.getElementById('transfer-to')?.value;
        if (!fromId || !toId) return alert("Select From and To accounts");
        if (fromId === toId) return alert("From and To accounts must be different");
        trans.fromAccountId = fromId;
        trans.toAccountId   = toId;
        trans.mainCategory  = '';
        trans.subCategory   = '';
    } else if (exclude) {
        trans.excluded     = true;
        trans.mainCategory = '';
        trans.subCategory  = '';
    } else if (currentType === 'expense') {
        trans.mainCategory = document.getElementById('main-cat').value;
        trans.subCategory  = document.getElementById('sub-cat').value;
        if (!trans.mainCategory || !trans.subCategory) return alert("Choose section & category");
        const expAccId = document.getElementById('expense-account')?.value;
        if (expAccId) trans.walletAccountId = expAccId;
    } else {
        trans.mainCategory = document.getElementById('income-cat').value;
        trans.subCategory  = '';
        const incAccId = document.getElementById('income-account')?.value;
        if (incAccId) trans.walletAccountId = incAccId;
    }

    // Undo old balance changes when editing
    if (_editingTxIdx !== null) {
        _updateAccountBalances(transactions[_editingTxIdx], true);
        trans.id = transactions[_editingTxIdx].id;
        transactions[_editingTxIdx] = trans;
    } else {
        trans.id = Date.now();
        transactions.unshift(trans);
    }
    // Apply new balance changes
    _updateAccountBalances(trans, false);
    saveData();
    hideModal();
    renderAll();
}

function deleteTransaction(index) {
    _showUndo(index);
}


