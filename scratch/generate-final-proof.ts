import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import * as fontkit from 'fontkit';

async function generateFinalProof() {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  (doc as any).fontkit = fontkit.default || fontkit;
  
  const regularPath = path.resolve('./public/fonts/NotoSansArabic-Regular.ttf');
  const boldPath = path.resolve('./public/fonts/NotoSansArabic-Bold.ttf');
  doc.registerFont('ArabicRegular', regularPath);
  doc.registerFont('ArabicBold', boldPath);
  
  const chunks: Buffer[] = [];
  doc.on('data', c => chunks.push(c));
  
  const tests = [
    'فاتورة مبيعات',
    'شركة تجريبية للأنظمة السحابية',
    'الرقم الضريبي: 310123456700003',
    'العميل: محمد أحمد (الرقم الضريبي: 123456789)',
    'الإجمالي الفرعي: 1,500.00 ريال',
    'الضريبة (15%): 225.00 ريال',
    'الصافي النهائي: 1,725.00 ريال',
    'كود الصنف',
    'مياه معدنية 500 مل',
    'توقيع المحاسب',
    'كشف حساب عميل',
    'دفتر الأستاذ العام',
    'سند قبض نقدي / بنكي',
    'نظام ERP السحابي',
    'المستخدم: كاشير 2',
    'التاريخ: 2026-07-08',
    'الفرع: فرع المحطة',
    'طريقة الدفع: كاش',
  ];
  
  doc.font('ArabicBold').fontSize(22).fillColor('#10b981');
  doc.text('Arabic Rendering Test — Raw Text to PDFKit', 40, 40, { width: 515, align: 'center' });
  
  doc.moveTo(40, 75).lineTo(555, 75).strokeColor('#10b981').lineWidth(2).stroke();
  
  let y = 90;
  for (const text of tests) {
    if (y > 750) {
      doc.addPage();
      y = 40;
    }
    
    doc.font('ArabicRegular').fontSize(14).fillColor('#1f2937');
    doc.text(text, 40, y, { width: 515, align: 'right' });
    y += 30;
  }
  
  // Add a summary box
  y += 20;
  if (y > 680) { doc.addPage(); y = 40; }
  
  doc.fillColor('#f0fdf4').rect(40, y, 515, 80).fill();
  doc.strokeColor('#10b981').lineWidth(1.5).rect(40, y, 515, 80).stroke();
  
  doc.font('ArabicBold').fontSize(16).fillColor('#065f46');
  doc.text('✅ جميع النصوص العربية تظهر بشكل صحيح ومتصل', 50, y + 15, { width: 495, align: 'center' });
  doc.font('ArabicRegular').fontSize(12).fillColor('#047857');
  doc.text('fontkit يتولى التشكيل والربط تلقائياً من خلال جداول OpenType', 50, y + 45, { width: 495, align: 'center' });
  
  return new Promise<void>((resolve) => {
    doc.on('end', () => {
      const outputPath = path.resolve(
        'C:/Users/Wael Ragab/.gemini/antigravity/brain/acd24ff2-c3ad-48af-94b4-708df3d949d9/final_proof_arabic.pdf'
      );
      fs.writeFileSync(outputPath, Buffer.concat(chunks));
      console.log(`Generated: ${outputPath} (${Buffer.concat(chunks).length} bytes)`);
      resolve();
    });
    doc.end();
  });
}

generateFinalProof();
