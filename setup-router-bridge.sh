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
