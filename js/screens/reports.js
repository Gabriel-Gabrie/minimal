/* ══════════════════════════════════════════════
   REPORTS — Redesigned dashboard
══════════════════════════════════════════════ */

let _rptView  = 'spending';   // 'spending' | 'income' | 'surplus'
let _rptRange = 6;            // months to show in trend

/* ── View / range setters ────────────────────── */

function setReportView(view) {
    _rptView = view;
    ['spending','income','surplus'].forEach(v => {
        const btn = document.getElementById('rv-' + v);
        if (btn) btn.className = 'flex-1 py-2 rounded-xl text-xs font-semibold transition-all ' +
            (v === view ? 'bg-zinc-700 text-white' : 'text-zinc-500');
    });
    // Show breakdown toggle only for spending
    const tog = document.getElementById('rpt-break-toggle');
    if (tog) tog.classList.toggle('hidden', view !== 'spending');
    renderReports();
}

function setReportRange(n) {
    _rptRange = n;
    _updateRangePills();
    renderReports();
}

function _updateRangePills() {
    [3,6,12].forEach(n => {
        const b = document.getElementById('rbtn-' + n);
        if (b) b.className = 'px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ' +
            (n === _rptRange ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500');
    });
}

/* ── Helper functions (shared) ──────────────── */

function _pastMonths(n) {
    n = (n !== undefined) ? n : _breakMonthCount;
    const out = [];
    let d = new Date(getCurrentDateEST());
    for (let i = 0; i < n; i++) {
        out.unshift(d.toISOString().slice(0,7));
        d.setMonth(d.getMonth() - 1);
    }
    return out;
}

function _pastMonthsTrend() {
    return _pastMonths(Math.max(3, _trendMonthCount));
}

function _getInc(m) {
    return transactions.filter(t => t.type === 'income' && !t.excluded && t.date.startsWith(m))
        .reduce((s,t) => s + parseFloat(t.amount), 0);
}
function _getExp(m) { return calculateSpentInMonth(m) + Math.max(0, _calculateTotalSavingsInMonth(m)); }

function _destroyChart(id) {
    if (_rCharts[id]) { try { _rCharts[id].destroy(); } catch(e){} delete _rCharts[id]; }
}

/* ── Chart builders ──────────────────────────── */

function _buildLineOrBar(canvasId, labels, data, color) {
    _destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const light   = document.documentElement.classList.contains('light');
    const gridClr = light ? 'rgba(200,200,210,0.35)' : 'rgba(63,63,70,0.35)';
    const tickClr = light ? '#a1a1aa' : '#71717a';
    const type = labels.length === 1 ? 'bar' : 'line';

    const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, ctx.parentElement.offsetHeight || 200);
    grad.addColorStop(0, color + '30');
    grad.addColorStop(1, color + '05');

    _rCharts[canvasId] = new Chart(ctx, {
        type,
        data: {
            labels,
            datasets: [{ data, borderColor: color, backgroundColor: type === 'line' ? grad : color + '33',
                fill: type === 'line', tension: 0.35,
                pointBackgroundColor: color, borderRadius: 4,
                borderWidth: type === 'bar' ? 0 : 2.5,
                pointRadius: type === 'line' ? 3 : 0,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 400, easing: 'easeOutQuart' },
            plugins: { legend: { display: false },
                tooltip: {
                    backgroundColor: light ? '#fff' : '#1c1c1f',
                    borderColor: light ? '#e4e4e7' : '#3f3f46',
                    borderWidth: 1,
                    titleColor: light ? '#71717a' : '#a1a1aa',
                    bodyColor: light ? '#09090b' : '#f4f4f5',
                    padding: 10, cornerRadius: 10,
                    callbacks: { label: item => '  $' + Math.round(item.raw).toLocaleString() },
                },
            },
            scales: {
                y: { grid: { color: gridClr, lineWidth: 0.5 }, ticks: { color: tickClr, font: { size: 10 },
                    callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v) }, border: { display: false }, beginAtZero: true },
                x: { grid: { color: gridClr, lineWidth: 0.5 }, ticks: { color: tickClr, font: { size: 10 } }, border: { display: false } }
            }
        }
    });
}

