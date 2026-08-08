// @ts-ignore
import reshaper from 'arabic-persian-reshaper';

function shapeText(text: any): string {
  if (text === null || text === undefined) return '';
  const str = String(text).trim();
  if (!str) return '';

  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(str);
  if (!hasArabic) {
    return str;
  }

  const pipeIdx = str.indexOf('|');
  if (pipeIdx > -1) {
    const left = str.substring(0, pipeIdx).trim();
    const right = str.substring(pipeIdx + 1).trim();
    return `${shapeText(left)}  |  ${shapeText(right)}`;
  }

  const colonIdx = str.indexOf(':');
  if (colonIdx > -1) {
    const label = str.substring(0, colonIdx).trim();
    const val = str.substring(colonIdx + 1).trim();
    
    const isEnglishLabel = /^[a-zA-Z0-9\s]+$/.test(label);
    if (isEnglishLabel) {
      const shapedVal = shapeText(val);
      return `${label}: ${shapedVal}`;
    }

    const shapedLabel = shapeText(label);
    const shapedVal = shapeText(val);
    return `${shapedVal} :${shapedLabel}`;
  }

  const words = str.split(/\s+/);
  if (words.length > 1) {
    const reversedWords = words.reverse().join(' ');
    return reshaper.ArabicShaper.convertArabic(reversedWords);
  }

  return reshaper.ArabicShaper.convertArabic(str);
}

console.log("=== TESTING FOOTER THANK YOU NOTE ===");
console.log("Result:", shapeText("شكراً لتعاملكم معنا | Thank you for your business"));
