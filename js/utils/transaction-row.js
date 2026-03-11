/* ══════════════════════════════════════════════
   TRANSACTION ROW BUILDER
   Shared utility for rendering transaction rows
   across Overview, Transactions, Wallet, and
   Bank Import screens
══════════════════════════════════════════════ */

/**
 * Builds HTML for a transaction row with configurable variants
 *
 * @param {Object} transaction - Transaction object from global transactions array
 * @param {Object} options - Configuration options
 * @param {string} options.variant - Row variant: 'full' (with swipe-delete), 'compact' (minimal), 'import' (bank import preview)
 * @param {string} options.onClick - Click handler string (e.g., "showTxSummary(0)")
 * @param {boolean} options.showDelete - Include swipe-to-delete wrapper (for 'full' variant)
 * @param {number} options.index - Transaction index for data-index attribute
 * @param {string} options.customSubtitle - Override default subtitle text
 * @param {string} options.extraClasses - Additional CSS classes for the row container
 * @param {boolean} options.isEditing - If true, skip rendering (for import edit mode)
 * @param {string} options.walletAccountId - For wallet detail view: renders transfers from this account's perspective (outgoing/incoming)
 *
 * @returns {string} HTML string for the transaction row
 *
 * @example
 * // Full variant (transactions.js)
 * buildTransactionRowHTML(tx, {
 *   variant: 'full',
 *   onClick: 'showTxSummary(0)',
 *   showDelete: true,
 *   index: 0
 * })
 *
 * @example
 * // Compact variant (overview.js, wallet.js)
 * buildTransactionRowHTML(tx, {
 *   variant: 'compact',
 *   customSubtitle: 'Today'
 * })
 *
 * @example
 * // Import variant (bank-import.js)
 * buildTransactionRowHTML(tx, {
 *   variant: 'import',
 *   onClick: '_impTapRow(0)',
 *   index: 0
 * })
 */
function buildTransactionRowHTML(transaction, options = {}) {
    const {
        variant = 'compact',
        onClick = '',
        showDelete = false,
        index = null,
        customSubtitle = null,
        extraClasses = '',
        isEditing = false,
        walletAccountId = null
    } = options;

    // Skip rendering if in edit mode (for import preview)
    if (isEditing) return '';

    const t = transaction;
    const isInc  = t.type === 'income';
    const isTrf  = t.type === 'transfer';
    const isExcl = !!t.excluded || !!t._excluded;

    // Build display values based on transaction type
    const displayData = _buildDisplayData(t, isInc, isTrf, isExcl, customSubtitle, walletAccountId);

    // Build row HTML based on variant
    if (variant === 'full') {
        return _buildFullRow(displayData, onClick, index, extraClasses, showDelete);
    } else if (variant === 'import') {
        return _buildImportRow(displayData, onClick, index, isExcl, extraClasses);
    } else {
        return _buildCompactRow(displayData, onClick, extraClasses);
    }
}

/* ── Internal helpers ─────────────────────── */

/**
 * Builds display data (emoji, title, subtitle, amount classes, sign) for a transaction
 * @private
 */