function _buildSurplusBar(canvasId, labels, data) {
    _destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const light   = document.documentElement.classList.contains('light');
    const gridClr = light ? 'rgba(200,200,210,0.35)' : 'rgba(63,63,70,0.35)';
    const tickClr = light ? '#a1a1aa' : '#71717a';
    _rCharts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: data.map(v => v >= 0 ? '#10b98140' : '#f43f5e40'),
                borderColor:     data.map(v => v >= 0 ? '#10b981'   : '#f43f5e'),
                borderWidth: 1.5, borderRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 400, easing: 'easeOutQuart' },
            plugins: { legend: { display: false },
                tooltip: {
                    backgroundColor: light ? '#fff' : '#1c1c1f',
                    borderColor: light ? '#e4e4e7' : '#3f3f46',
                    borderWidth: 1,
                    titleColor: light ? '#71717a' : '#a1a1aa',
                    bodyColor: light ? '#09090b' : '#f4f4f5',
                    padding: 10, cornerRadius: 10,
                    callbacks: { label: item => {
                        const v = item.raw;
                        return '  ' + (v >= 0 ? '+' : '\u2212') + '$' + Math.round(Math.abs(v)).toLocaleString();
                    }},
                },
            },
            scales: {
                y: { grid: { color: gridClr, lineWidth: 0.5 }, ticks: { color: tickClr, font: { size: 10 },
                    callback: v => (v >= 0 ? '' : '-') + '$' + Math.abs(v) }, border: { display: false } },
                x: { grid: { color: gridClr, lineWidth: 0.5 }, ticks: { color: tickClr, font: { size: 10 } }, border: { display: false } }
            }
        }
    });
}

function _buildDoughnut(canvasId, labels, values, colors) {
    _destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const light = document.documentElement.classList.contains('light');
    const total = values.reduce((s,v) => s+v, 0);
    _rCharts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors,
            borderColor: light ? '#ffffff' : '#18181b', borderWidth: 3, hoverOffset: 6 }] },
        options: {
            cutout: '68%',
            animation: { duration: 400, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: {
                    label: ctx2 => ' ' + ctx2.label + '  $' + Math.round(ctx2.parsed)
                        + '  (' + (total > 0 ? (ctx2.parsed/total*100).toFixed(1) : 0) + '%)'
                }}
            }
        }
    });
}

function _buildStackedBar(canvasId, labels, datasets) {
    _destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const light   = document.documentElement.classList.contains('light');
    const gridClr = light ? 'rgba(200,200,210,0.35)' : 'rgba(63,63,70,0.35)';
    const tickClr = light ? '#a1a1aa' : '#71717a';
    _rCharts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 400, easing: 'easeOutQuart' },
            plugins: { legend: { display: false } },
            scales: {
                x: { stacked: true, grid: { color: gridClr, lineWidth: 0.5 }, ticks: { color: tickClr, font: { size: 10 } }, border: { display: false } },
                y: { stacked: true, grid: { color: gridClr, lineWidth: 0.5 }, ticks: { color: tickClr, font: { size: 10 },
                    callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v) }, border: { display: false } }
            }
        }
    });
}

/* ── Stats & legend renderers ────────────────── */

function _renderStats(elId, data, color) {
    const el = document.getElementById(elId);
    if (!el) return;
    const abs  = data.map(Math.abs);
    const tot  = abs.reduce((s,v)=>s+v, 0);
    const avg  = abs.length ? tot/abs.length : 0;
    const peak = abs.length ? Math.max(...abs) : 0;
    const fmt  = v => v >= 1000 ? '$'+(v/1000).toFixed(1)+'k' : '$'+v.toFixed(0);
    el.innerHTML = [['Total', fmt(tot)], ['Monthly Avg', fmt(avg)], ['Peak', fmt(peak)]]
        .map(([l,v]) => `<div class="bg-zinc-900 rounded-2xl px-4 py-3 text-center">
            <div class="text-[9px] font-black tracking-[.12em] text-zinc-600 uppercase mb-1">${l}</div>
            <div class="text-lg font-bold tracking-tight" style="color:${color}">${v}</div>
        </div>`).join('');
}

