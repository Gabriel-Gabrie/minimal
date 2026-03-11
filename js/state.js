/* ══════════════════════════════════════════════
   STATE — Data model, defaults, persistence
══════════════════════════════════════════════ */

let transactions = [];
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
            "Income:Student Loans":         0,
            "Income:Family Support":        0,
            "Income:Scholarships":          0,
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
            "Income:Bonuses":               0,
            "Income:Side Hustle":           0,
            "Income:Investments":           0,
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
            "Income:Primary Salary":        4500,
            "Income:Secondary Salary":      3000,
            "Income:Child Benefits":        500,
            "Income:Investments":           0,
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
            "Income:Client Payments":       4000,
            "Income:Recurring Contracts":   1500,
            "Income:Passive Income":        0,
            "Income:Investments":           0,
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
    retiree: {
        name: "Retiree",
        description: "Budget for retirees living on pension and retirement savings",
        categories: {
            "Income":         ["Pension", "Social Security", "Retirement Withdrawals", "Investments"],
            "Food":           ["Groceries", "Restaurants/Dining"],
            "Personal":       ["Phone Plan", "Subscriptions", "Entertainment", "Hobbies", "Grooming"],
            "Household":      ["Rent/Mortgage", "Property Tax", "Utilities", "Internet", "Maintenance", "Supplies"],
            "Transportation": ["Car Payment", "Auto Insurance", "Gas/Charging", "Maintenance"],
            "Health":         ["Health Insurance", "Dental Insurance", "Prescriptions", "Medical", "Vision", "Supplements"],
            "Travel":         ["Vacations", "Visits to Family", "Tours/Excursions"],
            "Banking":        ["Bank Fees", "Transfers"],
            "Saving":         ["Emergency Fund", "Legacy/Gifts"],
        },
        itemIcons: {
            "Income:Pension":               "💰",
            "Income:Social Security":       "🏛️",
            "Income:Retirement Withdrawals": "🏖️",
            "Income:Investments":           "📈",
            "Food:Groceries":               "🛒",
            "Food:Restaurants/Dining":      "🍽️",
            "Personal:Phone Plan":          "📱",
            "Personal:Subscriptions":       "📺",
            "Personal:Entertainment":       "🎬",
            "Personal:Hobbies":             "🎨",
            "Personal:Grooming":            "✂️",
            "Household:Rent/Mortgage":      "🏠",
            "Household:Property Tax":       "🏘️",
            "Household:Utilities":          "💡",
            "Household:Internet":           "🌐",
            "Household:Maintenance":        "🔨",
            "Household:Supplies":           "🧹",
            "Transportation:Car Payment":   "🚗",
            "Transportation:Auto Insurance": "🛡️",
            "Transportation:Gas/Charging":  "⛽",
            "Transportation:Maintenance":   "🔧",
            "Health:Health Insurance":      "🛡️",
            "Health:Dental Insurance":      "🦷",
            "Health:Prescriptions":         "💊",
            "Health:Medical":               "🏥",
            "Health:Vision":                "👓",
            "Health:Supplements":           "🌿",
            "Travel:Vacations":             "✈️",
            "Travel:Visits to Family":      "👨‍👩‍👧‍👦",
            "Travel:Tours/Excursions":      "🗺️",
            "Banking:Bank Fees":            "🏦",
            "Banking:Transfers":            "💸",
            "Saving:Emergency Fund":        "🐷",
            "Saving:Legacy/Gifts":          "🎁",
        },
        suggestedBudgets: {
            "Income:Pension":               2500,
            "Income:Social Security":       1800,
            "Income:Retirement Withdrawals": 1000,
            "Income:Investments":           0,
            "Food:Groceries":               400,
            "Food:Restaurants/Dining":      200,
            "Personal:Phone Plan":          70,
            "Personal:Subscriptions":       40,
            "Personal:Entertainment":       100,
            "Personal:Hobbies":             150,
            "Personal:Grooming":            60,
            "Household:Rent/Mortgage":      1200,
            "Household:Property Tax":       300,
            "Household:Utilities":          180,
            "Household:Internet":           70,
            "Household:Maintenance":        200,
            "Household:Supplies":           60,
            "Transportation:Car Payment":   0,
            "Transportation:Auto Insurance": 120,
            "Transportation:Gas/Charging":  100,
            "Transportation:Maintenance":   80,
            "Health:Health Insurance":      400,
            "Health:Dental Insurance":      60,
            "Health:Prescriptions":         200,
            "Health:Medical":               150,
            "Health:Vision":                50,
            "Health:Supplements":           80,
            "Travel:Vacations":             300,
            "Travel:Visits to Family":      150,
            "Travel:Tours/Excursions":      100,
            "Banking:Bank Fees":            15,
            "Banking:Transfers":            0,
            "Saving:Emergency Fund":        200,
            "Saving:Legacy/Gifts":          100,
        }
    }
};

/* ── Persistence helpers ─────────────────────── */

// Write to localStorage (always) + Firestore (debounced, when signed in)
let _saveTimer = null;
function saveData() {
    if (_demoMode) return; // never persist demo data
    const snap = {
        transactions, expenseCategories, monthlyBudgets, itemIcons, walletAccounts,
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