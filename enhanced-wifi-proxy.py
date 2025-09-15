#!/usr/bin/env python3
"""
Enhanced WiFi Proxy Server for IT Inventory App
Binds to all interfaces and properly forwards both app and API requests
"""

import http.server
import urllib.request
import urllib.error
from urllib.parse import urljoin, urlparse
import json
import socketserver
import threading
import sys

class EnhancedProxyHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        """Override to provide better logging"""
        print(f"🔄 {self.client_address[0]} - {format % args}")
    
    def do_GET(self):
        self.proxy_request()
    
    def do_POST(self):
        self.proxy_request()
        
    def do_PATCH(self):
        self.proxy_request()
        
    def do_DELETE(self):
        self.proxy_request()
        
    def do_OPTIONS(self):
        self.proxy_request()
    
    def proxy_request(self):
        try:
            # Determine target based on path
            if self.path.startswith('/api/') or self.path.startswith('/items') or self.path.startswith('/users') or self.path.startswith('/checkoutHistory'):
                # API requests go to port 3001
                target_host = "127.0.0.1"
                target_port = 3001
                print(f"📡 API Request: {self.command} {self.path} → {target_host}:{target_port}")
            else:
                # App requests go to port 8080
                target_host = "127.0.0.1" 
                target_port = 8080
                print(f"🌐 App Request: {self.command} {self.path} → {target_host}:{target_port}")
            
            # Build target URL
            target_url = f"http://{target_host}:{target_port}{self.path}"
            
            # Create request headers
            headers = {}
            for key, value in self.headers.items():
                if key.lower() not in ['host', 'connection']:
                    headers[key] = value
            
            # Read request body if present
            content_length = self.headers.get('Content-Length')
            request_body = None
            if content_length:
                request_body = self.rfile.read(int(content_length))
                print(f"📝 Request body length: {len(request_body)} bytes")
            
            # Create and send request
            req = urllib.request.Request(target_url, data=request_body, headers=headers)
            req.get_method = lambda: self.command
            
            with urllib.request.urlopen(req, timeout=30) as response:
                # Send response status
                self.send_response(response.getcode())
                print(f"✅ Response: {response.getcode()}")
                
                # Forward headers
                for key, value in response.headers.items():
                    if key.lower() not in ['connection', 'transfer-encoding']:
                        self.send_header(key, value)
                
                # Add comprehensive CORS headers
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
                self.send_header('Access-Control-Max-Age', '3600')
                
                self.end_headers()
                
                # Forward response body
                response_data = response.read()
                self.wfile.write(response_data)
                print(f"📤 Forwarded {len(response_data)} bytes")
                
        except urllib.error.HTTPError as e:
            print(f"⚠️  HTTP Error {e.code}: {e.reason}")
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            try:
                error_data = e.read()
                self.wfile.write(error_data)
            except:
                error_msg = json.dumps({"error": f"HTTP {e.code}: {e.reason}"}).encode()
                self.wfile.write(error_msg)
            
        except Exception as e:
            print(f"❌ Proxy error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_msg = json.dumps({"error": f"Proxy Error: {str(e)}"}).encode()
            self.wfile.write(error_msg)

def start_enhanced_proxy():
    # Bind to all interfaces - this is key for external access
    HOST = "0.0.0.0"
    PORT = 9091
    
    print(f"🚀 Starting Enhanced WiFi Proxy Server...")
    print(f"   🌐 Listening on: {HOST}:{PORT} (all interfaces)")
    print(f"   📱 App forwards to: http://127.0.0.1:8080")
    print(f"   📡 API forwards to: http://127.0.0.1:3001")
    print()
    print(f"   ✅ Ethernet users: http://172.22.71.200:8080")  
    print(f"   📶 WiFi users: http://172.22.210.200:{PORT}")
    print(f"   🌍 External users: http://[your-ip]:{PORT}")
    print()
    print(f"   🛑 Press Ctrl+C to stop")
    print(f"   📊 Requests will be logged below:")
    print("   " + "="*50)
    
    try:
        with socketserver.TCPServer((HOST, PORT), EnhancedProxyHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n🛑 Enhanced proxy server stopped")
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {PORT} is already in use!")
            print(f"   Kill existing proxy: pkill -f wifi-proxy")
            print(f"   Or use different port: python3 {sys.argv[0]} --port 9091")
        else:
            print(f"❌ Error starting proxy server: {e}")

if __name__ == "__main__":
    start_enhanced_proxy()