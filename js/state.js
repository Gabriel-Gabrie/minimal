/* ══════════════════════════════════════════════
   STATE — Data model, defaults, persistence
══════════════════════════════════════════════ */

let transactions = [];
let recurringTransactions = [];
let expenseCategories = {};
let monthlyBudgets = {};
let walletAccounts = [];

/* ── Firebase & demo state (shared across modules) ── */
let _fbAuth = null;
let _fbDb   = null;
let _demoMode = false;

let currentType = 'expense';
let selectedMonth = '';       // single shared month across Overview, Transactions, Budgets
let selectedBudgetMonth = ""; // alias — kept for backward compat, synced via selectedMonth
let _rCharts = {};  // report chart instances keyed by card id
let _rCardOpen = { expenses: true, income: false, surplus: false, spendBreak: true, incBreak: false };
let _rSectOpen = { trends: true, breakdowns: true };
let _trendMonthCount = 6;     // Trends section (default 6M)
let _breakMonthCount = 1;     // Breakdowns section (1 = ring chart, default)
let _breakdownMode = 'category'; // 'category' | 'item'
let txFilter = 'all';
let selectedTxMonth = '';   // alias — kept for backward compat, synced via selectedMonth
let txSort = 'date-desc';     // 'date-desc'|'date-asc'|'amount-desc'|'amount-asc'
let _undoData = null, _undoTimer = null;
let _editingTxIdx = null;
let _editingRecurringId = null;


let mainEmojis = { "Income":"💰","Food":"🍽️","Household":"🏠","Personal":"👤","Health":"💊","Transportation":"🚗","Banking":"🏛️","Saving":"🐷","Debt":"💳" };
let itemIcons = {}; // keyed "main:sub", e.g. "Food:Groceries" → "🛒"
let _bimMain = null, _bimSub = null, _bimSelectedIcon = null;
let _balLegendOpen = false;
let _budgetViewMode = 'plan'; // 'plan' | 'remaining'
let incomeCats = ["Salary","Freelance","Investments","Gifts","Other"]; // legacy — now derived from expenseCategories['Income']

const defaultCategories = {
    "Income":         ["Salary", "Freelance", "Investments"],
    "Food":           ["Groceries", "Restaurants/Coffee"],
    "Personal":       ["Phone Plan", "Subscriptions", "Entertainment", "Education", "Grooming/Haircut", "Laundry"],
    "Household":      ["Rent/Mortgage", "Utilities", "Internet"],
    "Transportation": ["Car Payment", "Auto Insurance", "Gas/Charging", "Maintenance", "Parking/Tolls"],
    "Health":         ["Supplements", "Medical", "Training"],
    "Banking":        ["Bank Fees", "Transfers", "Cash Withdrawal"],
};

const defaultItemIcons = {
    "Income:Salary":              "💼",
    "Income:Freelance":           "💻",
    "Income:Investments":         "📈",
    "Food:Groceries":             "🛒",
    "Food:Restaurants/Coffee":    "☕",
    "Personal:Phone Plan":        "📱",
    "Personal:Subscriptions":     "📺",
    "Personal:Entertainment":     "🎬",
    "Personal:Education":         "📚",
    "Personal:Grooming/Haircut":  "✂️",
    "Personal:Laundry":           "🧺",
    "Household:Rent/Mortgage":    "🏠",
    "Household:Utilities":        "💡",
    "Household:Internet":         "🌐",
    "Transportation:Car Payment": "🚗",
    "Transportation:Auto Insurance": "🛡️",
    "Transportation:Gas/Charging":"⛽",
    "Transportation:Maintenance": "🔧",
    "Transportation:Parking/Tolls": "🅿️",
    "Health:Supplements":         "💊",
    "Health:Medical":             "🏥",
    "Health:Training":            "🏋️",
    "Banking:Bank Fees":          "🏦",
    "Banking:Transfers":          "💸",
    "Banking:Cash Withdrawal":    "💵",
};

/* ── Persistence helpers ─────────────────────── */

// Write to localStorage (always) + Firestore (debounced, when signed in)
let _saveTimer = null;
function saveData() {
    if (_demoMode) return; // never persist demo data
    const snap = {
        transactions, recurringTransactions, expenseCategories, monthlyBudgets, itemIcons, walletAccounts,
        categoryOrder: Object.keys(expenseCategories)
        // incomeCats is now derived from expenseCategories['Income'] — not saved separately
    };
    // Always write to localStorage as offline cache
    Object.entries(snap).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));

    // Debounced cloud write
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        const user = _fbAuth ? _fbAuth.currentUser : null;
        if (!user || !_fbDb) return;
        _fbDb.collection('users').doc(user.uid)
            .set({ data: snap, updatedAt: new Date().toISOString() }, { merge: true })
            .catch(e => console.warn('Firestore write:', e.message));
    }, 1500);
}

