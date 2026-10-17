import { Router } from 'express';
import * as XLSX from 'xlsx';
import { authenticateToken, AuthRequest } from './auth-middleware';
import pool from './postgres';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { ensureUniqueSequenceNumber } from './erp-api';
import { recordAdjustment, recordGoodsReceipt, recordTransfer } from './cost-engine';
import { InventoryMovementService } from '../services/InventoryMovementService';

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
  },

  // ── أرصدة المخزون الافتتاحية ─────────────────────────────────────
  opening_stock_balances: {
    nameAr: 'أرصدة المخزون الافتتاحية',
    dbTable: 'opening_stock_balances',
    uniqueKey: 'document_number',
    columns: [
      { key: 'document_number',     label: 'رقم المرجع / السند *',        labelEn: 'Reference / Document Number (Required, e.g. OPB-000001)', required: true,  type: 'text',         example: 'OPB-000001', note: 'رقم يجمع أسطر نفس السند الافتتاحي' },
      { key: 'date',                label: 'تاريخ السند *',               labelEn: 'Document Date (YYYY-MM-DD, Required)',                    required: true,  type: 'date',         example: '2026-10-17' },
      { key: 'description',         label: 'البيان العام للسند',           labelEn: 'Document Description',                                    required: false, type: 'text',         example: 'أرصدة أول المدة للمخزون' },
      { key: 'debit_account_code',  label: 'كود حساب المخزون (المدين) *',  labelEn: 'Inventory Account Code (Debit, Required)',                required: true,  type: 'account_code', example: '1115',       note: 'حساب بضاعة أول المدة أو المخزون بدليل الحسابات' },
      { key: 'credit_account_code', label: 'كود حساب المقابل (الدائن) *',  labelEn: 'Counter Account Code (Credit, Required)',                 required: true,  type: 'account_code', example: '31',         note: 'حساب رأس المال أو الأرباح المحتجزة / أرصدة افتتاحية' },
      { key: 'product_code',        label: 'كود الصنف *',                 labelEn: 'Product Code (Required)',                                 required: true,  type: 'text',         example: 'PROD-001',   note: 'كود الصنف المسجل في بطاقات الأصناف' },
      { key: 'warehouse_name',      label: 'اسم أو كود المستودع *',       labelEn: 'Warehouse Name or Code (Required)',                       required: true,  type: 'text',         example: 'المستودع الرئيسي' },
      { key: 'quantity',            label: 'الكمية *',                    labelEn: 'Quantity (Positive number > 0)',                          required: true,  type: 'number',       example: '50' },
      { key: 'unit_cost',           label: 'تكلفة الوحدة *',              labelEn: 'Unit Cost (>= 0)',                                        required: true,  type: 'number',       example: '100' },
      { key: 'notes',               label: 'ملاحظات السطر',               labelEn: 'Item Notes',                                              required: false, type: 'text',         example: 'رصيد مستودع رئيسي' },
    ]
  },

  // ── تسويات المخزون (أذون التسوية) ────────────────────────────────
  stock_adjustments: {
    nameAr: 'تسويات المخزون',
    dbTable: 'stock_adjustments',
    uniqueKey: 'adjustment_number',
    columns: [
      { key: 'adjustment_number',   label: 'رقم المرجع / إذن التسوية *',   labelEn: 'Adjustment / Reference Number (Required, e.g. ADJ-000001)', required: true,  type: 'text',         example: 'ADJ-000001', note: 'رقم يجمع أسطر إذن التسوية الواحد' },
      { key: 'date',                label: 'تاريخ التسوية *',              labelEn: 'Adjustment Date (YYYY-MM-DD, Required)',                    required: true,  type: 'date',         example: '2026-10-17' },
      { key: 'description',         label: 'البيان العام للتسوية',          labelEn: 'Adjustment Description',                                    required: false, type: 'text',         example: 'تسوية فروقات جردية' },
      { key: 'account_code',        label: 'كود حساب فروقات الجرد *',      labelEn: 'Adjustment Account Code (Required)',                        required: true,  type: 'account_code', example: '512',        note: 'حساب أرباح وخسائر التسويات أو فروقات الجرد' },
      { key: 'product_code',        label: 'كود الصنف *',                 labelEn: 'Product Code (Required)',                                   required: true,  type: 'text',         example: 'PROD-001' },
      { key: 'warehouse_name',      label: 'اسم أو كود المستودع *',       labelEn: 'Warehouse Name or Code (Required)',                         required: true,  type: 'text',         example: 'المستودع الرئيسي' },
      { key: 'quantity',            label: 'كمية الفرق (+ زيادة / - عجز) *', labelEn: 'Discrepancy Quantity (+ for gain, - for loss)',          required: true,  type: 'number',       example: '5' },
      { key: 'unit_cost',           label: 'تكلفة الوحدة *',              labelEn: 'Unit Cost (>= 0)',                                          required: true,  type: 'number',       example: '50' },
      { key: 'notes',               label: 'ملاحظات السطر',               labelEn: 'Item Notes',                                                required: false, type: 'text',         example: 'زيادة جردية فعلية' },
    ]
  },

  // ── سندات القبض ─────────────────────────────────────────────────
  receipt_vouchers: {
    nameAr: 'سندات القبض',
    dbTable: 'receipt_vouchers',
    uniqueKey: 'voucher_number',
    columns: [
      { key: 'voucher_number',      label: 'رقم السند',                   labelEn: 'Voucher Number (Optional, auto-generated if blank)',        required: false, type: 'text',         example: 'RV-000001' },
      { key: 'date',                label: 'تاريخ السند *',               labelEn: 'Voucher Date (YYYY-MM-DD, Required)',                       required: true,  type: 'date',         example: '2026-10-17' },
      { key: 'amount',              label: 'المبلغ *',                    labelEn: 'Amount (Required, > 0)',                                    required: true,  type: 'number',       example: '5000' },
      { key: 'payment_method_name', label: 'طريقة السداد / الخزينة *',    labelEn: 'Payment Method / Cash / Bank Name (Required)',              required: true,  type: 'text',         example: 'الخزينة الرئيسية' },
      { key: 'entity_type',         label: 'نوع جهة القبض *',             labelEn: 'Entity Type: customer | supplier | account',                required: true,  type: 'select',       options: ['customer', 'supplier', 'account'], example: 'customer' },
      { key: 'entity_code',         label: 'كود / اسم العميل أو المورد أو الحساب *', labelEn: 'Customer/Supplier Code or Account Code (Required)', required: true,  type: 'text',         example: 'CUST-001' },
      { key: 'description',         label: 'البيان',                      labelEn: 'Description',                                               required: false, type: 'text',         example: 'تحصيل دفعة نقدية' },
      { key: 'manual_reference',    label: 'المرجع الورقي / اليدوي',      labelEn: 'Manual / Paper Reference Number',                           required: false, type: 'text',         example: 'REC-101' },
    ]
  },

  // ── سندات الصرف ─────────────────────────────────────────────────
  payment_vouchers: {
    nameAr: 'سندات الصرف',
    dbTable: 'payment_vouchers',
    uniqueKey: 'voucher_number',
    columns: [
      { key: 'voucher_number',      label: 'رقم السند',                   labelEn: 'Voucher Number (Optional, auto-generated if blank)',        required: false, type: 'text',         example: 'PV-000001' },
      { key: 'date',                label: 'تاريخ السند *',               labelEn: 'Voucher Date (YYYY-MM-DD, Required)',                       required: true,  type: 'date',         example: '2026-10-17' },
      { key: 'amount',              label: 'المبلغ *',                    labelEn: 'Amount (Required, > 0)',                                    required: true,  type: 'number',       example: '3000' },
      { key: 'payment_method_name', label: 'طريقة السداد / الخزينة *',    labelEn: 'Payment Method / Cash / Bank Name (Required)',              required: true,  type: 'text',         example: 'الخزينة الرئيسية' },
      { key: 'paid_to_type',        label: 'جهة الصرف *',                 labelEn: 'Paid To Type: supplier | expense | customer | account',     required: true,  type: 'select',       options: ['supplier', 'expense', 'customer', 'account'], example: 'supplier' },
      { key: 'entity_code',         label: 'كود / اسم المورد أو بند المصروف أو الحساب *', labelEn: 'Supplier/Expense Code or Account Code (Required)', required: true,  type: 'text',         example: 'SUPP-001' },
      { key: 'description',         label: 'البيان',                      labelEn: 'Description',                                               required: false, type: 'text',         example: 'سداد دفعة نقدية' },
      { key: 'manual_reference',    label: 'المرجع الورقي / اليدوي',      labelEn: 'Manual / Paper Reference Number',                           required: false, type: 'text',         example: 'PAY-101' },
    ]
  },

  // ── تحويلات النقدية والخزائن ─────────────────────────────────────
  cash_transfers: {
    nameAr: 'تحويلات النقدية والخزائن',
    dbTable: 'cash_transfers',
    uniqueKey: 'transfer_number',
    columns: [
      { key: 'transfer_number',           label: 'رقم التحويل',              labelEn: 'Transfer Number (Optional, auto-generated if blank)',   required: false, type: 'text',         example: 'TR-000001' },
      { key: 'date',                      label: 'تاريخ التحويل *',          labelEn: 'Transfer Date (YYYY-MM-DD, Required)',                  required: true,  type: 'date',         example: '2026-10-17' },
      { key: 'amount',                    label: 'المبلغ المحول *',          labelEn: 'Amount (Required, > 0)',                                required: true,  type: 'number',       example: '10000' },
      { key: 'from_payment_method_name',  label: 'من خزينة / بنك (المحول) *', labelEn: 'From Cash / Bank (Required)',                           required: true,  type: 'text',         example: 'الخزينة الرئيسية' },
      { key: 'to_payment_method_name',    label: 'إلى خزينة / بنك (المستلم) *', labelEn: 'To Cash / Bank (Required)',                          required: true,  type: 'text',         example: 'البنك الأهلي' },
      { key: 'description',               label: 'البيان / سبب التحويل',     labelEn: 'Description',                                           required: false, type: 'text',         example: 'إيداع نقدي بالبنك من الخزينة' },
    ]
  },

  // ── خصومات العملاء (الخصم المسموح به) ───────────────────────────
  customer_discounts: {
    nameAr: 'خصومات العملاء (المسموح به)',
    dbTable: 'customer_discounts',
    uniqueKey: 'number',
    columns: [
      { key: 'number',        label: 'رقم إشعار الخصم',             labelEn: 'Discount Number (Optional, auto-generated if blank)',   required: false, type: 'text',         example: 'CDISC-00001' },
      { key: 'date',          label: 'تاريخ الخصم *',               labelEn: 'Discount Date (YYYY-MM-DD, Required)',                  required: true,  type: 'date',         example: '2026-10-17' },
      { key: 'customer_code', label: 'كود أو اسم العميل *',         labelEn: 'Customer Code or Name (Required)',                      required: true,  type: 'text',         example: 'CUST-001' },
      { key: 'amount',        label: 'مبلغ الخصم *',                labelEn: 'Discount Amount (Required, > 0)',                       required: true,  type: 'number',       example: '500' },
      { key: 'account_code',  label: 'كود حساب الخصم المسموح به *', labelEn: 'Discount Expense Account Code (Required)',              required: true,  type: 'account_code', example: '412', note: 'حساب الخصم المسموح به بدليل الحسابات' },
      { key: 'description',   label: 'البيان / سبب الخصم',          labelEn: 'Description',                                           required: false, type: 'text',         example: 'خصم تعجيل دفع' },
      { key: 'notes',         label: 'ملاحظات إضافية',              labelEn: 'Notes',                                                 required: false, type: 'text',         example: 'موافقة الإدارة' },
    ]
  },

  // ── خصومات الموردين (الخصم المكتسب) ─────────────────────────────
  supplier_discounts: {
    nameAr: 'خصومات الموردين (الخصم المكتسب)',
    dbTable: 'supplier_discounts',
    uniqueKey: 'number',
    columns: [
      { key: 'number',        label: 'رقم إشعار الخصم',             labelEn: 'Discount Number (Optional, auto-generated if blank)',   required: false, type: 'text',         example: 'SDISC-00001' },
      { key: 'date',          label: 'تاريخ الخصم *',               labelEn: 'Discount Date (YYYY-MM-DD, Required)',                  required: true,  type: 'date',         example: '2026-10-17' },
      { key: 'supplier_code', label: 'كود أو اسم المورد *',         labelEn: 'Supplier Code or Name (Required)',                      required: true,  type: 'text',         example: 'SUPP-001' },
      { key: 'amount',        label: 'مبلغ الخصم *',                labelEn: 'Discount Amount (Required, > 0)',                       required: true,  type: 'number',       example: '800' },
      { key: 'account_code',  label: 'كود حساب الخصم المكتسب *',    labelEn: 'Earned Discount Account Code (Required)',               required: true,  type: 'account_code', example: '512', note: 'حساب الخصم المكتسب بدليل الحسابات' },
      { key: 'description',   label: 'البيان / سبب الخصم',          labelEn: 'Description',                                           required: false, type: 'text',         example: 'خصم كمية من المورد' },
      { key: 'notes',         label: 'ملاحظات إضافية',              labelEn: 'Notes',                                                 required: false, type: 'text',         example: 'تسوية سنوية' },
    ]
  },

  // ── الشيكات الصادرة (أوراق الدفع) ──────────────────────────────────
  issued_cheques: {
    nameAr: 'الشيكات الصادرة',
    dbTable: 'issued_cheques',
    uniqueKey: 'cheque_number',
    columns: [
      { key: 'cheque_number',       label: 'رقم الشيك *',                     labelEn: 'Cheque Number (Required)',                                    required: true,  type: 'text',         example: 'CHQ-100251', note: 'رقم الشيك الفعلي المطبوع' },
      { key: 'issue_date',          label: 'تاريخ التحرير والإصدار *',        labelEn: 'Issue Date (YYYY-MM-DD, Required)',                           required: true,  type: 'date',         example: '2026-10-17' },
      { key: 'due_date',            label: 'تاريخ الاستحقاق والصرف *',        labelEn: 'Due Date (YYYY-MM-DD, Required)',                             required: true,  type: 'date',         example: '2026-11-17' },
      { key: 'amount',              label: 'المبلغ *',                        labelEn: 'Amount (Required, > 0)',                                      required: true,  type: 'number',       example: '5000' },
      { key: 'payee_type',          label: 'نوع المستفيد *',                  labelEn: 'Payee Type: supplier | general',                              required: true,  type: 'select',       options: ['supplier', 'general'], example: 'supplier', note: 'supplier = شيك لمورد | general = شيك بدون مورد' },
      { key: 'supplier_code',       label: 'كود أو اسم المورد',               labelEn: 'Supplier Code or Name (Required for supplier type)',          required: false, type: 'text',         example: 'SUPP-001',   note: 'مطلوب في حال اختيار نوع المستفيد supplier' },
      { key: 'payee_name',          label: 'اسم المستفيد (لأمر من)',          labelEn: 'Payee / Beneficiary Name (Required for general type)',        required: false, type: 'text',         example: 'شركة التوريدات الحديثة' },
      { key: 'bank_name',           label: 'البنك المسحوب منه (الخزينة/البنك) *', labelEn: 'Drawn Bank / Payment Method Name (Required)',            required: true,  type: 'text',         example: 'البنك الأهلي المصري', note: 'اسم البنك أو طريقة السداد البنكية المسجلة بالنظام' },
      { key: 'credit_account_code', label: 'كود حساب أوراق الدفع (الدائن) *', labelEn: 'Notes Payable Account Code (Required)',                      required: true,  type: 'account_code', example: '210102',     note: 'حساب أوراق الدفع / الشيكات الصادرة بدليل الحسابات' },
      { key: 'debit_account_code',  label: 'كود الحساب المدين',               labelEn: 'Debit Account Code (Required for general type)',              required: false, type: 'account_code', example: '210101',     note: 'مطلوب في حالة الشيك بدون مورد (حساب المصروف أو الأصل أو المستفيد)' },
      { key: 'description',         label: 'البيان / الغرض',                  labelEn: 'Description',                                                 required: false, type: 'text',         example: 'دفعة تحت حساب التوريدات' },
      { key: 'notes',               label: 'ملاحظات إضافية',                  labelEn: 'Notes',                                                       required: false, type: 'text',         example: 'شيك مؤجل الدفع' },
    ]
  },

  // ── الشيكات الواردة (أوراق القبض) ──────────────────────────────────
  received_cheques: {
    nameAr: 'الشيكات الواردة',
    dbTable: 'received_cheques',
    uniqueKey: 'cheque_number',
    columns: [
      { key: 'receipt_number',      label: 'رقم الحافظة / الإيصال',           labelEn: 'Receipt Voucher Number (Optional, auto-generated if blank)',  required: false, type: 'text',         example: 'REC-00001' },
      { key: 'cheque_number',       label: 'رقم الشيك *',                     labelEn: 'Cheque Number (Required)',                                    required: true,  type: 'text',         example: 'CHQ-77881',  note: 'رقم الشيك الورقي المستلم' },
      { key: 'receive_date',        label: 'تاريخ الاستلام *',                labelEn: 'Receive Date (YYYY-MM-DD, Required)',                         required: true,  type: 'date',         example: '2026-10-17' },
      { key: 'due_date',            label: 'تاريخ الاستحقاق *',               labelEn: 'Due Date (YYYY-MM-DD, Required)',                             required: true,  type: 'date',         example: '2026-11-15' },
      { key: 'amount',              label: 'المبلغ *',                        labelEn: 'Amount (Required, > 0)',                                      required: true,  type: 'number',       example: '10000' },
      { key: 'payer_type',          label: 'نوع الجهة الساحبة *',             labelEn: 'Payer Type: customer | general',                              required: true,  type: 'select',       options: ['customer', 'general'], example: 'customer', note: 'customer = شيك من عميل | general = شيك بدون عميل' },
      { key: 'customer_code',       label: 'كود أو اسم العميل',               labelEn: 'Customer Code or Name (Required for customer type)',          required: false, type: 'text',         example: 'CUST-001',   note: 'مطلوب في حال اختيار نوع الساحب customer' },
      { key: 'payer_name',          label: 'اسم الساحب / المحرر',             labelEn: 'Payer / Issuer Name (Required for general type)',             required: false, type: 'text',         example: 'شركة الأمل للتجارة' },
      { key: 'bank_name',           label: 'اسم البنك المسحوب عليه *',        labelEn: 'Drawn Bank Name (Required)',                                  required: true,  type: 'text',         example: 'البنك التجاري الدولي CIB', note: 'اسم البنك المسحوب عليه الشيك' },
      { key: 'debit_account_code',  label: 'كود حساب أوراق القبض (المدين) *', labelEn: 'Notes Receivable Account Code (Required)',                    required: true,  type: 'account_code', example: '110202',     note: 'حساب أوراق القبض / شيكات برسم التحصيل بدليل الحسابات' },
      { key: 'credit_account_code', label: 'كود الحساب الدائن',               labelEn: 'Credit Account Code (Required for general type)',             required: false, type: 'account_code', example: '110201',     note: 'مطلوب في حالة الشيك بدون عميل (حساب الإيراد أو الجهة الدائنة)' },
      { key: 'description',         label: 'البيان / الغرض',                  labelEn: 'Description',                                                 required: false, type: 'text',         example: 'تحصيل دفعة بشيك مؤجل' },
      { key: 'notes',               label: 'ملاحظات إضافية',                  labelEn: 'Notes',                                                       required: false, type: 'text',         example: 'حافظة شيكات واردة' },
    ]
  },

  // ── أذون استلام البضائع ──────────────────────────────────────────
  goods_receipts: {
    nameAr: 'أذون استلام البضائع',
    dbTable: 'goods_receipts',
    uniqueKey: 'receipt_number',
    columns: [
      { key: 'receipt_number',  label: 'رقم إذن الاستلام *',         labelEn: 'Goods Receipt Number (Required, e.g. GR-000001)',  required: true,  type: 'text',   example: 'GR-000001', note: 'رقم يجمع أصناف إذن الاستلام الواحد' },
      { key: 'date',            label: 'تاريخ الاستلام *',          labelEn: 'Receipt Date (YYYY-MM-DD, Required)',               required: true,  type: 'date',   example: '2026-10-17' },
      { key: 'warehouse_name',  label: 'اسم أو كود المستودع *',     labelEn: 'Warehouse Name or Code (Required)',                 required: true,  type: 'text',   example: 'المستودع الرئيسي', note: 'اسم أو كود المستودع المستلم' },
      { key: 'supplier_code',   label: 'كود أو اسم المورد',         labelEn: 'Supplier Code or Name (Optional)',                  required: false, type: 'text',   example: 'SUPP-001',   note: 'كود أو اسم المورد المستلم منه (اختياري)' },
      { key: 'product_code',    label: 'كود الصنف *',               labelEn: 'Product Code (Required)',                           required: true,  type: 'text',   example: 'PROD-001',   note: 'كود الصنف المسجل بالنظام' },
      { key: 'quantity',        label: 'الكمية *',                  labelEn: 'Quantity (Positive number > 0)',                    required: true,  type: 'number', example: '50' },
      { key: 'unit_cost',       label: 'تكلفة الوحدة *',            labelEn: 'Unit Cost (>= 0)',                                  required: true,  type: 'number', example: '100' },
      { key: 'batch_id',        label: 'رقم التشغيلة (الباتش)',     labelEn: 'Batch / Lot Number (Optional)',                     required: false, type: 'text',   example: 'BATCH-01' },
      { key: 'serial_number',   label: 'الرقم التسلسلي (سيريال)',   labelEn: 'Serial Number (Optional)',                          required: false, type: 'text',   example: 'SN-001' },
      { key: 'notes',           label: 'ملاحظات السطر',             labelEn: 'Item Notes',                                        required: false, type: 'text',   example: 'استلام بضائع للمستودع' },
    ]
  },

  // ── التحويل بين المخازن ──────────────────────────────────────────
  warehouse_transfers: {
    nameAr: 'التحويل بين المخازن',
    dbTable: 'warehouse_transfers',
    uniqueKey: 'transfer_number',
    columns: [
      { key: 'transfer_number',     label: 'رقم التحويل *',             labelEn: 'Transfer Number (Required, e.g. TR-000001)',         required: true,  type: 'text',   example: 'TR-000001', note: 'رقم يجمع أصناف إذن التحويل الواحد' },
      { key: 'date',                label: 'تاريخ التحويل *',           labelEn: 'Transfer Date (YYYY-MM-DD, Required)',               required: true,  type: 'date',   example: '2026-10-17' },
      { key: 'from_warehouse_name', label: 'من مستودع (المصدر) *',       labelEn: 'Source Warehouse Name or Code (Required)',           required: true,  type: 'text',   example: 'المستودع الرئيسي' },
      { key: 'to_warehouse_name',   label: 'إلى مستودع (الوجهة) *',     labelEn: 'Destination Warehouse Name or Code (Required)',      required: true,  type: 'text',   example: 'مستودع المعادي' },
      { key: 'product_code',        label: 'كود الصنف *',               labelEn: 'Product Code (Required)',                           required: true,  type: 'text',   example: 'PROD-001' },
      { key: 'quantity',            label: 'الكمية المحولة *',          labelEn: 'Quantity (Positive number > 0)',                    required: true,  type: 'number', example: '10' },
      { key: 'notes',               label: 'البيان / ملاحظات',          labelEn: 'Description / Notes',                               required: false, type: 'text',   example: 'تحويل بضاعة بين المستودعات' },
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

  // Helper to find account code
  const findAccCode = (predicate: (a: { code: string; name: string; required_sub_account: boolean }) => boolean, fallback: string) => {
    const found = accountsRef.find(predicate);
    return found ? found.code : fallback;
  };

  let sampleCust = { code: 'CUST-001', name: 'شركة الأمل للتجارة' };
  let sampleSupp = { code: 'SUPP-001', name: 'شركة التوريدات الحديثة' };
  let samplePm   = { name: 'الخزينة الرئيسية', type: 'cash' };
  let sampleProd = { code: 'PROD-001', name: 'لابتوب ديل للأعمال' };
  let sampleWh   = { id: '', code: 'WH-01', name: 'المستودع الرئيسي' };
  let sampleWh2  = { id: '', code: 'WH-02', name: 'مستودع المعادي' };
  let sampleExp  = { code: 'EXP-001', name: 'مصاريف إيجار' };

  try {
    const cRes = await pool.query(`SELECT code, name FROM customers WHERE company_id = $1 ORDER BY id LIMIT 1`, [companyId]);
    if (cRes.rows[0]) sampleCust = cRes.rows[0];
    const sRes = await pool.query(`SELECT code, name FROM suppliers WHERE company_id = $1 ORDER BY id LIMIT 1`, [companyId]);
    if (sRes.rows[0]) sampleSupp = sRes.rows[0];
    const pmRes = await pool.query(`SELECT name, type FROM payment_methods WHERE company_id = $1 ORDER BY id LIMIT 1`, [companyId]);
    if (pmRes.rows[0]) samplePm = pmRes.rows[0];
    const pRes = await pool.query(`SELECT code, name FROM products WHERE company_id = $1 ORDER BY id LIMIT 1`, [companyId]);
    if (pRes.rows[0]) sampleProd = pRes.rows[0];
    const wRes = await pool.query(`SELECT id, code, name FROM warehouses WHERE company_id = $1 ORDER BY id LIMIT 2`, [companyId]);
    if (wRes.rows[0]) sampleWh = wRes.rows[0];
    if (wRes.rows[1]) sampleWh2 = wRes.rows[1];
    const expRes = await pool.query(`SELECT code, name FROM expense_categories WHERE company_id = $1 ORDER BY id LIMIT 1`, [companyId]);
    if (expRes.rows[0]) sampleExp = expRes.rows[0];
  } catch (e) { /* non-fatal */ }

  let sampleBankPm = samplePm;
  try {
    const bankRes = await pool.query(`SELECT name, type FROM payment_methods WHERE company_id = $1 AND (type = 'bank' OR bank_name IS NOT NULL) ORDER BY id LIMIT 1`, [companyId]);
    if (bankRes.rows[0]) sampleBankPm = bankRes.rows[0];
  } catch (e) { /* non-fatal */ }

  const custAccCode = findAccCode(a => a.required_sub_account && (a.name.includes('عملاء') || a.name.toLowerCase().includes('customer')), '111');
  const suppAccCode = findAccCode(a => a.required_sub_account && (a.name.includes('مورد') || a.name.toLowerCase().includes('supplier')), '211');
  const cashAccCode = findAccCode(a => a.name.includes('خزين') || a.name.includes('صندوق') || a.name.includes('نقد') || a.code === '1101' || a.code === '101', '1101');
  const revAccCode  = findAccCode(a => a.name.includes('إيراد') || a.name.includes('مبيعات') || a.code === '41', '41');
  const costAccCode = findAccCode(a => a.name.includes('تكلفة') || a.code === '51', '51');
  const expAccCode  = findAccCode(a => a.name.includes('مصروف') || a.code === '511', '511');
  const invAccCode  = findAccCode(a => a.name.includes('مخزون') || a.name.includes('بضاعة') || a.code === '1115', '1115');
  const capAccCode  = findAccCode(a => a.name.includes('رأس المال') || a.name.includes('افتتاحي') || a.name.includes('أرباح') || a.code === '31', '31');
  const notesPayableAccCode = findAccCode(a => a.name.includes('أوراق دفع') || a.name.includes('اوراق دفع') || a.code === '210102', '210102');
  const notesReceivableAccCode = findAccCode(a => a.name.includes('أوراق قبض') || a.name.includes('اوراق قبض') || a.code === '110202', '110202');

  let exampleRows: any[][] = [];

  if (moduleName === 'journal_entries') {
    // قيدان متوازنان يوضحان الحسابات الفرعية للعملاء، الموردين، والخزائن مع تكرار بيانات القيد
    exampleRows = [
      // 1. القيد الأول: تحصيل نقدي من عميل بالخزينة (طرف الخزينة مدين)
      [
        'Ref-000001',
        '2026-10-17',
        'مثال توضيحي: تحصيل نقدي من عميل بالخزينة (احذف هذا المثال قبل الرفع)',
        cashAccCode,
        samplePm.name,
        'payment_method',
        5000,
        0,
        'local',
        1,
        0,
        '',
        '',
        '',
        'تحصيل نقدي بالخزينة'
      ],
      // 1. القيد الأول: طرف العميل دائن
      [
        'Ref-000001',
        '2026-10-17',
        'مثال توضيحي: تحصيل نقدي من عميل بالخزينة (احذف هذا المثال قبل الرفع)',
        custAccCode,
        sampleCust.code,
        'customer',
        0,
        5000,
        'local',
        1,
        0,
        '',
        '',
        '',
        'سداد من حساب العميل'
      ],
      // 2. القيد الثاني: سداد دفعة نقدية لمورد من الخزينة (طرف المورد مدين)
      [
        'Ref-000002',
        '2026-10-17',
        'مثال توضيحي: سداد لمورد نقداً من الخزينة (احذف هذا المثال قبل الرفع)',
        suppAccCode,
        sampleSupp.code,
        'supplier',
        3000,
        0,
        'local',
        1,
        0,
        '',
        '',
        '',
        'سداد مستحقات المورد'
      ],
      // 2. القيد الثاني: طرف الخزينة دائن
      [
        'Ref-000002',
        '2026-10-17',
        'مثال توضيحي: سداد لمورد نقداً من الخزينة (احذف هذا المثال قبل الرفع)',
        cashAccCode,
        samplePm.name,
        'payment_method',
        0,
        3000,
        'local',
        1,
        0,
        '',
        '',
        '',
        'صرف من الخزينة لسداد المورد'
      ]
    ];
  } else if (moduleName === 'customers') {
    exampleRows = [
      [
        'CUST-EXAMPLE',
        '1001',
        'مثال توضيحي: شركة الأمل للتجارة (احذف هذا الصف قبل الرفع)',
        '0501234567',
        'customer@example.com',
        'الرياض، شارع الملك فهد',
        '300123456789003',
        custAccCode,
        '31',
        5000,
        '2026-01-01',
        50000,
        'credit',
        30,
        0
      ]
    ];
  } else if (moduleName === 'suppliers') {
    exampleRows = [
      [
        'SUPP-EXAMPLE',
        '2001',
        'مثال توضيحي: شركة التوريدات الحديثة (احذف هذا الصف قبل الرفع)',
        '0509876543',
        'supplier@example.com',
        'جدة، المنطقة الصناعية',
        '300987654321003',
        suppAccCode,
        '31',
        10000,
        '2026-01-01',
        100000,
        'credit',
        60,
        0
      ]
    ];
  } else if (moduleName === 'products') {
    exampleRows = [
      [
        'PROD-EXAMPLE',
        '3001',
        'مثال توضيحي: لابتوب ديل للأعمال (احذف هذا الصف قبل الرفع)',
        'product',
        '6281234567890',
        'قطعة',
        'معالج Core i7 - ذاكرة 16GB',
        2500,
        2000,
        5,
        revAccCode,
        costAccCode,
        '1115',
        '2221',
        '1181',
        '2221',
        14,
        'WAC',
        'EG-123456789-PROD01',
        'EGS',
        '',
        'EGS',
        'نشط',
        '',
        ''
      ]
    ];
  } else if (moduleName === 'expense_categories') {
    exampleRows = [
      [
        'EXP-EXAMPLE',
        'مثال توضيحي: إيجار المقر الشهري (احذف هذا الصف قبل الرفع)',
        expAccCode,
        'مصروفات إيجار المقر والفرع الرئيسي'
      ]
    ];
  } else if (moduleName === 'payment_methods') {
    exampleRows = [
      [
        'مثال توضيحي: الخزينة الرئيسية (احذف هذا الصف قبل الرفع)',
        'cash',
        cashAccCode,
        '',
        '',
        'الخزينة النقدية الرئيسية للمقر'
      ]
    ];
  } else if (moduleName === 'opening_stock_balances') {
    exampleRows = [
      [
        'OPB-000001',
        '2026-10-17',
        'مثال توضيحي: رصيد أول المدة لمستودع رئيسي (احذف هذا الصف قبل الرفع)',
        invAccCode,
        capAccCode,
        sampleProd.code,
        sampleWh.name,
        50,
        100,
        'رصيد أول المدة للمستودع'
      ]
    ];
  } else if (moduleName === 'stock_adjustments') {
    exampleRows = [
      [
        'ADJ-000001',
        '2026-10-17',
        'مثال توضيحي: إذن تسوية جردية بالزيادة أو العجز (احذف هذا الصف قبل الرفع)',
        expAccCode,
        sampleProd.code,
        sampleWh.name,
        5,
        100,
        'زيادة جردية فعلية'
      ]
    ];
  } else if (moduleName === 'receipt_vouchers') {
    exampleRows = [
      [
        'RV-000001',
        '2026-10-17',
        5000,
        samplePm.name,
        'customer',
        sampleCust.code,
        'مثال توضيحي: سند قبض نقدي من عميل (احذف هذا الصف قبل الرفع)',
        'REC-101'
      ]
    ];
  } else if (moduleName === 'payment_vouchers') {
    exampleRows = [
      [
        'PV-000001',
        '2026-10-17',
        3000,
        samplePm.name,
        'supplier',
        sampleSupp.code,
        'مثال توضيحي: سند صرف نقدي لمورد (احذف هذا الصف قبل الرفع)',
        'PAY-101'
      ]
    ];
  } else if (moduleName === 'cash_transfers') {
    exampleRows = [
      [
        'TR-000001',
        '2026-10-17',
        10000,
        samplePm.name,
        'البنك الأهلي',
        'مثال توضيحي: تحويل من الخزينة إلى البنك (احذف هذا الصف قبل الرفع)'
      ]
    ];
  } else if (moduleName === 'customer_discounts') {
    exampleRows = [
      [
        'CDISC-00001',
        '2026-10-17',
        sampleCust.code,
        500,
        revAccCode,
        'مثال توضيحي: خصم مسموح به لعميل (احذف هذا الصف قبل الرفع)',
        'خصم تعجيل سداد'
      ]
    ];
  } else if (moduleName === 'supplier_discounts') {
    exampleRows = [
      [
        'SDISC-00001',
        '2026-10-17',
        sampleSupp.code,
        800,
        costAccCode,
        'مثال توضيحي: خصم مكتسب من مورد (احذف هذا الصف قبل الرفع)',
        'خصم كمية سنوي'
      ]
    ];
  }

  if (moduleName === 'issued_cheques') {
    // مثالان توضيحيان: 1- شيك صادر لمورد  2- شيك صادر بدون مورد (مصروفات / جهات أخرى)
    exampleRows = [
      // 1. شيك صادر لمورد (يتم ترحيل قيد أوراق الدفع تلقائياً)
      [
        'CHQ-100251',
        '2026-10-17',
        '2026-11-17',
        5000,
        'supplier',
        sampleSupp.code,
        sampleSupp.name,
        sampleBankPm.name,
        notesPayableAccCode,
        suppAccCode,
        'مثال توضيحي: شيك صادر لمورد (احذف هذا الصف قبل الرفع)',
        'دفعة تحت حساب التوريدات'
      ],
      // 2. شيك صادر بدون مورد (شيك عام / مصروف إيجار أو جهة أخرى)
      [
        'CHQ-100252',
        '2026-10-17',
        '2026-12-01',
        3000,
        'general',
        '',
        'مصلحة الضرائب / مالك العقار',
        sampleBankPm.name,
        notesPayableAccCode,
        expAccCode,
        'مثال توضيحي: شيك صادر بدون مورد لمصروف إيجار (احذف هذا الصف قبل الرفع)',
        'سداد إيجار المقر بشيك مؤجل'
      ]
    ];
  }

  if (moduleName === 'received_cheques') {
    // مثالان توضيحيان: 1- شيك مستلم من عميل  2- شيك مستلم بدون عميل (إيرادات / جهات أخرى)
    exampleRows = [
      // 1. شيك مستلم من عميل (أوراق قبض - عملاء)
      [
        'REC-00001',
        'CHQ-77881',
        '2026-10-17',
        '2026-11-15',
        10000,
        'customer',
        sampleCust.code,
        sampleCust.name,
        'البنك التجاري الدولي CIB',
        notesReceivableAccCode,
        custAccCode,
        'مثال توضيحي: استلام شيك من عميل سداد دفعة (احذف هذا الصف قبل الرفع)',
        'شيك مسحوب على CIB'
      ],
      // 2. شيك مستلم بدون عميل (أوراق قبض - إيرادات أخرى / جهة عامة)
      [
        'REC-00002',
        'CHQ-77882',
        '2026-10-17',
        '2026-12-01',
        4500,
        'general',
        '',
        'مستأجر فرع المعادي',
        'بنك قطر الوطني QNB',
        notesReceivableAccCode,
        revAccCode,
        'مثال توضيحي: استلام شيك بدون عميل إيراد إيجار (احذف هذا الصف قبل الرفع)',
        'إيراد إيجار مقدم'
      ]
    ];
  }

  if (moduleName === 'goods_receipts') {
    // مثالان توضيحيان يوضحان تجميع أصناف نفس إذن الاستلام برقم إذن واحد (GR-000001)
    exampleRows = [
      [
        'GR-000001',
        '2026-10-17',
        sampleWh.name,
        sampleSupp.code,
        sampleProd.code,
        50,
        100,
        'BATCH-01',
        'SN-001',
        'مثال توضيحي: إذن استلام بضائع للمستودع (احذف هذا الصف قبل الرفع)'
      ],
      [
        'GR-000001',
        '2026-10-17',
        sampleWh.name,
        sampleSupp.code,
        sampleProd.code,
        25,
        120,
        'BATCH-02',
        '',
        'مثال توضيحي: صنف ثانٍ بنفس إذن الاستلام (احذف هذا الصف قبل الرفع)'
      ]
    ];
  }

  if (moduleName === 'warehouse_transfers') {
    // مثالان توضيحيان يوضحان تجميع أصناف نفس إذن التحويل برقم تحويل واحد (TR-000001)
    exampleRows = [
      [
        'TR-000001',
        '2026-10-17',
        sampleWh.name,
        sampleWh2.name,
        sampleProd.code,
        10,
        'مثال توضيحي: تحويل أصناف بين مستودعين (احذف هذا الصف قبل الرفع)'
      ],
      [
        'TR-000001',
        '2026-10-17',
        sampleWh.name,
        sampleWh2.name,
        sampleProd.code,
        5,
        'مثال توضيحي: صنف ثانٍ بنفس إذن التحويل (احذف هذا الصف قبل الرفع)'
      ]
    ];
  }

  // ── Data Sheet: Header on Row 0, Example Rows follow directly from Row 1 ──
  const arabicHeaders = config.columns.map(c => c.label);
  const wsData: any[][] = [arabicHeaders, ...exampleRows];
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

  // Style example rows in red font
  for (let r = 1; r <= exampleRows.length; r++) {
    for (let c = 0; c < colCount; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { color: { rgb: 'B91C1C' }, sz: 10, italic: true },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }
  }

  const rowHeights = [{ hpt: 30 }];
  for (let i = 0; i < exampleRows.length; i++) {
    rowHeights.push({ hpt: 24 });
  }
  ws['!cols'] = config.columns.map(() => ({ wch: 26 }));
  ws['!rows'] = rowHeights;
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

  // ── Additional Reference Sheets ──────────────────────────────
  try {
    // 1. العملاء
    if (['journal_entries', 'receipt_vouchers', 'payment_vouchers', 'customer_discounts', 'received_cheques'].includes(moduleName)) {
      const custRes = await pool.query(`SELECT code, name FROM customers WHERE company_id = $1 ORDER BY code`, [companyId]);
      if (custRes.rows.length > 0) {
        const cData = [['كود العميل', 'اسم العميل'], ...custRes.rows.map(c => [c.code, c.name])];
        const wsC = XLSX.utils.aoa_to_sheet(cData);
        wsC['!cols'] = [{ wch: 18 }, { wch: 35 }];
        XLSX.utils.book_append_sheet(wb, wsC, 'العملاء');
      }
    }

    // 2. الموردين
    if (['journal_entries', 'receipt_vouchers', 'payment_vouchers', 'supplier_discounts', 'issued_cheques', 'goods_receipts'].includes(moduleName)) {
      const suppRes = await pool.query(`SELECT code, name FROM suppliers WHERE company_id = $1 ORDER BY code`, [companyId]);
      if (suppRes.rows.length > 0) {
        const sData = [['كود المورد', 'اسم المورد'], ...suppRes.rows.map(s => [s.code, s.name])];
        const wsS = XLSX.utils.aoa_to_sheet(sData);
        wsS['!cols'] = [{ wch: 18 }, { wch: 35 }];
        XLSX.utils.book_append_sheet(wb, wsS, 'الموردين');
      }
    }

    // 3. طرق السداد والخزن
    if (['journal_entries', 'receipt_vouchers', 'payment_vouchers', 'cash_transfers', 'issued_cheques'].includes(moduleName)) {
      const pmRes = await pool.query(`SELECT name, type FROM payment_methods WHERE company_id = $1 ORDER BY name`, [companyId]);
      if (pmRes.rows.length > 0) {
        const pmData = [['اسم طريقة السداد / الخزينة', 'النوع'], ...pmRes.rows.map(p => [p.name, p.type])];
        const wsPM = XLSX.utils.aoa_to_sheet(pmData);
        wsPM['!cols'] = [{ wch: 30 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsPM, 'طرق السداد والخزن');
      }
    }

    // 4. المستودعات
    if (['opening_stock_balances', 'stock_adjustments', 'goods_receipts', 'warehouse_transfers'].includes(moduleName)) {
      const whRes = await pool.query(`SELECT code, name FROM warehouses WHERE company_id = $1 ORDER BY name`, [companyId]);
      if (whRes.rows.length > 0) {
        const whData = [['كود المستودع', 'اسم المستودع'], ...whRes.rows.map(w => [w.code || '-', w.name])];
        const wsWH = XLSX.utils.aoa_to_sheet(whData);
        wsWH['!cols'] = [{ wch: 18 }, { wch: 35 }];
        XLSX.utils.book_append_sheet(wb, wsWH, 'المستودعات');
      }
    }

    // 5. الأصناف
    if (['opening_stock_balances', 'stock_adjustments', 'goods_receipts', 'warehouse_transfers'].includes(moduleName)) {
      const prRes = await pool.query(`SELECT code, name, unit FROM products WHERE company_id = $1 ORDER BY code`, [companyId]);
      if (prRes.rows.length > 0) {
        const prData = [['كود الصنف', 'اسم الصنف', 'وحدة القياس'], ...prRes.rows.map(p => [p.code, p.name, p.unit || 'قطعة'])];
        const wsPR = XLSX.utils.aoa_to_sheet(prData);
        wsPR['!cols'] = [{ wch: 18 }, { wch: 35 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsPR, 'الأصناف');
      }
    }

    // 6. بنود المصروفات
    if (['payment_vouchers'].includes(moduleName)) {
      const expCatRes = await pool.query(`SELECT code, name FROM expense_categories WHERE company_id = $1 ORDER BY code`, [companyId]);
      if (expCatRes.rows.length > 0) {
        const expData = [['كود البند', 'اسم بند المصروف'], ...expCatRes.rows.map(e => [e.code, e.name])];
        const wsExp = XLSX.utils.aoa_to_sheet(expData);
        wsExp['!cols'] = [{ wch: 18 }, { wch: 35 }];
        XLSX.utils.book_append_sheet(wb, wsExp, 'بنود المصروفات');
      }
    }

    // 7. العمليات
    if (moduleName === 'journal_entries') {
      const opRes = await pool.query(`SELECT operation_number, description FROM operations WHERE company_id = $1 ORDER BY operation_number`, [companyId]);
      if (opRes.rows.length > 0) {
        const opData = [['رقم العملية', 'البيان'], ...opRes.rows.map(o => [o.operation_number, o.description])];
        const wsOp = XLSX.utils.aoa_to_sheet(opData);
        wsOp['!cols'] = [{ wch: 20 }, { wch: 35 }];
        XLSX.utils.book_append_sheet(wb, wsOp, 'العمليات');
      }
    }
  } catch (e) { /* non-fatal */ }

  // ── Instructions Sheet ────────────────────────────────────────
  const hasExampleRow = [
    'journal_entries', 'customers', 'suppliers', 'products', 'expense_categories', 'payment_methods',
    'opening_stock_balances', 'stock_adjustments', 'receipt_vouchers', 'payment_vouchers', 'cash_transfers', 'customer_discounts', 'supplier_discounts',
    'issued_cheques', 'received_cheques', 'goods_receipts', 'warehouse_transfers'
  ].includes(moduleName);

  const instructions = [
    ['تعليمات الاستيراد - ' + config.nameAr],
    ...(hasExampleRow ? [
      ['⚠️ تنبيه هام باللون الأحمر: تم وضع صفوف كأمثلة توضيحية داخل هذا الملف لمساعدتك (تظهر باللون الأحمر).'],
      ['   يجب حذف صفوف المثال بالكامل قبل رفع الملف إلى النظام وإدخال بياناتك الفعلية بدلاً منها.'],
      [''],
    ] : []),
    ['1. لا تحذف أو تعدل صف رؤوس الأعمدة (الصف الأول)'],
    ['2. ابدأ إدخال بياناتك مباشرة من أول الجدول (الصف الثاني بعد رؤوس الأعمدة) بعد حذف صفوف المثال التوضيحي'],
    ['3. الحقول المعلمة بـ (*) إجبارية'],
    ...(moduleName === 'journal_entries' ? [
      ['4. العمود الأول "رقم المرجع *" يحدد القيد الذي ينتمي له كل سطر (مثال: Ref-000001)'],
      ['5. تم تضمين مثالين في النموذج: تحصيل من عميل بالخزينة (عملاء وخزائن) وسداد لمورد (موردين وخزائن)'],
      ['6. يمكن إدخال قيد واحد أو عدة قيود في نفس الملف مع تكرار رقم المرجع لأسطر نفس القيد'],
      ['7. يجب تكرار بيانات القيد (رقم المرجع، التاريخ، البيان) في كل سطر يحتوي على القيد'],
      ['8. يجب أن يتساوى إجمالي المدين مع إجمالي الدائن لكل قيد (توازن القيد)'],
      ['9. يجب أن يحتوي كل قيد على سطرين على الأقل (طرف مدين وطرف دائن)'],
      ['10. لا يتم الرفع في حالة أن الحسابات غير صحيحة، وإذا كان الحساب يلزم له حساب فرعي فيجب إدخال الحساب الفرعي'],
      ['   → راجع ورقة "دليل الحسابات" لمعرفة الحسابات التي يلزم لها حساب فرعي (عمود "يلزم حساب فرعي")'],
      ['   → يمكن إدخال كود أو اسم العميل / المورد / الخزينة في عمود الحساب الفرعي'],
      ['11. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-01-01)'],
    ] : moduleName === 'opening_stock_balances' ? [
      ['4. العمود الأول "رقم المرجع / السند *" يحدد السند الذي ينتمي له كل صنف (مثال: OPB-000001)'],
      ['5. يمكن إدخال سند واحد أو عدة سندات في نفس الملف مع تكرار بيانات السند (رقم السند، التاريخ، الحسابات) لأسطر نفس السند'],
      ['6. كود حساب المخزون وكود حساب المقابل يجب أن يكونا مسجلين في دليل الحسابات (راجع ورقة "دليل الحسابات")'],
      ['7. كود الصنف يجب أن يكون مسجلاً في النظام (راجع ورقة "الأصناف")'],
      ['8. اسم أو كود المستودع يجب أن يطابق مستودع موجود في النظام (راجع ورقة "المستودعات")'],
      ['9. الكميات يجب أن تكون موجبة أكبر من صفر (> 0) والتكلفة لا تقل عن صفر (>= 0)'],
      ['10. يتم إنشاء القيد المحاسبي وحركات المخزون آلياً فور تنفيذ الاستيراد'],
      ['11. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
    ] : moduleName === 'stock_adjustments' ? [
      ['4. العمود الأول "رقم المرجع / إذن التسوية *" يحدد إذن التسوية الذي ينتمي له كل سطر (مثال: ADJ-000001)'],
      ['5. يمكن إدخال إذن تسوية واحد أو عدة أذون في نفس الملف مع تكرار بيانات الإذن لأسطر نفس التسوية'],
      ['6. كمية الفرق: أدخل رقماً موجباً (+) للزيادة الجردية، أو رقماً سالباً (-) للعجز الجردي'],
      ['7. كود حساب فروقات الجرد يجب أن يكون مسجلاً بدليل الحسابات (راجع ورقة "دليل الحسابات")'],
      ['8. كود الصنف واسم المستودع يجب أن يكونا مسجلين في النظام (راجع ورقتي "الأصناف" و "المستودعات")'],
      ['9. يتم إنشاء القيد المحاسبي والتسوية المخزنية آلياً فور التنفيذ'],
      ['10. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
    ] : moduleName === 'receipt_vouchers' ? [
      ['4. رقم السند اختياري؛ إذا تركته فارغاً سيقوم النظام بتوليد رقم تسلسلي تلقائي (RV-XXXXXX)'],
      ['5. طريقة السداد / الخزينة: أدخل اسم الخزينة أو البنك المسجل بالنظام (راجع ورقة "طرق السداد والخزن")'],
      ['6. نوع جهة القبض: اختر customer (عميل) أو supplier (مورد) أو account (حساب عام)'],
      ['7. كود / اسم الجهة: أدخل كود أو اسم العميل أو المورد أو كود الحساب المقابل (راجع أوراق "العملاء" و "الموردين" و "دليل الحسابات")'],
      ['8. يتم إنشاء قيد اليومية المقابل لسند القبض تلقائياً وموازنته بالكامل في شجرة الحسابات'],
      ['9. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
    ] : moduleName === 'payment_vouchers' ? [
      ['4. رقم السند اختياري؛ إذا تركته فارغاً سيقوم النظام بتوليد رقم تسلسلي تلقائي (PV-XXXXXX)'],
      ['5. طريقة السداد / الخزينة: أدخل اسم الخزينة أو البنك الصادر منه المبلغ (راجع ورقة "طرق السداد والخزن")'],
      ['6. جهة الصرف: اختر supplier (مورد) أو expense (مصروف) أو customer (عميل) أو account (حساب عام)'],
      ['7. كود / اسم الجهة: أدخل كود أو اسم المورد أو بند المصروف أو الحساب (راجع أوراق "الموردين"، "بنود المصروفات"، "دليل الحسابات")'],
      ['8. يتم إنشاء قيد الصرف المحاسبي تلقائياً وموازنته بالكامل فور التنفيذ'],
      ['9. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
    ] : moduleName === 'cash_transfers' ? [
      ['4. رقم التحويل اختياري؛ إذا تركته فارغاً سيقوم النظام بتوليد رقم تسلسلي تلقائي (TR-XXXXXX)'],
      ['5. أدخل اسم الخزينة/البنك المحول واسم الخزينة/البنك المستلم بدقة (راجع ورقة "طرق السداد والخزن")'],
      ['6. لا يمكن أن تكون جهة التحويل وجهة الاستلام متطابقتين'],
      ['7. يتم إنشاء قيد تحويل النقدية بين الحسابين تلقائياً وموازنته'],
      ['8. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
    ] : moduleName === 'customer_discounts' ? [
      ['4. رقم إشعار الخصم اختياري؛ إذا تركته فارغاً سيقوم النظام بتوليد رقم تسلسلي تلقائي (CDISC-XXXXX)'],
      ['5. كود أو اسم العميل يجب أن يطابق عميلاً مسجلاً بالنظام (راجع ورقة "العملاء")'],
      ['6. كود حساب الخصم المسموح به يجب أن يكون مسجلاً بدليل الحسابات (راجع ورقة "دليل الحسابات")'],
      ['7. يتم إنشاء قيد الخصم المسموح به تلقائياً (مدين: حساب الخصم، دائن: حساب العميل)'],
      ['8. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
    ] : moduleName === 'supplier_discounts' ? [
      ['4. رقم إشعار الخصم اختياري؛ إذا تركته فارغاً سيقوم النظام بتوليد رقم تسلسلي تلقائي (SDISC-XXXXX)'],
      ['5. كود أو اسم المورد يجب أن يطابق مورداً مسجلاً بالنظام (راجع ورقة "الموردين")'],
      ['6. كود حساب الخصم المكتسب يجب أن يكون مسجلاً بدليل الحسابات (راجع ورقة "دليل الحسابات")'],
      ['7. يتم إنشاء قيد الخصم المكتسب تلقائياً (مدين: حساب المورد، دائن: حساب الخصم المكتسب)'],
      ['8. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
    ] : moduleName === 'issued_cheques' ? [
      ['4. رقم الشيك وتاريخ التحرير وتاريخ الاستحقاق والمبلغ إجبارية'],
      ['5. نوع المستفيد: اختر supplier (شيك لمورد) أو general (شيك بدون مورد / جهات أخرى)'],
      ['6. في حالة شيك لمورد (supplier): كود أو اسم المورد إجباري ويجب أن يطابق مورداً مسجلاً بالنظام (راجع ورقة "الموردين")'],
      ['7. في حالة شيك بدون مورد (general): اسم المستفيد وكود الحساب المدين إجباريان (راجع ورقة "دليل الحسابات")'],
      ['8. البنك المسحوب منه: اسم طريقة السداد أو البنك المسجل بالنظام المسحوب منه الشيك (راجع ورقة "طرق السداد والخزن")'],
      ['9. كود حساب أوراق الدفع (الدائن): كود حساب أوراق الدفع بدليل الحسابات (مثل 210102)'],
      ['10. يتم إنشاء قيد إصدار الشيك المحاسبي (أوراق الدفع) وحفظ الشيك بحالة "صادر" آلياً فور التنفيذ'],
      ['11. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
    ] : moduleName === 'received_cheques' ? [
      ['4. رقم الحافظة / الإيصال اختياري؛ إذا تركته فارغاً سيتم توليده تلقائياً'],
      ['5. رقم الشيك وتاريخ الاستلام وتاريخ الاستحقاق والمبلغ واسم بنك الساحب إجبارية'],
      ['6. نوع الجهة الساحبة: اختر customer (شيك من عميل) أو general (شيك بدون عميل / إيرادات أخرى)'],
      ['7. في حالة شيك من عميل (customer): كود أو اسم العميل إجباري ويجب أن يطابق عميلاً مسجلاً بالنظام (راجع ورقة "العملاء")'],
      ['8. في حالة شيك بدون عميل (general): اسم الساحب/المحرر وكود الحساب الدائن إجباريان (راجع ورقة "دليل الحسابات")'],
      ['9. كود حساب أوراق القبض (المدين): كود حساب أوراق القبض بدليل الحسابات (مثل 110202)'],
      ['10. يتم إنشاء قيد إثبات استلام الشيكات وحافظة أوراق القبض بحالة "مستلم بالحافظة" آلياً فور التنفيذ'],
      ['11. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
    ] : moduleName === 'goods_receipts' ? [
      ['4. العمود الأول "رقم إذن الاستلام *" يجمع الأصناف التي تنتمي لنفس إذن الاستلام (مثل GR-000001)'],
      ['5. يجب تكرار بيانات إذن الاستلام (رقم الإذن، التاريخ، المستودع، والمورد) لكل صنف في نفس الإذن'],
      ['6. المستودع والأصناف يجب أن تكون مسجلة مسبقاً في النظام (راجع أوراق العمل المرفقة)'],
      ['7. كود المورد اختياري ولكن إن وُجد يجب أن يكون مسجلاً بالنظام (راجع ورقة "الموردين")'],
      ['8. الكميات يجب أن تكون موجبة أكبر من صفر (> 0) والتكلفة لا تقل عن صفر (>= 0)'],
      ['9. يتم إثبات حركات المخزون وطبقات التكلفة آلياً فور تنفيذ الاستيراد'],
      ['10. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
    ] : moduleName === 'warehouse_transfers' ? [
      ['4. العمود الأول "رقم التحويل *" يجمع الأصناف التي تنتمي لنفس عملية التحويل (مثل TR-000001)'],
      ['5. يجب تكرار بيانات عملية التحويل (رقم التحويل، التاريخ، مستودع المصدر، مستودع الوجهة) لكل صنف في نفس التحويل'],
      ['6. يجب أن يختلف مستودع المصدر عن مستودع الوجهة'],
      ['7. المستودعات والأصناف يجب أن تكون مسجلة مسبقاً بالنظام (راجع أوراق العمل المرفقة)'],
      ['8. الكميات المحولة يجب أن تكون موجبة أكبر من صفر (> 0)'],
      ['9. يتم تسجيل حركات الصرف والإضافة المخزنية آلياً فور تنفيذ الاستيراد'],
      ['10. تنسيق التواريخ: YYYY-MM-DD (مثال: 2026-10-17)'],
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
  if (hasExampleRow && wsInst['A2'] && wsInst['A3']) {
    wsInst['A2'].s = { font: { bold: true, color: { rgb: 'B91C1C' }, sz: 12 } };
    wsInst['A3'].s = { font: { bold: true, color: { rgb: 'B91C1C' }, sz: 11 } };
  }
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

    // Helper to detect if a row is an illustrative example row (if user forgot to delete it)
    const isExampleRow = (r: any[]) => {
      return r.some(cell => {
        if (cell === null || cell === undefined) return false;
        const s = String(cell).trim().toLowerCase();
        return s.includes('مثال توضيحي') ||
               s.includes('احذف هذا') ||
               s.includes('cust-example') ||
               s.includes('supp-example') ||
               s.includes('prod-example') ||
               s.includes('exp-example') ||
               s.includes('opb-000001') ||
               s.includes('adj-000001') ||
               s.includes('rv-000001') ||
               s.includes('pv-000001') ||
               s.includes('tr-000001') ||
               s.includes('cdisc-00001') ||
               s.includes('sdisc-00001') ||
               s.includes('chq-100251') ||
               s.includes('chq-100252') ||
               s.includes('chq-77881') ||
               s.includes('chq-77882') ||
               s.includes('chq-example') ||
               s.includes('opb-example') ||
               s.includes('adj-example') ||
               s.includes('rv-example') ||
               s.includes('pv-example') ||
               s.includes('tr-example') ||
               s.includes('cdisc-example') ||
               s.includes('sdisc-example') ||
               s.includes('gr-000001') ||
               s.includes('gr-example');
      });
    };

    const dataRowsWithIdx: { rawRow: any[]; originalRowNumber: number }[] = [];
    let skippedExamplesCount = 0;
    for (let idx = startIdx; idx < rawRows.length; idx++) {
      const r = rawRows[idx];
      if (r && r.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')) {
        if (isExampleRow(r)) {
          skippedExamplesCount++;
          continue;
        }
        dataRowsWithIdx.push({ rawRow: r, originalRowNumber: idx + 1 });
      }
    }

    if (dataRowsWithIdx.length === 0) {
      if (skippedExamplesCount > 0) {
        return res.status(400).json({
          error: 'الملف يحتوي فقط على صفوف الأمثلة التوضيحية! يرجى حذف صفوف الأمثلة التوضيحية وكتابة بياناتك الفعلية بدلاً منها قبل الرفع.'
        });
      }
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
    // 1 & 2: OPENING STOCK BALANCES & STOCK ADJUSTMENTS VALIDATION
    // ================================================================
    if (moduleName === 'opening_stock_balances' || moduleName === 'stock_adjustments') {
      const accountsRes = await pool.query('SELECT id, code, name FROM accounts WHERE company_id = $1', [companyId]);
      const accMap: Record<string, { id: string; code: string; name: string }> = {};
      accountsRes.rows.forEach(a => { accMap[String(a.code).trim()] = a; });

      const prodRes = await pool.query('SELECT id, code, name, inventory_account_id FROM products WHERE company_id = $1', [companyId]);
      const prodMapByCode: Record<string, any> = {};
      const prodMapByName: Record<string, any> = {};
      prodRes.rows.forEach(p => {
        if (p.code) prodMapByCode[String(p.code).trim().toLowerCase()] = p;
        if (p.name) prodMapByName[String(p.name).trim().toLowerCase()] = p;
      });

      const whRes = await pool.query('SELECT id, code, name FROM warehouses WHERE company_id = $1', [companyId]);
      const whMap: Record<string, any> = {};
      whRes.rows.forEach(w => {
        if (w.name) whMap[String(w.name).trim().toLowerCase()] = w;
        if (w.code) whMap[String(w.code).trim().toLowerCase()] = w;
      });

      const validatedRows: { rowNumber: number; data: Record<string, any> }[] = [];
      const rowsWithErrors: { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];

      for (const item of dataRowsWithIdx) {
        const rawRow = item.rawRow;
        const rowNumber = item.originalRowNumber;
        const errors: string[] = [];
        const rowData: Record<string, any> = {};

        for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
          const colDef = config.columns[colIdx];
          let val = rawRow[colIdx];
          if (typeof val === 'string') val = val.trim();

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
              errors.push(`تاريخ "${val}" يجب أن يكون بتنسيق YYYY-MM-DD`);
            }
          }

          rowData[colDef.key] = val;
        }

        // Product resolution
        const prodVal = String(rowData.product_code || '').trim().toLowerCase();
        const prod = prodMapByCode[prodVal] || prodMapByName[prodVal];
        if (!prod) {
          errors.push(`الصنف "${rowData.product_code}" غير مسجل في دليل الأصناف`);
        } else {
          rowData.product_id = prod.id;
          rowData.product_name = prod.name;
          rowData.product_code = prod.code;
          if (moduleName === 'stock_adjustments' && !prod.inventory_account_id) {
            errors.push(`الصنف "${prod.name}" ليس له حساب مخزون مرتبط ببطاقته`);
          }
        }

        // Warehouse resolution
        const whVal = String(rowData.warehouse_name || '').trim().toLowerCase();
        const wh = whMap[whVal];
        if (!wh) {
          errors.push(`المستودع "${rowData.warehouse_name}" غير مسجل في دليل المستودعات`);
        } else {
          rowData.warehouse_id = wh.id;
          rowData.warehouse_name = wh.name;
        }

        // Cost and Quantity validation
        const qty = Number(rowData.quantity) || 0;
        const cost = Number(rowData.unit_cost) || 0;

        if (moduleName === 'opening_stock_balances') {
          if (qty <= 0) errors.push('الكمية يجب أن تكون أكبر من صفر في رصيد أول المدة');
          if (cost < 0) errors.push('التكلفة لا يمكن أن تكون سالبة');

          // Accounts resolution
          const debitCode = String(rowData.debit_account_code || '').trim();
          const creditCode = String(rowData.credit_account_code || '').trim();
          const debitAcc = accMap[debitCode];
          const creditAcc = accMap[creditCode];

          if (!debitAcc) errors.push(`كود حساب المخزون المدين "${debitCode}" غير موجود بدليل الحسابات`);
          else {
            rowData.debit_account_id = debitAcc.id;
            rowData.debit_account_name = debitAcc.name;
          }

          if (!creditAcc) errors.push(`كود حساب المقابل الدائن "${creditCode}" غير موجود بدليل الحسابات`);
          else {
            rowData.credit_account_id = creditAcc.id;
            rowData.credit_account_name = creditAcc.name;
          }
        } else {
          // stock_adjustments
          if (qty === 0) errors.push('كمية الفرق لا يمكن أن تكون صفراً');
          if (cost < 0) errors.push('تكلفة الوحدة لا يمكن أن تكون سالبة');

          const accCode = String(rowData.account_code || '').trim();
          const acc = accMap[accCode];
          if (!acc) errors.push(`كود حساب فروقات الجرد والتسوية "${accCode}" غير موجود بدليل الحسابات`);
          else {
            rowData.account_id = acc.id;
            rowData.account_name = acc.name;
          }
        }

        if (errors.length > 0) {
          rowsWithErrors.push({ rowNumber, data: rowData, errors });
        } else {
          validatedRows.push({ rowNumber, data: rowData });
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
    // 3 & 4: RECEIPT & PAYMENT VOUCHERS VALIDATION
    // ================================================================
    if (moduleName === 'receipt_vouchers' || moduleName === 'payment_vouchers') {
      const pmRes = await pool.query('SELECT id, name, account_id FROM payment_methods WHERE company_id = $1', [companyId]);
      const pmMapByName: Record<string, any> = {};
      pmRes.rows.forEach(p => { pmMapByName[String(p.name).trim().toLowerCase()] = p; });

      const accountsRes = await pool.query('SELECT id, code, name FROM accounts WHERE company_id = $1', [companyId]);
      const accMap: Record<string, any> = {};
      accountsRes.rows.forEach(a => {
        accMap[String(a.code).trim()] = a;
        accMap[String(a.name).trim().toLowerCase()] = a;
      });

      const custRes = await pool.query('SELECT id, code, name, account_id FROM customers WHERE company_id = $1', [companyId]);
      const custMap: Record<string, any> = {};
      custRes.rows.forEach(c => {
        if (c.code) custMap[String(c.code).trim().toLowerCase()] = c;
        if (c.name) custMap[String(c.name).trim().toLowerCase()] = c;
      });

      const suppRes = await pool.query('SELECT id, code, name, account_id FROM suppliers WHERE company_id = $1', [companyId]);
      const suppMap: Record<string, any> = {};
      suppRes.rows.forEach(s => {
        if (s.code) suppMap[String(s.code).trim().toLowerCase()] = s;
        if (s.name) suppMap[String(s.name).trim().toLowerCase()] = s;
      });

      const expRes = await pool.query('SELECT id, code, name, account_id FROM expense_categories WHERE company_id = $1', [companyId]);
      const expMap: Record<string, any> = {};
      expRes.rows.forEach(e => {
        if (e.code) expMap[String(e.code).trim().toLowerCase()] = e;
        if (e.name) expMap[String(e.name).trim().toLowerCase()] = e;
      });

      const validatedRows: { rowNumber: number; data: Record<string, any> }[] = [];
      const rowsWithErrors: { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];

      for (const item of dataRowsWithIdx) {
        const rawRow = item.rawRow;
        const rowNumber = item.originalRowNumber;
        const errors: string[] = [];
        const rowData: Record<string, any> = {};

        for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
          const colDef = config.columns[colIdx];
          let val = rawRow[colIdx];
          if (typeof val === 'string') val = val.trim();

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
              errors.push(`تاريخ "${val}" يجب أن يكون بتنسيق YYYY-MM-DD`);
            }
          }

          rowData[colDef.key] = val;
        }

        const amount = Number(rowData.amount) || 0;
        if (amount <= 0) errors.push('المبلغ يجب أن يكون أكبر من صفر');

        // Payment method check
        const pmName = String(rowData.payment_method_name || '').trim().toLowerCase();
        const pm = pmMapByName[pmName];
        if (!pm) {
          errors.push(`طريقة السداد / الخزينة "${rowData.payment_method_name}" غير مسجلة في النظام`);
        } else if (!pm.account_id) {
          errors.push(`طريقة السداد / الخزينة "${pm.name}" غير مربوطة بحساب بدليل الحسابات`);
        } else {
          rowData.payment_method_id = pm.id;
          rowData.payment_method_name = pm.name;
          rowData.pm_account_id = pm.account_id;
        }

        // Entity check
        const entityCode = String(rowData.entity_code || '').trim().toLowerCase();
        if (moduleName === 'receipt_vouchers') {
          const type = rowData.entity_type || 'customer';
          if (type === 'customer') {
            const cust = custMap[entityCode];
            if (!cust) errors.push(`العميل "${rowData.entity_code}" غير مسجل بالنظام`);
            else if (!cust.account_id) errors.push(`العميل "${cust.name}" غير مربوط بحساب محاسبي`);
            else {
              rowData.customer_id = cust.id;
              rowData.customer_name = cust.name;
              rowData.counter_account_id = cust.account_id;
            }
          } else if (type === 'supplier') {
            const supp = suppMap[entityCode];
            if (!supp) errors.push(`المورد "${rowData.entity_code}" غير مسجل بالنظام`);
            else if (!supp.account_id) errors.push(`المورد "${supp.name}" غير مربوط بحساب محاسبي`);
            else {
              rowData.supplier_id = supp.id;
              rowData.supplier_name = supp.name;
              rowData.counter_account_id = supp.account_id;
            }
          } else {
            // General account
            const acc = accMap[entityCode];
            if (!acc) errors.push(`الحساب "${rowData.entity_code}" غير موجود بدليل الحسابات`);
            else {
              rowData.account_id = acc.id;
              rowData.counter_account_id = acc.id;
            }
          }
        } else {
          // payment_vouchers
          const type = rowData.paid_to_type || 'supplier';
          if (type === 'supplier') {
            const supp = suppMap[entityCode];
            if (!supp) errors.push(`المورد "${rowData.entity_code}" غير مسجل بالنظام`);
            else if (!supp.account_id) errors.push(`المورد "${supp.name}" غير مربوط بحساب محاسبي`);
            else {
              rowData.supplier_id = supp.id;
              rowData.supplier_name = supp.name;
              rowData.counter_account_id = supp.account_id;
            }
          } else if (type === 'expense') {
            const exp = expMap[entityCode];
            if (!exp) errors.push(`بند المصروف "${rowData.entity_code}" غير مسجل بالنظام`);
            else if (!exp.account_id) errors.push(`بند المصروف "${exp.name}" غير مربوط بحساب محاسبي`);
            else {
              rowData.expense_category_id = exp.id;
              rowData.category_name = exp.name;
              rowData.counter_account_id = exp.account_id;
            }
          } else if (type === 'customer') {
            const cust = custMap[entityCode];
            if (!cust) errors.push(`العميل "${rowData.entity_code}" غير مسجل بالنظام`);
            else if (!cust.account_id) errors.push(`العميل "${cust.name}" غير مربوط بحساب محاسبي`);
            else {
              rowData.customer_id = cust.id;
              rowData.customer_name = cust.name;
              rowData.counter_account_id = cust.account_id;
            }
          } else {
            // General account
            const acc = accMap[entityCode];
            if (!acc) errors.push(`الحساب "${rowData.entity_code}" غير موجود بدليل الحسابات`);
            else {
              rowData.account_id = acc.id;
              rowData.counter_account_id = acc.id;
            }
          }
        }

        if (errors.length > 0) {
          rowsWithErrors.push({ rowNumber, data: rowData, errors });
        } else {
          validatedRows.push({ rowNumber, data: rowData });
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
    // 5: CASH TRANSFERS VALIDATION
    // ================================================================
    if (moduleName === 'cash_transfers') {
      const pmRes = await pool.query('SELECT id, name, account_id FROM payment_methods WHERE company_id = $1', [companyId]);
      const pmMapByName: Record<string, any> = {};
      pmRes.rows.forEach(p => { pmMapByName[String(p.name).trim().toLowerCase()] = p; });

      const validatedRows: { rowNumber: number; data: Record<string, any> }[] = [];
      const rowsWithErrors: { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];

      for (const item of dataRowsWithIdx) {
        const rawRow = item.rawRow;
        const rowNumber = item.originalRowNumber;
        const errors: string[] = [];
        const rowData: Record<string, any> = {};

        for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
          const colDef = config.columns[colIdx];
          let val = rawRow[colIdx];
          if (typeof val === 'string') val = val.trim();

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
              errors.push(`تاريخ "${val}" يجب أن يكون بتنسيق YYYY-MM-DD`);
            }
          }

          rowData[colDef.key] = val;
        }

        const amount = Number(rowData.amount) || 0;
        if (amount <= 0) errors.push('المبلغ المحول يجب أن يكون أكبر من صفر');

        const fromName = String(rowData.from_payment_method_name || '').trim().toLowerCase();
        const toName = String(rowData.to_payment_method_name || '').trim().toLowerCase();

        const fromPm = pmMapByName[fromName];
        const toPm = pmMapByName[toName];

        if (!fromPm) errors.push(`الخزينة/البنك المحول منه "${rowData.from_payment_method_name}" غير مسجل بالنظام`);
        else if (!fromPm.account_id) errors.push(`الخزينة/البنك المحول منه "${fromPm.name}" غير مربوط بحساب بدليل الحسابات`);
        else {
          rowData.from_payment_method_id = fromPm.id;
          rowData.from_payment_method_name = fromPm.name;
          rowData.from_account_id = fromPm.account_id;
        }

        if (!toPm) errors.push(`الخزينة/البنك المحول إليه "${rowData.to_payment_method_name}" غير مسجل بالنظام`);
        else if (!toPm.account_id) errors.push(`الخزينة/البنك المحول إليه "${toPm.name}" غير مربوط بحساب بدليل الحسابات`);
        else {
          rowData.to_payment_method_id = toPm.id;
          rowData.to_payment_method_name = toPm.name;
          rowData.to_account_id = toPm.account_id;
        }

        if (fromPm && toPm && fromPm.id === toPm.id) {
          errors.push('لا يمكن أن تكون جهة التحويل وجهة الاستلام متطابقتين');
        }

        if (errors.length > 0) {
          rowsWithErrors.push({ rowNumber, data: rowData, errors });
        } else {
          validatedRows.push({ rowNumber, data: rowData });
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
    // 6 & 7: CUSTOMER & SUPPLIER DISCOUNTS VALIDATION
    // ================================================================
    if (moduleName === 'customer_discounts' || moduleName === 'supplier_discounts') {
      const accountsRes = await pool.query('SELECT id, code, name FROM accounts WHERE company_id = $1', [companyId]);
      const accMap: Record<string, any> = {};
      accountsRes.rows.forEach(a => {
        accMap[String(a.code).trim()] = a;
        accMap[String(a.name).trim().toLowerCase()] = a;
      });

      const custRes = await pool.query('SELECT id, code, name, account_id FROM customers WHERE company_id = $1', [companyId]);
      const custMap: Record<string, any> = {};
      custRes.rows.forEach(c => {
        if (c.code) custMap[String(c.code).trim().toLowerCase()] = c;
        if (c.name) custMap[String(c.name).trim().toLowerCase()] = c;
      });

      const suppRes = await pool.query('SELECT id, code, name, account_id FROM suppliers WHERE company_id = $1', [companyId]);
      const suppMap: Record<string, any> = {};
      suppRes.rows.forEach(s => {
        if (s.code) suppMap[String(s.code).trim().toLowerCase()] = s;
        if (s.name) suppMap[String(s.name).trim().toLowerCase()] = s;
      });

      const validatedRows: { rowNumber: number; data: Record<string, any> }[] = [];
      const rowsWithErrors: { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];

      for (const item of dataRowsWithIdx) {
        const rawRow = item.rawRow;
        const rowNumber = item.originalRowNumber;
        const errors: string[] = [];
        const rowData: Record<string, any> = {};

        for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
          const colDef = config.columns[colIdx];
          let val = rawRow[colIdx];
          if (typeof val === 'string') val = val.trim();

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
              errors.push(`تاريخ "${val}" يجب أن يكون بتنسيق YYYY-MM-DD`);
            }
          }

          rowData[colDef.key] = val;
        }

        const amount = Number(rowData.amount) || 0;
        if (amount <= 0) errors.push('مبلغ الخصم يجب أن يكون أكبر من صفر');

        // Account check
        const accCode = String(rowData.account_code || '').trim();
        const acc = accMap[accCode];
        if (!acc) errors.push(`كود حساب الخصم "${accCode}" غير موجود بدليل الحسابات`);
        else {
          rowData.account_id = acc.id;
          rowData.account_name = acc.name;
        }

        if (moduleName === 'customer_discounts') {
          const custCode = String(rowData.customer_code || '').trim().toLowerCase();
          const cust = custMap[custCode];
          if (!cust) errors.push(`العميل "${rowData.customer_code}" غير مسجل بالنظام`);
          else if (!cust.account_id) errors.push(`العميل "${cust.name}" غير مربوط بحساب بدليل الحسابات`);
          else {
            rowData.customer_id = cust.id;
            rowData.customer_name = cust.name;
            rowData.counter_account_id = cust.account_id;
          }
        } else {
          // supplier_discounts
          const suppCode = String(rowData.supplier_code || '').trim().toLowerCase();
          const supp = suppMap[suppCode];
          if (!supp) errors.push(`المورد "${rowData.supplier_code}" غير مسجل بالنظام`);
          else if (!supp.account_id) errors.push(`المورد "${supp.name}" غير مربوط بحساب بدليل الحسابات`);
          else {
            rowData.supplier_id = supp.id;
            rowData.supplier_name = supp.name;
            rowData.counter_account_id = supp.account_id;
          }
        }

        if (errors.length > 0) {
          rowsWithErrors.push({ rowNumber, data: rowData, errors });
        } else {
          validatedRows.push({ rowNumber, data: rowData });
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
    // 7: ISSUED CHEQUES VALIDATION (الشيكات الصادرة)
    // ================================================================
    if (moduleName === 'issued_cheques') {
      const accountsRes = await pool.query('SELECT id, code, name FROM accounts WHERE company_id = $1', [companyId]);
      const accMap: Record<string, { id: string; code: string; name: string }> = {};
      accountsRes.rows.forEach(a => { accMap[String(a.code).trim()] = a; });

      const suppRes = await pool.query('SELECT id, code, name, account_id FROM suppliers WHERE company_id = $1', [companyId]);
      const suppMap: Record<string, any> = {};
      suppRes.rows.forEach(s => {
        if (s.code) suppMap[String(s.code).trim().toLowerCase()] = s;
        if (s.name) suppMap[String(s.name).trim().toLowerCase()] = s;
      });

      const pmRes = await pool.query('SELECT id, name, type, bank_name, account_id FROM payment_methods WHERE company_id = $1', [companyId]);
      const pmMapByName: Record<string, any> = {};
      pmRes.rows.forEach(p => {
        pmMapByName[String(p.name).trim().toLowerCase()] = p;
        if (p.bank_name) pmMapByName[String(p.bank_name).trim().toLowerCase()] = p;
      });
      const firstBankPm = pmRes.rows.find((p: any) => p.type === 'bank' || p.bank_name) || pmRes.rows[0];

      const validatedRows: { rowNumber: number; data: Record<string, any> }[] = [];
      const rowsWithErrors: { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];

      for (const item of dataRowsWithIdx) {
        const rawRow = item.rawRow;
        const rowNumber = item.originalRowNumber;
        const errors: string[] = [];
        const rowData: Record<string, any> = {};

        for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
          const colDef = config.columns[colIdx];
          let val = rawRow[colIdx];
          if (typeof val === 'string') val = val.trim();

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
              errors.push(`تاريخ "${val}" يجب أن يكون بتنسيق YYYY-MM-DD`);
            }
          }

          rowData[colDef.key] = val;
        }

        const amount = Number(rowData.amount) || 0;
        if (amount <= 0) errors.push('مبلغ الشيك يجب أن يكون أكبر من صفر');

        if (rowData.issue_date && rowData.due_date && rowData.due_date < rowData.issue_date) {
          errors.push(`تاريخ استحقاق الشيك (${rowData.due_date}) لا يمكن أن يكون قبل تاريخ التحرير (${rowData.issue_date})`);
        }

        // Bank / payment method
        const bankInput = String(rowData.bank_name || '').trim().toLowerCase();
        let matchedPm = pmMapByName[bankInput];
        if (!matchedPm && bankInput) {
          matchedPm = pmRes.rows.find((p: any) => 
            p.name.toLowerCase().includes(bankInput) || (p.bank_name && p.bank_name.toLowerCase().includes(bankInput))
          );
        }
        if (!matchedPm) matchedPm = firstBankPm;

        if (matchedPm) {
          rowData.bank_account_id = matchedPm.id;
          rowData.bank_name = matchedPm.name;
        } else {
          errors.push(`البنك / طريقة السداد "${rowData.bank_name}" غير مسجلة في طرق السداد بالنظام`);
        }

        // Credit account (Notes Payable)
        const creditCode = String(rowData.credit_account_code || '').trim();
        const creditAcc = accMap[creditCode];
        if (!creditAcc) {
          errors.push(`حساب أوراق الدفع "${rowData.credit_account_code}" غير موجود بدليل الحسابات`);
        } else {
          rowData.credit_account_id = creditAcc.id;
          rowData.credit_account_name = creditAcc.name;
        }

        // Payee validation: supplier vs general
        const payeeType = rowData.payee_type === 'general' ? 'general' : 'supplier';
        rowData.payee_type = payeeType;

        if (payeeType === 'supplier') {
          const suppCode = String(rowData.supplier_code || '').trim().toLowerCase();
          const supp = suppMap[suppCode];
          if (!supp) {
            errors.push(`كود أو اسم المورد "${rowData.supplier_code}" غير مسجل بالنظام (مطلوب لشيكات الموردين)`);
          } else {
            rowData.supplier_id = supp.id;
            rowData.supplier_name = supp.name;
            if (!rowData.payee_name) rowData.payee_name = supp.name;

            // Debit account for supplier
            const debitCode = String(rowData.debit_account_code || '').trim();
            if (debitCode && accMap[debitCode]) {
              rowData.debit_account_id = accMap[debitCode].id;
              rowData.debit_account_name = accMap[debitCode].name;
            } else if (supp.account_id) {
              const suppAcc = accountsRes.rows.find((a: any) => a.id === supp.account_id);
              rowData.debit_account_id = supp.account_id;
              rowData.debit_account_name = suppAcc?.name || 'حساب الموردين';
            } else {
              errors.push(`المورد "${supp.name}" غير مربوط بحساب محاسبي، يرجى إدخال "كود الحساب المدين" في الملف`);
            }
          }
        } else {
          // General cheque (without supplier)
          if (!rowData.payee_name || String(rowData.payee_name).trim() === '') {
            errors.push('اسم المستفيد مطلوب للشيكات الصادرة بدون مورد');
          }
          const debitCode = String(rowData.debit_account_code || '').trim();
          const debitAcc = accMap[debitCode];
          if (!debitAcc) {
            errors.push(`كود الحساب المدين "${rowData.debit_account_code}" غير موجود بدليل الحسابات (إجباري للشيك بدون مورد)`);
          } else {
            rowData.debit_account_id = debitAcc.id;
            rowData.debit_account_name = debitAcc.name;
          }
        }

        if (errors.length > 0) {
          rowsWithErrors.push({ rowNumber, data: rowData, errors });
        } else {
          validatedRows.push({ rowNumber, data: rowData });
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
    // 8: RECEIVED CHEQUES VALIDATION (الشيكات الواردة)
    // ================================================================
    if (moduleName === 'received_cheques') {
      const accountsRes = await pool.query('SELECT id, code, name FROM accounts WHERE company_id = $1', [companyId]);
      const accMap: Record<string, { id: string; code: string; name: string }> = {};
      accountsRes.rows.forEach(a => { accMap[String(a.code).trim()] = a; });

      const custRes = await pool.query('SELECT id, code, name, account_id FROM customers WHERE company_id = $1', [companyId]);
      const custMap: Record<string, any> = {};
      custRes.rows.forEach(c => {
        if (c.code) custMap[String(c.code).trim().toLowerCase()] = c;
        if (c.name) custMap[String(c.name).trim().toLowerCase()] = c;
      });

      const validatedRows: { rowNumber: number; data: Record<string, any> }[] = [];
      const rowsWithErrors: { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];

      for (const item of dataRowsWithIdx) {
        const rawRow = item.rawRow;
        const rowNumber = item.originalRowNumber;
        const errors: string[] = [];
        const rowData: Record<string, any> = {};

        for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
          const colDef = config.columns[colIdx];
          let val = rawRow[colIdx];
          if (typeof val === 'string') val = val.trim();

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
              errors.push(`تاريخ "${val}" يجب أن يكون بتنسيق YYYY-MM-DD`);
            }
          }

          rowData[colDef.key] = val;
        }

        const amount = Number(rowData.amount) || 0;
        if (amount <= 0) errors.push('مبلغ الشيك يجب أن يكون أكبر من صفر');

        if (rowData.receive_date && rowData.due_date && rowData.due_date < rowData.receive_date) {
          errors.push(`تاريخ استحقاق الشيك (${rowData.due_date}) لا يمكن أن يكون قبل تاريخ الاستلام (${rowData.receive_date})`);
        }

        // Debit account (Notes Receivable)
        const debitCode = String(rowData.debit_account_code || '').trim();
        const debitAcc = accMap[debitCode];
        if (!debitAcc) {
          errors.push(`حساب أوراق القبض "${rowData.debit_account_code}" غير موجود بدليل الحسابات`);
        } else {
          rowData.debit_account_id = debitAcc.id;
          rowData.debit_account_name = debitAcc.name;
        }

        // Payer validation: customer vs general
        const payerType = rowData.payer_type === 'general' ? 'general' : 'customer';
        rowData.payer_type = payerType;

        if (payerType === 'customer') {
          const custCode = String(rowData.customer_code || '').trim().toLowerCase();
          const cust = custMap[custCode];
          if (!cust) {
            errors.push(`كود أو اسم العميل "${rowData.customer_code}" غير مسجل بالنظام (مطلوب لشيكات العملاء)`);
          } else {
            rowData.customer_id = cust.id;
            rowData.customer_name = cust.name;
            if (!rowData.payer_name) rowData.payer_name = cust.name;

            // Credit account for customer
            const creditCode = String(rowData.credit_account_code || '').trim();
            if (creditCode && accMap[creditCode]) {
              rowData.credit_account_id = accMap[creditCode].id;
              rowData.credit_account_name = accMap[creditCode].name;
            } else if (cust.account_id) {
              const custAcc = accountsRes.rows.find((a: any) => a.id === cust.account_id);
              rowData.credit_account_id = cust.account_id;
              rowData.credit_account_name = custAcc?.name || 'حساب العملاء';
            } else {
              errors.push(`العميل "${cust.name}" غير مربوط بحساب محاسبي، يرجى إدخال "كود الحساب الدائن" في الملف`);
            }
          }
        } else {
          // General cheque (without customer)
          if (!rowData.payer_name || String(rowData.payer_name).trim() === '') {
            errors.push('اسم الساحب / المحرر مطلوب للشيكات الواردة بدون عميل');
          }
          const creditCode = String(rowData.credit_account_code || '').trim();
          const creditAcc = accMap[creditCode];
          if (!creditAcc) {
            errors.push(`كود الحساب الدائن "${rowData.credit_account_code}" غير موجود بدليل الحسابات (إجباري للشيك بدون عميل)`);
          } else {
            rowData.credit_account_id = creditAcc.id;
            rowData.credit_account_name = creditAcc.name;
          }
        }

        if (errors.length > 0) {
          rowsWithErrors.push({ rowNumber, data: rowData, errors });
        } else {
          validatedRows.push({ rowNumber, data: rowData });
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
    // 8: GOODS RECEIPTS VALIDATION (أذون استلام البضائع)
    // ================================================================
    if (moduleName === 'goods_receipts') {
      const whRes = await pool.query('SELECT id, code, name FROM warehouses WHERE company_id = $1', [companyId]);
      const whMap: Record<string, any> = {};
      whRes.rows.forEach(w => {
        if (w.name) whMap[String(w.name).trim().toLowerCase()] = w;
        if (w.code) whMap[String(w.code).trim().toLowerCase()] = w;
      });

      const prodRes = await pool.query('SELECT id, code, name, unit FROM products WHERE company_id = $1', [companyId]);
      const prodMapByCode: Record<string, any> = {};
      const prodMapByName: Record<string, any> = {};
      prodRes.rows.forEach(p => {
        if (p.code) prodMapByCode[String(p.code).trim().toLowerCase()] = p;
        if (p.name) prodMapByName[String(p.name).trim().toLowerCase()] = p;
      });

      const suppRes = await pool.query('SELECT id, code, name FROM suppliers WHERE company_id = $1', [companyId]);
      const suppMapByCode: Record<string, any> = {};
      const suppMapByName: Record<string, any> = {};
      suppRes.rows.forEach(s => {
        if (s.code) suppMapByCode[String(s.code).trim().toLowerCase()] = s;
        if (s.name) suppMapByName[String(s.name).trim().toLowerCase()] = s;
      });

      const validatedRows: { rowNumber: number; data: Record<string, any> }[] = [];
      const rowsWithErrors: { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];
      const receiptGroups: Record<string, { rows: { rowNumber: number; data: Record<string, any>; errors: string[] }[]; warehouse_id?: string; date?: string; supplier_id?: string }> = {};

      for (const item of dataRowsWithIdx) {
        const rawRow = item.rawRow;
        const rowNumber = item.originalRowNumber;
        const errors: string[] = [];
        const rowData: Record<string, any> = {};

        for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
          const colDef = config.columns[colIdx];
          let val = rawRow[colIdx];
          if (typeof val === 'string') val = val.trim();

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
              errors.push(`تاريخ "${val}" يجب أن يكون بتنسيق YYYY-MM-DD`);
            }
          }

          rowData[colDef.key] = val;
        }

        // Warehouse resolution
        const whVal = String(rowData.warehouse_name || '').trim().toLowerCase();
        const wh = whMap[whVal];
        if (!wh) {
          errors.push(`المستودع "${rowData.warehouse_name}" غير مسجل في دليل المستودعات`);
        } else {
          rowData.warehouse_id = wh.id;
          rowData.warehouse_name = wh.name;
        }

        // Product resolution
        const prodVal = String(rowData.product_code || '').trim().toLowerCase();
        const prod = prodMapByCode[prodVal] || prodMapByName[prodVal];
        if (!prod) {
          errors.push(`الصنف "${rowData.product_code}" غير مسجل في دليل الأصناف`);
        } else {
          rowData.product_id = prod.id;
          rowData.product_name = prod.name;
          rowData.product_code = prod.code;
          rowData.unit = prod.unit || 'default';
        }

        // Supplier resolution (optional)
        if (rowData.supplier_code) {
          const suppVal = String(rowData.supplier_code).trim().toLowerCase();
          const supp = suppMapByCode[suppVal] || suppMapByName[suppVal];
          if (!supp) {
            errors.push(`المورد "${rowData.supplier_code}" غير مسجل في دليل الموردين`);
          } else {
            rowData.supplier_id = supp.id;
            rowData.supplier_name = supp.name;
          }
        }

        // Qty and Cost validation
        const qty = Number(rowData.quantity) || 0;
        const cost = Number(rowData.unit_cost) || 0;
        if (qty <= 0) errors.push('الكمية يجب أن تكون أكبر من صفر');
        if (cost < 0) errors.push('تكلفة الوحدة لا يمكن أن تكون سالبة');

        const rowObj = { rowNumber, data: rowData, errors };
        if (errors.length > 0) {
          rowsWithErrors.push(rowObj);
        } else {
          validatedRows.push({ rowNumber, data: rowData });
        }

        // Group by receipt_number
        const ref = String(rowData.receipt_number || `ROW-${rowNumber}`).trim();
        if (!receiptGroups[ref]) {
          receiptGroups[ref] = { rows: [], warehouse_id: rowData.warehouse_id, date: rowData.date, supplier_id: rowData.supplier_id };
        }
        receiptGroups[ref].rows.push(rowObj);
      }

      // Group consistency checks
      for (const [ref, group] of Object.entries(receiptGroups)) {
        const groupErrors: string[] = [];
        const firstRow = group.rows[0]?.data;
        for (let i = 1; i < group.rows.length; i++) {
          const cur = group.rows[i].data;
          if (cur.warehouse_id && firstRow.warehouse_id && cur.warehouse_id !== firstRow.warehouse_id) {
            groupErrors.push(`إذن الاستلام رقم "${ref}": لا يمكن أن يحتوي على مستودعات مختلفة لنفس الإذن`);
            break;
          }
          if (cur.date && firstRow.date && cur.date !== firstRow.date) {
            groupErrors.push(`إذن الاستلام رقم "${ref}": يجب أن يكون التاريخ موحداً لجميع أصناف نفس الإذن`);
            break;
          }
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
    // 9: WAREHOUSE TRANSFERS VALIDATION (التحويل بين المخازن)
    // ================================================================
    if (moduleName === 'warehouse_transfers') {
      const whRes = await pool.query('SELECT id, code, name FROM warehouses WHERE company_id = $1', [companyId]);
      const whMap: Record<string, any> = {};
      whRes.rows.forEach(w => {
        if (w.name) whMap[String(w.name).trim().toLowerCase()] = w;
        if (w.code) whMap[String(w.code).trim().toLowerCase()] = w;
      });

      const prodRes = await pool.query('SELECT id, code, name, unit, cost_price, weighted_average_cost FROM products WHERE company_id = $1', [companyId]);
      const prodMapByCode: Record<string, any> = {};
      const prodMapByName: Record<string, any> = {};
      prodRes.rows.forEach(p => {
        if (p.code) prodMapByCode[String(p.code).trim().toLowerCase()] = p;
        if (p.name) prodMapByName[String(p.name).trim().toLowerCase()] = p;
      });

      const validatedRows: { rowNumber: number; data: Record<string, any> }[] = [];
      const rowsWithErrors: { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];
      const transferGroups: Record<string, { rows: { rowNumber: number; data: Record<string, any>; errors: string[] }[]; from_warehouse_id?: string; to_warehouse_id?: string; date?: string }> = {};

      for (const item of dataRowsWithIdx) {
        const rawRow = item.rawRow;
        const rowNumber = item.originalRowNumber;
        const errors: string[] = [];
        const rowData: Record<string, any> = {};

        for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
          const colDef = config.columns[colIdx];
          let val = rawRow[colIdx];
          if (typeof val === 'string') val = val.trim();

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
              errors.push(`تاريخ "${val}" يجب أن يكون بتنسيق YYYY-MM-DD`);
            }
          }

          rowData[colDef.key] = val;
        }

        // Source warehouse
        const fromWhVal = String(rowData.from_warehouse_name || '').trim().toLowerCase();
        const fromWh = whMap[fromWhVal];
        if (!fromWh) {
          errors.push(`مستودع المصدر "${rowData.from_warehouse_name}" غير مسجل في دليل المستودعات`);
        } else {
          rowData.from_warehouse_id = fromWh.id;
          rowData.from_warehouse_name = fromWh.name;
        }

        // Destination warehouse
        const toWhVal = String(rowData.to_warehouse_name || '').trim().toLowerCase();
        const toWh = whMap[toWhVal];
        if (!toWh) {
          errors.push(`مستودع الوجهة "${rowData.to_warehouse_name}" غير مسجل في دليل المستودعات`);
        } else {
          rowData.to_warehouse_id = toWh.id;
          rowData.to_warehouse_name = toWh.name;
        }

        if (fromWh && toWh && fromWh.id === toWh.id) {
          errors.push('مستودع المصدر ومستودع الوجهة متطابقان؛ يجب أن يختلفا في عملية التحويل');
        }

        // Product resolution
        const prodVal = String(rowData.product_code || '').trim().toLowerCase();
        const prod = prodMapByCode[prodVal] || prodMapByName[prodVal];
        if (!prod) {
          errors.push(`الصنف "${rowData.product_code}" غير مسجل في دليل الأصناف`);
        } else {
          rowData.product_id = prod.id;
          rowData.product_name = prod.name;
          rowData.product_code = prod.code;
          rowData.unit = prod.unit || 'default';
          const currentCost = parseFloat(prod.weighted_average_cost || '0') || parseFloat(prod.cost_price || '0') || 0;
          rowData.unit_cost = currentCost;
        }

        const qty = Number(rowData.quantity) || 0;
        if (qty <= 0) errors.push('الكمية المحولة يجب أن تكون أكبر من صفر');

        const rowObj = { rowNumber, data: rowData, errors };
        if (errors.length > 0) {
          rowsWithErrors.push(rowObj);
        } else {
          validatedRows.push({ rowNumber, data: rowData });
        }

        // Group by transfer_number
        const ref = String(rowData.transfer_number || `ROW-${rowNumber}`).trim();
        if (!transferGroups[ref]) {
          transferGroups[ref] = { rows: [], from_warehouse_id: rowData.from_warehouse_id, to_warehouse_id: rowData.to_warehouse_id, date: rowData.date };
        }
        transferGroups[ref].rows.push(rowObj);
      }

      // Group consistency checks
      for (const [ref, group] of Object.entries(transferGroups)) {
        const groupErrors: string[] = [];
        const firstRow = group.rows[0]?.data;
        for (let i = 1; i < group.rows.length; i++) {
          const cur = group.rows[i].data;
          if (cur.from_warehouse_id && firstRow.from_warehouse_id && cur.from_warehouse_id !== firstRow.from_warehouse_id) {
            groupErrors.push(`عملية التحويل "${ref}": مستودع المصدر غير متطابق عبر أسطر التحويل`);
            break;
          }
          if (cur.to_warehouse_id && firstRow.to_warehouse_id && cur.to_warehouse_id !== firstRow.to_warehouse_id) {
            groupErrors.push(`عملية التحويل "${ref}": مستودع الوجهة غير متطابق عبر أسطر التحويل`);
            break;
          }
          if (cur.date && firstRow.date && cur.date !== firstRow.date) {
            groupErrors.push(`عملية التحويل "${ref}": التاريخ غير متطابق عبر أسطر التحويل`);
            break;
          }
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

    // ── OPENING STOCK BALANCES EXECUTE ───────────────────────────
    if (moduleName === 'opening_stock_balances') {
      const groups: Record<string, any[]> = {};
      for (const { data } of rows) {
        const ref = String(data.document_number || 'OPB-DEFAULT').trim();
        if (!groups[ref]) groups[ref] = [];
        groups[ref].push(data);
      }

      let count = 0;
      for (const [ref, lines] of Object.entries(groups)) {
        const docId = uuidv4();
        const firstLine = lines[0];
        const dateStr = firstLine.date || new Date().toISOString().split('T')[0];
        const docNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'opening_stock_balances', dateStr, ref.startsWith('OPB-DEFAULT') ? undefined : ref);
        const description = firstLine.description || `أرصدة افتتاحية للمخزون - سند رقم ${docNumber}`;

        await client.query(
          `INSERT INTO "opening_stock_balances" (
            id, company_id, document_number, date, debit_account_id, debit_account_name,
            credit_account_id, credit_account_name, description, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, docNumber, dateStr,
            firstLine.debit_account_id, firstLine.debit_account_name || null,
            firstLine.credit_account_id, firstLine.credit_account_name || null,
            description, req.user?.id || 'system'
          ]
        );

        let totalDocCost = 0;
        for (const line of lines) {
          const itemId = uuidv4();
          const qty = Number(line.quantity) || 0;
          const cost = Number(line.unit_cost) || 0;
          const lineTotal = Math.round(qty * cost * 100) / 100;
          totalDocCost += lineTotal;

          await client.query(
            `INSERT INTO "opening_stock_items" (
              id, opening_stock_id, product_id, product_name, product_code,
              warehouse_id, warehouse_name, quantity, unit_cost, total_cost, company_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
            [
              itemId, docId, line.product_id, line.product_name, line.product_code,
              line.warehouse_id, line.warehouse_name, qty, cost, lineTotal, companyId
            ]
          );

          if (qty > 0) {
            await recordAdjustment(
              client,
              companyId || '',
              line.warehouse_id || null,
              line.product_id,
              qty,
              cost,
              docId,
              docNumber,
              dateStr
            );
          }
        }

        totalDocCost = Math.round(totalDocCost * 100) / 100;
        if (totalDocCost > 0) {
          const jeId = uuidv4();
          const entryNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'journal_entries', dateStr);
          await client.query(
            `INSERT INTO "journal_entries" (
              id, company_id, entry_number, date, description,
              reference_id, reference_type, reference_number,
              total_debit, total_credit, status, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
            [
              jeId, companyId, entryNumber, dateStr, description,
              docId, 'opening_stock_balance', docNumber,
              totalDocCost, totalDocCost, req.user?.id || 'system'
            ]
          );

          await client.query(
            `INSERT INTO "journal_entry_lines" (
              id, journal_entry_id, company_id, account_id, account_name,
              debit, credit, description, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, CURRENT_TIMESTAMP)`,
            [
              uuidv4(), jeId, companyId, firstLine.debit_account_id, firstLine.debit_account_name || 'حساب المخزون',
              totalDocCost, `رصيد أول المدة للمخزون - سند رقم ${docNumber}`
            ]
          );

          await client.query(
            `INSERT INTO "journal_entry_lines" (
              id, journal_entry_id, company_id, account_id, account_name,
              debit, credit, description, created_at
            ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, CURRENT_TIMESTAMP)`,
            [
              uuidv4(), jeId, companyId, firstLine.credit_account_id, firstLine.credit_account_name || 'حساب مقابل أرصدة أول المدة',
              totalDocCost, `رصيد أول المدة للمخزون - سند رقم ${docNumber}`
            ]
          );
        }

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
    }

    // ── STOCK ADJUSTMENTS EXECUTE ─────────────────────────────────
    if (moduleName === 'stock_adjustments') {
      const groups: Record<string, any[]> = {};
      for (const { data } of rows) {
        const ref = String(data.adjustment_number || 'ADJ-DEFAULT').trim();
        if (!groups[ref]) groups[ref] = [];
        groups[ref].push(data);
      }

      let count = 0;
      for (const [ref, lines] of Object.entries(groups)) {
        const docId = uuidv4();
        const firstLine = lines[0];
        const dateStr = firstLine.date || new Date().toISOString().split('T')[0];
        const adjNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'stock_adjustments', dateStr, ref.startsWith('ADJ-DEFAULT') ? undefined : ref);
        const description = firstLine.description || `إذن تسوية مخزنية رقم ${adjNumber}`;

        await client.query(
          `INSERT INTO "stock_adjustments" (
            id, company_id, adjustment_number, date, account_id, account_name,
            description, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, adjNumber, dateStr,
            firstLine.account_id, firstLine.account_name || null,
            description, req.user?.id || 'system'
          ]
        );

        const journalLines: { account_id: string; debit: number; credit: number; description: string }[] = [];

        for (const line of lines) {
          const itemId = uuidv4();
          const qty = Number(line.quantity) || 0;
          const cost = Number(line.unit_cost) || 0;

          const costInfo = await recordAdjustment(
            client,
            companyId || '',
            line.warehouse_id || null,
            line.product_id,
            qty,
            cost,
            docId,
            adjNumber,
            dateStr
          );

          const totalCostValue = Math.abs(costInfo.totalCost || (qty * cost));
          const lineTotal = qty < 0 ? -totalCostValue : totalCostValue;

          await client.query(
            `INSERT INTO "stock_adjustment_items" (
              id, adjustment_id, product_id, product_name, product_code,
              warehouse_id, warehouse_name, quantity, unit_cost, total_cost, company_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
            [
              itemId, docId, line.product_id, line.product_name, line.product_code,
              line.warehouse_id, line.warehouse_name, qty, cost, lineTotal, companyId
            ]
          );

          const prodRes = await client.query('SELECT inventory_account_id FROM products WHERE id = $1', [line.product_id]);
          const invAccountId = prodRes.rows[0]?.inventory_account_id;

          if (invAccountId && totalCostValue > 0) {
            if (qty > 0) {
              journalLines.push({
                account_id: invAccountId,
                debit: totalCostValue,
                credit: 0,
                description: `تسوية إضافة مخزون صنف: ${line.product_name}`
              });
              journalLines.push({
                account_id: firstLine.account_id,
                debit: 0,
                credit: totalCostValue,
                description: `تسوية إضافة مخزون صنف: ${line.product_name}`
              });
            } else if (qty < 0) {
              journalLines.push({
                account_id: firstLine.account_id,
                debit: totalCostValue,
                credit: 0,
                description: `تسوية صرف مخزون صنف: ${line.product_name}`
              });
              journalLines.push({
                account_id: invAccountId,
                debit: 0,
                credit: totalCostValue,
                description: `تسوية صرف مخزون صنف: ${line.product_name}`
              });
            }
          }
        }

        if (journalLines.length > 0) {
          const jeId = uuidv4();
          const entryNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'journal_entries', dateStr);
          const totalDebit = Math.round(journalLines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
          const totalCredit = Math.round(journalLines.reduce((s, l) => s + l.credit, 0) * 100) / 100;

          await client.query(
            `INSERT INTO "journal_entries" (
              id, company_id, entry_number, date, description,
              reference_id, reference_type, reference_number,
              total_debit, total_credit, status, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
            [
              jeId, companyId, entryNumber, dateStr, description,
              docId, 'stock_adjustment', adjNumber,
              totalDebit, totalCredit, req.user?.id || 'system'
            ]
          );

          for (const jl of journalLines) {
            await client.query(
              `INSERT INTO "journal_entry_lines" (
                id, journal_entry_id, company_id, account_id, debit, credit, description, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
              [
                uuidv4(), jeId, companyId, jl.account_id,
                Math.round(jl.debit * 100) / 100, Math.round(jl.credit * 100) / 100,
                jl.description
              ]
            );
          }
        }

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
    }

    // ── RECEIPT VOUCHERS EXECUTE ──────────────────────────────────
    if (moduleName === 'receipt_vouchers') {
      let count = 0;
      for (const { data } of rows) {
        const docId = uuidv4();
        const dateStr = data.date || new Date().toISOString().split('T')[0];
        const vNum = await ensureUniqueSequenceNumber(client, companyId || '', 'receipt_vouchers', dateStr, data.voucher_number || undefined);
        const amount = Math.round(Number(data.amount) * 100) / 100;
        const desc = data.description || `سند قبض رقم ${vNum}`;

        await client.query(
          `INSERT INTO "receipt_vouchers" (
            id, company_id, voucher_number, date, amount, description,
            payment_method_id, payment_method_name, account_id,
            customer_id, customer_name, supplier_id, supplier_name,
            manual_reference, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, vNum, dateStr, amount, desc,
            data.payment_method_id, data.payment_method_name, data.pm_account_id,
            data.customer_id || null, data.customer_name || null,
            data.supplier_id || null, data.supplier_name || null,
            data.manual_reference || null
          ]
        );

        const jeId = uuidv4();
        const entryNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'journal_entries', dateStr);

        await client.query(
          `INSERT INTO "journal_entries" (
            id, company_id, entry_number, date, description,
            reference_id, reference_type, reference_number,
            total_debit, total_credit, status, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
          [
            jeId, companyId, entryNumber, dateStr, desc,
            docId, 'receipt_voucher', vNum,
            amount, amount, req.user?.id || 'system'
          ]
        );

        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id, account_name,
            debit, credit, description, sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 'payment_method', CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.pm_account_id, data.payment_method_name,
            amount, `سند قبض رقم ${vNum} - ${data.payment_method_name}`,
            data.payment_method_id
          ]
        );

        const subId = data.customer_id || data.supplier_id || null;
        const subType = data.customer_id ? 'customer' : (data.supplier_id ? 'supplier' : null);
        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id,
            customer_id, customer_name, supplier_id, supplier_name,
            debit, credit, description, sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.counter_account_id,
            data.customer_id || null, data.customer_name || null,
            data.supplier_id || null, data.supplier_name || null,
            amount, `سند قبض رقم ${vNum} - ${data.description || data.customer_name || data.supplier_name || ''}`,
            subId, subType
          ]
        );

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
    }

    // ── PAYMENT VOUCHERS EXECUTE ──────────────────────────────────
    if (moduleName === 'payment_vouchers') {
      let count = 0;
      for (const { data } of rows) {
        const docId = uuidv4();
        const dateStr = data.date || new Date().toISOString().split('T')[0];
        const vNum = await ensureUniqueSequenceNumber(client, companyId || '', 'payment_vouchers', dateStr, data.voucher_number || undefined);
        const amount = Math.round(Number(data.amount) * 100) / 100;
        const desc = data.description || `سند صرف رقم ${vNum}`;

        await client.query(
          `INSERT INTO "payment_vouchers" (
            id, company_id, voucher_number, date, amount, description,
            payment_method_id, payment_method_name, account_id,
            supplier_id, supplier_name, expense_category_id, category_name,
            customer_id, customer_name, paid_to_type, manual_reference, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, vNum, dateStr, amount, desc,
            data.payment_method_id, data.payment_method_name, data.pm_account_id,
            data.supplier_id || null, data.supplier_name || null,
            data.expense_category_id || null, data.category_name || null,
            data.customer_id || null, data.customer_name || null,
            data.paid_to_type || 'supplier', data.manual_reference || null
          ]
        );

        const jeId = uuidv4();
        const entryNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'journal_entries', dateStr);

        await client.query(
          `INSERT INTO "journal_entries" (
            id, company_id, entry_number, date, description,
            reference_id, reference_type, reference_number,
            total_debit, total_credit, status, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
          [
            jeId, companyId, entryNumber, dateStr, desc,
            docId, 'payment_voucher', vNum,
            amount, amount, req.user?.id || 'system'
          ]
        );

        const subId = data.supplier_id || data.customer_id || null;
        const subType = data.supplier_id ? 'supplier' : (data.customer_id ? 'customer' : null);
        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id,
            supplier_id, supplier_name, customer_id, customer_name,
            debit, credit, description, sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11, $12, CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.counter_account_id,
            data.supplier_id || null, data.supplier_name || null,
            data.customer_id || null, data.customer_name || null,
            amount, `سند صرف رقم ${vNum} - ${data.description || data.supplier_name || data.category_name || data.customer_name || ''}`,
            subId, subType
          ]
        );

        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id, account_name,
            debit, credit, description, sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, 'payment_method', CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.pm_account_id, data.payment_method_name,
            amount, `سند صرف رقم ${vNum} - ${data.payment_method_name}`,
            data.payment_method_id
          ]
        );

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
    }

    // ── CASH TRANSFERS EXECUTE ────────────────────────────────────
    if (moduleName === 'cash_transfers') {
      let count = 0;
      for (const { data } of rows) {
        const docId = uuidv4();
        const dateStr = data.date || new Date().toISOString().split('T')[0];
        const tNum = await ensureUniqueSequenceNumber(client, companyId || '', 'cash_transfers', dateStr, data.transfer_number || undefined);
        const amount = Math.round(Number(data.amount) * 100) / 100;
        const desc = data.description || `تحويل نقدية رقم ${tNum} من ${data.from_payment_method_name} إلى ${data.to_payment_method_name}`;

        await client.query(
          `INSERT INTO "cash_transfers" (
            id, company_id, transfer_number, date, amount,
            from_payment_method_id, to_payment_method_id,
            from_payment_method_name, to_payment_method_name,
            description, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, tNum, dateStr, amount,
            data.from_payment_method_id, data.to_payment_method_id,
            data.from_payment_method_name, data.to_payment_method_name,
            desc, req.user?.id || 'system'
          ]
        );

        const jeId = uuidv4();
        const entryNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'journal_entries', dateStr);

        await client.query(
          `INSERT INTO "journal_entries" (
            id, company_id, entry_number, date, description,
            reference_id, reference_type, reference_number,
            total_debit, total_credit, status, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
          [
            jeId, companyId, entryNumber, dateStr, desc,
            docId, 'transfer', tNum,
            amount, amount, req.user?.id || 'system'
          ]
        );

        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id, account_name,
            debit, credit, description, sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 'payment_method', CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.to_account_id, data.to_payment_method_name,
            amount, `تحويل وارد إلى ${data.to_payment_method_name} - سند رقم ${tNum}`,
            data.to_payment_method_id
          ]
        );

        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id, account_name,
            debit, credit, description, sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, 'payment_method', CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.from_account_id, data.from_payment_method_name,
            amount, `تحويل صادر من ${data.from_payment_method_name} - سند رقم ${tNum}`,
            data.from_payment_method_id
          ]
        );

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
    }

    // ── CUSTOMER DISCOUNTS EXECUTE ────────────────────────────────
    if (moduleName === 'customer_discounts') {
      let count = 0;
      for (const { data } of rows) {
        const docId = uuidv4();
        const dateStr = data.date || new Date().toISOString().split('T')[0];
        const dNum = await ensureUniqueSequenceNumber(client, companyId || '', 'customer_discounts', dateStr, data.number || undefined);
        const amount = Math.round(Number(data.amount) * 100) / 100;
        const desc = data.description || `خصم مسموح به إشعار رقم ${dNum} للعميل ${data.customer_name}`;

        await client.query(
          `INSERT INTO "customer_discounts" (
            id, company_id, number, date, customer_id, customer_name,
            account_id, account_name, amount, description, notes, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, dNum, dateStr, data.customer_id, data.customer_name,
            data.account_id, data.account_name, amount, desc, data.notes || null,
            req.user?.id || 'system'
          ]
        );

        const jeId = uuidv4();
        const entryNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'journal_entries', dateStr);

        await client.query(
          `INSERT INTO "journal_entries" (
            id, company_id, entry_number, date, description,
            reference_id, reference_type, reference_number,
            total_debit, total_credit, status, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
          [
            jeId, companyId, entryNumber, dateStr, desc,
            docId, 'customer_discount', dNum,
            amount, amount, req.user?.id || 'system'
          ]
        );

        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id, account_name,
            debit, credit, description, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.account_id, data.account_name || 'حساب الخصم المسموح به',
            amount, `خصم مسموح به - إشعار رقم ${dNum} - ${data.customer_name}`
          ]
        );

        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id,
            customer_id, customer_name, debit, credit, description,
            sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, 'customer', CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.counter_account_id,
            data.customer_id, data.customer_name,
            amount, `خصم مسموح به - إشعار رقم ${dNum} - ${data.customer_name}`,
            data.customer_id
          ]
        );

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
    }

    // ── SUPPLIER DISCOUNTS EXECUTE ────────────────────────────────
    if (moduleName === 'supplier_discounts') {
      let count = 0;
      for (const { data } of rows) {
        const docId = uuidv4();
        const dateStr = data.date || new Date().toISOString().split('T')[0];
        const dNum = await ensureUniqueSequenceNumber(client, companyId || '', 'supplier_discounts', dateStr, data.number || undefined);
        const amount = Math.round(Number(data.amount) * 100) / 100;
        const desc = data.description || `خصم مكتسب إشعار رقم ${dNum} من المورد ${data.supplier_name}`;

        await client.query(
          `INSERT INTO "supplier_discounts" (
            id, company_id, number, date, supplier_id, supplier_name,
            account_id, account_name, amount, description, notes, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, dNum, dateStr, data.supplier_id, data.supplier_name,
            data.account_id, data.account_name, amount, desc, data.notes || null,
            req.user?.id || 'system'
          ]
        );

        const jeId = uuidv4();
        const entryNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'journal_entries', dateStr);

        await client.query(
          `INSERT INTO "journal_entries" (
            id, company_id, entry_number, date, description,
            reference_id, reference_type, reference_number,
            total_debit, total_credit, status, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
          [
            jeId, companyId, entryNumber, dateStr, desc,
            docId, 'supplier_discount', dNum,
            amount, amount, req.user?.id || 'system'
          ]
        );

        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id,
            supplier_id, supplier_name, debit, credit, description,
            sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, 'supplier', CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.counter_account_id,
            data.supplier_id, data.supplier_name,
            amount, `خصم مكتسب - إشعار رقم ${dNum} - ${data.supplier_name}`,
            data.supplier_id
          ]
        );

        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id, account_name,
            debit, credit, description, created_at
          ) VALUES ($1, $2, $3, $4, $5, 0, $6, $7, CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.account_id, data.account_name || 'حساب الخصم المكتسب',
            amount, `خصم مكتسب - إشعار رقم ${dNum} - ${data.supplier_name}`
          ]
        );

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
    }

    // ── ISSUED CHEQUES EXECUTE (الشيكات الصادرة) ──────────────────────
    if (moduleName === 'issued_cheques') {
      let count = 0;
      for (const { data } of rows) {
        const docId = uuidv4();
        const issueDateStr = data.issue_date || new Date().toISOString().split('T')[0];
        const dueDateStr = data.due_date || issueDateStr;
        const serialNum = await ensureUniqueSequenceNumber(client, companyId || '', 'issued_cheques', issueDateStr);
        const amount = Math.round(Number(data.amount) * 100) / 100;
        const chequeNo = String(data.cheque_number || '').trim();
        const beneficiary = data.payee_name || data.supplier_name || 'المستفيد';
        const desc = data.description || `إصدار شيك رقم ${chequeNo} لصالح ${beneficiary}`;

        await client.query(
          `INSERT INTO "issued_cheques" (
            id, company_id, serial_number, cheque_number, cheque_type,
            supplier_id, supplier_name, payee_name, bank_account_id, bank_name,
            amount, currency, exchange_rate, issue_date, due_date, status,
            description, notes, debit_account_id, debit_account_name,
            credit_account_id, credit_account_name, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EGP', 1.0, $12, $13, 'ISSUED', $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, serialNum, chequeNo, data.payee_type === 'supplier' ? 'supplier' : 'other',
            data.supplier_id || null, data.supplier_name || null, beneficiary,
            data.bank_account_id, data.bank_name || null,
            amount, issueDateStr, dueDateStr, desc, data.notes || null,
            data.debit_account_id, data.debit_account_name || null,
            data.credit_account_id, data.credit_account_name || null,
            req.user?.id || 'system'
          ]
        );

        const jeId = uuidv4();
        const entryNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'journal_entries', issueDateStr);

        await client.query(
          `INSERT INTO "journal_entries" (
            id, company_id, entry_number, date, description,
            reference_id, reference_type, reference_number,
            total_debit, total_credit, status, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
          [
            jeId, companyId, entryNumber, issueDateStr, desc,
            docId, 'issued_cheque', chequeNo,
            amount, amount, req.user?.id || 'system'
          ]
        );

        // الطرف المدين (حساب المورد أو الحساب المدين)
        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id,
            supplier_id, supplier_name, debit, credit, description,
            sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.debit_account_id,
            data.supplier_id || null, data.supplier_name || null,
            amount, `إصدار شيك رقم ${chequeNo} - لصالح ${beneficiary}`,
            data.supplier_id || null, data.supplier_id ? 'supplier' : null
          ]
        );

        // الطرف الدائن (أوراق الدفع)
        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id, account_name,
            supplier_id, supplier_name, debit, credit, description, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.credit_account_id, data.credit_account_name || 'أوراق دفع',
            data.supplier_id || null, data.supplier_name || null,
            amount, `أوراق دفع - شيك رقم ${chequeNo} (استحقاق ${dueDateStr})`
          ]
        );

        await client.query(
          `UPDATE "issued_cheques" SET issue_journal_entry_id = $1 WHERE id = $2`,
          [jeId, docId]
        );

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
    }

    // ── RECEIVED CHEQUES EXECUTE (الشيكات الواردة) ────────────────────
    if (moduleName === 'received_cheques') {
      let count = 0;
      for (const { data } of rows) {
        const docId = uuidv4();
        const receiveDateStr = data.receive_date || new Date().toISOString().split('T')[0];
        const dueDateStr = data.due_date || receiveDateStr;
        const receiptNum = data.receipt_number && String(data.receipt_number).trim() !== ''
          ? String(data.receipt_number).trim()
          : await ensureUniqueSequenceNumber(client, companyId || '', 'receipt_vouchers', receiveDateStr);
        const serialNum = `${receiptNum}-${String(count + 1).padStart(2, '0')}`;
        const amount = Math.round(Number(data.amount) * 100) / 100;
        const chequeNo = String(data.cheque_number || '').trim();
        const payer = data.payer_name || data.customer_name || 'العميل / الساحب';
        const desc = data.description || `استلام شيك رقم ${chequeNo} من ${payer}`;

        await client.query(
          `INSERT INTO "received_cheques" (
            id, company_id, receipt_number, serial_number, cheque_number, cheque_type,
            customer_id, customer_name, payer_name, bank_name,
            amount, currency, exchange_rate, receive_date, due_date, status,
            description, notes, debit_account_id, debit_account_name,
            credit_account_id, credit_account_name, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EGP', 1.0, $12, $13, 'RECEIVED', $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, receiptNum, serialNum, chequeNo, data.payer_type === 'customer' ? 'customer' : 'other',
            data.customer_id || null, data.customer_name || null, payer, data.bank_name || null,
            amount, receiveDateStr, dueDateStr, desc, data.notes || null,
            data.debit_account_id, data.debit_account_name || null,
            data.credit_account_id, data.credit_account_name || null,
            req.user?.id || 'system'
          ]
        );

        const jeId = uuidv4();
        const entryNumber = await ensureUniqueSequenceNumber(client, companyId || '', 'journal_entries', receiveDateStr);

        await client.query(
          `INSERT INTO "journal_entries" (
            id, company_id, entry_number, date, description,
            reference_id, reference_type, reference_number,
            total_debit, total_credit, status, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'posted', $11, CURRENT_TIMESTAMP)`,
          [
            jeId, companyId, entryNumber, receiveDateStr, desc,
            docId, 'received_cheque', receiptNum || chequeNo,
            amount, amount, req.user?.id || 'system'
          ]
        );

        // الطرف المدين (أوراق القبض)
        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id, account_name,
            customer_id, customer_name, debit, credit, description,
            sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.debit_account_id, data.debit_account_name || 'أوراق قبض',
            data.customer_id || null, data.customer_name || null,
            amount, `أوراق قبض - استلام شيك رقم ${chequeNo} من ${payer}`,
            data.customer_id || null, data.customer_id ? 'customer' : null
          ]
        );

        // الطرف الدائن (حساب العميل أو الحساب الدائن)
        await client.query(
          `INSERT INTO "journal_entry_lines" (
            id, journal_entry_id, company_id, account_id,
            customer_id, customer_name, debit, credit, description,
            sub_account_id, sub_account_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
          [
            uuidv4(), jeId, companyId, data.credit_account_id,
            data.customer_id || null, data.customer_name || null,
            amount, `سداد بشيك رقم ${chequeNo} - ${payer}`,
            data.customer_id || null, data.customer_id ? 'customer' : null
          ]
        );

        await client.query(
          `UPDATE "received_cheques" SET receive_journal_entry_id = $1 WHERE id = $2`,
          [jeId, docId]
        );

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
    }

    // ── GOODS RECEIPTS EXECUTE (أذون استلام البضائع) ──────────────────
    if (moduleName === 'goods_receipts') {
      const groups: Record<string, any[]> = {};
      for (const { data } of rows) {
        const ref = String(data.receipt_number || 'GR-DEFAULT').trim();
        if (!groups[ref]) groups[ref] = [];
        groups[ref].push(data);
      }

      let count = 0;
      for (const [ref, lines] of Object.entries(groups)) {
        const docId = uuidv4();
        const firstLine = lines[0];
        const dateStr = firstLine.date || new Date().toISOString().split('T')[0];
        const docNumber = await ensureUniqueSequenceNumber(
          client,
          companyId || '',
          'goods_receipts',
          dateStr,
          ref.startsWith('GR-DEFAULT') ? undefined : ref
        );
        const description = firstLine.notes || `إذن استلام بضائع مستورد - ${docNumber}`;

        await client.query(
          `INSERT INTO "goods_receipts" (
            id, company_id, receipt_number, warehouse_id, warehouse_name,
            supplier_id, supplier_name, date, status, document_origin,
            created_automatically, notes, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'posted', 'excel_import', false, $9, $10, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, docNumber, firstLine.warehouse_id, firstLine.warehouse_name,
            firstLine.supplier_id || null, firstLine.supplier_name || null,
            dateStr, description, req.user?.id || 'system'
          ]
        );

        const movementLines: any[] = [];
        for (const line of lines) {
          const itemId = uuidv4();
          const qty = Number(line.quantity) || 0;
          const cost = Number(line.unit_cost) || 0;
          const lineTotal = Math.round(qty * cost * 100) / 100;

          await client.query(
            `INSERT INTO "goods_receipt_items" (
              id, goods_receipt_id, company_id, product_id, product_name, product_code,
              unit, quantity, unit_cost, total_cost, batch_id, serial_number, notes,
              billed_quantity, remaining_quantity, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, $14, CURRENT_TIMESTAMP)`,
            [
              itemId, docId, companyId, line.product_id, line.product_name, line.product_code,
              line.unit || 'default', qty, cost, lineTotal, line.batch_id || null, line.serial_number || null,
              line.notes || null, qty
            ]
          );

          if (qty > 0) {
            await recordGoodsReceipt(
              client,
              companyId || '',
              firstLine.warehouse_id || null,
              line.product_id,
              qty,
              cost,
              docId,
              docNumber,
              dateStr
            );

            movementLines.push({
              product_id: line.product_id,
              unit_id: line.unit || 'default',
              quantity: qty,
              direction: 'IN',
              unit_cost: cost,
              total_cost: lineTotal,
              batch_id: line.batch_id || null,
              serial_number: line.serial_number || null,
              notes: line.notes || null
            });
          }
        }

        if (movementLines.length > 0) {
          await InventoryMovementService.createMovement({
            company_id: companyId,
            warehouse_id: firstLine.warehouse_id || null,
            movement_number: docNumber,
            movement_type: 'goods_receipt',
            source_document_type: 'goods_receipt',
            source_document_id: docId,
            movement_date: dateStr,
            status: 'posted',
            notes: description,
            created_by: req.user?.id || 'system'
          }, movementLines, client);
        }

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
    }

    // ── WAREHOUSE TRANSFERS EXECUTE (التحويل بين المخازن) ────────────────
    if (moduleName === 'warehouse_transfers') {
      const groups: Record<string, any[]> = {};
      for (const { data } of rows) {
        const ref = String(data.transfer_number || 'TR-DEFAULT').trim();
        if (!groups[ref]) groups[ref] = [];
        groups[ref].push(data);
      }

      let count = 0;
      for (const [ref, lines] of Object.entries(groups)) {
        const docId = uuidv4();
        const firstLine = lines[0];
        const dateStr = firstLine.date || new Date().toISOString().split('T')[0];
        const docNumber = await ensureUniqueSequenceNumber(
          client,
          companyId || '',
          'warehouse_transfers',
          dateStr,
          ref.startsWith('TR-DEFAULT') ? undefined : ref
        );
        const description = firstLine.notes || `تحويل مخزني مستورد - ${docNumber}`;

        await client.query(
          `INSERT INTO "warehouse_transfers" (
            id, company_id, transfer_number, from_warehouse_id, to_warehouse_id,
            from_warehouse_name, to_warehouse_name, date, description, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
          [
            docId, companyId, docNumber, firstLine.from_warehouse_id, firstLine.to_warehouse_id,
            firstLine.from_warehouse_name, firstLine.to_warehouse_name,
            dateStr, description, req.user?.id || 'system'
          ]
        );

        const fromMovementLines: any[] = [];
        const toMovementLines: any[] = [];

        for (const line of lines) {
          const itemId = uuidv4();
          const qty = Number(line.quantity) || 0;

          const prodRes = await client.query('SELECT cost_price, weighted_average_cost FROM products WHERE id = $1', [line.product_id]);
          const currentCost = (prodRes.rows[0] && (parseFloat(prodRes.rows[0].weighted_average_cost || '0') || parseFloat(prodRes.rows[0].cost_price || '0'))) || Number(line.unit_cost) || 0;
          const lineTotal = Math.round(qty * currentCost * 100) / 100;

          await client.query(
            `INSERT INTO "warehouse_transfer_items" (
              id, transfer_id, product_id, product_name, product_code,
              quantity, unit_cost, total_cost, company_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
            [
              itemId, docId, line.product_id, line.product_name, line.product_code,
              qty, currentCost, lineTotal, companyId
            ]
          );

          if (qty > 0) {
            await recordTransfer(
              client,
              companyId || '',
              firstLine.from_warehouse_id,
              firstLine.to_warehouse_id,
              line.product_id,
              qty,
              docId,
              docNumber,
              dateStr
            );

            fromMovementLines.push({
              product_id: line.product_id,
              unit_id: line.unit || 'default',
              quantity: qty,
              direction: 'OUT',
              unit_cost: currentCost,
              total_cost: lineTotal,
              notes: line.notes || null
            });

            toMovementLines.push({
              product_id: line.product_id,
              unit_id: line.unit || 'default',
              quantity: qty,
              direction: 'IN',
              unit_cost: currentCost,
              total_cost: lineTotal,
              notes: line.notes || null
            });
          }
        }

        if (fromMovementLines.length > 0) {
          await InventoryMovementService.createMovement({
            company_id: companyId,
            warehouse_id: firstLine.from_warehouse_id,
            movement_number: `${docNumber}-OUT`,
            movement_type: 'warehouse_transfer',
            source_document_type: 'warehouse_transfer',
            source_document_id: docId,
            movement_date: dateStr,
            status: 'posted',
            notes: `تحويل منصرف إلى ${firstLine.to_warehouse_name} - ${docNumber}`,
            created_by: req.user?.id || 'system'
          }, fromMovementLines, client);

          await InventoryMovementService.createMovement({
            company_id: companyId,
            warehouse_id: firstLine.to_warehouse_id,
            movement_number: `${docNumber}-IN`,
            movement_type: 'warehouse_transfer',
            source_document_type: 'warehouse_transfer',
            source_document_id: docId,
            movement_date: dateStr,
            status: 'posted',
            notes: `تحويل وارد من ${firstLine.from_warehouse_name} - ${docNumber}`,
            created_by: req.user?.id || 'system'
          }, toMovementLines, client);
        }

        count++;
      }

      await client.query('COMMIT');
      return res.json({ success: true, inserted: count, updated: 0, total: rows.length });
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
