import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/env';
import pool from '../lib/postgres';
import erpRouter, { logAudit, _resetLoginRateLimits } from '../lib/erp-api';
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

  const tokenRegularUserA = jwt.sign(
    { id: 'user-regular-a', email: 'regular-a@company-a.com', role: 'user', company_id: companyAId },
    getJwtSecret()
  );

  const tokenMultiCompanyAdmin = jwt.sign(
    { id: 'user-multi-admin', email: 'multi@company-a.com', role: 'admin', company_id: companyAId, authorized_company_ids: [companyAId, companyBId] },
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
    const defaultMockClient = {
      query: vi.fn().mockImplementation(async (sql: any, params?: any[]) => {
        return { rows: [] };
      }),
      release: vi.fn()
    };
    vi.spyOn(pool, 'connect').mockResolvedValue(defaultMockClient as any);

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

  // TEST 16: GET /company/eta-settings response returns own company credentials
  it('TEST 16: GET /company/eta-settings response returns own company client_secret', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM eta_settings')) {
        return {
          rows: [{
            company_id: companyAId,
            environment: 'preprod',
            client_id: 'client-id-xyz',
            client_secret: 'secret-a-xyz',
            operating_key: 'op-key-a-xyz',
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
    expect(body.client_secret).toBe('secret-a-xyz');
    expect(body.client_secret_configured).toBe(true);
  });

  // TEST 17: GET /company/eta-settings response returns own company operating_key
  it('TEST 17: GET /company/eta-settings response returns own company operating_key', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM eta_settings')) {
        return {
          rows: [{
            company_id: companyAId,
            environment: 'preprod',
            client_id: 'client-id-xyz',
            client_secret: 'secret-a-xyz',
            operating_key: 'op-key-a-xyz',
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
    expect(body.operating_key).toBe('op-key-a-xyz');
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

  // ==========================================
  // PHASE 1B TESTS — HIGH-01 & HIGH-02
  // ==========================================

  // TEST 40: password_hash never appears in user GET/list responses (HIGH-01)
  it('TEST 40: password_hash never appears in user GET/list responses', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM "users"')) {
        return {
          rows: [
            { id: 'user-1', name: 'User 1', email: 'u1@company-a.com', password_hash: '$2a$10$xyzSecretHash111', company_id: companyAId },
            { id: 'user-2', name: 'User 2', email: 'u2@company-a.com', password_hash: '$2a$10$xyzSecretHash222', company_id: companyAId }
          ]
        } as any;
      }
      return { rows: [] } as any;
    });

    // List endpoint
    const resList = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    expect(resList.status).toBe(200);
    const users = await resList.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBe(2);
    users.forEach((u: any) => {
      expect(u.password_hash).toBeUndefined();
      expect(JSON.stringify(u)).not.toContain('xyzSecretHash');
    });

    // Single record endpoint
    const resSingle = await fetch(`${baseUrl}/users/user-1`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    expect(resSingle.status).toBe(200);
    const singleUser = await resSingle.json();
    expect(singleUser.password_hash).toBeUndefined();
    expect(JSON.stringify(singleUser)).not.toContain('xyzSecretHash');
  });

  // TEST 41: temp_password never appears in generic user GET/list responses (HIGH-01)
  it('TEST 41: temp_password never appears in generic user GET/list responses', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM "users"')) {
        return {
          rows: [
            { id: 'user-1', name: 'User 1', email: 'u1@company-a.com', temp_password: 'TempPassword@123', company_id: companyAId }
          ]
        } as any;
      }
      return { rows: [] } as any;
    });

    const resList = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    expect(resList.status).toBe(200);
    const users = await resList.json();
    expect(users[0].temp_password).toBeUndefined();
    expect(JSON.stringify(users)).not.toContain('TempPassword@123');

    const resSingle = await fetch(`${baseUrl}/users/user-1`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    expect(resSingle.status).toBe(200);
    const single = await resSingle.json();
    expect(single.temp_password).toBeUndefined();
    expect(JSON.stringify(single)).not.toContain('TempPassword@123');
  });

  // TEST 42: User create response does not leak credential fields (HIGH-01)
  it('TEST 42: User create response does not leak credential fields', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: any) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO "users"')) {
          return {
            rows: [{
              id: 'new-user-123',
              name: 'New Worker',
              username: 'worker1',
              email: 'worker1@company-a.com',
              role: 'user',
              company_id: companyAId,
              password_hash: '$2a$10$hashedPassWorker',
              temp_password: 'WorkerTempPass!456'
            }]
          };
        }
        return { rows: [] };
      }),
      release: vi.fn()
    };
    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as any);

    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCompanyA}`
      },
      body: JSON.stringify({
        name: 'New Worker',
        username: 'worker1',
        email: 'worker1@company-a.com',
        password: 'PlainTextPassword!123',
        role: 'user'
      })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('new-user-123');
    expect(body.password_hash).toBeUndefined();
    expect(body.temp_password).toBeUndefined();
    expect(body.password).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('hashedPassWorker');
    expect(JSON.stringify(body)).not.toContain('WorkerTempPass');
    expect(JSON.stringify(body)).not.toContain('PlainTextPassword');
  });

  // TEST 43: Backup and Excel export do not contain credential fields (HIGH-01)
  it('TEST 43: Backup and export-excel do not contain credential fields', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('FROM users')) {
        return {
          rows: [{
            id: 'u-bkp-1',
            email: 'bkp@company-a.com',
            password_hash: '$2a$10$LeakedBackupHash999',
            temp_password: 'LeakedTempPass999',
            company_id: companyAId
          }]
        } as any;
      }
      return { rows: [] } as any;
    });

    const resBackup = await fetch(`${baseUrl}/system/backup`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    expect(resBackup.status).toBe(200);
    const backupJson = await resBackup.json();
    expect(backupJson.data.users).toBeDefined();
    const userRow = backupJson.data.users[0];
    expect(userRow.password_hash).toBeUndefined();
    expect(userRow.temp_password).toBeUndefined();
    expect(JSON.stringify(backupJson)).not.toContain('LeakedBackupHash999');
    expect(JSON.stringify(backupJson)).not.toContain('LeakedTempPass999');

    const resExcel = await fetch(`${baseUrl}/system/export-excel`, {
      headers: { Authorization: `Bearer ${tokenCompanyA}` }
    });
    expect(resExcel.status).toBe(200);
    const excelBuffer = await resExcel.arrayBuffer();
    const excelText = Buffer.from(excelBuffer).toString('latin1');
    expect(excelText).not.toContain('LeakedBackupHash999');
    expect(excelText).not.toContain('LeakedTempPass999');
  });

  // TEST 44: Audit metadata recursively strips credentials (HIGH-01)
  it('TEST 44: Audit metadata recursively strips credentials', async () => {
    let capturedAuditSql = '';
    let capturedAuditParams: any[] | null = null;

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO audit_logs')) {
        capturedAuditSql = sql;
        capturedAuditParams = params || [];
      }
      return { rows: [] } as any;
    });

    const sensitiveMetadata = {
      operation: 'UPDATE_INTEGRATION_SETTINGS',
      non_sensitive_field: 'public_config_value',
      user_name: 'admin_user',
      password: 'TopLevelSecretPassword123!',
      password_hash: '$2b$10$TopLevelHash456',
      temp_password: 'TopLevelTempPass789',
      token: 'top-level-jwt-token-abc',
      secret: 'top-level-app-secret-xyz',
      client_secret: 'top-level-oauth-secret',
      operating_key: 'top-level-operating-key-999',
      nested_service: {
        provider: 'payment_gateway',
        status: 'active',
        password: 'NestedSecretPassword!',
        password_hash: '$2b$10$NestedHash123',
        temp_password: 'NestedTempPass!',
        token: 'nested-bearer-token',
        secret: 'nested-private-secret',
        client_secret: 'nested-client-secret-val',
        operating_key: 'nested-op-key-val',
        deep_devices: [
          {
            device_id: 'dev-001',
            device_name: 'POS Terminal 1',
            secret: 'DeviceSecretKeyVal',
            token: 'DeviceTokenVal',
            password_hash: 'DeviceHashVal'
          }
        ]
      }
    };

    // Invoke existing audit logging path with nested sensitive values
    await logAudit({
      company_id: companyAId,
      user_id: 'user-a-1',
      username: 'admin_user',
      user_email: 'admin-a@company-a.com',
      action: 'UPDATE',
      module: 'SETTINGS',
      details: 'Updated integration settings',
      entity_type: 'settings',
      entity_id: 'int-001',
      metadata: sensitiveMetadata
    });

    expect(capturedAuditParams).not.toBeNull();
    expect(capturedAuditSql).toContain('INSERT INTO audit_logs');

    const serializedParams = JSON.stringify(capturedAuditParams);

    // 1. Verify sensitive keys are absent recursively in stored metadata
    const storedMeta = JSON.parse(capturedAuditParams![10]);
    expect(storedMeta.password).toBeUndefined();
    expect(storedMeta.password_hash).toBeUndefined();
    expect(storedMeta.temp_password).toBeUndefined();
    expect(storedMeta.token).toBeUndefined();
    expect(storedMeta.secret).toBeUndefined();
    expect(storedMeta.client_secret).toBeUndefined();
    expect(storedMeta.operating_key).toBeUndefined();

    // Nested object checks
    expect(storedMeta.nested_service.password).toBeUndefined();
    expect(storedMeta.nested_service.password_hash).toBeUndefined();
    expect(storedMeta.nested_service.temp_password).toBeUndefined();
    expect(storedMeta.nested_service.token).toBeUndefined();
    expect(storedMeta.nested_service.secret).toBeUndefined();
    expect(storedMeta.nested_service.client_secret).toBeUndefined();
    expect(storedMeta.nested_service.operating_key).toBeUndefined();

    // Nested array object checks
    expect(storedMeta.nested_service.deep_devices[0].secret).toBeUndefined();
    expect(storedMeta.nested_service.deep_devices[0].token).toBeUndefined();
    expect(storedMeta.nested_service.deep_devices[0].password_hash).toBeUndefined();

    // 2. Verify actual secret values are absent from the entire audit log payload
    const forbiddenValues = [
      'TopLevelSecretPassword123!',
      '$2b$10$TopLevelHash456',
      'TopLevelTempPass789',
      'top-level-jwt-token-abc',
      'top-level-app-secret-xyz',
      'top-level-oauth-secret',
      'top-level-operating-key-999',
      'NestedSecretPassword!',
      '$2b$10$NestedHash123',
      'NestedTempPass!',
      'nested-bearer-token',
      'nested-private-secret',
      'nested-client-secret-val',
      'nested-op-key-val',
      'DeviceSecretKeyVal',
      'DeviceTokenVal',
      'DeviceHashVal'
    ];
    for (const secretVal of forbiddenValues) {
      expect(serializedParams).not.toContain(secretVal);
    }

    // 3. Verify non-sensitive audit information remains present in metadata and new_values
    expect(storedMeta.operation).toBe('UPDATE_INTEGRATION_SETTINGS');
    expect(storedMeta.non_sensitive_field).toBe('public_config_value');
    expect(storedMeta.user_name).toBe('admin_user');
    expect(storedMeta.nested_service.provider).toBe('payment_gateway');
    expect(storedMeta.nested_service.status).toBe('active');
    expect(storedMeta.nested_service.deep_devices[0].device_id).toBe('dev-001');
    expect(storedMeta.nested_service.deep_devices[0].device_name).toBe('POS Terminal 1');
    expect(capturedAuditParams![6]).toBe('Updated integration settings');

    // 4. Verify old_values and new_values are also sanitized
    const storedOldValues = JSON.parse(capturedAuditParams![17]);
    const storedNewValues = JSON.parse(capturedAuditParams![18]);
    expect(storedNewValues.password).toBeUndefined();
    expect(storedNewValues.password_hash).toBeUndefined();
    expect(storedNewValues.temp_password).toBeUndefined();
    expect(storedNewValues.token).toBeUndefined();
    expect(storedNewValues.secret).toBeUndefined();
    expect(storedNewValues.nested_service?.password).toBeUndefined();
    expect(storedNewValues.nested_service?.deep_devices?.[0]?.secret).toBeUndefined();
    expect(storedNewValues.operation).toBe('UPDATE_INTEGRATION_SETTINGS');
    expect(storedNewValues.non_sensitive_field).toBe('public_config_value');
  });

  // TEST 45: Regular user cannot modify role/permissions/role_ids/company_id (HIGH-02)
  it('TEST 45: Regular user cannot modify privileged fields or other users', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('SELECT id, company_id, role FROM users WHERE id = $1')) {
        const id = params?.[0];
        if (id === 'user-regular-a') {
          return { rows: [{ id: 'user-regular-a', company_id: companyAId, role: 'user' }] } as any;
        }
        if (id === 'user-other') {
          return { rows: [{ id: 'user-other', company_id: companyAId, role: 'user' }] } as any;
        }
      }
      if (typeof sql === 'string' && sql.includes('UPDATE "users"')) {
        return { rowCount: 1, rows: [] } as any;
      }
      if (typeof sql === 'string' && sql.includes('information_schema.columns')) {
        return { rows: [{ '?column?': 1 }] } as any;
      }
      return { rows: [] } as any;
    });

    // 1. Regular user trying to modify another user -> 403
    const resOther = await fetch(`${baseUrl}/users/user-other`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({ name: 'Hacked Name' })
    });
    expect(resOther.status).toBe(403);

    // 2. Regular user trying to escalate self to admin -> 403
    const resRole = await fetch(`${baseUrl}/users/user-regular-a`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({ role: 'admin' })
    });
    expect(resRole.status).toBe(403);

    // 3. Regular user trying to modify permissions -> 403
    const resPerms = await fetch(`${baseUrl}/users/user-regular-a`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({ permissions: { invoices: { view: true, create: true } } })
    });
    expect(resPerms.status).toBe(403);

    // 4. Regular user trying to modify role_ids -> 403
    const resRoleIds = await fetch(`${baseUrl}/users/user-regular-a`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({ role_ids: ['some-role-id'] })
    });
    expect(resRoleIds.status).toBe(403);

    // 5. Regular user trying to modify company_id -> 403
    const resComp = await fetch(`${baseUrl}/users/user-regular-a`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({ company_id: companyBId })
    });
    expect(resComp.status).toBe(403);

    // 6. Regular user legitimate self-service profile update -> 200
    const resValidSelf = await fetch(`${baseUrl}/users/user-regular-a`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({ name: 'Updated Regular Name', mobile: '01012345678' })
    });
    expect(resValidSelf.status).toBe(200);
  });

  // TEST 46: Company admin cannot escalate a user to super_admin (HIGH-02)
  it('TEST 46: Company admin cannot escalate a user to super_admin', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any) => {
      if (typeof sql === 'string' && sql.includes('SELECT id, company_id, role FROM users WHERE id = $1')) {
        return { rows: [{ id: 'user-a-2', company_id: companyAId, role: 'user' }] } as any;
      }
      return { rows: [] } as any;
    });

    // Escalation via POST
    const resPost = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCompanyA}` },
      body: JSON.stringify({
        name: 'Evil Admin',
        username: 'eviladmin',
        email: 'evil@company-a.com',
        role: 'super_admin'
      })
    });
    expect(resPost.status).toBe(403);

    // Escalation via PUT
    const resPut = await fetch(`${baseUrl}/users/user-a-2`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCompanyA}` },
      body: JSON.stringify({ role: 'super_admin' })
    });
    expect(resPut.status).toBe(403);
  });

  // TEST 47: Company admin cannot move a user to an unauthorized company (HIGH-02)
  it('TEST 47: Company admin cannot move a user to an unauthorized company', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('SELECT id, company_id, role FROM users WHERE id = $1')) {
        const id = params?.[0];
        if (id === 'user-a-2') {
          return { rows: [{ id: 'user-a-2', company_id: companyAId, role: 'user' }] } as any;
        }
        if (id === 'user-b-1') {
          return { rows: [{ id: 'user-b-1', company_id: companyBId, role: 'user' }] } as any;
        }
      }
      return { rows: [] } as any;
    });

    // 1. Moving user from companyA to companyB (unauthorized for Company Admin A)
    const resMove = await fetch(`${baseUrl}/users/user-a-2`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCompanyA}` },
      body: JSON.stringify({ company_id: companyBId })
    });
    expect(resMove.status).toBe(403);

    // 2. Modifying user belonging to companyB
    const resModOtherTenantUser = await fetch(`${baseUrl}/users/user-b-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCompanyA}` },
      body: JSON.stringify({ name: 'Tampered' })
    });
    expect(resModOtherTenantUser.status).toBe(403);

    // 3. Creating user in unauthorized company
    const resCreateUnauthorizedComp = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCompanyA}` },
      body: JSON.stringify({
        name: 'Cross Tenant User',
        username: 'crosstenant',
        email: 'cross@company-b.com',
        company_id: companyBId
      })
    });
    expect(resCreateUnauthorizedComp.status).toBe(403);
  });

  // TEST 48: Super admin's legitimate user-management workflow still works (HIGH-02)
  it('TEST 48: Super admin legitimate user-management workflow works', async () => {
    const mockClient = {
      query: vi.fn().mockImplementation(async (sql: any) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO "users"')) {
          return {
            rows: [{ id: 'new-co-admin', name: 'Company Admin Created', company_id: companyAId, role: 'admin' }]
          };
        }
        return { rows: [] };
      }),
      release: vi.fn()
    };
    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as any);

    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('SELECT id, company_id, role FROM users WHERE id = $1')) {
        return { rows: [{ id: 'target-user-1', company_id: companyAId, role: 'user' }] } as any;
      }
      if (typeof sql === 'string' && sql.includes('UPDATE "users"')) {
        return { rowCount: 1, rows: [] } as any;
      }
      if (typeof sql === 'string' && sql.includes('information_schema.columns')) {
        return { rows: [{ '?column?': 1 }] } as any;
      }
      return { rows: [] } as any;
    });

    // Super admin creates user with temporary password provisioning
    const resCreate = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
      body: JSON.stringify({
        name: 'New Company Admin',
        username: 'newcoadmin',
        email: 'admin@company-a.com',
        role: 'admin',
        company_id: companyAId,
        temp_password: 'TempAdminPass@123'
      })
    });
    expect(resCreate.status).toBe(201);
    const bodyCreate = await resCreate.json();
    expect(bodyCreate.password_hash).toBeUndefined();
    expect(bodyCreate.temp_password).toBeUndefined();
    expect(JSON.stringify(bodyCreate)).not.toContain('TempAdminPass@123');

    // Super admin updates user with new temporary password provisioning
    const resUpdate = await fetch(`${baseUrl}/users/target-user-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
      body: JSON.stringify({
        status: 'inactive',
        company_id: companyBId,
        temp_password: 'NewSuperTemp@456'
      })
    });
    expect(resUpdate.status).toBe(200);
    const bodyUpdate = await resUpdate.json();
    expect(bodyUpdate.password_hash).toBeUndefined();
    expect(bodyUpdate.temp_password).toBeUndefined();
    expect(JSON.stringify(bodyUpdate)).not.toContain('NewSuperTemp@456');
  });

  // TEST 49: Company Switcher remains functional and unauthorized switching remains blocked (Regression)
  it('TEST 49: Company Switcher remains functional and unauthorized switching is blocked', async () => {
    vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
      // 1. Membership query by email
      if (typeof sql === 'string' && sql.includes('FROM "users"') && sql.includes('email')) {
        return {
          rows: [
            { id: 'u-mem-1', email: 'multi@company-a.com', company_id: companyAId, role: 'admin' },
            { id: 'u-mem-2', email: 'multi@company-a.com', company_id: companyBId, role: 'admin' }
          ]
        } as any;
      }
      // 2. Data queries for company A or B
      if (typeof sql === 'string' && sql.includes('FROM "customers"')) {
        return {
          rows: [{ id: 'cust-1', name: 'Customer', company_id: params?.[0] || companyAId }]
        } as any;
      }
      return { rows: [] } as any;
    });

    // 1. Discovery query for memberships
    const resDiscovery = await fetch(`${baseUrl}/users?email=multi@company-a.com`, {
      headers: { Authorization: `Bearer ${tokenMultiCompanyAdmin}` }
    });
    expect(resDiscovery.status).toBe(200);
    const memberships = await resDiscovery.json();
    expect(memberships.length).toBe(2);
    expect(memberships[0].password_hash).toBeUndefined();
    expect(memberships[1].password_hash).toBeUndefined();

    // 2. Switch to authorized company B
    const resSwitchAuthorized = await fetch(`${baseUrl}/customers`, {
      headers: {
        Authorization: `Bearer ${tokenMultiCompanyAdmin}`,
        'x-company-id': companyBId
      }
    });
    expect(resSwitchAuthorized.status).toBe(200);

    // 3. Switch to unauthorized company -> falls back to primary authorized company
    const resSwitchUnauthorized = await fetch(`${baseUrl}/customers`, {
      headers: {
        Authorization: `Bearer ${tokenMultiCompanyAdmin}`,
        'x-company-id': 'unauthorized-comp-999'
      }
    });
    expect(resSwitchUnauthorized.status).toBe(200);
  });

  // TEST 50: Normal user cannot use users:create to escalate privileges (HIGH-02)
  it('TEST 50: Normal user cannot use users:create to escalate privileges', async () => {
    // 1. Normal user cannot create an admin user
    const resAdminRole = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({
        name: 'Escalated Admin',
        email: 'esc_admin@company-a.com',
        role: 'admin',
        password: 'Password123'
      })
    });
    expect(resAdminRole.status).toBe(403);

    // 2. Normal user cannot create a super_admin user
    const resSuperAdminRole = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({
        name: 'Escalated Super',
        email: 'esc_super@company-a.com',
        role: 'super_admin',
        password: 'Password123'
      })
    });
    expect(resSuperAdminRole.status).toBe(403);

    // 3. Normal user cannot create user in another company
    const resOtherComp = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({
        name: 'Escalated Comp',
        email: 'esc_comp@company-b.com',
        company_id: companyBId,
        password: 'Password123'
      })
    });
    expect(resOtherComp.status).toBe(403);

    // 4. Normal user cannot assign custom permissions
    const resCustomPerms = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({
        name: 'Escalated Perms',
        email: 'esc_perms@company-a.com',
        permissions: { invoices: { view: true, create: true, delete: true } },
        password: 'Password123'
      })
    });
    expect(resCustomPerms.status).toBe(403);

    // 5. Normal user cannot assign role_ids
    const resCustomRoles = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRegularUserA}` },
      body: JSON.stringify({
        name: 'Escalated Roles',
        email: 'esc_roles@company-a.com',
        role_ids: ['some-role-id'],
        password: 'Password123'
      })
    });
    expect(resCustomRoles.status).toBe(403);
  });

  describe('PHASE 1C: MED-01 & MED-02 — RATE LIMITING & SESSION INVALIDATION', () => {
    const sessionTokenValid = 'session-token-valid-111';
    const userSessionId = 'user-session-1';
    const userSessionEmail = 'session-user@company-a.com';

    const tokenWithSession = jwt.sign(
      {
        id: userSessionId,
        email: userSessionEmail,
        role: 'admin',
        company_id: companyAId,
        authorized_company_ids: [companyAId, companyBId],
        session_token: sessionTokenValid
      },
      getJwtSecret()
    );

    beforeEach(() => {
      _resetLoginRateLimits();
    });

    it('MED-02-A: Request succeeds when active_session_token in DB matches JWT session_token', async () => {
      vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
        if (typeof sql === 'string' && sql.includes('active_session_token FROM users WHERE id = $1')) {
          return { rows: [{ active_session_token: sessionTokenValid }] } as any;
        }
        if (typeof sql === 'string' && sql.includes('SELECT id, username, name, email, role, company_id FROM users')) {
          return { rows: [{ id: userSessionId, email: userSessionEmail, role: 'admin', company_id: companyAId }] } as any;
        }
        return { rows: [] } as any;
      });

      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenWithSession}` }
      });
      expect(res.status).toBe(200);
    });

    it('MED-02-A: JWT is rejected with 401 SESSION_INVALIDATED when active_session_token is NULL (e.g. after logout)', async () => {
      vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
        if (typeof sql === 'string' && sql.includes('active_session_token FROM users WHERE id = $1')) {
          return { rows: [{ active_session_token: null }] } as any;
        }
        return { rows: [] } as any;
      });

      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenWithSession}` }
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('SESSION_INVALIDATED');
    });

    it('MED-02-A: Company Switcher continues to work seamlessly with active session', async () => {
      vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
        if (typeof sql === 'string' && sql.includes('active_session_token FROM users WHERE id = $1')) {
          return { rows: [{ active_session_token: sessionTokenValid }] } as any;
        }
        if (typeof sql === 'string' && sql.includes('SELECT id, company_id, role, permissions, role_ids FROM users')) {
          return {
            rows: [
              { id: userSessionId, company_id: companyAId, role: 'admin' },
              { id: 'user-session-b', company_id: companyBId, role: 'admin' }
            ]
          } as any;
        }
        if (typeof sql === 'string' && sql.includes('FROM "customers"')) {
          return { rows: [{ id: 'cust-b', name: 'Cust B', company_id: companyBId }] } as any;
        }
        return { rows: [] } as any;
      });

      const res = await fetch(`${baseUrl}/customers/cust-b`, {
        headers: {
          Authorization: `Bearer ${tokenWithSession}`,
          'x-company-id': companyBId
        }
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.company_id).toBe(companyBId);
    });

    it('MED-02-B: /auth/update-password synchronizes across all company records, rotates session, and invalidates old JWT', async () => {
      let dbActiveSessionToken = sessionTokenValid;
      let updatedQuerySql = '';
      let updatedParams: any[] = [];

      vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
        if (typeof sql === 'string' && sql.includes('active_session_token FROM users WHERE id = $1')) {
          return { rows: [{ active_session_token: dbActiveSessionToken }] } as any;
        }
        if (typeof sql === 'string' && sql.includes('UPDATE "users"')) {
          updatedQuerySql = sql;
          updatedParams = params || [];
          dbActiveSessionToken = params?.[1];
          return { rowCount: 2 } as any;
        }
        if (typeof sql === 'string' && sql.includes('SELECT id, username, name, email, role, company_id FROM users')) {
          return { rows: [{ id: userSessionId, email: userSessionEmail, role: 'admin', company_id: companyAId }] } as any;
        }
        return { rows: [] } as any;
      });

      const res = await fetch(`${baseUrl}/auth/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenWithSession}`
        },
        body: JSON.stringify({ newPassword: 'BrandNewPassword123' })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.sessionToken).toBeDefined();
      expect(body.sessionToken).not.toBe(sessionTokenValid);

      // Verify SQL updated all records for the email
      expect(updatedQuerySql).toContain('WHERE LOWER(email) = LOWER($3)');
      expect(updatedParams[2]).toBe(userSessionEmail);

      // Verify OLD token is immediately rejected
      const oldTokenRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenWithSession}` }
      });
      expect(oldTokenRes.status).toBe(401);
      const oldBody = await oldTokenRes.json();
      expect(oldBody.error).toBe('SESSION_INVALIDATED');

      // Verify NEW token works
      const newTokenRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${body.token}` }
      });
      expect(newTokenRes.status).toBe(200);
    });

    it('MED-02-C: Redundant unauthenticated /auth/logout is removed; only primary authenticated route responds', async () => {
      // 1. Unauthenticated call to /auth/logout must fail with 401
      const resUnauth = await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      expect(resUnauth.status).toBe(401);

      // 2. Authenticated call to /auth/logout succeeds and clears session
      let logoutSqlCalled = false;
      vi.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
        if (typeof sql === 'string' && sql.includes('active_session_token FROM users WHERE id = $1')) {
          return { rows: [{ active_session_token: sessionTokenValid }] } as any;
        }
        if (typeof sql === 'string' && sql.includes('UPDATE users SET active_session_token = NULL')) {
          logoutSqlCalled = true;
          return { rowCount: 1 } as any;
        }
        return { rows: [] } as any;
      });

      const resAuth = await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenWithSession}`
        }
      });
      expect(resAuth.status).toBe(200);
      expect(logoutSqlCalled).toBe(true);
    });

    it('MED-01-A: Login rate limiter allows normal requests then blocks brute-force after threshold', async () => {
      const targetEmail = 'brute_target@company-a.com';

      // Mock users query returning empty to simulate failed attempts
      vi.spyOn(pool, 'query').mockResolvedValue({ rows: [] } as any);

      // First 7 failed attempts should return 401 (not 429)
      for (let i = 0; i < 7; i++) {
        const res = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail, password: `wrong-pass-${i}` })
        });
        expect(res.status).toBe(401);
      }

      // 8th attempt should be blocked by rate limiter with 429
      const blockedRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: 'wrong-pass-again' })
      });
      expect(blockedRes.status).toBe(429);
      const blockedBody = await blockedRes.json();
      expect(blockedBody.error).toBe('TOO_MANY_ATTEMPTS');
      expect(blockedRes.headers.get('Retry-After')).toBeDefined();
    });
  });
});