// Populate app state from a plain object
function _applyData(d) {
    expenseCategories = d.expenseCategories || {...defaultCategories};
    // Restore category order (Firestore doesn't preserve object key order)
    if (d.categoryOrder && Array.isArray(d.categoryOrder) && expenseCategories) {
        const ordered = {};
        d.categoryOrder.forEach(k => { if (k in expenseCategories) ordered[k] = expenseCategories[k]; });
        Object.keys(expenseCategories).forEach(k => { if (!(k in ordered)) ordered[k] = expenseCategories[k]; });
        expenseCategories = ordered;
    }
    monthlyBudgets    = d.monthlyBudgets    || {};

    transactions      = d.transactions      || [];
    recurringTransactions = d.recurringTransactions || [];
    itemIcons         = d.itemIcons         || {};
    walletAccounts    = d.walletAccounts    || [];
    incomeCats        = d.incomeCats        || ["Salary","Freelance","Investments","Gifts","Other"];
    selectedMonth = getCurrentMonthKey();
    selectedBudgetMonth = selectedMonth;
    selectedTxMonth = selectedMonth;

    // ── Migration 1: "Living" → "Household" ────────────────────────
    if ('Living' in expenseCategories && !('Household' in expenseCategories)) {
        const rebuilt = {};
        Object.keys(expenseCategories).forEach(k => {
            rebuilt[k === 'Living' ? 'Household' : k] = expenseCategories[k];
        });
        expenseCategories = rebuilt;
        Object.keys(monthlyBudgets).forEach(m => {
            if (monthlyBudgets[m]['Living']) {
                monthlyBudgets[m]['Household'] = monthlyBudgets[m]['Living'];
                delete monthlyBudgets[m]['Living'];
            }
        });
        transactions.forEach(t => {
            if (t.type === 'expense' && t.mainCategory === 'Living') t.mainCategory = 'Household';
        });
    }

    // ── Migration 2: Inject Income as first category ────────────────
    if (!('Income' in expenseCategories)) {
        const incItems = (incomeCats && incomeCats.length)
            ? incomeCats.slice()
            : ["Salary", "Freelance", "Investments"];
        expenseCategories = { "Income": incItems, ...expenseCategories };
    }

    // ── Migration 3: Keep incomeCats in sync (derived) ─────────────
    incomeCats = expenseCategories['Income'] || [];
}

function loadData() {
    // Read from localStorage (used as offline fallback and pre-Firebase init)
    _applyData({
        expenseCategories: JSON.parse(localStorage.getItem('expenseCategories')),
        monthlyBudgets:    JSON.parse(localStorage.getItem('monthlyBudgets')),

        transactions:      JSON.parse(localStorage.getItem('transactions')),
        recurringTransactions: JSON.parse(localStorage.getItem('recurringTransactions')),
        itemIcons:         JSON.parse(localStorage.getItem('itemIcons')),
        walletAccounts:    JSON.parse(localStorage.getItem('walletAccounts')),
        incomeCats:        JSON.parse(localStorage.getItem('incomeCats')),
        categoryOrder:     JSON.parse(localStorage.getItem('categoryOrder')),
    });
}

// Load from Firestore for current user; falls back to localStorage
async function loadFromFirestore(uid) {
    if (!_fbDb) { loadData(); return; }
    try {
        const doc = await _fbDb.collection('users').doc(uid).get();
        if (doc.exists && doc.data().data) {
            const d = doc.data().data;
            _applyData(d);
            // Mirror to localStorage so offline works
            Object.entries(d).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
        } else {
            loadData(); // new user — start fresh
        }
    } catch(e) {
        console.warn('Firestore read failed, using localStorage:', e.message);
        loadData();
    }
}

function getCurrentDateEST() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
}

function getCurrentMonthKey() {
    return getCurrentDateEST().slice(0,7);
}


function getNextMonth(key) {
    let [year, month] = key.split('-').map(Number);
    month++;
    if (month > 12) { month = 1; year++; }
    return `${year}-${month.toString().padStart(2, '0')}`;
}

