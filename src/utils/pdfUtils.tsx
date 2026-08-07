export interface PDFOptions {
  filename: string;
  margin?: number;
  orientation?: 'portrait' | 'landscape';
  reportTitle?: string;
  columns?: any[];
  rows?: any[];
  totals?: Record<string, any>;
  templateName?: string;
}

/**
 * Compatibility Bridge: Parses target DOM tables and compiles them 
 * directly into data-driven PDF requests sent to the backend PDF engine.
 */
export const exportToPDF = async (element: HTMLElement, options: PDFOptions) => {
  if (!element) {
    console.error('PDF Export: Element not found');
    return;
  }

  // 1. Resolve Company Details from local configurations
  const company = {
    name: localStorage.getItem('company_name') || 'نظام ERP السحابي',
    logoUrl: localStorage.getItem('company_logo') || '',
    taxNumber: localStorage.getItem('company_tax') || '',
    phone: localStorage.getItem('company_phone') || ''
  };

  // 2. Locate and Parse DOM tables inside element
  let table: HTMLTableElement | null = null;
  if (element.tagName.toLowerCase() === 'table') {
    table = element as HTMLTableElement;
  } else {
    table = element.querySelector('table');
  }
  
  let columns: Array<{ id: string; label: string; width?: number; align?: 'left' | 'center' | 'right' }> = [];
  let rows: any[] = [];
  let totals: { [key: string]: string } = {};

  if (table) {
    
    // Reconstruct columns from complex rowSpan/colSpan thead grid
    const headerRows = Array.from(table.querySelectorAll('thead tr'));
    let targetThs: HTMLTableCellElement[] = [];

    if (headerRows.length > 1) {
      // Reconstruct leaf header cells using a 2D grid
      const numRows = headerRows.length;
      // Estimate max columns count by counting td in the first body row
      // Estimate max columns count by finding a row in tbody with the maximum cells
      const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
      let maxColsRow = bodyRows[0];
      let maxCellsCount = 0;
      bodyRows.forEach(row => {
        const count = row.querySelectorAll('td, th').length;
        if (count > maxCellsCount) {
          maxCellsCount = count;
          maxColsRow = row;
        }
      });
      const numCols = maxColsRow ? maxColsRow.querySelectorAll('td, th').length : 30;
      
      const grid: (HTMLTableCellElement | null)[][] = Array.from({ length: numRows }, () => Array(numCols).fill(null));
      
      headerRows.forEach((tr, r) => {
        const cells = Array.from(tr.querySelectorAll('th, td')) as HTMLTableCellElement[];
        let c = 0;
        cells.forEach(cell => {
          // Find first unassigned column in row r
          while (c < numCols && grid[r][c] !== null) {
            c++;
          }
          if (c >= numCols) return;

          const rowspan = cell.rowSpan || 1;
          const colspan = cell.colSpan || 1;
          
          for (let dr = 0; dr < rowspan; dr++) {
            for (let dc = 0; dc < colspan; dc++) {
              if (r + dr < numRows && c + dc < numCols) {
                grid[r + dr][c + dc] = cell;
              }
            }
          }
          c += colspan;
        });
      });

      // Get bottom-most (leaf) cell for each column
      for (let colIdx = 0; colIdx < numCols; colIdx++) {
        let leafCell: HTMLTableCellElement | null = null;
        for (let rowIdx = numRows - 1; rowIdx >= 0; rowIdx--) {
          if (grid[rowIdx][colIdx] !== null) {
            leafCell = grid[rowIdx][colIdx];
            break;
          }
        }
        if (leafCell) {
          targetThs.push(leafCell);
        }
      }
    } else {
      const ths = Array.from(table.querySelectorAll('thead th, tr:first-child th')) as HTMLTableCellElement[];
      targetThs = ths.length > 0 ? ths : Array.from(table.querySelectorAll('tr:first-child td')) as HTMLTableCellElement[];
    }
    
    const validIndices: number[] = [];
    columns = [];

    targetThs.forEach((cell, index) => {
      const text = cell.textContent?.trim() || '';
      // Skip empty columns (checkboxes, selection/action columns, spacing gaps)
      if (text === '') return;

      let width = 1.0;
      let align: 'left' | 'center' | 'right' = 'right';
      
      const lowerText = text.toLowerCase();
      if (lowerText.includes('تاريخ') || lowerText.includes('date')) {
        width = 1.4;
        align = 'center';
      } else if (lowerText.includes('نوع') || lowerText.includes('type')) {
        width = 1.2;
        align = 'center';
      } else if (lowerText.includes('قيد') || lowerText.includes('entry')) {
        width = 2.2;
        align = 'center';
      } else if (lowerText.includes('مرجع') || lowerText.includes('ref')) {
        width = 1.8;
        align = 'center';
      } else if (
        lowerText.includes('البيان') || 
        lowerText.includes('اسم') || 
        lowerText.includes('شرح') || 
        lowerText.includes('desc') || 
        lowerText.includes('name') || 
        lowerText.includes('product') || 
        lowerText.includes('صنف')
      ) {
        width = targetThs.length > 10 ? 1.6 : 3.0;
        align = 'right';
      } else if (lowerText.includes('مدين') || lowerText.includes('debit')) {
        width = 1.2;
        align = 'right';
      } else if (lowerText.includes('دائن') || lowerText.includes('credit')) {
        width = 1.2;
        align = 'right';
      } else if (lowerText.includes('رصيد') || lowerText.includes('balance')) {
        width = 1.4;
        align = 'right';
      }
      
      columns.push({
        id: `col_${index}`,
        label: text,
        width,
        align
      });
      validIndices.push(index);
    });

    // Parse the table body rows
    const tbodyTrs = Array.from(table.querySelectorAll('tbody tr, tfoot tr'));
    const trs = tbodyTrs.length > 0 ? tbodyTrs : Array.from(table.querySelectorAll('tr')).slice(targetThs.length > 0 ? 0 : 1);
    
    trs.forEach(trElement => {
      const tr = trElement as HTMLTableRowElement;
      const tds = Array.from(tr.querySelectorAll('td, th'));
      if (tds.length === 0) return;

      const isTotalRow = tr.classList.contains('total-row') || 
                         tr.style.fontWeight === 'bold' || 
                         tds.some(td => {
                           const text = td.textContent || '';
                           return text.includes('الإجمالي') || text.includes('الصافي') || 
                                  text.toLowerCase().includes('total') || text.toLowerCase().includes('ending balance');
                         });
      
      const rowData: any = {};
      
      if (isTotalRow) {
        let colVisualIndex = 0;
        tds.forEach((td) => {
          const text = td.textContent?.trim() || '';
          const colspan = (td as HTMLTableCellElement).colSpan || 1;
          
          const targetIndex = colVisualIndex + colspan - 1;
          rowData[`col_${targetIndex}`] = text;
          
          colVisualIndex += colspan;
        });
      } else {
        // Map normal row cells using only valid column indices to prevent shifting
        validIndices.forEach(idx => {
          if (tds[idx]) {
            rowData[`col_${idx}`] = tds[idx].textContent?.trim() || '';
          }
        });
      }

      if (isTotalRow) {
        columns.forEach(col => {
          if (rowData[col.id] !== undefined && rowData[col.id] !== '') {
            totals[col.id] = rowData[col.id];
          }
        });
      } else if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    });
  }

  // 2.5 Filter out completely empty columns (delete excess empty columns)
  const nonEmptyColumnIds = new Set<string>();
  columns.forEach(col => {
    // Keep metadata/important text columns
    const isMeta = col.id === 'col_0' || col.id === 'col_1' || col.id === 'col_2' || col.id === 'col_3' || 
                   col.label.includes('كود') || col.label.includes('الاسم') || col.label.includes('اسم') || 
                   col.label.toLowerCase().includes('code') || col.label.toLowerCase().includes('name') ||
                   col.label.toLowerCase().includes('desc') || col.label.toLowerCase().includes('date') ||
                   col.label.toLowerCase().includes('type') || col.label.toLowerCase().includes('ref') ||
                   col.label.includes('تاريخ') || col.label.includes('بيان') || col.label.includes('الرصيد') ||
                   col.label.toLowerCase().includes('balance');
    
    if (isMeta) {
      nonEmptyColumnIds.add(col.id);
      return;
    }

    const hasValue = rows.some(row => {
      const val = (row[col.id] || '').trim();
      return val !== '' && val !== '-' && val !== '0' && val !== '0.00' && val !== '0.0' && val !== '0.00+' && val !== '0.00-';
    });

    const totalVal = (totals[col.id] || '').trim();
    const hasTotal = totalVal !== '' && totalVal !== '-' && totalVal !== '0' && totalVal !== '0.00' && totalVal !== '0.0';

    if (hasValue || hasTotal) {
      nonEmptyColumnIds.add(col.id);
    }
  });

  columns = columns.filter(col => nonEmptyColumnIds.has(col.id));

  // 3. Construct the DTO payload
  const isRtl = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';
  const dto = {
    company,
    reportTitle: options.reportTitle || 'تقرير النظام',
    columns,
    rows,
    totals,
    isRtl,
    orientation: options.orientation || 'portrait'
  };

  const titleStr = String(options.reportTitle || '').toLowerCase();
  const fileStr = String(options.filename || '').toLowerCase();
  const isPurchase = titleStr.includes('مشتريات') || titleStr.includes('purchase') || fileStr.includes('purchase') || fileStr.includes('pinv');

  const templateName = isPurchase ? 'PurchaseInvoicePdf' : 'ReportTemplate';

  // 4. Send POST request to backend PDF service
  try {
    const response = await fetch('/api/erp/print/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        templateName,
        dto
      })
    });

    if (!response.ok) {
      let serverErrorMsg = 'Failed to generate PDF on server';
      try {
        const errorJson = await response.json();
        if (errorJson && errorJson.exceptionMessage) {
          console.error("=================== BACKEND PDF FAILURE DETAILS ===================");
          console.error(`- Failed File: ${errorJson.failedFile}`);
          console.error(`- Line Number: ${errorJson.lineNumber}`);
          console.error(`- Exception Name: ${errorJson.exceptionName}`);
          console.error(`- Exception Message: ${errorJson.exceptionMessage}`);
          console.error(`- Stack Trace:\n${errorJson.stackTrace}`);
          console.error("===================================================================");
          serverErrorMsg = `Backend PDF Error: ${errorJson.exceptionMessage} (at ${errorJson.failedFile}:${errorJson.lineNumber})`;
        } else if (errorJson && errorJson.error) {
          serverErrorMsg = `Backend PDF Error: ${errorJson.error}`;
        }
      } catch (e) {
        // Fallback to generic message if parsing fails
      }
      throw new Error(serverErrorMsg);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const rawFilename = options.filename || 'report';
    link.download = rawFilename.endsWith('.pdf') ? rawFilename : `${rawFilename}.pdf`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Server PDF Generation failed:', error);
  }
};

