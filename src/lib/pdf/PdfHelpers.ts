// Arabic cursive shaper and Bidi layout manager for @react-pdf/renderer

const arabicLetters: { [key: string]: { isolated: string, initial: string, medial: string, final: string, joinLeft: boolean, joinRight: boolean } } = {
  // Alef Madda
  '\u0622': { isolated: '\uFE81', initial: '\uFE81', medial: '\uFE82', final: '\uFE82', joinLeft: false, joinRight: true },
  // Alef Hamza Above
  '\u0623': { isolated: '\uFE83', initial: '\uFE83', medial: '\uFE84', final: '\uFE84', joinLeft: false, joinRight: true },
  // Waw Hamza
  '\u0624': { isolated: '\uFE85', initial: '\uFE85', medial: '\uFE86', final: '\uFE86', joinLeft: false, joinRight: true },
  // Alef Hamza Below
  '\u0625': { isolated: '\uFE87', initial: '\uFE87', medial: '\uFE88', final: '\uFE88', joinLeft: false, joinRight: true },
  // Ya Hamza
  '\u0626': { isolated: '\uFE89', initial: '\uFE8B', medial: '\uFE8C', final: '\uFE8A', joinLeft: true, joinRight: true },
  // Alef
  '\u0627': { isolated: '\uFE8D', initial: '\uFE8D', medial: '\uFE8E', final: '\uFE8E', joinLeft: false, joinRight: true },
  // Ba
  '\u0628': { isolated: '\uFE8F', initial: '\uFE91', medial: '\uFE92', final: '\uFE90', joinLeft: true, joinRight: true },
  // Ta Marbuta
  '\u0629': { isolated: '\uFE93', initial: '\uFE93', medial: '\uFE94', final: '\uFE94', joinLeft: false, joinRight: true },
  // Ta
  '\u062A': { isolated: '\uFE95', initial: '\uFE97', medial: '\uFE98', final: '\uFE96', joinLeft: true, joinRight: true },
  // Tha
  '\u062B': { isolated: '\uFE99', initial: '\uFE9B', medial: '\uFE9C', final: '\uFE9A', joinLeft: true, joinRight: true },
  // Jeem
  '\u062C': { isolated: '\uFE9D', initial: '\uFE9F', medial: '\uFEA0', final: '\uFE9E', joinLeft: true, joinRight: true },
  // Hha
  '\u062D': { isolated: '\uFEA1', initial: '\uFEA3', medial: '\uFEA4', final: '\uFEA2', joinLeft: true, joinRight: true },
  // Kha
  '\u062E': { isolated: '\uFEA5', initial: '\uFEA7', medial: '\uFEA8', final: '\uFEA6', joinLeft: true, joinRight: true },
  // Dal
  '\u062F': { isolated: '\uFEA9', initial: '\uFEA9', medial: '\uFEAA', final: '\uFEAA', joinLeft: false, joinRight: true },
  // Thal
  '\u0630': { isolated: '\uFEAB', initial: '\uFEAB', medial: '\uFEAC', final: '\uFEAC', joinLeft: false, joinRight: true },
  // Ra
  '\u0631': { isolated: '\uFEAD', initial: '\uFEAD', medial: '\uFEAE', final: '\uFEAE', joinLeft: false, joinRight: true },
  // Zay
  '\u0632': { isolated: '\uFEAF', initial: '\uFEAF', medial: '\uFEB0', final: '\uFEB0', joinLeft: false, joinRight: true },
  // Seen
  '\u0633': { isolated: '\uFEB1', initial: '\uFEB3', medial: '\uFEB4', final: '\uFEB2', joinLeft: true, joinRight: true },
  // Sheen
  '\u0634': { isolated: '\uFEB5', initial: '\uFEB7', medial: '\uFEB8', final: '\uFEB6', joinLeft: true, joinRight: true },
  // Sad
  '\u0635': { isolated: '\uFEB9', initial: '\uFEBB', medial: '\uFEBC', final: '\uFEBA', joinLeft: true, joinRight: true },
  // Dad
  '\u0636': { isolated: '\uFEBD', initial: '\uFEBF', medial: '\uFEC0', final: '\uFEBE', joinLeft: true, joinRight: true },
  // Tah
  '\u0637': { isolated: '\uFEC1', initial: '\uFEC3', medial: '\uFEC4', final: '\uFEC2', joinLeft: true, joinRight: true },
  // Zah
  '\u0638': { isolated: '\uFEC5', initial: '\uFEC7', medial: '\uFEC8', final: '\uFEC6', joinLeft: true, joinRight: true },
  // Ain
  '\u0639': { isolated: '\uFEC9', initial: '\uFECB', medial: '\uFECC', final: '\uFECA', joinLeft: true, joinRight: true },
  // Ghain
  '\u063A': { isolated: '\uFECD', initial: '\uFECF', medial: '\uFED0', final: '\uFECE', joinLeft: true, joinRight: true },
  // Fa
  '\u0641': { isolated: '\uFED1', initial: '\uFED3', medial: '\uFED4', final: '\uFED2', joinLeft: true, joinRight: true },
  // Qaf
  '\u0642': { isolated: '\uFED5', initial: '\uFED7', medial: '\uFED8', final: '\uFED6', joinLeft: true, joinRight: true },
  // Kaf
  '\u0643': { isolated: '\uFED9', initial: '\uFEDB', medial: '\uFEDC', final: '\uFEDA', joinLeft: true, joinRight: true },
  // Lam
  '\u0644': { isolated: '\uFEDD', initial: '\uFEDF', medial: '\uFEE0', final: '\uFEDE', joinLeft: true, joinRight: true },
  // Meem
  '\u0645': { isolated: '\uFEE1', initial: '\uFEE3', medial: '\uFEE4', final: '\uFEE2', joinLeft: true, joinRight: true },
  // Noon
  '\u0646': { isolated: '\uFEE5', initial: '\uFEE7', medial: '\uFEE8', final: '\uFEE6', joinLeft: true, joinRight: true },
  // Ha
  '\u0647': { isolated: '\uFEE9', initial: '\uFEEB', medial: '\uFEEC', final: '\uFEEA', joinLeft: true, joinRight: true },
  // Waw
  '\u0648': { isolated: '\uFEED', initial: '\uFEED', medial: '\uFEEE', final: '\uFEEE', joinLeft: false, joinRight: true },
  // Ya
  '\u064A': { isolated: '\uFEF1', initial: '\uFEF3', medial: '\uFEF4', final: '\uFEF0', joinLeft: true, joinRight: true },
  // Alif Maksura
  '\u0649': { isolated: '\uFEEF', initial: '\uFEEF', medial: '\uFEF0', final: '\uFEF0', joinLeft: false, joinRight: true },
  // Hamza
  '\u0621': { isolated: '\uFE80', initial: '\uFE80', medial: '\uFE80', final: '\uFE80', joinLeft: false, joinRight: false }
};

