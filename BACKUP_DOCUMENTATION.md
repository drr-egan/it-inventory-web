# IT Inventory App - Complete Backup Documentation
**Date:** 2025-09-10  
**Version:** Production with Unified Checkout & Editable History  
**Branch:** main  

## 🎯 Application Overview

A comprehensive IT Inventory Management system built as a single-page React application with Python SQLite backend. Features unified shopping/checkout interface, advanced PDF processing, and full CRUD operations on all data types.

## 🏗️ Architecture

### Frontend Architecture
- **Framework:** React 18 via CDN with Babel for JSX compilation
- **Styling:** Tailwind CSS via CDN
- **File:** Single HTML file (`index.html`) - 3,741 lines
- **State Management:** React hooks (useState, useEffect)
- **UI Pattern:** Tabbed interface with unified Shop/Cart experience

### Backend Architecture
- **API Server:** Python HTTP server (`simple_api_server.py`) 
- **Database:** SQLite (`inventory.db`)
- **File Server:** Python HTTP server for static files
- **Port Configuration:**
  - Web Server: 8080 (configurable via PORT env var)
  - API Server: 3001 (configurable via PORT env var)

## 📁 File Structure

```
/home/eganuser/it-inventory-app/
├── index.html              # Main application (3,741 lines)
├── simple_api_server.py    # SQLite API server (426 lines)
├── start-app.py            # Application launcher
├── inventory.db            # SQLite database (253,952 bytes)
├── CLAUDE.md              # Development documentation
├── cart-icon.png          # App icon (33,015 bytes)
├── web-server.py          # Web deployment server
├── convert-to-sqlite.py   # JSON to SQLite migration
└── db.json               # Legacy JSON data (220,169 bytes)
```

## 🗃️ Database Schema

### Items Table
```sql
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    asin TEXT DEFAULT '',
    quantity INTEGER DEFAULT 0,
    minThreshold INTEGER DEFAULT 5,
    category TEXT DEFAULT 'Uncategorized',
    price REAL DEFAULT 0.0
)
```

### Users Table  
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT,
    cost_code TEXT NOT NULL,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL
)
```

### CheckoutHistory Table
```sql
CREATE TABLE checkoutHistory (
    id TEXT PRIMARY KEY,
    item TEXT DEFAULT '',
    user TEXT DEFAULT '',
    costCode TEXT DEFAULT '',
    dateEntered TEXT DEFAULT '',
    jobNumber TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    isUsed INTEGER DEFAULT 0,
    isComplete INTEGER DEFAULT 0,
    itemName TEXT DEFAULT '',
    userName TEXT DEFAULT '',
    departmentId TEXT DEFAULT '',
    quantity INTEGER DEFAULT 1,
    checkedOutBy TEXT DEFAULT 'System'
)
```

## 🔧 React Components & State Management

### Main App Component (`App`)
**Location:** index.html:48-3739

### Core State Variables
```javascript
// Navigation & UI
const [activeTab, setActiveTab] = useState('shop');

// Data States  
const [items, setItems] = useState([]);
const [users, setUsers] = useState([]);
const [checkoutHistory, setCheckoutHistory] = useState([]);
const [cart, setCart] = useState([]);
const [notifications, setNotifications] = useState([]);

// Search & Filter
const [categoryFilter, setCategoryFilter] = useState('All');
const [searchQuery, setSearchQuery] = useState('');
const [barcodeInput, setBarcodeInput] = useState('');

// Modal States
const [showCheckoutModal, setShowCheckoutModal] = useState(false);
const [showEditModal, setShowEditModal] = useState(false);
const [showQuantityModal, setShowQuantityModal] = useState(false);

// Checkout Modes
const [checkoutMode, setCheckoutMode] = useState('user'); // 'user' or 'job'
const [jobNumber, setJobNumber] = useState('');

// Edit States
const [editingRecord, setEditingRecord] = useState(null);
const [editingItem, setEditingItem] = useState(null);

// File Upload States
const [selectedUserFile, setSelectedUserFile] = useState(null);
const [selectedItemFile, setSelectedItemFile] = useState(null);
const [selectedHistoryFile, setSelectedHistoryFile] = useState(null);
const [selectedPdfFile, setSelectedPdfFile] = useState(null);

// Shipment Processing
const [selectedShipmentItems, setSelectedShipmentItems] = useState([]);
const [itemQuantities, setItemQuantities] = useState({});
const [itemPrices, setItemPrices] = useState({});
const [shipmentTax, setShipmentTax] = useState(0);
const [shipmentFees, setShipmentFees] = useState(0);

