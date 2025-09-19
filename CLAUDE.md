# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an IT Inventory Management web application built with React (via CDN) that runs as a single-page application (SPA). The application supports **multiple deployment models** to accommodate different environments and requirements.

## Architecture & Deployment Models

The application supports three distinct deployment architectures:

### 1. **GitHub Pages + Firebase (Production)**
*Current production deployment for cloud-based multi-user access*

- **Frontend**: GitHub Pages hosting with `index-github-pages.html`
- **Backend**: Firebase Firestore with real-time synchronization
- **Authentication**: Firebase Auth with Google sign-in
- **Data Storage**: Firebase Firestore collections (items, users, checkoutHistory)
- **Deployment**: Automated via GitHub Actions workflow
- **Features**: Multi-user collaboration, real-time updates, authentication, Material Design UI

### 2. **GitHub Pages + LocalStorage (Fallback)**
*Client-side data storage for offline-capable deployment*

- **Frontend**: GitHub Pages hosting with data adapter pattern
- **Backend**: Mock API using `github-pages-adapter.js`
- **Data Storage**: Browser localStorage with static JSON file initialization
- **Features**: Offline functionality, client-side data persistence, no authentication required

### 3. **Local Development (Legacy)**
*For local development and testing - localhost ports 8080/3001*

- **Frontend**: Local HTTP server (`python3 -m http.server 8080`)
- **Backend**: SQLite API server (`simple-api-server.py`) on port 3001
- **Data Storage**: SQLite database (`inventory.db`)
- **Launcher**: Coordinated startup via `start-app.py`
- **Note**: All localhost port references (8080, 3001) apply ONLY to this local development mode

## Key Components

The application consists of several main functional areas:
- **Shop**: Browse and add items to cart with category filtering and price display
- **Cart**: Manage selected items and complete checkout process
- **Process Shipment**: Upload PDF receipts to match against checkout history
- **Users**: Manage user database via CSV import
- **Inventory Management**: Unified interface for comprehensive inventory control including manual creation, CSV import/export, barcode scanning, and price management
- **Checkout History**: View and import historical checkout records
- **Notifications**: Display low stock alerts and export functionality

## Deployment Commands

### Production (GitHub Pages + Firebase)
**Current deployment mode - automatically deployed via GitHub Actions**

No manual commands needed. Push to main branch triggers automatic deployment:
1. GitHub Actions copies `index-github-pages.html` to `index.html`
2. Validates and prepares static JSON data files
3. Deploys to GitHub Pages
4. Application connects to Firebase for real-time data

**Access**: Via GitHub Pages URL (e.g., `https://username.github.io/it-inventory-app`)

### Local Development (Legacy)
**For development and testing only - uses localhost ports 8080/3001**

```bash
# Start complete local environment
python3 start-app.py
```
This starts both the SQLite API server (port 3001) and HTTP server (port 8080).

**Prerequisites**: Python 3 and SQLite support required.

**Database Setup**: Create/update SQLite database from JSON:
```bash
python3 convert-to-sqlite.py
```

**Manual Server Management**:
```bash
# Start SQLite API server only (port 3001)
python3 simple-api-server.py

# Start HTTP server only (port 8080)
python3 -m http.server 8080
```

**⚠️ Important**: All localhost port references (8080, 3001) apply ONLY to local development mode and are not relevant for the current GitHub Pages + Firebase production deployment.

## Firebase Configuration

### Setup Requirements
The production deployment uses Firebase for backend services:

**Firebase Project Configuration:**
- Project ID: `it-inventory-eaebc`
- Authentication: Google sign-in enabled
- Firestore: Cloud database with real-time sync
- Security Rules: Configured for authenticated access

**Collections Structure:**
- `items`: Inventory items with fields: name, asin, quantity, minThreshold, category, price
- `users`: User profiles with authentication integration
- `checkoutHistory`: Checkout records with user assignments and timestamps

**Authentication Flow:**
1. User visits GitHub Pages URL
2. Firebase Auth loads Google sign-in
3. Successful authentication grants Firestore access
4. Real-time data synchronization begins

