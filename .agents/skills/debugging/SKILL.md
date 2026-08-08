---
name: debugging
description: Systematic debugging process for fixing application errors without breaking existing features.
---

# Debugging Skill

When an error occurs:

1. Do not immediately change code.
2. Reproduce the issue.
3. Read the complete error message.
4. Identify the root cause.
5. Inspect related:
   - frontend components
   - API endpoints
   - backend logic
   - database schema
   - migrations
   - logs

## Fix Rules

- Apply the smallest safe fix.
- Do not rewrite working modules unnecessarily.
- Do not remove validation to hide errors.
- Do not disable security checks.
- Do not delete data to solve problems.

## Database Errors

If the problem involves the database:

1. Check schema.
2. Check migrations.
3. Check relationships.
4. Verify IDs and foreign keys.
5. Never reset production database.

## After Fix

Always verify:

- Build succeeds.
- API works.
- Database operations work.
- Existing features are not broken.
- Logs are clean.

## Final Report

Explain:

- Root cause.
- Files changed.
- Why the fix works.
- Verification performed.