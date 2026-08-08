---
name: server-management
description: Safe management rules for Hostinger VPS, Docker, Nginx, SSL, services, logs, and production infrastructure.
---

# Server Management Skill

## Server Identity

The application is running on a production Hostinger VPS.

Server infrastructure is critical.

Any server change can affect production availability.

---

# Golden Server Rule

Never modify production infrastructure unless explicitly required.

Always inspect before changing.

Always understand the current configuration before applying fixes.

---

# VPS Safety Rules

Never execute destructive commands:

- rm -rf on important directories
- docker system prune
- deleting production volumes
- removing services
- reinstalling the server environment
- resetting the VPS

Never change server architecture without approval.

---

# Nginx Rules

Nginx is a critical production component.

Before changing Nginx:

1. Inspect current configuration.
2. Understand existing domains.
3. Check reverse proxy rules.
4. Check SSL configuration.
5. Validate configuration syntax.

Never:

- Replace the entire nginx.conf
- Remove existing server blocks
- Change ports without understanding dependencies

After any Nginx change:

Run configuration validation.

Verify the website is accessible.

---

# SSL Rules

SSL certificates are production critical.

Never:

- Delete certificates
- Change SSL configuration randomly
- Disable HTTPS

Before SSL changes:

Check:

- Current certificate status
- Domain configuration
- Renewal process

---

# Docker Rules

Before Docker changes:

Inspect:

- docker-compose.yml
- Dockerfile
- Running containers
- Volumes
- Networks

Never:

- Delete production volumes
- Remove containers without understanding impact
- Run destructive cleanup commands

After Docker changes verify:

- Containers are running
- Application starts
- Logs are clean

---

# Application Services

Before restarting services:

Identify:

- Service name
- Process manager
- Current status
- Dependencies

Restart only the affected service.

Do not restart the entire VPS unless necessary.

---

# Environment Variables

Environment variables contain sensitive configuration.

Never:

- Delete .env files
- Replace production environment variables
- Expose secrets
- Commit secrets to Git

Before changing environment variables:

Explain:
- What variable changes.
- Why it is required.
- Possible impact.

---

# Logs and Monitoring

When investigating problems:

Check:

- Application logs
- Docker logs
- Nginx logs
- System logs

Do not modify configuration before understanding the error.

---

# Deployment Process

Production deployment follows:

1. Verify code changes.
2. Build successfully.
3. Check migrations.
4. Deploy application.
5. Restart affected service.
6. Check logs.
7. Run health check.

---

# Backup Rules

Before high-risk server operations:

Verify backup availability.

High-risk operations:

- Database migrations
- Docker architecture changes
- Nginx changes
- SSL changes
- Major dependency upgrades

---

# Troubleshooting Order

When the website fails:

Check in this order:

1. Application status.
2. Application logs.
3. Database connection.
4. Docker containers.
5. Nginx configuration.
6. SSL status.
7. Server resources.

Do not change multiple things at once.

---

# Final Report

After any server operation report:

## Operation
What was changed.

## Reason
Why it was needed.

## Impact
Possible affected components.

## Verification
Tests performed.

## Status
SUCCESS or FAILED.