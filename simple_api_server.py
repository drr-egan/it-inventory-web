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
        """Initialize database with basic tables if they don't exist"""
        try:
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
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    firstName TEXT NOT NULL,
                    lastName TEXT NOT NULL,
                    cost_code TEXT NOT NULL
                )
            ''')
            
            # Create checkout history table if not exists
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS checkoutHistory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    itemName TEXT NOT NULL,
                    userName TEXT NOT NULL,
                    departmentId TEXT,
                    jobNumber TEXT,
                    notes TEXT,
                    dateEntered DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"Database initialization error: {e}")
    
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