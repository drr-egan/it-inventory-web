#!/bin/bash
# WiFi Access Solutions for IT Inventory App
# Port isolation is enabled on WiFi (172.22.210.x), Ethernet (172.22.71.x) works fine

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📶 WiFi Access Solutions for IT Inventory App${NC}"
echo "================================================="

echo -e "${YELLOW}🔍 Current Situation:${NC}"
echo "   ✅ Ethernet (172.22.71.200): Accessible to other devices"
echo "   ❌ WiFi (172.22.210.200): Port isolation blocks access"
echo "   🎯 Goal: Make app accessible to WiFi users"
echo ""

echo -e "${BLUE}🚀 Solution Options (Choose One):${NC}"
echo ""

echo -e "${GREEN}=== SOLUTION 1: Router Gateway Bridge (Recommended) ===${NC}"
echo -e "${YELLOW}Use the router as a bridge between networks${NC}"

cat > setup-router-bridge.sh << 'EOF'
#!/bin/bash
# Router Bridge Solution
echo "🌉 Setting up Router Gateway Bridge..."

# Get router IP for WiFi network
WIFI_GATEWAY=$(ip route | grep wlp2s0 | grep default | awk '{print $3}')
echo "WiFi Router IP: $WIFI_GATEWAY"

# Test if router can reach our ethernet IP
ping -c 2 172.22.71.200 > /dev/null && echo "✅ Router can reach ethernet network" || echo "❌ Router cannot reach ethernet"

echo ""
echo "📋 Manual Router Configuration Steps:"
echo "1. Access router admin: http://$WIFI_GATEWAY"
echo "2. Look for 'Port Forwarding' or 'Virtual Servers'"
echo "3. Add rule: External Port 8080 → 172.22.71.200:8080"
echo "4. WiFi users can then access: http://$WIFI_GATEWAY:8080"
echo ""
echo "🔧 Alternative - DMZ Host:"
echo "1. Set DMZ Host to: 172.22.71.200"
echo "2. This forwards ALL ports to your server"
EOF

chmod +x setup-router-bridge.sh

echo -e "${GREEN}=== SOLUTION 2: Nginx Reverse Proxy ===${NC}"
echo -e "${YELLOW}Set up nginx on this machine to proxy requests${NC}"

cat > setup-nginx-proxy.sh << 'EOF'
#!/bin/bash
# Nginx Reverse Proxy Solution
echo "🔄 Setting up Nginx Reverse Proxy..."

# Install nginx if not present
if ! command -v nginx &> /dev/null; then
    echo "Installing nginx..."
    sudo apt update && sudo apt install -y nginx
fi

# Create nginx config that binds to WiFi interface
sudo tee /etc/nginx/sites-available/inventory-wifi-proxy > /dev/null << NGINXCONF
server {
    listen 172.22.210.200:80;
    server_name 172.22.210.200;
    
    location / {
        proxy_pass http://172.22.71.200:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINXCONF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/inventory-wifi-proxy /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Nginx proxy configured"
echo "WiFi users can access: http://172.22.210.200/"
EOF

chmod +x setup-nginx-proxy.sh

echo -e "${GREEN}=== SOLUTION 3: Python Proxy Server ===${NC}"
echo -e "${YELLOW}Simple Python-based proxy (no admin privileges needed)${NC}"

cat > wifi-proxy-server.py << 'EOF'
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
EOF

chmod +x wifi-proxy-server.py

echo -e "${GREEN}=== SOLUTION 4: SSH Tunnel ===${NC}"
echo -e "${YELLOW}For remote access or advanced users${NC}"

cat > setup-ssh-tunnel.sh << 'EOF'
#!/bin/bash
# SSH Tunnel Solution
echo "🔐 SSH Tunnel Setup Guide"
echo ""
echo "For WiFi users to access via SSH tunnel:"
echo "1. From WiFi device, run:"
echo "   ssh -L 8080:172.22.71.200:8080 username@172.22.71.200"
echo "2. Then access: http://localhost:8080"
echo ""
echo "Requirements:"
echo "- SSH access to this server"
echo "- Users need SSH client"
EOF

chmod +x setup-ssh-tunnel.sh

echo -e "${GREEN}=== SOLUTION 5: Mobile Hotspot Bridge ===${NC}"
echo -e "${YELLOW}Quick temporary solution${NC}"

cat > mobile-hotspot-guide.sh << 'EOF'
#!/bin/bash
echo "📱 Mobile Hotspot Bridge Solution"
echo ""
echo "Quick temporary solution:"
echo "1. Enable mobile hotspot on your phone"
echo "2. Connect this server to the mobile hotspot"
echo "3. Connect WiFi users to the same hotspot"
echo "4. Everyone accesses via the hotspot network IP"
echo ""
echo "Pros: Quick setup, bypasses router isolation"
echo "Cons: Uses mobile data, temporary solution"
EOF

chmod +x mobile-hotspot-guide.sh

echo ""
echo -e "${BLUE}📊 Solution Comparison:${NC}"
echo ""
echo -e "${YELLOW}Solution 1 - Router Bridge:${NC}"
echo "   ✅ Best performance, permanent fix"
echo "   ❌ Requires router admin access"
echo "   🎯 WiFi users access: http://[router-ip]:8080"
echo ""
echo -e "${YELLOW}Solution 2 - Nginx Proxy:${NC}"  
echo "   ✅ Professional, reliable"
echo "   ❌ Requires sudo/admin privileges"
echo "   🎯 WiFi users access: http://172.22.210.200/"
echo ""
echo -e "${YELLOW}Solution 3 - Python Proxy (Recommended):${NC}"
echo "   ✅ No admin privileges needed, easy setup"
echo "   ✅ Runs as regular user"
echo "   🎯 WiFi users access: http://172.22.210.200:9090"
echo ""
echo -e "${YELLOW}Solution 4 - SSH Tunnel:${NC}"
echo "   ✅ Secure, works remotely"
echo "   ❌ Complex for end users"
echo "   🎯 Each user sets up their own tunnel"
echo ""
echo -e "${YELLOW}Solution 5 - Mobile Hotspot:${NC}"
echo "   ✅ Quick temporary fix"
echo "   ❌ Uses mobile data, not permanent"

echo ""
echo -e "${GREEN}🚀 Quick Start Recommendations:${NC}"
echo ""
echo -e "${BLUE}For Immediate Use:${NC}"
echo "   python3 wifi-proxy-server.py &"
echo "   # WiFi users: http://172.22.210.200:9090"
echo ""
echo -e "${BLUE}For Permanent Solution:${NC}"
echo "   ./setup-router-bridge.sh"
echo "   # Configure port forwarding in router"
echo ""
echo -e "${BLUE}For Professional Setup:${NC}" 
echo "   ./setup-nginx-proxy.sh"
echo "   # Requires sudo access"

echo ""
echo -e "${YELLOW}📝 Current Access Status:${NC}"
echo "   Ethernet users: http://172.22.71.200:8080 ✅"
echo "   WiFi users: Currently blocked by port isolation ❌"
echo "   After solution: WiFi users can access via proxy ✅"

echo -e "${GREEN}✨ Setup complete! Choose and run your preferred solution.${NC}"
EOF

chmod +x wifi-access-solutions.sh