/* ── Budget Item Edit Modal ──────────────────────────────────── */
const BUDGET_ICONS = [
    '🛒','🍔','🍕','🌮','🥑','☕','🍜','🍷','🧃','🍰',
    '🏠','🛋️','💡','🔧','🧹','🌿','📦','🔑','🛁','🖥️',
    '👔','✂️','💄','🎮','📱','🎵','📚','🏋️','🎨','🧴',
    '🚗','✈️','⛽','🚌','🚲','🅿️','🛵','🚆','🛳️','🚁',
    '💊','🏥','🧘','🏃','🦷','👓','🩺','💉','🥗','🌡️',
    '💳','🏦','💰','📊','💸','🎯','🏆','💼','📈','🤝',
    '🎬','🎭','🎪','🎡','🎢','🎳','🎲','🃏','🎤','🏖️',
    '🌍','📅','🔔','⚡','🌟','❤️','🎁','✨','🐾','☂️',
];

function openBudgetItemModal(main, sub) {
    _bimMain = main;
    _bimSub  = sub;
    _bimSelectedIcon = null;

    const isDynamic = (main === 'Saving' || main === 'Debt');
    const mb     = monthlyBudgets[selectedBudgetMonth] || {};
    const budget = (mb[main] || {})[sub] || 0;
    const isInc  = main === 'Income';

    let actual;
    if (isDynamic) {
        const acc = walletAccounts.find(a => a.name === sub && a.type === main.toLowerCase());
        actual = acc ? _calculateTransferToAccount(selectedBudgetMonth, acc.id) : 0;
    } else {
        actual = isInc ? calculateIncomeInMonth(selectedBudgetMonth, sub)
                       : calculateSpentInMonth(selectedBudgetMonth, main, sub);
    }

    let icon;
    if (isDynamic) {
        const acc = walletAccounts.find(a => a.name === sub && a.type === main.toLowerCase());
        icon = acc ? (acc.icon || (main === 'Debt' ? '💳' : '🐷')) : '💸';
    } else {
        icon = itemIcons[`${main}:${sub}`] || defaultItemIcons[`${main}:${sub}`] || (isInc ? '💵' : '💸');
    }

    const pct    = budget > 0 ? Math.abs(actual) / budget * 100 : 0;
    const color  = _budgetItemColor(pct, isInc);
    const remaining = budget - actual;

    // Header icon
    const hdrIcon = document.getElementById('bim-hdr-icon');
    if (hdrIcon) hdrIcon.textContent = icon;

    // Centered name + category
    const nameEl = document.getElementById('bim-name-display');
    if (nameEl) {
        nameEl.textContent = sub;
        nameEl.onclick = isDynamic ? null : function() { _bimInlineEditName(this); };
        nameEl.style.cursor = isDynamic ? 'default' : 'pointer';
    }
    const catEl = document.getElementById('bim-cat-label');
    if (catEl) catEl.textContent = main;

    // Stats row
    const budgetedEl = document.getElementById('bim-stat-budgeted');
    if (budgetedEl) {
        budgetedEl.textContent = budget > 0 ? `$${Math.round(budget)}` : 'Not set';
        budgetedEl.onclick = function() { _bimInlineEditAmount(this); };
    }
    const spentEl = document.getElementById('bim-stat-spent');
    if (spentEl) {
        spentEl.textContent = `$${Math.round(Math.abs(actual))}`;
        spentEl.className = 'text-sm font-bold ' + (isInc ? 'text-emerald-400' : 'text-rose-400');
        // Update label for income
        const spentLabel = spentEl.parentElement?.querySelector('.text-zinc-600');
        if (spentLabel) spentLabel.textContent = isInc ? 'Received' : 'Spent';
    }
    const leftEl = document.getElementById('bim-stat-left');
    if (leftEl) {
        if (budget > 0) {
            leftEl.textContent = remaining >= 0 ? `$${Math.round(remaining)}` : `-$${Math.round(-remaining)}`;
            leftEl.className = 'text-sm font-bold ' + (remaining >= 0 ? 'text-emerald-400' : 'text-rose-400');
        } else {
            leftEl.textContent = '—';
            leftEl.className = 'text-sm font-bold text-zinc-600';
        }
    }

    // Progress bar
    const progWrap = document.getElementById('bim-progress-wrap');
    const progBar  = document.getElementById('bim-progress-bar');
    const progPct  = document.getElementById('bim-progress-pct');
    if (budget > 0 && progWrap) {
        progWrap.classList.remove('hidden');
        const barPct = Math.min(pct, 100);
        if (progBar) {
            progBar.style.width = barPct + '%';
            progBar.style.backgroundColor = color;
        }
        if (progPct) {
            progPct.textContent = Math.round(pct) + '%';
            progPct.style.color = color;
        }
    } else if (progWrap) {
        progWrap.classList.add('hidden');
    }

    // Icon picker — hidden for dynamic sections, populate grid for others
    const pickerEl = document.getElementById('bim-icon-picker');
    if (pickerEl) pickerEl.classList.add('hidden');
    const grid = document.getElementById('bim-icon-grid');
    if (grid && !isDynamic) {
        grid.innerHTML = BUDGET_ICONS.map(e =>
            `<button type="button" onclick="_bimSelectIcon('${e}')"
                class="text-xl w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition-all ${e === icon ? 'bg-zinc-700 ring-2 ring-emerald-500' : 'hover:bg-zinc-700'}">${e}</button>`
        ).join('');
    }

    // Show/hide edit button — hidden for dynamic sections
    const editBtn = document.getElementById('bim-edit-btn');
    if (editBtn) editBtn.classList.toggle('hidden', isDynamic);

    // Show/hide delete — hidden for dynamic sections (managed by wallet)
    const del = document.getElementById('bim-delete-btn');
    if (isDynamic) {
        if (del) del.classList.add('hidden');
    } else {
        const arr = expenseCategories[main] || [];
        if (del) del.classList.toggle('hidden', arr.length <= 1);
    }

    // Populate transaction list
    _bimPopulateTxList(main, sub, isInc, isDynamic);

    document.getElementById('budget-item-modal').classList.remove('hidden');
}

