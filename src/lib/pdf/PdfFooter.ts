import { PdfTheme } from './PdfTheme';
import { drawTextLine } from './PdfText';

export function drawAllFooters(doc: any) {
  const range = doc.bufferedPageRange();
  const margin = PdfTheme.dimensions.margin;
  const pageWidth = PdfTheme.dimensions.pageWidth;
  const pageHeight = PdfTheme.dimensions.pageHeight;
  const footerY = pageHeight - 30;

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    // Draw separator line
    doc.strokeColor(PdfTheme.colors.border)
       .lineWidth(0.5)
       .moveTo(margin, footerY - 5)
       .lineTo(pageWidth - margin, footerY - 5)
       .stroke();

    // Brand mark (Right-aligned)
    drawTextLine(doc, 'نظام ERP السحابي', margin, footerY, {
      font: PdfTheme.fonts.regular,
      fontSize: 7.5,
      color: PdfTheme.colors.textMuted,
      width: pageWidth - 2 * margin,
      align: 'right'
    });

    // Dynamic page numbering (Left-aligned)
    const pageNumText = `صفحة ${i + 1} من ${range.count}`;
    drawTextLine(doc, pageNumText, margin, footerY, {
      font: PdfTheme.fonts.regular,
      fontSize: 7.5,
      color: PdfTheme.colors.textMuted,
      width: pageWidth - 2 * margin,
      align: 'left'
    });
  }
}
