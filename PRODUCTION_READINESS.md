# ERP Production Readiness Checklist

## 1. Data Integrity & Migrations
- [ ] Schema validation passed for all records (`MigrationSafetyChecker.runFullHealthCheck`)
- [ ] No unbalanced journal entries in system (`AccountingEngine.validateGlobalBalance`)
- [ ] Audit logs active for all transactional collections

## 2. Security
- [ ] Role-Based Access Control (RBAC) verified for superadmin/admin/user
- [ ] No sensitive fields exposed in public API objects
- [ ] Session tokens expire correctly

## 3. Performance & Stability
- [ ] Load test passed for 100+ concurrent transactions
- [ ] Accounting Engine processing < 100ms for 10k ledger lines
- [ ] Snapshot/Backup strategy verified

## 4. Disaster Recovery
- [ ] Snapshot retrieval path tested
- [ ] Database rollback process documented and tested

## 5. Development Cycle
- [ ] All Vitest suites passing
- [ ] Build script forces test execution before deploy
- [ ] Linter configured for strict TypeScript safety
