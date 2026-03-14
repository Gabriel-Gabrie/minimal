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
let recurringTransactions = [];

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
let customTemplates = [];

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
/** @type {{dateRange: {start: string|null, end: string|null}, categories: string[], amountRange: {min: number|null, max: number|null}}} Advanced filter state */
let advancedFilters = {
    dateRange: { start: null, end: null },
    categories: [],
    amountRange: { min: null, max: null }
};
/** @type {Array<{id: string, name: string, filters: Object}>} Saved filter presets */
let savedFilters = [];
/** @type {Object|null} Undo data snapshot for transaction deletion */
let _undoData = null;
/** @type {number|null} Undo toast timeout timer ID */
let _undoTimer = null;
/** @type {number|null} Index of transaction currently being edited */
let _editingTxIdx = null;
let _editingRecurringId = null;

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

/* ── Budget Templates ─────────────────────── */

const budgetTemplates = {
    student: {
        name: "Student",
        description: "Budget designed for student life with educational expenses and limited income",
        categories: {
            "Income":         ["Part-time Job", "Student Loans", "Family Support", "Scholarships"],
            "Food":           ["Groceries", "Meal Plan", "Restaurants/Coffee"],
            "Personal":       ["Phone Plan", "Subscriptions", "Entertainment", "Grooming/Haircut", "Laundry"],
            "Household":      ["Rent/Dorm", "Utilities", "Internet"],
            "Transportation": ["Public Transit", "Bike Maintenance", "Ride Share"],
            "Health":         ["Health Insurance", "Medical", "Gym Membership"],
            "Education":      ["Tuition", "Books/Supplies", "Course Materials"],
            "Banking":        ["Bank Fees", "Transfers"],
            "Saving":         ["Emergency Fund", "Future Goals"],
        },
        itemIcons: {
            "Income:Part-time Job":         "💼",
            "Income:Student Loans":         "🎓",
            "Income:Family Support":        "👨‍👩‍👧",
            "Income:Scholarships":          "🏆",
            "Food:Groceries":               "🛒",
            "Food:Meal Plan":               "🍱",
            "Food:Restaurants/Coffee":      "☕",
            "Personal:Phone Plan":          "📱",
            "Personal:Subscriptions":       "📺",
            "Personal:Entertainment":       "🎬",
            "Personal:Grooming/Haircut":    "✂️",
            "Personal:Laundry":             "🧺",
            "Household:Rent/Dorm":          "🏠",
            "Household:Utilities":          "💡",
            "Household:Internet":           "🌐",
            "Transportation:Public Transit": "🚌",
            "Transportation:Bike Maintenance": "🚴",
            "Transportation:Ride Share":    "🚕",
            "Health:Health Insurance":      "🛡️",
            "Health:Medical":               "🏥",
            "Health:Gym Membership":        "🏋️",
            "Education:Tuition":            "🎓",
            "Education:Books/Supplies":     "📚",
            "Education:Course Materials":   "📝",
            "Banking:Bank Fees":            "🏦",
            "Banking:Transfers":            "💸",
            "Saving:Emergency Fund":        "🐷",
            "Saving:Future Goals":          "🎯",
        },
        suggestedBudgets: {
            "Income:Part-time Job":         800,
            "Income:Student Loans":         500,
            "Income:Family Support":        300,
            "Income:Scholarships":          265,
            "Food:Groceries":               200,
            "Food:Meal Plan":               400,
            "Food:Restaurants/Coffee":      80,
            "Personal:Phone Plan":          50,
            "Personal:Subscriptions":       15,
            "Personal:Entertainment":       60,
            "Personal:Grooming/Haircut":    25,
            "Personal:Laundry":             20,
            "Household:Rent/Dorm":          600,
            "Household:Utilities":          40,
            "Household:Internet":           0,
            "Transportation:Public Transit": 80,
            "Transportation:Bike Maintenance": 15,
            "Transportation:Ride Share":    30,
            "Health:Health Insurance":      0,
            "Health:Medical":               30,
            "Health:Gym Membership":        0,
            "Education:Tuition":            0,
            "Education:Books/Supplies":     100,
            "Education:Course Materials":   30,
            "Banking:Bank Fees":            10,
            "Banking:Transfers":            0,
            "Saving:Emergency Fund":        50,
            "Saving:Future Goals":          30,
        }
    },
    youngProfessional: {
        name: "Young Professional",
        description: "Budget for early career professionals building financial independence",
        categories: {
            "Income":         ["Salary", "Bonuses", "Side Hustle", "Investments"],
            "Food":           ["Groceries", "Restaurants/Coffee", "Meal Delivery"],
            "Personal":       ["Phone Plan", "Subscriptions", "Entertainment", "Grooming/Haircut", "Shopping", "Hobbies"],
            "Household":      ["Rent/Mortgage", "Utilities", "Internet", "Furniture", "Supplies"],
            "Transportation": ["Car Payment", "Auto Insurance", "Gas/Charging", "Maintenance", "Parking/Tolls", "Public Transit"],
            "Health":         ["Health Insurance", "Dental Insurance", "Medical", "Gym Membership", "Supplements"],
            "Banking":        ["Bank Fees", "Transfers"],
            "Saving":         ["Emergency Fund", "Retirement", "Down Payment"],
            "Debt":           ["Student Loans", "Credit Cards"],
        },
        itemIcons: {
            "Income:Salary":                "💼",
            "Income:Bonuses":               "💰",
            "Income:Side Hustle":           "💻",
            "Income:Investments":           "📈",
            "Food:Groceries":               "🛒",
            "Food:Restaurants/Coffee":      "☕",
            "Food:Meal Delivery":           "🍕",
            "Personal:Phone Plan":          "📱",
            "Personal:Subscriptions":       "📺",
            "Personal:Entertainment":       "🎬",
            "Personal:Grooming/Haircut":    "✂️",
            "Personal:Shopping":            "🛍️",
            "Personal:Hobbies":             "🎨",
            "Household:Rent/Mortgage":      "🏠",
            "Household:Utilities":          "💡",
            "Household:Internet":           "🌐",
            "Household:Furniture":          "🛋️",
            "Household:Supplies":           "🧹",
            "Transportation:Car Payment":   "🚗",
            "Transportation:Auto Insurance": "🛡️",
            "Transportation:Gas/Charging":  "⛽",
            "Transportation:Maintenance":   "🔧",
            "Transportation:Parking/Tolls": "🅿️",
            "Transportation:Public Transit": "🚌",
            "Health:Health Insurance":      "🛡️",
            "Health:Dental Insurance":      "🦷",
            "Health:Medical":               "🏥",
            "Health:Gym Membership":        "🏋️",
            "Health:Supplements":           "💊",
            "Banking:Bank Fees":            "🏦",
            "Banking:Transfers":            "💸",
            "Saving:Emergency Fund":        "🐷",
            "Saving:Retirement":            "🏖️",
            "Saving:Down Payment":          "🏡",
            "Debt:Student Loans":           "🎓",
            "Debt:Credit Cards":            "💳",
        },
        suggestedBudgets: {
            "Income:Salary":                3500,
            "Income:Bonuses":               500,
            "Income:Side Hustle":           500,
            "Income:Investments":           265,
            "Food:Groceries":               350,
            "Food:Restaurants/Coffee":      200,
            "Food:Meal Delivery":           80,
            "Personal:Phone Plan":          75,
            "Personal:Subscriptions":       45,
            "Personal:Entertainment":       120,
            "Personal:Grooming/Haircut":    60,
            "Personal:Shopping":            150,
            "Personal:Hobbies":             80,
            "Household:Rent/Mortgage":      1200,
            "Household:Utilities":          120,
            "Household:Internet":           60,
            "Household:Furniture":          50,
            "Household:Supplies":           40,
            "Transportation:Car Payment":   350,
            "Transportation:Auto Insurance": 150,
            "Transportation:Gas/Charging":  120,
            "Transportation:Maintenance":   80,
            "Transportation:Parking/Tolls": 40,
            "Transportation:Public Transit": 0,
            "Health:Health Insurance":      200,
            "Health:Dental Insurance":      30,
            "Health:Medical":               60,
            "Health:Gym Membership":        50,
            "Health:Supplements":           40,
            "Banking:Bank Fees":            15,
            "Banking:Transfers":            0,
            "Saving:Emergency Fund":        200,
            "Saving:Retirement":            300,
            "Saving:Down Payment":          150,
            "Debt:Student Loans":           250,
            "Debt:Credit Cards":            100,
        }
    },
    family: {
        name: "Family",
        description: "Comprehensive family budget with children, household, and education expenses",
        categories: {
            "Income":         ["Primary Salary", "Secondary Salary", "Child Benefits", "Investments"],
            "Food":           ["Groceries", "Restaurants/Takeout", "School Lunches"],
            "Personal":       ["Phone Plans", "Subscriptions", "Entertainment", "Grooming", "Clothing"],
            "Household":      ["Rent/Mortgage", "Property Tax", "Utilities", "Internet", "Maintenance", "Supplies", "Furniture"],
            "Transportation": ["Car Payment", "Auto Insurance", "Gas/Charging", "Maintenance", "Parking/Tolls"],
            "Health":         ["Health Insurance", "Dental Insurance", "Medical", "Prescriptions", "Vision"],
            "Children":       ["Childcare", "Activities", "School Supplies", "Allowance", "Education Savings"],
            "Banking":        ["Bank Fees", "Transfers"],
            "Saving":         ["Emergency Fund", "Retirement", "Vacation Fund"],
            "Debt":           ["Mortgage Payment", "Student Loans", "Credit Cards"],
        },
        itemIcons: {
            "Income:Primary Salary":        "💼",
            "Income:Secondary Salary":      "👔",
            "Income:Child Benefits":        "👶",
            "Income:Investments":           "📈",
            "Food:Groceries":               "🛒",
            "Food:Restaurants/Takeout":     "🍔",
            "Food:School Lunches":          "🍱",
            "Personal:Phone Plans":         "📱",
            "Personal:Subscriptions":       "📺",
            "Personal:Entertainment":       "🎬",
            "Personal:Grooming":            "✂️",
            "Personal:Clothing":            "👕",
            "Household:Rent/Mortgage":      "🏠",
            "Household:Property Tax":       "🏘️",
            "Household:Utilities":          "💡",
            "Household:Internet":           "🌐",
            "Household:Maintenance":        "🔨",
            "Household:Supplies":           "🧹",
            "Household:Furniture":          "🛋️",
            "Transportation:Car Payment":   "🚗",
            "Transportation:Auto Insurance": "🛡️",
            "Transportation:Gas/Charging":  "⛽",
            "Transportation:Maintenance":   "🔧",
            "Transportation:Parking/Tolls": "🅿️",
            "Health:Health Insurance":      "🛡️",
            "Health:Dental Insurance":      "🦷",
            "Health:Medical":               "🏥",
            "Health:Prescriptions":         "💊",
            "Health:Vision":                "👓",
            "Children:Childcare":           "👶",
            "Children:Activities":          "⚽",
            "Children:School Supplies":     "📚",
            "Children:Allowance":           "💵",
            "Children:Education Savings":   "🎓",
            "Banking:Bank Fees":            "🏦",
            "Banking:Transfers":            "💸",
            "Saving:Emergency Fund":        "🐷",
            "Saving:Retirement":            "🏖️",
            "Saving:Vacation Fund":         "✈️",
            "Debt:Mortgage Payment":        "🏡",
            "Debt:Student Loans":           "🎓",
            "Debt:Credit Cards":            "💳",
        },
        suggestedBudgets: {
            "Income:Primary Salary":        5000,
            "Income:Secondary Salary":      3500,
            "Income:Child Benefits":        800,
            "Income:Investments":           850,
            "Food:Groceries":               800,
            "Food:Restaurants/Takeout":     250,
            "Food:School Lunches":          100,
            "Personal:Phone Plans":         150,
            "Personal:Subscriptions":       60,
            "Personal:Entertainment":       150,
            "Personal:Grooming":            100,
            "Personal:Clothing":            200,
            "Household:Rent/Mortgage":      2000,
            "Household:Property Tax":       300,
            "Household:Utilities":          200,
            "Household:Internet":           80,
            "Household:Maintenance":        150,
            "Household:Supplies":           80,
            "Household:Furniture":          100,
            "Transportation:Car Payment":   450,
            "Transportation:Auto Insurance": 250,
            "Transportation:Gas/Charging":  200,
            "Transportation:Maintenance":   100,
            "Transportation:Parking/Tolls": 50,
            "Health:Health Insurance":      600,
            "Health:Dental Insurance":      80,
            "Health:Medical":               150,
            "Health:Prescriptions":         100,
            "Health:Vision":                50,
            "Children:Childcare":           1200,
            "Children:Activities":          200,
            "Children:School Supplies":     80,
            "Children:Allowance":           50,
            "Children:Education Savings":   300,
            "Banking:Bank Fees":            20,
            "Banking:Transfers":            0,
            "Saving:Emergency Fund":        400,
            "Saving:Retirement":            500,
            "Saving:Vacation Fund":         200,
            "Debt:Mortgage Payment":        0,
            "Debt:Student Loans":           300,
            "Debt:Credit Cards":            150,
        }
    },
    freelancer: {
        name: "Freelancer",
        description: "Budget for self-employed individuals with irregular income and business expenses",
        categories: {
            "Income":         ["Client Payments", "Recurring Contracts", "Passive Income", "Investments"],
            "Food":           ["Groceries", "Restaurants/Coffee", "Client Meals"],
            "Personal":       ["Phone Plan", "Subscriptions", "Entertainment", "Grooming/Haircut", "Clothing"],
            "Household":      ["Rent/Mortgage", "Utilities", "Internet", "Home Office"],
            "Transportation": ["Car Payment", "Auto Insurance", "Gas/Charging", "Maintenance", "Parking/Tolls"],
            "Health":         ["Health Insurance", "Dental Insurance", "Medical", "Vision"],
            "Business":       ["Software/Tools", "Marketing", "Professional Development", "Equipment", "Office Supplies"],
            "Banking":        ["Bank Fees", "Payment Processing", "Business Account"],
            "Saving":         ["Emergency Fund", "Retirement", "Tax Reserve", "Business Reserve"],
            "Debt":           ["Credit Cards", "Business Loan"],
        },
        itemIcons: {
            "Income:Client Payments":       "💼",
            "Income:Recurring Contracts":   "📋",
            "Income:Passive Income":        "💰",
            "Income:Investments":           "📈",
            "Food:Groceries":               "🛒",
            "Food:Restaurants/Coffee":      "☕",
            "Food:Client Meals":            "🍽️",
            "Personal:Phone Plan":          "📱",
            "Personal:Subscriptions":       "📺",
            "Personal:Entertainment":       "🎬",
            "Personal:Grooming/Haircut":    "✂️",
            "Personal:Clothing":            "👔",
            "Household:Rent/Mortgage":      "🏠",
            "Household:Utilities":          "💡",
            "Household:Internet":           "🌐",
            "Household:Home Office":        "🖥️",
            "Transportation:Car Payment":   "🚗",
            "Transportation:Auto Insurance": "🛡️",
            "Transportation:Gas/Charging":  "⛽",
            "Transportation:Maintenance":   "🔧",
            "Transportation:Parking/Tolls": "🅿️",
            "Health:Health Insurance":      "🛡️",
            "Health:Dental Insurance":      "🦷",
            "Health:Medical":               "🏥",
            "Health:Vision":                "👓",
            "Business:Software/Tools":      "💻",
            "Business:Marketing":           "📢",
            "Business:Professional Development": "📚",
            "Business:Equipment":           "⚙️",
            "Business:Office Supplies":     "📎",
            "Banking:Bank Fees":            "🏦",
            "Banking:Payment Processing":   "💳",
            "Banking:Business Account":     "🏛️",
            "Saving:Emergency Fund":        "🐷",
            "Saving:Retirement":            "🏖️",
            "Saving:Tax Reserve":           "📊",
            "Saving:Business Reserve":      "💼",
            "Debt:Credit Cards":            "💳",
            "Debt:Business Loan":           "🏢",
        },
        suggestedBudgets: {
            "Income:Client Payments":       4500,
            "Income:Recurring Contracts":   2000,
            "Income:Passive Income":        300,
            "Income:Investments":           285,
            "Food:Groceries":               400,
            "Food:Restaurants/Coffee":      150,
            "Food:Client Meals":            100,
            "Personal:Phone Plan":          80,
            "Personal:Subscriptions":       50,
            "Personal:Entertainment":       100,
            "Personal:Grooming/Haircut":    60,
            "Personal:Clothing":            80,
            "Household:Rent/Mortgage":      1400,
            "Household:Utilities":          130,
            "Household:Internet":           80,
            "Household:Home Office":        100,
            "Transportation:Car Payment":   300,
            "Transportation:Auto Insurance": 150,
            "Transportation:Gas/Charging":  100,
            "Transportation:Maintenance":   80,
            "Transportation:Parking/Tolls": 30,
            "Health:Health Insurance":      450,
            "Health:Dental Insurance":      60,
            "Health:Medical":               100,
            "Health:Vision":                40,
            "Business:Software/Tools":      150,
            "Business:Marketing":           200,
            "Business:Professional Development": 100,
            "Business:Equipment":           80,
            "Business:Office Supplies":     50,
            "Banking:Bank Fees":            20,
            "Banking:Payment Processing":   80,
            "Banking:Business Account":     15,
            "Saving:Emergency Fund":        500,
            "Saving:Retirement":            400,
            "Saving:Tax Reserve":           800,
            "Saving:Business Reserve":      300,
            "Debt:Credit Cards":            150,
            "Debt:Business Loan":           200,
        }
    },
};

