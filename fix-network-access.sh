#!/bin/bash
# Network Access Fix Script for IT Inventory Management App
# Addresses the issue where the app is accessible locally but not from external devices

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Network Access Fix Script${NC}"
echo "======================================="

# Get current network information
LOCAL_IP=$(ip addr show | grep -E "inet.*scope global" | head -1 | awk '{print $2}' | cut -d'/' -f1)
GATEWAY=$(ip route | grep default | awk '{print $3}' | head -1)
INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)

echo -e "${YELLOW}📍 Current Network Configuration:${NC}"
echo "   Local IP: $LOCAL_IP"
echo "   Gateway: $GATEWAY"
echo "   Interface: $INTERFACE"
echo ""

# Check if services are running
echo -e "${YELLOW}🔍 Checking Service Status...${NC}"
if pgrep -f "start-app.py" > /dev/null; then
    echo -e "   ✅ Application: Running"
    APP_RUNNING=true
else
    echo -e "   ❌ Application: Not running"
    APP_RUNNING=false
fi

# Check port bindings
echo -e "${YELLOW}📡 Checking Port Bindings...${NC}"
PORT_8080=$(ss -tlnp | grep ":8080" | grep "0.0.0.0" | wc -l)
PORT_3000=$(ss -tlnp | grep ":3000" | grep "0.0.0.0" | wc -l)

if [[ $PORT_8080 -gt 0 ]]; then
    echo -e "   ✅ Port 8080: Bound to all interfaces (0.0.0.0)"
else
    echo -e "   ❌ Port 8080: Not properly bound"
fi

if [[ $PORT_3000 -gt 0 ]]; then
    echo -e "   ✅ Port 3000: Bound to all interfaces (0.0.0.0)"
else
    echo -e "   ❌ Port 3000: Not properly bound"
fi

echo ""

# Test local connectivity
echo -e "${YELLOW}🧪 Testing Local Connectivity...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/ --connect-timeout 5 | grep -q "200"; then
    echo -e "   ✅ Localhost (127.0.0.1): Working"
    LOCALHOST_OK=true
else
    echo -e "   ❌ Localhost (127.0.0.1): Failed"
    LOCALHOST_OK=false
fi

if curl -s -o /dev/null -w "%{http_code}" http://$LOCAL_IP:8080/ --connect-timeout 5 | grep -q "200"; then
    echo -e "   ✅ Local IP ($LOCAL_IP): Working"
    LOCAL_IP_OK=true
else
    echo -e "   ❌ Local IP ($LOCAL_IP): Failed"
    LOCAL_IP_OK=false
fi

echo ""

# Common fixes
echo -e "${BLUE}🔧 Applying Network Fixes...${NC}"

# Fix 1: Check and disable UFW if it's blocking
echo -n "   Checking UFW firewall status: "
if command -v ufw >/dev/null 2>&1; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1 | awk '{print $2}' || echo "inactive")
    echo "$UFW_STATUS"
    
    if [[ "$UFW_STATUS" == "active" ]]; then
        echo -e "   ${YELLOW}⚠️  UFW is active, adding rules for our ports...${NC}"
        sudo ufw allow 8080/tcp comment "IT Inventory App" 2>/dev/null || echo "   Failed to add UFW rule (may need manual intervention)"
        sudo ufw allow 3000/tcp comment "IT Inventory API" 2>/dev/null || echo "   Failed to add UFW rule (may need manual intervention)"
        sudo ufw allow 3001/tcp comment "IT Inventory API Enhanced" 2>/dev/null || echo "   Failed to add UFW rule (may need manual intervention)"
        echo -e "   ✅ UFW rules added"
    else
        echo -e "   ✅ UFW is inactive (not blocking)"
    fi
else
    echo "Not installed"
fi

# Fix 2: Check NetworkManager WiFi isolation
echo -n "   Checking WiFi AP isolation: "
if command -v nmcli >/dev/null 2>&1; then
    WIFI_CONNECTION=$(nmcli -t -f NAME connection show --active | grep -v lo | head -1)
    if [[ -n "$WIFI_CONNECTION" ]]; then
        echo "Connection: $WIFI_CONNECTION"
        echo -e "   ${YELLOW}💡 Note: WiFi router may have AP isolation enabled${NC}"
        echo -e "      This prevents devices from communicating with each other"
    else
        echo "No active WiFi connection found"
    fi
else
    echo "NetworkManager not available"
fi

# Fix 3: Create a temporary Python HTTP server test
echo -e "${YELLOW}🧪 Creating Network Test Server...${NC}"
cat > network-test-server.py << 'EOF'
#!/usr/bin/env python3
import http.server
import socketserver
import threading
import time

class TestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        
        client_ip = self.client_address[0]
        message = f"""
        <html><body style="font-family: Arial; margin: 40px;">
            <h2>🌐 Network Test Server</h2>
            <p><strong>Status:</strong> ✅ Connection Successful!</p>
            <p><strong>Your IP:</strong> {client_ip}</p>
            <p><strong>Server IP:</strong> {self.server.server_address[0]}</p>
            <p><strong>Server Port:</strong> {self.server.server_address[1]}</p>
            <hr>
            <p>If you can see this page from another device, network connectivity is working!</p>
        </body></html>
        """
        self.wfile.write(message.encode())

