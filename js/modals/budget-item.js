/* ── Budget Category Modals ─────────────────────────────────── */
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

let _catModalMain = null, _catModalSub = null;
let _catModalReturnTo = null; // 'plan' | 'remaining'
let _aimEditingMain = null, _aimEditingSub = null;

/* ── Helper: resolve icon for a budget item ──────────────────── */
function _resolveBudgetIcon(main, sub) {
    const isDynamic = (main === 'Saving' || main === 'Debt');
    if (isDynamic) {
        const acc = walletAccounts.find(a => a.name === sub && a.type === main.toLowerCase());
        return acc ? (acc.icon || (main === 'Debt' ? '💳' : '🐷')) : '💸';
    }
    return itemIcons[`${main}:${sub}`] || defaultItemIcons[`${main}:${sub}`] || (main === 'Income' ? '💵' : '💸');
}

/* ── Router ──────────────────────────────────────────────────── */
function openBudgetItemModal(main, sub) {
    if (_budgetViewMode === 'plan') {
        _openCategoryPlanModal(main, sub);
    } else {
        _openCategoryRemainingModal(main, sub);
    }
}

/* ══════════════════════════════════════════════
   CATEGORY PLAN MODAL
══════════════════════════════════════════════ */
function _openCategoryPlanModal(main, sub) {
    _catModalMain = main;
    _catModalSub = sub;
    _catModalReturnTo = 'plan';

    const isDynamic = (main === 'Saving' || main === 'Debt');
    const mb = monthlyBudgets[selectedBudgetMonth] || {};
    const budget = (mb[main] || {})[sub] || 0;
    const icon = _resolveBudgetIcon(main, sub);

    document.getElementById('bpm-icon').textContent = icon;
    document.getElementById('bpm-name').textContent = sub;

    const amtInput = document.getElementById('bpm-amount');
    amtInput.value = budget > 0 ? Math.round(budget) : '';

    // Hide edit button for dynamic sections
    const editBtn = document.getElementById('bpm-edit-btn');
    if (editBtn) editBtn.classList.toggle('hidden', isDynamic);

    document.getElementById('budget-plan-modal').classList.remove('hidden');
    setTimeout(() => amtInput.focus(), 80);
}

function _savePlanModal() {
    if (!_catModalMain || !_catModalSub) return;
    const amtInput = document.getElementById('bpm-amount');
    const amt = Math.round(parseFloat(amtInput.value) || 0);

    if (!monthlyBudgets[selectedBudgetMonth]) monthlyBudgets[selectedBudgetMonth] = {};
    if (!monthlyBudgets[selectedBudgetMonth][_catModalMain]) monthlyBudgets[selectedBudgetMonth][_catModalMain] = {};
    monthlyBudgets[selectedBudgetMonth][_catModalMain][_catModalSub] = amt;

    saveData();
    const returnTo = _catModalReturnTo;
    const main = _catModalMain, sub = _catModalSub;
    _closePlanModal();
    renderBudgets();
    if (returnTo === 'remaining') {
        _openCategoryRemainingModal(main, sub);
    }
}

function _closePlanModal() {
    document.getElementById('budget-plan-modal').classList.add('hidden');
    _catModalMain = null;
    _catModalSub = null;
}

function _bpmBackdrop(e) {
    if (e.target === document.getElementById('budget-plan-modal')) _closePlanModal();
}

