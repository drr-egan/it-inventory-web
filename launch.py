#!/usr/bin/env python3
"""
IT Inventory Management System Launcher
Choose how you want to run the application
"""

import subprocess
import sys
import os

def show_menu():
    """Display the launch options menu"""
    print("🚀 IT Inventory Management System")
    print("=" * 40)
    print("Choose how to run the application:")
    print()
    print("1. 📦 Production Only (port 8080)")
    print("2. 🧪 Beta Only (port 8081)")  
    print("3. 🔄 Both Apps - Shared Database (8080 + 8081)")
    print("4. 🔐 Both Apps - Separate Databases (8080 + 8081)")
    print("5. 🔀 Switch to Production Branch")
    print("6. 🔀 Switch to Beta Branch")
    print("7. 📊 View System Status")
    print("8. ❌ Exit")
    print()
    return input("Enter your choice (1-8): ").strip()

def run_production_only():
    """Run production app on port 8080"""
    print("\n🚀 Starting Production App...")
    try:
        # Switch to production branch first
        result = subprocess.run(['git', 'checkout', 'production'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Switched to production branch")
        
        # Start the app
        subprocess.run([sys.executable, 'start-app.py'])
    except KeyboardInterrupt:
        print("\n👋 Production app stopped.")
    except Exception as e:
        print(f"❌ Error: {e}")

def run_beta_only():
    """Run beta app on port 8081"""
    print("\n🧪 Starting Beta App...")
    
    # First create a modified start script for beta
    create_beta_launcher()
    
    try:
        # Switch to beta branch first
        result = subprocess.run(['git', 'checkout', 'beta'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Switched to beta branch")
        
        # Start the beta app
        subprocess.run([sys.executable, 'start-beta-app.py'])
    except KeyboardInterrupt:
        print("\n👋 Beta app stopped.")
    except Exception as e:
        print(f"❌ Error: {e}")

def run_dual_apps_shared():
    """Run both production and beta apps with shared database"""
    print("\n🔄 Starting Both Apps (Shared Database)...")
    try:
        subprocess.run([sys.executable, 'start-dual-simple.py'])
    except KeyboardInterrupt:
        print("\n👋 Both apps stopped.")
    except Exception as e:
        print(f"❌ Error: {e}")

def run_dual_apps_isolated():
    """Run both production and beta apps with separate databases"""
    print("\n🔐 Starting Both Apps (Separate Databases)...")
    try:
        subprocess.run([sys.executable, 'start-dual-isolated.py'])
    except KeyboardInterrupt:
        print("\n👋 Both apps stopped.")
    except Exception as e:
        print(f"❌ Error: {e}")

def switch_to_production():
    """Switch to production branch only"""
    try:
        subprocess.run([sys.executable, 'switch-to-production.py'])
    except Exception as e:
        print(f"❌ Error: {e}")

def switch_to_beta():
    """Switch to beta branch only"""
    try:
        subprocess.run([sys.executable, 'switch-to-beta.py'])
    except Exception as e:
        print(f"❌ Error: {e}")

def show_status():
    """Show current system status"""
    print("\n📊 System Status")
    print("=" * 30)
    
    # Check current git branch
    try:
        result = subprocess.run(['git', 'branch', '--show-current'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print(f"🌿 Current branch: {result.stdout.strip()}")
        else:
            print("🌿 Current branch: Not a git repository")
    except:
        print("🌿 Current branch: Git not available")
    
    # Check for running processes
    try:
        result = subprocess.run(['pgrep', '-f', 'python.*start.*app'], 
                              capture_output=True, text=True)
        if result.stdout.strip():
            print("🔄 Running processes found")
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                print(f"   PID: {pid}")
        else:
            print("🔄 No app processes running")
    except:
        print("🔄 Could not check running processes")
    
    # Check ports
    try:
        result = subprocess.run(['netstat', '-ln'], capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.split('\n')
            port_8080 = any(':8080' in line for line in lines)
            port_8081 = any(':8081' in line for line in lines)
            port_3001 = any(':3001' in line for line in lines)
            
            print(f"🌐 Port 8080 (Production): {'🟢 ACTIVE' if port_8080 else '🔴 INACTIVE'}")
            print(f"🌐 Port 8081 (Beta):       {'🟢 ACTIVE' if port_8081 else '🔴 INACTIVE'}")
            print(f"🌐 Port 3001 (API):       {'🟢 ACTIVE' if port_3001 else '🔴 INACTIVE'}")
    except:
        print("🌐 Could not check port status")
    
    # Check database
    if os.path.exists('inventory.db'):
        print("🗄️  Database: ✅ inventory.db exists")
    else:
        print("🗄️  Database: ❌ inventory.db not found")
    
    print()

def create_beta_launcher():
    """Create a beta-specific launcher with port 8081"""
    beta_content = '''#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
import threading
import time
import os
import subprocess
import sys

# --- Configuration for BETA ---
APP_PORT = 8081
DB_PORT = 3001
DB_FILE = "inventory.db"

db_process = None

def start_database_server():
    global db_process
    print(f"🗄️  Starting database server on port {DB_PORT}...")
    
    if not os.path.exists(DB_FILE):
        print(f"❌ Database file '{DB_FILE}' not found!")
        sys.exit(1)
    
    try:
        db_process = subprocess.Popen(
            [sys.executable, "simple-api-server.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print(f"✅ Database server running (PID: {db_process.pid}).")
    except Exception as e:
        print(f"❌ Failed to start database server: {e}")
        sys.exit(1)

def open_browser():
    time.sleep(2)
    webbrowser.open(f'http://localhost:{APP_PORT}')

def start_app_server():
    print(f"🧪 Starting BETA App on port {APP_PORT}...")
    try:
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        with socketserver.TCPServer(("", APP_PORT), http.server.SimpleHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {APP_PORT} is already in use.")
        else:
            print(f"❌ Error starting beta app: {e}")

if __name__ == "__main__":
    db_thread = threading.Thread(target=start_database_server, daemon=True)
    db_thread.start()
    
    time.sleep(2)
    
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    print(f"🧪 Beta app will be available at: http://localhost:{APP_PORT}")
    print("📱 Press Ctrl+C to stop.")
    
    try:
        start_app_server()
    except KeyboardInterrupt:
        print("\\n👋 Beta app stopped.")
    finally:
        if db_process:
            db_process.terminate()
            db_process.wait()
'''
    
    with open('start-beta-app.py', 'w') as f:
        f.write(beta_content)
    
    # Make executable
    os.chmod('start-beta-app.py', 0o755)

def main():
    """Main launcher function"""
    while True:
        choice = show_menu()
        
        if choice == '1':
            run_production_only()
        elif choice == '2':
            run_beta_only()
        elif choice == '3':
            run_dual_apps_shared()
        elif choice == '4':
            run_dual_apps_isolated()
        elif choice == '5':
            switch_to_production()
        elif choice == '6':
            switch_to_beta()
        elif choice == '7':
            show_status()
        elif choice == '8':
            print("👋 Goodbye!")
            sys.exit(0)
        else:
            print("❌ Invalid choice. Please try again.")
        
        print()
        input("Press Enter to return to menu...")

if __name__ == "__main__":
    main()