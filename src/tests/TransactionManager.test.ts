import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionManager } from '../services/TransactionManager';
import { dbService } from '../services/dbService';
import { z } from 'zod';

// Mock dbService
vi.mock('../services/dbService', () => ({
  dbService: {
    add: vi.fn(),
    addWithId: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('TransactionManager (Manual Rollback)', () => {
  let manager: TransactionManager;

  beforeEach(() => {
    manager = new TransactionManager();
    vi.clearAllMocks();
  });

  it('should successfully execute multiple steps', async () => {
    vi.mocked(dbService.add).mockResolvedValueOnce('id-1').mockResolvedValueOnce('id-2');

    const steps = [
      { collection: 'coll1', data: { name: 'item 1' } },
      { collection: 'coll2', data: { name: 'item 2' } },
    ];

    const result = await manager.execute(steps);

    expect(result.success).toBe(true);
    expect(result.ids).toHaveLength(2);
    expect(dbService.add).toHaveBeenCalledTimes(2);
    expect(dbService.delete).not.toHaveBeenCalled();
  });

  it('should validate data against schema and fail if invalid', async () => {
    const schema = z.object({ count: z.number() });
    const steps = [
      { collection: 'coll1', data: { count: 'not a number' }, schema }
    ];

    await expect(manager.execute(steps)).rejects.toThrow();
    expect(dbService.add).not.toHaveBeenCalled();
  });

  it('should rollback previous steps if a middle step fails', async () => {
    // First step succeeds
    vi.mocked(dbService.add).mockResolvedValueOnce('id-1');
    // Second step fails
    vi.mocked(dbService.add).mockRejectedValueOnce(new Error('DB Failure'));

    const steps = [
      { collection: 'coll1', data: { name: 'item 1' } },
      { collection: 'coll2', data: { name: 'item 2' } },
    ];

    await expect(manager.execute(steps)).rejects.toThrow('DB Failure');

    // Verify rollback
    expect(dbService.add).toHaveBeenCalledTimes(2);
    expect(dbService.delete).toHaveBeenCalledWith('coll1', 'id-1');
  });

  it('should handle accounting transaction helper correctly', async () => {
    vi.mocked(dbService.add).mockResolvedValueOnce('invoice-id').mockResolvedValueOnce('journal-id');

    const mainSchema = z.object({ amount: z.number() });
    const journalSchema = z.object({ 
      reference_id: z.string(), 
      items: z.array(z.any()) 
    });

    const result = await TransactionManager.saveWithAccounting(
      'invoices',
      { amount: 100 },
      mainSchema,
      { items: [] },
      journalSchema
    );

    expect(result.mainId).toBe('invoice-id');
    expect(result.journalId).toBe('journal-id');
    
    // Check that reference_id was injected
    expect(dbService.add).toHaveBeenLastCalledWith('journal_entries', expect.objectContaining({
      reference_id: 'invoice-id'
    }));
  });
});
