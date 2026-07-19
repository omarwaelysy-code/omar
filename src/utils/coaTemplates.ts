export type TemplateAccount = {
  code: string;
  name_ar: string;
  name_en: string;
  usage?: string; // keys from accountUsageUtils
  business_type?: 'all' | 'commercial' | 'service'; // To filter if needed
  children?: TemplateAccount[];
};

export type TemplateType = {
  code: string;
  name_ar: string;
  name_en: string;
  statement_type: 'balance_sheet' | 'income_statement';
  classification: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cost';
  accounts: TemplateAccount[];
};

export const STANDARD_COA_TEMPLATE: TemplateType[] = [
  {
    code: '1',
    name_ar: 'الأصول',
    name_en: 'Assets',
    statement_type: 'balance_sheet',
    classification: 'asset',
    accounts: [
      {
        code: '11',
        name_ar: 'الأصول المتداولة',
        name_en: 'Current Assets',
        usage: 'current_asset',
        children: [
          {
            code: '1101',
            name_ar: 'النقدية وما في حكمها',
            name_en: 'Cash and Cash Equivalents',
            children: [
              { code: '110101', name_ar: 'الصندوق الرئيسي', name_en: 'Main Cash', usage: 'main_cash' },
              { code: '110102', name_ar: 'صندوق المصروفات النثرية', name_en: 'Petty Cash', usage: 'petty_cash' },
              { code: '110103', name_ar: 'البنك', name_en: 'Bank', usage: 'bank' }
            ]
          },
          {
            code: '1102',
            name_ar: 'الذمم المدينة',
            name_en: 'Accounts Receivable',
            usage: 'accounts_receivable',
            children: [
              { code: '110201', name_ar: 'العملاء', name_en: 'Customers', usage: 'customer' },
              { code: '110202', name_ar: 'شيكات تحت التحصيل', name_en: 'Post Dated Cheques', usage: 'post_dated_cheque' }
            ]
          },
          {
            code: '1103',
            name_ar: 'المخزون',
            name_en: 'Inventory',
            usage: 'inventory',
            business_type: 'commercial', // Mainly for commercial, but could be for service if they sell parts
            children: [
              { code: '110301', name_ar: 'مخزون بضاعة', name_en: 'Goods Inventory', usage: 'finished_goods' }
            ]
          },
          {
            code: '1104',
            name_ar: 'أرصدة مدينة أخرى',
            name_en: 'Other Receivables',
            children: [
              { code: '110401', name_ar: 'سلف الموظفين', name_en: 'Employee Advances', usage: 'employee_advances' },
              { code: '110402', name_ar: 'ضريبة القيمة المضافة - مدخلات', name_en: 'Input VAT', usage: 'input_vat' }
            ]
          }
        ]
      },
      {
        code: '12',
        name_ar: 'الأصول غير المتداولة (الثابتة)',
        name_en: 'Non-Current Assets',
        usage: 'fixed_asset',
        children: [
          {
            code: '1201',
            name_ar: 'الممتلكات والمعدات',
            name_en: 'Property and Equipment',
            children: [
              { code: '120101', name_ar: 'الآلات والمعدات', name_en: 'Machinery and Equipment' },
              { code: '120102', name_ar: 'الأثاث والتركيبات', name_en: 'Furniture and Fixtures' },
              { code: '120103', name_ar: 'أجهزة الحاسب الآلي', name_en: 'Computers' },
              { code: '120104', name_ar: 'السيارات', name_en: 'Vehicles' }
            ]
          },
          {
            code: '1202',
            name_ar: 'مجمع الإهلاك',
            name_en: 'Accumulated Depreciation',
            usage: 'accumulated_depreciation',
            children: [
              { code: '120201', name_ar: 'مجمع إهلاك الآلات', name_en: 'Acc. Depr. Machinery' },
              { code: '120202', name_ar: 'مجمع إهلاك الأثاث', name_en: 'Acc. Depr. Furniture' },
              { code: '120203', name_ar: 'مجمع إهلاك الحاسبات', name_en: 'Acc. Depr. Computers' },
              { code: '120204', name_ar: 'مجمع إهلاك السيارات', name_en: 'Acc. Depr. Vehicles' }
            ]
          }
        ]
      }
    ]
  },
  {
    code: '2',
    name_ar: 'الالتزامات',
    name_en: 'Liabilities',
    statement_type: 'balance_sheet',
    classification: 'liability',
    accounts: [
      {
        code: '21',
        name_ar: 'الالتزامات المتداولة',
        name_en: 'Current Liabilities',
        usage: 'current_liability',
        children: [
          {
            code: '2101',
            name_ar: 'الذمم الدائنة',
            name_en: 'Accounts Payable',
            usage: 'accounts_payable',
            children: [
              { code: '210101', name_ar: 'الموردون', name_en: 'Suppliers', usage: 'supplier' }
            ]
          },
          {
            code: '2102',
            name_ar: 'أرصدة دائنة أخرى',
            name_en: 'Other Payables',
            children: [
              { code: '210201', name_ar: 'رواتب مستحقة', name_en: 'Accrued Salaries', usage: 'payroll' },
              { code: '210202', name_ar: 'ضريبة القيمة المضافة - مخرجات', name_en: 'Output VAT', usage: 'output_vat' }
            ]
          }
        ]
      },
      {
        code: '22',
        name_ar: 'الالتزامات غير المتداولة',
        name_en: 'Non-Current Liabilities',
        usage: 'long_term_liability',
        children: [
          { code: '2201', name_ar: 'قروض طويلة الأجل', name_en: 'Long Term Loans', usage: 'loan' },
          { code: '2202', name_ar: 'مكافأة نهاية الخدمة', name_en: 'End of Service Provision' }
        ]
      }
    ]
  },
  {
    code: '3',
    name_ar: 'حقوق الملكية',
    name_en: 'Equity',
    statement_type: 'balance_sheet',
    classification: 'equity',
    accounts: [
      { code: '3101', name_ar: 'رأس المال', name_en: 'Capital', usage: 'capital' },
      { code: '3102', name_ar: 'جاري الشركاء / مسحوبات', name_en: 'Drawings / Partner Current', usage: 'drawings' },
      { code: '3103', name_ar: 'أرباح مبقاة (محتجزة)', name_en: 'Retained Earnings', usage: 'retained_earnings' }
    ]
  },
  {
    code: '4',
    name_ar: 'الإيرادات',
    name_en: 'Revenue',
    statement_type: 'income_statement',
    classification: 'revenue',
    accounts: [
      {
        code: '41',
        name_ar: 'الإيرادات التشغيلية',
        name_en: 'Operating Revenue',
        children: [
          { code: '4101', name_ar: 'إيرادات مبيعات بضاعة', name_en: 'Sales Revenue', usage: 'sales_revenue', business_type: 'commercial' },
          { code: '4102', name_ar: 'إيرادات خدمات', name_en: 'Service Revenue', usage: 'service_revenue', business_type: 'service' },
          { code: '4103', name_ar: 'مرتجعات المبيعات', name_en: 'Sales Returns', usage: 'sales_returns', business_type: 'commercial' },
          { code: '4104', name_ar: 'خصم مسموح به', name_en: 'Granted Discounts', usage: 'granted_discounts' }
        ]
      },
      {
        code: '42',
        name_ar: 'إيرادات أخرى',
        name_en: 'Other Revenue',
        usage: 'other_revenue',
        children: [
          { code: '4201', name_ar: 'إيرادات متنوعة', name_en: 'Miscellaneous Revenue' },
          { code: '4202', name_ar: 'أرباح فروق عملة', name_en: 'Exchange Difference Gain' }
        ]
      }
    ]
  },
  {
    code: '5',
    name_ar: 'تكلفة المبيعات',
    name_en: 'Cost of Sales',
    statement_type: 'income_statement',
    classification: 'cost',
    accounts: [
      { code: '5101', name_ar: 'تكلفة البضاعة المباعة', name_en: 'Cost of Goods Sold', usage: 'cost_of_sales', business_type: 'commercial' },
      { code: '5102', name_ar: 'تكاليف تشغيل الخدمات', name_en: 'Cost of Services', business_type: 'service' },
      { code: '5103', name_ar: 'المشتريات', name_en: 'Purchases', usage: 'purchases', business_type: 'commercial' },
      { code: '5104', name_ar: 'مرتجعات المشتريات', name_en: 'Purchase Returns', usage: 'purchase_returns', business_type: 'commercial' },
      { code: '5105', name_ar: 'خصم مكتسب', name_en: 'Earned Discounts', usage: 'earned_discounts' }
    ]
  },
  {
    code: '6',
    name_ar: 'المصروفات',
    name_en: 'Expenses',
    statement_type: 'income_statement',
    classification: 'expense',
    accounts: [
      {
        code: '61',
        name_ar: 'المصروفات العمومية والإدارية',
        name_en: 'General & Administrative Expenses',
        usage: 'administrative_expense',
        children: [
          { code: '6101', name_ar: 'الرواتب والأجور', name_en: 'Salaries & Wages' },
          { code: '6102', name_ar: 'إيجارات', name_en: 'Rent' },
          { code: '6103', name_ar: 'كهرباء ومياه', name_en: 'Electricity & Water' },
          { code: '6104', name_ar: 'قرطاسية ومطبوعات', name_en: 'Stationery & Printing' },
          { code: '6105', name_ar: 'رسوم حكومية', name_en: 'Government Fees' },
          { code: '6106', name_ar: 'مصروفات بنكية', name_en: 'Bank Charges' }
        ]
      },
      {
        code: '62',
        name_ar: 'المصروفات البيعية والتسويقية',
        name_en: 'Selling & Marketing Expenses',
        usage: 'marketing_expense',
        children: [
          { code: '6201', name_ar: 'إعلانات وتسويق', name_en: 'Advertising & Marketing' },
          { code: '6202', name_ar: 'عمولات بيع', name_en: 'Sales Commissions' }
        ]
      },
      {
        code: '63',
        name_ar: 'المصروفات المالية والإهلاكات',
        name_en: 'Financial & Depreciation Expenses',
        children: [
          { code: '6301', name_ar: 'مصروف الإهلاك', name_en: 'Depreciation Expense', usage: 'depreciation_expense' },
          { code: '6302', name_ar: 'خسائر فروق عملة', name_en: 'Exchange Difference Loss' }
        ]
      }
    ]
  }
];
