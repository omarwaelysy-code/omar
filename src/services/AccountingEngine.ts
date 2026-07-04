import { JournalEntry, Account, TrialBalanceItem, LedgerLine, AccountType, Customer, Supplier } from '../types';

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
    const startVal = startDate || '';
    const endVal = endDate || '';

    const result = accounts.map(account => {
      let openingDebit = Number(account.opening_balance) > 0 ? Number(account.opening_balance) : 0;
      let openingCredit = Number(account.opening_balance) < 0 ? Math.abs(Number(account.opening_balance)) : 0;
      let movementDebit = 0;
      let movementCredit = 0;

      entries.forEach(entry => {
        const entryDateStr = (entry.date || '').slice(0, 10);
        entry.items?.forEach(item => {
          if (item.account_id === account.id) {
            const debit = Number(item.debit) || 0;
            const credit = Number(item.credit) || 0;
            
            const isBefore = startVal && entryDateStr < startVal;
            const isAfter = endVal && entryDateStr > endVal;

            if (isBefore) {
              openingDebit += debit;
              openingCredit += credit;
            } else if (!isBefore && !isAfter) {
              movementDebit += debit;
              movementCredit += credit;
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
    entityIds?: string[],
    customers?: Customer[],
    suppliers?: Supplier[]
  ): { lines: LedgerLine[]; openingBalance: number } {
    const startVal = startDate || '';
    const endVal = endDate || '';

    let openingDebit = (entityIds && entityIds.length > 0) ? 0 : (Number(account.opening_balance) > 0 ? Number(account.opening_balance) : 0);
    let openingCredit = (entityIds && entityIds.length > 0) ? 0 : (Number(account.opening_balance) < 0 ? Math.abs(Number(account.opening_balance)) : 0);
    
    const relevantEntries: LedgerLine[] = [];

    entries.forEach(entry => {
      const entryDateStr = (entry.date || '').slice(0, 10);
      entry.items?.forEach(item => {
        if (item.account_id === account.id) {
          const debit = Number(item.debit) || 0;
          const credit = Number(item.credit) || 0;

          // Apply entity filter if provided
          if (entityIds && entityIds.length > 0) {
            const matchesEntity = entityIds.includes(item.customer_id || '') || 
                                 entityIds.includes(item.supplier_id || '') ||
                                 entityIds.includes(item.sub_account_id || '');
            if (!matchesEntity) return;
          }

          const isBefore = startVal && entryDateStr < startVal;
          const isAfter = endVal && entryDateStr > endVal;

          if (isBefore) {
            openingDebit += debit;
            openingCredit += credit;
          } else if (!isBefore && !isAfter) {
            let entityName = item.customer_name || item.supplier_name || '';
            if (!entityName) {
              if (item.customer_id && customers) {
                const found = customers.find(c => c.id === item.customer_id);
                if (found) entityName = found.name;
              }
              if (!entityName && item.supplier_id && suppliers) {
                const found = suppliers.find(s => s.id === item.supplier_id);
                if (found) entityName = found.name;
              }
              if (!entityName && item.sub_account_id && customers && (item.sub_account_type === 'customer' || !item.sub_account_type)) {
                const found = customers.find(c => c.id === item.sub_account_id);
                if (found) entityName = found.name;
              }
              if (!entityName && item.sub_account_id && suppliers && (item.sub_account_type === 'supplier' || !item.sub_account_type)) {
                const found = suppliers.find(s => s.id === item.sub_account_id);
                if (found) entityName = found.name;
              }
            }
            if (!entityName) {
              entityName = item.sub_account_type === 'payment_method' ? 'خزينة/بنك' : '';
            }

            relevantEntries.push({
              id: entry.id || '',
              date: entry.date,
              reference: entry.reference_number || '',
              description: item.description || entry.description,
              debit: debit,
              credit: credit,
              balance: 0,
              entity_name: entityName,
              reference_type: entry.reference_type,
              entry_number: entry.entry_number,
              sub_account_id: item.sub_account_id,
              sub_account_type: item.sub_account_type,
              reference_id: entry.reference_id
            });
          }
        }
      });
    });

    // Sort by date, with entry_number and ID as tie-breakers
    relevantEntries.sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      
      const aNo = a.entry_number || '';
      const bNo = b.entry_number || '';
      const noDiff = aNo.localeCompare(bNo, undefined, { numeric: true });
      if (noDiff !== 0) return noDiff;

      return (a.id || '').localeCompare(b.id || '');
    });

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
        totalDebit += Number(item.debit) || 0;
        totalCredit += Number(item.credit) || 0;
      });
    });

    const difference = totalDebit - totalCredit;
    return {
      isBalanced: Math.abs(difference) < 0.01,
      difference
    };
  }

  /**
   * Calculates and returns sub-periods (start, end, labelAr, labelEn) based on the date range and view mode.
   */
  static getSubPeriods(
    startDateStr: string,
    endDateStr: string,
    mode: 'single' | 'monthly' | 'quarterly' | 'yearly'
  ): { start: string; end: string; labelAr: string; labelEn: string }[] {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [];
    }

    const formatDateLocal = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const subPeriods: { start: string; end: string; labelAr: string; labelEn: string }[] = [];

    if (mode === 'single') {
      subPeriods.push({
        start: startDateStr,
        end: endDateStr,
        labelAr: 'الفترة المحددة',
        labelEn: 'Selected Period'
      });
      return subPeriods;
    }

    if (mode === 'monthly') {
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);

      const arMonths = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];
      const enMonths = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      while (current <= endLimit) {
        const year = current.getFullYear();
        const month = current.getMonth();

        const pStart = new Date(Math.max(start.getTime(), new Date(year, month, 1).getTime()));
        const pEnd = new Date(Math.min(end.getTime(), new Date(year, month + 1, 0).getTime()));

        const startStr = formatDateLocal(pStart);
        const endStr = formatDateLocal(pEnd);

        subPeriods.push({
          start: startStr,
          end: endStr,
          labelAr: `${arMonths[month]} ${year}`,
          labelEn: `${enMonths[month]} ${year}`
        });

        current = new Date(year, month + 1, 1);
      }
    } else if (mode === 'quarterly') {
      const getQuarterStartMonth = (month: number) => Math.floor(month / 3) * 3;

      let current = new Date(start.getFullYear(), getQuarterStartMonth(start.getMonth()), 1);
      const endLimit = new Date(end.getFullYear(), getQuarterStartMonth(end.getMonth()), 1);

      const arQuarters = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];
      const enQuarters = ['Q1', 'Q2', 'Q3', 'Q4'];

      while (current <= endLimit) {
        const year = current.getFullYear();
        const qStartMonth = current.getMonth();
        const qIndex = qStartMonth / 3;

        const pStart = new Date(Math.max(start.getTime(), new Date(year, qStartMonth, 1).getTime()));
        const pEnd = new Date(Math.min(end.getTime(), new Date(year, qStartMonth + 3, 0).getTime()));

        const startStr = formatDateLocal(pStart);
        const endStr = formatDateLocal(pEnd);

        subPeriods.push({
          start: startStr,
          end: endStr,
          labelAr: `${arQuarters[qIndex]} ${year}`,
          labelEn: `${enQuarters[qIndex]} ${year}`
        });

        current = new Date(year, qStartMonth + 3, 1);
      }
    } else if (mode === 'yearly') {
      let currentYear = start.getFullYear();
      const endYear = end.getFullYear();

      while (currentYear <= endYear) {
        const pStart = new Date(Math.max(start.getTime(), new Date(currentYear, 0, 1).getTime()));
        const pEnd = new Date(Math.min(end.getTime(), new Date(currentYear, 11, 31).getTime()));

        const startStr = formatDateLocal(pStart);
        const endStr = formatDateLocal(pEnd);

        subPeriods.push({
          start: startStr,
          end: endStr,
          labelAr: `${currentYear}`,
          labelEn: `${currentYear}`
        });

        currentYear++;
      }
    }

    return subPeriods;
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

    const isIncomeStatementType = (type: AccountType | undefined) => {
      if (!type) return false;
      // Primary check: classification
      if (['revenue', 'cost', 'expense', 'interest_expense', 'depreciation', 'other_revenue', 'other_expense'].includes(type.classification)) return true;
      if (['asset', 'liability', 'equity', 'liability_equity', 'cash_and_equivalents', 'receivables', 'payables'].includes(type.classification)) return false;
      // Secondary check: statement_type
      return type.statement_type === 'income_statement';
    };

    const isAccounts = mappedAccounts.filter(a => isIncomeStatementType(a.typeInfo));
    
    const revenues = isAccounts.filter(a => ['revenue', 'other_revenue'].includes(a.typeInfo?.classification || ''));
    const costs = isAccounts.filter(a => a.typeInfo?.classification === 'cost');
    const expenses = isAccounts.filter(a => ['expense', 'interest_expense', 'depreciation', 'other_expense'].includes(a.typeInfo?.classification || ''));

    // Sign handling: Revenue is normally Credit, Cost/Expense normally Debit
    // For Income Statement we use MOVEMENTS in the period
    const totalRevenues = revenues.reduce((sum, a) => sum + (Number(a.movement.credit) - Number(a.movement.debit)), 0);
    const totalCosts = costs.reduce((sum, a) => sum + (Number(a.movement.debit) - Number(a.movement.credit)), 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + (Number(a.movement.debit) - Number(a.movement.credit)), 0);

    const grossProfit = totalRevenues - totalCosts;
    const netProfit = grossProfit - totalExpenses;

    return {
      revenues: revenues.map(r => ({ id: r.id, name: r.name, balance: r.movement.credit - r.movement.debit })),
      costs: costs.map(c => ({ id: c.id, name: c.name, balance: c.movement.debit - c.movement.credit })),
      expenses: expenses.map(e => ({ id: e.id, name: e.name, balance: e.movement.debit - e.movement.credit })),
      totalRevenues,
      totalCosts,
      grossProfit,
      totalExpenses,
      netProfit,
      isAccountsCount: isAccounts.length
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
    // For Balance Sheet, we use trial balance from beginning of time (or very early date) until endDate
    const startDate = '1900-01-01'; 
    const trialBalance = this.calculateTrialBalance(accounts, entries, startDate, endDate);

    // Map classifications
    const mappedAccounts = trialBalance.map(a => {
      const type = accountTypes.find(t => t.id === (accounts.find(acc => acc.id === a.id)?.type_id));
      return { ...a, typeInfo: type };
    });

    const isBalanceSheetType = (type: AccountType | undefined) => {
      if (!type) return false;
      // Primary check: classification
      if (['asset', 'liability', 'equity', 'liability_equity', 'cash_and_equivalents', 'receivables', 'payables'].includes(type.classification)) return true;
      if (['revenue', 'cost', 'expense', 'interest_expense', 'depreciation', 'other_revenue', 'other_expense'].includes(type.classification)) return false;
      // Secondary check: statement_type
      return type.statement_type === 'balance_sheet';
    };

    const bsAccounts = mappedAccounts.filter(a => isBalanceSheetType(a.typeInfo));
    
    // Calculate Net Profit for the entire period up to targetDate (Cumulative)
    const incomeStatement = this.calculateIncomeStatement(accounts, accountTypes, entries, startDate, endDate);
    
    const assets = bsAccounts.filter(a => ['asset', 'cash_and_equivalents', 'receivables'].includes(a.typeInfo?.classification || ''));
    const liabilities = bsAccounts.filter(a => ['liability', 'liability_equity', 'payables'].includes(a.typeInfo?.classification || ''));
    const equity = bsAccounts.filter(a => a.typeInfo?.classification === 'equity');

    const totalAssets = assets.reduce((sum, a) => sum + (a.closing.debit - a.closing.credit), 0);
    
    // Liabilities and Equity are normally Credit balances
    const liabilitiesSum = liabilities.reduce((sum, a) => sum + (a.closing.credit - a.closing.debit), 0);
    const equitySum = equity.reduce((sum, a) => sum + (a.closing.credit - a.closing.debit), 0);
    
    const totalLiabilitiesEquity = liabilitiesSum + equitySum + incomeStatement.netProfit;

    // Additional Diagnostics
    const entriesBeforeDate = entries.filter(e => !endDate || (e.date || '').slice(0, 10) <= endDate);
    
    const unbalancedEntries: string[] = [];
    const missingAccountType: string[] = [];
    const orphanedAccounts: string[] = [];
    
    let globalDebit = 0;
    let globalCredit = 0;

    // Check every account in the system for classification
    mappedAccounts.forEach(a => {
      if (!a.typeInfo) {
        missingAccountType.push(`${a.name} (${a.code})`);
      } else if (!a.typeInfo.statement_type) {
        orphanedAccounts.push(`${a.name} (${a.code}) - Missing Statement Type`);
      }
    });

    entriesBeforeDate.forEach(entry => {
      let entryDebit = 0;
      let entryCredit = 0;
      entry.items?.forEach(item => {
        const itemDebit = Number(item.debit) || 0;
        const itemCredit = Number(item.credit) || 0;
        
        entryDebit += itemDebit;
        entryCredit += itemCredit;
        globalDebit += itemDebit;
        globalCredit += itemCredit;
      });
      if (Math.abs(entryDebit - entryCredit) > 0.01) {
        unbalancedEntries.push(`${entry.description || 'Entry'} (Ref: ${entry.id.substring(0, 5)}, Diff: ${(entryDebit - entryCredit).toFixed(2)})`);
      }
    });

    return {
      assets: assets.map(a => ({ id: a.id, name: a.name, balance: a.closing.debit - a.closing.credit })),
      liabilities: liabilities.map(l => ({ id: l.id, name: l.name, balance: l.closing.credit - l.closing.debit })),
      equity: equity.map(e => ({ id: e.id, name: e.name, balance: e.closing.credit - e.closing.debit })),
      netProfit: incomeStatement.netProfit,
      totalAssets,
      totalLiabilities: liabilitiesSum,
      totalEquity: equitySum + incomeStatement.netProfit,
      totalLiabilitiesEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesEquity) < 0.01,
      diagnostics: {
        difference: totalAssets - totalLiabilitiesEquity,
        globalDebit,
        globalCredit,
        globalDiff: globalDebit - globalCredit,
        unbalancedEntries,
        missingAccountType,
        orphanedAccounts
      }
    };
  }
}
