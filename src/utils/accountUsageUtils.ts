export interface AccountUsageOption {
  key: string;
  ar: string;
  en: string;
}

export const ACCOUNT_USAGE_OPTIONS: AccountUsageOption[] = [
  { key: 'cash', ar: 'نقدية', en: 'Cash' },
  { key: 'main_cash', ar: 'صندوق رئيسي', en: 'Main Cash' },
  { key: 'petty_cash', ar: 'عهد نقدية', en: 'Petty Cash' },
  { key: 'bank', ar: 'بنك', en: 'Bank' },
  { key: 'wallet', ar: 'محفظة إلكترونية', en: 'Wallet' },
  { key: 'credit_card', ar: 'بطاقة ائتمان', en: 'Credit Card' },
  { key: 'debit_card', ar: 'بطاقة خصم', en: 'Debit Card' },
  { key: 'cheque', ar: 'شيكات', en: 'Cheque' },
  { key: 'post_dated_cheque', ar: 'شيكات آجلة', en: 'Post Dated Cheque' },
  { key: 'customer', ar: 'عميل', en: 'Customer' },
  { key: 'accounts_receivable', ar: 'ذمم العملاء', en: 'Accounts Receivable' },
  { key: 'supplier', ar: 'مورد', en: 'Supplier' },
  { key: 'accounts_payable', ar: 'ذمم الموردين', en: 'Accounts Payable' },
  { key: 'inventory', ar: 'مخزون', en: 'Inventory' },
  { key: 'raw_materials', ar: 'خامات', en: 'Raw Materials' },
  { key: 'work_in_progress', ar: 'إنتاج تحت التشغيل', en: 'Work In Progress' },
  { key: 'finished_goods', ar: 'منتجات تامة', en: 'Finished Goods' },
  { key: 'sales_revenue', ar: 'مبيعات', en: 'Sales Revenue' },
  { key: 'service_revenue', ar: 'إيرادات خدمات', en: 'Service Revenue' },
  { key: 'other_revenue', ar: 'إيرادات أخرى', en: 'Other Revenue' },
  { key: 'cost_of_sales', ar: 'تكلفة المبيعات', en: 'Cost of Sales' },
  { key: 'purchases', ar: 'مشتريات', en: 'Purchases' },
  { key: 'purchase_returns', ar: 'مردودات مشتريات', en: 'Purchase Returns' },
  { key: 'sales_returns', ar: 'مردودات مبيعات', en: 'Sales Returns' },
  { key: 'earned_discounts', ar: 'خصومات مكتسبة', en: 'Earned Discounts' },
  { key: 'granted_discounts', ar: 'خصومات ممنوحة', en: 'Granted Discounts' },
  { key: 'operating_expense', ar: 'مصروفات تشغيلية', en: 'Operating Expense' },
  { key: 'administrative_expense', ar: 'مصروفات إدارية', en: 'Administrative Expense' },
  { key: 'marketing_expense', ar: 'مصروفات تسويق', en: 'Marketing Expense' },
  { key: 'selling_expense', ar: 'مصروفات بيع', en: 'Selling Expense' },
  { key: 'financial_expense', ar: 'مصروفات مالية', en: 'Financial Expense' },
  { key: 'financial_revenue', ar: 'إيرادات مالية', en: 'Financial Revenue' },
  { key: 'vat', ar: 'ضريبة قيمة مضافة', en: 'VAT' },
  { key: 'input_vat', ar: 'ضريبة مدخلات', en: 'Input VAT' },
  { key: 'output_vat', ar: 'ضريبة مخرجات', en: 'Output VAT' },
  { key: 'withholding_tax', ar: 'ضرائب مستقطعة', en: 'Withholding Tax' },
  { key: 'employee', ar: 'موظف', en: 'Employee' },
  { key: 'payroll', ar: 'مرتبات', en: 'Payroll' },
  { key: 'employee_advances', ar: 'سلف موظفين', en: 'Employee Advances' },
  { key: 'employee_loans', ar: 'قروض موظفين', en: 'Employee Loans' },
  { key: 'fixed_asset', ar: 'أصل ثابت', en: 'Fixed Asset' },
  { key: 'accumulated_depreciation', ar: 'مجمع الإهلاك', en: 'Accumulated Depreciation' },
  { key: 'depreciation_expense', ar: 'إهلاك', en: 'Depreciation Expense' },
  { key: 'current_asset', ar: 'أصل متداول', en: 'Current Asset' },
  { key: 'current_liability', ar: 'التزامات متداولة', en: 'Current Liability' },
  { key: 'long_term_liability', ar: 'التزامات طويلة الأجل', en: 'Long Term Liability' },
  { key: 'loan', ar: 'قرض', en: 'Loan' },
  { key: 'capital', ar: 'رأس المال', en: 'Capital' },
  { key: 'equity', ar: 'حقوق الملكية', en: 'Equity' },
  { key: 'retained_earnings', ar: 'أرباح محتجزة', en: 'Retained Earnings' },
  { key: 'drawings', ar: 'مسحوبات', en: 'Drawings' },
  { key: 'cost_center', ar: 'مركز تكلفة', en: 'Cost Center' },
  { key: 'project', ar: 'مشروع', en: 'Project' },
  { key: 'branch', ar: 'فرع', en: 'Branch' },
  { key: 'department', ar: 'قسم', en: 'Department' },
  { key: 'contract', ar: 'عقد', en: 'Contract' },
  { key: 'investment', ar: 'استثمار', en: 'Investment' },
  { key: 'exchange_difference', ar: 'فرق عملة', en: 'Exchange Difference' },
  { key: 'foreign_currency', ar: 'عملة أجنبية', en: 'Foreign Currency' },
  { key: 'internal_transfer', ar: 'تحويل داخلي', en: 'Internal Transfer' },
  { key: 'suspense_account', ar: 'حساب معلق', en: 'Suspense Account' },
  { key: 'clearing_account', ar: 'حساب تسوية', en: 'Clearing Account' },
  { key: 'opening_balance', ar: 'رصيد افتتاحي', en: 'Opening Balance' },
  { key: 'closing_balance', ar: 'رصيد إقفالي', en: 'Closing Balance' },
  { key: 'insurance', ar: 'تأمين', en: 'Insurance' },
  { key: 'maintenance', ar: 'صيانة', en: 'Maintenance' },
  { key: 'manufacturing', ar: 'تصنيع', en: 'Manufacturing' },
  { key: 'other', ar: 'أخرى', en: 'Other' }
];

