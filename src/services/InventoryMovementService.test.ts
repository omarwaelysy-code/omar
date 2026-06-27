import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryMovementService } from './InventoryMovementService.js';
import { PoolClient } from 'pg';

const createMockClient = (registeredTypes: string[] = [
  'goods_receipt', 'purchase', 'purchase_return', 'sales', 'sales_return',
  'warehouse_transfer', 'inventory_adjustment', 'opening_balance',
  'production_receipt', 'production_consumption', 'damage', 'scrap', 'consumption', 'gift'
]) => {
  const queries: { text: string; params: any[] }[] = [];
  const client = {
    query: vi.fn().mockImplementation(async (text: string, params: any[] = []) => {
      queries.push({ text, params });
      const queryClean = text.toLowerCase().trim();

      if (queryClean.includes('select id from inventory_movement_types')) {
        const typeId = params[0];
        const isRegistered = registeredTypes.includes(typeId);
        return { rows: isRegistered ? [{ id: typeId }] : [] };
      }

      return { rows: [], rowCount: 1 };
    })
  } as unknown as PoolClient;

  return { client, queries };
};

describe('InventoryMovementService (Phase 1 - Revised)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateMovement', () => {
    it('should throw an error if company_id is missing', async () => {
      const { client } = createMockClient();
      const movement = { movement_number: 'MOV-001', movement_type: 'purchase', movement_date: '2026-06-27' };
      const lines = [{ product_id: 'prod-1', unit_id: 'pcs-id', quantity: 10, direction: 'IN' as const }];

      await expect(InventoryMovementService.validateMovement(client, movement, lines))
        .rejects.toThrow('Company ID is required.');
    });

    it('should throw an error if movement_number is missing', async () => {
      const { client } = createMockClient();
      const movement = { company_id: 'comp-1', movement_type: 'purchase', movement_date: '2026-06-27' };
      const lines = [{ product_id: 'prod-1', unit_id: 'pcs-id', quantity: 10, direction: 'IN' as const }];

      await expect(InventoryMovementService.validateMovement(client, movement, lines))
        .rejects.toThrow('Movement number is required.');
    });

    it('should throw an error if movement_type is missing', async () => {
      const { client } = createMockClient();
      const movement = { company_id: 'comp-1', movement_number: 'MOV-001', movement_date: '2026-06-27' };
      const lines = [{ product_id: 'prod-1', unit_id: 'pcs-id', quantity: 10, direction: 'IN' as const }];

      await expect(InventoryMovementService.validateMovement(client, movement, lines))
        .rejects.toThrow('Movement type is required.');
    });

    it('should throw an error if movement_date is missing', async () => {
      const { client } = createMockClient();
      const movement = { company_id: 'comp-1', movement_number: 'MOV-001', movement_type: 'purchase' };
      const lines = [{ product_id: 'prod-1', unit_id: 'pcs-id', quantity: 10, direction: 'IN' as const }];

      await expect(InventoryMovementService.validateMovement(client, movement, lines))
        .rejects.toThrow('Movement date is required.');
    });

    it('should throw an error if movement_type is unregistered', async () => {
      const { client } = createMockClient();
      const movement = { company_id: 'comp-1', movement_number: 'MOV-001', movement_type: 'unregistered-type', movement_date: '2026-06-27' };
      const lines = [{ product_id: 'prod-1', unit_id: 'pcs-id', quantity: 10, direction: 'IN' as const }];

      await expect(InventoryMovementService.validateMovement(client, movement, lines))
        .rejects.toThrow('Movement type "unregistered-type" is not registered.');
    });

    it('should throw an error if lines array is empty', async () => {
      const { client } = createMockClient();
      const movement = { company_id: 'comp-1', movement_number: 'MOV-001', movement_type: 'purchase', movement_date: '2026-06-27' };

      await expect(InventoryMovementService.validateMovement(client, movement, []))
        .rejects.toThrow('Movement must contain at least one line.');
    });

    it('should throw an error if line quantity is negative or zero', async () => {
      const { client } = createMockClient();
      const movement = { company_id: 'comp-1', movement_number: 'MOV-001', movement_type: 'purchase', movement_date: '2026-06-27' };
      const lines = [{ product_id: 'prod-1', unit_id: 'pcs-id', quantity: -5, direction: 'IN' as const }];

      await expect(InventoryMovementService.validateMovement(client, movement, lines))
        .rejects.toThrow('Line 1: Quantity must be greater than zero.');
    });

    it('should throw an error if line direction is invalid', async () => {
      const { client } = createMockClient();
      const movement = { company_id: 'comp-1', movement_number: 'MOV-001', movement_type: 'purchase', movement_date: '2026-06-27' };
      const lines = [{ product_id: 'prod-1', unit_id: 'pcs-id', quantity: 10, direction: 'invalid-dir' as any }];

      await expect(InventoryMovementService.validateMovement(client, movement, lines))
        .rejects.toThrow('Line 1: Direction must be "IN" or "OUT".');
    });

    it('should pass validation if all details are correct', async () => {
      const { client } = createMockClient();
      const movement = { company_id: 'comp-1', movement_number: 'MOV-001', movement_type: 'purchase', movement_date: '2026-06-27' };
      const lines = [
        { product_id: 'prod-1', unit_id: 'pcs-id', quantity: 10, direction: 'IN' as const },
        { product_id: 'prod-2', unit_id: 'box-id', quantity: 2, direction: 'OUT' as const }
      ];

      await expect(InventoryMovementService.validateMovement(client, movement, lines))
        .resolves.not.toThrow();
    });
  });

  describe('createMovementDryRun', () => {
    it('should simulate records and assign unique IDs but not touch DB', async () => {
      const { client, queries } = createMockClient();
      const movement = { company_id: 'comp-1', movement_number: 'MOV-001', movement_type: 'purchase', movement_date: '2026-06-27' };
      const lines = [
        { product_id: 'prod-1', unit_id: 'pcs-id', quantity: 10, direction: 'IN' as const, unit_cost: 15 }
      ];

      const result = await InventoryMovementService.createMovementDryRun(client, movement, lines);

      expect(result.movement.id).toBeDefined();
      expect(result.movement.movement_number).toBe('MOV-001');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].id).toBeDefined();
      expect(result.lines[0].movement_id).toBe(result.movement.id);
      expect(result.lines[0].total_cost).toBe(150);
      expect(result.lines[0].direction).toBe('IN');

      // Verify that database inserts were NOT run (only validation select query occurred)
      const insertQueries = queries.filter(q => q.text.toLowerCase().includes('insert'));
      expect(insertQueries).toHaveLength(0);
    });
  });

  describe('createMovement (with transactions)', () => {
    it('should validate and insert header and detail rows', async () => {
      const { client, queries } = createMockClient();
      
      const movement = { 
        company_id: 'comp-1', 
        branch_id: 'branch-1',
        movement_number: 'MOV-001', 
        movement_type: 'purchase', 
        movement_date: '2026-06-27' 
      };
      const lines = [
        { product_id: 'prod-1', unit_id: 'pcs-id', quantity: 10, direction: 'IN' as const, unit_cost: 15 }
      ];

      const result = await InventoryMovementService.createMovement(movement, lines, client);

      expect(result.movement.id).toBeDefined();
      expect(result.movement.branch_id).toBe('branch-1');
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].movement_id).toBe(result.movement.id);
      expect(result.lines[0].unit_id).toBe('pcs-id');

      // Validate database interactions
      const insertHeader = queries.find(q => q.text.includes('inventory_movements_v2'));
      const insertLine = queries.find(q => q.text.includes('inventory_movement_lines'));

      expect(insertHeader).toBeDefined();
      expect(insertLine).toBeDefined();

      // Since we passed client directly, it should NOT trigger local transaction commands (BEGIN/COMMIT)
      const txQueries = queries.filter(q => q.text.includes('BEGIN') || q.text.includes('COMMIT'));
      expect(txQueries).toHaveLength(0);
    });
  });
});
