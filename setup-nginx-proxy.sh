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
