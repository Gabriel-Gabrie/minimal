/* ══════════════════════════════════════════════
   STATE — Data model, defaults, persistence
══════════════════════════════════════════════ */

/**
 * @typedef {Object} Transaction
 * @property {number} id - Unique transaction identifier (timestamp-based)
 * @property {string} type - Transaction type: 'income', 'expense', or 'transfer'
 * @property {number} amount - Transaction amount
 * @property {string} date - Transaction date in YYYY-MM-DD format
 * @property {string} desc - Transaction description
 * @property {string} mainCategory - Main category name
 * @property {string} subCategory - Sub-category name
 * @property {boolean} excluded - Whether transaction is excluded from budgets
 * @property {string} [walletAccountId] - Wallet account ID (optional, for income/expense)
 * @property {string} [fromAccountId] - Source account ID (optional, for transfers)
 * @property {string} [toAccountId] - Destination account ID (optional, for transfers)
 */

let transactions = [];

/**
 * @typedef {Object.<string, string[]>} ExpenseCategories
 * Object mapping category names to arrays of subcategories.
 * Each key is a category name (e.g., "Food", "Income") and each value is an array of subcategory names.
 */
let expenseCategories = {};

/**
 * @typedef {Object.<string, Object.<string, Object.<string, number>>>} MonthlyBudgets
 * Three-level nested structure mapping month keys to categories to budget items.
 * First level: Month key in YYYY-MM format (e.g., "2025-03")
 * Second level: Category name (e.g., "Food", "Income")
 * Third level: Item name (e.g., "Groceries", "Salary") mapped to budget amount
 * @example
 * {
 *   "2025-03": {
 *     "Food": {
 *       "Groceries": 500,
 *       "Restaurants/Coffee": 200
 *     },
 *     "Income": {
 *       "Salary": 5000
 *     }
 *   }
 * }
 */
let monthlyBudgets = {};

/**
 * @typedef {Object.<string, BudgetMonth>} BudgetMonths
 * Per-month budget structure with active sections and nested budgets.
 * @typedef {Object} BudgetMonth
 * @property {Object.<string, string[]>} activeSections - Map of section names to arrays of category names
 * @property {string[]} sectionOrder - Array of section names defining display order
 * @property {Object.<string, Object.<string, Object.<string, Object>>>} budgets - Nested: section→category→item→{amount}
 */
let budgetMonths = {};

/**
 * @typedef {Object} WalletAccount
 * @property {string} id - Unique account identifier
 * @property {string} name - Account name
 * @property {string} type - Account type: 'spending', 'saving', or 'debt'
 * @property {string} icon - Account icon (emoji)
 * @property {string} colour - Account color (hex format, e.g., '#10b981')
 * @property {number} balance - Current account balance
 * @property {number} goal - Goal amount (for saving accounts) or starting debt (for debt accounts)
 * @property {boolean} isDefault - Whether this is the default account for transactions
 * @property {string} createdAt - Creation timestamp in ISO 8601 format
 */
let walletAccounts = [];

/**
 * @typedef {Object.<string, string[]>} MasterSections
 * Object mapping section names to arrays of category names.
 * This serves as the global library of available budget sections/categories.
 * Each key is a section name (e.g., "Income", "Bills") and each value is an array of category names.
 */
let masterSections = {};

/**
 * @type {string[]} Array of section names defining display order
 */
let masterSectionOrder = [];

/**
 * @type {number} Data migration version tracker (0 = pre-migration, 1 = migrated to new structure)
 */
let _dataVersion = 0;

/* ── Firebase & demo state (shared across modules) ── */
/** @type {Object|null} Firebase Auth instance */
let _fbAuth = null;
/** @type {Object|null} Firebase Firestore instance */
let _fbDb   = null;
/** @type {boolean} Demo mode flag (when true, data is not persisted) */
let _demoMode = false;

