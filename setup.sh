#!/bin/bash

# VPS Setup Script for ERP System (Ubuntu 22.04)
# Usage: sudo bash setup.sh

set -e

echo "Starting VPS Setup..."

# 1. Update System
echo "Updating system..."
apt-get update && apt-get upgrade -y

# 2. Install Dependencies
echo "Installing dependencies..."
apt-get install -y curl git build-essential nginx postgresql postgresql-contrib ufw

# 3. Install Node.js (v20)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 4. Install PM2
echo "Installing PM2..."
npm install -g pm2

# 5. Configure Firewall
echo "Configuring Firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# 6. Setup PostgreSQL
echo "Setting up PostgreSQL..."
# Note: These commands are usually run interactively or via psql
# We'll provide the manual commands in the summary, but here's a basic setup
sudo -u postgres psql -c "CREATE DATABASE cloud_erp_system;" || true
sudo -u postgres psql -c "CREATE USER erp_user WITH PASSWORD 'erp_password';" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cloud_erp_system TO erp_user;" || true

# 7. Configure Nginx
echo "Configuring Nginx..."
cat > /etc/nginx/sites-available/erp-system <<EOF
server {
    listen 80;
    server_name _; # Replace with your domain

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/erp-system /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "VPS Setup Completed Successfully!"
echo "Next steps:"
echo "1. Clone your repository: git clone <your-repo-url> /var/www/erp-system"
echo "2. CD into directory: cd /var/www/erp-system"
echo "3. Install dependencies: npm install"
echo "4. Build frontend: npm run build"
echo "5. Create .env file with your DB credentials"
echo "6. Start application: pm2 start server.ts --interpreter tsx --name erp-system"
echo "7. Save PM2 state: pm2 save && pm2 startup"
