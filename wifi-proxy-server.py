#!/usr/bin/env python3
"""
WiFi Proxy Server for IT Inventory App
Runs on WiFi interface and forwards requests to Ethernet interface
"""

import http.server
import urllib.request
import urllib.error
from urllib.parse import urljoin
import json
import socketserver
import threading

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    TARGET_HOST = "172.22.71.200"
    TARGET_PORT = 8080
    
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
            # Build target URL
            target_url = f"http://{self.TARGET_HOST}:{self.TARGET_PORT}{self.path}"
            
            # Create request
            headers = {}
            for key, value in self.headers.items():
                if key.lower() not in ['host', 'connection']:
                    headers[key] = value
            
            # Read request body if present
            content_length = self.headers.get('Content-Length')
            request_body = None
            if content_length:
                request_body = self.rfile.read(int(content_length))
            
            # Create and send request
            req = urllib.request.Request(target_url, data=request_body, headers=headers)
            req.get_method = lambda: self.command
            
            with urllib.request.urlopen(req, timeout=30) as response:
                # Send response
                self.send_response(response.getcode())
                
                # Forward headers
                for key, value in response.headers.items():
                    if key.lower() not in ['connection', 'transfer-encoding']:
                        self.send_header(key, value)
                
                # Add CORS headers
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                
                self.end_headers()
                
                # Forward response body
                self.wfile.write(response.read())
                
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(e.read())
            
        except Exception as e:
            print(f"Proxy error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(f"Proxy Error: {str(e)}".encode())

def start_proxy_server():
    # Bind to WiFi interface
    HOST = "172.22.210.200"
    PORT = 9090  # Different port to avoid conflicts
    
    print(f"🔄 Starting WiFi Proxy Server...")
    print(f"   Listening on: http://{HOST}:{PORT}")
    print(f"   Forwarding to: http://172.22.71.200:8080")
    print(f"   WiFi users can access: http://{HOST}:{PORT}")
    print("   Press Ctrl+C to stop")
    
    try:
        with socketserver.TCPServer((HOST, PORT), ProxyHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Proxy server stopped")
    except OSError as e:
        print(f"❌ Error starting proxy server: {e}")
        print("   Try a different port or check if address is available")

if __name__ == "__main__":
    start_proxy_server()