// Sort Configurations
const [itemSortConfig, setItemSortConfig] = useState({ key: 'name', direction: 'ascending' });
const [userSortConfig, setUserSortConfig] = useState({ key: 'lastName', direction: 'ascending' });
const [historySortConfig, setHistorySortConfig] = useState({ key: 'dateEntered', direction: 'descending' });
```

### Key Functions

#### Data Fetching Functions
- `fetchItems()` - Load inventory items from API
- `fetchUsers()` - Load user data from API  
- `fetchCheckoutHistory()` - Load checkout history from API

#### Shopping & Checkout Functions
- `addToCart(item)` - Add item to shopping cart
- `removeFromCart(itemId)` - Remove item from cart
- `updateCartQuantity(itemId, quantity)` - Update cart item quantity
- `initiateCheckout()` - Start checkout process
- `handleJobCheckout()` - Process job-based checkout
- `handleUserCheckout()` - Process user-based checkout

#### CRUD Operations
- `handleSaveEdit()` - Save edited checkout record
- `handleDeleteRecord(recordId)` - Delete checkout record
- `handleAddItem()` - Add new inventory item
- `saveItemChanges()` - Save item edits
- `updateItemQuantity()` - Update item quantities

#### File Processing Functions
- `handleUserCsvProcess()` - Process user CSV uploads
- `handleItemCsvProcess()` - Process item CSV uploads  
- `handleHistoryCsvProcess()` - Process history CSV uploads
- `handleUploadShipmentPdf()` - Process PDF shipment receipts
- `generateShipmentReport()` - Generate cost allocation reports

#### Export Functions
- `exportInventory()` - Export inventory to CSV
- `exportUsers()` - Export users to CSV
- `exportBulkInventoryTemplate()` - Export inventory template

## 📱 User Interface Components

### Navigation Tabs
1. **Shop** - Unified shopping and cart interface
2. **Process Shipment** - PDF receipt processing and cost allocation
3. **Users** - User management and CSV import
4. **Inventory Management** - Item CRUD, barcode scanning, bulk operations
5. **Checkout History** - Historical records with edit/delete capabilities
6. **Notifications** - Low stock alerts and system messages

### Shop Tab (Unified Interface)
**Layout:** Side-by-side shopping items (left) and cart panel (right)
- Item browsing with category filtering
- Search functionality
- Add to cart with quantity selection
- Real-time cart updates
- Unified checkout modal with job/user selection

### Process Shipment Tab
- PDF upload and preview
- Item matching against checkout history
- Quantity and price extraction
- Tax and fee allocation
- Automated cost allocation report generation
- PDF appending with fallback to standalone reports

### Users Tab
- User table with sorting
- CSV import functionality
- Export capabilities
- User creation and editing

### Inventory Management Tab
- Dual mode: Edit Mode and Scan Mode
- Barcode scanning support
- Direct quantity editing with inline saves
- Price management
- Category management with bulk updates
- CSV import/export for bulk operations
- Search and filtering

### Checkout History Tab  
**NEW FEATURE:** Full CRUD operations
- Sortable table with all checkout records
- **Edit** buttons on each row opening edit modal
- **Remove** buttons with confirmation dialog
- Edit modal with all field editing capabilities
- Real-time updates after changes

## 🔌 API Endpoints

### Base URL: `http://localhost:3001`

#### Items Endpoints
- `GET /items` - Retrieve all inventory items
- `POST /items` - Create new item
- `PATCH /items/{id}` - Update item (supports: name, asin, quantity, minThreshold, category, price)
- `DELETE /items/{id}` - Delete item

#### Users Endpoints  
- `GET /users` - Retrieve all users
- `POST /users` - Create new user
- `PATCH /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user

#### Checkout History Endpoints
- `GET /checkoutHistory` - Retrieve all checkout records
- `POST /checkoutHistory` - Create new checkout entry
- `PATCH /checkoutHistory/{id}` - **NEW:** Update checkout record
- `DELETE /checkoutHistory/{id}` - **NEW:** Delete checkout record

### CORS Configuration
All endpoints support CORS with:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## 🛠️ Key Features

### 1. Unified Shop/Checkout Experience
- Combined shopping and cart in single interface
- Side-by-side layout: items (left) + cart (right)
- Modal-based checkout with job/user selection
- Real-time inventory updates during checkout

### 2. Advanced PDF Processing
- PDF.js for text extraction and preview
- PDF-lib for document manipulation
- Automated item matching against checkout history
- Cost allocation with tax/fee distribution
- Report appending to original PDFs

### 3. Comprehensive Data Management
- CSV import/export for all data types
- Barcode scanning integration
- Bulk operations and category management
- Real-time search and filtering
- Sortable tables with multiple sort configurations

### 4. Full CRUD Operations (NEW)
- **Checkout History Editing:** Complete edit modal with all fields
- **Record Deletion:** Confirmation-based deletion
- **Real-time Updates:** Immediate UI refresh after changes
- **Form Validation:** Required field validation in edit modal

### 5. Inventory Management Modes
- **Edit Mode:** Direct table editing with save buttons
- **Scan Mode:** Barcode scanning for rapid counting
- **Template System:** CSV templates for bulk updates

## 🔄 Data Flow Architecture

### Frontend → Backend Communication
```
React Component → fetch() → Python API Server → SQLite Database
                          ↓
