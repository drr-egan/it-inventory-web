# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an IT Inventory Management web application built with React (via CDN) that runs as a single-page application (SPA). The backend is a JSON Server that provides a REST API for data persistence.

## Architecture

- **Frontend**: Single HTML file (`index.html`) with inline React code using Babel for JSX transformation
- **Backend**: SQLite API server (`simple-api-server.py`) using SQLite database for data persistence
- **Data Storage**: SQLite database (`inventory.db`) containing items, users, and checkout history
- **Data Migration**: JSON to SQLite conversion script (`convert-to-sqlite.py`)
- **Launcher**: Python script (`start-app.py`) that coordinates both servers

## Key Components

The application consists of several main functional areas:
- **Shop**: Browse and add items to cart with category filtering and price display
- **Cart**: Manage selected items and complete checkout process
- **Process Shipment**: Upload PDF receipts to match against checkout history
- **Users**: Manage user database via CSV import
- **Inventory Management**: Unified interface for comprehensive inventory control including manual creation, CSV import/export, barcode scanning, and price management
- **Checkout History**: View and import historical checkout records
- **Notifications**: Display low stock alerts and export functionality

## Common Commands

### Starting the Application
```bash
python3 start-app.py
```
This starts both the SQLite API server (port 3001) and HTTP server (port 8080), then opens the app in a browser.

### Prerequisites
The application requires Python 3 and SQLite support. No additional npm packages needed.

### Database Setup
If the SQLite database needs to be created or updated from JSON data:
```bash
python3 convert-to-sqlite.py
```

### Manual Server Management
If needed, you can start components separately:
```bash
# Start SQLite API server only
python3 simple-api-server.py

# Start simple HTTP server only (from app directory)
python3 -m http.server 8080
```

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

## API Endpoints

SQLite API server provides REST endpoints at `http://localhost:3001`:
- `GET/POST/PATCH/DELETE /items` - Inventory management (supports price field)
- `GET/POST/PATCH/DELETE /users` - User management  
- `GET/POST/DELETE /checkoutHistory` - Checkout records

### Items API Details
- **GET /items**: Retrieve all items with price information
- **GET /items/{id}**: Retrieve specific item
- **POST /items**: Create new item (supports price field)
- **PATCH /items/{id}**: Update item fields including price
- **DELETE /items/{id}**: Remove item

Item fields supported: `name`, `asin`, `quantity`, `minThreshold`, `category`, `price`

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

- `index.html` - Main application file with all React components
- `start-app.py` - Application launcher script
- `simple-api-server.py` - SQLite API server
- `convert-to-sqlite.py` - Database migration script
- `inventory.db` - SQLite database file
- `db.json` - Legacy JSON data file (for migration reference)
- `cart-icon.png` - Application icon asset
- `switch-to-production.py` - Switch to stable version script
- `switch-to-beta.py` - Switch to testing version script  
- `version-info.py` - Version and status information script

## Development Notes

- All React code is inline in `index.html` using Babel transformation
- Uses CDN-loaded libraries (React, Tailwind CSS, PDF.js, jsPDF, PapaParse, PDF-lib)
- No build process required - runs directly in browser
- Error boundaries implemented for graceful error handling
- Responsive design using Tailwind CSS classes
- Advanced PDF manipulation with PDF-lib for document merging and generation
- Intelligent text wrapping algorithms for dynamic PDF layouts

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

### Database Connection Issues
```bash
# Verify database API is running
curl -s http://localhost:3001/items >/dev/null && echo "API OK" || echo "API Down"

# Check database file exists and is accessible
ls -la inventory.db
```

### Port Issues
- Web server: http://localhost:8080
- API server: http://localhost:3001
- Both ports must be free before starting