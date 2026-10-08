export const formatNumber = (value: number | string | undefined | null, decimals: number = 2): string => {
  if (value === undefined || value === null || value === '') return '0.00';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0.00';
  
  // Use Intl.NumberFormat for consistent formatting
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(num);
};

export const formatMoney = (value: number | string | undefined | null): string => {
  return formatNumber(value, 2);
};

export const formatDate = (date: string | Date | undefined | null): string => {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    
    // For ISO strings that are likely just dates (like 2024-03-20),
    // we use UTC to avoid timezone shifts showing the previous day
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(date);
  }
};

export const formatDateTime = (date: string | Date | undefined | null): string => {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    
    // For date-time, we show local time with Egyptian DD/MM/YYYY format and 12-hour AM/PM
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    
    return `${day}/${month}/${year}, ${strHours}:${minutes} ${ampm}`;
  } catch (e) {
    return String(date);
  }
};

export const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

export const isCustomerAccount = (accountId: string, customer: any, accountsList: any[]) => {
  if (customer?.account_id && accountId === customer.account_id) return true;
  if (!accountId || !Array.isArray(accountsList)) return false;
  const acc = accountsList.find(a => a.id === accountId);
  if (acc && ['receivable', 'customer', 'accounts_receivable'].includes(acc.account_usage)) return true;
  return false;
};

export const isSupplierAccount = (accountId: string, supplier: any, accountsList: any[]) => {
  if (supplier?.account_id && accountId === supplier.account_id) return true;
  if (!accountId || !Array.isArray(accountsList)) return false;
  const acc = accountsList.find(a => a.id === accountId);
  if (acc && ['payable', 'supplier', 'accounts_payable'].includes(acc.account_usage)) return true;
  return false;
};

/**
 * Automatically cleans duplicated partner/supplier names caused by portal errors
 * e.g. "شركه سويفت ايجيبت ليمتد شركه سويفت ايجيبت ليمتد" -> "شركه سويفت ايجيبت ليمتد"
 * or "ABC Ltd - ABC Ltd" -> "ABC Ltd"
 */
export const cleanDuplicatedPartnerName = (rawName: string | null | undefined): string => {
  if (!rawName) return '';
  let name = String(rawName).trim().replace(/\s+/g, ' ');

  // 1. Check if separated by common delimiters: " - ", " / ", " | ", " ، ", ", "
  const delimiters = [' - ', ' / ', ' | ', ' ، ', ' , '];
  for (const delim of delimiters) {
    if (name.includes(delim)) {
      const parts = name.split(delim).map(p => p.trim()).filter(Boolean);
      if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
        name = parts[0];
        break;
      }
    }
  }

  // 2. Check for repeated phrase at word level
  // e.g. words = ["شركه", "سويفت", "ايجيبت", "ليمتد", "شركه", "سويفت", "ايجيبت", "ليمتد"]
  const words = name.split(' ');
  if (words.length >= 2 && words.length % 2 === 0) {
    const halfWords = words.length / 2;
    const firstHalfWords = words.slice(0, halfWords).join(' ');
    const secondHalfWords = words.slice(halfWords).join(' ');
    if (firstHalfWords.toLowerCase() === secondHalfWords.toLowerCase()) {
      name = firstHalfWords;
    }
  } else {
    // 3. Fallback character-level half-check
    const len = name.length;
    const mid = Math.floor(len / 2);
    for (let offset = -2; offset <= 2; offset++) {
      const splitIdx = mid + offset;
      if (splitIdx >= 3 && splitIdx < len - 2) {
        const p1 = name.substring(0, splitIdx).trim();
        const p2 = name.substring(splitIdx).trim();
        if (p1.length >= 3 && p1.toLowerCase() === p2.toLowerCase()) {
          name = p1;
          break;
        }
      }
    }
  }

  return name.trim();
};

