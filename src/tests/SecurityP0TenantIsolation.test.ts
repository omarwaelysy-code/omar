import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/env';
import pool from '../lib/postgres';
import erpRouter from '../lib/erp-api';
import { getAuthenticatedCompanyId, AuthRequest } from '../lib/auth-middleware';
import type { Server } from 'http';

describe('SECURITY P0 — TENANT ISOLATION & ETA CREDENTIAL PROTECTION', () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  const companyAId = 'comp-aaa-111';
  const companyBId = 'comp-bbb-222';

  const tokenCompanyA = jwt.sign(
    { id: 'user-a-1', email: 'admin-a@company-a.com', role: 'admin', company_id: companyAId },
    getJwtSecret()
  );

  const tokenCompanyB = jwt.sign(
    { id: 'user-b-1', email: 'admin-b@company-b.com', role: 'admin', company_id: companyBId },
    getJwtSecret()
  );

  const tokenSuperAdmin = jwt.sign(
    { id: 'super-admin-1', email: 'admin@system.local', role: 'super_admin', is_super_admin: true, company_id: 'SYSTEM' },
    getJwtSecret()
  );

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/erp', erpRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}/api/erp`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    // Default safe mock for licensing / audit logs queries so they do not attempt real DB connection
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('companies')) {
        return {
          rows: [{
            subscription_status: 'ACTIVE',
            company_status: 'ACTIVE',
            subscription_end: '2099-01-01',
            subscription_expiry: '2099-01-01'
          }]
        } as any;
      }
      return { rows: [] } as any;
    });
  });

  // TEST 1: Company A GET Company A record -> 200
  it('TEST 1: Company A GET Company A record returns 200 and data', async () => {
    const recordId = 'cust-a-001';
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      // Single record query
      if (typeof sql === 'string' && sql.includes('FROM "customers"')) {
        expect(params).toEqual([recordId, companyAId]);
        return {
          rows: [{ id: recordId, name: 'Customer A', company_id: companyAId }]
        } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/customers/${recordId}`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(recordId);
    expect(body.company_id).toBe(companyAId);
  });

  // TEST 2: Company A GET Company B record -> 404 (Cross-tenant single record blocked)
  it('TEST 2: Company A GET Company B record returns 404', async () => {
    const recordBId = 'cust-b-999';
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM "customers"')) {
        // Query must be scoped to authenticated companyAId ($2), which returns empty because record belongs to B
        expect(params).toEqual([recordBId, companyAId]);
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/customers/${recordBId}`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(404);
  });

  // TEST 3: Company A: GET /customers?company_id=CompanyB -> query forced to Company A
  it('TEST 3: Company A GET /customers?company_id=CompanyB must NOT query Company B', async () => {
    let capturedCompanyParam: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM "customers"')) {
        capturedCompanyParam = params;
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/customers?company_id=${companyBId}`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(200);
    expect(capturedCompanyParam).toBeDefined();
    // Verify Company A was forced and Company B was discarded
    expect(capturedCompanyParam).toContain(companyAId);
    expect(capturedCompanyParam).not.toContain(companyBId);
  });

  // TEST 4: Company A: GET /invoices?company_id=CompanyB -> query forced to Company A
  it('TEST 4: Company A GET /invoices?company_id=CompanyB must NOT query Company B', async () => {
    let capturedParams: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM "invoices"')) {
        capturedParams = params;
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/invoices?company_id=${companyBId}`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(200);
    expect(capturedParams).toBeDefined();
    expect(capturedParams).toContain(companyAId);
    expect(capturedParams).not.toContain(companyBId);
  });

  // TEST 5: Company A: GET /detailed-journal-entries?company_id=CompanyB -> forced to Company A
  it('TEST 5: Company A GET /detailed-journal-entries?company_id=CompanyB scopes strictly to Company A', async () => {
    let capturedParams: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('count(*)')) {
        return { rows: [{ total: '0' }] } as any;
      }
      if (typeof sql === 'string' && sql.includes('sum(debit)')) {
        return { rows: [{ total_debit: 0, total_credit: 0 }] } as any;
      }
      if (typeof sql === 'string' && sql.includes('journal_entry_lines')) {
        capturedParams = params;
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/detailed-journal-entries?company_id=${companyBId}`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(200);
    expect(capturedParams).toBeDefined();
    // First parameter in detailed-journal-entries is company_id
    expect(capturedParams[0]).toBe(companyAId);
    expect(capturedParams).not.toContain(companyBId);
  });

  // TEST 6: Company A admin: GET /system/backup?company_id=CompanyB -> must NOT export Company B
  it('TEST 6: Company A admin GET /system/backup?company_id=CompanyB exports Company A only', async () => {
    let queriedCompanyIds: string[] = [];
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('WHERE company_id = $1') && params) {
        queriedCompanyIds.push(params[0]);
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/system/backup?company_id=${companyBId}`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.company_id).toBe(companyAId);
    expect(queriedCompanyIds.length).toBeGreaterThan(0);
    expect(queriedCompanyIds.every(id => id === companyAId)).toBe(true);
    expect(queriedCompanyIds).not.toContain(companyBId);
  });

  // TEST 7: Company A admin: GET /system/export-excel?company_id=CompanyB -> exports Company A only
  it('TEST 7: Company A admin GET /system/export-excel?company_id=CompanyB scopes strictly to Company A', async () => {
    let queriedCompanyIds: string[] = [];
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('WHERE company_id = $1') && params) {
        queriedCompanyIds.push(params[0]);
      }
      if (typeof sql === 'string' && sql.includes('companies')) {
        return { rows: [{ id: companyAId, name: 'Company A' }] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/system/export-excel?company_id=${companyBId}`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(200);
    expect(queriedCompanyIds.length).toBeGreaterThan(0);
    expect(queriedCompanyIds.every(id => id === companyAId)).toBe(true);
    expect(queriedCompanyIds).not.toContain(companyBId);
  });

  // TEST 8: Company A admin: DELETE /companies/CompanyB -> 403 Forbidden
  it('TEST 8: Company A admin DELETE /companies/CompanyB is rejected with 403', async () => {
    const res = await fetch(`${baseUrl}/companies/${companyBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Only super_admin can delete a company');
  });

  // TEST 9: Company A: GET /company/eta-settings with x-company-id=CompanyB -> returns Company A settings
  it('TEST 9: Company A GET /company/eta-settings with x-company-id=CompanyB ignores header', async () => {
    let queriedCompanyId: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM eta_settings')) {
        queriedCompanyId = params?.[0];
        return {
          rows: [{
            company_id: companyAId,
            environment: 'preprod',
            client_id: 'client-a',
            client_secret_configured: true,
            operating_key_configured: true
          }]
        } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/company/eta-settings`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'x-company-id': companyBId
      }
    });

    expect(res.status).toBe(200);
    expect(queriedCompanyId).toBe(companyAId);
    const body = await res.json();
    expect(body.company_id).toBe(companyAId);
  });

  // TEST 10: Company A: POST ETA settings with company_id=CompanyB -> must NOT modify Company B
  it('TEST 10: Company A POST ETA settings with company_id=CompanyB strictly targets Company A', async () => {
    let savedCompanyId: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO eta_settings')) {
        // $2 is company_id
        savedCompanyId = params?.[1];
        return {
          rows: [{
            company_id: companyAId,
            environment: 'preprod',
            client_id: 'new-client-a',
            client_secret_configured: true,
            operating_key_configured: false
          }]
        } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/company/eta-settings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'x-company-id': companyBId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        company_id: companyBId,
        client_id: 'new-client-a'
      })
    });

    expect(res.status).toBe(200);
    expect(savedCompanyId).toBe(companyAId);
  });

  // TEST 11: Company A: GET ETA documents with x-company-id=CompanyB -> scopes to Company A
  it('TEST 11: Company A GET /eta/invoices/received with x-company-id=CompanyB scopes to Company A', async () => {
    let searchCompanyId: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM eta_documents')) {
        searchCompanyId = params?.[0];
        return { rows: [{ total_count: 0 }] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/eta/invoices/received`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'x-company-id': companyBId
      }
    });

    expect(res.status).toBe(200);
    expect(searchCompanyId).toBe(companyAId);
  });

  // TEST 12: Company A: GET supplier mapping with x-company-id=CompanyB -> scopes to Company A
  it('TEST 12: Company A GET /eta/suppliers/mapping with x-company-id=CompanyB scopes to Company A', async () => {
    let queriedCompanyId: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && (sql.includes('eta_supplier_mappings') || sql.includes('suppliers'))) {
        queriedCompanyId = params?.[0];
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/eta/suppliers/mapping`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'x-company-id': companyBId
      }
    });

    expect(res.status).toBe(200);
    expect(queriedCompanyId).toBe(companyAId);
  });

  // TEST 13: Company A: GET product/item mapping with x-company-id=CompanyB -> scopes to Company A
  it('TEST 13: Company A GET /eta/items/mapping with x-company-id=CompanyB scopes to Company A', async () => {
    let queriedCompanyId: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && (sql.includes('eta_item_mappings') || sql.includes('products'))) {
        queriedCompanyId = params?.[0];
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/eta/items/mapping`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'x-company-id': companyBId
      }
    });

    expect(res.status).toBe(200);
    expect(queriedCompanyId).toBe(companyAId);
  });

  // TEST 14: Company A: access Company B cheque -> 404
  it('TEST 14: Company A access Company B cheque returns 404', async () => {
    const chequeBId = 'cheque-b-888';
    vi.spyOn(pool, 'connect').mockResolvedValue({
      query: vi.fn().mockImplementation(async (sql: any, params?: any[]) => {
        if (typeof sql === 'string' && sql.includes('FROM issued_cheques')) {
          // Scoped to company_id ($2) which is Company A, returns no rows because cheque belongs to B
          expect(params).toEqual([chequeBId, companyAId]);
          return { rows: [] };
        }
        return { rows: [] };
      }),
      release: vi.fn()
    } as any);

    const res = await fetch(`${baseUrl}/issued-cheques/${chequeBId}/pay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ payment_date: '2026-09-06' })
    });

    expect(res.status).toBe(404);
  });

  // TEST 15: Verify req.user.company_id is NEVER mutated during cheque operations
  it('TEST 15: req.user.company_id is preserved and never mutated during cheque operations', () => {
    const mockReq: AuthRequest = {
      user: {
        id: 'user-a',
        email: 'user-a@company.com',
        role: 'admin',
        company_id: companyAId
      },
      headers: { 'x-company-id': companyBId },
      query: { company_id: companyBId },
      body: { company_id: companyBId }
    } as any;

    const resolved = getAuthenticatedCompanyId(mockReq);
    expect(resolved).toBe(companyAId);
    expect(mockReq.user?.company_id).toBe(companyAId);
  });

  // TEST 16: GET /company/eta-settings response MUST NOT contain plaintext client_secret
  it('TEST 16: GET /company/eta-settings response MUST NOT contain plaintext client_secret', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM eta_settings')) {
        // Verify SQL does NOT select client_secret or operating_key
        expect(sql).not.toContain('client_secret,');
        expect(sql).not.toContain('operating_key,');
        return {
          rows: [{
            company_id: companyAId,
            environment: 'preprod',
            client_id: 'client-id-xyz',
            client_secret_configured: true,
            operating_key_configured: true
          }]
        } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/company/eta-settings`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.client_secret).toBeUndefined();
    expect(body.client_secret_configured).toBe(true);
  });

  // TEST 17: GET /company/eta-settings response MUST NOT contain plaintext operating_key
  it('TEST 17: GET /company/eta-settings response MUST NOT contain plaintext operating_key', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM eta_settings')) {
        return {
          rows: [{
            company_id: companyAId,
            environment: 'preprod',
            client_id: 'client-id-xyz',
            client_secret_configured: true,
            operating_key_configured: true
          }]
        } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/company/eta-settings`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.operating_key).toBeUndefined();
    expect(body.operating_key_configured).toBe(true);
  });

  // TEST 18: Super Admin legitimate cross-company operation remains functional
  it('TEST 18: Super Admin legitimate cross-company operation remains supported', async () => {
    let queriedCompanyId: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM eta_settings')) {
        queriedCompanyId = params?.[0];
        return {
          rows: [{
            company_id: companyBId,
            environment: 'production',
            client_id: 'super-admin-target',
            client_secret_configured: true,
            operating_key_configured: true
          }]
        } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/company/eta-settings`, {
      headers: {
        Authorization: `Bearer ${tokenSuperAdmin}`,
        'x-company-id': companyBId
      }
    });

    expect(res.status).toBe(200);
    expect(queriedCompanyId).toBe(companyBId);
  });

  // =========================================================================
  // MULTI-COMPANY AUTHORIZED SWITCHING TESTS
  // =========================================================================

  const tokenMultiUser = jwt.sign(
    { id: 'user-multi-a', email: 'multi@company.com', role: 'admin', company_id: companyAId },
    getJwtSecret()
  );

  const mockMultiUserMemberships = [
    { id: 'user-multi-a', company_id: companyAId, role: 'admin', permissions: { all: true }, email: 'multi@company.com' },
    { id: 'user-multi-b', company_id: companyBId, role: 'admin', permissions: { all: true }, email: 'multi@company.com' }
  ];

  // TEST 19: User with access to Company A and Company B can switch to Company A
  it('TEST 19: Multi-company user can switch to Company A and reads use Company A', async () => {
    let capturedParams: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE LOWER(email)')) {
        return { rows: mockMultiUserMemberships } as any;
      }
      if (typeof sql === 'string' && sql.includes('FROM "customers"')) {
        capturedParams = params;
        return { rows: [{ id: 'cust-1', name: 'Customer in A', company_id: companyAId }] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/customers`, {
      headers: {
        Authorization: `Bearer ${tokenMultiUser}`,
        'x-company-id': companyAId
      }
    });

    expect(res.status).toBe(200);
    expect(capturedParams).toBeDefined();
    expect(capturedParams).toContain(companyAId);
    expect(capturedParams).not.toContain(companyBId);
  });

  // TEST 20: User with access to Company A and Company B can switch to Company B
  it('TEST 20: Multi-company user can switch to Company B and reads use Company B', async () => {
    let capturedParams: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM users')) {
        return { rows: mockMultiUserMemberships } as any;
      }
      if (typeof sql === 'string' && sql.includes('companies')) {
        return {
          rows: [{
            subscription_status: 'ACTIVE',
            company_status: 'ACTIVE',
            subscription_end: '2099-01-01',
            subscription_expiry: '2099-01-01'
          }]
        } as any;
      }
      if (typeof sql === 'string' && sql.includes('FROM "customers"')) {
        capturedParams = params;
        return { rows: [{ id: 'cust-2', name: 'Customer in B', company_id: companyBId }] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/customers`, {
      headers: {
        Authorization: `Bearer ${tokenMultiUser}`,
        'x-company-id': companyBId
      }
    });

    expect(res.status).toBe(200);
    expect(capturedParams).toBeDefined();
    expect(capturedParams).toContain(companyBId);
    expect(capturedParams).not.toContain(companyAId);
  });

  // TEST 21: User with access ONLY to Company A attempting to select Company B is rejected
  it('TEST 21: User with access only to Company A cannot switch to Company B', async () => {
    let capturedParams: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM users')) {
        // User only has membership for Company A
        return { rows: [{ id: 'user-a-1', company_id: companyAId, role: 'admin' }] } as any;
      }
      if (typeof sql === 'string' && sql.includes('companies')) {
        return {
          rows: [{
            subscription_status: 'ACTIVE',
            company_status: 'ACTIVE',
            subscription_end: '2099-01-01',
            subscription_expiry: '2099-01-01'
          }]
        } as any;
      }
      if (typeof sql === 'string' && sql.includes('FROM "customers"')) {
        capturedParams = params;
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/customers`, {
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'x-company-id': companyBId
      }
    });

    expect(res.status).toBe(200);
    expect(capturedParams).toBeDefined();
    // Unauthorized companyBId was rejected; query forced to Company A
    expect(capturedParams).toContain(companyAId);
    expect(capturedParams).not.toContain(companyBId);
  });

  // TEST 22: User cannot bypass authorization through request body company_id
  it('TEST 22: User cannot inject unauthorized company_id in request body on POST', async () => {
    let capturedInsertParams: any = null;
    vi.spyOn(pool, 'connect').mockResolvedValue({
      query: vi.fn().mockImplementation(async (sql: any, params?: any[]) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO "customers"')) {
          capturedInsertParams = params;
          return { rows: [{ id: 'new-cust', company_id: companyAId }] };
        }
        return { rows: [] };
      }),
      release: vi.fn()
    } as any);

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM users')) {
        return { rows: [{ id: 'user-a-1', company_id: companyAId, role: 'admin' }] } as any;
      }
      if (typeof sql === 'string' && sql.includes('companies')) {
        return {
          rows: [{
            subscription_status: 'ACTIVE',
            company_status: 'ACTIVE',
            subscription_end: '2099-01-01',
            subscription_expiry: '2099-01-01'
          }]
        } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenCompanyA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Evil Customer',
        account_id: 'acc-cust-001',
        company_id: companyBId // Trying to inject into unauthorized company B
      })
    });

    expect(res.status).toBe(201);
    expect(capturedInsertParams).toBeDefined();
    // Verify company_id was forced to companyAId, not companyBId
    expect(capturedInsertParams).toContain(companyAId);
    expect(capturedInsertParams).not.toContain(companyBId);
  });

  // TEST 23: Multi-company user can export backup for Company B
  it('TEST 23: Multi-company user can export backup for authorized Company B', async () => {
    let queriedCompanyIds: string[] = [];
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM users')) {
        return { rows: mockMultiUserMemberships } as any;
      }
      if (typeof sql === 'string' && sql.includes('companies')) {
        return {
          rows: [{
            id: companyBId,
            subscription_status: 'ACTIVE',
            company_status: 'ACTIVE',
            subscription_end: '2099-01-01',
            subscription_expiry: '2099-01-01'
          }]
        } as any;
      }
      if (typeof sql === 'string' && sql.includes('WHERE company_id = $1') && params) {
        queriedCompanyIds.push(params[0]);
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/system/backup?company_id=${companyBId}`, {
      headers: { Authorization: `Bearer ${tokenMultiUser}` }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.company_id).toBe(companyBId);
    expect(queriedCompanyIds.length).toBeGreaterThan(0);
    expect(queriedCompanyIds.every(id => id === companyBId)).toBe(true);
  });

  // TEST 24: Single-company user exporting backup for Company B gets Company A only
  it('TEST 24: Single-company user requesting Company B backup gets Company A only', async () => {
    let queriedCompanyIds: string[] = [];
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM users')) {
        return { rows: [{ id: 'user-a-1', company_id: companyAId, role: 'admin' }] } as any;
      }
      if (typeof sql === 'string' && sql.includes('companies')) {
        return {
          rows: [{
            id: companyAId,
            subscription_status: 'ACTIVE',
            company_status: 'ACTIVE',
            subscription_end: '2099-01-01',
            subscription_expiry: '2099-01-01'
          }]
        } as any;
      }
      if (typeof sql === 'string' && sql.includes('WHERE company_id = $1') && params) {
        queriedCompanyIds.push(params[0]);
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/system/backup?company_id=${companyBId}`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.company_id).toBe(companyAId);
    expect(queriedCompanyIds.every(id => id === companyAId)).toBe(true);
    expect(queriedCompanyIds).not.toContain(companyBId);
  });

  // TEST 25: Multi-company user switched to Company B accesses Company B ETA documents
  it('TEST 25: Multi-company user switched to Company B queries Company B ETA documents', async () => {
    let searchCompanyId: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM users')) {
        return { rows: mockMultiUserMemberships } as any;
      }
      if (typeof sql === 'string' && sql.includes('companies')) {
        return {
          rows: [{
            subscription_status: 'ACTIVE',
            company_status: 'ACTIVE',
            subscription_end: '2099-01-01',
            subscription_expiry: '2099-01-01'
          }]
        } as any;
      }
      if (typeof sql === 'string' && sql.includes('FROM eta_documents')) {
        searchCompanyId = params?.[0];
        return { rows: [{ total_count: 0 }] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/eta/invoices/received`, {
      headers: {
        Authorization: `Bearer ${tokenMultiUser}`,
        'x-company-id': companyBId
      }
    });

    expect(res.status).toBe(200);
    expect(searchCompanyId).toBe(companyBId);
  });

  // TEST 26: Own-email membership query for multi-company user (including super_admin) returns all memberships
  it('TEST 26: Own-email membership query returns all authorized memberships without company scoping', async () => {
    let queriedSql = '';
    let queriedParams: any = null;

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM "users"')) {
        queriedSql = sql;
        queriedParams = params;
        return { rows: mockMultiUserMemberships } as any;
      }
      return { rows: [] } as any;
    });

    // Super-admin user querying their own email to populate company switcher
    const res = await fetch(`${baseUrl}/users?email=multi@company.com`, {
      headers: {
        Authorization: `Bearer ${tokenMultiUser}`
      }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    // Verified that company_id was NOT injected into WHERE clause
    expect(queriedSql).not.toContain('company_id =');
  });

  // TEST 27: Querying another user's email across companies remains restricted / company-scoped
  it('TEST 27: Querying another user email does not bypass company scoping', async () => {
    let queriedSql = '';
    let queriedParams: any = null;

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('FROM "users"')) {
        queriedSql = sql;
        queriedParams = params;
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/users?email=victim@other.com`, {
      headers: {
        Authorization: `Bearer ${tokenMultiUser}`
      }
    });

    expect(res.status).toBe(200);
    // Verified that company_id was enforced
    expect(queriedSql).toContain('"company_id"');
    expect(queriedParams).toContain(companyAId);
  });

  // =========================================================================
  // CRIT-01: PUBLIC REGISTRATION PRIVILEGE ESCALATION TESTS
  // =========================================================================

  // TEST 28: Unauthenticated registration cannot create super_admin
  it('TEST 28: Unauthenticated registration cannot create super_admin (returns 401)', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker-super@evil.com',
        password: 'Password123!',
        company_id: companyAId,
        role: 'super_admin'
      })
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Access denied');
  });

  // TEST 29: Unauthenticated registration cannot create admin
  it('TEST 29: Unauthenticated registration cannot create admin (returns 401)', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker-admin@evil.com',
        password: 'Password123!',
        company_id: companyAId,
        role: 'admin'
      })
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Access denied');
  });

  // TEST 30: Unauthenticated caller cannot assign arbitrary company_id
  it('TEST 30: Unauthenticated caller cannot assign arbitrary company_id (returns 401)', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker-company@evil.com',
        password: 'Password123!',
        company_id: 'arbitrary-company-uuid-999',
        role: 'user'
      })
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Access denied');
  });

  // TEST 31: Unauthenticated caller cannot create a membership in an existing company
  it('TEST 31: Unauthenticated caller cannot create a membership in an existing company (returns 401)', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker-member@evil.com',
        password: 'Password123!',
        company_id: companyAId,
        role: 'user'
      })
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Access denied');
  });

  // TEST 32: Authenticated non-admin user cannot register users (returns 403)
  it('TEST 32: Authenticated regular user cannot register users (returns 403)', async () => {
    const tokenRegularUser = jwt.sign(
      { id: 'user-regular-1', email: 'regular@company-a.com', role: 'user', company_id: companyAId },
      getJwtSecret()
    );

    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenRegularUser}`
      },
      body: JSON.stringify({
        email: 'newuser@company-a.com',
        password: 'Password123!',
        company_id: companyAId,
        role: 'user'
      })
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Access denied');
  });

  // TEST 33: Authenticated admin cannot assign role super_admin (returns 403)
  it('TEST 33: Authenticated admin cannot assign role super_admin (returns 403)', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        email: 'escalation@company-a.com',
        password: 'Password123!',
        company_id: companyAId,
        role: 'super_admin'
      })
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('strictly prohibited');
  });

  // TEST 34: Authenticated admin cannot create user in unauthorized company (returns 403)
  it('TEST 34: Authenticated admin cannot create user in unauthorized company (returns 403)', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        email: 'crosstenant@company-b.com',
        password: 'Password123!',
        company_id: companyBId, // Company A admin trying to add to Company B
        role: 'user'
      })
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('unauthorized company');
  });

  // TEST 35: Legitimate authorized user creation works through the intended workflow
  it('TEST 35: Legitimate authorized user creation works through intended workflow (returns 201)', async () => {
    let insertedUser: any = null;
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string') {
        if (sql.includes('FROM users WHERE LOWER(email) = LOWER($1) AND company_id = $2')) {
          return { rows: [] } as any; // user not in company
        }
        if (sql.includes('FROM users WHERE LOWER(email) = LOWER($1) ORDER BY created_at')) {
          return { rows: [] } as any; // new user overall
        }
        if (sql.includes('INSERT INTO users')) {
          insertedUser = params;
          return { rows: [] } as any;
        }
        if (sql.includes('companies')) {
          return { rows: [{ subscription_status: 'ACTIVE', company_status: 'ACTIVE', subscription_end: '2099-01-01' }] } as any;
        }
      }
      return { rows: [] } as any;
    });

    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        email: 'legit-user@company-a.com',
        password: 'Password123!',
        company_id: companyAId,
        role: 'user'
      })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe('legit-user@company-a.com');
    expect(body.company_id).toBe(companyAId);
    expect(body.role).toBe('user');
    expect(insertedUser).toBeDefined();
    expect(insertedUser[5]).toBe(companyAId); // company_id in INSERT
  });

  // =========================================================================
  // CRIT-02: PUBLIC DEBUG INFORMATION DISCLOSURE TESTS
  // =========================================================================

  // TEST 36: Anonymous GET /api/erp/debug/db-query is denied (returns 401)
  it('TEST 36: Anonymous GET /api/erp/debug/db-query is denied (returns 401)', async () => {
    const res = await fetch(`${baseUrl}/debug/db-query`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Access denied');
    expect(body.companies).toBeUndefined();
    expect(body.returns).toBeUndefined();
    expect(body.journalEntries).toBeUndefined();
  });

  // TEST 37: Anonymous GET /api/erp/debug/latest-error is denied (returns 401)
  it('TEST 37: Anonymous GET /api/erp/debug/latest-error is denied (returns 401)', async () => {
    const res = await fetch(`${baseUrl}/debug/latest-error`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Access denied');
    expect(body.stack).toBeUndefined();
  });

  // TEST 38: Regular company admin / user GET /api/erp/debug/* is denied (returns 403)
  it('TEST 38: Regular company admin GET /api/erp/debug/* is denied (returns 403)', async () => {
    const resQuery = await fetch(`${baseUrl}/debug/db-query`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    expect(resQuery.status).toBe(403);

    const resError = await fetch(`${baseUrl}/debug/latest-error`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    expect(resError.status).toBe(403);
  });

  // TEST 39: Authorized super_admin can access debug endpoints (returns 200)
  it('TEST 39: Authorized super_admin can access debug endpoints (returns 200)', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM companies')) {
        return { rows: [{ id: 'comp-1', name: 'Company 1' }] } as any;
      }
      return { rows: [] } as any;
    });

    const resQuery = await fetch(`${baseUrl}/debug/db-query`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
    });
    expect(resQuery.status).toBe(200);
    const bodyQuery = await resQuery.json();
    expect(bodyQuery.companies).toBeDefined();

    const resError = await fetch(`${baseUrl}/debug/latest-error`, {
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
    });
    expect(resError.status).toBe(200);
  });
});

