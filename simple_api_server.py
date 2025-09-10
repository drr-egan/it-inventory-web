#!/usr/bin/env python3
"""
Simple API Server Module for Web Deployment
Simplified version of the main API server for deployment
"""
import http.server
import json
import sqlite3
import urllib.parse
import os
from pathlib import Path

class InventoryAPIHandler(http.server.BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Ensure database exists
        self.db_path = self.get_database_path()
        self.init_database()
        super().__init__(*args, **kwargs)
    
    def get_database_path(self):
        """Get the appropriate database path for the environment"""
        # Check for mounted data directory (production)
        data_dir = Path("/app/data")
        if data_dir.exists():
            return str(data_dir / "inventory.db")
        
        # Local development
        local_db = Path("inventory.db")
        if local_db.exists():
            return str(local_db)
        
        # Beta directory fallback
        beta_db = Path("beta/inventory.db") 
        if beta_db.exists():
            return str(beta_db)
        
        # Create new database in current directory
        return "inventory.db"
    
    def init_database(self):
        """Initialize database with basic tables and sample data if they don't exist"""
        try:
            # Ensure database file exists
            if not os.path.exists(self.db_path):
                print(f"Creating new database at {self.db_path}")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create items table if not exists
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS items (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    asin TEXT DEFAULT '',
                    quantity INTEGER DEFAULT 0,
                    minThreshold INTEGER DEFAULT 5,
                    category TEXT DEFAULT 'Uncategorized',
                    price REAL DEFAULT 0.0
                )
            ''')
            
            # Create users table if not exists
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    cost_code TEXT DEFAULT '',
                    firstName TEXT NOT NULL,
                    lastName TEXT NOT NULL
                )
            ''')
            
            # Create checkout history table if not exists
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS checkoutHistory (
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
            ''')
            
            # Add sample data if tables are empty
            cursor.execute('SELECT COUNT(*) FROM items')
            item_count = cursor.fetchone()[0]
            
            if item_count == 0:
                print("Adding sample inventory data...")
                sample_items = [
                    ('item001', 'Dell Monitor 24"', 'B07CVL2D2T', 15, 5, 'Electronics', 299.99),
                    ('item002', 'USB-C Hub', 'B08HR6DSLT', 25, 10, 'Accessories', 49.99),
                    ('item003', 'Wireless Mouse', 'B07FKMDJQZ', 30, 15, 'Accessories', 29.99),
                    ('item004', 'Ethernet Cable 6ft', 'B00N2VIALK', 50, 20, 'Cables', 12.99),
                    ('item005', 'Laptop Stand', 'B075GCG36Z', 8, 3, 'Accessories', 79.99)
                ]
                
                cursor.executemany('''
                    INSERT INTO items (id, name, asin, quantity, minThreshold, category, price)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', sample_items)
            
            cursor.execute('SELECT COUNT(*) FROM users')
            user_count = cursor.fetchone()[0]
            
            if user_count == 0:
                print("Adding sample user data...")
                sample_users = [
                    ('user001', 'John Doe', 'IT-001', 'John', 'Doe'),
                    ('user002', 'Jane Smith', 'IT-002', 'Jane', 'Smith'),
                    ('user003', 'Mike Wilson', 'HR-001', 'Mike', 'Wilson'),
                    ('user004', 'Sarah Johnson', 'ACC-001', 'Sarah', 'Johnson')
                ]
                
                cursor.executemany('''
                    INSERT INTO users (id, name, cost_code, firstName, lastName)
                    VALUES (?, ?, ?, ?, ?)
                ''', sample_users)
            
            conn.commit()
            conn.close()
            print(f"✅ Database initialized successfully at {self.db_path}")
            
        except Exception as e:
            print(f"❌ Database initialization error: {e}")
            import traceback
            traceback.print_exc()
    
    def send_cors_response(self, status_code, data=None):
        """Send response with CORS headers"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        
        if data is not None:
            response = json.dumps(data, default=str)
            self.wfile.write(response.encode('utf-8'))
    
    def do_OPTIONS(self):
        """Handle preflight requests"""
        self.send_cors_response(200)
    
    def do_GET(self):
        """Handle GET requests"""
        path = self.path.split('?')[0]  # Remove query parameters
        
        if path == '/items':
            self.get_items()
        elif path == '/users':
            self.get_users()
        elif path == '/checkoutHistory':
            self.get_checkout_history()
        else:
            self.send_cors_response(404, {'error': 'Endpoint not found'})
    
    def get_items(self):
        """Get all inventory items"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM items')
            items = [dict(row) for row in cursor.fetchall()]
            
            conn.close()
            self.send_cors_response(200, items)
            
        except Exception as e:
            self.send_cors_response(500, {'error': str(e)})
    
    def get_users(self):
        """Get all users"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM users')
            users = [dict(row) for row in cursor.fetchall()]
            
            conn.close()
            self.send_cors_response(200, users)
            
        except Exception as e:
            self.send_cors_response(500, {'error': str(e)})
    
    def get_checkout_history(self):
        """Get checkout history"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM checkoutHistory ORDER BY dateEntered DESC')
            history = [dict(row) for row in cursor.fetchall()]
            
            conn.close()
            self.send_cors_response(200, history)
            
        except Exception as e:
            self.send_cors_response(500, {'error': str(e)})

if __name__ == "__main__":
    import socketserver
    
    PORT = int(os.environ.get('PORT', 3001))
    
    with socketserver.TCPServer(("", PORT), InventoryAPIHandler) as httpd:
        print(f"🗄️  Simple API Server running on port {PORT}")
        httpd.serve_forever()