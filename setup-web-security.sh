#!/bin/bash
# IT Inventory Management App - Web Security Setup Script
# Run as: bash setup-web-security.sh

set -e  # Exit on any error

echo "🔒 Setting up web security for IT Inventory Management App..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   echo "Please run as regular user with sudo privileges"
   exit 1
fi

# Update system packages
echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Install required packages
echo -e "${YELLOW}📦 Installing security packages...${NC}"
sudo apt install -y nginx certbot python3-certbot-nginx ufw fail2ban htop curl wget

# Configure firewall
echo -e "${YELLOW}🛡️  Configuring firewall...${NC}"
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Configure fail2ban
echo -e "${YELLOW}🔐 Configuring fail2ban...${NC}"
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true

[nginx-noproxy]
enabled = true

[nginx-noscript]
enabled = true

[nginx-badbots]
enabled = true
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban

# Set up nginx configuration
echo -e "${YELLOW}🌐 Setting up nginx configuration...${NC}"
sudo cp nginx-config.conf /etc/nginx/sites-available/inventory-app

# Prompt for domain name
read -p "Enter your domain name (or press Enter to skip): " DOMAIN_NAME

if [[ -n "$DOMAIN_NAME" ]]; then
    # Replace placeholder domain in config
    sudo sed -i "s/your-domain.com/$DOMAIN_NAME/g" /etc/nginx/sites-available/inventory-app
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/inventory-app /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    sudo nginx -t && sudo systemctl reload nginx
    
    echo -e "${GREEN}✅ Nginx configured for domain: $DOMAIN_NAME${NC}"
    
    # Offer SSL setup
    read -p "Set up SSL certificate with Let's Encrypt? (y/n): " SETUP_SSL
    
    if [[ $SETUP_SSL =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🔒 Setting up SSL certificate...${NC}"
        sudo certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos --email webmaster@${DOMAIN_NAME}
        
        # Set up automatic renewal
        echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo tee -a /etc/crontab > /dev/null
        
        echo -e "${GREEN}✅ SSL certificate installed and auto-renewal configured${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping nginx configuration. You can set up domain later.${NC}"
fi

# Create backup script
echo -e "${YELLOW}💾 Creating backup script...${NC}"
tee backup-database.sh > /dev/null <<'EOF'
#!/bin/bash
# Database backup script for IT Inventory Management App

BACKUP_DIR="$HOME/inventory-backups"
DATE=$(date +"%Y%m%d_%H%M%S")
DATABASE_FILE="inventory.db"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup with timestamp
if [[ -f "$DATABASE_FILE" ]]; then
    cp "$DATABASE_FILE" "$BACKUP_DIR/inventory_backup_$DATE.db"
    echo "✅ Database backed up to: $BACKUP_DIR/inventory_backup_$DATE.db"
    
    # Keep only last 30 backups
    cd "$BACKUP_DIR"
    ls -t inventory_backup_*.db | tail -n +31 | xargs rm -f 2>/dev/null
    
    echo "📊 Current backups: $(ls inventory_backup_*.db | wc -l)"
else
    echo "❌ Database file not found: $DATABASE_FILE"
fi
EOF

chmod +x backup-database.sh

# Set up automatic backups
echo "0 2 * * * $(pwd)/backup-database.sh" | crontab -

# Create monitoring script
echo -e "${YELLOW}📊 Creating monitoring script...${NC}"
tee monitor-app.sh > /dev/null <<'EOF'
#!/bin/bash
# Application monitoring script

echo "🏥 IT Inventory Management App - System Status"
echo "=============================================="

# Check if app is running
if pgrep -f "start-app.py" > /dev/null; then
    echo "✅ Application: Running"
else
    echo "❌ Application: Not running"
fi

# Check ports
echo ""
echo "📡 Port Status:"
netstat -tlnp 2>/dev/null | grep -E ":(8080|3000|3001)" | while read line; do
    echo "  $line"
done

# Check system resources
echo ""
echo "💻 System Resources:"
echo "  CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)% used"
echo "  Memory: $(free | grep Mem | awk '{printf("%.1f%%"), $3/$2 * 100.0}')"
echo "  Disk: $(df -h / | awk 'NR==2{printf "%s used", $5}')"

# Check database size
if [[ -f "inventory.db" ]]; then
    DB_SIZE=$(du -h inventory.db | cut -f1)
    echo "  Database: $DB_SIZE"
fi

# Check recent errors
echo ""
echo "🚨 Recent Errors (last 10):"
if [[ -f "/tmp/launcher.log" ]]; then
    tail -n 100 /tmp/launcher.log | grep -i error | tail -n 10 || echo "  No recent errors"
else
    echo "  No error log found"
fi

# Check nginx status (if installed)
if command -v nginx &> /dev/null; then
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx: Running"
    else
        echo "❌ Nginx: Not running"
    fi
fi
EOF

chmod +x monitor-app.sh

# Create systemd service file for auto-start
echo -e "${YELLOW}⚙️  Creating systemd service...${NC}"
sudo tee /etc/systemd/system/inventory-app.service > /dev/null <<EOF
[Unit]
Description=IT Inventory Management Application
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/python3 $(pwd)/start-app.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable inventory-app.service

# Final security recommendations
echo -e "${GREEN}🎉 Web security setup complete!${NC}"
echo ""
echo "📋 Summary of changes made:"
echo "  ✅ Firewall configured (UFW)"
echo "  ✅ Fail2ban installed for intrusion prevention"
echo "  ✅ Nginx installed and configured"
echo "  ✅ Automatic database backups enabled"
echo "  ✅ System monitoring script created"
echo "  ✅ Systemd service created for auto-start"

if [[ -n "$DOMAIN_NAME" ]]; then
    echo "  ✅ Domain configured: $DOMAIN_NAME"
    if [[ $SETUP_SSL =~ ^[Yy]$ ]]; then
        echo "  ✅ SSL certificate installed"
        echo ""
        echo "🌐 Your app is now accessible at: https://$DOMAIN_NAME"
    else
        echo ""
        echo "🌐 Your app is accessible at: http://$DOMAIN_NAME"
    fi
fi

echo ""
echo "📝 Next steps:"
echo "  1. Test your deployment with: ./monitor-app.sh"
echo "  2. Check logs with: sudo journalctl -u inventory-app -f"
echo "  3. Restart app service: sudo systemctl restart inventory-app"
echo "  4. View nginx logs: sudo tail -f /var/log/nginx/inventory-app-*.log"
echo "  5. Run backups manually: ./backup-database.sh"
echo ""
echo "🔒 Security recommendations:"
echo "  - Change default passwords if any"
echo "  - Monitor logs regularly" 
echo "  - Keep system updated"
echo "  - Consider implementing user authentication"
echo "  - Set up monitoring alerts"
EOF

chmod +x setup-web-security.sh