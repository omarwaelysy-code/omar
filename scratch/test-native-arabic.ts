import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import * as fontkit from 'fontkit';

async function testNativeArabic() {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream('test-native-arabic.pdf'));

  (doc as any).fontkit = fontkit.default || fontkit;

  const fontPath = path.resolve('./public/fonts/NotoSansArabic-Regular.ttf');
  doc.registerFont('Arabic', fontPath);

  doc.font('Arabic').fontSize(20);
  
  // Draw standard Arabic directly
  doc.text('فاتورة مبيعات ضريبية', 100, 100);
  
  // Draw with parentheses
  doc.text('الضريبة (15%): 150 ريال', 100, 150);

  doc.end();
  console.log('Generated test-native-arabic.pdf');
}

testNativeArabic();
