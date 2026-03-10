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

## Quick Start

**Minimal** works out-of-the-box with no build step or installation. Just serve the files with any static HTTP server:

```bash
# Option 1: Python (most systems have this pre-installed)
python3 -m http.server 8000

# Option 2: Python 2 (older systems)
python -m SimpleHTTPServer 8000

# Option 3: Node.js
npx serve .

# Option 4: PHP
php -S localhost:8000
```

Then open your browser to `http://localhost:8000` and start tracking your finances!

**No login required** — the app works 100% offline using localStorage. All your data stays on your device unless you choose to enable cloud sync (see Firebase Setup below).

## Firebase Setup (Optional)

Firebase is **only required if you want cross-device sync**. The app works fully offline without it.

To enable cloud sync with email, Google, or Apple sign-in, follow these steps:

### 1. Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** (or **Create a project**)
3. Enter a project name → **Continue**
4. (Optional) Disable Google Analytics if you don't need it → **Continue** → **Create project**

### 2. Enable Authentication

1. In the Firebase Console, go to **Build** → **Authentication** (left sidebar)
2. Click **Get started**
3. Enable the following sign-in methods:
   - **Email/Password** — Click to enable, then **Save**
   - **Google** — Click to enable, then **Save**
   - **Apple** *(optional)* — Requires an Apple Developer account ($99/yr) and a registered domain (not localhost). See [Firebase docs: Sign in with Apple on web](https://firebase.google.com/docs/auth/web/apple)

### 3. Create Firestore Database

1. Go to **Build** → **Firestore Database** (left sidebar)
2. Click **Create database**
3. Choose **Start in production mode** → **Next**
4. Select the closest region → **Enable**

### 4. Configure Security Rules

⚠️ **Important:** The app stores data at `/users/{userId}` (not `/users/{userId}/data`). Make sure your rules match this structure.

1. In Firestore, click the **Rules** tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

3. Click **Publish**

### 5. Get Your Firebase Config

1. Go to **Project settings** (gear icon in left sidebar) → **General** tab
2. Scroll to **Your apps** section
3. Click the **Web** icon (`</>`) → **Register app**
4. Enter a nickname (e.g., "Minimal Web") → **Register app**
5. Copy the `firebaseConfig` object

### 6. Add Config to Your App

⚠️ **Security Warning:** This app currently has Firebase config **hardcoded in `js/app.js` lines 46-53**. This is convenient for demos but exposes your API keys in the browser source.

**For production use**, consider:
- Using Firebase App Check to restrict API key usage
- Moving sensitive config to environment variables (requires a build step)
- Implementing Firestore security rules (already done in Step 4)

**To replace the config:**

1. Open `js/app.js`
2. Find lines 46-53 (the `firebaseConfig` object)
3. Replace the placeholder values with your own from Step 5

```javascript
const firebaseConfig = {
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId:             "YOUR_APP_ID"
};
```

4. Save and refresh the app
5. You should now see sign-in options instead of "Demo Mode"

**Done!** Your data will now sync across any device where you sign in with the same account.

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
