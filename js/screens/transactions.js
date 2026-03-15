/* ── Filter / search helpers ─────────────────────── */
function setTxFilter(f) { txFilter = f; renderTransactions(); }
function cycleTxFilter() {
    const order = ['all', 'expense', 'income', 'transfer'];
    txFilter = order[(order.indexOf(txFilter) + 1) % order.length];
    renderTransactions();
}

function clearTxSearch() {
    document.getElementById('search').value = '';
    renderTransactions();
}

function _updatePills(nAll, nExp, nInc, nTrf) {
    const LABELS = { all: 'All', expense: 'Exp', income: 'Inc', transfer: 'Trf' };
    const btn = document.getElementById('tx-filter-btn');
    const lbl = document.getElementById('tx-filter-label');
    if (lbl) lbl.textContent = LABELS[txFilter] || 'All';
    if (btn) {
        const activeClass =
            txFilter === 'expense'  ? 'bg-rose-500/20 text-rose-400' :
            txFilter === 'income'   ? 'bg-emerald-500/20 text-emerald-400' :
            txFilter === 'transfer' ? 'bg-sky-500/20 text-sky-400' :
                                      'bg-zinc-900 text-zinc-400 hover:bg-zinc-800';
        btn.className = 'shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors ' + activeClass;
    }
}

function _dateLabel(ds) {
    const today = getCurrentDateEST();
    const d = new Date(today); d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);
    if (ds === today)     return 'Today';
    if (ds === yesterday) return 'Yesterday';
    const [y, mo, day] = ds.split('-').map(Number);
    return new Date(y, mo - 1, day).toLocaleDateString('default', { weekday:'short', month:'short', day:'numeric' });
}

function _countActiveFilters() {
    let count = 0;
    // Count date range filter (1 point if either start or end is set)
    if (advancedFilters.dateRange.start || advancedFilters.dateRange.end) count++;
    // Count selected categories
    count += advancedFilters.categories.length;
    // Count amount range filter (1 point if either min or max is set)
    if (advancedFilters.amountRange.min !== null || advancedFilters.amountRange.max !== null) count++;
    return count;
}

function _updateFilterBadge() {
    const badge = document.getElementById('tx-filter-badge');
    const clearBtn = document.getElementById('tx-clear-filters-btn');

    const count = _countActiveFilters();
    if (count > 0) {
        if (badge) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        }
        if (clearBtn) clearBtn.classList.remove('hidden');
    } else {
        if (badge) badge.classList.add('hidden');
        if (clearBtn) clearBtn.classList.add('hidden');
    }
}

