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
  PaymentMethod,
  IssuedCheque
} from '../types';
import { dbService } from './dbService';

export class PostingService {

  /**
   * Generates a Journal Entry from an Invoice
   */
  static generateInvoiceJournal(invoice: Invoice, customers: Customer[], products: Product[], accounts: Account[], paymentMethods: PaymentMethod[], settings?: any): Omit<JournalEntry, 'id'> {
    const customer = customers.find(c => 
      (invoice.customer_id && c.id === invoice.customer_id) || 
      (invoice.customer_name && c.name?.trim().toLowerCase() === invoice.customer_name?.trim().toLowerCase()) ||
      ((invoice as any).customer_code && c.code?.trim().toLowerCase() === (invoice as any).customer_code?.trim().toLowerCase())
    );
    const subtotal = Number(invoice.subtotal) || 0;
    const discount = Number(invoice.discount_amount || invoice.discount) || 0;
    const total_amount = Number(invoice.total_amount) || 0;
    const rate = Number(invoice.exchange_rate) || 1;
    const currencyCode = (invoice as any).currency_code || (invoice as any).currency || 'EGP';

    const totalAmountLocal = Number((total_amount * rate).toFixed(2));
    const discountLocal = Number((discount * rate).toFixed(2));

    const journalItems: JournalEntryItem[] = [];
    
    // Get Customer Account ID
    let customerAccountId = customer?.account_id || '';
    let customerAccountName = customer?.account_name || 'حساب العملاء';
    if (!customerAccountId) {
      throw new Error(`لا يمكن إنشاء القيد المحاسبي: حساب العميل غير محدد للعميل "${customer?.name || invoice.customer_name || invoice.customer_id}". يمنع النظام توقع الحسابات تلقائياً.`);
    }

    // Main Sales Invoice Debit Line (Customer Account)
    journalItems.push({
      account_id: customerAccountId,
      account_name: customerAccountName,
      debit: totalAmountLocal,
      credit: 0,
      currency: currencyCode,
      exchange_rate: rate,
      foreign_amount: total_amount,
      description: `فاتورة مبيعات رقم ${invoice.invoice_number} - ${customer?.name || ''}`,
      customer_id: invoice.customer_id,
      customer_name: customer?.name,
      sub_account_id: invoice.customer_id,
      sub_account_type: 'customer'
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
        debit: totalAmountLocal,
        credit: 0,
        currency: currencyCode,
        exchange_rate: rate,
        foreign_amount: total_amount,
        description: `تحصيل فاتورة مبيعات رقم ${invoice.invoice_number} - ${customer?.name || ''}`,
        sub_account_id: invoice.payment_method_id,
        sub_account_type: 'payment_method'
      });

      // Credit Customer (to clear the receivable)
      journalItems.push({
        account_id: customerAccountId,
        account_name: customerAccountName,
        debit: 0,
        credit: totalAmountLocal,
        currency: currencyCode,
        exchange_rate: rate,
        foreign_amount: total_amount,
        description: `سداد فاتورة مبيعات رقم ${invoice.invoice_number} - ${customer?.name || ''}`,
        customer_id: invoice.customer_id,
        customer_name: customer?.name,
        sub_account_id: invoice.customer_id,
        sub_account_type: 'customer'
      });
    }

    // Discount
    if (discountLocal > 0) {
      const discountAccountId = settings?.customer_discount_account_id || '';
      const discountAccount = accounts.find(a => a.id === discountAccountId);
      journalItems.push({
        account_id: discountAccountId,
        account_name: discountAccount?.name || 'حساب الخصم المسموح به',
        debit: discountLocal,
        credit: 0,
        currency: currencyCode,
        exchange_rate: rate,
        foreign_amount: discount,
        description: `خصم مسموح به - فاتورة رقم ${invoice.invoice_number}`
      });
    }

    // Credit side: Sales Revenue
    invoice.items?.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      let salesAccountId = product?.revenue_account_id || '';
      let salesAccountName = product?.revenue_account_name || 'حساب المبيعات';

      if (!salesAccountId) {
        throw new Error(`لا يمكن إنشاء القيد المحاسبي: حساب الإيرادات غير محدد في بطاقة الصنف "${item.product_name || product?.name}". يمنع النظام توقع الحسابات تلقائياً.`);
      }
      const itemTotalFC = Number(item.total) || 0;
      const itemTotalLocal = Number((itemTotalFC * rate).toFixed(2));

