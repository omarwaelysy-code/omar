import reshaper from 'arabic-persian-reshaper';

function shapeAndReverseForPdfKit(text: string): string {
  if (!text) return '';
  const str = String(text).trim();
  if (!str) return '';

  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str);
  if (!hasArabic) return str;

  // 1. Convert to connected presentation forms
  const reshaped = reshaper.ArabicShaper.convertArabic(str);

  // 2. Reverse character string so PDFKit's LTR engine outputs RTL visual layout
  // We mirror brackets/parentheses to preserve ( -> )
  const chars = reshaped.split('');
  const reversed = chars.reverse().map(ch => {
    switch (ch) {
      case '(': return ')';
      case ')': return '(';
      case '[': return ']';
      case ']': return '[';
      case '{': return '}';
      case '}': return '{';
      default: return ch;
    }
  });

  return reversed.join('');
}

console.log("Original: 'مراجع الفاتورة'");
console.log("PdfKit string:", shapeAndReverseForPdfKit('مراجع الفاتورة'));

console.log("\nOriginal: 'العميل : شركة الامل الجديد'");
console.log("PdfKit string:", shapeAndReverseForPdfKit('العميل : شركة الامل الجديد'));
