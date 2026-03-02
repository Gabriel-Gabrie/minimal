# CLAUDE.md — Minimal (Personal Finance PWA)

## Project Overview

**Minimal** is a mobile-first Progressive Web App for personal budgeting, expense tracking, wallet management, and bank statement importing. It is built with vanilla JavaScript (no frameworks) and uses Firebase for authentication and cloud sync. The app works fully offline via localStorage and a service worker.

## Tech Stack

- **Frontend**: Vanilla ES6+ JavaScript, HTML5, Tailwind CSS (CDN)
- **Charts**: Chart.js 4.4.1 (CDN)
- **Backend**: Firebase 10.11.0 (Auth + Firestore, CDN)
- **Storage**: localStorage (offline) + Firestore (cloud sync, debounced 1.5s)
- **PWA**: Service worker (`sw.js`) with cache-first strategy for assets, network-first for HTML

**No build system, no npm, no bundler, no transpiler.** All files are served as static assets. All external dependencies are loaded via CDN `<script>` tags in `index.html`.

## Repository Structure

```
budget-app/
├── index.html              # Main HTML (entire app shell, ~1,666 lines)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline caching)
├── css/
│   ├── base.css            # Base styles, animations, custom components
│   └── themes.css          # Light mode overrides (dark is default)
└── js/
    ├── state.js            # Global state, data model, persistence, helpers
    ├── auth.js             # Firebase auth (email, Google, Apple sign-in)
    ├── app.js              # App initialization, theme management, tab routing
    ├── screens/
    │   ├── overview.js     # Overview/dashboard tab
    │   ├── transactions.js # Transaction list tab
    │   ├── budgets.js      # Budget planning/tracking tab
    │   ├── wallet.js       # Wallet/accounts tab
    │   └── reports.js      # Reports & charts tab
    ├── modals/
    │   ├── budget-item.js  # Add/edit budget items modal
    │   ├── settings.js     # Settings modal (profile, categories, data)
    │   └── bank-import.js  # Bank statement import (OFX/QFX/CSV parser)
    └── utils/
        └── tutorial.js     # First-run tutorial walkthrough
```

## Architecture

### Global State (`js/state.js`)
All app state lives in global variables — no state management library:
- `transactions` — Array of transaction objects
- `expenseCategories` — Object mapping category names to arrays of subcategories
- `monthlyBudgets` — Object keyed by `YYYY-MM` with budget amounts per category/item
- `walletAccounts` — Array of wallet account objects
- `itemIcons` — Emoji icons keyed by `"Main:Sub"` format

### Data Persistence
- **`saveData()`** writes to localStorage immediately, then debounces a Firestore write (1.5s)
- **`loadData()`** reads from localStorage (offline fallback)
- **`loadFromFirestore(uid)`** fetches from Firestore and mirrors to localStorage
- Demo mode (`_demoMode`) never persists data

### Data Migrations (in `_applyData()`)
1. `Living` → `Household` category rename
2. Inject `Income` as first category if missing
3. Keep `incomeCats` derived from `expenseCategories['Income']`

### Rendering Pattern
Each screen module exposes a `render*()` function (e.g., `renderOverview()`, `renderBudgets()`) that rebuilds its DOM section via `getElementById()` and `innerHTML`. There is no virtual DOM or diffing — direct DOM manipulation throughout.

### Authentication (`js/auth.js`)
Firebase `onAuthStateChanged` listener drives the auth flow. The app gracefully falls back to offline/demo mode if Firebase is not configured.

### Service Worker (`sw.js`)
- Cache name: `minimal-v1`
- Precaches all local assets on install
- Network-first for HTML documents, cache-first for other assets
- Skips cross-origin requests (CDNs, Firebase)

**Important**: When adding new JS/CSS files, update the `ASSETS` array in `sw.js` so they are cached for offline use.

## Key Conventions

### Code Style
- **4-space indentation** (implicit, no formatter config)
- **camelCase** for variables and functions
- **Private functions/variables** prefixed with `_` (e.g., `_fbAuth`, `_applyData()`)
- **Section headers** use decorative ASCII-art comments:
  ```js
  /* ══════════════════════════════════════════════
     SECTION TITLE
  ══════════════════════════════════════════════ */
  ```
- **Sub-sections** use lighter dividers:
  ```js
  /* ── Description ─────────────────────── */
  ```

### Naming Patterns
- Render functions: `render*()` (e.g., `renderOverview()`)
- Show/hide modals: `show*()`, `hide*()`
- Event handlers: `on*()` or inline
- Date keys: `YYYY-MM` format (e.g., `"2025-03"`)
- Transaction types: `'income'`, `'expense'`, `'transfer'`

### Month Key Format
All month references use `YYYY-MM` strings. Use `getCurrentMonthKey()` for the current month (EST timezone). Helper functions `getNextMonth()`, `getPrevMonth()`, `formatMonthShort()`, and `formatMonthName()` are in `state.js`.

### No Build Step
This project has **no package.json, no npm scripts, no build commands**. To "run" the app, serve the files with any static HTTP server:
```sh
# Example using Python
python3 -m http.server 8000

# Example using npx
npx serve .
```

## Development Guidelines

### Adding a New Screen/Module
1. Create the JS file under `js/screens/` or `js/modals/`
2. Add a `<script>` tag in `index.html` (order matters — `state.js` and `app.js` must load first)
3. Add the file path to the `ASSETS` array in `sw.js`
4. Add the HTML shell/container to `index.html`

### Modifying State
- Always call `saveData()` after mutating global state to persist changes
- Use `_applyData()` when loading a full data snapshot (handles migrations)

### Working with Categories
- Categories are stored in `expenseCategories` as `{ "CategoryName": ["Sub1", "Sub2"] }`
- `Income` is always the first category and is treated specially in budgets/reports
- Icons are stored in `itemIcons` keyed as `"Main:Sub"` (e.g., `"Food:Groceries"` → `"🛒"`)

### CSS & Theming
- Dark mode is the default (`bg-zinc-950 text-zinc-100`)
- Light mode overrides are in `css/themes.css` using `html.light` selector
- System theme detection is handled in `js/app.js`
- Uses Tailwind utility classes extensively; custom styles go in `css/base.css`

### Bank Import (`js/modals/bank-import.js`)
Supports parsing OFX/QFX (SGML v1 and XML v2) and CSV formats. Includes presets for major Canadian banks: TD, RBC, BMO, Scotiabank, CIBC, Tangerine, Simplii, EQ Bank.

## Git Workflow

- **Branch naming**: `claude/<feature-description>-<ID>`
- **Commit messages**: Imperative mood, concise description of the change
- **PR-based workflow**: Feature branches merged via pull requests
- **Staging branch**: Used for integration before merging to main

## Common Pitfalls

- **Script load order**: `state.js` must load before all other JS modules since they depend on its globals. `auth.js` and `app.js` must load before screen/modal scripts.
- **Service worker cache**: After adding/renaming files, update `sw.js` ASSETS array or users will get stale cached versions offline.
- **Firestore rules**: Data is stored at `/users/{uid}` (not `/users/{uid}/data`). The Firestore security rules must match this path.
- **Demo mode**: When `_demoMode` is true, `saveData()` is a no-op. Ensure demo data mutations don't leak to persistence.
- **No tests**: There is no automated test suite. Verify changes manually by testing the affected screen/feature in a browser.