      journalItems.push({
        account_id: salesAccountId,
        account_name: salesAccountName,
        debit: 0,
        credit: itemTotalLocal,
        currency: currencyCode,
        exchange_rate: rate,
        foreign_amount: itemTotalFC,
        description: `مبيعات صنف: ${item.product_name} - فاتورة ${invoice.invoice_number}`,
        operation_id: (item as any).operation_id || (invoice as any).operation_id || null,
        department_id: (item as any).department_id || (invoice as any).department_id || null,
        cost_center_id: (item as any).cost_center_id || (invoice as any).cost_center_id || null
      });
    });

    // VAT / Tax credit line (grouped by item product's sales_vat_account_id or vat_account_id)
    const vatGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    invoice.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const vatAccountId = prod?.sales_vat_account_id || prod?.vat_account_id || '';
      const vatAccountName = prod?.sales_vat_account_name || prod?.vat_account_name || 'حساب ضريبة القيمة المضافة (مبيعات)';
      const rateVal = item.vat_rate !== undefined ? item.vat_rate : (prod?.vat_rate || 0);
      const itemTotal = Number(item.total) || 0;
      const itemVat = Number((itemTotal * (rateVal / 100)).toFixed(2));
      
      if (itemVat > 0) {
        if (!vatAccountId) {
          throw new Error(`لا يمكن إنشاء القيد المحاسبي: حساب ضريبة القيمة المضافة (مبيعات) غير محدد في بطاقة الصنف "${item.product_name || prod?.name}". يمنع النظام توقع الحسابات تلقائياً.`);
        }
        
        if (!vatGroup[vatAccountId]) {
          vatGroup[vatAccountId] = {
            account_id: vatAccountId,
            account_name: vatAccountName,
            amount: 0
          };
        }
        vatGroup[vatAccountId].amount += itemVat;
      }
    });

    const taxAmount = Number(invoice.tax_amount || 0);
    if (Object.keys(vatGroup).length > 0) {
      Object.values(vatGroup).forEach(vat => {
        const vatLocal = Number((vat.amount * rate).toFixed(2));
        journalItems.push({
          account_id: vat.account_id,
          account_name: vat.account_name,
          debit: 0,
          credit: vatLocal,
          currency: currencyCode,
          exchange_rate: rate,
          foreign_amount: vat.amount,
          description: `ضريبة القيمة المضافة - فاتورة مبيعات رقم ${invoice.invoice_number}`
        });
      });
    } else if (taxAmount > 0) {
      throw new Error(`لا يمكن إنشاء القيد المحاسبي: الفاتورة رقم ${invoice.invoice_number} تحتوي على ضريبة قيمة مضافة (${taxAmount}) لكن لم يتم تحديد حساب ضريبة القيمة المضافة في بطاقة أي صنف.`);
    }

    // Withholding Tax (Debit side for sales: Current Asset - Tax Withheld by Customers)
    const whtSalesGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    invoice.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const whtAccountId = prod?.sales_withholding_tax_account_id || '';
      const whtAccountName = prod?.sales_withholding_tax_account_name || 'ضرائب خصم من العملاء';
      const rateVal = item.withholding_tax_rate !== undefined ? item.withholding_tax_rate : (prod?.sales_withholding_tax_rate || 0);
      const itemTotal = Number(item.total) || 0;
      const itemWht = Number(item.withholding_tax_amount !== undefined ? item.withholding_tax_amount : (itemTotal * (rateVal / 100)).toFixed(2));

      if (itemWht > 0) {
        if (!whtAccountId) {
          throw new Error(`لا يمكن إنشاء القيد المحاسبي: حساب ضرائب خصم من العملاء غير محدد في بطاقة الصنف "${item.product_name || prod?.name}". يمنع النظام توقع الحسابات تلقائياً.`);
        }

        if (!whtSalesGroup[whtAccountId]) {
          whtSalesGroup[whtAccountId] = {
            account_id: whtAccountId,
            account_name: whtAccountName,
            amount: 0
          };
        }
        whtSalesGroup[whtAccountId].amount += itemWht;
      }
    });

    const invoiceWhtTotal = Number(invoice.withholding_tax_amount || 0);
    if (Object.keys(whtSalesGroup).length > 0) {
      Object.values(whtSalesGroup).forEach(wht => {
        const whtLocal = Number((wht.amount * rate).toFixed(2));
        journalItems.push({
          account_id: wht.account_id,
          account_name: wht.account_name,
          debit: whtLocal,
          credit: 0,
          currency: currencyCode,
          exchange_rate: rate,
          foreign_amount: wht.amount,
          description: `ضريبة خصم وإضافة مبيعات (خصم من العملاء) - فاتورة رقم ${invoice.invoice_number}`
        });
      });
    } else if (invoiceWhtTotal > 0) {
      throw new Error(`لا يمكن إنشاء القيد المحاسبي: الفاتورة رقم ${invoice.invoice_number} تحتوي على ضريبة خصم (${invoiceWhtTotal}) دون تحديد حساب ضرائب الخصم في بطاقة الصنف.`);
    }

    let total_debit = Number(journalItems.reduce((sum, i) => sum + (Number(i.debit) || 0), 0).toFixed(2));
    let total_credit = Number(journalItems.reduce((sum, i) => sum + (Number(i.credit) || 0), 0).toFixed(2));

    const diff = Number((total_debit - total_credit).toFixed(2));
    if (diff !== 0 && journalItems.length > 0) {
      if (diff > 0) {
        const creditItem = journalItems.find(item => (Number(item.credit) || 0) > 0);
        if (creditItem) creditItem.credit = Number((Number(creditItem.credit) + diff).toFixed(2));
      } else {
        const debitItem = journalItems.find(item => (Number(item.debit) || 0) > 0);
        if (debitItem) debitItem.debit = Number((Number(debitItem.debit) + Math.abs(diff)).toFixed(2));
      }
      total_debit = Number(journalItems.reduce((sum, i) => sum + (Number(i.debit) || 0), 0).toFixed(2));
      total_credit = Number(journalItems.reduce((sum, i) => sum + (Number(i.credit) || 0), 0).toFixed(2));
    }

    return {
      date: invoice.date,
      reference_number: invoice.invoice_number,
      reference_id: invoice.id,
      reference_type: 'invoice',
      description: `قيد فاتورة مبيعات رقم: ${invoice.invoice_number}`,
      items: journalItems,
      total_debit,
      total_credit,
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
    const customer = customers.find(c => 
      (doc.customer_id && c.id === doc.customer_id) || 
      (doc.customer_name && c.name?.trim().toLowerCase() === doc.customer_name?.trim().toLowerCase()) ||
      ((doc as any).customer_code && c.code?.trim().toLowerCase() === (doc as any).customer_code?.trim().toLowerCase())
    );
    const total_amount = Number(doc.total_amount) || 0;

    const journalItems: JournalEntryItem[] = [];

    // Debit side: Sales Returns (Expense/Revenue reduction)
    doc.items?.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      let salesReturnAccountId = product?.revenue_account_id || ''; 
      let salesReturnAccountName = product?.revenue_account_name || 'حساب مردودات المبيعات';

      if (!salesReturnAccountId) {
        throw new Error(`لا يمكن إنشاء القيد المحاسبي: حساب مردودات/إيرادات المبيعات غير محدد في بطاقة الصنف "${item.product_name || product?.name}".`);
      }

      journalItems.push({
        account_id: salesReturnAccountId,
        account_name: salesReturnAccountName,
        debit: Number(item.total) || 0,
        credit: 0,
        description: `مردودات مبيعات: ${item.product_name} - مرتجع ${doc.return_number || doc.id.slice(-6)}`,
        operation_id: (item as any).operation_id || (doc as any).operation_id || null,
        department_id: (item as any).department_id || (doc as any).department_id || null,
        cost_center_id: (item as any).cost_center_id || (doc as any).cost_center_id || null
      });
    });

    // VAT / Tax debit line for returns (grouped by item product's sales_vat_account_id or vat_account_id)
    const vatGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    doc.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const vatAccountId = prod?.sales_vat_account_id || prod?.vat_account_id || '';
      const vatAccountName = prod?.sales_vat_account_name || prod?.vat_account_name || 'حساب ضريبة القيمة المضافة (مبيعات)';
      const rateVal = prod?.vat_rate || 0;
      const itemTotal = Number(item.total) || 0;
      const itemVat = Number((itemTotal * (rateVal / 100)).toFixed(2));
      
      if (itemVat > 0) {
        if (!vatAccountId) {
          throw new Error(`لا يمكن إنشاء القيد المحاسبي: حساب ضريبة القيمة المضافة (مبيعات) غير محدد في بطاقة الصنف "${item.product_name || prod?.name}".`);
        }
        
        if (!vatGroup[vatAccountId]) {
          vatGroup[vatAccountId] = {
            account_id: vatAccountId,
            account_name: vatAccountName,
            amount: 0
          };
        }
        vatGroup[vatAccountId].amount += itemVat;
      }
    });

    const taxAmountReturn = Number(doc.tax || 0);
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
      throw new Error(`لا يمكن إنشاء القيد المحاسبي: مرتجع المبيعات رقم ${doc.return_number} يحتوي على ضريبة (${taxAmountReturn}) دون تحديد حساب ضريبة القيمة المضافة في بطاقة الصنف.`);
    }

    // Debit Customer Account (Clear customer balance on return)
    let customerAccountId = customer?.account_id || '';
    let customerAccountName = customer?.account_name || 'حساب العملاء';
    if (!customerAccountId) {
      throw new Error(`لا يمكن إنشاء القيد المحاسبي: حساب العميل غير محدد للعميل "${customer?.name || doc.customer_id}".`);
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

    
    // Withholding Tax credit line for returns (reversal of tax withheld by customers)
    const whtReturnGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    doc.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const whtAccountId = prod?.sales_withholding_tax_account_id || '';
      const whtAccountName = prod?.sales_withholding_tax_account_name || 'ضرائب خصم من العملاء';
      const rateVal = item.withholding_tax_rate !== undefined ? item.withholding_tax_rate : (prod?.sales_withholding_tax_rate || 0);
      const itemTotal = Number(item.total) || 0;
      const itemWht = Number(item.withholding_tax_amount !== undefined ? item.withholding_tax_amount : (itemTotal * (rateVal / 100)).toFixed(2));

      if (itemWht > 0) {
        if (!whtAccountId) {
          throw new Error(`لا يمكن إنشاء القيد المحاسبي: حساب ضرائب خصم من العملاء غير محدد في بطاقة الصنف "${item.product_name || prod?.name}".`);
        }

        if (!whtReturnGroup[whtAccountId]) {
          whtReturnGroup[whtAccountId] = {
            account_id: whtAccountId,
            account_name: whtAccountName,
            amount: 0
          };
        }
        whtReturnGroup[whtAccountId].amount += itemWht;
      }
    });

    const returnWhtTotal = Number(doc.withholding_tax_amount || 0);
    if (Object.keys(whtReturnGroup).length > 0) {
      Object.values(whtReturnGroup).forEach(wht => {
        journalItems.push({
          account_id: wht.account_id,
          account_name: wht.account_name,
          debit: 0,
          credit: Number(wht.amount.toFixed(2)),
          description: `تسوية ضريبة خصم وإضافة - مرتجع مبيعات رقم ${doc.return_number || doc.id.slice(-6)}`
        });
      });
    } else if (returnWhtTotal > 0) {
      throw new Error(`لا يمكن إنشاء القيد المحاسبي: مرتجع المبيعات رقم ${doc.return_number} يحتوي على ضريبة خصم (${returnWhtTotal}) دون تحديد حساب ضرائب الخصم في بطاقة الصنف.`);
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
    const supplier = suppliers.find(s => 
      (doc.supplier_id && s.id === doc.supplier_id) || 
      (doc.supplier_name && s.name?.trim().toLowerCase() === doc.supplier_name?.trim().toLowerCase()) ||
      ((doc as any).supplier_code && s.code?.trim().toLowerCase() === (doc as any).supplier_code?.trim().toLowerCase())
    );
    const total_amount = Number(doc.total_amount) || 0;

    const journalItems: JournalEntryItem[] = [];

    // Debit side: Purchases / Inventory
    doc.items?.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      let purchaseAccountId = product?.cost_account_id || product?.inventory_account_id || '';
      let purchaseAccountName = product?.cost_account_name || product?.inventory_account_name || 'حساب المشتريات / التكلفة';

      if (!purchaseAccountId) {
        throw new Error(`لا يمكن حفظ القيد: حساب التكلفة أو المخزون غير محدد في بطاقة الصنف "${item.product_name || product?.name || 'غير معروف'}". يمنع النظام توقع الحسابات تلقائياً.`);
      }

      journalItems.push({
        account_id: purchaseAccountId,
        account_name: purchaseAccountName,
        debit: Number(item.total) || 0,
        credit: 0,
        description: `مشتريات: ${item.product_name} - فاتورة ${doc.invoice_number}`,
        operation_id: (item as any).operation_id || (doc as any).operation_id || null,
        department_id: (item as any).department_id || (doc as any).department_id || null,
        cost_center_id: (item as any).cost_center_id || (doc as any).cost_center_id || null
      });
    });

    // VAT / Tax debit line (grouped by item product's purchase_vat_account_id or vat_account_id)
    const vatGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    doc.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const vatAccountId = prod?.purchase_vat_account_id || prod?.vat_account_id || '';
      const vatAccountName = prod?.purchase_vat_account_name || prod?.vat_account_name || 'حساب ضريبة القيمة المضافة (مشتريات)';
      const rateVal = item.vat_rate !== undefined ? item.vat_rate : (prod?.vat_rate || 0);
      const itemTotal = Number(item.total) || 0;
      const itemVat = Number((itemTotal * (rateVal / 100)).toFixed(2));
      
      if (itemVat > 0) {
        if (!vatAccountId) {
          throw new Error(`لا يمكن حفظ القيد: حساب ضريبة القيمة المضافة (مشتريات) غير محدد في بطاقة الصنف "${item.product_name || prod?.name || 'غير معروف'}". يمنع النظام توقع الحسابات تلقائياً.`);
        }
        
        if (!vatGroup[vatAccountId]) {
          vatGroup[vatAccountId] = {
            account_id: vatAccountId,
            account_name: vatAccountName,
            amount: 0
          };
        }
        vatGroup[vatAccountId].amount += itemVat;
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
      throw new Error(`لا يمكن حفظ القيد: فاتورة المشتريات رقم ${doc.invoice_number} تحتوي على ضريبة (${taxAmountPurchase}) دون تحديد حساب ضريبة القيمة المضافة في بطاقة الصنف.`);
    }

    // Credit Supplier Account (Account Payable)
    let supplierAccountId = supplier?.account_id || '';
    let supplierAccountName = supplier?.account_name || 'حساب الموردين';
    if (!supplierAccountId) {
      throw new Error(`لا يمكن حفظ القيد: حساب المورد غير محدد في بطاقة المورد "${supplier?.name || doc.supplier_id}". يمنع النظام توقع الحسابات تلقائياً.`);
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

    
    // Withholding Tax credit line for purchases (Current Liability - Tax Withheld for Suppliers)
    const whtPurchaseGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    doc.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const whtAccountId = prod?.purchase_withholding_tax_account_id || '';
      const whtAccountName = prod?.purchase_withholding_tax_account_name || 'ضرائب خصم على الموردين';
      const rateVal = item.withholding_tax_rate !== undefined ? item.withholding_tax_rate : (prod?.purchase_withholding_tax_rate || 0);
      const itemTotal = Number(item.total) || 0;
      const itemWht = Number(item.withholding_tax_amount !== undefined ? item.withholding_tax_amount : (itemTotal * (rateVal / 100)).toFixed(2));

      if (itemWht > 0) {
        if (!whtAccountId) {
          throw new Error(`لا يمكن حفظ القيد: حساب ضرائب الخصم على الموردين غير محدد في بطاقة الصنف "${item.product_name || prod?.name || 'غير معروف'}". يمنع النظام توقع الحسابات تلقائياً.`);
        }

        if (!whtPurchaseGroup[whtAccountId]) {
          whtPurchaseGroup[whtAccountId] = {
            account_id: whtAccountId,
            account_name: whtAccountName,
            amount: 0
          };
        }
        whtPurchaseGroup[whtAccountId].amount += itemWht;
      }
    });

    const docWhtTotal = Number(doc.withholding_tax_amount || 0);
    if (Object.keys(whtPurchaseGroup).length > 0) {
      Object.values(whtPurchaseGroup).forEach(wht => {
        journalItems.push({
          account_id: wht.account_id,
          account_name: wht.account_name,
          debit: 0,
          credit: Number(wht.amount.toFixed(2)),
          description: `ضريبة خصم وإضافة مشتريات (خصم على الموردين) - فاتورة مشتريات رقم ${doc.invoice_number}`
        });
      });
    } else if (docWhtTotal > 0) {
      throw new Error(`لا يمكن حفظ القيد: فاتورة المشتريات رقم ${doc.invoice_number} تحتوي على ضريبة خصم (${docWhtTotal}) دون تحديد حساب ضرائب الخصم في بطاقة الصنف.`);
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
    const supplier = suppliers.find(s => 
      (doc.supplier_id && s.id === doc.supplier_id) || 
      (doc.supplier_name && s.name?.trim().toLowerCase() === doc.supplier_name?.trim().toLowerCase()) ||
      ((doc as any).supplier_code && s.code?.trim().toLowerCase() === (doc as any).supplier_code?.trim().toLowerCase())
    );
    const total_amount = Number(doc.total_amount) || 0;

    const journalItems: JournalEntryItem[] = [];

    // Supplier account ID
    let supplierAccountId = supplier?.account_id || '';
    let supplierAccountName = supplier?.account_name || 'حساب الموردين';
    if (!supplierAccountId) {
      throw new Error(`لا يمكن حفظ القيد: حساب المورد غير محدد في بطاقة المورد "${supplier?.name || doc.supplier_id}". يمنع النظام توقع الحسابات تلقائياً.`);
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
      let purchaseReturnAccountId = product?.cost_account_id || product?.inventory_account_id || '';
      let purchaseReturnAccountName = product?.cost_account_name || product?.inventory_account_name || 'حساب مردودات المشتريات / المخزون';

      if (!purchaseReturnAccountId) {
        throw new Error(`لا يمكن حفظ القيد: حساب التكلفة أو المخزون غير محدد في بطاقة الصنف "${item.product_name || product?.name || 'غير معروف'}". يمنع النظام توقع الحسابات تلقائياً.`);
      }

      journalItems.push({
        account_id: purchaseReturnAccountId,
        account_name: purchaseReturnAccountName,
        debit: 0,
        credit: Number(item.total) || 0,
        description: `مرتجع مشتريات: ${item.product_name} - رقم ${doc.return_number}`,
        operation_id: (item as any).operation_id || (doc as any).operation_id || null,
        department_id: (item as any).department_id || (doc as any).department_id || null,
        cost_center_id: (item as any).cost_center_id || (doc as any).cost_center_id || null
      });
    });

    // VAT / Tax credit line for purchase returns (grouped by item product's purchase_vat_account_id or vat_account_id)
    const vatGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    doc.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const vatAccountId = prod?.purchase_vat_account_id || prod?.vat_account_id || '';
      const vatAccountName = prod?.purchase_vat_account_name || prod?.vat_account_name || 'حساب ضريبة القيمة المضافة (مشتريات)';
      const rateVal = prod?.vat_rate || 0;
      const itemTotal = Number(item.total) || 0;
      const itemVat = Number((itemTotal * (rateVal / 100)).toFixed(2));
      
      if (itemVat > 0) {
        if (!vatAccountId) {
          throw new Error(`لا يمكن حفظ القيد: حساب ضريبة القيمة المضافة (مشتريات) غير محدد في بطاقة الصنف "${item.product_name || prod?.name || 'غير معروف'}". يمنع النظام توقع الحسابات تلقائياً.`);
        }
        
        if (!vatGroup[vatAccountId]) {
          vatGroup[vatAccountId] = {
            account_id: vatAccountId,
            account_name: vatAccountName,
            amount: 0
          };
        }
        vatGroup[vatAccountId].amount += itemVat;
      }
    });

    const taxAmountPurchaseReturn = Number(doc.tax || 0);
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
      throw new Error(`لا يمكن حفظ القيد: مرتجع المشتريات رقم ${doc.return_number} يحتوي على ضريبة (${taxAmountPurchaseReturn}) دون تحديد حساب ضريبة القيمة المضافة في بطاقة الصنف.`);
    }

    
    // Withholding Tax debit line for purchase returns (reversal of tax withheld for suppliers)
    const whtPurchReturnGroup: Record<string, { account_id: string; account_name: string; amount: number }> = {};
    doc.items?.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      const whtAccountId = prod?.purchase_withholding_tax_account_id || '';
      const whtAccountName = prod?.purchase_withholding_tax_account_name || 'ضرائب خصم على الموردين';
      const rateVal = item.withholding_tax_rate !== undefined ? item.withholding_tax_rate : (prod?.purchase_withholding_tax_rate || 0);
      const itemTotal = Number(item.total) || 0;
      const itemWht = Number(item.withholding_tax_amount !== undefined ? item.withholding_tax_amount : (itemTotal * (rateVal / 100)).toFixed(2));

      if (itemWht > 0) {
        if (!whtAccountId) {
          throw new Error(`لا يمكن حفظ القيد: حساب ضرائب الخصم على الموردين غير محدد في بطاقة الصنف "${item.product_name || prod?.name || 'غير معروف'}". يمنع النظام توقع الحسابات تلقائياً.`);
        }

        if (!whtPurchReturnGroup[whtAccountId]) {
          whtPurchReturnGroup[whtAccountId] = {
            account_id: whtAccountId,
            account_name: whtAccountName,
            amount: 0
          };
        }
        whtPurchReturnGroup[whtAccountId].amount += itemWht;
      }
    });

    const purchReturnWhtTotal = Number(doc.withholding_tax_amount || 0);
    if (Object.keys(whtPurchReturnGroup).length > 0) {
      Object.values(whtPurchReturnGroup).forEach(wht => {
        journalItems.push({
          account_id: wht.account_id,
          account_name: wht.account_name,
          debit: Number(wht.amount.toFixed(2)),
          credit: 0,
          description: `تسوية ضريبة خصم وإضافة - مرتجع مشتريات رقم ${doc.return_number || doc.id.slice(-6)}`
        });
      });
    } else if (purchReturnWhtTotal > 0) {
      throw new Error(`لا يمكن حفظ القيد: مرتجع المشتريات رقم ${doc.return_number} يحتوي على ضريبة خصم (${purchReturnWhtTotal}) دون تحديد حساب ضرائب الخصم في بطاقة الصنف.`);
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
        : `تحصيل من العميل: ${doc.customer_name || ''}`,
      sub_account_id: pm?.id,
      sub_account_type: 'payment_method'
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
        : `صرف من: ${pm?.name || ''}`,
      sub_account_id: pm?.id,
      sub_account_type: 'payment_method'
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

  /**
   * Generates a Journal Entry for an Issued Cheque upon ISSUANCE:
   * Debit: Supplier (Accounts Payable)
   * Credit: Notes Payable (Cheques Payable)
   */
  static generateIssuedChequeJournal(
    doc: IssuedCheque,
    suppliers: Supplier[],
    accounts: Account[]
  ): Omit<JournalEntry, 'id'> {
    const supplier = suppliers.find(s => s.id === doc.supplier_id);
    const amount = Number(doc.amount) || 0;

    // Supplier Account (Debit)
    let supplierAccountId = supplier?.account_id || '';
    let supplierAccountName = supplier?.account_name || '';
    if (!supplierAccountId) {
      const defaultSupplierAcc = accounts.find(a => a.account_usage === 'supplier' || a.account_usage === 'accounts_payable' || a.code === '210101');
      supplierAccountId = defaultSupplierAcc?.id || '';
      supplierAccountName = defaultSupplierAcc?.name || 'حساب الموردين';
    }

    // Notes Payable Account / Designated Credit Account (Credit)
    let notesPayableAccountId = '';
    let notesPayableAccountName = 'حساب أوراق الدفع - شيكات صادرة';
    if (doc.credit_account_id) {
      const explicitAcc = accounts.find(a => a.id === doc.credit_account_id);
      notesPayableAccountId = doc.credit_account_id;
      notesPayableAccountName = explicitAcc?.name || doc.credit_account_name || 'حساب أوراق الدفع';
    } else {
      const notesPayableAcc = accounts.find(a => a.account_usage === 'notes_payable' || a.code === '210102' || a.name.includes('أوراق دفع') || a.name.includes('شيكات صادرة'));
      if (notesPayableAcc) {
        notesPayableAccountId = notesPayableAcc.id;
        notesPayableAccountName = notesPayableAcc.name;
      } else {
        // Fallback to liabilities or supplier account
        const fallbackAcc = accounts.find(a => a.account_usage === 'current_liability' || a.code?.startsWith('21'));
        notesPayableAccountId = fallbackAcc?.id || supplierAccountId;
        notesPayableAccountName = fallbackAcc?.name || 'أوراق دفع';
      }
    }

    const journalItems: JournalEntryItem[] = [
      {
        account_id: supplierAccountId,
        account_name: supplierAccountName || 'حساب الموردين',
        debit: amount,
        credit: 0,
        description: `إصدار شيك رقم ${doc.cheque_number} - لصالح ${supplier?.name || doc.payee_name || 'المورد'}`,
        supplier_id: doc.supplier_id,
        supplier_name: supplier?.name || doc.payee_name,
        sub_account_id: doc.supplier_id,
        sub_account_type: 'supplier'
      },
      {
        account_id: notesPayableAccountId,
        account_name: notesPayableAccountName,
        debit: 0,
        credit: amount,
        description: `أوراق دفع - شيك رقم ${doc.cheque_number} (استحقاق ${doc.due_date})`,
        supplier_id: doc.supplier_id,
        supplier_name: supplier?.name || doc.payee_name
      }
    ];

    return {
      date: doc.issue_date,
      reference_number: doc.cheque_number,
      reference_id: doc.id,
      reference_type: 'issued_cheque',
      description: `قيد إصدار شيك رقم: ${doc.cheque_number} للمورد: ${supplier?.name || doc.payee_name || ''}`,
      items: journalItems,
      total_debit: amount,
      total_credit: amount,
      company_id: doc.company_id || '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  /**
   * Generates a Journal Entry for an Issued Cheque upon PAYMENT (Cashing from Bank):
   * Debit: Notes Payable (Cheques Payable)
   * Credit: Bank Account
   */
  static generateChequePaymentJournal(
    doc: IssuedCheque,
    paymentMethods: PaymentMethod[],
    accounts: Account[]
  ): Omit<JournalEntry, 'id'> {
    const bankMethod = paymentMethods.find(p => p.id === doc.bank_account_id);
    const amount = Number(doc.amount) || 0;

    // Bank Account (Credit)
    let bankAccountId = bankMethod?.account_id || '';
    let bankAccountName = bankMethod?.account_name || bankMethod?.name || 'حساب البنك';
    if (!bankAccountId) {
      const defaultBankAcc = accounts.find(a => a.account_usage === 'bank' || a.code === '110103');
      bankAccountId = defaultBankAcc?.id || '';
      bankAccountName = defaultBankAcc?.name || bankAccountName;
    }

    // Notes Payable Account (Debit)
    let notesPayableAccountId = '';
    let notesPayableAccountName = 'حساب أوراق الدفع - شيكات صادرة';
    if (doc.credit_account_id) {
      const explicitAcc = accounts.find(a => a.id === doc.credit_account_id);
      notesPayableAccountId = doc.credit_account_id;
      notesPayableAccountName = explicitAcc?.name || doc.credit_account_name || 'حساب أوراق الدفع';
    } else {
      const notesPayableAcc = accounts.find(a => a.account_usage === 'notes_payable' || a.code === '210102' || a.name.includes('أوراق دفع') || a.name.includes('شيكات صادرة'));
      if (notesPayableAcc) {
        notesPayableAccountId = notesPayableAcc.id;
        notesPayableAccountName = notesPayableAcc.name;
      } else {
        const fallbackAcc = accounts.find(a => a.account_usage === 'current_liability' || a.code?.startsWith('21'));
        notesPayableAccountId = fallbackAcc?.id || bankAccountId;
        notesPayableAccountName = fallbackAcc?.name || 'أوراق دفع';
      }
    }

    const journalItems: JournalEntryItem[] = [
      {
        account_id: notesPayableAccountId,
        account_name: notesPayableAccountName,
        debit: amount,
        credit: 0,
        description: `تسوية وصرف شيك رقم ${doc.cheque_number} من بنك ${bankMethod?.name || doc.bank_name || ''}`,
        supplier_id: doc.supplier_id,
        supplier_name: doc.supplier_name || doc.payee_name
      },
      {
        account_id: bankAccountId,
        account_name: bankAccountName,
        debit: 0,
        credit: amount,
        description: `خصم قيمة الشيك رقم ${doc.cheque_number} من الحساب البنكي ${bankMethod?.name || ''}`,
        sub_account_id: bankMethod?.id,
        sub_account_type: 'payment_method'
      }
    ];

    return {
      date: doc.payment_date || new Date().toISOString().slice(0, 10),
      reference_number: doc.cheque_number,
      reference_id: doc.id,
      reference_type: 'cheque_payment',
      description: `قيد صرف وسداد شيك رقم: ${doc.cheque_number} من بنك: ${bankMethod?.name || doc.bank_name || ''}`,
      items: journalItems,
      total_debit: amount,
      total_credit: amount,
      company_id: doc.company_id || '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }

  /**
   * Generates a Journal Entry for an Issued Cheque upon RETURN:
   * Debit: Notes Payable (Cheques Payable)
   * Credit: Supplier (Accounts Payable)
   */
  static generateChequeReturnJournal(
    doc: IssuedCheque,
    suppliers: Supplier[],
    accounts: Account[]
  ): Omit<JournalEntry, 'id'> {
    const supplier = suppliers.find(s => s.id === doc.supplier_id);
    const amount = Number(doc.amount) || 0;

    // Supplier Account (Credit - Restores debt)
    let supplierAccountId = supplier?.account_id || '';
    let supplierAccountName = supplier?.account_name || '';
    if (!supplierAccountId) {
      const defaultSupplierAcc = accounts.find(a => a.account_usage === 'supplier' || a.account_usage === 'accounts_payable' || a.code === '210101');
      supplierAccountId = defaultSupplierAcc?.id || '';
      supplierAccountName = defaultSupplierAcc?.name || 'حساب الموردين';
    }

    // Notes Payable Account (Debit - Clears the liability)
    let notesPayableAccountId = '';
    let notesPayableAccountName = 'حساب أوراق الدفع - شيكات صادرة';
    if (doc.credit_account_id) {
      const explicitAcc = accounts.find(a => a.id === doc.credit_account_id);
      notesPayableAccountId = doc.credit_account_id;
      notesPayableAccountName = explicitAcc?.name || doc.credit_account_name || 'حساب أوراق الدفع';
    } else {
      const notesPayableAcc = accounts.find(a => a.account_usage === 'notes_payable' || a.code === '210102' || a.name.includes('أوراق دفع') || a.name.includes('شيكات صادرة'));
      if (notesPayableAcc) {
        notesPayableAccountId = notesPayableAcc.id;
        notesPayableAccountName = notesPayableAcc.name;
      } else {
        const fallbackAcc = accounts.find(a => a.account_usage === 'current_liability' || a.code?.startsWith('21'));
        notesPayableAccountId = fallbackAcc?.id || supplierAccountId;
        notesPayableAccountName = fallbackAcc?.name || 'أوراق دفع';
      }
    }

    const journalItems: JournalEntryItem[] = [
      {
        account_id: notesPayableAccountId,
        account_name: notesPayableAccountName,
        debit: amount,
        credit: 0,
        description: `إلغاء ورقة دفع لارتداد شيك رقم ${doc.cheque_number} - سبب: ${doc.return_reason || 'غير محدد'}`,
        supplier_id: doc.supplier_id,
        supplier_name: supplier?.name || doc.payee_name
      },
      {
        account_id: supplierAccountId,
        account_name: supplierAccountName || 'حساب الموردين',
        debit: 0,
        credit: amount,
        description: `إعادة إثبات مديونية لارتداد شيك رقم ${doc.cheque_number} - ${supplier?.name || ''}`,
        supplier_id: doc.supplier_id,
        supplier_name: supplier?.name || doc.payee_name,
        sub_account_id: doc.supplier_id,
        sub_account_type: 'supplier'
      }
    ];

    return {
      date: doc.return_date || new Date().toISOString().slice(0, 10),
      reference_number: doc.cheque_number,
      reference_id: doc.id,
      reference_type: 'cheque_return',
      description: `قيد ارتداد شيك رقم: ${doc.cheque_number} للمورد: ${supplier?.name || doc.payee_name || ''} - سبب: ${doc.return_reason || ''}`,
      items: journalItems,
      total_debit: amount,
      total_credit: amount,
      company_id: doc.company_id || '',
      created_at: new Date().toISOString(),
      created_by: 'system'
    };
  }
}
