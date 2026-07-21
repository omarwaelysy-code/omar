export interface AccountUsageOption {
  key: string;
  ar: string;
  en: string;
}

export const ACCOUNT_USAGE_OPTIONS: AccountUsageOption[] = [
  // Cash & Banking
  { key: 'cash', ar: 'نقدية', en: 'Cash' },
  { key: 'main_cash', ar: 'صندوق رئيسي', en: 'Main Cash' },
  { key: 'petty_cash', ar: 'عهد نقدية', en: 'Petty Cash' },
  { key: 'bank', ar: 'بنك', en: 'Bank' },
  { key: 'wallet', ar: 'محفظة إلكترونية', en: 'Wallet' },
  { key: 'credit_card', ar: 'بطاقة ائتمان', en: 'Credit Card' },
  { key: 'debit_card', ar: 'بطاقة خصم', en: 'Debit Card' },

  // Receivables & Customers (Merged per request)
  { key: 'cheque', ar: 'أوراق قبض', en: 'Notes Receivable' },
  { key: 'customer', ar: 'عملاء', en: 'Customers' },

  // Inventory & Production
  { key: 'inventory', ar: 'مخزون', en: 'Inventory' },
  { key: 'raw_materials', ar: 'خامات', en: 'Raw Materials' },
  { key: 'work_in_progress', ar: 'إنتاج تحت التشغيل', en: 'Work In Progress' },
  { key: 'finished_goods', ar: 'منتجات تامة', en: 'Finished Goods' },

  // Employee Accounts
  { key: 'employee_advances', ar: 'سلف موظفين', en: 'Employee Advances' },
  { key: 'employee_loans', ar: 'قروض موظفين', en: 'Employee Loans' },
  { key: 'payroll', ar: 'مرتبات', en: 'Payroll' },
  { key: 'employee', ar: 'موظف', en: 'Employee' },

  // Assets
  { key: 'fixed_asset', ar: 'أصل ثابت', en: 'Fixed Asset' },
  { key: 'current_asset', ar: 'أصل متداول', en: 'Current Asset' },
  { key: 'accumulated_depreciation', ar: 'مجمع الإهلاك', en: 'Accumulated Depreciation' },
  { key: 'investment', ar: 'استثمار', en: 'Investment' },

  // Suppliers & Liabilities
  { key: 'supplier', ar: 'موردين', en: 'Suppliers' },
  { key: 'accounts_payable', ar: 'ذمم الموردين', en: 'Accounts Payable' },
  { key: 'current_liability', ar: 'التزامات متداولة', en: 'Current Liability' },
  { key: 'long_term_liability', ar: 'التزامات طويلة الأجل', en: 'Long Term Liability' },
  { key: 'loan', ar: 'قرض', en: 'Loan' },

  // Equity & Capital
  { key: 'capital', ar: 'رأس المال', en: 'Capital' },
  { key: 'equity', ar: 'حقوق الملكية', en: 'Equity' },
  { key: 'retained_earnings', ar: 'أرباح محتجزة', en: 'Retained Earnings' },
  { key: 'drawings', ar: 'مسحوبات', en: 'Drawings' },

  // Revenues & Sales
  { key: 'sales_revenue', ar: 'مبيعات', en: 'Sales Revenue' },
  { key: 'service_revenue', ar: 'إيرادات خدمات', en: 'Service Revenue' },
  { key: 'other_revenue', ar: 'إيرادات أخرى', en: 'Other Revenue' },
  { key: 'financial_revenue', ar: 'إيرادات مالية', en: 'Financial Revenue' },
  { key: 'earned_discounts', ar: 'خصومات مكتسبة', en: 'Earned Discounts' },

  // Costs & Purchases
  { key: 'cost_of_sales', ar: 'تكلفة المبيعات', en: 'Cost of Sales' },
  { key: 'purchases', ar: 'مشتريات', en: 'Purchases' },
  { key: 'purchase_returns', ar: 'مردودات مشتريات', en: 'Purchase Returns' },
  { key: 'sales_returns', ar: 'مردودات مبيعات', en: 'Sales Returns' },
  { key: 'granted_discounts', ar: 'خصومات ممنوحة', en: 'Granted Discounts' },

  // Expenses
  { key: 'operating_expense', ar: 'مصروفات تشغيلية', en: 'Operating Expense' },
  { key: 'administrative_expense', ar: 'مصروفات إدارية', en: 'Administrative Expense' },
  { key: 'marketing_expense', ar: 'مصروفات تسويق', en: 'Marketing Expense' },
  { key: 'selling_expense', ar: 'مصروفات بيع', en: 'Selling Expense' },
  { key: 'financial_expense', ar: 'مصروفات مالية', en: 'Financial Expense' },
  { key: 'depreciation_expense', ar: 'إهلاك', en: 'Depreciation Expense' },

  // Taxes & System
  { key: 'vat', ar: 'ضريبة قيمة مضافة', en: 'VAT' },
  { key: 'input_vat', ar: 'ضريبة مدخلات', en: 'Input VAT' },
  { key: 'output_vat', ar: 'ضريبة مخرجات', en: 'Output VAT' },
  { key: 'withholding_tax', ar: 'ضرائب مستقطعة', en: 'Withholding Tax' },
  { key: 'cost_center', ar: 'مركز تكلفة', en: 'Cost Center' },
  { key: 'project', ar: 'مشروع', en: 'Project' },
  { key: 'branch', ar: 'فرع', en: 'Branch' },
  { key: 'department', ar: 'قسم', en: 'Department' },
  { key: 'contract', ar: 'عقد', en: 'Contract' },
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
  if (key === 'post_dated_cheque' || key === 'cheque') {
    return lang === 'ar' ? 'أوراق قبض' : 'Notes Receivable';
  }
  if (key === 'accounts_receivable' || key === 'customer') {
    return lang === 'ar' ? 'عملاء' : 'Customers';
  }
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
    labelAr: 'النقدية والبنوك والوسائل المالية',
    labelEn: 'Cash, Banks & Payment Methods',
    keys: ['cash', 'main_cash', 'petty_cash', 'bank', 'wallet', 'credit_card', 'debit_card']
  },
  {
    labelAr: 'أوراق القبض والعملاء',
    labelEn: 'Receivables & Customers',
    keys: ['cheque', 'post_dated_cheque', 'customer', 'accounts_receivable']
  },
  {
    labelAr: 'المخزون والإنتاج',
    labelEn: 'Inventory & Production',
    keys: ['inventory', 'raw_materials', 'work_in_progress', 'finished_goods']
  },
  {
    labelAr: 'حسابات الموظفين',
    labelEn: 'Employee Accounts',
    keys: ['employee_advances', 'employee_loans', 'payroll', 'employee']
  },
  {
    labelAr: 'الأصول الثابتة والمتداولة الأخرى',
    labelEn: 'Fixed & Other Current Assets',
    keys: ['fixed_asset', 'current_asset', 'accumulated_depreciation', 'investment']
  },
  {
    labelAr: 'الموردون والالتزامات والقروض',
    labelEn: 'Suppliers, Liabilities & Loans',
    keys: ['supplier', 'accounts_payable', 'current_liability', 'long_term_liability', 'loan']
  },
  {
    labelAr: 'حقوق الملكية ورأس المال',
    labelEn: 'Equity & Capital',
    keys: ['capital', 'equity', 'retained_earnings', 'drawings']
  },
  {
    labelAr: 'الإيرادات والمبيعات',
    labelEn: 'Revenues & Sales',
    keys: ['sales_revenue', 'service_revenue', 'other_revenue', 'financial_revenue', 'earned_discounts']
  },
  {
    labelAr: 'التكاليف والمشتريات',
    labelEn: 'Costs & Purchases',
    keys: ['cost_of_sales', 'purchases', 'purchase_returns', 'sales_returns', 'granted_discounts']
  },
  {
    labelAr: 'المصروفات',
    labelEn: 'Expenses',
    keys: ['operating_expense', 'administrative_expense', 'marketing_expense', 'selling_expense', 'financial_expense', 'depreciation_expense']
  },
  {
    labelAr: 'الضرائب والحسابات الأخرى',
    labelEn: 'Taxes & Other Accounts',
    keys: ['vat', 'input_vat', 'output_vat', 'withholding_tax', 'cost_center', 'project', 'branch', 'department', 'contract', 'exchange_difference', 'foreign_currency', 'internal_transfer', 'suspense_account', 'clearing_account', 'opening_balance', 'closing_balance', 'insurance', 'maintenance', 'manufacturing', 'other']
  }
];


