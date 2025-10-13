# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an IT Inventory Management web application built with React (via CDN) that runs as a single-page application (SPA) deployed on GitHub Pages with Firebase backend.

## Architecture & Deployment

The application uses a cloud-based architecture for production deployment:

### **GitHub Pages + Firebase (Production)**
*Production deployment for cloud-based multi-user access*

- **Frontend**: GitHub Pages hosting with `index-github-pages.html`
- **Backend**: Firebase Firestore with real-time synchronization
- **Authentication**: Firebase Auth with Google sign-in
- **Data Storage**: Firebase Firestore collections (items, users, checkoutHistory, archivedCheckouts)
- **Deployment**: Automated via GitHub Actions workflow
- **Features**: Multi-user collaboration, real-time updates, authentication, Material Design UI

### **Fallback Mode (Optional)**
*Client-side data storage for offline scenarios*

- **Data Storage**: Browser localStorage with static JSON file initialization via `github-pages-adapter.js`
- **Features**: Offline functionality, client-side data persistence
- **Note**: Used automatically when Firebase is unavailable

## Key Components

The application consists of several main functional areas:
- **Shop**: Browse and add items to cart with category filtering and price display
- **Cart**: Manage selected items and complete checkout process
- **Process Shipment**: Upload PDF receipts to match against checkout history
- **Users**: Manage user database via CSV import
- **Inventory Management**: Unified interface for comprehensive inventory control including manual creation, CSV import/export, barcode scanning, and price management
- **Checkout History**: View and import historical checkout records with Current/Archive toggle for processed shipments
- **Notifications**: Display low stock alerts and export functionality

## Deployment

### Automated GitHub Actions Deployment
**Production deployment is fully automated**

No manual commands needed. Push to main branch triggers automatic deployment:
1. GitHub Actions copies `index-github-pages.html` to `index.html`
2. Validates and prepares static JSON data files
3. Deploys to GitHub Pages
4. Application connects to Firebase for real-time data

**Access**: Via your GitHub Pages URL

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
- `checkoutHistory`: Active checkout records with user assignments and timestamps
- `archivedCheckouts`: Processed checkout records moved from active history during shipment processing with archivedAt timestamps

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
- **Price Storage**: Items can have price data stored in Firestore as decimal values
- **Firebase Integration**: Items collection includes `price` field for each item
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

## Checkout History Archive System

The application features a comprehensive archive system for managing checkout history data through the shipment processing workflow:

### Archive Functionality
- **Current/Archive Toggle**: Toggle button interface to switch between active checkout history and archived records
- **Automatic Archiving**: Items processed through shipment allocation are automatically moved from `checkoutHistory` to `archivedCheckouts` collection
- **Audit Trail**: Archived records maintain original checkout data plus `archivedAt` timestamp for complete accountability
- **Real-time Sync**: Both current and archived data use Firebase real-time listeners for immediate updates across all connected clients

### User Interface Features
- **Toggle Button UI**: Clean Material Design toggle with count badges showing record counts for both current and archived data
- **Dynamic Table**: Table headers and columns adapt based on current view mode
  - **Current View**: Standard checkout history table with Item, User, Quantity, Department, and Date columns
  - **Archive View**: Extended table including additional "Archived Date" column showing when records were processed
- **Visual Indicators**: Active view highlighted with blue styling and appropriate icons (`pending_actions` for current, `inventory` for archive)
- **Dynamic Descriptions**: Context-appropriate help text based on selected view mode

### Data Management
- **Pagination**: Separate pagination handling for current and archived data sources with automatic reset on toggle
- **Data Integrity**: Prevents double-allocation by moving processed records to archive collection
- **Search and Filter**: Full search functionality available for both current and archived records
- **Export Capability**: Archive data can be accessed and exported for reporting purposes

### Technical Implementation
- **State Management**: Uses `checkoutViewMode` state to track current view ('current' or 'archive')
- **Firebase Integration**: Real-time listeners for both `checkoutHistory` and `archivedCheckouts` collections
- **Responsive Design**: Toggle interface adapts to both desktop and mobile layouts
- **Performance Optimization**: Limit 500 records for archived data with descending sort by archived date

### ✅ Implementation Status: **FULLY OPERATIONAL**
*Last Updated: 2025-09-19*

**Production Verification:**
- **Current Checkout Records**: 102 active records displaying correctly
- **Archive Records**: 1 processed record with proper archive timestamp
- **Toggle Functionality**: Seamless switching between views with accurate count badges
- **Data Integrity**: Automatic archiving during shipment processing confirmed operational
- **User Interface**: Material Design toggle with proper visual indicators and responsive behavior
- **Firebase Sync**: Real-time synchronization working across both collections
- **Pagination**: Proper handling of data source switching with page reset functionality

