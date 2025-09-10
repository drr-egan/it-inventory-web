#!/usr/bin/env python3
"""
Isolated Dual-port IT Inventory App Launcher
Runs production (8080) and beta (8081) with SEPARATE databases
"""
import http.server
import socketserver
import webbrowser
import threading
import time
import os
import subprocess
import sys
import signal
import shutil
import sqlite3
from pathlib import Path

# --- Configuration ---
PROD_PORT = 8080
BETA_PORT = 8081
PROD_API_PORT = 3001
BETA_API_PORT = 3002
PROD_DB = "inventory-production.db"
BETA_DB = "inventory-beta.db"

# --- Global variables ---
processes = []

def setup_databases():
    """Set up separate production and beta databases"""
    print("🗄️  Setting up isolated databases...")
    
    # Ensure main database exists
    if not os.path.exists("inventory.db"):
        print("❌ Main inventory.db not found. Please run 'python3 convert-to-sqlite.py' first.")
        sys.exit(1)
    
    # Copy main database to production database if it doesn't exist
    if not os.path.exists(PROD_DB):
        shutil.copy2("inventory.db", PROD_DB)
        print(f"📄 Created production database: {PROD_DB}")
    
    # Copy main database to beta database if it doesn't exist or is older
    if not os.path.exists(BETA_DB):
        shutil.copy2("inventory.db", BETA_DB)
        print(f"📄 Created beta database: {BETA_DB}")
    else:
        # Optionally sync beta with production (uncomment if desired)
        # print(f"🔄 Syncing beta database with production...")
        # shutil.copy2(PROD_DB, BETA_DB)
        print(f"📄 Using existing beta database: {BETA_DB}")
    
    return True

