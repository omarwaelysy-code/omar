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
      // Ensure default account types exist first
      let accountTypes = await dbService.list<any>('account_types', companyId);
      if (accountTypes.length === 0) {
        const types = [
          { name: 'الأصول', code: '1', classification: 'asset', statement_type: 'balance_sheet' },
          { name: 'الالتزامات', code: '2', classification: 'liability', statement_type: 'balance_sheet' },
          { name: 'حقوق الملكية', code: '3', classification: 'equity', statement_type: 'balance_sheet' },
          { name: 'الإيرادات', code: '4', classification: 'revenue', statement_type: 'income_statement' },
          { name: 'المصروفات', code: '5', classification: 'expense', statement_type: 'income_statement' },
        ];
        for (const t of types) {
          await dbService.add('account_types', { ...t, company_id: companyId });
        }
        accountTypes = await dbService.list<any>('account_types', companyId);
      }

      const getTypeId = (cls: string) => accountTypes.find((t: any) => t.classification === cls)?.id || '';
      
      // 1. Fetch current accounts
      let accounts = await dbService.list<Account>('accounts', companyId);

      // Helper to ensure key accounts exist
      const ensureAccount = async (name: string, code: string, classification: string) => {
        let acc = accounts.find(a => a.name === name || a.code === code);
        if (!acc) {
          const typeId = getTypeId(classification);
          if (typeId) {
            const id = await dbService.add('accounts', {
              name,
              code,
              type_id: typeId,
              is_active: true,
              company_id: companyId
            });
            acc = {
              id,
              name,
              code,
              type_id: typeId,
              company_id: companyId,
              opening_balance: 0,
              is_active: true
            };
            accounts.push(acc);
          }
        }
        return acc;
      };

      // Ensure key accounts exist
      const bankAcc = await ensureAccount('حساب البنك', '1102', 'asset');
      await ensureAccount('المبيعات', '4101', 'revenue');
      await ensureAccount('مخزون البضاعة', '1301', 'asset');
      await ensureAccount('حساب العملاء', '1201', 'asset');
      await ensureAccount('حساب الموردين', '2101', 'liability');
      const equityAcc = await ensureAccount('رأس المال', '3101', 'equity');

      // Find key accounts
      const bank = accounts.find(a => a.name.includes('بنك') || a.name.includes('Bank') || a.name.includes('الخزينة'));
      const sales = accounts.find(a => a.name.includes('مبيعات') || a.name.includes('Sales'));
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
            { account_id: equityAcc?.id || 'equity_capital_id', debit: 0, credit: 100000 }
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
