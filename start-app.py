#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
import threading
import time
import os
import subprocess
import sys

# --- Configuration ---
APP_PORT = 8080
DB_PORT = 3001
DB_FILE = "inventory.db"

# --- Global variable to hold the database server process ---
db_process = None

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
        print(f"✅ Database server is running (PID: {db_process.pid}).")
    except Exception as e:
        print(f"❌ Failed to start database server: {e}")
        sys.exit(1)

def open_browser():
    """Waits a moment and then opens the web browser to the app."""
    time.sleep(2)  # Wait for the app server to be ready
    webbrowser.open(f'http://localhost:{APP_PORT}')

def start_app_server():
    """Starts the simple HTTP server for the main application."""
    print(f"🚀 Starting IT Inventory Management App on port {APP_PORT}...")
    try:
        # Ensure we are in the correct directory
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        with socketserver.TCPServer(("", APP_PORT), http.server.SimpleHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {APP_PORT} is already in use. Please close the other application or change the APP_PORT.")
        else:
            print(f"❌ Error starting app server: {e}")
    finally:
        # This will be called when the server is stopped
        pass

if __name__ == "__main__":
    # Start the database server in a separate thread
    db_thread = threading.Thread(target=start_database_server, daemon=True)
    db_thread.start()

    # Give the DB a moment to start before the app tries to connect
    time.sleep(2)

    # Start the browser opener in a separate thread
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()

    print(f"🌐 App will be available at: http://localhost:{APP_PORT}")
    print("📱 Press Ctrl+C to stop both servers.")

    try:
        # Start the app server in the main thread
        start_app_server()
    except KeyboardInterrupt:
        print("\n👋 Ctrl+C received. Shutting down servers...")
    finally:
        # Cleanly terminate the database server process
        if db_process:
            print("🛑 Stopping database server...")
            db_process.terminate()
            db_process.wait()
            print("✅ Database server stopped.")
        print("👋 Goodbye!")
