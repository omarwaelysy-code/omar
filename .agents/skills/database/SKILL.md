---
name: database
description: Safely manage database schema changes, migrations, and production data protection.
---

# Database Safety Skill

## Golden Database Rule

Production data must never be destroyed.

All database schema changes must use migrations.

---

## Before Any Database Change

1. Inspect the current schema.
2. Inspect existing migrations.
3. Understand relationships and dependencies.
4. Identify possible data impact.
5. Choose the safest solution.

---

## Never Execute

Never run:

- DROP DATABASE
- DROP TABLE
- TRUNCATE
- DELETE production data without approval
- prisma migrate reset

Never recreate production tables to solve errors.

---

## Migration Rules

Before applying migrations:

1. Review the migration file.
2. Check if it modifies existing data.
3. Check foreign keys.
4. Check nullable constraints.
5. Verify compatibility with current production records.

---

## Production Safety

Never:

- Change existing IDs
- Remove columns containing important data
- Break existing relationships
- Modify production schema manually

Prefer:

- New migrations
- Backward compatible changes
- Safe rollouts

---

## Failed Migration

If migration fails:

STOP.

Do not reset the database.

Analyze:

- Error message
- Current database state
- Previous migrations
- Possible partial changes

Fix safely and verify.

---

## Final Requirement

A database change is successful only after:

- Migration completed
- Application starts
- Existing data is accessible
- No database errors appear in logs# Project Migration System

This project does NOT use Prisma or TypeORM.

Database changes are managed through:

- src/db/migrations/
- migration-runner.ts
- master-migration.sql

Never create Prisma migrations.

Never use Prisma commands.

All schema changes must follow the existing custom migration system.

Before creating a migration:

1. Inspect migration-runner.ts.
2. Check existing migration versions.
3. Create a new numbered SQL migration.
4. Verify compatibility with PostgreSQL 16.
5. Test migration before production deployment.