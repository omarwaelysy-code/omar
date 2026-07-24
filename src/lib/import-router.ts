import { Router } from 'express';
import * as XLSX from 'xlsx';
import { authenticateToken, AuthRequest } from './auth-middleware';
import pool from './postgres';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

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
      { key: 'revenue_account_code',    label: 'كود حساب الإيرادات *',               labelEn: 'Revenue Account Code (Required) e.g. 41',           required: true,  type: 'account_code', example: '41',   note: 'حساب المبيعات/الإيرادات المرتبط بهذا الصنف' },
      { key: 'cost_account_code',       label: 'كود حساب التكلفة *',                 labelEn: 'Cost of Goods Account Code (Required) e.g. 51',     required: true,  type: 'account_code', example: '51',   note: 'حساب تكلفة البضاعة المباعة' },
      { key: 'inventory_account_code',  label: 'كود حساب المخزون',                   labelEn: 'Inventory Account Code e.g. 1115',                  required: false, type: 'account_code', example: '1115', note: 'حساب المخزون (للأصناف المخزنية فقط)' },
      { key: 'vat_account_code',        label: 'كود حساب ضريبة القيمة المضافة',       labelEn: 'VAT Account Code e.g. 2221',                        required: false, type: 'account_code', example: '2221', note: 'حساب ضريبة القيمة المضافة المحصلة' },
      // إعدادات الضريبة والمخزون
      { key: 'vat_rate',                label: 'نسبة الضريبة %',                     labelEn: 'VAT Rate % (e.g. 15)',                              required: false, type: 'number',       example: '15' },
      { key: 'inventory_cost_method',   label: 'طريقة تكلفة المخزون',                labelEn: 'Inventory Costing Method',                          required: false, type: 'select',       options: ['WAC', 'FIFO', 'specific'], example: 'WAC' },
      // المجموعة
      { key: 'item_group_code',         label: 'كود مجموعة الأصناف',                 labelEn: 'Item Group Code (must match existing group code)',   required: false, type: 'text',         example: 'GRP-001' },
      // الصورة
      { key: 'image_url',               label: 'رابط صورة الصنف (URL)',               labelEn: 'Product Image URL (optional, paste a public image link)', required: false, type: 'text',   example: 'https://example.com/product.jpg', note: 'ارفع الصورة على الإنترنت ثم الصق الرابط هنا' },
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

  // Load existing account codes to embed as reference in template
  let accountsRef: { code: string; name: string }[] = [];
  try {
    const acRes = await pool.query(
      `SELECT code, name FROM accounts WHERE company_id = $1 ORDER BY code`,
      [companyId]
    );
    accountsRef = acRes.rows;
  } catch (e) { /* non-fatal */ }

  const wb = XLSX.utils.book_new();

  // ── Data Sheet ──────────────────────────────────────────────────
  const arabicHeaders  = config.columns.map(c => c.label);
  const englishHeaders = config.columns.map(c => c.labelEn);
  const notesRow       = config.columns.map(c => c.note || '');
  const exampleRow     = config.columns.map(c => c.example || '');

  const wsData: any[][] = [arabicHeaders, englishHeaders, notesRow, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Style rows
  const colCount = config.columns.length;
  for (let c = 0; c < colCount; c++) {
    // Row 0 – Arabic header (green)
    const r0 = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[r0]) ws[r0].s = { fill: { fgColor: { rgb: '1E6E42' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
    // Row 1 – English description (light green)
    const r1 = XLSX.utils.encode_cell({ r: 1, c });
    if (ws[r1]) ws[r1].s = { fill: { fgColor: { rgb: 'D9F0E4' } }, font: { italic: true, sz: 10 }, alignment: { horizontal: 'center', wrapText: true } };
    // Row 2 – Notes row (light blue)
    const r2 = XLSX.utils.encode_cell({ r: 2, c });
    if (ws[r2]) ws[r2].s = { fill: { fgColor: { rgb: 'DDEEFF' } }, font: { italic: true, sz: 9, color: { rgb: '336699' } }, alignment: { horizontal: 'center', wrapText: true } };
    // Row 3 – Example (yellow)
    const r3 = XLSX.utils.encode_cell({ r: 3, c });
    if (ws[r3]) ws[r3].s = { fill: { fgColor: { rgb: 'FFF8E1' } }, font: { italic: true, color: { rgb: '8B6914' }, sz: 10 }, alignment: { horizontal: 'center' } };
  }

  ws['!cols'] = config.columns.map(() => ({ wch: 30 }));
  ws['!rows'] = [{ hpt: 30 }, { hpt: 25 }, { hpt: 22 }, { hpt: 20 }];
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
  if (hasAccountCols && accountsRef.length > 0) {
    const accData: any[][] = [['كود الحساب', 'اسم الحساب']];
    accountsRef.forEach(a => accData.push([a.code, a.name]));
    const wsAcc = XLSX.utils.aoa_to_sheet(accData);
    wsAcc['!cols'] = [{ wch: 18 }, { wch: 40 }];
    // Style header
    ['A1', 'B1'].forEach(ref => {
      if (wsAcc[ref]) wsAcc[ref].s = { fill: { fgColor: { rgb: '1E3A5F' } }, font: { bold: true, color: { rgb: 'FFFFFF' } } };
    });
    XLSX.utils.book_append_sheet(wb, wsAcc, 'دليل الحسابات');
  }

  // ── Instructions Sheet ────────────────────────────────────────
  const instructions = [
    ['تعليمات الاستيراد - ' + config.nameAr],
    [''],
    ['1. لا تحذف أو تعدل الصفوف الأربعة الأولى (رؤوس + شرح + ملاحظات + مثال)'],
    ['2. ابدأ إدخال البيانات من الصف الخامس'],
    ['3. الحقول المعلمة بـ (*) إجبارية'],
    ['4. الأكواد يجب أن تكون فريدة وغير مكررة'],
    ['5. أعمدة "كود الحساب" يجب إدخال كود الحساب الموجود في دليل الحسابات'],
    ['   → راجع ورقة "دليل الحسابات" للحصول على الأكواد الصحيحة'],
    ['6. تنسيق التواريخ: YYYY-MM-DD (مثال: 2025-01-01)'],
    ['7. القيم المسموح بها للحقول المنسدلة موجودة في ورقة "القيم المسموح بها"'],
    ...(moduleName === 'products' ? [
      [''],
      ['ملاحظات خاصة بالأصناف:'],
      ['- عمود "رابط صورة الصنف": الصق رابط URL لصورة مرفوعة على الإنترنت (اختياري)'],
      ['- طريقة التكلفة: WAC = متوسط التكلفة، FIFO = أول دخول أول خروج'],
      ['- كود مجموعة الأصناف يجب أن يطابق كود مجموعة موجودة في النظام'],
    ] : []),
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

    if (rawRows.length < 4) {
      return res.status(400).json({ error: 'الملف فارغ أو لا يحتوي على بيانات كافية (يجب أن يحتوي على 4 صفوف رأسية على الأقل)' });
    }

    // Validate headers (row 0 = Arabic headers)
    const arabicHeaderRow = rawRows[0] as string[];
    const expectedHeaders  = config.columns.map(c => c.label);
    const headerErrors: string[] = [];
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (arabicHeaderRow[i] !== expectedHeaders[i]) {
        headerErrors.push(`العمود ${i + 1}: المتوقع "${expectedHeaders[i]}" - الموجود "${arabicHeaderRow[i] || 'فارغ'}"`);
      }
    }
    if (headerErrors.length > 0) {
      return res.status(400).json({ error: 'رؤوس الأعمدة لا تتطابق مع النموذج - استخدم النموذج المُنزَّل من النظام', headerErrors });
    }

    // Data rows start from row index 4 (skip 4 header rows)
    const dataRows = rawRows.slice(4).filter(row => row.some(cell => cell !== undefined && cell !== ''));

    // ── Load reference data ──────────────────────────────────────
    // Account map: code → { id, name }
    const accountMap: Record<string, { id: string; name: string }> = {};
    try {
      const acRes = await pool.query('SELECT id, code, name FROM accounts WHERE company_id = $1', [companyId]);
      acRes.rows.forEach((r: any) => { accountMap[String(r.code).trim()] = { id: r.id, name: r.name }; });
    } catch (e) { console.warn('Could not load accounts:', e); }

    // Existing unique keys for duplicate detection
    let existingCodes = new Set<string>();
    if (config.uniqueKey) {
      try {
        const exRes = await pool.query(
          `SELECT ${config.uniqueKey} FROM ${config.dbTable} WHERE company_id = $1`,
          [companyId]
        );
        existingCodes = new Set(exRes.rows.map((r: any) => String(r[config.uniqueKey!]).trim()));
      } catch (e) { /* non-fatal */ }
    }

    // Item group code map (products only)
    const itemGroupMap: Record<string, string> = {};
    if (moduleName === 'products') {
      try {
        const igRes = await pool.query('SELECT id, code FROM item_groups WHERE company_id = $1', [companyId]);
        igRes.rows.forEach((r: any) => { itemGroupMap[r.code] = r.id; });
      } catch (e) { /* non-fatal */ }
    }

    const validatedRows:   { rowNumber: number; data: Record<string, any> }[] = [];
    const rowsWithErrors:  { rowNumber: number; data: Record<string, any>; errors: string[] }[] = [];
    const codesInFile = new Set<string>();

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const rawRow    = dataRows[rowIdx];
      const rowNumber = rowIdx + 5; // actual Excel row (4 headers + 1-based)
      const errors: string[] = [];
      const rowData: Record<string, any> = {};

      for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
        const colDef = config.columns[colIdx];
        let value    = rawRow[colIdx];

        // Trim strings
        if (typeof value === 'string') value = value.trim();

        // Excel date serial → string
        if (colDef.type === 'date' && typeof value === 'number') {
          try {
            const d = XLSX.SSF.parse_date_code(value);
            if (d) value = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
          } catch { /* ignore */ }
        }

        const isEmpty = value === undefined || value === null || value === '';

        // Required check
        if (colDef.required && isEmpty) {
          errors.push(`الحقل "${colDef.label.replace(' *','')}" مطلوب`);
          rowData[colDef.key] = null;
          continue;
        }
        if (isEmpty) { rowData[colDef.key] = null; continue; }

        // Type validations
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

        // Account code resolution
        if (colDef.type === 'account_code') {
          const codeStr = String(value).trim();
          const acct = accountMap[codeStr];
          if (!acct) {
            errors.push(`كود الحساب "${codeStr}" في حقل "${colDef.label.replace(' *','')}" غير موجود في دليل الحسابات`);
            rowData[colDef.key] = null;
            continue;
          }
          // Store the resolved account info using the mapped field names
          const fieldBase = colDef.key.replace('_code', ''); // e.g. account_code → account
          rowData[`${fieldBase}_id`]   = acct.id;
          rowData[`${fieldBase}_name`] = acct.name;
          rowData[colDef.key] = codeStr; // keep for display in preview
          continue;
        }

        rowData[colDef.key] = value;
      }

      // Duplicate code check within file
      const codeKey = config.uniqueKey;
      if (codeKey && rowData[codeKey]) {
        const codeVal = String(rowData[codeKey]).trim();
        if (codesInFile.has(codeVal)) {
          errors.push(`الكود "${codeVal}" مكرر داخل الملف`);
        } else {
          codesInFile.add(codeVal);
        }
        if (existingCodes.has(codeVal)) rowData['_existing'] = true;
      }

      // Products: resolve item_group_code → item_group_id
      if (moduleName === 'products' && rowData['item_group_code']) {
        const igId = itemGroupMap[rowData['item_group_code']];
        if (!igId) {
          errors.push(`كود مجموعة الأصناف "${rowData['item_group_code']}" غير موجود في النظام`);
        } else {
          rowData['item_group_id']   = igId;
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
      total:       dataRows.length,
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

    for (const { data, rowNumber } of rows) {
      // Build row – strip display-only fields (_code suffix fields kept for account resolution)
      const rowToInsert: Record<string, any> = { ...data, company_id: companyId };
      delete rowToInsert['_existing'];

      // Remove raw _code display fields (account_code, revenue_account_code, etc.)
      // The resolved _id and _name fields are already in rowData from validation
      Object.keys(rowToInsert).forEach(k => {
        if (k.endsWith('_code') && !['employee_code', 'item_group_code'].includes(k)) {
          delete rowToInsert[k];
        }
      });

      // Ensure ID
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