/** @type {'income'|'expense'|'transfer'} Current transaction type being entered/displayed */
let currentType = 'expense';
/** @type {string} Single shared month key (YYYY-MM format) across Overview, Transactions, Budgets */
let selectedMonth = '';
/** @type {string} Alias for selectedMonth — kept for backward compat, synced via selectedMonth */
let selectedBudgetMonth = "";
/** @type {Object.<string, Object>} Report chart instances keyed by card id */
let _rCharts = {};
/** @type {{expenses: boolean, income: boolean, surplus: boolean, spendBreak: boolean, incBreak: boolean}} Report card visibility states */
let _rCardOpen = { expenses: true, income: false, surplus: false, spendBreak: true, incBreak: false };
/** @type {{trends: boolean, breakdowns: boolean}} Report section visibility states */
let _rSectOpen = { trends: true, breakdowns: true };
/** @type {number} Number of months to show in trends section (default 6) */
let _trendMonthCount = 6;
/** @type {number} Number of months to show in breakdowns section (1 = ring chart, default) */
let _breakMonthCount = 1;
/** @type {'category'|'item'} Breakdown display mode */
let _breakdownMode = 'category';
/** @type {string} Transaction filter mode ('all' or other filter values) */
let txFilter = 'all';
/** @type {string} Alias for selectedMonth — kept for backward compat, synced via selectedMonth */
let selectedTxMonth = '';
/** @type {'date-desc'|'date-asc'|'amount-desc'|'amount-asc'} Transaction list sort order */
let txSort = 'date-desc';
/** @type {Object|null} Undo data snapshot for transaction deletion */
let _undoData = null;
/** @type {number|null} Undo toast timeout timer ID */
let _undoTimer = null;
/** @type {number|null} Index of transaction currently being edited */
let _editingTxIdx = null;

/** @type {Object.<string, string>} Main category emoji icons keyed by category name */
let mainEmojis = { "Income":"💰","Food":"🍽️","Household":"🏠","Personal":"👤","Health":"💊","Transportation":"🚗","Banking":"🏛️","Saving":"🐷","Debt":"💳" };
/** @type {Object.<string, string>} Item emoji icons keyed by "Main:Sub" format (e.g., "Food:Groceries" → "🛒") */
let itemIcons = {};
/** @type {string|null} Currently selected main category in budget item modal */
let _bimMain = null;
/** @type {string|null} Currently selected sub-category in budget item modal */
let _bimSub = null;
/** @type {string|null} Currently selected emoji icon in budget item modal */
let _bimSelectedIcon = null;
/** @type {boolean} Wallet balance legend visibility state */
let _balLegendOpen = false;
/** @type {'plan'|'remaining'} Budget view mode (plan = budgeted amounts, remaining = remaining amounts) */
let _budgetViewMode = 'plan';
/** @type {string[]} Income category items — legacy, now derived from expenseCategories['Income'] */
let incomeCats = ["Salary","Freelance","Investments","Gifts","Other"];

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

const defaultSections = {
    "Income":         ["Salary", "Freelance", "Investments"],
    "Bills":          ["Rent/Mortgage", "Utilities", "Internet", "Insurance"],
    "Groceries":      ["Supermarket", "Farmers Market", "Meal Prep"],
    "Transport":      ["Public Transit", "Gas/Charging", "Car Payment", "Auto Insurance", "Maintenance"],
    "Personal":       ["Phone Plan", "Subscriptions", "Grooming/Haircut", "Laundry"],
    "Entertainment":  ["Dining Out", "Movies/Shows", "Hobbies", "Events"],
    "Health":         ["Medical", "Supplements", "Gym/Fitness"],
    "Household":      ["Furniture", "Home Maintenance", "Supplies"],
};

/* ── Persistence helpers ─────────────────────── */

/**
 * Write to localStorage (always) + Firestore (debounced, when signed in).
 * Does nothing in demo mode. Immediately writes to localStorage and debounces
 * Firestore write by 1.5 seconds to avoid excessive cloud writes.
 * @returns {void}
 */
/** @type {number|null} Debounce timer ID for Firestore save operations */
let _saveTimer = null;
function saveData() {
    if (_demoMode) return; // never persist demo data
    const snap = {
        transactions, expenseCategories, monthlyBudgets, budgetMonths, itemIcons, walletAccounts,
        masterSections, masterSectionOrder, _dataVersion,
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
            .then(() => {
                // Firestore write successful
            })
            .catch(e => {
                console.warn('Firestore write:', e.message);
            });
    }, 1500);
}

