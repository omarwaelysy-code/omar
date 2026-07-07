import fs from 'fs';
import { execSync } from 'child_process';
import { PdfTheme } from './PdfTheme';

type Direction = 'RTL' | 'LTR';

interface TextSegment {
  text: string;
  dir: Direction;
}

// ----------------------------------------------------
// Arabic Character Contextual Shaping Map
// ----------------------------------------------------
const ARABIC_MAP: { [key: string]: [string, string, string, string, boolean, boolean] } = {
  // char: [isolated, initial, medial, final, rightLink, leftLink]
  'ا': ['\uFE8D', '\uFE8D', '\uFE8E', '\uFE8E', true, false],
  'أ': ['\uFE83', '\uFE83', '\uFE84', '\uFE84', true, false],
  'إ': ['\uFE87', '\uFE87', '\uFE88', '\uFE88', true, false],
  'آ': ['\uFE81', '\uFE81', '\uFE82', '\uFE82', true, false],
  'ب': ['\uFE8F', '\uFE91', '\uFE92', '\uFE90', true, true],
  'ت': ['\uFE95', '\uFE97', '\uFE98', '\uFE96', true, true],
  'ث': ['\uFE99', '\uFE9B', '\uFE9C', '\uFE9A', true, true],
  'ج': ['\uFE9D', '\uFE9F', '\uFEA0', '\uFE9E', true, true],
  'ح': ['\uFEA1', '\uFEA3', '\uFEA4', '\uFEA2', true, true],
  'خ': ['\uFEA5', '\uFEA7', '\uFEA8', '\uFEA6', true, true],
  'د': ['\uFEA9', '\uFEA9', '\uFEAA', '\uFEAA', true, false],
  'ذ': ['\uFEAB', '\uFEAB', '\uFEAC', '\uFEAC', true, false],
  'ر': ['\uFEAD', '\uFEAD', '\uFEAE', '\uFEAE', true, false],
  'ز': ['\uFEAF', '\uFEAF', '\uFEB0', '\uFEB0', true, false],
  'س': ['\uFEB1', '\uFEB3', '\uFEB4', '\uFEB2', true, true],
  'ش': ['\uFEB5', '\uFEB7', '\uFEB8', '\uFEB6', true, true],
  'ص': ['\uFEB9', '\uFEBB', '\uFEBC', '\uFEBA', true, true],
  'ض': ['\uFEBD', '\uFEBF', '\uFEC0', '\uFEBE', true, true],
  'ط': ['\uFEC1', '\uFEC3', '\uFEC4', '\uFEC2', true, true],
  'ظ': ['\uFEC5', '\uFEC7', '\uFEC8', '\uFEC6', true, true],
  'ع': ['\uFEC9', '\uFECB', '\uFECC', '\uFECA', true, true],
  'غ': ['\uFECD', '\uFECF', '\uFED0', '\uFECE', true, true],
  'ف': ['\uFED1', '\uFED3', '\uFED4', '\uFED2', true, true],
  'ق': ['\uFED5', '\uFED7', '\uFED8', '\uFED6', true, true],
  'ك': ['\uFED9', '\uFEDB', '\uFEDC', '\uFEDA', true, true],
  'ل': ['\uFEDD', '\uFEDF', '\uFEE0', '\uFEDE', true, true],
  'م': ['\uFEE1', '\uFEE3', '\uFEE4', '\uFEE2', true, true],
  'ن': ['\uFEE5', '\uFEE7', '\uFEE8', '\uFEE6', true, true],
  'ه': ['\uFEE9', '\uFEEB', '\uFEEC', '\uFEEA', true, true],
  'و': ['\uFEED', '\uFEED', '\uFEEE', '\uFEEE', true, false],
  'ي': ['\uFEF1', '\uFEF3', '\uFEF4', '\uFEF2', true, true],
  'ى': ['\uFEEF', '\uFEEF', '\uFEF0', '\uFEF0', true, false],
  'ة': ['\uFE93', '\uFE93', '\uFE94', '\uFE94', true, false],
  'ؤ': ['\uFE85', '\uFE85', '\uFE86', '\uFE86', true, false],
  'ئ': ['\uFE89', '\uFE8B', '\uFE8C', '\uFE8A', true, true],
  'ء': ['\uFE80', '\uFE80', '\uFE80', '\uFE80', false, false],
  // Lam-Alef placeholders (in private use area)
  '\uF001': ['\uFEFB', '\uFEFB', '\uFEFC', '\uFEFC', true, false], // لا
  '\uF002': ['\uFEF7', '\uFEF7', '\uFEF8', '\uFEF8', true, false], // لأ
  '\uF003': ['\uFEF9', '\uFEF9', '\uFEFA', '\uFEFA', true, false], // لإ
  '\uF004': ['\uFEF5', '\uFEF5', '\uFEF6', '\uFEF6', true, false]  // لآ
};

// ----------------------------------------------------
// Helper Functions
// ----------------------------------------------------

