export interface AccountUsageOption {
  key: string;
  ar: string;
  en: string;
}

export interface AccountUsageGroup {
  macroAr: string;
  macroEn: string;
  labelAr: string;
  labelEn: string;
  keys: string[];
}

export const ACCOUNT_USAGE_OPTIONS: AccountUsageOption[] = [
  // 1. الميزانية - أصول
  { key: 'cash', ar: 'نقدية', en: 'Cash' },
  { key: 'petty_cash', ar: 'عهد نقدية', en: 'Petty Cash' },
  { key: 'bank', ar: 'بنك', en: 'Bank' },
  { key: 'wallet', ar: 'محفظة إلكترونية', en: 'Wallet' },
  { key: 'credit_card', ar: 'بطاقة ائتمان', en: 'Credit Card' },
  { key: 'debit_card', ar: 'بطاقة خصم', en: 'Debit Card' },

  { key: 'cheque', ar: 'أوراق قبض', en: 'Notes Receivable' },
  { key: 'customer', ar: 'عملاء', en: 'Customers' },

  { key: 'inventory', ar: 'مخزون', en: 'Inventory' },
  { key: 'raw_materials', ar: 'خامات', en: 'Raw Materials' },
  { key: 'work_in_progress', ar: 'إنتاج تحت التشغيل', en: 'Work In Progress' },
  { key: 'finished_goods', ar: 'منتجات تامة', en: 'Finished Goods' },

  { key: 'fixed_asset', ar: 'أصل ثابت', en: 'Fixed Asset' },
  { key: 'current_asset', ar: 'أصل متداول', en: 'Current Asset' },
  { key: 'accumulated_depreciation', ar: 'مجمع الإهلاك', en: 'Accumulated Depreciation' },
  { key: 'investment', ar: 'استثمار', en: 'Investment' },

  // 2. الميزانية - التزامات
  { key: 'supplier', ar: 'موردين', en: 'Suppliers' },
  { key: 'notes_payable', ar: 'أوراق دفع', en: 'Notes Payable' },

  { key: 'current_liability', ar: 'التزامات متداولة', en: 'Current Liability' },
  { key: 'long_term_liability', ar: 'التزامات طويلة الأجل', en: 'Long Term Liability' },
  { key: 'loan', ar: 'قرض', en: 'Loan' },

  { key: 'employee_advances', ar: 'سلف موظفين', en: 'Employee Advances' },
  { key: 'payroll', ar: 'رواتب مستحقة', en: 'Accrued Salaries' },

  { key: 'vat', ar: 'ضريبة قيمة مضافة', en: 'VAT' },
  { key: 'payroll_tax', ar: 'ضرائب كسب عمل', en: 'Payroll Tax' },
  { key: 'income_tax', ar: 'ضرائب دخل', en: 'Income Tax' },
  { key: 'withholding_tax_customers', ar: 'ضرائب خصم من العملاء', en: 'Tax Withheld by Customers' },
  { key: 'withholding_tax_suppliers', ar: 'ضرائب خصم على الموردين', en: 'Tax Withheld for Suppliers' },

  // 3. الميزانية - حقوق ملكية
  { key: 'capital', ar: 'رأس المال', en: 'Capital' },
  { key: 'equity', ar: 'حقوق الملكية', en: 'Equity' },
  { key: 'retained_earnings', ar: 'أرباح محتجزة', en: 'Retained Earnings' },
  { key: 'drawings', ar: 'جاري شركاء', en: 'Partners Current Account' },

  // 4. قائمة الدخل - إيرادات
  { key: 'sales_revenue', ar: 'مبيعات', en: 'Sales Revenue' },
  { key: 'service_revenue', ar: 'إيرادات خدمات', en: 'Service Revenue' },
  { key: 'other_revenue', ar: 'إيرادات أخرى', en: 'Other Revenue' },
  { key: 'financial_revenue', ar: 'إيرادات مالية', en: 'Financial Revenue' },
  { key: 'sales_returns', ar: 'مردودات مبيعات', en: 'Sales Returns' },
  { key: 'earned_discounts', ar: 'خصم مبيعات', en: 'Sales Discount' },

  // 5. قائمة الدخل - تكاليف
  { key: 'cost_of_sales', ar: 'تكلفة المبيعات', en: 'Cost of Sales' },
  { key: 'purchases', ar: 'مشتريات', en: 'Purchases' },
  { key: 'purchase_returns', ar: 'مردودات مشتريات', en: 'Purchase Returns' },
  { key: 'granted_discounts', ar: 'خصم مشتريات', en: 'Purchase Discount' },

  // 6. قائمة الدخل - مصروفات / إهلاك / فوائد
  { key: 'operating_expense', ar: 'مصروفات تشغيلية', en: 'Operating Expense' },
  { key: 'administrative_expense', ar: 'مصروفات إدارية', en: 'Administrative Expense' },
  { key: 'marketing_expense', ar: 'مصروفات تسويق', en: 'Marketing Expense' },
  { key: 'selling_expense', ar: 'مصروفات بيع', en: 'Selling Expense' },
  { key: 'financial_expense', ar: 'مصروفات مالية (فوائد)', en: 'Financial Expense (Interest)' },
  { key: 'depreciation_expense', ar: 'إهلاك', en: 'Depreciation Expense' }
];

