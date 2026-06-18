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
  static generateInvoiceJournal(invoice: Invoice, customers: Customer[], products: Product[], accounts: Account[], paymentMethods: PaymentMethod[], settings?: any): Omit<JournalEntry, 'id'> {
    const customer = customers.find(c => c.id === invoice.customer_id);
    const subtotal = Number(invoice.subtotal) || 0;
    const discount = Number(invoice.discount_amount || invoice.discount) || 0;
    const total_amount = Number(invoice.total_amount) || 0;

    const journalItems: JournalEntryItem[] = [];
    
    // Get Customer Account ID
    let customerAccountId = customer?.account_id || '';
    let customerAccountName = customer?.account_name || 'حساب العملاء';

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
      let cashAccountName = pm?.account_name || 'حساب النقدية';

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
      const discountAccountId = settings?.customer_discount_account_id || '';
      const discountAccount = accounts.find(a => a.id === discountAccountId);
      journalItems.push({
        account_id: discountAccountId,
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
      let salesAccountName = product?.revenue_account_name || 'حساب المبيعات';

      journalItems.push({
        account_id: salesAccountId,
        account_name: salesAccountName,
        debit: 0,
        credit: Number(item.total) || 0,
        description: `مبيعات صنف: ${item.product_name} - فاتورة ${invoice.invoice_number}`
      });
    });

    // VAT / Tax credit line (grouped by item product's vat_account_id)
    const vatGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    invoice.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const vatAccountId = prod?.vat_account_id || '';
      const vatAccountName = prod?.vat_account_name || 'حساب ضريبة القيمة المضافة';
      const rateVal = item.vat_rate !== undefined ? item.vat_rate : (prod?.vat_rate || 0);
      const itemTotal = Number(item.total) || 0;
      const itemVat = Number((itemTotal * (rateVal / 100)).toFixed(2));
      
      if (itemVat > 0) {
        let finalVatAccountId = vatAccountId;
        let finalVatAccountName = vatAccountName;
        
        if (!finalVatAccountId) {
          const globalVatAccount = accounts.find(a => 
            a.name.includes('ضريبة القيمة المضافة') || 
            a.name.includes('قيمة مضافة') || 
            a.name.includes('ضريبة مبيعات')
          );
          finalVatAccountId = globalVatAccount?.id || '';
          finalVatAccountName = globalVatAccount?.name || finalVatAccountName;
        }
        
        if (finalVatAccountId) {
          if (!vatGroup[finalVatAccountId]) {
            vatGroup[finalVatAccountId] = {
              account_id: finalVatAccountId,
              account_name: finalVatAccountName,
              amount: 0
            };
          }
          vatGroup[finalVatAccountId].amount += itemVat;
        }
      }
    });

    const taxAmount = Number(invoice.tax_amount || invoice.tax || 0);
    if (Object.keys(vatGroup).length > 0) {
      Object.values(vatGroup).forEach(vat => {
        journalItems.push({
          account_id: vat.account_id,
          account_name: vat.account_name,
          debit: 0,
          credit: vat.amount,
          description: `ضريبة القيمة المضافة - فاتورة مبيعات رقم ${invoice.invoice_number}`
        });
      });
    } else if (taxAmount > 0) {
      const vatAccount = accounts.find(a => 
        a.name.includes('ضريبة القيمة المضافة') || 
        a.name.includes('قيمة مضافة') || 
        a.name.includes('ضريبة مبيعات')
      );
      const vatAccountId = vatAccount?.id || '';
      const vatAccountName = vatAccount?.name || 'حساب ضريبة القيمة المضافة';
      journalItems.push({
        account_id: vatAccountId,
        account_name: vatAccountName,
        debit: 0,
        credit: taxAmount,
        description: `ضريبة القيمة المضافة - فاتورة مبيعات رقم ${invoice.invoice_number}`
      });
    }

    return {
      date: invoice.date,
      reference_number: invoice.invoice_number,
      reference_id: invoice.id,
      reference_type: 'invoice',
      description: `قيد فاتورة مبيعات رقم: ${invoice.invoice_number}`,
      items: journalItems,
      total_debit: Number(journalItems.reduce((sum, i) => sum + (Number(i.debit) || 0), 0).toFixed(2)),
      total_credit: Number(journalItems.reduce((sum, i) => sum + (Number(i.credit) || 0), 0).toFixed(2)),
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
        entry = this.generateInvoiceJournal(doc, dependencies.customers, dependencies.products, dependencies.accounts, dependencies.paymentMethods, dependencies.settings);
        break;
      case 'receipt_vouchers':
        entry = this.generateReceiptJournal(doc, dependencies.customers, dependencies.suppliers, dependencies.accounts, dependencies.paymentMethods, dependencies.expenseCategories);
        break;
      case 'payment_vouchers':
        entry = this.generatePaymentVoucherJournal(doc, dependencies.suppliers, dependencies.customers, dependencies.accounts, dependencies.paymentMethods, dependencies.expenseCategories);
        break;
      case 'returns':
        entry = this.generateReturnJournal(doc, dependencies.customers, dependencies.products, dependencies.accounts, dependencies.paymentMethods);
        break;
      case 'purchase_invoices':
        entry = this.generatePurchaseInvoiceJournal(doc, dependencies.suppliers, dependencies.products, dependencies.accounts, dependencies.paymentMethods, dependencies.settings);
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
    const total_amount = Number(doc.total_amount) || 0;

    const journalItems: JournalEntryItem[] = [];

    // Debit side: Sales Returns (Expense/Revenue reduction)
    doc.items?.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      let salesReturnAccountId = product?.revenue_account_id || ''; 
      let salesReturnAccountName = product?.revenue_account_name || 'حساب مردودات المبيعات';

      journalItems.push({
        account_id: salesReturnAccountId,
        account_name: salesReturnAccountName,
        debit: Number(item.total) || 0,
        credit: 0,
        description: `مردودات مبيعات: ${item.product_name} - مرتجع ${doc.return_number || doc.id.slice(-6)}`
      });
    });

    // VAT / Tax debit line for returns (grouped by item product's vat_account_id)
    const vatGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    doc.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const vatAccountId = prod?.vat_account_id || '';
      const vatAccountName = prod?.vat_account_name || 'حساب ضريبة القيمة المضافة';
      const rateVal = item.vat_rate !== undefined ? item.vat_rate : (prod?.vat_rate || 0);
      const itemTotal = Number(item.total) || 0;
      const itemVat = Number((itemTotal * (rateVal / 100)).toFixed(2));
      
      if (itemVat > 0) {
        let finalVatAccountId = vatAccountId;
        let finalVatAccountName = vatAccountName;
        
        if (!finalVatAccountId) {
          const globalVatAccount = accounts.find(a => 
            a.name.includes('ضريبة القيمة المضافة') || 
            a.name.includes('قيمة مضافة') || 
            a.name.includes('ضريبة مبيعات')
          );
          finalVatAccountId = globalVatAccount?.id || '';
          finalVatAccountName = globalVatAccount?.name || finalVatAccountName;
        }
        
        if (finalVatAccountId) {
          if (!vatGroup[finalVatAccountId]) {
            vatGroup[finalVatAccountId] = {
              account_id: finalVatAccountId,
              account_name: finalVatAccountName,
              amount: 0
            };
          }
          vatGroup[finalVatAccountId].amount += itemVat;
        }
      }
    });

    const taxAmountReturn = Number(doc.tax_amount || 0);
    if (Object.keys(vatGroup).length > 0) {
      Object.values(vatGroup).forEach(vat => {
        journalItems.push({
          account_id: vat.account_id,
          account_name: vat.account_name,
          debit: vat.amount,
          credit: 0,
          description: `ضريبة القيمة المضافة - مرتجع مبيعات رقم ${doc.return_number || doc.id.slice(-6)}`
        });
      });
    } else if (taxAmountReturn > 0) {
      const vatAccount = accounts.find(a => 
        a.name.includes('ضريبة القيمة المضافة') || 
        a.name.includes('قيمة مضافة') || 
        a.name.includes('ضريبة مبيعات')
      );
      const vatAccountId = vatAccount?.id || '';
      const vatAccountName = vatAccount?.name || 'حساب ضريبة القيمة المضافة';
      journalItems.push({
        account_id: vatAccountId,
        account_name: vatAccountName,
        debit: taxAmountReturn,
        credit: 0,
        description: `ضريبة القيمة المضافة - مرتجع مبيعات رقم ${doc.return_number || doc.id.slice(-6)}`
      });
    }

    // Debit Customer Account (Clear customer balance on return)
    let customerAccountId = customer?.account_id || '';
    let customerAccountName = customer?.account_name || 'حساب العملاء';

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
      let cashAccountName = pm?.account_name || 'حساب النقدية';

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
      total_debit: Number(journalItems.reduce((sum, i) => sum + (Number(i.debit) || 0), 0).toFixed(2)),
      total_credit: Number(journalItems.reduce((sum, i) => sum + (Number(i.credit) || 0), 0).toFixed(2)),
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  static generatePurchaseInvoiceJournal(doc: PurchaseInvoice, suppliers: Supplier[], products: Product[], accounts: Account[], paymentMethods: PaymentMethod[], settings?: any): Omit<JournalEntry, 'id'> {
    const supplier = suppliers.find(s => s.id === doc.supplier_id);
    const total_amount = Number(doc.total_amount) || 0;

    const journalItems: JournalEntryItem[] = [];

    // Debit side: Purchases / Inventory
    doc.items?.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      let purchaseAccountId = product?.cost_account_id || '';
      let purchaseAccountName = product?.cost_account_name || 'حساب المشتريات';

      journalItems.push({
        account_id: purchaseAccountId,
        account_name: purchaseAccountName,
        debit: Number(item.total) || 0,
        credit: 0,
        description: `مشتريات: ${item.product_name} - فاتورة ${doc.invoice_number}`
      });
    });

    // VAT / Tax debit line (grouped by item product's vat_account_id)
    const vatGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    doc.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const vatAccountId = prod?.vat_account_id || '';
      const vatAccountName = prod?.vat_account_name || 'حساب ضريبة القيمة المضافة';
      const rateVal = item.vat_rate !== undefined ? item.vat_rate : (prod?.vat_rate || 0);
      const itemTotal = Number(item.total) || 0;
      const itemVat = Number((itemTotal * (rateVal / 100)).toFixed(2));
      
      if (itemVat > 0) {
        let finalVatAccountId = vatAccountId;
        let finalVatAccountName = vatAccountName;
        
        if (!finalVatAccountId) {
          const globalVatAccount = accounts.find(a => 
            a.name.includes('ضريبة القيمة المضافة') || 
            a.name.includes('قيمة مضافة') || 
            a.name.includes('ضريبة مدخلات')
          );
          finalVatAccountId = globalVatAccount?.id || '';
          finalVatAccountName = globalVatAccount?.name || finalVatAccountName;
        }
        
        if (finalVatAccountId) {
          if (!vatGroup[finalVatAccountId]) {
            vatGroup[finalVatAccountId] = {
              account_id: finalVatAccountId,
              account_name: finalVatAccountName,
              amount: 0
            };
          }
          vatGroup[finalVatAccountId].amount += itemVat;
        }
      }
    });

    const taxAmountPurchase = Number(doc.tax_amount || 0);
    if (Object.keys(vatGroup).length > 0) {
      Object.values(vatGroup).forEach(vat => {
        journalItems.push({
          account_id: vat.account_id,
          account_name: vat.account_name,
          debit: vat.amount,
          credit: 0,
          description: `ضريبة القيمة المضافة - فاتورة مشتريات رقم ${doc.invoice_number}`
        });
      });
    } else if (taxAmountPurchase > 0) {
      const vatAccount = accounts.find(a => 
        a.name.includes('ضريبة القيمة المضافة') || 
        a.name.includes('قيمة مضافة') || 
        a.name.includes('ضريبة مدخلات')
      );
      const vatAccountId = vatAccount?.id || '';
      const vatAccountName = vatAccount?.name || 'حساب ضريبة القيمة المضافة';
      journalItems.push({
        account_id: vatAccountId,
        account_name: vatAccountName,
        debit: taxAmountPurchase,
        credit: 0,
        description: `ضريبة القيمة المضافة - فاتورة مشتريات رقم ${doc.invoice_number}`
      });
    }

    // Credit Supplier Account (Account Payable)
    let supplierAccountId = supplier?.account_id || '';
    let supplierAccountName = supplier?.account_name || 'حساب الموردين';

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
      let cashAccountName = pm?.account_name || 'حساب النقدية';

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
      total_debit: Number(journalItems.reduce((sum, i) => sum + (Number(i.debit) || 0), 0).toFixed(2)),
      total_credit: Number(journalItems.reduce((sum, i) => sum + (Number(i.credit) || 0), 0).toFixed(2)),
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  static generatePurchaseReturnJournal(doc: PurchaseReturn, suppliers: Supplier[], products: Product[], accounts: Account[], paymentMethods: PaymentMethod[]): Omit<JournalEntry, 'id'> {
    const supplier = suppliers.find(s => s.id === doc.supplier_id);
    const total_amount = Number(doc.total_amount) || 0;

    const journalItems: JournalEntryItem[] = [];

    // Supplier account ID
    let supplierAccountId = supplier?.account_id || '';
    let supplierAccountName = supplier?.account_name || 'حساب الموردين';

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
      let cashAccountName = pm?.account_name || 'حساب النقدية';

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
      let purchaseReturnAccountName = product?.cost_account_name || 'حساب مردودات المشتريات';

      journalItems.push({
        account_id: purchaseReturnAccountId,
        account_name: purchaseReturnAccountName,
        debit: 0,
        credit: Number(item.total) || 0,
        description: `مرتجع مشتريات: ${item.product_name} - رقم ${doc.return_number}`
      });
    });

    // VAT / Tax credit line for purchase returns (grouped by item product's vat_account_id)
    const vatGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    doc.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const vatAccountId = prod?.vat_account_id || '';
      const vatAccountName = prod?.vat_account_name || 'حساب ضريبة القيمة المضافة';
      const rateVal = item.vat_rate !== undefined ? item.vat_rate : (prod?.vat_rate || 0);
      const itemTotal = Number(item.total) || 0;
      const itemVat = Number((itemTotal * (rateVal / 100)).toFixed(2));
      
      if (itemVat > 0) {
        let finalVatAccountId = vatAccountId;
        let finalVatAccountName = vatAccountName;
        
        if (!finalVatAccountId) {
          const globalVatAccount = accounts.find(a => 
            a.name.includes('ضريبة القيمة المضافة') || 
            a.name.includes('قيمة مضافة') || 
            a.name.includes('ضريبة مدخلات')
          );
          finalVatAccountId = globalVatAccount?.id || '';
          finalVatAccountName = globalVatAccount?.name || finalVatAccountName;
        }
        
        if (finalVatAccountId) {
          if (!vatGroup[finalVatAccountId]) {
            vatGroup[finalVatAccountId] = {
              account_id: finalVatAccountId,
              account_name: finalVatAccountName,
              amount: 0
            };
          }
          vatGroup[finalVatAccountId].amount += itemVat;
        }
      }
    });

    const taxAmountPurchaseReturn = Number(doc.tax_amount || 0);
    if (Object.keys(vatGroup).length > 0) {
      Object.values(vatGroup).forEach(vat => {
        journalItems.push({
          account_id: vat.account_id,
          account_name: vat.account_name,
          debit: 0,
          credit: vat.amount,
          description: `ضريبة القيمة المضافة - مرتجع مشتريات رقم ${doc.return_number || doc.id.slice(-6)}`
        });
      });
    } else if (taxAmountPurchaseReturn > 0) {
      const vatAccount = accounts.find(a => 
        a.name.includes('ضريبة القيمة المضافة') || 
        a.name.includes('قيمة مضافة') || 
        a.name.includes('ضريبة مدخلات')
      );
      const vatAccountId = vatAccount?.id || '';
      const vatAccountName = vatAccount?.name || 'حساب ضريبة القيمة المضافة';
      journalItems.push({
        account_id: vatAccountId,
        account_name: vatAccountName,
        debit: 0,
        credit: taxAmountPurchaseReturn,
        description: `ضريبة القيمة المضافة - مرتجع مشتريات رقم ${doc.return_number || doc.id.slice(-6)}`
      });
    }

    return {
      date: doc.date,
      reference_number: doc.return_number || doc.id.slice(-6),
      reference_id: doc.id,
      reference_type: 'purchase_return',
      description: `قيد مرتجع مشتريات رقم: ${doc.return_number || ''}`,
      items: journalItems,
      total_debit: Number(journalItems.reduce((sum, i) => sum + (Number(i.debit) || 0), 0).toFixed(2)),
      total_credit: Number(journalItems.reduce((sum, i) => sum + (Number(i.credit) || 0), 0).toFixed(2)),
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  static generateTransferJournal(doc: any, paymentMethods: PaymentMethod[], accounts: Account[]): Omit<JournalEntry, 'id'> {
    const fromPm = paymentMethods.find(p => p.id === doc.from_payment_method_id);
    const toPm = paymentMethods.find(p => p.id === doc.to_payment_method_id);
    const amount = Number(doc.amount) || 0;

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

  static generateReceiptJournal(
    doc: ReceiptVoucher, 
    customers: Customer[], 
    suppliers: Supplier[], 
    accounts: Account[], 
    paymentMethods: PaymentMethod[],
    expenseCategories: any[] = []
  ): Omit<JournalEntry, 'id'> {
    const pm = paymentMethods.find(p => p.id === doc.payment_method_id);
    const amount = Number(doc.amount) || 0;
    
    let cashAccountId = pm?.account_id || '';
    let cashAccountName = pm?.account_name || 'حساب النقدية';

    const journalItems: JournalEntryItem[] = [];
    const isMulti = doc.voucher_type === 'multi' || (doc.items && doc.items.length > 0);

    if (isMulti) {
      doc.items?.forEach(item => {
        let creditAccountId = '';
        let creditAccountName = '';
        let subAccountId = item.sub_account_id || undefined;
        let subAccountType = item.sub_account_type || undefined;

        if (item.type === 'customer') {
          const customer = customers.find(c => c.id === item.entity_id);
          creditAccountId = customer?.account_id || '';
          creditAccountName = customer?.account_name || 'حساب العملاء';
          subAccountId = customer?.id;
          subAccountType = 'customer';
        } else if (item.type === 'supplier') {
          const supplier = suppliers.find(s => s.id === item.entity_id);
          creditAccountId = supplier?.account_id || '';
          creditAccountName = supplier?.account_name || 'حساب الموردين';
          subAccountId = supplier?.id;
          subAccountType = 'supplier';
        } else if (item.type === 'expense') {
          const category = expenseCategories.find(c => c.id === item.entity_id);
          creditAccountId = category?.account_id || '';
          creditAccountName = category?.name || 'حساب المصروف';
          subAccountId = category?.id;
          subAccountType = 'expense';
        } else {
          const account = accounts.find(a => a.id === item.entity_id);
          creditAccountId = account?.id || '';
          creditAccountName = account?.name || '';
        }

        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          debit: 0,
          credit: Number(item.amount) || 0,
          description: item.description || `سند قبض رقم ${doc.voucher_number || doc.id.slice(-6)}`,
          sub_account_id: subAccountId,
          sub_account_type: subAccountType as any,
          customer_id: item.type === 'customer' ? item.entity_id : undefined,
          supplier_id: item.type === 'supplier' ? item.entity_id : undefined,
        });
      });
    } else {
      const customer = customers.find(c => c.id === doc.customer_id);
      let customerAccountId = customer?.account_id || '';
      let customerAccountName = customer?.account_name || 'حساب العملاء';

      journalItems.push({
        account_id: customerAccountId,
        account_name: customerAccountName,
        debit: 0,
        credit: amount,
        description: `سند قبض رقم: ${doc.voucher_number || ''}`,
        customer_id: doc.customer_id,
        customer_name: doc.customer_name || customer?.name
      });
    }

    journalItems.push({
      account_id: cashAccountId,
      account_name: cashAccountName,
      debit: amount,
      credit: 0,
      description: isMulti
        ? `سند قبض رقم ${doc.voucher_number || doc.id.slice(-6)} إلى حساب: ${pm?.name || ''}`
        : `تحصيل من العميل: ${doc.customer_name || ''}`
    });

    return {
      date: doc.date,
      reference_number: doc.voucher_number || doc.id.slice(-6),
      reference_id: doc.id,
      reference_type: 'receipt',
      description: `سند قبض رقم: ${doc.voucher_number || ''} - ${doc.description || ''}`,
      items: journalItems,
      total_debit: amount,
      total_credit: amount,
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  static generatePaymentVoucherJournal(
    doc: PaymentVoucher, 
    suppliers: Supplier[], 
    customers: Customer[], 
    accounts: Account[], 
    paymentMethods: PaymentMethod[],
    expenseCategories: any[] = []
  ): Omit<JournalEntry, 'id'> {
    const pm = paymentMethods.find(p => p.id === doc.payment_method_id);
    const amount = Number(doc.amount) || 0;
    
    let cashAccountId = pm?.account_id || '';
    let cashAccountName = pm?.account_name || 'حساب النقدية';

    const journalItems: JournalEntryItem[] = [];
    const isMulti = doc.voucher_type === 'multi' || (doc.items && doc.items.length > 0);

    if (isMulti) {
      doc.items?.forEach(item => {
        let debitAccountId = '';
        let debitAccountName = '';
        let subAccountId = item.sub_account_id || undefined;
        let subAccountType = item.sub_account_type || undefined;

        if (item.type === 'supplier') {
          const supplier = suppliers.find(s => s.id === item.entity_id);
          debitAccountId = supplier?.account_id || '';
          debitAccountName = supplier?.account_name || 'حساب الموردين';
          subAccountId = supplier?.id;
          subAccountType = 'supplier';
        } else if (item.type === 'customer') {
          const customer = customers.find(c => c.id === item.entity_id);
          debitAccountId = customer?.account_id || '';
          debitAccountName = customer?.account_name || 'حساب العملاء';
          subAccountId = customer?.id;
          subAccountType = 'customer';
        } else if (item.type === 'expense') {
          const category = expenseCategories.find(c => c.id === item.entity_id);
          debitAccountId = category?.account_id || '';
          debitAccountName = category?.name || 'حساب المصروف';
          subAccountId = category?.id;
          subAccountType = 'expense';
        } else {
          const account = accounts.find(a => a.id === item.entity_id);
          debitAccountId = account?.id || '';
          debitAccountName = account?.name || '';
        }

        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: Number(item.amount) || 0,
          credit: 0,
          description: item.description || `سند صرف رقم ${doc.voucher_number || doc.id.slice(-6)}`,
          sub_account_id: subAccountId,
          sub_account_type: subAccountType as any,
          customer_id: item.type === 'customer' ? item.entity_id : undefined,
          supplier_id: item.type === 'supplier' ? item.entity_id : undefined,
        });
      });
    } else {
      let targetAccountId = '';
      let targetAccountName = '';

      if (doc.supplier_id) {
        const supplier = suppliers.find(s => s.id === doc.supplier_id);
        targetAccountId = supplier?.account_id || '';
        targetAccountName = supplier?.account_name || 'حساب الموردين';
      } else {
        targetAccountId = doc.account_id || '';
        const acc = accounts.find(a => a.id === targetAccountId);
        targetAccountName = acc?.name || '';
      }

      journalItems.push({
        account_id: targetAccountId,
        account_name: targetAccountName || 'حساب مدين',
        debit: amount,
        credit: 0,
        description: doc.description || `سند صرف رقم ${doc.voucher_number || doc.id.slice(-6)}`,
        supplier_id: doc.supplier_id,
        supplier_name: doc.supplier_name
      });
    }

    journalItems.push({
      account_id: cashAccountId,
      account_name: cashAccountName,
      debit: 0,
      credit: amount,
      description: isMulti
        ? `سند صرف رقم ${doc.voucher_number || doc.id.slice(-6)} من حساب: ${pm?.name || ''}`
        : `صرف من: ${pm?.name || ''}`
    });

    return {
      date: doc.date,
      reference_number: doc.voucher_number || doc.id.slice(-6),
      reference_id: doc.id,
      reference_type: 'payment',
      description: `سند صرف رقم: ${doc.voucher_number || ''} - ${doc.description || ''}`,
      items: journalItems,
      total_debit: amount,
      total_credit: amount,
      company_id: '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }
}