function _renderLegend(elId, labels, values, colors) {
    const el = document.getElementById(elId);
    if (!el) return;
    const total = (values || []).reduce((s,v) => s+v, 0);
    el.innerHTML = labels.map((l, i) => {
        const pct  = (total > 0 && values) ? (values[i]/total*100).toFixed(1) + '%' : '';
        const amt  = values ? '$' + Math.round(values[i]).toLocaleString() : '';
        return `<div class="flex items-center gap-2 py-1">
            <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${colors[i]}"></div>
            <span class="text-xs text-zinc-400 flex-1 truncate">${l}</span>
            ${pct ? `<span class="text-[11px] text-zinc-600 tabular-nums">${pct}</span>` : ''}
            ${amt ? `<span class="text-xs font-medium text-zinc-300 tabular-nums text-right">${amt}</span>` : ''}
        </div>`;
    }).join('');
}

function _renderMonthList(elId, pastMonths, mode) {
    const el = document.getElementById(elId);
    if (!el) return;
    let html = '';
    pastMonths.slice().reverse().forEach(m => {
        const inc = _getInc(m), exp = _getExp(m), surplus = inc - exp;
        const monthBudget = monthlyBudgets[m] || {};
        let totalBud = 0;
        Object.values(monthBudget).forEach(cat => Object.values(cat||{}).forEach(b => totalBud += b));
        const util = totalBud > 0 ? Math.round(exp/totalBud*100) : 0;

        let val, sub, barColor, valColor;
        if (mode === 'spending') {
            val = '$' + Math.round(exp).toLocaleString();
            sub = totalBud > 0 ? util + '% of budget' : 'No budget set';
            barColor = util > 100 ? '#ef4444' : util > 80 ? '#f59e0b' : '#10b981';
            valColor = util > 100 ? 'text-rose-400' : util > 80 ? 'text-amber-400' : 'text-zinc-200';
        } else if (mode === 'income') {
            val = '$' + Math.round(inc).toLocaleString();
            sub = exp > 0 ? 'Spent $' + Math.round(exp).toLocaleString() : 'No expenses';
            barColor = '#10b981'; valColor = 'text-emerald-400';
        } else {
            val = (surplus >= 0 ? '+' : '\u2212') + '$' + Math.round(Math.abs(surplus)).toLocaleString();
            sub = '\u2191$' + Math.round(inc).toLocaleString() + '  \u2193$' + Math.round(exp).toLocaleString();
            barColor = surplus >= 0 ? '#10b981' : '#ef4444';
            valColor = surplus >= 0 ? 'text-emerald-400' : 'text-rose-400';
        }
        html += `<div class="flex items-stretch bg-zinc-900 rounded-2xl overflow-hidden">
            <div style="width:3px;background:${barColor};flex-shrink:0;margin:8px 0 8px 8px;border-radius:2px"></div>
            <div class="flex-1 px-4 py-3 flex justify-between items-center">
                <div class="font-medium text-sm">${formatMonthName(m)}</div>
                <div class="text-right">
                    <div class="${valColor} font-semibold text-sm tabular-nums">${val}</div>
                    <div class="text-[10px] text-zinc-600 mt-0.5">${sub}</div>
                </div>
            </div>
        </div>`;
    });
    el.innerHTML = html || '<p class="text-center text-zinc-600 text-sm py-6">No data yet</p>';
}

/* ── Breakdown data builders ─────────────────── */

function _spendBreakData(month) {
    if (_breakdownMode === 'category') {
        const pairs = Object.keys(expenseCategories)
            .map((cat, i) => ({ cat, val: calculateSpentInMonth(month, cat), i }))
            .filter(x => x.val > 0)
            .sort((a, b) => b.val - a.val);
        let ci = pairs.length;
        ['Saving', 'Debt'].forEach(secType => {
            const val = walletAccounts.filter(a => a.type === secType.toLowerCase())
                .reduce((s, acc) => s + Math.max(0, _calculateTransferToAccount(month, acc.id)), 0);
            if (val > 0) pairs.push({ cat: secType, val, i: ci++ });
        });
        pairs.sort((a, b) => b.val - a.val);
        return { labels: pairs.map(x=>x.cat), values: pairs.map(x=>x.val), colors: pairs.map(x=>_catColor(x.cat, x.i)) };
    } else {
        const entries = [];
        Object.entries(expenseCategories).forEach(([cat, items]) => {
            (items || []).forEach(item => {
                const v = calculateSpentInMonth(month, cat, item);
                if (v > 0) entries.push({ label: item, v, color: _catColor(cat, entries.length) });
            });
        });
        ['Saving', 'Debt'].forEach(secType => {
            walletAccounts.filter(a => a.type === secType.toLowerCase()).forEach(acc => {
                const v = Math.max(0, _calculateTransferToAccount(month, acc.id));
                if (v > 0) entries.push({ label: acc.name, v, color: _catColor(secType, entries.length) });
            });
        });
        entries.sort((a, b) => b.v - a.v);
        return { labels: entries.map(x=>x.label), values: entries.map(x=>x.v), colors: entries.map(x=>x.color) };
    }
}

