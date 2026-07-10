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
  return String(text);
}

export interface TextSegment {
  text: string;
  isArabic: boolean;
}

export function segmentText(text: string): TextSegment[] {
  if (!text) return [];
  const segments: TextSegment[] = [];
  let currentSegment = '';
  let currentIsArabic = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.codePointAt(0) || 0;
    
    // Arabic unicode ranges:
    const isArabicChar = (code >= 0x0600 && code <= 0x06FF) ||
                         (code >= 0x0750 && code <= 0x077F) ||
                         (code >= 0x08A0 && code <= 0x08FF) ||
                         (code >= 0xFB50 && code <= 0xFDFF) ||
                         (code >= 0xFE70 && code <= 0xFEFF);

    const isSpaceChar = char === ' ';

    if (currentSegment === '') {
      currentSegment = char;
      currentIsArabic = isArabicChar;
    } else {
      const isPrevSpace = currentSegment === ' ';
      const isCurrSpace = isSpaceChar;
      const isArabicTransition = isArabicChar !== currentIsArabic;

      if (isPrevSpace || isCurrSpace || isArabicTransition) {
        segments.push({ text: currentSegment, isArabic: currentIsArabic });
        currentSegment = char;
        currentIsArabic = isArabicChar;
      } else {
        currentSegment += char;
      }
    }
  }
  if (currentSegment !== '') {
    segments.push({ text: currentSegment, isArabic: currentIsArabic });
  }
  return segments;
}

export function measureTextWidth(doc: any, text: string, fontName: string, fontSize: number): number {
  const isBold = fontName.includes('Bold');
  const segments = segmentText(text);
  let totalWidth = 0;
  segments.forEach(seg => {
    // Only use Helvetica if the segment contains English alphabetical characters, symbols (+, /) or parentheses to prevent tofu
    const useHelvetica = /[a-zA-Z]|\+|\/|\(|\)/.test(seg.text);
    const segFont = !useHelvetica 
      ? (isBold ? 'ArabicBold' : 'ArabicRegular')
      : (isBold ? 'Helvetica-Bold' : 'Helvetica');
    doc.font(segFont).fontSize(fontSize);
    totalWidth += doc.widthOfString(seg.text);
  });
  return totalWidth;
}

