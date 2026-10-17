import { Router } from 'express';
import * as XLSX from 'xlsx';
import { authenticateToken, AuthRequest } from './auth-middleware';
import pool from './postgres';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { ensureUniqueSequenceNumber } from './erp-api';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ================================================================
// IMPORT TEMPLATES CONFIG
// ================================================================
// NOTE: columns with type 'account_code' are resolved in validation
// from account.code → account.id  (and account.name stored too)
// ================================================================
const IMPORT_CONFIGS: Record<string, {
  nameAr: string;
  columns: { key: string; label: string; labelEn: string; required: boolean; type: string; options?: string[]; example?: string; note?: string }[];
  dbTable: string;
  uniqueKey?: string;
}> = {

  // ── العملاء ────────────────────────────────────────────────────
  customers: {
    nameAr: 'العملاء',
    dbTable: 'customers',
    uniqueKey: 'code',
    columns: [
      // تعريف العميل
      { key: 'code',                  label: 'كود العميل *',                   labelEn: 'Customer Code (Required, unique)',         required: true,  type: 'text',         example: 'CUST-001' },
      { key: 'manual_code',           label: 'كود يدوي',                       labelEn: 'Manual Code (Optional)',                   required: false, type: 'text',         example: '8880' },
      { key: 'name',                  label: 'اسم العميل *',                    labelEn: 'Customer Name (Required)',                 required: true,  type: 'text',         example: 'شركة ABC للتجارة' },
      { key: 'mobile',                label: 'رقم الجوال',                      labelEn: 'Mobile Number',                           required: false, type: 'text',         example: '0501234567' },
      { key: 'email',                 label: 'البريد الإلكتروني',               labelEn: 'Email',                                   required: false, type: 'text',         example: 'info@abc.com' },
      { key: 'address',               label: 'العنوان',                         labelEn: 'Address',                                 required: false, type: 'text',         example: 'الرياض، السعودية' },
      { key: 'tax_number',            label: 'الرقم الضريبي',                   labelEn: 'Tax Number (VAT)',                        required: false, type: 'text',         example: '300123456789' },
      // الحساب المحاسبي
      { key: 'account_code',          label: 'كود حساب العميل *',               labelEn: 'Customer Account Code (Required) e.g. 111',  required: true,  type: 'account_code', example: '111', note: 'يجب أن يكون كوداً حسابياً موجوداً في النظام' },
      { key: 'counter_account_code',  label: 'كود حساب مقابل الرصيد الافتتاحي', labelEn: 'Counter Account Code for Opening Balance e.g. 31', required: false, type: 'account_code', example: '31', note: 'حساب المقابل عند إضافة رصيد افتتاحي' },
      // الرصيد الافتتاحي
      { key: 'opening_balance',       label: 'الرصيد الافتتاحي',                labelEn: 'Opening Balance (positive = debit)',       required: false, type: 'number',       example: '5000' },
      { key: 'opening_balance_date',  label: 'تاريخ الرصيد الافتتاحي',          labelEn: 'Opening Balance Date (YYYY-MM-DD)',        required: false, type: 'date',         example: '2025-01-01' },
      // شروط الائتمان
      { key: 'credit_limit',         label: 'حد الائتمان',                     labelEn: 'Credit Limit',                            required: false, type: 'number',       example: '50000' },
      { key: 'payment_terms',        label: 'شروط الدفع',                      labelEn: 'Payment Terms',                           required: false, type: 'select',       options: ['cash', 'credit'],  example: 'credit' },
      { key: 'payment_terms_days',   label: 'أيام الدفع الآجل',                labelEn: 'Payment Terms Days (if credit)',           required: false, type: 'number',       example: '30' },
      { key: 'advance_percentage',   label: 'نسبة الدفع المقدم %',             labelEn: 'Advance Payment Percentage',              required: false, type: 'number',       example: '0' },
    ]
  },

  // ── الموردين ────────────────────────────────────────────────────
  suppliers: {
    nameAr: 'الموردين',
    dbTable: 'suppliers',
    uniqueKey: 'code',
    columns: [
      { key: 'code',                  label: 'كود المورد *',                    labelEn: 'Supplier Code (Required, unique)',         required: true,  type: 'text',         example: 'SUPP-001' },
      { key: 'manual_code',           label: 'كود يدوي',                       labelEn: 'Manual Code (Optional)',                   required: false, type: 'text',         example: '7770' },
      { key: 'name',                  label: 'اسم المورد *',                     labelEn: 'Supplier Name (Required)',                 required: true,  type: 'text',         example: 'شركة XYZ للتوريد' },
      { key: 'mobile',                label: 'رقم الجوال',                       labelEn: 'Mobile Number',                           required: false, type: 'text',         example: '0501234567' },
      { key: 'email',                 label: 'البريد الإلكتروني',                labelEn: 'Email',                                   required: false, type: 'text',         example: 'info@xyz.com' },
      { key: 'address',               label: 'العنوان',                          labelEn: 'Address',                                 required: false, type: 'text',         example: 'جدة، السعودية' },
      { key: 'tax_number',            label: 'الرقم الضريبي',                    labelEn: 'Tax Number (VAT)',                        required: false, type: 'text',         example: '300987654321' },
      { key: 'account_code',          label: 'كود حساب المورد *',                labelEn: 'Supplier Account Code (Required) e.g. 211', required: true,  type: 'account_code', example: '211', note: 'يجب أن يكون كوداً حسابياً موجوداً في النظام' },
      { key: 'counter_account_code',  label: 'كود حساب مقابل الرصيد الافتتاحي', labelEn: 'Counter Account Code for Opening Balance e.g. 31', required: false, type: 'account_code', example: '31' },
      { key: 'opening_balance',       label: 'الرصيد الافتتاحي',                 labelEn: 'Opening Balance (positive = credit)',      required: false, type: 'number',       example: '10000' },
      { key: 'opening_balance_date',  label: 'تاريخ الرصيد الافتتاحي',           labelEn: 'Opening Balance Date (YYYY-MM-DD)',        required: false, type: 'date',         example: '2025-01-01' },
      { key: 'credit_limit',         label: 'حد الائتمان',                      labelEn: 'Credit Limit',                            required: false, type: 'number',       example: '100000' },
      { key: 'payment_terms',        label: 'شروط الدفع',                       labelEn: 'Payment Terms',                           required: false, type: 'select',       options: ['cash', 'credit'], example: 'credit' },
      { key: 'payment_terms_days',   label: 'أيام الدفع الآجل',                 labelEn: 'Payment Terms Days (if credit)',           required: false, type: 'number',       example: '60' },
      { key: 'advance_percentage',   label: 'نسبة الدفع المقدم %',              labelEn: 'Advance Payment Percentage',              required: false, type: 'number',       example: '0' },
    ]
  },

  // ── الموظفين ────────────────────────────────────────────────────
  employees: {
    nameAr: 'الموظفين',
    dbTable: 'employees',
    uniqueKey: 'employee_code',
    columns: [
      { key: 'employee_code',         label: 'كود الموظف *',                    labelEn: 'Employee Code (Required)',                 required: true,  type: 'text',         example: 'EMP-001' },
      { key: 'name',                  label: 'اسم الموظف *',                     labelEn: 'Employee Name (Required)',                 required: true,  type: 'text',         example: 'أحمد محمد علي' },
      { key: 'job_title',             label: 'المسمى الوظيفي',                   labelEn: 'Job Title',                               required: false, type: 'text',         example: 'مدير مبيعات' },
      { key: 'nationality',           label: 'الجنسية',                          labelEn: 'Nationality',                             required: false, type: 'text',         example: 'سعودي' },
      { key: 'national_id',           label: 'رقم الهوية',                       labelEn: 'National ID',                             required: false, type: 'text',         example: '1234567890' },
      { key: 'gender',                label: 'الجنس',                            labelEn: 'Gender',                                  required: false, type: 'select',       options: ['male', 'female'], example: 'male' },
      { key: 'marital_status',        label: 'الحالة الاجتماعية',                labelEn: 'Marital Status',                          required: false, type: 'select',       options: ['single', 'married', 'divorced', 'widowed'], example: 'married' },
      { key: 'birth_date',            label: 'تاريخ الميلاد',                    labelEn: 'Birth Date (YYYY-MM-DD)',                  required: false, type: 'date',         example: '1990-05-15' },
      { key: 'hire_date',             label: 'تاريخ التعيين *',                  labelEn: 'Hire Date (YYYY-MM-DD, Required)',         required: true,  type: 'date',         example: '2025-01-01' },
      { key: 'contract_type',         label: 'نوع العقد',                        labelEn: 'Contract Type',                           required: false, type: 'select',       options: ['full_time', 'part_time', 'temporary', 'contract'], example: 'full_time' },
      { key: 'contract_expiry_date',  label: 'تاريخ انتهاء العقد',               labelEn: 'Contract Expiry Date (YYYY-MM-DD)',        required: false, type: 'date',         example: '2026-12-31' },
    ]
  },

  // ── طرق السداد ─────────────────────────────────────────────────
  payment_methods: {
    nameAr: 'طرق السداد',
    dbTable: 'payment_methods',
    uniqueKey: 'name',
    columns: [
      { key: 'name',          label: 'اسم طريقة السداد *',    labelEn: 'Payment Method Name (Required)',           required: true,  type: 'text',         example: 'صندوق الرئيسي' },
      { key: 'type',          label: 'النوع *',                labelEn: 'Type: cash | bank | wallet',              required: true,  type: 'select',       options: ['cash', 'bank', 'wallet'], example: 'cash' },
      { key: 'account_code',  label: 'كود الحساب المرتبط *',  labelEn: 'Linked Account Code (Required) e.g. 101', required: true,  type: 'account_code', example: '101', note: 'كود الصندوق أو الحساب البنكي المرتبط بهذه الطريقة' },
      { key: 'account_number',label: 'رقم الحساب البنكي',      labelEn: 'Bank Account Number (for bank type)',     required: false, type: 'text',         example: 'SA1234567890' },
      { key: 'bank_name',     label: 'اسم البنك',              labelEn: 'Bank Name (for bank type)',               required: false, type: 'text',         example: 'بنك الأهلي' },
      { key: 'description',   label: 'الوصف',                  labelEn: 'Description',                             required: false, type: 'text',         example: 'الصندوق الرئيسي للمقر' },
    ]
  },

  // ── بنود المصروفات ──────────────────────────────────────────────
  expense_categories: {
    nameAr: 'بنود المصروفات',
    dbTable: 'expense_categories',
    uniqueKey: 'code',
    columns: [
      { key: 'code',         label: 'كود البند *',           labelEn: 'Category Code (Required, unique)', required: true,  type: 'text',         example: 'EXP-001' },
      { key: 'name',         label: 'اسم البند *',           labelEn: 'Category Name (Required)',         required: true,  type: 'text',         example: 'مصاريف إيجار' },
      { key: 'account_code', label: 'كود الحساب المرتبط *', labelEn: 'Linked Account Code (Required)',    required: true,  type: 'account_code', example: '511', note: 'كود حساب المصروف في شجرة الحسابات' },
      { key: 'description',  label: 'الوصف',                 labelEn: 'Description',                      required: false, type: 'text',         example: 'مصروفات الإيجار الشهري للمقر' },
    ]
  },

  // ── مجموعات الأصناف ─────────────────────────────────────────────
  item_groups: {
    nameAr: 'مجموعات الأصناف',
    dbTable: 'item_groups',
    uniqueKey: 'code',
    columns: [
      { key: 'code',          label: 'كود المجموعة *',   labelEn: 'Group Code (Required, unique)',            required: true,  type: 'text',   example: 'GRP-001' },
      { key: 'name',          label: 'اسم المجموعة *',   labelEn: 'Group Name (Required)',                    required: true,  type: 'text',   example: 'إلكترونيات' },
      { key: 'type',          label: 'نوع المجموعة',     labelEn: 'Group Type',                              required: false, type: 'select', options: ['finished_product', 'service', 'raw_material', 'commodity'], example: 'finished_product' },
      { key: 'description',   label: 'الوصف',             labelEn: 'Description',                             required: false, type: 'text',   example: 'مجموعة الأجهزة الإلكترونية' },
    ]
  },

  // ── الأصناف ─────────────────────────────────────────────────────
  products: {
    nameAr: 'الأصناف',
    dbTable: 'products',
    uniqueKey: 'code',
    columns: [
      // تعريف الصنف
      { key: 'code',                    label: 'كود الصنف *',                       labelEn: 'Product Code (Required, unique)',                    required: true,  type: 'text',         example: 'PROD-001' },
      { key: 'manual_code',             label: 'كود يدوي',                          labelEn: 'Manual Code (Optional)',                             required: false, type: 'text',         example: '5550' },
      { key: 'name',                    label: 'اسم الصنف *',                        labelEn: 'Product Name (Required)',                            required: true,  type: 'text',         example: 'لابتوب HP Core i7' },
      { key: 'type',                    label: 'نوع الصنف *',                        labelEn: 'Product Type (Required)',                            required: true,  type: 'select',       options: ['product', 'service', 'raw_material', 'semi_finished'], example: 'product' },
      { key: 'barcode',                 label: 'الباركود',                           labelEn: 'Barcode (optional)',                                 required: false, type: 'text',         example: '6281234567890' },
      { key: 'unit',                    label: 'وحدة القياس',                        labelEn: 'Unit of Measure',                                   required: false, type: 'text',         example: 'قطعة' },
      { key: 'description',             label: 'الوصف',                              labelEn: 'Description',                                       required: false, type: 'text',         example: 'لابتوب HP مواصفات عالية' },
      // الأسعار
      { key: 'sale_price',              label: 'سعر البيع *',                        labelEn: 'Sale Price (Required)',                              required: true,  type: 'number',       example: '1500' },
      { key: 'cost_price',              label: 'سعر التكلفة',                        labelEn: 'Cost Price',                                        required: false, type: 'number',       example: '1200' },
      { key: 'min_stock',               label: 'الحد الأدنى للمخزون',                labelEn: 'Minimum Stock Alert Level',                         required: false, type: 'number',       example: '5' },
      // الإعدادات المحاسبية - حسابات
      { key: 'revenue_account_code',        label: 'كود حساب الإيرادات *',                    labelEn: 'Revenue Account Code (Required) e.g. 41',           required: true,  type: 'account_code', example: '41',   note: 'حساب المبيعات/الإيرادات المرتبط بهذا الصنف' },
      { key: 'cost_account_code',           label: 'كود حساب التكلفة *',                      labelEn: 'Cost of Goods Account Code (Required) e.g. 51',     required: true,  type: 'account_code', example: '51',   note: 'حساب تكلفة البضاعة المباعة' },
      { key: 'inventory_account_code',      label: 'كود حساب المخزون',                        labelEn: 'Inventory Account Code e.g. 1115',                  required: false, type: 'account_code', example: '1115', note: 'حساب المخزون (للأصناف المخزنية فقط)' },
      { key: 'sales_vat_account_code',      label: 'كود حساب ضريبة القيمة المضافة (مبيعات)',  labelEn: 'Sales VAT Account Code (e.g. 2221)',                required: false, type: 'account_code', example: '2221', note: 'حساب ضريبة القيمة المضافة (مخرجات)' },
      { key: 'purchase_vat_account_code',   label: 'كود حساب ضريبة القيمة المضافة (مشتريات)', labelEn: 'Purchase VAT Account Code (e.g. 1181)',             required: false, type: 'account_code', example: '1181', note: 'حساب ضريبة القيمة المضافة (مدخلات)' },
      { key: 'vat_account_code',            label: 'كود حساب الضريبة (عام)',                  labelEn: 'General VAT Account Code',                          required: false, type: 'account_code', example: '2221', note: 'حساب الضريبة العام' },
      // إعدادات الضريبة والمخزون
      { key: 'vat_rate',                    label: 'نسبة الضريبة %',                          labelEn: 'VAT Rate % (e.g. 14)',                              required: false, type: 'number',       example: '14' },
      { key: 'inventory_cost_method',       label: 'طريقة تكلفة المخزون',                     labelEn: 'Inventory Costing Method',                          required: false, type: 'select',       options: ['WAC', 'FIFO', 'LIFO'], example: 'WAC' },
      // منظومة الفاتورة الإلكترونية ETA
      { key: 'eta_item_code',               label: 'كود الصنف الإلكتروني (ETA مبيعات)',       labelEn: 'ETA Sales Item Code',                               required: false, type: 'text',         example: 'EG-123456789-PROD01' },
      { key: 'eta_code_type',               label: 'نوع كود ETA مبيعات',                      labelEn: 'ETA Sales Code Type (EGS / GS1)',                   required: false, type: 'select',       options: ['EGS', 'GS1', 'GPC', 'OTHER'], example: 'EGS' },
      { key: 'tax_item_code',               label: 'كود ربط المشتريات (ETA وارد)',            labelEn: 'ETA Received Item Code',                            required: false, type: 'text',         example: 'EG-987654321-MAT01' },
      { key: 'tax_code_type',               label: 'نوع كود ETA مشتريات',                     labelEn: 'ETA Received Code Type (EGS / GS1)',                required: false, type: 'select',       options: ['EGS', 'GS1', 'GPC', 'OTHER'], example: 'EGS' },
      // الحالة والمجموعة
      { key: 'is_active',                   label: 'حالة النشاط',                             labelEn: 'Active Status (نشط / غير نشط)',                     required: false, type: 'text',         example: 'نشط' },
      { key: 'item_group_code',             label: 'كود مجموعة الأصناف',                      labelEn: 'Item Group Code (must match existing group code)',   required: false, type: 'text',         example: 'GRP-001' },
      // الصورة
      { key: 'image_url',                   label: 'رابط صورة الصنف (URL)',                   labelEn: 'Product Image URL (optional, paste a public image link)', required: false, type: 'text',   example: 'https://example.com/product.jpg', note: 'ارفع الصورة على الإنترنت ثم الصق الرابط هنا' },
    ]
  },

  // ── قيود اليومية ─────────────────────────────────────────────────
  journal_entries: {
    nameAr: 'قيود اليومية',
    dbTable: 'journal_entries',
    uniqueKey: 'reference_number',
    columns: [
      { key: 'reference_number', label: 'رقم المرجع *',           labelEn: 'Reference Number (Required, e.g. Ref-000001)', required: true,  type: 'text',         example: 'Ref-000001', note: 'كود يجمع أسطر القيد الواحد مثل Ref-000001' },
      { key: 'date',             label: 'تاريخ القيد *',          labelEn: 'Entry Date (YYYY-MM-DD, Required)',            required: true,  type: 'date',         example: '2026-10-17', note: 'تاريخ القيد بصيغة YYYY-MM-DD' },
      { key: 'description',      label: 'البيان العام للقيد',      labelEn: 'General Description',                          required: false, type: 'text',         example: 'قيد رواتب وتسويات' },
      { key: 'account_code',     label: 'كود الحساب *',            labelEn: 'Account Code (Required, e.g. 111)',            required: true,  type: 'account_code', example: '111',        note: 'كود الحساب بدليل الحسابات' },
      { key: 'sub_account_code', label: 'كود / اسم الحساب الفرعي',   labelEn: 'Sub-Account Code or Name (Required if account requires sub-account)', required: false, type: 'text', example: 'CUST-001', note: 'إجباري إذا كان الحساب يلزم له حساب فرعي (كود أو اسم العميل/المورد/الخزينة)' },
      { key: 'sub_account_type', label: 'نوع الحساب الفرعي',       labelEn: 'Sub-Account Type (customer | supplier | payment_method)', required: false, type: 'select', options: ['customer', 'supplier', 'payment_method'], example: 'customer' },
      { key: 'debit',            label: 'مدين',                    labelEn: 'Debit Amount',                                 required: false, type: 'number',       example: '1000' },
      { key: 'credit',           label: 'دائن',                    labelEn: 'Credit Amount',                                required: false, type: 'number',       example: '0' },
      { key: 'currency',         label: 'العملة',                  labelEn: 'Currency Code (e.g. EGP, USD, or blank for local)', required: false, type: 'text',   example: 'local' },
      { key: 'exchange_rate',    label: 'سعر الصرف',               labelEn: 'Exchange Rate (default 1)',                    required: false, type: 'number',       example: '1' },
      { key: 'foreign_amount',   label: 'المبلغ بالعملة الأجنبية',   labelEn: 'Foreign Amount',                               required: false, type: 'number',       example: '0' },
      { key: 'operation_number', label: 'رقم العملية',             labelEn: 'Operation Number',                             required: false, type: 'text',         example: 'OP-001' },
      { key: 'cost_center_code', label: 'كود مركز التكلفة',         labelEn: 'Cost Center Code',                             required: false, type: 'text',         example: 'CC-001' },
      { key: 'department_code',  label: 'كود الإدارة',              labelEn: 'Department Code',                              required: false, type: 'text',         example: 'DEP-001' },
      { key: 'line_description', label: 'شرح السطر',               labelEn: 'Line Description',                             required: false, type: 'text',         example: 'شرح تفصيلي للسطر' },
    ]
  }
};