// Edit button handler — opens add-budget-item modal in edit mode
function _bimStartEdit() {
    const main = _bimMain, sub = _bimSub;
    if (!main || !sub) return;
    document.getElementById('budget-item-modal').classList.add('hidden');
    // Open add-item modal pre-populated for editing
    const mb = monthlyBudgets[selectedBudgetMonth] || {};
    const budget = (mb[main] || {})[sub] || 0;
    const icon = itemIcons[`${main}:${sub}`] || defaultItemIcons[`${main}:${sub}`] || '💸';
    const modal = document.getElementById('add-budget-item-modal');
    const catLabel = document.getElementById('aim-cat-label');
    const nameInput = document.getElementById('aim-name-input');
    const amtInput = document.getElementById('aim-amount-input');
    const hdrIcon = document.getElementById('aim-hdr-icon');
    if (catLabel) catLabel.textContent = main;
    if (nameInput) nameInput.value = sub;
    if (amtInput) amtInput.value = budget || '';
    if (hdrIcon) hdrIcon.textContent = icon;
    _aimSelectedIcon = icon;
    _aimEditingMain = main;
    _aimEditingSub = sub;
    // Update button text
    const addBtn = modal?.querySelector('button[onclick="_aimConfirm()"]');
    if (addBtn) addBtn.textContent = 'Save Changes';
    // Populate icon picker
    const grid = document.getElementById('aim-icon-grid');
    if (grid) {
        grid.innerHTML = BUDGET_ICONS.map(e =>
            `<button type="button" onclick="_aimSelectIcon('${e}')"
                class="text-xl w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition-all ${e === icon ? 'bg-zinc-700 ring-2 ring-emerald-500' : 'hover:bg-zinc-700'}">${e}</button>`
        ).join('');
    }
    if (modal) modal.classList.remove('hidden');
}
let _aimEditingMain = null, _aimEditingSub = null;