def start_test_server(port=8888):
    with socketserver.TCPServer(("0.0.0.0", port), TestHandler) as httpd:
        print(f"Test server running on http://0.0.0.0:{port}")
        httpd.serve_forever()

if __name__ == "__main__":
    start_test_server()
EOF

chmod +x network-test-server.py

# Start test server in background
echo -e "   Starting test server on port 8888..."
python3 network-test-server.py &
TEST_SERVER_PID=$!
sleep 2

# Test the test server
echo -n "   Testing network test server: "
if curl -s -o /dev/null -w "%{http_code}" http://$LOCAL_IP:8888/ --connect-timeout 5 | grep -q "200"; then
    echo -e "${GREEN}✅ Working${NC}"
    TEST_SERVER_OK=true
else
    echo -e "${RED}❌ Failed${NC}"
    TEST_SERVER_OK=false
fi

# Kill test server
kill $TEST_SERVER_PID 2>/dev/null || true
sleep 1

echo ""

# Provide specific solutions based on findings
echo -e "${BLUE}💡 Network Access Solutions${NC}"

if [[ $APP_RUNNING == false ]]; then
    echo -e "${RED}❌ Issue: Application is not running${NC}"
    echo -e "   ${YELLOW}Solution: Start the application${NC}"
    echo -e "   Command: python3 start-app.py"
    echo ""
fi

if [[ $LOCALHOST_OK == true && $LOCAL_IP_OK == true && $TEST_SERVER_OK == false ]]; then
    echo -e "${YELLOW}⚠️  Issue: Local firewall is likely blocking external access${NC}"
    echo -e "   ${GREEN}Solutions:${NC}"
    echo -e "   1. Disable local firewall temporarily:"
    echo -e "      sudo ufw disable"
    echo -e "   2. Or add specific firewall rules:"
    echo -e "      sudo ufw allow from 172.22.210.0/24 to any port 8080"
    echo -e "      sudo ufw allow from 172.22.210.0/24 to any port 3000"
    echo ""
fi

if [[ $TEST_SERVER_OK == false ]]; then
    echo -e "${YELLOW}⚠️  Issue: WiFi Access Point (AP) Isolation is likely enabled${NC}"
    echo -e "   ${GREEN}Solutions:${NC}"
    echo -e "   1. Check WiFi router settings:"
    echo -e "      - Log into router admin panel (usually http://$GATEWAY)"
    echo -e "      - Look for 'AP Isolation' or 'Client Isolation' settings"
    echo -e "      - Disable AP isolation"
    echo -e "   2. Or connect devices to different WiFi network"
    echo -e "   3. Or use ethernet connection instead of WiFi"
    echo ""
fi

echo -e "${YELLOW}⚡ Quick Fixes to Try:${NC}"
echo ""

echo -e "${BLUE}1. Disable Local Firewall (Temporary)${NC}"
echo -e "   sudo ufw disable"
echo -e "   # Test access from another device"
echo -e "   # Re-enable later: sudo ufw enable"
echo ""

echo -e "${BLUE}2. Allow Specific Network Range${NC}"
echo -e "   sudo ufw allow from 172.22.210.0/24"
echo -e "   # This allows all devices on your local network"
echo ""

echo -e "${BLUE}3. Manual Port Rules${NC}"
echo -e "   sudo ufw allow 8080/tcp"
echo -e "   sudo ufw allow 3000/tcp"
echo -e "   sudo ufw allow 3001/tcp"
echo ""

echo -e "${BLUE}4. Test Network Connectivity${NC}"
echo -e "   # From another device, try to ping this computer:"
echo -e "   ping $LOCAL_IP"
echo -e "   # If ping fails, it's likely AP isolation"
echo ""

echo -e "${BLUE}5. Router Configuration${NC}"
echo -e "   # Access router admin panel:"
echo -e "   http://$GATEWAY"
echo -e "   # Look for and disable:"
echo -e "   - AP Isolation"
echo -e "   - Client Isolation" 
echo -e "   - Guest Network restrictions"
echo ""

# Create a quick test command
cat > test-external-access.sh << EOF
#!/bin/bash
echo "Testing external access to IT Inventory App..."
echo "Run this command from another device on the network:"
echo ""
echo "curl -s http://$LOCAL_IP:8080/ | head -10"
echo ""
echo "Or open in browser: http://$LOCAL_IP:8080"
echo ""
echo "If it fails, the issue is likely:"
echo "1. Local firewall blocking connections"
echo "2. WiFi AP isolation enabled" 
echo "3. Router firewall settings"
EOF

chmod +x test-external-access.sh

echo -e "${GREEN}📋 Summary${NC}"
echo -e "   Local Access: $([ $LOCAL_IP_OK == true ] && echo '✅ Working' || echo '❌ Failed')"
echo -e "   App Running: $([ $APP_RUNNING == true ] && echo '✅ Yes' || echo '❌ No')"
echo -e "   Ports Bound: $([ $PORT_8080 -gt 0 ] && echo '✅ Correct' || echo '❌ Wrong')"
echo ""
echo -e "${BLUE}📱 Test from another device:${NC}"
echo -e "   http://$LOCAL_IP:8080"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo -e "   1. Run: ./test-external-access.sh"
echo -e "   2. Try the quick fixes above"
echo -e "   3. Check router settings for AP isolation"
echo -e "   4. Test access from another device"
echo ""
echo -e "${GREEN}✨ Network troubleshooting complete!${NC}"