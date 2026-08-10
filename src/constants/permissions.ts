export interface PermissionGroup {
  id: string;
  nameAr: string;
  nameEn: string;
  modules: string[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'dashboard',
    nameAr: 'لوحة التحكم',
    nameEn: 'Dashboard',
    modules: ['dashboard', 'dashboard_designer', 'integrity_dashboard']
  },
  {
    id: 'master_data',
    nameAr: 'البيانات الأساسية',
    nameEn: 'Master Data',
    modules: ['customers', 'suppliers', 'products', 'item_groups', 'employees', 'expenses', 'payment_methods', 'currencies', 'departments', 'cost_centers']
  },
  {
    id: 'sales',
    nameAr: 'المبيعات',
    nameEn: 'Sales',
    modules: ['quotations', 'sales_orders', 'invoices', 'returns', 'customer_discounts', 'customer_settlements']
  },
  {
    id: 'purchases',
    nameAr: 'المشتريات',
    nameEn: 'Purchases',
    modules: ['purchase_orders', 'purchase_invoices', 'purchase_returns', 'supplier_discounts', 'supplier_settlements']
  },
  {
    id: 'warehouses',
    nameAr: 'المخازن',
    nameEn: 'Warehouses',
    modules: ['warehouses', 'goods_receipts', 'warehouse_transfers', 'opening_stock_balances', 'stock_adjustments']
  },
  {
    id: 'cash_banks',
    nameAr: 'الخزينة والبنوك',
    nameEn: 'Cash & Banks',
    modules: ['receipts', 'payment_vouchers', 'cash_transfers', 'cash_balances']
  },
  {
    id: 'general_ledger',
    nameAr: 'الحسابات العامة',
    nameEn: 'General Ledger',
    modules: ['account_types', 'accounts', 'chart_of_accounts']
  },
  {
    id: 'journal_entries',
    nameAr: 'القيود اليومية',
    nameEn: 'Journal Entries',
    modules: ['create_journal_entry', 'journal_entries', 'detailed_journal_entries']
  },
  {
    id: 'reports',
    nameAr: 'التقارير',
    nameEn: 'Reports',
    modules: [
      'customer_statement', 'supplier_statement', 'customer_balances', 'supplier_balances',
      'sales_report', 'expenses_report', 'cash_report', 'general_ledger_report',
      'trial_balance', 'income_statement', 'balance_sheet', 'stock_card_report',
      'stock_balances_report', 'general_stock_movements_report'
    ]
  },
  {
    id: 'management',
    nameAr: 'الإدارة',
    nameEn: 'Management',
    modules: ['users', 'companies', 'activity_log', 'audit_logs', 'system_check', 'period_closing']
  },
  {
    id: 'settings',
    nameAr: 'الإعدادات',
    nameEn: 'Settings',
    modules: ['company_settings', 'discount_settings', 'backup_restore', 'templates', 'create_template', 'operation_categories', 'operation_fields', 'operations']
  }
];

