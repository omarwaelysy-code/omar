import { 
  Invoice, 
  PurchaseInvoice, 
  ReceiptVoucher, 
  PaymentVoucher, 
  Return, 
  PurchaseReturn, 
  JournalEntry, 
  JournalEntryItem,
  Account,
  Customer,
  Supplier,
  Product,
  PaymentMethod
} from '../types';
import { dbService } from './dbService';

export class PostingService {
  /**
   * Generates a Journal Entry from an Invoice
   */
  static generateInvoiceJournal(invoice: Invoice, customers: Customer[], products: Product[], accounts: Account[], paymentMethods: PaymentMethod[]): Omit<JournalEntry, 'id'> {
    const customer = customers.find(c => c.id === invoice.customer_id);
    const subtotal = invoice.subtotal || 0;
    const discount = invoice.discount_amount || invoice.discount || 0;
    const total_amount = invoice.total_amount;

    const journalItems: JournalEntryItem[] = [];
    
    // Get Customer Account ID
    let customerAccountId = customer?.account_id || '';
    let customerAccountName = customer?.account_name || '';
    if (!customerAccountId) {
      const fallback = accounts.find(a => a.name.includes('عملاء'));
      customerAccountId = fallback?.id || 'customers_default';
      customerAccountName = fallback?.name || 'حساب العملاء (افتراضي)';
    }

    // Main Sales Invoice Debit Line (Customer Account)
    journalItems.push({
      account_id: customerAccountId,
      account_name: customerAccountName,
      debit: total_amount,
      credit: 0,
      description: `فاتورة مبيعات رقم ${invoice.invoice_number} - ${customer?.name || ''}`,
      customer_id: invoice.customer_id,
      customer_name: customer?.name
    });

    // Cash payments logic
    if (invoice.payment_type === 'cash') {
      const pm = paymentMethods.find(p => p.id === invoice.payment_method_id);
      let cashAccountId = pm?.account_id || '';
      let cashAccountName = pm?.account_name || '';
      
      if (!cashAccountId) {
        const fallback = accounts.find(a => a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق'));
        cashAccountId = fallback?.id || 'cash_default';
        cashAccountName = fallback?.name || 'حساب النقدية (افتراضي)';
      }

      // Debit Cash/Bank
      journalItems.push({
        account_id: cashAccountId,
        account_name: cashAccountName,
        debit: total_amount,
        credit: 0,
        description: `تحصيل فاتورة مبيعات رقم ${invoice.invoice_number} - ${customer?.name || ''}`,
        sub_account_id: invoice.payment_method_id,
        sub_account_type: 'payment_method'
      });

      // Credit Customer (to clear the receivable)
      journalItems.push({
        account_id: customerAccountId,
        account_name: customerAccountName,
        debit: 0,
        credit: total_amount,
        description: `سداد فاتورة مبيعات رقم ${invoice.invoice_number} - ${customer?.name || ''}`,
        customer_id: invoice.customer_id,
        customer_name: customer?.name,
        sub_account_id: invoice.customer_id,
        sub_account_type: 'customer'
      });
    }

    // Discount
    if (discount > 0) {
      const discountAccount = accounts.find(a => a.name.includes('خصم مسموح به') || a.name.includes('خصم مبيعات'));
      journalItems.push({
        account_id: discountAccount?.id || 'discount_allowed_default',
        account_name: discountAccount?.name || 'حساب الخصم المسموح به',
        debit: discount,
        credit: 0,
        description: `خصم مسموح به - فاتورة رقم ${invoice.invoice_number}`
      });
    }

    // Credit side: Sales Revenue
    invoice.items?.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      let salesAccountId = product?.revenue_account_id || '';
      let salesAccountName = product?.revenue_account_name || '';
      
      if (!salesAccountId) {
        const fallback = accounts.find(a => a.name.includes('مبيعات') || a.name.includes('إيراد'));
        salesAccountId = fallback?.id || 'sales_default';
        salesAccountName = fallback?.name || 'حساب المبيعات (افتراضي)';
      }

      journalItems.push({
        account_id: salesAccountId,
        account_name: salesAccountName,
        debit: 0,
        credit: item.total,
        description: `مبيعات صنف: ${item.product_name} - فاتورة ${invoice.invoice_number}`
      });
    });

