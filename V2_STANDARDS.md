# ERP V2 Engineering Standards

## The Golden Rule
**No code changes are permitted without meeting the following criteria:**
1. **Tests**: Every new feature or fix must include automated tests (Vitest).
2. **Rollback Safety**: Systems must use `TransactionManager` or equivalent to ensure atomic operations that can revert on failure.
3. **Migration Safety**: All data schema changes must be verified against existing records using `MigrationSafetyChecker`.
4. **No Regressions**: The `npm run ci` command must pass before any build or deployment.

## System Architecture (V2 Baseline)
- **Transaction Manager**: Controls all multi-collection writes to prevent partial data states.
- **Accounting Engine**: Centralized logic for double-entry validation (A = L + E).
- **Integrity Dashboard**: Real-time monitoring of data consistency and system health.
- **Migration Checker**: Static and runtime validation of data against Zod schemas.

## Current Version: v2.0.0
- Baseline locked.
- Production readiness checklist implemented.
- CI/CD gating active in build scripts.