/* ── Main render ─────────────────────────────────── */
function renderTransactions() {
    // Sync from shared month
    _initSharedMonth();
    selectedTxMonth = selectedMonth;

    // Transactions for this month (or date range if advanced filters active)
    let monthTx;
    if (advancedFilters.dateRange.start && advancedFilters.dateRange.end) {
        // Filter by date range (can span multiple months)
        monthTx = transactions.filter(t =>
            t.date >= advancedFilters.dateRange.start &&
            t.date <= advancedFilters.dateRange.end
        );
    } else {
        // Filter by selected month only
        monthTx = transactions.filter(t => t.date.startsWith(selectedTxMonth));
    }

    const listEl     = document.getElementById('full-list');
    const emptyEl    = document.getElementById('tx-empty');
    const controlsEl = document.getElementById('tx-controls');

    if (!monthTx.length) {
        // Show empty state, hide controls and list
        if (emptyEl)    emptyEl.classList.remove('hidden');
        if (controlsEl) controlsEl.classList.add('hidden');
        if (listEl)     listEl.innerHTML = '';
        return;
    }

    // Month has transactions — show controls, hide empty state
    if (emptyEl)    emptyEl.classList.add('hidden');
    if (controlsEl) controlsEl.classList.remove('hidden');

    const q   = (document.getElementById('search')?.value || '').toLowerCase().trim();
    const clr = document.getElementById('search-clear');
    if (clr) clr.classList.toggle('hidden', !q);

    // Pill counts (this month only)
    let nAll = 0, nExp = 0, nInc = 0, nTrf = 0;
    monthTx.forEach(t => { nAll++; if (t.type === 'transfer') nTrf++; else if (t.type === 'expense') nExp++; else nInc++; });
    _updatePills(nAll, nExp, nInc, nTrf);

    // Update filter badge
    _updateFilterBadge();

    // Sort
    const sorted = monthTx.slice().sort((a, b) => {
        if (txSort === 'amount-desc') return parseFloat(b.amount) - parseFloat(a.amount);
        if (txSort === 'amount-asc')  return parseFloat(a.amount) - parseFloat(b.amount);
        if (txSort === 'date-asc')    return new Date(a.date) - new Date(b.date);
        return new Date(b.date) - new Date(a.date); // date-desc default
    });
    const SORT_LABELS = {'date-desc':'Date ↓','date-asc':'Date ↑','amount-desc':'Amt ↓','amount-asc':'Amt ↑'};
    const sortLbl = document.getElementById('tx-sort-label');
    if (sortLbl) sortLbl.textContent = SORT_LABELS[txSort] || 'Date ↓';

    // Filter by type + search query + categories + amount range
    const filtered = sorted.filter(t => {
        if (txFilter !== 'all' && t.type !== txFilter) return false;

        // Multi-category filter
        if (advancedFilters.categories.length > 0) {
            if (!advancedFilters.categories.includes(t.mainCategory)) return false;
        }

        // Amount range filter
        if (advancedFilters.amountRange.min !== null || advancedFilters.amountRange.max !== null) {
            const amt = parseFloat(t.amount);
            if (advancedFilters.amountRange.min !== null && amt < advancedFilters.amountRange.min) return false;
            if (advancedFilters.amountRange.max !== null && amt > advancedFilters.amountRange.max) return false;
        }

        if (!q) return true;
        return [t.desc||'', t.mainCategory||'', t.subCategory||'',
            parseFloat(t.amount).toFixed(2)].join(' ').toLowerCase().includes(q);
    });

    if (!filtered.length) {
        listEl.innerHTML = '<p class="text-center text-zinc-600 text-sm py-16">No transactions match your search</p>';
        return;
    }

    let html = '';
    if (txSort === 'amount-desc' || txSort === 'amount-asc') {
        // No date grouping when sorted by amount
        filtered.forEach(t => { html += _txRowHTML(t); });
    } else {
        // Group by date
        const groups = new Map();
        filtered.forEach(t => {
            const lbl = _dateLabel(t.date);
            if (!groups.has(lbl)) groups.set(lbl, []);
            groups.get(lbl).push(t);
        });
        for (const [lbl, items] of groups) {
            html += `<div class="flex items-center gap-3 pt-5 pb-2">
                <span class="text-[9px] font-black tracking-[.12em] text-zinc-600 uppercase shrink-0">${lbl}</span>
                <div class="flex-1 h-px bg-zinc-800/80"></div>
            </div>`;
            items.forEach(t => { html += _txRowHTML(t); });
        }
    }
    listEl.innerHTML = html;
    _attachSwipe();
}

function _txRowHTML(t) {
    const realIdx = transactions.indexOf(t);
    const isInc   = t.type === 'income';
    const isTrf   = t.type === 'transfer';
    const isExcl  = !!t.excluded;
    const isRecurring = !!t.recurringId;

    let amtCls, sign, emoji, title, subtitle;
    if (isTrf) {
        const fromAcc = _getAccById(t.fromAccountId);
        const toAcc   = _getAccById(t.toAccountId);
        amtCls  = _isTransferExcluded(t) ? 'text-zinc-600' : 'text-sky-400';
        sign    = '⇄';
        emoji   = '🔄';
        title   = t.desc || ((fromAcc ? fromAcc.name : '?') + ' → ' + (toAcc ? toAcc.name : '?'));
        subtitle = (fromAcc ? fromAcc.name : '?') + ' → ' + (toAcc ? toAcc.name : '?');
    } else {
        const iconKey = t.mainCategory + ':' + (t.subCategory || '');
        amtCls  = isExcl ? 'text-zinc-600 line-through' : isInc ? 'text-emerald-400' : 'text-zinc-200';
        sign    = isInc ? '+' : '\u2212';
        emoji   = isExcl ? '🚫' : (itemIcons[iconKey] || mainEmojis[t.mainCategory] || (isInc ? '💰' : '💸'));
        title   = t.desc || (t.mainCategory + (t.subCategory ? ' \u00B7 ' + t.subCategory : ''));
        const linkedAcc = t.walletAccountId ? _getAccById(t.walletAccountId) : null;
        subtitle = linkedAcc ? linkedAcc.name : (t.mainCategory || '');
    }

    // Recurring indicator badge
    const recurringBadge = isRecurring
        ? '<div class="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-zinc-950 flex items-center justify-center text-[10px]">🔄</div>'
        : '';

    return `<div class="tx-item mb-1" data-index="${realIdx}">
        <div class="tx-content flex items-center gap-3 px-3 py-2.5" onclick="showTxSummary(${realIdx})" style="cursor:pointer">
            <div class="relative w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">
                ${emoji}
                ${recurringBadge}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium leading-snug truncate">${title}</p>
                <p class="text-[11px] text-zinc-600 mt-0.5 truncate">${subtitle}</p>
            </div>
            <span class="${amtCls} font-semibold text-sm tabular-nums shrink-0">${sign}$${parseFloat(t.amount).toFixed(2)}</span>
        </div>
        <div class="tx-delete">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
            DELETE
        </div>
    </div>`;
    return buildTransactionRowHTML(t, {
        variant: 'full',
        onClick: `showTxSummary(${realIdx})`,
        showDelete: true,
        index: realIdx
    });
}