export function shapeArabicText(text: string): string {
  if (text === null || text === undefined) return '';
  const val = String(text);
  // Preprocess Lam-Alef ligatures
  let prepared = val;
  prepared = prepared.replace(/لأ/g, '\uF002');
  prepared = prepared.replace(/لإ/g, '\uF003');
  prepared = prepared.replace(/لآ/g, '\uF004');
  prepared = prepared.replace(/لا/g, '\uF001');

  const chars = Array.from(prepared);
  const shaped: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const map = ARABIC_MAP[char];

    if (!map) {
      shaped.push(char);
      continue;
    }

    const prevChar = chars[i - 1];
    const nextChar = chars[i + 1];

    const prevMap = prevChar ? ARABIC_MAP[prevChar] : null;
    const nextMap = nextChar ? ARABIC_MAP[nextChar] : null;

    // Check link on the right (connects to prev)
    const connectRight = prevMap ? prevMap[5] && map[4] : false;

    // Check link on the left (connects to next)
    const connectLeft = nextMap ? nextMap[4] && map[5] : false;

    if (connectRight && connectLeft) {
      shaped.push(map[2]); // medial
    } else if (connectRight) {
      shaped.push(map[3]); // final
    } else if (connectLeft) {
      shaped.push(map[1]); // initial
    } else {
      shaped.push(map[0]); // isolated
    }
  }

  return shaped.join('');
}

export function segmentText(text: string): TextSegment[] {
  if (text === null || text === undefined) return [];
  const val = String(text);
  const segments: TextSegment[] = [];
  let currentText = '';
  let currentDir: Direction | null = null;

  const isArabicChar = (char: string) => {
    const code = char.charCodeAt(0);
    return (
      (code >= 0x0600 && code <= 0x06FF) ||
      (code >= 0x0750 && code <= 0x077F) ||
      (code >= 0x08A0 && code <= 0x08FF) ||
      (code >= 0xFB50 && code <= 0xFDFF) ||
      (code >= 0xFE70 && code <= 0xFEFF) ||
      (char >= '\uF001' && char <= '\uF004') ||
      char === '،' || char === '؛' || char === '؟'
    );
  };

  const isNeutralChar = (char: string) => {
    return ' \t\r\n+-*/%=()[]{}.,;:!?@#$&|<>`"\'\\'.includes(char);
  };

  for (let i = 0; i < val.length; i++) {
    const char = val[i];
    if (isNeutralChar(char)) {
      currentText += char;
    } else {
      const dir = isArabicChar(char) ? 'RTL' : 'LTR';
      if (currentDir === null) {
        currentDir = dir;
        currentText += char;
      } else if (currentDir === dir) {
        currentText += char;
      } else {
        segments.push({ text: currentText, dir: currentDir });
        currentText = char;
        currentDir = dir;
      }
    }
  }

  if (currentText) {
    segments.push({ text: currentText, dir: currentDir || 'RTL' });
  }

  return segments;
}

export function prepareTextLine(text: string): string {
  if (text === null || text === undefined) return '';
  const val = String(text);
  const segments = segmentText(val);
  if (segments.length === 0) return '';

  const processedSegments = segments.map(seg => {
    if (seg.dir === 'RTL') {
      const shaped = shapeArabicText(seg.text);
      return Array.from(shaped).reverse().join('');
    } else {
      return seg.text;
    }
  });

  return processedSegments.reverse().join('');
}

export function wrapRtlText(doc: any, text: string, maxWidth: number): string[] {
  if (text === null || text === undefined) return [];
  const val = String(text);
  const lines = val.split('\n');
  const resultLines: string[] = [];

  for (const line of lines) {
    const words = line.trim().split(/\s+/);
    if (words.length === 0 || (words.length === 1 && words[0] === '')) {
      resultLines.push('');
      continue;
    }

    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + ' ' + word;
      const preparedTest = prepareTextLine(testLine);
      const width = doc.widthOfString(preparedTest);

      if (width > maxWidth) {
        resultLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      resultLines.push(currentLine);
    }
  }

  return resultLines;
}

export function drawTextLine(doc: any, text: string, x: number, y: number, options: any = {}) {
  const align = options.align || 'right';
  const width = options.width;
  const font = options.font || PdfTheme.fonts.regular;
  const fontSize = options.fontSize || 9;
  const color = options.color || PdfTheme.colors.text;

  doc.font(font).fontSize(fontSize).fillColor(color);

  const val = text === null || text === undefined ? '' : String(text);
  const prepared = prepareTextLine(val);

  if (width) {
    const textWidth = doc.widthOfString(prepared);
    let targetX = x;
    if (align === 'right') {
      targetX = x + width - textWidth;
    } else if (align === 'center') {
      targetX = x + (width - textWidth) / 2;
    }
    doc.text(prepared, targetX, y, { lineBreak: false });
  } else {
    doc.text(prepared, x, y, { lineBreak: false });
  }
}

export function drawText(doc: any, text: string, x: number, y: number, options: any = {}): number {
  const width = options.width || 200;
  const lineHeight = options.lineHeight || (options.fontSize || 9) * 1.3;
  const val = text === null || text === undefined ? '' : String(text);
  const lines = wrapRtlText(doc, val, width);

  let currentY = y;
  for (const line of lines) {
    drawTextLine(doc, line, x, currentY, options);
    currentY += lineHeight;
  }

  return currentY - y; // Return total height drawn
}
