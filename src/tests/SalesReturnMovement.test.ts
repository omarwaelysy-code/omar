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

const getPostHandler = () => {
  const layer = erpRouter.stack.find(
    (l: any) => l.route && l.route.path === '/returns' && l.route.methods.post
  );
  if (!layer) throw new Error('Route POST /returns not found');
  return layer.route.stack[1].handle;
};

const getPutHandler = () => {
  const layer = erpRouter.stack.find(
    (l: any) => l.route && l.route.path === '/returns/:id' && l.route.methods.put
  );
  if (!layer) throw new Error('Route PUT /returns/:id not found');
  return layer.route.stack[1].handle;
};

const getDeleteHandler = () => {
  const layer = erpRouter.stack.find(
    (l: any) => l.route && l.route.path === '/returns/:id' && l.route.methods.delete
  );
  if (!layer) throw new Error('Route DELETE /returns/:id not found');
  return layer.route.stack[1].handle;
};

describe('Sales Return and Inventory Movement Integration (Phase 7)', () => {
  let mockClient: any;
  let postHandler: any;
  let putHandler: any;
  let deleteHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();
    postHandler = getPostHandler();
    putHandler = getPutHandler();
    deleteHandler = getDeleteHandler();

    mockClient = {
      query: vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
        const textClean = text.toLowerCase();
        if (textClean.includes('from products')) {
          return { rows: [{ id: params[0], type: 'product', is_service: false, weighted_average_cost: 15, cost_price: 15, stock: 10 }] };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn()
    };

    vi.mocked(pool.connect).mockResolvedValue(mockClient as any);
  });

  it('should successfully create a sales return movement when creating a sales return', async () => {
    const req = {
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        return_number: 'RET-2026-0001',
        date: '2026-06-27',
        warehouse_id: 'wh-main',
        items: [
          { product_id: 'prod-123', quantity: 2, unit_price: 15, unit: 'pcs' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await postHandler(req, res);

    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(res.status).toHaveBeenCalledWith(201);

    expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(1);

    const serviceCallArgs = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
    const movementHeader = serviceCallArgs[0];
    const movementLines = serviceCallArgs[1];
    const clientPassed = serviceCallArgs[2];

    expect(movementHeader.company_id).toBe('comp-abc');
    expect(movementHeader.movement_number).toBe('RET-2026-0001');
    expect(movementHeader.movement_type).toBe('sales_return');
    expect(movementHeader.source_document_type).toBe('sales_return');
    expect(movementHeader.movement_date).toBe('2026-06-27');
    expect(movementHeader.warehouse_id).toBe('wh-main');

    expect(movementLines).toHaveLength(1);
    expect(movementLines[0].product_id).toBe('prod-123');
    expect(movementLines[0].direction).toBe('IN');
    expect(movementLines[0].quantity).toBe(2);
    expect(clientPassed).toBe(mockClient);
  });

  it('should trigger reverseMovement and re-create movement when updating a sales return', async () => {
    const req = {
      params: { id: 'ret-update-123' },
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        return_number: 'RET-2026-0002',
        date: '2026-06-27',
        warehouse_id: 'wh-main',
        items: [
          { product_id: 'prod-123', quantity: 3, unit_price: 15, unit: 'pcs' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await putHandler(req, res);

    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(res.json).toHaveBeenCalledWith({ success: true });

    // Verify reverseMovement was called on the sales return
    expect(InventoryMovementService.reverseMovement).toHaveBeenCalledWith('sales_return', 'ret-update-123', mockClient);

    // Verify createMovement was called with new quantities
    expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(1);
    const movementLines = vi.mocked(InventoryMovementService.createMovement).mock.calls[0][1];
    expect(movementLines[0].quantity).toBe(3);
  });

  it('should trigger reverseMovement when deleting a sales return', async () => {
    const req = {
      params: { id: 'ret-delete-123' },
      user: { company_id: 'comp-abc', id: 'user-xyz' }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await deleteHandler(req, res);

    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(res.json).toHaveBeenCalledWith({ success: true });

    // Verify reverseMovement was called on DELETE
    expect(InventoryMovementService.reverseMovement).toHaveBeenCalledWith('sales_return', 'ret-delete-123', mockClient);
  });
});
