function renderOverview() {
    const monthKey  = getCurrentMonthKey();
    const today     = getCurrentDateEST();
    const [yr, mo]  = monthKey.split('-').map(Number);
    const daysInMo  = new Date(yr, mo, 0).getDate();
    const todayDay  = parseInt(today.slice(8), 10);
    const daysLeft  = daysInMo - todayDay;

    // ── Totals ────────────────────────────────────────────────
    const mExpPure = calculateSpentInMonth(monthKey);
    const mSavings = _calculateTotalSavingsInMonth(monthKey);
    const mExp = mExpPure + Math.max(0, mSavings);  // expenses + savings outflow
    const mInc = transactions
        .filter(t => t.type === 'income' && !t.excluded && t.date.startsWith(monthKey))
        .reduce((s, t) => s + parseFloat(t.amount), 0);

    const _allTimeSav = _calculateTotalSavingsAllTime();
    const allExp = transactions.filter(t => t.type === 'expense' && !t.excluded)
        .reduce((s, t) => s + parseFloat(t.amount), 0)
        + Math.max(0, _allTimeSav);
    const allInc = transactions.filter(t => t.type === 'income' && !t.excluded)
        .reduce((s, t) => s + parseFloat(t.amount), 0);

    // Budget this month — exclude Income section from expense pace, include Saving/Debt
    const mb = monthlyBudgets[monthKey] || {};
    let totalBudget = 0;
    Object.entries(mb).forEach(([cat, items]) => {
        if (cat === 'Income') return;
        Object.values(items || {}).forEach(v => totalBudget += v);
    });
    const hasBudget = totalBudget > 0;

    // ── Header ────────────────────────────────────────────────
    const netBal = allInc - allExp;
    const balEl  = document.getElementById('balance');
    if (balEl) {
        balEl.className = 'text-3xl font-semibold tracking-tighter mt-0.5 ' +
            (netBal >= 0 ? 'text-emerald-400' : 'text-rose-400');
        balEl.textContent = (netBal < 0 ? '-' : '') + '$' + Math.round(Math.abs(netBal));
    }
    const lbl = document.getElementById('ov-month-label');
    if (lbl) lbl.textContent = new Date(yr, mo - 1)
        .toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
    const incEl = document.getElementById('total-income');
    const expEl = document.getElementById('total-expense');
    if (incEl) incEl.textContent = '$' + Math.round(mInc);
    if (expEl) expEl.textContent = '$' + Math.round(mExp);

    // ── Build cumulative daily spending array (includes savings outflows) ──
    const cumActual = [];
    let running = 0;
    for (let d = 1; d <= daysInMo; d++) {
        if (d <= todayDay) {
            const dayStr = `${monthKey}-${String(d).padStart(2, '0')}`;
            // Regular expenses
            running += transactions
                .filter(t => t.type === 'expense' && !t.excluded && t.date === dayStr)
                .reduce((s, t) => s + parseFloat(t.amount), 0);
            // Transfer outflows (spending→saving/debt) minus inflows (saving/debt→spending)
            running += transactions
                .filter(t => t.type === 'transfer' && t.date === dayStr)
                .reduce((s, t) => {
                    const ft = _getAccType(t.fromAccountId), tt = _getAccType(t.toAccountId);
                    if (ft === 'spending' && (tt === 'saving' || tt === 'debt')) return s + parseFloat(t.amount);
                    if ((ft === 'saving' || ft === 'debt') && tt === 'spending') return s - parseFloat(t.amount);
                    return s;
                }, 0);
            cumActual.push(parseFloat(running.toFixed(2)));
        } else {
            cumActual.push(null);
        }
    }

    // ── Budget pace: linear 0 → totalBudget over full month ────
    const budgetPace = hasBudget
        ? Array.from({ length: daysInMo }, (_, i) =>
            parseFloat(((i + 1) / daysInMo * totalBudget).toFixed(2)))
        : null;

    // ── X labels: 1, 5, 10, 15, 20, 25, last ─────────────────
    const xLabels = Array.from({ length: daysInMo }, (_, i) => {
        const d = i + 1;
        return (d === 1 || d % 5 === 0 || d === daysInMo) ? String(d) : '';
    });

    // ── Render chart ───────────────────────────────────────────
    _renderOvChart(cumActual, budgetPace, xLabels);

    // ── Pace badge ─────────────────────────────────────────────
    const dayLblEl = document.getElementById('ov-day-label');
    const badgeEl  = document.getElementById('ov-pace-badge');
    if (dayLblEl) {
        dayLblEl.textContent = hasBudget
            ? `Day ${todayDay} of ${daysInMo}  ·  $${totalBudget.toFixed(0)} budget`
            : `Day ${todayDay} of ${daysInMo}`;
    }
    if (badgeEl) {
        if (hasBudget && todayDay > 0) {
            const expectedNow = (todayDay / daysInMo) * totalBudget;
            const pct   = Math.round(mExp / expectedNow * 100);
            const under = mExp <= expectedNow;
            badgeEl.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full mt-0.5 ' +
                (under ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400');
            badgeEl.textContent = under ? pct + '% of pace \u2713' : pct + '% of pace';
        } else {
            badgeEl.className = 'hidden';
        }
    }

    // ── 3-stat row ─────────────────────────────────────────────
    const remaining  = hasBudget ? Math.max(0, totalBudget - mExp) : null;
    const dailyAllow = (remaining !== null && daysLeft > 0) ? remaining / daysLeft : null;

    const sSpent  = document.getElementById('ov-s-spent');
    const sBudget = document.getElementById('ov-s-budget');
    const sLeft   = document.getElementById('ov-s-left');
    const sDays   = document.getElementById('ov-s-days');
    const sDaily  = document.getElementById('ov-s-daily');

    if (sSpent)  sSpent.textContent  = '$' + Math.round(mExp);
    if (sBudget) sBudget.textContent  = hasBudget ? 'of $' + Math.round(totalBudget) : 'no budget';
    if (sLeft) {
        sLeft.textContent = remaining !== null ? '$' + Math.round(remaining) : '\u2014';
        sLeft.className   = 'text-[15px] font-semibold tracking-tight leading-none ' +
            (remaining !== null
                ? (remaining > 0 ? 'text-emerald-400' : 'text-rose-400')
                : 'text-zinc-400');
    }
    if (sDays)  sDays.textContent  = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    if (sDaily) {
        sDaily.textContent = dailyAllow !== null ? '$' + Math.round(dailyAllow) : '\u2014';
        sDaily.className   = 'text-[15px] font-semibold tracking-tight leading-none ' +
            (dailyAllow !== null && dailyAllow > 0 ? 'text-emerald-400' : 'text-zinc-400');
    }

    // ── Projection callout ─────────────────────────────────────
    const projEl    = document.getElementById('ov-proj');
    const projIcon  = document.getElementById('ov-proj-icon');
    const projTitle = document.getElementById('ov-proj-title');
    const projSub   = document.getElementById('ov-proj-sub');

    if (projEl) {
        if (todayDay > 0 && (hasBudget || mExp > 0)) {
            const dailyRate = mExp / todayDay;
            const projected = dailyRate * daysInMo;
            const pFmt      = '$' + Math.round(projected);
            let icon, title, sub, cls;

            if (!hasBudget) {
                icon  = '\uD83D\uDCCA'; cls = 'bg-zinc-800/60';
                title = `Projected spend: ${pFmt} this month`;
                sub   = 'Add a budget to see pacing targets';
            } else if (projected <= totalBudget * 0.95) {
                icon  = '\uD83D\uDFE2'; cls = 'bg-emerald-500/10 border border-emerald-500/20';
                title = 'On track \u2014 great pacing!';
                sub   = `Projected ${pFmt}  \u00B7  $${Math.round(totalBudget - projected)} under budget`;
            } else if (projected <= totalBudget * 1.08) {
                icon  = '\uD83D\uDFE1'; cls = 'bg-amber-500/10 border border-amber-500/20';
                title = 'Close to budget \u2014 watch your pace';
                sub   = `Projected ${pFmt}  \u00B7  $${Math.round(projected - totalBudget)} over budget`;
            } else {
                icon  = '\uD83D\uDD34'; cls = 'bg-rose-500/10 border border-rose-500/20';
                title = 'Over budget pace';
                sub   = `Projected ${pFmt}  \u00B7  $${Math.round(projected - totalBudget)} over budget`;
            }
            projEl.className = `mx-5 mt-3 rounded-2xl px-4 py-3 flex items-center gap-3 ${cls}`;
            projEl.classList.remove('hidden');
            if (projIcon)  projIcon.textContent  = icon;
            if (projTitle) projTitle.textContent = title;
            if (projSub)   projSub.textContent   = sub;
        } else {
            projEl.classList.add('hidden');
        }
    }

    // ── Recent transactions ────────────────────────────────────
    const CAT_EMOJI = { Food:'\uD83C\uDF54', Living:'\uD83C\uDFE0', Personal:'\uD83D\uDC64', Health:'\uD83E\uDE7A', Transportation:'\uD83D\uDE97', Debt:'\uD83D\uDCB3' };
    const recent = transactions.slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 6);
    let html = '';
    recent.forEach(t => {
        const isInc  = t.type === 'income';
        const isTrf  = t.type === 'transfer';
        let bar, emoji, amtCls, sign, title, meta;
        if (isTrf) {
            const fA = _getAccById(t.fromAccountId), tA = _getAccById(t.toAccountId);
            bar    = '#0ea5e9';
            emoji  = '🔄';
            amtCls = 'text-sky-400';
            sign   = '⇄';
            title  = t.desc || ((fA ? fA.name : '?') + ' → ' + (tA ? tA.name : '?'));
            meta   = (fA ? fA.name : '?') + ' → ' + (tA ? tA.name : '?');
        } else {
            bar    = isInc ? '#10b981' : '#f43f5e';
            emoji  = isInc ? '\uD83D\uDCB0' : (CAT_EMOJI[t.mainCategory] || '\uD83D\uDCB8');
            amtCls = isInc ? 'text-emerald-400' : 'text-rose-400';
            sign   = isInc ? '+' : '\u2212';
            title  = t.desc || (t.mainCategory + (t.subCategory ? ' \u00B7 ' + t.subCategory : ''));
            meta   = t.desc ? (t.mainCategory + (t.subCategory ? ' \u00B7 ' + t.subCategory : '')) : t.date;
        }
        html += `<div class="flex items-stretch bg-zinc-900 rounded-2xl overflow-hidden">
            <div style="width:3px;background:${bar};flex-shrink:0;margin:8px 0 8px 8px;border-radius:2px"></div>
            <div class="flex items-center w-10 shrink-0 justify-center text-lg">${emoji}</div>
            <div class="flex-1 min-w-0 py-3 pl-1">
                <div class="font-semibold text-sm leading-snug truncate">${title}</div>
                <div class="text-xs text-zinc-500 mt-0.5 truncate">${meta}</div>
            </div>
            <div class="flex items-center pr-4 shrink-0">
                <span class="${amtCls} font-semibold text-base tabular-nums">${sign}$${parseFloat(t.amount).toFixed(2)}</span>
            </div>
        </div>`;
    });
    document.getElementById('recent-list').innerHTML = html ||
        '<p class="text-center text-zinc-600 text-sm py-8">No transactions yet</p>';
}