**Key Features Confirmed:**
✅ Current/Archive toggle with live count badges (102/1)
✅ Dynamic table headers with conditional "Archived Date" column
✅ Automatic pagination reset when switching views
✅ Context-sensitive descriptions for each view mode
✅ Real-time Firebase synchronization for both data sources
✅ Proper audit trail preservation with archive timestamps
✅ Material Design UI with accessibility considerations

### Usage Guide

**Accessing the Archive System:**
1. Navigate to the **History** tab (should show total count, e.g., "103")
2. Use the **Current Checkout** / **Archive** toggle buttons at the top
3. **Current Checkout** shows active records awaiting processing
4. **Archive** shows records that have been processed through shipments

**Understanding the Data:**
- **Current Checkout**: Items checked out but not yet allocated to shipments
- **Archive**: Items that have been processed and allocated with archive timestamps
- **Count Badges**: Live display of records in each category (e.g., 102 current, 1 archive)

**Workflow Integration:**
- Process shipments via **Process Shipment** tab to move items to archive
- Archived items include cost allocation details and cannot be double-allocated
- Use archive for reporting, auditing, and historical analysis

## Key State Management

The React app uses hooks for state management:
- `items`: Inventory items array
- `users`: User database array
- `checkoutHistory`: Active checkout records
- `archivedCheckouts`: Archived checkout records from processed shipments
- `checkoutViewMode`: Toggle state for Current/Archive view ('current' or 'archive')
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

After processing, allocated items are automatically removed from checkout history and archived in the `archivedCheckouts` collection with timestamps for audit trail and accountability.

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
**Primary backend - cloud-based Firestore**

Firestore collections:
- **items**: Inventory management with real-time synchronization
- **users**: User management with authentication
- **checkoutHistory**: Active checkout records with audit trail
- **archivedCheckouts**: Processed checkout records from shipment allocation with archive timestamps

**Authentication**: Firebase Auth with Google sign-in required
**Real-time Updates**: Automatic synchronization across all connected clients

**Supported Item Fields**: `name`, `asin`, `quantity`, `minThreshold`, `category`, `price`

### Fallback Mode (Offline)
**Client-side storage for offline scenarios**

Fallback storage via `github-pages-adapter.js`:
- Uses browser localStorage with JSON file initialization
- Provides basic CRUD operations when Firebase is unavailable
- Data persists locally in browser only
- No authentication required in fallback mode

## File Structure

### Production Files
- `index-github-pages.html` - **Main production application** with Firebase integration
- `index.html` - Generated during deployment (copy of index-github-pages.html)
- `.github/workflows/deploy.yml` - **GitHub Actions deployment workflow**
- `github-pages-adapter.js` - Client-side data adapter for localStorage fallback mode
- `cart-icon.png` - Application icon asset

### Data Files
- `data/` - Static JSON files for fallback initialization
  - `items.json` - Default inventory items
  - `users.json` - Default user data
  - `checkoutHistory.json` - Initial checkout history
  - `archivedCheckouts.json` - Sample archived checkout records

### Alternative Implementations
- `firebase-app-material.html` - Alternative Firebase implementation with Material Design
- `index-firebase-github.html` - GitHub Pages + Firebase hybrid version
- `index-firebase.html` - Firebase-only implementation

## Development Notes

### Architecture
- **React**: All React code is inline using Babel transformation (no build process)
- **CDN Libraries**: React, Tailwind CSS, PDF.js, jsPDF, PapaParse, PDF-lib, Firebase SDK
- **Material Design**: Custom Material Design components with elevation shadows and ripple effects
- **Responsive Design**: Tailwind CSS classes for mobile-first responsive layout
- **Error Boundaries**: Comprehensive error handling with graceful degradation

### Data Architecture
- **Adapter Pattern**: Data access abstracted through adapters (Firebase primary, localStorage fallback)
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

### White Screen Issues
If the app shows a white screen, check:

1. **JSX Syntax Errors**: Check browser console for Babel compilation errors
   - Look for multi-line template literals in `className` attributes
   - Ensure all JSX fragments `<>` and `</>` are properly used
   - Check for duplicate function declarations

2. **Firebase Connection**: Verify Firebase is properly initialized
   - Check browser console for Firebase connection errors
   - Verify Firebase config in `index-github-pages.html`
   - Check network connectivity to Firebase services

3. **Component Rendering**: Ensure `ReactDOM.render` calls the correct component
   - Should render `<App />` not `<AppDebug />`

### PDF Processing Issues
If PDF appending fails:
1. Check browser console for detailed error messages
2. Verify PDF-lib CDN is loading properly
3. Test with different PDF file sizes/formats
4. System automatically falls back to standalone report generation

### Firebase Connection Issues
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

### Data Adapter Issues (Fallback Mode)
**If using localStorage fallback:**

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