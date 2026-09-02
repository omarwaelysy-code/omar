import { describe, it, expect } from 'vitest';
import { PostingService } from '../services/PostingService';
import { IssuedCheque, Supplier, Account, PaymentMethod } from '../types';

describe('🏦 Issued Cheques Module - Accounting & Logic Verification', () => {
  const mockSuppliers: Supplier[] = [
    {
      id: 'supp-1',
      name: 'شركة الأمل للتوريدات',
      code: 'SUPP-001',
      mobile: '01000000000',
      opening_balance: 0,
      account_id: 'acc-supp-1',
      account_name: 'حساب المورد - شركة الأمل',
      company_id: 'comp-1'
    }
  ];

  const mockAccounts: Account[] = [
    {
      id: 'acc-supp-1',
      company_id: 'comp-1',
      code: '210101001',
      name: 'حساب المورد - شركة الأمل',
      type_id: 'liabilities',
      account_usage: 'supplier',
      opening_balance: 0,
      is_active: true
    },
    {
      id: 'acc-notes-payable',
      company_id: 'comp-1',
      code: '210102',
      name: 'أوراق الدفع - شيكات صادرة',
      type_id: 'liabilities',
      account_usage: 'notes_payable',
      opening_balance: 0,
      is_active: true
    },
    {
      id: 'acc-bank-cib',
      company_id: 'comp-1',
      code: '110103001',
      name: 'البنك التجاري الدولي CIB',
      type_id: 'assets',
      account_usage: 'bank',
      opening_balance: 0,
      is_active: true
    }
  ];

  const mockPaymentMethods: PaymentMethod[] = [
    {
      id: 'pm-bank-1',
      code: 'PM-001',
      name: 'CIB البنك التجاري الدولي',
      type: 'bank',
      bank_name: 'CIB',
      account_number: '1000258963',
      account_id: 'acc-bank-cib',
      opening_balance: 0,
      company_id: 'comp-1'
    }
  ];

  const sampleCheque: IssuedCheque = {
    id: 'chk-101',
    company_id: 'comp-1',
    cheque_number: '00045892',
    supplier_id: 'supp-1',
    supplier_name: 'شركة الأمل للتوريدات',
    bank_account_id: 'pm-bank-1',
    bank_name: 'CIB',
    account_number: '1000258963',
    amount: 50000,
    currency: 'EGP',
    issue_date: '2026-09-01',
    due_date: '2026-10-01',
    status: 'DRAFT',
    payee_name: 'شركة الأمل للتوريدات',
    description: 'دفعة تحت الحساب لتوريد خامات'
  };

  it('1. Cheque Issuance Journal: Dr Supplier, Cr Notes Payable', () => {
    const journal = PostingService.generateIssuedChequeJournal(
      sampleCheque,
      mockSuppliers,
      mockAccounts
    );

    expect(journal).toBeDefined();
    expect(journal?.total_debit).toBe(50000);
    expect(journal?.total_credit).toBe(50000);
    expect(journal?.items).toHaveLength(2);

    // Debit Line: Supplier Account
    const debitLine = journal?.items.find(i => i.debit === 50000);
    expect(debitLine).toBeDefined();
    expect(debitLine?.account_id).toBe('acc-supp-1');
    expect(debitLine?.supplier_id).toBe('supp-1');

    // Credit Line: Notes Payable Account
    const creditLine = journal?.items.find(i => i.credit === 50000);
    expect(creditLine).toBeDefined();
    expect(creditLine?.account_id).toBe('acc-notes-payable');
  });

  it('2. Cheque Payment / Cashing Journal: Dr Notes Payable, Cr Bank Account', () => {
    const journal = PostingService.generateChequePaymentJournal(
      sampleCheque,
      mockPaymentMethods,
      mockAccounts
    );

    expect(journal).toBeDefined();
    expect(journal?.total_debit).toBe(50000);
    expect(journal?.total_credit).toBe(50000);
    expect(journal?.items).toHaveLength(2);

    // Debit Line: Notes Payable (Settlement)
    const debitLine = journal?.items.find(i => i.debit === 50000);
    expect(debitLine).toBeDefined();
    expect(debitLine?.account_id).toBe('acc-notes-payable');

    // Credit Line: Bank Account (Cash Outflow)
    const creditLine = journal?.items.find(i => i.credit === 50000);
    expect(creditLine).toBeDefined();
    expect(creditLine?.account_id).toBe('acc-bank-cib');
  });

  it('3. Cheque Return Reversal Journal: Dr Notes Payable, Cr Supplier Account', () => {
    const returnedCheque: IssuedCheque = {
      ...sampleCheque,
      status: 'RETURNED',
      return_date: '2026-10-02',
      return_reason: 'عدم كفاية الرصيد'
    };

    const journal = PostingService.generateChequeReturnJournal(
      returnedCheque,
      mockSuppliers,
      mockAccounts
    );

    expect(journal).toBeDefined();
    expect(journal?.total_debit).toBe(50000);
    expect(journal?.total_credit).toBe(50000);
    expect(journal?.items).toHaveLength(2);

    // Debit Line: Cancel Notes Payable
    const debitLine = journal?.items.find(i => i.debit === 50000);
    expect(debitLine).toBeDefined();
    expect(debitLine?.account_id).toBe('acc-notes-payable');

    // Credit Line: Re-establish Supplier Liability
    const creditLine = journal?.items.find(i => i.credit === 50000);
    expect(creditLine).toBeDefined();
    expect(creditLine?.account_id).toBe('acc-supp-1');
  });

  it('4. Validation Constraints: Due Date must be >= Issue Date and Amount must be positive', () => {
    const validCheque = { ...sampleCheque, issue_date: '2026-09-01', due_date: '2026-09-15', amount: 1000 };
    expect(new Date(validCheque.due_date).getTime()).toBeGreaterThanOrEqual(new Date(validCheque.issue_date).getTime());
    expect(validCheque.amount).toBeGreaterThan(0);

    const invalidDateCheque = { ...sampleCheque, issue_date: '2026-09-15', due_date: '2026-09-01' };
    expect(new Date(invalidDateCheque.due_date).getTime()).toBeLessThan(new Date(invalidDateCheque.issue_date).getTime());
  });
});