function _spendBreakDatasets(months) {
    if (_breakdownMode === 'category') {
        const ds = Object.keys(expenseCategories).map((cat, i) => ({
            label: cat,
            data: months.map(m => calculateSpentInMonth(m, cat)),
            backgroundColor: _catColor(cat, i),
            borderWidth: 0, borderRadius: 4, stack: 'spend'
        }));
        let ci = ds.length;
        ['Saving', 'Debt'].forEach(secType => {
            const data = months.map(m => walletAccounts.filter(a => a.type === secType.toLowerCase())
                .reduce((s, acc) => s + Math.max(0, _calculateTransferToAccount(m, acc.id)), 0));
            if (data.some(v => v > 0)) {
                ds.push({ label: secType, data, backgroundColor: _catColor(secType, ci++),
                    borderWidth: 0, borderRadius: 4, stack: 'spend' });
            }
        });
        return ds.filter(d => d.data.some(v => v > 0))
            .sort((a, b) => b.data.reduce((s,v)=>s+v,0) - a.data.reduce((s,v)=>s+v,0));
    } else {
        const datasets = [];
        let ci = 0;
        Object.entries(expenseCategories).forEach(([cat, items]) => {
            (items || []).forEach(item => {
                const data = months.map(m => calculateSpentInMonth(m, cat, item));
                if (data.some(v => v > 0)) {
                    datasets.push({ label: item, data, backgroundColor: _catColor(cat, ci),
                        borderWidth: 0, borderRadius: 4, stack: 'spend' });
                    ci++;
                }
            });
        });
        ['Saving', 'Debt'].forEach(secType => {
            walletAccounts.filter(a => a.type === secType.toLowerCase()).forEach(acc => {
                const data = months.map(m => Math.max(0, _calculateTransferToAccount(m, acc.id)));
                if (data.some(v => v > 0)) {
                    datasets.push({ label: acc.name, data, backgroundColor: _catColor(secType, ci++),
                        borderWidth: 0, borderRadius: 4, stack: 'spend' });
                }
            });
        });
        return datasets.sort((a, b) => b.data.reduce((s,v)=>s+v,0) - a.data.reduce((s,v)=>s+v,0));
    }
}

function _incBreakDatasets(months) {
    return incomeCats.map((cat, i) => ({
        label: cat,
        data: months.map(m => transactions.filter(t =>
            t.type === 'income' && !t.excluded && t.date.startsWith(m) && t.mainCategory === cat)
            .reduce((s,t) => s + parseFloat(t.amount), 0)),
        backgroundColor: _FB_COLORS[i % _FB_COLORS.length],
        borderWidth: 0, borderRadius: 4, stack: 'inc'
    }))
    .filter(ds => ds.data.some(v => v > 0))
    .sort((a, b) => b.data.reduce((s,v)=>s+v,0) - a.data.reduce((s,v)=>s+v,0));
}

/* ── Breakdown card renderer ─────────────────── */

