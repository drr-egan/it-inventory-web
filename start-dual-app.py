#!/usr/bin/env python3
"""
Dual-port IT Inventory App Launcher
Runs production version on 8080 and beta version on 8081 simultaneously
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
db_process = None
processes = []

class GitHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that can serve from different git branches"""
    
    def __init__(self, *args, branch='production', **kwargs):
        self.branch = branch
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        # For the root path, ensure we're on the right branch
        if self.path == '/' or self.path == '/index.html':
            current_branch = get_current_branch()
            if current_branch != self.branch:
                switch_to_branch(self.branch)
        
        return super().do_GET()

def get_current_branch():
    """Get current git branch"""
    try:
        result = subprocess.run(['git', 'branch', '--show-current'], 
                              capture_output=True, text=True)
        return result.stdout.strip()
    except:
        return 'unknown'

def switch_to_branch(branch):
    """Switch to specified git branch"""
    try:
        subprocess.run(['git', 'checkout', branch], 
                      capture_output=True, text=True, check=True)
        print(f"✅ Switched to {branch} branch")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to switch to {branch}: {e}")
        return False

def start_database_server():
    """Starts the SQLite API server in a separate process."""
    global db_process
    print(f"🗄️  Starting database server on port {DB_PORT}...")
    
    # Check if database exists
    if not os.path.exists(DB_FILE):
        print(f"❌ Database file '{DB_FILE}' not found!")
        print("🔧 Please run 'python3 convert-to-sqlite.py' first to create the database.")
        sys.exit(1)
    
    try:
        # Use Popen to run simple-api-server.py as a background process
        db_process = subprocess.Popen(
            [sys.executable, "simple-api-server.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        processes.append(db_process)
        print(f"✅ Database server is running (PID: {db_process.pid}).")
        time.sleep(1)  # Give DB time to start
    except Exception as e:
        print(f"❌ Failed to start database server: {e}")
        sys.exit(1)

def serve_branch(port, branch, server_name):
    """Serve a specific branch on a specific port"""
    print(f"🚀 Starting {server_name} on port {port} (branch: {branch})...")
    
    # Ensure we're in the correct directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Switch to the target branch
    if not switch_to_branch(branch):
        print(f"❌ Could not switch to {branch} branch. Continuing anyway...")
    
    try:
        # Create custom handler for this branch
        handler = lambda *args, **kwargs: GitHandler(*args, branch=branch, **kwargs)
        
        with socketserver.TCPServer(("", port), handler) as httpd:
            print(f"✅ {server_name} running on http://localhost:{port}")
            httpd.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {port} is already in use. Please close the other application.")
        else:
            print(f"❌ Error starting {server_name}: {e}")

def open_browsers():
    """Opens both apps in browser tabs"""
    time.sleep(3)  # Wait for servers to be ready
    print("🌐 Opening browsers...")
    webbrowser.open(f'http://localhost:{PROD_PORT}')
    time.sleep(1)
    webbrowser.open(f'http://localhost:{BETA_PORT}')

def cleanup():
    """Clean up all processes"""
    print("\n🛑 Shutting down all servers...")
    
    # Kill all spawned processes
    for process in processes:
        if process and process.poll() is None:
            try:
                process.terminate()
                process.wait(timeout=5)
                print(f"✅ Process {process.pid} stopped.")
            except:
                try:
                    process.kill()
                    print(f"🔥 Process {process.pid} killed.")
                except:
                    pass
    
    print("👋 All servers stopped.")

def signal_handler(signum, frame):
    """Handle Ctrl+C gracefully"""
    cleanup()
    sys.exit(0)

if __name__ == "__main__":
    # Set up signal handler for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("🚀 Starting Dual-Port IT Inventory Management System")
    print("=" * 60)
    print(f"📦 Production App: http://localhost:{PROD_PORT} (production branch)")
    print(f"🧪 Beta App:       http://localhost:{BETA_PORT} (beta branch)")
    print(f"🗄️  API Server:     http://localhost:{DB_PORT}")
    print("=" * 60)
    
    # Check if git repository exists
    if not os.path.exists('.git'):
        print("❌ This is not a git repository. Creating branches...")
        print("🔧 Run these commands first:")
        print("   git init")
        print("   git add .")
        print("   git commit -m 'Initial commit'")
        print("   git branch beta")
        sys.exit(1)
    
    # Check if branches exist
    try:
        result = subprocess.run(['git', 'branch', '--list'], capture_output=True, text=True)
        branches = result.stdout
        
        if 'production' not in branches:
            print("🔧 Creating production branch...")
            subprocess.run(['git', 'checkout', '-b', 'production'], check=True)
        
        if 'beta' not in branches:
            print("🔧 Creating beta branch...")
            subprocess.run(['git', 'checkout', '-b', 'beta'], check=True)
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Git error: {e}")
        sys.exit(1)
    
    try:
        # Start the database server
        db_thread = threading.Thread(target=start_database_server, daemon=True)
        db_thread.start()
        time.sleep(2)
        
        # Start production server in a separate thread
        prod_thread = threading.Thread(
            target=serve_branch, 
            args=(PROD_PORT, 'production', 'Production Server'),
            daemon=True
        )
        prod_thread.start()
        time.sleep(1)
        
        # Start beta server in a separate thread
        beta_thread = threading.Thread(
            target=serve_branch, 
            args=(BETA_PORT, 'beta', 'Beta Server'),
            daemon=True
        )
        beta_thread.start()
        time.sleep(1)
        
        # Open browsers
        browser_thread = threading.Thread(target=open_browsers, daemon=True)
        browser_thread.start()
        
        print("\n🌐 Both servers are running!")
        print(f"📦 Production: http://localhost:{PROD_PORT}")
        print(f"🧪 Beta:       http://localhost:{BETA_PORT}")
        print("📱 Press Ctrl+C to stop all servers.")
        
        # Keep main thread alive
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        signal_handler(signal.SIGINT, None)
    except Exception as e:
        print(f"❌ Error: {e}")
        cleanup()
        sys.exit(1)