export const getDocumentTypeName = (
  referenceType: string | null | undefined,
  description?: string | null,
  referenceNumber?: string | null,
  lang: 'ar' | 'en' = 'ar'
): string => {
  let type = (referenceType || '').toLowerCase().trim();
  const desc = description || '';
  const ref = referenceNumber || '';

  // If type is empty or manual, check if reference number prefix reveals the real type
  if ((!type || type === 'manual') && ref) {
    if (ref.startsWith('INV-')) type = 'invoice';
    else if (ref.startsWith('PINV-')) type = 'purchase_invoice';
    else if (ref.startsWith('RCT-')) type = 'receipt';
    else if (ref.startsWith('PAY-')) type = 'payment_voucher';
    else if (ref.startsWith('RET-')) type = 'return';
    else if (ref.startsWith('PRET-')) type = 'purchase_return';
    else if (ref.startsWith('CDISC-')) type = 'customer_discount';
    else if (ref.startsWith('SDISC-')) type = 'supplier_discount';
    else if (ref.startsWith('CHK-')) type = 'issued_cheque';
    else if (ref.startsWith('RCHK-')) type = 'received_cheque';
    else if (ref.startsWith('TRF-')) type = 'cash_transfer';
    else if (ref.startsWith('ADJ-')) type = 'stock_adjustment';
  }

  if (type === 'invoice' || type === 'sales_invoice') {
    return lang === 'ar' ? 'فواتير المبيعات' : 'Sales Invoice';
  }
  if (type === 'purchase_invoice' || type === 'bill') {
    return lang === 'ar' ? 'فواتير المشتريات' : 'Purchase Invoice';
  }
  if (type === 'opening_stock' || type === 'opening_stock_balance') {
    return lang === 'ar' ? 'أرصدة المخزون الافتتاحية' : 'Opening Stock Balance';
  }
  if (type === 'return' || type === 'sales_return') {
    return lang === 'ar' ? 'مردودات المبيعات' : 'Sales Return';
  }
  if (type === 'receipt' || type === 'receipt_voucher') {
    return lang === 'ar' ? 'سندات القبض' : 'Receipt Voucher';
  }
  if (type === 'payment' || type === 'payment_voucher' || type === 'voucher') {
    return lang === 'ar' ? 'سندات الصرف' : 'Payment Voucher';
  }
  if (type === 'purchase_return') {
    return lang === 'ar' ? 'مردودات المشتريات' : 'Purchase Return';
  }
  if (type === 'issued_cheque') {
    return lang === 'ar' ? 'الشيكات الصادرة (إصدار شيك)' : 'Issued Cheque';
  }
  if (type === 'cheque_payment') {
    return lang === 'ar' ? 'صرف الشيكات من البنك' : 'Cheque Payment';
  }
  if (type === 'cheque_cancellation' || type === 'cheque_return') {
    return lang === 'ar' ? 'إلغاء الشيكات' : 'Cheque Cancellation';
  }
  if (type === 'cash_transfer' || type === 'transfer') {
    return lang === 'ar' ? 'تحويلات النقدية والخزائن' : 'Cash Transfer';
  }
  if (type === 'stock_adjustment') {
    return lang === 'ar' ? 'تسويات المخزون (أذون التسوية المقيدة)' : 'Stock Adjustment';
  }
  if (type === 'customer_discount') {
    return lang === 'ar' ? 'خصومات العملاء (المسموح به)' : 'Customer Discount';
  }
  if (type === 'supplier_discount') {
    return lang === 'ar' ? 'خصومات الموردين (الخصم المكتسب)' : 'Supplier Discount';
  }
  if (type === 'received_cheque') {
    return lang === 'ar' ? 'الشيكات الواردة' : 'Received Cheque';
  }
  if (type === 'warehouse_transfer') {
    return lang === 'ar' ? 'التحويلات المخزنية' : 'Warehouse Transfer';
  }
  if (type.includes('asset') || type.startsWith('fixed_asset')) {
    return lang === 'ar' ? 'الأصول الثابتة' : 'Fixed Assets';
  }
  if (type === 'payroll') {
    return lang === 'ar' ? 'المرتبات والأجور' : 'Payroll';
  }
  if (type.startsWith('pos_')) {
    return lang === 'ar' ? 'نقاط البيع' : 'POS';
  }
  if (type === 'opening_balance') {
    if (desc.includes('للعميل')) {
      return lang === 'ar' ? 'الأرصدة الافتتاحية للعملاء (بطاقة العميل)' : 'Customer Opening Balance';
    }
    if (desc.includes('للمورد')) {
      return lang === 'ar' ? 'الأرصدة الافتتاحية للموردين (بطاقة المورد)' : 'Supplier Opening Balance';
    }
    if (desc.includes('لطريقة') || desc.includes('خزينة') || desc.includes('خزنة') || desc.includes('بنك')) {
      return lang === 'ar' ? 'الأرصدة الافتتاحية للبنوك والخزائن' : 'Bank/Safe Opening Balance';
    }
    return lang === 'ar' ? 'الأرصدة الافتتاحية لدليل الحسابات' : 'Chart of Accounts Opening Balance';
  }
  if (!type || type === 'manual' || type === 'journal_entry') {
    return lang === 'ar' ? 'قيود اليومية العامة (إنشاء قيود من الحسابات العامة)' : 'General Journal Entry';
  }
  return type;
};

