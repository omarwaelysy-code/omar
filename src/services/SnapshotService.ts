import { dbService } from './dbService';
import { JournalEntry, Account, AccountType } from '../types';

export interface DatabaseSnapshot {
  timestamp: string;
  version: string;
  company_id: string;
  data: {
    accounts: Account[];
    journal_entries: JournalEntry[];
    account_types: AccountType[];
  };
}

export class SnapshotService {
  static async createSnapshot(companyId: string): Promise<DatabaseSnapshot> {
    console.log(`[SnapshotService] Creating point-in-time snapshot for company ${companyId}`);
    
    const [accounts, journal_entries, account_types] = await Promise.all([
      dbService.list<Account>('accounts', companyId),
      dbService.list<JournalEntry>('journal_entries', companyId),
      dbService.list<AccountType>('account_types', companyId)
    ]);

    const snapshot: DatabaseSnapshot = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      company_id: companyId,
      data: {
        accounts,
        journal_entries,
        account_types
      }
    };

    // In a real scenario, we'd save this to a 'snapshots' collection
    // await dbService.add('snapshots', snapshot);
    
    return snapshot;
  }

  static async verifySnapshot(snapshot: DatabaseSnapshot): Promise<boolean> {
    // Basic verification of data integrity within snapshot
    if (!snapshot.company_id || !snapshot.data.accounts) return false;
    return snapshot.data.accounts.length > 0;
  }
}
