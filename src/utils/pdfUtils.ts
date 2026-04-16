import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface PDFOptions {
  filename: string;
  margin?: number;
  orientation?: 'portrait' | 'landscape';
  reportTitle?: string;
}

export const exportToPDF = async (element: HTMLElement, options: PDFOptions) => {
  const { filename, margin = 10, orientation = 'landscape', reportTitle } = options;
  console.log('PDF Export: Starting professional export for', filename);

  if (!element) {
    console.error('PDF Export: Element not found');
    throw new Error('Element not found');
  }

  // Handle potential import variations
  // @ts-ignore
  const html2pdfFunc = html2pdf.default || html2pdf;

  if (typeof html2pdfFunc !== 'function') {
    console.error('PDF Export: html2pdf is not a function. Type:', typeof html2pdfFunc);
    throw new Error('PDF export library not loaded correctly');
  }

  // Store current scroll position
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  
  // Reset scroll to 0,0 for better capture
  window.scrollTo(0, 0);

  // Small delay to ensure any layout shifts or rendering is complete
  await new Promise(resolve => setTimeout(resolve, 150));

  // Get element dimensions for explicit canvas sizing
  const rect = element.getBoundingClientRect();
  // For landscape A4, we want a width around 1120px for good resolution
  const targetWidth = orientation === 'landscape' ? 1120 : 800;
  
  const opt = {
    margin: margin,
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { 
      scale: 3, // High resolution
      useCORS: true,
      letterRendering: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: targetWidth,
      onclone: (clonedDoc: Document) => {
        console.log('PDF Export: Cloning document and applying professional report styling...');
        
        // Find the cloned element
        let clonedElement: HTMLElement | null = null;
        if (element.id) {
          clonedElement = clonedDoc.getElementById(element.id);
        }
        if (!clonedElement) {
          // Fallback to finding by some other means if ID is missing or changed
          clonedElement = clonedDoc.body.querySelector(`[id="${element.id}"]`) as HTMLElement || 
                         clonedDoc.body.querySelector('table') as HTMLElement ||
                         clonedDoc.body.querySelector(':first-child') as HTMLElement;
        }

        if (clonedElement) {
          // Create a professional report wrapper
          const wrapper = clonedDoc.createElement('div');
          wrapper.style.padding = '40px';
          wrapper.style.backgroundColor = '#ffffff';
          wrapper.style.direction = 'rtl';
          wrapper.style.fontFamily = '"Cairo", sans-serif';
          wrapper.style.width = `${targetWidth}px`;
          wrapper.style.margin = '0 auto';

          // Add Header
          const header = clonedDoc.createElement('div');
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'flex-start';
          header.style.marginBottom = '30px';
          header.style.borderBottom = '2px solid #10b981';
          header.style.paddingBottom = '15px';

          const titleContainer = clonedDoc.createElement('div');
          const mainTitle = clonedDoc.createElement('h1');
          mainTitle.innerText = reportTitle || 'تقرير محاسبي';
          mainTitle.style.fontSize = '28px';
          mainTitle.style.fontWeight = 'bold';
          mainTitle.style.color = '#064e3b';
          mainTitle.style.margin = '0';
          titleContainer.appendChild(mainTitle);

          const dateContainer = clonedDoc.createElement('div');
          dateContainer.style.textAlign = 'left';
          const dateLabel = clonedDoc.createElement('p');
          dateLabel.innerText = `تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`;
          dateLabel.style.fontSize = '14px';
          dateLabel.style.color = '#6b7280';
          dateLabel.style.margin = '0';
          dateContainer.appendChild(dateLabel);

          header.appendChild(titleContainer);
          header.appendChild(dateContainer);
          wrapper.appendChild(header);

          // Move the cloned element into the wrapper
          const elementParent = clonedElement.parentElement;
          if (elementParent) {
            elementParent.replaceChild(wrapper, clonedElement);
            wrapper.appendChild(clonedElement);
          } else {
            clonedDoc.body.innerHTML = '';
            clonedDoc.body.appendChild(wrapper);
            wrapper.appendChild(clonedElement);
          }

          // Apply professional table styling
          clonedElement.style.width = '100%';
          clonedElement.style.borderCollapse = 'collapse';
          clonedElement.style.fontSize = '16px'; // Larger font
          clonedElement.style.overflow = 'visible';
          clonedElement.style.maxHeight = 'none';
          clonedElement.style.height = 'auto';

          // Style all tables within the element
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
              th.style.padding = '12px 15px';
              th.style.border = '1px solid #e5e7eb';
              th.style.textAlign = 'right';
              th.style.fontSize = '16px';
            });

            const tds = Array.from(table.getElementsByTagName('td'));
            tds.forEach(td => {
              td.style.padding = '10px 15px';
              td.style.border = '1px solid #e5e7eb';
              td.style.textAlign = 'right';
              td.style.fontSize = '14px';
              td.style.color = '#374151';
            });
          });

          // Remove unwanted elements
          const toRemove = clonedDoc.querySelectorAll('.no-print, button, .no-pdf, [data-html2canvas-ignore]');
          toRemove.forEach(el => (el as HTMLElement).style.display = 'none');

          // Clean all style tags in the cloned document for Tailwind 4 compatibility
          const styleTags = Array.from(clonedDoc.getElementsByTagName('style'));
          styleTags.forEach(tag => {
            if (tag.innerHTML) {
              tag.innerHTML = tag.innerHTML
                .replace(/oklch\([^)]+\)/g, '#000000')
                .replace(/oklab\([^)]+\)/g, '#000000')
                .replace(/color-mix\([^)]+\)/g, '#000000')
                .replace(/:\s*;/g, ': initial;');
            }
          });

          // Handle inline styles for oklch/oklab
          const allElements = Array.from(clonedDoc.getElementsByTagName('*'));
          allElements.forEach(el => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style) {
              const props = ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'];
              props.forEach(prop => {
                // @ts-ignore
                let val = htmlEl.style[prop];
                if (!val) {
                  try {
                    val = window.getComputedStyle(htmlEl).getPropertyValue(prop.replace(/([A-Z])/g, "-$1").toLowerCase());
                  } catch (e) {}
                }
                if (val && (val.includes('oklch') || val.includes('oklab') || val.includes('color-mix'))) {
                  // @ts-ignore
                  htmlEl.style[prop] = prop.toLowerCase().includes('background') ? 'transparent' : '#000000';
                }
              });
            }
          });
        }

        const style = clonedDoc.createElement('style');
        style.innerHTML = `
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
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
    jsPDF: { unit: 'mm', format: 'a4', orientation: orientation }
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
  doc.text(`تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}`, pageWidth - 20, 10, { align: 'right' });
  
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