export interface DocumentTypeOption {
  key: string;
  labelAr: string;
  labelEn: string;
}

export const DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [
  { key: 'all', labelAr: 'جميع أنواع الحركات / المستندات', labelEn: 'All Document Types' },
  { key: 'sales_invoices', labelAr: 'فواتير المبيعات', labelEn: 'Sales Invoices' },
  { key: 'purchase_invoices', labelAr: 'فواتير المشتريات', labelEn: 'Purchase Invoices' },
  { key: 'opening_stock_balances', labelAr: 'أرصدة المخزون الافتتاحية', labelEn: 'Opening Stock Balances' },
  { key: 'returns', labelAr: 'مردودات المبيعات', labelEn: 'Sales Returns' },
  { key: 'receipt_vouchers', labelAr: 'سندات القبض', labelEn: 'Receipt Vouchers' },
  { key: 'payment_methods_opening', labelAr: 'الأرصدة الافتتاحية للبنوك والخزائن', labelEn: 'Bank/Safe Opening Balances' },
  { key: 'payment_vouchers', labelAr: 'سندات الصرف', labelEn: 'Payment Vouchers' },
  { key: 'purchase_returns', labelAr: 'مردودات المشتريات', labelEn: 'Purchase Returns' },
  { key: 'issued_cheques', labelAr: 'الشيكات الصادرة (إصدار شيك)', labelEn: 'Issued Cheques' },
  { key: 'cheque_payments', labelAr: 'صرف الشيكات من البنك', labelEn: 'Cheque Payments' },
  { key: 'manual_journal_entries', labelAr: 'قيود اليومية العامة (إنشاء قيود من الحسابات العامة)', labelEn: 'General Journal Entries' },
  { key: 'cash_transfers', labelAr: 'تحويلات النقدية والخزائن', labelEn: 'Cash Transfers' },
  { key: 'customer_opening_balances', labelAr: 'الأرصدة الافتتاحية للعملاء (بطاقة العميل)', labelEn: 'Customer Opening Balances' },
  { key: 'cheque_cancellations', labelAr: 'إلغاء الشيكات', labelEn: 'Cheque Cancellations' },
  { key: 'supplier_opening_balances', labelAr: 'الأرصدة الافتتاحية للموردين (بطاقة المورد)', labelEn: 'Supplier Opening Balances' },
  { key: 'stock_adjustments', labelAr: 'تسويات المخزون (أذون التسوية المقيدة)', labelEn: 'Stock Adjustments' },
  { key: 'customer_discounts', labelAr: 'خصومات العملاء (المسموح به)', labelEn: 'Customer Discounts' },
  { key: 'supplier_discounts', labelAr: 'خصومات الموردين (الخصم المكتسب)', labelEn: 'Supplier Discounts' },
  { key: 'received_cheques', labelAr: 'الشيكات الواردة', labelEn: 'Received Cheques' },
  { key: 'account_opening_balances', labelAr: 'الأرصدة الافتتاحية لدليل الحسابات', labelEn: 'Chart of Accounts Opening Balances' },
];

export const matchesDocumentTypeFilter = (
  filterKey: string,
  referenceType: string | null | undefined,
  description?: string | null,
  referenceNumber?: string | null
): boolean => {
  if (!filterKey || filterKey === 'all') return true;
  const label = getDocumentTypeName(referenceType, description, referenceNumber, 'ar');
  const opt = DOCUMENT_TYPE_OPTIONS.find(o => o.key === filterKey);
  if (!opt) return true;
  return label === opt.labelAr;
};

