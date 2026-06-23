import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import pool from '../lib/postgres';
import router from '../lib/erp-api';

// Mock the postgres pool
vi.mock('../lib/postgres', () => {
  return {
    default: {
      query: vi.fn()
    }
  };
});

// Helper to extract Express router handlers by path and method
function getRouteHandler(path: string, method: 'get' | 'post') {
  const layer = router.stack.find((s: any) => {
    return s.route && s.route.path === path && s.route.methods[method];
  });
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  // The last handler in the stack is our route controller
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('Universal Widget Data Engine (APIs & Query Generator)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /widgets/data-sources', () => {
    it('should query information_schema and return dynamic tables and columns', async () => {
      const handler = getRouteHandler('/widgets/data-sources', 'get');
      
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [
          { table_name: 'invoices', column_name: 'id' },
          { table_name: 'invoices', column_name: 'company_id' },
          { table_name: 'invoices', column_name: 'total_amount' },
          { table_name: 'customers', column_name: 'name' }
        ]
      } as any);

      const req = {
        user: { id: 'user-1', company_id: 'comp-1', role: 'admin' }
      } as any;

      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      } as any;

      await handler(req, res, vi.fn());

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('information_schema.columns')
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          invoices: expect.arrayContaining(['id', 'company_id', 'total_amount']),
          customers: expect.arrayContaining(['name'])
        })
      );
    });
  });

  describe('POST /widgets/query', () => {
    it('should execute aggregation SUM queries successfully and apply company isolation', async () => {
      const handler = getRouteHandler('/widgets/query', 'post');

      // 1. Column metadata mock
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [
          { column_name: 'id' },
          { column_name: 'company_id' },
          { column_name: 'total_amount' },
          { column_name: 'category' }
        ]
      } as any);

      // 2. Query execution mock
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [
          { category: 'A', value: 150.5 }
        ]
      } as any);

      const req = {
        user: { id: 'user-1', company_id: 'comp-1', role: 'admin' },
        body: {
          source: 'invoices',
          aggregation: { type: 'SUM', field: 'total_amount' },
          grouping: ['category']
        }
      } as any;

      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      } as any;

      await handler(req, res, vi.fn());

      // Verify validation metadata query was run
      expect(pool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('information_schema.columns'),
        ['invoices']
      );

      // Verify the generated SQL statement is correct and parameter-bound
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('SELECT "invoices"."category" AS "category", SUM("invoices"."total_amount") AS value FROM "invoices"'),
        ['comp-1']
      );

      expect(res.json).toHaveBeenCalledWith([{ category: 'A', value: 150.5 }]);
    });

    it('should validate inputs and reject invalid query columns to block SQL injection', async () => {
      const handler = getRouteHandler('/widgets/query', 'post');

      // Mock columns lookup
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [
          { column_name: 'id' },
          { column_name: 'company_id' }
        ]
      } as any);

      const req = {
        user: { id: 'user-1', company_id: 'comp-1', role: 'admin' },
        body: {
          source: 'invoices',
          fields: ['id; DROP TABLE invoices; --']
        }
      } as any;

      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      } as any;

      await handler(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid column') })
      );
    });

    it('should compute running totals successfully in post-processing', async () => {
      const handler = getRouteHandler('/widgets/query', 'post');

      // 1. Column metadata mock
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [
          { column_name: 'id' },
          { column_name: 'company_id' },
          { column_name: 'total_amount' },
          { column_name: 'date' }
        ]
      } as any);

      // 2. Query all sorted rows mock
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [
          { date: '2026-06-01', total: 100 },
          { date: '2026-06-02', total: 150 }
        ]
      } as any);

      const req = {
        user: { id: 'user-1', company_id: 'comp-1', role: 'admin' },
        body: {
          source: 'invoices',
          aggregation: { type: 'RUNNING_TOTAL', field: 'total_amount' }
        }
      } as any;

      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      } as any;

      await handler(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith([
        { date: '2026-06-01', value: 100 },
        { date: '2026-06-02', value: 250 } // running sum 100 + 150
      ]);
    });

    it('should calculate growth comparison metric percentage', async () => {
      const handler = getRouteHandler('/widgets/query', 'post');

      // 1. Columns lookup
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [
          { column_name: 'id' },
          { column_name: 'company_id' },
          { column_name: 'total_amount' },
          { column_name: 'date' }
        ]
      } as any);

      // 2. Current period SUM mock
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{ value: 150 }]
      } as any);

      // 3. Previous period SUM mock
      vi.mocked(pool.query).mockResolvedValueOnce({
        rows: [{ value: 100 }]
      } as any);

      const req = {
        user: { id: 'user-1', company_id: 'comp-1', role: 'admin' },
        body: {
          source: 'invoices',
          dateRange: 'this_month',
          aggregation: { type: 'GROWTH', field: 'total_amount' }
        }
      } as any;

      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      } as any;

      await handler(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith([
        { current: 150, previous: 100, growth: 50, value: 150 }
      ]);
    });
  });
});
