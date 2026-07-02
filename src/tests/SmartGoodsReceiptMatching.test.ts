import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  allocatePurchaseInvoiceBillingToGoodsReceipts, 
  revertPurchaseInvoiceBillingFromGoodsReceipts 
} from '../lib/erp-api';

describe('Smart Goods Receipt Matching FIFO Allocation Engine', () => {
  let mockClient: any;
  let queries: { text: string; params: any[] }[];

  beforeEach(() => {
    queries = [];
    mockClient = {
      query: vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
        queries.push({ text, params });
        const textClean = text.toLowerCase();

        // 1. Mock select goods_receipt_items for ANY Linked Goods Receipts
        if (textClean.includes('from goods_receipt_items') && textClean.includes('goods_receipt_id = any')) {
          return {
            rows: [
              {
                id: 'gri-1',
                goods_receipt_id: 'gr-1',
                product_id: 'prod-A',
                quantity: 10,
                billed_quantity: 2,
                remaining_quantity: 8
              },
              {
                id: 'gri-2',
                goods_receipt_id: 'gr-1',
                product_id: 'prod-B',
                quantity: 5,
                billed_quantity: 0,
                remaining_quantity: 5
              }
            ]
          };
        }

        // 2. Mock select goods_receipt_items for a single Goods Receipt (during status update)
        if (textClean.includes('from goods_receipt_items') && textClean.includes('goods_receipt_id = $1')) {
          // Find updated values from previously executed UPDATE queries in this test run
          const gri1Update = queries.find(q => q.text.includes('UPDATE goods_receipt_items') && q.params[2] === 'gri-1');
          const gri2Update = queries.find(q => q.text.includes('UPDATE goods_receipt_items') && q.params[2] === 'gri-2');

          return {
            rows: [
              {
                id: 'gri-1',
                goods_receipt_id: 'gr-1',
                product_id: 'prod-A',
                quantity: 10,
                billed_quantity: gri1Update ? gri1Update.params[0] : 2,
                remaining_quantity: gri1Update ? gri1Update.params[1] : 8
              },
              {
                id: 'gri-2',
                goods_receipt_id: 'gr-1',
                product_id: 'prod-B',
                quantity: 5,
                billed_quantity: gri2Update ? gri2Update.params[0] : 0,
                remaining_quantity: gri2Update ? gri2Update.params[1] : 5
              }
            ]
          };
        }

        // 3. Mock select supplier_id from goods_receipts
        if (textClean.includes('from goods_receipts') && textClean.includes('where id = $1')) {
          return {
            rows: [
              { id: 'gr-1', supplier_id: 'supplier-123' }
            ]
          };
        }

        // 4. Mock select goods_receipt_id from purchase_invoice_goods_receipts
        if (textClean.includes('from purchase_invoice_goods_receipts') && textClean.includes('purchase_invoice_id = $1')) {
          return {
            rows: [
              { goods_receipt_id: 'gr-1' }
            ]
          };
        }

        // 5. Mock select items from purchase_invoice_items
        if (textClean.includes('from purchase_invoice_items') && textClean.includes('invoice_id = $1')) {
          return {
            rows: [
              { product_id: 'prod-A', quantity: 4 }
            ]
          };
        }

        return { rows: [], rowCount: 0 };
      })
    };
  });

  it('should allocate invoice billing quantity using FIFO and update billing status to partial', async () => {
    const items = [
      { product_id: 'prod-A', quantity: 4, cost_price: 10 },
      { product_id: 'prod-B', quantity: 2, cost_price: 20 }
    ];

    await allocatePurchaseInvoiceBillingToGoodsReceipts(
      mockClient,
      'comp-123',
      'inv-123',
      ['gr-1'],
      items,
      'supplier-123',
      'Supplier name'
    );

    // Verify allocated items updates on goods_receipt_items table
    const updateGri1 = queries.find(q => q.text.includes('UPDATE goods_receipt_items') && q.params[2] === 'gri-1');
    expect(updateGri1).toBeDefined();
    // billed_quantity = 2 (original) + 4 (allocated) = 6
    // remaining_quantity = 8 (original) - 4 (allocated) = 4
    expect(updateGri1?.params[0]).toBe(6);
    expect(updateGri1?.params[1]).toBe(4);

    const updateGri2 = queries.find(q => q.text.includes('UPDATE goods_receipt_items') && q.params[2] === 'gri-2');
    expect(updateGri2).toBeDefined();
    // billed_quantity = 0 (original) + 2 (allocated) = 2
    // remaining_quantity = 5 (original) - 2 (allocated) = 3
    expect(updateGri2?.params[0]).toBe(2);
    expect(updateGri2?.params[1]).toBe(3);

    // Verify Goods Receipt status update to partially_invoiced
    const updateGrStatus = queries.find(q => q.text.includes('UPDATE goods_receipts') && q.text.includes('billing_status'));
    expect(updateGrStatus).toBeDefined();
    expect(updateGrStatus?.params[0]).toBe('partially_invoiced');
  });

  it('should revert billing allocations and restore remaining quantities on Goods Receipt items', async () => {
    await revertPurchaseInvoiceBillingFromGoodsReceipts(mockClient, 'comp-123', 'inv-123');

    // Verify restoration updates on Goods Receipt item
    const restoreGri = queries.find(q => q.text.includes('UPDATE goods_receipt_items') && q.params[2] === 'gri-1');
    expect(restoreGri).toBeDefined();
    // For prod-A (gri-1): billed_quantity 2. We are reverting 4, but billed_quantity is 2.
    // So it restores 2, setting billed_quantity to 0, remaining_quantity to 10.
    expect(restoreGri?.params[0]).toBe(0);
    expect(restoreGri?.params[1]).toBe(10);
  });

  it('should assign supplier_id to Goods Receipt if it was NULL', async () => {
    mockClient.query = vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
      queries.push({ text, params });
      const textClean = text.toLowerCase();

      if (textClean.includes('from goods_receipt_items') && textClean.includes('goods_receipt_id = any')) {
        return {
          rows: [
            {
              id: 'gri-10',
              goods_receipt_id: 'gr-10',
              product_id: 'prod-A',
              quantity: 5,
              billed_quantity: 0,
              remaining_quantity: 5
            }
          ]
        };
      }
      if (textClean.includes('from goods_receipts') && textClean.includes('where id = $1')) {
        return {
          rows: [
            { id: 'gr-10', supplier_id: null } // Supplier is NULL
          ]
        };
      }
      if (textClean.includes('from goods_receipt_items') && textClean.includes('goods_receipt_id = $1')) {
        return {
          rows: [
            { id: 'gri-10', quantity: 5, billed_quantity: 5, remaining_quantity: 0 }
          ]
        };
      }
      return { rows: [], rowCount: 0 };
    });

    await allocatePurchaseInvoiceBillingToGoodsReceipts(
      mockClient,
      'comp-123',
      'inv-555',
      ['gr-10'],
      [{ product_id: 'prod-A', quantity: 5, cost_price: 10 }],
      'supplier-new',
      'Supplier new'
    );

    // Verify supplier_id update on goods_receipts
    const updateGrSupplier = queries.find(q => q.text.includes('UPDATE goods_receipts') && q.text.includes('supplier_id ='));
    expect(updateGrSupplier).toBeDefined();
    expect(updateGrSupplier?.params[0]).toBe('supplier-new');
    expect(updateGrSupplier?.params[1]).toBe('Supplier new');
  });
});
