# IT Inventory Web - Current State Documentation

**Last Updated:** 2025-10-01
**Version:** 2.0 (Vite Architecture)
**Production URL:** https://drr-egan.github.io/it-inventory-web/

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Recent Changes & Migration History](#recent-changes--migration-history)
3. [Styling System & Design Language](#styling-system--design-language)
4. [Known Issues & Solutions](#known-issues--solutions)
5. [File Structure & Key Components](#file-structure--key-components)
6. [Deployment Pipeline](#deployment-pipeline)
7. [Development Workflow](#development-workflow)
8. [Firebase Backend Configuration](#firebase-backend-configuration)
9. [Service Worker & PWA Caching](#service-worker--pwa-caching)
10. [Testing & Debugging](#testing--debugging)

---

## Architecture Overview

### Current Architecture (2.0 - Vite)
The application has been **fully migrated to Vite** with a modular React component architecture:

```
React (Vite) → Firebase Firestore → GitHub Pages
```

**Key Technologies:**
- **Build System:** Vite 4.5.14
- **Frontend Framework:** React 18 (loaded via CDN in production)
- **Backend:** Firebase Firestore with real-time sync
- **Authentication:** Firebase Auth with Google sign-in
- **Hosting:** GitHub Pages with automated deployment
- **Styling:** Tailwind CSS + Custom Material Design 3 system
- **PWA:** Workbox service worker for offline capability

### Legacy Architecture (Deprecated)
⚠️ **IMPORTANT:** The following files are **NO LONGER USED** in production:

- `index-github-pages.html` - Original monolithic single-file app
- `index-firebase.html` - Firebase-only implementation
- `firebase-app-material.html` - Alternative Material Design implementation
- `simple-api-server.py` - SQLite API server (localhost only)
- `inventory.db` - Local SQLite database

**DO NOT EDIT THESE FILES** - They are kept for reference only.

---

## Recent Changes & Migration History

### Latest Changes (2025-10-01)

#### Background Gradient Fix (Commit: 0c80628)
**Problem:** White background instead of dark gradient (blue → navy)
**Root Cause:** Tailwind's `bg-gray-50` classes in `App.jsx` were overriding CSS gradient
**Solution:** Removed `bg-gray-50` from:
- Main App wrapper div (`src/App.jsx` line 36)
- Loading screen fallbacks (lines 27, 39)

**Files Modified:**
- `src/App.jsx` - Removed background classes
- Already had correct CSS in `src/index.css` (lines 6-19)

**Verification:**
```bash
# Check built CSS contains gradient
grep -n "background:linear-gradient" dist/assets/index-*.css
# Should show: body{...background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%)!important...}
```

#### UI Transformation (Commits: 051f8fc, 273be81, addf5dd)
Transformed app to match reference design with:
- Dark gradient background (blue-900 → slate-950)
- Material Design 3 cards with glassmorphism
- Blue top banner with branding
- Green Firebase status bar
- Blue navigation tabs with count badges
- Colored quantity badges (red/green based on stock)
- Pill badges for cost codes and IDs

### Migration from Monolithic to Vite (Previous)

The app was previously migrated from a single `index-github-pages.html` file to modular Vite architecture:

**Before:** Single 6000+ line HTML file with inline React
**After:** Modular component structure with code splitting

**Key Changes:**
- Split into separate component files under `src/components/`
- Introduced lazy loading for feature components
- Created dedicated services layer (`src/services/`)
- Implemented Material Design styling system
- Added PWA capabilities with Workbox

---

## Styling System & Design Language

### Design System: Material Design 3

The app uses a **custom Material Design 3** implementation with the following design tokens:

#### Color Palette

**Primary Colors:**
```css
--color-bg-gradient-start: #1e3a8a  /* blue-900 */
--color-bg-gradient-end: #0f172a    /* slate-950 */
--color-primary-blue: #2563eb       /* Main brand color */
--color-card-bg: rgba(59, 130, 246, 0.1)  /* Translucent blue */
--color-card-border: rgba(59, 130, 246, 0.2)
```

**Semantic Colors:**
```css
--color-success-green: #10b981
--color-warning-yellow: #f59e0b
--color-error-red: #ef4444
--color-text-light: #f8fafc
--color-text-muted: #cbd5e1
```

#### Material Design Tokens

The system includes full MD3 token support in `src/styles/material-design.css`:

- **Elevation:** 5 levels of shadows (`--md-elevation-1` through `--md-elevation-5`)
- **Shape:** Corner radii from 4px to 1000px (full pill)
- **Typography:** Roboto font with display/headline/title/body/label scales
- **Color Roles:** Primary, secondary, tertiary, error, surface, outline
- **State Layers:** Hover, focus, pressed states

#### Component Classes

**Cards:**
```css
.mat-card {
    background: var(--color-card-bg);
    backdrop-filter: blur(10px);  /* Glassmorphism effect */
    border: 1px solid var(--color-card-border);
    border-radius: var(--md-sys-shape-corner-large);
}
```

**Badges:**
```css
/* Count badges (navigation) */
.count-badge { /* Small white/translucent numbers */ }

/* Quantity badges (stock levels) */
.quantity-badge.low-stock { /* Red background, light red text */ }
.quantity-badge.adequate-stock { /* Green background, light green text */ }
.quantity-badge.out-of-stock { /* Bright red, prominent */ }

/* Pill badges (IDs, codes) */
.pill-badge { /* Blue translucent with monospace font */ }
```

**Buttons:**
```css
.md-button.primary { /* Blue filled button */ }
.md-button.secondary { /* Outlined button */ }
.md-button.error { /* Red error button */ }
```

#### Dark/Light Mode System

The app has a **dark/light mode toggle** managed in `src/components/MainApp.jsx` (lines 23-79):

- **Default:** Dark mode (`isDarkMode: true`)
- **Storage:** Persisted to localStorage as `materialYouTheme`
- **CSS Variables:** Dynamically updates Material Design color tokens
- **Scope:** Applied to `document.documentElement` (`:root`)

**Important:** Currently configured for dark mode. The gradient background should always be visible.

### CSS Architecture

**Load Order (Critical):**
1. `src/styles/material-design.css` - Material Design tokens and components
2. `src/index.css` - Tailwind + custom overrides

**In `src/index.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    body {
        /* Gradient applied here with !important */
        background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%) !important;
        background-attachment: fixed !important;
    }
}
```

⚠️ **Critical Rule:** Never add `bg-*` Tailwind classes to:
- `src/App.jsx` - Main app wrapper
- `src/components/MainApp.jsx` - Main content wrapper
- Any top-level container divs

These will override the body gradient!

---

## Known Issues & Solutions

### Issue 1: White Background Instead of Gradient

**Symptoms:**
- App shows white/light gray background
- Login screen may show gradient correctly
- Main app after login is white

**Root Causes:**
1. ✅ **FIXED** - `bg-gray-50` class in `src/App.jsx` (commit 0c80628)
2. Service worker caching old styles
3. Browser cache not clearing

**Solutions:**

**A. Hard Refresh (User Side):**
```
Chrome/Edge: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
Firefox: Ctrl+F5 (Windows) / Cmd+Shift+R (Mac)
```

**B. Unregister Service Worker (User Side):**
1. Open DevTools (F12)
2. Application tab → Service Workers
3. Click "Unregister" next to the service worker
4. Hard refresh the page

**C. Verify CSS Build (Developer Side):**
```bash
# Check gradient is in built CSS
grep "background:linear-gradient" dist/assets/index-*.css

# Should output:
# body{...background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%)!important...}
```

**D. Check for Background Classes (Developer Side):**
```bash
# Search for any bg-gray or bg-white classes that might override
grep -rn "className.*bg-gray\|className.*bg-white" src/

# Should return NO results in App.jsx or MainApp.jsx
```

**Prevention:**
- Never use Tailwind background classes (`bg-*`) on root containers
- Always test with hard refresh after CSS changes
- Verify service worker updates after deployment

### Issue 2: Service Worker Aggressively Caching

**Symptoms:**
- Changes not appearing after deployment
- Old version loads despite new commit
- Users see outdated UI

**Root Cause:**
Workbox PWA service worker caches all assets including CSS/JS

**Solutions:**

**A. Update Service Worker Version (If Repeated Issues):**
Edit `vite.config.js` and increment cache name:
```javascript
VitePWA({
  workbox: {
    cleanupOutdatedCaches: true,
    // Add or increment version number
    cacheName: 'it-inventory-cache-v2'
  }
})
```

**B. Force Skip Waiting (Nuclear Option):**
The service worker already calls `self.skipWaiting()` but you can verify in `dist/sw.js`.

**C. Test Without Service Worker:**
```bash
# Local development - no service worker
npm run dev

# Access at http://localhost:5173
```

### Issue 3: Firebase Connection Issues

**Symptoms:**
- "Firebase not initialized" errors
- Authentication fails
- Real-time sync not working

**Verification:**
Check browser console for:
```
✓ "Firebase initialized successfully"
✓ "Auth state changed: user@email.com"
```

**Solutions:**

**A. Check Firebase Config:**
Verify in `src/services/firebase.js`:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyCBOBb7mJPoI7cwubp12xnmjglLkuWYWYI",
    authDomain: "it-inventory-eaebc.firebaseapp.com",
    projectId: "it-inventory-eaebc",
    // ... other config
};
```

**B. Verify Firestore Rules:**
Firebase Console → Firestore Database → Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**C. Check Authentication Providers:**
Firebase Console → Authentication → Sign-in method:
- Google provider should be **enabled**

### Issue 4: Icons Not Loading (404 on cart-icon.png)

**Symptoms:**
Console shows:
```
Failed to load resource: the server responded with a status of 404 ()
https://drr-egan.github.io/cart-icon.png
```

**Root Cause:**
Manifest references icon at root, but GitHub Pages serves from `/it-inventory-web/` base path.

**Current Status:**
Non-critical - app functions normally. PWA install prompt may not show icon.

**Solution (Low Priority):**
Update `public/manifest.webmanifest`:
```json
{
  "icons": [
    {
      "src": "/it-inventory-web/cart-icon.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

### Issue 5: Component Not Rendering/White Screen

**Symptoms:**
- Specific tab shows blank/white
- Console shows no errors
- Other tabs work fine

**Common Causes:**
1. Lazy loaded component failed to import
2. Component has JSX syntax error
3. Unhandled exception in component render

**Debugging Steps:**

**A. Check Console:**
Look for:
- Babel transformation errors
- Import failures
- React error boundaries

**B. Check Component Imports:**
```bash
# Verify all lazy imports exist
ls -la src/components/shop/ShopManager.jsx
ls -la src/components/inventory/InventoryManager.jsx
# etc...
```

**C. Test Component Directly:**
```javascript
// Temporarily disable lazy loading in MainApp.jsx
import ShopManager from './shop/ShopManager';  // Direct import
// const ShopManager = React.lazy(...)  // Comment out

// This will show errors immediately vs. lazy load failures
```

**D. Check for Missing Props:**
Components may require props from MainApp:
```javascript
<ShopManager
  items={items}           // Required
  addToCart={addToCart}   // Required
  // Missing props cause failures
/>
```

---

## File Structure & Key Components

### Source Directory Structure

```
it-inventory-web/
├── src/
│   ├── main.jsx                 # App entry point
│   ├── App.jsx                  # Root component with auth routing
│   │                            # ⚠️ NO bg-* CLASSES HERE
│   ├── index.css                # Tailwind + gradient background
│   │
│   ├── components/
│   │   ├── MainApp.jsx          # Main authenticated app shell
│   │   │                        # - Navigation tabs
│   │   │                        # - Dark mode toggle
│   │   │                        # - Real-time data sync
│   │   │                        # ⚠️ NO bg-* CLASSES HERE
│   │   │
│   │   ├── auth/
│   │   │   └── AuthComponent.jsx      # Firebase Google sign-in
│   │   │
│   │   ├── shop/
│   │   │   └── ShopManager.jsx        # Shopping interface
│   │   │
│   │   ├── cart/
│   │   │   └── ShoppingCart.jsx       # Cart sidebar
│   │   │
│   │   ├── scanner/
│   │   │   └── BarcodeScanner.jsx     # Barcode scanning
│   │   │
│   │   ├── inventory/
│   │   │   └── InventoryManager.jsx   # Inventory CRUD + CSV import
│   │   │
│   │   ├── users/
│   │   │   └── UsersManager.jsx       # User management
│   │   │
│   │   ├── shipment/
│   │   │   └── ShipmentProcessor.jsx  # PDF receipt processing
│   │   │
│   │   ├── history/
│   │   │   └── CheckoutHistory.jsx    # Checkout records + archive
│   │   │
│   │   ├── admin/
│   │   │   └── AdminPanel.jsx         # Admin utilities
│   │   │
│   │   └── shared/
│   │       ├── LoadingSpinner.jsx     # Loading indicator
│   │       ├── ErrorBoundary.jsx      # React error boundary
│   │       ├── MaterialButton.jsx     # MD3 button component
│   │       ├── MaterialInput.jsx      # MD3 input component
│   │       └── MaterialPagination.jsx # Pagination component
│   │
│   ├── services/
│   │   ├── firebase.js          # Firebase initialization
│   │   └── pdf.js               # PDF.js configuration
│   │
│   └── styles/
│       └── material-design.css  # Material Design 3 tokens
│
├── dist/                        # Built output (deployed to GitHub Pages)
│   ├── index.html               # Generated entry HTML
│   ├── assets/                  # Hashed JS/CSS bundles
│   ├── sw.js                    # Service worker
│   └── manifest.webmanifest     # PWA manifest
│
├── public/                      # Static assets (copied to dist/)
│   ├── cart-icon.png
│   ├── favicon.ico
│   └── manifest.webmanifest
│
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions deployment
│
├── index.html                   # Vite entry template
├── vite.config.js               # Vite + PWA configuration
├── package.json                 # Dependencies and scripts
├── CLAUDE.md                    # Project instructions for Claude
└── CURRENT_STATE.md             # This file
```

### Key Component Responsibilities

#### App.jsx (Root)
- Firebase auth state listener
- Routes between AuthComponent and MainApp
- Loading screens during initialization
- **Critical:** Must NOT have background classes

**State:**
- `user` - Current authenticated user
- `loading` - Initial auth check

#### MainApp.jsx (Main App Shell)
- Tab navigation system
- Firebase real-time data sync (items, users, checkout history)
- Cart management state and functions
- Dark/light mode toggle
- Lazy loads all feature components

**State:**
- `activeTab` - Current visible tab
- `cart` - Shopping cart items
- `items` - Inventory items (synced from Firestore)
- `users` - User database (synced from Firestore)
- `checkoutHistory` - Active checkouts (synced from Firestore)
- `notifications` - Low stock alerts
- `isDarkMode` - Theme preference

**Props Passed to Children:**
```javascript
// All child components receive relevant props
<ShopManager
  items={items}
  addToCart={addToCart}
/>

<InventoryManager
  items={items}
  // Items auto-sync via Firestore, no update function needed
/>
```

#### Feature Components

All feature components are **lazy loaded** for code splitting:

```javascript
const ShopManager = React.lazy(() => import('./shop/ShopManager'));
```

**Benefits:**
- Faster initial page load
- Smaller bundle sizes
- On-demand loading of features

**Suspension:**
Wrapped in `<Suspense>` with loading fallback:
```javascript
<Suspense fallback={<LoadingSpinner />}>
  {activeTab === 'shop' && <ShopManager />}
</Suspense>
```

### Important File Relationships

**CSS Load Order:**
```
src/main.jsx
  → imports src/styles/material-design.css  (Material Design tokens)
  → imports src/index.css                    (Tailwind + gradient)
```

**Component Hierarchy:**
```
main.jsx
  → App.jsx
      → AuthComponent.jsx (not logged in)
      → MainApp.jsx (logged in)
          → ShopManager.jsx
          → InventoryManager.jsx
          → CheckoutHistory.jsx
          → etc...
```

**Firebase Initialization:**
```
src/main.jsx
  → imports src/services/firebase.js  (init happens immediately)
  → exports { auth, db }              (available to all components)
```

---

## Deployment Pipeline

### GitHub Actions Workflow

**File:** `.github/workflows/deploy.yml`

**Trigger:**
- Push to `main` branch (automatic)
- Manual workflow dispatch

**Steps:**
1. Checkout repository
2. Setup Node.js 18
3. Install dependencies: `npm ci`
4. Build Vite app: `npm run build`
5. Deploy `dist/` directory to `gh-pages` branch
6. GitHub Pages serves from `gh-pages` branch

**Build Configuration:**
- Base path: `/it-inventory-web/`
- Output: `dist/` directory
- Assets: Hashed filenames for cache busting

**Deployment URL:**
```
https://drr-egan.github.io/it-inventory-web/
```

### Manual Deployment

If automatic deployment fails or you need to deploy manually:

```bash
# Build the app
npm run build

# Verify build output
ls -la dist/

# Push to main (triggers GitHub Actions)
git add dist/ src/
git commit -m "Deploy update"
git push origin main

# GitHub Actions will deploy automatically
```

**Check Deployment Status:**
1. Go to GitHub repository
2. Click "Actions" tab
3. View latest workflow run
4. Check for green checkmark (success) or red X (failure)

**Troubleshooting Deployment:**

**Build Failures:**
```bash
# Check for errors
npm run build

# Common issues:
# - Syntax errors in components
# - Missing imports
# - Vite config errors
```

**Deployment Failures:**
- Check GitHub Actions logs
- Verify `gh-pages` branch exists
- Check repository settings → Pages → Source is `gh-pages` branch

### Vite Configuration

**File:** `vite.config.js`

**Key Settings:**
```javascript
export default defineConfig({
  base: '/it-inventory-web/',  // GitHub Pages base path

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,png,jpg,svg}']
      }
    })
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'pdf-vendor': ['pdfjs-dist']
        }
      }
    }
  }
})
```

**Manual Chunks:**
- Splits large vendor libraries into separate bundles
- Improves caching (vendor code changes less often)
- Reduces main bundle size

---

## Development Workflow

### Local Development

**Start Dev Server:**
```bash
npm run dev
```

**Access:**
```
http://localhost:5173
```

**Features:**
- Hot Module Replacement (HMR)
- Fast refresh on save
- No service worker (easier testing)
- Source maps for debugging

**Environment:**
- Uses production Firebase (same as deployed)
- Real-time sync with production data
- ⚠️ Changes affect production database!

### Building for Production

**Build Command:**
```bash
npm run build
```

**Output:**
- Directory: `dist/`
- Minified and optimized
- Hashed filenames for cache busting
- Service worker generated

**Preview Build:**
```bash
npm run preview
```
Access at `http://localhost:4173`

**Build Verification:**
```bash
# Check bundle sizes
ls -lh dist/assets/

# Verify gradient in CSS
grep "background:linear-gradient" dist/assets/index-*.css

# Test service worker
# Open http://localhost:4173 in browser
# Check Application → Service Workers in DevTools
```

### Making Style Changes

**Process:**
1. Edit `src/styles/material-design.css` or `src/index.css`
2. Run `npm run dev` to test locally
3. Verify gradient background appears
4. Build: `npm run build`
5. Verify gradient in built CSS: `grep "linear-gradient" dist/assets/*.css`
6. Commit and push to deploy

**⚠️ Critical Checklist for Style Changes:**
- [ ] NO `bg-*` classes added to `src/App.jsx`
- [ ] NO `bg-*` classes added to `src/components/MainApp.jsx`
- [ ] Gradient visible in local dev server
- [ ] Gradient present in built CSS (`dist/assets/`)
- [ ] Tested with hard refresh (Ctrl+Shift+R)

### Making Component Changes

**Adding New Component:**
```bash
# Create component file
touch src/components/feature/NewComponent.jsx

# Add to MainApp.jsx
const NewComponent = React.lazy(() => import('./feature/NewComponent'));

// Add to tabs array
const tabs = [
  { id: 'new', name: 'New Feature', icon: 'icon_name' }
];

// Add to render
{activeTab === 'new' && <NewComponent />}
```

**Modifying Existing Component:**
1. Edit component file in `src/components/`
2. Test in dev server: `npm run dev`
3. Verify no console errors
4. Build and deploy

**Component Best Practices:**
- Use React hooks for state
- Implement loading states for async operations
- Use Material Design classes from `material-design.css`
- Handle errors gracefully with try/catch
- Use CSS variables for colors (theme-aware)

### Git Workflow

**Standard Flow:**
```bash
# Make changes
# Test locally
npm run dev

# Build
npm run build

# Stage changes
git add src/ dist/

# Commit with descriptive message
git commit -m "feat: Add new feature"

# Push to trigger deployment
git push origin main
```

**Commit Message Format:**
```
<type>: <description>

[optional body]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `style:` - Style/UI changes
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `chore:` - Maintenance

---

## Firebase Backend Configuration

### Firebase Project Details

**Project ID:** `it-inventory-eaebc`
**Region:** us-central1 (default)
**Console:** https://console.firebase.google.com/project/it-inventory-eaebc

### Firestore Database Structure

#### Collections

**1. `items` - Inventory Items**
```javascript
{
  id: "auto-generated",
  name: "Item Name",
  asin: "B07XYZ1234",
  quantity: 50,
  minThreshold: 10,
  category: "Electronics",
  price: 29.99,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Indexes:** Auto-generated on `name`, `category`

**2. `users` - User Database**
```javascript
{
  id: "auto-generated",
  firstName: "John",
  lastName: "Doe",
  costCode: "2-20-060-5770",
  email: "john.doe@example.com",
  createdAt: Timestamp
}
```

**3. `checkoutHistory` - Active Checkouts**
```javascript
{
  id: "auto-generated",
  itemName: "Item Name",
  userName: "John Doe",
  quantity: 5,
  departmentId: "2-20-060-5770",
  jobNum: "JOB-2024-001",
  checkoutDate: Timestamp,
  userId: "user-id-ref"
}
```

**4. `archivedCheckouts` - Processed Checkouts**
```javascript
{
  // All fields from checkoutHistory, plus:
  archivedAt: Timestamp,
  processedBy: "user@email.com",
  shipmentId: "shipment-id-ref"
}
```

**Archive Workflow:**
- Items processed via "Process Shipment" move from `checkoutHistory` to `archivedCheckouts`
- Original checkout data preserved
- Audit trail maintained with archive timestamp

### Security Rules

**File:** Firebase Console → Firestore Database → Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Require authentication for all operations
    match /{document=**} {
      allow read, write: if request.auth != null;
    }

    // Optional: Add more specific rules
    match /items/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

**Important:** Currently all authenticated users have full read/write access. Consider more granular permissions for production.

### Authentication Configuration

**Providers Enabled:**
- Google Sign-In

**Configuration:**
1. Firebase Console → Authentication → Sign-in method
2. Google provider enabled
3. Authorized domains:
   - `localhost` (for development)
   - `drr-egan.github.io` (for production)

**Sign-In Flow:**
1. User clicks "Sign in with Google"
2. Google OAuth popup
3. User selects account
4. Firebase creates/updates user record
5. Auth token stored in browser
6. `onAuthStateChanged` listener in `src/App.jsx` detects login
7. User redirected to MainApp

**Sign-Out:**
```javascript
import { auth } from './services/firebase';
import { signOut } from 'firebase/auth';

await signOut(auth);
// User automatically redirected to AuthComponent
```

### Real-Time Sync

All Firestore collections use **real-time listeners** in `MainApp.jsx`:

```javascript
useEffect(() => {
  // Items listener
  const itemsUnsub = onSnapshot(
    query(collection(db, 'items'), orderBy('name')),
    (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItems(itemsData);
    }
  );

  // Similar for users, checkoutHistory

  return () => {
    itemsUnsub();  // Cleanup on unmount
  };
}, []);
```

**Benefits:**
- Instant updates across all clients
- No manual refresh needed
- Collaborative editing
- Automatic sync on reconnect

### Firebase SDK Configuration

**File:** `src/services/firebase.js`

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCBOBb7mJPoI7cwubp12xnmjglLkuWYWYI",
    authDomain: "it-inventory-eaebc.firebaseapp.com",
    projectId: "it-inventory-eaebc",
    storageBucket: "it-inventory-eaebc.firebasestorage.app",
    messagingSenderId: "1081021280207",
    appId: "1:1081021280207:web:9619a96bff1692493aecba"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

**Security Note:** API key is intentionally public (restricted by Firebase security rules and domain allowlist).

---

## Service Worker & PWA Caching

### PWA Configuration

**Plugin:** `vite-plugin-pwa` with Workbox

**Manifest:** `public/manifest.webmanifest`
```json
{
  "name": "IT Inventory Management",
  "short_name": "IT Inventory",
  "start_url": "/it-inventory-web/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1976d2",
  "icons": [...]
}
```

### Service Worker Behavior

**File:** `dist/sw.js` (generated by Workbox)

**Strategies:**

**1. Precaching (Install Time):**
- All HTML, CSS, JS in `dist/assets/`
- Static assets (icons, manifest)
- PDF.js worker

**2. Runtime Caching:**
- Google Fonts: CacheFirst strategy
- CDN assets (unpkg.com): CacheFirst with 30-day expiration
- API calls: NetworkFirst (Firebase handles this)

**Cache Names:**
- `workbox-precache-v2-it-inventory` (auto-versioned)
- `google-fonts-stylesheets`
- `google-fonts-webfonts`
- `unpkg-cdn`

### Cache Invalidation

**Automatic:**
- `cleanupOutdatedCaches: true` in vite.config.js
- New service worker activates on `skipWaiting()`
- Old caches deleted automatically

**Manual (User Side):**
```
1. Open DevTools (F12)
2. Application → Service Workers
3. Click "Unregister"
4. Application → Storage → Clear site data
5. Hard refresh (Ctrl+Shift+R)
```

**Manual (Developer Side):**
```bash
# Increment cache version in vite.config.js
VitePWA({
  workbox: {
    cacheName: 'it-inventory-cache-v3'  // Increment version
  }
})
```

### Service Worker Lifecycle

**1. Install:**
- Service worker downloads
- Precaches all assets
- Waits in "waiting" state

**2. Activate:**
- Calls `skipWaiting()` to activate immediately
- Calls `clientsClaim()` to control all tabs
- Cleans up old caches

**3. Fetch:**
- Intercepts all network requests
- Serves from cache (CacheFirst) or network (NetworkFirst)
- Updates cache in background

### Debugging Service Worker

**Enable Service Worker Logs:**
```javascript
// In browser console
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg);
  console.log('Active:', reg.active);
  console.log('Waiting:', reg.waiting);
});
```

**View Cached Assets:**
```
DevTools → Application → Cache Storage → Expand cache names
```

**Update Service Worker:**
```
DevTools → Application → Service Workers → Update button
```

**Common Issues:**

**Service Worker Not Updating:**
- Check "Update on reload" checkbox in DevTools
- Manually unregister and refresh
- Clear all site data

**Old CSS Persisting:**
- Hard refresh: Ctrl+Shift+R
- Check cache storage for old asset hashes
- Verify new asset hash in `dist/index.html`

---

## Testing & Debugging

### Browser Developer Tools

**Essential Panels:**

**1. Console:**
- Check for Firebase initialization: `"Firebase initialized successfully"`
- Check for auth state: `"Auth state changed: user@email.com"`
- Check for errors: Red messages

**2. Network:**
- Filter by "Fetch/XHR" to see Firebase calls
- Check for failed requests (red)
- Verify asset loading (200 status codes)

**3. Application:**
- Service Workers: Check registration and status
- Storage → Local Storage: Check for `materialYouTheme`
- Storage → IndexedDB: Check Firebase offline persistence
- Cache Storage: View cached assets

**4. Elements:**
- Inspect `<body>` tag: Should have gradient background style
- Check computed styles for background property
- Verify CSS variables in `:root`

### Common Console Messages

**Normal (Good):**
```
Firebase initialized successfully
PDF services configured with lazy loading
Auth state changed: user@email.com
```

**Warnings (Usually OK):**
```
Cross-Origin-Opener-Policy policy would block the window.closed call.
// ^ This is from Firebase Auth popup, safe to ignore
```

**Errors (Need Fixing):**
```
Failed to load resource: 404
// ^ Check if resource path is correct

Firebase: Error (auth/popup-closed-by-user)
// ^ User closed auth popup, not a bug

Uncaught Error: ...
// ^ Actual error, needs investigation
```

### Testing Checklist

**After Making Changes:**

**1. Visual Testing:**
- [ ] Gradient background visible (blue → navy)
- [ ] Text readable (light color on dark background)
- [ ] Cards have glassmorphism effect (translucent blue)
- [ ] Badges colored correctly (red/green for stock, blue for codes)
- [ ] Top banner is blue with white text
- [ ] Firebase status bar is green

**2. Functional Testing:**
- [ ] Login with Google works
- [ ] All tabs accessible (Shop, Scanner, Inventory, etc.)
- [ ] Data loads in each tab
- [ ] Real-time sync works (open two tabs, change data, see update)
- [ ] CSV import/export works
- [ ] PDF upload works (Process Shipment)
- [ ] Logout works

**3. Performance Testing:**
- [ ] Initial load under 3 seconds
- [ ] Tab switching instant (after first load)
- [ ] No console errors
- [ ] Service worker registers successfully

**4. Mobile Testing:**
- [ ] Responsive layout works
- [ ] Touch interactions work
- [ ] No horizontal scrolling
- [ ] Text readable on small screen

### Testing Real-Time Sync

**Method:**
1. Open app in two browser windows (side by side)
2. Log in with same account in both
3. In window 1: Navigate to Inventory tab
4. In window 2: Navigate to Inventory tab
5. In window 1: Edit an item quantity
6. In window 2: Watch quantity update automatically (no refresh)

**Expected:** Changes appear in window 2 within 1-2 seconds

### Testing Service Worker

**Method 1: Offline Test**
```
1. Open app and load fully
2. Open DevTools → Network
3. Check "Offline" checkbox
4. Navigate between tabs
5. Expected: App continues working (from cache)
```

**Method 2: Cache Test**
```
1. Open app and load fully
2. Open DevTools → Application → Cache Storage
3. Expand cache name
4. Verify all assets present (HTML, CSS, JS, fonts)
```

**Method 3: Update Test**
```
1. Make a visible change (e.g., change button color)
2. Build and deploy
3. Wait 2-3 minutes for deployment
4. In browser: Hard refresh (Ctrl+Shift+R)
5. Expected: New change visible
```

### Debugging Techniques

**Problem: Gradient Not Showing**
```bash
# 1. Check built CSS
grep -n "background:linear-gradient" dist/assets/index-*.css

# 2. Check for background classes in components
grep -rn "className.*bg-" src/App.jsx src/components/MainApp.jsx

# 3. Inspect in browser
# Open DevTools → Elements → Inspect <body>
# Check computed styles for background property
# Should show: linear-gradient(135deg, rgb(30, 58, 138) 0%, rgb(15, 23, 42) 100%)
```

**Problem: Component Not Loading**
```javascript
// 1. Disable lazy loading temporarily
// In src/components/MainApp.jsx:
import ShopManager from './shop/ShopManager';  // Direct import
// const ShopManager = React.lazy(...)  // Comment out

// 2. Check console for import errors

// 3. Check component export
// In component file, must have:
export default ComponentName;
```

**Problem: Firebase Data Not Loading**
```javascript
// 1. Check console for Firebase errors

// 2. Verify auth state
console.log(auth.currentUser);  // Should show user object

// 3. Test Firestore query manually
import { collection, getDocs } from 'firebase/firestore';
const items = await getDocs(collection(db, 'items'));
console.log(items.docs.map(d => d.data()));

// 4. Check Firestore rules in Firebase Console
// Must allow authenticated read/write
```

**Problem: Styles Not Applying**
```javascript
// 1. Check CSS load order in src/main.jsx
import './styles/material-design.css';
import './index.css';

// 2. Check class name spelling
className="mat-card"  // Correct
className="mat-cards"  // Wrong (typo)

// 3. Check Tailwind purge
// Tailwind may remove unused classes
// Ensure class appears in component JSX
```

---

## Future Development Notes

### Planned Features (Not Yet Implemented)

**1. User Role Management:**
- Admin vs. regular user permissions
- Firestore rules based on user role
- Admin-only features (bulk delete, user management)

**2. Enhanced Reporting:**
- Inventory value reports
- Usage analytics
- Cost allocation by department over time
- Export to Excel

**3. Notifications:**
- Email alerts for low stock
- Push notifications (PWA)
- Shipment processing notifications

**4. Advanced Search:**
- Full-text search in items
- Filter by multiple categories
- Search history

**5. Barcode Generation:**
- Generate barcodes for new items
- Print barcode labels
- QR code generation

### Technical Debt

**1. Icon Path Issue:**
- Manifest references `/cart-icon.png` (root)
- Should be `/it-inventory-web/cart-icon.png` (base path)
- Low priority, non-critical

**2. Service Worker Caching:**
- Sometimes overly aggressive
- Consider implementing "Update Available" banner
- Allow user to manually trigger update

**3. Error Handling:**
- Some components lack proper error boundaries
- Network errors could be handled more gracefully
- Consider retry logic for failed Firestore operations

**4. Performance:**
- Large datasets (500+ items) may slow down
- Consider pagination for inventory list
- Implement virtual scrolling for long tables

**5. Accessibility:**
- Add ARIA labels to buttons and inputs
- Improve keyboard navigation
- Screen reader support

### Code Maintenance Guidelines

**When Adding New Features:**
1. Create new component in appropriate `src/components/` subdirectory
2. Use lazy loading if feature is not critical path
3. Follow Material Design 3 styling conventions
4. Use CSS variables for colors (theme-aware)
5. Implement loading states for async operations
6. Add proper error handling
7. Test real-time sync if using Firestore
8. Update this documentation

**When Refactoring:**
1. Test locally before committing
2. Verify no console errors
3. Check all tabs still work
4. Test with hard refresh
5. Verify service worker updates correctly
6. Update documentation if architecture changes

**When Fixing Bugs:**
1. Identify root cause (use debugging techniques above)
2. Create minimal reproduction case
3. Fix in smallest scope possible
4. Test fix thoroughly
5. Document solution in this file if likely to recur
6. Consider if fix reveals larger architectural issue

### Performance Optimization

**Current Bundle Sizes:**
- React vendor: ~141 KB (gzip: 45 KB)
- Firebase vendor: ~459 KB (gzip: 106 KB)
- PDF vendor: ~1087 KB (not gzipped due to worker)
- App code: ~14-16 KB per feature component

**Optimization Opportunities:**

**1. PDF.js Worker:**
- Largest asset (1+ MB)
- Only needed for Process Shipment tab
- Consider loading on-demand only

**2. Firebase Bundle:**
- Currently imports full auth and firestore
- Could use modular imports to reduce size
- Consider Firebase Lite SDK for smaller bundle

**3. Image Optimization:**
- Icons could be smaller
- Consider using SVG instead of PNG
- Implement lazy loading for images

**4. Code Splitting:**
- Already implemented for feature components
- Could split Material Design CSS by feature
- Consider route-based splitting

### Security Considerations

**Current Security:**
- Firebase security rules require authentication
- API key public but restricted by rules
- HTTPS enforced by GitHub Pages
- No sensitive data in client code

**Security Improvements to Consider:**

**1. Firestore Rules:**
```javascript
// More granular permissions
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.admin == true;  // Admin only
    }
  }
}
```

**2. Input Validation:**
- Add server-side validation (Cloud Functions)
- Sanitize user inputs before Firestore write
- Validate CSV uploads for malicious content

**3. Rate Limiting:**
- Implement rate limiting for bulk operations
- Prevent abuse of CSV import feature
- Use Firebase App Check for bot protection

**4. Audit Logging:**
- Log all write operations to Firestore
- Track who made changes and when
- Implement "last modified by" field

### Monitoring and Analytics

**Current Monitoring:**
- Browser console logs
- Firebase Console (basic metrics)
- GitHub Actions deployment logs

**Consider Adding:**

**1. Error Tracking:**
- Sentry or similar for production errors
- Automatic error reporting
- Stack traces for debugging

**2. Performance Monitoring:**
- Firebase Performance Monitoring
- Track page load times
- Identify slow Firestore queries

**3. User Analytics:**
- Firebase Analytics
- Track feature usage
- Identify popular/unused features

**4. Uptime Monitoring:**
- External service to ping app
- Alert on downtime
- Track Firebase availability

---

## Quick Reference

### Essential Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Build for production (output: dist/)
npm run preview          # Preview production build

# Deployment (automatic via GitHub Actions on push to main)
git add .
git commit -m "message"
git push origin main

# Debugging
grep "background:linear-gradient" dist/assets/index-*.css  # Check gradient
grep -rn "bg-gray\|bg-white" src/                          # Find bg classes
npm run build && ls -lh dist/assets/                       # Build and check sizes
```

### Key URLs

```
Production:      https://drr-egan.github.io/it-inventory-web/
Firebase Console: https://console.firebase.google.com/project/it-inventory-eaebc
GitHub Repo:     https://github.com/drr-egan/it-inventory-web
GitHub Actions:  https://github.com/drr-egan/it-inventory-web/actions
```

### Important Files to Remember

```
⚠️ DO NOT add bg-* classes:
  - src/App.jsx
  - src/components/MainApp.jsx

✅ Gradient background defined:
  - src/index.css (lines 6-19)

✅ Material Design tokens:
  - src/styles/material-design.css

✅ Firebase configuration:
  - src/services/firebase.js

✅ Build configuration:
  - vite.config.js
  - .github/workflows/deploy.yml
```

### Color Palette Reference

```css
/* Background Gradient */
#1e3a8a → #0f172a  (blue-900 → slate-950)

/* Primary Colors */
#2563eb  Blue (main brand)
#10b981  Green (success, adequate stock)
#f59e0b  Yellow (warning)
#ef4444  Red (error, low stock)

/* Text Colors */
#f8fafc  Light text (on dark background)
#cbd5e1  Muted text

/* Card Colors */
rgba(59, 130, 246, 0.1)  Translucent blue background
rgba(59, 130, 246, 0.2)  Translucent blue border
```

---

## Conclusion

This documentation provides a comprehensive overview of the IT Inventory Web application's current state as of 2025-10-01. The app has been successfully migrated to a modern Vite architecture with Material Design 3 styling and real-time Firebase backend.

**Key Takeaways:**
- ✅ Modern modular architecture with React + Vite
- ✅ Real-time data sync with Firebase Firestore
- ✅ Material Design 3 with custom dark gradient theme
- ✅ Automated deployment via GitHub Actions
- ✅ PWA capabilities with offline support
- ⚠️ Never add `bg-*` classes to root containers
- ⚠️ Service worker may cache aggressively (hard refresh needed)

For questions or issues, refer to the [Known Issues & Solutions](#known-issues--solutions) section.

**Last Updated:** 2025-10-01 by Claude Code