### Environment Variables
Firebase configuration is embedded directly in `index-github-pages.html`:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyCBOBb7mJPoI7cwubp12xnmjglLkuWYWYI",
    authDomain: "it-inventory-eaebc.firebaseapp.com",
    projectId: "it-inventory-eaebc",
    storageBucket: "it-inventory-eaebc.firebasestorage.app",
    messagingSenderId: "1081021280207",
    appId: "1:1081021280207:web:9619a96bff1692493aecba"
};
```

## GitHub Actions Deployment

### Automated Deployment Workflow
Located at `.github/workflows/deploy.yml`, the workflow:

1. **Triggers**: On push to main branch or manual dispatch
2. **File Preparation**:
   - Copies `index-github-pages.html` → `index.html`
   - Validates static JSON data files in `/data/` directory
   - Creates fallback empty arrays for missing data files
3. **Deployment**: Uploads to GitHub Pages with artifact optimization

### Manual Deployment
To manually trigger deployment:
1. Go to GitHub repository → Actions tab
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow" button

### Data File Management
Static JSON files in `/data/` directory provide initialization data:
- Automatically validated as valid JSON during deployment
- Used by GitHub Pages adapter for localStorage fallback
- Serve as default data when Firebase is unavailable

## Data Management

### Item Management
Items can be managed through multiple methods:

**Manual Creation:**
- Interactive form in Items Admin tab for single item creation
- Fields: Item Name (required), Price, Initial Quantity, ASIN, Category
- Auto-populates category dropdown from existing categories
- Real-time form validation and status feedback

**CSV Import:**
- Bulk import with columns: Item (required), Stock Quantity (required), Price (optional), ASIN (optional), Category (optional)
- Supports pricing data for cost tracking and budgeting
- Automatic category assignment with "Uncategorized" fallback

**Barcode Scanning:**
- Quick inventory updates via barcode scanner integration
- Rapid quantity adjustments for receiving shipments

### Other Data Types
- **Users**: Managed via CSV import with columns: FirstName (required), LastName (required), CostCode (required)
- **Checkout History**: Managed via CSV import with columns: ItemName (required), UserName (required), DepartmentId (required), JobNum (optional)

### Item Pricing System
The system includes comprehensive pricing support:
- **Price Storage**: Items can have price data stored as decimal values in SQLite database
- **Database Schema**: Items table includes `price REAL DEFAULT 0.0` column
- **API Support**: PATCH and POST endpoints support price field for updates and creation
- **Visual Display**: Prices shown prominently in green ($XX.XX format) throughout the interface
- **Conditional Rendering**: Prices only display when > 0 to avoid clutter
- **Cost Allocation**: Prices used in shipment cost calculations and reporting
- **Budget Tracking**: Enables cost analysis and inventory value calculations
- **Shipment Updates**: Process Shipment feature can update item prices based on receipt data

### Department ID Formatting
Department IDs are automatically formatted to follow the pattern `x-xx-xxx-5770` throughout the system:
- **History Import**: When importing checkout history via CSV, department IDs are formatted before being saved
- **Cost Allocation**: When generating cost allocation reports, department IDs used as cost codes are formatted consistently
- **Format Logic**: Preserves original department structure but ensures third segment is exactly 3 digits and ends with "5770" suffix
- **Examples**: 
  - `2-20-0600` → `2-20-060-5770`
  - `1-10-2000` → `1-10-200-5770`
  - `3-10-100` → `3-10-100-5770`

## Key State Management

The React app uses hooks for state management:
- `items`: Inventory items array
- `users`: User database array  
- `checkoutHistory`: Historical checkout records
- `cart`: Shopping cart items
- `notifications`: Low stock alerts
- Multiple sort configurations for table sorting
- File upload states for CSV/PDF processing

## PDF Processing & Cost Allocation

The app provides comprehensive PDF receipt processing with advanced cost allocation features:

### PDF Upload & Analysis
- Uses PDF.js for text extraction and visual preview generation
- Automatically matches items in PDF text against checkout history records
- Supports quantity and price extraction from receipt formats

### Cost Allocation Reports
- **Appended Reports**: Automatically appends cost allocation summary to original uploaded PDF
- **Text Wrapping**: Full item descriptions displayed without truncation using intelligent text wrapping
- **Department ID Formatting**: Consistently formats department IDs as x-xx-xxx-5770 pattern
- **Job Number Integration**: Uses job numbers when available, falls back to formatted department IDs
- **Dual Pricing Structure**: Shows base unit price separate from total cost (including distributed taxes/fees)
- **Multi-line Support**: Accommodates long item names and user names across multiple lines
- **Dynamic Layout**: Tables automatically adjust row height based on content length

### Report Components
1. **Cost Allocation Summary Table**
   - Item Description (with text wrapping)
   - Quantity and Units
   - Job/Cost Code (job numbers or formatted department IDs)
   - Unit Price (base price without taxes/fees)
   - Total Cost (includes distributed taxes and fees)
   
2. **Individual Checkout Details**
   - Complete item-by-item breakdown
   - User assignments with cost codes
   - Multi-line formatting for readability

3. **Financial Breakdown**
   - Subtotal (items only)
   - Tax allocation (distributed evenly per item)
   - Fee allocation (distributed evenly per item)
   - Grand total with complete transparency

### Technical Implementation
- **PDF-lib Integration**: Uses PDF-lib for PDF manipulation and merging
- **Fallback System**: Generates standalone reports if PDF appending fails
- **Error Handling**: Comprehensive error logging and graceful degradation
- **Memory Management**: Efficient handling of large PDF files

### Output Files
- **Success**: `shipment-with-allocation-[timestamp].pdf` (original + appended report)
- **Fallback**: `shipment-allocation-[timestamp].pdf` (standalone report)

After processing, allocated items are automatically removed from checkout history to prevent double-allocation.

## Inventory Management

The Inventory Management tab (formerly Items Admin and Bulk Inventory) provides comprehensive inventory management with unified interface:

### Features
- **Manual Item Creation**: Interactive form for adding new inventory items with price support
- **Dual Mode Operation**: Toggle between Edit Mode and Scan Mode for inventory management
- **Barcode Scanning**: Rapid inventory counting via barcode scanner
- **Editable Table**: Direct quantity and price editing with inline save functionality
- **Price Management**: View and edit item prices in dedicated column with formatted display
- **Search & Filter**: Find items by name, ASIN, or category filter
- **CSV Export**: Download template with current quantities and prices for spreadsheet editing
- **CSV Import**: Upload updated quantities and prices from spreadsheet
- **Bulk Actions**: Set all items to zero with confirmation prompt
- **Visual Indicators**: Color-coded quantity badges (red for low stock, green for adequate)
- **Real-time Feedback**: Visual highlighting of recently scanned items

### Edit Mode Workflow
1. **Export Template**: Click "Export Template" to download current inventory as CSV
2. **Edit in Spreadsheet**: Update the "New Quantity" column with desired quantities
3. **Import Updates**: Use "Import CSV" to bulk update all quantities
4. **Direct Editing**: Alternatively, edit quantities directly in the table and click Save

### Scan Mode Workflow
1. **Switch to Scan Mode**: Click "📷 Switch to Scan Mode" button
2. **Rapid Scanning**: Use barcode scanner or type item names
3. **Auto-increment**: Each scan automatically adds +1 to item quantity
4. **Visual Feedback**: Scanned items highlight in green with sparkle icon (✨)
5. **Track Progress**: View scan count and clear data as needed
6. **Return to Edit**: Switch back to Edit Mode when finished

### CSV Format
The CSV template includes columns:
- **Item**: Item name (required for matching)
- **Current Quantity**: Current inventory level
- **New Quantity**: Updated quantity to set (leave blank to skip item)
- **Price**: Item price (leave blank to skip price updates)
- **ASIN**: Product identifier
- **Category**: Item category

## Data Management APIs

### Firebase API (Production)
**Current production backend - cloud-based Firestore**

Firestore collections:
- **items**: Inventory management with real-time synchronization
- **users**: User management with authentication
- **checkoutHistory**: Checkout records with audit trail

**Authentication**: Firebase Auth with Google sign-in required
**Real-time Updates**: Automatic synchronization across all connected clients

### GitHub Pages Adapter API (Fallback)
**Client-side mock API for offline functionality**

Mock endpoints via `github-pages-adapter.js`:
- `GET/POST/PATCH/DELETE /items` - Inventory management
- `GET/POST/PATCH/DELETE /users` - User management
- `GET/POST/DELETE /checkoutHistory` - Checkout records

**Storage**: Browser localStorage with JSON file initialization
**Persistence**: Local to browser, no server required

### SQLite API (Local Development Only)
**Legacy backend for local development - localhost:3001**

REST endpoints at `http://localhost:3001`:
- `GET/POST/PATCH/DELETE /items` - Inventory management (supports price field)
- `GET/POST/PATCH/DELETE /users` - User management
- `GET/POST/DELETE /checkoutHistory` - Checkout records