function prevTxMonth() { prevSharedMonth(); }
function nextTxMonth() { nextSharedMonth(); }
function toggleTxSort() {
    const order = ['date-desc','date-asc','amount-desc','amount-asc'];
    txSort = order[(order.indexOf(txSort) + 1) % order.length];
    renderTransactions();
}

/* ══════════════════════════════════════════════
   ADVANCED FILTER MODAL
══════════════════════════════════════════════ */

function showAdvancedFilters() {
    document.getElementById('advanced-filter-modal').classList.remove('hidden');
    _populateFilterModal();
}

function _populateFilterModal() {
    // Populate date range inputs and attach event listeners
    const startInput = document.getElementById('filter-date-start');
    const endInput = document.getElementById('filter-date-end');
    if (startInput) {
        startInput.value = advancedFilters.dateRange.start || '';
        startInput.onchange = () => {
            advancedFilters.dateRange.start = startInput.value || null;
        };
    }
    if (endInput) {
        endInput.value = advancedFilters.dateRange.end || '';
        endInput.onchange = () => {
            advancedFilters.dateRange.end = endInput.value || null;
        };
    }

    // Populate amount range inputs and attach event listeners
    const minInput = document.getElementById('filter-amount-min');
    const maxInput = document.getElementById('filter-amount-max');
    if (minInput) {
        minInput.value = advancedFilters.amountRange.min !== null ? advancedFilters.amountRange.min : '';
        minInput.onchange = () => {
            const val = parseFloat(minInput.value);
            advancedFilters.amountRange.min = minInput.value && !isNaN(val) ? val : null;
        };
    }
    if (maxInput) {
        maxInput.value = advancedFilters.amountRange.max !== null ? advancedFilters.amountRange.max : '';
        maxInput.onchange = () => {
            const val = parseFloat(maxInput.value);
            advancedFilters.amountRange.max = maxInput.value && !isNaN(val) ? val : null;
        };
    }

    // Populate category checkboxes
    const catList = document.getElementById('filter-categories-list');
    if (catList) {
        let html = '';
        Object.keys(expenseCategories).forEach(cat => {
            const isChecked = advancedFilters.categories.includes(cat);
            const checkboxId = 'filter-cat-' + cat.replace(/\s+/g, '-');
            const escapedCat = escapeHtml(cat);
            const escapedId = escapeHtml(checkboxId);
            html += `<div class="flex items-center justify-between px-4 py-3 border-b border-zinc-700/30 last:border-0">
                <label for="${escapedId}" class="flex-1 text-sm text-zinc-200 cursor-pointer">${mainEmojis[cat] || '📁'} ${escapedCat}</label>
                <input type="checkbox" id="${escapedId}" data-category="${escapedCat}"
                       ${isChecked ? 'checked' : ''}
                       class="w-5 h-5 rounded bg-zinc-700 border-zinc-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900 cursor-pointer">
            </div>`;
        });
        catList.innerHTML = html;

        // Attach event listeners to category checkboxes
        catList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.onchange = () => {
                const cat = cb.dataset.category;
                if (cb.checked) {
                    if (!advancedFilters.categories.includes(cat)) {
                        advancedFilters.categories.push(cat);
                    }
                } else {
                    advancedFilters.categories = advancedFilters.categories.filter(c => c !== cat);
                }
            };
        });
    }

    // Render saved filter presets
    _renderSavedFilters();
}

