#!/bin/bash

# ERP System - Automated Production VPS Setup Script
# Target OS: Ubuntu 22.04 / 24.04
# This script installs Docker, Nginx, PostgreSQL, and configures SSL.

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting ERP System Production Setup...${NC}"

# 1. Update System
echo -e "${GREEN}Updating system packages...${NC}"
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Prerequisites
echo -e "${GREEN}Installing prerequisites...${NC}"
sudo apt-get install -y curl git build-essential ufw ca-certificates gnupg lsb-release

# 3. Install Docker
if ! command -v docker &> /dev/null; then
    echo -e "${GREEN}Installing Docker...${NC}"
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable docker
    sudo systemctl start docker
fi

# 4. Configure Firewall
echo -e "${GREEN}Configuring Firewall (UFW)...${NC}"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 5. Setup Project Directory
echo -e "${GREEN}Setting up project directory...${NC}"
PROJECT_DIR="/var/www/erp-system"
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR
cd $PROJECT_DIR

# 6. Ask for Domain and Email
read -p "Enter your domain name (e.g., erp.example.com): " DOMAIN
read -p "Enter your email for SSL alerts: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Domain and Email are required. Exiting."
    exit 1
fi

# 7. Create .env file
echo -e "${GREEN}Creating .env file...${NC}"
cat > .env <<EOF
DB_HOST=erp-db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=$(openssl rand -base64 12)
DB_NAME=cloud_erp_system
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF

# 8. Create Nginx Configuration
mkdir -p nginx
cat > nginx/default.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF

# 9. Create Docker Compose File
cat > docker-compose.yml <<EOF
services:
  erp-db:
    image: postgres:16-alpine
    container_name: erp-postgres
    restart: always
    environment:
      POSTGRES_USER: \${DB_USER}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
      POSTGRES_DB: \${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - erp-network

  erp-app:
    build: .
    container_name: erp-backend
    restart: always
    environment:
      DB_HOST: erp-db
      DB_PORT: 5432
      DB_USER: \${DB_USER}
      DB_PASSWORD: \${DB_PASSWORD}
      DB_NAME: \${DB_NAME}
      JWT_SECRET: \${JWT_SECRET}
      NODE_ENV: production
    depends_on:
      - erp-db
    networks:
      - erp-network

  erp-proxy:
    image: nginx:alpine
    container_name: erp-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - erp-app
    networks:
      - erp-network

  certbot:
    image: certbot/certbot
    container_name: erp-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

networks:
  erp-network:
    driver: bridge

volumes:
  postgres_data:
EOF

# 10. Initial SSL Generation
echo -e "${GREEN}Generating SSL Certificate...${NC}"
# Start nginx temporarily to handle challenge
docker compose up -d erp-proxy

# Run certbot
docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot \
    --email $EMAIL --agree-tos --no-eff-email \
    -d $DOMAIN

# Stop proxy to update config
docker compose stop erp-proxy

# 11. Update Nginx for HTTPS
cat > nginx/default.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://erp-app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 12. Final Launch
echo -e "${GREEN}Launching all services...${NC}"
docker compose up -d --build

echo -e "${BLUE}Setup Completed Successfully!${NC}"
echo -e "Your ERP system is now running at: ${GREEN}https://$DOMAIN${NC}"
echo -e "Database is persistent and SSL will auto-renew."
