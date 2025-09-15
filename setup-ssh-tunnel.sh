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