// ================================================================
// GET /import/template/:module  – Download Excel template
// ================================================================
router.get('/import/template/:module', authenticateToken, async (req: AuthRequest, res) => {
  const moduleName = req.params.module;
  const config = IMPORT_CONFIGS[moduleName];
  if (!config) return res.status(404).json({ error: 'Module not found' });

  const companyId = req.user?.company_id;

  // Load existing account codes with sub_account requirement to embed as reference in template
  let accountsRef: { code: string; name: string; required_sub_account: boolean }[] = [];
  try {
    const acRes = await pool.query(
      `SELECT code, name, required_sub_account FROM accounts WHERE company_id = $1 ORDER BY code`,
      [companyId]
    );
    accountsRef = acRes.rows;
  } catch (e) { /* non-fatal */ }

  const wb = XLSX.utils.book_new();

  // ── Data Sheet: Header on Row 0 ONLY, user enters data directly from Row 1 (Row 2 in Excel) ──
  const arabicHeaders = config.columns.map(c => c.label);
  const wsData: any[][] = [arabicHeaders];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Style header row (Row 0 – Arabic header: green background, white bold text)
  const colCount = config.columns.length;
  for (let c = 0; c < colCount; c++) {
    const r0 = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[r0]) {
      ws[r0].s = {
        fill: { fgColor: { rgb: '1E6E42' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
      };
    }
  }

  ws['!cols'] = config.columns.map(() => ({ wch: 26 }));
  ws['!rows'] = [{ hpt: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, config.nameAr);

  // ── Dropdown Values Sheet ─────────────────────────────────────
  const selectCols = config.columns.filter(c => c.type === 'select' && c.options?.length);
  if (selectCols.length > 0) {
    const dropHeaders = selectCols.map(c => c.label);
    const maxOptions  = Math.max(...selectCols.map(c => c.options!.length));
    const dropData: any[][] = [dropHeaders];
    for (let i = 0; i < maxOptions; i++) {
      dropData.push(selectCols.map(c => c.options![i] || ''));
    }
    const wsDrop = XLSX.utils.aoa_to_sheet(dropData);
    wsDrop['!cols'] = selectCols.map(() => ({ wch: 28 }));
    XLSX.utils.book_append_sheet(wb, wsDrop, 'القيم المسموح بها');
  }

  // ── Accounts Reference Sheet ──────────────────────────────────
  const hasAccountCols = config.columns.some(c => c.type === 'account_code');
  if ((hasAccountCols || moduleName === 'journal_entries') && accountsRef.length > 0) {
    const accData: any[][] = [['كود الحساب', 'اسم الحساب', 'يلزم حساب فرعي']];
    accountsRef.forEach(a => accData.push([a.code, a.name, a.required_sub_account ? 'نعم' : 'لا']));
    const wsAcc = XLSX.utils.aoa_to_sheet(accData);
    wsAcc['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsAcc, 'دليل الحسابات');
  }

  // ── Additional Reference Sheets for Journal Entries ───────────
  if (moduleName === 'journal_entries') {
    try {
      const custRes = await pool.query(`SELECT code, name FROM customers WHERE company_id = $1 ORDER BY code`, [companyId]);
      if (custRes.rows.length > 0) {
        const cData = [['كود العميل', 'اسم العميل'], ...custRes.rows.map(c => [c.code, c.name])];
        const wsC = XLSX.utils.aoa_to_sheet(cData);
        wsC['!cols'] = [{ wch: 18 }, { wch: 35 }];
        XLSX.utils.book_append_sheet(wb, wsC, 'العملاء');
      }

      const suppRes = await pool.query(`SELECT code, name FROM suppliers WHERE company_id = $1 ORDER BY code`, [companyId]);
      if (suppRes.rows.length > 0) {
        const sData = [['كود المورد', 'اسم المورد'], ...suppRes.rows.map(s => [s.code, s.name])];
        const wsS = XLSX.utils.aoa_to_sheet(sData);
        wsS['!cols'] = [{ wch: 18 }, { wch: 35 }];
        XLSX.utils.book_append_sheet(wb, wsS, 'الموردين');
      }

      const pmRes = await pool.query(`SELECT name, type FROM payment_methods WHERE company_id = $1 ORDER BY name`, [companyId]);
      if (pmRes.rows.length > 0) {
        const pmData = [['اسم طريقة السداد / الخزينة', 'النوع'], ...pmRes.rows.map(p => [p.name, p.type])];
        const wsPM = XLSX.utils.aoa_to_sheet(pmData);
        wsPM['!cols'] = [{ wch: 30 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsPM, 'طرق السداد والخزن');
      }

      const opRes = await pool.query(`SELECT operation_number, description FROM operations WHERE company_id = $1 ORDER BY operation_number`, [companyId]);
      if (opRes.rows.length > 0) {
        const opData = [['رقم العملية', 'البيان'], ...opRes.rows.map(o => [o.operation_number, o.description])];
        const wsOp = XLSX.utils.aoa_to_sheet(opData);
        wsOp['!cols'] = [{ wch: 20 }, { wch: 35 }];
        XLSX.utils.book_append_sheet(wb, wsOp, 'العمليات');
      }
    } catch (e) { /* non-fatal */ }
  }

  // ── Instructions Sheet ────────────────────────────────────────
  const instructions = [
    ['تعليمات الاستيراد - ' + config.nameAr],
    [''],
    ['1. لا تحذف أو تعدل صف رؤوس الأعمدة (الصف الأول)'],
    ['2. ابدأ إدخال البيانات مباشرة من أول الجدول (الصف الثاني بعد رؤوس الأعمدة)'],
    ['3. الحقول المعلمة بـ (*) إجبارية'],
    ...(moduleName === 'journal_entries' ? [
      ['4. العمود الأول "رقم المرجع *" يحدد القيد الذي ينتمي له كل سطر (مثال: Ref-000001)'],
      ['5. يمكن إدخال قيد واحد أو عدة قيود في نفس الملف مع تكرار رقم المرجع لأسطر نفس القيد'],
      ['6. يجب تكرار بيانات القيد (رقم المرجع، التاريخ، البيان) في كل سطر يحتوي على القيد'],
      ['7. يجب أن يتساوى إجمالي المدين مع إجمالي الدائن لكل قيد (توازن القيد)'],
      ['8. يجب أن يحتوي كل قيد على سطرين على الأقل (طرف مدين وطرف دائن)'],
      ['9. لا يتم الرفع في حالة أن الحسابات غير صحيحة، وإذا كان الحساب يلزم له حساب فرعي فيجب إدخال الحساب الفرعي'],
      ['   → راجع ورقة "دليل الحسابات" لمعرفة الحسابات التي يلزم لها حساب فرعي'],
      ['   → يمكن إدخال كود أو اسم العميل / المورد / الخزينة في عمود الحساب الفرعي'],
      ['10. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-01-01)'],
    ] : [
      ['4. الأكواد يجب أن تكون فريدة وغير مكررة'],
      ['5. أعمدة "كود الحساب" يجب إدخال كود الحساب الموجود في دليل الحسابات'],
      ['   → راجع ورقة "دليل الحسابات" للحصول على الأكواد الصحيحة'],
      ['6. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-01-01)'],
      ['7. القيم المسموح بها للحقول المنسدلة موجودة في ورقة "القيم المسموح بها"'],
      ...(moduleName === 'products' ? [
        [''],
        ['ملاحظات خاصة بالأصناف:'],
        ['- عمود "رابط صورة الصنف": الصق رابط URL لصورة مرفوعة على الإنترنت (اختياري)'],
        ['- طريقة التكلفة: WAC = متوسط التكلفة، FIFO = أول دخول أول خروج'],
        ['- كود مجموعة الأصناف يجب أن يطابق كود مجموعة موجودة في النظام'],
      ] : []),
    ]),
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  wsInst['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInst, 'التعليمات');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  res.set({
    'Content-Disposition': `attachment; filename="template_${moduleName}_${Date.now()}.xlsx"`,
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  res.send(buffer);
});

// ================================================================
// POST /import/validate/:module  – Validate without DB write
// ================================================================
router.post('/import/validate/:module', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  const moduleName = req.params.module;
  const config = IMPORT_CONFIGS[moduleName];
  if (!config) return res.status(404).json({ error: 'Module not found' });
  if (!req.file)  return res.status(400).json({ error: 'No file uploaded' });

  const companyId = req.user?.company_id;

  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    if (rawRows.length < 2) {
      return res.status(400).json({ error: 'الملف فارغ أو لا يحتوي على بيانات (يجب أن يحتوي على صف الرؤوس وصف بيانات واحد على الأقل)' });
    }

    // Validate headers (row 0 = Arabic headers)
    const arabicHeaderRow = (rawRows[0] || []) as string[];
    const expectedHeaders = config.columns.map(c => c.label);
    const headerErrors: string[] = [];
    for (let i = 0; i < expectedHeaders.length; i++) {
      const exp = expectedHeaders[i].trim();
      const act = String(arabicHeaderRow[i] || '').trim();
      if (act !== exp) {
        headerErrors.push(`العمود ${i + 1}: المتوقع "${exp}" - الموجود "${act || 'فارغ'}"`);
      }
    }
    if (headerErrors.length > 0) {
      return res.status(400).json({ error: 'رؤوس الأعمدة لا تتطابق مع النموذج - استخدم النموذج المُنزَّل من النظام', headerErrors });
    }

    // Determine start row: skip legacy multi-header rows if present
    let startIdx = 1;
    if (rawRows.length > 2) {
      const r1Str = (rawRows[1] || []).join(' ');
      if (r1Str.includes('Customer Code') || r1Str.includes('Product Code') || r1Str.includes('Reference Number') || r1Str.includes('Required')) {
        startIdx = 2;
        if (rawRows.length > 4) {
          const r2Str = (rawRows[2] || []).join(' ');
          if (r2Str.includes('يجب') || r2Str.includes('دليل') || r2Str.includes('note')) {
            startIdx = 4;
          }
        }
      }
    }

    const dataRowsWithIdx: { rawRow: any[]; originalRowNumber: number }[] = [];
    for (let idx = startIdx; idx < rawRows.length; idx++) {
      const r = rawRows[idx];
      if (r && r.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')) {
        dataRowsWithIdx.push({ rawRow: r, originalRowNumber: idx + 1 });
      }
    }

    if (dataRowsWithIdx.length === 0) {
      return res.status(400).json({ error: 'الملف لا يحتوي على أي صفوف بيانات للإدخال' });
    }

    // ================================================================
    // JOURNAL ENTRIES VALIDATION FLOW
    // ================================================================
    if (moduleName === 'journal_entries') {
      const accountsRes = await pool.query(
        'SELECT id, code, name, required_sub_account FROM accounts WHERE company_id = $1',
        [companyId]
      );
      const accMap: Record<string, { id: string; code: string; name: string; required_sub_account: boolean }> = {};
      accountsRes.rows.forEach(a => { accMap[String(a.code).trim()] = a; });

      const custRes = await pool.query('SELECT id, code, name FROM customers WHERE company_id = $1', [companyId]);
      const custMapByCode: Record<string, any> = {};
      const custMapByName: Record<string, any> = {};
      custRes.rows.forEach(c => {
        if (c.code) custMapByCode[String(c.code).trim().toLowerCase()] = c;
        if (c.name) custMapByName[String(c.name).trim().toLowerCase()] = c;
      });

      const suppRes = await pool.query('SELECT id, code, name FROM suppliers WHERE company_id = $1', [companyId]);
      const suppMapByCode: Record<string, any> = {};
      const suppMapByName: Record<string, any> = {};
      suppRes.rows.forEach(s => {
        if (s.code) suppMapByCode[String(s.code).trim().toLowerCase()] = s;
        if (s.name) suppMapByName[String(s.name).trim().toLowerCase()] = s;
      });

      const pmRes = await pool.query('SELECT id, name, type FROM payment_methods WHERE company_id = $1', [companyId]);
      const pmMapByName: Record<string, any> = {};
      pmRes.rows.forEach(p => {
        if (p.name) pmMapByName[String(p.name).trim().toLowerCase()] = p;
      });

      const opRes = await pool.query('SELECT id, operation_number FROM operations WHERE company_id = $1', [companyId]);
      const opMap: Record<string, string> = {};
      opRes.rows.forEach(o => { if (o.operation_number) opMap[String(o.operation_number).trim()] = o.id; });

      const ccRes = await pool.query('SELECT id, code, name FROM cost_centers WHERE company_id = $1', [companyId]);
      const ccMap: Record<string, string> = {};
      ccRes.rows.forEach(cc => {
        if (cc.code) ccMap[String(cc.code).trim()] = cc.id;
        if (cc.name) ccMap[String(cc.name).trim()] = cc.id;
      });

      const depRes = await pool.query('SELECT id, code, name FROM departments WHERE company_id = $1', [companyId]);
      const depMap: Record<string, string> = {};
      depRes.rows.forEach(d => {
        if (d.code) depMap[String(d.code).trim()] = d.id;
        if (d.name) depMap[String(d.name).trim()] = d.id;
      });

      const validatedRows: { rowNumber: number; data: Record<string, any> }[] = [];
      const rowsWithErrors: { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];
      const entryGroups: Record<string, { rows: { rowNumber: number; data: Record<string, any>; errors: string[] }[]; totalDebit: number; totalCredit: number }> = {};

      for (const item of dataRowsWithIdx) {
        const rawRow = item.rawRow;
        const rowNumber = item.originalRowNumber;
        const errors: string[] = [];
        const rowData: Record<string, any> = {};

        for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
          const colDef = config.columns[colIdx];
          let val = rawRow[colIdx];
          if (typeof val === 'string') val = val.trim();

          // Excel date parse
          if (colDef.type === 'date' && typeof val === 'number') {
            try {
              const d = XLSX.SSF.parse_date_code(val);
              if (d) val = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
            } catch { /* ignore */ }
          }

          const isEmpty = val === undefined || val === null || val === '';
          if (colDef.required && isEmpty) {
            errors.push(`الحقل "${colDef.label.replace(' *', '')}" مطلوب`);
            rowData[colDef.key] = null;
            continue;
          }
          if (isEmpty) {
            rowData[colDef.key] = colDef.type === 'number' ? 0 : null;
            continue;
          }

          if (colDef.type === 'number') {
            const num = Number(val);
            if (isNaN(num)) errors.push(`"${colDef.label.replace(' *', '')}" يجب أن يكون رقماً`);
            else val = num;
          }

          if (colDef.type === 'date') {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(val))) {
              errors.push(`تاريخ القيد "${val}" يجب أن يكون بتنسيق YYYY-MM-DD`);
            }
          }

          rowData[colDef.key] = val;
        }

        // Account check
        const accCode = String(rowData.account_code || '').trim();
        const account = accMap[accCode];
        if (!account) {
          errors.push(`كود الحساب "${accCode}" غير موجود في دليل الحسابات`);
        } else {
          rowData.account_id = account.id;
          rowData.account_name = account.name;

          // Sub-account check
          const subAccVal = String(rowData.sub_account_code || '').trim();
          if (account.required_sub_account) {
            if (!subAccVal) {
              errors.push(`الحساب "${account.name}" (${account.code}) يلزم له حساب فرعي (يرجى إدخال كود أو اسم العميل أو المورد أو الخزينة)`);
            } else {
              const subNorm = subAccVal.toLowerCase();
              const cust = custMapByCode[subNorm] || custMapByName[subNorm];
              const supp = suppMapByCode[subNorm] || suppMapByName[subNorm];
              const pm = pmMapByName[subNorm];

              if (cust) {
                rowData.sub_account_id = cust.id;
                rowData.sub_account_type = 'customer';
                rowData.customer_id = cust.id;
                rowData.customer_name = cust.name;
              } else if (supp) {
                rowData.sub_account_id = supp.id;
                rowData.sub_account_type = 'supplier';
                rowData.supplier_id = supp.id;
                rowData.supplier_name = supp.name;
              } else if (pm) {
                rowData.sub_account_id = pm.id;
                rowData.sub_account_type = 'payment_method';
              } else {
                errors.push(`الحساب الفرعي "${subAccVal}" غير موجود في قائمة العملاء أو الموردين أو طرق السداد`);
              }
            }
          } else if (subAccVal) {
            const subNorm = subAccVal.toLowerCase();
            const cust = custMapByCode[subNorm] || custMapByName[subNorm];
            const supp = suppMapByCode[subNorm] || suppMapByName[subNorm];
            const pm = pmMapByName[subNorm];
            if (cust) {
              rowData.sub_account_id = cust.id;
              rowData.sub_account_type = 'customer';
              rowData.customer_id = cust.id;
              rowData.customer_name = cust.name;
            } else if (supp) {
              rowData.sub_account_id = supp.id;
              rowData.sub_account_type = 'supplier';
              rowData.supplier_id = supp.id;
              rowData.supplier_name = supp.name;
            } else if (pm) {
              rowData.sub_account_id = pm.id;
              rowData.sub_account_type = 'payment_method';
            }
          }
        }

        // Debit / Credit numbers check
        const debit = Number(rowData.debit) || 0;
        const credit = Number(rowData.credit) || 0;
        if (debit === 0 && credit === 0) {
          errors.push('يجب إدخال مبلغ في المدين أو الدائن');
        }
        if (debit > 0 && credit > 0) {
          errors.push('لا يمكن أن يكون السطر مديناً ودائناً معاً');
        }

        // Dimensions resolution
        if (rowData.operation_number && opMap[rowData.operation_number]) {
          rowData.operation_id = opMap[rowData.operation_number];
        }
        if (rowData.cost_center_code && ccMap[rowData.cost_center_code]) {
          rowData.cost_center_id = ccMap[rowData.cost_center_code];
        }
        if (rowData.department_code && depMap[rowData.department_code]) {
          rowData.department_id = depMap[rowData.department_code];
        }

        const rowObj = { rowNumber, data: rowData, errors };
        if (errors.length > 0) {
          rowsWithErrors.push(rowObj);
        } else {
          validatedRows.push({ rowNumber, data: rowData });
        }

        // Group by reference_number
        const ref = String(rowData.reference_number || `ROW-${rowNumber}`).trim();
        if (!entryGroups[ref]) {
          entryGroups[ref] = { rows: [], totalDebit: 0, totalCredit: 0 };
        }
        entryGroups[ref].rows.push(rowObj);
        entryGroups[ref].totalDebit += debit;
        entryGroups[ref].totalCredit += credit;
      }

      // Group-level validation (balance and minimum 2 lines per entry)
      for (const [ref, group] of Object.entries(entryGroups)) {
        const groupErrors: string[] = [];
        if (group.rows.length < 2) {
          groupErrors.push(`القيد برقم المرجع "${ref}": يجب أن يحتوي على سطرين على الأقل (طرف مدين وطرف دائن)`);
        }
        const diff = Math.abs(group.totalDebit - group.totalCredit);
        if (diff >= 0.01) {
          groupErrors.push(`القيد برقم المرجع "${ref}": غير متزن (إجمالي المدين ${group.totalDebit.toFixed(2)} لا يساوي إجمالي الدائن ${group.totalCredit.toFixed(2)} - الفارق: ${diff.toFixed(2)})`);
        }

        if (groupErrors.length > 0) {
          for (const rObj of group.rows) {
            rObj.errors.push(...groupErrors);
            const vIdx = validatedRows.findIndex(v => v.rowNumber === rObj.rowNumber);
            if (vIdx !== -1) {
              validatedRows.splice(vIdx, 1);
              rowsWithErrors.push(rObj);
            }
          }
        }
      }

      return res.json({
        total:       dataRowsWithIdx.length,
        valid:       validatedRows.length,
        errors:      rowsWithErrors.length,
        validRows:   validatedRows,
        errorRows:   rowsWithErrors,
        columns:     config.columns.map(c => ({ key: c.key, label: c.label, type: c.type })),
        moduleConfig: { nameAr: config.nameAr, uniqueKey: config.uniqueKey }
      });
    }

    // ================================================================
    // STANDARD MODULES VALIDATION (Customers, Suppliers, Products, etc.)
    // ================================================================
    const accountMap: Record<string, { id: string; name: string }> = {};
    try {
      const acRes = await pool.query('SELECT id, code, name FROM accounts WHERE company_id = $1', [companyId]);
      acRes.rows.forEach((r: any) => { accountMap[String(r.code).trim()] = { id: r.id, name: r.name }; });
    } catch (e) { console.warn('Could not load accounts:', e); }

    let existingCodes = new Set<string>();
    const existingCodeToId: Record<string, string> = {};
    if (config.uniqueKey) {
      try {
        const exRes = await pool.query(
          `SELECT id, ${config.uniqueKey} FROM ${config.dbTable} WHERE company_id = $1`,
          [companyId]
        );
        exRes.rows.forEach((r: any) => {
          const val = String(r[config.uniqueKey!]).trim();
          existingCodes.add(val);
          existingCodeToId[val] = r.id;
        });
      } catch (e) { /* non-fatal */ }
    }

    const itemGroupMap: Record<string, string> = {};
    if (moduleName === 'products') {
      try {
        const igRes = await pool.query('SELECT id, code FROM item_groups WHERE company_id = $1', [companyId]);
        igRes.rows.forEach((r: any) => { itemGroupMap[r.code] = r.id; });
      } catch (e) { /* non-fatal */ }
    }

    const validatedRows:  { rowNumber: number; data: Record<string, any> }[] = [];
    const rowsWithErrors: { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];
    const codesInFile = new Set<string>();

    for (const item of dataRowsWithIdx) {
      const rawRow    = item.rawRow;
      const rowNumber = item.originalRowNumber;
      const errors: string[] = [];
      const rowData: Record<string, any> = {};

      for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
        const colDef = config.columns[colIdx];
        let value    = rawRow[colIdx];

        if (typeof value === 'string') value = value.trim();

        if (colDef.type === 'date' && typeof value === 'number') {
          try {
            const d = XLSX.SSF.parse_date_code(value);
            if (d) value = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
          } catch { /* ignore */ }
        }

        const isEmpty = value === undefined || value === null || value === '';

        if (colDef.required && isEmpty) {
          errors.push(`الحقل "${colDef.label.replace(' *','')}" مطلوب`);
          rowData[colDef.key] = null;
          continue;
        }
        if (isEmpty) { rowData[colDef.key] = null; continue; }

        if (colDef.type === 'number') {
          const num = Number(value);
          if (isNaN(num)) { errors.push(`"${colDef.label.replace(' *','')}" يجب أن يكون رقماً`); }
          else value = num;
        }

        if (colDef.type === 'select' && colDef.options) {
          if (!colDef.options.includes(String(value))) {
            errors.push(`"${colDef.label.replace(' *','')}" يجب أن يكون أحد: ${colDef.options.join(' | ')}`);
          }
        }

        if (colDef.type === 'date') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
            errors.push(`"${colDef.label.replace(' *','')}" يجب أن يكون بتنسيق YYYY-MM-DD`);
          }
        }

        if (colDef.key === 'is_active') {
          const strVal = String(value).trim().toLowerCase();
          rowData['is_active'] = !['غير نشط', 'معطل', 'false', '0', 'no', 'disabled'].includes(strVal);
          continue;
        }

        if (colDef.type === 'account_code') {
          const codeStr = String(value).trim();
          const acct = accountMap[codeStr];
          if (!acct) {
            errors.push(`كود الحساب "${codeStr}" في حقل "${colDef.label.replace(' *','')}" غير موجود في دليل الحسابات`);
            rowData[colDef.key] = null;
            continue;
          }
          const fieldBase = colDef.key.replace('_code', '');
          rowData[`${fieldBase}_id`]   = acct.id;
          rowData[`${fieldBase}_name`] = acct.name;
          rowData[colDef.key] = codeStr;
          continue;
        }

        rowData[colDef.key] = value;
      }

      const codeKey = config.uniqueKey;
      if (codeKey && rowData[codeKey]) {
        const codeVal = String(rowData[codeKey]).trim();
        if (codesInFile.has(codeVal)) {
          errors.push(`الكود "${codeVal}" مكرر داخل الملف`);
        } else {
          codesInFile.add(codeVal);
        }
        if (existingCodes.has(codeVal)) {
          rowData['_existing'] = true;
          if (existingCodeToId[codeVal]) {
            rowData['id'] = existingCodeToId[codeVal];
          }
        }
      }

      if (moduleName === 'products' && rowData['item_group_code']) {
        const igId = itemGroupMap[rowData['item_group_code']];
        if (!igId) {
          errors.push(`كود مجموعة الأصناف "${rowData['item_group_code']}" غير موجود في النظام`);
        } else {
          rowData['item_group_id'] = igId;
        }
        delete rowData['item_group_code'];
      }

      if (errors.length > 0) {
        rowsWithErrors.push({ rowNumber, data: rowData, errors });
      } else {
        validatedRows.push({ rowNumber, data: rowData });
      }
    }

    res.json({
      total:       dataRowsWithIdx.length,
      valid:       validatedRows.length,
      errors:      rowsWithErrors.length,
      validRows:   validatedRows,
      errorRows:   rowsWithErrors,
      columns:     config.columns.map(c => ({ key: c.key, label: c.label, type: c.type })),
      moduleConfig: { nameAr: config.nameAr, uniqueKey: config.uniqueKey }
    });
  } catch (err: any) {
    console.error('Validation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// POST /import/execute/:module  – Execute DB write
// ================================================================
router.post('/import/execute/:module', authenticateToken, async (req: AuthRequest, res) => {
  const moduleName = req.params.module;
  const config     = IMPORT_CONFIGS[moduleName];
  if (!config) return res.status(404).json({ error: 'Module not found' });

  const { rows } = req.body as { rows: { data: Record<string, any>; rowNumber: number }[] };
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows to import' });

  const companyId = req.user?.company_id;
  const client    = await pool.connect();
  let inserted = 0, updated = 0;

  try {
    await client.query('BEGIN');

    // ── JOURNAL ENTRIES EXECUTE ──────────────────────────────────
    if (moduleName === 'journal_entries') {
      const groups: Record<string, any[]> = {};
      for (const { data } of rows) {
        const ref = String(data.reference_number || 'REF-DEFAULT').trim();
        if (!groups[ref]) groups[ref] = [];
        groups[ref].push(data);
      }

      let entriesCount = 0;
      for (const [ref, lines] of Object.entries(groups)) {
        const jeId = uuidv4();
        const firstLine = lines[0];
        const dateStr = firstLine.date || new Date().toISOString().split('T')[0];
        const description = firstLine.description || `قيد مستورد رقم مرجع ${ref}`;

        let totalDebit = 0;
        let totalCredit = 0;
        lines.forEach(l => {
          totalDebit += Number(l.debit) || 0;
          totalCredit += Number(l.credit) || 0;
        });
        totalDebit = Math.round(totalDebit * 100) / 100;
        totalCredit = Math.round(totalCredit * 100) / 100;

        const entryNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'journal_entries', dateStr);

        await client.query(
          `INSERT INTO journal_entries (
            id, company_id, entry_number, date, description,
            reference_id, reference_type, reference_number,
            total_debit, total_credit, status, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
          [
            jeId, companyId, entryNumber, dateStr, description,
            'manual', 'manual', ref,
            totalDebit, totalCredit, req.user?.id || 'system'
          ]
        );

        for (const line of lines) {
          const lineId = uuidv4();
          await client.query(
            `INSERT INTO journal_entry_lines (
              id, journal_entry_id, account_id, account_name, description,
              debit, credit, company_id, customer_id, customer_name,
              supplier_id, supplier_name, sub_account_id, sub_account_type,
              operation_id, department_id, cost_center_id,
              currency, exchange_rate, foreign_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
            [
              lineId, jeId, line.account_id, line.account_name, line.line_description || line.description || '',
              Number(line.debit) || 0, Number(line.credit) || 0, companyId,
              line.customer_id || null, line.customer_name || null,
              line.supplier_id || null, line.supplier_name || null,
              line.sub_account_id || null, line.sub_account_type || null,
              line.operation_id || null, line.department_id || null, line.cost_center_id || null,
              line.currency || 'local', Number(line.exchange_rate) || 1, Number(line.foreign_amount) || 0
            ]
          );
        }
        entriesCount++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: entriesCount, updated: 0, total: rows.length });
    }

    // ── STANDARD MODULES EXECUTE ─────────────────────────────────
    for (const { data, rowNumber } of rows) {
      const rowToInsert: Record<string, any> = { ...data, company_id: companyId };
      delete rowToInsert['_existing'];

      Object.keys(rowToInsert).forEach(k => {
        if (k.endsWith('_code') && !['employee_code', 'item_group_code', 'eta_item_code', 'tax_item_code', 'code', 'manual_code'].includes(k)) {
          delete rowToInsert[k];
        }
      });

      if (!rowToInsert['id']) rowToInsert['id'] = uuidv4();

      const keys   = Object.keys(rowToInsert).filter(k => rowToInsert[k] !== null && rowToInsert[k] !== undefined);
      const values = keys.map(k => rowToInsert[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const updateClause = keys
        .filter(k => k !== 'id' && k !== 'company_id')
        .map(k => `"${k}" = EXCLUDED."${k}"`);

      try {
        const result = await client.query(
          `INSERT INTO "${config.dbTable}" (${keys.map(k => `"${k}"`).join(', ')})
           VALUES (${placeholders.join(', ')})
           ON CONFLICT (id) DO UPDATE SET ${updateClause.join(', ')}
           RETURNING xmax`,
          values
        );
        if (result.rows[0]?.xmax === '0' || result.rows[0]?.xmax === 0) inserted++;
        else updated++;
      } catch (rowErr: any) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `خطأ في الصف ${rowNumber}: ${rowErr.message}` });
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, inserted, updated, total: rows.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