/**
 * Populate app state from a plain object.
 * Applies data migrations, restores category order, and initializes derived state.
 * @param {Object} d - Data snapshot object
 * @param {ExpenseCategories} [d.expenseCategories] - Category definitions
 * @param {MonthlyBudgets} [d.monthlyBudgets] - Budget data by month (legacy)
 * @param {BudgetMonths} [d.budgetMonths] - Per-month budget structure (new)
 * @param {Transaction[]} [d.transactions] - Transaction history
 * @param {Object.<string, string>} [d.itemIcons] - Icon mappings ("Main:Sub" → emoji)
 * @param {WalletAccount[]} [d.walletAccounts] - Wallet accounts
 * @param {string[]} [d.incomeCats] - Legacy income categories (now derived)
 * @param {string[]} [d.categoryOrder] - Category key order for restoration
 * @param {MasterSections} [d.masterSections] - Master section definitions
 * @param {string[]} [d.masterSectionOrder] - Master section order array
 * @param {number} [d._dataVersion] - Data migration version tracker
 * @returns {void}
 */
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
    budgetMonths      = d.budgetMonths      || {};

    transactions      = d.transactions      || [];
    itemIcons         = d.itemIcons         || {};
    walletAccounts    = d.walletAccounts    || [];
    incomeCats        = d.incomeCats        || ["Salary","Freelance","Investments","Gifts","Other"];
    masterSections    = d.masterSections    || {};
    masterSectionOrder = d.masterSectionOrder || [];
    _dataVersion      = d._dataVersion      || 0;
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
    incomeCats = masterSections['Income'] || [];

    // ── Migration 4: Data Version 1 — masterSections & per-month budgets ────
    // Check if this is a brand new user (no existing budget data at all)
    const isNewUser = _dataVersion === 0
        && Object.keys(masterSections).length === 0
        && Object.keys(budgetMonths).length === 0
        && Object.keys(monthlyBudgets).length === 0;

    if (isNewUser) {
        // New user initialization (skip migration path)
        console.log('New user detected - initializing with default sections');
        masterSections = {...defaultSections};
        masterSectionOrder = Object.keys(masterSections);
        budgetMonths = {};
        _dataVersion = 1;
        console.log('New user initialization complete');
    } else if (_dataVersion < 1) {
        // Existing user migration
        console.log('Starting budget data migration to v1...');

        // Migrate expenseCategories to masterSections
        if (expenseCategories && Object.keys(expenseCategories).length > 0) {
            masterSections = {...expenseCategories};
            console.log('Migrated expenseCategories to masterSections');
        } else {
            masterSections = {...defaultSections};
            console.log('Initialized masterSections from defaultSections');
        }

        // Build masterSectionOrder from section names
        masterSectionOrder = Object.keys(masterSections);

        // Migrate legacy monthlyBudgets to per-month budgetMonths structure
        if (monthlyBudgets && Object.keys(monthlyBudgets).length > 0) {
            console.log('Migrating legacy budgets to per-month structure...');
            budgetMonths = {};

            Object.keys(monthlyBudgets).forEach(monthKey => {
                const legacyMonth = monthlyBudgets[monthKey];
                const activeSections = {};
                const sectionOrder = [];
                const budgets = {};

                // Process each section (old category) in this month
                Object.keys(legacyMonth).forEach(sectionName => {
                    const legacySection = legacyMonth[sectionName];

                    // Extract categories (old items) for this section
                    const categories = Object.keys(legacySection);

                    // Add to activeSections
                    activeSections[sectionName] = categories;

                    // Add to sectionOrder
                    sectionOrder.push(sectionName);

                    // Build nested budgets structure
                    budgets[sectionName] = {};
                    categories.forEach(categoryName => {
                        const amount = legacySection[categoryName];

                        // Create nested structure: section → category → item → {amount}
                        // Use "Budget" as default item name since old format didn't have items
                        budgets[sectionName][categoryName] = {
                            "Budget": { amount: amount }
                        };
                    });
                });

                // Store migrated month data
                budgetMonths[monthKey] = {
                    activeSections,
                    sectionOrder,
                    budgets
                };
            });

            console.log(`Migrated ${Object.keys(budgetMonths).length} months to new budget structure`);
        } else {
            // No legacy budgets, initialize empty
            budgetMonths = {};
        }

        // Set version flag to prevent re-migration
        _dataVersion = 1;
        console.log('Budget data migration to v1 complete');
    }
}

