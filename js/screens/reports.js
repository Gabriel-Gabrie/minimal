function renderAllReports() {
    _updateReportPills();
    // Render all open cards
    Object.keys(_rCardOpen).forEach(id => {
        if (_rCardOpen[id]) _renderOpenCard(id);
    });
}

// ── Helpers ─────────────────────────────────────────────────────────
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

function _buildLineOrBar(canvasId, labels, data, color) {
    _destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const type = labels.length === 1 ? 'bar' : 'line';
    _rCharts[canvasId] = new Chart(ctx, {
        type,
        data: {
            labels,
            datasets: [{ data, borderColor: color, backgroundColor: color + '33',
                fill: type === 'line', tension: 0.35,
                pointBackgroundColor: color, borderRadius: 4,
                borderWidth: type === 'bar' ? 0 : 2 }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color:'#27272a' }, ticks: { color:'#71717a', callback: v => '$'+Math.abs(v) } },
                x: { grid: { color:'#27272a' }, ticks: { color:'#71717a' } }
            }
        }
    });
}

function _buildSurplusBar(canvasId, labels, data) {
    _destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    _rCharts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: data.map(v => v >= 0 ? '#10b98166' : '#f43f5e66'),
                borderColor:     data.map(v => v >= 0 ? '#10b981'   : '#f43f5e'),
                borderWidth: 1.5, borderRadius: 4
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color:'#27272a' }, ticks: { color:'#71717a', callback: v => '$'+v } },
                x: { grid: { color:'#27272a' }, ticks: { color:'#71717a' } }
            }
        }
    });
}

function _buildDoughnut(canvasId, labels, values, colors) {
    _destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    // Total for centre label
    const total = values.reduce((s,v) => s+v, 0);
    _rCharts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors,
            borderColor: '#18181b', borderWidth: 3, hoverOffset: 6 }] },
        options: {
            cutout: '68%',
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: {
                    label: ctx => ' ' + ctx.label + '  $' + Math.round(ctx.parsed)
                        + '  (' + (total > 0 ? (ctx.parsed/total*100).toFixed(1) : 0) + '%)'
                }}
            }
        }
    });
}

function _buildStackedBar(canvasId, labels, datasets) {
    _destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    _rCharts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { stacked: true, grid: { color:'#27272a' }, ticks: { color:'#71717a' } },
                y: { stacked: true, grid: { color:'#27272a' }, ticks: { color:'#71717a', callback: v => '$'+v } }
            }
        }
    });
}

