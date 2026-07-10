interface PDFOptions {
  filename: string;
  margin?: number;
  orientation?: 'portrait' | 'landscape';
  reportTitle?: string;
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
  const tables = Array.from(element.getElementsByTagName('table'));
  
  let columns: Array<{ id: string; label: string; width?: number; align?: 'left' | 'center' | 'right' }> = [];
  let rows: any[] = [];
  let totals: { [key: string]: string } = {};

  if (tables.length > 0) {
    const table = tables[0];
    
    // Parse the table header columns
    const ths = Array.from(table.querySelectorAll('thead th, tr:first-child th'));
    const targetThs = ths.length > 0 ? ths : Array.from(table.querySelectorAll('tr:first-child td'));
    
    columns = targetThs.map((cell, index) => {
      const text = cell.textContent?.trim() || '';
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
        width = 3.0;
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
      
      return {
        id: `col_${index}`,
        label: text,
        width,
        align
      };
    });

    // Parse the table body rows
    const trs = Array.from(table.querySelectorAll('tbody tr, tr')).slice(ths.length > 0 ? 0 : 1);
    
    trs.forEach(trElement => {
      const tr = trElement as HTMLTableRowElement;
      const tds = Array.from(tr.querySelectorAll('td, th'));
      if (tds.length === 0) return;

      const isTotalRow = tr.classList.contains('total-row') || 
                         tr.style.fontWeight === 'bold' || 
                         tds.some(td => td.textContent?.includes('الإجمالي') || td.textContent?.includes('الصافي'));
      
      const rowData: any = {};
      let colVisualIndex = 0;
      tds.forEach((td) => {
        const text = td.textContent?.trim() || '';
        const colspan = parseInt(td.getAttribute('colspan') || '1', 10);
        
        // Map the text to the last index covered by this colspan to align it correctly
        const targetIndex = colVisualIndex + colspan - 1;
        rowData[`col_${targetIndex}`] = text;
        
        colVisualIndex += colspan;
      });

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

  // 4. Send POST request to backend PDF service
  try {
    const response = await fetch('/api/erp/print/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        templateName: 'ReportTemplate',
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
 * Standard browser printing fallback
 */
export const printElement = (element: HTMLElement) => {
  if (!element) return;
  window.print();
};
