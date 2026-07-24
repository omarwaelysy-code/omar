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
const IMPORT_CONFIGS: Record<string, {
  nameAr: string;
  columns: { key: string; label: string; labelEn: string; required: boolean; type: string; options?: string[]; example?: string }[];
  dbTable: string;
  uniqueKey?: string;
}> = {
  customers: {
    nameAr: 'العملاء',
    dbTable: 'customers',
    uniqueKey: 'code',
    columns: [
      { key: 'code', label: 'كود العميل *', labelEn: 'Customer Code (Required)', required: true, type: 'text', example: 'CUST-001' },
      { key: 'name', label: 'اسم العميل *', labelEn: 'Customer Name (Required)', required: true, type: 'text', example: 'شركة ABC للتجارة' },
      { key: 'mobile', label: 'رقم الجوال', labelEn: 'Mobile Number', required: false, type: 'text', example: '0501234567' },
      { key: 'email', label: 'البريد الإلكتروني', labelEn: 'Email', required: false, type: 'text', example: 'info@abc.com' },
      { key: 'address', label: 'العنوان', labelEn: 'Address', required: false, type: 'text', example: 'الرياض، السعودية' },
      { key: 'tax_number', label: 'الرقم الضريبي', labelEn: 'Tax Number', required: false, type: 'text', example: '300123456789' },
      { key: 'opening_balance', label: 'الرصيد الافتتاحي', labelEn: 'Opening Balance', required: false, type: 'number', example: '0' },
      { key: 'opening_balance_date', label: 'تاريخ الرصيد الافتتاحي', labelEn: 'Opening Balance Date (YYYY-MM-DD)', required: false, type: 'date', example: '2025-01-01' },
      { key: 'credit_limit', label: 'حد الائتمان', labelEn: 'Credit Limit', required: false, type: 'number', example: '50000' },
      { key: 'payment_terms', label: 'شروط الدفع', labelEn: 'Payment Terms', required: false, type: 'select', options: ['نقد', 'آجل'], example: 'نقد' },
      { key: 'payment_terms_days', label: 'أيام الدفع الآجل', labelEn: 'Payment Terms Days', required: false, type: 'number', example: '30' },
    ]
  },
  suppliers: {
    nameAr: 'الموردين',
    dbTable: 'suppliers',
    uniqueKey: 'code',
    columns: [
      { key: 'code', label: 'كود المورد *', labelEn: 'Supplier Code (Required)', required: true, type: 'text', example: 'SUPP-001' },
      { key: 'name', label: 'اسم المورد *', labelEn: 'Supplier Name (Required)', required: true, type: 'text', example: 'شركة XYZ للتوريد' },
      { key: 'mobile', label: 'رقم الجوال', labelEn: 'Mobile Number', required: false, type: 'text', example: '0501234567' },
      { key: 'email', label: 'البريد الإلكتروني', labelEn: 'Email', required: false, type: 'text', example: 'info@xyz.com' },
      { key: 'address', label: 'العنوان', labelEn: 'Address', required: false, type: 'text', example: 'جدة، السعودية' },
      { key: 'tax_number', label: 'الرقم الضريبي', labelEn: 'Tax Number', required: false, type: 'text', example: '300987654321' },
      { key: 'opening_balance', label: 'الرصيد الافتتاحي', labelEn: 'Opening Balance', required: false, type: 'number', example: '0' },
      { key: 'opening_balance_date', label: 'تاريخ الرصيد الافتتاحي', labelEn: 'Opening Balance Date (YYYY-MM-DD)', required: false, type: 'date', example: '2025-01-01' },
      { key: 'credit_limit', label: 'حد الائتمان', labelEn: 'Credit Limit', required: false, type: 'number', example: '100000' },
      { key: 'payment_terms', label: 'شروط الدفع', labelEn: 'Payment Terms', required: false, type: 'select', options: ['نقد', 'آجل'], example: 'آجل' },
      { key: 'payment_terms_days', label: 'أيام الدفع الآجل', labelEn: 'Payment Terms Days', required: false, type: 'number', example: '60' },
    ]
  },
  employees: {
    nameAr: 'الموظفين',
    dbTable: 'employees',
    uniqueKey: 'employee_code',
    columns: [
      { key: 'employee_code', label: 'كود الموظف *', labelEn: 'Employee Code (Required)', required: true, type: 'text', example: 'EMP-001' },
      { key: 'name', label: 'اسم الموظف *', labelEn: 'Employee Name (Required)', required: true, type: 'text', example: 'أحمد محمد علي' },
      { key: 'job_title', label: 'المسمى الوظيفي', labelEn: 'Job Title', required: false, type: 'text', example: 'مدير مبيعات' },
      { key: 'nationality', label: 'الجنسية', labelEn: 'Nationality', required: false, type: 'text', example: 'سعودي' },
      { key: 'national_id', label: 'رقم الهوية', labelEn: 'National ID', required: false, type: 'text', example: '1234567890' },
      { key: 'gender', label: 'الجنس', labelEn: 'Gender', required: false, type: 'select', options: ['ذكر', 'أنثى'], example: 'ذكر' },
      { key: 'marital_status', label: 'الحالة الاجتماعية', labelEn: 'Marital Status', required: false, type: 'select', options: ['أعزب', 'متزوج', 'مطلق', 'أرمل'], example: 'متزوج' },
      { key: 'birth_date', label: 'تاريخ الميلاد', labelEn: 'Birth Date (YYYY-MM-DD)', required: false, type: 'date', example: '1990-05-15' },
      { key: 'hire_date', label: 'تاريخ التعيين *', labelEn: 'Hire Date (YYYY-MM-DD, Required)', required: true, type: 'date', example: '2025-01-01' },
      { key: 'contract_type', label: 'نوع العقد', labelEn: 'Contract Type', required: false, type: 'select', options: ['دوام كامل', 'دوام جزئي', 'مؤقت', 'عقد'], example: 'دوام كامل' },
      { key: 'contract_expiry_date', label: 'تاريخ انتهاء العقد', labelEn: 'Contract Expiry Date (YYYY-MM-DD)', required: false, type: 'date', example: '2026-12-31' },
    ]
  },
  payment_methods: {
    nameAr: 'طرق السداد',
    dbTable: 'payment_methods',
    uniqueKey: 'name',
    columns: [
      { key: 'name', label: 'اسم طريقة السداد *', labelEn: 'Payment Method Name (Required)', required: true, type: 'text', example: 'نقد' },
      { key: 'type', label: 'النوع *', labelEn: 'Type (Required)', required: true, type: 'select', options: ['cash', 'bank', 'wallet'], example: 'cash' },
      { key: 'account_number', label: 'رقم الحساب البنكي', labelEn: 'Bank Account Number', required: false, type: 'text', example: 'SA1234567890' },
      { key: 'bank_name', label: 'اسم البنك', labelEn: 'Bank Name', required: false, type: 'text', example: 'بنك الأهلي' },
      { key: 'description', label: 'الوصف', labelEn: 'Description', required: false, type: 'text', example: 'طريقة سداد نقدية' },
    ]
  },
  item_groups: {
    nameAr: 'مجموعات الأصناف',
    dbTable: 'item_groups',
    uniqueKey: 'code',
    columns: [
      { key: 'code', label: 'كود المجموعة *', labelEn: 'Group Code (Required)', required: true, type: 'text', example: 'GRP-001' },
      { key: 'name', label: 'اسم المجموعة *', labelEn: 'Group Name (Required)', required: true, type: 'text', example: 'إلكترونيات' },
      { key: 'type', label: 'النوع', labelEn: 'Type', required: false, type: 'select', options: ['product', 'service', 'raw_material', 'semi_finished'], example: 'product' },
      { key: 'description', label: 'الوصف', labelEn: 'Description', required: false, type: 'text', example: 'مجموعة المنتجات الإلكترونية' },
    ]
  },
  products: {
    nameAr: 'الأصناف',
    dbTable: 'products',
    uniqueKey: 'code',
    columns: [
      { key: 'code', label: 'كود الصنف *', labelEn: 'Product Code (Required - Must be unique)', required: true, type: 'text', example: 'PROD-001' },
      { key: 'name', label: 'اسم الصنف *', labelEn: 'Product Name (Required)', required: true, type: 'text', example: 'لابتوب HP' },
      { key: 'barcode', label: 'الباركود', labelEn: 'Barcode', required: false, type: 'text', example: '6281234567890' },
      { key: 'type', label: 'نوع الصنف *', labelEn: 'Product Type (Required)', required: true, type: 'select', options: ['product', 'service', 'raw_material', 'semi_finished'], example: 'product' },
      { key: 'unit', label: 'وحدة القياس', labelEn: 'Unit of Measure', required: false, type: 'text', example: 'قطعة' },
      { key: 'sale_price', label: 'سعر البيع *', labelEn: 'Sale Price (Required)', required: true, type: 'number', example: '1500' },
      { key: 'cost_price', label: 'سعر التكلفة', labelEn: 'Cost Price', required: false, type: 'number', example: '1200' },
      { key: 'min_stock', label: 'الحد الأدنى للمخزون', labelEn: 'Minimum Stock Level', required: false, type: 'number', example: '5' },
      { key: 'description', label: 'الوصف', labelEn: 'Description', required: false, type: 'text', example: 'لابتوب HP Core i7' },
      { key: 'vat_rate', label: 'نسبة الضريبة %', labelEn: 'VAT Rate %', required: false, type: 'number', example: '15' },
      { key: 'item_group_code', label: 'كود مجموعة الأصناف', labelEn: 'Item Group Code (must match existing group code)', required: false, type: 'text', example: 'GRP-001' },
    ]
  }
};

