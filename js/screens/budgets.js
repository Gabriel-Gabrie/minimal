function renderBudgets() {
    // Sync from shared month
    _initSharedMonth();
    selectedBudgetMonth = selectedMonth;

    const monthBudgets = monthlyBudgets[selectedBudgetMonth] || {};
    // hasBudget: true if month key exists in monthlyBudgets (even with all zeros — user deliberately created it)
    const hasBudget = selectedBudgetMonth in monthlyBudgets;

    // ── Empty state: no budget set for this month ─────────────────
    if (!hasBudget) {
        const closest   = _closestBudgetMonth(selectedBudgetMonth);
        const monthName = formatMonthName(selectedBudgetMonth);

        const summaryEl = document.getElementById('budget-summary');
        if (summaryEl) summaryEl.innerHTML = '';

        const closestName = closest ? formatMonthName(closest) : '';
        const msg = closest
            ? 'Hey there! It looks like you don\'t have a budget for <strong>' + monthName + '</strong> yet. We\'ll copy your <strong>' + closestName + '</strong> budget to get you started.'
            : 'Hey there! You don\'t have a budget set up for <strong>' + monthName + '</strong> yet \u2014 let\'s create one.';

        const btnLabel  = closest
            ? 'Copy ' + closestName + ' budget'
            : 'Create ' + monthName + ' Budget';
        const btnAction = closest
            ? '_copyBudgetMonth(\'' + closest + '\',\'' + selectedBudgetMonth + '\')'
            : '_createBlankBudget(\'' + selectedBudgetMonth + '\')';

        document.getElementById('budgets-list').innerHTML =
            '<div class="mx-0 mt-2 bg-zinc-900 rounded-3xl p-7 text-center">'
            + '<div class="text-3xl mb-4">\uD83D\uDCC5</div>'
            + '<p class="text-sm text-zinc-400 leading-relaxed mb-6">' + msg + '</p>'
            + '<button onclick="' + btnAction + '" class="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-3.5 rounded-2xl text-sm transition-all">'
            + btnLabel + '</button>'
            + (closest ? '<button onclick="_createBlankBudget(\'' + selectedBudgetMonth + '\')" class="mt-3 w-full py-2.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Start with a blank budget instead</button>' : '')
            + (localStorage.getItem('tutDone') ? '<button onclick="_showTemplateSelector(\'' + selectedBudgetMonth + '\')" class="mt-3 w-full border border-zinc-700 hover:border-zinc-500 active:scale-95 text-zinc-300 hover:text-zinc-100 font-medium py-3 rounded-2xl text-sm transition-all">📋 Use a Template</button>' : '')
            + '</div>';
        attachBudgetSwipe();
        const footerEl2 = document.getElementById('budget-actions-footer');
        if (footerEl2) footerEl2.classList.add('hidden');
        const toggleEl2 = document.getElementById('budget-view-toggle');
        if (toggleEl2) toggleEl2.classList.add('hidden');
        return;
    }

    // ── Normal state: budget exists ───────────────────────────────
    monthlyBudgets[selectedBudgetMonth] = monthlyBudgets[selectedBudgetMonth] || {};

    // ── Zero-Sum Budget Balancer ───────────────────────────────────
    const currentBudget = budgetMonths[selectedBudgetMonth] || {};
    const budgetsObj = currentBudget.budgets || {};
    const activeSections = currentBudget.activeSections || {};
    const sectionOrder = currentBudget.sectionOrder || [];

    // Calculate income from Income section (if exists)
    let incomePlanned = 0;
    if (budgetsObj['Income']) {
        Object.keys(budgetsObj['Income']).forEach(category => {
            Object.keys(budgetsObj['Income'][category]).forEach(item => {
                incomePlanned += budgetsObj['Income'][category][item].amount || 0;
            });
        });
    }

    // Calculate expenses from all non-Income sections
    let expBudgeted = 0;
    Object.keys(budgetsObj).forEach(section => {
        if (section === 'Income') return;
        Object.keys(budgetsObj[section]).forEach(category => {
            Object.keys(budgetsObj[section][category]).forEach(item => {
                expBudgeted += budgetsObj[section][category][item].amount || 0;
            });
        });
    });
    const balance = incomePlanned - expBudgeted;
    const balPct  = incomePlanned > 0 ? Math.min(100, Math.round(expBudgeted / incomePlanned * 100)) : 0;
    const isBalanced  = Math.abs(balance) < 5;
    const balColor    = isBalanced ? '#10b981' : balance > 0 ? '#f59e0b' : '#ef4444';
    const balBadgeCls = isBalanced ? 'bg-emerald-500/20 text-emerald-400'
                      : balance > 0   ? 'bg-amber-500/20 text-amber-400'
                      :                 'bg-rose-500/20 text-rose-400';
    const balLabel    = isBalanced ? 'Balanced ✓'
                      : balance > 0   ? `Left to Budget`
                      :                 `Over Income`;
    const balSign     = !isBalanced && balance > 0 ? '+' : '';

    const summaryEl = document.getElementById('budget-summary');
    if (summaryEl) {
        const r = 65, cxD = 85, cyD = 85, sw = 18;
        const circ = 2 * Math.PI * r;

        // Color palettes: light → dark (largest category gets lightest shade)
        const emeraldShades = ['#a7f3d0','#6ee7b7','#34d399','#10b981','#059669','#047857'];
        const amberShades   = ['#fde68a','#fcd34d','#fbbf24','#f59e0b','#d97706','#b45309'];
        const roseShades    = ['#fecdd3','#fda4af','#fb7185','#f43f5e','#e11d48','#be123c'];
        const spentShades   = ['#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8','#1e40af'];

        let segs = '', legendItems = [], centerSVG, statsHTML;

        if (_budgetViewMode === 'remaining' && expBudgeted > 0) {
            // ── REMAINING MODE RING: spent by section / total budgeted ──
            const totalSpentR = calculateSpentInMonth(selectedBudgetMonth) + Math.max(0, _calculateTotalSavingsInMonth(selectedBudgetMonth));
            const leftToSpendR = expBudgeted - totalSpentR;

            // Build spent-by-section entries
            const spentEntries = [];
            sectionOrder.forEach(sectionName => {
                if (sectionName === 'Income') return;
                const categories = activeSections[sectionName] || [];
                let sectionSpent = 0;
                categories.forEach(category => {
                    const categoryBudgets = (budgetsObj[sectionName] || {})[category] || {};
                    Object.keys(categoryBudgets).forEach(item => {
                        sectionSpent += calculateSpentInMonth(selectedBudgetMonth, category, item);
                    });
                });
                if (sectionSpent > 0) spentEntries.push({ cat: sectionName, spent: sectionSpent });
            });
            spentEntries.sort((a, b) => b.spent - a.spent);

            // Assign colors
            const nSp = spentEntries.length;
            spentEntries.forEach((entry, rank) => {
                const ci = nSp <= 1 ? 2 : Math.round(rank / (nSp - 1) * 5);
                entry.color = spentShades[ci];
            });

            // Build arcs: full circle = expBudgeted
            let offsetArc = 0;
            spentEntries.forEach(entry => {
                const arcLen = Math.min((entry.spent / expBudgeted) * circ, circ - offsetArc);
                if (arcLen <= 0) return;
                segs += `<circle cx="${cxD}" cy="${cyD}" r="${r}" fill="none" stroke="${entry.color}" stroke-width="${sw}" stroke-dasharray="${arcLen.toFixed(3)} ${(circ-arcLen).toFixed(3)}" stroke-dashoffset="${(circ-offsetArc).toFixed(3)}" transform="rotate(-90,${cxD},${cyD})"/>`;
                const pctLbl = Math.round(entry.spent / expBudgeted * 100);
                legendItems.push(
                    `<div style="display:flex;align-items:center;gap:8px;padding:3px 0">` +
                    `<span style="width:8px;height:8px;border-radius:50%;background:${entry.color};display:inline-block;flex-shrink:0"></span>` +
                    `<span style="font-size:14px;color:#a1a1aa;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${entry.cat} <span style="color:#71717a;font-size:12px">${pctLbl}%</span></span>` +
                    `<span style="font-size:14px;color:#a1a1aa;font-variant-numeric:tabular-nums">$${Math.round(entry.spent)}</span>` +
                    `</div>`
                );
                offsetArc += arcLen;
            });

            // Center text
            const ltsFill = leftToSpendR >= 0 ? '#34d399' : '#ef4444';
            centerSVG = `<text x="${cxD}" y="${cyD-7}" text-anchor="middle" fill="${ltsFill}" font-size="22" font-weight="700" font-family="system-ui,sans-serif">${leftToSpendR >= 0 ? '' : '-'}$${Math.round(Math.abs(leftToSpendR))}</text><text x="${cxD}" y="${cyD+12}" text-anchor="middle" fill="${ltsFill}" font-size="9" font-family="system-ui,sans-serif" letter-spacing="0.08em">${leftToSpendR >= 0 ? 'LEFT TO SPEND' : 'OVER BUDGET'}</text>`;

            // Right-side stats
            const ltsColor = leftToSpendR >= 0 ? '#34d399' : '#ef4444';
            statsHTML = `<div style="display:flex;flex-direction:column;gap:12px">
                <div><div style="font-size:9px;color:#52525b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px">Spent</div><div style="font-size:14px;font-weight:700;color:#f87171;font-variant-numeric:tabular-nums">$${Math.round(totalSpentR)}</div></div>
                <div><div style="font-size:9px;color:#52525b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px">Budgeted</div><div style="font-size:14px;font-weight:700;color:#e4e4e7;font-variant-numeric:tabular-nums">$${Math.round(expBudgeted)}</div></div>
                <div><div style="font-size:9px;color:#52525b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px">${leftToSpendR >= 0 ? 'Left to Spend' : 'Over Budget'}</div><div style="font-size:14px;font-weight:700;color:${ltsColor};font-variant-numeric:tabular-nums">$${Math.round(Math.abs(leftToSpendR))}</div></div>
               </div>`;

        } else {
            // ── PLAN MODE RING: budgeted by section / income ──
            const palette = isBalanced ? emeraldShades : (balance > 0 ? amberShades : roseShades);

            const catEntries = [];
            sectionOrder.forEach(sectionName => {
                if (sectionName === 'Income') return;
                const categories = activeSections[sectionName] || [];
                let sectionBudget = 0;
                categories.forEach(category => {
                    const categoryBudgets = (budgetsObj[sectionName] || {})[category] || {};
                    Object.keys(categoryBudgets).forEach(item => {
                        sectionBudget += categoryBudgets[item].amount || 0;
                    });
                });
                if (sectionBudget > 0 && incomePlanned > 0) {
                    catEntries.push({ cat: sectionName, catBudget: sectionBudget });
                }
            });
            catEntries.sort((a, b) => b.catBudget - a.catBudget);

            const numCats = catEntries.length;
            catEntries.forEach((entry, rank) => {
                const colorIdx = numCats <= 1 ? 2 : Math.round(rank / (numCats - 1) * 5);
                entry.color = palette[colorIdx];
            });

            let offsetArc = 0;
            catEntries.forEach(entry => {
                const { cat, catBudget, color } = entry;
                const arcLen = Math.min((catBudget / incomePlanned) * circ, circ - offsetArc);
                if (arcLen <= 0) return;
                segs += `<circle cx="${cxD}" cy="${cyD}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${arcLen.toFixed(3)} ${(circ-arcLen).toFixed(3)}" stroke-dashoffset="${(circ-offsetArc).toFixed(3)}" transform="rotate(-90,${cxD},${cyD})"/>`;
                const pctLbl = Math.round(catBudget / incomePlanned * 100);
                legendItems.push(
                    `<div style="display:flex;align-items:center;gap:8px;padding:3px 0">` +
                    `<span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>` +
                    `<span style="font-size:14px;color:#a1a1aa;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cat} <span style="color:#71717a;font-size:12px">${pctLbl}%</span></span>` +
                    `<span style="font-size:14px;color:#a1a1aa;font-variant-numeric:tabular-nums">$${Math.round(catBudget)}</span>` +
                    `</div>`
                );
                offsetArc += arcLen;
            });

            if (!isBalanced && balance > 0 && incomePlanned > 0) {
                const unallocArc = Math.min((balance / incomePlanned) * circ, circ - offsetArc);
                if (unallocArc > 0.5) {
                    segs += `<circle cx="${cxD}" cy="${cyD}" r="${r}" fill="none" stroke="${palette[0]}" stroke-width="10" opacity="0.35" stroke-dasharray="${unallocArc.toFixed(3)} ${(circ-unallocArc).toFixed(3)}" stroke-dashoffset="${(circ-offsetArc).toFixed(3)}" transform="rotate(-90,${cxD},${cyD})"/>`;
                }
            }

            const cAmt  = incomePlanned === 0 ? '' : `${balSign}$${Math.round(Math.abs(balance))}`;
            const cLbl  = incomePlanned === 0 ? 'no income set' : balLabel.toUpperCase();
            const cAmtFill = isBalanced ? '#10b981' : balance > 0 ? '#f59e0b' : '#ef4444';
            const cLblFill = isBalanced ? '#34d399' : balance > 0 ? '#d97706' : '#f87171';

            if (incomePlanned === 0) {
                centerSVG = `<text x="${cxD}" y="${cyD+4}" text-anchor="middle" fill="#52525b" font-size="10" font-family="system-ui,sans-serif">No income set</text>`;
            } else {
                centerSVG = `<text x="${cxD}" y="${cyD-7}" text-anchor="middle" fill="${cAmtFill}" font-size="22" font-weight="700" font-family="system-ui,sans-serif">${cAmt}</text><text x="${cxD}" y="${cyD+12}" text-anchor="middle" fill="${cLblFill}" font-size="9" font-family="system-ui,sans-serif" letter-spacing="0.08em">${cLbl}</text>`;
            }

            if (incomePlanned === 0) {
                statsHTML = `<p style="font-size:11px;color:#52525b;line-height:1.6">Set a planned<br>income amount<br>to get started.</p>`;
            } else {
                statsHTML = `<div style="display:flex;flex-direction:column;gap:12px">
                    <div><div style="font-size:9px;color:#52525b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px">Expected Income</div><div style="font-size:14px;font-weight:700;color:#34d399;font-variant-numeric:tabular-nums">$${Math.round(incomePlanned)}</div></div>
                    <div><div style="font-size:9px;color:#52525b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px">Planned Outflows</div><div style="font-size:14px;font-weight:700;color:#e4e4e7;font-variant-numeric:tabular-nums">$${Math.round(expBudgeted)}</div></div>
                    <div><div style="font-size:9px;color:#52525b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px">${isBalanced ? 'Balanced' : balance >= 0 ? 'Left to Budget' : 'Over Income'}</div><div style="font-size:14px;font-weight:700;color:${cAmtFill};font-variant-numeric:tabular-nums">$${Math.round(Math.abs(balance))}</div></div>
                   </div>`;
            }
        }

        // Category legend — collapsible single column
        const legendHTML = legendItems.length ? `
            <button onclick="_toggleBalLegend()" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 0 4px;border-top:1px solid #27272a;margin-top:8px;background:none;border-left:none;border-right:none;border-bottom:none;cursor:pointer">
                <span style="font-size:10px;font-weight:800;letter-spacing:.12em;color:#52525b;text-transform:uppercase">Summary</span>
                <svg id="bal-leg-chev" style="width:14px;height:14px;color:#52525b;transition:transform .2s;transform:${_balLegendOpen?'':'rotate(-90deg)'}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div id="bal-leg-panel" style="display:${_balLegendOpen?'flex':'none'};flex-direction:column;gap:0;padding-bottom:4px">
                ${legendItems.join('')}
            </div>` : '';

        summaryEl.innerHTML = `<div class="bg-zinc-900 rounded-3xl p-5">
            <div style="display:flex;align-items:center;gap:16px">
                <div style="flex-shrink:0">
                    <svg width="170" height="170" viewBox="0 0 170 170">
                        <circle cx="${cxD}" cy="${cyD}" r="${r}" fill="none" stroke="#27272a" stroke-width="${sw}"/>
                        ${segs}
                        ${centerSVG}
                    </svg>
                </div>
                <div style="flex:1;min-width:0">${statsHTML}</div>
            </div>
            ${legendHTML}
        </div>`;
    }

    let html = '';

    // ── Iterate sections in display order ──
    sectionOrder.forEach(sectionName => {
        const categories = activeSections[sectionName] || [];
        if (!categories.length) return;

        const isIncome = sectionName === 'Income';
        const sectionBudgets = budgetsObj[sectionName] || {};

        html += `<div class="mb-5">`;
        html += `<div class="flex items-center gap-2 px-1 mb-2">
            <span class="text-lg">${mainEmojis[sectionName] || '📂'}</span>
            <span class="text-xs font-bold text-zinc-500 tracking-widest uppercase flex-1">${sectionName}</span>
        </div>`;

        html += `<div class="space-y-1.5">`;

        // ── Iterate categories within section ──
        categories.forEach(category => {
            const categoryBudgets = sectionBudgets[category] || {};
            const items = Object.keys(categoryBudgets);

            // ── Iterate items within category ──
            items.forEach(item => {
                const itemData = categoryBudgets[item] || {};
                const budget = itemData.amount || 0;
                const actual = isIncome
                    ? calculateIncomeInMonth(selectedBudgetMonth, item)
                    : calculateSpentInMonth(selectedBudgetMonth, category, item);
                const pct = budget > 0 ? actual / budget * 100 : 0;
                const donutColor = _budgetItemColor(pct, isIncome);
                const icon = itemIcons[`${category}:${item}`] || defaultItemIcons[`${category}:${item}`] || (isIncome ? '💵' : '💸');
                const catEsc = category.replace(/'/g,"\\'");
                const itemEsc = item.replace(/'/g,"\\'");

                if (_budgetViewMode === 'plan') {
                    const planAmtText = budget === 0 ? 'Set amount' : `$${Math.round(budget)}`;
                    const planAmtCls  = budget === 0 ? 'text-zinc-600' : 'text-zinc-300';
                    html += `<div class="flex items-center gap-3 bg-zinc-900 rounded-2xl px-4 py-3 cursor-pointer active:bg-zinc-800 transition-colors select-none"
                                 onclick="openBudgetItemModal('${catEsc}','${itemEsc}')">
                        <div class="text-2xl shrink-0">${icon}</div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-semibold text-zinc-200 truncate">${item}</div>
                        </div>
                        <div class="text-sm font-bold ${planAmtCls} shrink-0">${planAmtText}</div>
                    </div>`;
                } else {
                    // Remaining mode: row with progress bar
                    const barPct = Math.min(pct, 100);
                    let leftText, leftColor;
                    if (budget === 0) {
                        leftText = 'No budget'; leftColor = 'text-zinc-600';
                    } else if (isIncome) {
                        const diff = actual - budget;
                        leftText = diff >= 0 ? `+$${Math.round(diff)}` : `$${Math.round(budget - actual)} left`;
                        leftColor = diff >= 0 ? 'text-emerald-400' : 'text-amber-400';
                    } else {
                        const left = budget - actual;
                        leftText = left >= 0 ? `$${Math.round(left)} left` : `-$${Math.round(-left)} over`;
                        leftColor = left >= 0 ? 'text-emerald-400' : 'text-rose-400';
                    }
                    html += `<div class="bg-zinc-900 rounded-2xl px-4 py-3 cursor-pointer active:bg-zinc-800 transition-colors select-none"
                                 onclick="openBudgetItemModal('${catEsc}','${itemEsc}')">
                        <div class="flex items-center gap-3 ${budget > 0 ? 'mb-2' : ''}">
                            <div class="text-2xl shrink-0">${icon}</div>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-semibold text-zinc-200 truncate">${item}</div>
                            </div>
                            <div class="text-xs font-bold ${leftColor} shrink-0">${leftText}</div>
                        </div>
                        ${budget > 0 ? `<div class="ml-11">
                            <div class="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1">
                                <div class="h-full rounded-full progress-bar" style="width:${barPct}%;background:${donutColor}"></div>
                            </div>
                            <div class="text-[11px] text-zinc-500">$${Math.round(actual)} / $${Math.round(budget)}</div>
                        </div>` : ''}
                    </div>`;
                }
            });
        });

        // Add category row with dropdown
        const secEscQ = sectionName.replace(/"/g,'&quot;');
        const secEscS = sectionName.replace(/'/g,"\\'");
        const inactiveCategories = (masterSections[sectionName] || []).filter(c => !categories.includes(c));
        if (inactiveCategories.length > 0) {
            html += `<button id="add-cat-btn-${sectionName.replace(/\s+/g,'-')}" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-dashed border-zinc-800 hover:border-emerald-500/40 text-zinc-600 hover:text-zinc-400 active:scale-[.98] transition-all"
                         onclick="_toggleAddCategoryDropdown('${secEscS}')">
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                <span class="text-xs">Add category</span>
                <svg id="add-cat-chevron-${sectionName.replace(/\s+/g,'-')}" class="w-3.5 h-3.5 shrink-0 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div id="add-cat-dropdown-${sectionName.replace(/\s+/g,'-')}" class="hidden mt-2 bg-zinc-900 rounded-2xl p-2 space-y-1"></div>`;
        }

        html += `</div></div>`;
    });

    // ── Add Section button (shows inactive sections from masterSectionOrder) ──
    const inactiveSections = masterSectionOrder.filter(s => !sectionOrder.includes(s));
    if (inactiveSections.length > 0) {
        html += `<div class="mt-4">
            <button id="add-section-btn" class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-zinc-800 hover:border-emerald-500/40 text-zinc-600 hover:text-zinc-400 active:scale-[.98] transition-all"
                onclick="_toggleAddSectionDropdown()">
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                <span class="text-xs font-semibold">Add Section</span>
                <svg id="add-section-chevron" class="w-3.5 h-3.5 shrink-0 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div id="add-section-dropdown" class="hidden mt-2 bg-zinc-900 rounded-2xl p-2 space-y-1"></div>
        </div>`;
    }

    document.getElementById('budgets-list').innerHTML = html || '<p class="text-center text-zinc-600 text-sm py-10">No sections yet</p>';
    attachBudgetItemListeners();
    attachBudgetSwipe();
    // Show/hide footer and view toggle
    const footerEl = document.getElementById('budget-actions-footer');
    if (footerEl) footerEl.classList.toggle('hidden', !hasBudget);
    const toggleEl = document.getElementById('budget-view-toggle');
    if (toggleEl) toggleEl.classList.toggle('hidden', !hasBudget);
}

function attachBudgetItemListeners() {
    document.querySelectorAll('.add-budget-item-btn').forEach(btn => {
        btn.addEventListener('click', () => addBudgetItemToMain(btn.dataset.main));
    });
}

/* ── Add Section Dropdown ─────────────────────── */
function _toggleAddSectionDropdown() {
    const dropdown = document.getElementById('add-section-dropdown');
    const chevron = document.getElementById('add-section-chevron');
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('hidden');

    if (isHidden) {
        // Build and show dropdown
        const currentBudget = budgetMonths[selectedBudgetMonth] || {};
        const sectionOrder = currentBudget.sectionOrder || [];
        const inactiveSections = masterSectionOrder.filter(s => !sectionOrder.includes(s));

        let dropdownHTML = '';
        inactiveSections.forEach(sectionName => {
            const icon = mainEmojis[sectionName] || '📂';
            dropdownHTML += `<button onclick="_addSectionFromDropdown('${sectionName.replace(/'/g, "\\'")}')"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white text-left transition-colors">
                <span class="text-lg">${icon}</span>
                <span class="text-sm font-medium">${sectionName}</span>
            </button>`;
        });

        dropdown.innerHTML = dropdownHTML;
        dropdown.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        // Hide dropdown
        dropdown.classList.add('hidden');
        if (chevron) chevron.style.transform = '';
    }
}

function _addSectionFromDropdown(sectionName) {
    addSectionToBudget(selectedBudgetMonth, sectionName);
    saveData();
    renderBudgets();
}

/* ── Add Category Dropdown ─────────────────────── */
function _toggleAddCategoryDropdown(sectionName) {
    const dropdownId = 'add-cat-dropdown-' + sectionName.replace(/\s+/g,'-');
    const chevronId = 'add-cat-chevron-' + sectionName.replace(/\s+/g,'-');
    const dropdown = document.getElementById(dropdownId);
    const chevron = document.getElementById(chevronId);
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('hidden');

    if (isHidden) {
        // Build and show dropdown
        const currentBudget = budgetMonths[selectedBudgetMonth] || {};
        const activeSections = currentBudget.activeSections || {};
        const activeCategories = activeSections[sectionName] || [];
        const inactiveCategories = (masterSections[sectionName] || []).filter(c => !activeCategories.includes(c));

        let dropdownHTML = '';
        inactiveCategories.forEach(categoryName => {
            const catEsc = categoryName.replace(/'/g, "\\'");
            const secEsc = sectionName.replace(/'/g, "\\'");
            // Get icon from first item in this category (if exists in itemIcons)
            const firstItemKey = categoryName + ':' + categoryName;
            const icon = itemIcons[firstItemKey] || defaultItemIcons[firstItemKey] || '📁';
            dropdownHTML += `<button onclick="_addCategoryFromDropdown('${secEsc}','${catEsc}')"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white text-left transition-colors">
                <span class="text-lg">${icon}</span>
                <span class="text-sm font-medium">${categoryName}</span>
            </button>`;
        });

        dropdown.innerHTML = dropdownHTML;
        dropdown.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        // Hide dropdown
        dropdown.classList.add('hidden');
        if (chevron) chevron.style.transform = '';
    }
}

function _addCategoryFromDropdown(sectionName, categoryName) {
    addCategoryToBudget(selectedBudgetMonth, sectionName, categoryName);
    saveData();
    renderBudgets();
}

function inlineEditName(row, main, sub) {
    const nameDiv = row.querySelector('.budget-item-name');
    if (nameDiv.querySelector('input')) return;
    const inner = nameDiv.querySelector('div');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = sub;
    input.className = 'w-full bg-zinc-950 border border-emerald-500 rounded-lg px-2 py-1 text-sm font-medium focus:outline-none';
    inner.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    function save() {
        if (done) return; done = true;
        const newName = input.value.trim();
        if (!newName || newName === sub) { renderBudgets(); return; }
        if (expenseCategories[main].includes(newName)) {
            alert(`"${newName}" already exists in ${main}.`);
            renderBudgets(); return;
        }
        const idx = expenseCategories[main].indexOf(sub);
        if (idx !== -1) expenseCategories[main][idx] = newName;
        Object.keys(monthlyBudgets).forEach(mo => {
            const mb = monthlyBudgets[mo];
            if (mb[main] && sub in mb[main]) { mb[main][newName] = mb[main][sub]; delete mb[main][sub]; }
        });
        transactions.forEach(t => { if (t.mainCategory === main && t.subCategory === sub) t.subCategory = newName; });

        saveData();
        renderBudgets();
    }
    function cancel() { if (done) return; done = true; renderBudgets(); }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
}

function inlineEditAmount(row, main, sub) {
    const amountDiv = row.querySelector('.budget-item-amount');
    if (amountDiv.querySelector('input')) return;
    monthlyBudgets[selectedBudgetMonth] = monthlyBudgets[selectedBudgetMonth] || {};
    const mb = monthlyBudgets[selectedBudgetMonth];
    mb[main] = mb[main] || {};
    const current = mb[main][sub] || 0;
    const spent = calculateSpentInMonth(selectedBudgetMonth, main, sub);

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center gap-1';
    const spentLabel = document.createElement('span');
    spentLabel.className = 'text-sm text-zinc-400';
    spentLabel.textContent = `$${Math.round(spent)} / $`;
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.step = '1';
    input.value = current > 0 ? Math.round(current) : '';
    input.placeholder = '0';
    input.className = 'w-20 bg-zinc-950 border border-emerald-500 rounded-lg px-2 py-0.5 text-sm text-center focus:outline-none';
    wrapper.appendChild(spentLabel);
    wrapper.appendChild(input);
    amountDiv.replaceChildren(wrapper);
    input.focus();
    input.select();

    let done = false;
    function save() {
        if (done) return; done = true;
        const amt = Math.round(parseFloat(input.value) || 0);
        monthlyBudgets[selectedBudgetMonth][main][sub] = amt;
        saveData();
        renderBudgets();
    }
    function cancel() { if (done) return; done = true; renderBudgets(); }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
}

// ── Budget item color: 4-state system ──────────────────────────
// expense: ≤60% emerald → 60-95% amber → 95-100% sky (on-target) → >100% rose
// income:  <60% rose → 60-100% amber → ≥100% emerald
function _budgetItemColor(pct, isInc) {
    if (isInc) {
        if (pct >= 100) return '#10b981';
        if (pct >= 60)  return '#f59e0b';
        return '#ef4444';
    }
    if (pct > 100) return '#ef4444';   // over — rose
    if (pct >= 95) return '#0ea5e9';   // on target — sky blue
    if (pct >= 60) return '#f59e0b';   // approaching — amber
    return '#10b981';                   // safe — emerald
}

function _setBudgetViewMode(mode) {
    _budgetViewMode = mode;
    const planBtn = document.getElementById('bview-btn-plan');
    const remBtn  = document.getElementById('bview-btn-remaining');
    if (planBtn) {
        planBtn.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all '
            + (mode === 'plan' ? 'bg-zinc-800 text-white' : 'text-zinc-500');
    }
    if (remBtn) {
        remBtn.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all '
            + (mode === 'remaining' ? 'bg-zinc-800 text-white' : 'text-zinc-500');
    }
    renderBudgets();
}

/* ── Budget section/category reordering ─────────────── */
function _toggleBalLegend() {
    _balLegendOpen = !_balLegendOpen;
    const panel = document.getElementById('bal-leg-panel');
    const chev  = document.getElementById('bal-leg-chev');
    if (panel) panel.style.display = _balLegendOpen ? 'flex' : 'none';
    if (chev)  chev.style.transform = _balLegendOpen ? '' : 'rotate(-90deg)';
}

/* ── Template Selector ─────────────────────────────── */
function _showTemplateSelector(monthKey) {
    // Gather all templates: built-in + custom
    const templates = [];
    Object.keys(budgetTemplates).forEach(key => {
        const t = budgetTemplates[key];
        const cats = Object.keys(t.categories || {}).filter(c => c !== 'Income');
        const emojis = cats.slice(0, 5).map(c => {
            const firstItem = (t.categories[c] || [])[0];
            return firstItem ? (t.itemIcons[c + ':' + firstItem] || '📁') : '📁';
        }).join(' ');
        templates.push({ id: key, name: t.name, description: t.description || '', emojis: emojis, data: { id: key, ...t } });
    });
    customTemplates.forEach(t => {
        const cats = Object.keys(t.categories || {}).filter(c => c !== 'Income');
        const emojis = cats.slice(0, 5).map(c => {
            const firstItem = (t.categories[c] || [])[0];
            return firstItem ? ((t.itemIcons || {})[c + ':' + firstItem] || '📁') : '📁';
        }).join(' ');
        templates.push({ id: t.id, name: t.name, description: t.description || '', emojis: emojis, data: t });
    });

    let cards = '';
    templates.forEach(t => {
        cards += '<div class="bg-zinc-800 rounded-2xl p-4 flex flex-col gap-2">'
            + '<div class="text-lg">' + t.emojis + '</div>'
            + '<div class="text-sm font-semibold text-zinc-100">' + t.name + '</div>'
            + (t.description ? '<p class="text-xs text-zinc-500 leading-relaxed">' + t.description + '</p>' : '')
            + '<button onclick="_applyTemplateToMonth(\'' + t.id + '\',\'' + monthKey + '\')" class="mt-auto bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-2.5 rounded-xl text-xs transition-all">Apply</button>'
            + '</div>';
    });

    if (!templates.length) {
        cards = '<p class="text-sm text-zinc-500 text-center py-4">No templates available.</p>';
    }

    document.getElementById('budgets-list').innerHTML =
        '<div class="mx-0 mt-2 bg-zinc-900 rounded-3xl p-5">'
        + '<div class="text-center mb-4">'
        + '<div class="text-2xl mb-2">📋</div>'
        + '<p class="text-sm font-semibold text-zinc-200">Choose a Template</p>'
        + '<p class="text-xs text-zinc-500 mt-1">Pick a template to set up your budget for ' + formatMonthName(monthKey) + '</p>'
        + '</div>'
        + '<div class="grid grid-cols-2 gap-3">' + cards + '</div>'
        + '<button onclick="renderBudgets()" class="mt-4 w-full py-2.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>'
        + '</div>';

    const footerEl = document.getElementById('budget-actions-footer');
    if (footerEl) footerEl.classList.add('hidden');
    const toggleEl = document.getElementById('budget-view-toggle');
    if (toggleEl) toggleEl.classList.add('hidden');
}

function _applyTemplateToMonth(templateId, monthKey) {
    const templateData = getTemplateById(templateId);
    if (!templateData) return;

    const success = applyBudgetTemplate(templateData, monthKey);
    if (!success) {
        // Month already has a budget — show inline error
        const listEl = document.getElementById('budgets-list');
        const errDiv = listEl.querySelector('.template-error');
        if (errDiv) errDiv.remove();
        const el = document.createElement('div');
        el.className = 'template-error bg-rose-500/20 text-rose-400 text-xs text-center rounded-xl px-4 py-2.5 mt-3 mx-5';
        el.textContent = formatMonthName(monthKey) + ' already has a budget. Templates can only be applied to empty months.';
        listEl.querySelector('.bg-zinc-900').appendChild(el);
        return;
    }
    renderBudgets();
}

function attachBudgetSwipe() {
    // Month navigation now handled by master month bar
    return;
    let startX = 0;
    clone.addEventListener('touchstart', e => startX = e.touches[0].clientX);
    clone.addEventListener('touchend', e => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 80) {
            if (diff > 0) nextBudgetMonth();
            else prevBudgetMonth();
        }
    });
}


/* ─────────────────────────────────────────────────────────────
   REPORTS  —  Trends & Breakdowns
───────────────────────────────────────────────────────────── */

const CAT_PALETTE = {
    'Food':'#f59e0b','Living':'#818cf8','Personal':'#c084fc',
    'Health':'#34d399','Transportation':'#38bdf8',
    'Debt':'#fb923c','Banking':'#94a3b8'
};
const _FB_COLORS = ['#f87171','#fb923c','#fbbf24','#a3e635','#34d399',
                    '#22d3ee','#818cf8','#c084fc','#f472b6','#e879f9'];

function _catColor(name, idx) {
    return CAT_PALETTE[name] || _FB_COLORS[idx % _FB_COLORS.length];
}

function setReport(){}  // no-op — kept for any lingering references

function setTrendCount(n) { _trendMonthCount = n; renderReports(); }
function setBreakCount(n) {
    _breakMonthCount = n;
    _updateReportPills();
    _renderBreakdownCard('spendBreak');
}
function setMonthCount(n) { setTrendCount(n); setBreakCount(n); }

function setBreakdownMode(mode) {
    _breakdownMode = mode;
    document.getElementById('bmode-category').className =
        'flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ' +
        (mode === 'category' ? 'bg-zinc-700 text-white' : 'text-zinc-500');
    document.getElementById('bmode-item').className =
        'flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ' +
        (mode === 'item' ? 'bg-zinc-700 text-white' : 'text-zinc-500');
    _renderBreakdownCard('spendBreak');
}

function toggleReportSection(id) {}  // no-op — old accordion sections removed
function toggleReportCard(id) {}     // no-op — old accordion cards removed

function _updateReportPills() {
    [1,3,6,12].forEach(n => {
        const b = document.getElementById('bbtn-' + n);
        if (b) b.className = 'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ' +
            (n === _breakMonthCount ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500');
    });
}
