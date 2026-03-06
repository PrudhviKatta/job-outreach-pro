#!/bin/bash
# Oracle Cloud VM Setup Script for Job Outreach Pro
# Run as root or with sudo on Ubuntu 22.04+

set -e

echo "=== Job Outreach Pro - Server Setup ==="

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PostgreSQL 15
apt install -y postgresql postgresql-contrib

# Install nginx
apt install -y nginx

# Install pm2 globally
npm install -g pm2

# Install certbot for SSL
apt install -y certbot python3-certbot-nginx

# Start and enable services
systemctl enable postgresql
systemctl start postgresql
systemctl enable nginx
systemctl start nginx

# Setup PostgreSQL database
echo "=== Setting up PostgreSQL ==="
sudo -u postgres psql -c "CREATE USER joboutreach WITH PASSWORD 'CHANGE_ME_TO_SECURE_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE job_outreach_pro OWNER joboutreach;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE job_outreach_pro TO joboutreach;"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Clone your repo: git clone <your-repo-url> /home/ubuntu/job-outreach-pro"
echo "2. cd /home/ubuntu/job-outreach-pro"
echo "3. npm install"
echo "4. Copy .env.example to .env and fill in values"
echo "5. Update DATABASE_URL in .env: postgresql://joboutreach:YOUR_PASSWORD@localhost:5432/job_outreach_pro"
echo "6. Generate NEXTAUTH_SECRET: openssl rand -base64 32"
echo "7. Generate ENCRYPTION_KEY: openssl rand -hex 32"
echo "8. Run migrations: npx prisma db push"
echo "9. Build: npm run build"
echo "10. Start with pm2: pm2 start deploy/ecosystem.config.js"
echo "11. Copy nginx config: sudo cp deploy/nginx.conf /etc/nginx/sites-available/job-outreach-pro"
echo "12. Enable: sudo ln -s /etc/nginx/sites-available/job-outreach-pro /etc/nginx/sites-enabled/"
echo "13. Remove default: sudo rm /etc/nginx/sites-enabled/default"
echo "14. Test & reload nginx: sudo nginx -t && sudo systemctl reload nginx"
echo "15. (Optional) Setup SSL: sudo certbot --nginx -d yourdomain.com"
echo ""
echo "Don't forget to open ports 80 and 443 in Oracle Cloud security lists!"
