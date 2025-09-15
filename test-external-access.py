#!/usr/bin/env python3
"""
External Access Test Server
Tests network connectivity from external devices without firewall/admin requirements
"""

import http.server
import socketserver
import threading
import time
import sys

class ExternalTestHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        """Log with timestamp and client info"""
        timestamp = time.strftime('%H:%M:%S')
        print(f"[{timestamp}] {self.client_address[0]} - {format % args}")
    
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        client_ip = self.client_address[0]
        server_ip = self.server.server_address[0]
        
        # Determine network type
        network_type = "Unknown"
        if client_ip.startswith('172.22.71.'):
            network_type = "Ethernet (172.22.71.x)"
        elif client_ip.startswith('172.22.210.'):
            network_type = "WiFi (172.22.210.x)"
        elif client_ip == '127.0.0.1':
            network_type = "Local (127.0.0.1)"
        
        response = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>🌐 Network Connectivity Test</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }}
                .container {{ background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                .success {{ color: green; font-size: 24px; font-weight: bold; }}
                .info {{ background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 10px 0; }}
                .network {{ background: #fff3e0; padding: 15px; border-radius: 5px; margin: 10px 0; }}
                .test {{ background: #f3e5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }}
                ul {{ line-height: 1.8; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success">✅ EXTERNAL ACCESS SUCCESS!</div>
                
                <div class="info">
                    <h3>🔍 Connection Details</h3>
                    <ul>
                        <li><strong>Your IP:</strong> {client_ip}</li>
                        <li><strong>Server IP:</strong> {server_ip}</li>
                        <li><strong>Network Type:</strong> {network_type}</li>
                        <li><strong>Access Time:</strong> {time.strftime('%Y-%m-%d %H:%M:%S')}</li>
                    </ul>
                </div>
                
                <div class="network">
                    <h3>🌐 Network Status</h3>
                    <p>If you can see this page from another device, external HTTP access is working!</p>
                    <ul>
                        <li><strong>Port Binding:</strong> Server bound to all interfaces (0.0.0.0)</li>
                        <li><strong>External Connectivity:</strong> ✅ Confirmed working</li>
                        <li><strong>Firewall Status:</strong> ✅ Not blocking this connection</li>
                    </ul>
                </div>
                
                <div class="test">
                    <h3>🧪 Next Tests</h3>
                    <p>If this test page works but the main app doesn't, the issue is likely:</p>
                    <ul>
                        <li>App-specific binding issues</li>
                        <li>CORS configuration</li>
                        <li>Application-level restrictions</li>
                        <li>Different port blocking rules</li>
                    </ul>
                    
                    <p><strong>Test URLs to try:</strong></p>
                    <ul>
                        <li>Main App: <a href="http://{server_ip}:8080">http://{server_ip}:8080</a></li>
                        <li>Proxy: <a href="http://{server_ip}:9091">http://{server_ip}:9091</a></li>
                        <li>API: <a href="http://{server_ip}:3001/items">http://{server_ip}:3001/items</a></li>
                    </ul>
                </div>
            </div>
        </body>
        </html>
        """
        
        self.wfile.write(response.encode())

def start_test_servers():
    """Start test servers on multiple ports to isolate connectivity issues"""
    
    servers = []
    test_ports = [8888, 8889, 8890]
    
    print("🧪 Starting External Access Test Servers...")
    print("=" * 50)
    
    for port in test_ports:
        try:
            server = socketserver.TCPServer(("0.0.0.0", port), ExternalTestHandler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            servers.append((server, port))
            print(f"✅ Test server started on: http://0.0.0.0:{port}")
        except OSError as e:
            print(f"❌ Port {port} failed: {e}")
    
    if not servers:
        print("❌ No test servers could start!")
        return
    
    print("\n🌐 External Access Test URLs:")
    print("-" * 30)
    print(f"📱 From Ethernet devices: http://172.22.71.200:{test_ports[0]}")
    print(f"📶 From WiFi devices: http://172.22.210.200:{test_ports[0]}")
    print(f"🖥️  From any device: http://[server-ip]:{test_ports[0]}")
    
    print("\n🔍 What this test reveals:")
    print("- If you can access these URLs from other devices → Network/firewall is OK")
    print("- If you can't → Network/firewall is blocking external access")
    print("- Compare results with main app to isolate the issue")
    
    print(f"\n🛑 Press Ctrl+C to stop all test servers")
    print("📊 Connection attempts will be logged below:")
    print("=" * 50)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"\n🛑 Stopping test servers...")
        for server, port in servers:
            server.shutdown()
            server.server_close()
            print(f"✅ Test server on port {port} stopped")

if __name__ == "__main__":
    start_test_servers()