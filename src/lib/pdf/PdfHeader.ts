import { PdfTheme } from './PdfTheme';
import { drawTextLine } from './PdfText';

function drawBase64Image(doc: any, base64Uri: any, x: number, y: number, width: number, height: number): boolean {
  if (!base64Uri || typeof base64Uri !== 'string' || !base64Uri.startsWith('data:image/')) return false;
  try {
    const commaIndex = base64Uri.indexOf(',');
    if (commaIndex === -1) return false;
    const base64Data = base64Uri.substring(commaIndex + 1);
    const imgBuffer = Buffer.from(base64Data, 'base64');
    doc.image(imgBuffer, x, y, { fit: [width, height], align: 'right', valign: 'center' });
    return true;
  } catch (e: any) {
    console.warn('[PDF-HEADER] Failed to draw base64 logo:', e.message);
    return false;
  }
}

export function drawHeader(doc: any, company: any, title: string, branchName = '', userName = '', dateStr = '') {
  const margin = PdfTheme.dimensions.margin;
  const pageWidth = PdfTheme.dimensions.pageWidth;
  const topY = 40;

  // 1. Company Logo (Right-aligned)
  let logoWidth = 60;
  let logoHeight = 60;
  let logoDrawn = false;

  const logoX = pageWidth - margin - logoWidth;
  if (company && company.logoUrl) {
    logoDrawn = drawBase64Image(doc, company.logoUrl, logoX, topY, logoWidth, logoHeight);
  }

  // 2. Company Details (Right side, under logo or next to it)
  const infoX = margin;
  const infoWidth = pageWidth - 2 * margin;
  let currentY = topY;

  if (logoDrawn) {
    currentY += logoHeight + 10;
  }

  // Draw Company Name & Details
  if (company && company.name) {
    drawTextLine(doc, company.name, infoX, currentY, {
      font: PdfTheme.fonts.bold,
      fontSize: 12,
      color: PdfTheme.colors.primaryDark,
      width: infoWidth,
      align: 'right'
    });
    currentY += 15;
  }

  if (company && company.taxNumber) {
    drawTextLine(doc, `الرقم الضريبي: ${company.taxNumber}`, infoX, currentY, {
      font: PdfTheme.fonts.regular,
      fontSize: 8,
      color: PdfTheme.colors.textLight,
      width: infoWidth,
      align: 'right'
    });
    currentY += 11;
  }

  if (company && company.phone) {
    drawTextLine(doc, `الهاتف: ${company.phone}`, infoX, currentY, {
      font: PdfTheme.fonts.regular,
      fontSize: 8,
      color: PdfTheme.colors.textLight,
      width: infoWidth,
      align: 'right'
    });
    currentY += 11;
  }

  // 3. Report Title (Centered)
  const titleY = topY + 15;
  drawTextLine(doc, title, margin, titleY, {
    font: PdfTheme.fonts.bold,
    fontSize: 16,
    color: PdfTheme.colors.primary,
    width: pageWidth - 2 * margin,
    align: 'center'
  });

  if (branchName) {
    drawTextLine(doc, `الفرع: ${branchName}`, margin, titleY + 22, {
      font: PdfTheme.fonts.regular,
      fontSize: 9,
      color: PdfTheme.colors.textLight,
      width: pageWidth - 2 * margin,
      align: 'center'
    });
  }

  // 4. Document Metadata (Left side)
  const metaY = topY;
  const metaX = margin;
  const metaWidth = 150;

  const displayUser = userName || 'المشرف';
  const displayDate = dateStr || new Date().toLocaleDateString('ar-SA');

  drawTextLine(doc, `المستخدم: ${displayUser}`, metaX, metaY, {
    font: PdfTheme.fonts.regular,
    fontSize: 8,
    color: PdfTheme.colors.textLight,
    width: metaWidth,
    align: 'left'
  });

  drawTextLine(doc, `التاريخ: ${displayDate}`, metaX, metaY + 11, {
    font: PdfTheme.fonts.regular,
    fontSize: 8,
    color: PdfTheme.colors.textLight,
    width: metaWidth,
    align: 'left'
  });

  // 5. Header separator line
  const lineY = Math.max(currentY + 10, topY + 75);
  doc.strokeColor(PdfTheme.colors.primary)
     .lineWidth(1.5)
     .moveTo(margin, lineY)
     .lineTo(pageWidth - margin, lineY)
     .stroke();

  return lineY + 15; // Return ending Y position for next layout element
}