/**
 * Load app data from localStorage.
 * Used as offline fallback and pre-Firebase initialization.
 * @returns {void}
 */
function loadData() {
    // Read from localStorage (used as offline fallback and pre-Firebase init)
    _applyData({
        expenseCategories: JSON.parse(localStorage.getItem('expenseCategories')),
        monthlyBudgets:    JSON.parse(localStorage.getItem('monthlyBudgets')),
        budgetMonths:      JSON.parse(localStorage.getItem('budgetMonths')),

        transactions:      JSON.parse(localStorage.getItem('transactions')),
        itemIcons:         JSON.parse(localStorage.getItem('itemIcons')),
        walletAccounts:    JSON.parse(localStorage.getItem('walletAccounts')),
        incomeCats:        JSON.parse(localStorage.getItem('incomeCats')),
        categoryOrder:     JSON.parse(localStorage.getItem('categoryOrder')),

        masterSections:    JSON.parse(localStorage.getItem('masterSections')),
        masterSectionOrder: JSON.parse(localStorage.getItem('masterSectionOrder')),
        _dataVersion:      JSON.parse(localStorage.getItem('_dataVersion')),
    });
}

/**
 * Load from Firestore for current user; falls back to localStorage.
 * Mirrors Firestore data to localStorage for offline access. If Firestore
 * is unavailable or read fails, falls back to loadData().
 * @param {string} uid - Firebase user ID
 * @returns {Promise<void>}
 */
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

/**
 * Get current date in EST/EDT timezone.
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getCurrentDateEST() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
}

/**
 * Get current month key in EST/EDT timezone.
 * @returns {string} Month key in YYYY-MM format (e.g., "2025-03")
 */
function getCurrentMonthKey() {
    return getCurrentDateEST().slice(0,7);
}


/**
 * Get the next month key.
 * @param {string} key - Current month key in YYYY-MM format
 * @returns {string} Next month key in YYYY-MM format
 */
function getNextMonth(key) {
    let [year, month] = key.split('-').map(Number);
    month++;
    if (month > 12) { month = 1; year++; }
    return `${year}-${month.toString().padStart(2, '0')}`;
}

/**
 * Get the previous month key.
 * @param {string} key - Current month key in YYYY-MM format
 * @returns {string} Previous month key in YYYY-MM format
 */
function getPrevMonth(key) {
    let [year, month] = key.split('-').map(Number);
    month--;
    if (month < 1) { month = 12; year--; }
    return `${year}-${month.toString().padStart(2, '0')}`;
}

/**
 * Format month key as short display string.
 * @param {string} key - Month key in YYYY-MM format
 * @returns {string} Formatted month string (e.g., "Mar-25") or original key if invalid
 */
function formatMonthShort(key) {
    if (!key || !key.match(/^\d{4}-\d{2}$/)) return key;
    const [y, m] = key.split('-').map(Number);
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return names[m - 1] + '-' + String(y).slice(2);
}

/**
 * Format month key as full month name and year.
 * @param {string} key - Month key in YYYY-MM format
 * @returns {string} Formatted month name (e.g., "March 2025") or "Invalid Date" if key is invalid
 */
function formatMonthName(key) {
    if (!key || !key.match(/^\d{4}-\d{2}$/)) return "Invalid Date";
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m-1).toLocaleString('default', { month: 'long', year: 'numeric' });
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

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} unsafe - Untrusted user input
 * @returns {string} HTML-safe string
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ── Budget Section Helpers ─────────────────────── */

/**
 * Get active sections for a given month.
 * @param {string} monthKey - Month key in YYYY-MM format
 * @returns {Object.<string, string[]>} Active sections object mapping section names to arrays of category names, or empty object if month doesn't exist
 */
function getActiveSections(monthKey) {
    return budgetMonths[monthKey]?.activeSections || {};
}

/**
 * Check if a section is active in any budget month.
 * @param {string} sectionName - Name of the section to check
 * @returns {boolean} True if section is active in at least one month, false otherwise
 */