React State Update ← JSON Response ← SQL Query Result
```

### File Upload Flow
```
User Upload → Papa Parse (CSV) / PDF.js (PDF) → Data Processing → API Calls → Database Update
```

### PDF Processing Flow
```
PDF Upload → PDF.js Text Extraction → Item Matching → Cost Calculation → PDF-lib Report Generation
```

## 📦 Dependencies

### Frontend (CDN-loaded)
- React 18.0.0 (Development)
- React-DOM 18.0.0 (Development) 
- Babel Standalone 7.x (JSX compilation)
- Tailwind CSS 3.x (Styling)
- Papa Parse 5.x (CSV processing)
- PDF.js 3.4.120 (PDF text extraction)
- jsPDF 2.5.1 (PDF generation)
- PDF-lib 1.17.1 (PDF manipulation)

### Backend (Python Standard Library)
- `http.server` - HTTP server functionality
- `socketserver` - Server framework
- `sqlite3` - Database operations  
- `json` - JSON processing
- `urllib.parse` - URL parsing
- `os` - Environment variables
- `pathlib` - Path operations
- `threading` - Concurrent server operations

## 🚀 Startup Process

### Application Launch (`start-app.py`)
1. Check for existing processes on ports 8080/3001
2. Start SQLite API server on port 3001
3. Start HTTP file server on port 8080  
4. Open browser to `http://localhost:8080`

### API Server Initialization (`simple_api_server.py`)
1. Determine database path (Render/production/local fallbacks)
2. Initialize SQLite database with tables
3. Populate sample data if empty
4. Start HTTP request handler on configured port

### Database Auto-Setup
- Creates tables if they don't exist
- Populates sample items (5 items) if empty
- Populates sample users (4 users) if empty
- Handles various deployment environments (Render, Docker, local)

## 💾 Backup Recommendations

### Critical Files for Backup
1. **`index.html`** - Complete application code
2. **`simple_api_server.py`** - API server with all endpoints  
3. **`inventory.db`** - Production database
4. **`start-app.py`** - Application launcher
5. **`CLAUDE.md`** - Development documentation
6. **`cart-icon.png`** - Application icon

### Database Backup
```bash
# Create database backup with timestamp
cp inventory.db "inventory-backup-$(date +%Y%m%d_%H%M%S).db"

# Export to JSON format (if needed)
python3 -c "
import sqlite3, json
conn = sqlite3.connect('inventory.db')
conn.row_factory = sqlite3.Row
data = {}
for table in ['items', 'users', 'checkoutHistory']:
    cursor = conn.execute(f'SELECT * FROM {table}')
    data[table] = [dict(row) for row in cursor.fetchall()]
with open('database-export.json', 'w') as f:
    json.dump(data, f, indent=2, default=str)
conn.close()
"
```

### Full Application Backup
```bash
# Create timestamped backup directory
mkdir -p "backups/backup-$(date +%Y%m%d_%H%M%S)"
cp index.html simple_api_server.py start-app.py inventory.db CLAUDE.md cart-icon.png "backups/backup-$(date +%Y%m%d_%H%M%S)/"
```

## 🔍 Current Branch Status
- **Branch:** main
- **Last Commits:** 
  - Added unified checkout interface
  - Added edit/delete functionality for checkout history
  - Removed standalone cart tab
- **Pending Changes:** None (clean working directory)

## ⚠️ Known Issues & Limitations
1. **Single File Architecture:** All React code in one HTML file
2. **CDN Dependencies:** Requires internet connection for external libraries
3. **No Authentication:** Open access to all functionality
4. **SQLite Concurrency:** Limited concurrent write operations
5. **PDF Processing:** Memory intensive for large PDF files
6. **Error Handling:** Basic error handling in some areas

## 🎯 Recent Changes (Last Session)
1. ✅ **Added Edit Functionality:** Complete edit modal for checkout history records
2. ✅ **Added Delete Functionality:** Confirmation-based record deletion  
3. ✅ **Enhanced API Server:** Added PATCH and DELETE endpoints for checkout history
4. ✅ **Removed Cart Tab:** Unified interface with shop tab only
5. ✅ **Updated Navigation:** Cleaner 6-tab interface

This documentation serves as a complete backup specification for restoring the application to its current state.