import reshaper from 'arabic-persian-reshaper';
import bidiFactory from 'bidi-js';

const bidi = bidiFactory();

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

function processLine(shapedLine: string): string {
  if (!shapedLine) return '';

  let unshapedForBidi = '';
  for (let i = 0; i < shapedLine.length; i++) {
    const code = shapedLine.codePointAt(i) || 0;
    if ((code >= 0xFB50 && code <= 0xFDFF) || (code >= 0xFE70 && code <= 0xFEFF)) {
      unshapedForBidi += 'ع';
    } else {
      unshapedForBidi += shapedLine[i];
    }
  }

  const embeddingLevels = bidi.getEmbeddingLevels(unshapedForBidi, 'rtl');
  const flips = bidi.getReorderSegments(unshapedForBidi, embeddingLevels);
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
  if (!text) return '';
  const str = String(text).trim();
  if (!str) return '';

  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str);
  if (!hasArabic) return str;

  return reshaper.ArabicShaper.convertArabic(str);
}

console.log("Original: 'مراجع الفاتورة'");
const shaped1 = shapeText('مراجع الفاتورة');
console.log("Shaped:", shaped1);
console.log("ProcessLine:", processLine(shaped1));

console.log("\nOriginal: 'العميل : شركة الامل الجديد'");
const shaped2 = shapeText('العميل : شركة الامل الجديد');
console.log("Shaped:", shaped2);
console.log("ProcessLine:", processLine(shaped2));