// Shape Lam-Alef ligatures before standard character shaping
function replaceLamAlef(text: string): string {
  return text
    .replace(/\u0644\u0627/g, '\uFEFB') // Lam + Alef
    .replace(/\u0644\u0622/g, '\uFEF5') // Lam + Alef Madda
    .replace(/\u0644\u0623/g, '\uFEF7') // Lam + Alef Hamza Above
    .replace(/\u0644\u0625/g, '\uFEF9'); // Lam + Alef Hamza Below
}

/**
 * Perform Arabic contextual letter shaping and reverse the output for LTR PDF engines.
 */
export function shapeArabicText(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return '';
  const strVal = String(text);
  if (!strVal.trim()) return strVal;

  // 1. Process Lam-Alef ligatures first
  const ligatured = replaceLamAlef(strVal);

  // 2. Perform contextual shaping
  let shaped = '';
  for (let i = 0; i < ligatured.length; i++) {
    const c = ligatured[i];
    const letter = arabicLetters[c];
    if (letter) {
      const prev = ligatured[i - 1];
      const next = ligatured[i + 1];

      const joinPrev = prev && arabicLetters[prev]?.joinLeft && letter.joinRight;
      const joinNext = next && letter.joinLeft && arabicLetters[next]?.joinRight;

      if (joinPrev && joinNext) {
        shaped += letter.medial;
      } else if (joinPrev) {
        shaped += letter.final;
      } else if (joinNext) {
        shaped += letter.initial;
      } else {
        shaped += letter.isolated;
      }
    } else {
      shaped += c;
    }
  }

  // 3. Simple Bidi layout: split text into Latin/numerical blocks and Arabic blocks,
  // then reverse the character order of Arabic blocks and re-assemble them from right to left.
  const tokens = shaped.split(/([a-zA-Z0-9\s.,:\/\\%#$()_+\-*@!?&]+)/g);
  const processedTokens = tokens.map(token => {
    // If it's a Latin/numeric/symbol block, keep it as is.
    if (/[a-zA-Z0-9]/.test(token)) {
      return token;
    }
    // If it is an Arabic/shaped block, reverse the characters to flow RTL.
    return token.split('').reverse().join('');
  });

  // Reverse the token list to read from right-to-left
  return processedTokens.reverse().join('');
}