function _renderStats(elId, data, color) {
    const el = document.getElementById(elId);
    if (!el) return;
    const abs  = data.map(Math.abs);
    const tot  = abs.reduce((s,v)=>s+v, 0);
    const avg  = abs.length ? tot/abs.length : 0;
    const peak = abs.length ? Math.max(...abs) : 0;
    const fmt  = v => v >= 1000 ? '$'+(v/1000).toFixed(1)+'k' : '$'+v.toFixed(0);
    el.innerHTML = [['Total', fmt(tot)], ['Monthly Avg', fmt(avg)], ['Peak', fmt(peak)]]
        .map(([l,v]) => `<div class="bg-zinc-800/60 rounded-2xl p-3 text-center">
            <div class="text-[9px] font-black tracking-[.12em] text-zinc-600 uppercase mb-1">${l}</div>
            <div class="text-base font-semibold tracking-tight" style="color:${color}">${v}</div>
        </div>`).join('');
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
        if (mode === 'expense') {
            val = '$' + Math.round(exp);
            sub = totalBud > 0 ? util + '% of budget' : 'No budget set';
            barColor = util > 100 ? '#ef4444' : util > 80 ? '#f59e0b' : '#10b981';
            valColor = util > 100 ? 'text-rose-400' : util > 80 ? 'text-amber-400' : 'text-zinc-200';
        } else if (mode === 'income') {
            val = '$' + Math.round(inc);
            sub = exp > 0 ? 'Spent $' + Math.round(exp) : 'No expenses';
            barColor = '#10b981'; valColor = 'text-emerald-400';
        } else {
            val = (surplus >= 0 ? '+' : '−') + '$' + Math.round(Math.abs(surplus));
            sub = '↑$' + Math.round(inc) + '  ↓$' + Math.round(exp);
            barColor = surplus >= 0 ? '#10b981' : '#ef4444';
            valColor = surplus >= 0 ? 'text-emerald-400' : 'text-rose-400';
        }
        html += `<div class="flex items-stretch bg-zinc-800/60 rounded-2xl overflow-hidden">
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

// ── Trend card renderers ─────────────────────────────────────────────
function _renderTrendCard(cardId, mode) {
    const months = _pastMonthsTrend();
    const labels = months.map(m => formatMonthShort(m));
    const data   = months.map(m => mode === 'income' ? _getInc(m) : _getExp(m));
    const color  = mode === 'income' ? '#10b981' : '#f43f5e';
    const canvas = document.getElementById('rchart-' + cardId);
    if (canvas) canvas.height = 160;
    _buildLineOrBar('rchart-' + cardId, labels, data, color);
    _renderStats('rstats-' + cardId, data, color);
}

function _renderSurplusCard() {
    const months = _pastMonthsTrend();
    const labels = months.map(m => formatMonthShort(m));
    const data   = months.map(m => _getInc(m) - _getExp(m));
    const canvas = document.getElementById('rchart-surplus');
    if (canvas) canvas.height = 160;
    _buildSurplusBar('rchart-surplus', labels, data);
    _renderStats('rstats-surplus', data, '#38bdf8');
}

// ── Breakdown card renderers ─────────────────────────────────────────
function _spendBreakData(month) {
    // Returns { labels, values, colors } for a single month
    if (_breakdownMode === 'category') {
        const pairs = Object.keys(expenseCategories)
            .map((cat, i) => ({ cat, val: calculateSpentInMonth(month, cat), i }))
            .filter(x => x.val > 0)
            .sort((a, b) => b.val - a.val);
        // Add Saving/Debt as sections
        let ci = pairs.length;
        ['Saving', 'Debt'].forEach(secType => {
            const val = walletAccounts.filter(a => a.type === secType.toLowerCase())
                .reduce((s, acc) => s + Math.max(0, _calculateTransferToAccount(month, acc.id)), 0);
            if (val > 0) pairs.push({ cat: secType, val, i: ci++ });
        });
        pairs.sort((a, b) => b.val - a.val);
        return { labels: pairs.map(x=>x.cat), values: pairs.map(x=>x.val), colors: pairs.map(x=>_catColor(x.cat, x.i)) };
    } else {
        // By category — collect all then sort
        const entries = [];
        Object.entries(expenseCategories).forEach(([cat, items]) => {
            (items || []).forEach(item => {
                const v = calculateSpentInMonth(month, cat, item);
                if (v > 0) entries.push({ label: item, v, color: _catColor(cat, entries.length) });
            });
        });
        // Add individual saving/debt accounts
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
            borderWidth: 0, borderRadius: 2, stack: 'spend'
        }));
        // Add Saving/Debt sections
        let ci = ds.length;
        ['Saving', 'Debt'].forEach(secType => {
            const data = months.map(m => walletAccounts.filter(a => a.type === secType.toLowerCase())
                .reduce((s, acc) => s + Math.max(0, _calculateTransferToAccount(m, acc.id)), 0));
            if (data.some(v => v > 0)) {
                ds.push({ label: secType, data, backgroundColor: _catColor(secType, ci++),
                    borderWidth: 0, borderRadius: 2, stack: 'spend' });
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
                        borderWidth: 0, borderRadius: 2, stack: 'spend' });
                    ci++;
                }
            });
        });
        // Add individual saving/debt accounts
        ['Saving', 'Debt'].forEach(secType => {
            walletAccounts.filter(a => a.type === secType.toLowerCase()).forEach(acc => {
                const data = months.map(m => Math.max(0, _calculateTransferToAccount(m, acc.id)));
                if (data.some(v => v > 0)) {
                    datasets.push({ label: acc.name, data, backgroundColor: _catColor(secType, ci++),
                        borderWidth: 0, borderRadius: 2, stack: 'spend' });
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
        borderWidth: 0, borderRadius: 2, stack: 'inc'
    }))
    .filter(ds => ds.data.some(v => v > 0))
    .sort((a, b) => b.data.reduce((s,v)=>s+v,0) - a.data.reduce((s,v)=>s+v,0));
}

function _renderLegend(elId, labels, values, colors) {
    const el = document.getElementById(elId);
    if (!el) return;
    const total = (values || []).reduce((s,v) => s+v, 0);
    el.innerHTML = labels.map((l, i) => {
        const pct  = (total > 0 && values) ? (values[i]/total*100).toFixed(1) + '%' : '';
        const amt  = values ? '$' + Math.round(values[i]) : '';
        return `<div class="flex items-center gap-2 py-0.5">
            <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${colors[i]}"></div>
            <span class="text-xs text-zinc-400 flex-1 truncate">${l}</span>
            ${pct ? `<span class="text-xs text-zinc-600 tabular-nums">${pct}</span>` : ''}
            ${amt ? `<span class="text-xs text-zinc-400 tabular-nums text-right">${amt}</span>` : ''}
        </div>`;
    }).join('');
}

function _renderBreakdownCard(cardId) {
    const months = _pastMonths();
    const labels = months.map(m => formatMonthShort(m));
    const canvas = document.getElementById('rchart-' + cardId);

    if (cardId === 'spendBreak') {
        if (_breakMonthCount === 1) {
            // Ring chart
            if (canvas) { canvas.height = 220; canvas.width = 220; canvas.style.maxWidth='220px'; canvas.style.margin='0 auto'; canvas.style.display='block'; }
            const d = _spendBreakData(months[0]);
            _buildDoughnut('rchart-spendBreak', d.labels, d.values, d.colors);
            _renderLegend('rlegend-spendBreak', d.labels, d.values, d.colors);
        } else {
            if (canvas) { canvas.height = 220; canvas.style.maxWidth=''; canvas.style.margin=''; canvas.style.display=''; }
            const ds = _spendBreakDatasets(months);
            _buildStackedBar('rchart-spendBreak', labels, ds);
            const uniq = ds.map(d => ({ label: d.label, color: d.backgroundColor }));
            _renderLegend('rlegend-spendBreak', uniq.map(u=>u.label), null, uniq.map(u=>u.color));
        }
    } else if (cardId === 'incBreak') {
        if (_breakMonthCount === 1) {
            if (canvas) { canvas.height = 220; canvas.width = 220; canvas.style.maxWidth='220px'; canvas.style.margin='0 auto'; canvas.style.display='block'; }
            // Single month income by type
            const m = months[0];
            const vals = incomeCats.map(cat => transactions.filter(t =>
                t.type==='income' && !t.excluded && t.date.startsWith(m) && t.mainCategory===cat)
                .reduce((s,t)=>s+parseFloat(t.amount),0));
            const filtered = incomeCats.map((l,i) => ({ l, v: vals[i], c: _FB_COLORS[i%_FB_COLORS.length] }))
                .filter(x => x.v > 0);
            _buildDoughnut('rchart-incBreak', filtered.map(x=>x.l), filtered.map(x=>x.v), filtered.map(x=>x.c));
            _renderLegend('rlegend-incBreak', filtered.map(x=>x.l), filtered.map(x=>x.v), filtered.map(x=>x.c));
        } else {
            if (canvas) { canvas.height = 220; canvas.style.maxWidth=''; canvas.style.margin=''; canvas.style.display=''; }
            const ds = _incBreakDatasets(months);
            _buildStackedBar('rchart-incBreak', labels, ds);
            _renderLegend('rlegend-incBreak', ds.map(d=>d.label), null, ds.map(d=>d.backgroundColor));
        }
    }
}

function updateReportControls() {} // kept as no-op for safety


function renderReports() {
    updateReportControls();

    const pastMonths = [];
    let d = new Date(getCurrentDateEST());
    for (let i = 0; i < _breakMonthCount; i++) {
        const key = d.toISOString().slice(0,7);
        pastMonths.unshift(key);
        d.setMonth(d.getMonth() - 1);
    }

    const meta = REPORT_META[selectedReport];

    const labels = pastMonths.map(m => formatMonthShort(m));

    const getInc = m => transactions.filter(t => t.type==='income' && t.date.startsWith(m)).reduce((s,t)=>s+parseFloat(t.amount),0);
    const getExp = m => calculateSpentInMonth(m);

    let chartData, chartType, chartDatasets;

    if (selectedReport === 'spending' || selectedReport === 'expense') {
        chartType = 'line';
        chartData = pastMonths.map(m => getExp(m));
        chartDatasets = [{ data: chartData, borderColor: meta.color, backgroundColor: meta.color + '22', fill: true, tension: 0.3, pointBackgroundColor: meta.color }];
    } else if (selectedReport === 'income') {
        chartType = 'line';
        chartData = pastMonths.map(m => getInc(m));
        chartDatasets = [{ data: chartData, borderColor: '#10b981', backgroundColor: '#10b98122', fill: true, tension: 0.3, pointBackgroundColor: '#10b981' }];
    } else { // surplus
        chartType = 'bar';
        chartData = pastMonths.map(m => getInc(m) - getExp(m));
        chartDatasets = [{
            data: chartData,
            backgroundColor: chartData.map(v => v >= 0 ? '#10b98166' : '#f43f5e66'),
            borderColor:     chartData.map(v => v >= 0 ? '#10b981'   : '#f43f5e'),
            borderWidth: 1.5,
            borderRadius: 4,
        }];
    }

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById('trendChart'), {
        type: chartType,
        data: { labels, datasets: chartDatasets },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#27272a' }, ticks: { color: '#71717a', callback: v => '$' + v } },
                x: { grid: { color: '#27272a' }, ticks: { color: '#71717a' } }
            }
        }
    });

    // Summary stats
    const allValues = chartData.filter(v => v > 0);
    const statTotal = chartData.reduce((s,v) => s + Math.abs(v), 0);
    const statAvg   = chartData.length > 0 ? statTotal / chartData.length : 0;
    const statPeak  = chartData.length > 0 ? Math.max(...chartData.map(Math.abs)) : 0;
    const statColor = meta.color;

    const statsEl = document.getElementById('report-stats');
    if (statsEl) {
        const fmtAmt = v => v >= 1000 ? '$' + (v/1000).toFixed(1) + 'k' : '$' + v.toFixed(0);
        statsEl.innerHTML = [
            ['Total',   fmtAmt(statTotal)],
            ['Monthly Avg', fmtAmt(statAvg)],
            ['Peak',    fmtAmt(statPeak)],
        ].map(([label, val]) => `
            <div class="bg-zinc-900 rounded-2xl p-4 text-center">
                <div class="text-[9px] font-black tracking-[.12em] text-zinc-600 uppercase mb-1">${label}</div>
                <div class="text-lg font-semibold tracking-tight" style="color:${statColor}">${val}</div>
            </div>`).join('');
    }

    // Month list with colored bars
    let listHTML = '';
    pastMonths.slice().reverse().forEach(m => {
        const inc = getInc(m), exp = getExp(m), surplus = inc - exp;
        const monthBudget = monthlyBudgets[m] || {};
        let totalBudget = 0;
        Object.values(monthBudget).forEach(cat => Object.values(cat || {}).forEach(b => totalBudget += b));
        const util = totalBudget > 0 ? Math.round(exp / totalBudget * 100) : 0;

        let rightVal, rightSub, barColor, rowVal;
        if (selectedReport === 'spending' || selectedReport === 'expense') {
            rowVal = exp;
            rightVal = `$${Math.round(exp)}`;
            rightSub = totalBudget > 0 ? `${util}% of budget` : 'No budget set';
            barColor = util > 100 ? '#ef4444' : util > 80 ? '#f59e0b' : '#10b981';
        } else if (selectedReport === 'income') {
            rowVal = inc;
            rightVal = `$${Math.round(inc)}`;
            rightSub = exp > 0 ? `Spent $${Math.round(exp)}` : 'No expenses';
            barColor = '#10b981';
        } else {
            rowVal = surplus;
            rightVal = `${surplus >= 0 ? '+' : '−'}$${Math.round(Math.abs(surplus))}`;
            rightSub = `↑$${Math.round(inc)}  ↓$${Math.round(exp)}`;
            barColor = surplus >= 0 ? '#10b981' : '#ef4444';
        }

        const rightColor = selectedReport === 'surplus'
            ? (surplus >= 0 ? 'text-emerald-400' : 'text-rose-400')
            : selectedReport === 'income' ? 'text-emerald-400'
            : (util > 100 ? 'text-rose-400' : util > 80 ? 'text-amber-400' : 'text-emerald-400');

        listHTML += `<div class="flex items-stretch bg-zinc-900 rounded-2xl overflow-hidden">
            <div style="width:3px;background:${barColor};flex-shrink:0;margin:8px 0 8px 8px;border-radius:2px"></div>
            <div class="flex-1 px-4 py-3.5 flex justify-between items-center">
                <div class="font-medium text-sm">${formatMonthName(m)}</div>
                <div class="text-right">
                    <div class="${rightColor} font-semibold text-sm tabular-nums">${rightVal}</div>
                    <div class="text-[10px] text-zinc-600 mt-0.5">${rightSub}</div>
                </div>
            </div>
        </div>`;
    });
    document.getElementById('history-list').innerHTML = listHTML || '<p class="text-center text-zinc-600 text-sm py-8">No data yet</p>';
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

