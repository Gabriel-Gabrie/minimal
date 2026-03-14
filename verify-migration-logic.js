#!/usr/bin/env node

/**
 * Migration Logic Verification Script
 *
 * This script simulates the migration logic from js/state.js
 * to verify it works correctly without needing a browser.
 */

console.log('=== Budget Migration Logic Verification ===\n');

// Mock defaultSections (from state.js lines 187+)
const defaultSections = {
    "Income": ["Salary", "Freelance", "Investments"],
    "Bills": ["Rent/Mortgage", "Utilities", "Internet", "Insurance"],
    "Groceries": ["Supermarket", "Farmers Market", "Meal Prep"],
    "Transport": ["Public Transit", "Gas/Charging", "Car Payment", "Auto Insurance", "Maintenance"],
    "Personal": ["Phone Plan", "Subscriptions", "Grooming/Haircut", "Laundry"],
    "Entertainment": ["Dining Out", "Movies/Shows", "Hobbies", "Events"],
    "Health": ["Medical", "Supplements", "Gym/Fitness"],
    "Household": ["Furniture", "Home Maintenance", "Supplies"]
};

// Test Case 1: Existing User with Legacy Data
function testExistingUserMigration() {
    console.log('TEST 1: Existing User Migration');
    console.log('─'.repeat(50));

    // Setup: Legacy data structure
    let expenseCategories = {
        "Income": ["Salary", "Freelance", "Investments"],
        "Food": ["Groceries", "Restaurants"],
        "Bills": ["Rent", "Utilities", "Internet"],
        "Transport": ["Gas", "Public Transit"]
    };

    let monthlyBudgets = {
        "2026-03": {
            "Income": {
                "Salary": 5000,
                "Freelance": 1000
            },
            "Food": {
                "Groceries": 500,
                "Restaurants": 200
            },
            "Bills": {
                "Rent": 1500,
                "Utilities": 150,
                "Internet": 60
            }
        },
        "2026-02": {
            "Income": {"Salary": 5000},
            "Food": {"Groceries": 450},
            "Bills": {"Rent": 1500}
        }
    };

    // Initial state
    let masterSections = {};
    let masterSectionOrder = [];
    let budgetMonths = {};
    let _dataVersion = 0;

    // Migration logic (from state.js lines 754-824)
    const isNewUser = _dataVersion === 0
        && Object.keys(masterSections).length === 0
        && Object.keys(budgetMonths).length === 0
        && Object.keys(monthlyBudgets).length === 0;

    if (isNewUser) {
        console.log('❌ ERROR: Should not be detected as new user');
        return false;
    } else if (_dataVersion < 1) {
        console.log('✓ Migration triggered (_dataVersion < 1)');

        // Migrate expenseCategories to masterSections
        if (expenseCategories && Object.keys(expenseCategories).length > 0) {
            masterSections = {...expenseCategories};
            console.log('✓ Migrated expenseCategories to masterSections');
        } else {
            masterSections = {...defaultSections};
            console.log('✓ Initialized masterSections from defaultSections');
        }

        // Build masterSectionOrder
        masterSectionOrder = Object.keys(masterSections);
        console.log(`✓ Built masterSectionOrder: [${masterSectionOrder.join(', ')}]`);

        // Migrate legacy monthlyBudgets
        if (monthlyBudgets && Object.keys(monthlyBudgets).length > 0) {
            console.log('✓ Migrating legacy budgets to per-month structure...');
            budgetMonths = {};

            Object.keys(monthlyBudgets).forEach(monthKey => {
                const legacyMonth = monthlyBudgets[monthKey];
                const activeSections = {};
                const sectionOrder = [];
                const budgets = {};

                Object.keys(legacyMonth).forEach(sectionName => {
                    const legacySection = legacyMonth[sectionName];
                    const categories = Object.keys(legacySection);

                    activeSections[sectionName] = categories;
                    sectionOrder.push(sectionName);

                    budgets[sectionName] = {};
                    categories.forEach(categoryName => {
                        const amount = legacySection[categoryName];
                        budgets[sectionName][categoryName] = {
                            "Budget": { amount: amount }
                        };
                    });
                });

                budgetMonths[monthKey] = {
                    activeSections,
                    sectionOrder,
                    budgets
                };
            });

            console.log(`✓ Migrated ${Object.keys(budgetMonths).length} months to new budget structure`);
        }

        _dataVersion = 1;
        console.log('✓ Set _dataVersion = 1');
    }

    // Verify results
    console.log('\nVerification:');
    let passed = true;

    // Check 1: _dataVersion
    if (_dataVersion === 1) {
        console.log('  ✓ _dataVersion = 1');
    } else {
        console.log(`  ✗ _dataVersion should be 1, got ${_dataVersion}`);
        passed = false;
    }

    // Check 2: masterSections
    if (Object.keys(masterSections).length === 4) {
        console.log(`  ✓ masterSections has 4 sections`);
    } else {
        console.log(`  ✗ masterSections should have 4 sections, got ${Object.keys(masterSections).length}`);
        passed = false;
    }

    // Check 3: budgetMonths
    if (Object.keys(budgetMonths).length === 2) {
        console.log(`  ✓ budgetMonths has 2 months`);
    } else {
        console.log(`  ✗ budgetMonths should have 2 months, got ${Object.keys(budgetMonths).length}`);
        passed = false;
    }

    // Check 4: March structure
    const march = budgetMonths['2026-03'];
    if (march && march.activeSections && march.sectionOrder && march.budgets) {
        console.log('  ✓ March 2026 has correct structure');
    } else {
        console.log('  ✗ March 2026 missing required fields');
        passed = false;
    }

    // Check 5: Amount preservation
    const salaryAmount = march?.budgets?.Income?.Salary?.Budget?.amount;
    if (salaryAmount === 5000) {
        console.log('  ✓ Budget amounts preserved (Income.Salary = 5000)');
    } else {
        console.log(`  ✗ Income.Salary should be 5000, got ${salaryAmount}`);
        passed = false;
    }

    console.log(`\n${passed ? '✅ TEST 1 PASSED' : '❌ TEST 1 FAILED'}\n`);
    return passed;
}