/**
 * Standard browser printing for HTML elements/tables
 */
export const printElement = (element: HTMLElement | null, reportTitle: string = 'تقرير') => {
  if (!element) {
    window.print();
    return;
  }
  const companyName = localStorage.getItem('company_name') || 'نظام ERP السحابي';
  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) {
    window.print();
    return;
  }

  // Clone element to remove interactive inputs or action columns if needed
  const cloned = element.cloneNode(true) as HTMLElement;
  // Remove last header and body column if it contains action buttons
  cloned.querySelectorAll('tr').forEach(tr => {
    const lastCell = tr.lastElementChild;
    if (lastCell && (lastCell.querySelector('button') || lastCell.textContent?.includes('إجراءات') || lastCell.textContent?.includes('Actions'))) {
      lastCell.remove();
    }
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${reportTitle}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 25px; direction: rtl; color: #1e293b; }
        .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #0f766e; padding-bottom: 15px; }
        .header h1 { margin: 0 0 6px 0; font-size: 24px; color: #0f766e; font-weight: bold; }
        .header h2 { margin: 0; font-size: 16px; color: #475569; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; background: #fff; }
        th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: right; font-size: 12px; }
        th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .footer { margin-top: 25px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        button, .no-print, input[type="checkbox"] { display: none !important; }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${companyName}</h1>
        <h2>${reportTitle}</h2>
      </div>
      ${cloned.outerHTML}
      <div class="footer">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}</div>
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

