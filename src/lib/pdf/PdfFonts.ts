import path from 'path';
import fs from 'fs';
import { PdfTheme } from './PdfTheme';

export function registerFonts(doc: any) {
  const regularPath = path.resolve('./public/fonts/NotoSansArabic-Regular.ttf');
  const boldPath = path.resolve('./public/fonts/NotoSansArabic-Bold.ttf');

  if (fs.existsSync(regularPath)) {
    doc.registerFont(PdfTheme.fonts.regular, regularPath);
  } else {
    console.warn(`Font not found at ${regularPath}, using Helvetica fallback`);
    doc.registerFont(PdfTheme.fonts.regular, 'Helvetica');
  }

  if (fs.existsSync(boldPath)) {
    doc.registerFont(PdfTheme.fonts.bold, boldPath);
  } else {
    console.warn(`Font not found at ${boldPath}, using Helvetica-Bold fallback`);
    doc.registerFont(PdfTheme.fonts.bold, 'Helvetica-Bold');
  }
}