/* ── Template Application ─────────────────────── */

function applyBudgetTemplate(template) {
    if (!template || !budgetTemplates[template]) return;

    const tmpl = budgetTemplates[template];

    // Check if there's existing data
    const hasData = transactions.length > 0 ||
                    Object.keys(monthlyBudgets).length > 0 ||
                    Object.keys(expenseCategories).length > 0;

    // Show confirmation if data exists
    if (hasData) {
        const msg = `Apply "${tmpl.name}" template?\n\nThis will replace your current budget categories and clear existing budget amounts.\n\nTransactions and wallet accounts will be kept.`;
        if (!confirm(msg)) return;
    }

    // Apply template data
    expenseCategories = { ...tmpl.categories };
    itemIcons = { ...tmpl.itemIcons };

    // Apply suggested budgets to current month if template has them
    if (tmpl.suggestedBudgets) {
        const monthKey = getCurrentMonthKey();
        monthlyBudgets[monthKey] = {};

        // Convert flat "Main:Sub" → amount format to nested structure
        Object.entries(tmpl.suggestedBudgets).forEach(([key, amount]) => {
            const [main, sub] = key.split(':');
            if (!monthlyBudgets[monthKey][main]) {
                monthlyBudgets[monthKey][main] = {};
            }
            monthlyBudgets[monthKey][main][sub] = amount;
        });
    }

    // Sync Income categories
    incomeCats = expenseCategories['Income'] || [];

    // Persist changes
    saveData();
}

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
        transactions, expenseCategories, monthlyBudgets, budgetMonths, itemIcons, walletAccounts, customTemplates, savedFilters,
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
        // Set sync state to 'syncing' when Firestore write begins
        if (typeof setSyncStateSyncing === 'function') setSyncStateSyncing();
        _fbDb.collection('users').doc(user.uid)
            .set({ data: snap, updatedAt: new Date().toISOString() }, { merge: true })
            .then(() => {
                // Set sync state to 'synced' on success
                if (typeof setSyncStateSynced === 'function') setSyncStateSynced();
            })
            .catch(e => {
                console.warn('Firestore write:', e.message);
                // Set sync state to 'failed' on error
                if (typeof setSyncStateFailed === 'function') setSyncStateFailed();
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
    recurringTransactions = d.recurringTransactions || [];
    itemIcons         = d.itemIcons         || {};
    walletAccounts    = d.walletAccounts    || [];
    customTemplates   = d.customTemplates   || [];
    savedFilters      = d.savedFilters      || [];
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
    incomeCats = expenseCategories['Income'] || [];

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
        recurringTransactions: JSON.parse(localStorage.getItem('recurringTransactions')),
        itemIcons:         JSON.parse(localStorage.getItem('itemIcons')),
        walletAccounts:    JSON.parse(localStorage.getItem('walletAccounts')),
        customTemplates:   JSON.parse(localStorage.getItem('customTemplates')),
        savedFilters:      JSON.parse(localStorage.getItem('savedFilters')),
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

/* ── Template CRUD & Apply ────────────────────────────── */

function saveCustomTemplate(template) {
    if (!template.id) {
        template.id = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        template.createdAt = new Date().toISOString();
    }
    template.updatedAt = new Date().toISOString();
    const idx = customTemplates.findIndex(t => t.id === template.id);
    if (idx >= 0) {
        customTemplates[idx] = template;
    } else {
        customTemplates.push(template);
    }
    saveData();
    return template;
}

function deleteCustomTemplate(id) {
    customTemplates = customTemplates.filter(t => t.id !== id);
    saveData();
}

function getTemplateById(id) {
    // Search built-in templates by key
    if (budgetTemplates[id]) return { id, ...budgetTemplates[id] };
    // Search custom templates by id
    return customTemplates.find(t => t.id === id) || null;
}

function applyBudgetTemplate(templateData, targetMonth) {
    // Guard against overwriting existing budget
    if (monthlyBudgets[targetMonth]) return false;

    // Set categories and icons from template
    expenseCategories = JSON.parse(JSON.stringify(templateData.categories));
    itemIcons = JSON.parse(JSON.stringify(templateData.itemIcons || {}));

    // Build budget structure: { main: { sub: amount } }
    monthlyBudgets[targetMonth] = {};
    Object.keys(expenseCategories).forEach(cat => {
        monthlyBudgets[targetMonth][cat] = {};
        expenseCategories[cat].forEach(item => {
            const key = cat + ':' + item;
            monthlyBudgets[targetMonth][cat][item] = templateData.suggestedBudgets[key] || 0;
        });
    });

    // Include dynamic Saving/Debt sections from walletAccounts
    ['Saving', 'Debt'].forEach(secType => {
        const accs = walletAccounts.filter(a => a.type === secType.toLowerCase());
        if (accs.length) {
            if (!monthlyBudgets[targetMonth][secType]) {
                monthlyBudgets[targetMonth][secType] = {};
            }
            accs.forEach(acc => {
                if (!(acc.name in monthlyBudgets[targetMonth][secType])) {
                    monthlyBudgets[targetMonth][secType][acc.name] = 0;
                }
            });
        }
    });

    saveData();
    return true;
}