import * as XLSX from 'xlsx';

interface ExcelOptions {
  filename: string;
  sheetName?: string;
}

const EXCEL_CELL_LIMIT = 32760; // Slightly under 32767 for safety

/**
 * Tries to parse a string representation of a number to a number type,
 * while preserving codes with leading zeros, dates, and non-numeric fields.
 */
const tryParseNumber = (value: any): any => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return value;
    
    // Check if it's a date-like string (e.g. 2026-06-05 or 05/06/2026)
    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(trimmed) || /^\d{2}[-/]\d{2}[-/]\d{4}/.test(trimmed)) {
      return trimmed;
    }
    // Check if it has time or timezone info
    if (/^\d{4}-\d{2}-\d{2}[T ]/.test(trimmed) || /^\d{2}[-/]\d{2}[-/]\d{4}[T ]/.test(trimmed)) {
      return trimmed;
    }
    // Check if it's a code with leading zeros (e.g. '00123' or '05')
    if (/^0[0-9]+/.test(trimmed) && !/^0\./.test(trimmed)) {
      return trimmed;
    }
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }
  return value;
};

/**
 * Flattens a nested object into a single-level object with dot-separated keys.
 */
const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
  const flattened: Record<string, any> = {};
  
  if (obj === null || obj === undefined) return { [prefix]: '' };
  if (typeof obj !== 'object') return { [prefix]: obj };
  if (obj instanceof Date) return { [prefix]: obj.toISOString().split('T')[0] };

  Object.keys(obj).forEach(key => {
    const propName = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(flattened, flattenObject(value, propName));
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        flattened[propName] = '[]';
      } else {
        const isPrimitiveArray = value.every(v => typeof v !== 'object' || v === null);
        if (isPrimitiveArray) {
          flattened[propName] = value.join(', ');
        } else {
          // For complex arrays, flatten each element with an index
          value.forEach((item, index) => {
            Object.assign(flattened, flattenObject(item, `${propName}.${index}`));
          });
        }
      }
    } else {
      flattened[propName] = value;
    }
  });
  
  return flattened;
};

/**
 * Sanitizes data for Excel by flattening and splitting long strings.
 */
export const sanitizeForExcel = (data: any[]): any[] => {
  if (!data || data.length === 0) return [];

  return data.map(item => {
    // 1. Flatten the object to avoid raw JSON in cells
    const flattened = flattenObject(item);
    const sanitized: any = {};
    
    // 2. Handle values, format dates, and parse numbers
    Object.keys(flattened).forEach(key => {
      let value = flattened[key];
      
      if (value === null || value === undefined) {
        sanitized[key] = '';
        return;
      }

      // Convert Date object to date-only string YYYY-MM-DD
      if (value instanceof Date) {
        const day = String(value.getUTCDate()).padStart(2, '0');
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const year = value.getUTCFullYear();
        value = `${year}-${month}-${day}`;
      }

      // Convert ISO Date-time or formatted date-time string to Date-only string
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}[T ]/.test(trimmed) || /^\d{2}[-/]\d{2}[-/]\d{4}[T ]/.test(trimmed)) {
          value = trimmed.substring(0, 10);
        }
      }

      // Convert to number if it's a numeric string
      value = tryParseNumber(value);

      // Convert to string to check length limit
      let strValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (strValue.length > EXCEL_CELL_LIMIT) {
        // Split into multiple columns: Key_Part1, Key_Part2, etc.
        for (let i = 0; i < strValue.length; i += EXCEL_CELL_LIMIT) {
          const part = strValue.substring(i, i + EXCEL_CELL_LIMIT);
          const partKey = i === 0 ? key : `${key}_Part${Math.floor(i / EXCEL_CELL_LIMIT) + 1}`;
          sanitized[partKey] = part;
        }
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  });
};