export const getAccountUsageLabel = (key: string | undefined, lang: 'ar' | 'en'): string => {
  if (!key) return lang === 'ar' ? 'عام' : 'General';
  if (key === 'post_dated_cheque' || key === 'cheque') {
    return lang === 'ar' ? 'أوراق قبض' : 'Notes Receivable';
  }
  if (key === 'accounts_receivable' || key === 'customer') {
    return lang === 'ar' ? 'عملاء' : 'Customers';
  }
  if (key === 'accounts_payable' || key === 'supplier') {
    return lang === 'ar' ? 'موردين' : 'Suppliers';
  }
  if (key === 'main_cash') {
    return lang === 'ar' ? 'نقدية' : 'Cash';
  }
  if (key === 'earned_discounts') {
    return lang === 'ar' ? 'خصم مبيعات' : 'Sales Discount';
  }
  if (key === 'granted_discounts') {
    return lang === 'ar' ? 'خصم مشتريات' : 'Purchase Discount';
  }
  if (key === 'drawings') {
    return lang === 'ar' ? 'جاري شركاء' : 'Partners Current Account';
  }
  if (key === 'payroll') {
    return lang === 'ar' ? 'رواتب مستحقة' : 'Accrued Salaries';
  }
  const opt = ACCOUNT_USAGE_OPTIONS.find(o => o.key === key);
  if (!opt) return key;
  return lang === 'ar' ? opt.ar : opt.en;
};

export const ACCOUNT_USAGE_GROUPS: AccountUsageGroup[] = [
  // 1. الميزانية - أصول
  {
    macroAr: 'الميزانية - أصول',
    macroEn: 'Balance Sheet - Assets',
    labelAr: 'النقدية والبنوك والوسائل المالية',
    labelEn: 'Cash, Banks & Payment Methods',
    keys: ['cash', 'petty_cash', 'bank', 'wallet', 'credit_card', 'debit_card']
  },
  {
    macroAr: 'الميزانية - أصول',
    macroEn: 'Balance Sheet - Assets',
    labelAr: 'أوراق القبض والعملاء',
    labelEn: 'Receivables & Customers',
    keys: ['cheque', 'post_dated_cheque', 'customer', 'accounts_receivable']
  },
  {
    macroAr: 'الميزانية - أصول',
    macroEn: 'Balance Sheet - Assets',
    labelAr: 'المخزون والإنتاج',
    labelEn: 'Inventory & Production',
    keys: ['inventory', 'raw_materials', 'work_in_progress', 'finished_goods']
  },
  {
    macroAr: 'الميزانية - أصول',
    macroEn: 'Balance Sheet - Assets',
    labelAr: 'الأصول الثابتة والمتداولة الأخرى',
    labelEn: 'Fixed & Other Current Assets',
    keys: ['fixed_asset', 'current_asset', 'accumulated_depreciation', 'investment']
  },

  // 2. الميزانية - التزامات
  {
    macroAr: 'الميزانية - التزامات',
    macroEn: 'Balance Sheet - Liabilities',
    labelAr: 'أوراق الدفع والموردين',
    labelEn: 'Payables & Suppliers',
    keys: ['supplier', 'accounts_payable', 'notes_payable']
  },
  {
    macroAr: 'الميزانية - التزامات',
    macroEn: 'Balance Sheet - Liabilities',
    labelAr: 'الالتزامات والقروض',
    labelEn: 'Liabilities & Loans',
    keys: ['current_liability', 'long_term_liability', 'loan']
  },
  {
    macroAr: 'الميزانية - التزامات',
    macroEn: 'Balance Sheet - Liabilities',
    labelAr: 'حسابات الموظفين والرواتب',
    labelEn: 'Employee Accounts & Payroll',
    keys: ['employee_advances', 'payroll']
  },
  {
    macroAr: 'الميزانية - التزامات',
    macroEn: 'Balance Sheet - Liabilities',
    labelAr: 'الضرائب',
    labelEn: 'Taxes',
    keys: ['vat', 'payroll_tax', 'income_tax', 'withholding_tax_customers', 'withholding_tax_suppliers']
  },

  // 3. الميزانية - حقوق ملكية
  {
    macroAr: 'الميزانية - حقوق ملكية',
    macroEn: 'Balance Sheet - Equity',
    labelAr: 'حقوق الملكية ورأس المال',
    labelEn: 'Equity & Capital',
    keys: ['capital', 'equity', 'retained_earnings', 'drawings']
  },

  // 4. قائمة الدخل - إيرادات
  {
    macroAr: 'قائمة الدخل - إيرادات',
    macroEn: 'Income Statement - Revenues',
    labelAr: 'الإيرادات والمبيعات والمردودات',
    labelEn: 'Revenues, Sales & Returns',
    keys: ['sales_revenue', 'service_revenue', 'other_revenue', 'financial_revenue', 'sales_returns', 'earned_discounts']
  },

  // 5. قائمة الدخل - تكاليف
  {
    macroAr: 'قائمة الدخل - تكاليف',
    macroEn: 'Income Statement - Costs',
    labelAr: 'التكاليف والمشتريات',
    labelEn: 'Costs & Purchases',
    keys: ['cost_of_sales', 'purchases', 'purchase_returns', 'granted_discounts']
  },

  // 6. قائمة الدخل - مصروفات / إهلاك / فوائد
  {
    macroAr: 'قائمة الدخل - مصروفات / إهلاك / فوائد',
    macroEn: 'Income Statement - Expenses / Depreciation / Interest',
    labelAr: 'المصروفات والإهلاك والفوائد',
    labelEn: 'Expenses, Depreciation & Interest',
    keys: ['operating_expense', 'administrative_expense', 'marketing_expense', 'selling_expense', 'financial_expense', 'depreciation_expense']
  }
];


