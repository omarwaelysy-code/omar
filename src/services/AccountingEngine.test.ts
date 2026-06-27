import { describe, it, expect } from 'vitest';
import { AccountingEngine } from './AccountingEngine';
import { Account, JournalEntry, AccountType } from '../types';

describe('AccountingEngine', () => {
  const mockAccountTypes: AccountType[] = [
    { id: 't1', code: '1', name: 'Assets', statement_type: 'balance_sheet', classification: 'asset', company_id: 'c1' },
    { id: 't2', code: '4', name: 'Revenues', statement_type: 'income_statement', classification: 'revenue', company_id: 'c1' },
    { id: 't3', code: '5', name: 'Expenses', statement_type: 'income_statement', classification: 'expense', company_id: 'c1' },
    { id: 't4', code: '3', name: 'Equity', statement_type: 'balance_sheet', classification: 'liability_equity', company_id: 'c1' },
  ];

  const mockAccounts: Account[] = [
    { id: 'a1', code: '101', name: 'Cash', type_id: 't1', company_id: 'c1', opening_balance: 1000 },
    { id: 'a2', code: '401', name: 'Sales', type_id: 't2', company_id: 'c1', opening_balance: 0 },
    { id: 'a3', code: '501', name: 'Rent', type_id: 't3', company_id: 'c1', opening_balance: 0 },
    { id: 'a4', code: '301', name: 'Capital', type_id: 't4', company_id: 'c1', opening_balance: -1000 },
  ];

  const mockEntries: JournalEntry[] = [
    {
      id: 'e1',
      date: '2026-04-01',
      description: 'Sale',
      reference_id: 'r1',
      reference_type: 'invoice',
      total_debit: 500,
      total_credit: 500,
      company_id: 'c1',
      items: [
        { account_id: 'a1', account_name: 'Cash', debit: 500, credit: 0 },
        { account_id: 'a2', account_name: 'Sales', debit: 0, credit: 500 },
      ],
      created_at: '',
      created_by: ''
    },
    {
      id: 'e2',
      date: '2026-04-05',
      description: 'Rent',
      reference_id: 'r2',
      reference_type: 'payment',
      total_debit: 200,
      total_credit: 200,
      company_id: 'c1',
      items: [
        { account_id: 'a3', account_name: 'Rent', debit: 200, credit: 0 },
        { account_id: 'a1', account_name: 'Cash', debit: 0, credit: 200 },
      ],
      created_at: '',
      created_by: ''
    }
  ];

  it('calculates trial balance correctly', () => {
    const tb = AccountingEngine.calculateTrialBalance(mockAccounts, mockEntries, '2026-04-01', '2026-04-30');
    
    const cash = tb.find(a => a.id === 'a1');
    expect(cash?.opening.debit).toBe(1000);
    expect(cash?.movement.debit).toBe(500);
    expect(cash?.movement.credit).toBe(200);
    expect(cash?.closing.debit).toBe(1300);
  });

  it('validates global balance', () => {
    const check = AccountingEngine.validateGlobalBalance(mockEntries);
    expect(check.isBalanced).toBe(true);
    expect(check.difference).toBe(0);
  });

  it('calculates income statement correctly', () => {
    const is = AccountingEngine.calculateIncomeStatement(mockAccounts, mockAccountTypes, mockEntries, '2026-04-01', '2026-04-30');
    
    expect(is.totalRevenues).toBe(500);
    expect(is.totalExpenses).toBe(200);
    expect(is.netProfit).toBe(300);
  });

  it('calculates balance sheet correctly', () => {
    const bs = AccountingEngine.calculateBalanceSheet(mockAccounts, mockAccountTypes, mockEntries, '2026-04-30');
    
    expect(bs.totalAssets).toBe(1300); // 1000 + 500 - 200
    expect(bs.totalLiabilitiesEquity).toBe(1300); // 1000 (Capital) + 300 (Net Profit)
    expect(bs.isBalanced).toBe(true);
  });

  it('correctly maps and sums new classifications in reports', () => {
    const testTypes: AccountType[] = [
      { id: 't_cash', code: '10', name: 'Cash equivalents', statement_type: 'balance_sheet', classification: 'cash_and_equivalents', company_id: 'c1' },
      { id: 't_rec', code: '11', name: 'Receivables', statement_type: 'balance_sheet', classification: 'receivables', company_id: 'c1' },
      { id: 't_pay', code: '20', name: 'Payables', statement_type: 'balance_sheet', classification: 'payables', company_id: 'c1' },
      { id: 't_dep', code: '50', name: 'Depreciation', statement_type: 'income_statement', classification: 'depreciation', company_id: 'c1' },
      { id: 't_other_rev', code: '41', name: 'Other Rev', statement_type: 'income_statement', classification: 'other_revenue', company_id: 'c1' }
    ];

    const testAccounts: Account[] = [
      { id: 'a_cash', code: '101', name: 'Cash Box', type_id: 't_cash', company_id: 'c1', opening_balance: 500 },
      { id: 'a_rec', code: '102', name: 'Client Account', type_id: 't_rec', company_id: 'c1', opening_balance: 300 },
      { id: 'a_pay', code: '201', name: 'Supplier Account', type_id: 't_pay', company_id: 'c1', opening_balance: -200 },
      { id: 'a_dep', code: '501', name: 'Asset Dep', type_id: 't_dep', company_id: 'c1', opening_balance: 0 },
      { id: 'a_other_rev', code: '411', name: 'Interests', type_id: 't_other_rev', company_id: 'c1', opening_balance: 0 }
    ];

    const testEntries: JournalEntry[] = [
      {
        id: 'te1',
        date: '2026-04-10',
        description: 'Adj',
        reference_id: 'r1',
        reference_type: 'manual',
        total_debit: 100,
        total_credit: 100,
        company_id: 'c1',
        items: [
          { account_id: 'a_dep', account_name: 'Asset Dep', debit: 60, credit: 0 },
          { account_id: 'a_other_rev', account_name: 'Interests', debit: 0, credit: 100 },
          { account_id: 'a_cash', account_name: 'Cash Box', debit: 40, credit: 0 }
        ],
        created_at: '',
        created_by: ''
      }
    ];

    const is = AccountingEngine.calculateIncomeStatement(testAccounts, testTypes, testEntries, '2026-04-01', '2026-04-30');
    // totalRevenues should sum 'other_revenue' = 100
    expect(is.totalRevenues).toBe(100);
    // totalExpenses should sum 'depreciation' = 60
    expect(is.totalExpenses).toBe(60);
    expect(is.netProfit).toBe(40);

    const bs = AccountingEngine.calculateBalanceSheet(testAccounts, testTypes, testEntries, '2026-04-30');
    // Assets: 'cash_and_equivalents' (500 + 40 = 540) + 'receivables' (300) = 840
    expect(bs.totalAssets).toBe(840);
    // Liabilities: 'payables' (200) + Net Profit (40) = 240
    expect(bs.totalLiabilitiesEquity).toBe(240); 
  });

  describe('getSubPeriods', () => {
    it('splits a date range into monthly sub-periods correctly', () => {
      const periods = AccountingEngine.getSubPeriods('2026-01-15', '2026-04-10', 'monthly');
      expect(periods).toHaveLength(4);
      
      expect(periods[0]).toEqual({
        start: '2026-01-15',
        end: '2026-01-31',
        labelAr: 'يناير 2026',
        labelEn: 'January 2026'
      });
      expect(periods[1]).toEqual({
        start: '2026-02-01',
        end: '2026-02-28',
        labelAr: 'فبراير 2026',
        labelEn: 'February 2026'
      });
      expect(periods[2]).toEqual({
        start: '2026-03-01',
        end: '2026-03-31',
        labelAr: 'مارس 2026',
        labelEn: 'March 2026'
      });
      expect(periods[3]).toEqual({
        start: '2026-04-01',
        end: '2026-04-10',
        labelAr: 'أبريل 2026',
        labelEn: 'April 2026'
      });
    });

    it('splits a date range into quarterly sub-periods correctly', () => {
      const periods = AccountingEngine.getSubPeriods('2026-02-01', '2026-08-15', 'quarterly');
      expect(periods).toHaveLength(3); // Q1, Q2, Q3 overlapping
      
      // Q1 (intersection is Feb 1 to Mar 31)
      expect(periods[0]).toEqual({
        start: '2026-02-01',
        end: '2026-03-31',
        labelAr: 'الربع الأول 2026',
        labelEn: 'Q1 2026'
      });
      // Q2 (intersection is Apr 1 to Jun 30)
      expect(periods[1]).toEqual({
        start: '2026-04-01',
        end: '2026-06-30',
        labelAr: 'الربع الثاني 2026',
        labelEn: 'Q2 2026'
      });
      // Q3 (intersection is Jul 1 to Aug 15)
      expect(periods[2]).toEqual({
        start: '2026-07-01',
        end: '2026-08-15',
        labelAr: 'الربع الثالث 2026',
        labelEn: 'Q3 2026'
      });
    });

    it('splits a date range into yearly sub-periods correctly', () => {
      const periods = AccountingEngine.getSubPeriods('2025-06-15', '2027-02-20', 'yearly');
      expect(periods).toHaveLength(3); // 2025, 2026, 2027
      
      expect(periods[0]).toEqual({
        start: '2025-06-15',
        end: '2025-12-31',
        labelAr: '2025',
        labelEn: '2025'
      });
      expect(periods[1]).toEqual({
        start: '2026-01-01',
        end: '2026-12-31',
        labelAr: '2026',
        labelEn: '2026'
      });
      expect(periods[2]).toEqual({
        start: '2027-01-01',
        end: '2027-02-20',
        labelAr: '2027',
        labelEn: '2027'
      });
    });
  });
});