function hideAdvancedFilters() {
    document.getElementById('advanced-filter-modal').classList.add('hidden');
    renderTransactions();
}

function applyAdvancedFilters() {
    hideAdvancedFilters();
}

function clearAllFilters() {
    // Reset all advanced filters to default state
    advancedFilters.dateRange.start = null;
    advancedFilters.dateRange.end = null;
    advancedFilters.categories = [];
    advancedFilters.amountRange.min = null;
    advancedFilters.amountRange.max = null;

    // Re-populate the modal with cleared values
    _populateFilterModal();

    // Re-render transactions with filters cleared
    renderTransactions();
}

/* ── Saved Filter Presets ─────────────────────── */
function saveFilterPreset() {
    // Check if there are any active filters to save
    const hasDateRange = advancedFilters.dateRange.start || advancedFilters.dateRange.end;
    const hasCategories = advancedFilters.categories.length > 0;
    const hasAmountRange = advancedFilters.amountRange.min !== null || advancedFilters.amountRange.max !== null;

    if (!hasDateRange && !hasCategories && !hasAmountRange) {
        alert('Please set at least one filter before saving.');
        return;
    }

    // Prompt for preset name
    const name = prompt('Enter a name for this filter preset:');
    if (!name || !name.trim()) return;

    // Create preset object
    const preset = {
        id: Date.now().toString(),
        name: name.trim(),
        filters: {
            dateRange: { ...advancedFilters.dateRange },
            categories: [...advancedFilters.categories],
            amountRange: { ...advancedFilters.amountRange }
        }
    };

    // Add to savedFilters array
    savedFilters.push(preset);

    // Persist to storage
    saveData();

    // Update the saved filters list in the modal
    _renderSavedFilters();
}

function _renderSavedFilters() {
    const listEl = document.getElementById('filter-presets-list');
    if (!listEl) return;

    if (savedFilters.length === 0) {
        listEl.innerHTML = '<div class="px-4 py-3 text-xs text-zinc-600 text-center">No saved filters yet</div>';
        return;
    }

    let html = '';
    savedFilters.forEach(preset => {
        // Build filter description
        const parts = [];
        if (preset.filters.dateRange.start || preset.filters.dateRange.end) {
            const start = escapeHtml(preset.filters.dateRange.start || '...');
            const end = escapeHtml(preset.filters.dateRange.end || '...');
            parts.push(`📅 ${start} → ${end}`);
        }
        if (preset.filters.categories.length > 0) {
            parts.push(`🏷️ ${preset.filters.categories.length} categories`);
        }
        if (preset.filters.amountRange.min !== null || preset.filters.amountRange.max !== null) {
            const minStr = preset.filters.amountRange.min !== null ? String(preset.filters.amountRange.min) : '...';
            const maxStr = preset.filters.amountRange.max !== null ? String(preset.filters.amountRange.max) : '...';
            parts.push(`💵 $${escapeHtml(minStr)} - $${escapeHtml(maxStr)}`);
        }
        const description = parts.join(' · ');

        html += `<div class="border-t border-zinc-700/40 first:border-t-0">
            <div class="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-800/50 transition-colors" onclick="loadFilterPreset('${preset.id}')">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-medium text-sm truncate">${escapeHtml(preset.name)}</span>
                    </div>
                    <p class="text-[11px] text-zinc-500 truncate">${description}</p>
                </div>
                <button onclick="event.stopPropagation();deleteFilterPreset('${preset.id}')"
                    class="shrink-0 w-8 h-8 rounded-full bg-zinc-800 hover:bg-rose-500/20 flex items-center justify-center text-zinc-500 hover:text-rose-400 transition-colors"
                    aria-label="Delete preset">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                    </svg>
                </button>
            </div>
        </div>`;
    });

    listEl.innerHTML = html;
}

function loadFilterPreset(presetId) {
    const preset = savedFilters.find(p => p.id === presetId);
    if (!preset) return;

    // Apply preset filters to advancedFilters state
    advancedFilters.dateRange.start = preset.filters.dateRange.start;
    advancedFilters.dateRange.end = preset.filters.dateRange.end;
    advancedFilters.categories = [...preset.filters.categories];
    advancedFilters.amountRange.min = preset.filters.amountRange.min;
    advancedFilters.amountRange.max = preset.filters.amountRange.max;

    // Re-populate the modal to reflect loaded filters
    _populateFilterModal();

    // Close modal and apply filters
    hideAdvancedFilters();
}

