import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryPostingService } from './InventoryPostingService.js';
import { PoolClient } from 'pg';
import { InventoryMovementV2, InventoryMovementLine } from '../types.js';

const createMockClient = (options: {
  products?: Record<string, { stock: number; cost_price: number }>;
  oldMovements?: Record<string, { quantity: number; unit_cost: number }[]>;
} = {}) => {
  const queries: { text: string; params: any[] }[] = [];
  const client = {
    query: vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
      queries.push({ text, params });
      const textClean = text.toLowerCase().trim();

      // Mock previous movements query from old table
      if (textClean.includes('select quantity, unit_cost from inventory_movements')) {
        const productId = params[0];
        const rows = (options.oldMovements && options.oldMovements[productId]) || [];
        return { rows, rowCount: rows.length };
      }

      // Mock products table fetch fallback
      if (textClean.includes('select stock, cost_price from products')) {
        const productId = params[0];
        const prod = (options.products && options.products[productId]) || { stock: 0, cost_price: 0 };
        return { rows: [prod], rowCount: 1 };
      }

      // Default success responses for updates/inserts
      return { rows: [], rowCount: 1 };
    })
  } as unknown as PoolClient;

  return { client, queries };
};

describe('InventoryTransactionJournal (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a transaction journal entry automatically after a successful movement post', async () => {
    const { client, queries } = createMockClient({
      products: { 'prod-1': { stock: 0, cost_price: 0 } },
      oldMovements: { 'prod-1': [] }
    });

    const movement: InventoryMovementV2 = {
      id: 'mov-123',
      company_id: 'comp-abc',
      warehouse_id: 'wh-main',
      movement_number: 'PINV-001',
      movement_type: 'purchase',
      source_document_type: 'purchase_invoice',
      source_document_id: 'inv-456',
      movement_date: '2026-06-27',
      status: 'posted',
      created_by: 'user-789',
      notes: 'Test note'
    };

    const lines: InventoryMovementLine[] = [
      {
        id: 'line-abc',
        movement_id: 'mov-123',
        product_id: 'prod-1',
        unit_id: 'pcs',
        quantity: 10,
        direction: 'IN',
        unit_cost: 15,
        total_cost: 150
      }
    ];

    await InventoryPostingService.postMovement(movement, lines, client);

    // Verify journal entry insertion query was run
    const insertJournal = queries.find(q => q.text.includes('INSERT INTO "inventory_transaction_journal"'));
    expect(insertJournal).toBeDefined();

    // Verify the query parameters
    const params = insertJournal?.params || [];
    // order of fields in query: id, company_id, warehouse_id, movement_id, movement_type, source_document_type, source_document_id, reference_number, status, created_by, posted_at, notes
    expect(params[1]).toBe('comp-abc'); // company_id
    expect(params[2]).toBe('wh-main'); // warehouse_id
    expect(params[3]).toBe('mov-123'); // movement_id
    expect(params[4]).toBe('purchase'); // movement_type
    expect(params[5]).toBe('purchase_invoice'); // source_document_type
    expect(params[6]).toBe('inv-456'); // source_document_id
    expect(params[7]).toBe('PINV-001'); // reference_number
    expect(params[8]).toBe('Posted'); // status
    expect(params[9]).toBe('user-789'); // created_by
    expect(params[10]).toBeInstanceOf(Date); // posted_at
    expect(params[11]).toBe('Test note'); // notes
  });

  it('should not create a journal entry when the posting fails (rollback check)', async () => {
    // Setup client to throw an error during products table update
    const queries: { text: string; params: any[] }[] = [];
    const mockClient = {
      query: vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
        queries.push({ text, params });
        const textClean = text.toLowerCase().trim();
        if (textClean.includes('select quantity, unit_cost from inventory_movements')) {
          return { rows: [], rowCount: 0 };
        }
        if (textClean.includes('update products')) {
          throw new Error('Database connection failed');
        }
        return { rows: [], rowCount: 1 };
      })
    } as unknown as PoolClient;

    const movement: InventoryMovementV2 = {
      id: 'mov-123',
      company_id: 'comp-abc',
      movement_number: 'PINV-001',
      movement_type: 'purchase',
      movement_date: '2026-06-27',
      status: 'posted'
    };

    const lines: InventoryMovementLine[] = [
      {
        id: 'line-abc',
        movement_id: 'mov-123',
        product_id: 'prod-1',
        unit_id: 'pcs',
        quantity: 10,
        direction: 'IN',
        unit_cost: 15
      }
    ];

    await expect(InventoryPostingService.postMovement(movement, lines, mockClient))
      .rejects.toThrow('Database connection failed');

    // Verify journal entry insert was never reached
    const insertJournal = queries.find(q => q.text.includes('INSERT INTO "inventory_transaction_journal"'));
    expect(insertJournal).toBeUndefined();
  });

  it('should correctly link Stock Card and Journal Entry via sharing same movement_id', async () => {
    const { client, queries } = createMockClient({
      products: { 'prod-1': { stock: 0, cost_price: 0 } },
      oldMovements: { 'prod-1': [] }
    });

    const movement: InventoryMovementV2 = {
      id: 'mov-unique',
      company_id: 'comp-abc',
      movement_number: 'PINV-001',
      movement_type: 'purchase',
      movement_date: '2026-06-27',
      status: 'posted'
    };

    const lines: InventoryMovementLine[] = [
      {
        id: 'line-abc',
        movement_id: 'mov-unique',
        product_id: 'prod-1',
        unit_id: 'pcs',
        quantity: 10,
        direction: 'IN',
        unit_cost: 15
      }
    ];

    await InventoryPostingService.postMovement(movement, lines, client);

    const stockCardQuery = queries.find(q => q.text.includes('INSERT INTO "stock_card"'));
    const journalQuery = queries.find(q => q.text.includes('INSERT INTO "inventory_transaction_journal"'));

    expect(stockCardQuery?.params).toContain('mov-unique');
    expect(journalQuery?.params).toContain('mov-unique');
  });

  it('should handle Draft status for journal if movement is not posted', async () => {
    const { client, queries } = createMockClient({
      products: { 'prod-1': { stock: 0, cost_price: 0 } },
      oldMovements: { 'prod-1': [] }
    });

    const movement: InventoryMovementV2 = {
      id: 'mov-draft',
      company_id: 'comp-abc',
      movement_number: 'PINV-001',
      movement_type: 'purchase',
      movement_date: '2026-06-27',
      status: 'draft' // movement is draft
    };

    const lines: InventoryMovementLine[] = [
      {
        id: 'line-abc',
        movement_id: 'mov-draft',
        product_id: 'prod-1',
        unit_id: 'pcs',
        quantity: 10,
        direction: 'IN',
        unit_cost: 15
      }
    ];

    await InventoryPostingService.postMovement(movement, lines, client);

    const journalQuery = queries.find(q => q.text.includes('INSERT INTO "inventory_transaction_journal"'));
    expect(journalQuery?.params[8]).toBe('Draft'); // status
    expect(journalQuery?.params[10]).toBeNull(); // posted_at
  });
});
