import { PdfTheme } from './PdfTheme';
import { drawTextLine, wrapRtlText } from './PdfText';

interface TableColumn {
  id: string;
  field?: string;
  label: string;
  width: number; // weight or percentage
  align?: 'right' | 'center' | 'left';
}

function drawTableHeader(doc: any, columns: TableColumn[], widths: number[], y: number): number {
  const margin = PdfTheme.dimensions.margin;
  const headerHeight = 20;
  const cellPadding = 4;

  // Draw header container background
  doc.rect(margin, y, widths.reduce((s, w) => s + w, 0), headerHeight)
     .fill(PdfTheme.colors.primary);

  let currentX = margin;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const colWidth = widths[i];

    drawTextLine(doc, col.label, currentX + cellPadding, y + 5, {
      font: PdfTheme.fonts.bold,
      fontSize: 8,
      color: PdfTheme.colors.white,
      width: colWidth - 2 * cellPadding,
      align: col.align || 'right'
    });

    currentX += colWidth;
  }

  return headerHeight;
}

function drawTableRow(
  doc: any,
  columns: TableColumn[],
  row: any,
  widths: number[],
  y: number,
  height: number,
  isEven: boolean,
  isTotalRow: boolean
) {
  const margin = PdfTheme.dimensions.margin;
  const cellPadding = 4;

  // Alternating background
  if (isTotalRow) {
    doc.rect(margin, y, widths.reduce((s, w) => s + w, 0), height)
       .fill(PdfTheme.colors.bgLight);
  } else if (isEven) {
    doc.rect(margin, y, widths.reduce((s, w) => s + w, 0), height)
       .fill(PdfTheme.colors.bgLight);
  }

  let currentX = margin;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const colWidth = widths[i];
    const val = row[col.id] !== undefined ? row[col.id] : (col.field ? row[col.field] : '');
    const cellValue = String(val !== null && val !== undefined ? val : '');

    // Draw cell border
    doc.strokeColor(PdfTheme.colors.border)
       .lineWidth(isTotalRow ? 1.0 : 0.5)
       .rect(currentX, y, colWidth, height)
       .stroke();

    const wrapped = wrapRtlText(doc, cellValue, colWidth - 2 * cellPadding);
    const lineHeight = 11;
    const textHeight = wrapped.length * lineHeight;
    const textY = y + (height - textHeight) / 2; // Center vertically

    wrapped.forEach((line, lineIndex) => {
      drawTextLine(doc, line, currentX + cellPadding, textY + lineIndex * lineHeight, {
        font: isTotalRow ? PdfTheme.fonts.bold : PdfTheme.fonts.regular,
        fontSize: isTotalRow ? 8 : 7.5,
        color: isTotalRow ? PdfTheme.colors.primaryDark : PdfTheme.colors.text,
        width: colWidth - 2 * cellPadding,
        align: col.align || 'right'
      });
    });

    currentX += colWidth;
  }
}

export function drawTable(
  doc: any,
  columns: TableColumn[],
  rows: any[],
  startY: number,
  onNewPageHeader: (doc: any) => number
): number {
  const margin = PdfTheme.dimensions.margin;
  const pageWidth = PdfTheme.dimensions.pageWidth;
  const pageHeight = PdfTheme.dimensions.pageHeight;
  const pageLimit = pageHeight - margin - 35; // margin + footer Y space
  const cellPadding = 4;
  const cellLineHeight = 11;

  // Calculate absolute widths based on column weights
  const totalWeight = columns.reduce((sum, col) => sum + col.width, 0);
  const printableWidth = pageWidth - 2 * margin;
  const widths = columns.map(col => (col.width / totalWeight) * printableWidth);

  let currentY = startY;

  // Draw initial headers
  let headerHeight = drawTableHeader(doc, columns, widths, currentY);
  currentY += headerHeight;

  rows.forEach((row, index) => {
    // Determine if it is a summary/total row
    const isTotalRow =
      row.isTotalRow === true ||
      row.id === 'total' ||
      columns.some(col => {
        const val = String(row[col.id] || '');
        return val.includes('الإجمالي') || val.includes('الصافي');
      });

    // Calculate height needed for this row
    let maxLines = 1;
    columns.forEach((col, colIdx) => {
      const val = row[col.id] !== undefined ? row[col.id] : (col.field ? row[col.field] : '');
      const cellValue = String(val !== null && val !== undefined ? val : '');
      const wrapped = wrapRtlText(doc, cellValue, widths[colIdx] - 2 * cellPadding);
      if (wrapped.length > maxLines) {
        maxLines = wrapped.length;
      }
    });

    const rowHeight = maxLines * cellLineHeight + 8; // line height + padding

    // Handle Page Break
    if (currentY + rowHeight > pageLimit) {
      doc.addPage();
      currentY = onNewPageHeader(doc); // execute new page header callbacks and get fresh Y start
      headerHeight = drawTableHeader(doc, columns, widths, currentY);
      currentY += headerHeight;
    }

    // Draw the row
    drawTableRow(doc, columns, row, widths, currentY, rowHeight, index % 2 === 0, isTotalRow);
    currentY += rowHeight;
  });

  return currentY;
}