**⚠️ Note**: SQLite API endpoints are only available in local development mode and do not apply to the current GitHub Pages + Firebase production deployment.

### Supported Item Fields
All deployment modes support: `name`, `asin`, `quantity`, `minThreshold`, `category`, `price`

## Version Management

The application uses git branching for production vs beta development:

### Branches
- **production**: Stable, tested version for daily use
- **beta**: Development branch for testing new features

### Branch Management Scripts
- `python3 switch-to-production.py` - Switch to stable production version
- `python3 switch-to-beta.py` - Switch to beta testing version  
- `python3 version-info.py` - Show current version and server status

### Workflow
1. **Daily Use**: Stay on production branch for reliable operation
2. **Feature Testing**: Switch to beta branch to test new features
3. **Issue Found**: Immediately switch back to production, report issues
4. **Feature Ready**: New features are merged from beta to production

## File Structure

### Production Files (GitHub Pages + Firebase)
- `index-github-pages.html` - **Production application** with Firebase integration
- `index.html` - Generated during deployment (copy of index-github-pages.html)
- `firebase-app-material.html` - Alternative Firebase implementation with Material Design
- `index-firebase-github.html` - GitHub Pages + Firebase hybrid version
- `.github/workflows/deploy.yml` - **GitHub Actions deployment workflow**
- `data/` - Static JSON files for fallback initialization
  - `items.json` - Default inventory items
  - `users.json` - Default user data
  - `checkoutHistory.json` - Initial checkout history

