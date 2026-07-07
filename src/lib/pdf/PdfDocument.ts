import PDFDocument from 'pdfkit';
import { registerFonts } from './PdfFonts';
import { drawAllFooters } from './PdfFooter';

export function createPdfDocument(): any {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    bufferPages: true // critical for page numbering in the footer at finalization time
  });

  // Register TrueType Noto Sans Arabic fonts
  registerFonts(doc);

  return doc;
}

export async function finalizePdfDocument(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Draw page numbers and brand marks on all buffered pages
      drawAllFooters(doc);

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: any) => reject(err));

      // End PDFKit layout stream (compiles output)
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
