# IT Inventory Web - Troubleshooting Guide

**Quick Reference for Common Issues and Solutions**

---

## Table of Contents

1. [Visual/Styling Issues](#visualstyling-issues)
2. [Firebase/Backend Issues](#firebasebackend-issues)
3. [Build/Deployment Issues](#builddeployment-issues)
4. [Component/Feature Issues](#componentfeature-issues)
5. [Performance Issues](#performance-issues)
6. [Service Worker/Caching Issues](#service-workercaching-issues)

---

## Visual/Styling Issues

### Issue: White Background Instead of Gradient

**Symptoms:**
- App background is white or light gray
- Login screen shows gradient, but main app is white
- CSS seems correct but doesn't apply

**Diagnosis:**
```bash
# 1. Check if gradient exists in built CSS
grep "background:linear-gradient" dist/assets/index-*.css
# Expected: body{...background:linear-gradient(135deg,#1e3a8a 0%,#0f172a 100%)!important...}

# 2. Check for background classes overriding
grep -rn "className.*bg-gray\|className.*bg-white" src/App.jsx src/components/MainApp.jsx
# Expected: NO RESULTS (any bg-* classes here will override gradient)

# 3. Check browser computed styles
# Open DevTools → Elements → Inspect <body>
# Computed tab → Search for "background"
# Should show: linear-gradient(135deg, rgb(30, 58, 138) 0%, rgb(15, 23, 42) 100%)
```

**Solutions:**

**A. Remove Background Classes (Developer Fix):**
```javascript
// ❌ WRONG - in src/App.jsx or src/components/MainApp.jsx
<div className="min-h-screen bg-gray-50">

// ✅ CORRECT
<div className="min-h-screen">
```

**B. Clear Cache (User Fix):**
```
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. If still white:
   - Open DevTools (F12)
   - Application → Service Workers → Unregister
   - Application → Storage → Clear site data
   - Hard refresh again
```

**C. Verify Service Worker Update (User Fix):**
```
1. Open DevTools → Application → Service Workers
2. Check "Update on reload" checkbox
3. Hard refresh
4. Check timestamp of active service worker (should be recent)
```

**Prevention:**
- Never add Tailwind `bg-*` classes to root containers
- Always test with hard refresh after style changes
- Add comments in code: `{/* ⚠️ NO bg-* classes - will override gradient */}`

---

### Issue: Text Not Readable (Dark Text on Dark Background)

**Symptoms:**
- Text appears very dark or invisible
- Some components have black text
- Hard to read content

**Diagnosis:**
```bash
# Check for hardcoded dark text colors
grep -rn "text-gray-900\|text-black" src/components/

# Check for missing color variables
grep -rn "style.*color:" src/components/ | grep -v "color-"
```

**Solution:**
```javascript
// ❌ WRONG - Hardcoded dark text
<span className="text-gray-900">Text</span>

// ✅ CORRECT - Use CSS variables
<span style={{ color: 'var(--color-text-light)' }}>Text</span>

// ✅ ALSO CORRECT - Tailwind light colors
<span className="text-gray-100">Text</span>
```

**Quick Fix for Components:**
Replace `text-gray-900`, `text-gray-800`, `text-black` with:
- `text-gray-100` or `text-gray-200` for light text
- `style={{ color: 'var(--color-text-light)' }}` for theme-aware text

---

### Issue: Cards Not Translucent (Glassmorphism Missing)

**Symptoms:**
- Cards have solid backgrounds
- No blur effect behind cards
- Cards look flat, not Material Design 3

**Diagnosis:**
```bash
# Check if mat-card class is being used
grep -rn "mat-card" src/components/

# Check if material-design.css is loaded
grep "material-design.css" src/main.jsx
```

**Solution:**
```javascript
// ❌ WRONG - No glassmorphism
<div className="bg-white rounded-lg p-4">

// ✅ CORRECT - Material Design card
<div className="mat-card p-6">

// ✅ ALSO CORRECT - Inline translucent style
<div style={{
  background: 'var(--color-card-bg)',
  backdropFilter: 'blur(10px)',
  border: '1px solid var(--color-card-border)',
  borderRadius: 'var(--md-sys-shape-corner-large)'
}}>
```

**Verification:**
- Open DevTools → Elements → Inspect card element
- Computed styles should show:
  - `background: rgba(59, 130, 246, 0.1)`
  - `backdrop-filter: blur(10px)`
  - `border: 1px solid rgba(59, 130, 246, 0.2)`

---

### Issue: Badges Wrong Color or Missing

**Symptoms:**
- Quantity badges are not red/green
- Navigation count badges missing
- Pill badges for codes not styled

**Diagnosis:**
```bash
# Check badge class usage
grep -rn "badge" src/components/

# Expected classes:
# - count-badge (navigation)
# - quantity-badge (with .low-stock or .adequate-stock)
# - pill-badge (cost codes, IDs)
```

**Solution:**
```javascript
// Navigation count badge
<span className="count-badge">{count}</span>

// Quantity badge (stock level)
<span className={`quantity-badge ${
  item.quantity <= (item.minThreshold || 5)
    ? 'low-stock'      // Red background
    : 'adequate-stock' // Green background
}`}>
  {item.quantity}
</span>

// Pill badge (cost codes, IDs)
<span className="pill-badge">{costCode}</span>
```

---

## Firebase/Backend Issues

### Issue: "Firebase not initialized" Error

**Symptoms:**
- Console shows "Firebase not initialized" or similar error
- Auth doesn't work
- Data doesn't load
- White screen with error

**Diagnosis:**
```javascript
// In browser console, run:
console.log(firebase);  // Should be defined
console.log(auth);      // Should be object
console.log(db);        // Should be object
```

**Solutions:**

**A. Check Firebase Import:**
```javascript
// In component file
import { auth, db } from '../services/firebase';

// Should NOT show errors
```

**B. Check Firebase Config:**
```bash
# Verify config exists
cat src/services/firebase.js

# Should contain:
# const firebaseConfig = { apiKey: "...", ... }
```

**C. Clear Cache and Reload:**
```
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check console for "Firebase initialized successfully"
```

**D. Check Network (Firewall/VPN):**
```
1. Open DevTools → Network tab
2. Filter by "firebaseapp" or "googleapis"
3. Check if requests are blocked (Status: failed/cancelled)
4. If blocked: Disable VPN or check firewall settings
```

---

### Issue: Authentication Loop (Keeps Redirecting to Login)

**Symptoms:**
- Successfully sign in with Google
- Redirected back to login screen
- Never reaches main app
- Console shows auth state changing repeatedly

**Diagnosis:**
```javascript
// In browser console, check auth state
auth.currentUser  // Should be object if logged in, null if not

// Check localStorage
localStorage.getItem('firebase:authUser')  // Should exist if logged in
```

**Solutions:**

**A. Clear Auth State:**
```javascript
// In browser console, run:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

**B. Check Third-Party Cookies:**
```
1. Browser settings → Privacy
2. Ensure third-party cookies are allowed
3. Or add exception for firebaseapp.com
```

**C. Check Firebase Auth Configuration:**
```
1. Firebase Console → Authentication → Sign-in method
2. Verify Google provider is enabled
3. Check authorized domains include:
   - localhost
   - drr-egan.github.io
```

---

### Issue: Data Not Loading (Empty Tables)

**Symptoms:**
- Tables show "No items found"
- Data exists in Firebase but not displaying
- Loading spinner never completes

**Diagnosis:**
```javascript
// In browser console, manually fetch data:
import { collection, getDocs } from 'firebase/firestore';
import { db } from './services/firebase';

const snapshot = await getDocs(collection(db, 'items'));
console.log(snapshot.docs.map(d => d.data()));
// Should show array of items
```

**Solutions:**

**A. Check Firestore Rules:**
```
1. Firebase Console → Firestore Database → Rules
2. Verify rules allow authenticated read:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if request.auth != null;
    }
  }
}
```

**B. Check Real-Time Listener:**
```javascript
// In MainApp.jsx, verify useEffect is NOT commented out:
useEffect(() => {
  const itemsUnsub = onSnapshot(
    query(collection(db, 'items'), orderBy('name')),
    (snapshot) => {
      setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  );
  return () => itemsUnsub();
}, []);
```

**C. Check Console for Errors:**
```
Look for:
- "FirebaseError: Missing or insufficient permissions"
  → Check Firestore rules
- "FirebaseError: Collection 'items' does not exist"
  → Check collection name spelling
```

---

### Issue: Real-Time Sync Not Working

**Symptoms:**
- Changes in one tab don't appear in another
- Have to refresh to see updates
- Data seems stale

**Diagnosis:**
```bash
# Check if onSnapshot is being used (not get/getDocs)
grep -rn "onSnapshot" src/components/MainApp.jsx
# Should show real-time listeners for items, users, checkoutHistory

# Check for getDocs usage (one-time fetch, not real-time)
grep -rn "getDocs" src/
# Should NOT be used for main data (items, users, history)
```

**Solution:**
```javascript
// ❌ WRONG - One-time fetch, no real-time sync
const snapshot = await getDocs(collection(db, 'items'));
setItems(snapshot.docs.map(d => d.data()));

// ✅ CORRECT - Real-time listener
const unsubscribe = onSnapshot(
  collection(db, 'items'),
  (snapshot) => {
    setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  }
);
return () => unsubscribe();  // Cleanup
```

---

## Build/Deployment Issues

### Issue: Build Fails with Errors

**Symptoms:**
- `npm run build` shows errors
- Red error messages in terminal
- Build does not complete

**Common Errors and Fixes:**

**A. Syntax Error:**
```bash
# Error message will show file and line number
# Example: src/components/Shop.jsx:45:12

# Fix: Open file, go to line, fix syntax
# Common issues:
# - Missing closing tag: </div>
# - Unclosed JSX expression: {item.name
# - Missing comma in object: { a: 1 b: 2 }
```

**B. Import Error:**
```bash
# Error: Cannot find module './Component'

# Fix: Check import path
import Component from './Component';  // ❌ File doesn't exist
import Component from './Component.jsx';  // ✅ Correct extension

# Or check file exists:
ls -la src/components/Component.jsx
```

**C. Dependency Error:**
```bash
# Error: Cannot find package 'some-package'

# Fix: Install dependency
npm install some-package
```

**Clean Build (Nuclear Option):**
```bash
# Remove all build artifacts and dependencies
rm -rf node_modules dist .vite
npm ci
npm run build
```

---

### Issue: Deployment Succeeds but Changes Not Visible

**Symptoms:**
- GitHub Actions shows green checkmark
- Build completed successfully
- But changes not visible on live site
- Old version still showing

**Diagnosis:**
```bash
# 1. Check GitHub Actions log
# Go to: https://github.com/drr-egan/it-inventory-web/actions
# View latest workflow run
# Verify it actually deployed (not just built)

# 2. Check git commit hash
git log -1 --oneline
# Note the commit hash

# 3. Check live site
# View source of https://drr-egan.github.io/it-inventory-web/
# Look for asset hashes in <script> and <link> tags
# Compare to dist/index.html locally
```

**Solutions:**

**A. Wait for Deployment (Most Common):**
```
Deployment takes 2-5 minutes after GitHub Actions completes
- Wait 5 minutes
- Hard refresh (Ctrl+Shift+R)
- Clear service worker and cache
```

**B. Manual Deploy:**
```bash
# If automatic deployment fails

# 1. Build locally
npm run build

# 2. Commit and push
git add dist/
git commit -m "Manual deploy"
git push origin main

# 3. Wait 2-5 minutes, hard refresh
```

**C. Check GitHub Pages Settings:**
```
1. Go to repository → Settings → Pages
2. Verify:
   - Source: Deploy from a branch
   - Branch: gh-pages
   - Folder: / (root)
```

---

### Issue: 404 on Assets After Deployment

**Symptoms:**
- Site loads but shows errors
- CSS/JS files 404
- Console shows "Failed to load resource"

**Diagnosis:**
```bash
# Check base path in vite.config.js
grep "base:" vite.config.js
# Should show: base: '/it-inventory-web/',

# Check built index.html
grep "assets/" dist/index.html
# Paths should start with /it-inventory-web/assets/
```

**Solution:**
```javascript
// In vite.config.js
export default defineConfig({
  base: '/it-inventory-web/',  // ✅ MUST match repo name
  // NOT: base: '/',  // ❌ Wrong for GitHub Pages subdirectory
})
```

Rebuild and redeploy after fixing.

---

## Component/Feature Issues

### Issue: Specific Tab Shows Blank/White

**Symptoms:**
- Most tabs work fine
- One specific tab (e.g., "Inventory") is blank
- No content renders
- Console may or may not show errors

**Diagnosis:**
```bash
# 1. Check if component file exists
ls -la src/components/inventory/InventoryManager.jsx

# 2. Check lazy loading import
grep "InventoryManager" src/components/MainApp.jsx

# 3. Check browser console for import errors
# Look for: "Failed to load module" or "Uncaught SyntaxError"
```

**Solutions:**

**A. Fix Import Path:**
```javascript
// In MainApp.jsx
const InventoryManager = React.lazy(() =>
  import('./inventory/InventoryManager')  // ✅ Correct
  // NOT: import('./inventory/InventoryManager.jsx')  // ❌ May fail
);
```

**B. Temporarily Disable Lazy Loading:**
```javascript
// Debug by removing lazy loading
import InventoryManager from './inventory/InventoryManager';
// const InventoryManager = React.lazy(...)  // Comment out

// This will show errors immediately in console
```

**C. Check Component Export:**
```javascript
// In InventoryManager.jsx, must have:
export default InventoryManager;  // ✅ Default export

// NOT: export { InventoryManager };  // ❌ Named export won't work with lazy
```

---

### Issue: CSV Import/Export Not Working

**Symptoms:**
- Click "Import CSV" but nothing happens
- Export downloads empty file
- Console shows errors

**Diagnosis:**
```javascript
// Check PapaParse is imported
grep -n "papaparse" src/components/

// Check file input element
// Should have: accept=".csv"
```

**Solutions:**

**A. Check PapaParse CDN:**
```html
<!-- In index.html, verify PapaParse is loaded -->
<script src="https://unpkg.com/papaparse@5.4.1/papaparse.min.js"></script>
```

**B. Check Browser Console:**
```
Look for:
- "Papa is not defined" → PapaParse not loaded
- "File is empty" → Check CSV format
- "Permission denied" → Check file input permissions
```

**C. Verify CSV Format:**
```csv
Item,Stock Quantity,Price,ASIN,Category
Example Item,10,29.99,B07XYZ,Electronics

# Must have header row
# Columns must match expected names exactly
```

---

### Issue: PDF Upload/Processing Fails

**Symptoms:**
- Upload PDF but nothing happens
- Processing hangs forever
- Error message shows

**Diagnosis:**
```javascript
// Check PDF.js is loaded
console.log(pdfjsLib);  // Should be defined

// Check PDF file
// - Must be valid PDF (not renamed .doc or .txt)
// - Size should be reasonable (< 10 MB)
// - Not password protected
```

**Solutions:**

**A. Check PDF.js CDN:**
```html
<!-- In index.html -->
<script src="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js"></script>
```

**B. Check Worker Path:**
```javascript
// In src/services/pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
```

**C. Test with Different PDF:**
```
1. Try uploading a different PDF file
2. If that works, original PDF may be corrupted
3. Try re-saving original PDF from PDF reader
```

---

## Performance Issues

### Issue: Slow Initial Load

**Symptoms:**
- App takes 5+ seconds to load
- White screen for extended period
- Progress bar stuck

**Diagnosis:**
```bash
# Check bundle sizes
npm run build
# Look for large bundles (> 500 KB)

# Check network in DevTools
# Open DevTools → Network → Reload
# Sort by Size (largest first)
# Look for bottlenecks
```

**Solutions:**

**A. Check Internet Connection:**
```
Large bundles:
- Firebase vendor: ~459 KB (gzip: 106 KB)
- React vendor: ~141 KB (gzip: 45 KB)
- PDF.js worker: ~1087 KB (not gzipped)

On slow connection (< 1 Mbps), this can take 10+ seconds
```

**B. Implement Loading Skeleton:**
```javascript
// Add loading skeleton instead of blank screen
<Suspense fallback={<DetailedLoadingSkeleton />}>
  {/* Component */}
</Suspense>
```

**C. Optimize PDF.js (If Not Using Process Shipment):**
```javascript
// In vite.config.js, consider conditional loading
// Only load PDF.js when needed, not on initial load
```

---

### Issue: Lag When Switching Tabs

**Symptoms:**
- Delay when clicking different tabs
- UI freezes briefly
- Slow response

**Diagnosis:**
```bash
# Check if lazy loading is implemented
grep "React.lazy" src/components/MainApp.jsx

# Check component sizes
ls -lh dist/assets/*.js | sort -k5 -h
```

**Solution:**
```javascript
// Ensure components are lazy loaded
const InventoryManager = React.lazy(() =>
  import('./inventory/InventoryManager')
);

// NOT all imported at once:
// import InventoryManager from './inventory/InventoryManager';
```

---

### Issue: Large Data Sets Cause Slowdown

**Symptoms:**
- 500+ items in inventory
- Tables slow to render
- Scrolling is laggy

**Solutions:**

**A. Implement Pagination:**
```javascript
// Show 50 items per page instead of all
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 50;
const paginatedItems = items.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
);
```

**B. Implement Virtual Scrolling:**
```javascript
// Use react-window or react-virtualized
// Only renders visible items
import { FixedSizeList } from 'react-window';
```

**C. Add Search/Filter:**
```javascript
// Reduce visible items by filtering
const filteredItems = items.filter(item =>
  item.name.toLowerCase().includes(searchTerm.toLowerCase())
);
```

---

## Service Worker/Caching Issues

### Issue: Updates Not Appearing After Deployment

**Symptoms:**
- New version deployed
- GitHub Actions shows success
- But users see old version
- Hard refresh doesn't help

**Solutions:**

**A. Unregister Service Worker (User):**
```
1. Open DevTools (F12)
2. Application tab → Service Workers
3. Click "Unregister" button
4. Close and reopen browser
5. Visit site again
```

**B. Clear All Site Data (User):**
```
1. Open DevTools (F12)
2. Application tab → Storage
3. Click "Clear site data" button
4. Close and reopen browser
5. Visit site again
```

**C. Force Update (Developer):**
```javascript
// In vite.config.js, increment cache version
VitePWA({
  workbox: {
    cacheName: 'it-inventory-cache-v3'  // Increment number
  }
})

// Rebuild and redeploy
npm run build
git add vite.config.js dist/
git commit -m "Force cache update"
git push
```

---

### Issue: Offline Mode Not Working

**Symptoms:**
- Expected offline functionality (PWA)
- But app doesn't work offline
- Shows "No internet connection" error

**Diagnosis:**
```javascript
// Check if service worker is registered
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg);
  console.log('Active:', reg?.active?.state);
});
// Should show: active: "activated"
```

**Solutions:**

**A. Check Service Worker Registration:**
```
1. Open DevTools → Application → Service Workers
2. Should show service worker as "activated"
3. If "redundant" or missing, check console for errors
```

**B. Verify Workbox Configuration:**
```javascript
// In vite.config.js
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,jpg,svg}']
  }
})
```

**C. Test Offline:**
```
1. Load app fully (visit all tabs)
2. Open DevTools → Network
3. Check "Offline" checkbox
4. Navigate between tabs
5. Should work from cache
```

---

### Issue: Old Service Worker Won't Update

**Symptoms:**
- New service worker in "waiting" state
- Never activates
- skipWaiting() not working

**Solutions:**

**A. Force Activation (Developer):**
```javascript
// In browser console
navigator.serviceWorker.getRegistration().then(reg => {
  reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
  location.reload();
});
```

**B. Check for Open Tabs:**
```
Service workers won't update if multiple tabs are open:
1. Close all tabs of the site
2. Open one new tab
3. Visit site
4. New service worker should activate
```

**C. Bypass for Development:**
```
In DevTools:
1. Application → Service Workers
2. Check "Update on reload"
3. Check "Bypass for network"
4. Now every reload gets fresh content
```

---

## Emergency Procedures

### Nuclear Option: Complete Reset

If all else fails and you need to start fresh:

**User Side:**
```
1. Open DevTools (F12)
2. Application → Storage → Clear site data
3. Application → Service Workers → Unregister all
4. Close browser completely
5. Clear browser cache (Ctrl+Shift+Delete)
6. Reopen browser
7. Visit site
```

**Developer Side:**
```bash
# Complete clean rebuild
rm -rf node_modules dist .vite
npm ci
npm run build
git add dist/
git commit -m "Clean rebuild"
git push origin main

# Wait 5 minutes for deployment
# Hard refresh in browser (Ctrl+Shift+R)
```

---

## Getting Help

If issue persists after trying solutions:

**1. Gather Information:**
```
- Browser and version
- Operating system
- Console error messages (F12 → Console)
- Network errors (F12 → Network)
- Steps to reproduce
```

**2. Check Documentation:**
- `CURRENT_STATE.md` - Architecture and current state
- `CLAUDE.md` - Project overview
- This file - Troubleshooting

**3. Create Issue:**
```markdown
**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- URL: https://drr-egan.github.io/it-inventory-web/

**Issue:**
[Describe problem]

**Steps to Reproduce:**
1. [Step one]
2. [Step two]

**Expected:**
[What should happen]

**Actual:**
[What actually happens]

**Console Errors:**
```
[Paste errors]
```

**Screenshots:**
[Attach if helpful]
```

---

**Last Updated:** 2025-10-01
