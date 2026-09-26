import { JournalEntry, Account, TrialBalanceItem, LedgerLine, AccountType, Customer, Supplier } from '../types';

export class AccountingEngine {
  /**
   * Computes the fiscal year start date for any given date and fiscal year end configuration.
   * Default: Fiscal year ends December 31 -> Starts January 1 of that calendar year.
   */
  static getFiscalYearStartDate(dateStr: string, fiscalYearEndSetting?: string): string {
    if (!dateStr) return '1900-01-01';
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) return '1900-01-01';

    const year = targetDate.getFullYear();
    let endMonth = 12;
    let endDay = 31;

    if (fiscalYearEndSetting) {
      const parts = fiscalYearEndSetting.split('-');
      if (parts.length >= 2) {
        endMonth = parseInt(parts[parts.length - 2], 10) || 12;
        endDay = parseInt(parts[parts.length - 1], 10) || 31;
      }
    }

    if (endMonth === 12 && endDay === 31) {
      return `${year}-01-01`;
    }

    const fyEndThisYear = new Date(year, endMonth - 1, endDay);
    if (targetDate <= fyEndThisYear) {
      const prevFyEnd = new Date(year - 1, endMonth - 1, endDay);
      prevFyEnd.setDate(prevFyEnd.getDate() + 1);
      return prevFyEnd.toISOString().slice(0, 10);
    } else {
      const thisFyEnd = new Date(year, endMonth - 1, endDay);
      thisFyEnd.setDate(thisFyEnd.getDate() + 1);
      return thisFyEnd.toISOString().slice(0, 10);
    }
  }

  /**
   * Calculates the Trial Balance for a given set of accounts and journal entries.
   * Implements standard fiscal year closing (rollover) for nominal / income statement accounts,
   * transferring prior years' accumulated earnings/losses to Retained Earnings (الأرباح المرحلة).
   */
  static calculateTrialBalance(
    accounts: Account[],
    entries: JournalEntry[],
    startDate: string,
    endDate: string,
    fiscalYearEndSetting?: string,
    accountTypes?: AccountType[]
  ) {
    const startTime = performance.now();
    const startVal = startDate || '';
    const endVal = endDate || '';
    const fiscalYearStart = startVal ? this.getFiscalYearStartDate(startVal, fiscalYearEndSetting) : '';

    let priorIncomeNet = 0; // accumulated prior years net income for nominal accounts

    const result = accounts.map(account => {
      let openingDebit = Number(account.opening_balance) > 0 ? Number(account.opening_balance) : 0;
      let openingCredit = Number(account.opening_balance) < 0 ? Math.abs(Number(account.opening_balance)) : 0;
      let movementDebit = 0;
      let movementCredit = 0;

      const typeInfo = this.resolveAccountClassification(account, accountTypes || []);
      const isIncomeStatement = typeInfo.statement_type === 'income_statement' ||
        ['revenue', 'cost', 'expense', 'interest_expense', 'depreciation', 'other_revenue', 'other_expense'].includes(typeInfo.classification);

      entries.forEach(entry => {
        const entryDateStr = (entry.date || '').slice(0, 10);
        const itemsList = (entry.items && Array.isArray(entry.items) && entry.items.length > 0) ? entry.items : ((entry as any).lines || (entry as any).journal_entry_lines || []);
        itemsList.forEach((item: any) => {
          const isMatched = item.account_id === account.id ||
            (!item.account_id && item.account_name && (
              item.account_name.trim().toLowerCase() === account.name.trim().toLowerCase() ||
              (item.account_name.includes('خصم') && account.name.includes('خصم')) ||
              (item.account_name.includes('نقد') && account.name.includes('نقد'))
            ));
          if (isMatched) {
            const debit = Number(item.debit) || 0;
            const credit = Number(item.credit) || 0;
            
            const isBefore = startVal && entryDateStr < startVal;
            const isAfter = endVal && entryDateStr > endVal;

            if (isBefore) {
              const isPriorFiscalYear = fiscalYearStart && entryDateStr < fiscalYearStart;
              if (isIncomeStatement && isPriorFiscalYear) {
                // Prior fiscal year nominal movement closed to Retained Earnings
                priorIncomeNet += (credit - debit);
              } else {
                openingDebit += debit;
                openingCredit += credit;
              }
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
    // If there is prior fiscal year net income/loss from nominal accounts, reflect it in Retained Earnings (الأرباح المرحلة)
    if (Math.abs(priorIncomeNet) > 0.0001) {
      let retAcc = result.find(a => 
        a.code === '3103' || 
        (a as any).account_usage === 'retained_earnings' || 
        a.name.includes('مرحل') || 
        a.name.includes('مبقاة') ||
        a.code === '33'
      );

      if (retAcc) {
        const currentOpeningNet = retAcc.opening.credit - retAcc.opening.debit;
        const newOpeningNet = currentOpeningNet + priorIncomeNet;
        retAcc.opening.debit = newOpeningNet < 0 ? Math.abs(newOpeningNet) : 0;
        retAcc.opening.credit = newOpeningNet > 0 ? newOpeningNet : 0;

        const currentClosingNet = retAcc.closing.credit - retAcc.closing.debit;
        const newClosingNet = currentClosingNet + priorIncomeNet;
        retAcc.closing.debit = newClosingNet < 0 ? Math.abs(newClosingNet) : 0;
        retAcc.closing.credit = newClosingNet > 0 ? newClosingNet : 0;
      } else {
        result.push({
          id: 'retained_earnings_virtual',
          code: '3103',
          name: 'الأرباح (الخسائر) المرحلة (Retained Earnings)',
          opening: {
            debit: priorIncomeNet < 0 ? Math.abs(priorIncomeNet) : 0,
            credit: priorIncomeNet > 0 ? priorIncomeNet : 0
          },
          movement: { debit: 0, credit: 0 },
          closing: {
            debit: priorIncomeNet < 0 ? Math.abs(priorIncomeNet) : 0,
            credit: priorIncomeNet > 0 ? priorIncomeNet : 0
          }
        });
      }
    }

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
      const itemsList = (entry.items && Array.isArray(entry.items) && entry.items.length > 0) ? entry.items : ((entry as any).lines || (entry as any).journal_entry_lines || []);
      itemsList.forEach((item: any) => {
        const isMatched = item.account_id === account.id ||
          (!item.account_id && item.account_name && (
            item.account_name.trim().toLowerCase() === account.name.trim().toLowerCase() ||
            (item.account_name.includes('خصم') && account.name.includes('خصم')) ||
            (item.account_name.includes('نقد') && account.name.includes('نقد'))
          ));
        if (isMatched) {
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

            const itemRate = Number(item.exchange_rate) || 1;
            const itemCurr = item.currency || 'EGP';
            const foreignAmt = Number(item.foreign_amount) || 0;

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
              reference_id: entry.reference_id,
              currency: itemCurr,
              foreign_amount: foreignAmt,
              exchange_rate: itemRate
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
   * Resolves classification and statement type for an account cleanly and reliably.
   */
  public static resolveAccountClassification(
    acc: Account | undefined,
    accountTypes: AccountType[]
  ): { classification: string; statement_type: string } {
    if (!acc) return { classification: 'asset', statement_type: 'balance_sheet' };

    // 1. Direct type_id match in accountTypes array
    if (acc.type_id && Array.isArray(accountTypes) && accountTypes.length > 0) {
      const type = accountTypes.find(t => t.id === acc.type_id);
      if (type && type.classification) {
        return {
          classification: type.classification,
          statement_type: type.statement_type || (['revenue', 'cost', 'expense', 'interest_expense', 'depreciation', 'other_revenue', 'other_expense'].includes(type.classification) ? 'income_statement' : 'balance_sheet')
        };
      }
    }

    // 2. Direct property check on account object
    const accTypeStr = String((acc as any).type || (acc as any).classification || (acc as any).type_name || '').toLowerCase();
    if (accTypeStr.includes('revenue') || accTypeStr.includes('sales') || accTypeStr.includes('إيراد')) {
      return { classification: 'revenue', statement_type: 'income_statement' };
    }
    if (accTypeStr.includes('cost') || accTypeStr.includes('تكلفة')) {
      return { classification: 'cost', statement_type: 'income_statement' };
    }
    if (accTypeStr.includes('expense') || accTypeStr.includes('مصروف')) {
      return { classification: 'expense', statement_type: 'income_statement' };
    }
    if (accTypeStr.includes('asset') || accTypeStr.includes('أصل') || accTypeStr.includes('أصول')) {
      return { classification: 'asset', statement_type: 'balance_sheet' };
    }
    if (accTypeStr.includes('liability') || accTypeStr.includes('خصم') || accTypeStr.includes('خصوم') || accTypeStr.includes('التزام')) {
      return { classification: 'liability', statement_type: 'balance_sheet' };
    }
    if (accTypeStr.includes('equity') || accTypeStr.includes('ملكيات') || accTypeStr.includes('حقوق')) {
      return { classification: 'equity', statement_type: 'balance_sheet' };
    }

    // 3. Match by standard Chart of Accounts code prefix
    const code = String(acc.code || '').trim();
    if (code.startsWith('1')) {
      if (code.startsWith('1101') || code.startsWith('1102')) {
        return { classification: 'cash_and_equivalents', statement_type: 'balance_sheet' };
      }
      if (code.startsWith('1103')) {
        return { classification: 'receivables', statement_type: 'balance_sheet' };
      }
      return { classification: 'asset', statement_type: 'balance_sheet' };
    }
    if (code.startsWith('2')) {
      if (code.startsWith('2101')) {
        return { classification: 'payables', statement_type: 'balance_sheet' };
      }
      return { classification: 'liability', statement_type: 'balance_sheet' };
    }
    if (code.startsWith('3')) {
      return { classification: 'equity', statement_type: 'balance_sheet' };
    }
    if (code.startsWith('4')) {
      return { classification: 'revenue', statement_type: 'income_statement' };
    }
    if (code.startsWith('5')) {
      return { classification: 'cost', statement_type: 'income_statement' };
    }
    if (code.startsWith('6') || code.startsWith('7') || code.startsWith('8') || code.startsWith('9')) {
      return { classification: 'expense', statement_type: 'income_statement' };
    }

    // 4. Match by account name keywords
    const name = String(acc.name || '').toLowerCase();
    if (name.includes('إيراد') || name.includes('مبيعات') || name.includes('إيرادات')) {
      return { classification: 'revenue', statement_type: 'income_statement' };
    }
    if (name.includes('تكلفة') || name.includes('مشتريات')) {
      return { classification: 'cost', statement_type: 'income_statement' };
    }
    if (name.includes('مصروف') || name.includes('عمومية') || name.includes('إدارية') || name.includes('إهلاك')) {
      return { classification: 'expense', statement_type: 'income_statement' };
    }
    if (name.includes('عملاء') || name.includes('العملاء') || name.includes('مدينون')) {
      return { classification: 'receivables', statement_type: 'balance_sheet' };
    }
    if (name.includes('موردين') || name.includes('الموردين') || name.includes('دائنون')) {
      return { classification: 'payables', statement_type: 'balance_sheet' };
    }
    if (name.includes('نقدية') || name.includes('صندوق') || name.includes('خزينة') || name.includes('بنك')) {
      return { classification: 'cash_and_equivalents', statement_type: 'balance_sheet' };
    }
    if (name.includes('أصول') || name.includes('مخزون') || name.includes('سيارات') || name.includes('أثاث') || name.includes('مباني')) {
      return { classification: 'asset', statement_type: 'balance_sheet' };
    }
    if (name.includes('خصوم') || name.includes('إلتزامات') || name.includes('قروض')) {
      return { classification: 'liability', statement_type: 'balance_sheet' };
    }
    if (name.includes('حقوق') || name.includes('رأس المال') || name.includes('أرباح')) {
      return { classification: 'equity', statement_type: 'balance_sheet' };
    }

    // Default fallback
    return { classification: 'asset', statement_type: 'balance_sheet' };
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
      const acc = accounts.find(account => account.id === a.id);
      const typeInfo = this.resolveAccountClassification(acc, accountTypes);
      return { ...a, typeInfo };
    });

    const isIncomeStatementType = (type: { classification: string; statement_type: string }) => {
      if (['revenue', 'cost', 'expense', 'interest_expense', 'depreciation', 'other_revenue', 'other_expense'].includes(type.classification)) return true;
      if (['asset', 'liability', 'equity', 'liability_equity', 'cash_and_equivalents', 'receivables', 'payables'].includes(type.classification)) return false;
      return type.statement_type === 'income_statement';
    };

    const isAccounts = mappedAccounts.filter(a => isIncomeStatementType(a.typeInfo));
    
    const revenues = isAccounts.filter(a => ['revenue', 'other_revenue'].includes(a.typeInfo.classification));
    const costs = isAccounts.filter(a => a.typeInfo.classification === 'cost');
    const expenses = isAccounts.filter(a => ['expense', 'interest_expense', 'depreciation', 'other_expense'].includes(a.typeInfo.classification));

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
    endDate: string,
    fiscalYearEndSetting?: string
  ) {
    // For Balance Sheet, we use trial balance from beginning of time (or very early date) until endDate
    const startDate = '1900-01-01'; 
    const trialBalance = this.calculateTrialBalance(accounts, entries, startDate, endDate);

    // Map classifications
    const mappedAccounts = trialBalance.map(a => {
      const acc = accounts.find(account => account.id === a.id);
      const typeInfo = this.resolveAccountClassification(acc, accountTypes);
      return { ...a, typeInfo };
    });

    const isBalanceSheetType = (type: { classification: string; statement_type: string }) => {
      if (['asset', 'liability', 'equity', 'liability_equity', 'cash_and_equivalents', 'receivables', 'payables'].includes(type.classification)) return true;
      if (['revenue', 'cost', 'expense', 'interest_expense', 'depreciation', 'other_revenue', 'other_expense'].includes(type.classification)) return false;
      return type.statement_type === 'balance_sheet';
    };

    const bsAccounts = mappedAccounts.filter(a => isBalanceSheetType(a.typeInfo));
    
    // Determine current fiscal year start
    const fiscalYearStart = this.getFiscalYearStartDate(endDate, fiscalYearEndSetting);
    
    // 1. Calculate Prior Periods Income Statement (Retained Earnings up to fiscalYearStart - 1 day)
    let retainedEarnings = 0;
    if (fiscalYearStart > '1900-01-01') {
      const prevDate = new Date(fiscalYearStart);
      prevDate.setDate(prevDate.getDate() - 1);
      const priorPeriodEnd = prevDate.toISOString().slice(0, 10);
      const priorIncome = this.calculateIncomeStatement(accounts, accountTypes, entries, '1900-01-01', priorPeriodEnd);
      retainedEarnings = priorIncome.netProfit;
    }

    // 2. Calculate Current Period Income Statement (from fiscalYearStart to endDate)
    const currentIncome = this.calculateIncomeStatement(accounts, accountTypes, entries, fiscalYearStart, endDate);
    const currentPeriodNetProfit = currentIncome.netProfit;

    // Cumulative net profit across all time
    const totalCumulativeProfit = retainedEarnings + currentPeriodNetProfit;
    
    const assets = bsAccounts.filter(a => ['asset', 'cash_and_equivalents', 'receivables'].includes(a.typeInfo.classification));
    const liabilities = bsAccounts.filter(a => ['liability', 'liability_equity', 'payables'].includes(a.typeInfo.classification));
    const equity = bsAccounts.filter(a => a.typeInfo.classification === 'equity');

    // For equity presentation, filter out 3103/retained_earnings account if its direct journal balance is 0 to avoid duplicates
    const isRetainedEarningsAccount = (a: any) => {
      const acc = accounts.find(x => x.id === a.id);
      return a.code === '3103' || (acc as any)?.account_usage === 'retained_earnings' || a.name.includes('مرحل') || a.name.includes('مبقاة');
    };
    const manualEquity = equity.filter(a => !isRetainedEarningsAccount(a) || Math.abs(a.closing.credit - a.closing.debit) > 0.01);

    // Classification according to IAS 1 / EAS 1 (Non-Current vs Current)
    const isNonCurrentAsset = (acc: any) => {
      const code = String(acc.code || '');
      const name = String(acc.name || '').toLowerCase();
      const cls = String(acc.typeInfo?.classification || '').toLowerCase();
      return code.startsWith('12') || 
             cls === 'fixed_asset' || 
             ['أصول ثابتة', 'الات', 'آلات', 'معدات', 'سيارات', 'أثاث', 'اثاث', 'مباني', 'عقارات', 'تجهيزات', 'مشروعات تحت التنفيذ', 'استثمارات طويلة', 'شهرة', 'أصول غير ملموسة'].some(k => name.includes(k));
    };

    const isNonCurrentLiability = (acc: any) => {
      const code = String(acc.code || '');
      const name = String(acc.name || '').toLowerCase();
      const cls = String(acc.typeInfo?.classification || '').toLowerCase();
      return (code.startsWith('22') && !name.includes('ضرائب') && !name.includes('قيمة مضافة')) ||
             cls === 'non_current_liability' ||
             ['طويلة الأجل', 'طويل الأجل', 'قروض طويلة', 'مخصصات طويلة', 'التزامات مؤجلة'].some(k => name.includes(k));
    };

    const nonCurrentAssets = assets.filter(a => isNonCurrentAsset(a));
    const currentAssets = assets.filter(a => !isNonCurrentAsset(a));

    const nonCurrentLiabilities = liabilities.filter(l => isNonCurrentLiability(l));
    const currentLiabilities = liabilities.filter(l => !isNonCurrentLiability(l));

    const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, a) => sum + (a.closing.debit - a.closing.credit), 0);
    const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + (a.closing.debit - a.closing.credit), 0);
    const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

    const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, a) => sum + (a.closing.credit - a.closing.debit), 0);
    const totalCurrentLiabilities = currentLiabilities.reduce((sum, a) => sum + (a.closing.credit - a.closing.debit), 0);
    const totalLiabilities = totalNonCurrentLiabilities + totalCurrentLiabilities;

    const equitySum = manualEquity.reduce((sum, a) => sum + (a.closing.credit - a.closing.debit), 0);
    const totalEquity = equitySum + totalCumulativeProfit;

    const totalLiabilitiesEquity = totalLiabilities + totalEquity;

    // Sub-groupings for Current Assets for IAS 1 presentation:
    const cashAndEquivalents = currentAssets.filter(a => ['نقدية', 'خزينة', 'صندوق', 'بنك'].some(k => a.name.includes(k)) || a.code?.startsWith('113') || a.code?.startsWith('1101') || a.code?.startsWith('1102'));
    const receivables = currentAssets.filter(a => ['عملاء', 'مدينون', 'ذمم'].some(k => a.name.includes(k)) || a.code?.startsWith('111') || a.code?.startsWith('1103'));
    const inventory = currentAssets.filter(a => ['مخزون', 'بضاعة', 'خامات'].some(k => a.name.includes(k)) || a.code?.startsWith('1115') || a.code?.startsWith('112') || a.code?.startsWith('1104'));
    const otherCurrentAssets = currentAssets.filter(a => !cashAndEquivalents.includes(a) && !receivables.includes(a) && !inventory.includes(a));

    const inventoryTotal = inventory.reduce((sum, a) => sum + (a.closing.debit - a.closing.credit), 0);
    const workingCapital = totalCurrentAssets - totalCurrentLiabilities;
    const currentRatio = totalCurrentLiabilities > 0 ? Number((totalCurrentAssets / totalCurrentLiabilities).toFixed(2)) : 0;
    const quickRatio = totalCurrentLiabilities > 0 ? Number(((totalCurrentAssets - inventoryTotal) / totalCurrentLiabilities).toFixed(2)) : 0;
    const debtToEquity = totalEquity > 0 ? Number((totalLiabilities / totalEquity).toFixed(2)) : 0;

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
      assets: assets.map(a => ({ id: a.id, name: a.name, code: a.code, balance: a.closing.debit - a.closing.credit })),
      liabilities: liabilities.map(l => ({ id: l.id, name: l.name, code: l.code, balance: l.closing.credit - l.closing.debit })),
      equity: manualEquity.map(e => ({ id: e.id, name: e.name, code: e.code, balance: e.closing.credit - e.closing.debit })),
      retainedEarnings,
      currentPeriodNetProfit,
      nonCurrentAssets: nonCurrentAssets.map(a => ({ id: a.id, name: a.name, code: a.code, balance: a.closing.debit - a.closing.credit })),
      currentAssets: currentAssets.map(a => ({ id: a.id, name: a.name, code: a.code, balance: a.closing.debit - a.closing.credit })),
      nonCurrentLiabilities: nonCurrentLiabilities.map(l => ({ id: l.id, name: l.name, code: l.code, balance: l.closing.credit - l.closing.debit })),
      currentLiabilities: currentLiabilities.map(l => ({ id: l.id, name: l.name, code: l.code, balance: l.closing.credit - l.closing.debit })),
      cashAndEquivalents: cashAndEquivalents.map(a => ({ id: a.id, name: a.name, code: a.code, balance: a.closing.debit - a.closing.credit })),
      receivables: receivables.map(a => ({ id: a.id, name: a.name, code: a.code, balance: a.closing.debit - a.closing.credit })),
      inventory: inventory.map(a => ({ id: a.id, name: a.name, code: a.code, balance: a.closing.debit - a.closing.credit })),
      otherCurrentAssets: otherCurrentAssets.map(a => ({ id: a.id, name: a.name, code: a.code, balance: a.closing.debit - a.closing.credit })),
      totalNonCurrentAssets,
      totalCurrentAssets,
      totalNonCurrentLiabilities,
      totalCurrentLiabilities,
      workingCapital,
      currentRatio,
      quickRatio,
      debtToEquity,
      netProfit: totalCumulativeProfit,
      totalAssets,
      totalLiabilities,
      totalEquity,
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
