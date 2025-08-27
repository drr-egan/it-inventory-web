# IT Inventory App - SQLite Migration

The IT Inventory Management app has been successfully converted from JSON Server to SQLite database.

## What Changed

### Database
- **Before**: Single `db.json` file with json-server
- **After**: SQLite database (`inventory.db`) with custom Python API server

### Files Added
- `convert-to-sqlite.py` - Migration script to convert JSON data to SQLite
- `simple-api-server.py` - Custom API server using Python standard library
- `api-server.py` - Alternative Flask-based API server (requires Flask)
- `inventory.db` - SQLite database file

### Files Modified
- `start-app.py` - Updated to use SQLite API server instead of json-server
- `index.html` - Fixed user cost_code field mapping issue

## Benefits of SQLite

1. **Better Performance**: SQL queries are more efficient than JSON file operations
2. **Data Integrity**: ACID compliance and foreign key constraints
3. **Scalability**: Better handling of concurrent operations
4. **Query Flexibility**: Full SQL support for complex queries
5. **Smaller Memory Footprint**: Data loaded on-demand rather than entire file in memory
6. **No External Dependencies**: No need for json-server npm package

## Migration Process

1. **Run Migration**:
   ```bash
   python3 convert-to-sqlite.py
   ```
   This converts your existing `db.json` to `inventory.db`

2. **Start Application**:
   ```bash
   python3 start-app.py
   ```
   Now uses SQLite backend automatically

## Database Schema

### Items Table
- `id` (TEXT PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `asin` (TEXT)
- `quantity` (INTEGER DEFAULT 0)
- `minThreshold` (INTEGER DEFAULT 5) 
- `category` (TEXT DEFAULT 'Uncategorized')

### Users Table
- `id` (TEXT PRIMARY KEY)
- `name` (TEXT)
- `cost_code` (TEXT NOT NULL)
- `firstName` (TEXT NOT NULL)
- `lastName` (TEXT NOT NULL)

### CheckoutHistory Table
- `id` (TEXT PRIMARY KEY)
- `item` (TEXT)
- `user` (TEXT) 
- `costCode` (TEXT)
- `dateEntered` (TEXT)
- `jobNumber` (TEXT)
- `notes` (TEXT)
- `isUsed` (BOOLEAN DEFAULT 0)
- `isComplete` (BOOLEAN DEFAULT 0)
- `itemName` (TEXT)
- `userName` (TEXT)
- `departmentId` (TEXT)
- `quantity` (INTEGER DEFAULT 1)

## API Endpoints

The custom API server provides the same REST endpoints as json-server:

- `GET /items` - List all items
- `GET /items/:id` - Get specific item
- `POST /items` - Create new item
- `PATCH /items/:id` - Update item
- `DELETE /items/:id` - Delete item

- `GET /users` - List all users
- `POST /users` - Create new user
- `DELETE /users/:id` - Delete user

- `GET /checkoutHistory` - List checkout history
- `POST /checkoutHistory` - Create checkout record
- `DELETE /checkoutHistory/:id` - Delete checkout record

## Performance Improvements

With SQLite, the app now has:
- Indexed searches on frequently queried fields
- Faster sorting and filtering operations
- Better concurrent access handling
- Reduced memory usage
- Faster startup times

## Backup and Recovery

SQLite database can be easily backed up:
```bash
# Backup
cp inventory.db inventory_backup.db

# Or use SQLite dump
sqlite3 inventory.db .dump > inventory_backup.sql
```

The original `db.json` file is preserved and can still be used with json-server if needed.

## Troubleshooting

If you need to go back to json-server:
1. Rename `start-app.py` to `start-app-sqlite.py`
2. Restore the original json-server version of start-app.py
3. Run `python3 start-app.py` as before

The migration preserves all your existing data and functionality while providing better performance and reliability.