#!/usr/bin/env python3
"""
Simple launcher that starts servers one by one with better error handling
"""
import subprocess
import time
import webbrowser
import os
import sys
import socket

def check_port_free(port, max_attempts=3):
    """Check if port is free, with retries"""
    for i in range(max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return True
        except OSError:
            if i < max_attempts - 1:
                print(f"Port {port} busy, waiting...")
                time.sleep(2)
            continue
    return False

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    if not os.path.exists('inventory.db'):
        print("❌ Database file 'inventory.db' not found!")
        return 1
    
    print("🚀 Starting IT Inventory App...")
    
    # Check ports are free
    if not check_port_free(3001):
        print("❌ Port 3001 is not available")
        return 1
        
    if not check_port_free(8080):
        print("❌ Port 8080 is not available") 
        return 1
    
    try:
        # Start API server
        print("📊 Starting API server...")
        api_cmd = [sys.executable, 'simple-api-server.py']
        api_process = subprocess.Popen(api_cmd)
        
        # Wait and check if it started
        time.sleep(3)
        if api_process.poll() is not None:
            print("❌ API server failed to start")
            return 1
            
        # Test API connection
        try:
            result = subprocess.run(['curl', '-s', 'http://localhost:3001'], 
                                  capture_output=True, timeout=5)
            if result.returncode != 0:
                print("❌ API server not responding")
                api_process.terminate()
                return 1
        except:
            print("❌ Could not test API server")
            api_process.terminate()
            return 1
            
        print("✅ API server running on port 3001")
        
        # Start web server
        print("🌐 Starting web server...")
        web_cmd = [sys.executable, '-m', 'http.server', '8080']
        web_process = subprocess.Popen(web_cmd)
        
        time.sleep(2)
        if web_process.poll() is not None:
            print("❌ Web server failed to start")
            api_process.terminate()
            return 1
            
        print("✅ Web server running on port 8080")
        print("🔗 Opening browser...")
        webbrowser.open('http://localhost:8080')
        
        print("✅ App is running!")
        print("📱 Press Ctrl+C to stop servers.")
        
        # Wait for keyboard interrupt
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n👋 Stopping servers...")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    finally:
        # Clean up
        if 'api_process' in locals():
            api_process.terminate()
        if 'web_process' in locals():
            web_process.terminate()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())