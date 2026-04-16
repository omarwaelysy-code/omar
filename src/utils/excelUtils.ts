import * as XLSX from 'xlsx';

interface ExcelOptions {
  filename: string;
  sheetName?: string;
}

const EXCEL_CELL_LIMIT = 32760; // Slightly under 32767 for safety

/**
 * Flattens a nested object into a single-level object with dot-separated keys.
 */
const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
  const flattened: Record<string, any> = {};
  
  if (obj === null || obj === undefined) return { [prefix]: '' };
  if (typeof obj !== 'object') return { [prefix]: obj };
  if (obj instanceof Date) return { [prefix]: obj.toISOString() };

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
    
    // 2. Handle long strings by splitting into multiple columns if necessary
    Object.keys(flattened).forEach(key => {
      let value = flattened[key];
      
      if (value === null || value === undefined) {
        sanitized[key] = '';
        return;
      }

      // Convert to string if not already
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

  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Handle extremely large datasets by splitting into multiple sheets if needed
  // Excel row limit is 1,048,576
  const MAX_ROWS_PER_SHEET = 1000000;
  
  if (sanitizedData.length > MAX_ROWS_PER_SHEET) {
    for (let i = 0; i < sanitizedData.length; i += MAX_ROWS_PER_SHEET) {
      const chunk = sanitizedData.slice(i, i + MAX_ROWS_PER_SHEET);
      const ws = XLSX.utils.json_to_sheet(chunk);
      XLSX.utils.book_append_sheet(wb, ws, `${sheetName}_${Math.floor(i / MAX_ROWS_PER_SHEET) + 1}`);
    }
  } else {
    const ws = XLSX.utils.json_to_sheet(sanitizedData);
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
