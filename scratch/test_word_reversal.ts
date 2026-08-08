import reshaper from 'arabic-persian-reshaper';

function oldShapeText(text: string): string {
  const str = String(text).trim();
  const colonIdx = str.indexOf(':');
  if (colonIdx > -1) {
    const label = str.substring(0, colonIdx).trim();
    const val = str.substring(colonIdx + 1).trim();
    const shapedLabel = oldShapeText(label);
    const shapedVal = oldShapeText(val);
    return `${shapedVal} :${shapedLabel}`;
  }

  const words = str.split(/\s+/);
  if (words.length > 1) {
    const reversedWords = words.reverse().join(' ');
    return reshaper.ArabicShaper.convertArabic(reversedWords);
  }

  return reshaper.ArabicShaper.convertArabic(str);
}

console.log("Original: 'مراجع الفاتورة'");
console.log("Old shaped:", oldShapeText('مراجع الفاتورة'));

console.log("\nOriginal: 'العميل : شركة الامل الجديد'");
console.log("Old shaped:", oldShapeText('العميل : شركة الامل الجديد'));