function deleteFilterPreset(presetId) {
    if (!confirm('Delete this filter preset?')) return;

    // Remove preset from savedFilters array
    const index = savedFilters.findIndex(p => p.id === presetId);
    if (index === -1) return;

    savedFilters.splice(index, 1);
    saveData();

    // Re-render the saved filters list
    _renderSavedFilters();
}

/* ══════════════════════════════════════════════
   TRANSACTION SUMMARY MODAL
══════════════════════════════════════════════ */

function showTxSummary(idx) {
    const t = transactions[idx];
    if (!t) return;

    const modal = document.getElementById('tx-summary-modal');
    if (!modal) return;

    const isInc  = t.type === 'income';
    const isTrf  = t.type === 'transfer';
    const isExcl = !!t.excluded;

    // Amount display
    let sign, amtColor;
    if (isTrf) {
        sign = '⇄'; amtColor = 'text-sky-400';
    } else if (isInc) {
        sign = '+'; amtColor = 'text-emerald-400';
    } else {
        sign = '\u2212'; amtColor = isExcl ? 'text-zinc-500' : 'text-rose-400';
    }

    // Emoji
    let emoji;
    if (isTrf) {
        emoji = '🔄';
    } else if (isExcl) {
        emoji = '🚫';
    } else {
        const iconKey = t.mainCategory + ':' + (t.subCategory || '');
        emoji = itemIcons[iconKey] || mainEmojis[t.mainCategory] || (isInc ? '💰' : '💸');
    }

    // Type badge
    const typeBadges = {
        expense:  { label: 'Expense',  cls: 'bg-rose-500/15 text-rose-400' },
        income:   { label: 'Income',   cls: 'bg-emerald-500/15 text-emerald-400' },
        transfer: { label: 'Transfer', cls: 'bg-sky-500/15 text-sky-400' },
    };
    const badge = typeBadges[t.type] || typeBadges.expense;
    if (isExcl) { badge.label = 'Excluded'; badge.cls = 'bg-zinc-700/50 text-zinc-400'; }

    // Description / title
    let title;
    if (isTrf) {
        const fromAcc = _getAccById(t.fromAccountId);
        const toAcc   = _getAccById(t.toAccountId);
        title = t.desc || ((fromAcc ? fromAcc.name : '?') + ' → ' + (toAcc ? toAcc.name : '?'));
    } else {
        title = t.desc || (t.mainCategory + (t.subCategory ? ' \u00B7 ' + t.subCategory : ''));
    }

    // Date formatted
    const [y, mo, day] = t.date.split('-').map(Number);
    const dateFormatted = new Date(y, mo - 1, day).toLocaleDateString('default', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    // Date added (from transaction id — timestamp)
    let dateAdded = '';
    if (t.id && typeof t.id === 'number' && t.id > 1000000000000) {
        const addedDate = new Date(t.id);
        dateAdded = addedDate.toLocaleDateString('default', {
            month: 'short', day: 'numeric', year: 'numeric'
        }) + ' at ' + addedDate.toLocaleTimeString('default', {
            hour: 'numeric', minute: '2-digit'
        });
    }

    // Build detail rows
    let detailRows = '';

    // Category (for non-transfers)
    if (!isTrf && t.mainCategory) {
        const catLabel = t.mainCategory + (t.subCategory ? ' \u00B7 ' + t.subCategory : '');
        detailRows += _summaryRow('Category', catLabel);
    }

    // Account
    if (isTrf) {
        const fromAcc = _getAccById(t.fromAccountId);
        const toAcc   = _getAccById(t.toAccountId);
        detailRows += _summaryRow('From', fromAcc ? (fromAcc.icon || '🏦') + ' ' + fromAcc.name : '?');
        detailRows += _summaryRow('To', toAcc ? (toAcc.icon || '🏦') + ' ' + toAcc.name : '?');
    } else if (t.walletAccountId) {
        const acc = _getAccById(t.walletAccountId);
        if (acc) detailRows += _summaryRow('Account', (acc.icon || '🏦') + ' ' + acc.name);
    }

    // Date
    detailRows += _summaryRow('Date', dateFormatted);

    // Note / description
    if (t.desc) {
        detailRows += _summaryRow('Note', t.desc);
    }

    // Excluded badge
    if (isExcl) {
        detailRows += _summaryRow('Status', 'Excluded from budget & reports');
    }
    if (isTrf && _isTransferExcluded(t)) {
        detailRows += _summaryRow('Status', 'Same-type transfer (excluded)');
    }

    // Recurring indicator
    const isRecurring = !!t.recurringId;
    if (isRecurring) {
        detailRows += _summaryRow('Recurring', '🔄 Part of recurring series');
    }

    // Date added
    if (dateAdded) {
        detailRows += _summaryRow('Added', dateAdded);
    }

    // Manage recurring button (if recurring transaction)
    const manageRecurringBtn = isRecurring ? `
        <button onclick="hideTxSummary();showDataModal();_openRecurringSection()"
            class="w-full bg-zinc-800 hover:bg-zinc-700 py-3.5 rounded-2xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            Manage Recurring Series
        </button>` : '';

    const content = document.getElementById('tx-summary-content');
    content.innerHTML = `
        <!-- Header -->
        <div class="flex flex-col items-center pt-2 pb-5">
            <div class="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-3xl mb-4">${emoji}</div>
            <span class="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-3 ${badge.cls}">${badge.label}</span>
            <p class="${amtColor} text-4xl font-bold tracking-tight">${sign}$${parseFloat(t.amount).toFixed(2)}</p>
            <p class="text-sm text-zinc-400 mt-1.5 text-center px-4 truncate max-w-full">${title}</p>
        </div>

        <!-- Detail card -->
        <div class="mx-1 rounded-2xl bg-zinc-800/50 overflow-hidden mb-5">
            ${detailRows}
        </div>

        <!-- Actions -->
        <div class="space-y-2 px-1">
            ${manageRecurringBtn}
            <button onclick="hideTxSummary();openEditTx(${idx})"
                class="w-full bg-zinc-800 hover:bg-zinc-700 py-3.5 rounded-2xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                Edit Transaction
            </button>
            <button onclick="hideTxSummary();_showUndo(${idx});renderTransactions()"
                class="w-full py-3 rounded-2xl text-sm text-rose-400 hover:bg-rose-500/10 transition-colors font-medium">
                Delete
            </button>
        </div>`;

    modal.classList.remove('hidden');
}

function _summaryRow(label, value) {
    return `<div class="flex items-center justify-between px-4 py-3 border-b border-zinc-700/30 last:border-0">
        <span class="text-[11px] text-zinc-500 font-medium uppercase tracking-wider shrink-0">${label}</span>
        <span class="text-sm text-zinc-200 text-right truncate ml-4">${value}</span>
    </div>`;
}

function hideTxSummary() {
    const modal = document.getElementById('tx-summary-modal');
    if (modal) modal.classList.add('hidden');
}

function _openRecurringSection() {
    // Ensure the recurring accordion is expanded
    const body = document.getElementById('recurring-acc-body');
    const chev = document.getElementById('recurring-acc-chev');
    if (body && body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        if (chev) chev.style.transform = 'rotate(180deg)';
        renderRecurringTransactions();
    }
}

/* ── Direction-locked swipe-to-delete ────────────── */
function _attachSwipe() {
    document.querySelectorAll('.tx-item').forEach(item => {
        const content = item.querySelector('.tx-content');
        let sx = 0, sy = 0, cx = 0, axis = null;

        item.addEventListener('touchstart', e => {
            sx = e.touches[0].clientX;
            sy = e.touches[0].clientY;
            cx = 0; axis = null;
            content.style.transition = 'none';
        }, { passive: true });

        item.addEventListener('touchmove', e => {
            const dx = e.touches[0].clientX - sx;
            const dy = e.touches[0].clientY - sy;
            if (!axis && (Math.abs(dx) > 5 || Math.abs(dy) > 5))
                axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            if (axis !== 'h') return;
            e.preventDefault();
            item.classList.add('swiping');
            cx = Math.max(-76, Math.min(0, dx));
            content.style.transform = `translateX(${cx}px)`;
        }, { passive: false });

        item.addEventListener('touchend', () => {
            item.classList.remove('swiping');
            if (axis !== 'h') { axis = null; return; }
            content.style.transition = '';
            if (cx < -38) {
                // Animate off then collapse height
                content.style.transform = 'translateX(-110%)';
                const h = item.offsetHeight;
                item.style.cssText += `;overflow:hidden;max-height:${h}px;
                    transition:max-height .28s .12s ease,opacity .25s .12s ease,margin-bottom .28s .12s ease`;
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    item.style.maxHeight   = '0';
                    item.style.opacity     = '0';
                    item.style.marginBottom = '0';
                }));
                setTimeout(() => _showUndo(parseInt(item.dataset.index)), 340);
            } else {
                content.style.transform = 'translateX(0)';
            }
            axis = null;
        });
    });
}

