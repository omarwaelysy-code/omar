import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import bidiFactory from 'bidi-js';
// @ts-ignore
import reshaper from 'arabic-persian-reshaper';

const bidi = bidiFactory();

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

export function wrapText(doc: any, shapedText: string, maxWidth: number): string[] {
  const paragraphs = shapedText.split('\n');
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
      if (doc.widthOfString(testLine) > maxWidth) {
        if (currentLine && currentLine.trim() !== '') {
          lines.push(currentLine);
          currentLine = word.trim() === '' ? '' : word;
        } else {
          // Force break single word
          let testWord = '';
          for (const char of word) {
            if (doc.widthOfString(testWord + char) > maxWidth) {
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

function shapeText(text: any): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  return reshaper.ArabicShaper.convertArabic(str);
}

export async function generatePDF(templateName: string, dto: any): Promise<Buffer> {
  const STEP = '[PDF-GENERATOR]';
  console.log(`${STEP} ▶ ENTER generatePDF | template: ${templateName}`);

  const company = dto.company || {};
  
  // Resolve paths for fonts
  const regularPath = path.resolve('./public/fonts/NotoSansArabic-Regular.ttf');
  const boldPath = path.resolve('./public/fonts/NotoSansArabic-Bold.ttf');

  if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
    throw new Error(`Font files not found at ${regularPath} or ${boldPath}`);
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 30, right: 30 },
        bufferPages: true
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      // Register fonts (passing Buffers to support Vitest/JSDOM test environments)
      doc.registerFont('Arabic-Regular', fs.readFileSync(regularPath));
      doc.registerFont('Arabic-Bold', fs.readFileSync(boldPath));

      const usableWidth = doc.page.width - 60; // 535.28 points
      let currentY = 40;

      // Draw Header Helper
      const drawHeader = (title: string, branchName = '', userName = '', dateStr = '') => {
        const headerHeight = 70;
        
        // 1. Logo
        let logoBuffer: Buffer | null = null;
        if (company.logoUrl && company.logoUrl.startsWith('data:image')) {
          const base64Data = company.logoUrl.split(',')[1];
          if (base64Data) {
            logoBuffer = Buffer.from(base64Data, 'base64');
          }
        }
        
        if (logoBuffer) {
          try {
            doc.image(logoBuffer, doc.page.width - 80, currentY, { width: 50, height: 50 });
          } catch (e: any) {
            console.error(`${STEP} Logo render error:`, e.message);
          }
        }

        // 2. Company Info (aligned to the right)
        doc.fillColor('#064e3b').font('Arabic-Bold').fontSize(12);
        const nameShaped = shapeText(company.name || '');
        const nameVisual = processLine(nameShaped);
        doc.text(nameVisual, doc.page.width - 340, currentY + 5, { width: 250, align: 'right' });

        doc.fillColor('#4b5563').font('Arabic-Regular').fontSize(8.5);
        if (company.taxNumber) {
          const taxShaped = shapeText(`الرقم الضريبي: ${company.taxNumber}`);
          doc.text(processLine(taxShaped), doc.page.width - 340, currentY + 20, { width: 250, align: 'right' });
        }
        if (company.phone) {
          const phoneShaped = shapeText(`الهاتف: ${company.phone}`);
          doc.text(processLine(phoneShaped), doc.page.width - 340, currentY + 32, { width: 250, align: 'right' });
        }

        // 3. Document Title
        doc.fillColor('#064e3b').font('Arabic-Bold').fontSize(15);
        const titleShaped = shapeText(title);
        const titleVisual = processLine(titleShaped);
        doc.text(titleVisual, 30, currentY + 12, { width: usableWidth - 300, align: 'left' });

        if (branchName) {
          doc.fillColor('#4b5563').font('Arabic-Regular').fontSize(8.5);
          const branchShaped = shapeText(`الفرع: ${branchName}`);
          doc.text(processLine(branchShaped), 30, currentY + 30, { width: usableWidth - 300, align: 'left' });
        }

        // 4. Meta Info
        const dateValue = dateStr || new Date().toLocaleDateString('ar-SA');
        const userShaped = shapeText(`المستخدم: ${userName || 'المشرف'}`);
        const dateShaped = shapeText(`التاريخ: ${dateValue}`);
        
        doc.fillColor('#4b5563').font('Arabic-Regular').fontSize(8);
        doc.text(processLine(userShaped), 30, currentY + 5, { width: 150, align: 'left' });
        doc.text(processLine(dateShaped), 30, currentY + 15, { width: 150, align: 'left' });

        // Divider Line
        doc.strokeColor('#10b981').lineWidth(2).moveTo(30, currentY + 58).lineTo(doc.page.width - 30, currentY + 58).stroke();

        currentY += 70;
      };

      // Helper to draw the table
      const drawTable = (
        columns: ColumnDef[],
        rows: any[],
        totals: any
      ) => {
        const colWidths = columns.map(col => (col.width / 100) * usableWidth);

        const drawRow = (rowItems: string[], y: number, isHeader = false, isTotal = false) => {
          const rowHeight = 18;
          let maxCellHeight = rowHeight;
          const cellLines = rowItems.map((cellText, colIndex) => {
            const colWidth = colWidths[colIndex];
            const wrapped = wrapText(doc, shapeText(cellText), colWidth - 10);
            const lineCount = wrapped.length || 1;
            const cellHeight = lineCount * 11 + 7; // 11pt line height + padding
            if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
            return wrapped.map(line => processLine(line));
          });

          // Check if we need to break page before drawing this row
          if (y + maxCellHeight > doc.page.height - 50) {
            doc.addPage();
            y = 40;
            // Draw repeating header
            if (!isHeader) {
              y = drawRow(columns.map(c => c.label), y, true);
            }
          }

          // Draw background for header or total row
          if (isHeader) {
            doc.fillColor('#10b981').rect(30, y, usableWidth, maxCellHeight).fill();
          } else if (isTotal) {
            doc.fillColor('#f3f4f6').rect(30, y, usableWidth, maxCellHeight).fill();
          } else {
            // Draw bottom border
            doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(30, y + maxCellHeight).lineTo(30 + usableWidth, y + maxCellHeight).stroke();
          }

          // Draw cells
          let currentX = 30;
          cellLines.forEach((lines, colIndex) => {
            const colWidth = colWidths[colIndex];
            const align = columns[colIndex].align || 'right';
            
            doc.fillColor(isHeader ? '#ffffff' : '#1f2937');
            doc.font(isHeader || isTotal ? 'Arabic-Bold' : 'Arabic-Regular').fontSize(8.5);

            lines.forEach((line, lineIndex) => {
              const textY = y + 4 + lineIndex * 11;
              doc.text(line, currentX + 5, textY, {
                width: colWidth - 10,
                align: align
              });
            });

            // Draw vertical column borders
            doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(currentX, y).lineTo(currentX, y + maxCellHeight).stroke();

            currentX += colWidth;
          });

          // Draw final vertical border on the right
          doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(30 + usableWidth, y).lineTo(30 + usableWidth, y + maxCellHeight).stroke();

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

        // Draw Total Row if totals present
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

        const processedItems = items.map(item => {
          const shapedLabel = shapeText(item.label);
          const processedLabel = processLine(shapedLabel);
          const shapedVal = shapeText(item.val);
          const processedVal = processLine(shapedVal);

          const wrappedLabel = wrapText(doc, shapedLabel, colWidth - 10).map(processLine);
          const wrappedVal = wrapText(doc, shapedVal, colWidth - 10).map(processLine);

          const height = (wrappedLabel.length + wrappedVal.length) * 11 + 10;
          if (height > maxValHeight) maxValHeight = height;

          return { wrappedLabel, wrappedVal };
        });

        // Break page if necessary
        if (currentY + maxValHeight > doc.page.height - 50) {
          doc.addPage();
          currentY = 40;
        }

        // Draw box background
        doc.fillColor('#f9fafb').rect(30, currentY, usableWidth, maxValHeight).fill();
        doc.strokeColor('#e5e7eb').lineWidth(0.5).rect(30, currentY, usableWidth, maxValHeight).stroke();

        let currentX = 30;
        processedItems.forEach((item, index) => {
          doc.fillColor('#4b5563').font('Arabic-Regular').fontSize(8.5);
          item.wrappedLabel.forEach((line, lineIndex) => {
            doc.text(line, currentX + 5, currentY + 5 + lineIndex * 11, { width: colWidth - 10, align: 'right' });
          });

          doc.fillColor('#1f2937').font('Arabic-Bold').fontSize(9.0);
          const labelOffset = item.wrappedLabel.length * 11;
          item.wrappedVal.forEach((line, lineIndex) => {
            doc.text(line, currentX + 5, currentY + 5 + labelOffset + lineIndex * 11, { width: colWidth - 10, align: 'right' });
          });

          if (index < items.length - 1) {
            doc.strokeColor('#e5e7eb').lineWidth(0.5)
               .moveTo(currentX + colWidth, currentY)
               .lineTo(currentX + colWidth, currentY + maxValHeight)
               .stroke();
          }

          currentX += colWidth;
        });

        currentY += maxValHeight + 15;
      };

      // Helper to draw signatures
      const drawSignatures = (leftTitle: string, rightTitle: string) => {
        if (currentY + 55 > doc.page.height - 50) {
          doc.addPage();
          currentY = 40;
        }
        const boxWidth = 140;

        const leftX = 30 + (usableWidth / 4) - (boxWidth / 2);
        doc.strokeColor('#9ca3af').lineWidth(0.5)
           .moveTo(leftX, currentY + 30)
           .lineTo(leftX + boxWidth, currentY + 30)
           .stroke();
        doc.fillColor('#4b5563').font('Arabic-Bold').fontSize(8.5);
        doc.text(processLine(shapeText(leftTitle)), leftX, currentY + 36, { width: boxWidth, align: 'center' });

        const rightX = 30 + (3 * usableWidth / 4) - (boxWidth / 2);
        doc.strokeColor('#9ca3af').lineWidth(0.5)
           .moveTo(rightX, currentY + 30)
           .lineTo(rightX + boxWidth, currentY + 30)
           .stroke();
        doc.text(processLine(shapeText(rightTitle)), rightX, currentY + 36, { width: boxWidth, align: 'center' });

        currentY += 55;
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

          // Table Columns
          const columns: ColumnDef[] = [
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
          const summaryWidth = 200;
          const summaryHeight = 65 + (Number(dto.discount_amount) > 0 ? 12 : 0);
          
          if (currentY + summaryHeight > doc.page.height - 50) {
            doc.addPage();
            currentY = 40;
          }

          const summaryX = doc.page.width - 30 - summaryWidth;
          doc.fillColor('#f9fafb').rect(summaryX, currentY + 10, summaryWidth, summaryHeight).fill();
          doc.strokeColor('#10b981').lineWidth(1.5).rect(summaryX, currentY + 10, summaryWidth, summaryHeight).stroke();

          let summaryY = currentY + 15;
          const drawSummaryRow = (label: string, val: string, isBold = false) => {
            doc.fillColor(isBold ? '#064e3b' : '#4b5563');
            doc.font(isBold ? 'Arabic-Bold' : 'Arabic-Regular').fontSize(isBold ? 9.5 : 8.5);
            doc.text(processLine(shapeText(label)), summaryX + 5, summaryY, { width: 100, align: 'right' });
            doc.text(processLine(shapeText(val)), summaryX + 105, summaryY, { width: 90, align: 'left' });
            summaryY += 12;
          };

          drawSummaryRow('الإجمالي الفرعي:', dto.subtotal || '0.00');
          if (Number(dto.discount_amount) > 0) {
            drawSummaryRow('الخصم:', dto.discount_amount);
          }
          drawSummaryRow('الضريبة (15%):', dto.vat_amount || '0.00');
          summaryY += 2;
          doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(summaryX + 5, summaryY).lineTo(summaryX + summaryWidth - 5, summaryY).stroke();
          summaryY += 4;
          drawSummaryRow('الصافي النهائي:', dto.net_total || '0.00', true);

          currentY += summaryHeight + 25;

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

          const columns: ColumnDef[] = [
            { id: 'date', label: 'التاريخ', width: 15, align: 'right' },
            { id: 'reference', label: 'المرجع', width: 15, align: 'right' },
            { id: 'description', label: 'البيان', width: 38, align: 'right' },
            { id: 'debit', label: 'مدين', width: 11, align: 'right' },
            { id: 'credit', label: 'دائن', width: 11, align: 'right' },
            { id: 'balance', label: 'الرصيد', width: 10, align: 'right' }
          ];
          
          const totals = {
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

          const columns: ColumnDef[] = [
            { id: 'date', label: 'التاريخ', width: 12, align: 'right' },
            { id: 'entry_num', label: 'رقم القيد', width: 12, align: 'right' },
            { id: 'account_code', label: 'كود الحساب', width: 14, align: 'right' },
            { id: 'account_name', label: 'اسم الحساب', width: 22, align: 'right' },
            { id: 'description', label: 'البيان', width: 22, align: 'right' },
            { id: 'debit', label: 'مدين', width: 9, align: 'right' },
            { id: 'credit', label: 'دائن', width: 9, align: 'right' }
          ];

          const totals = {
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
            const descLabelShaped = shapeText("البيان / الشرح:");
            const descShaped = shapeText(dto.description);
            const wrappedDesc = wrapText(doc, descShaped, usableWidth - 20).map(processLine);
            const boxHeight = 12 + wrappedDesc.length * 11 + 10;

            if (currentY + boxHeight > doc.page.height - 50) {
              doc.addPage();
              currentY = 40;
            }

            doc.fillColor('#f9fafb').rect(30, currentY, usableWidth, boxHeight).fill();
            doc.strokeColor('#e5e7eb').lineWidth(0.5).rect(30, currentY, usableWidth, boxHeight).stroke();

            doc.fillColor('#4b5563').font('Arabic-Regular').fontSize(8.5);
            doc.text(processLine(descLabelShaped), 40, currentY + 5, { width: usableWidth - 20, align: 'right' });

            doc.fillColor('#1f2937').font('Arabic-Bold').fontSize(9.5);
            wrappedDesc.forEach((line, lineIndex) => {
              doc.text(line, 40, currentY + 16 + lineIndex * 11, { width: usableWidth - 20, align: 'right' });
            });

            currentY += boxHeight + 15;
          }

          if (dto.items && dto.items.length > 0) {
            const columns: ColumnDef[] = [
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

          currentY += 10;
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

      // Add page numbers and footer on all pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        doc.strokeColor('#e5e7eb').lineWidth(0.5)
           .moveTo(30, doc.page.height - 40)
           .lineTo(doc.page.width - 30, doc.page.height - 40)
           .stroke();

        doc.fillColor('#9ca3af').font('Arabic-Regular').fontSize(8);
        
        const footerL = processLine(shapeText("نظام ERP السحابي"));
        doc.text(footerL, 30, doc.page.height - 32, { align: 'left' });

        const pageStr = `صفحة ${i + 1} من ${range.count}`;
        const footerR = processLine(shapeText(pageStr));
        doc.text(footerR, doc.page.width - 150, doc.page.height - 32, {
          width: 120,
          align: 'right'
        });
      }

      doc.end();
    } catch (e: any) {
      console.error(`${STEP} Re-throwing layout error:`, e.stack);
      reject(e);
    }
  });
}
