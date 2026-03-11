/* ══════════════════════════════════════════════
   TEMPLATE MANAGEMENT MODAL
   Handles budget template browsing, CRUD operations,
   and template application workflows.
══════════════════════════════════════════════ */
// ── SHOW / HIDE ──────────────────────────────────────
function showTemplateManagement() {
    document.getElementById('template-management-modal').classList.remove('hidden');
    _renderTemplateList();
}
function hideTemplateManagement() {
    document.getElementById('template-management-modal').classList.add('hidden');
}
// ── TEMPLATE LIST VIEW (Subtask 3-1) ────────────────
function _renderTemplateList() {
    const content = document.getElementById('template-content');
    // Header
    let html = '<div class="pt-3 pb-5">'
        + '<h2 class="text-xl font-semibold tracking-tight mb-1">Budget Templates</h2>'
        + '<p class="text-sm text-zinc-500">Choose a template or create your own</p>'
        + '</div>';
    // Built-in templates section
    html += '<div class="mb-6">'
        + '<div class="text-[10px] font-black tracking-[.14em] text-zinc-600 uppercase mb-3">Built-in Templates</div>'
        + '<div class="grid grid-cols-2 gap-3">';
    // Iterate built-in templates (from state.js budgetTemplates object)
    const builtInKeys = ['student', 'youngProfessional', 'family', 'freelancer'];
    const builtInEmojis = {
        student: '🎓',
        youngProfessional: '💼',
        family: '👨‍👩‍👧‍👦',
        freelancer: '💻'
    };
    builtInKeys.forEach(key => {
        const t = budgetTemplates[key];
        if (!t) return;
        const categoryCount = Object.keys(t.categories).length;
        const subcategoryCount = Object.values(t.categories).reduce((sum, arr) => sum + arr.length, 0);
        html += '<div class="bg-zinc-800 rounded-2xl p-4 flex flex-col gap-2">'
            + '<div class="text-2xl">' + builtInEmojis[key] + '</div>'
            + '<div class="text-sm font-semibold text-zinc-100">' + t.name + '</div>'
            + '<p class="text-xs text-zinc-500 leading-relaxed flex-1">' + t.description + '</p>'
            + '<div class="text-[10px] text-zinc-600">' + categoryCount + ' categories · ' + subcategoryCount + ' items</div>'
            + '<div class="flex gap-2 mt-2">'
            + '<button onclick="_showTemplateDetail(\'' + key + '\')" class="flex-1 bg-zinc-700 hover:bg-zinc-600 active:scale-95 text-white font-semibold py-2 rounded-xl text-xs transition-all">View</button>'
            + '<button onclick="_applyTemplateFromManagement(\'' + key + '\')" class="flex-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-2 rounded-xl text-xs transition-all">Apply</button>'
            + '</div>'
            + '</div>';
    });
    html += '</div></div>'; // Close grid + built-in section
    // Custom templates section
    html += '<div class="mb-6">'
        + '<div class="flex items-center justify-between mb-3">'
        + '<div class="text-[10px] font-black tracking-[.14em] text-zinc-600 uppercase">Custom Templates</div>'
        + '<button onclick="_showTemplateForm()" class="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">+ Create Template</button>'
        + '</div>';
    if (customTemplates.length === 0) {
        html += '<div class="bg-zinc-900 rounded-2xl p-6 text-center">'
            + '<div class="text-3xl mb-2">💡</div>'
            + '<p class="text-sm text-zinc-500">No custom templates yet</p>'
            + '<p class="text-xs text-zinc-600 mt-1">Create one to match your unique needs</p>'
            + '</div>';
    } else {
        html += '<div class="grid grid-cols-2 gap-3">';
        customTemplates.forEach(t => {
            const categoryCount = Object.keys(t.categories).length;
            const subcategoryCount = Object.values(t.categories).reduce((sum, arr) => sum + arr.length, 0);
            // Get first emoji from itemIcons or use default
            const firstEmoji = Object.values(t.itemIcons)[0] || '📊';
            html += '<div class="bg-zinc-800 rounded-2xl p-4 flex flex-col gap-2">'
                + '<div class="text-2xl">' + firstEmoji + '</div>'
                + '<div class="text-sm font-semibold text-zinc-100">' + t.name + '</div>'
                + '<p class="text-xs text-zinc-500 leading-relaxed flex-1">' + (t.description || 'Custom budget template') + '</p>'
                + '<div class="text-[10px] text-zinc-600">' + categoryCount + ' categories · ' + subcategoryCount + ' items</div>'
                + '<div class="flex gap-2 mt-2">'
                + '<button onclick="_showTemplateDetail(\'' + t.id + '\')" class="flex-1 bg-zinc-700 hover:bg-zinc-600 active:scale-95 text-white font-semibold py-2 rounded-xl text-xs transition-all">View</button>'
                + '<button onclick="_applyTemplateFromManagement(\'' + t.id + '\')" class="flex-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-2 rounded-xl text-xs transition-all">Apply</button>'
                + '</div>'
                + '<div class="flex gap-2">'
                + '<button onclick="_showTemplateForm(\'' + t.id + '\')" class="flex-1 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-400 font-semibold py-2 rounded-xl text-xs transition-all">Edit</button>'
                + '<button onclick="_deleteTemplate(\'' + t.id + '\')" class="flex-1 bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 text-rose-400 font-semibold py-2 rounded-xl text-xs transition-all">Delete</button>'
                + '</div>'
                + '</div>';
        });
        html += '</div>';
    }
    html += '</div>'; // Close custom templates section
    content.innerHTML = html;
}
// ── TEMPLATE DETAIL VIEW (Subtask 3-2) ──────────────
function _showTemplateDetail(templateId) {
    const content = document.getElementById('template-content');
    const template = getTemplateById(templateId);
    if (!template) {
        content.innerHTML = '<div class="py-8 text-center text-zinc-500">Template not found</div>';
        return;
    }
    const isCustom = templateId.startsWith('custom_');
    const categoryCount = Object.keys(template.categories).length;
    const subcategoryCount = Object.values(template.categories).reduce((sum, arr) => sum + arr.length, 0);
    // Header
    let html = '<div class="pt-3 pb-5">'
        + '<button onclick="_renderTemplateList()" class="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-4 transition-colors">'
        + '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>'
        + 'Back to Templates'
        + '</button>'
        + '<h2 class="text-xl font-semibold tracking-tight mb-1">' + template.name + '</h2>'
        + '<p class="text-sm text-zinc-500 mb-3">' + template.description + '</p>'
        + '<div class="text-xs text-zinc-600">' + categoryCount + ' categories · ' + subcategoryCount + ' items</div>'
        + '</div>';
    // Action buttons
    html += '<div class="flex gap-2 mb-6">'
        + '<button onclick="_applyTemplateFromManagement(\'' + templateId + '\')" class="flex-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-3 rounded-xl text-sm transition-all">Apply to Month</button>';
    if (isCustom) {
        html += '<button onclick="_showTemplateForm(\'' + templateId + '\')" class="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold py-3 rounded-xl text-sm transition-all">Edit Template</button>';
    }
    html += '</div>';
    // Category breakdown
    html += '<div class="space-y-4">';
    Object.keys(template.categories).forEach(categoryName => {
        const subcategories = template.categories[categoryName];
        html += '<div class="bg-zinc-900 rounded-2xl p-4">'
            + '<div class="font-semibold text-sm mb-3 text-zinc-100">' + categoryName + '</div>'
            + '<div class="space-y-2">';
        subcategories.forEach(subcat => {
            const key = categoryName + ':' + subcat;
            const icon = template.itemIcons[key] || '•';
            const amount = template.suggestedBudgets[key] || 0;
            const amountStr = amount > 0 ? '$' + amount.toLocaleString() : '—';
            html += '<div class="flex items-center justify-between py-1.5">'
                + '<div class="flex items-center gap-2 flex-1 min-w-0">'
                + '<span class="text-base">' + icon + '</span>'
                + '<span class="text-xs text-zinc-400 truncate">' + subcat + '</span>'
                + '</div>'
                + '<span class="text-xs font-semibold text-zinc-300 ml-3">' + amountStr + '</span>'
                + '</div>';
        });
        html += '</div></div>';
    });
    html += '</div>';
    content.innerHTML = html;
}
// ── CREATE/EDIT TEMPLATE FORM (Subtask 3-3) ─────────
function _showTemplateForm(templateId = null) {
    const content = document.getElementById('template-content');
    const isEdit = templateId !== null && templateId !== undefined;
    const template = isEdit ? getTemplateById(templateId) : null;
    // Header
    let html = '<div class="pt-3 pb-5">'
        + '<button onclick="_renderTemplateList()" class="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-4 transition-colors">'
        + '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>'
        + 'Back to Templates'
        + '</button>'
        + '<h2 class="text-xl font-semibold tracking-tight mb-1">' + (isEdit ? 'Edit Template' : 'Create Template') + '</h2>'
        + '<p class="text-sm text-zinc-500">Define categories, items, and suggested amounts</p>'
        + '</div>';
    // Form
    html += '<form id="template-form" class="space-y-5">';
    // Name
    html += '<div>'
        + '<label class="block text-xs font-semibold text-zinc-400 mb-2">Template Name</label>'
        + '<input type="text" id="form-name" value="' + (template?.name || '') + '" placeholder="e.g., My Custom Budget" '
        + 'class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500">'
        + '</div>';
    // Description
    html += '<div>'
        + '<label class="block text-xs font-semibold text-zinc-400 mb-2">Description</label>'
        + '<textarea id="form-description" rows="2" placeholder="Brief description of this template" '
        + 'class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500">'
        + (template?.description || '')
        + '</textarea>'
        + '</div>';
    // Categories (dynamic)
    html += '<div>'
        + '<div class="flex items-center justify-between mb-2">'
        + '<label class="text-xs font-semibold text-zinc-400">Categories & Items</label>'
        + '<button type="button" onclick="_addCategoryField()" class="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">+ Add Category</button>'
        + '</div>'
        + '<div id="categories-container" class="space-y-4">';
    // Pre-populate if editing
    if (template && template.categories) {
        Object.keys(template.categories).forEach((catName, catIdx) => {
            html += _buildCategoryFieldHTML(catIdx, catName, template.categories[catName], template.itemIcons, template.suggestedBudgets);
        });
    } else {
        // Start with one empty category
        html += _buildCategoryFieldHTML(0, '', [], {}, {});
    }
    html += '</div></div>';
    // Save button
    html += '<div class="sticky bottom-0 bg-zinc-950 pt-4 pb-2 -mx-5 px-5 border-t border-zinc-800">'
        + '<button type="button" onclick="_saveTemplateForm(\'' + (templateId || '') + '\')" '
        + 'class="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-3.5 rounded-xl text-sm transition-all">'
        + 'Save Template'
        + '</button>'
        + '</div>';
    html += '</form>';
    content.innerHTML = html;
}
function _buildCategoryFieldHTML(index, catName, subcategories, itemIcons, suggestedBudgets) {
    let html = '<div class="bg-zinc-900 rounded-2xl p-4" data-category-index="' + index + '">';
    // Category name
    html += '<div class="flex items-center gap-2 mb-3">'
        + '<input type="text" placeholder="Category Name (e.g., Food)" value="' + catName + '" '
        + 'data-cat-name="' + index + '" '
        + 'class="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500">'
        + '<button type="button" onclick="_removeCategoryField(' + index + ')" class="w-8 h-8 flex items-center justify-center text-rose-400 hover:text-rose-300 transition-colors">'
        + '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>'
        + '</button>'
        + '</div>';
    // Subcategories
    html += '<div data-subcat-container="' + index + '" class="space-y-2 mb-3">';
    if (subcategories && subcategories.length > 0) {
        subcategories.forEach((subcat, subIdx) => {
            const key = catName + ':' + subcat;
            const icon = itemIcons[key] || '';
            const amount = suggestedBudgets[key] || '';
            html += _buildSubcategoryFieldHTML(index, subIdx, subcat, icon, amount);
        });
    }
    html += '</div>';
    // Add subcategory button
    html += '<button type="button" onclick="_addSubcategoryField(' + index + ')" class="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">+ Add Item</button>';
    html += '</div>';
    return html;
}
function _buildSubcategoryFieldHTML(catIndex, subIndex, subcatName, icon, amount) {
    return '<div class="flex items-center gap-2" data-subcat-index="' + subIndex + '">'
        + '<input type="text" placeholder="Emoji" value="' + icon + '" maxlength="2" '
        + 'data-subcat-icon="' + catIndex + '-' + subIndex + '" '
        + 'class="w-12 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">'
        + '<input type="text" placeholder="Item name" value="' + subcatName + '" '
        + 'data-subcat-name="' + catIndex + '-' + subIndex + '" '
        + 'class="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500">'
        + '<input type="number" placeholder="$" value="' + amount + '" '
        + 'data-subcat-amount="' + catIndex + '-' + subIndex + '" '
        + 'class="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500">'
        + '<button type="button" onclick="_removeSubcategoryField(' + catIndex + ',' + subIndex + ')" class="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-rose-400 transition-colors">'
        + '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>'
        + '</button>'
        + '</div>';
}
function _addCategoryField() {
    const container = document.getElementById('categories-container');
    const newIndex = container.children.length;
    const html = _buildCategoryFieldHTML(newIndex, '', [], {}, {});
    container.insertAdjacentHTML('beforeend', html);
}
function _removeCategoryField(index) {
    const container = document.getElementById('categories-container');
    const field = container.querySelector('[data-category-index="' + index + '"]');
    if (field) field.remove();
}
function _addSubcategoryField(catIndex) {
    const container = document.querySelector('[data-subcat-container="' + catIndex + '"]');
    const newSubIndex = container.children.length;
    const html = _buildSubcategoryFieldHTML(catIndex, newSubIndex, '', '', '');
    container.insertAdjacentHTML('beforeend', html);
}
function _removeSubcategoryField(catIndex, subIndex) {
    const container = document.querySelector('[data-subcat-container="' + catIndex + '"]');
    const field = container.querySelector('[data-subcat-index="' + subIndex + '"]');
    if (field) field.remove();
}
function _saveTemplateForm(templateId) {
    // Gather form data
    const name = document.getElementById('form-name').value.trim();
    const description = document.getElementById('form-description').value.trim();
    if (!name) {
        alert('Please enter a template name');
        return;
    }
    const categories = {};
    const itemIcons = {};
    const suggestedBudgets = {};
    // Parse categories
    const catFields = document.querySelectorAll('[data-category-index]');
    catFields.forEach(catField => {
        const catIdx = catField.getAttribute('data-category-index');
        const catNameInput = catField.querySelector('[data-cat-name="' + catIdx + '"]');
        const catName = catNameInput ? catNameInput.value.trim() : '';
        if (!catName) return; // Skip empty categories
        const subcats = [];
        const subcatFields = catField.querySelectorAll('[data-subcat-name^="' + catIdx + '-"]');
        subcatFields.forEach(subcatField => {
            const subcatName = subcatField.value.trim();
            if (!subcatName) return;
            const parts = subcatField.getAttribute('data-subcat-name').split('-');
            const subIdx = parts[1];
            const iconInput = catField.querySelector('[data-subcat-icon="' + catIdx + '-' + subIdx + '"]');
            const amountInput = catField.querySelector('[data-subcat-amount="' + catIdx + '-' + subIdx + '"]');
            const icon = iconInput ? iconInput.value.trim() : '•';
            const amount = amountInput ? parseFloat(amountInput.value) || 0 : 0;
            subcats.push(subcatName);
            const key = catName + ':' + subcatName;
            itemIcons[key] = icon;
            suggestedBudgets[key] = amount;
        });
        if (subcats.length > 0) {
            categories[catName] = subcats;
        }
    });
    if (Object.keys(categories).length === 0) {
        alert('Please add at least one category with items');
        return;
    }
    // Build template object
    const template = {
        name,
        description,
        categories,
        itemIcons,
        suggestedBudgets
    };
    if (templateId && templateId.startsWith('custom_')) {
        template.id = templateId;
    }
    // Save
    saveCustomTemplate(template);
    // Show success and return to list
    _renderTemplateList();
}
// ── DELETE & DUPLICATE (Subtask 3-4) ────────────────
function _deleteTemplate(id) {
    const template = getTemplateById(id);
    if (!template) return;
    const confirmed = confirm('Delete "' + template.name + '"?\n\nThis action cannot be undone.');
    if (!confirmed) return;
    deleteCustomTemplate(id);
    _renderTemplateList();
}
// ── APPLY TEMPLATE FROM MANAGEMENT ──────────────────
function _applyTemplateFromManagement(templateId) {
    // Get current month key
    const now = new Date();
    const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    // Try to apply
    const success = applyBudgetTemplate(templateId, monthKey);
    if (success) {
        // Close modal, switch to budgets tab, show month
        hideTemplateManagement();
        switchTab(2); // Budgets tab
        showMonthBudget(monthKey);
    } else {
        alert('Cannot apply template: This month already has a budget.\n\nPlease choose a different month or delete the existing budget first.');
    }
}