/* ── Undo snackbar ───────────────────────────────── */
function _showUndo(idx) {
    _undoData = { t: transactions[idx], idx };
    // Reverse balance changes before removing
    _updateAccountBalances(transactions[idx], true);
    transactions.splice(idx, 1);
    saveData();

    const old = document.getElementById('_undo');
    if (old) old.remove();
    if (_undoTimer) clearTimeout(_undoTimer);

    const bar = document.createElement('div');
    bar.id = '_undo';
    bar.innerHTML = `<span style="color:#a1a1aa">Transaction deleted</span>
        <button onclick="undoTxDelete()" style="background:none;border:none;cursor:pointer;color:#10b981;font-weight:700;font-size:.82rem">Undo</button>`;
    document.body.appendChild(bar);

    _undoTimer = setTimeout(() => {
        bar.classList.add('out');
        setTimeout(() => { bar.remove(); _undoData = null; }, 230);
    }, 4500);
}

function undoTxDelete() {
    if (!_undoData) return;
    clearTimeout(_undoTimer);
    transactions.splice(_undoData.idx, 0, _undoData.t);
    // Re-apply balance changes
    _updateAccountBalances(_undoData.t, false);
    _undoData = null;
    saveData();
    const bar = document.getElementById('_undo');
    if (bar) { bar.classList.add('out'); setTimeout(() => bar.remove(), 230); }
    renderAll();
}

        function _closestBudgetMonth(targetKey) {
    // Returns the nearest month key that has at least one budget value set
    const months = Object.keys(budgetMonths).filter(mk => {
        const m = budgetMonths[mk];
        if (!m || !m.budgets) return false;
        // Check if any section has any category with any item with amount > 0
        return Object.values(m.budgets).some(section =>
            Object.values(section).some(category =>
                Object.values(category).some(item =>
                    item.amount && item.amount > 0
                )
            )
        );
    });
    if (!months.length) return null;
    const [ty, tm] = targetKey.split('-').map(Number);
    let best = null, bestDist = Infinity;
    months.forEach(mk => {
        const [y, m] = mk.split('-').map(Number);
        const dist = Math.abs((y*12+m) - (ty*12+tm));
        if (dist < bestDist) { bestDist = dist; best = mk; }
    });
    return best;
}

