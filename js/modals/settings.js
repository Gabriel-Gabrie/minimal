/* ── Settings modal ─────────────────────────────── */
function showDataModal() {
    document.getElementById('data-modal').classList.remove('hidden');
    renderSettingsStats();
    renderCategoryEditorCount();
    renderRecurringCount();
    loadNotifSettings();
    _updateThemePills();
    _updateHomeDot();
    renderShareIcon();
    renderLaunchPills();
    _refreshSettingsAccount();
}

function _refreshSettingsAccount() {
    const user = _fbAuth ? _fbAuth.currentUser : null;
    if (!user) return;
    const name    = user.displayName || '';
    const email   = user.email || '';
    const photo   = user.photoURL || '';
    const initials = name
        ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)
        : email.slice(0,2).toUpperCase();
    const nm = document.getElementById('settings-user-name');
    const em = document.getElementById('settings-user-email');
    const ph = document.getElementById('settings-photo');
    const ii = document.getElementById('settings-initials');
    if (nm) nm.textContent = name || email;
    if (em) em.textContent = email;
    if (photo && ph) { ph.src = photo; ph.classList.remove('hidden'); if(ii) ii.classList.add('hidden'); }
    else if (ii) { ii.textContent = initials; if(ph) ph.classList.add('hidden'); }
}

function hideDataModal() {
    document.getElementById('data-modal').classList.add('hidden');
    // Re-render current screen to reflect any order changes
    [renderOverview, renderTransactions, renderBudgets, renderReports, renderWallet].forEach(fn => {
        try { fn?.(); } catch(e) {}
    });
}

function handleSettingsBackdrop(e) {
    if (e.target === document.getElementById('data-modal')) hideDataModal();
}

function renderSettingsStats() {
    const el = document.getElementById('settings-stats');
    if (!el) return;
    const catCount = Object.values(expenseCategories).reduce((s, arr) => s + arr.length, 0);
    const stats = [
        ['Transactions', transactions.length,  '#10b981'],
        ['Categories', catCount,              '#10b981'],
    ];
    el.innerHTML = stats.map(([label, val, color]) => `
        <div class="bg-zinc-900 rounded-2xl py-3 px-3 text-center">
            <div class="text-xl font-semibold tracking-tight" style="color:${color}">${val}</div>
            <div class="text-[9px] font-bold tracking-widest text-zinc-600 uppercase mt-0.5">${label}</div>
        </div>`).join('');
}

/* ── Budget Categories editor ─────────────────────────────────── */
function _syncIncomeCats() { incomeCats = expenseCategories['Income'] || incomeCats; }

function renderCategoryEditorCount() {
    const el = document.getElementById('cat-editor-count');
    const n  = Object.keys(expenseCategories).length;
    if (el) el.textContent = `${n} section${n !== 1 ? 's' : ''}`;
}

