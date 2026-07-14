import { describe, it, expect, vi, beforeEach } from 'vitest';
import erpRouter from '../lib/erp-api.js';
import { InventoryMovementService } from '../services/InventoryMovementService.js';
import pool from '../lib/postgres.js';

vi.mock('../services/InventoryMovementService', () => ({
  InventoryMovementService: {
    createMovement: vi.fn()
  }
}));

vi.mock('../lib/postgres', () => {
  const mockPool = {
    connect: vi.fn(),
    query: vi.fn()
  };
  return {
    default: mockPool,
    query: vi.fn()
  };
});

// Helper to extract the POST handler for /purchase_invoices from Express stack
const getPostHandler = () => {
  const layer = erpRouter.stack.find(
    (l: any) => l.route && l.route.path === '/purchase_invoices' && l.route.methods.post
  );
  if (!layer) throw new Error('Route POST /purchase_invoices not found');
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

describe('Purchase Invoice and Inventory Movement Integration', () => {
  let mockClient: any;
  let postHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();
    postHandler = getPostHandler();

    mockClient = {
      query: vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
        const textClean = text.toLowerCase();
        if (textClean.includes('select * from products')) {
          // Return non-service product
          return { rows: [{ id: params[0], type: 'product', is_service: false }] };
        }
        if (textClean.includes('select cost_price')) {
          return { rows: [{ cost_price: 10, stock: 5 }] };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn()
    };

    vi.mocked(pool.connect).mockResolvedValue(mockClient as any);
  });

  it('should successfully create a purchase movement when saving a purchase invoice', async () => {
    const req = {
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        invoice_number: 'PINV-2026-0001',
        date: '2026-06-27',
        warehouse_id: 'wh-main',
        items: [
          { product_id: 'prod-123', quantity: 5, unit_price: 15, unit: 'pcs' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await postHandler(req, res);

    // Verify transaction COMMIT was run
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(res.status).toHaveBeenCalledWith(201);

    // Verify InventoryMovementService.createMovement was called exactly once
    expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(1);

    // Verify Header details passed to the service
    const serviceCallArgs = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
    const movementHeader = serviceCallArgs[0];
    const movementLines = serviceCallArgs[1];
    const clientPassed = serviceCallArgs[2];

    expect(movementHeader.company_id).toBe('comp-abc');
    expect(movementHeader.movement_number).toBe('PINV-2026-0001');
    expect(movementHeader.movement_type).toBe('purchase');
    expect(movementHeader.source_document_type).toBe('purchase_invoice');
    expect(movementHeader.movement_date).toBe('2026-06-27');
    expect(movementHeader.created_by).toBe('user-xyz');
    expect(movementHeader.warehouse_id).toBe('wh-main');

    // Verify Line details
    expect(movementLines).toHaveLength(1);
    expect(movementLines[0].product_id).toBe('prod-123');
    expect(movementLines[0].unit_id).toBe('pcs');
    expect(movementLines[0].quantity).toBe(5);
    expect(movementLines[0].direction).toBe('IN');
    expect(movementLines[0].unit_cost).toBe(15);
    expect(movementLines[0].total_cost).toBe(75);

    // Verify transaction client was passed to ensure atomic commit/rollback
    expect(clientPassed).toBe(mockClient);
  });

  it('should exclude service items from creating inventory movement lines', async () => {
    // Custom mock client to return a service item for prod-service
    mockClient.query = vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
      const textClean = text.toLowerCase();
      if (textClean.includes('select * from products')) {
        const prodId = params[0];
        if (prodId === 'prod-service') {
          return { rows: [{ id: prodId, type: 'service', is_service: true }] };
        }
        return { rows: [{ id: prodId, type: 'product', is_service: false }] };
      }
      if (textClean.includes('select cost_price')) {
        return { rows: [{ cost_price: 10, stock: 5 }] };
      }
      return { rows: [], rowCount: 1 };
    });

    const req = {
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        invoice_number: 'PINV-2026-0002',
        date: '2026-06-27',
        warehouse_id: 'wh-main',
        items: [
          { product_id: 'prod-physical', quantity: 5, unit_price: 15, unit: 'pcs' },
          { product_id: 'prod-service', quantity: 1, unit_price: 100, unit: 'hour' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await postHandler(req, res);

    expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(1);

    // Verify only the physical item is passed to createMovement lines
    const serviceCallArgs = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
    const movementLines = serviceCallArgs[1];

    expect(movementLines).toHaveLength(1);
    expect(movementLines[0].product_id).toBe('prod-physical');
  });

  it('should rollback transaction and not save invoice or movement if service creation fails', async () => {
    // Force createMovement to throw an error
    vi.mocked(InventoryMovementService.createMovement).mockRejectedValue(new Error('Engine Save Error'));

    const req = {
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        invoice_number: 'PINV-2026-0003',
        date: '2026-06-27',
        warehouse_id: 'wh-main',
        items: [
          { product_id: 'prod-123', quantity: 5, unit_price: 15, unit: 'pcs' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await postHandler(req, res);

    // Verify ROLLBACK was called and COMMIT was not
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');

    // Verify response was sent with status 500
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