export function wrapText(doc: any, rawText: string, maxWidth: number, fontName: string, fontSize: number): string[] {
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
      
      const testLineWidth = measureTextWidth(doc, testLine, fontName, fontSize);

      if (testLineWidth > maxWidth) {
        if (currentLine && currentLine.trim() !== '') {
          lines.push(currentLine);
          currentLine = word.trim() === '' ? '' : word;
        } else {
          // Force break single word
          let testWord = '';
          for (const char of word) {
            if (measureTextWidth(doc, testWord + char, fontName, fontSize) > maxWidth) {
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
  let pageWidth = isThermal ? (is58 ? 164.41 : 226.77) : 595.28;
  let pageHeight = 841.89; // A4 height

  if (!isThermal && dto.orientation === 'landscape') {
    pageWidth = 841.89;
    pageHeight = 595.28;
  }
  
  // Estimate height dynamically for thermal receipts to avoid empty trailing space
  if (isThermal) {
    const itemCount = (dto.items || []).length;
    const rowsCount = (dto.rows || []).length;
    const itemsLen = Math.max(itemCount, rowsCount);
    const metaCount = 4;
    pageHeight = 120 + (itemsLen * 24) + (metaCount * 11) + (dto.description ? 45 : 0) + (qrBuffer ? 60 : 0) + 120;
    if (pageHeight < 280) pageHeight = 280;
  }

  // Resolve RTL flag
  const isRtl = dto.isRtl !== false;

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
      doc.registerFont('ArabicRegular', regularPath);
      doc.registerFont('ArabicBold', boldPath);

      // Set default font
      doc.font('ArabicRegular').fontSize(isThermal ? 7.5 : 10);

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
          lineBreak?: boolean;
        } = {}
      ) => {
        const fontName = options.font || 'ArabicRegular';
        const fontSize = options.size || (isThermal ? 7.5 : 10);
        const isBold = fontName.includes('Bold');
        
        // Shape and reorder text using our segment reorderer
        const processed = renderArabic(text);
        const segments = segmentText(processed);
        
        // Measure total width
        let totalWidth = 0;
        segments.forEach(seg => {
          const segFont = seg.isArabic 
            ? (isBold ? 'ArabicBold' : 'ArabicRegular')
            : (isBold ? 'Helvetica-Bold' : 'Helvetica');
          doc.font(segFont).fontSize(fontSize);
          totalWidth += doc.widthOfString(seg.text);
        });

        // Determine absolute X starting point
        let startX = x;
        const maxWidth = options.width;
        const align = options.align || (isRtl ? 'right' : 'left');
        if (maxWidth !== undefined && maxWidth > 0) {
          if (align === 'right') {
            startX = x + maxWidth - totalWidth;
          } else if (align === 'center') {
            startX = x + (maxWidth - totalWidth) / 2;
          }
        }

        // Render segments
        if (isRtl) {
          // Draw segments from right to left (first segment is on the far right)
          let currentSegmentX = startX + totalWidth;
          segments.forEach(seg => {
            const useHelvetica = /[a-zA-Z]|\+|\/|\(|\)/.test(seg.text);
            const segFont = !useHelvetica 
              ? (isBold ? 'ArabicBold' : 'ArabicRegular')
              : (isBold ? 'Helvetica-Bold' : 'Helvetica');
            doc.font(segFont).fontSize(fontSize);
            
            const segWidth = doc.widthOfString(seg.text);
            currentSegmentX -= segWidth;
            // Adjust NotoSans Arabic baseline to align with Helvetica
            const adjustedY = !useHelvetica ? (y - fontSize * 0.45) : y;
            doc.text(seg.text, currentSegmentX, adjustedY, { lineBreak: false });
          });
        } else {
          // Draw segments from left to right (first segment is on the far left)
          let currentSegmentX = startX;
          segments.forEach(seg => {
            const useHelvetica = /[a-zA-Z]|\+|\/|\(|\)/.test(seg.text);
            const segFont = !useHelvetica 
              ? (isBold ? 'ArabicBold' : 'ArabicRegular')
              : (isBold ? 'Helvetica-Bold' : 'Helvetica');
            doc.font(segFont).fontSize(fontSize);
            
            // Adjust NotoSans Arabic baseline to align with Helvetica
            const adjustedY = !useHelvetica ? (y - fontSize * 0.45) : y;
            doc.text(seg.text, currentSegmentX, adjustedY, { lineBreak: false });
            currentSegmentX += doc.widthOfString(seg.text);
          });
        }
      };

      // Draw Header Helper
      const drawHeader = (title: string, branchName = '', userName = '', dateStr = '') => {
        const logoSize = isThermal ? 32 : 50;
        
        const titleLower = title.toLowerCase();
        const isStatement = title.includes('كشف حساب') || 
                            title.includes('كشف حركة') || 
                            title.includes('تقرير') || 
                            title.includes('قائمة') || 
                            title.includes('الميزانية') ||
                            titleLower.includes('statement') || 
                            titleLower.includes('report') || 
                            titleLower.includes('balances') || 
                            titleLower.includes('balance') || 
                            titleLower.includes('income') || 
                            templateName.toLowerCase().includes('statement') || 
                            dto.isStatement;

        if (isStatement) {
          // Clean Statement Header Layout (No logo/company info/user/branch, centered title, print date/time on top left)
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const printDateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
          const dateLabel = printDateTime; // Remove "تاريخ الطباعة:" label as requested
          
          if (isThermal) {
            renderText(title, sideMargin, currentY, { width: usableWidth, align: 'center', font: 'ArabicBold', size: 9.5 });
            currentY += 12;
            renderText(dateLabel, sideMargin, currentY, { width: usableWidth, align: 'center', size: 7.5 });
            currentY += 12;
          } else {
            // Centered Title
            renderText(title, sideMargin, currentY + 12, { width: usableWidth, align: 'center', font: 'ArabicBold', size: 16 });
            
            // Print date/time on top left
            renderText(dateLabel, sideMargin, currentY + 12, { width: 250, align: 'left', size: 8.5 });
            
            currentY += 45; // Advance past title & metadata
          }
        } else {
          // Standard Invoice / Report Header Layout
          // 1. Logo
          if (logoBuffer) {
            try {
              const logoX = isRtl ? (doc.page.width - sideMargin - logoSize) : sideMargin;
              doc.image(logoBuffer, logoX, currentY, { width: logoSize, height: logoSize });
            } catch (e: any) {
              console.error(`${STEP} Logo render error:`, e.message);
            }
          }

          // 2. Company Info
          if (isThermal) {
            renderText(company.name || '', sideMargin, currentY, { width: usableWidth, align: 'center', font: 'ArabicBold', size: 9.5 });
            currentY += 12;
            if (company.taxNumber) {
              renderText(`الرقم الضريبي: ${company.taxNumber}`, sideMargin, currentY, { width: usableWidth, align: 'center', size: 7.5 });
              currentY += 10;
            }
            if (company.phone) {
              renderText(`الهاتف: ${company.phone}`, sideMargin, currentY, { width: usableWidth, align: 'center', size: 7.5 });
              currentY += 10;
            }
          } else {
            const companyX = isRtl 
              ? (doc.page.width - sideMargin - (logoBuffer ? logoSize + 15 : 0) - 250)
              : (sideMargin + (logoBuffer ? logoSize + 15 : 0));
            const companyAlign = isRtl ? 'right' : 'left';
            
            renderText(company.name || '', companyX, currentY + 5, { width: 250, align: companyAlign, font: 'ArabicBold', size: 12 });
            
            if (company.taxNumber) {
              renderText(`الرقم الضريبي: ${company.taxNumber}`, companyX, currentY + 20, { width: 250, align: companyAlign, size: 8.5 });
            }
            if (company.phone) {
              renderText(`الهاتف: ${company.phone}`, companyX, currentY + 32, { width: 250, align: companyAlign, size: 8.5 });
            }
          }

          // 3. Document Title
          if (isThermal) {
            currentY += 2;
            renderText(title, sideMargin, currentY, { width: usableWidth, align: 'center', font: 'ArabicBold', size: 9 });
            currentY += 12;
            if (branchName) {
              renderText(`الفرع: ${branchName}`, sideMargin, currentY, { width: usableWidth, align: 'center', size: 7.5 });
              currentY += 10;
            }
          } else {
            renderText(title, sideMargin, currentY + 12, { width: usableWidth, align: 'center', font: 'ArabicBold', size: 16 });
            if (branchName) {
              renderText(`الفرع: ${branchName}`, sideMargin, currentY + 32, { width: usableWidth, align: 'center', size: 9 });
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
            const metaX = isRtl ? sideMargin : (doc.page.width - sideMargin - 250);
            const metaAlign = isRtl ? 'left' : 'right';
            renderText(`المستخدم: ${userName || 'المشرف'}`, metaX, currentY + 5, { width: 250, align: metaAlign, size: 8.5 });
            renderText(`التاريخ: ${dateValue}`, metaX, currentY + 17, { width: 250, align: metaAlign, size: 8.5 });
          }

          if (!isThermal) {
            currentY += 50; // Advance currentY past header texts to prevent overlapping
          }
        }

        // Divider Line
        doc.strokeColor('#10b981')
           .lineWidth(isThermal ? 1 : 2)
           .moveTo(sideMargin, currentY)
           .lineTo(doc.page.width - sideMargin, currentY)
           .stroke();

        currentY += isThermal ? 8 : 15;
      };

      // Helper to draw the table
      const drawTable = (
        columns: ColumnDef[],
        rows: any[],
        totals: any
      ) => {
        // Find the description/name column to allocate remaining/surplus width to it
        const descCol = columns.find(col => {
          const label = (col.label || '').toLowerCase();
          return col.id === 'col_4' || col.id === 'description' || 
                 label.includes('البيان') || label.includes('description') || label.includes('desc');
        });

        let colWidths: number[] = [];
        if (descCol) {
          // Total target weight based on default layout configuration
          const baseTotalWeight = columns.reduce((sum, col) => sum + (col.width || 0), 0);
          let allocatedWidth = 0;
          
          columns.forEach((col, idx) => {
            if (col.id === descCol.id) {
              colWidths[idx] = 0; // Temp placeholder
            } else {
              const pct = (col.width || 1) / baseTotalWeight;
              colWidths[idx] = pct * usableWidth;
              allocatedWidth += colWidths[idx];
            }
          });
          
          const descIndex = columns.findIndex(col => col.id === descCol.id);
          colWidths[descIndex] = Math.max(50, usableWidth - allocatedWidth);
        } else {
          const totalWidthWeight = columns.reduce((sum, col) => sum + (col.width || 0), 0);
          colWidths = columns.map(col => {
            const pct = totalWidthWeight > 0 ? ((col.width || 0) / totalWidthWeight) : (1 / (columns.length || 1));
            return pct * usableWidth;
          });
        }

        const drawRow = (rowItems: string[], y: number, isHeader = false, isTotal = false) => {
          const rowHeight = isThermal ? 14 : 18;
          let maxCellHeight = rowHeight;
          
          const cellFont = isHeader || isTotal ? 'ArabicBold' : 'ArabicRegular';
          const cellSize = isThermal ? 7.5 : (columns.length > 12 ? 6.0 : (columns.length > 9 ? 7.0 : 8.5));

          const cellLines = rowItems.map((cellText, colIndex) => {
            const colWidth = colWidths[colIndex];
            const wrapWidth = Math.max(20, colWidth - (isThermal ? 4 : 10));
            
            // Wrap the raw text first based on correct font metrics
            const wrapped = wrapText(doc, cellText, wrapWidth, cellFont, cellSize);
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

          // Draw cells (supporting RTL and LTR layouts)
          if (isRtl) {
            let currentX = sideMargin + usableWidth;
            cellLines.forEach((lines, colIndex) => {
              const colWidth = colWidths[colIndex];
              currentX -= colWidth;
              const align = columns[colIndex].align || 'right';
              
              doc.fillColor(isHeader ? '#ffffff' : '#1f2937');

              lines.forEach((line, lineIndex) => {
                const textY = y + (isThermal ? 2.5 : 4) + lineIndex * (isThermal ? 9.5 : 11);
                renderText(line, currentX + (isThermal ? 2 : 5), textY, {
                  width: colWidth - (isThermal ? 4 : 10),
                  align: align,
                  font: cellFont,
                  size: cellSize,
                  lineBreak: false
                });
              });

              // Vertical borders (on the left boundary of current cell)
              doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(currentX, y).lineTo(currentX, y + maxCellHeight).stroke();
            });

            // Right boundary border of the table
            doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(sideMargin + usableWidth, y).lineTo(sideMargin + usableWidth, y + maxCellHeight).stroke();
          } else {
            let currentX = sideMargin;
            cellLines.forEach((lines, colIndex) => {
              const colWidth = colWidths[colIndex];
              const align = columns[colIndex].align || 'left';
              
              doc.fillColor(isHeader ? '#ffffff' : '#1f2937');

              lines.forEach((line, lineIndex) => {
                const textY = y + (isThermal ? 2.5 : 4) + lineIndex * (isThermal ? 9.5 : 11);
                renderText(line, currentX + (isThermal ? 2 : 5), textY, {
                  width: colWidth - (isThermal ? 4 : 10),
                  align: align,
                  font: cellFont,
                  size: cellSize,
                  lineBreak: false
                });
              });

              // Vertical borders
              doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(currentX, y).lineTo(currentX, y + maxCellHeight).stroke();

              currentX += colWidth;
            });

            // Rightmost border
            doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(sideMargin + usableWidth, y).lineTo(sideMargin + usableWidth, y + maxCellHeight).stroke();
          }

          return y + maxCellHeight;
        };

        // Draw Header
        currentY = drawRow(columns.map(c => c.label), currentY, true);

        // Draw Body Rows
        for (const row of rows) {
          const rowItems = columns.map(col => {
            let val = row[col.id];
            // Translate system default descriptions on English LTR reports
            const isDescCol = col.id === 'col_4' || col.id === 'description' || 
                              col.label.toLowerCase().includes('desc') || 
                              col.label.includes('البيان') || col.label.includes('بيان');
            if (!isRtl && isDescCol && val) {
              val = translateSystemDescription(String(val));
            }
            return val !== undefined ? String(val) : '';
          });
          currentY = drawRow(rowItems, currentY);
        }

        // Draw Totals
        if (totals && Object.keys(totals).length > 0) {
          // Check if any non-numeric column already has a custom label in totals payload
          const hasExistingLabel = columns.some((col) => {
            const isNumericCol = col.id.includes('debit') || col.id.includes('credit') || col.id.includes('balance') || 
                                 col.id === 'col_5' || col.id === 'col_6' || col.id === 'col_7';
            return !isNumericCol && totals[col.id] !== undefined && totals[col.id] !== '';
          });

          const totalItems = columns.map((col, index) => {
            if (totals[col.id] !== undefined) {
              let val = totals[col.id];
              // Translate totals labels in English reports
              if (!isRtl && (col.id === 'col_4' || col.id === 'description' || col.id === 'col_3') && val) {
                const strVal = String(val).trim();
                if (strVal === 'الرصيد الختامي' || strVal === 'ختامي رصيد' || strVal === 'الرصيد النهائي' || strVal === 'الرصيد المتبقي') val = 'Ending Balance';
                else if (strVal === 'الرصيد الافتتاحي' || strVal === 'الرصيد الأول') val = 'Opening Balance';
              }
              return String(val);
            } else if (index === 0 && !hasExistingLabel) {
              return isRtl ? 'الإجمالي' : 'Total';
            } else {
              return '';
            }
          });
          currentY = drawRow(totalItems, currentY, false, true);
        }
      };

      // Helper to draw Meta Grid (supporting RTL and LTR)
      const drawMetaGrid = (items: { label: string; val: string }[]) => {
        const colWidth = usableWidth / items.length;
        let maxValHeight = 12;

        const fontLabel = 'ArabicRegular';
        const fontVal = 'ArabicBold';
        const sizeLabel = isThermal ? 7.5 : 8.5;
        const sizeVal = isThermal ? 7.5 : 9.0;

        const processedItems = items.map(item => {
          // Wrap raw labels and values first
          const wrapWidth = Math.max(20, colWidth - (isThermal ? 4 : 10));
          const wrappedLabel = wrapText(doc, item.label, wrapWidth, fontLabel, sizeLabel);
          const wrappedVal = wrapText(doc, item.val, wrapWidth, fontVal, sizeVal);

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

        let currentX = isRtl ? (sideMargin + usableWidth) : sideMargin;
        processedItems.forEach((item, index) => {
          if (isRtl) currentX -= colWidth;

          const align = isRtl ? 'right' : 'left';

          doc.fillColor('#4b5563');
          item.wrappedLabel.forEach((line, lineIndex) => {
            renderText(line, currentX + (isThermal ? 2 : 5), currentY + (isThermal ? 3 : 5) + lineIndex * (isThermal ? 9.5 : 11), { 
              width: colWidth - (isThermal ? 4 : 10), 
              align: align,
              font: fontLabel,
              size: sizeLabel,
              lineBreak: false
            });
          });

          doc.fillColor('#1f2937');
          const labelOffset = item.wrappedLabel.length * (isThermal ? 9.5 : 11);
          item.wrappedVal.forEach((line, lineIndex) => {
            renderText(line, currentX + (isThermal ? 2 : 5), currentY + (isThermal ? 3 : 5) + labelOffset + lineIndex * (isThermal ? 9.5 : 11), { 
              width: colWidth - (isThermal ? 4 : 10), 
              align: align,
              font: fontVal,
              size: sizeVal,
              lineBreak: false
            });
          });

          if (index < items.length - 1) {
            const separatorX = isRtl ? currentX : (currentX + colWidth);
            doc.strokeColor('#e5e7eb').lineWidth(0.5)
               .moveTo(separatorX, currentY)
               .lineTo(separatorX, currentY + maxValHeight)
               .stroke();
          }

          if (!isRtl) currentX += colWidth;
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
        renderText(leftTitle, leftX, currentY + (isThermal ? 24 : 36), { width: boxWidth, align: 'center', font: 'ArabicBold', size: isThermal ? 7 : 8.5 });

        const rightX = sideMargin + (3 * usableWidth / 4) - (boxWidth / 2);
        doc.strokeColor('#9ca3af').lineWidth(0.5)
           .moveTo(rightX, currentY + (isThermal ? 20 : 30))
           .lineTo(rightX + boxWidth, currentY + (isThermal ? 20 : 30))
           .stroke();
        renderText(rightTitle, rightX, currentY + (isThermal ? 24 : 36), { width: boxWidth, align: 'center', font: 'ArabicBold', size: isThermal ? 7 : 8.5 });

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
            const fontName = isBold ? 'ArabicBold' : 'ArabicRegular';
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
            const fontLabel = 'ArabicRegular';
            const fontVal = 'ArabicBold';
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
                size: sizeVal,
                lineBreak: false
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

        const footerY = doc.page.height - (isThermal ? 12 : 32);
        
        // Website URL on the left
        renderText("www.obrain.tech", sideMargin, footerY, { align: 'left', font: 'ArabicRegular', size: isThermal ? 6.5 : 8 });

        if (!isThermal) {
          const pageStr = isRtl 
            ? `صفحة ${i + 1} من ${range.count}`
            : `Page ${i + 1} of ${range.count}`;
          
          renderText(pageStr, doc.page.width - sideMargin - 150, footerY, {
            width: 150,
            align: 'right',
            font: 'ArabicRegular',
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

function translateSystemDescription(text: string): string {
  if (!text) return '';
  let res = text.trim();
  
  // Exact translations
  if (res === 'فاتورة مبيعات' || res === 'مبيعات فاتورة') return 'Sales Invoice';
  if (res === 'مرتجع مبيعات' || res === 'مبيعات مرتجع') return 'Sales Return';
  if (res === 'سند قبض' || res === 'قبض سند') return 'Receipt Voucher';
  if (res === 'سند صرف' || res === 'صرف سند') return 'Payment Voucher';
  if (res === 'قيد يومية' || res === 'يومية قيد') return 'Journal Entry';
  if (res === 'رصيد منقول' || res === 'منقول رصيد') return 'Balance Forward';
  if (res === 'رصيد افتتاحي' || res === 'افتتاحي رصيد') return 'Opening Balance';
  if (res === 'رصيد أول' || res === 'أول رصيد' || res === 'رصيد أول الفترة') return 'Beginning Balance';
  if (res === 'فاتورة مشتريات' || res === 'مشتريات فاتورة') return 'Purchase Invoice';
  if (res === 'مرتجع مشتريات' || res === 'مشتريات مرتجع') return 'Purchase Return';

  // Pattern translations
  // 1. تحصيل فاتورة مبيعات رقم [X] - [Y]
  if (res.includes('تحصيل فاتورة مبيعات رقم') && res.includes('-')) {
    const match = res.match(/تحصيل فاتورة مبيعات رقم\s*([^\s-]+)\s*-\s*(.*)/);
    if (match) {
      return `Collection of Sales Invoice no. ${match[1]} - ${match[2]}`;
    }
  }
  
  // 1.1 تحصيل فاتورة مبيعات رقم [X]
  if (res.includes('تحصيل فاتورة مبيعات رقم')) {
    const match = res.match(/تحصيل فاتورة مبيعات رقم\s*(.*)/);
    if (match) {
      return `Collection of Sales Invoice no. ${match[1]}`;
    }
  }

  // 2. سداد فاتورة مشتريات رقم [X] - [Y]
  if (res.includes('سداد فاتورة مشتريات رقم') && res.includes('-')) {
    const match = res.match(/سداد فاتورة مشتريات رقم\s*([^\s-]+)\s*-\s*(.*)/);
    if (match) {
      return `Payment of Purchase Invoice no. ${match[1]} - ${match[2]}`;
    }
  }

  // 2.1 سداد فاتورة مشتريات رقم [X]
  if (res.includes('سداد فاتورة مشتريات رقم')) {
    const match = res.match(/سداد فاتورة مشتريات رقم\s*(.*)/);
    if (match) {
      return `Payment of Purchase Invoice no. ${match[1]}`;
    }
  }

  // 3. سند صرف رقم [X] من حساب: [Y]
  if (res.includes('سند صرف رقم') && res.includes('من حساب:')) {
    const match = res.match(/سند صرف رقم\s*([^\s:]+)\s*من حساب:\s*(.*)/);
    if (match) {
      return `Payment Voucher no. ${match[1]} from account: ${match[2]}`;
    }
  }

  // 4. سند قبض رقم [X] إلى حساب: [Y]
  if (res.includes('سند قبض رقم') && res.includes('إلى حساب:')) {
    const match = res.match(/سند قبض رقم\s*([^\s:]+)\s*إلى حساب:\s*(.*)/);
    if (match) {
      return `Receipt Voucher no. ${match[1]} to account: ${match[2]}`;
    }
  }

  // 5. تحصيل من العميل: [X]
  if (res.includes('تحصيل من العميل:')) {
    const match = res.match(/تحصيل من العميل:\s*(.*)/);
    if (match) {
      return `Collection from Customer: ${match[1]}`;
    }
  }

  // 6. تحويل من [X] إلى [Y]
  if (res.includes('تحويل من') && res.includes('إلى')) {
    const match = res.match(/تحويل من\s*(.*?)\s*إلى\s*(.*)/);
    if (match) {
      return `Transfer from ${match[1]} to ${match[2]}`;
    }
  }

  return res;
}