function renderCategoryEditor() {
    renderCategoryEditorCount();
    const list = document.getElementById('category-editor-list');
    if (!list) return;
    const cats = Object.keys(expenseCategories);
    list.innerHTML = cats.map((cat, ci) => {
        const items = expenseCategories[cat];
        const isFirst = ci === 0, isLast = ci === cats.length - 1;
        const itemsHTML = items.map((item, ii) => `
            <div class="cat-item-row flex items-center gap-2 pl-14 pr-4 py-2.5 border-t border-zinc-800/60" data-cat="${cat.replace(/"/g,'&quot;')}" data-idx="${ii}">
                <div class="cat-item-label flex-1 text-sm text-zinc-400 cursor-pointer hover:text-emerald-400 transition-colors truncate" onclick="inlineRenameCatItem('${cat.replace(/'/g,"\\'")}',${ii})">${item}</div>
                <button onclick="moveCatItemUp('${cat.replace(/'/g,"\\'")}',${ii})" class="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors ${ii===0?'opacity-20 pointer-events-none':''}" title="Move up">
                    <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button onclick="moveCatItemDown('${cat.replace(/'/g,"\\'")}',${ii})" class="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors ${ii===items.length-1?'opacity-20 pointer-events-none':''}" title="Move down">
                    <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <button onclick="deleteCatItem('${cat.replace(/'/g,"\\'")}',${ii})" class="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors" title="Delete">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>`).join('');
        return `<div class="cat-editor-section" data-cat="${cat.replace(/"/g,'&quot;')}">
            <div class="flex items-center gap-2 px-5 py-3.5 border-t border-zinc-800">
                <span class="text-lg shrink-0">${mainEmojis[cat] || '📂'}</span>
                <div class="cat-label flex-1 font-medium text-sm cursor-pointer hover:text-emerald-400 transition-colors truncate" onclick="inlineRenameCategory('${cat.replace(/'/g,"\\'")}' )">${cat}</div>
                <button onclick="moveCategoryUp('${cat.replace(/'/g,"\\'")}' )" class="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors ${isFirst?'opacity-20 pointer-events-none':''}" title="Move up">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button onclick="moveCategoryDown('${cat.replace(/'/g,"\\'")}' )" class="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors ${isLast?'opacity-20 pointer-events-none':''}" title="Move down">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <button onclick="deleteCategory('${cat.replace(/'/g,"\\'")}' )" class="w-6 h-6 flex items-center justify-center text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors" title="Delete section">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            ${itemsHTML}
            <button onclick="addCatItemInline('${cat.replace(/'/g,"\\'")}' )" class="w-full flex items-center gap-3 pl-14 pr-4 py-2.5 border-t border-zinc-800/60 hover:bg-zinc-800/40 transition-colors group">
                <svg class="w-3.5 h-3.5 text-zinc-700 group-hover:text-emerald-500 transition-colors shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                <span class="text-xs text-zinc-700 group-hover:text-emerald-500 transition-colors">Add category</span>
            </button>
        </div>`;
    }).join('');
}

function toggleCategoryEditorAccordion() {
    const body    = document.getElementById('cat-editor-body');
    const chevron = document.getElementById('cat-editor-chevron');
    if (!body) return;
    const open = body.classList.toggle('open');
    if (chevron) chevron.classList.toggle('open', open);
    if (open) renderCategoryEditor();
}

function moveCategoryUp(cat) {
    const keys = Object.keys(expenseCategories);
    const i = keys.indexOf(cat); if (i <= 0) return;
    [keys[i-1], keys[i]] = [keys[i], keys[i-1]];
    const r = {}; keys.forEach(k => r[k] = expenseCategories[k]);
    expenseCategories = r;
    saveData(); renderCategoryEditor();
}
function moveCategoryDown(cat) {
    const keys = Object.keys(expenseCategories);
    const i = keys.indexOf(cat); if (i < 0 || i >= keys.length-1) return;
    [keys[i], keys[i+1]] = [keys[i+1], keys[i]];
    const r = {}; keys.forEach(k => r[k] = expenseCategories[k]);
    expenseCategories = r;
    saveData(); renderCategoryEditor();
}

