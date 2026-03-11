/**
 * Service Worker Offline Verification Script
 *
 * This script can be run in the browser console to verify that the service worker
 * is properly caching transaction-row.js and that the app works offline.
 *
 * Usage:
 * 1. Open http://localhost:8000 in browser
 * 2. Open DevTools console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter to run
 */

(async function verifyOfflineSupport() {
    console.log('🔍 Starting Service Worker Offline Verification...\n');

    const results = {
        passed: [],
        failed: [],
        warnings: []
    };

    // Check 1: Service Worker Registration
    console.log('📋 Check 1: Service Worker Registration');
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            console.log('✅ Service Worker is registered');
            console.log(`   Scope: ${registration.scope}`);
            console.log(`   Active: ${registration.active ? 'Yes' : 'No'}`);
            results.passed.push('Service Worker registered and active');
        } else {
            console.log('❌ Service Worker is NOT registered');
            results.failed.push('Service Worker not registered');
        }
    } else {
        console.log('❌ Service Worker API not supported');
        results.failed.push('Service Worker API not supported in this browser');
    }

    console.log('');

    // Check 2: Cache Storage
    console.log('📋 Check 2: Cache Storage');
    const cacheNames = await caches.keys();
    console.log(`   Found ${cacheNames.length} cache(s): ${cacheNames.join(', ')}`);

    const targetCache = cacheNames.find(name => name.includes('minimal'));
    if (targetCache) {
        console.log(`✅ Found app cache: ${targetCache}`);
        results.passed.push(`Cache found: ${targetCache}`);

        // Check 3: transaction-row.js in cache
        console.log('');
        console.log('📋 Check 3: transaction-row.js Cached');
        const cache = await caches.open(targetCache);
        const cachedRequests = await cache.keys();

        const transactionRowCached = cachedRequests.some(req =>
            req.url.includes('transaction-row.js')
        );

        if (transactionRowCached) {
            console.log('✅ transaction-row.js IS cached');
            results.passed.push('transaction-row.js found in cache');

            // Get the cached file to verify it's not corrupt
            const response = await cache.match('/js/utils/transaction-row.js');
            if (response) {
                const text = await response.text();
                if (text.includes('buildTransactionRowHTML')) {
                    console.log('✅ Cached file contains buildTransactionRowHTML function');
                    results.passed.push('Cached file is valid and complete');
                } else {
                    console.log('⚠️  Cached file may be corrupt (missing expected function)');
                    results.warnings.push('Cached file validation concern');
                }
            }
        } else {
            console.log('❌ transaction-row.js is NOT cached');
            results.failed.push('transaction-row.js missing from cache');
        }

        // Check 4: Other critical assets
        console.log('');
        console.log('📋 Check 4: Other Critical Assets');
        const criticalAssets = [
            'state.js',
            'app.js',
            'overview.js',
            'transactions.js',
            'wallet.js',
            'base.css'
        ];

        const missingAssets = [];
        for (const asset of criticalAssets) {
            const isCached = cachedRequests.some(req => req.url.includes(asset));
            if (isCached) {
                console.log(`   ✅ ${asset}`);
            } else {
                console.log(`   ❌ ${asset} - MISSING`);
                missingAssets.push(asset);
            }
        }

        if (missingAssets.length === 0) {
            results.passed.push('All critical assets cached');
        } else {
            results.failed.push(`Missing assets: ${missingAssets.join(', ')}`);
        }

        console.log(`   Total cached files: ${cachedRequests.length}`);

    } else {
        console.log('❌ No app cache found');
        results.failed.push('App cache not found');
    }

    // Check 5: buildTransactionRowHTML availability
    console.log('');
    console.log('📋 Check 5: buildTransactionRowHTML Function');
    if (typeof buildTransactionRowHTML === 'function') {
        console.log('✅ buildTransactionRowHTML is defined and callable');
        results.passed.push('buildTransactionRowHTML function available');

        // Try to call it with test data
        try {
            const testTransaction = {
                id: 'test',
                date: '2026-03-10',
                type: 'expense',
                main: 'Food',
                sub: 'Groceries',
                amount: 50,
                wallet: 'Cash',
                note: 'Test transaction'
            };
            const html = buildTransactionRowHTML(testTransaction, { variant: 'compact' });
            if (html && html.includes('Food')) {
                console.log('✅ Function executes successfully with test data');
                results.passed.push('Function execution test passed');
            } else {
                console.log('⚠️  Function executed but output may be incorrect');
                results.warnings.push('Function output validation concern');
            }
        } catch (e) {
            console.log(`❌ Function threw error: ${e.message}`);
            results.failed.push(`Function error: ${e.message}`);
        }
    } else {
        console.log('❌ buildTransactionRowHTML is NOT defined');
        results.failed.push('buildTransactionRowHTML function not available');
    }

    // Summary
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📊 VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Passed: ${results.passed.length}`);
    results.passed.forEach(item => console.log(`   • ${item}`));

    if (results.warnings.length > 0) {
        console.log(`\n⚠️  Warnings: ${results.warnings.length}`);
        results.warnings.forEach(item => console.log(`   • ${item}`));
    }

    if (results.failed.length > 0) {
        console.log(`\n❌ Failed: ${results.failed.length}`);
        results.failed.forEach(item => console.log(`   • ${item}`));
    }

    console.log('');

    if (results.failed.length === 0) {
        console.log('🎉 ALL CHECKS PASSED!');
        console.log('');
        console.log('Next steps for offline testing:');
        console.log('1. Open DevTools → Network tab');
        console.log('2. Enable "Offline" mode');
        console.log('3. Reload the page (Ctrl+R)');
        console.log('4. Verify the app loads and all transaction rows render');
        console.log('5. Test all tabs: Overview, Transactions, Wallet, Budgets');
        return true;
    } else {
        console.log('⚠️  VERIFICATION FAILED - See failures above');
        console.log('');
        console.log('Troubleshooting:');
        console.log('1. Ensure server is running (http://localhost:8000)');
        console.log('2. Force reload (Ctrl+Shift+R) to register service worker');
        console.log('3. Check DevTools → Application → Service Workers');
        console.log('4. Unregister old service workers if needed');
        console.log('5. Clear cache and reload');
        return false;
    }
})();