function getPrevMonth(key) {
    let [year, month] = key.split('-').map(Number);
    month--;
    if (month < 1) { month = 12; year--; }
    return `${year}-${month.toString().padStart(2, '0')}`;
}

function formatMonthShort(key) {
    if (!key || !key.match(/^\d{4}-\d{2}$/)) return key;
    const [y, m] = key.split('-').map(Number);
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return names[m - 1] + '-' + String(y).slice(2);
}

function formatMonthName(key) {
    if (!key || !key.match(/^\d{4}-\d{2}$/)) return "Invalid Date";
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m-1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

/* ── Recurring transaction date helpers ─────────────────────── */

function addWeeks(dateStr, weeks) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + (weeks * 7));
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addBiWeekly(dateStr) {
    return addWeeks(dateStr, 2);
}

function addMonths(dateStr, months) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setMonth(date.getMonth() + months);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addYears(dateStr, years) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setFullYear(date.getFullYear() + years);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/* ── Shared month selector (syncs Overview, Transactions, Budgets) ── */

function _initSharedMonth() {
    if (!selectedMonth) selectedMonth = getCurrentMonthKey();
}

function _syncMonthAliases() {
    selectedBudgetMonth = selectedMonth;
    selectedTxMonth = selectedMonth;
    if (typeof _ovSelectedMonth !== 'undefined') _ovSelectedMonth = selectedMonth;
}

function setSharedMonth(key) {
    selectedMonth = key;
    _syncMonthAliases();
    _updateMasterMonthUI();
    // Re-render the active main tab
    const active = document.querySelector('[id^="tab-"].tab-active');
    if (!active) return;
    const n = parseInt(active.id.replace('tab-', ''), 10);
    [renderOverview, renderTransactions, renderBudgets][n]?.();
}

function prevSharedMonth() {
    _initSharedMonth();
    setSharedMonth(getPrevMonth(selectedMonth));
}

function nextSharedMonth() {
    _initSharedMonth();
    setSharedMonth(getNextMonth(selectedMonth));
}

function goThisMonth() {
    setSharedMonth(getCurrentMonthKey());
}

function _updateMasterMonthUI() {
    _initSharedMonth();
    const label = document.getElementById('master-month-label');
    if (label) label.textContent = formatMonthName(selectedMonth);
    const thisBtn = document.getElementById('master-this-month');
    if (thisBtn) {
        const isCurrent = selectedMonth === getCurrentMonthKey();
        thisBtn.classList.toggle('hidden', isCurrent);
    }
}

/* ── Recurring transaction generation ─────────────────────── */

function generateRecurringTransactions() {
    if (!recurringTransactions || !Array.isArray(recurringTransactions)) return;

    const today = getCurrentDateEST();
    let generated = 0;

    recurringTransactions.forEach(template => {
        if (!template.active) return;

        // Generate all due transactions up to today
        while (template.nextDate && template.nextDate <= today) {
            // Stop if end date is reached
            if (template.endDate && template.nextDate > template.endDate) {
                template.active = false;
                break;
            }

            // Skip if this date is in skippedDates array
            if (template.skippedDates && template.skippedDates.includes(template.nextDate)) {
                template.nextDate = _calculateNextRecurrenceDate(template.nextDate, template.frequency);
                continue;
            }

            // Check if transaction already exists for this date and recurringId
            const alreadyExists = transactions.some(t =>
                t.recurringId === template.id && t.date === template.nextDate
            );

            if (!alreadyExists) {
                // Generate new transaction from template
                const newTx = {
                    id: Date.now() + Math.random(),
                    type: template.type,
                    amount: template.amount,
                    date: template.nextDate,
                    mainCategory: template.mainCategory,
                    subCategory: template.subCategory,
                    desc: template.desc || '',
                    excluded: template.excluded || false,
                    recurringId: template.id,
                };

                // Add wallet account ID if present (FOR ALL TRANSACTION TYPES)
                if (template.walletAccountId) {
                    newTx.walletAccountId = template.walletAccountId;
                }

                // Add transfer-specific fields if applicable
                if (template.type === 'transfer') {
                    newTx.fromAccountId = template.fromAccountId;
                    newTx.toAccountId = template.toAccountId;
                }

                transactions.push(newTx);
                generated++;
            }

            // Advance to next occurrence
            template.nextDate = _calculateNextRecurrenceDate(template.nextDate, template.frequency);
        }
    });

    if (generated > 0) {
        saveData();
    }
}