function moveCatItemUp(cat, idx) {
    const arr = expenseCategories[cat]; if (!arr || idx <= 0) return;
    [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
    saveData(); renderCategoryEditor();
}
function moveCatItemDown(cat, idx) {
    const arr = expenseCategories[cat]; if (!arr || idx >= arr.length-1) return;
    [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
    saveData(); renderCategoryEditor();
}

function inlineRenameCategory(cat) {
    const sec = document.querySelector(`.cat-editor-section[data-cat="${CSS.escape(cat)}"]`);
    if (!sec) return;
    const labelDiv = sec.querySelector('.cat-label');
    if (!labelDiv || labelDiv.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'text'; input.value = cat;
    input.className = 'flex-1 bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-sm focus:outline-none w-full min-w-0';
    labelDiv.replaceChildren(input); input.focus(); input.select();
    let done = false;
    function save() {
        if (done) return; done = true;
        const newName = input.value.trim();
        if (!newName || newName === cat || expenseCategories[newName]) { renderCategoryEditor(); return; }
        const r = {};
        Object.keys(expenseCategories).forEach(k => r[k === cat ? newName : k] = expenseCategories[k]);
        expenseCategories = r;
        Object.keys(monthlyBudgets).forEach(m => {
            if (monthlyBudgets[m][cat]) { monthlyBudgets[m][newName] = monthlyBudgets[m][cat]; delete monthlyBudgets[m][cat]; }
        });
        transactions.forEach(t => { if (t.mainCategory === cat) t.mainCategory = newName; });
        _syncIncomeCats(); saveData(); renderCategoryEditor(); renderCategoryEditorCount();
    }
    function cancel() { if (done) return; done = true; renderCategoryEditor(); }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => { if (e.key==='Enter'){e.preventDefault();save();} if (e.key==='Escape'){e.preventDefault();cancel();} });
}

function inlineRenameCatItem(cat, idx) {
    const rows = document.querySelectorAll(`.cat-item-row[data-cat="${CSS.escape(cat)}"][data-idx="${idx}"]`);
    const row = rows[0]; if (!row) return;
    const labelDiv = row.querySelector('.cat-item-label');
    if (!labelDiv || labelDiv.querySelector('input')) return;
    const oldName = expenseCategories[cat][idx];
    const input = document.createElement('input');
    input.type = 'text'; input.value = oldName;
    input.className = 'flex-1 bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-xs focus:outline-none w-full min-w-0';
    labelDiv.replaceChildren(input); input.focus(); input.select();
    let done = false;
    function save() {
        if (done) return; done = true;
        const newName = input.value.trim();
        if (!newName || newName === oldName || expenseCategories[cat].includes(newName)) { renderCategoryEditor(); return; }
        expenseCategories[cat][idx] = newName;
        Object.keys(monthlyBudgets).forEach(m => {
            if (monthlyBudgets[m][cat] && monthlyBudgets[m][cat][oldName] !== undefined) {
                monthlyBudgets[m][cat][newName] = monthlyBudgets[m][cat][oldName];
                delete monthlyBudgets[m][cat][oldName];
            }
        });
        transactions.forEach(t => {
            if (t.mainCategory === cat && t.subCategory === oldName) t.subCategory = newName;
            if (cat === 'Income' && t.type === 'income' && t.mainCategory === oldName) t.mainCategory = newName;
        });
        _syncIncomeCats(); saveData(); renderCategoryEditor();
    }
    function cancel() { if (done) return; done = true; renderCategoryEditor(); }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => { if (e.key==='Enter'){e.preventDefault();save();} if (e.key==='Escape'){e.preventDefault();cancel();} });
}

function deleteCategory(cat) {
    if (Object.keys(expenseCategories).length <= 1) return;
    if (!confirm(`Delete section "${cat}" and all its categories?\nBudget data will be removed. Transactions are kept.`)) return;
    delete expenseCategories[cat];
    Object.keys(monthlyBudgets).forEach(m => { delete monthlyBudgets[m][cat]; });
    _syncIncomeCats(); saveData(); renderCategoryEditor(); renderCategoryEditorCount();
}

function deleteCatItem(cat, idx) {
    const arr = expenseCategories[cat]; if (!arr || arr.length <= 1) return;
    const oldName = arr[idx];
    if (!confirm(`Delete category "${oldName}" from ${cat}?\nBudget data will be removed. Transactions are kept.`)) return;
    arr.splice(idx, 1);
    Object.keys(monthlyBudgets).forEach(m => { if (monthlyBudgets[m][cat]) delete monthlyBudgets[m][cat][oldName]; });
    _syncIncomeCats(); saveData(); renderCategoryEditor();
}

function addCategoryInline() {
    const list = document.getElementById('category-editor-list');
    if (!list) return;
    const tempRow = document.createElement('div');
    tempRow.className = 'flex items-center gap-3 px-5 py-3.5 border-t border-zinc-800';
    tempRow.innerHTML = `<span class="text-lg">📂</span>
        <input id="new-cat-input" type="text" placeholder="Section name…" class="flex-1 bg-zinc-800 border border-emerald-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
        <button onclick="confirmAddCategory()" class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30 transition-colors shrink-0">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </button>`;
    list.appendChild(tempRow);
    const inp = document.getElementById('new-cat-input');
    inp.focus();
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); confirmAddCategory(); }
        if (e.key === 'Escape') { e.preventDefault(); renderCategoryEditor(); }
    });
}