export const getAccountUsageLabel = (key: string | undefined, lang: 'ar' | 'en'): string => {
  const opt = ACCOUNT_USAGE_OPTIONS.find(o => o.key === key);
  if (!opt) return lang === 'ar' ? 'أخرى' : 'Other';
  return lang === 'ar' ? opt.ar : opt.en;
};

export interface AccountUsageGroup {
  labelAr: string;
  labelEn: string;
  keys: string[];
}

export const ACCOUNT_USAGE_GROUPS: AccountUsageGroup[] = [
  {
    labelAr: 'الميزانية - الأصول',
    labelEn: 'Balance Sheet - Assets',
    keys: ['cash', 'main_cash', 'petty_cash', 'bank', 'wallet', 'credit_card', 'debit_card', 'cheque', 'post_dated_cheque', 'customer', 'accounts_receivable', 'inventory', 'raw_materials', 'work_in_progress', 'finished_goods', 'employee_advances', 'employee_loans', 'fixed_asset', 'current_asset']
  },
  {
    labelAr: 'الميزانية - الالتزامات وحقوق الملكية',
    labelEn: 'Balance Sheet - Liabilities & Equity',
    keys: ['supplier', 'accounts_payable', 'accumulated_depreciation', 'current_liability', 'long_term_liability', 'loan', 'capital', 'equity', 'retained_earnings']
  },
  {
    labelAr: 'قائمة الدخل - الإيرادات',
    labelEn: 'Income Statement - Revenues',
    keys: ['sales_revenue', 'service_revenue', 'other_revenue', 'financial_revenue']
  },
  {
    labelAr: 'قائمة الدخل - التكلفة',
    labelEn: 'Income Statement - Costs',
    keys: ['cost_of_sales', 'purchases', 'purchase_returns', 'sales_returns']
  },
  {
    labelAr: 'قائمة الدخل - المصروفات',
    labelEn: 'Income Statement - Expenses',
    keys: ['operating_expense', 'administrative_expense', 'marketing_expense', 'selling_expense', 'financial_expense', 'depreciation_expense', 'payroll']
  },
  {
    labelAr: 'أخرى',
    labelEn: 'Others',
    keys: ['earned_discounts', 'granted_discounts', 'vat', 'input_vat', 'output_vat', 'withholding_tax', 'employee', 'drawings', 'cost_center', 'project', 'branch', 'department', 'contract', 'investment', 'exchange_difference', 'foreign_currency', 'internal_transfer', 'suspense_account', 'clearing_account', 'opening_balance', 'closing_balance', 'insurance', 'maintenance', 'manufacturing', 'other']
  }
];