function isSectionActiveInAnyBudget(sectionName) {
    for (const monthKey in budgetMonths) {
        if (budgetMonths[monthKey]?.activeSections?.[sectionName]) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a category is active in a section in any budget month.
 * @param {string} sectionName - Name of the section to check
 * @param {string} categoryName - Name of the category to check
 * @returns {boolean} True if category is active in the section in at least one month, false otherwise
 */
function isCategoryActiveInAnyBudget(sectionName, categoryName) {
    for (const monthKey in budgetMonths) {
        const activeSections = budgetMonths[monthKey]?.activeSections;
        if (activeSections?.[sectionName]?.includes(categoryName)) {
            return true;
        }
    }
    return false;
}

/**
 * Add a section to a month's budget.
 * @param {string} monthKey - Month key in YYYY-MM format
 * @param {string} sectionName - Name of the section to add
 */
function addSectionToBudget(monthKey, sectionName) {
    // Initialize month structure if it doesn't exist
    if (!budgetMonths[monthKey]) {
        budgetMonths[monthKey] = {
            activeSections: {},
            sectionOrder: [],
            budgets: {}
        };
    }

    const month = budgetMonths[monthKey];

    // Check if section already exists
    if (month.activeSections[sectionName]) {
        return; // Section already exists, nothing to do
    }

    // Get categories from masterSections, or use empty array if section not in master
    const categories = masterSections[sectionName] || [];
    month.activeSections[sectionName] = [...categories];

    // Add section to sectionOrder if not already there
    if (!month.sectionOrder.includes(sectionName)) {
        month.sectionOrder.push(sectionName);
    }

    // Initialize budgets structure for this section
    if (!month.budgets[sectionName]) {
        month.budgets[sectionName] = {};

        // Initialize each category with empty object
        categories.forEach(categoryName => {
            month.budgets[sectionName][categoryName] = {};
        });
    }
}

/**
 * Remove a section from a month's budget.
 * @param {string} monthKey - Month key in YYYY-MM format
 * @param {string} sectionName - Name of the section to remove
 */
function removeSectionFromBudget(monthKey, sectionName) {
    // Check if month exists
    if (!budgetMonths[monthKey]) {
        return; // Month doesn't exist, nothing to remove
    }

    const month = budgetMonths[monthKey];

    // Remove section from activeSections
    if (month.activeSections[sectionName]) {
        delete month.activeSections[sectionName];
    }

    // Remove section from sectionOrder
    const sectionIndex = month.sectionOrder.indexOf(sectionName);
    if (sectionIndex !== -1) {
        month.sectionOrder.splice(sectionIndex, 1);
    }

    // Remove section from budgets
    if (month.budgets[sectionName]) {
        delete month.budgets[sectionName];
    }
}

/**
 * Add a category to a section within a month's budget.
 * @param {string} monthKey - Month key in YYYY-MM format
 * @param {string} sectionName - Name of the section
 * @param {string} categoryName - Name of the category to add
 */
function addCategoryToBudget(monthKey, sectionName, categoryName) {
    // Initialize month structure if it doesn't exist
    if (!budgetMonths[monthKey]) {
        budgetMonths[monthKey] = {
            activeSections: {},
            sectionOrder: [],
            budgets: {}
        };
    }

    const month = budgetMonths[monthKey];

    // Initialize section if it doesn't exist
    if (!month.activeSections[sectionName]) {
        month.activeSections[sectionName] = [];

        // Add section to sectionOrder if not already there
        if (!month.sectionOrder.includes(sectionName)) {
            month.sectionOrder.push(sectionName);
        }

        // Initialize budgets structure for this section
        month.budgets[sectionName] = {};
    }

    // Check if category already exists in this section
    if (month.activeSections[sectionName].includes(categoryName)) {
        return; // Category already exists, nothing to do
    }

    // Add category to section's active categories array
    month.activeSections[sectionName].push(categoryName);

    // Initialize budgets structure for this category
    if (!month.budgets[sectionName][categoryName]) {
        month.budgets[sectionName][categoryName] = {};
    }
}

/**
 * Remove a category from a section within a month's budget.
 * @param {string} monthKey - Month key in YYYY-MM format
 * @param {string} sectionName - Name of the section
 * @param {string} categoryName - Name of the category to remove
 */
function removeCategoryFromBudget(monthKey, sectionName, categoryName) {
    // Check if month exists
    if (!budgetMonths[monthKey]) {
        return; // Month doesn't exist, nothing to remove
    }

    const month = budgetMonths[monthKey];

    // Check if section exists
    if (!month.activeSections[sectionName]) {
        return; // Section doesn't exist, nothing to remove
    }

    // Remove category from section's active categories array
    const categoryIndex = month.activeSections[sectionName].indexOf(categoryName);
    if (categoryIndex !== -1) {
        month.activeSections[sectionName].splice(categoryIndex, 1);
    }

    // Remove category from budgets structure
    if (month.budgets[sectionName] && month.budgets[sectionName][categoryName]) {
        delete month.budgets[sectionName][categoryName];
    }
}

/* ── Balance & budget calculations ─────────────────────── */

/**
 * Calculate all-time totals across all transactions.
 * Excludes transactions marked as excluded. Transfers do not affect totals.
 * @returns {{balance: number, income: number, expense: number}} Total balance, income, and expense
 */
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

/**
 * Calculate total expenses in a specific month, optionally filtered by category/subcategory.
 * Excludes transactions marked as excluded.
 * @param {string} monthKey - Month key in YYYY-MM format (e.g., "2025-03")
 * @param {string} main - Main category name to filter by (or null/undefined for all)
 * @param {string|null} [sub=null] - Sub-category name to filter by (optional)
 * @returns {number} Total amount spent
 */
function calculateSpentInMonth(monthKey, main, sub = null) {
    return transactions.filter(t => t.type === 'expense' && !t.excluded && t.date.startsWith(monthKey) && (!main || t.mainCategory === main) && (!sub || t.subCategory === sub))
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
}

/**
 * Calculate total income in a specific month, optionally filtered by income item.
 * Excludes transactions marked as excluded.
 * @param {string} monthKey - Month key in YYYY-MM format (e.g., "2025-03")
 * @param {string|null} [item=null] - Income item name to filter by (optional, stored in mainCategory)
 * @returns {number} Total income amount
 */
function calculateIncomeInMonth(monthKey, item = null) {
    return transactions
        .filter(t => t.type === 'income' && !t.excluded && t.date.startsWith(monthKey)
                  && (!item || t.mainCategory === item))
        .reduce((s, t) => s + parseFloat(t.amount), 0);
}

/* ── Transfer budget helpers ──────────────────────────────── */

/**
 * Get account type from wallet by ID.
 * @param {string} id - Wallet account ID
 * @returns {string|null} Account type ('spending', 'saving', or 'debt') or null if not found
 */
function _getAccType(id) {
    const a = walletAccounts.find(x => x.id === id);
    return a ? a.type : null;
}

/**
 * Get wallet account by ID.
 * @param {string} id - Wallet account ID
 * @returns {WalletAccount|null} Wallet account object or null if not found
 */
function _getAccById(id) {
    return walletAccounts.find(x => x.id === id) || null;
}

/**
 * Calculate net amount transferred TO a saving/debt account in a given month.
 * Positive = money going into saving/debt (expense-like).
 * Negative = money pulled back from saving/debt (negative expense).
 * @param {string} monthKey - Month key in YYYY-MM format (e.g., "2025-03")
 * @param {string} accountId - Wallet account ID
 * @returns {number} Net transfer amount (positive = into account, negative = out of account)
 */
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

/**
 * Calculate total savings/debt payments in a month (for overview: expenses + savings).
 * Positive = money moved from spending to saving/debt (outflow from budget).
 * Negative = money moved from saving/debt back to spending (inflow to budget).
 * @param {string} monthKey - Month key in YYYY-MM format (e.g., "2025-03")
 * @returns {number} Net savings/debt payment amount
 */
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

/**
 * Calculate all-time total savings/debt payments (no month filter).
 * Positive = net money moved from spending to saving/debt.
 * Negative = net money moved from saving/debt back to spending.
 * @returns {number} Net all-time savings/debt payment amount
 */
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

/**
 * Check if a transfer is excluded from budget (same-type transfer).
 * Transfers between accounts of the same type (e.g., spending → spending) don't affect budgets.
 * @param {Transaction} t - Transaction object to check
 * @returns {boolean} True if transfer should be excluded from budget calculations
 */
function _isTransferExcluded(t) {
    if (t.type !== 'transfer') return false;
    const fromType = _getAccType(t.fromAccountId);
    const toType   = _getAccType(t.toAccountId);
    if (!fromType || !toType) return true;
    return fromType === toType;
}

