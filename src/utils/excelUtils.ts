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
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(trimmed)) {
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

      // Convert ISO Date-time string to Date-only string YYYY-MM-DD
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(value)) {
        value = value.substring(0, 10);
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
  XLSX.writeFile(wb, `${filename}.xlsx`, { cellNF: true });
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
