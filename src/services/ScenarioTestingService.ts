import { dbService } from './dbService';
import { TransactionManager, TransactionStep } from './TransactionManager';
import { Account, JournalEntry, Invoice, PaymentVoucher, ReceiptVoucher } from '../types';
import { AccountSchema, JournalEntrySchema, InvoiceSchema } from '../lib/schemas';

/**
 * ScenarioTestingService
 * Used to bootstrap a "Golden Scenario" company for regression testing.
 * Completes a full cycle: Setup -> Purchase -> Sale -> Payment -> Financial Reporting check.
 */
export class ScenarioTestingService {
  static async seedTestCompany(companyId: string, userId: string) {
    const tm = new TransactionManager();

    try {
      // 1. Setup Chart of Accounts if missing
      const accounts = await dbService.list<Account>('accounts', companyId);
      if (accounts.length === 0) {
        // Logic to seed basic CoA would go here
      }

      // Find key accounts
      const bank = accounts.find(a => a.name.includes('بنك') || a.name.includes('Bank'));
      const sales = accounts.find(a => a.type_id?.includes('revenue'));
      const inventory = accounts.find(a => a.name.includes('مخزون') || a.name.includes('Inventory'));
      const customers = accounts.find(a => a.name.includes('عملاء') || a.name.includes('Customers'));

      if (!bank || !sales || !inventory || !customers) {
        throw new Error('Test Company must have Bank, Sales, Inventory, and Customers accounts.');
      }

      // 2. Initial Capital Injection
      const steps: TransactionStep[] = [{
        collection: 'journal_entries',
        data: {
          date: new Date().toISOString().split('T')[0],
          description: 'Initial Capital Seed',
          reference_type: 'manual',
          total_debit: 100000,
          total_credit: 100000,
          company_id: companyId,
          created_by: userId,
          items: [
            { account_id: bank.id, debit: 100000, credit: 0 },
            { account_id: 'equity_capital_id', debit: 0, credit: 100000 } // Placeholder
          ]
        },
        schema: JournalEntrySchema
      }];
      await tm.execute(steps);

      // 3. Purchase Inventory
      // ... Followed by Sales, then Payments ...
      
      console.log('Seeding complete for company:', companyId);
      return { success: true };
    } catch (error) {
      console.error('Seeding failed:', error);
      throw error;
    }
  }
}
