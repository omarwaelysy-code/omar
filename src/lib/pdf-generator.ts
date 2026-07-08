import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import * as fontkit from 'fontkit';
import bidiFactory from 'bidi-js';
import QRCodeNode from 'qrcode';
// @ts-ignore
import reshaper from 'arabic-persian-reshaper';

const bidi = bidiFactory();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ColumnDef {
  id: string;
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

function mirrorChar(char: string): string {
  switch (char) {
    case '(': return ')';
    case ')': return '(';
    case '[': return ']';
    case ']': return '[';
    case '{': return '}';
    case '}': return '{';
    case '<': return '>';
    case '>': return '<';
    default: return char;
  }
}

export function processLine(shapedLine: string): string {
  if (!shapedLine) return '';
  const embeddingLevels = bidi.getEmbeddingLevels(shapedLine, 'rtl');
  const flips = bidi.getReorderSegments(shapedLine, embeddingLevels);
  let arr = shapedLine.split('');
  flips.forEach(([start, end]) => {
    const segment = arr.slice(start, end + 1).reverse().map(mirrorChar);
    for (let i = start; i <= end; i++) {
      arr[i] = segment[i - start];
    }
  });
  return arr.join('');
}

function shapeText(text: any): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  return reshaper.ArabicShaper.convertArabic(str);
}

export function renderArabic(text: string): string {
  if (text === null || text === undefined) return '';
  const str = String(text);

  // Check if string contains any Arabic characters (Unicode range 0600-06FF)
  const hasArabic = /[\u0600-\u06ff]/.test(str);
  if (!hasArabic) {
    return str;
  }

  const shaped = shapeText(str);
  const reordered = processLine(shaped);

  // Temporary debug log
  console.log(`[DEBUG-ARABIC] Original: "${str}" | Shaped: "${shaped}" | BiDi: "${reordered}"`);

  return reordered;
}

export function wrapText(doc: any, rawText: string, maxWidth: number, fontName: string, fontSize: number): string[] {
  doc.font(fontName).fontSize(fontSize);
  const paragraphs = rawText.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (para === '') {
      lines.push('');
      continue;
    }
    const words = para.split(/(\s+)/);
    let currentLine = '';

    for (const word of words) {
      if (word === '') continue;
      const testLine = currentLine + word;
      
      // Shape the test line to get precise width of the connected glyphs!
      const testLineShaped = shapeText(testLine);
      const testLineWidth = doc.widthOfString(testLineShaped);

      if (testLineWidth > maxWidth) {
        if (currentLine && currentLine.trim() !== '') {
          lines.push(currentLine);
          currentLine = word.trim() === '' ? '' : word;
        } else {
          // Force break single word
          let testWord = '';
          for (const char of word) {
            const testWordShaped = shapeText(testWord + char);
            if (doc.widthOfString(testWordShaped) > maxWidth) {
              lines.push(testWord);
              testWord = char;
            } else {
              testWord += char;
            }
          }
          currentLine = testWord;
        }
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine && currentLine.trim() !== '') {
      lines.push(currentLine);
    }
  }

  return lines;
}

