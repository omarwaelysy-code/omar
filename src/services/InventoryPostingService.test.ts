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

describe('InventoryPostingService (Phase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('postMovement - Purchase Posting & Average Cost', () => {
    it('should calculate and post first purchase correctly (0 initial stock)', async () => {
      const { client, queries } = createMockClient({
        products: { 'prod-1': { stock: 0, cost_price: 0 } },
        oldMovements: { 'prod-1': [] } // No old movements
      });

      const movement: InventoryMovementV2 = {
        id: 'mov-1',
        company_id: 'comp-1',
        movement_number: 'MOV-001',
        movement_type: 'purchase',
        movement_date: '2026-06-27',
        status: 'posted'
      };

      const lines: InventoryMovementLine[] = [
        {
          id: 'line-1',
          movement_id: 'mov-1',
          product_id: 'prod-1',
          unit_id: 'pcs',
          quantity: 10,
          direction: 'IN',
          unit_cost: 15,
          total_cost: 150
        }
      ];

      await InventoryPostingService.postMovement(movement, lines, client);

      // Verify movement line was updated with snapshot metrics
      const updateLineQuery = queries.find(q => q.text.includes('UPDATE "inventory_movement_lines"'));
      expect(updateLineQuery).toBeDefined();
      expect(updateLineQuery?.params).toEqual([0, 10, 0, 15, 'line-1']); // beforeQty=0, afterQty=10, beforeCost=0, afterCost=15

      // Verify stock card was inserted
      const insertStockCard = queries.find(q => q.text.includes('INSERT INTO "stock_card"'));
      expect(insertStockCard).toBeDefined();
      // before_qty=0, after_qty=10, before_cost=0, after_cost=15, unit_cost=15, total_cost=150
      expect(insertStockCard?.params).toContain(0);
      expect(insertStockCard?.params).toContain(10);
      expect(insertStockCard?.params).toContain(15);
      expect(insertStockCard?.params).toContain(150);

      // Verify product table was updated
      const updateProduct = queries.find(q => q.text.includes('UPDATE products'));
      expect(updateProduct).toBeDefined();
      expect(updateProduct?.params).toEqual([10, 15, 'prod-1']); // stock=10, cost=15
    });

    it('should calculate Moving Average cost correctly on subsequent purchases', async () => {
      // Setup product with 10 units at $15 WAC from past purchases
      const { client, queries } = createMockClient({
        oldMovements: {
          'prod-1': [
            { quantity: 10, unit_cost: 15 } // 10 units at $15
          ]
        }
      });

      const movement: InventoryMovementV2 = {
        id: 'mov-2',
        company_id: 'comp-1',
        movement_number: 'MOV-002',
        movement_type: 'purchase',
        movement_date: '2026-06-27',
        status: 'posted'
      };

      // Purchase another 5 units at $30 (new total cost = $150)
      // New WAC should be: (10 * 15 + 5 * 30) / 15 = (150 + 150) / 15 = $20
      const lines: InventoryMovementLine[] = [
        {
          id: 'line-2',
          movement_id: 'mov-2',
          product_id: 'prod-1',
          unit_id: 'pcs',
          quantity: 5,
          direction: 'IN',
          unit_cost: 30,
          total_cost: 150
        }
      ];

      await InventoryPostingService.postMovement(movement, lines, client);

      // Verify movement line was updated with WAC metrics
      const updateLine = queries.find(q => q.text.includes('UPDATE "inventory_movement_lines"'));
      expect(updateLine?.params).toEqual([10, 15, 15, 20, 'line-2']); // beforeQty=10, afterQty=15, beforeCost=15, afterCost=20

      // Verify product was updated to 15 stock and $20 cost
      const updateProduct = queries.find(q => q.text.includes('UPDATE products'));
      expect(updateProduct?.params).toEqual([15, 20, 'prod-1']);
    });
  });

  describe('postMovement - Outflows & Negative Stock Checks', () => {
    it('should decrease stock but keep cost unchanged on valid outflow (sales)', async () => {
      // Setup product with 10 stock at $15 cost
      const { client, queries } = createMockClient({
        oldMovements: {
          'prod-1': [
            { quantity: 10, unit_cost: 15 }
          ]
        }
      });

      const movement: InventoryMovementV2 = {
        id: 'mov-3',
        company_id: 'comp-1',
        movement_number: 'MOV-003',
        movement_type: 'sales',
        movement_date: '2026-06-27',
        status: 'posted'
      };

      // Sale of 4 units (WAC remains $15)
      const lines: InventoryMovementLine[] = [
        {
          id: 'line-3',
          movement_id: 'mov-3',
          product_id: 'prod-1',
          unit_id: 'pcs',
          quantity: 4,
          direction: 'OUT',
          unit_cost: 15,
          total_cost: 60
        }
      ];

      await InventoryPostingService.postMovement(movement, lines, client);

      const updateLine = queries.find(q => q.text.includes('UPDATE "inventory_movement_lines"'));
      expect(updateLine?.params).toEqual([10, 6, 15, 15, 'line-3']); // beforeQty=10, afterQty=6, beforeCost=15, afterCost=15

      const updateProduct = queries.find(q => q.text.includes('UPDATE products'));
      expect(updateProduct?.params).toEqual([6, 15, 'prod-1']); // stock=6, cost=15
    });

    it('should throw an error and abort if outflow causes negative stock', async () => {
      // Setup product with 3 stock
      const { client } = createMockClient({
        oldMovements: {
          'prod-1': [
            { quantity: 3, unit_cost: 15 }
          ]
        }
      });

      const movement: InventoryMovementV2 = {
        id: 'mov-4',
        company_id: 'comp-1',
        movement_number: 'MOV-004',
        movement_type: 'sales',
        movement_date: '2026-06-27',
        status: 'posted'
      };

      // Attempt to sell 5 units (exceeding stock of 3)
      const lines: InventoryMovementLine[] = [
        {
          id: 'line-4',
          movement_id: 'mov-4',
          product_id: 'prod-1',
          unit_id: 'pcs',
          quantity: 5,
          direction: 'OUT',
          unit_cost: 15,
          total_cost: 75
        }
      ];

      await expect(InventoryPostingService.postMovement(movement, lines, client))
        .rejects.toThrow('Negative stock is not allowed.');
    });
  });

  describe('postMovement - Multiple Items & Rollback', () => {
    it('should successfully post multiple items in one call', async () => {
      const { client, queries } = createMockClient({
        oldMovements: {
          'prod-1': [{ quantity: 5, unit_cost: 10 }],
          'prod-2': [{ quantity: 2, unit_cost: 50 }]
        }
      });

      const movement: InventoryMovementV2 = {
        id: 'mov-5',
        company_id: 'comp-1',
        movement_number: 'MOV-005',
        movement_type: 'purchase',
        movement_date: '2026-06-27',
        status: 'posted'
      };

      const lines: InventoryMovementLine[] = [
        {
          id: 'line-a',
          movement_id: 'mov-5',
          product_id: 'prod-1',
          unit_id: 'pcs',
          quantity: 5,
          direction: 'IN',
          unit_cost: 10,
          total_cost: 50
        },
        {
          id: 'line-b',
          movement_id: 'mov-5',
          product_id: 'prod-2',
          unit_id: 'pcs',
          quantity: 1,
          direction: 'OUT',
          unit_cost: 50,
          total_cost: 50
        }
      ];

      await expect(InventoryPostingService.postMovement(movement, lines, client))
        .resolves.not.toThrow();

      // Should run product update twice
      const updateProductQueries = queries.filter(q => q.text.includes('UPDATE products'));
      expect(updateProductQueries).toHaveLength(2);
    });
  });
});