export const SPECIAL_PERMISSIONS_DESC: { [key: string]: { ar: string; en: string; descAr: string; descEn: string } } = {
  approve: {
    ar: 'اعتماد',
    en: 'Approve',
    descAr: 'يسمح بتحويل المستند إلى حالة "معتمد" ليؤثر على المخزون أو الحسابات.',
    descEn: 'Allows changing the document status to "Approved" to affect inventory or accounts.'
  },
  cancel_approval: {
    ar: 'إلغاء الاعتماد',
    en: 'Cancel Approval',
    descAr: 'يسمح بإلغاء اعتماد المستند وإزالة أثره المحاسبي أو المخزني.',
    descEn: 'Allows cancelling document approval and reversing its accounting or inventory effect.'
  },
  print: {
    ar: 'طباعة',
    en: 'Print',
    descAr: 'يسمح للمستخدم بطباعة المستندات أو الفواتير والتقارير.',
    descEn: 'Allows printing documents, invoices, or reports.'
  },
  export_pdf: {
    ar: 'تصدير PDF',
    en: 'Export PDF',
    descAr: 'يسمح بتصدير البيانات أو التقارير والمستندات بصيغة PDF.',
    descEn: 'Allows exporting data, reports, or documents as PDF.'
  },
  export_excel: {
    ar: 'تصدير Excel',
    en: 'Export Excel',
    descAr: 'يسمح بتصدير البيانات أو التقارير والمستندات بصيغة Excel.',
    descEn: 'Allows exporting data, reports, or documents as Excel.'
  },
  copy: {
    ar: 'نسخ',
    en: 'Copy',
    descAr: 'يسمح بنسخ مستند قائم لإنشاء مستند جديد بسرعة.',
    descEn: 'Allows copying an existing document to quickly create a new one.'
  },
  edit_approved: {
    ar: 'تعديل بعد الاعتماد',
    en: 'Edit Approved',
    descAr: 'يسمح بتعديل البيانات داخل مستند أو سجل تم اعتماده مسبقاً.',
    descEn: 'Allows editing data inside an already approved document.'
  },
  delete_approved: {
    ar: 'حذف بعد الاعتماد',
    en: 'Delete Approved',
    descAr: 'يسمح بحذف مستند أو سجل تم اعتماده مسبقاً من النظام.',
    descEn: 'Allows deleting an already approved document.'
  },
  view_cost: {
    ar: 'عرض التكلفة',
    en: 'View Cost',
    descAr: 'يسمح برؤية سعر تكلفة شراء الأصناف في الشاشات والتقارير.',
    descEn: 'Allows viewing item cost prices in screens and reports.'
  },
  view_profit_margin: {
    ar: 'عرض هامش الربح',
    en: 'View Profit Margin',
    descAr: 'يسمح بعرض الأرباح وهامش الربح داخل الفواتير وشاشات البيع والتقارير.',
    descEn: 'Allows viewing profits and profit margins in invoices, sales, and reports.'
  },
  change_prices: {
    ar: 'تغيير أسعار البيع',
    en: 'Change Prices',
    descAr: 'يسمح بتعديل سعر بيع الصنف يدويًا أثناء تسجيل الفاتورة أو المعاملة.',
    descEn: 'Allows modifying item selling prices manually during invoices or sales transactions.'
  },
  allow_negative: {
    ar: 'تجاوز الرصيد السالب',
    en: 'Allow Negative Stock',
    descAr: 'يسمح بإتمام عمليات الصرف والبيع حتى لو أصبحت كمية الصنف سالبة في المخازن.',
    descEn: 'Allows executing sales or issues even if the item stock goes negative.'
  },
  manual_stock_adjust: {
    ar: 'تعديل المخزون يدويًا',
    en: 'Manual Stock Adjust',
    descAr: 'يسمح بإجراء حركات تعديل أو تسوية مباشرة على كميات المخازن دون مستندات نظام.',
    descEn: 'Allows doing direct adjustment or reconciliation on warehouse stock quantities manually.'
  },
  open_closed_period: {
    ar: 'فتح فترة مغلقة',
    en: 'Open Closed Period',
    descAr: 'يسمح للمستخدم بفتح فترة محاسبية مغلقة مسبقاً والتعديل عليها.',
    descEn: 'Allows opening a previously closed accounting period and making changes.'
  },
  repost: {
    ar: 'إعادة ترحيل',
    en: 'Re-post',
    descAr: 'يسمح بإعادة ترحيل المستندات وتوليد القيود اليومية الخاصة بها مجدداً.',
    descEn: 'Allows re-posting documents and regenerating their journal entries.'
  },
  recalculate_cost: {
    ar: 'إعادة احتساب التكلفة',
    en: 'Recalculate Cost',
    descAr: 'يسمح بتشغيل محرك إعادة احتساب متوسط تكلفة الأصناف في المخازن.',
    descEn: 'Allows running the engine to recalculate average cost for items in inventory.'
  },
  perform_inventory: {
    ar: 'تنفيذ الجرد',
    en: 'Perform Inventory',
    descAr: 'يسمح للمستخدم بالدخول لشاشات الجرد وإدخال الكميات الفعلية وتسويتها.',
    descEn: 'Allows entering physical inventory quantities and committing stock adjustments.'
  },
  edit_cost_price: {
    ar: 'تعديل سعر التكلفة',
    en: 'Edit Cost Price',
    descAr: 'يسمح بتعديل سعر تكلفة الشراء أو المتوسط الافتراضي للأصناف يدويًا.',
    descEn: 'Allows modifying default cost price or average cost for items manually.'
  },
  reopen: {
    ar: 'فتح الفترة',
    en: 'Reopen Period',
    descAr: 'يسمح بفتح فترة محاسبية مغلقة وإلغاء حالة الإغلاق للحركة.',
    descEn: 'Allows reopening a closed period and resetting the closing status.'
  },
  bulk_close: {
    ar: 'إغلاق جماعي',
    en: 'Bulk Close',
    descAr: 'يسمح بتنفيذ إغلاق الفترات لجميع حركات ومستندات النظام دفعة واحدة.',
    descEn: 'Allows executing bulk period closing for all transactions at once.'
  },
  bypass: {
    ar: 'تجاوز الإغلاق بكلمة سر',
    en: 'Bypass Closing with Password',
    descAr: 'يسمح بتخطي منع إدخال الحركات في الفترات المغلقة باستخدام كلمة سر تجاوز الإغلاق.',
    descEn: 'Allows bypassing the restriction of adding transactions in closed periods using bypass password.'
  }
};

