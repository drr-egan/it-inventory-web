# Web Deployment Guide for IT Inventory Management App

## Current Status
- **Primary Network IP:** 172.22.210.200
- **Previous Network IP:** 172.22.71.200 (legacy)
- **Public IP:** 4.4.131.194  
- **App Port:** 8080
- **API Ports:** 3000, 3001
- **Current Access:** http://172.22.210.200:8080 (local network)

## Deployment Options

### Option 1: Local Network Access (READY NOW)
Your app is accessible on the local network:
- **Primary URL:** http://172.22.210.200:8080
- **Legacy URL:** http://172.22.71.200:8080 (if still available)
- **Who can access:** Anyone on your local network (172.22.x.x)
- **Security:** Basic network isolation

### Option 2: Internet Access (Requires Network Admin)
To make it accessible from anywhere on the internet:

#### Required Steps:
1. **Firewall Configuration:**
   ```bash
   # Allow ports through firewall (requires admin privileges)
   sudo ufw allow 8080
   sudo ufw allow 3000  
   sudo ufw allow 3001
   ```

2. **Router Port Forwarding:** (Network admin needed)
   - Forward external port 8080 → 172.22.210.200:8080
   - Forward external port 3000 → 172.22.210.200:3000  
   - Forward external port 3001 → 172.22.210.200:3001

3. **Test External Access:**
   ```
   http://4.4.131.194:8080
   ```

### Option 3: Professional Cloud Deployment

#### A. Reverse Proxy with Domain (Recommended)
```bash
# Install nginx
sudo apt update && sudo apt install nginx certbot python3-certbot-nginx

# Configure nginx for your domain
sudo nano /etc/nginx/sites-available/inventory-app
```

Sample nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### B. SSL Certificate Setup
```bash
# Get free SSL certificate
sudo certbot --nginx -d your-domain.com
```

#### C. Cloud Platform Options
1. **DigitalOcean Droplet** ($5/month)
2. **AWS EC2** (Free tier available)
3. **Google Cloud Compute** (Free tier available) 
4. **Linode** ($5/month)
5. **Heroku** (Free tier discontinued, starts at $7/month)

## Security Considerations

### Essential Security Measures:
1. **Authentication System** (Not currently implemented)
2. **HTTPS/SSL** (Required for production)
3. **Rate Limiting** (Prevent abuse)
4. **Input Validation** (Already implemented)
5. **Database Backup** (Recommended)

### Security Script:
```bash
#!/bin/bash
# Basic security hardening script

# Update system
sudo apt update && sudo apt upgrade -y

# Install fail2ban (prevents brute force attacks)
sudo apt install fail2ban -y

# Configure basic firewall
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 8080

# Set up automatic updates
sudo apt install unattended-upgrades -y
```

## Quick Start Instructions

### For Immediate Local Network Access:
1. Share this URL with your team: **http://172.22.71.200:8080**
2. Ensure all users are on the same network
3. Test access from different devices

### For Internet Access:
1. Contact your network administrator
2. Request firewall ports 8080, 3000, 3001 to be opened
3. Request port forwarding configuration
4. Test with: http://4.4.131.194:8080

### For Production Deployment:
1. Purchase a domain name ($10-15/year)
2. Set up cloud server ($5-20/month) 
3. Configure SSL certificate (free with Let's Encrypt)
4. Implement authentication system
5. Set up automated backups

## Monitoring and Maintenance

The app includes built-in health monitoring:
- **Health endpoint:** http://your-url:8080/health/launcher
- **Auto-recovery:** Automatic restart of failed services
- **Logging:** Comprehensive error and access logging

## Cost Breakdown

| Option | Setup Cost | Monthly Cost | Technical Skill Required |
|--------|------------|-------------|-------------------------|
| Local Network | Free | Free | Basic |
| Internet (Current Server) | Free | Free | Network Admin |
| Cloud + Domain | $10-50 | $15-30 | Intermediate |
| Professional Setup | $100-500 | $50-200 | Advanced |

## Recommended Next Steps

1. **Immediate:** Test local network access
2. **Short-term:** Work with network admin for internet access  
3. **Long-term:** Consider cloud deployment with proper security