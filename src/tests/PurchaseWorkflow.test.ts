import { describe, it, expect, vi, beforeEach } from 'vitest';
import erpRouter from '../lib/erp-api.js';
import { InventoryMovementService } from '../services/InventoryMovementService.js';
import pool from '../lib/postgres.js';

vi.mock('../services/InventoryMovementService', () => ({
  InventoryMovementService: {
    createMovement: vi.fn().mockResolvedValue({ id: 'move-123' })
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

// Helper to extract handlers from Express router stack
const getPostHandler = (path: string) => {
  const layer = erpRouter.stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods.post
  );
  if (!layer) throw new Error(`Route POST ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

describe('Purchase Workflow Mode & Goods Receipts Integration', () => {
  let mockClient: any;
  let postInvoiceHandler: any;
  let postGRHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();
    postInvoiceHandler = getPostHandler('/purchase_invoices');
    postGRHandler = getPostHandler('/goods_receipts');

    mockClient = {
      query: vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
        const textClean = text.toLowerCase().trim();
        if (textClean.includes('select purchase_workflow_mode')) {
          return { rows: [{ purchase_workflow_mode: 'Simple' }] };
        }
        if (textClean.includes('select * from companies')) {
          return { rows: [{ id: 'comp-abc', purchase_workflow_mode: 'Simple' }] };
        }
        if (textClean.includes('from products')) {
          return { rows: [{ id: params[0], name: 'Product 123', code: 'P123', type: 'product', is_service: false, revenue_account_id: 'acc-rev', cost_account_id: 'acc-cost', inventory_account_id: 'acc-inv' }] };
        }
        if (textClean.includes('from customers') || textClean.includes('from suppliers') || textClean.includes('from payment_methods')) {
          return { rows: [{ id: params[0], name: 'Mock Entity', account_id: 'acc-123' }], rowCount: 1 };
        }
        if (textClean.includes('select cost_price') || textClean.includes('select unit_cost')) {
          return { rows: [{ cost_price: 10, stock: 5 }] };
        }
        if (textClean.includes('document_sequences')) {
          return { rows: [{ last_seq: 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn()
    };

    vi.mocked(pool.connect).mockResolvedValue(mockClient as any);
  });

  it('Simple Mode: purchase invoice should directly create inventory movement', async () => {
    const req = {
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        invoice_number: 'PINV-2026-S1',
        date: '2026-06-27',
        warehouse_id: 'wh-main',
        supplier_id: 'supplier-1',
        items: [
          { product_id: 'prod-123', quantity: 5, unit_price: 15, unit: 'pcs' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await postInvoiceHandler(req, res);

    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(1);

    const serviceCallArgs = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
    expect(serviceCallArgs[0].movement_type).toBe('purchase');
    expect(serviceCallArgs[0].source_document_type).toBe('purchase_invoice');
  });

  it('Enterprise Strict Mode: should block purchase invoice without Goods Receipt', async () => {
    // Custom mock to return Enterprise Strict mode
    mockClient.query = vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
      const textClean = text.toLowerCase().trim();
      if (textClean.includes('select purchase_workflow_mode') || textClean.includes('select * from companies')) {
        return { rows: [{ id: 'comp-abc', purchase_workflow_mode: 'Enterprise Strict' }] };
      }
      if (textClean.includes('document_sequences')) {
        return { rows: [{ last_seq: 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    const req = {
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        invoice_number: 'PINV-2026-ST1',
        date: '2026-06-27',
        warehouse_id: 'wh-main',
        supplier_id: 'supplier-1',
        items: [
          { product_id: 'prod-123', quantity: 5, unit_price: 15, unit: 'pcs' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await postInvoiceHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('الدورة الكاملة') })
    );
    expect(InventoryMovementService.createMovement).not.toHaveBeenCalled();
  });

  it('Enterprise Strict Mode: should allow purchase invoice with Goods Receipt and not double post movement', async () => {
    mockClient.query = vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
      const textClean = text.toLowerCase().trim();
      if (textClean.includes('select purchase_workflow_mode') || textClean.includes('select * from companies')) {
        return { rows: [{ id: 'comp-abc', purchase_workflow_mode: 'Enterprise Strict' }] };
      }
      if (textClean.includes('from products')) {
        return { rows: [{ id: params[0], name: 'Product 123', code: 'P123', type: 'product', is_service: false, revenue_account_id: 'acc-rev', cost_account_id: 'acc-cost', inventory_account_id: 'acc-inv' }] };
      }
      if (textClean.includes('from customers') || textClean.includes('from suppliers') || textClean.includes('from payment_methods')) {
        return { rows: [{ id: params[0], name: 'Mock Entity', account_id: 'acc-123' }], rowCount: 1 };
      }
      if (textClean.includes('document_sequences')) {
        return { rows: [{ last_seq: 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    const req = {
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        invoice_number: 'PINV-2026-ST2',
        date: '2026-06-27',
        warehouse_id: 'wh-main',
        supplier_id: 'supplier-1',
        goods_receipt_ids: ['gr-123'],
        items: [
          { product_id: 'prod-123', quantity: 5, unit_price: 15, unit: 'pcs' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await postInvoiceHandler(req, res);

    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(res.status).toHaveBeenCalledWith(201);
    // Movement is NOT posted because it was linked to an existing Goods Receipt (already posted to inventory)
    expect(InventoryMovementService.createMovement).not.toHaveBeenCalled();
  });

  it('Enterprise Flexible Mode: should auto-generate Goods Receipt and post movement if requested', async () => {
    mockClient.query = vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
      const textClean = text.toLowerCase().trim();
      if (textClean.includes('select purchase_workflow_mode') || textClean.includes('select * from companies')) {
        return { rows: [{ id: 'comp-abc', purchase_workflow_mode: 'Enterprise Flexible' }] };
      }
      if (textClean.includes('from products')) {
        return { rows: [{ id: params[0], name: 'Product 123', code: 'P123', type: 'product', is_service: false, revenue_account_id: 'acc-rev', cost_account_id: 'acc-cost', inventory_account_id: 'acc-inv' }] };
      }
      if (textClean.includes('from customers') || textClean.includes('from suppliers') || textClean.includes('from payment_methods')) {
        return { rows: [{ id: params[0], name: 'Mock Entity', account_id: 'acc-123' }], rowCount: 1 };
      }
      if (textClean.includes('document_sequences')) {
        return { rows: [{ last_seq: 1 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    const req = {
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        invoice_number: 'PINV-2026-F1',
        date: '2026-06-27',
        warehouse_id: 'wh-main',
        supplier_id: 'supplier-1',
        auto_generate_gr: true,
        items: [
          { product_id: 'prod-123', quantity: 5, unit_price: 15, unit: 'pcs' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await postInvoiceHandler(req, res);

    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(res.status).toHaveBeenCalledWith(201);
    // Inventory Movement should be created under the Goods Receipt reference, not the invoice
    expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(1);
    const serviceCallArgs = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
    expect(serviceCallArgs[0].movement_type).toBe('goods_receipt');
    expect(serviceCallArgs[0].source_document_type).toBe('goods_receipt');
  });

  it('Goods Receipt Creation: should trigger inventory movement and update PO', async () => {
    const req = {
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        supplier_id: 'supplier-1',
        supplier_name: 'Supplier One',
        warehouse_id: 'wh-main',
        warehouse_name: 'Main Warehouse',
        date: '2026-06-27',
        status: 'posted',
        source_document_type: 'purchase_order',
        source_document_id: 'po-123',
        items: [
          { product_id: 'prod-123', quantity: 10, unit_cost: 12, unit: 'pcs' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await postGRHandler(req, res);

    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(1);

    const serviceCallArgs = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
    expect(serviceCallArgs[0].movement_type).toBe('goods_receipt');
    expect(serviceCallArgs[0].source_document_type).toBe('goods_receipt');
  });

  it('Purchase Invoice with Foreign Currency: should multiply cost by exchange rate in movement lines', async () => {
    const req = {
      user: { company_id: 'comp-abc', id: 'user-xyz' },
      body: {
        supplier_id: 'supplier-1',
        warehouse_id: 'wh-main',
        invoice_number: 'PINV-FC-123',
        date: '2026-06-27',
        status: 'posted',
        exchange_rate: 50.0,
        currency_id: 'usd-123',
        items: [
          { product_id: 'prod-123', quantity: 9, unit_price: 150, unit: 'pcs' }
        ]
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await postInvoiceHandler(req, res);

    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(InventoryMovementService.createMovement).toHaveBeenCalledTimes(1);

    const serviceCallArgs = vi.mocked(InventoryMovementService.createMovement).mock.calls[0];
    const movementLines = serviceCallArgs[1];
    expect(movementLines[0].unit_cost).toBe(150 * 50.0); // 7500 local currency
    expect(movementLines[0].total_cost).toBe(9 * 150 * 50.0); // 67500 local currency
  });
});