function _bimPopulateTxList(main, sub, isInc, isDynamic) {
    const [year, month] = selectedBudgetMonth.split('-').map(Number);
    let monthTxs;
    if (isDynamic) {
        // Show transfers involving this account
        const acc = walletAccounts.find(a => a.name === sub && a.type === main.toLowerCase());
        monthTxs = acc ? transactions.filter(t => {
            if (t.type !== 'transfer') return false;
            const d = new Date(t.date + 'T00:00:00');
            if (d.getFullYear() !== year || (d.getMonth() + 1) !== month) return false;
            const fromType = _getAccType(t.fromAccountId);
            const toType   = _getAccType(t.toAccountId);
            // spending→saving/debt to this account, or this account→spending
            return (fromType === 'spending' && t.toAccountId === acc.id) ||
                   (t.fromAccountId === acc.id && toType === 'spending');
        }).sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
    } else {
        monthTxs = transactions.filter(t => {
            const d = new Date(t.date + 'T00:00:00');
            if (d.getFullYear() !== year || (d.getMonth() + 1) !== month) return false;
            if (t.excluded) return false;
            if (isInc) return t.type === 'income' && t.mainCategory === sub;
            return t.type === 'expense' && t.mainCategory === main && t.subCategory === sub;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    const listEl  = document.getElementById('bim-tx-list');
    const emptyEl = document.getElementById('bim-tx-empty');

    if (monthTxs.length === 0) {
        if (listEl)  listEl.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    const sign = isInc ? '+' : '-';
    const amtStyle = isInc ? 'color:#34d399' : 'color:#e4e4e7';
    listEl.innerHTML = monthTxs.map(t => {
        const d   = new Date(t.date + 'T00:00:00');
        const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<div class="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3">
            <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-zinc-200 truncate">${t.description || (isInc ? 'Income' : 'Expense')}</div>
                <div class="text-[11px] text-zinc-600 mt-0.5">${day}</div>
            </div>
            <div class="text-sm font-bold ml-3 shrink-0" style="${amtStyle}">${sign}$${t.amount.toFixed(2)}</div>
        </div>`;
    }).join('');
}

function _bimToggleIconPicker() {
    const picker = document.getElementById('bim-icon-picker');
    if (picker) picker.classList.toggle('hidden');
}

function _bimSelectIcon(emoji) {
    _bimSelectedIcon = emoji;
    const hdrIcon = document.getElementById('bim-hdr-icon');
    if (hdrIcon) hdrIcon.textContent = emoji;
    document.querySelectorAll('#bim-icon-grid button').forEach(btn => {
        const sel = btn.textContent.trim() === emoji;
        btn.className = 'text-xl w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition-all '
            + (sel ? 'bg-zinc-700 ring-2 ring-emerald-500' : 'hover:bg-zinc-700');
    });
    // Save immediately and close picker
    if (_bimMain && _bimSub) {
        itemIcons[`${_bimMain}:${_bimSub}`] = emoji;
        saveData();
        renderBudgets();
    }
    document.getElementById('bim-icon-picker').classList.add('hidden');
}

function _bimInlineEditName(el) {
    const current = el.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'w-full bg-zinc-800 rounded-xl px-3 py-1.5 text-base font-bold text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';
    el.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
        const newName = input.value.trim() || current;
        if (newName !== current && _bimMain && _bimSub) {
            if ((expenseCategories[_bimMain] || []).includes(newName)) {
                alert(`"${newName}" already exists in ${_bimMain}.`);
            } else {
                const idx = (expenseCategories[_bimMain] || []).indexOf(_bimSub);
                if (idx !== -1) expenseCategories[_bimMain][idx] = newName;
                Object.keys(monthlyBudgets).forEach(mo => {
                    const mb = monthlyBudgets[mo];
                    if (mb[_bimMain] && _bimSub in mb[_bimMain]) {
                        mb[_bimMain][newName] = mb[_bimMain][_bimSub];
                        delete mb[_bimMain][_bimSub];
                    }
                });
                transactions.forEach(t => {
                    if (t.mainCategory === _bimMain && t.subCategory === _bimSub) t.subCategory = newName;
                });

                if (itemIcons[`${_bimMain}:${_bimSub}`]) {
                    itemIcons[`${_bimMain}:${newName}`] = itemIcons[`${_bimMain}:${_bimSub}`];
                    delete itemIcons[`${_bimMain}:${_bimSub}`];
                }
                _bimSub = newName;
                saveData();
                renderBudgets();
            }
        }
        const nameEl = document.createElement('div');
        nameEl.id = 'bim-name-display';
        nameEl.className = 'text-base font-bold text-zinc-100 mb-0.5 cursor-pointer truncate active:text-emerald-400 transition-colors';
        nameEl.textContent = _bimSub;
        nameEl.onclick = function() { _bimInlineEditName(this); };
        input.replaceWith(nameEl);
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = current; input.blur(); }
    });
}

function _bimInlineEditAmount(el) {
    const mb      = monthlyBudgets[selectedBudgetMonth] || {};
    const current = (mb[_bimMain] || {})[_bimSub] || 0;

    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.step = '1';
    input.min  = '0';
    input.value = current > 0 ? current : '';
    input.placeholder = '0';
    input.className = 'bg-zinc-800 rounded-lg px-2 py-0.5 text-sm font-bold text-zinc-100 w-20 text-center focus:outline-none focus:ring-1 focus:ring-emerald-500';
    el.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
        const newAmt = Math.round(parseFloat(input.value) || 0);
        monthlyBudgets[selectedBudgetMonth] = monthlyBudgets[selectedBudgetMonth] || {};
        monthlyBudgets[selectedBudgetMonth][_bimMain] = monthlyBudgets[selectedBudgetMonth][_bimMain] || {};
        monthlyBudgets[selectedBudgetMonth][_bimMain][_bimSub] = newAmt;
        saveData();
        renderBudgets();
        // Refresh the modal stats
        openBudgetItemModal(_bimMain, _bimSub);
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') {
            openBudgetItemModal(_bimMain, _bimSub);
        }
    });
}

function _bimInlinePlanAmount(main, sub, el) {
    const mb      = monthlyBudgets[selectedBudgetMonth] || {};
    const current = (mb[main] || {})[sub] || 0;

    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.step = '1';
    input.min  = '0';
    input.value = current > 0 ? current : '';
    input.placeholder = '0';
    input.className = 'w-full bg-zinc-800 rounded-lg text-center text-[12px] font-bold text-zinc-100 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500';
    el.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
        const newAmt = Math.round(parseFloat(input.value) || 0);
        monthlyBudgets[selectedBudgetMonth] = monthlyBudgets[selectedBudgetMonth] || {};
        monthlyBudgets[selectedBudgetMonth][main] = monthlyBudgets[selectedBudgetMonth][main] || {};
        monthlyBudgets[selectedBudgetMonth][main][sub] = newAmt;
        saveData();
        renderBudgets();
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { renderBudgets(); }
    });
}

function closeBudgetItemModal() {
    document.getElementById('budget-item-modal').classList.add('hidden');
    _bimMain = null; _bimSub = null; _bimSelectedIcon = null;
}

function _bimBackdrop(e) {
    if (e.target === document.getElementById('budget-item-modal')) closeBudgetItemModal();
}

function deleteBudgetItemFromModal() {
    if (!_bimMain || !_bimSub) return;
    if (!confirm(`Delete category "${_bimSub}" from ${_bimMain}?\nTransactions using it will stay.`)) return;
    expenseCategories[_bimMain] = (expenseCategories[_bimMain] || []).filter(s => s !== _bimSub);
    Object.keys(monthlyBudgets).forEach(k => {
        if (monthlyBudgets[k]?.[_bimMain]) delete monthlyBudgets[k][_bimMain][_bimSub];
    });
    delete itemIcons[`${_bimMain}:${_bimSub}`];
    saveData();
    closeBudgetItemModal();
    renderBudgets();
}

/* ══════════════════════════════════════════════
   SPEED DIAL FAB
══════════════════════════════════════════════ */
let _fabOpen = false;

function toggleFab() {
    _fabOpen ? closeFab() : openFab();
}

function openFab() {
    _fabOpen = true;
    const icon = document.getElementById('fab-icon');
    const opts = document.getElementById('fab-options');
    const bg   = document.getElementById('fab-backdrop');
    if (icon) icon.style.transform = 'rotate(45deg)';
    if (opts) { opts.classList.remove('opacity-0','pointer-events-none','translate-y-3'); opts.classList.add('opacity-100','pointer-events-auto','translate-y-0'); }
    if (bg)   bg.classList.remove('hidden');
}

function closeFab() {
    _fabOpen = false;
    const icon = document.getElementById('fab-icon');
    const opts = document.getElementById('fab-options');
    const bg   = document.getElementById('fab-backdrop');
    if (icon) icon.style.transform = '';
    if (opts) { opts.classList.add('opacity-0','pointer-events-none','translate-y-3'); opts.classList.remove('opacity-100','pointer-events-auto','translate-y-0'); }
    if (bg)   bg.classList.add('hidden');
}

function fabAdd(type) {
    closeFab();
    showAddModal(type);
}

/* ══════════════════════════════════════════════
   ADD / EDIT TRANSACTION MODAL
══════════════════════════════════════════════ */
function showAddModal(type) {
    document.getElementById('add-modal').classList.remove('hidden');
    document.getElementById('date').value = getCurrentDateEST();
    document.getElementById('amount').value = '';
    document.getElementById('desc').value = '';
    const excl = document.getElementById('tx-exclude');
    if (excl) excl.checked = false;
    setType(type || 'expense');
    updateExcludeUI();
}

function updateExcludeUI() {
    const excl    = !!document.getElementById('tx-exclude')?.checked;
    const fields  = document.getElementById('expense-fields');
    const incRow  = document.getElementById('income-cat-row');
    const trfFields = document.getElementById('transfer-fields');
    if (fields)  fields.style.opacity  = excl ? '0.3' : '';
    if (incRow)  incRow.style.opacity   = excl ? '0.3' : '';
    // Disable category interaction when excluded
    if (fields)  fields.querySelectorAll('select,input').forEach(function(el) { el.disabled = excl; });
    if (incRow)  incRow.querySelectorAll('select,input').forEach(function(el) { el.disabled = excl; });
    // Transfer mode: exclude checkbox not applicable, but handle gracefully
    if (trfFields && currentType === 'transfer') {
        const exclCb = document.getElementById('tx-exclude');
        if (exclCb) exclCb.checked = false;
    }
}

function hideModal() {
    document.getElementById('add-modal').classList.add('hidden');
    _editingTxIdx = null;
}

function setType(type) {
    currentType = type;
    const expFields = document.getElementById('expense-fields');
    const incCatRow = document.getElementById('income-cat-row');
    const trfFields = document.getElementById('transfer-fields');
    const incSelect = document.getElementById('income-cat');
    const amtInput  = document.getElementById('amount');
    const amtPrefix = document.getElementById('amount-prefix');
    const saveBtn   = document.getElementById('save-transaction-btn');
    const badge     = document.getElementById('modal-type-badge');

    // Reset field visibility
    expFields.classList.add('hidden');
    incCatRow.classList.add('hidden');
    if (trfFields) trfFields.classList.add('hidden');

    // Hide exclude toggle for transfers
    const exclWrap = document.getElementById('exclude-toggle-wrap');
    if (exclWrap) exclWrap.classList.toggle('hidden', type === 'transfer');

    if (type === 'expense') {
        expFields.classList.remove('hidden');
        amtInput.classList.remove('text-emerald-400','text-sky-400'); amtInput.classList.add('text-rose-400');
        amtPrefix.classList.remove('text-emerald-400','text-sky-400'); amtPrefix.classList.add('text-rose-400');
        if (badge) { badge.textContent = 'Expense'; badge.className = 'text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-rose-500/15 text-rose-400'; }
        if (saveBtn) {
            saveBtn.className = 'w-full bg-rose-500 hover:bg-rose-600 active:scale-[.98] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all';
            saveBtn.textContent = 'Save Expense';
        }
        updateMainOptions();
        _populateExpenseAccountSelect();
    } else if (type === 'income') {
        incCatRow.classList.remove('hidden');
        amtInput.classList.remove('text-rose-400','text-sky-400'); amtInput.classList.add('text-emerald-400');
        amtPrefix.classList.remove('text-rose-400','text-sky-400'); amtPrefix.classList.add('text-emerald-400');
        if (badge) { badge.textContent = 'Income'; badge.className = 'text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400'; }
        if (saveBtn) {
            saveBtn.className = 'w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[.98] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all';
            saveBtn.textContent = 'Save Income';
        }
        incSelect.innerHTML = '';
        (expenseCategories['Income'] || incomeCats).forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; incSelect.appendChild(opt); });
        _populateIncomeAccountSelect();
    } else if (type === 'transfer') {
        if (trfFields) trfFields.classList.remove('hidden');
        amtInput.classList.remove('text-rose-400','text-emerald-400'); amtInput.classList.add('text-sky-400');
        amtPrefix.classList.remove('text-rose-400','text-emerald-400'); amtPrefix.classList.add('text-sky-400');
        if (badge) { badge.textContent = 'Transfer'; badge.className = 'text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-sky-500/15 text-sky-400'; }
        if (saveBtn) {
            saveBtn.className = 'w-full bg-sky-500 hover:bg-sky-600 active:scale-[.98] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all';
            saveBtn.textContent = 'Save Transfer';
        }
        _populateTransferAccounts();
    }
}

function _populateTransferAccounts() {
    const fromSel = document.getElementById('transfer-from');
    const toSel   = document.getElementById('transfer-to');
    if (!fromSel || !toSel) return;

    const accounts = walletAccounts;
    if (accounts.length < 2) {
        fromSel.innerHTML = '<option value="">Need at least 2 accounts</option>';
        toSel.innerHTML   = '<option value="">Need at least 2 accounts</option>';
        return;
    }

    const buildOpts = (excludeId) => {
        return accounts
            .filter(a => a.id !== excludeId)
            .map(a => `<option value="${a.id}">${a.icon || '🏦'} ${a.name}</option>`)
            .join('');
    };

    fromSel.innerHTML = accounts.map(a =>
        `<option value="${a.id}">${a.icon || '🏦'} ${a.name}</option>`
    ).join('');

    const updateTo = () => {
        const fromId = fromSel.value;
        toSel.innerHTML = buildOpts(fromId);
        _updateTransferBudgetInfo();
    };

    fromSel.onchange = updateTo;
    toSel.onchange = _updateTransferBudgetInfo;
    updateTo();
}

function _updateTransferBudgetInfo() {
    const fromSel = document.getElementById('transfer-from');
    const toSel   = document.getElementById('transfer-to');
    const infoEl  = document.getElementById('transfer-budget-info');
    if (!fromSel || !toSel || !infoEl) return;

    const fromAcc = walletAccounts.find(a => a.id === fromSel.value);
    const toAcc   = walletAccounts.find(a => a.id === toSel.value);
    if (!fromAcc || !toAcc) { infoEl.classList.add('hidden'); return; }

    const fromType = fromAcc.type;
    const toType   = toAcc.type;
    const msgEl    = infoEl.querySelector('div');

    if (fromType === toType) {
        msgEl.textContent = 'Same-type transfer — excluded from budget & reports.';
        infoEl.classList.remove('hidden');
    } else if (fromType === 'spending' && (toType === 'saving' || toType === 'debt')) {
        msgEl.textContent = `Budget category: ${toAcc.name} (${toType === 'saving' ? 'Saving' : 'Debt'} section)`;
        infoEl.classList.remove('hidden');
    } else if ((fromType === 'saving' || fromType === 'debt') && toType === 'spending') {
        msgEl.textContent = `Counts as -$amount from ${fromAcc.name} (${fromType === 'saving' ? 'Saving' : 'Debt'} section)`;
        infoEl.classList.remove('hidden');
    } else {
        infoEl.classList.add('hidden');
    }
}

/* ── Account select helpers for expense/income ───────── */
function _populateExpenseAccountSelect() {
    const sel = document.getElementById('expense-account');
    if (!sel) return;
    const typeLabels = { spending: 'Spending', saving: 'Saving', debt: 'Debt' };
    sel.innerHTML = '<option value="">None</option>' +
        walletAccounts.map(a => `<option value="${a.id}">${a.icon || '🏦'} ${a.name} (${typeLabels[a.type] || a.type})</option>`).join('');
}

function _populateIncomeAccountSelect() {
    const sel = document.getElementById('income-account');
    if (!sel) return;
    const typeLabels = { spending: 'Spending', saving: 'Saving', debt: 'Debt' };
    sel.innerHTML = '<option value="">None</option>' +
        walletAccounts.map(a => `<option value="${a.id}">${a.icon || '🏦'} ${a.name} (${typeLabels[a.type] || a.type})</option>`).join('');
    _onIncomeAccountChange();
}

function _onIncomeAccountChange() {
    const sel = document.getElementById('income-account');
    const incCatSel = document.getElementById('income-cat');
    if (!sel || !incCatSel) return;
    const acc = walletAccounts.find(a => a.id === sel.value);
    if (acc && (acc.type === 'saving' || acc.type === 'debt')) {
        // Lock income type to match the account section
        const secType = acc.type === 'saving' ? 'Saving' : 'Debt';
        incCatSel.innerHTML = `<option value="${acc.name}" selected>${acc.name}</option>`;
        incCatSel.disabled = true;
        incCatSel.style.opacity = '0.5';
    } else {
        incCatSel.disabled = false;
        incCatSel.style.opacity = '';
        // Re-populate if it was locked
        if (incCatSel.options.length <= 1 || incCatSel.disabled === false) {
            const current = incCatSel.value;
            incCatSel.innerHTML = '';
            (expenseCategories['Income'] || incomeCats).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c; opt.textContent = c;
                incCatSel.appendChild(opt);
            });
            if (current) incCatSel.value = current;
        }
    }
}

/* ── Account balance update helpers ─────────────────── */
function _updateAccountBalances(trans, isUndo) {
    const amt = parseFloat(trans.amount);
    const sign = isUndo ? -1 : 1;

    if (trans.type === 'transfer') {
        // Transfers always update balances regardless of exclusion
        const fromAcc = walletAccounts.find(a => a.id === trans.fromAccountId);
        const toAcc   = walletAccounts.find(a => a.id === trans.toAccountId);
        if (fromAcc) fromAcc.balance = parseFloat(fromAcc.balance || 0) - amt * sign;
        if (toAcc)   toAcc.balance   = parseFloat(toAcc.balance || 0) + amt * sign;
    } else if (!trans.excluded) {
        // Non-excluded expense/income update linked account
        const accId = trans.walletAccountId;
        if (!accId) return;
        const acc = walletAccounts.find(a => a.id === accId);
        if (!acc) return;
        if (trans.type === 'expense') {
            if (acc.type === 'debt') {
                // Expense from debt: debt increases (you owe more)
                acc.balance = parseFloat(acc.balance || 0) + amt * sign;
            } else {
                // Expense from spending/saving: balance decreases
                acc.balance = parseFloat(acc.balance || 0) - amt * sign;
            }
        } else if (trans.type === 'income') {
            if (acc.type === 'debt') {
                // Income to debt: debt decreases (paying it off)
                acc.balance = parseFloat(acc.balance || 0) - amt * sign;
            } else {
                // Income to spending/saving: balance increases
                acc.balance = parseFloat(acc.balance || 0) + amt * sign;
            }
        }
    }
}

function updateMainOptions() {
    const sel = document.getElementById('main-cat');
    sel.innerHTML = '<option value="">Select section</option>';
    Object.keys(expenseCategories).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = `${mainEmojis[m]} ${m}`;
        sel.appendChild(opt);
    });
    updateSubOptions();
}

function updateSubOptions() {
    const main = document.getElementById('main-cat').value;
    const sel = document.getElementById('sub-cat'); sel.innerHTML = '';
    if (!main) return;
    expenseCategories[main].forEach(sub => {
        const opt = document.createElement('option'); opt.value = sub; opt.textContent = sub; sel.appendChild(opt);
    });
}


function renderAll() {
    renderOverview();
    renderTransactions();
    renderBudgets();
    renderAllReports();
    renderWallet();
}