function confirmAddCategory() {
    const inp = document.getElementById('new-cat-input'); if (!inp) return;
    const name = inp.value.trim();
    if (!name || expenseCategories[name]) { renderCategoryEditor(); return; }
    expenseCategories[name] = [];
    saveData(); renderCategoryEditor(); renderCategoryEditorCount();
}

function addCatItemInline(cat) {
    const secs = document.querySelectorAll(`.cat-editor-section[data-cat="${CSS.escape(cat)}"]`);
    const sec = secs[0]; if (!sec) return;
    const addBtn = sec.querySelector('button:last-child');
    const tempRow = document.createElement('div');
    tempRow.className = 'flex items-center gap-3 pl-14 pr-4 py-2.5 border-t border-zinc-800/60';
    tempRow.innerHTML = `<input id="new-item-input-${CSS.escape(cat)}" type="text" placeholder="Category name…" class="flex-1 bg-zinc-800 border border-emerald-500 rounded-lg px-2 py-1 text-xs focus:outline-none">
        <button onclick="confirmAddCatItem('${cat.replace(/'/g,"\\'")}' )" class="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30 transition-colors shrink-0">
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </button>`;
    sec.insertBefore(tempRow, addBtn);
    const inp = tempRow.querySelector('input');
    inp.focus();
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); confirmAddCatItem(cat); }
        if (e.key === 'Escape') { e.preventDefault(); renderCategoryEditor(); }
    });
}

function confirmAddCatItem(cat) {
    const inp = document.querySelector(`.cat-editor-section[data-cat="${CSS.escape(cat)}"] input`);
    if (!inp) return;
    const name = inp.value.trim();
    if (!name || (expenseCategories[cat] || []).includes(name)) { renderCategoryEditor(); return; }
    if (!expenseCategories[cat]) expenseCategories[cat] = [];
    expenseCategories[cat].push(name);
    _syncIncomeCats(); saveData(); renderCategoryEditor();
}

// Legacy stubs (called from nothing — kept to avoid any stray onclick errors)
function toggleIncomeAccordion() { toggleCategoryEditorAccordion(); }
function renderIncomeTypesList() { renderCategoryEditor(); }
function renderIncomeTypeCount() { renderCategoryEditorCount(); }
function addIncomeTypeInline()   { addCatItemInline('Income'); }
function deleteIncomeType(i)     { deleteCatItem('Income', i); }

function clearAllData() {
    if (!confirm('Reset app to factory defaults?\nThis clears ALL transactions, budgets and sections — and restores the default section list.\nThis cannot be undone.')) return;
    // Full factory reset: wipe everything and restore defaults
    transactions      = [];
    monthlyBudgets    = {};
    walletAccounts    = [];
    expenseCategories = {...defaultCategories};
    _syncIncomeCats();
    // Wipe localStorage completely for this app
    ['transactions','monthlyBudgets','expenseCategories','incomeCats','walletAccounts','tutDone']
        .forEach(function(k) { localStorage.removeItem(k); });
    // Delete from Firestore if signed in
    const user = _fbAuth ? _fbAuth.currentUser : null;
    if (user && _fbDb) {
        _fbDb.collection('users').doc(user.uid).delete()
            .catch(function(e) { console.warn('Firestore delete:', e.message); });
    }
    hideDataModal();
    renderAll();
    showToast('App reset to defaults', 'emerald');
}

function backupData() {
    const backupData = {
        transactions,
        expenseCategories,
        monthlyBudgets,
        walletAccounts,
        exportedAt: new Date().toISOString()
    };
    const filename = `Minimal-Budget-Backup-${new Date().toISOString().slice(0,10)}.json`;
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    hideDataModal();
}

function restoreFromBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const imported = JSON.parse(ev.target.result);
            if (imported.transactions) transactions = imported.transactions;
            if (imported.expenseCategories) expenseCategories = imported.expenseCategories;
            if (imported.monthlyBudgets) monthlyBudgets = imported.monthlyBudgets;
            if (imported.walletAccounts) walletAccounts = imported.walletAccounts;
            saveData();
            alert("Backup restored successfully!");
            hideDataModal();
            switchTab(0);
        } catch(err) {
            alert("Invalid backup file.");
        }
    };
    reader.readAsText(file);
}