function _renderBreakdownCard(cardId) {
    const months = _pastMonths();
    const labels = months.map(m => formatMonthShort(m));
    const canvas = document.getElementById('rchart-' + cardId);

    if (cardId === 'spendBreak') {
        if (_breakMonthCount === 1) {
            if (canvas) { canvas.height = 200; canvas.width = 200; canvas.style.maxWidth='200px'; canvas.style.margin='0 auto'; canvas.style.display='block'; }
            const d = _spendBreakData(months[0]);
            _buildDoughnut('rchart-spendBreak', d.labels, d.values, d.colors);
            _renderLegend('rlegend-spendBreak', d.labels, d.values, d.colors);
        } else {
            if (canvas) { canvas.height = 200; canvas.style.maxWidth=''; canvas.style.margin=''; canvas.style.display=''; }
            const ds = _spendBreakDatasets(months);
            _buildStackedBar('rchart-spendBreak', labels, ds);
            const uniq = ds.map(d => ({ label: d.label, color: d.backgroundColor }));
            _renderLegend('rlegend-spendBreak', uniq.map(u=>u.label), null, uniq.map(u=>u.color));
        }
    } else if (cardId === 'incBreak') {
        if (_breakMonthCount === 1) {
            if (canvas) { canvas.height = 200; canvas.width = 200; canvas.style.maxWidth='200px'; canvas.style.margin='0 auto'; canvas.style.display='block'; }
            const m = months[0];
            const vals = incomeCats.map(cat => transactions.filter(t =>
                t.type==='income' && !t.excluded && t.date.startsWith(m) && t.mainCategory===cat)
                .reduce((s,t)=>s+parseFloat(t.amount),0));
            const filtered = incomeCats.map((l,i) => ({ l, v: vals[i], c: _FB_COLORS[i%_FB_COLORS.length] }))
                .filter(x => x.v > 0);
            _buildDoughnut('rchart-incBreak', filtered.map(x=>x.l), filtered.map(x=>x.v), filtered.map(x=>x.c));
            _renderLegend('rlegend-incBreak', filtered.map(x=>x.l), filtered.map(x=>x.v), filtered.map(x=>x.c));
        } else {
            if (canvas) { canvas.height = 200; canvas.style.maxWidth=''; canvas.style.margin=''; canvas.style.display=''; }
            const ds = _incBreakDatasets(months);
            _buildStackedBar('rchart-incBreak', labels, ds);
            _renderLegend('rlegend-incBreak', ds.map(d=>d.label), null, ds.map(d=>d.backgroundColor));
        }
    }
}

/* ══════════════════════════════════════════════
   MAIN RENDER
══════════════════════════════════════════════ */

function renderReports() {
    _updateRangePills();
    _updateReportPills();

    const months = _pastMonths(_rptRange);
    const labels = months.map(m => formatMonthShort(m));

    const view = _rptView;
    const viewColors = { spending: '#f87171', income: '#34d399', surplus: '#38bdf8' };
    const color = viewColors[view];

    // Data for trend
    let data;
    if (view === 'spending') {
        data = months.map(m => _getExp(m));
    } else if (view === 'income') {
        data = months.map(m => _getInc(m));
    } else {
        data = months.map(m => _getInc(m) - _getExp(m));
    }

    // ── Hero amount ──────────────────────────────────
    const heroAmt = document.getElementById('rpt-hero-amount');
    const heroSub = document.getElementById('rpt-hero-sub');
    const total   = data.reduce((s,v) => s + Math.abs(v), 0);
    const avg     = data.length ? total / data.length : 0;
    const fmt     = v => '$' + Math.round(v).toLocaleString();

    if (heroAmt) {
        const heroColors = { spending: 'text-rose-400', income: 'text-emerald-400', surplus: 'text-sky-400' };
        heroAmt.className = 'text-3xl font-bold tracking-tight leading-none text-center ' + heroColors[view];
        if (view === 'surplus') {
            const net = data.reduce((s,v) => s + v, 0);
            heroAmt.textContent = (net >= 0 ? '+' : '\u2212') + '$' + Math.round(Math.abs(net)).toLocaleString();
        } else {
            heroAmt.textContent = fmt(total);
        }
    }
    if (heroSub) {
        const rangeLabel = _rptRange + '-month ' + (view === 'surplus' ? 'net' : 'total');
        heroSub.textContent = rangeLabel + '  \u00B7  avg ' + fmt(avg) + '/mo';
    }

    // ── Trend chart ──────────────────────────────────
    if (view === 'surplus') {
        _buildSurplusBar('rpt-trend-chart', labels, data);
    } else {
        _buildLineOrBar('rpt-trend-chart', labels, data, color);
    }

    // ── Stats row ────────────────────────────────────
    _renderStats('rpt-stats', data, color);

    // ── Month list ───────────────────────────────────
    _renderMonthList('rpt-month-list', months, view);

    // ── Spending breakdown ───────────────────────────
    _renderBreakdownCard('spendBreak');
}


/* ── Legacy shims — kept for safety ────────── */
function renderAllReports() { renderReports(); }
function updateReportControls() {}
function _renderOpenCard(id) {
    if      (id === 'spendBreak') _renderBreakdownCard('spendBreak');
    else if (id === 'incBreak')   _renderBreakdownCard('incBreak');
}