/* ── Overview chart (spending pace) ──────────────────────── */
let _ovChart = null;

function _renderOvChart(actualData, paceData, labels) {
    if (_ovChart) { try { _ovChart.destroy(); } catch (e) {} _ovChart = null; }
    const ctx = document.getElementById('ov-chart');
    if (!ctx) return;

    const light    = document.documentElement.classList.contains('light');
    const gridClr  = light ? 'rgba(200,200,210,0.5)' : 'rgba(63,63,70,0.5)';
    const tickClr  = light ? '#a1a1aa' : '#71717a';
    const paceClr  = light ? '#a1a1aa' : '#52525b';
    const areaClr  = 'rgba(244,63,94,0.10)';
    const ttBg     = light ? '#ffffff' : '#1c1c1f';
    const ttBorder = light ? '#e4e4e7' : '#3f3f46';
    const ttBody   = light ? '#09090b' : '#f4f4f5';
    const ttTitle  = light ? '#71717a' : '#a1a1aa';

    const lastIdx = actualData.reduce((last, v, i) => v !== null ? i : last, -1);

    const datasets = [{
        label: 'Actual',
        data: actualData,
        borderColor: '#f43f5e',
        backgroundColor: areaClr,
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: (ctx2) => ctx2.dataIndex === lastIdx ? 5 : 0,
        pointHoverRadius: 5,
        pointBackgroundColor: '#f43f5e',
        pointBorderColor: '#f43f5e',
        spanGaps: false,
    }];

    if (paceData) {
        datasets.push({
            label: 'Budget pace',
            data: paceData,
            borderColor: paceClr,
            backgroundColor: 'transparent',
            fill: false,
            tension: 0,
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 4,
        });
    }

    _ovChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: ttBg,
                    borderColor: ttBorder,
                    borderWidth: 1,
                    titleColor: ttTitle,
                    bodyColor: ttBody,
                    padding: 10,
                    cornerRadius: 10,
                    callbacks: {
                        title: (items) => 'Day ' + (items[0].dataIndex + 1),
                        label: (item) => {
                            if (item.raw === null) return null;
                            return '  ' + item.dataset.label + ': $' + Math.round(item.raw);
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { color: gridClr, lineWidth: 0.5 },
                    ticks: { color: tickClr, font: { size: 9.5 }, maxRotation: 0 },
                    border: { display: false },
                },
                y: {
                    grid: { color: gridClr, lineWidth: 0.5 },
                    ticks: {
                        color: tickClr,
                        font: { size: 9.5 },
                        callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v),
                    },
                    border: { display: false },
                    beginAtZero: true,
                },
            },
        },
    });
}
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
        btn.className = 'shrink-0 flex items-center gap-1 px-3 py-3 rounded-2xl text-xs font-semibold transition-colors ' + activeClass;
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

/* ── Main render ─────────────────────────────────── */