export async function generatePDF(templateName: string, dto: any): Promise<Buffer> {
  const STEP = '[PDF-GENERATOR]';
  console.log(`${STEP} ▶ ENTER generatePDF | template: ${templateName}`);

  const company = dto.company || {};
  
  // Resolve paths for fonts relative to the file location to make it directory-independent
  const regularPath = path.resolve(__dirname, '../../public/fonts/NotoSansArabic-Regular.ttf');
  const boldPath = path.resolve(__dirname, '../../public/fonts/NotoSansArabic-Bold.ttf');

  if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
    throw new Error(`Font files not found at ${regularPath} or ${boldPath}`);
  }

  // Pre-load company logo as Buffer if present
  let logoBuffer: Buffer | null = null;
  if (company.logoUrl && company.logoUrl.startsWith('data:image')) {
    const base64Data = company.logoUrl.split(',')[1];
    if (base64Data) {
      try {
        logoBuffer = Buffer.from(base64Data, 'base64');
      } catch (e: any) {
        console.error(`${STEP} Failed to parse base64 logo:`, e.message);
      }
    }
  }

  // Pre-load or generate QR Code Buffer if present
  let qrBuffer: Buffer | null = null;
  const qrData = dto.qr_code || dto.qrCode || dto.qrcode;
  if (qrData) {
    if (qrData.startsWith('data:image')) {
      const base64Data = qrData.split(',')[1];
      if (base64Data) {
        try {
          qrBuffer = Buffer.from(base64Data, 'base64');
        } catch (e: any) {
          console.error(`${STEP} Failed to parse base64 QR code:`, e.message);
        }
      }
    } else {
      try {
        // Generate QR code directly using qrcode library
        qrBuffer = await QRCodeNode.toBuffer(qrData, { type: 'png', margin: 1, width: 80 });
      } catch (e: any) {
        console.error(`${STEP} Failed to generate QR code:`, e.message);
      }
    }
  }

  // Detect paper size options (A4 vs Thermal 80mm/58mm)
  const isThermal = templateName.toLowerCase().includes('thermal') || 
                    dto.isThermal || 
                    dto.paperSize === 'thermal_80' || 
                    dto.paperSize === 'thermal_58';
  
  const is58 = dto.paperSize === 'thermal_58' || templateName.toLowerCase().includes('58');
  
  // Page Width (in points): A4 is 595.28, 80mm is ~226.77, 58mm is ~164.41
  const pageWidth = isThermal ? (is58 ? 164.41 : 226.77) : 595.28;
  
  // Estimate height dynamically for thermal receipts to avoid empty trailing space
  let pageHeight = 841.89; // A4 height
  if (isThermal) {
    const itemCount = (dto.items || []).length;
    const rowsCount = (dto.rows || []).length;
    const itemsLen = Math.max(itemCount, rowsCount);
    const metaCount = 4;
    pageHeight = 120 + (itemsLen * 24) + (metaCount * 11) + (dto.description ? 45 : 0) + (qrBuffer ? 60 : 0) + 120;
    if (pageHeight < 280) pageHeight = 280;
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [pageWidth, pageHeight],
        margins: isThermal 
          ? { top: 10, bottom: 10, left: 10, right: 10 }
          : { top: 40, bottom: 40, left: 30, right: 30 },
        bufferPages: true
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      // Register fontkit to support local TTF fonts
      (doc as any).fontkit = fontkit.default || fontkit;

      // Register Noto Sans Arabic fonts as path files to guarantee perfect metadata loading
      doc.registerFont('Arabic-Regular', regularPath);
      doc.registerFont('Arabic-Bold', boldPath);

      // Set default font
      doc.font('Arabic-Regular').fontSize(isThermal ? 7.5 : 10);

      const usableWidth = isThermal ? (pageWidth - 20) : (doc.page.width - 60);
      const sideMargin = isThermal ? 10 : 30;
      let currentY = isThermal ? 10 : 40;

      // Custom safe text rendering function that enforces correct font, size, and Arabic shaping
      const renderText = (
        text: string,
        x: number,
        y: number,
        options: {
          width?: number;
          align?: 'left' | 'right' | 'center';
          font?: string;
          size?: number;
        } = {}
      ) => {
        const fontName = options.font || 'Arabic-Regular';
        const fontSize = options.size || (isThermal ? 7.5 : 10);
        
        doc.font(fontName).fontSize(fontSize);
        
        const rendered = renderArabic(text);
        
        // Runtime log before doc.text call
        console.log(`[RUNTIME-DRAW] Original: "${text}" | Rendered: "${rendered}" | Font: "${fontName}" | Size: ${fontSize} | Pos: (${x.toFixed(1)}, ${y.toFixed(1)})`);

        const textOptions: any = {};
        if (options.width !== undefined) textOptions.width = options.width;
        if (options.align !== undefined) textOptions.align = options.align;
        
        doc.text(rendered, x, y, textOptions);
      };

      // Draw Header Helper
      const drawHeader = (title: string, branchName = '', userName = '', dateStr = '') => {
        const logoSize = isThermal ? 32 : 50;
        
        // 1. Logo
        if (logoBuffer) {
          try {
            const logoX = isThermal ? (pageWidth - logoSize) / 2 : (doc.page.width - sideMargin - logoSize);
            doc.image(logoBuffer, logoX, currentY, { width: logoSize, height: logoSize });
            if (isThermal) {
              currentY += logoSize + 5;
            }
          } catch (e: any) {
            console.error(`${STEP} Logo render error:`, e.message);
          }
        }

        // 2. Company Info
        if (isThermal) {
          renderText(company.name || '', sideMargin, currentY, { width: usableWidth, align: 'center', font: 'Arabic-Bold', size: 9.5 });
          currentY += 12;
        } else {
          renderText(company.name || '', doc.page.width - sideMargin - 310, currentY + 5, { width: 250, align: 'right', font: 'Arabic-Bold', size: 12 });
        }

        if (company.taxNumber) {
          const label = `الرقم الضريبي: ${company.taxNumber}`;
          if (isThermal) {
            renderText(label, sideMargin, currentY, { width: usableWidth, align: 'center', size: 7.5 });
            currentY += 10;
          } else {
            renderText(label, doc.page.width - sideMargin - 310, currentY + 20, { width: 250, align: 'right', size: 8.5 });
          }
        }
        if (company.phone) {
          const label = `الهاتف: ${company.phone}`;
          if (isThermal) {
            renderText(label, sideMargin, currentY, { width: usableWidth, align: 'center', size: 7.5 });
            currentY += 10;
          } else {
            renderText(label, doc.page.width - sideMargin - 310, currentY + 32, { width: 250, align: 'right', size: 8.5 });
          }
        }

        // 3. Document Title
        if (isThermal) {
          currentY += 2;
          renderText(title, sideMargin, currentY, { width: usableWidth, align: 'center', font: 'Arabic-Bold', size: 9 });
          currentY += 12;
        } else {
          renderText(title, sideMargin, currentY + 12, { width: usableWidth - 300, align: 'left', font: 'Arabic-Bold', size: 15 });
        }

        if (branchName) {
          const label = `الفرع: ${branchName}`;
          if (isThermal) {
            renderText(label, sideMargin, currentY, { width: usableWidth, align: 'center', size: 7.5 });
            currentY += 10;
          } else {
            renderText(label, sideMargin, currentY + 30, { width: usableWidth - 300, align: 'left', size: 8.5 });
          }
        }

        // 4. Meta Info
        const dateValue = dateStr || new Date().toLocaleDateString('ar-SA');
        if (isThermal) {
          renderText(`المستخدم: ${userName || 'المشرف'}`, sideMargin, currentY, { width: usableWidth, align: 'center', size: 7 });
          currentY += 9;
          renderText(`التاريخ: ${dateValue}`, sideMargin, currentY, { width: usableWidth, align: 'center', size: 7 });
          currentY += 12;
        } else {
          renderText(`المستخدم: ${userName || 'المشرف'}`, sideMargin, currentY + 5, { width: 150, align: 'left', size: 8 });
          renderText(`التاريخ: ${dateValue}`, sideMargin, currentY + 15, { width: 150, align: 'left', size: 8 });
        }

        // Divider Line
        doc.strokeColor('#10b981')
           .lineWidth(isThermal ? 1 : 2)
           .moveTo(sideMargin, currentY + (isThermal ? 0 : 5))
           .lineTo(doc.page.width - sideMargin, currentY + (isThermal ? 0 : 5))
           .stroke();

        currentY += isThermal ? 8 : 15;
      };

      // Helper to draw the table
      const drawTable = (
        columns: ColumnDef[],
        rows: any[],
        totals: any
      ) => {
        const colWidths = columns.map(col => (col.width / 100) * usableWidth);

        const drawRow = (rowItems: string[], y: number, isHeader = false, isTotal = false) => {
          const rowHeight = isThermal ? 14 : 18;
          let maxCellHeight = rowHeight;
          
          const cellFont = isHeader || isTotal ? 'Arabic-Bold' : 'Arabic-Regular';
          const cellSize = isThermal ? 7.5 : 8.5;

          const cellLines = rowItems.map((cellText, colIndex) => {
            const colWidth = colWidths[colIndex];
            
            // Wrap the raw text first based on correct font metrics
            const wrapped = wrapText(doc, cellText, colWidth - (isThermal ? 4 : 10), cellFont, cellSize);
            const lineCount = wrapped.length || 1;
            const cellHeight = lineCount * (isThermal ? 9.5 : 11) + (isThermal ? 4.5 : 7);
            if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
            
            return wrapped; // return raw wrapped lines
          });

          // Check for page break (only for A4; thermal receipts print continuously on a single custom page)
          if (!isThermal && (y + maxCellHeight > doc.page.height - 50)) {
            doc.addPage();
            y = 40;
            if (!isHeader) {
              y = drawRow(columns.map(c => c.label), y, true);
            }
          }

          // Draw backgrounds and borders
          if (isHeader) {
            doc.fillColor('#10b981').rect(sideMargin, y, usableWidth, maxCellHeight).fill();
          } else if (isTotal) {
            doc.fillColor('#f3f4f6').rect(sideMargin, y, usableWidth, maxCellHeight).fill();
          } else {
            doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(sideMargin, y + maxCellHeight).lineTo(sideMargin + usableWidth, y + maxCellHeight).stroke();
          }

          // Draw cells
          let currentX = sideMargin;
          cellLines.forEach((lines, colIndex) => {
            const colWidth = colWidths[colIndex];
            const align = columns[colIndex].align || 'right';
            
            doc.fillColor(isHeader ? '#ffffff' : '#1f2937');

            lines.forEach((line, lineIndex) => {
              const textY = y + (isThermal ? 2.5 : 4) + lineIndex * (isThermal ? 9.5 : 11);
              renderText(line, currentX + (isThermal ? 2 : 5), textY, {
                width: colWidth - (isThermal ? 4 : 10),
                align: align,
                font: cellFont,
                size: cellSize
              });
            });

            // Vertical borders
            doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(currentX, y).lineTo(currentX, y + maxCellHeight).stroke();

            currentX += colWidth;
          });

          // Rightmost vertical border
          doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(sideMargin + usableWidth, y).lineTo(sideMargin + usableWidth, y + maxCellHeight).stroke();

          return y + maxCellHeight;
        };

        // Draw Header
        currentY = drawRow(columns.map(c => c.label), currentY, true);

        // Draw Body Rows
        for (const row of rows) {
          const rowItems = columns.map(col => {
            const val = row[col.id];
            return val !== undefined ? String(val) : '';
          });
          currentY = drawRow(rowItems, currentY);
        }

        // Draw Totals
        if (totals && Object.keys(totals).length > 0) {
          const totalItems = columns.map((col, index) => {
            if (totals[col.id] !== undefined) {
              return String(totals[col.id]);
            } else if (index === 0) {
              return 'الإجمالي';
            } else {
              return '';
            }
          });
          currentY = drawRow(totalItems, currentY, false, true);
        }
      };

      // Helper to draw Meta Grid
      const drawMetaGrid = (items: { label: string; val: string }[]) => {
        const colWidth = usableWidth / items.length;
        let maxValHeight = 12;

        const fontLabel = 'Arabic-Regular';
        const fontVal = 'Arabic-Bold';
        const sizeLabel = isThermal ? 7.5 : 8.5;
        const sizeVal = isThermal ? 7.5 : 9.0;

        const processedItems = items.map(item => {
          // Wrap raw labels and values first
          const wrappedLabel = wrapText(doc, item.label, colWidth - (isThermal ? 4 : 10), fontLabel, sizeLabel);
          const wrappedVal = wrapText(doc, item.val, colWidth - (isThermal ? 4 : 10), fontVal, sizeVal);

          const height = (wrappedLabel.length + wrappedVal.length) * (isThermal ? 9.5 : 11) + (isThermal ? 6 : 10);
          if (height > maxValHeight) maxValHeight = height;

          return { wrappedLabel, wrappedVal };
        });

        // Page break check (only A4)
        if (!isThermal && (currentY + maxValHeight > doc.page.height - 50)) {
          doc.addPage();
          currentY = 40;
        }

        // Draw backgrounds and borders
        doc.fillColor('#f9fafb').rect(sideMargin, currentY, usableWidth, maxValHeight).fill();
        doc.strokeColor('#e5e7eb').lineWidth(0.5).rect(sideMargin, currentY, usableWidth, maxValHeight).stroke();

        let currentX = sideMargin;
        processedItems.forEach((item, index) => {
          doc.fillColor('#4b5563');
          item.wrappedLabel.forEach((line, lineIndex) => {
            renderText(line, currentX + (isThermal ? 2 : 5), currentY + (isThermal ? 3 : 5) + lineIndex * (isThermal ? 9.5 : 11), { 
              width: colWidth - (isThermal ? 4 : 10), 
              align: 'right',
              font: fontLabel,
              size: sizeLabel
            });
          });

          doc.fillColor('#1f2937');
          const labelOffset = item.wrappedLabel.length * (isThermal ? 9.5 : 11);
          item.wrappedVal.forEach((line, lineIndex) => {
            renderText(line, currentX + (isThermal ? 2 : 5), currentY + (isThermal ? 3 : 5) + labelOffset + lineIndex * (isThermal ? 9.5 : 11), { 
              width: colWidth - (isThermal ? 4 : 10), 
              align: 'right',
              font: fontVal,
              size: sizeVal
            });
          });

          if (index < items.length - 1) {
            doc.strokeColor('#e5e7eb').lineWidth(0.5)
               .moveTo(currentX + colWidth, currentY)
               .lineTo(currentX + colWidth, currentY + maxValHeight)
               .stroke();
          }

          currentX += colWidth;
        });

        currentY += maxValHeight + (isThermal ? 8 : 15);
      };

      // Helper to draw signatures
      const drawSignatures = (leftTitle: string, rightTitle: string) => {
        if (!isThermal && (currentY + 55 > doc.page.height - 50)) {
          doc.addPage();
          currentY = 40;
        }
        const boxWidth = isThermal ? 75 : 140;

        const leftX = sideMargin + (usableWidth / 4) - (boxWidth / 2);
        doc.strokeColor('#9ca3af').lineWidth(0.5)
           .moveTo(leftX, currentY + (isThermal ? 20 : 30))
           .lineTo(leftX + boxWidth, currentY + (isThermal ? 20 : 30))
           .stroke();
        renderText(leftTitle, leftX, currentY + (isThermal ? 24 : 36), { width: boxWidth, align: 'center', font: 'Arabic-Bold', size: isThermal ? 7 : 8.5 });

        const rightX = sideMargin + (3 * usableWidth / 4) - (boxWidth / 2);
        doc.strokeColor('#9ca3af').lineWidth(0.5)
           .moveTo(rightX, currentY + (isThermal ? 20 : 30))
           .lineTo(rightX + boxWidth, currentY + (isThermal ? 20 : 30))
           .stroke();
        renderText(rightTitle, rightX, currentY + (isThermal ? 24 : 36), { width: boxWidth, align: 'center', font: 'Arabic-Bold', size: isThermal ? 7 : 8.5 });

        currentY += isThermal ? 35 : 55;
      };

      // Switch based on template name
      switch (templateName) {
        case 'InvoiceTemplate':
        case 'SalesInvoicePdf':
        case 'PurchaseInvoicePdf': {
          const isSales = templateName.includes('Sales') || templateName === 'InvoiceTemplate';
          const title = isSales ? 'فاتورة مبيعات' : 'فاتورة مشتريات';
          const partyLabel = isSales ? 'العميل' : 'المورد';
          const partyName = isSales ? dto.customer_name : dto.supplier_name;
          const partyTaxNum = isSales ? dto.customer_tax_number : dto.supplier_tax_number;

          // Header
          drawHeader(title, dto.branchName, dto.userName, dto.date);

          // Meta Grid
          const metaItems = [
            { label: 'رقم الفاتورة:', val: dto.invoice_number || '' },
            { label: 'طريقة الدفع:', val: dto.payment_method || '' },
            { label: partyLabel + ':', val: (partyName || '') + (partyTaxNum ? ` (الرقم الضريبي: ${partyTaxNum})` : '') }
          ];
          drawMetaGrid(metaItems);

          // Table Columns (simplified structure for narrow thermal rolls)
          const columns: ColumnDef[] = isThermal ? [
            { id: 'product_name', label: 'الصنف', width: 55, align: 'right' },
            { id: 'quantity', label: 'الكمية', width: 15, align: 'right' },
            { id: 'total', label: 'الإجمالي', width: 30, align: 'right' }
          ] : [
            { id: 'product_code', label: 'كود الصنف', width: 12, align: 'right' },
            { id: 'product_name', label: 'الصنف', width: 33, align: 'right' },
            { id: 'quantity', label: 'الكمية', width: 10, align: 'right' },
            { id: 'unit', label: 'الوحدة', width: 10, align: 'right' },
            { id: 'unit_price', label: 'السعر', width: 11, align: 'right' },
            { id: 'discount', label: 'الخصم', width: 8, align: 'right' },
            { id: 'vat_amount', label: 'الضريبة', width: 8, align: 'right' },
            { id: 'total', label: 'الإجمالي', width: 8, align: 'right' }
          ];
          
          drawTable(columns, dto.items || [], null);

          // Summary box
          const summaryWidth = isThermal ? 130 : 200;
          const summaryHeight = isThermal 
            ? (50 + (Number(dto.discount_amount) > 0 ? 10 : 0))
            : (65 + (Number(dto.discount_amount) > 0 ? 12 : 0));
          
          if (!isThermal && (currentY + summaryHeight > doc.page.height - 50)) {
            doc.addPage();
            currentY = 40;
          }

          const summaryX = doc.page.width - sideMargin - summaryWidth;
          doc.fillColor('#f9fafb').rect(summaryX, currentY + 10, summaryWidth, summaryHeight).fill();
          doc.strokeColor('#10b981').lineWidth(1.5).rect(summaryX, currentY + 10, summaryWidth, summaryHeight).stroke();

          let summaryY = currentY + (isThermal ? 13 : 15);
          const drawSummaryRow = (label: string, val: string, isBold = false) => {
            const fontName = isBold ? 'Arabic-Bold' : 'Arabic-Regular';
            const fontSize = isThermal ? (isBold ? 8.5 : 7.5) : (isBold ? 9.5 : 8.5);
            renderText(label, summaryX + 2, summaryY, { width: isThermal ? 65 : 100, align: 'right', font: fontName, size: fontSize });
            renderText(val, summaryX + (isThermal ? 70 : 105), summaryY, { width: isThermal ? 58 : 90, align: 'left', font: fontName, size: fontSize });
            summaryY += isThermal ? 10 : 12;
          };

          drawSummaryRow('الإجمالي الفرعي:', dto.subtotal || '0.00');
          if (Number(dto.discount_amount) > 0) {
            drawSummaryRow('الخصم:', dto.discount_amount);
          }
          drawSummaryRow('الضريبة (15%):', dto.vat_amount || '0.00');
          summaryY += isThermal ? 1 : 2;
          doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(summaryX + 5, summaryY).lineTo(summaryX + summaryWidth - 5, summaryY).stroke();
          summaryY += isThermal ? 3 : 4;
          drawSummaryRow('الصافي النهائي:', dto.net_total || '0.00', true);

          currentY += summaryHeight + (isThermal ? 15 : 25);

          // QR Code rendering if present
          if (qrBuffer) {
            const qrSize = isThermal ? 50 : 65;
            const qrX = isThermal ? (pageWidth - qrSize) / 2 : sideMargin;
            if (!isThermal && (currentY + qrSize > doc.page.height - 50)) {
              doc.addPage();
              currentY = 40;
            }
            doc.image(qrBuffer, qrX, currentY, { width: qrSize, height: qrSize });
            if (isThermal) {
              currentY += qrSize + 10;
            }
          }

          // Signatures
          drawSignatures(
            isSales ? 'توقيع المحاسب' : 'توقيع المشتريات',
            isSales ? 'توقيع العميل' : 'اعتماد الإدارة'
          );
          break;
        }

        case 'StatementTemplate':
        case 'CustomerStatementPdf':
        case 'SupplierStatementPdf': {
          const isCust = templateName.includes('Customer') || templateName === 'StatementTemplate';
          const title = isCust ? 'كشف حساب عميل' : 'كشف حساب مورد';
          const partyName = isCust ? dto.customer_name : dto.supplier_name;

          drawHeader(title, dto.branchName, dto.userName);

          const metaItems = [
            { label: 'الاسم:', val: partyName || '' },
            { label: 'الفترة:', val: `من ${dto.date_from || ''} إلى ${dto.date_to || ''}` },
            { label: 'الرصيد الافتتاحي:', val: dto.starting_balance || '0.00' },
            { label: 'الرصيد الختامي:', val: dto.ending_balance || '0.00' }
          ];
          drawMetaGrid(metaItems);

          const columns: ColumnDef[] = isThermal ? [
            { id: 'date', label: 'التاريخ', width: 25, align: 'right' },
            { id: 'reference', label: 'المرجع', width: 25, align: 'right' },
            { id: 'balance', label: 'الرصيد', width: 50, align: 'right' }
          ] : [
            { id: 'date', label: 'التاريخ', width: 15, align: 'right' },
            { id: 'reference', label: 'المرجع', width: 15, align: 'right' },
            { id: 'description', label: 'البيان', width: 38, align: 'right' },
            { id: 'debit', label: 'مدين', width: 11, align: 'right' },
            { id: 'credit', label: 'دائن', width: 11, align: 'right' },
            { id: 'balance', label: 'الرصيد', width: 10, align: 'right' }
          ];
          
          const totals = isThermal ? {
            balance: dto.ending_balance || '0.00'
          } : {
            debit: dto.total_debit || '0.00',
            credit: dto.total_credit || '0.00',
            balance: dto.ending_balance || '0.00'
          };
          drawTable(columns, dto.rows || [], totals);
          break;
        }

        case 'LedgerTemplate':
        case 'LedgerPdf': {
          drawHeader('دفتر الأستاذ العام', dto.branchName, dto.userName);

          const metaItems = [
            { label: 'الفترة:', val: `من ${dto.date_from || ''} إلى ${dto.date_to || ''}` }
          ];
          drawMetaGrid(metaItems);

          const columns: ColumnDef[] = isThermal ? [
            { id: 'date', label: 'التاريخ', width: 30, align: 'right' },
            { id: 'account_name', label: 'الحساب', width: 40, align: 'right' },
            { id: 'debit', label: 'مدين', width: 30, align: 'right' }
          ] : [
            { id: 'date', label: 'التاريخ', width: 12, align: 'right' },
            { id: 'entry_num', label: 'رقم القيد', width: 12, align: 'right' },
            { id: 'account_code', label: 'كود الحساب', width: 14, align: 'right' },
            { id: 'account_name', label: 'اسم الحساب', width: 22, align: 'right' },
            { id: 'description', label: 'البيان', width: 22, align: 'right' },
            { id: 'debit', label: 'مدين', width: 9, align: 'right' },
            { id: 'credit', label: 'دائن', width: 9, align: 'right' }
          ];

          const totals = isThermal ? {
            debit: dto.total_debit || '0.00'
          } : {
            debit: dto.total_debit || '0.00',
            credit: dto.total_credit || '0.00'
          };
          drawTable(columns, dto.rows || [], totals);
          break;
        }

        case 'VoucherTemplate':
        case 'VoucherPdf': {
          const title = dto.isReceipt ? 'سند قبض نقدي / بنكي' : 'سند صرف نقدي / بنكي';
          drawHeader(title, dto.branchName, dto.userName, dto.date);

          const metaItems = [
            { label: 'رقم السند:', val: dto.voucher_number || '' },
            { label: 'طريقة الدفع:', val: dto.payment_method || '' },
            { label: dto.isReceipt ? 'مستلم من:' : 'مدفوع لـ:', val: dto.party_name || '' },
            { label: 'المبلغ الإجمالي:', val: dto.amount || '0.00' }
          ];
          drawMetaGrid(metaItems);

          if (dto.description) {
            const fontLabel = 'Arabic-Regular';
            const fontVal = 'Arabic-Bold';
            const sizeLabel = isThermal ? 7.5 : 8.5;
            const sizeVal = isThermal ? 7.5 : 9.5;

            // Wrap the raw description first based on font metrics
            const wrappedDesc = wrapText(doc, dto.description, usableWidth - (isThermal ? 8 : 20), fontVal, sizeVal);
            
            const boxHeight = (isThermal ? 10 : 12) + wrappedDesc.length * (isThermal ? 9.5 : 11) + (isThermal ? 6 : 10);

            if (!isThermal && (currentY + boxHeight > doc.page.height - 50)) {
              doc.addPage();
              currentY = 40;
            }

            doc.fillColor('#f9fafb').rect(sideMargin, currentY, usableWidth, boxHeight).fill();
            doc.strokeColor('#e5e7eb').lineWidth(0.5).rect(sideMargin, currentY, usableWidth, boxHeight).stroke();

            renderText("البيان / الشرح:", sideMargin + (isThermal ? 4 : 10), currentY + 5, { width: usableWidth - (isThermal ? 8 : 20), align: 'right', font: fontLabel, size: sizeLabel });

            wrappedDesc.forEach((line, lineIndex) => {
              renderText(line, sideMargin + (isThermal ? 4 : 10), currentY + (isThermal ? 14 : 16) + lineIndex * (isThermal ? 9.5 : 11), { 
                width: usableWidth - (isThermal ? 8 : 20), 
                align: 'right',
                font: fontVal,
                size: sizeVal
              });
            });

            currentY += boxHeight + (isThermal ? 8 : 15);
          }

          if (dto.items && dto.items.length > 0) {
            const columns: ColumnDef[] = isThermal ? [
              { id: 'account_name', label: 'الحساب الموجه', width: 60, align: 'right' },
              { id: 'amount', label: 'المبلغ', width: 40, align: 'right' }
            ] : [
              { id: 'account_code', label: 'كود الحساب', width: 18, align: 'right' },
              { id: 'account_name', label: 'اسم الحساب الموجه', width: 33, align: 'right' },
              { id: 'description', label: 'شرح السطر', width: 33, align: 'right' },
              { id: 'amount', label: 'المبلغ', width: 16, align: 'right' }
            ];
            const totals = {
              amount: dto.amount || '0.00'
            };
            drawTable(columns, dto.items, totals);
          }

          currentY += isThermal ? 5 : 10;
          drawSignatures('توقيع أمين الصندوق', 'توقيع المستلم');
          break;
        }

        default: {
          const title = dto.reportTitle || 'تقرير النظام';
          const columnsRaw = dto.columns || [];
          const rows = dto.rows || [];
          const totals = dto.totals || {};

          drawHeader(title, dto.branchName, dto.userName);

          const columns: ColumnDef[] = columnsRaw.map((col: any) => ({
            id: col.id,
            label: col.label || '',
            width: col.width || (100 / columnsRaw.length),
            align: 'right'
          }));

          drawTable(columns, rows, totals);
          break;
        }
      }

      // Add page numbers and footers (only for A4; thermal receipts print on a single continuous page)
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        doc.strokeColor('#e5e7eb').lineWidth(0.5)
           .moveTo(sideMargin, doc.page.height - (isThermal ? 16 : 40))
           .lineTo(doc.page.width - sideMargin, doc.page.height - (isThermal ? 16 : 40))
           .stroke();

        renderText("نظام ERP السحابي", sideMargin, doc.page.height - (isThermal ? 12 : 32), { align: 'left', font: 'Arabic-Regular', size: isThermal ? 6.5 : 8 });

        if (!isThermal) {
          const pageStr = `صفحة ${i + 1} من ${range.count}`;
          renderText(pageStr, doc.page.width - 150, doc.page.height - 32, {
            width: 120,
            align: 'right',
            font: 'Arabic-Regular',
            size: 8
          });
        }
      }

      doc.end();
    } catch (e: any) {
      console.error(`${STEP} Re-throwing layout error:`, e.stack);
      reject(e);
    }
  });
}
