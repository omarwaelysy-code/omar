import { JournalEntry, Account, TrialBalanceItem, LedgerLine, AccountType } from '../types';

export class AccountingEngine {
  /**
   * Calculates the Trial Balance for a given set of accounts and journal entries.
   */
  static calculateTrialBalance(
    accounts: Account[],
    entries: JournalEntry[],
    startDate: string,
    endDate: string
  ) {
    const startTime = performance.now();
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const result = accounts.map(account => {
      let openingDebit = account.opening_balance > 0 ? account.opening_balance : 0;
      let openingCredit = account.opening_balance < 0 ? Math.abs(account.opening_balance) : 0;
      let movementDebit = 0;
      let movementCredit = 0;

      entries.forEach(entry => {
        const entryDate = new Date(entry.date);
        entry.items?.forEach(item => {
          if (item.account_id === account.id) {
            if (entryDate < start) {
              openingDebit += item.debit;
              openingCredit += item.credit;
            } else if (entryDate >= start && entryDate <= end) {
              movementDebit += item.debit;
              movementCredit += item.credit;
            }
          }
        });
      });

      const openingBalanceAdjusted = openingDebit - openingCredit;
      const closingBalance = openingBalanceAdjusted + (movementDebit - movementCredit);

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        opening: {
          debit: openingBalanceAdjusted > 0 ? openingBalanceAdjusted : 0,
          credit: openingBalanceAdjusted < 0 ? Math.abs(openingBalanceAdjusted) : 0
        },
        movement: {
          debit: movementDebit,
          credit: movementCredit
        },
        closing: {
          debit: closingBalance > 0 ? closingBalance : 0,
          credit: closingBalance < 0 ? Math.abs(closingBalance) : 0
        }
      };
    });
    const endTime = performance.now();
    console.debug(`[AccountingPerformance] TrialBalance calculated in ${(endTime - startTime).toFixed(2)}ms for ${accounts.length} accounts and ${entries.length} entries`);
    return result;
  }

  /**
   * Calculates the General Ledger for a specific account.
   */
  static calculateLedger(
    account: Account,
    entries: JournalEntry[],
    startDate: string,
    endDate: string,
    entityIds?: string[]
  ): { lines: LedgerLine[]; openingBalance: number } {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let openingDebit = account.opening_balance > 0 ? account.opening_balance : 0;
    let openingCredit = account.opening_balance < 0 ? Math.abs(account.opening_balance) : 0;
    
    const relevantEntries: LedgerLine[] = [];

    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      entry.items?.forEach(item => {
        if (item.account_id === account.id) {
          // Apply entity filter if provided
          if (entityIds && entityIds.length > 0) {
            const matchesEntity = entityIds.includes(item.customer_id || '') || 
                                entityIds.includes(item.supplier_id || '');
            if (!matchesEntity) return;
          }

          if (entryDate < start) {
            openingDebit += item.debit;
            openingCredit += item.credit;
          } else if (entryDate >= start && entryDate <= end) {
            relevantEntries.push({
              id: entry.id || '',
              date: entry.date,
              reference: entry.reference_number || '',
              description: item.description || entry.description,
              debit: item.debit,
              credit: item.credit,
              balance: 0,
              entity_name: item.customer_name || item.supplier_name
            });
          }
        }
      });
    });

    // Sort by date
    relevantEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = openingDebit - openingCredit;
    const openingBalanceTotal = runningBalance;
    
    const lines: LedgerLine[] = relevantEntries.map(line => {
      runningBalance += (line.debit - line.credit);
      return { ...line, balance: runningBalance };
    });

    return { lines, openingBalance: openingBalanceTotal };
  }

  /**
   * Validates if the total system is balanced (Total Debits = Total Credits).
   */
  static validateGlobalBalance(entries: JournalEntry[]): { isBalanced: boolean; difference: number } {
    let totalDebit = 0;
    let totalCredit = 0;

    entries.forEach(entry => {
      entry.items?.forEach(item => {
        totalDebit += item.debit;
        totalCredit += item.credit;
      });
    });

    const difference = totalDebit - totalCredit;
    return {
      isBalanced: Math.abs(difference) < 0.01,
      difference
    };
  }

  /**
   * Calculates Income Statement data.
   */
  static calculateIncomeStatement(
    accounts: Account[],
    accountTypes: AccountType[],
    entries: JournalEntry[],
    startDate: string,
    endDate: string
  ) {
    const trialBalance = this.calculateTrialBalance(accounts, entries, startDate, endDate);
    
    // Map classifications to accounts in trial balance
    const mappedAccounts = trialBalance.map(a => {
      const type = accountTypes.find(t => t.id === (accounts.find(acc => acc.id === a.id)?.type_id));
      return { ...a, typeInfo: type };
    });

    const isAccounts = mappedAccounts.filter(a => a.typeInfo?.statement_type === 'income_statement');
    
    const revenues = isAccounts.filter(a => a.typeInfo?.classification === 'revenue');
    const costs = isAccounts.filter(a => a.typeInfo?.classification === 'cost');
    const expenses = isAccounts.filter(a => a.typeInfo?.classification === 'expense');

    const totalRevenues = revenues.reduce((sum, a) => sum + (a.closing.credit - a.closing.debit), 0);
    const totalCosts = costs.reduce((sum, a) => sum + (a.closing.debit - a.closing.credit), 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + (a.closing.debit - a.closing.credit), 0);

    const grossProfit = totalRevenues - totalCosts;
    const netProfit = grossProfit - totalExpenses;

    return {
      revenues: revenues.map(r => ({ id: r.id, name: r.name, balance: r.closing.credit - r.closing.debit })),
      costs: costs.map(c => ({ id: c.id, name: c.name, balance: c.closing.debit - c.closing.credit })),
      expenses: expenses.map(e => ({ id: e.id, name: e.name, balance: e.closing.debit - e.closing.credit })),
      totalRevenues,
      totalCosts,
      grossProfit,
      totalExpenses,
      netProfit
    };
  }

  /**
   * Calculates Balance Sheet data.
   */
  static calculateBalanceSheet(
    accounts: Account[],
    accountTypes: AccountType[],
    entries: JournalEntry[],
    endDate: string
  ) {
    // For Balance Sheet, we use trial balance from beginning of time until endDate
    const startDate = '2000-01-01'; 
    const trialBalance = this.calculateTrialBalance(accounts, entries, startDate, endDate);

    // Map classifications
    const mappedAccounts = trialBalance.map(a => {
      const type = accountTypes.find(t => t.id === (accounts.find(acc => acc.id === a.id)?.type_id));
      return { ...a, typeInfo: type };
    });

    const bsAccounts = mappedAccounts.filter(a => a.typeInfo?.statement_type === 'balance_sheet');
    
    // Calculate Net Profit for the period up to targetDate
    const incomeStatement = this.calculateIncomeStatement(accounts, accountTypes, entries, startDate, endDate);
    
    const assets = bsAccounts.filter(a => a.typeInfo?.classification === 'asset');
    const liabilitiesEquity = bsAccounts.filter(a => a.typeInfo?.classification === 'liability_equity');

    const totalAssets = assets.reduce((sum, a) => sum + (a.closing.debit - a.closing.credit), 0);
    const liabilitiesEquitySum = liabilitiesEquity.reduce((sum, a) => sum + (a.closing.credit - a.closing.debit), 0);
    
    const totalLiabilitiesEquity = liabilitiesEquitySum + incomeStatement.netProfit;

    // Additional Diagnostics
    const entriesBeforeDate = entries.filter(e => new Date(e.date) <= new Date(endDate));
    const globalCheck = this.validateGlobalBalance(entriesBeforeDate);

    const unbalancedEntries: string[] = [];
    const missingAccountEntries: string[] = [];
    let globalDebit = 0;
    let globalCredit = 0;

    entriesBeforeDate.forEach(entry => {
      let entryDebit = 0;
      let entryCredit = 0;
      entry.items?.forEach(item => {
        entryDebit += item.debit;
        entryCredit += item.credit;
        globalDebit += item.debit;
        globalCredit += item.credit;

        if (!accounts.find(a => a.id === item.account_id)) {
          missingAccountEntries.push(`${entry.description || 'No Description'} (Missing Account ID: ${item.account_id})`);
        }
      });
      if (Math.abs(entryDebit - entryCredit) > 0.01) {
        unbalancedEntries.push(`${entry.description || 'No Description'} (Ref: ${entry.reference_number || 'N/A'}, Diff: ${entryDebit - entryCredit})`);
      }
    });

    return {
      assets: assets.map(a => ({ id: a.id, name: a.name, balance: a.closing.debit - a.closing.credit })),
      liabilitiesEquity: liabilitiesEquity.map(l => ({ id: l.id, name: l.name, balance: l.closing.credit - l.closing.debit })),
      netProfit: incomeStatement.netProfit,
      totalAssets,
      totalLiabilitiesEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesEquity) < 0.01,
      diagnostics: {
        difference: totalAssets - totalLiabilitiesEquity,
        globalDebit,
        globalCredit,
        globalDiff: globalDebit - globalCredit,
        unbalancedEntries,
        missingAccountEntries
      }
    };
  }
}
