import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import * as fontkit from 'fontkit';
// @ts-ignore
import reshaper from 'arabic-persian-reshaper';
import bidiFactory from 'bidi-js';

const bidi = bidiFactory();

function mirrorChar(char: string): string {
  switch (char) {
    case '(': return ')'; case ')': return '(';
    case '[': return ']'; case ']': return '[';
    case '{': return '}'; case '}': return '{';
    case '<': return '>'; case '>': return '<';
    default: return char;
  }
}

function processLine(shapedLine: string): string {
  if (!shapedLine) return '';
  const embeddingLevels = bidi.getEmbeddingLevels(shapedLine, 'rtl');
  const flips = bidi.getReorderSegments(shapedLine, embeddingLevels);
  let arr = shapedLine.split('');
  flips.forEach(([start, end]) => {
    const segment = arr.slice(start, end + 1).reverse().map(mirrorChar);
    for (let i = start; i <= end; i++) arr[i] = segment[i - start];
  });
  return arr.join('');
}

async function generateTestPDF(filename: string, mode: string) {
  const doc = new PDFDocument({ size: 'A4' });
  (doc as any).fontkit = fontkit.default || fontkit;
  
  const fontPath = path.resolve('./public/fonts/NotoSansArabic-Regular.ttf');
  doc.registerFont('ArabicRegular', fontPath);
  
  const chunks: Buffer[] = [];
  doc.on('data', c => chunks.push(c));
  
  const tests = [
    'فاتورة مبيعات',
    'شركة تجريبية للأنظمة السحابية',
    'الضريبة (15%): 150 ريال',
    'الإجمالي الفرعي',
    'كود الصنف',
    'توقيع المحاسب'
  ];
  
  doc.font('ArabicRegular').fontSize(18);
  doc.fillColor('#000000');
  doc.text(`Mode: ${mode}`, 50, 50);
  
  let y = 100;
  for (const text of tests) {
    let rendered: string;
    
    if (mode === 'RAW') {
      rendered = text;
    } else if (mode === 'SHAPED_ONLY') {
      rendered = reshaper.ArabicShaper.convertArabic(text);
    } else if (mode === 'BIDI_ONLY') {
      const levels = bidi.getEmbeddingLevels(text, 'rtl');
      const flips = bidi.getReorderSegments(text, levels);
      let arr = text.split('');
      flips.forEach(([s, e]) => {
        const seg = arr.slice(s, e + 1).reverse().map(mirrorChar);
        for (let i = s; i <= e; i++) arr[i] = seg[i - s];
      });
      rendered = arr.join('');
    } else {
      // SHAPED+BIDI (current production approach)
      const shaped = reshaper.ArabicShaper.convertArabic(text);
      rendered = processLine(shaped);
    }
    
    // Print what is being passed
    const codepoints = [...rendered].map(c => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0'));
    console.log(`[${mode}] "${text}" => "${rendered}"`);
    console.log(`  Codepoints: ${codepoints.slice(0, 10).join(' ')}${codepoints.length > 10 ? '...' : ''}`);
    
    doc.text(`Original: ${text}`, 50, y, { width: 500, align: 'left' });
    y += 25;
    doc.text(`${mode}: ${rendered}`, 50, y, { width: 500, align: 'left' });
    y += 40;
  }
  
  return new Promise<void>((resolve) => {
    doc.on('end', () => {
      fs.writeFileSync(filename, Buffer.concat(chunks));
      console.log(`\nGenerated: ${filename} (${Buffer.concat(chunks).length} bytes)`);
      resolve();
    });
    doc.end();
  });
}

async function main() {
  await generateTestPDF('test-RAW.pdf', 'RAW');
  await generateTestPDF('test-SHAPED_ONLY.pdf', 'SHAPED_ONLY');
  await generateTestPDF('test-BIDI_ONLY.pdf', 'BIDI_ONLY');
  await generateTestPDF('test-SHAPED_BIDI.pdf', 'SHAPED_BIDI');
  console.log('\n=== ALL 4 test PDFs generated. Open them to compare Arabic rendering. ===');
}

main();
