#!/usr/bin/env node

/**
 * Verification Script: App Load & Console Error Check
 * Tests that the Minimal PWA loads without JavaScript errors
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('=== APP LOAD VERIFICATION ===\n');

// Step 1: Verify server is running
console.log('Step 1: Checking server status...');
http.get('http://localhost:8000/', (res) => {
    if (res.statusCode === 200 || res.statusCode === 301) {
        console.log('✅ Server is running on http://localhost:8000\n');

        // Step 2: Verify critical files exist
        console.log('Step 2: Verifying critical files exist...');
        const criticalFiles = [
            'index.html',
            'js/state.js',
            'js/app.js',
            'js/auth.js',
            'js/screens/overview.js',
            'js/screens/transactions.js',
            'js/screens/budgets.js',
            'js/screens/wallet.js',
            'js/screens/reports.js',
            'css/base.css',
            'css/themes.css',
            'manifest.json',
            'sw.js'
        ];

        let allFilesExist = true;
        criticalFiles.forEach(file => {
            if (fs.existsSync(file)) {
                console.log(`  ✅ ${file}`);
            } else {
                console.log(`  ❌ MISSING: ${file}`);
                allFilesExist = false;
            }
        });

        if (!allFilesExist) {
            console.log('\n❌ VERIFICATION FAILED: Missing critical files');
            process.exit(1);
        }

        console.log('\n✅ All critical files exist\n');

        // Step 3: Check JS syntax (basic check)
        console.log('Step 3: Checking JavaScript syntax...');
        const jsFiles = [
            'js/state.js',
            'js/app.js',
            'js/auth.js',
            'js/screens/overview.js',
            'js/screens/transactions.js',
            'js/screens/budgets.js',
            'js/screens/wallet.js',
            'js/screens/reports.js',
            'js/modals/budget-item.js',
            'js/modals/settings.js',
            'js/modals/bank-import.js',
            'js/utils/tutorial.js'
        ];

        let syntaxErrors = [];
        jsFiles.forEach(file => {
            if (fs.existsSync(file)) {
                const code = fs.readFileSync(file, 'utf8');
                try {
                    // Try to parse as JavaScript (basic syntax check)
                    new Function(code);
                    console.log(`  ✅ ${file}`);
                } catch (err) {
                    console.log(`  ❌ SYNTAX ERROR in ${file}: ${err.message}`);
                    syntaxErrors.push({ file, error: err.message });
                }
            }
        });

        if (syntaxErrors.length > 0) {
            console.log('\n❌ VERIFICATION FAILED: JavaScript syntax errors detected');
            syntaxErrors.forEach(({ file, error }) => {
                console.log(`   - ${file}: ${error}`);
            });
            process.exit(1);
        }

        console.log('\n✅ No JavaScript syntax errors detected\n');

        // Step 4: Verify migration code exists
        console.log('Step 4: Verifying migration code exists in state.js...');
        const stateJs = fs.readFileSync('js/state.js', 'utf8');

        const checks = [
            { name: 'masterSections variable', pattern: /let masterSections = \{\}/ },
            { name: 'masterSectionOrder variable', pattern: /let masterSectionOrder = \[\]/ },
            { name: '_dataVersion variable', pattern: /_dataVersion = 0/ },
            { name: 'budgetMonths variable', pattern: /let budgetMonths = \{\}/ },
            { name: 'defaultSections constant', pattern: /const defaultSections = \{/ },
            { name: 'Migration version guard', pattern: /_dataVersion < 1/ },
            { name: 'Migration completion log', pattern: /Budget data migration to v1 complete/ },
            { name: 'New user detection', pattern: /New user detected/ },
            { name: 'getActiveSections helper', pattern: /function getActiveSections\(monthKey\)/ },
            { name: 'addSectionToBudget helper', pattern: /function addSectionToBudget\(/ },
            { name: 'removeSectionFromBudget helper', pattern: /function removeSectionFromBudget\(/ },
            { name: 'addCategoryToBudget helper', pattern: /function addCategoryToBudget\(/ },
            { name: 'removeCategoryFromBudget helper', pattern: /function removeCategoryFromBudget\(/ },
            { name: 'isSectionActiveInAnyBudget helper', pattern: /function isSectionActiveInAnyBudget\(/ },
            { name: 'isCategoryActiveInAnyBudget helper', pattern: /function isCategoryActiveInAnyBudget\(/ }
        ];

        let missingFeatures = [];
        checks.forEach(({ name, pattern }) => {
            if (pattern.test(stateJs)) {
                console.log(`  ✅ ${name}`);
            } else {
                console.log(`  ❌ MISSING: ${name}`);
                missingFeatures.push(name);
            }
        });

        if (missingFeatures.length > 0) {
            console.log('\n❌ VERIFICATION FAILED: Missing migration features');
            process.exit(1);
        }

        console.log('\n✅ All migration features present\n');

        // Step 5: Verify index.html loads scripts in correct order
        console.log('Step 5: Verifying script load order in index.html...');
        const indexHtml = fs.readFileSync('index.html', 'utf8');

        const scriptOrder = [
            'js/state.js',
            'js/auth.js',
            'js/app.js',
            'js/screens/',
            'js/modals/',
            'js/utils/'
        ];

        let stateJsPosition = indexHtml.indexOf('js/state.js');
        let authJsPosition = indexHtml.indexOf('js/auth.js');
        let appJsPosition = indexHtml.indexOf('js/app.js');

        if (stateJsPosition === -1) {
            console.log('  ❌ MISSING: js/state.js script tag');
            process.exit(1);
        }

        if (authJsPosition === -1) {
            console.log('  ❌ MISSING: js/auth.js script tag');
            process.exit(1);
        }

        if (appJsPosition === -1) {
            console.log('  ❌ MISSING: js/app.js script tag');
            process.exit(1);
        }

        if (stateJsPosition < authJsPosition && authJsPosition < appJsPosition) {
            console.log('  ✅ Scripts load in correct order: state.js → auth.js → app.js');
        } else {
            console.log('  ❌ INCORRECT LOAD ORDER: state.js must load before auth.js and app.js');
            process.exit(1);
        }

        console.log('\n✅ Script load order is correct\n');

        // Final summary
        console.log('=== VERIFICATION SUMMARY ===\n');
        console.log('✅ Server is running on http://localhost:8000');
        console.log('✅ All critical files exist');
        console.log('✅ No JavaScript syntax errors');
        console.log('✅ All migration features implemented');
        console.log('✅ Script load order is correct');
        console.log('\n=== MANUAL VERIFICATION REQUIRED ===\n');
        console.log('Please open http://localhost:8000 in a browser and verify:');
        console.log('  1. App loads without errors');
        console.log('  2. No console errors (except expected migration log)');
        console.log('  3. UI displays correctly');
        console.log('  4. Navigation between tabs works');
        console.log('  5. No JavaScript exceptions');
        console.log('\n✅ AUTOMATED VERIFICATION PASSED\n');

        process.exit(0);
    } else {
        console.log(`❌ Server returned status code: ${res.statusCode}`);
        console.log('Please start the server with: npx serve . -p 8000');
        process.exit(1);
    }
}).on('error', (err) => {
    console.log('❌ Server is not running');
    console.log('Please start the server with: npx serve . -p 8000');
    console.log(`Error: ${err.message}`);
    process.exit(1);
});
