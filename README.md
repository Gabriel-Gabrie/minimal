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

## Local Development

**No build step required!** Minimal is a vanilla JavaScript app with zero dependencies. All external libraries (Tailwind CSS, Chart.js, Firebase) are loaded via CDN.

### Running Locally

Serve the files with any static HTTP server. Here are several options:

```bash
# Option 1: Python 3 (pre-installed on macOS/Linux, available on Windows)
python3 -m http.server 8000

# Option 2: Python 2 (older systems)
python -m SimpleHTTPServer 8000

# Option 3: Node.js (if you have npm installed)
npx serve .
# or with a custom port:
npx serve . -p 8000

# Option 4: PHP (if installed)
php -S localhost:8000

# Option 5: Ruby (if installed)
ruby -run -ehttpd . -p8000

# Option 6: Caddy (if installed)
caddy file-server --listen :8000
```

Then open your browser to `http://localhost:8000`.

### Project Structure

```
minimal/
├── index.html              # Main HTML (entire app shell)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline caching)
├── css/
│   ├── base.css            # Base styles, animations, custom components
│   └── themes.css          # Light mode overrides (dark is default)
└── js/
    ├── state.js            # Global state, data model, persistence
    ├── auth.js             # Firebase authentication
    ├── app.js              # App initialization, theme, routing
    ├── screens/            # Tab/screen modules
    ├── modals/             # Modal dialog modules
    └── utils/              # Utility modules (tutorial, etc.)
```

### Making Changes

1. **Edit any HTML, CSS, or JS file** — Changes take effect on browser refresh
2. **Update the service worker cache** (see below) if you add/rename files
3. **Test offline behavior** by opening DevTools → Application → Service Workers → "Offline" checkbox

### Service Worker Cache Updates

When you add or rename files, you **must** update the service worker cache to ensure they work offline:

1. Open `sw.js`
2. Find the `ASSETS` array (around line 5-20)
3. Add the new file path to the array:
   ```javascript
   const ASSETS = [
       './',
       './index.html',
       './manifest.json',
       './css/base.css',
       './css/themes.css',
       './js/state.js',
       // ... add your new file here
       './js/screens/new-feature.js'
   ];
   ```
4. **Increment the cache version** on line 1:
   ```javascript
   const CACHE_NAME = 'minimal-v2'; // was minimal-v1
   ```

**Important:** If you forget this step, users will get stale cached versions of the app when offline.

### No Build Tools

This project intentionally avoids:
- ❌ No `package.json` or `npm install`
- ❌ No webpack, Vite, or bundlers
- ❌ No Babel or transpilation
- ❌ No CSS preprocessors (Sass, Less)
- ❌ No TypeScript compilation
- ❌ No minification or obfuscation

**Why?** Maximum simplicity and transparency. You can view source in the browser and see the exact code that's running.

## Deployment

Minimal can be deployed to any static hosting service. No server-side logic, databases, or build steps required.

### Recommended Hosting Options

#### 1. **Netlify** (Easiest, free tier available)

**Via Netlify CLI:**
```bash
# Install Netlify CLI (one-time)
npm install -g netlify-cli

# Deploy from the project root
netlify deploy --prod --dir .
```

