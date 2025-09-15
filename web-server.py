#!/usr/bin/env python3
"""
IT Inventory Beta - Web Deployment Server
Serves only the beta version with authentication
"""
import http.server
import socketserver
import threading
import os
import sys
import signal
from pathlib import Path

# Import the API server
try:
    from simple_api_server import InventoryAPIHandler
except ImportError:
    print("❌ Could not import API server")
    sys.exit(1)

# Configuration
WEB_PORT = int(os.environ.get('PORT', 10000))
API_PORT = WEB_PORT + 1  # Use PORT+1 for API to avoid conflicts

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=".", **kwargs)
    
    def end_headers(self):
        # Add security headers for production
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('X-XSS-Protection', '1; mode=block')
        super().end_headers()

def start_api_server():
    """Start the API server on PORT+1"""
    print(f"🗄️  Starting API server on port {API_PORT}...")
    
    try:
        with socketserver.TCPServer(("0.0.0.0", API_PORT), InventoryAPIHandler) as api_server:
            print(f"✅ API server running on port {API_PORT}")
            api_server.serve_forever()
    except Exception as e:
        print(f"❌ Failed to start API server: {e}")
        sys.exit(1)

def start_web_server():
    """Start the web server for beta frontend"""
    print(f"🚀 Starting IT Inventory Beta on port {WEB_PORT}...")
    
    # Ensure index.html exists
    if not os.path.exists("index.html"):
        print("❌ index.html not found!")
        sys.exit(1)
    
    try:
        with socketserver.TCPServer(("0.0.0.0", WEB_PORT), CustomHTTPRequestHandler) as web_server:
            print(f"✅ Beta web server running on port {WEB_PORT}")
            print(f"🌐 Access at: http://0.0.0.0:{WEB_PORT}")
            web_server.serve_forever()
    except Exception as e:
        print(f"❌ Failed to start web server: {e}")
        sys.exit(1)

def signal_handler(signum, frame):
    """Handle shutdown gracefully"""
    print("\n🛑 Shutting down servers...")
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("🚀 IT Inventory Beta - Web Deployment")
    print("=" * 50)
    print(f"🧪 Beta App:  http://0.0.0.0:{WEB_PORT}")
    print(f"🗄️  API:       http://0.0.0.0:{API_PORT}")
    print("=" * 50)
    
    # Start API server in background thread
    api_thread = threading.Thread(target=start_api_server, daemon=True)
    api_thread.start()
    
    # Give API server time to start
    import time
    time.sleep(2)
    
    # Start web server (blocking)
    start_web_server()