### Fallback/Development Files
- `github-pages-adapter.js` - **Client-side data adapter** for localStorage mode
- `index-firebase.html` - Firebase-only implementation
- `cart-icon.png` - Application icon asset

### Local Development Files (Legacy)
- `start-app.py` - Local development launcher script
- `simple-api-server.py` - SQLite API server (localhost:3001)
- `convert-to-sqlite.py` - JSON to SQLite migration script
- `inventory.db` - SQLite database file
- `db.json` - Legacy JSON data file
- `switch-to-production.py` - Branch management script
- `switch-to-beta.py` - Branch management script
- `version-info.py` - Local version information script

### Development Files
- `mobile-preview.html` - Mobile interface testing
- `debug.html` - Debug interface
- `test-*.html` - Various testing interfaces

## Development Notes

### Architecture
- **React**: All React code is inline using Babel transformation (no build process)
- **CDN Libraries**: React, Tailwind CSS, PDF.js, jsPDF, PapaParse, PDF-lib, Firebase SDK
- **Material Design**: Custom Material Design components with elevation shadows and ripple effects
- **Responsive Design**: Tailwind CSS classes for mobile-first responsive layout
- **Error Boundaries**: Comprehensive error handling with graceful degradation

### Data Architecture
- **Adapter Pattern**: Data access abstracted through adapters (Firebase, localStorage, SQLite)
- **Real-time Sync**: Firebase provides real-time data synchronization across clients
- **Offline Support**: GitHub Pages adapter enables offline functionality with localStorage
- **Authentication**: Firebase Auth with Google sign-in for multi-user access

### Advanced Features
- **PDF Processing**: PDF.js for reading, PDF-lib for generation and manipulation
- **Cost Allocation**: Advanced PDF receipt processing with cost distribution
- **Barcode Scanning**: Integrated barcode scanner for inventory management
- **Material UI**: Custom Material Design components with animations and interactions
- **Multi-user Support**: Real-time collaboration with Firebase backend

### Deployment
- **GitHub Actions**: Automated deployment pipeline
- **Static Hosting**: GitHub Pages for frontend hosting
- **Cloud Backend**: Firebase for scalable, real-time backend services
- **Fallback Systems**: Multiple deployment modes for different requirements

## Troubleshooting

### Price Update Issues
If price updates from Process Shipment aren't reflecting in Inventory Management:

1. **Database Schema**: Ensure items table has price column
   ```bash
   python3 -c "import sqlite3; conn = sqlite3.connect('inventory.db'); cursor = conn.cursor(); cursor.execute('PRAGMA table_info(items)'); print([row for row in cursor.fetchall()]); conn.close()"
   ```
   Should show price column: `(6, 'price', 'REAL', 0, '0.0', 0)`

2. **API Server**: Verify price field is supported in PATCH requests
   - Check `simple-api-server.py` line 245 includes 'price' in allowed fields
   - Restart API server after making changes

3. **Test Price Updates**: Verify API accepts price updates
   ```bash
   curl -X PATCH http://localhost:3001/items/{id} -H "Content-Type: application/json" -d '{"price": 99.99}'
   ```