export const exportToExcel = (data: any[], options: ExcelOptions) => {
  const { filename, sheetName = 'Sheet1' } = options;
  
  if (!data || data.length === 0) {
    console.warn('No data to export to Excel');
    return;
  }

  // Sanitize data
  const sanitizedData = sanitizeForExcel(data);

  // Function to apply number format to numeric cells in a worksheet
  const applyNumberFormat = (ws: XLSX.WorkSheet) => {
    Object.keys(ws).forEach(key => {
      if (key[0] === '!') return; // Skip metadata keys
      const cell = ws[key];
      // If cell is numeric, apply financial format
      if (cell.t === 'n' && typeof cell.v === 'number') {
        cell.z = '#,##0.00';
      }
    });
  };

  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Handle extremely large datasets by splitting into multiple sheets if needed
  // Excel row limit is 1,048,576
  const MAX_ROWS_PER_SHEET = 1000000;
  
  if (sanitizedData.length > MAX_ROWS_PER_SHEET) {
    for (let i = 0; i < sanitizedData.length; i += MAX_ROWS_PER_SHEET) {
      const chunk = sanitizedData.slice(i, i + MAX_ROWS_PER_SHEET);
      const ws = XLSX.utils.json_to_sheet(chunk);
      applyNumberFormat(ws);
      XLSX.utils.book_append_sheet(wb, ws, `${sheetName}_${Math.floor(i / MAX_ROWS_PER_SHEET) + 1}`);
    }
  } else {
    const ws = XLSX.utils.json_to_sheet(sanitizedData);
    applyNumberFormat(ws);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  
  // Write file
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Formats data for excel export by mapping keys to readable names
 */
export const formatDataForExcel = (data: any[], keyMap: Record<string, string>) => {
  return data.map(item => {
    const formattedItem: Record<string, any> = {};
    Object.entries(keyMap).forEach(([key, label]) => {
      if (key.includes('.')) {
        const parts = key.split('.');
        let val = item;
        for (const part of parts) {
          val = val?.[part];
        }
        formattedItem[label] = val;
      } else {
        formattedItem[label] = item[key];
      }
    });
    return formattedItem;
  });
};

export interface SingleDocExportOptions {
  filename: string;
  sheetName?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyFax?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyTaxNumber?: string;
  docTitle: string;
  docNumber: string;
  docDate: string;
  referenceNo?: string;
  createdByName?: string;
  partyTitle?: string;
  partyName?: string;
  partyAddress?: string;
  partyPhone?: string;
  partyEmail?: string;
  partyTaxNumber?: string;
  paymentMethod?: string;
  warehouseOrBranch?: string;
  notes?: string;
  columns: Array<{ label: string; key: string }>;
  items: Array<Record<string, any>>;
  summaryRows?: Array<{ label: string; value: any }>;
}

/**
 * Formats a single transaction document (Invoice, Voucher, Return) into a professional Excel sheet
 * with full 3-column Company/Party Header, Metadata Grid, Items Table (padded grid rows), and Totals Summary block.
 */
export const exportSingleDocumentToExcel = (options: SingleDocExportOptions) => {
  const {
    filename,
    sheetName = 'مستند',
    companyName = localStorage.getItem('company_name') || 'نظام ERP السحابي',
    companyAddress = localStorage.getItem('company_address') || '',
    companyPhone = localStorage.getItem('company_phone') || '',
    companyFax = '',
    companyEmail = localStorage.getItem('company_email') || '',
    companyWebsite = '',
    companyTaxNumber = localStorage.getItem('company_tax') || '',
    docTitle,
    docNumber,
    docDate,
    referenceNo = '-',
    createdByName = '',
    partyTitle = 'الجهة',
    partyName = '-',
    partyAddress = '',
    partyPhone = '',
    partyEmail = '',
    partyTaxNumber = '',
    paymentMethod = '-',
    warehouseOrBranch = '-',
    notes = '',
    columns,
    items,
    summaryRows = []
  } = options;

  const aoa: any[][] = [];

  // 1. Executive Top Header (Row 1-2): Brand Title (Left), Address/Phone (Middle), Email/Web (Right)
  aoa.push([
    docTitle.toUpperCase(), '', '',
    companyAddress ? `Address: ${companyAddress}` : companyName,
    companyPhone ? `P: ${companyPhone}` : '',
    companyFax ? `F: ${companyFax}` : '',
    companyEmail ? `Email: ${companyEmail}` : companyWebsite
  ]);
  
  if (companyTaxNumber || companyWebsite) {
    aoa.push([
      '', '', '',
      `الرقم الضريبي: ${companyTaxNumber || '-'}`,
      '', '',
      companyWebsite ? `Web: ${companyWebsite}` : ''
    ]);
  }

  // Blank Separator
  aoa.push([]);

  // 2. Metadata Grid (Rows 4-6) - 3 Column Layout matching Excel Invoice template
  aoa.push([
    `${partyTitle}:`, partyName, '',
    'الهاتف / Phone:', partyPhone || '-',
    `${docTitle} #:`, docNumber
  ]);
  aoa.push([
    'العنوان / Address:', partyAddress || '-', '',
    'الرقم الضريبي / Tax ID:', partyTaxNumber || '-',
    'التاريخ / Date:', docDate
  ]);
  aoa.push([
    'الفرع / المخزن:', warehouseOrBranch, '',
    'البريد / Email:', partyEmail || '-',
    'طريقة الدفع / Payment:', paymentMethod
  ]);
  if (referenceNo !== '-' || createdByName) {
    aoa.push([
      'المرجع / Ref:', referenceNo, '',
      'المسؤول / Contact:', createdByName || '-',
      '', ''
    ]);
  }

  // Blank separator before table
  aoa.push([]);

  // 3. Table Headers (Row 8)
  const headerRow = columns.map(c => c.label);
  aoa.push(headerRow);

  // 4. Data Rows
  items.forEach((item, index) => {
    const row = columns.map(col => {
      if (col.key === 'index' || col.key === 'م') return index + 1;
      const val = item[col.key];
      return val !== undefined && val !== null ? val : '-';
    });
    aoa.push(row);
  });

  // Pad extra empty grid rows if item list has fewer than 6 items to maintain a full document sheet format
  const MIN_GRID_ROWS = 6;
  if (items.length < MIN_GRID_ROWS) {
    const padCount = MIN_GRID_ROWS - items.length;
    for (let p = 0; p < padCount; p++) {
      const emptyRow = columns.map(() => '');
      aoa.push(emptyRow);
    }
  }

  // Blank separator before summary
  aoa.push([]);

  // 5. Summary Block (Bottom Right aligned)
  summaryRows.forEach((sum) => {
    const emptyCells = new Array(Math.max(0, columns.length - 2)).fill('');
    aoa.push([...emptyCells, sum.label, sum.value]);
  });

  // 6. Notes & Terms Footer (Bottom Left)
  aoa.push([]);
  aoa.push([`Make all checks payable to ${companyName}.`]);
  aoa.push([`Total due in 30 days. Overdue accounts are subject to interest charge of 2% per month.`]);
  if (notes) {
    aoa.push([`ملاحظات / Notes: ${notes}`]);
  }

  // 7. Generate Worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Apply financial formatting to numeric cells
  Object.keys(ws).forEach(key => {
    if (key[0] === '!') return;
    const cell = ws[key];
    if (cell.t === 'n' && typeof cell.v === 'number') {
      cell.z = '#,##0.00';
    }
  });

  // Set column widths dynamically
  const colWidths = columns.map(c => ({ wch: Math.max(c.label.length + 6, 16) }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`}`);
};



