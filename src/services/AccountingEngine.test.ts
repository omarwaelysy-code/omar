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
});
