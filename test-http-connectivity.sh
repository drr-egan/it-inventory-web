#!/bin/bash
# HTTP Connectivity Test Script
# Since ping works but HTTP doesn't, this focuses on HTTP-specific issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🌐 HTTP Connectivity Test${NC}"
echo "=========================="

# Get network info
LOCAL_IP=$(ip addr show | grep -E "inet.*scope global" | head -1 | awk '{print $2}' | cut -d'/' -f1)
echo -e "${YELLOW}📍 Network Info:${NC}"
echo "   Local IP: $LOCAL_IP"
echo ""

# Test HTTP connectivity with detailed output
echo -e "${YELLOW}🧪 Testing HTTP Access Methods...${NC}"

echo -e "${BLUE}1. Testing with curl (verbose):${NC}"
curl -v -m 10 http://$LOCAL_IP:8080/ 2>&1 | head -20 || echo "❌ Curl test failed"

echo ""
echo -e "${BLUE}2. Testing with wget:${NC}"
timeout 10 wget -O - http://$LOCAL_IP:8080/ 2>&1 | head -10 || echo "❌ Wget test failed"

echo ""
echo -e "${BLUE}3. Testing with netcat port check:${NC}"
timeout 5 nc -zv $LOCAL_IP 8080 2>&1 || echo "❌ Netcat test failed"

echo ""
echo -e "${BLUE}4. Testing with telnet simulation:${NC}"
timeout 3 bash -c "echo 'GET / HTTP/1.0' | nc $LOCAL_IP 8080" 2>&1 | head -5 || echo "❌ HTTP request test failed"

echo ""
echo -e "${YELLOW}🔍 Checking potential blocking issues...${NC}"

# Check for iptables rules
echo -e "${BLUE}5. Checking iptables rules:${NC}"
if command -v iptables >/dev/null 2>&1; then
    echo "INPUT chain rules:"
    sudo iptables -L INPUT -n --line-numbers 2>/dev/null | head -10 || echo "Cannot access iptables (may need sudo)"
    echo "OUTPUT chain rules:"
    sudo iptables -L OUTPUT -n --line-numbers 2>/dev/null | head -10 || echo "Cannot access iptables"
else
    echo "iptables not available"
fi

echo ""
echo -e "${BLUE}6. Checking for other services on port 8080:${NC}"
sudo lsof -i :8080 2>/dev/null || echo "Cannot check lsof (may need sudo)"

echo ""
echo -e "${YELLOW}💡 Common HTTP Blocking Causes:${NC}"
echo "1. Local firewall (iptables/ufw)"
echo "2. Application binding to localhost only"
echo "3. SELinux/AppArmor restrictions"
echo "4. Network service conflicts"
echo "5. Router firewall (even with ping working)"

echo ""
echo -e "${BLUE}🔧 Quick Fixes to Try:${NC}"

echo ""
echo -e "${YELLOW}Fix 1: Temporary iptables allow${NC}"
echo "sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT"
echo "sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT"

echo ""
echo -e "${YELLOW}Fix 2: UFW allow (even if inactive)${NC}"
echo "sudo ufw allow 8080/tcp"
echo "sudo ufw allow 3000/tcp"

echo ""
echo -e "${YELLOW}Fix 3: Check application logs${NC}"
echo "tail -f /tmp/launcher.log"

echo ""
echo -e "${YELLOW}Fix 4: Restart with specific binding${NC}"
echo "# Stop current app and restart with explicit IP binding"

# Create a test HTTP server
echo ""
echo -e "${BLUE}7. Creating test HTTP server on port 8888...${NC}"

cat > simple-test-server.py << 'EOF'
#!/usr/bin/env python3
import http.server
import socketserver
import sys

class TestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        client_ip = self.client_address[0]
        response = f"""
        <html><body style="font-family: Arial;">
        <h1>✅ HTTP Test Server Working!</h1>
        <p>Your IP: {client_ip}</p>
        <p>Server IP: {self.server.server_address[0]}</p>
        <p>If you can see this from another device, HTTP connectivity works!</p>
        </body></html>
        """
        self.wfile.write(response.encode())

PORT = 8888
print(f"Starting test HTTP server on 0.0.0.0:{PORT}")
print("Test from another device: http://$LOCAL_IP:{PORT}")
print("Press Ctrl+C to stop")

try:
    with socketserver.TCPServer(("0.0.0.0", PORT), TestHandler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nTest server stopped")
except OSError as e:
    print(f"Error: {e}")
    print("Port 8888 may be in use")
EOF

chmod +x simple-test-server.py

echo "Test server created: simple-test-server.py"
echo ""
echo -e "${YELLOW}📝 Manual Test Instructions:${NC}"
echo "1. Run: python3 simple-test-server.py"
echo "2. From another device, browse to: http://$LOCAL_IP:8888"
echo "3. If test server works but main app doesn't, it's an app-specific issue"
echo "4. If test server fails too, it's a system/network issue"

echo ""
echo -e "${GREEN}🎯 Next Steps:${NC}"
echo "1. Try the manual HTTP test above"
echo "2. Run one of the quick fixes"
echo "3. Check application logs for errors"
echo "4. Verify no other service is using port 8080"

echo ""
echo -e "${BLUE}📞 For External Testing:${NC}"
echo "Ask someone on another device to try:"
echo "curl -v http://$LOCAL_IP:8080/"
echo "or browse to: http://$LOCAL_IP:8080"