/* ── Notifications ──────────────────────────────── */
function loadNotifSettings() {
    const prefs = JSON.parse(localStorage.getItem('notifPrefs') || '{}');
    const masterEl  = document.getElementById('notif-master');
    const budgetEl  = document.getElementById('notif-budget');
    const monthlyEl = document.getElementById('notif-monthly');
    const master = prefs.master !== false;
    if (masterEl)  masterEl.checked  = master;
    if (budgetEl)  budgetEl.checked  = prefs.budget  !== false;
    if (monthlyEl) monthlyEl.checked = prefs.monthly !== false;
    // Dim sub-items if master off
    const body = document.getElementById('notif-acc-body');
    if (body) body.style.opacity = master ? '' : '0.4';
}

function saveNotifSettings() {
    const master = document.getElementById('notif-master')?.checked ?? true;
    const prefs = {
        master,
        budget:  document.getElementById('notif-budget')?.checked  ?? true,
        monthly: document.getElementById('notif-monthly')?.checked ?? true,
    };
    localStorage.setItem('notifPrefs', JSON.stringify(prefs));
    // Dim sub-items when master is off
    const body = document.getElementById('notif-acc-body');
    if (body) body.style.opacity = master ? '' : '0.4';
}

function toggleNotifAccordion() {
    const body = document.getElementById('notif-acc-body');
    const chev = document.getElementById('notif-acc-chev');
    if (!body) return;
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    if (chev) chev.style.transform = open ? '' : 'rotate(180deg)';
}

function getNotifPrefs() {
    return JSON.parse(localStorage.getItem('notifPrefs') || '{}');
}

/* ── Customize Order accordion ─────────────────────────────── */
function toggleOrderAccordion() {
    const body = document.getElementById('order-acc-body');
    const chev = document.getElementById('order-acc-chev');
    if (!body) return;
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    if (chev) chev.style.transform = open ? '' : 'rotate(180deg)';
    if (!open) renderOrderList();
}

