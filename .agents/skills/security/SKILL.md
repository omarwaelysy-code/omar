---
name: security
description: Security rules for protecting ERP application, authentication, authorization, APIs, secrets, and sensitive production data.
---

# Security Skill

## Security Identity

This is a production ERP system that handles:

- User accounts
- Company data
- Customers
- Invoices
- Inventory
- Financial information
- Business operations

Security must be considered in every change.

---

# Golden Security Rule

Never reduce security to make a feature work.

Never disable authentication, authorization, validation, or protection mechanisms.

Always choose the safest implementation.

---

# Authentication Rules

Before modifying authentication:

Check:

- Login flow
- Session handling
- Token management
- Password security
- User identity verification

Never:

- Remove authentication checks.
- Store passwords in plain text.
- Expose authentication tokens.
- Bypass login requirements.

---

# Authorization Rules

The system contains different user roles.

Always respect:

- User permissions.
- Company access.
- Role restrictions.
- Protected actions.

Never:

- Give users more permissions than required.
- Remove permission checks.
- Trust frontend permissions alone.

Authorization must be verified on the backend.

---

# API Security Rules

Before modifying APIs:

Check:

- Authentication requirements.
- Authorization rules.
- Input validation.
- Error handling.
- Data exposure.

Never:

- Return sensitive data unnecessarily.
- Expose database structure.
- Trust user input directly.
- Remove validation.

---

# Database Security

Never expose:

- Database credentials.
- Connection strings.
- Private keys.
- Secrets.

Never commit:

- .env files.
- API keys.
- Passwords.
- Tokens.

Database queries must:

- Validate inputs.
- Prevent injection risks.
- Use safe query methods.

---

# Environment Variables

Sensitive configuration must remain in environment variables.

Examples:

- Database credentials.
- API keys.
- Authentication secrets.
- Third-party service keys.

Never:

- Hardcode secrets inside source code.
- Print secrets in logs.
- Share secrets in responses.

---

# Frontend Security

The frontend cannot be trusted for security decisions.

Never rely only on:

- Hidden buttons.
- Disabled UI elements.
- Client-side checks.

Important permissions must be enforced by the backend.

---

# Logging Security

Logs must help debugging without exposing sensitive information.

Never log:

- Passwords.
- Tokens.
- API keys.
- Full sensitive customer data.
- Database credentials.

---

# File Upload Security

Before implementing uploads:

Check:

- File type validation.
- File size limits.
- Storage location.
- Access permissions.

Never allow unsafe file execution.

---

# Error Handling

Errors should provide useful information without exposing internal details.

Never expose:

- Database errors directly to users.
- Stack traces in production.
- Server paths.
- Secrets.

---

# Dependency Security

Before adding packages:

Check:

- Package reputation.
- Security impact.
- Compatibility.

Avoid unnecessary dependencies.

---

# Production Security Verification

Before deployment verify:

- Authentication works.
- Permissions work.
- No secrets are exposed.
- No sensitive logs exist.
- APIs validate input.
- Production configuration is safe.

---

# Security Incident Rule

If a security issue is discovered:

STOP.

Explain:

1. The security risk.
2. Affected components.
3. Safe fix.
4. Required verification.

Do not hide security problems.

---

# Final Security Report

After security-related changes report:

## Issue
What security problem was addressed.

## Changes
Files and components modified.

## Risk
Possible impact.

## Verification
Security checks performed.

## Status
SECURE / NEEDS REVIEW.