/* ══════════════════════════════════════════════
   CATEGORY REMAINING MODAL
══════════════════════════════════════════════ */
function _openCategoryRemainingModal(main, sub) {
    _catModalMain = main;
    _catModalSub = sub;
    _catModalReturnTo = 'remaining';

    const isDynamic = (main === 'Saving' || main === 'Debt');
    const isInc = main === 'Income';
    const mb = monthlyBudgets[selectedBudgetMonth] || {};
    const budget = (mb[main] || {})[sub] || 0;
    const icon = _resolveBudgetIcon(main, sub);

    let actual;
    if (isDynamic) {
        const acc = walletAccounts.find(a => a.name === sub && a.type === main.toLowerCase());
        actual = acc ? _calculateTransferToAccount(selectedBudgetMonth, acc.id) : 0;
    } else {
        actual = isInc ? calculateIncomeInMonth(selectedBudgetMonth, sub)
                       : calculateSpentInMonth(selectedBudgetMonth, main, sub);
    }

    const pct = budget > 0 ? Math.abs(actual) / budget * 100 : 0;
    const color = _budgetItemColor(pct, isInc || isDynamic);
    const remaining = budget - actual;

    // Header
    document.getElementById('brm-icon').textContent = icon;
    document.getElementById('brm-name').textContent = sub;
    const editBtn = document.getElementById('brm-edit-btn');
    if (editBtn) editBtn.classList.toggle('hidden', isDynamic);

    // Stats
    const budgetedEl = document.getElementById('brm-stat-budgeted');
    if (budgetedEl) budgetedEl.textContent = budget > 0 ? `$${Math.round(budget)}` : 'Not set';

    const spentEl = document.getElementById('brm-stat-spent');
    if (spentEl) {
        spentEl.textContent = `$${Math.round(Math.abs(actual))}`;
        spentEl.className = 'text-sm font-bold ' + (isInc ? 'text-emerald-400' : 'text-rose-400');
        const spentLabel = spentEl.parentElement?.querySelector('.text-zinc-600');
        if (spentLabel) spentLabel.textContent = isInc ? 'Received' : 'Spent';
    }

    const leftEl = document.getElementById('brm-stat-left');
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
    const progWrap = document.getElementById('brm-progress-wrap');
    const progBar = document.getElementById('brm-progress-bar');
    const progPct = document.getElementById('brm-progress-pct');
    if (budget > 0 && progWrap) {
        progWrap.classList.remove('hidden');
        const barPct = Math.min(pct, 100);
        if (progBar) { progBar.style.width = barPct + '%'; progBar.style.backgroundColor = color; }
        if (progPct) { progPct.textContent = Math.round(pct) + '%'; progPct.style.color = color; }
    } else if (progWrap) {
        progWrap.classList.add('hidden');
    }

    // Transactions
    _brmPopulateTxList(main, sub, isInc, isDynamic);

    document.getElementById('budget-remaining-modal').classList.remove('hidden');
}