### White Screen Issues
If the app shows a white screen, check:

1. **JSX Syntax Errors**: Check browser console for Babel compilation errors
   - Look for multi-line template literals in `className` attributes
   - Ensure all JSX fragments `<>` and `</>` are properly used
   - Check for duplicate function declarations

2. **Data Loading Issues**: Verify `useEffect` hooks are uncommented
   - Data fetching should occur on component mount
   - Check API server is running on port 3001
   - Verify SQLite database exists and has data

3. **Component Rendering**: Ensure `ReactDOM.render` calls the correct component
   - Should render `<App />` not `<AppDebug />`

### Common Fixes
```bash
# Kill all servers and restart fresh
lsof -ti:8080 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
python3 start-app.py

# If database API fails to start automatically
nohup python3 simple-api-server.py > api_server.log 2>&1 &

# Update database from JSON if needed
python3 convert-to-sqlite.py
```

### PDF Processing Issues
If PDF appending fails:
1. Check browser console for detailed error messages
2. Verify PDF-lib CDN is loading properly
3. Test with different PDF file sizes/formats
4. System automatically falls back to standalone report generation

### Firebase Connection Issues (Production)
**For GitHub Pages + Firebase deployment:**

1. **Authentication Problems**:
   - Check Firebase console for enabled authentication providers
   - Verify Google sign-in is configured correctly
   - Check browser console for Firebase auth errors

2. **Firestore Connection Issues**:
   - Verify Firestore rules allow read/write access
   - Check network connectivity to Firebase services
   - Monitor Firebase console for quota limits

3. **GitHub Pages Deployment**:
   - Check GitHub Actions workflow status
   - Verify `index-github-pages.html` is being copied correctly
   - Ensure static data files are valid JSON

### Local Development Issues (Legacy)
**For localhost development only:**

```bash
# Verify local API server is running (localhost:3001)
curl -s http://localhost:3001/items >/dev/null && echo "API OK" || echo "API Down"

# Check SQLite database exists
ls -la inventory.db

# Kill conflicting processes
lsof -ti:8080 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
```

**⚠️ Important**: Port issues (8080, 3001) only apply to local development mode and are not relevant for the current GitHub Pages + Firebase production deployment.

### Data Adapter Issues
**For GitHub Pages + localStorage fallback:**

- Check browser console for adapter initialization messages
- Verify static JSON files in `/data/` directory are valid
- Clear localStorage if data becomes corrupted:
  ```javascript
  localStorage.clear();
  window.location.reload();
  ```

## Production Considerations

### Security
**Firebase Security Rules:**
- Authentication required for all Firestore operations
- User-specific data access controls
- Input validation and sanitization
- HTTPS enforced for all communications

**GitHub Pages Security:**
- Content Security Policy (CSP) headers configured
- HTTPS-only deployment
- Static file serving with security headers
- No server-side code execution

### Performance Optimization
**Firebase:**
- Real-time listeners for efficient data sync
- Firestore indexes for query optimization
- Connection pooling and caching
- Offline persistence enabled

**GitHub Pages:**
- CDN-delivered assets for global performance
- Static file caching and compression
- Optimized bundle sizes via CDN libraries
- Lazy loading for large datasets

### Multi-User Collaboration
**Real-time Features:**
- Live inventory updates across all users
- Conflict resolution for concurrent edits
- User presence indicators
- Activity audit trails

**User Management:**
- Google authentication integration
- Role-based access control via Firebase rules
- User profile management
- Session management and security

### Data Backup and Export
**Firebase Backup:**
- Automatic cloud backups via Firebase
- Manual export via admin console
- Data import/export utilities built into app

**Local Backup:**
- Client-side export functionality
- CSV download for spreadsheet integration
- JSON export for data migration
- Automated backup scheduling recommendations

### Monitoring and Analytics
**Firebase Monitoring:**
- Performance monitoring via Firebase console
- Error tracking and crash reporting
- Usage analytics and user engagement
- Real-time database performance metrics

**GitHub Actions Monitoring:**
- Deployment status tracking
- Build success/failure notifications
- Artifact size monitoring
- Deploy time optimization

### Scalability Considerations
**Firebase Scaling:**
- Automatic scaling with usage
- Pay-per-use pricing model
- Global CDN for low latency
- Multi-region backup and failover

**GitHub Pages Scaling:**
- Global CDN distribution
- Automatic HTTPS and custom domains
- High availability infrastructure
- Static asset optimization