import { dbService } from './dbService';
import { TransactionManager, TransactionStep } from './TransactionManager';
import { JournalEntrySchema } from '../lib/schemas';

/**
 * LoadTestScenario
 * Simulates high-frequency transactional load to stress test the AccountingEngine 
 * and TransactionManager concurrency safety.
 */
export class LoadTestScenario {
  static async runBurst(companyId: string, userId: string, iterations: number = 100) {
    const tm = new TransactionManager();
    const startTime = performance.now();
    
    console.log(`[LoadTest] Starting burst of ${iterations} parallel transactions...`);

    const promises = Array.from({ length: iterations }).map((_, i) => {
      const amount = Math.floor(Math.random() * 1000) + 1;
      const steps: TransactionStep[] = [{
        collection: 'journal_entries',
        data: {
          date: new Date().toISOString().split('T')[0],
          description: `Load Test Entry #${i}`,
          reference_type: 'manual',
          total_debit: amount,
          total_credit: amount,
          company_id: companyId,
          created_by: userId,
          items: [
            { account_id: 'cash_account_id', debit: amount, credit: 0 },
            { account_id: 'revenue_account_id', debit: 0, credit: amount }
          ]
        },
        schema: JournalEntrySchema
      }];
      return tm.execute(steps);
    });

    const results = await Promise.allSettled(promises);
    const endTime = performance.now();
    
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[LoadTest] Burst completed in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`[LoadTest] Success: ${succeeded}, Failed: ${failed}`);

    return {
      duration: endTime - startTime,
      succeeded,
      failed
    };
  }
}