export const MODULE_PERMISSIONS_META: { [moduleId: string]: { labelAr: string; labelEn: string; hasCrud: boolean; special?: string[] } } = {
  // Dashboards
  dashboard: { labelAr: 'لوحة التحكم الرئيسية', labelEn: 'Main Dashboard', hasCrud: true },
  dashboard_designer: { labelAr: 'مصمم لوحات التحكم', labelEn: 'Dashboard Designer', hasCrud: true },
  integrity_dashboard: { labelAr: 'فحص سلامة البيانات', labelEn: 'Data Integrity Dashboard', hasCrud: true },
  // Master Data
  customers: { labelAr: 'العملاء', labelEn: 'Customers', hasCrud: true, special: ['print', 'export_pdf', 'export_excel'] },
  suppliers: { labelAr: 'الموردين', labelEn: 'Suppliers', hasCrud: true, special: ['print', 'export_pdf', 'export_excel'] },
  products: { labelAr: 'الأصناف والمنتجات', labelEn: 'Products', hasCrud: true, special: ['view_cost', 'edit_cost_price', 'change_prices', 'allow_negative', 'manual_stock_adjust', 'recalculate_cost', 'print', 'export_pdf', 'export_excel'] },
  item_groups: { labelAr: 'مجموعات الأصناف', labelEn: 'Item Groups', hasCrud: true },
  employees: { labelAr: 'الموظفين', labelEn: 'Employees', hasCrud: true },
  expenses: { labelAr: 'بنود المصروفات', labelEn: 'Expenses List', hasCrud: true },
  payment_methods: { labelAr: 'طرق السداد', labelEn: 'Payment Methods', hasCrud: true },
  currencies: { labelAr: 'العملات وأسعار الصرف', labelEn: 'Currencies & Exchange Rates', hasCrud: true },
  departments: { labelAr: 'الإدارات', labelEn: 'Departments', hasCrud: true },
  cost_centers: { labelAr: 'مراكز التكلفة', labelEn: 'Cost Centers', hasCrud: true },
  // Sales
  quotations: { labelAr: 'عروض الأسعار', labelEn: 'Quotations', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy'] },
  sales_orders: { labelAr: 'أوامر البيع', labelEn: 'Sales Orders', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'] },
  invoices: { labelAr: 'فواتير المبيعات', labelEn: 'Sales Invoices', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved', 'view_cost', 'view_profit_margin', 'change_prices', 'allow_negative'] },
  returns: { labelAr: 'مرتجع المبيعات', labelEn: 'Sales Returns', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved', 'view_cost'] },
  customer_discounts: { labelAr: 'خصم العملاء', labelEn: 'Customer Discounts', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel'] },
  customer_settlements: { labelAr: 'تسويات العملاء', labelEn: 'Customer Settlements', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'edit_approved', 'delete_approved'] },
  // Purchases
  purchase_orders: { labelAr: 'أوامر الشراء', labelEn: 'Purchase Orders', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'] },
  purchase_invoices: { labelAr: 'فواتير المشتريات', labelEn: 'Purchase Invoices', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved', 'view_cost', 'edit_cost_price'] },
  purchase_returns: { labelAr: 'مرتجع المشتريات', labelEn: 'Purchase Returns', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved', 'view_cost'] },
  supplier_discounts: { labelAr: 'خصم الموردين', labelEn: 'Supplier Discounts', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel'] },
  supplier_settlements: { labelAr: 'تسويات الموردين', labelEn: 'Supplier Settlements', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'edit_approved', 'delete_approved'] },
  // Warehouses
  warehouses: { labelAr: 'المستودعات والمخازن', labelEn: 'Warehouses & Stores', hasCrud: true, special: ['manual_stock_adjust', 'perform_inventory'] },
  goods_receipts: { labelAr: 'إذن استلام المخزون', labelEn: 'Goods Receipts', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'] },
  warehouse_transfers: { labelAr: 'حوالات المستودعات', labelEn: 'Warehouse Transfers', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'edit_approved', 'delete_approved'] },
  opening_stock_balances: { labelAr: 'أرصدة أول المدة للمخزون', labelEn: 'Opening Stock Balances', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'edit_approved', 'delete_approved', 'manual_stock_adjust'] },
  stock_adjustments: { labelAr: 'تسويات المخزون', labelEn: 'Stock Adjustments', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'edit_approved', 'delete_approved', 'manual_stock_adjust'] },
  // Cash & Banks
  receipts: { labelAr: 'سندات القبض', labelEn: 'Receipt Vouchers', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'] },
  payment_vouchers: { labelAr: 'سندات الصرف', labelEn: 'Payment Vouchers', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'] },
  supplier_payment_vouchers: { labelAr: 'سند صرف مورد', labelEn: 'Supplier Payment Vouchers', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved'] },
  cash_transfers: { labelAr: 'حوالات الخزينة', labelEn: 'Cash Transfers', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'edit_approved', 'delete_approved'] },
  cash_balances: { labelAr: 'أرصدة النقدية والخزائن', labelEn: 'Cash Balances', hasCrud: true },
  // GL
  account_types: { labelAr: 'أنواع الحسابات', labelEn: 'Account Types', hasCrud: true },
  accounts: { labelAr: 'دليل الحسابات', labelEn: 'Accounts', hasCrud: true },
  chart_of_accounts: { labelAr: 'شجرة الحسابات', labelEn: 'Chart of Accounts', hasCrud: true },
  // Journal entries
  create_journal_entry: { labelAr: 'إضافة قيد يومية', labelEn: 'Create Journal Entry', hasCrud: true, special: ['print', 'export_pdf', 'export_excel'] },
  journal_entries: { labelAr: 'قيود اليومية', labelEn: 'Journal Entries', hasCrud: true, special: ['approve', 'cancel_approval', 'print', 'export_pdf', 'export_excel', 'copy', 'edit_approved', 'delete_approved', 'repost'] },
  detailed_journal_entries: { labelAr: 'دفتر اليومية المفصل', labelEn: 'Detailed Journal Entries', hasCrud: true, special: ['print', 'export_pdf', 'export_excel'] },
  // Reports
  customer_statement: { labelAr: 'كشف حساب العميل', labelEn: 'Customer Statement', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  supplier_statement: { labelAr: 'كشف حساب المورد', labelEn: 'Supplier Statement', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  customer_balances: { labelAr: 'تقرير أرصدة العملاء', labelEn: 'Customer Balances Report', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  supplier_balances: { labelAr: 'تقرير أرصدة الموردين', labelEn: 'Supplier Balances Report', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  sales_report: { labelAr: 'تقرير المبيعات والربحية', labelEn: 'Sales Report', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  expenses_report: { labelAr: 'تقرير المصروفات', labelEn: 'Expenses Report', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  cash_report: { labelAr: 'تقرير حركة الخزينة البنكية', labelEn: 'Cash & Bank Book Report', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  general_ledger_report: { labelAr: 'تقرير دفتر الأستاذ العام', labelEn: 'General Ledger Report', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  trial_balance: { labelAr: 'تقرير ميزان المراجعة', labelEn: 'Trial Balance Report', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  income_statement: { labelAr: 'قائمة الدخل', labelEn: 'Income Statement', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  balance_sheet: { labelAr: 'الميزانية العمومية والمركز المالي', labelEn: 'Balance Sheet', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  stock_card_report: { labelAr: 'تقرير كارت حركة الصنف', labelEn: 'Stock Card Report', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  stock_balances_report: { labelAr: 'تقرير أرصدة المخزون الحالية', labelEn: 'Stock Balances Report', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  general_stock_movements_report: { labelAr: 'تقرير حركات المخازن التفصيلي', labelEn: 'Detailed Stock Movements Report', hasCrud: false, special: ['print', 'export_pdf', 'export_excel'] },
  // Management
  users: { labelAr: 'إدارة المستخدمين والصلاحيات', labelEn: 'Users & Permissions Management', hasCrud: true },
  companies: { labelAr: 'إدارة الشركات والفروع', labelEn: 'Companies & Branches Management', hasCrud: true },
  activity_log: { labelAr: 'سجل النشاط العام', labelEn: 'Activity Log', hasCrud: true },
  audit_logs: { labelAr: 'سجل الرقابة والأمن', labelEn: 'Audit Logs', hasCrud: true },
  system_check: { labelAr: 'فحص سلامة النظام', labelEn: 'System Check', hasCrud: true },
  period_closing: { labelAr: 'إغلاق الفترات المحاسبية', labelEn: 'Period Closing', hasCrud: true, special: ['reopen', 'bulk_close', 'bypass'] },
  // Settings
  company_settings: { labelAr: 'إعدادات الشركة والمالية', labelEn: 'Company & Financial Settings', hasCrud: true, special: ['open_closed_period'] },
  discount_settings: { labelAr: 'إعدادات الخصومات والأسعار', labelEn: 'Discount & Price Settings', hasCrud: true },
  backup_restore: { labelAr: 'النسخ الاحتياطي والاستعادة', labelEn: 'Backup & Restore', hasCrud: true },
  templates: { labelAr: 'قوالب المطبوعات', labelEn: 'Print Templates', hasCrud: true },
  create_template: { labelAr: 'مصمم قوالب المطبوعات', labelEn: 'Print Template Designer', hasCrud: true },
  operation_categories: { labelAr: 'فئات الحسابات الإدارية', labelEn: 'Operation Categories', hasCrud: true },
  operation_fields: { labelAr: 'تعريف الحقول الإضافية', labelEn: 'Custom Operation Fields', hasCrud: true },
  operations: { labelAr: 'حركات الحسابات الإدارية', labelEn: 'Operation Transactions', hasCrud: true }
};

export interface BusinessPermissionMeta {
  id: string;
  labelAr: string;
  labelEn: string;
  type: 'boolean' | 'selection';
  selectionType?: 'warehouses' | 'cash_balances' | 'banks' | 'departments' | 'cost_centers' | 'payment_methods';
  descriptionAr: string;
  descriptionEn: string;
}

export const DOCUMENT_BUSINESS_PERMISSIONS: { [moduleId: string]: BusinessPermissionMeta[] } = {
  invoices: [
    { id: 'change_prices', labelAr: 'تعديل سعر البيع', labelEn: 'Change Sales Price', type: 'boolean', descriptionAr: 'السماح بتعديل سعر بيع الصنف يدويًا أثناء إعداد الفاتورة.', descriptionEn: 'Allows changing selling price in invoices.' },
    { id: 'edit_discount', labelAr: 'تعديل الخصم', labelEn: 'Edit Discount', type: 'boolean', descriptionAr: 'السماح بإضافة أو تعديل خصومات الفاتورة.', descriptionEn: 'Allows editing discount in invoices.' },
    { id: 'override_min_price', labelAr: 'تجاوز الحد الأدنى للسعر', labelEn: 'Override Min Price', type: 'boolean', descriptionAr: 'السماح بالبيع بأقل من السعر الأدنى المحدد للصنف.', descriptionEn: 'Allows selling below minimum product price.' },
    { id: 'edit_tax', labelAr: 'تعديل الضريبة', labelEn: 'Edit Tax', type: 'boolean', descriptionAr: 'السماح بتغيير أو تعديل نسبة الضريبة على الأصناف.', descriptionEn: 'Allows modifying VAT rates in invoices.' },
    { id: 'edit_invoice_date', labelAr: 'تعديل تاريخ الفاتورة', labelEn: 'Edit Invoice Date', type: 'boolean', descriptionAr: 'السماح بتغيير تاريخ الفاتورة يدوياً.', descriptionEn: 'Allows editing invoice date.' },
    { id: 'change_warehouse', labelAr: 'تغيير المخزن', labelEn: 'Change Warehouse', type: 'boolean', descriptionAr: 'السماح بتغيير مخزن الصرف الافتراضي في الفاتورة.', descriptionEn: 'Allows selecting a different source warehouse in invoices.' },
    { id: 'change_salesman', labelAr: 'تغيير مندوب البيع', labelEn: 'Change Salesman', type: 'boolean', descriptionAr: 'السماح بتغيير مندوب البيع المسئول عن الفاتورة.', descriptionEn: 'Allows changing salesperson.' },
    { id: 'change_customer_after_items', labelAr: 'تغيير العميل بعد إضافة الأصناف', labelEn: 'Change Customer After Adding Items', type: 'boolean', descriptionAr: 'السماح بتعديل العميل بعد بدء إضافة الأصناف في الفاتورة.', descriptionEn: 'Allows changing customer after selecting invoice items.' },
    { id: 'view_cost', labelAr: 'رؤية تكلفة الصنف', labelEn: 'View Item Cost', type: 'boolean', descriptionAr: 'عرض تكلفة شراء الصنف داخل الفاتورة.', descriptionEn: 'Allows viewing item cost in invoices.' },
    { id: 'view_profit_margin', labelAr: 'رؤية هامش الربح', labelEn: 'View Profit Margin', type: 'boolean', descriptionAr: 'عرض هامش الربحية والأرباح الإجمالية للفاتورة.', descriptionEn: 'Allows viewing profit margins.' },
    { id: 'edit_cost_price', labelAr: 'تعديل تكلفة الصنف', labelEn: 'Edit Cost Price', type: 'boolean', descriptionAr: 'السماح بتعديل تكلفة الصنف يدوياً.', descriptionEn: 'Allows manual editing of item cost.' },
    { id: 'approve', labelAr: 'اعتماد الفاتورة', labelEn: 'Approve Invoice', type: 'boolean', descriptionAr: 'اعتماد وترحيل الفاتورة مالياً ومخزنياً.', descriptionEn: 'Allows approving/posting invoice.' },
    { id: 'cancel_approval', labelAr: 'إلغاء اعتماد الفاتورة', labelEn: 'Cancel Approval', type: 'boolean', descriptionAr: 'إلغاء ترحيل الفاتورة وإرجاع الحركات.', descriptionEn: 'Allows cancelling invoice approval.' },
    { id: 'print', labelAr: 'طباعة', labelEn: 'Print', type: 'boolean', descriptionAr: 'طباعة الفاتورة أو إرسالها للطابعة.', descriptionEn: 'Allows printing invoice.' },
    { id: 'export_pdf', labelAr: 'تصدير PDF', labelEn: 'Export PDF', type: 'boolean', descriptionAr: 'تصدير الفاتورة كملف PDF.', descriptionEn: 'Allows PDF export.' },
    { id: 'export_excel', labelAr: 'تصدير Excel', labelEn: 'Export Excel', type: 'boolean', descriptionAr: 'تصدير تفاصيل الفاتورة لملف Excel.', descriptionEn: 'Allows Excel export.' },
    { id: 'delete_approved', labelAr: 'حذف بعد الاعتماد', labelEn: 'Delete Approved', type: 'boolean', descriptionAr: 'حذف الفاتورة بعد أن تم اعتمادها وترحيلها.', descriptionEn: 'Allows deleting approved invoice.' },
    { id: 'edit_approved', labelAr: 'تعديل بعد الاعتماد', labelEn: 'Edit Approved', type: 'boolean', descriptionAr: 'تعديل الفاتورة بعد أن تم اعتمادها وترحيلها.', descriptionEn: 'Allows editing approved invoice.' }
  ],
  goods_receipts: [
    { id: 'show_supplier', labelAr: 'إظهار المورد', labelEn: 'Show Supplier', type: 'boolean', descriptionAr: 'عرض المورد وتفاصيله بسند الاستلام.', descriptionEn: 'Allows viewing supplier details.' },
    { id: 'hide_supplier', labelAr: 'إخفاء المورد', labelEn: 'Hide Supplier', type: 'boolean', descriptionAr: 'إخفاء المورد من الشاشة للمستخدم.', descriptionEn: 'Restricts supplier view in goods receipt.' },
    { id: 'edit_supplier', labelAr: 'تعديل المورد', labelEn: 'Edit Supplier', type: 'boolean', descriptionAr: 'السماح بتغيير المورد المختار بالسند.', descriptionEn: 'Allows editing supplier.' },
    { id: 'change_warehouse', labelAr: 'تغيير المخزن', labelEn: 'Change Warehouse', type: 'boolean', descriptionAr: 'السماح بتعديل المخزن المستلم للبضاعة.', descriptionEn: 'Allows selecting receipt warehouse.' },
    { id: 'change_po', labelAr: 'تغيير أمر الشراء', labelEn: 'Change Purchase Order', type: 'boolean', descriptionAr: 'السماح بتغيير أمر الشراء المرتبط بالسند.', descriptionEn: 'Allows altering purchase order linkage.' },
    { id: 'allow_receipt_no_po', labelAr: 'السماح بالاستلام بدون أمر شراء', labelEn: 'Allow Receipt without PO', type: 'boolean', descriptionAr: 'السماح بإنشاء إذن استلام مباشر بدون أمر شراء مسبق.', descriptionEn: 'Allows creating goods receipt directly without PO.' },
    { id: 'allow_partial_receipt', labelAr: 'السماح بالاستلام الجزئي', labelEn: 'Allow Partial Receipt', type: 'boolean', descriptionAr: 'السماح باستلام كمية أقل من كمية أمر الشراء.', descriptionEn: 'Allows receiving partial quantities.' },
    { id: 'edit_received_qty', labelAr: 'تعديل الكميات المستلمة', labelEn: 'Edit Received Quantities', type: 'boolean', descriptionAr: 'السماح بتعديل الكميات يدوياً أثناء الاستلام.', descriptionEn: 'Allows changing receipt quantity.' },
    { id: 'edit_cost', labelAr: 'تعديل التكلفة', labelEn: 'Edit Cost', type: 'boolean', descriptionAr: 'السماح بتعديل تكلفة الصنف يدوياً بسند الاستلام.', descriptionEn: 'Allows modifying unit cost during receipt.' },
    { id: 'approve', labelAr: 'اعتماد سند الاستلام', labelEn: 'Approve Receipt', type: 'boolean', descriptionAr: 'اعتماد وترحيل السند لتحديث المخزون.', descriptionEn: 'Allows approving goods receipt.' },
    { id: 'cancel_approval', labelAr: 'إلغاء الاعتماد', labelEn: 'Cancel Approval', type: 'boolean', descriptionAr: 'إلغاء اعتماد السند وعكس الكميات المخزنية.', descriptionEn: 'Allows reversing goods receipt approval.' }
  ],
  purchase_invoices: [
    { id: 'edit_prices', labelAr: 'تعديل الأسعار', labelEn: 'Edit Prices', type: 'boolean', descriptionAr: 'السماح بتعديل أسعار الشراء يدوياً في الفاتورة.', descriptionEn: 'Allows modifying purchase prices.' },
    { id: 'edit_taxes', labelAr: 'تعديل الضرائب', labelEn: 'Edit Taxes', type: 'boolean', descriptionAr: 'السماح بتعديل نسب أو مبالغ الضريبة في فاتورة المشتريات.', descriptionEn: 'Allows modifying VAT.' },
    { id: 'edit_discounts', labelAr: 'تعديل الخصومات', labelEn: 'Edit Discounts', type: 'boolean', descriptionAr: 'السماح بتعديل الخصومات المقدمة من المورد.', descriptionEn: 'Allows modifying purchase discount.' },
    { id: 'change_supplier', labelAr: 'تغيير المورد', labelEn: 'Change Supplier', type: 'boolean', descriptionAr: 'السماح بتعديل المورد بعد بدء إضافة البيانات.', descriptionEn: 'Allows altering supplier.' },
    { id: 'create_direct_invoice', labelAr: 'إنشاء فاتورة مباشرة', labelEn: 'Create Direct Invoice', type: 'boolean', descriptionAr: 'السماح بإنشاء فاتورة مشتريات مباشرة دون إذن استلام.', descriptionEn: 'Allows creating purchase invoice directly without GR.' },
    { id: 'create_invoice_from_gr_only', labelAr: 'إنشاء فاتورة من سند استلام فقط', labelEn: 'Create Invoice from GR Only', type: 'boolean', descriptionAr: 'تقييد المستخدم بحيث لا يمكنه إنشاء فاتورة إلا بالتحويل من سند استلام.', descriptionEn: 'Forces creation from GR only.' },
    { id: 'link_invoice_to_gr', labelAr: 'ربط الفاتورة بسند الاستلام', labelEn: 'Link Invoice to GR', type: 'boolean', descriptionAr: 'السماح بربط الفاتورة يدوياً بسندات الاستلام المفتوحة.', descriptionEn: 'Allows linking invoice to GR.' },
    { id: 'edit_approved', labelAr: 'تعديل بعد الاعتماد', labelEn: 'Edit Approved', type: 'boolean', descriptionAr: 'السماح بتعديل فاتورة المشتريات المعتمدة.', descriptionEn: 'Allows editing approved invoice.' },
    { id: 'delete_approved', labelAr: 'حذف بعد الاعتماد', labelEn: 'Delete Approved', type: 'boolean', descriptionAr: 'السماح بحذف فاتورة المشتريات المعتمدة.', descriptionEn: 'Allows deleting approved invoice.' }
  ],
  warehouses: [
    { id: 'restrict_warehouses', labelAr: 'تقييد المستخدم بمستودعات محددة', labelEn: 'Restrict Warehouses', type: 'selection', selectionType: 'warehouses', descriptionAr: 'تحديد المستودعات المسموح للمستخدم رؤيتها والتعامل معها.', descriptionEn: 'Limits user access to specific warehouses.' }
  ],
  cash_balances: [
    { id: 'restrict_safes', labelAr: 'تقييد المستخدم بخزائن محددة', labelEn: 'Restrict Cash Safes', type: 'selection', selectionType: 'cash_balances', descriptionAr: 'تحديد الخزائن النقدية المسموح للمستخدم التعامل معها.', descriptionEn: 'Limits user access to specific safes.' }
  ],
  accounts: [
    { id: 'restrict_banks', labelAr: 'تقييد المستخدم بحسابات بنكية محددة', labelEn: 'Restrict Bank Accounts', type: 'selection', selectionType: 'banks', descriptionAr: 'تحديد الحسابات البنكية المسموح للمستخدم إيداع أو صرف الأموال منها.', descriptionEn: 'Limits user access to specific bank accounts.' }
  ],
  departments: [
    { id: 'restrict_departments', labelAr: 'تقييد المستخدم بإدارات محددة', labelEn: 'Restrict Departments', type: 'selection', selectionType: 'departments', descriptionAr: 'تحديد الإدارات المسموح للمستخدم رؤيتها والتعامل معها.', descriptionEn: 'Limits user access to specific departments.' }
  ],
  cost_centers: [
    { id: 'restrict_cost_centers', labelAr: 'تقييد المستخدم بمراكز تكلفة محددة', labelEn: 'Restrict Cost Centers', type: 'selection', selectionType: 'cost_centers', descriptionAr: 'تحديد مراكز التكلفة المسموح للمستخدم رؤيتها والتعامل معها.', descriptionEn: 'Limits user access to specific cost centers.' }
  ],
  payment_methods: [
    { id: 'restrict_payment_methods', labelAr: 'تقييد المستخدم بطرق سداد محددة', labelEn: 'Restrict Payment Methods', type: 'selection', selectionType: 'payment_methods', descriptionAr: 'تحديد طرق السداد المسموح للمستخدم رؤيتها والتعامل معها.', descriptionEn: 'Limits user access to specific payment methods.' }
  ],
  journal_entries: [
    { id: 'create', labelAr: 'إنشاء قيد', labelEn: 'Create Entry', type: 'boolean', descriptionAr: 'السماح بإنشاء قيود يومية جديدة.', descriptionEn: 'Allows creating journal entries.' },
    { id: 'edit', labelAr: 'تعديل قيد', labelEn: 'Edit Entry', type: 'boolean', descriptionAr: 'السماح بتعديل قيود اليومية غير المعتمدة.', descriptionEn: 'Allows editing journal entries.' },
    { id: 'delete', labelAr: 'حذف قيد', labelEn: 'Delete Entry', type: 'boolean', descriptionAr: 'السماح بحذف قيود اليومية غير المعتمدة.', descriptionEn: 'Allows deleting journal entries.' },
    { id: 'approve', labelAr: 'اعتماد قيد', labelEn: 'Approve Entry', type: 'boolean', descriptionAr: 'اعتماد وترحيل قيود اليومية.', descriptionEn: 'Allows approving journal entries.' },
    { id: 'cancel_approval', labelAr: 'إلغاء اعتماد قيد', labelEn: 'Cancel Approval', type: 'boolean', descriptionAr: 'إلغاء ترحيل قيود اليومية للتحسين.', descriptionEn: 'Allows reversing journal entry approval.' }
  ]
};
