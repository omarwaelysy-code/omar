import PDFDocument from 'pdfkit';
// @ts-ignore
import reshaper from 'arabic-persian-reshaper';
import bidiFactory from 'bidi-js';
import fs from 'fs';
import path from 'path';

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

function shapeText(text: string): string {
  if (!text) return '';
  return reshaper.ArabicShaper.convertArabic(text);
}

// Simple reverse helper
function reverseString(str: string): string {
  return str.split('').reverse().join('');
}

console.log("=== COMPARING TEXT TRANSFORMATIONS ===");
const sample = "فاتورة مبيعات";
console.log("Original:        ", sample);
console.log("shapeText:       ", shapeText(sample));
console.log("processLine:     ", processLine(shapeText(sample)));
console.log("reverse(shape):  ", reverseString(shapeText(sample)));
