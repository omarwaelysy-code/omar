import { describe, it, expect, vi, beforeEach } from 'vitest';
import erpRouter from '../lib/erp-api.js';
import { InventoryMovementService } from '../services/InventoryMovementService.js';
import pool from '../lib/postgres.js';

vi.mock('../services/InventoryMovementService', () => ({
  InventoryMovementService: {
    createMovement: vi.fn(),
    reverseMovement: vi.fn()
  }
}));

vi.mock('../lib/postgres', () => {
  const mockPool = {
    connect: vi.fn(),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  };
  return {
    default: mockPool,
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  };
});

// Route Handlers Resolvers
const getHandler = (path: string, method: 'post' | 'put' | 'delete') => {
  const layer = erpRouter.stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

describe('Professional Inventory Engine Integration (Phase 8)', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      query: vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
        const textClean = text.toLowerCase();
        if (textClean.includes('from products')) {
          return { rows: [{ id: params[0], name: 'test product', code: 'PROD-123', type: 'product', is_service: false, weighted_average_cost: 12, cost_price: 12, stock: 15 }] };
        }
        if (textClean.includes('select name from accounts')) {
          return { rows: [{ name: 'حساب التسويات' }] };
        }
        if (textClean.includes('from warehouses')) {
          return { rows: [{ id: 'wh-from', name: 'المخزن الرئيسي' }, { id: 'wh-to', name: 'مخزن المعرض' }] };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn()
    };

    vi.mocked(pool.connect).mockResolvedValue(mockClient as any);
  });

  describe('Warehouse Transfer (Inventory Transfer)', () => {
    it('should successfully create OUT and IN movements on creation', async () => {
      const handler = getHandler('/warehouse_transfers', 'post');
      const req = {
        user: { company_id: 'comp-abc', id: 'user-xyz' },
        body: {
          transfer_number: 'TR-0001',
          date: '2026-06-27',
          from_warehouse_id: 'wh-from',
          to_warehouse_id: 'wh-to',
          items: [{ product_id: 'prod-123', quantity: 5 }]
        }
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler(req as any, res as any, () => {});

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(res.status).toHaveBeenCalledWith(201);
      
      // Verify two movements created: one for OUT, one for IN
      expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(2);

      const firstCallArgs = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
      const secondCallArgs = vi.mocked(InventoryMovementService.createMovement).mock.calls[1];

      expect(firstCallArgs[0].warehouse_id).toBe('wh-from');
      expect(firstCallArgs[1][0].direction).toBe('OUT');

      expect(secondCallArgs[0].warehouse_id).toBe('wh-to');
      expect(secondCallArgs[1][0].direction).toBe('IN');
    });

    it('should reverse old and create new movements on update', async () => {
      const handler = getHandler('/warehouse_transfers/:id', 'put');
      const req = {
        params: { id: 'transfer-update-123' },
        user: { company_id: 'comp-abc', id: 'user-xyz' },
        body: {
          transfer_number: 'TR-0002',
          date: '2026-06-27',
          from_warehouse_id: 'wh-from',
          to_warehouse_id: 'wh-to',
          items: [{ product_id: 'prod-123', quantity: 6 }]
        }
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler(req as any, res as any, () => {});

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(InventoryMovementService.reverseMovement).toHaveBeenCalledWith('warehouse_transfer', 'transfer-update-123', mockClient);
      expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(2);
    });

    it('should reverse movements on deletion', async () => {
      const handler = getHandler('/warehouse_transfers/:id', 'delete');
      const req = {
        params: { id: 'transfer-delete-123' },
        user: { company_id: 'comp-abc', id: 'user-xyz' }
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler(req as any, res as any, () => {});

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(InventoryMovementService.reverseMovement).toHaveBeenCalledWith('warehouse_transfer', 'transfer-delete-123', mockClient);
    });
  });

  describe('Inventory Adjustment (Stock Adjustment)', () => {
    it('should successfully create adjustment movement on creation', async () => {
      const handler = getHandler('/stock_adjustments', 'post');
      const req = {
        user: { company_id: 'comp-abc', id: 'user-xyz' },
        body: {
          adjustment_number: 'ADJ-0001',
          date: '2026-06-27',
          account_id: 'acc-adj',
          items: [{ product_id: 'prod-123', quantity: 2, unit_cost: 15 }]
        }
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler(req as any, res as any, () => {});

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(1);

      const [header, lines] = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
      expect(header.movement_type).toBe('inventory_adjustment');
      expect(lines[0].direction).toBe('IN');
      expect(lines[0].quantity).toBe(2);
    });

    it('should reverse old and create new adjustment on update', async () => {
      const handler = getHandler('/stock_adjustments/:id', 'put');
      const req = {
        params: { id: 'adj-update-123' },
        user: { company_id: 'comp-abc', id: 'user-xyz' },
        body: {
          adjustment_number: 'ADJ-0002',
          date: '2026-06-27',
          account_id: 'acc-adj',
          items: [{ product_id: 'prod-123', quantity: -3, unit_cost: 15 }]
        }
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler(req as any, res as any, () => {});

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(InventoryMovementService.reverseMovement).toHaveBeenCalledWith('stock_adjustment', 'adj-update-123', mockClient);

      const [header, lines] = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
      expect(lines[0].direction).toBe('OUT');
      expect(lines[0].quantity).toBe(3);
    });
  });

  describe('Opening Stock Balance', () => {
    it('should successfully create opening balance movement on creation', async () => {
      const handler = getHandler('/opening_stock_balances', 'post');
      const req = {
        user: { company_id: 'comp-abc', id: 'user-xyz' },
        body: {
          document_number: 'OPB-0001',
          date: '2026-06-27',
          debit_account_id: 'acc-inv',
          credit_account_id: 'acc-cap',
          items: [{ product_id: 'prod-123', quantity: 10, unit_cost: 12 }]
        }
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler(req as any, res as any, () => {});

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(1);

      const [header, lines] = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
      expect(header.movement_type).toBe('opening_balance');
      expect(lines[0].direction).toBe('IN');
    });

    it('should reverse old and create new opening balance on update', async () => {
      const handler = getHandler('/opening_stock_balances/:id', 'put');
      const req = {
        params: { id: 'opb-update-123' },
        user: { company_id: 'comp-abc', id: 'user-xyz' },
        body: {
          document_number: 'OPB-0002',
          date: '2026-06-27',
          debit_account_id: 'acc-inv',
          credit_account_id: 'acc-cap',
          items: [{ product_id: 'prod-123', quantity: 12, unit_cost: 12 }]
        }
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await handler(req as any, res as any, () => {});

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(InventoryMovementService.reverseMovement).toHaveBeenCalledWith('opening_stock_balance', 'opb-update-123', mockClient);
    });
  });
});
