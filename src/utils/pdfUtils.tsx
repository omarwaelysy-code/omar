import React from 'react';
import { downloadPDF } from '../lib/pdf/PdfExporter';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { PdfHeader } from '../lib/pdf/PdfHeader';
import { PdfFooter } from '../lib/pdf/PdfFooter';
import { PdfTable } from '../lib/pdf/PdfTable';
import { pdfStyles } from '../lib/pdf/PdfTheme';
import { shapeArabicText } from '../lib/pdf/PdfHelpers';

interface PDFOptions {
  filename: string;
  margin?: number;
  orientation?: 'portrait' | 'landscape';
  reportTitle?: string;
}

/**
 * Compatibility Bridge: Parses target DOM tables and compiles them 
 * directly into data-driven @react-pdf/renderer document structures.
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
    
    trs.forEach(tr => {
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

  const documentTitle = options.reportTitle || 'تقرير النظام';

  // 3. Construct @react-pdf/renderer document structure
  const pdfDocument = (
    <Document>
      <Page size="A4" orientation={options.orientation || 'portrait'} style={pdfStyles.page}>
        <PdfHeader
          companyName={company.name}
          companyLogo={company.logoUrl}
          companyTaxNumber={company.taxNumber}
          companyPhone={company.phone}
          reportTitle={documentTitle}
        />
        
        {columns.length > 0 ? (
          <PdfTable
            columns={columns}
            data={rows}
            showTotals={Object.keys(totals).length > 0}
            totals={totals}
          />
        ) : (
          <View style={{ padding: 10 }}>
            <Text style={{ fontSize: 10 }}>
              {shapeArabicText(element.textContent || 'لا توجد بيانات')}
            </Text>
          </View>
        )}
        
        <PdfFooter />
      </Page>
    </Document>
  );

  // 4. Trigger download
  await downloadPDF(pdfDocument, options.filename || 'report.pdf');
};

/**
 * Standard browser printing fallback (re-routed from PDF capture method)
 */
export const printElement = (element: HTMLElement) => {
  if (!element) return;
  window.print();
};