**Via Netlify UI:**
1. Go to [https://app.netlify.com](https://app.netlify.com)
2. Drag and drop your project folder onto the Netlify dashboard
3. Done! Your site is live at `https://[random-name].netlify.app`

**Custom domain:** Go to Site settings → Domain management

#### 2. **Vercel** (Great for Git-based deployments)

**Via Vercel CLI:**
```bash
# Install Vercel CLI (one-time)
npm install -g vercel

# Deploy from the project root
vercel --prod
```

**Via Vercel UI:**
1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import your Git repository (GitHub, GitLab, Bitbucket)
3. Leave build settings empty (no build command needed)
4. Deploy!

#### 3. **Firebase Hosting** (Recommended if using Firebase for auth/sync)

```bash
# Install Firebase CLI (one-time)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase Hosting in your project directory
firebase init hosting
# Select your Firebase project
# Set public directory to: . (current directory)
# Configure as single-page app: Yes
# Don't overwrite index.html

# Deploy
firebase deploy --only hosting
```

Your app will be live at `https://[your-project-id].web.app`

#### 4. **GitHub Pages** (Free, integrates with GitHub repos)

**Option A: Via GitHub UI**
1. Push your code to a GitHub repository
2. Go to repository **Settings** → **Pages**
3. Set Source to "Deploy from a branch"
4. Select branch: `main` (or `master`), folder: `/ (root)`
5. Save — your site will be live at `https://[username].github.io/[repo-name]`

**Option B: Via `gh-pages` branch**
```bash
# Install gh-pages (one-time)
npm install -g gh-pages

# Deploy to GitHub Pages
npx gh-pages -d .
```

#### 5. **Cloudflare Pages** (Fast global CDN, free tier)

1. Go to [https://pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect your Git repository
3. Leave build settings empty
4. Deploy!

#### 6. **Static File Hosts** (Upload via FTP/SFTP)

Any traditional web host works:
- Upload all files via FTP/SFTP
- Point your domain to the uploaded directory
- Done!

### Deployment Checklist

Before deploying to production:

- [ ] **Replace Firebase config** with your own (see Firebase Setup section)
- [ ] **Test offline functionality** — open DevTools → Application → Service Workers → Offline checkbox
- [ ] **Test on mobile devices** — the app is mobile-first, so test on iOS and Android
- [ ] **Verify PWA installation** — check that "Add to Home Screen" works
- [ ] **Update `manifest.json`** if you want to customize app name, icons, or theme colors
- [ ] **Test bank import** with real OFX/CSV files from your banks
- [ ] **Review Firestore security rules** to ensure data is protected

### Custom Domain

Most hosting providers support custom domains:

- **Netlify:** Site settings → Domain management → Add custom domain
- **Vercel:** Project settings → Domains → Add domain
- **Firebase Hosting:** `firebase hosting:channel:deploy production` → Custom domain setup
- **GitHub Pages:** Repository settings → Pages → Custom domain
- **Cloudflare Pages:** Pages dashboard → Custom domains → Set up a domain

### HTTPS & Security

All recommended hosting providers automatically provision free SSL certificates via Let's Encrypt. Your app will be served over HTTPS by default.

**Important for PWA:** Service workers require HTTPS to function (except on `localhost`). All hosting options above provide HTTPS automatically.

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

## Architecture

Minimal is built with a straightforward, framework-free architecture that prioritizes simplicity and transparency.

### Global State (`js/state.js`)

All application state lives in global JavaScript variables — no state management library required:

- **`transactions`** — Array of transaction objects (income, expenses, transfers)
- **`expenseCategories`** — Object mapping category names to arrays of subcategories
- **`monthlyBudgets`** — Object keyed by `YYYY-MM` with budget amounts per category/item
- **`walletAccounts`** — Array of wallet account objects
- **`itemIcons`** — Emoji icons keyed by `"Main:Sub"` format (e.g., `"Food:Groceries"` → `"🛒"`)

### Data Persistence

A hybrid local-first, cloud-optional persistence model:

- **`saveData()`** — Writes to localStorage immediately, then debounces a Firestore write (1.5s delay)
- **`loadData()`** — Reads from localStorage (offline fallback)
- **`loadFromFirestore(uid)`** — Fetches from Firestore and mirrors to localStorage
- **Demo mode** — Never persists data when `_demoMode` is true

**Data flow:**
```
User action → Mutate global state → saveData() → localStorage (instant) → Firestore (debounced 1.5s)
```

### Rendering Pattern

Each screen module exposes a `render*()` function (e.g., `renderOverview()`, `renderBudgets()`) that rebuilds its DOM section via `getElementById()` and `innerHTML`:

- **No virtual DOM** — Direct DOM manipulation throughout
- **No diffing** — Full re-render of each screen on state changes
- **Event delegation** — Event listeners attached to parent containers

**Example:**
```javascript
function renderOverview() {
    const container = document.getElementById('overview-content');
    container.innerHTML = `<!-- full HTML rebuild -->`;
}
```

### Authentication (`js/auth.js`)

Firebase `onAuthStateChanged` listener drives the auth flow:

- **Email/Password sign-in** — Standard Firebase email authentication
- **Google sign-in** — OAuth via Firebase Auth
- **Apple sign-in** — OAuth via Firebase Auth (optional)
- **Graceful fallback** — App works in offline/demo mode if Firebase is not configured

### Service Worker (`sw.js`)

Offline-first caching strategy:

- **Cache name:** `minimal-v1` (increment when updating assets)
- **Install event:** Precaches all local assets on first load
- **Fetch strategy:**
  - **HTML documents:** Network-first (always fetch latest, fallback to cache)
  - **Other assets:** Cache-first (instant load from cache)
- **Cross-origin requests:** Skipped (CDNs and Firebase not cached)

**Important:** When adding new JS/CSS files, update the `ASSETS` array in `sw.js` to ensure offline availability.

### Key Design Patterns

- **Month keys:** All month references use `YYYY-MM` string format (e.g., `"2025-03"`)
- **Transaction types:** `'income'`, `'expense'`, `'transfer'`
- **Private conventions:** Functions/variables prefixed with `_` (e.g., `_fbAuth`, `_applyData()`)
- **Naming conventions:**
  - Render functions: `render*()`
  - Show/hide modals: `show*()`, `hide*()`
  - Event handlers: `on*()` or inline

For a complete architecture deep-dive, see **[CLAUDE.md](./CLAUDE.md)** — the developer onboarding guide with detailed conventions, patterns, and pitfalls.

## Contributing

Contributions are welcome! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### Getting Started

1. **Read [CLAUDE.md](./CLAUDE.md)** — This is the comprehensive developer guide covering:
   - Code style and conventions
   - Architecture patterns
   - Common pitfalls
   - Development workflows

2. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/yourusername/minimal.git
   cd minimal
   ```

3. **Serve locally** — No build step required:
   ```bash
   python3 -m http.server 8000
   ```

4. **Make your changes** following the patterns in CLAUDE.md

5. **Test thoroughly:**
   - Test in Chrome, Firefox, Safari (mobile and desktop)
   - Test offline mode (DevTools → Application → Service Workers → Offline)
   - Test with demo data and real Firebase auth (if applicable)

6. **Submit a pull request:**
   - **Branch naming:** `feature/<description>` or `fix/<description>`
   - **Commit messages:** Use imperative mood (e.g., "Add transaction filtering" not "Added transaction filtering")
   - **PR description:** Explain what changed and why

### Code Conventions

- **4-space indentation** (no tabs)
- **camelCase** for variables and functions
- **Private functions/variables** prefixed with `_`
- **No console.log** in production code
- **Update service worker** (`sw.js` ASSETS array) when adding new files

### Development Workflow

```bash
# Create a feature branch
git checkout -b feature/new-feature

# Make changes, test locally
python3 -m http.server 8000

# Commit with descriptive message
git commit -m "Add new feature for X"

# Push and create PR
git push origin feature/new-feature
```

### What We're Looking For

- **Bug fixes** — Especially edge cases in transaction parsing, budget calculations, or chart rendering
- **New features** — Additional chart types, export formats, bank import presets, etc.
- **Accessibility improvements** — ARIA labels, keyboard navigation, screen reader support
- **Documentation** — Clearer setup instructions, additional screenshots, use case examples
- **Performance optimizations** — Faster rendering, reduced memory usage, better caching
- **Mobile improvements** — Better touch interactions, responsive design tweaks

### What to Avoid

- **Framework rewrites** — This project is intentionally vanilla JS. No React/Vue/Angular/Svelte conversions please.
- **Build systems** — No webpack, Vite, Rollup, Parcel, etc. The "no build step" philosophy is core to this project.
- **TypeScript** — Would require a compilation step, breaking the no-build requirement.
- **Large dependencies** — All dependencies must be CDN-loadable. No npm packages that require bundling.

### Questions?

- **Open an issue** for bugs, feature requests, or general questions
- **Check CLAUDE.md** for detailed architecture and development guidelines
- **Review closed PRs** to see examples of accepted contributions

## License

This project is licensed under the **MIT License** — you are free to use, modify, and distribute this software for any purpose, including commercial use.

See the full license text below:

```
MIT License

Copyright (c) 2026 Minimal Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Third-Party Licenses

This project uses the following open-source libraries via CDN:

- **Tailwind CSS** — [MIT License](https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE)
- **Chart.js** — [MIT License](https://github.com/chartjs/Chart.js/blob/master/LICENSE.md)
- **Firebase** — [Apache 2.0 License](https://github.com/firebase/firebase-js-sdk/blob/master/LICENSE)

---

**Built with ❤️ by the open-source community. No frameworks, no build steps, just vanilla JavaScript.**

For detailed developer documentation, see **[CLAUDE.md](./CLAUDE.md)**.
