#!/usr/bin/env python3
"""
Simple launcher for IT Inventory App using SQLite backend
"""
import subprocess
import time
import webbrowser
import os
import sys

def kill_existing_servers():
    """Kill any existing servers on our ports"""
    try:
        # Kill existing processes
        subprocess.run(['pkill', '-f', 'simple-api-server.py'], capture_output=True)
        subprocess.run(['pkill', '-f', 'http.server 8080'], capture_output=True)
        time.sleep(1)
    except:
        pass

def main():
    # Change to the app directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Check if database exists
    if not os.path.exists('inventory.db'):
        print("❌ Database file 'inventory.db' not found!")
        print("🔧 Please run 'python3 convert-to-sqlite.py' first to create the database.")
        sys.exit(1)
    
    print("🚀 Starting IT Inventory Management App...")
    
    # Kill any existing servers first
    print("🧹 Cleaning up existing processes...")
    kill_existing_servers()
    
    api_process = None
    web_process = None
    
    try:
        # Start API server
        print("📊 Starting SQLite API server on port 3001...")
        api_process = subprocess.Popen([sys.executable, 'simple-api-server.py'], 
                                     stdout=subprocess.PIPE, 
                                     stderr=subprocess.PIPE)
        
        # Wait a moment for API server to start
        time.sleep(3)
        
        # Check if API server started successfully
        try:
            result = subprocess.run(['curl', '-s', 'http://localhost:3001'], 
                                  capture_output=True, timeout=5)
            if result.returncode != 0:
                print("❌ API server failed to start")
                return 1
        except:
            print("❌ API server not responding")
            return 1
        
        # Start web server
        print("🌐 Starting web server on port 8080...")
        web_process = subprocess.Popen([sys.executable, '-m', 'http.server', '8080'],
                                     stdout=subprocess.PIPE, 
                                     stderr=subprocess.PIPE)
        
        # Wait a moment for web server to start
        time.sleep(2)
        
        # Open browser
        print("🔗 Opening browser...")
        webbrowser.open('http://localhost:8080')
        
        print("✅ App is running!")
        print("🌐 Web App: http://localhost:8080")
        print("📊 API Server: http://localhost:3001")
        print("📱 Press Ctrl+C to stop both servers.")
        
        # Wait for processes
        try:
            api_process.wait()
        except KeyboardInterrupt:
            print("\n👋 Ctrl+C received. Shutting down servers...")
    
    except Exception as e:
        print(f"❌ Error starting servers: {e}")
        return 1
    
    finally:
        # Clean up processes
        if api_process:
            api_process.terminate()
            try:
                api_process.wait(timeout=5)
            except:
                api_process.kill()
        
        if web_process:
            web_process.terminate()
            try:
                web_process.wait(timeout=5)
            except:
                web_process.kill()
        
        print("✅ Servers stopped.")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())