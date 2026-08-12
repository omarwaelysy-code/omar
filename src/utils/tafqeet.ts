/**
 * Utility for converting numeric monetary amounts into written words (Tafqeet)
 * Supports both Arabic and English with currency fraction handling.
 */

interface CurrencyConfig {
  mainAr: string;
  fractionAr: string;
  mainEn: string;
  fractionEn: string;
}

const CURRENCIES: Record<string, CurrencyConfig> = {
  EGP: { mainAr: 'جنيه مصري', fractionAr: 'قرش', mainEn: 'Egyptian Pound', fractionEn: 'Piaster' },
  SAR: { mainAr: 'ريال سعودي', fractionAr: 'هللة', mainEn: 'Saudi Riyal', fractionEn: 'Halala' },
  USD: { mainAr: 'دولار أمريكي', fractionAr: 'سنت', mainEn: 'US Dollar', fractionEn: 'Cent' },
  EUR: { mainAr: 'يورو', fractionAr: 'سنت', mainEn: 'Euro', fractionEn: 'Cent' },
  KWD: { mainAr: 'دينار كويتي', fractionAr: 'فلس', mainEn: 'Kuwaiti Dinar', fractionEn: 'Fils' },
  AED: { mainAr: 'درهم إماراتي', fractionAr: 'فلس', mainEn: 'UAE Dirham', fractionEn: 'Fils' },
  QAR: { mainAr: 'ريال قطري', fractionAr: 'درهم', mainEn: 'Qatari Riyal', fractionEn: 'Dirham' },
  BHD: { mainAr: 'دينار بحريني', fractionAr: 'فلس', mainEn: 'Bahraini Dinar', fractionEn: 'Fils' },
  OMR: { mainAr: 'ريال عماني', fractionAr: 'بيسة', mainEn: 'Omani Rial', fractionEn: 'Baisa' },
  JOD: { mainAr: 'دينار أردني', fractionAr: 'قرش', mainEn: 'Jordanian Dinar', fractionEn: 'Piaster' },
};

// --- ARABIC CONVERSION HELPERS ---
const onesAr = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const tensAr = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const hundredsAr = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function convertUnderThousandAr(n: number): string {
  if (n === 0) return '';
  const parts: string[] = [];

  const h = Math.floor(n / 100);
  const remainder = n % 100;

  if (h > 0) {
    parts.push(hundredsAr[h]);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(onesAr[remainder]);
    } else {
      const u = remainder % 10;
      const t = Math.floor(remainder / 10);
      if (u > 0) {
        parts.push(`${onesAr[u]} و${tensAr[t]}`);
      } else {
        parts.push(tensAr[t]);
      }
    }
  }

  return parts.join(' و');
}

export function tafqeetAr(amount: number, currencyCode: string = 'EGP'): string {
  if (isNaN(amount) || amount === 0) {
    const curr = CURRENCIES[currencyCode.toUpperCase()] || { mainAr: currencyCode, fractionAr: '' };
    return `صفر ${curr.mainAr} لا غير`;
  }

  const curr = CURRENCIES[currencyCode.toUpperCase()] || { mainAr: currencyCode, fractionAr: 'قرش' };
  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const fractionPart = Math.round((absAmount - integerPart) * 100);

  const parts: string[] = [];

  // Billions
  const billions = Math.floor(integerPart / 1000000000);
  const remBillions = integerPart % 1000000000;

  // Millions
  const millions = Math.floor(remBillions / 1000000);
  const remMillions = remBillions % 1000000;

  // Thousands
  const thousands = Math.floor(remMillions / 1000);
  const ones = remMillions % 1000;

  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else if (billions >= 3 && billions <= 10) parts.push(`${convertUnderThousandAr(billions)} مليارات`);
    else parts.push(`${convertUnderThousandAr(billions)} مليار`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertUnderThousandAr(millions)} ملايين`);
    else parts.push(`${convertUnderThousandAr(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertUnderThousandAr(thousands)} آلاف`);
    else parts.push(`${convertUnderThousandAr(thousands)} ألفاً`);
  }

  if (ones > 0) {
    parts.push(convertUnderThousandAr(ones));
  }

  let result = parts.length > 0 ? parts.join(' و') : 'صفر';
  result += ` ${curr.mainAr}`;

  if (fractionPart > 0) {
    result += ` و${convertUnderThousandAr(fractionPart)} ${curr.fractionAr}`;
  }

  return `فقط ${result} لا غير`;
}

// --- ENGLISH CONVERSION HELPERS ---
const onesEn = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tensEn = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertUnderThousandEn(n: number): string {
  if (n === 0) return '';
  const parts: string[] = [];

  const h = Math.floor(n / 100);
  const remainder = n % 100;

  if (h > 0) {
    parts.push(`${onesEn[h]} Hundred`);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(onesEn[remainder]);
    } else {
      const u = remainder % 10;
      const t = Math.floor(remainder / 10);
      parts.push(u > 0 ? `${tensEn[t]}-${onesEn[u]}` : tensEn[t]);
    }
  }

  return parts.join(' ');
}

export function tafqeetEn(amount: number, currencyCode: string = 'EGP'): string {
  if (isNaN(amount) || amount === 0) {
    const curr = CURRENCIES[currencyCode.toUpperCase()] || { mainEn: currencyCode, fractionEn: '' };
    return `Zero ${curr.mainEn}s Only`;
  }

  const curr = CURRENCIES[currencyCode.toUpperCase()] || { mainEn: currencyCode, fractionEn: 'Cent' };
  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const fractionPart = Math.round((absAmount - integerPart) * 100);

  const parts: string[] = [];

  const billions = Math.floor(integerPart / 1000000000);
  const remBillions = integerPart % 1000000000;
  const millions = Math.floor(remBillions / 1000000);
  const remMillions = remBillions % 1000000;
  const thousands = Math.floor(remMillions / 1000);
  const ones = remMillions % 1000;

  if (billions > 0) parts.push(`${convertUnderThousandEn(billions)} Billion`);
  if (millions > 0) parts.push(`${convertUnderThousandEn(millions)} Million`);
  if (thousands > 0) parts.push(`${convertUnderThousandEn(thousands)} Thousand`);
  if (ones > 0) parts.push(convertUnderThousandEn(ones));

  let result = parts.length > 0 ? parts.join(' ') : 'Zero';
  result += ` ${curr.mainEn}${integerPart !== 1 ? 's' : ''}`;

  if (fractionPart > 0) {
    result += ` and ${convertUnderThousandEn(fractionPart)} ${curr.fractionEn}${fractionPart !== 1 ? 's' : ''}`;
  }

  return `${result} Only`;
}

export function tafqeet(amount: number, currencyCode: string = 'EGP', lang: 'ar' | 'en' = 'ar'): string {
  return lang === 'ar' ? tafqeetAr(amount, currencyCode) : tafqeetEn(amount, currencyCode);
}