function _brmPopulateTxList(main, sub, isInc, isDynamic) {
    const [year, month] = selectedBudgetMonth.split('-').map(Number);
    let monthTxs;
    if (isDynamic) {
        const acc = walletAccounts.find(a => a.name === sub && a.type === main.toLowerCase());
        monthTxs = acc ? transactions.filter(t => {
            if (t.type !== 'transfer') return false;
            const d = new Date(t.date + 'T00:00:00');
            if (d.getFullYear() !== year || (d.getMonth() + 1) !== month) return false;
            const fromType = _getAccType(t.fromAccountId);
            const toType = _getAccType(t.toAccountId);
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

    const listEl = document.getElementById('brm-tx-list');
    const emptyEl = document.getElementById('brm-tx-empty');

    if (monthTxs.length === 0) {
        if (listEl) listEl.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    listEl.innerHTML = monthTxs.map(t => {
        const d = new Date(t.date + 'T00:00:00');
        const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const isTrf = t.type === 'transfer';
        const isTxInc = t.type === 'income';

        let emoji, title, subtitle, sign, amtCls;
        if (isTrf) {
            const fromAcc = _getAccById(t.fromAccountId);
            const toAcc = _getAccById(t.toAccountId);
            emoji = '🔄';
            title = t.desc || ((fromAcc ? fromAcc.name : '?') + ' → ' + (toAcc ? toAcc.name : '?'));
            subtitle = (fromAcc ? fromAcc.name : '?') + ' → ' + (toAcc ? toAcc.name : '?');
            sign = '⇄'; amtCls = 'text-sky-400';
        } else {
            const iconKey = t.mainCategory + ':' + (t.subCategory || '');
            emoji = itemIcons[iconKey] || mainEmojis[t.mainCategory] || (isTxInc ? '💰' : '💸');
            title = t.desc || (t.mainCategory + (t.subCategory ? ' · ' + t.subCategory : ''));
            const linkedAcc = t.walletAccountId ? _getAccById(t.walletAccountId) : null;
            subtitle = linkedAcc ? linkedAcc.name : (t.mainCategory || '');
            sign = isTxInc ? '+' : '\u2212';
            amtCls = isTxInc ? 'text-emerald-400' : 'text-zinc-200';
        }

        const realIdx = transactions.indexOf(t);
        return `<div class="flex items-center gap-3 px-3 py-2.5 cursor-pointer active:bg-zinc-800 transition-colors rounded-2xl" onclick="showTxSummary(${realIdx}); _closeRemainingModal();">
            <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">${emoji}</div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium leading-snug truncate">${title}</p>
                <p class="text-[11px] text-zinc-600 mt-0.5 truncate">${subtitle} · ${day}</p>
            </div>
            <span class="${amtCls} font-semibold text-sm tabular-nums shrink-0">${sign}$${parseFloat(t.amount).toFixed(2)}</span>
        </div>`;
    }).join('');
}

function _brmAddTransaction() {
    const main = _catModalMain;
    const sub = _catModalSub;
    const isInc = main === 'Income';
    const isDynamic = (main === 'Saving' || main === 'Debt');
    _closeRemainingModal();

    if (isDynamic) {
        showAddModal('transfer');
    } else if (isInc) {
        showAddModal('income');
        setTimeout(() => {
            const sel = document.getElementById('income-cat');
            if (sel) sel.value = sub;
        }, 50);
    } else {
        showAddModal('expense');
        setTimeout(() => {
            const mainSel = document.getElementById('main-cat');
            if (mainSel) {
                mainSel.value = main;
                updateSubOptions();
                const subSel = document.getElementById('sub-cat');
                if (subSel) subSel.value = sub;
            }
        }, 50);
    }
}

function _closeRemainingModal() {
    document.getElementById('budget-remaining-modal').classList.add('hidden');
    _catModalMain = null;
    _catModalSub = null;
}

function _brmEditBudgeted() {
    const main = _catModalMain, sub = _catModalSub;
    if (!main || !sub) return;
    document.getElementById('budget-remaining-modal').classList.add('hidden');
    _catModalReturnTo = 'remaining';
    _openCategoryPlanModal(main, sub);
}

function _brmBackdrop(e) {
    if (e.target === document.getElementById('budget-remaining-modal')) _closeRemainingModal();
}

/* ══════════════════════════════════════════════
   EDIT CATEGORY MODAL
══════════════════════════════════════════════ */
let _becmSelectedIcon = null;
let _becmOrigMain = null, _becmOrigSub = null;

function _openEditCategoryModal() {
    const main = _catModalMain;
    const sub = _catModalSub;
    if (!main || !sub) return;

    _becmOrigMain = main;
    _becmOrigSub = sub;

    // Close parent modal
    document.getElementById('budget-plan-modal').classList.add('hidden');
    document.getElementById('budget-remaining-modal').classList.add('hidden');

    const isInc = main === 'Income';
    const icon = itemIcons[`${main}:${sub}`] || defaultItemIcons[`${main}:${sub}`] || (isInc ? '💵' : '💸');
    _becmSelectedIcon = icon;

    // Name
    document.getElementById('becm-name').value = sub;

    // Icon preview
    document.getElementById('becm-icon-preview').textContent = icon;

    // Icon picker
    const picker = document.getElementById('becm-icon-picker');
    if (picker) picker.classList.add('hidden');
    const grid = document.getElementById('becm-icon-grid');
    if (grid) {
        grid.innerHTML = BUDGET_ICONS.map(e =>
            `<button type="button" onclick="_becmSelectIcon('${e}')"
                class="text-xl w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition-all ${e === icon ? 'bg-zinc-700 ring-2 ring-emerald-500' : 'hover:bg-zinc-700'}">${e}</button>`
        ).join('');
    }

    // Section dropdown
    const sel = document.getElementById('becm-section');
    sel.innerHTML = '';
    Object.keys(expenseCategories).forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = `${mainEmojis[cat] || '📂'} ${cat}`;
        if (cat === main) opt.selected = true;
        sel.appendChild(opt);
    });

    // Delete button — hidden if last item in section
    const arr = expenseCategories[main] || [];
    const del = document.getElementById('becm-delete-btn');
    if (del) del.classList.toggle('hidden', arr.length <= 1);

    document.getElementById('budget-edit-cat-modal').classList.remove('hidden');
}

function _becmToggleIconPicker() {
    const picker = document.getElementById('becm-icon-picker');
    if (picker) picker.classList.toggle('hidden');
}

function _becmSelectIcon(emoji) {
    _becmSelectedIcon = emoji;
    document.getElementById('becm-icon-preview').textContent = emoji;
    document.querySelectorAll('#becm-icon-grid button').forEach(btn => {
        const sel = btn.textContent.trim() === emoji;
        btn.className = 'text-xl w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition-all '
            + (sel ? 'bg-zinc-700 ring-2 ring-emerald-500' : 'hover:bg-zinc-700');
    });
    document.getElementById('becm-icon-picker').classList.add('hidden');
}

function _saveEditCatModal() {
    const origMain = _becmOrigMain;
    const origSub = _becmOrigSub;
    if (!origMain || !origSub) return;

    const newName = document.getElementById('becm-name').value.trim();
    if (!newName) return;

    const newSection = document.getElementById('becm-section').value;
    const newIcon = _becmSelectedIcon;
    const sectionChanged = newSection !== origMain;
    const nameChanged = newName !== origSub;

    // Validate no duplicates in target section
    if ((nameChanged || sectionChanged) && (expenseCategories[newSection] || []).includes(newName)) {
        alert(`"${newName}" already exists in ${newSection}.`);
        return;
    }

    if (sectionChanged) {
        // Move item to new section
        expenseCategories[origMain] = (expenseCategories[origMain] || []).filter(s => s !== origSub);
        if (!expenseCategories[newSection]) expenseCategories[newSection] = [];
        expenseCategories[newSection].push(newName);
        Object.keys(monthlyBudgets).forEach(mo => {
            const mb = monthlyBudgets[mo];
            if (mb[origMain] && origSub in mb[origMain]) {
                if (!mb[newSection]) mb[newSection] = {};
                mb[newSection][newName] = mb[origMain][origSub];
                delete mb[origMain][origSub];
            }
        });
        transactions.forEach(t => {
            if (t.mainCategory === origMain && t.subCategory === origSub) {
                t.mainCategory = newSection;
                t.subCategory = newName;
            }
        });
        if (itemIcons[`${origMain}:${origSub}`]) delete itemIcons[`${origMain}:${origSub}`];
        if (newIcon) itemIcons[`${newSection}:${newName}`] = newIcon;
    } else if (nameChanged) {
        // Rename within same section
        const idx = (expenseCategories[origMain] || []).indexOf(origSub);
        if (idx >= 0) expenseCategories[origMain][idx] = newName;
        Object.keys(monthlyBudgets).forEach(mo => {
            const mb = monthlyBudgets[mo];
            if (mb[origMain] && origSub in mb[origMain]) {
                mb[origMain][newName] = mb[origMain][origSub];
                delete mb[origMain][origSub];
            }
        });
        transactions.forEach(t => {
            if (t.mainCategory === origMain && t.subCategory === origSub) t.subCategory = newName;
        });
        if (itemIcons[`${origMain}:${origSub}`]) {
            itemIcons[`${origMain}:${newName}`] = itemIcons[`${origMain}:${origSub}`];
            delete itemIcons[`${origMain}:${origSub}`];
        }
        if (newIcon) itemIcons[`${origMain}:${newName}`] = newIcon;
    } else {
        // Only icon changed
        if (newIcon) itemIcons[`${origMain}:${origSub}`] = newIcon;
    }

    _syncIncomeCats();
    saveData();
    _closeEditCatModal();
    renderBudgets();
}

function _deleteFromEditCatModal() {
    const main = _becmOrigMain;
    const sub = _becmOrigSub;
    if (!main || !sub) return;
    if (!confirm(`Delete "${sub}" from ${main}?\nTransactions using it will stay.`)) return;

    expenseCategories[main] = (expenseCategories[main] || []).filter(s => s !== sub);
    Object.keys(monthlyBudgets).forEach(k => {
        if (monthlyBudgets[k]?.[main]) delete monthlyBudgets[k][main][sub];
    });
    delete itemIcons[`${main}:${sub}`];
    _syncIncomeCats();
    saveData();
    _closeEditCatModal();
    renderBudgets();
}

function _closeEditCatModal() {
    document.getElementById('budget-edit-cat-modal').classList.add('hidden');
    _becmOrigMain = null;
    _becmOrigSub = null;
    _becmSelectedIcon = null;
    _catModalMain = null;
    _catModalSub = null;
}

function _becmBackdrop(e) {
    if (e.target === document.getElementById('budget-edit-cat-modal')) _closeEditCatModal();
}

/* ── Legacy compat ───────────────────────────────────────────── */
function closeBudgetItemModal() {
    _closePlanModal();
    _closeRemainingModal();
}

function deleteBudgetItemFromModal() {
    _deleteFromEditCatModal();
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
    const recurring = document.getElementById('tx-recurring');
    if (recurring) recurring.checked = false;
    const recurringFreq = document.getElementById('recurring-frequency');
    if (recurringFreq) recurringFreq.value = 'monthly';
    const recurringEndDate = document.getElementById('recurring-end-date');
    if (recurringEndDate) recurringEndDate.value = '';
    setType(type || 'expense');
    updateExcludeUI();
    updateRecurringUI();
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

function updateRecurringUI() {
    const recurring = !!document.getElementById('tx-recurring')?.checked;
    const recurringFields = document.getElementById('recurring-fields');
    if (recurringFields) {
        if (recurring) {
            recurringFields.classList.remove('hidden');
        } else {
            recurringFields.classList.add('hidden');
        }
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
        if (fromAcc) {
            // From debt = borrowing more (increase debt); from non-debt = balance decreases
            if (fromAcc.type === 'debt') {
                fromAcc.balance = parseFloat(fromAcc.balance || 0) + amt * sign;
            } else {
                fromAcc.balance = parseFloat(fromAcc.balance || 0) - amt * sign;
            }
        }
        if (toAcc) {
            // To debt = paying off (decrease debt); to non-debt = balance increases
            if (toAcc.type === 'debt') {
                toAcc.balance = parseFloat(toAcc.balance || 0) - amt * sign;
            } else {
                toAcc.balance = parseFloat(toAcc.balance || 0) + amt * sign;
            }
        }
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