def create_custom_api_server(port, database, name):
    """Create a custom API server script for a specific database"""
    script_name = f"api-server-{name.lower()}.py"
    
    script_content = f'''#!/usr/bin/env python3
"""
Custom API server for {name} - Port {port}
Database: {database}
"""
import sqlite3
import json
import http.server
import socketserver
import urllib.parse
from urllib.parse import urlparse, parse_qs
import uuid
from datetime import datetime
import os
import threading

DATABASE = '{database}'

def dict_from_row(cursor, row):
    """Convert sqlite3 row to dictionary"""
    return {{cursor.description[idx][0]: value for idx, value in enumerate(row)}}

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE, check_same_thread=False)
    conn.row_factory = dict_from_row
    return conn

class APIHandler(http.server.BaseHTTPRequestHandler):
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        
        if not path_parts:
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({{'status': 'healthy', 'database': DATABASE, 'server': '{name}', 'port': {port}}}).encode())
            return
        
        resource = path_parts[0]
        resource_id = path_parts[1] if len(path_parts) > 1 else None
        
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            if resource == 'items':
                if resource_id:
                    cursor.execute('SELECT * FROM items WHERE id = ?', (resource_id,))
                    result = cursor.fetchone()
                    if not result:
                        self.send_error(404, 'Item not found')
                        return
                else:
                    cursor.execute('SELECT * FROM items ORDER BY name')
                    result = cursor.fetchall()
            
            elif resource == 'users':
                if resource_id:
                    cursor.execute('SELECT * FROM users WHERE id = ?', (resource_id,))
                    result = cursor.fetchone()
                    if not result:
                        self.send_error(404, 'User not found')
                        return
                else:
                    cursor.execute('SELECT * FROM users ORDER BY firstName, lastName')
                    result = cursor.fetchall()
            
            elif resource == 'checkoutHistory':
                if resource_id:
                    cursor.execute('SELECT * FROM checkoutHistory WHERE id = ?', (resource_id,))
                    result = cursor.fetchone()
                    if not result:
                        self.send_error(404, 'Record not found')
                        return
                else:
                    cursor.execute('SELECT * FROM checkoutHistory ORDER BY id DESC')
                    result = cursor.fetchall()
            
            else:
                self.send_error(404, 'Resource not found')
                return
            
            conn.close()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            print(f"Error in GET: {{e}}")
            self.send_error(500, f'Server error: {{str(e)}}')
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_url = urlparse(self.path)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        
        if len(path_parts) != 1:
            self.send_error(400, 'Invalid path')
            return
        
        resource = path_parts[0]
        
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
            except json.JSONDecodeError:
                self.send_error(400, 'Invalid JSON')
                return
        else:
            data = {{}}
        
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            if resource == 'items':
                item_id = str(uuid.uuid4())[:8]
                name = data.get('name', 'Unnamed Item')
                asin = data.get('asin', '')
                quantity = data.get('quantity', 0)
                minThreshold = data.get('minThreshold', 0)
                category = data.get('category', 'Uncategorized')
                price = data.get('price', 0.0)
                
                cursor.execute('''
                    INSERT INTO items (id, name, asin, quantity, minThreshold, category, price)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (item_id, name, asin, quantity, minThreshold, category, price))
                
                conn.commit()
                
                # Return the created item
                cursor.execute('SELECT * FROM items WHERE id = ?', (item_id,))
                result = cursor.fetchone()
                
            elif resource == 'users':
                user_id = str(uuid.uuid4())[:8]
                firstName = data.get('firstName', '')
                lastName = data.get('lastName', '')
                costCode = data.get('costCode', '')
                
                cursor.execute('''
                    INSERT INTO users (id, firstName, lastName, costCode)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, firstName, lastName, costCode))
                
                conn.commit()
                
                cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
                result = cursor.fetchone()
                
            elif resource == 'checkoutHistory':
                history_id = str(uuid.uuid4())[:8]
                itemName = data.get('itemName', '')
                userName = data.get('userName', '')
                departmentId = data.get('departmentId', '')
                jobNum = data.get('jobNum', '')
                timestamp = datetime.now().isoformat()
                
                cursor.execute('''
                    INSERT INTO checkoutHistory (id, itemName, userName, departmentId, jobNum, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (history_id, itemName, userName, departmentId, jobNum, timestamp))
                
                conn.commit()
                
                cursor.execute('SELECT * FROM checkoutHistory WHERE id = ?', (history_id,))
                result = cursor.fetchone()
                
            else:
                self.send_error(404, 'Resource not found')
                return
            
            conn.close()
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            print(f"Error in POST: {{e}}")
            self.send_error(500, f'Server error: {{str(e)}}')
    
    def do_PATCH(self):
        """Handle PATCH requests"""
        parsed_url = urlparse(self.path)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        
        if len(path_parts) != 2:
            self.send_error(400, 'Invalid path')
            return
        
        resource = path_parts[0]
        resource_id = path_parts[1]
        
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
            except json.JSONDecodeError:
                self.send_error(400, 'Invalid JSON')
                return
        else:
            self.send_error(400, 'No data provided')
            return
        
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            if resource == 'items':
                # Build update query dynamically
                updates = []
                values = []
                
                for field in ['name', 'asin', 'quantity', 'minThreshold', 'category', 'price']:
                    if field in data:
                        updates.append(f'{{field}} = ?')
                        values.append(data[field])
                
                if not updates:
                    self.send_error(400, 'No valid fields to update')
                    return
                
                values.append(resource_id)
                query = f"UPDATE items SET {{', '.join(updates)}} WHERE id = ?"
                
                cursor.execute(query, values)
                conn.commit()
                
                if cursor.rowcount == 0:
                    self.send_error(404, 'Item not found')
                    return
                
                cursor.execute('SELECT * FROM items WHERE id = ?', (resource_id,))
                result = cursor.fetchone()
            
            else:
                self.send_error(404, 'Resource not found')
                return
            
            conn.close()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            print(f"Error in PATCH: {{e}}")
            self.send_error(500, f'Server error: {{str(e)}}')
    
    def do_DELETE(self):
        """Handle DELETE requests"""
        parsed_url = urlparse(self.path)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        
        if len(path_parts) != 2:
            self.send_error(400, 'Invalid path')
            return
        
        resource = path_parts[0]
        resource_id = path_parts[1]
        
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            if resource == 'items':
                cursor.execute('DELETE FROM items WHERE id = ?', (resource_id,))
            elif resource == 'users':
                cursor.execute('DELETE FROM users WHERE id = ?', (resource_id,))
            elif resource == 'checkoutHistory':
                cursor.execute('DELETE FROM checkoutHistory WHERE id = ?', (resource_id,))
            else:
                self.send_error(404, 'Resource not found')
                return
            
            conn.commit()
            
            if cursor.rowcount == 0:
                self.send_error(404, 'Record not found')
                return
            
            conn.close()
            
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
        except Exception as e:
            print(f"Error in DELETE: {{e}}")
            self.send_error(500, f'Server error: {{str(e)}}')
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        print(f"Database {{DATABASE}} not found!")
        exit(1)
    
    print(f"Starting {name} API server with database: {{DATABASE}}")
    print(f"API available at: http://localhost:{port}")
    
    with socketserver.TCPServer(("", {port}), APIHandler) as httpd:
        httpd.serve_forever()
'''
    
    with open(script_name, 'w') as f:
        f.write(script_content)
    
    os.chmod(script_name, 0o755)
    return script_name

def create_custom_html(directory, api_port, version_name):
    """Create a custom HTML file pointing to the specific API port"""
    html_file = os.path.join(directory, "index.html")
    
    # Read the original HTML
    with open("index.html", 'r') as f:
        content = f.read()
    
    # Replace API_BASE URL
    content = content.replace(
        "const API_BASE = 'http://localhost:3001';",
        f"const API_BASE = 'http://localhost:{api_port}';"
    )
    
    # Add version indicator
    content = content.replace(
        "<title>IT Inventory Management</title>",
        f"<title>IT Inventory Management - {version_name}</title>"
    )
    
    # Add visual indicator in the header
    version_badge = f'''
                <div style="position: absolute; top: 10px; right: 10px; background: {'#059669' if version_name == 'Production' else '#7c3aed'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                    {version_name} ({api_port})
                </div>
    '''
    
    content = content.replace(
        '<div className="min-h-screen bg-gray-50">',
        f'<div className="min-h-screen bg-gray-50">{version_badge}'
    )
    
    with open(html_file, 'w') as f:
        f.write(content)
    
    print(f"📄 Created custom HTML for {version_name}: {html_file}")

def start_api_server(script_name, name):
    """Start a custom API server"""
    print(f"🗄️  Starting {name} API server...")
    try:
        process = subprocess.Popen(
            [sys.executable, script_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        processes.append(process)
        print(f"✅ {name} API server running (PID: {process.pid})")
        return process
    except Exception as e:
        print(f"❌ Failed to start {name} API server: {e}")
        sys.exit(1)

def start_web_server(port, directory, name):
    """Start a web server for a specific directory"""
    print(f"🚀 Starting {name} web server on port {port}...")
    
    try:
        original_dir = os.getcwd()
        os.chdir(directory)
        
        handler = http.server.SimpleHTTPRequestHandler
        with socketserver.TCPServer(("", port), handler) as httpd:
            print(f"✅ {name} running on http://localhost:{port}")
            httpd.serve_forever()
            
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {port} is already in use.")
        else:
            print(f"❌ Error starting {name}: {e}")
    finally:
        os.chdir(original_dir)

def setup_directories():
    """Set up production and beta directories with custom configurations"""
    base_dir = os.getcwd()
    prod_dir = os.path.join(base_dir, "production")
    beta_dir = os.path.join(base_dir, "beta")
    
    os.makedirs(prod_dir, exist_ok=True)
    os.makedirs(beta_dir, exist_ok=True)
    
    # Files to copy
    files_to_copy = ["cart-icon.png"]
    
    print("📁 Setting up isolated directories...")
    
    # Copy common files to both directories
    for file in files_to_copy:
        if os.path.exists(file):
            shutil.copy2(file, os.path.join(prod_dir, file))
            shutil.copy2(file, os.path.join(beta_dir, file))
    
    # Create custom HTML files for each environment
    create_custom_html(prod_dir, PROD_API_PORT, "Production")
    create_custom_html(beta_dir, BETA_API_PORT, "Beta")
    
    return prod_dir, beta_dir

def open_browsers():
    """Opens both apps in browser tabs"""
    time.sleep(5)
    print("🌐 Opening browsers...")
    webbrowser.open(f'http://localhost:{PROD_PORT}')
    time.sleep(1)
    webbrowser.open(f'http://localhost:{BETA_PORT}')

def cleanup():
    """Clean up all processes"""
    print("\\n🛑 Shutting down all servers...")
    for process in processes:
        if process and process.poll() is None:
            try:
                process.terminate()
                process.wait(timeout=5)
                print(f"✅ Process {process.pid} stopped.")
            except:
                try:
                    process.kill()
                except:
                    pass
    print("👋 All servers stopped.")

def signal_handler(signum, frame):
    """Handle Ctrl+C gracefully"""
    cleanup()
    sys.exit(0)

def sync_databases():
    """Sync beta database with production data"""
    choice = input("\\n🔄 Sync beta database with production data? (y/N): ").strip().lower()
    if choice == 'y':
        if os.path.exists(PROD_DB):
            shutil.copy2(PROD_DB, BETA_DB)
            print(f"✅ Beta database synced with production data")
        else:
            print(f"❌ Production database not found: {PROD_DB}")
    else:
        print("📄 Using existing beta database")

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("🚀 IT Inventory - Isolated Dual Setup")
    print("=" * 55)
    print(f"📦 Production: http://localhost:{PROD_PORT} (DB: {PROD_DB})")
    print(f"🧪 Beta:       http://localhost:{BETA_PORT} (DB: {BETA_DB})")
    print(f"🗄️  Prod API:   http://localhost:{PROD_API_PORT}")
    print(f"🗄️  Beta API:   http://localhost:{BETA_API_PORT}")
    print("=" * 55)
    
    try:
        # Set up databases
        setup_databases()
        
        # Ask if user wants to sync databases
        sync_databases()
        
        # Set up directories
        prod_dir, beta_dir = setup_directories()
        
        # Create custom API server scripts
        prod_api_script = create_custom_api_server(PROD_API_PORT, PROD_DB, "Production")
        beta_api_script = create_custom_api_server(BETA_API_PORT, BETA_DB, "Beta")
        
        # Start API servers
        start_api_server(prod_api_script, "Production")
        time.sleep(1)
        start_api_server(beta_api_script, "Beta")
        time.sleep(2)
        
        # Start web servers
        prod_thread = threading.Thread(
            target=start_web_server,
            args=(PROD_PORT, prod_dir, "Production Server"),
            daemon=True
        )
        prod_thread.start()
        time.sleep(1)
        
        beta_thread = threading.Thread(
            target=start_web_server,
            args=(BETA_PORT, beta_dir, "Beta Server"),
            daemon=True
        )
        beta_thread.start()
        time.sleep(1)
        
        # Open browsers
        browser_thread = threading.Thread(target=open_browsers, daemon=True)
        browser_thread.start()
        
        print(f"\\n🌐 Isolated servers running!")
        print(f"📦 Production: http://localhost:{PROD_PORT} (isolated DB)")
        print(f"🧪 Beta:       http://localhost:{BETA_PORT} (isolated DB)")
        print("📱 Press Ctrl+C to stop all servers.")
        print(f"\\n💡 Database files:")
        print(f"   Production: {PROD_DB}")
        print(f"   Beta:       {BETA_DB}")
        
        # Keep alive
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        signal_handler(signal.SIGINT, None)
    except Exception as e:
        print(f"❌ Error: {e}")
        cleanup()
        sys.exit(1)