    return {
      date: invoice.date,
      reference_number: invoice.invoice_number,
      reference_id: invoice.id,
      reference_type: 'invoice',
      description: `قيد فاتورة مبيعات رقم: ${invoice.invoice_number}`,
      items: journalItems,
      total_debit: total_amount + discount,
      total_credit: total_amount + discount,
      company_id: invoice.company_id || '',
      created_at: new Date().toISOString(),
      created_by: invoice.id // Placeholder or system
    };
  }

  // Similar methods for other document types...
  // I will implement them as I go in the backfill tool.

  /**
   * Reposts a single document
   */
  static async repostDocument(collection: string, doc: any, companyId: string, dependencies: any) {
    let entry: Omit<JournalEntry, 'id'> | null = null;
    
    switch (collection) {
      case 'invoices':
        entry = this.generateInvoiceJournal(doc, dependencies.customers, dependencies.products, dependencies.accounts, dependencies.paymentMethods);
        break;
      case 'receipt_vouchers':
        entry = this.generateReceiptJournal(doc, dependencies.customers, dependencies.accounts, dependencies.paymentMethods);
        break;
      case 'payment_vouchers':
        entry = this.generatePaymentVoucherJournal(doc, dependencies.suppliers, dependencies.accounts, dependencies.paymentMethods);
        break;
      case 'returns':
        entry = this.generateReturnJournal(doc, dependencies.customers, dependencies.products, dependencies.accounts, dependencies.paymentMethods);
        break;
      case 'purchase_invoices':
        entry = this.generatePurchaseInvoiceJournal(doc, dependencies.suppliers, dependencies.products, dependencies.accounts, dependencies.paymentMethods);
        break;
      case 'purchase_returns':
        entry = this.generatePurchaseReturnJournal(doc, dependencies.suppliers, dependencies.products, dependencies.accounts, dependencies.paymentMethods);
        break;
      case 'cash_transfers':
        entry = this.generateTransferJournal(doc, dependencies.paymentMethods, dependencies.accounts);
        break;
    }

    if (entry) {
      // First delete any existing journal entry for this reference
      await dbService.deleteJournalEntryByReference(doc.id, companyId);
      // Create new one
      await dbService.createJournalEntry({
        ...entry,
        company_id: companyId
      });
    }
  }

  static generateReturnJournal(doc: Return, customers: Customer[], products: Product[], accounts: Account[], paymentMethods: PaymentMethod[]): Omit<JournalEntry, 'id'> {
    const customer = customers.find(c => c.id === doc.customer_id);
    const total_amount = doc.total_amount;

    const journalItems: JournalEntryItem[] = [];

    // Debit side: Sales Returns (Expense/Revenue reduction)
    doc.items?.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      let salesReturnAccountId = product?.revenue_account_id || ''; 
      let salesReturnAccountName = product?.revenue_account_name || '';

      if (!salesReturnAccountId) {
        const fallback = accounts.find(a => a.name.includes('مردودات مبيعات') || a.name.includes('مبيعات'));
        salesReturnAccountId = fallback?.id || 'sales_returns_default';
        salesReturnAccountName = fallback?.name || 'حساب مردودات المبيعات';
      }

      journalItems.push({
        account_id: salesReturnAccountId,
        account_name: salesReturnAccountName,
        debit: item.total,
        credit: 0,
        description: `مردودات مبيعات: ${item.product_name} - مرتجع ${doc.return_number || doc.id.slice(-6)}`
      });
    });

    // Debit Customer Account (Clear customer balance on return)
    let customerAccountId = customer?.account_id || '';
    let customerAccountName = customer?.account_name || '';
    if (!customerAccountId) {
      const fallback = accounts.find(a => a.name.includes('عملاء'));
      customerAccountId = fallback?.id || 'customers_account_default';
      customerAccountName = fallback?.name || 'حساب العملاء (افتراضي)';
    }

    journalItems.push({
      account_id: customerAccountId,
      account_name: customerAccountName,
      debit: 0,
      credit: total_amount,
      description: `مرتجع مبيعات رقم ${doc.return_number || doc.id.slice(-6)} - ${customer?.name || ''}`,
      customer_id: doc.customer_id,
      customer_name: customer?.name
    });

    if (doc.payment_type === 'cash') {
      const pm = paymentMethods.find(p => p.id === doc.payment_method_id);
      let cashAccountId = pm?.account_id || '';
      let cashAccountName = pm?.account_name || '';
      if (!cashAccountId) {
        const fallback = accounts.find(a => a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق'));
        cashAccountId = fallback?.id || 'cash_account_default';
        cashAccountName = fallback?.name || 'حساب النقدية (افتراضي)';
      }

      // Debit Customer (to offset the credit return)
      journalItems.push({
        account_id: customerAccountId,
        account_name: customerAccountName,
        debit: total_amount,
        credit: 0,
        description: `تسوية نقدية لمرتجع مبيعات رقم ${doc.return_number || doc.id.slice(-6)} - ${customer?.name || ''}`,
        customer_id: doc.customer_id,
        customer_name: customer?.name,
        sub_account_id: doc.customer_id,
        sub_account_type: 'customer'
      });

      // Credit Cash/Bank
      journalItems.push({
        account_id: cashAccountId,
        account_name: cashAccountName,
        debit: 0,
        credit: total_amount,
        description: `دفع نقدية مقابل مرتجع مبيعات رقم ${doc.return_number || doc.id.slice(-6)} - ${customer?.name || ''}`,
        sub_account_id: doc.payment_method_id,
        sub_account_type: 'payment_method'
      });
    }

    return {
      date: doc.date,
      reference_number: doc.return_number || doc.id.slice(-6),
      reference_id: doc.id,
      reference_type: 'return',
      description: `قيد مرتجع مبيعات رقم: ${doc.return_number || ''}`,
      items: journalItems,
      total_debit: journalItems.reduce((sum, i) => sum + i.debit, 0),
      total_credit: journalItems.reduce((sum, i) => sum + i.credit, 0),
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  static generatePurchaseInvoiceJournal(doc: PurchaseInvoice, suppliers: Supplier[], products: Product[], accounts: Account[], paymentMethods: PaymentMethod[]): Omit<JournalEntry, 'id'> {
    const supplier = suppliers.find(s => s.id === doc.supplier_id);
    const total_amount = doc.total_amount;

    const journalItems: JournalEntryItem[] = [];

    // Debit side: Purchases / Inventory
    doc.items?.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      let purchaseAccountId = product?.cost_account_id || '';
      let purchaseAccountName = product?.cost_account_name || '';

      if (!purchaseAccountId) {
        const fallback = accounts.find(a => a.name.includes('مشتريات') || a.name.includes('مخزون'));
        purchaseAccountId = fallback?.id || 'purchases_default';
        purchaseAccountName = fallback?.name || 'حساب المشتريات';
      }

      journalItems.push({
        account_id: purchaseAccountId,
        account_name: purchaseAccountName,
        debit: item.total,
        credit: 0,
        description: `مشتريات: ${item.product_name} - فاتورة ${doc.invoice_number}`
      });
    });

    // Credit Supplier Account (Account Payable)
    let supplierAccountId = supplier?.account_id || '';
    let supplierAccountName = supplier?.account_name || '';
    if (!supplierAccountId) {
      const fallback = accounts.find(a => a.name.includes('موردين'));
      supplierAccountId = fallback?.id || 'supplier_account_default';
      supplierAccountName = fallback?.name || 'حساب الموردين (افتراضي)';
    }

    journalItems.push({
      account_id: supplierAccountId,
      account_name: supplierAccountName,
      debit: 0,
      credit: total_amount,
      description: `فاتورة مشتريات رقم ${doc.invoice_number} - ${supplier?.name || ''}`,
      supplier_id: doc.supplier_id,
      supplier_name: supplier?.name
    });

    if (doc.payment_type === 'cash') {
      const pm = paymentMethods.find(p => p.id === doc.payment_method_id);
      let cashAccountId = pm?.account_id || '';
      let cashAccountName = pm?.account_name || '';
      if (!cashAccountId) {
        const fallback = accounts.find(a => a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق'));
        cashAccountId = fallback?.id || 'cash_account_default';
        cashAccountName = fallback?.name || 'حساب النقدية (افتراضي)';
      }

      // Credit Cash/Bank
      journalItems.push({
        account_id: cashAccountId,
        account_name: cashAccountName,
        debit: 0,
        credit: total_amount,
        description: `دفع نقدية مقابل فاتورة مشتريات رقم ${doc.invoice_number} - ${supplier?.name || ''}`,
        sub_account_id: doc.payment_method_id,
        sub_account_type: 'payment_method'
      });

      // Debit Supplier (to clear the payable)
      journalItems.push({
        account_id: supplierAccountId,
        account_name: supplierAccountName,
        debit: total_amount,
        credit: 0,
        description: `تسوية نقدية لفاتورة مشتريات رقم ${doc.invoice_number} - ${supplier?.name || ''}`,
        supplier_id: doc.supplier_id,
        supplier_name: supplier?.name,
        sub_account_id: doc.supplier_id,
        sub_account_type: 'supplier'
      });
    }

    return {
      date: doc.date,
      reference_number: doc.invoice_number,
      reference_id: doc.id,
      reference_type: 'purchase_invoice',
      description: `قيد فاتورة مشتريات رقم: ${doc.invoice_number}`,
      items: journalItems,
      total_debit: total_amount,
      total_credit: total_amount,
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  static generatePurchaseReturnJournal(doc: PurchaseReturn, suppliers: Supplier[], products: Product[], accounts: Account[], paymentMethods: PaymentMethod[]): Omit<JournalEntry, 'id'> {
    const supplier = suppliers.find(s => s.id === doc.supplier_id);
    const total_amount = doc.total_amount;

    const journalItems: JournalEntryItem[] = [];

    // Supplier account ID
    let supplierAccountId = supplier?.account_id || '';
    let supplierAccountName = supplier?.account_name || '';
    if (!supplierAccountId) {
      const fallback = accounts.find(a => a.name.includes('موردين'));
      supplierAccountId = fallback?.id || 'suppliers_account_default';
      supplierAccountName = fallback?.name || 'حساب الموردين (افتراضي)';
    }

    journalItems.push({
      account_id: supplierAccountId,
      account_name: supplierAccountName,
      debit: total_amount,
      credit: 0,
      description: `مرتجع مشتريات رقم ${doc.return_number || doc.id.slice(-6)} - ${supplier?.name || ''}`,
      supplier_id: doc.supplier_id,
      supplier_name: supplier?.name
    });

    if (doc.payment_type === 'cash') {
      const pm = paymentMethods.find(p => p.id === doc.payment_method_id);
      let cashAccountId = pm?.account_id || '';
      let cashAccountName = pm?.account_name || '';
      if (!cashAccountId) {
        const fallback = accounts.find(a => a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق'));
        cashAccountId = fallback?.id || 'cash_account_default';
        cashAccountName = fallback?.name || 'حساب النقدية (افتراضي)';
      }

      // Debit Cash/Bank
      journalItems.push({
        account_id: cashAccountId,
        account_name: cashAccountName,
        debit: total_amount,
        credit: 0,
        description: `استلام نقدية مقابل مرتجع مشتريات رقم ${doc.return_number || doc.id.slice(-6)} - ${supplier?.name || ''}`,
        sub_account_id: doc.payment_method_id,
        sub_account_type: 'payment_method'
      });

      // Credit Supplier
      journalItems.push({
        account_id: supplierAccountId,
        account_name: supplierAccountName,
        debit: 0,
        credit: total_amount,
        description: `تسوية نقدية لمرتجع مشتريات رقم ${doc.return_number || doc.id.slice(-6)} - ${supplier?.name || ''}`,
        supplier_id: doc.supplier_id,
        supplier_name: supplier?.name,
        sub_account_id: doc.supplier_id,
        sub_account_type: 'supplier'
      });
    }

    // Credit side: Purchase Returns / Inventory reduction
    doc.items?.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      let purchaseReturnAccountId = product?.cost_account_id || '';
      let purchaseReturnAccountName = product?.cost_account_name || '';

      if (!purchaseReturnAccountId) {
        const fallback = accounts.find(a => a.name.includes('مردودات مشتريات') || a.name.includes('مشتريات'));
        purchaseReturnAccountId = fallback?.id || 'purchase_returns_default';
        purchaseReturnAccountName = fallback?.name || 'حساب مردودات مشتريات';
      }

      journalItems.push({
        account_id: purchaseReturnAccountId,
        account_name: purchaseReturnAccountName,
        debit: 0,
        credit: item.total,
        description: `مرتجع مشتريات: ${item.product_name} - رقم ${doc.return_number}`
      });
    });

    return {
      date: doc.date,
      reference_number: doc.return_number || doc.id.slice(-6),
      reference_id: doc.id,
      reference_type: 'purchase_return',
      description: `قيد مرتجع مشتريات رقم: ${doc.return_number || ''}`,
      items: journalItems,
      total_debit: total_amount,
      total_credit: total_amount,
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  static generateTransferJournal(doc: any, paymentMethods: PaymentMethod[], accounts: Account[]): Omit<JournalEntry, 'id'> {
    const fromPm = paymentMethods.find(p => p.id === doc.from_payment_method_id);
    const toPm = paymentMethods.find(p => p.id === doc.to_payment_method_id);
    const amount = doc.amount;

    return {
      date: doc.date,
      reference_number: doc.id.slice(-6),
      reference_id: doc.id,
      reference_type: 'transfer',
      description: `تحويل نقدية: من ${fromPm?.name || ''} إلى ${toPm?.name || ''} - ${doc.description || ''}`,
      items: [
        {
          account_id: toPm?.account_id || '',
          account_name: toPm?.account_name || 'حساب بنك/خزينة (مستلم)',
          debit: amount,
          credit: 0,
          description: `وارد تحويل من ${fromPm?.name || ''}`,
          sub_account_id: toPm?.id,
          sub_account_type: 'payment_method'
        },
        {
          account_id: fromPm?.account_id || '',
          account_name: fromPm?.account_name || 'حساب بنك/خزينة (محول)',
          debit: 0,
          credit: amount,
          description: `صادر تحويل إلى ${toPm?.name || ''}`,
          sub_account_id: fromPm?.id,
          sub_account_type: 'payment_method'
        }
      ],
      total_debit: amount,
      total_credit: amount,
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  static generateReceiptJournal(doc: ReceiptVoucher, customers: Customer[], accounts: Account[], paymentMethods: PaymentMethod[]): Omit<JournalEntry, 'id'> {
    const customer = customers.find(c => c.id === doc.customer_id);
    const pm = paymentMethods.find(p => p.id === doc.payment_method_id);
    
    let cashAccountId = pm?.account_id || '';
    let cashAccountName = pm?.account_name || '';
    if (!cashAccountId) {
      const fallback = accounts.find(a => a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق'));
      cashAccountId = fallback?.id || 'cash_default';
      cashAccountName = fallback?.name || 'حساب النقدية (افتراضي)';
    }

    let customerAccountId = customer?.account_id || '';
    let customerAccountName = customer?.account_name || '';
    if (!customerAccountId) {
      const fallback = accounts.find(a => a.name.includes('عملاء'));
      customerAccountId = fallback?.id || 'customers_default';
      customerAccountName = fallback?.name || 'حساب العملاء (افتراضي)';
    }

    return {
      date: doc.date,
      reference_number: doc.voucher_number || doc.id.slice(-6),
      reference_id: doc.id,
      reference_type: 'receipt',
      description: `سند قبض رقم: ${doc.voucher_number || ''} - ${doc.description}`,
      items: [
        {
          account_id: cashAccountId,
          account_name: cashAccountName,
          debit: doc.amount,
          credit: 0,
          description: `تحصيل من العميل: ${doc.customer_name || customer?.name || ''}`
        },
        {
          account_id: customerAccountId,
          account_name: customerAccountName,
          debit: 0,
          credit: doc.amount,
          description: `سند قبض رقم: ${doc.voucher_number || ''}`,
          customer_id: doc.customer_id,
          customer_name: doc.customer_name || customer?.name
        }
      ],
      total_debit: doc.amount,
      total_credit: doc.amount,
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  static generatePaymentVoucherJournal(doc: PaymentVoucher, suppliers: Supplier[], accounts: Account[], paymentMethods: PaymentMethod[]): Omit<JournalEntry, 'id'> {
    const supplier = suppliers.find(s => s.id === doc.supplier_id);
    const pm = paymentMethods.find(p => p.id === doc.payment_method_id);
    
    let cashAccountId = pm?.account_id || '';
    let cashAccountName = pm?.account_name || '';
    if (!cashAccountId) {
      const fallback = accounts.find(a => a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق'));
      cashAccountId = fallback?.id || 'cash_default';
      cashAccountName = fallback?.name || 'حساب النقدية (افتراضي)';
    }

    let targetAccountId = doc.account_id || '';
    let targetAccountName = '';

    if (doc.supplier_id) {
      targetAccountId = supplier?.account_id || '';
      targetAccountName = supplier?.account_name || '';
    }

    if (!targetAccountId) {
      const fallback = accounts.find(a => a.name.includes('موردين') || a.name.includes('مصروف'));
      targetAccountId = fallback?.id || 'expense_default';
      targetAccountName = fallback?.name || 'حساب مصروف (افتراضي)';
    }

    return {
      date: doc.date,
      reference_number: doc.voucher_number || doc.id.slice(-6),
      reference_id: doc.id,
      reference_type: 'payment',
      description: `سند صرف رقم: ${doc.voucher_number || ''} - ${doc.description}`,
      items: [
        {
          account_id: targetAccountId,
          account_name: targetAccountName || 'حساب مدين',
          debit: doc.amount,
          credit: 0,
          description: doc.description,
          supplier_id: doc.supplier_id,
          supplier_name: doc.supplier_name
        },
        {
          account_id: cashAccountId,
          account_name: cashAccountName,
          debit: 0,
          credit: doc.amount,
          description: `صرف من: ${pm?.name || ''}`
        }
      ],
      total_debit: doc.amount,
      total_credit: doc.amount,
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }
}
