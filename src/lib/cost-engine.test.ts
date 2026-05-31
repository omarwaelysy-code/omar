import { describe, it, expect, vi } from 'vitest';
import { recordPurchase, recordSale, recordSalesReturn, recordPurchaseReturn, recalculateProductStock } from './cost-engine';
import { PoolClient } from 'pg';

describe('Inventory Costing Engine', () => {
  const mockCompanyId = 'company-123';
  const mockProductId = 'product-abc';

  // Helper mock client
  const createMockClient = (settings: any, product: any, layers: any[] = []) => {
    return {
      query: vi.fn().mockImplementation((queryText: string, params: any[]) => {
        const queryClean = queryText.toLowerCase().trim();

        if (queryClean.includes('select settings from companies')) {
          return { rows: [{ settings }] };
        }
        if (queryClean.includes('select cost_price, stock from products') || queryClean.includes('select cost_price, stock, weighted_average_cost from products') || queryClean.includes('select * from products')) {
          return { rows: [product] };
        }
        if (queryClean.includes('select * from inventory_layers')) {
          return { rows: layers };
        }
        if (queryClean.includes('select unit_cost from invoice_items')) {
          return { rows: [{ unit_cost: 15 }] };
        }
        // default empty
        return { rows: [], rowCount: 1 };
      })
    } as unknown as PoolClient;
  };

  it('calculates Weighted Average Cost (WAC) correctly on purchase', async () => {
    const settings = { inventory_cost_method: 'wac' };
    const product = { id: mockProductId, cost_price: 10, stock: 5 }; // old total value = 50
    const client = createMockClient(settings, product);

    // Purchase 5 units at cost $20 (new addition = 100)
    // New Stock = 10. New total value = 150. New Cost = 15.
    const result = await recordPurchase(
      client,
      mockCompanyId,
      'test_warehouse_id',
      mockProductId,
      5,
      20,
      'ref-invoice-1',
      'PINV-001',
      '2026-05-20'
    );

    expect(result.unitCost).toBe(20);
    expect(result.totalCost).toBe(100);
    expect(result.methodUsed).toBe('wac');

    // Verify correct queries were fired
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE products'),
      [5, 15, mockProductId]
    );
  });

  it('determines the sale cost based on current cost price under WAC', async () => {
    const settings = { inventory_cost_method: 'wac' };
    const product = { id: mockProductId, cost_price: 15, stock: 10 };
    const client = createMockClient(settings, product);

    // Sale of 2 units
    const result = await recordSale(
      client,
      mockCompanyId,
      'test_warehouse_id',
      mockProductId,
      2,
      'ref-invoice-2',
      'INV-002',
      '2026-05-20'
    );

    expect(result.unitCost).toBe(15);
    expect(result.totalCost).toBe(30);
    expect(result.methodUsed).toBe('wac');
  });

  it('satisfies FIFO layer selection correctly', async () => {
    const settings = { inventory_cost_method: 'fifo' };
    const product = { id: mockProductId, cost_price: 15, stock: 10 };
    // Layers ordered by date ASC
    const activeLayers = [
      { id: 'layer-1', qty_remaining: 3, unit_cost: 10 }, // First layer
      { id: 'layer-2', qty_remaining: 5, unit_cost: 18 }  // Second layer
    ];
    const client = createMockClient(settings, product, activeLayers);

    // Sale of 5 units under FIFO:
    // Takes 3 from layer-1 @ $10 ($30)
    // Takes 2 from layer-2 @ $18 ($36)
    // Total cost = $66. Unit cost = $13.2
    const result = await recordSale(
      client,
      mockCompanyId,
      'test_warehouse_id',
      mockProductId,
      5,
      'ref-invoice-3',
      'INV-003',
      '2026-05-20'
    );

    expect(result.unitCost).toBe(13.2);
    expect(result.totalCost).toBe(66);
    expect(result.methodUsed).toBe('fifo');

    // Verify the layers decrement queries were requested
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inventory_layers SET qty_remaining = qty_remaining - $1 WHERE id = $2'),
      [3, 'layer-1']
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inventory_layers SET qty_remaining = qty_remaining - $1 WHERE id = $2'),
      [2, 'layer-2']
    );
  });

  it('satisfies LIFO layer selection correctly', async () => {
    const settings = { inventory_cost_method: 'lifo' };
    const product = { id: mockProductId, cost_price: 15, stock: 10 };
    // Layers ordered by date DESC
    const activeLayers = [
      { id: 'layer-2', qty_remaining: 5, unit_cost: 18 }, // Most recent layer under LIFO
      { id: 'layer-1', qty_remaining: 3, unit_cost: 10 }
    ];
    const client = createMockClient(settings, product, activeLayers);

    // Sale of 4 units under LIFO:
    // Takes 4 from layer-2 @ $18 ($72)
    // Total cost = $72. Unit cost = $18
    const result = await recordSale(
      client,
      mockCompanyId,
      'test_warehouse_id',
      mockProductId,
      4,
      'ref-invoice-4',
      'INV-004',
      '2026-05-20'
    );

    expect(result.unitCost).toBe(18);
    expect(result.totalCost).toBe(72);
    expect(result.methodUsed).toBe('lifo');

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inventory_layers SET qty_remaining = qty_remaining - $1 WHERE id = $2'),
      [4, 'layer-2']
    );
  });

  it('saves sales returns to correct structures', async () => {
    const settings = { inventory_cost_method: 'fifo' };
    const product = { id: mockProductId, cost_price: 15, stock: 10 };
    const client = createMockClient(settings, product);

    const result = await recordSalesReturn(
      client,
      mockCompanyId,
      'test_warehouse_id',
      mockProductId,
      2,
      15,
      'return-id-1',
      'RET-001',
      '2026-05-20'
    );

    expect(result.unitCost).toBe(15);
    expect(result.totalCost).toBe(30);
    expect(result.methodUsed).toBe('fifo');

    // Fired layered return
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO inventory_layers'),
      expect.any(Array)
    );
  });

  it('saves purchase returns to correct structures', async () => {
    const settings = { inventory_cost_method: 'fifo' };
    const product = { id: mockProductId, cost_price: 15, stock: 10 };
    const layers = [{ id: 'layer-p', qty_remaining: 5, unit_cost: 15 }];
    const client = createMockClient(settings, product, layers);

    const result = await recordPurchaseReturn(
      client,
      mockCompanyId,
      'test_warehouse_id',
      mockProductId,
      2,
      15,
      'preturn-id-2',
      'PRET-002',
      '2026-05-20'
    );

    expect(result.unitCost).toBe(15);
    expect(result.totalCost).toBe(30);
    expect(result.methodUsed).toBe('fifo');

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inventory_layers SET qty_remaining = qty_remaining - $1 WHERE id = $2'),
      [2, 'layer-p']
    );
  });

  it('recalculates stock and FIFO layers / costs correctly on recalculateProductStock', async () => {
    const settings = { inventory_cost_method: 'fifo' };
    const product = { id: mockProductId, cost_price: 15, stock: 10, weighted_average_cost: 15 };
    
    const dbLayers: any[] = [];
    const movements = [
      { id: 'move-1', date: '2026-05-01', quantity: '5.00', unit_cost: '10.00', total_cost: '50.00', movement_type: 'purchase', reference_type: 'purchase_invoice', reference_id: 'ref-1', created_at: new Date('2026-05-01T00:00:00Z') },
      { id: 'move-2', date: '2026-05-02', quantity: '5.00', unit_cost: '20.00', total_cost: '100.00', movement_type: 'purchase', reference_type: 'purchase_invoice', reference_id: 'ref-2', created_at: new Date('2026-05-02T00:00:00Z') },
      { id: 'move-3', date: '2026-05-03', quantity: '-7.00', unit_cost: '0.00', total_cost: '0.00', movement_type: 'sale', reference_type: 'invoice', reference_id: 'ref-3', created_at: new Date('2026-05-03T00:00:00Z') }
    ];

    const client = {
      query: vi.fn().mockImplementation(async (queryText: string, params: any[]) => {
        const queryClean = queryText.toLowerCase().trim();
        if (queryClean.includes('select settings from companies')) {
          return { rows: [{ settings }] };
        }
        if (queryClean.includes('select cost_price, weighted_average_cost from products')) {
          return { rows: [product] };
        }
        if (queryClean.includes('select * from inventory_movements')) {
          return { rows: movements };
        }
        if (queryClean.includes('delete from inventory_layers')) {
          dbLayers.length = 0;
          return { rows: [], rowCount: 1 };
        }
        if (queryClean.includes('insert into inventory_layers')) {
          dbLayers.push({
            id: params[0],
            purchase_date: params[3],
            qty_remaining: params[5],
            unit_cost: params[6],
            created_at: params[9]
          });
          return { rows: [], rowCount: 1 };
        }
        if (queryClean.includes('select * from inventory_layers')) {
          const isDesc = queryClean.includes('desc');
          const sorted = [...dbLayers].filter(l => l.qty_remaining > 0).sort((a, b) => {
            const dateDiff = new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime();
            if (dateDiff !== 0) return isDesc ? -dateDiff : dateDiff;
            return isDesc ? b.created_at - a.created_at : a.created_at - b.created_at;
          });
          return { rows: sorted };
        }
        if (queryClean.includes('update inventory_layers')) {
          const decr = params[0];
          const id = params[1];
          const l = dbLayers.find(x => x.id === id);
          if (l) l.qty_remaining -= decr;
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      })
    } as unknown as PoolClient;

    await recalculateProductStock(client, mockCompanyId, mockProductId);

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM inventory_layers'),
      [mockProductId, mockCompanyId]
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inventory_movements'),
      [12.857142857142858, -90, 'move-3']
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE invoice_items'),
      [12.857142857142858, 90, 'ref-3', mockProductId]
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE products'),
      [3, 20, mockProductId]
    );
  });

  it('recalculates stock and LIFO layers / costs correctly on recalculateProductStock', async () => {
    const settings = { inventory_cost_method: 'lifo' };
    const product = { id: mockProductId, cost_price: 15, stock: 10, weighted_average_cost: 15 };
    
    const dbLayers: any[] = [];
    const movements = [
      { id: 'move-1', date: '2026-05-01', quantity: '5.00', unit_cost: '10.00', total_cost: '50.00', movement_type: 'purchase', reference_type: 'purchase_invoice', reference_id: 'ref-1', created_at: new Date('2026-05-01T00:00:00Z') },
      { id: 'move-2', date: '2026-05-02', quantity: '5.00', unit_cost: '20.00', total_cost: '100.00', movement_type: 'purchase', reference_type: 'purchase_invoice', reference_id: 'ref-2', created_at: new Date('2026-05-02T00:00:00Z') },
      { id: 'move-3', date: '2026-05-03', quantity: '-7.00', unit_cost: '0.00', total_cost: '0.00', movement_type: 'sale', reference_type: 'invoice', reference_id: 'ref-3', created_at: new Date('2026-05-03T00:00:00Z') }
    ];

    const client = {
      query: vi.fn().mockImplementation(async (queryText: string, params: any[]) => {
        const queryClean = queryText.toLowerCase().trim();
        if (queryClean.includes('select settings from companies')) {
          return { rows: [{ settings }] };
        }
        if (queryClean.includes('select cost_price, weighted_average_cost from products')) {
          return { rows: [product] };
        }
        if (queryClean.includes('select * from inventory_movements')) {
          return { rows: movements };
        }
        if (queryClean.includes('delete from inventory_layers')) {
          dbLayers.length = 0;
          return { rows: [], rowCount: 1 };
        }
        if (queryClean.includes('insert into inventory_layers')) {
          dbLayers.push({
            id: params[0],
            purchase_date: params[3],
            qty_remaining: params[5],
            unit_cost: params[6],
            created_at: params[9]
          });
          return { rows: [], rowCount: 1 };
        }
        if (queryClean.includes('select * from inventory_layers')) {
          const isDesc = queryClean.includes('desc');
          const sorted = [...dbLayers].filter(l => l.qty_remaining > 0).sort((a, b) => {
            const dateDiff = new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime();
            if (dateDiff !== 0) return isDesc ? -dateDiff : dateDiff;
            return isDesc ? b.created_at - a.created_at : a.created_at - b.created_at;
          });
          return { rows: sorted };
        }
        if (queryClean.includes('update inventory_layers')) {
          const decr = params[0];
          const id = params[1];
          const l = dbLayers.find(x => x.id === id);
          if (l) l.qty_remaining -= decr;
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      })
    } as unknown as PoolClient;

    await recalculateProductStock(client, mockCompanyId, mockProductId);

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inventory_movements'),
      [17.142857142857142, -120, 'move-3']
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE invoice_items'),
      [17.142857142857142, 120, 'ref-3', mockProductId]
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE products'),
      [3, 20, mockProductId]
    );
  });
});