function renderOrderList() {
    const el = document.getElementById('order-sections-list');
    if (!el) return;

    // Budget sections
    const cats = Object.keys(expenseCategories);
    let html = `<div class="text-[9px] font-black tracking-[.14em] text-zinc-600 uppercase mb-2">Budget Sections</div>`;
    html += `<div class="space-y-1 mb-5">`;
    cats.forEach((cat, i) => {
        const isFirst = i === 0, isLast = i === cats.length - 1;
        const cEsc = cat.replace(/'/g, "\\'");
        html += `<div class="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2">
            <span class="text-base shrink-0">${mainEmojis[cat] || '📂'}</span>
            <span class="text-sm font-medium text-zinc-200 flex-1 truncate">${cat}</span>
            <button onclick="_orderMoveSection('${cEsc}','up')" class="w-7 h-7 rounded-lg bg-zinc-700/60 hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors ${isFirst ? 'opacity-20 pointer-events-none' : ''}">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button onclick="_orderMoveSection('${cEsc}','down')" class="w-7 h-7 rounded-lg bg-zinc-700/60 hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors ${isLast ? 'opacity-20 pointer-events-none' : ''}">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
        </div>`;
    });
    html += `</div>`;

    // Wallet accounts by type
    const types = [
        { key: 'spending', label: 'Spending Accounts' },
        { key: 'saving', label: 'Saving Accounts' },
        { key: 'debt', label: 'Debt Accounts' },
    ];
    types.forEach(({ key, label }) => {
        const accs = walletAccounts.filter(a => a.type === key);
        if (!accs.length) return;
        html += `<div class="text-[9px] font-black tracking-[.14em] text-zinc-600 uppercase mb-2">${label}</div>`;
        html += `<div class="space-y-1 mb-5">`;
        accs.forEach((acc, i) => {
            const isFirst = i === 0, isLast = i === accs.length - 1;
            html += `<div class="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2">
                <span class="text-base shrink-0">${acc.icon || '🏦'}</span>
                <span class="text-sm font-medium text-zinc-200 flex-1 truncate">${acc.name}</span>
                <button onclick="_orderMoveAccount('${acc.id}','up')" class="w-7 h-7 rounded-lg bg-zinc-700/60 hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors ${isFirst ? 'opacity-20 pointer-events-none' : ''}">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button onclick="_orderMoveAccount('${acc.id}','down')" class="w-7 h-7 rounded-lg bg-zinc-700/60 hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors ${isLast ? 'opacity-20 pointer-events-none' : ''}">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            </div>`;
        });
        html += `</div>`;
    });

    el.innerHTML = html;
}

function _orderMoveSection(cat, dir) {
    const keys = Object.keys(expenseCategories);
    const i = keys.indexOf(cat);
    if (dir === 'up' && i <= 0) return;
    if (dir === 'down' && (i < 0 || i >= keys.length - 1)) return;
    const j = dir === 'up' ? i - 1 : i + 1;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    const r = {};
    keys.forEach(k => r[k] = expenseCategories[k]);
    expenseCategories = r;
    saveData();
    renderOrderList();
}

function _orderMoveAccount(id, dir) {
    const idx = walletAccounts.findIndex(a => a.id === id);
    if (idx < 0) return;
    const acc = walletAccounts[idx];
    const sameType = walletAccounts.map((a, i) => ({ a, i })).filter(x => x.a.type === acc.type);
    const posInType = sameType.findIndex(x => x.i === idx);
    if (dir === 'up' && posInType <= 0) return;
    if (dir === 'down' && posInType >= sameType.length - 1) return;
    const swapIdx = dir === 'up' ? sameType[posInType - 1].i : sameType[posInType + 1].i;
    [walletAccounts[idx], walletAccounts[swapIdx]] = [walletAccounts[swapIdx], walletAccounts[idx]];
    saveData();
    renderOrderList();
}

/* ── Recurring Transactions accordion ──────────────────── */
function toggleRecurringAccordion() {
    const body = document.getElementById('recurring-acc-body');
    const chev = document.getElementById('recurring-acc-chev');
    if (!body) return;
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    if (chev) chev.style.transform = open ? '' : 'rotate(180deg)';
    if (!open) renderRecurringTransactions();
}

function renderRecurringCount() {
    const el = document.getElementById('recurring-acc-count');
    if (!el) return;
    const active = recurringTransactions.filter(r => r.active !== false);
    const n = active.length;
    el.textContent = n === 0
        ? 'No active recurring transactions'
        : `${n} active recurring transaction${n !== 1 ? 's' : ''}`;
}

function renderRecurringTransactions() {
    const el = document.getElementById('recurring-list');
    if (!el) return;

    const active = recurringTransactions.filter(r => r.active !== false);

    if (active.length === 0) {
        el.innerHTML = `<div class="px-5 py-6 text-center text-sm text-zinc-600">
            No recurring transactions yet.<br>
            <span class="text-xs">Add one when creating a transaction!</span>
        </div>`;
        return;
    }

    const frequencyLabels = {
        weekly: 'Weekly',
        'bi-weekly': 'Bi-Weekly',
        monthly: 'Monthly',
        yearly: 'Yearly'
    };

    el.innerHTML = active.map((rec, idx) => {
        const icon = itemIcons[`${rec.mainCategory}:${rec.subCategory}`] || mainEmojis[rec.mainCategory] || '💸';
        const freqLabel = frequencyLabels[rec.frequency] || rec.frequency;
        const nextDateFormatted = rec.nextDate ? new Date(rec.nextDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        const amount = Math.abs(rec.amount || 0).toFixed(2);
        const typeColor = rec.type === 'income' ? 'text-emerald-400' : 'text-zinc-100';

        return `
            <div class="flex items-center gap-3 px-5 py-3.5 ${idx > 0 ? 'border-t border-zinc-800/60' : ''}">
                <div class="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-lg shrink-0">${icon}</div>
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-zinc-100 truncate">${rec.desc || rec.subCategory || 'Untitled'}</div>
                    <div class="text-[11px] text-zinc-500 mt-0.5">
                        ${freqLabel} · Next: ${nextDateFormatted}
                    </div>
                </div>
                <div class="${typeColor} text-sm font-semibold shrink-0">
                    ${rec.type === 'income' ? '+' : '−'}$${amount}
                </div>
                <button onclick="skipNextOccurrence('${rec.id}')" class="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-amber-400 transition-colors shrink-0" title="Skip next">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M5 4l10 8-10 8V4z"/>
                        <line x1="19" y1="5" x2="19" y2="19"/>
                    </svg>
                </button>
                <button onclick="editRecurringTransaction('${rec.id}')" class="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-emerald-400 transition-colors shrink-0" title="Edit">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button onclick="cancelRecurringSeries('${rec.id}')" class="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-rose-400 transition-colors shrink-0" title="Cancel series">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>`;
    }).join('');
}

/* ── Edit recurring transaction ──────────────────── */
function editRecurringTransaction(id) {
    const rec = recurringTransactions.find(r => r.id === id);
    if (!rec) return;

    _editingRecurringId = id;
    _editingTxIdx = null;

    // Open transaction modal
    document.getElementById('add-modal').classList.remove('hidden');

    // Populate basic fields
    document.getElementById('date').value = rec.startDate || getCurrentDateEST();
    document.getElementById('amount').value = parseFloat(rec.amount).toFixed(2);
    document.getElementById('desc').value = rec.desc || '';

    // Set exclude toggle
    const exclCb = document.getElementById('tx-exclude');
    if (exclCb) exclCb.checked = !!rec.excluded;

    // Set transaction type
    setType(rec.type === 'transfer' ? 'transfer' : (rec.type === 'expense' || rec.excluded ? 'expense' : rec.type));
    updateExcludeUI();

    // Populate recurring fields
    const recurringToggle = document.getElementById('tx-recurring');
    if (recurringToggle) recurringToggle.checked = true;
    updateRecurringUI();

    const freqSel = document.getElementById('recurring-frequency');
    if (freqSel) freqSel.value = rec.frequency || 'monthly';

    const endDateInput = document.getElementById('recurring-end-date');
    if (endDateInput) endDateInput.value = rec.endDate || '';

    // After setType populates selects, set values
    setTimeout(() => {
        if (rec.type === 'transfer') {
            const fromSel = document.getElementById('transfer-from');
            const toSel   = document.getElementById('transfer-to');
            if (fromSel) fromSel.value = rec.fromAccountId || '';
            _populateTransferAccounts();
            if (fromSel) fromSel.value = rec.fromAccountId || '';
            if (toSel) {
                const fromId = fromSel.value;
                toSel.innerHTML = walletAccounts
                    .filter(a => a.id !== fromId)
                    .map(a => `<option value="${a.id}">${a.icon || '🏦'} ${a.name}</option>`)
                    .join('');
                toSel.value = rec.toAccountId || '';
            }
            _updateTransferBudgetInfo();
            const saveBtn = document.getElementById('save-transaction-btn');
            if (saveBtn) saveBtn.textContent = 'Update Recurring';
        } else if (rec.type === 'expense' && !rec.excluded) {
            document.getElementById('main-cat').value = rec.mainCategory || '';
            updateSubOptions();
            setTimeout(() => {
                document.getElementById('sub-cat').value = rec.subCategory || '';
            }, 0);
            const expAccSel = document.getElementById('expense-account');
            if (expAccSel && rec.walletAccountId) expAccSel.value = rec.walletAccountId;
            const saveBtn = document.getElementById('save-transaction-btn');
            if (saveBtn) saveBtn.textContent = 'Update Recurring';
        } else if (rec.type === 'income') {
            document.getElementById('income-cat').value = rec.mainCategory || '';
            const incAccSel = document.getElementById('income-account');
            if (incAccSel && rec.walletAccountId) incAccSel.value = rec.walletAccountId;
            const saveBtn = document.getElementById('save-transaction-btn');
            if (saveBtn) saveBtn.textContent = 'Update Recurring';
        }
    }, 0);
}

/* ── Cancel recurring series ────────────────────── */
function cancelRecurringSeries(id) {
    const rec = recurringTransactions.find(r => r.id === id);
    if (!rec) return;

    const desc = rec.desc || rec.subCategory || 'this recurring transaction';
    if (!confirm(`Cancel "${desc}"?\n\nNo new transactions will be generated. Past transactions will not be affected.`)) return;

    rec.active = false;
    saveData();
    renderRecurringTransactions();
    renderRecurringCount();
    showToast('Recurring series cancelled', 'emerald');
}

/* ── Skip next occurrence ───────────────────────── */
function skipNextOccurrence(id) {
    const rec = recurringTransactions.find(r => r.id === id);
    if (!rec) return;

    if (!rec.nextDate) {
        showToast('No upcoming occurrence to skip', 'rose');
        return;
    }

    const desc = rec.desc || rec.subCategory || 'this occurrence';
    const nextDateFormatted = new Date(rec.nextDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (!confirm(`Skip "${desc}" on ${nextDateFormatted}?\n\nThis occurrence will be skipped. The next one will be generated as usual.`)) return;

    if (!rec.skippedDates) rec.skippedDates = [];
    rec.skippedDates.push(rec.nextDate);
    saveData();
    renderRecurringTransactions();
    showToast('Next occurrence skipped', 'emerald');
}

/* ── In-app notification checks (called after data changes) ── */
function checkNotifications() {
    const prefs = getNotifPrefs();
    const monthKey = getCurrentMonthKey();

    // Budget alerts
    if (prefs.budget !== false) {
        Object.keys(expenseCategories).forEach(main => {
            expenseCategories[main].forEach(sub => {
                const mb = (monthlyBudgets[monthKey] || {})[main] || {};
                const budget = mb[sub] || 0;
                if (budget <= 0) return;
                const spent = calculateSpentInMonth(monthKey, main, sub);
                if (spent > budget) showToast(`⚠️ ${sub} is over budget!`, 'rose');
            });
        });
    }

}

function showToast(msg, color) {
    const old = document.getElementById('_toast');
    if (old) old.remove();
    const colors = {
        emerald: 'border-emerald-500/40 text-emerald-300',
        rose:    'border-rose-500/40 text-rose-300',
    };
    const t = document.createElement('div');
    t.id = '_toast';
    t.style.cssText = 'position:fixed;bottom:7.5rem;left:50%;transform:translateX(-50%);z-index:300;white-space:nowrap;animation:_snkIn .22s ease';
    t.className = `flex items-center gap-2 bg-zinc-900 border rounded-2xl px-4 py-3 text-sm font-medium shadow-xl ${colors[color] || colors.emerald}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.animation = '_snkOut .2s ease forwards'; setTimeout(() => t.remove(), 220); }, 3500);
}

/* ── Launch screen preference ───────────────────── */
const LAUNCH_TABS = ['Overview', 'Transactions', 'Budgets', 'Reports', 'Wallet'];

function getLaunchTab() {
    const n = parseInt(localStorage.getItem('launchTab') || '0', 10);
    return (n >= 0 && n <= 4) ? n : 0;
}

function setLaunchTab(n) {
    localStorage.setItem('launchTab', String(n));
    _updateHomeDot();
}

function _updateHomeDot() {
    const home = getLaunchTab();
    for (let i = 0; i < 5; i++) {
        const dot = document.getElementById('home-dot-' + i);
        if (dot) dot.classList.toggle('hidden', i !== home);
    }
}

function renderLaunchPills() {
    _updateHomeDot();
    const wrap = document.getElementById('launch-screen-pills');
    if (!wrap) return;
    const current = getLaunchTab();
    const icons = [
        '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
        '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>',
        '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 3"/></svg>',
        '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 16l4-5 4 3 5-6"/></svg>',
        '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><circle cx="18" cy="14" r="2"/></svg>'
    ];
    wrap.innerHTML = LAUNCH_TABS.map((name, i) => {
        const sel = i === current;
        return `<button onclick="setLaunchTab(${i}); renderLaunchPills();"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
            ${sel ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}"
            >${icons[i]} ${name}</button>`;
    }).join('');
}

function renderShareIcon() {
    const el = document.getElementById('share-icon');
    if (!el) return;
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
        // iOS share icon: box with upward arrow
        el.innerHTML = `<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>`;
    } else {
        // Android / generic share icon: three dots connected
        el.innerHTML = `<circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>`;
    }
}

function shareMinimal() {
    const text = `Check out Minimal \u2014 easy budgeting. \uD83C\uDF3F`;
    if (navigator.share) {
        navigator.share({ title: 'Minimal — Personal Finance', text }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Copied to clipboard!', 'emerald');
        }).catch(() => {
            showToast('Share: ' + text, 'emerald');
        });
    }
}