// ── Tab long-press: set home screen ─────────────────
let _tabHoldTimer = null;

function _tabTap(n) {
    _tabHoldEnd();
    switchTab(n);
}

function _tabHoldStart(n, el) {
    _tabHoldEnd();
    _tabHoldTimer = setTimeout(() => {
        _tabHoldTimer = null;
        setLaunchTab(n);
        // Show tooltip briefly
        const tip = document.getElementById('tab-home-tip');
        if (tip && el) {
            const r = el.getBoundingClientRect();
            tip.style.left  = (r.left + r.width / 2) + 'px';
            tip.style.top   = (r.top - 42) + 'px';
            tip.classList.remove('hidden');
            if (navigator.vibrate) navigator.vibrate(30);
            setTimeout(() => tip.classList.add('hidden'), 1400);
        }
    }, 500);
}

function _tabHoldEnd() {
    if (_tabHoldTimer) { clearTimeout(_tabHoldTimer); _tabHoldTimer = null; }
}

function switchTab(n) {
    document.querySelectorAll('[id^="screen-"]').forEach(s => s.classList.add('hidden'));
    document.getElementById(`screen-${n}`).classList.remove('hidden');
    document.querySelectorAll('[id^="tab-"]').forEach(t => {
        t.classList.remove('tab-active');
        t.classList.add('text-zinc-500');
        t.classList.remove('text-white');
    });
    const active = document.getElementById(`tab-${n}`);
    active.classList.add('tab-active');
    active.classList.remove('text-zinc-500');
    active.classList.add('text-white');
    [renderOverview, renderTransactions, renderBudgets, renderWallet, renderReports][n]?.();
}

function prevBudgetMonth() {
    selectedBudgetMonth = getPrevMonth(selectedBudgetMonth);
    renderBudgets();
}

function nextBudgetMonth() {
    selectedBudgetMonth = getNextMonth(selectedBudgetMonth);
    renderBudgets();
}

function copyFromPreviousMonth() {
    const prev = getPrevMonth(selectedBudgetMonth);
    if (monthlyBudgets[prev]) {
        if (confirm(`Copy budgets from ${formatMonthName(prev)}?`)) {
            monthlyBudgets[selectedBudgetMonth] = JSON.parse(JSON.stringify(monthlyBudgets[prev]));
            saveData();
            renderBudgets();
        }
    } else alert("No previous month budgets to copy.");
}

let _aimMain = null, _aimSelectedIcon = null;

function addBudgetItemToMain(main) {
    openAddItemModal(main);
}

function openAddItemModal(main) {
    _aimMain = main;
    _aimSelectedIcon = null;

    const catEl = document.getElementById('aim-cat-label');
    if (catEl) catEl.textContent = main;

    const iconEl = document.getElementById('aim-hdr-icon');
    const defaultIcon = main === 'Income' ? '💵' : '💸';
    if (iconEl) iconEl.textContent = defaultIcon;

    const nameEl = document.getElementById('aim-name-input');
    if (nameEl) { nameEl.value = ''; }

    const amtEl = document.getElementById('aim-amount-input');
    if (amtEl) { amtEl.value = ''; }

    const pickerEl = document.getElementById('aim-icon-picker');
    if (pickerEl) pickerEl.classList.add('hidden');

    const grid = document.getElementById('aim-icon-grid');
    if (grid) {
        grid.innerHTML = BUDGET_ICONS.map(e =>
            `<button type="button" onclick="_aimSelectIcon('${e}')"
                class="text-xl w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition-all hover:bg-zinc-700">${e}</button>`
        ).join('');
    }

    document.getElementById('add-budget-item-modal').classList.remove('hidden');
    setTimeout(() => { const n = document.getElementById('aim-name-input'); if (n) n.focus(); }, 80);
}

function closeAddItemModal() {
    document.getElementById('add-budget-item-modal').classList.add('hidden');
    _aimMain = null; _aimSelectedIcon = null;
    _aimEditingMain = null; _aimEditingSub = null;
    // Reset button text
    const addBtn = document.querySelector('#add-budget-item-modal button[onclick="_aimConfirm()"]');
    if (addBtn) addBtn.textContent = 'Add Category';
}

function _aimBackdrop(e) {
    if (e.target === document.getElementById('add-budget-item-modal')) closeAddItemModal();
}

