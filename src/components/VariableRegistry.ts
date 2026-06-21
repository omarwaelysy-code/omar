export interface SystemVariable {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: 'company' | 'branch' | 'user' | 'customer' | 'supplier' | 'employee' | 'document' | 'totals' | 'taxes' | 'currency' | 'datetime' | 'operation';
  dataType: 'string' | 'number' | 'date' | 'time' | 'image' | 'boolean';
  section: 'header' | 'details' | 'footer' | 'any';
}

export const VARIABLE_REGISTRY: SystemVariable[] = [
  // Company
  { key: 'company_name', nameAr: 'اسم الشركة', nameEn: 'Company Name', descriptionAr: 'اسم الشركة الحالية', descriptionEn: 'Current company name', category: 'company', dataType: 'string', section: 'header' },
  { key: 'company_logo', nameAr: 'شعار الشركة', nameEn: 'Company Logo', descriptionAr: 'شعار الشركة', descriptionEn: 'Company logo image URL', category: 'company', dataType: 'image', section: 'header' },
  { key: 'company_tax_number', nameAr: 'الرقم الضريبي للشركة', nameEn: 'Company Tax Number', descriptionAr: 'الرقم الضريبي للشركة', descriptionEn: 'Company tax registration number', category: 'company', dataType: 'string', section: 'header' },
  { key: 'company_commercial_register', nameAr: 'السجل التجاري للشركة', nameEn: 'Company Commercial Register', descriptionAr: 'رقم السجل التجاري للشركة', descriptionEn: 'Company commercial registry number', category: 'company', dataType: 'string', section: 'header' },
  { key: 'company_address', nameAr: 'عنوان الشركة', nameEn: 'Company Address', descriptionAr: 'عنوان الشركة', descriptionEn: 'Company address', category: 'company', dataType: 'string', section: 'header' },
  { key: 'company_phone', nameAr: 'هاتف الشركة', nameEn: 'Company Phone', descriptionAr: 'هاتف الشركة', descriptionEn: 'Company phone number', category: 'company', dataType: 'string', section: 'header' },
  { key: 'company_email', nameAr: 'بريد الشركة الإلكتروني', nameEn: 'Company Email', descriptionAr: 'بريد الشركة الإلكتروني', descriptionEn: 'Company email address', category: 'company', dataType: 'string', section: 'header' },

  // Branch
  { key: 'branch_name', nameAr: 'اسم الفرع', nameEn: 'Branch Name', descriptionAr: 'اسم الفرع المصدر للمستند', descriptionEn: 'Branch name', category: 'branch', dataType: 'string', section: 'header' },

  // User
  { key: 'user_name', nameAr: 'المستخدم الحالي', nameEn: 'Current User', descriptionAr: 'اسم المستخدم الذي قام بالطباعة أو الإنشاء', descriptionEn: 'User who created/printed the document', category: 'user', dataType: 'string', section: 'any' },

  // Customer
  { key: 'customer_name', nameAr: 'اسم العميل', nameEn: 'Customer Name', descriptionAr: 'اسم العميل المرتبط بالمستند', descriptionEn: 'Customer name', category: 'customer', dataType: 'string', section: 'header' },
  { key: 'customer_tax_number', nameAr: 'الرقم الضريبي للعميل', nameEn: 'Customer Tax Number', descriptionAr: 'الرقم الضريبي للعميل', descriptionEn: 'Customer tax registration number', category: 'customer', dataType: 'string', section: 'header' },
  { key: 'customer_phone', nameAr: 'هاتف العميل', nameEn: 'Customer Phone', descriptionAr: 'هاتف العميل', descriptionEn: 'Customer phone number', category: 'customer', dataType: 'string', section: 'header' },
  { key: 'customer_address', nameAr: 'عنوان العميل', nameEn: 'Customer Address', descriptionAr: 'عنوان العميل', descriptionEn: 'Customer address', category: 'customer', dataType: 'string', section: 'header' },

  // Supplier
  { key: 'supplier_name', nameAr: 'اسم المورد', nameEn: 'Supplier Name', descriptionAr: 'اسم المورد المرتبط بالمستند', descriptionEn: 'Supplier name', category: 'supplier', dataType: 'string', section: 'header' },
  { key: 'supplier_tax_number', nameAr: 'الرقم الضريبي للمورد', nameEn: 'Supplier Tax Number', descriptionAr: 'الرقم الضريبي للمورد', descriptionEn: 'Supplier tax registration number', category: 'supplier', dataType: 'string', section: 'header' },
  { key: 'supplier_phone', nameAr: 'هاتف المورد', nameEn: 'Supplier Phone', descriptionAr: 'هاتف المورد', descriptionEn: 'Supplier phone number', category: 'supplier', dataType: 'string', section: 'header' },
  { key: 'supplier_address', nameAr: 'عنوان المورد', nameEn: 'Supplier Address', descriptionAr: 'عنوان المورد', descriptionEn: 'Supplier address', category: 'supplier', dataType: 'string', section: 'header' },

  // Employee
  { key: 'employee_name', nameAr: 'اسم الموظف', nameEn: 'Employee Name', descriptionAr: 'اسم الموظف المسؤول', descriptionEn: 'Responsible employee name', category: 'employee', dataType: 'string', section: 'any' },

  // Document
  { key: 'document_number', nameAr: 'رقم المستند', nameEn: 'Document Number', descriptionAr: 'رقم المستند/الفاتورة/السند الحالي', descriptionEn: 'Unique document reference number', category: 'document', dataType: 'string', section: 'header' },
  { key: 'document_notes', nameAr: 'ملاحظات المستند', nameEn: 'Document Notes', descriptionAr: 'الملاحظات المكتوبة داخل المستند', descriptionEn: 'Document notes or terms', category: 'document', dataType: 'string', section: 'footer' },
  { key: 'payment_method', nameAr: 'طريقة الدفع', nameEn: 'Payment Method', descriptionAr: 'طريقة الدفع (نقدي، آجل، شبكة)', descriptionEn: 'Payment method description', category: 'document', dataType: 'string', section: 'header' },
  { key: 'due_date', nameAr: 'تاريخ الاستحقاق', nameEn: 'Due Date', descriptionAr: 'تاريخ استحقاق المستند إن وجد', descriptionEn: 'Document due date', category: 'document', dataType: 'date', section: 'header' },

  // Totals
  { key: 'subtotal', nameAr: 'الإجمالي الفرعي', nameEn: 'Subtotal', descriptionAr: 'المجموع قبل الضرائب والخصم', descriptionEn: 'Total before taxes and discounts', category: 'totals', dataType: 'number', section: 'footer' },
  { key: 'discount_amount', nameAr: 'إجمالي الخصم', nameEn: 'Discount Amount', descriptionAr: 'إجمالي قيمة الخصم الممنوح', descriptionEn: 'Total discount amount', category: 'totals', dataType: 'number', section: 'footer' },
  { key: 'vat_amount', nameAr: 'ضريبة القيمة المضافة', nameEn: 'VAT Amount', descriptionAr: 'إجمالي قيمة ضريبة القيمة المضافة', descriptionEn: 'Total value added tax', category: 'totals', dataType: 'number', section: 'footer' },
  { key: 'net_total', nameAr: 'الإجمالي النهائي', nameEn: 'Net Total', descriptionAr: 'الصافي النهائي المطلوب دفعه', descriptionEn: 'Final net amount to pay', category: 'totals', dataType: 'number', section: 'footer' },
  { key: 'paid_amount', nameAr: 'المبلغ المدفوع', nameEn: 'Paid Amount', descriptionAr: 'المبلغ المدفوع من الفاتورة', descriptionEn: 'Paid amount', category: 'totals', dataType: 'number', section: 'footer' },
  { key: 'remaining_amount', nameAr: 'المبلغ المتبقي', nameEn: 'Remaining Amount', descriptionAr: 'المتبقي المستحق من الفاتورة', descriptionEn: 'Remaining amount', category: 'totals', dataType: 'number', section: 'footer' },

  // Taxes
  { key: 'tax_rate', nameAr: 'نسبة الضريبة الافتراضية', nameEn: 'Default Tax Rate', descriptionAr: 'النسبة الضريبية الافتراضية بالشركة', descriptionEn: 'Default tax percentage', category: 'taxes', dataType: 'number', section: 'any' },

  // Currency
  { key: 'currency_code', nameAr: 'رمز العملة', nameEn: 'Currency Code', descriptionAr: 'رمز العملة المستخدمة (SAR, EGP)', descriptionEn: 'Currency code (e.g. SAR)', category: 'currency', dataType: 'string', section: 'any' },

  // Date & Time
  { key: 'date', nameAr: 'تاريخ المستند', nameEn: 'Document Date', descriptionAr: 'تاريخ إنشاء المستند', descriptionEn: 'Document date', category: 'datetime', dataType: 'date', section: 'any' },
  { key: 'time', nameAr: 'وقت المستند', nameEn: 'Document Time', descriptionAr: 'وقت إنشاء المستند', descriptionEn: 'Document time', category: 'datetime', dataType: 'time', section: 'any' },
  { key: 'current_date', nameAr: 'التاريخ الحالي للطباعة', nameEn: 'Current Date', descriptionAr: 'تاريخ وقت الطباعة الفعلي', descriptionEn: 'Actual print date', category: 'datetime', dataType: 'date', section: 'any' },
  { key: 'current_time', nameAr: 'الوقت الحالي للطباعة', nameEn: 'Current Time', descriptionAr: 'وقت الطباعة الفعلي', descriptionEn: 'Actual print time', category: 'datetime', dataType: 'time', section: 'any' },

  // Operation
  { key: 'operation_number', nameAr: 'رقم التشغيل', nameEn: 'Operation Number', descriptionAr: 'رقم عملية التشغيل إن وجدت', descriptionEn: 'Operation reference number', category: 'operation', dataType: 'string', section: 'header' },
  { key: 'department_name', nameAr: 'اسم القسم', nameEn: 'Department Name', descriptionAr: 'اسم القسم المرتبط بالعملية', descriptionEn: 'Associated department name', category: 'operation', dataType: 'string', section: 'header' },
  { key: 'cost_center_name', nameAr: 'اسم مركز التكلفة', nameEn: 'Cost Center Name', descriptionAr: 'اسم مركز التكلفة المرتبط بالعملية', descriptionEn: 'Associated cost center name', category: 'operation', dataType: 'string', section: 'header' },
];

export const getRegistryVariablesByCategory = (cat: SystemVariable['category']) => {
  return VARIABLE_REGISTRY.filter(v => v.category === cat);
};
