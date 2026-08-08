---
name: deploy
description: Safely build, deploy, and verify the application on the production Hostinger VPS.
---

# Production Deployment Skill

When deploying the application:

1. Inspect the project before deployment.
2. Check git status, branch, and current commit.
3. Build the application.
4. Run available tests and type checks.
5. If build or tests fail, STOP.
6. Check whether database migrations are required.
7. Never reset, drop, truncate, or delete the production database.
8. Deploy the verified application to the connected Hostinger VPS.
9. Restart only the affected application service.
10. Verify that the application is running.
11. Check recent application logs.
12. Run the production health check.

Deployment is successful ONLY when the health check succeeds.

Never claim deployment succeeded without verification.

Never modify Nginx, SSL, DNS, firewall, VPS configuration, or environment variables unless explicitly requested.
# OBRAIN Production Environment

Server:
Hostinger VPS

Hostname:
srv1584967.hstgr.cloud

Project Path:
/var/www/obrain

Deployment:
Docker Compose

Containers:
- obrain-app
- obrain-db
- nginx

Deployment Steps:

1. Verify local build:
   npm run build

2. Run tests:
   npm test

3. Connect to VPS using SSH.

4. Navigate:
   cd /var/www/obrain

5. Pull approved changes.

6. Build containers:
   docker compose build

7. Apply deployment:
   docker compose up -d

8. If database migration exists:
   Run only approved migration process.

9. Verify:
   /api/health

10. Check logs:
   docker compose logs --tail=100

Never:
- docker compose down -v
- delete database volumes
- reset database
- modify Nginx/SSL without approval
When deployment is requested:
1. Verify local build.
2. Commit and push changes.
3. Connect to VPS using SSH.
4. Navigate to ~/omar-v2.
5. Run ./deploy.sh.
6. Verify /api/health.
7. Report deployment status.