function _aimToggleIconPicker() {
    const picker = document.getElementById('aim-icon-picker');
    if (picker) picker.classList.toggle('hidden');
}

function _aimSelectIcon(emoji) {
    _aimSelectedIcon = emoji;
    const iconEl = document.getElementById('aim-hdr-icon');
    if (iconEl) iconEl.textContent = emoji;
    document.querySelectorAll('#aim-icon-grid button').forEach(btn => {
        const isSelected = btn.textContent === emoji;
        btn.className = 'text-xl w-8 h-8 flex items-center justify-center rounded-xl active:scale-90 transition-all '
            + (isSelected ? 'bg-zinc-700 ring-2 ring-emerald-500' : 'hover:bg-zinc-700');
    });
    const picker = document.getElementById('aim-icon-picker');
    if (picker) picker.classList.add('hidden');
}

function _aimFocusAmount() {
    const el = document.getElementById('aim-amount-input');
    if (el) el.focus();
}

function _aimConfirm() {
    const editMain = _aimEditingMain;
    const editSub  = _aimEditingSub;
    const main = editMain || _aimMain;
    if (!main) return;
    const nameEl = document.getElementById('aim-name-input');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) { if (nameEl) nameEl.focus(); return; }

    const amtEl = document.getElementById('aim-amount-input');
    const planned = amtEl ? parseFloat(amtEl.value) || 0 : 0;

    if (editSub) {
        // Edit mode: rename if needed, update amount and icon
        if (name !== editSub) {
            if ((expenseCategories[main] || []).includes(name)) {
                if (nameEl) { nameEl.focus(); nameEl.select(); }
                return;
            }
            const idx = (expenseCategories[main] || []).indexOf(editSub);
            if (idx >= 0) expenseCategories[main][idx] = name;
            Object.keys(monthlyBudgets).forEach(m => {
                if (monthlyBudgets[m][main] && monthlyBudgets[m][main][editSub] !== undefined) {
                    monthlyBudgets[m][main][name] = monthlyBudgets[m][main][editSub];
                    delete monthlyBudgets[m][main][editSub];
                }
            });
            transactions.forEach(t => {
                if (t.mainCategory === main && t.subCategory === editSub) t.subCategory = name;
                if (main === 'Income' && t.type === 'income' && t.mainCategory === editSub) t.mainCategory = name;
            });
            if (itemIcons[`${main}:${editSub}`]) {
                itemIcons[`${main}:${name}`] = itemIcons[`${main}:${editSub}`];
                delete itemIcons[`${main}:${editSub}`];
            }
        }
        if (!monthlyBudgets[selectedBudgetMonth]) monthlyBudgets[selectedBudgetMonth] = {};
        if (!monthlyBudgets[selectedBudgetMonth][main]) monthlyBudgets[selectedBudgetMonth][main] = {};
        monthlyBudgets[selectedBudgetMonth][main][name] = planned;
        if (_aimSelectedIcon) itemIcons[`${main}:${name}`] = _aimSelectedIcon;
    } else {
        // Add mode
        if ((expenseCategories[main] || []).includes(name)) {
            if (nameEl) { nameEl.focus(); nameEl.select(); }
            return;
        }
        if (!expenseCategories[main]) expenseCategories[main] = [];
        expenseCategories[main].push(name);
        if (_aimSelectedIcon) itemIcons[`${main}:${name}`] = _aimSelectedIcon;
        if (!monthlyBudgets[selectedBudgetMonth]) monthlyBudgets[selectedBudgetMonth] = {};
        if (!monthlyBudgets[selectedBudgetMonth][main]) monthlyBudgets[selectedBudgetMonth][main] = {};
        monthlyBudgets[selectedBudgetMonth][main][name] = planned;
    }

    _aimEditingMain = null;
    _aimEditingSub = null;
    _syncIncomeCats();
    saveData();
    closeAddItemModal();
    renderBudgets();
}

function deleteBudgetItem(main, sub) {
    if (confirm(`Delete category "${sub}" from ${main}?
Transactions using it will stay.`)) {
        expenseCategories[main] = expenseCategories[main].filter(s => s !== sub);
        Object.keys(monthlyBudgets).forEach(k => {
            if (monthlyBudgets[k] && monthlyBudgets[k][main]) delete monthlyBudgets[k][main][sub];
        });
        delete itemIcons[`${main}:${sub}`];
        saveData();
        renderBudgets();
    }
}
