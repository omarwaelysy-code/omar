import { describe, it, expect, vi } from 'vitest';
import { MigrationSafetyChecker } from './MigrationSafetyChecker';
import { dbService } from './dbService';
import { z } from 'zod';

describe('MigrationSafetyChecker', () => {
  it('identifies invalid records correctly', async () => {
    const mockSchema = z.object({
      id: z.string(),
      value: z.number()
    });

    vi.spyOn(dbService, 'list').mockResolvedValue([
      { id: '1', value: 100 },
      { id: '2', value: 'invalid' } // This should fail
    ]);

    const report = await MigrationSafetyChecker.validateCollection('test', mockSchema, 'c1');
    expect(report.total).toBe(2);
    expect(report.valid).toBe(1);
    expect(report.invalid).toBe(1);
    expect(report.errors[0].id).toBe('2');
  });
});