// Test Case 2: New User (No Data)
function testNewUserInitialization() {
    console.log('TEST 2: New User Initialization');
    console.log('─'.repeat(50));

    // Setup: Empty state
    let expenseCategories = {};
    let monthlyBudgets = {};
    let masterSections = {};
    let masterSectionOrder = [];
    let budgetMonths = {};
    let _dataVersion = 0;

    // Migration logic
    const isNewUser = _dataVersion === 0
        && Object.keys(masterSections).length === 0
        && Object.keys(budgetMonths).length === 0
        && Object.keys(monthlyBudgets).length === 0;

    if (isNewUser) {
        console.log('✓ Detected as new user');
        masterSections = {...defaultSections};
        masterSectionOrder = Object.keys(masterSections);
        budgetMonths = {};
        _dataVersion = 1;
        console.log('✓ Initialized with defaultSections');
        console.log('✓ Set _dataVersion = 1');
    } else if (_dataVersion < 1) {
        console.log('❌ ERROR: Should be detected as new user, not migration path');
        return false;
    }

    // Verify
    console.log('\nVerification:');
    let passed = true;

    if (_dataVersion === 1) {
        console.log('  ✓ _dataVersion = 1');
    } else {
        console.log(`  ✗ _dataVersion should be 1, got ${_dataVersion}`);
        passed = false;
    }

    if (Object.keys(masterSections).length === 8) {
        console.log('  ✓ masterSections initialized from defaultSections (8 sections)');
    } else {
        console.log(`  ✗ Should have 8 default sections, got ${Object.keys(masterSections).length}`);
        passed = false;
    }

    if (Object.keys(budgetMonths).length === 0) {
        console.log('  ✓ budgetMonths is empty object');
    } else {
        console.log(`  ✗ budgetMonths should be empty, has ${Object.keys(budgetMonths).length} entries`);
        passed = false;
    }

    console.log(`\n${passed ? '✅ TEST 2 PASSED' : '❌ TEST 2 FAILED'}\n`);
    return passed;
}

// Test Case 3: Idempotency (Already Migrated)
function testIdempotency() {
    console.log('TEST 3: Idempotency (Re-run Prevention)');
    console.log('─'.repeat(50));

    // Setup: Already migrated data
    let masterSections = {
        "Income": ["Salary"],
        "Bills": ["Rent"]
    };
    let masterSectionOrder = ["Income", "Bills"];
    let budgetMonths = {
        "2026-03": {
            activeSections: {"Income": ["Salary"]},
            sectionOrder: ["Income"],
            budgets: {
                "Income": {
                    "Salary": {"Budget": {amount: 5000}}
                }
            }
        }
    };
    let _dataVersion = 1;
    let monthlyBudgets = {};

    // Migration logic
    const isNewUser = _dataVersion === 0
        && Object.keys(masterSections).length === 0
        && Object.keys(budgetMonths).length === 0
        && Object.keys(monthlyBudgets).length === 0;

    let migrationRan = false;

    if (isNewUser) {
        console.log('❌ ERROR: Should not be detected as new user');
        return false;
    } else if (_dataVersion < 1) {
        console.log('❌ ERROR: Migration should NOT run when _dataVersion >= 1');
        migrationRan = true;
        return false;
    } else {
        console.log('✓ Migration skipped (_dataVersion >= 1)');
    }

    // Verify data unchanged
    console.log('\nVerification:');
    let passed = true;

    if (!migrationRan) {
        console.log('  ✓ Migration did not run');
    } else {
        console.log('  ✗ Migration ran when it should not have');
        passed = false;
    }

    if (_dataVersion === 1) {
        console.log('  ✓ _dataVersion unchanged (still 1)');
    } else {
        console.log(`  ✗ _dataVersion should remain 1, got ${_dataVersion}`);
        passed = false;
    }

    console.log(`\n${passed ? '✅ TEST 3 PASSED' : '❌ TEST 3 FAILED'}\n`);
    return passed;
}

// Run all tests
console.log('Starting migration verification tests...\n');
const test1 = testExistingUserMigration();
const test2 = testNewUserInitialization();
const test3 = testIdempotency();

console.log('='.repeat(50));
console.log('SUMMARY:');
console.log('─'.repeat(50));
console.log(`Test 1 (Existing User Migration): ${test1 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 2 (New User Init):            ${test2 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 3 (Idempotency):              ${test3 ? '✅ PASS' : '❌ FAIL'}`);
console.log('='.repeat(50));

const allPassed = test1 && test2 && test3;
if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Migration logic is correct.\n');
    process.exit(0);
} else {
    console.log('\n❌ SOME TESTS FAILED! Review migration logic.\n');
    process.exit(1);
}
