/* ══════════════════════════════════════════════
   OVERVIEW — Redesigned dashboard
══════════════════════════════════════════════ */

let _ovSelectedMonth = '';

function _initOvMonth() {
    if (!_ovSelectedMonth) _ovSelectedMonth = getCurrentMonthKey();
}

function prevOvMonth() {
    _initOvMonth();
    _ovSelectedMonth = getPrevMonth(_ovSelectedMonth);
    renderOverview();
}

function nextOvMonth() {
    _initOvMonth();
    _ovSelectedMonth = getNextMonth(_ovSelectedMonth);
    renderOverview();
}

function renderOverview() {
    _initOvMonth();
    const monthKey  = _ovSelectedMonth;
    const currentMK = getCurrentMonthKey();
    const isCurrentMonth = (monthKey === currentMK);
    const today     = getCurrentDateEST();
    const [yr, mo]  = monthKey.split('-').map(Number);
    const daysInMo  = new Date(yr, mo, 0).getDate();
    const todayDay  = isCurrentMonth ? parseInt(today.slice(8), 10) : daysInMo;
    const daysLeft  = isCurrentMonth ? daysInMo - todayDay : 0;

    // ── Totals ────────────────────────────────────────────────
    const mExpPure = calculateSpentInMonth(monthKey);
    const mSavings = _calculateTotalSavingsInMonth(monthKey);
    const mExp = mExpPure + Math.max(0, mSavings);
    const mInc = transactions
        .filter(t => t.type === 'income' && !t.excluded && t.date.startsWith(monthKey))
        .reduce((s, t) => s + parseFloat(t.amount), 0);

    const _allTimeSav = _calculateTotalSavingsAllTime();
    const allExp = transactions.filter(t => t.type === 'expense' && !t.excluded)
        .reduce((s, t) => s + parseFloat(t.amount), 0)
        + Math.max(0, _allTimeSav);
    const allInc = transactions.filter(t => t.type === 'income' && !t.excluded)
        .reduce((s, t) => s + parseFloat(t.amount), 0);

    // Budget this month
    const mb = monthlyBudgets[monthKey] || {};
    let totalBudget = 0;
    Object.entries(mb).forEach(([cat, items]) => {
        if (cat === 'Income') return;
        Object.values(items || {}).forEach(v => totalBudget += v);
    });
    const hasBudget = totalBudget > 0;

    // ── Header balance ────────────────────────────────────────
    const netBal = allInc - allExp;
    const balEl  = document.getElementById('balance');
    if (balEl) {
        balEl.className = 'text-3xl font-semibold tracking-tighter mt-0.5 ' +
            (netBal >= 0 ? 'text-emerald-400' : 'text-rose-400');
        balEl.textContent = (netBal < 0 ? '-' : '') + '$' + Math.round(Math.abs(netBal));
    }

    // ── Month selector label ──────────────────────────────────
    const lbl = document.getElementById('ov-month-label');
    if (lbl) lbl.textContent = new Date(yr, mo - 1)
        .toLocaleString('default', { month: 'long', year: 'numeric' });

    const incEl = document.getElementById('total-income');
    const expEl = document.getElementById('total-expense');
    if (incEl) incEl.textContent = '$' + Math.round(mInc);
    if (expEl) expEl.textContent = '$' + Math.round(mExp);

    // ── Build cumulative daily spending array ──
    const cumActual = [];
    let running = 0;
    for (let d = 1; d <= daysInMo; d++) {
        if (d <= todayDay) {
            const dayStr = `${monthKey}-${String(d).padStart(2, '0')}`;
            running += transactions
                .filter(t => t.type === 'expense' && !t.excluded && t.date === dayStr)
                .reduce((s, t) => s + parseFloat(t.amount), 0);
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

    // ── Budget pace: linear 0 → totalBudget ────
    const budgetPace = hasBudget
        ? Array.from({ length: daysInMo }, (_, i) =>
            parseFloat(((i + 1) / daysInMo * totalBudget).toFixed(2)))
        : null;

    // ── X labels ─────────────────
    const xLabels = Array.from({ length: daysInMo }, (_, i) => {
        const d = i + 1;
        return (d === 1 || d % 5 === 0 || d === daysInMo) ? String(d) : '';
    });

    // ── Projected end-of-month spend ──────────────────────────
    let projectedEnd = null;
    if (isCurrentMonth && todayDay > 0 && mExp > 0) {
        const dailyRate = mExp / todayDay;
        projectedEnd = dailyRate * daysInMo;
    }

    // ── Track status for chart color ─────────────────────────
    // 'green' = on track, 'amber' = projected off track, 'red' = actually off track
    let trackStatus = 'green';
    if (hasBudget && todayDay > 0) {
        const expectedNow = (todayDay / daysInMo) * totalBudget;
        if (mExp > expectedNow) {
            trackStatus = 'red';
        } else if (projectedEnd !== null && projectedEnd > totalBudget) {
            trackStatus = 'amber';
        }
    }

    // ── Render chart ───────────────────────────────────────────
    _renderOvChart(cumActual, budgetPace, xLabels, projectedEnd, daysInMo, todayDay, isCurrentMonth, trackStatus);

    // ── Spent / budget header ─────────────────────────────────
    const sSpent  = document.getElementById('ov-s-spent');
    const sBudget = document.getElementById('ov-s-budget');
    if (sSpent) sSpent.textContent = '$' + Math.round(mExp).toLocaleString();
    if (sBudget) {
        sBudget.textContent = hasBudget
            ? 'of $' + Math.round(totalBudget).toLocaleString() + ' budget'
            : 'spent this month';
    }

    // ── Pace badge ─────────────────────────────────────────────
    const dayLblEl = document.getElementById('ov-day-label');
    const badgeEl  = document.getElementById('ov-pace-badge');
    if (dayLblEl) {
        dayLblEl.textContent = isCurrentMonth
            ? `Day ${todayDay} of ${daysInMo}`
            : `${daysInMo} days`;
    }
    if (badgeEl) {
        if (hasBudget && todayDay > 0) {
            const expectedNow = (todayDay / daysInMo) * totalBudget;
            const pct   = Math.round(mExp / expectedNow * 100);
            const badgeColors = {
                green: 'bg-emerald-500/15 text-emerald-400',
                amber: 'bg-amber-500/15 text-amber-400',
                red:   'bg-rose-500/15 text-rose-400',
            };
            badgeEl.className = 'text-[11px] font-bold px-2.5 py-1 rounded-full ' + badgeColors[trackStatus];
            const statusText = trackStatus === 'green' ? 'On track' :
                               trackStatus === 'amber' ? 'Projected over' : 'Over budget';
            badgeEl.textContent = pct + '% \u00B7 ' + statusText;
        } else {
            badgeEl.className = 'hidden';
        }
    }

    // ── 2-stat row ─────────────────────────────────────────────
    const remaining  = hasBudget ? Math.max(0, totalBudget - mExp) : null;
    const dailyAllow = (remaining !== null && daysLeft > 0) ? remaining / daysLeft : null;

    const sLeft   = document.getElementById('ov-s-left');
    const sDays   = document.getElementById('ov-s-days');
    const sDaily  = document.getElementById('ov-s-daily');

    if (sLeft) {
        sLeft.textContent = remaining !== null ? '$' + Math.round(remaining).toLocaleString() : '\u2014';
        sLeft.className   = 'text-2xl font-bold tracking-tight leading-none ' +
            (remaining !== null
                ? (remaining > 0 ? 'text-emerald-400' : 'text-rose-400')
                : 'text-zinc-400');
    }
    if (sDays) sDays.textContent = isCurrentMonth
        ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`
        : '';
    if (sDaily) {
        sDaily.textContent = dailyAllow !== null ? '$' + Math.round(dailyAllow).toLocaleString() : '\u2014';
        sDaily.className   = 'text-2xl font-bold tracking-tight leading-none ' +
            (dailyAllow !== null && dailyAllow > 0 ? 'text-emerald-400' : 'text-zinc-400');
    }

    // ── Top Categories ────────────────────────────────────────
    _renderOvTopCategories(monthKey);

    // ── Recent transactions (top 3, description only) ─────────
    _renderOvRecent(monthKey);
}

/* ── Top Categories horizontal scroll ─────────────────── */
function _renderOvTopCategories(monthKey) {
    const catEl = document.getElementById('ov-top-cats');
    if (!catEl) return;

    // Gather spending per main category
    const catTotals = {};
    transactions
        .filter(t => t.type === 'expense' && !t.excluded && t.date.startsWith(monthKey))
        .forEach(t => {
            const cat = t.mainCategory || 'Other';
            catTotals[cat] = (catTotals[cat] || 0) + parseFloat(t.amount);
        });

    // Sort by total descending
    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
        catEl.innerHTML = '<p class="text-zinc-600 text-xs py-2">No spending yet</p>';
        return;
    }

    const catColors = {
        Food: '#f97316', Household: '#3b82f6', Personal: '#a855f7',
        Health: '#10b981', Transportation: '#eab308', Banking: '#6366f1',
        Saving: '#14b8a6', Debt: '#ef4444'
    };

    let html = '';
    sorted.forEach(([cat, total]) => {
        const emoji = mainEmojis[cat] || '📁';
        const color = catColors[cat] || '#71717a';
        html += `<div class="shrink-0 bg-zinc-900 rounded-2xl px-4 py-3 min-w-[120px]" style="border-left:3px solid ${color}">
            <div class="text-lg mb-1">${emoji}</div>
            <p class="text-[11px] text-zinc-500 leading-tight">${cat}</p>
            <p class="text-sm font-bold tracking-tight mt-0.5">$${Math.round(total).toLocaleString()}</p>
        </div>`;
    });
    catEl.innerHTML = html;
}

/* ── Recent transactions (top 3, clean layout) ─────────── */
function _renderOvRecent(monthKey) {
    const recent = transactions.slice()
        .filter(t => t.date.startsWith(monthKey))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);

    let html = '';
    recent.forEach(t => {
        const isInc  = t.type === 'income';
        const isTrf  = t.type === 'transfer';
        let emoji, amtCls, sign, title;

        if (isTrf) {
            const fA = _getAccById(t.fromAccountId), tA = _getAccById(t.toAccountId);
            emoji  = '🔄';
            amtCls = 'text-sky-400';
            sign   = '⇄';
            title  = t.desc || ((fA ? fA.name : '?') + ' → ' + (tA ? tA.name : '?'));
        } else {
            const iconKey = t.mainCategory + ':' + (t.subCategory || '');
            emoji  = itemIcons[iconKey] || mainEmojis[t.mainCategory] || (isInc ? '💰' : '💸');
            amtCls = isInc ? 'text-emerald-400' : 'text-zinc-200';
            sign   = isInc ? '+' : '\u2212';
            title  = t.desc || (t.mainCategory + (t.subCategory ? ' · ' + t.subCategory : ''));
        }

        html += `<div class="flex items-center gap-3 py-2">
            <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">${emoji}</div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium leading-snug truncate">${title}</p>
                <p class="text-[11px] text-zinc-600 mt-0.5">${_dateLabel(t.date)}</p>
            </div>
            <span class="${amtCls} font-semibold text-sm tabular-nums">${sign}$${parseFloat(t.amount).toFixed(2)}</span>
        </div>`;
    });

    document.getElementById('recent-list').innerHTML = html ||
        '<p class="text-center text-zinc-600 text-sm py-6">No transactions yet</p>';
}

/* ── Overview chart (spending pace — hero) ──────────────── */
let _ovChart = null;

function _renderOvChart(actualData, paceData, labels, projectedEnd, daysInMo, todayDay, isCurrentMonth, trackStatus) {
    if (_ovChart) { try { _ovChart.destroy(); } catch (e) {} _ovChart = null; }
    const ctx = document.getElementById('ov-chart');
    if (!ctx) return;

    const light    = document.documentElement.classList.contains('light');
    const gridClr  = light ? 'rgba(200,200,210,0.35)' : 'rgba(63,63,70,0.35)';
    const tickClr  = light ? '#a1a1aa' : '#71717a';
    const paceClr  = light ? '#a1a1aa' : '#52525b';
    const ttBg     = light ? '#ffffff' : '#1c1c1f';
    const ttBorder = light ? '#e4e4e7' : '#3f3f46';
    const ttBody   = light ? '#09090b' : '#f4f4f5';
    const ttTitle  = light ? '#71717a' : '#a1a1aa';

    // Dynamic colors based on tracking status
    const lineColors = {
        green: '#34d399',  // emerald
        amber: '#fbbf24',  // amber
        red:   '#f87171',  // rose/red
    };
    const gradColors = {
        green: ['rgba(52,211,153,0.25)', 'rgba(52,211,153,0.02)'],
        amber: ['rgba(251,191,36,0.22)', 'rgba(251,191,36,0.02)'],
        red:   ['rgba(248,113,113,0.22)', 'rgba(248,113,113,0.02)'],
    };
    const status = trackStatus || 'green';
    const lineClr = lineColors[status];
    const [gradTop, gradBot] = gradColors[status];

    const lastIdx = actualData.reduce((last, v, i) => v !== null ? i : last, -1);

    // Gradient fill under actual spend line
    const actualGrad = ctx.getContext('2d').createLinearGradient(0, 0, 0, ctx.parentElement.offsetHeight || 300);
    actualGrad.addColorStop(0, gradTop);
    actualGrad.addColorStop(1, gradBot);

    const datasets = [{
        label: 'Actual',
        data: actualData,
        borderColor: lineClr,
        backgroundColor: actualGrad,
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: (ctx2) => ctx2.dataIndex === lastIdx ? 6 : 0,
        pointHoverRadius: 6,
        pointBackgroundColor: lineClr,
        pointBorderColor: lineClr,
        pointBorderWidth: 0,
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

    // Update legend color to match line
    const legendActual = document.getElementById('ov-legend-actual');
    if (legendActual) legendActual.style.backgroundColor = lineClr;

    // Projected line from today to end of month
    const projLegend = document.getElementById('ov-legend-proj');
    if (projectedEnd !== null && isCurrentMonth && lastIdx >= 0 && lastIdx < daysInMo - 1) {
        const projData = new Array(daysInMo).fill(null);
        projData[lastIdx] = actualData[lastIdx];
        projData[daysInMo - 1] = projectedEnd;
        datasets.push({
            label: 'Projected',
            data: projData,
            borderColor: '#fbbf24',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0,
            borderWidth: 1.5,
            borderDash: [3, 3],
            pointRadius: (ctx2) => ctx2.dataIndex === daysInMo - 1 ? 5 : 0,
            pointBackgroundColor: '#fbbf24',
            pointBorderColor: '#fbbf24',
            pointBorderWidth: 0,
            spanGaps: true,
        });
        if (projLegend) projLegend.classList.remove('hidden');
    } else {
        if (projLegend) projLegend.classList.add('hidden');
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
                    ticks: { color: tickClr, font: { size: 10 }, maxRotation: 0 },
                    border: { display: false },
                },
                y: {
                    grid: { color: gridClr, lineWidth: 0.5 },
                    ticks: {
                        color: tickClr,
                        font: { size: 10 },
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
