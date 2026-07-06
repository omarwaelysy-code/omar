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

export function oklchToRgb(lStr: string, cStr: string, hStr: string, opacityStr?: string): string {
  let L = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
  let C = parseFloat(cStr);
  let H = parseFloat(hStr);
  let opacity = opacityStr ? (opacityStr.endsWith('%') ? parseFloat(opacityStr) / 100 : parseFloat(opacityStr)) : 1;

  if (isNaN(L) || isNaN(C) || isNaN(H)) return 'rgb(0, 0, 0)';

  const phi = (H * Math.PI) / 180;
  const a = C * Math.cos(phi);
  const b = C * Math.sin(phi);

  const L_ = L + 0.3963377774 * a + 0.2158017502 * b;
  const M_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const S_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = L_ * L_ * L_;
  const m = M_ * M_ * M_;
  const s = S_ * S_ * S_;

  let r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b_ = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const gamma = (c: number) => {
    if (c <= 0.0031308) return 12.92 * c;
    return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  const R = Math.max(0, Math.min(255, Math.round(gamma(r) * 255)));
  const G = Math.max(0, Math.min(255, Math.round(gamma(g) * 255)));
  const B = Math.max(0, Math.min(255, Math.round(gamma(b_) * 255)));

  if (opacity < 1) {
    return `rgba(${R}, ${G}, ${B}, ${opacity})`;
  }
  return `rgb(${R}, ${G}, ${B})`;
}

export function replaceOklabWithRgb(cssText: string): string {
  return cssText.replace(/oklab\(\s*([0-9.]+%?)\s+([0-9.-]+)\s+([0-9.-]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/g, (match, lStr, aStr, bStr, alphaStr) => {
    let L = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
    let a = parseFloat(aStr);
    let b = parseFloat(bStr);
    let opacity = alphaStr ? (alphaStr.endsWith('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr)) : 1;

    if (isNaN(L) || isNaN(a) || isNaN(b)) return 'rgb(0, 0, 0)';

    const L_ = L + 0.3963377774 * a + 0.2158017502 * b;
    const M_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const S_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = L_ * L_ * L_;
    const m = M_ * M_ * M_;
    const s = S_ * S_ * S_;

    let r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let b_ = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    const gamma = (c: number) => {
      if (c <= 0.0031308) return 12.92 * c;
      return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    };

    const R = Math.max(0, Math.min(255, Math.round(gamma(r) * 255)));
    const G = Math.max(0, Math.min(255, Math.round(gamma(g) * 255)));
    const B = Math.max(0, Math.min(255, Math.round(gamma(b_) * 255)));

    if (opacity < 1) {
      return `rgba(${R}, ${G}, ${B}, ${opacity})`;
    }
    return `rgb(${R}, ${G}, ${B})`;
  });
}

export function replaceOklchWithRgb(cssText: string): string {
  return cssText.replace(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/g, (match, lStr, cStr, hStr, aStr) => {
    return oklchToRgb(lStr, cStr, hStr, aStr);
  });
}

export const sanitizeStylesForPDF = () => {
  const backups: Array<{ element: HTMLElement; originalHtml?: string; disabledState?: boolean }> = [];
  const tempStyles: HTMLStyleElement[] = [];

  const cleanCss = (text: string) => replaceOklabWithRgb(replaceOklchWithRgb(text));

  // 1. Sanitize all inline <style> tags
  const styleTags = Array.from(document.getElementsByTagName('style'));
  styleTags.forEach(tag => {
    const originalHtml = tag.innerHTML;
    backups.push({ element: tag, originalHtml });
    tag.innerHTML = cleanCss(originalHtml);
  });

  // 2. Handle <link rel="stylesheet"> tags
  const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
  linkTags.forEach(link => {
    try {
      const sheet = link.sheet;
      if (sheet) {
        let cssText = '';
        try {
          const rules = Array.from(sheet.cssRules);
          rules.forEach(rule => {
            cssText += rule.cssText + '\n';
          });
        } catch (e) {
          // Cross-origin CSS file (CORS issue), disable it during print
          backups.push({ element: link, disabledState: link.disabled });
          link.disabled = true;
          return;
        }
        
        const tempStyle = document.createElement('style');
        tempStyle.innerHTML = cleanCss(cssText);
        document.head.appendChild(tempStyle);
        tempStyles.push(tempStyle);

        backups.push({ element: link, disabledState: link.disabled });
        link.disabled = true;
      }
    } catch (err) {
      console.warn('Could not read rules from link stylesheet:', link.href, err);
    }
  });

  // 3. Mock document.styleSheets to exclude any disabled or unreachable sheets
  const filteredSheets = Array.from(document.styleSheets).filter(sheet => {
    try {
      if (sheet.disabled) return false;
      const testRules = sheet.cssRules;
      return true;
    } catch (e) {
      return false;
    }
  });

  Object.defineProperty(document, 'styleSheets', {
    get() {
      return filteredSheets;
    },
    configurable: true
  });

  return () => {
    // Restore styleSheets property descriptor
    // @ts-ignore
    delete document.styleSheets;

    backups.forEach(backup => {
      if (backup.originalHtml !== undefined) {
        (backup.element as HTMLStyleElement).innerHTML = backup.originalHtml;
      }
      if (backup.disabledState !== undefined) {
        (backup.element as HTMLLinkElement).disabled = backup.disabledState;
      }
    });
    tempStyles.forEach(tag => {
      if (tag.parentNode) {
        tag.parentNode.removeChild(tag);
      }
    });
  };
};

export const exportToPDF = async (element: HTMLElement, options: PDFOptions) => {
  const { filename, margin = 10, orientation = 'portrait', reportTitle } = options;

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

  // 1. Create an isolated off-screen container in document.body
  const tempContainer = document.createElement('div');
  tempContainer.id = 'pdf-temp-container';
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '-9999px';
  tempContainer.style.width = orientation === 'landscape' ? '1120px' : '800px';
  tempContainer.style.backgroundColor = '#ffffff';
  tempContainer.style.direction = 'rtl';

  // 2. Clone the element to print/export
  const clone = element.cloneNode(true) as HTMLElement;
  
  // 3. Clean clone layout class list (strip fixed heights, scrolling behaviors, and flex containers)
  clone.className = clone.className
    .split(' ')
    .filter(c => !c.includes('flex-1') && !c.includes('overflow-y-auto') && !c.includes('h-full') && !c.includes('max-h-'))
    .join(' ');
  clone.style.overflow = 'visible';
  clone.style.maxHeight = 'none';
  clone.style.height = 'auto';
  clone.style.width = '100%';
  clone.style.padding = '24px';
  clone.style.boxSizing = 'border-box';

  // 4. Strip interactive and unwanted elements (buttons, sidebars)
  const toRemove = clone.querySelectorAll('.no-print, button, .no-pdf, [data-html2canvas-ignore]');
  toRemove.forEach(el => (el as HTMLElement).style.setProperty('display', 'none', 'important'));

  // 5. Inject title header if specified and this is NOT a single invoice document (which has its own header)
  if (reportTitle && !element.id?.includes('invoice-capture-area')) {
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.marginBottom = '25px';
    headerDiv.style.borderBottom = '2px solid #10b981';
    headerDiv.style.paddingBottom = '12px';
    headerDiv.style.direction = 'rtl';
    headerDiv.style.fontFamily = '"Cairo", sans-serif';

    const titleH1 = document.createElement('h1');
    titleH1.innerText = reportTitle;
    titleH1.style.fontSize = '20px';
    titleH1.style.fontWeight = 'bold';
    titleH1.style.color = '#064e3b';
    titleH1.style.margin = '0';
    headerDiv.appendChild(titleH1);

    const dateP = document.createElement('p');
    dateP.innerText = `تاريخ التصدير: ${formatDate(new Date())}`;
    dateP.style.fontSize = '11px';
    dateP.style.color = '#6b7280';
    dateP.style.margin = '0';
    headerDiv.appendChild(dateP);

    clone.insertBefore(headerDiv, clone.firstChild);
  }

  // 6. Apply compact, professional table styling inside the clone to prevent oversized rows
  const tables = Array.from(clone.getElementsByTagName('table'));
  tables.forEach(table => {
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginBottom = '20px';
    
    const ths = Array.from(table.getElementsByTagName('th'));
    ths.forEach(th => {
      th.style.backgroundColor = '#f9fafb';
      th.style.color = '#111827';
      th.style.fontWeight = 'bold';
      th.style.padding = '6px 8px';
      th.style.border = '1px solid #e5e7eb';
      th.style.textAlign = 'right';
      th.style.fontSize = '11px';
    });

    const tds = Array.from(table.getElementsByTagName('td'));
    tds.forEach(td => {
      td.style.padding = '5px 8px';
      td.style.border = '1px solid #e5e7eb';
      td.style.textAlign = 'right';
      td.style.fontSize = '10px';
      td.style.color = '#374151';
    });
  });

  // 7. Replace Tailwind oklch/oklab colors with compatible hex fallbacks
  const allCloneElements = Array.from(clone.getElementsByTagName('*'));
  allCloneElements.concat([clone]).forEach(el => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.style) {
      const props = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
      props.forEach(prop => {
        // @ts-ignore
        let val = htmlEl.style[prop];
        if (val && (val.includes('oklch') || val.includes('oklab'))) {
          // @ts-ignore
          htmlEl.style[prop] = replaceOklabWithRgb(replaceOklchWithRgb(val));
        }
      });
    }
  });

  tempContainer.appendChild(clone);
  document.body.appendChild(tempContainer);

  // 8. Inject styling tag to guarantee font availability inside tempContainer
  const fontStyle = document.createElement('style');
  fontStyle.innerHTML = `
    #pdf-temp-container, #pdf-temp-container * { 
      font-family: "Cairo", sans-serif !important;
    }
  `;
  tempContainer.appendChild(fontStyle);

  const targetWidth = orientation === 'landscape' ? 1120 : 800;
  const opt = {
    margin: margin,
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      allowTaint: true,
      removeContainer: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: targetWidth
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: orientation },
    pagebreak: { mode: ['css', 'legacy'], avoid: 'tr, .avoid-break, .company-invoice-header' }
  };

  const restoreStyles = sanitizeStylesForPDF();

  try {
    await html2pdfFunc().set(opt).from(tempContainer).save();
  } catch (error) {
    console.error('PDF Export Error:', error);
    throw error;
  } finally {
    restoreStyles();
    if (document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
    }
  }
};

/**
 * Robust Data Export using jsPDF-AutoTable
 * Better for large tables and multi-page reports
 */
export const exportDataToPDF = (title: string, headers: string[], rows: any[][], filename: string) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
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

/**
 * Universal print utility that clones the target element and appends it to the body.
 * This completely isolates the element from any fixed/flex containers, modals, and backdrops.
 */
export const printElement = (element: HTMLElement) => {
  if (!element) return;

  // Create a print container
  const printContainer = document.createElement('div');
  printContainer.id = 'print-section';
  
  // Clone the element
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Strip flex layout & scroll container classes on the clone to prevent formatting issues
  clone.className = clone.className
    .split(' ')
    .filter(c => !c.includes('flex-1') && !c.includes('overflow-y-auto') && !c.includes('h-full') && !c.includes('max-h-'))
    .join(' ');
  clone.style.overflow = 'visible';
  clone.style.maxHeight = 'none';
  clone.style.height = 'auto';
  clone.style.width = '100%';

  printContainer.appendChild(clone);
  document.body.appendChild(printContainer);

  // Add print-specific styles dynamically
  const style = document.createElement('style');
  style.innerHTML = `
    @media print {
      body > *:not(#print-section) {
        display: none !important;
      }
      #print-section {
        display: block !important;
        width: 100% !important;
        direction: rtl !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      #print-section table {
        width: 100% !important;
        font-size: 11px !important;
        border-collapse: collapse !important;
      }
      #print-section th {
        padding: 6px 8px !important;
        font-size: 11px !important;
        background-color: #fafafa !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #print-section td {
        padding: 5px 8px !important;
        font-size: 10px !important;
      }
      #print-section svg {
        max-width: 120px !important;
        height: auto !important;
      }
      .no-print, button, .no-pdf, [data-html2canvas-ignore] {
        display: none !important;
      }
      img {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;
  document.head.appendChild(style);

  // Trigger print
  window.print();

  // Cleanup after printing dialog closes
  setTimeout(() => {
    try {
      if (document.body.contains(printContainer)) {
        document.body.removeChild(printContainer);
      }
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    } catch (e) {
      console.error('Print Cleanup Error:', e);
    }
  }, 1000);
};
