#!/usr/bin/env python3
"""
Simplified Dual-port IT Inventory App Launcher
Runs production on 8080 and beta on 8081 using separate directories
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
from pathlib import Path

# --- Configuration ---
PROD_PORT = 8080
BETA_PORT = 8081
DB_PORT = 3001
DB_FILE = "inventory.db"

# --- Global variables ---
processes = []

def start_database_server():
    """Starts the SQLite API server"""
    print(f"🗄️  Starting database server on port {DB_PORT}...")
    
    if not os.path.exists(DB_FILE):
        print(f"❌ Database file '{DB_FILE}' not found!")
        print("🔧 Please run 'python3 convert-to-sqlite.py' first.")
        sys.exit(1)
    
    try:
        process = subprocess.Popen(
            [sys.executable, "simple-api-server.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        processes.append(process)
        print(f"✅ Database server running (PID: {process.pid})")
        return process
    except Exception as e:
        print(f"❌ Failed to start database server: {e}")
        sys.exit(1)

def start_web_server(port, directory, name):
    """Start a web server for a specific directory"""
    print(f"🚀 Starting {name} on port {port} from {directory}...")
    
    try:
        # Change to the target directory
        original_dir = os.getcwd()
        os.chdir(directory)
        
        # Create a simple HTTP server
        handler = http.server.SimpleHTTPRequestHandler
        with socketserver.TCPServer(("0.0.0.0", port), handler) as httpd:
            print(f"✅ {name} running on http://0.0.0.0:{port} (accessible from network)")
            httpd.serve_forever()
            
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {port} is already in use.")
        else:
            print(f"❌ Error starting {name}: {e}")
    finally:
        os.chdir(original_dir)

def setup_directories():
    """Set up production and beta directories"""
    base_dir = os.getcwd()
    prod_dir = os.path.join(base_dir, "production")
    beta_dir = os.path.join(base_dir, "beta")
    
    # Create directories if they don't exist
    os.makedirs(prod_dir, exist_ok=True)
    os.makedirs(beta_dir, exist_ok=True)
    
    # Files to copy to both directories (excluding index.html to preserve custom versions)
    files_to_copy = [
        "cart-icon.png",
        "inventory.db"
    ]
    
    print("📁 Setting up directories...")
    
    # Copy files to production directory
    for file in files_to_copy:
        if os.path.exists(file):
            dest = os.path.join(prod_dir, file)
            if not os.path.exists(dest) or os.path.getmtime(file) > os.path.getmtime(dest):
                shutil.copy2(file, dest)
                print(f"  📄 Copied {file} to production/")
    
    # Copy files to beta directory  
    for file in files_to_copy:
        if os.path.exists(file):
            dest = os.path.join(beta_dir, file)
            if not os.path.exists(dest) or os.path.getmtime(file) > os.path.getmtime(dest):
                shutil.copy2(file, dest)
                print(f"  📄 Copied {file} to beta/")
    
    return prod_dir, beta_dir

def open_browsers():
    """Opens both apps in browser tabs"""
    time.sleep(3)
    print("🌐 Opening browsers...")
    webbrowser.open(f'http://localhost:{PROD_PORT}')
    time.sleep(1)
    webbrowser.open(f'http://localhost:{BETA_PORT}')

def cleanup():
    """Clean up all processes"""
    print("\n🛑 Shutting down servers...")
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

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("🚀 IT Inventory - Dual Server Setup")
    print("=" * 50)
    print(f"📦 Production: http://localhost:{PROD_PORT}")
    print(f"🧪 Beta:       http://localhost:{BETA_PORT}")
    print(f"🗄️  API:        http://localhost:{DB_PORT}")
    print("=" * 50)
    
    try:
        # Set up directories
        prod_dir, beta_dir = setup_directories()
        
        # Start database server
        start_database_server()
        time.sleep(2)
        
        # Start production server
        prod_thread = threading.Thread(
            target=start_web_server,
            args=(PROD_PORT, prod_dir, "Production Server"),
            daemon=True
        )
        prod_thread.start()
        time.sleep(1)
        
        # Start beta server
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
        
        print(f"\n🌐 Servers running!")
        print(f"📦 Production: http://localhost:{PROD_PORT}")
        print(f"🧪 Beta:       http://localhost:{BETA_PORT}")
        print("📱 Press Ctrl+C to stop.")
        print("\n💡 Tip: Edit files in production/ or beta/ directories")
        print("   Changes will be visible immediately!")
        
        # Keep alive
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        signal_handler(signal.SIGINT, None)
    except Exception as e:
        print(f"❌ Error: {e}")
        cleanup()
        sys.exit(1)