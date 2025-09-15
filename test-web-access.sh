#!/bin/bash
# Web Access Testing Script for IT Inventory Management App

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌐 Testing Web Access for IT Inventory Management App${NC}"
echo "=================================================="

# Get network information
LOCAL_IP=$(ip addr show | grep -E "inet.*scope global" | head -1 | awk '{print $2}' | cut -d'/' -f1)
PUBLIC_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "Unable to get public IP")

echo -e "${YELLOW}📍 Network Information:${NC}"
echo "   Local IP: $LOCAL_IP"
echo "   Public IP: $PUBLIC_IP"
echo ""

# Test local access
echo -e "${YELLOW}🔍 Testing Local Network Access...${NC}"

# Test main application
echo -n "   Testing main app (port 8080): "
if curl -s -o /dev/null -w "%{http_code}" http://$LOCAL_IP:8080/ --connect-timeout 10 | grep -q "200"; then
    echo -e "${GREEN}✅ SUCCESS${NC}"
    LOCAL_APP_OK=true
else
    echo -e "${RED}❌ FAILED${NC}"
    LOCAL_APP_OK=false
fi

# Test API server
echo -n "   Testing API server (port 3000): "
if curl -s -o /dev/null -w "%{http_code}" http://$LOCAL_IP:3000/ --connect-timeout 10 | grep -q "200"; then
    echo -e "${GREEN}✅ SUCCESS${NC}"
    LOCAL_API_OK=true
else
    echo -e "${RED}❌ FAILED${NC}"
    LOCAL_API_OK=false
fi

# Test health endpoint
echo -n "   Testing health endpoint: "
if curl -s http://$LOCAL_IP:8080/health/launcher --connect-timeout 10 | grep -q "launcher" 2>/dev/null; then
    echo -e "${GREEN}✅ SUCCESS${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

echo ""

# Test external access (if possible)
echo -e "${YELLOW}🌍 Testing External Access...${NC}"
if [[ "$PUBLIC_IP" != "Unable to get public IP" ]]; then
    echo -n "   Testing external app access: "
    if timeout 15 curl -s -o /dev/null -w "%{http_code}" http://$PUBLIC_IP:8080/ --connect-timeout 10 | grep -q "200" 2>/dev/null; then
        echo -e "${GREEN}✅ SUCCESS - Accessible from internet!${NC}"
        EXTERNAL_OK=true
    else
        echo -e "${RED}❌ BLOCKED - Firewall/Router blocking access${NC}"
        EXTERNAL_OK=false
    fi
else
    echo -e "${RED}❌ Cannot determine public IP${NC}"
    EXTERNAL_OK=false
fi

echo ""

# Display access URLs
echo -e "${BLUE}📋 Access Information:${NC}"

if [[ $LOCAL_APP_OK == true ]]; then
    echo -e "${GREEN}✅ Local Network Access:${NC}"
    echo "   🌐 Main Application: http://$LOCAL_IP:8080"
    echo "   📊 Health Monitor: http://$LOCAL_IP:8080/health/launcher"
    echo "   🔧 API Endpoint: http://$LOCAL_IP:3000"
    echo ""
    echo "   👥 Share with team members on same network:"
    echo "      http://$LOCAL_IP:8080"
fi

if [[ $EXTERNAL_OK == true ]]; then
    echo ""
    echo -e "${GREEN}🌍 Internet Access (PUBLIC):${NC}"
    echo "   🌐 Main Application: http://$PUBLIC_IP:8080"
    echo "   ⚠️  WARNING: This is accessible from anywhere on the internet!"
    echo "   🔒 Consider setting up authentication and HTTPS"
fi

echo ""

# Security recommendations
echo -e "${YELLOW}🔒 Security Recommendations:${NC}"

if [[ $EXTERNAL_OK == true ]]; then
    echo "   🚨 URGENT - Your app is publicly accessible!"
    echo "   📝 Recommended actions:"
    echo "      1. Set up firewall rules to restrict access"
    echo "      2. Implement user authentication"
    echo "      3. Enable HTTPS with SSL certificate"
    echo "      4. Monitor access logs regularly"
    echo ""
    echo "   🛠️  Run security setup: bash setup-web-security.sh"
else
    echo "   ✅ App is only accessible on local network (safer)"
    echo "   📝 To make it internet-accessible:"
    echo "      1. Configure router port forwarding (8080 → $LOCAL_IP:8080)"
    echo "      2. Configure firewall rules"
    echo "      3. Run: bash setup-web-security.sh"
fi

echo ""

# Performance test
if [[ $LOCAL_APP_OK == true ]]; then
    echo -e "${YELLOW}⚡ Basic Performance Test...${NC}"
    
    echo -n "   Response time test: "
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" http://$LOCAL_IP:8080/ --connect-timeout 10)
    if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
        echo -e "${GREEN}${RESPONSE_TIME}s - Excellent${NC}"
    elif (( $(echo "$RESPONSE_TIME < 5.0" | bc -l) )); then
        echo -e "${YELLOW}${RESPONSE_TIME}s - Good${NC}"
    else
        echo -e "${RED}${RESPONSE_TIME}s - Slow${NC}"
    fi
    
    # Test API response
    echo -n "   API response test: "
    API_RESPONSE=$(curl -s http://$LOCAL_IP:3000/ --connect-timeout 10)
    if echo "$API_RESPONSE" | grep -q "healthy" 2>/dev/null; then
        echo -e "${GREEN}✅ API responding correctly${NC}"
    else
        echo -e "${RED}❌ API response issue${NC}"
    fi
fi

echo ""

# Next steps
echo -e "${BLUE}🚀 Next Steps:${NC}"

if [[ $LOCAL_APP_OK == true ]]; then
    echo "1. ✅ Your app is ready for local network use"
    echo "2. 📱 Test from other devices on your network: http://$LOCAL_IP:8080"
    echo "3. 👥 Share the URL with your team members"
    
    if [[ $EXTERNAL_OK != true ]]; then
        echo "4. 🌍 For internet access, contact your network administrator"
        echo "5. 🔧 Or run the security setup script: bash setup-web-security.sh"
    fi
    
    echo "6. 📊 Monitor the app: ./monitor-app.sh"
    echo "7. 💾 Set up backups: ./backup-database.sh"
else
    echo "1. ❌ App is not accessible - check if it's running"
    echo "2. 🔧 Restart the app: python3 start-app.py"
    echo "3. 📋 Check status: ./monitor-app.sh"
fi

echo ""
echo -e "${GREEN}✨ Testing complete!${NC}"