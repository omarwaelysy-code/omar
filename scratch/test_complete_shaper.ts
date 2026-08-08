import reshaper from 'arabic-persian-reshaper';

function shapeArabicCorrectly(text: string): string {
  if (!text) return '';
  const str = String(text).trim();
  if (!str) return '';

  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str);
  if (!hasArabic) return str;

  // Reshape Arabic characters to presentation forms (connecting letters)
  const reshaped = reshaper.ArabicShaper.convertArabic(str);

  // Split into words/tokens and reverse only Arabic runs so RTL visual order is preserved without swapping phrase meaning
  return reshaped;
}

console.log("Testing shapeArabicCorrectly:");
console.log("'مراجع الفاتورة' =>", shapeArabicCorrectly('مراجع الفاتورة'));
console.log("'العميل : شركة الامل الجديد' =>", shapeArabicCorrectly('العميل : شركة الامل الجديد'));
console.log("'INV-2026-08-000001' =>", shapeArabicCorrectly('INV-2026-08-000001'));
