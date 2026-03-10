# Minimal — Personal Finance

Easy budgeting, wallet tracking, and bank import — all offline.

**Minimal** is a mobile-first Progressive Web App for personal budgeting, expense tracking, wallet management, and bank statement importing. Built with vanilla JavaScript and designed to work completely offline, it provides a fast, privacy-focused alternative to cloud-based finance apps.

## Features

- **📊 Overview Dashboard** — See your monthly spending, income, and budget progress at a glance
- **💳 Transaction Tracking** — Record and categorize income, expenses, and transfers with custom categories
- **💰 Budget Planning** — Set monthly budgets by category and track your spending against targets
- **📈 Reports & Charts** — Visualize spending trends, category breakdowns, and monthly comparisons
- **👛 Wallet Management** — Track multiple accounts (cash, checking, savings, credit cards) with real-time balances
- **🏦 Bank Import** — Import transactions from OFX, QFX, and CSV files with presets for major Canadian banks

## Screenshots

> **Note:** To add screenshots, replace the placeholder paths below with actual screenshot files stored in a `/screenshots` directory at the root of the repository. Use the format: `![Alt Text](./screenshots/filename.png)`

### Overview Dashboard
<!-- Add screenshot: ./screenshots/overview.png -->
_Monthly spending summary, budget progress, and recent transactions at a glance_

### Transactions
<!-- Add screenshot: ./screenshots/transactions.png -->
_Complete transaction history with filtering and search capabilities_

### Budgets
<!-- Add screenshot: ./screenshots/budgets.png -->
_Set and track monthly budgets by category with visual progress indicators_

### Reports
<!-- Add screenshot: ./screenshots/reports.png -->
_Visualize spending trends with interactive charts and category breakdowns_

### Bank Import
<!-- Add screenshot: ./screenshots/bank-import.png -->
_Import transactions from OFX, QFX, and CSV files with bank presets_

### Settings
<!-- Add screenshot: ./screenshots/settings.png -->
_Manage categories, profile, and data export/import options_

**Example usage once screenshots are added:**
```markdown
![Overview Dashboard](./screenshots/overview.png)
```

## Tech Stack

- **Frontend**: Vanilla ES6+ JavaScript, HTML5, Tailwind CSS (CDN)
- **Charts**: Chart.js 4.4.1 (CDN)
- **Backend**: Firebase 10.11.0 (Auth + Firestore, CDN)
- **Storage**: localStorage (offline) + Firestore (cloud sync, debounced 1.5s)
- **PWA**: Service worker with cache-first strategy for assets, network-first for HTML

**No build system, no npm, no bundler, no transpiler.** All files are served as static assets. All external dependencies are loaded via CDN.

## PWA & Offline Capabilities

Minimal is a fully installable Progressive Web App that works 100% offline:

- **Install on any device** — Add to home screen on iOS, Android, or desktop
- **Offline-first architecture** — All data stored in localStorage with automatic cloud sync when online
- **Service worker caching** — Assets cached for instant loading without network access
- **No internet required** — Track expenses, manage budgets, and view reports anywhere
- **Optional cloud sync** — Sign in with email, Google, or Apple to sync across devices