// ================================================================
// GET /import/template/:module  - Download Excel template
// ================================================================
router.get('/import/template/:module', authenticateToken, (req: AuthRequest, res) => {
  const moduleName = req.params.module;
  const config = IMPORT_CONFIGS[moduleName];
  if (!config) return res.status(404).json({ error: 'Module not found' });

  const wb = XLSX.utils.book_new();

  // ── Data Sheet ──────────────────────────────────────────────────
  // Row 1: Arabic headers
  // Row 2: English description headers
  // Row 3: Example row
  // Row 4+: Data rows

  const arabicHeaders = config.columns.map(c => c.label);
  const englishHeaders = config.columns.map(c => c.labelEn);
  const exampleRow = config.columns.map(c => c.example || '');

  const wsData: any[][] = [arabicHeaders, englishHeaders, exampleRow];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Style header row (bold + color)
  const colCount = config.columns.length;
  for (let c = 0; c < colCount; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      fill: { fgColor: { rgb: '1E6E42' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { bottom: { style: 'thin', color: { rgb: '000000' } } }
    };
    // Style English header row  
    const cellRef2 = XLSX.utils.encode_cell({ r: 1, c });
    if (ws[cellRef2]) {
      ws[cellRef2].s = {
        fill: { fgColor: { rgb: 'D9F0E4' } },
        font: { italic: true, sz: 10, color: { rgb: '333333' } },
        alignment: { horizontal: 'center', wrapText: true }
      };
    }
    // Style example row
    const cellRef3 = XLSX.utils.encode_cell({ r: 2, c });
    if (ws[cellRef3]) {
      ws[cellRef3].s = {
        fill: { fgColor: { rgb: 'FFF8E1' } },
        font: { italic: true, color: { rgb: '8B6914' }, sz: 10 },
        alignment: { horizontal: 'center' }
      };
    }
  }

  // Set column widths
  ws['!cols'] = config.columns.map(() => ({ wch: 28 }));

  // Row heights
  ws['!rows'] = [{ hpt: 30 }, { hpt: 25 }, { hpt: 22 }];

  XLSX.utils.book_append_sheet(wb, ws, config.nameAr);

  // ── Dropdown Values Sheet ─────────────────────────────────────
  const selectCols = config.columns.filter(c => c.type === 'select' && c.options?.length);
  if (selectCols.length > 0) {
    const dropHeaders = selectCols.map(c => c.label);
    const maxOptions = Math.max(...selectCols.map(c => c.options!.length));
    const dropData: any[][] = [dropHeaders];
    for (let i = 0; i < maxOptions; i++) {
      dropData.push(selectCols.map(c => c.options![i] || ''));
    }
    const wsDrop = XLSX.utils.aoa_to_sheet(dropData);
    wsDrop['!cols'] = selectCols.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, wsDrop, 'القيم المسموح بها');
  }

  // ── Instructions Sheet ────────────────────────────────────────
  const instructions = [
    ['تعليمات الاستيراد', ''],
    ['', ''],
    ['1. لا تحذف أو تعدل الصفين الأول والثاني (رؤوس الأعمدة)', ''],
    ['2. الصف الثالث هو مثال توضيحي - يمكن حذفه', ''],
    ['3. ابدأ إدخال البيانات من الصف الرابع', ''],
    ['4. الحقول المعلمة بـ (*) إجبارية', ''],
    ['5. تأكد من أن الأكواد فريدة وغير مكررة', ''],
    ['6. قيم الحقول المنسدلة موجودة في ورقة "القيم المسموح بها"', ''],
    ['7. تنسيق التواريخ: YYYY-MM-DD (مثال: 2025-01-01)', ''],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  wsInst['!cols'] = [{ wch: 60 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsInst, 'التعليمات');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  res.set({
    'Content-Disposition': `attachment; filename="template_${moduleName}_${Date.now()}.xlsx"`,
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  res.send(buffer);
});

// ================================================================
// POST /import/validate/:module  - Validate uploaded Excel (no DB write)
// ================================================================
router.post('/import/validate/:module', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  const moduleName = req.params.module;
  const config = IMPORT_CONFIGS[moduleName];
  if (!config) return res.status(404).json({ error: 'Module not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    if (rawRows.length < 3) {
      return res.status(400).json({ error: 'الملف فارغ أو لا يحتوي على بيانات' });
    }

    // Row 0 = Arabic headers, Row 1 = English, Row 2 = example (skip), Row 3+ = data
    const arabicHeaderRow = rawRows[0] as string[];
    const expectedHeaders = config.columns.map(c => c.label);

    // Validate headers match
    const headerErrors: string[] = [];
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (arabicHeaderRow[i] !== expectedHeaders[i]) {
        headerErrors.push(`العمود ${i + 1}: المتوقع "${expectedHeaders[i]}" - الموجود "${arabicHeaderRow[i] || 'فارغ'}"`);
      }
    }
    if (headerErrors.length > 0) {
      return res.status(400).json({
        error: 'رؤوس الأعمدة لا تتطابق مع النموذج',
        headerErrors
      });
    }

    // Parse data rows (skip first 3 rows = headers + example)
    const dataRows = rawRows.slice(3).filter(row => row.some(cell => cell !== undefined && cell !== ''));
    const companyId = req.user?.company_id;

    // Load existing codes for duplicate check
    let existingCodes: Set<string> = new Set();
    if (config.uniqueKey) {
      try {
        const existingRes = await pool.query(
          `SELECT ${config.uniqueKey} FROM ${config.dbTable} WHERE company_id = $1`,
          [companyId]
        );
        existingCodes = new Set(existingRes.rows.map((r: any) => String(r[config.uniqueKey!]).trim()));
      } catch (e) {
        console.warn('Could not load existing codes:', e);
      }
    }

    // For products: load item group codes
    let itemGroupMap: Record<string, string> = {};
    if (moduleName === 'products') {
      const igRes = await pool.query('SELECT id, code FROM item_groups WHERE company_id = $1', [companyId]);
      igRes.rows.forEach((r: any) => { itemGroupMap[r.code] = r.id; });
    }

    const validatedRows: any[] = [];
    const rowsWithErrors: any[] = [];
    const codesInFile = new Set<string>();

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const rawRow = dataRows[rowIdx];
      const rowNumber = rowIdx + 4; // actual Excel row number
      const errors: string[] = [];
      const rowData: Record<string, any> = {};

      for (let colIdx = 0; colIdx < config.columns.length; colIdx++) {
        const colDef = config.columns[colIdx];
        let value = rawRow[colIdx];

        // Trim strings
        if (typeof value === 'string') value = value.trim();
        // Excel date serial numbers
        if (colDef.type === 'date' && typeof value === 'number') {
          const date = XLSX.SSF.parse_date_code(value);
          if (date) {
            const month = String(date.m).padStart(2, '0');
            const day = String(date.d).padStart(2, '0');
            value = `${date.y}-${month}-${day}`;
          }
        }

        // Required check
        if (colDef.required && (value === undefined || value === null || value === '')) {
          errors.push(`الحقل "${colDef.label.replace(' *', '')}" مطلوب`);
          rowData[colDef.key] = null;
          continue;
        }

        // Type check
        if (value !== undefined && value !== null && value !== '') {
          if (colDef.type === 'number') {
            const num = Number(value);
            if (isNaN(num)) {
              errors.push(`الحقل "${colDef.label.replace(' *', '')}" يجب أن يكون رقماً`);
            } else {
              value = num;
            }
          }
          if (colDef.type === 'select' && colDef.options) {
            if (!colDef.options.includes(String(value))) {
              errors.push(`الحقل "${colDef.label.replace(' *', '')}" يجب أن يكون أحد القيم: ${colDef.options.join(', ')}`);
            }
          }
          if (colDef.type === 'date' && value) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(String(value))) {
              errors.push(`الحقل "${colDef.label.replace(' *', '')}" يجب أن يكون بتنسيق YYYY-MM-DD`);
            }
          }
        }

        rowData[colDef.key] = (value === '' || value === undefined) ? null : value;
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
        if (existingCodes.has(codeVal)) {
          rowData['_existing'] = true; // will be updated, not inserted
        }
      }

      // Products: resolve item_group_code → item_group_id
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
      total: dataRows.length,
      valid: validatedRows.length,
      errors: rowsWithErrors.length,
      validRows: validatedRows,
      errorRows: rowsWithErrors,
      columns: config.columns.map(c => ({ key: c.key, label: c.label, type: c.type })),
      moduleConfig: {
        nameAr: config.nameAr,
        uniqueKey: config.uniqueKey
      }
    });
  } catch (err: any) {
    console.error('Validation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// POST /import/execute/:module  - Execute the import (DB write)
// ================================================================
router.post('/import/execute/:module', authenticateToken, async (req: AuthRequest, res) => {
  const moduleName = req.params.module;
  const config = IMPORT_CONFIGS[moduleName];
  if (!config) return res.status(404).json({ error: 'Module not found' });

  const { rows } = req.body as { rows: { data: Record<string, any>; rowNumber: number }[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows to import' });
  }

  const companyId = req.user?.company_id;
  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;

  try {
    await client.query('BEGIN');

    for (const { data, rowNumber } of rows) {
      const id = data.id || uuidv4();
      const rowToInsert: Record<string, any> = {
        ...data,
        id,
        company_id: companyId,
      };
      delete rowToInsert['_existing'];

      const keys = Object.keys(rowToInsert).filter(k => rowToInsert[k] !== null || config.columns.some(c => c.key === k && c.required));
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
        if (result.rows[0]?.xmax === '0' || result.rows[0]?.xmax === 0) {
          inserted++;
        } else {
          updated++;
        }
      } catch (rowErr: any) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `خطأ في الصف ${rowNumber}: ${rowErr.message}` });
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, inserted, updated, total: rows.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Import execute error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
