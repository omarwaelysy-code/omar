import { createPdfDocument, finalizePdfDocument } from './PdfDocument';
import { renderTemplate } from './PdfRenderer';

export async function generatePDF(templateName: string, dto: any): Promise<Buffer> {
  const STEP = '[PDF-KIT-GENERATOR]';
  console.log(`${STEP} ▶ ENTER generatePDF | templateName: ${templateName}`);

  // Create document instancing Noto Sans Arabic fonts & A4 setup
  const doc = createPdfDocument();

  // Render specific template layouts
  renderTemplate(doc, templateName, dto);

  // Draw dynamic footers, complete buffer streaming & release memory
  const pdfBuffer = await finalizePdfDocument(doc);
  console.log(`${STEP} ✓ PDF compiled successfully | size: ${pdfBuffer.length} bytes`);

  return pdfBuffer;
}