function _calculateNextRecurrenceDate(dateStr, frequency) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    switch (frequency) {
        case 'weekly':
            date.setDate(date.getDate() + 7);
            break;
        case 'bi-weekly':
            date.setDate(date.getDate() + 14);
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
        case 'yearly':
            date.setFullYear(date.getFullYear() + 1);
            break;
        default:
            return dateStr;
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/* ── Balance & budget calculations ─────────────────────── */

function calculateTotals() {
    let balance = 0, income = 0, expense = 0;
    transactions.forEach(t => {
        if (t.excluded) return;
        const a = parseFloat(t.amount);
        if (t.type === 'income') { income += a; balance += a; }
        else { expense += a; balance -= a; }
    });
    return {balance, income, expense};
}

function calculateSpentInMonth(monthKey, main, sub = null) {
    return transactions.filter(t => t.type === 'expense' && !t.excluded && t.date.startsWith(monthKey) && (!main || t.mainCategory === main) && (!sub || t.subCategory === sub))
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
}

function calculateIncomeInMonth(monthKey, item = null) {
    return transactions
        .filter(t => t.type === 'income' && !t.excluded && t.date.startsWith(monthKey)
                  && (!item || t.mainCategory === item))
        .reduce((s, t) => s + parseFloat(t.amount), 0);
}

/* ── Transfer budget helpers ──────────────────────────────── */

// Get account type from wallet by id
function _getAccType(id) {
    const a = walletAccounts.find(x => x.id === id);
    return a ? a.type : null;
}
function _getAccById(id) {
    return walletAccounts.find(x => x.id === id) || null;
}

// Calculate net amount transferred TO a saving/debt account in a given month
// Positive = money going into saving/debt (expense-like)
// Negative = money pulled back from saving/debt (negative expense)
function _calculateTransferToAccount(monthKey, accountId) {
    return transactions
        .filter(t => t.type === 'transfer' && t.date.startsWith(monthKey))
        .reduce((sum, t) => {
            const fromType = _getAccType(t.fromAccountId);
            const toType   = _getAccType(t.toAccountId);
            if (!fromType || !toType) return sum;
            // spending → saving/debt: destination = this account → positive
            if (fromType === 'spending' && (toType === 'saving' || toType === 'debt') && t.toAccountId === accountId) {
                return sum + parseFloat(t.amount);
            }
            // saving/debt → spending: source = this account → negative
            if ((fromType === 'saving' || fromType === 'debt') && toType === 'spending' && t.fromAccountId === accountId) {
                return sum - parseFloat(t.amount);
            }
            return sum;
        }, 0);
}

// Total savings/debt payments in a month (for overview: expenses + savings)
function _calculateTotalSavingsInMonth(monthKey) {
    return transactions
        .filter(t => t.type === 'transfer' && t.date.startsWith(monthKey))
        .reduce((sum, t) => {
            const fromType = _getAccType(t.fromAccountId);
            const toType   = _getAccType(t.toAccountId);
            if (!fromType || !toType) return sum;
            // spending → saving/debt counts as positive (outflow from budget)
            if (fromType === 'spending' && (toType === 'saving' || toType === 'debt')) {
                return sum + parseFloat(t.amount);
            }
            // saving/debt → spending counts as negative (inflow back to budget)
            if ((fromType === 'saving' || fromType === 'debt') && toType === 'spending') {
                return sum - parseFloat(t.amount);
            }
            return sum;
        }, 0);
}

// All-time total savings (no month filter)
function _calculateTotalSavingsAllTime() {
    return transactions
        .filter(t => t.type === 'transfer')
        .reduce((sum, t) => {
            const fromType = _getAccType(t.fromAccountId);
            const toType   = _getAccType(t.toAccountId);
            if (!fromType || !toType) return sum;
            if (fromType === 'spending' && (toType === 'saving' || toType === 'debt'))
                return sum + parseFloat(t.amount);
            if ((fromType === 'saving' || fromType === 'debt') && toType === 'spending')
                return sum - parseFloat(t.amount);
            return sum;
        }, 0);
}

// Check if a transfer is excluded from budget (same-type transfer)
function _isTransferExcluded(t) {
    if (t.type !== 'transfer') return false;
    const fromType = _getAccType(t.fromAccountId);
    const toType   = _getAccType(t.toAccountId);
    if (!fromType || !toType) return true;
    return fromType === toType;
}