function _createBlankBudget(monthKey) {
    monthlyBudgets[monthKey] = {};
    Object.keys(expenseCategories).forEach(cat => {
        monthlyBudgets[monthKey][cat] = {};
        expenseCategories[cat].forEach(item => {
            monthlyBudgets[monthKey][cat][item] = 0;
        });
    });
    // Include dynamic Saving/Debt sections
    ['Saving', 'Debt'].forEach(secType => {
        const accs = walletAccounts.filter(a => a.type === secType.toLowerCase());
        if (accs.length) {
            monthlyBudgets[monthKey][secType] = {};
            accs.forEach(acc => { monthlyBudgets[monthKey][secType][acc.name] = 0; });
        }
    });
    saveData();
    renderBudgets();
}

        function _copyBudgetMonth(fromKey, toKey) {
    const src = monthlyBudgets[fromKey];
    if (!src) return;
    monthlyBudgets[toKey] = JSON.parse(JSON.stringify(src));
    saveData();
    renderBudgets();
}

function resetBudgetMonth() {
    if (!confirm('Reset this month\'s budget to factory defaults? All custom amounts will be cleared.')) return;
    // Build from defaultCategories only (no user-added items)
    monthlyBudgets[selectedBudgetMonth] = {};
    Object.keys(defaultCategories).forEach(cat => {
        monthlyBudgets[selectedBudgetMonth][cat] = {};
        defaultCategories[cat].forEach(item => {
            monthlyBudgets[selectedBudgetMonth][cat][item] = 0;
        });
    });
    saveData();
    renderBudgets();
    showToast('Budget reset to defaults');
}

function deleteBudgetMonth() {
    if (!confirm('Delete this month\'s budget? This cannot be undone.')) return;
    delete monthlyBudgets[selectedBudgetMonth];
    saveData();
    renderBudgets();
    showToast('Budget deleted');
}