function _buildDisplayData(t, isInc, isTrf, isExcl, customSubtitle, walletAccountId) {
    let emoji, title, subtitle, amtCls, sign;

    if (isTrf) {
        // Transfer transaction
        const fromAcc = _getAccById(t.fromAccountId);
        const toAcc   = _getAccById(t.toAccountId);
        const fromName = fromAcc ? fromAcc.name : '?';
        const toName   = toAcc ? toAcc.name : '?';

        // Wallet-specific transfer rendering (from account's perspective)
        if (walletAccountId) {
            const isOutgoing = t.fromAccountId === walletAccountId;
            const otherAcc = _getAccById(isOutgoing ? t.toAccountId : t.fromAccountId);
            const otherName = otherAcc ? otherAcc.name : '?';
            emoji    = '🔄';
            sign     = isOutgoing ? '\u2212' : '+';
            amtCls   = isOutgoing ? 'text-rose-400' : 'text-emerald-400';
            title    = t.desc || (isOutgoing ? '→ ' + otherName : '← ' + otherName);
            subtitle = customSubtitle || (isOutgoing ? '→ ' + otherName : '← ' + otherName);
        } else {
            // Generic transfer rendering (for overview/transactions)
            emoji    = '🔄';
            sign     = '⇄';
            amtCls   = _isTransferExcluded(t) ? 'text-zinc-600' : 'text-sky-400';
            title    = t.desc || (fromName + ' → ' + toName);
            subtitle = customSubtitle || (fromName + ' → ' + toName);
        }
    } else {
        // Income or Expense transaction
        const iconKey = t.mainCategory + ':' + (t.subCategory || '');
        const linkedAcc = t.walletAccountId ? _getAccById(t.walletAccountId) : null;

        emoji    = isExcl ? '🚫' : (itemIcons[iconKey] || mainEmojis[t.mainCategory] || (isInc ? '💰' : '💸'));
        sign     = isInc ? '+' : '\u2212';
        amtCls   = isExcl ? 'text-zinc-600 line-through' : isInc ? 'text-emerald-400' : 'text-zinc-200';
        title    = t.desc || (t.mainCategory + (t.subCategory ? ' \u00B7 ' + t.subCategory : ''));
        subtitle = customSubtitle || (linkedAcc ? linkedAcc.name : (t.mainCategory || ''));
    }

    return { emoji, title, subtitle, amtCls, sign, amount: parseFloat(t.amount).toFixed(2) };
}

/**
 * Builds a full transaction row with optional swipe-to-delete wrapper
 * Used in transactions.js
 * @private
 */
function _buildFullRow(data, onClick, index, extraClasses, showDelete) {
    const indexAttr = index !== null ? `data-index="${index}"` : '';
    const clickAttr = onClick ? `onclick="${onClick}" style="cursor:pointer"` : '';

    const contentDiv = `<div class="tx-content flex items-center gap-3 px-3 py-2.5" ${clickAttr}>
        <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">${data.emoji}</div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-medium leading-snug truncate">${data.title}</p>
            <p class="text-[11px] text-zinc-600 mt-0.5 truncate">${data.subtitle}</p>
        </div>
        <span class="${data.amtCls} font-semibold text-sm tabular-nums shrink-0">${data.sign}$${data.amount}</span>
    </div>`;

    if (showDelete) {
        // Wrap in tx-item with delete button for swipe functionality
        return `<div class="tx-item mb-1 ${extraClasses}" ${indexAttr}>
            ${contentDiv}
            <div class="tx-delete">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                </svg>
                DELETE
            </div>
        </div>`;
    } else {
        return `<div class="mb-1 ${extraClasses}" ${indexAttr}>${contentDiv}</div>`;
    }
}

/**
 * Builds a compact transaction row (no wrapper)
 * Used in overview.js and wallet.js
 * @private
 */
function _buildCompactRow(data, onClick, extraClasses) {
    const clickAttr = onClick ? `onclick="${onClick}" style="cursor:pointer"` : '';

    return `<div class="flex items-center gap-3 py-2 ${extraClasses}" ${clickAttr}>
        <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">${data.emoji}</div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-medium leading-snug truncate">${data.title}</p>
            <p class="text-[11px] text-zinc-600 mt-0.5">${data.subtitle}</p>
        </div>
        <span class="${data.amtCls} font-semibold text-sm tabular-nums">${data.sign}$${data.amount}</span>
    </div>`;
}

/**
 * Builds an import preview row with special styling
 * Used in bank-import.js
 * @private
 */
function _buildImportRow(data, onClick, index, isExcl, extraClasses) {
    const clickAttr = onClick ? `onclick="${onClick}"` : '';
    const opacityClass = isExcl ? 'opacity-40' : 'active:bg-zinc-800';
    const titleClass = isExcl ? 'line-through' : '';

    return `<div class="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${opacityClass} cursor-pointer ${extraClasses}" ${clickAttr}>
        <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">${data.emoji}</div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-medium leading-snug truncate ${titleClass}">${data.title}</p>
            <p class="text-[11px] text-zinc-500 mt-0.5 truncate">${data.subtitle}</p>
        </div>
        <span class="${data.amtCls} font-semibold text-sm tabular-nums shrink-0">${data.sign}$${data.amount}</span>
    </div>`;
}
