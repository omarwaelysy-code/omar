import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDate } from './formatUtils';

interface PDFOptions {
  filename: string;
  margin?: number;
  orientation?: 'portrait' | 'landscape';
  reportTitle?: string;
}

export const exportToPDF = async (element: HTMLElement, options: PDFOptions) => {
  const { filename, margin = 10, orientation = 'portrait', reportTitle } = options;
  console.log('PDF Export: Starting professional export for', filename);

  if (!element) {
    console.error('PDF Export: Element not found');
    throw new Error('Element not found');
  }

  // @ts-ignore
  const html2pdfFunc = html2pdf.default || html2pdf;

  if (typeof html2pdfFunc !== 'function') {
    console.error('PDF Export: html2pdf is not a function.');
    throw new Error('PDF export library not loaded correctly');
  }

  // Store current scroll position
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  
  // Reset scroll to 0,0 for better capture
  window.scrollTo(0, 0);

  // Small delay to ensure rendering is complete
  await new Promise(resolve => setTimeout(resolve, 150));

  const targetWidth = orientation === 'landscape' ? 1120 : 800;
  
  const opt = {
    margin: margin,
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { 
      scale: 2, // High resolution but balanced to prevent memory crashes
      useCORS: true,
      letterRendering: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: targetWidth,
      onclone: (clonedDoc: Document) => {
        console.log('PDF Export: Applying styles in cloned document...');
        
        // Find the cloned element
        let clonedElement: HTMLElement | null = null;
        if (element.id) {
          clonedElement = clonedDoc.getElementById(element.id);
        }
        if (!clonedElement) {
          clonedElement = clonedDoc.body.querySelector(`[id="${element.id}"]`) as HTMLElement || 
                          clonedDoc.body.querySelector('table') as HTMLElement ||
                          clonedDoc.body.querySelector(':first-child') as HTMLElement;
        }

        if (clonedElement) {
          // Reset scroll and size constraints on the element itself to prevent clipping
          clonedElement.style.overflow = 'visible';
          clonedElement.style.maxHeight = 'none';
          clonedElement.style.height = 'auto';
          clonedElement.style.width = '100%';
          clonedElement.style.padding = '10px';

          // Remove scroll, height limits, flex, and positioning on all parent elements in the cloned document
          let parent = clonedElement.parentElement;
          while (parent && parent !== clonedDoc.body) {
            parent.style.setProperty('display', 'block', 'important');
            parent.style.setProperty('position', 'relative', 'important');
            parent.style.setProperty('overflow', 'visible', 'important');
            parent.style.setProperty('max-height', 'none', 'important');
            parent.style.setProperty('height', 'auto', 'important');
            parent.style.setProperty('min-height', '0', 'important');
            parent.style.setProperty('width', 'auto', 'important');
            parent.style.setProperty('transform', 'none', 'important');
            parent = parent.parentElement;
          }

          // Ensure html and body are fully visible and auto-height
          clonedDoc.body.style.setProperty('overflow', 'visible', 'important');
          clonedDoc.body.style.setProperty('height', 'auto', 'important');
          clonedDoc.body.style.setProperty('max-height', 'none', 'important');
          
          if (clonedDoc.documentElement) {
            clonedDoc.documentElement.style.setProperty('overflow', 'visible', 'important');
            clonedDoc.documentElement.style.setProperty('height', 'auto', 'important');
            clonedDoc.documentElement.style.setProperty('max-height', 'none', 'important');
          }

          // Add a beautiful print header if reportTitle is provided (for lists/tables)
          // and we are NOT exporting a single invoice (which has its own header)
          if (reportTitle && !element.id?.includes('invoice-capture-area')) {
            const headerDiv = clonedDoc.createElement('div');
            headerDiv.style.display = 'flex';
            headerDiv.style.justifyContent = 'space-between';
            headerDiv.style.alignItems = 'center';
            headerDiv.style.marginBottom = '25px';
            headerDiv.style.borderBottom = '2px solid #10b981';
            headerDiv.style.paddingBottom = '12px';
            headerDiv.style.direction = 'rtl';
            headerDiv.style.fontFamily = '"Cairo", sans-serif';

            const titleH1 = clonedDoc.createElement('h1');
            titleH1.innerText = reportTitle;
            titleH1.style.fontSize = '22px';
            titleH1.style.fontWeight = 'bold';
            titleH1.style.color = '#064e3b';
            titleH1.style.margin = '0';
            headerDiv.appendChild(titleH1);

            const dateP = clonedDoc.createElement('p');
            dateP.innerText = `تاريخ التصدير: ${formatDate(new Date())}`;
            dateP.style.fontSize = '12px';
            dateP.style.color = '#6b7280';
            dateP.style.margin = '0';
            headerDiv.appendChild(dateP);

            clonedElement.insertBefore(headerDiv, clonedElement.firstChild);
          }

          // Apply professional table styling to all tables inside
          const tables = Array.from(clonedElement.getElementsByTagName('table'));
          tables.forEach(table => {
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.marginBottom = '20px';
            
            const ths = Array.from(table.getElementsByTagName('th'));
            ths.forEach(th => {
              th.style.backgroundColor = '#f3f4f6';
              th.style.color = '#111827';
              th.style.fontWeight = 'bold';
              th.style.padding = '10px 12px';
              th.style.border = '1px solid #e5e7eb';
              th.style.textAlign = 'right';
              th.style.fontSize = '14px';
            });

            const tds = Array.from(table.getElementsByTagName('td'));
            tds.forEach(td => {
              td.style.padding = '8px 12px';
              td.style.border = '1px solid #e5e7eb';
              td.style.textAlign = 'right';
              td.style.fontSize = '13px';
              td.style.color = '#374151';
            });
          });

          // Remove unwanted elements like buttons, actions, etc.
          const toRemove = clonedElement.querySelectorAll('.no-print, button, .no-pdf, [data-html2canvas-ignore]');
          toRemove.forEach(el => (el as HTMLElement).style.setProperty('display', 'none', 'important'));

          // Fix oklch / oklab colors for html2canvas compatibility
          const allElements = Array.from(clonedElement.getElementsByTagName('*'));
          
          // Replace Tailwind 4 utility colors (oklch/oklab) in stylesheets
          const styleTags = Array.from(clonedDoc.getElementsByTagName('style'));
          styleTags.forEach(tag => {
            if (tag.innerHTML) {
              tag.innerHTML = tag.innerHTML
                .replace(/oklch\([^)]+\)/g, '#10b981') // fallback to emerald color
                .replace(/oklab\([^)]+\)/g, '#10b981')
                .replace(/color-mix\([^)]+\)/g, '#374151');
            }
          });

          // Replace inline colors
          allElements.forEach(el => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style) {
              const props = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
              props.forEach(prop => {
                // @ts-ignore
                let val = htmlEl.style[prop];
                if (!val) {
                  try {
                    val = window.getComputedStyle(htmlEl).getPropertyValue(prop.replace(/([A-Z])/g, "-$1").toLowerCase());
                  } catch (e) {}
                }
                if (val && (val.includes('oklch') || val.includes('oklab') || val.includes('color-mix'))) {
                  if (prop === 'backgroundColor') {
                    // check if it's light background or green
                    if (val.includes('0.9') || val.includes('95%') || val.includes('50')) {
                      htmlEl.style.backgroundColor = '#f0fdf4'; // very light green
                    } else {
                      htmlEl.style.backgroundColor = '#10b981'; // solid green
                    }
                  } else if (prop === 'borderColor') {
                    htmlEl.style.borderColor = '#e5e7eb';
                  } else {
                    htmlEl.style[prop as any] = '#111827';
                  }
                }
              });
            }
          });
        }

        // Add Google Fonts and generic rules to cloned document head
        const style = clonedDoc.createElement('style');
        style.innerHTML = `
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
          * { 
            font-family: "Cairo", sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body { background: white !important; }
        `;
        clonedDoc.head.appendChild(style);
      }
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: orientation },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.avoid-break', '.company-invoice-header', '.customer-details-card'] }
  };

  try {
    await html2pdfFunc().set(opt).from(element).save();
  } catch (error) {
    console.error('PDF Export Error:', error);
    throw error;
  } finally {
    window.scrollTo(scrollX, scrollY);
  }
};
/**
 * Robust Data Export using jsPDF-AutoTable
 * Better for large tables and multi-page reports
 */
export const exportDataToPDF = (title: string, headers: string[], rows: any[][], filename: string) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Note: Arabic support in jsPDF requires embedded fonts.
  // This version is optimized for data structure and layout.
  
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFontSize(22);
  doc.setTextColor(6, 78, 59); // Emerald-900
  doc.text(title, pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128); // Gray-500
  doc.text(`تاريخ التصدير: ${formatDate(new Date())}`, pageWidth - 20, 10, { align: 'right' });
  
  // @ts-ignore
  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 30,
    theme: 'striped',
    styles: { 
      font: 'helvetica', 
      halign: 'right',
      fontSize: 11,
      cellPadding: 5
    },
    headStyles: { 
      fillColor: [16, 185, 129], // Emerald-500
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 12
    },
    alternateRowStyles: { 
      fillColor: [249, 250, 251] 
    },
    margin: { top: 30, left: 15, right: 15 },
    tableWidth: 'auto'
  });

  doc.save(`${filename}.pdf`);
};
