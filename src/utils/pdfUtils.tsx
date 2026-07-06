interface PDFOptions {
  filename: string;
  margin?: number;
  orientation?: 'portrait' | 'landscape';
  reportTitle?: string;
}

/**
 * Compatibility Bridge: Parses target DOM tables and compiles them 
 * directly into data-driven PDF requests sent to the backend Puppeteer compiler.
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
      // Dynamically allocate larger width weight to descriptions
      const isDesc = text.includes('البيان') || text.includes('اسم') || text.includes('شرح');
      return {
        id: `col_${index}`,
        label: text,
        width: isDesc ? 2.5 : 1,
        align: 'right'
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
      tds.forEach((td, index) => {
        const text = td.textContent?.trim() || '';
        rowData[`col_${index}`] = text;
      });

      if (isTotalRow) {
        columns.forEach(col => {
          if (rowData[col.id]) {
            totals[col.id] = rowData[col.id];
          }
        });
      } else if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    });
  }

  // 3. Construct the DTO payload
  const dto = {
    company,
    reportTitle: options.reportTitle || 'تقرير النظام',
    columns,
    rows,
    totals
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
      throw new Error('Failed to generate PDF on server');
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
