export const formatNumber = (value: number | string | undefined | null, decimals: number = 2): string => {
  if (value === undefined || value === null || value === '') return '0.00';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '0.00';
  
  // Use Intl.NumberFormat for consistent formatting
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(num);
};

export const formatMoney = (value: number | string | undefined | null): string => {
  return formatNumber(value, 2);
};

export const formatDate = (date: string | Date | undefined | null): string => {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    
    // For ISO strings that are likely just dates (like 2024-03-20),
    // we use UTC to avoid timezone shifts showing the previous day
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(date);
  }
};

export const formatDateTime = (date: string | Date | undefined | null): string => {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    
    // For date-time, we show local time but maintain the Egyptian DD/MM/YYYY format
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    return String(date);
  }
};

export const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

export const isCustomerAccount = (accountId: string, customer: any, accountsList: any[]) => {
  return customer?.account_id ? accountId === customer.account_id : false;
};

export const isSupplierAccount = (accountId: string, supplier: any, accountsList: any[]) => {
  return supplier?.account_id ? accountId === supplier.account_id : false;
};

/**
 * Automatically cleans duplicated partner/supplier names caused by portal errors
 * e.g. "شركه سويفت ايجيبت ليمتد شركه سويفت ايجيبت ليمتد" -> "شركه سويفت ايجيبت ليمتد"
 * or "ABC Ltd - ABC Ltd" -> "ABC Ltd"
 */
export const cleanDuplicatedPartnerName = (rawName: string | null | undefined): string => {
  if (!rawName) return '';
  let name = String(rawName).trim().replace(/\s+/g, ' ');

  // 1. Check if separated by common delimiters: " - ", " / ", " | ", " ، ", ", "
  const delimiters = [' - ', ' / ', ' | ', ' ، ', ' , '];
  for (const delim of delimiters) {
    if (name.includes(delim)) {
      const parts = name.split(delim).map(p => p.trim()).filter(Boolean);
      if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
        name = parts[0];
        break;
      }
    }
  }

  // 2. Check for repeated phrase at word level
  // e.g. words = ["شركه", "سويفت", "ايجيبت", "ليمتد", "شركه", "سويفت", "ايجيبت", "ليمتد"]
  const words = name.split(' ');
  if (words.length >= 2 && words.length % 2 === 0) {
    const halfWords = words.length / 2;
    const firstHalfWords = words.slice(0, halfWords).join(' ');
    const secondHalfWords = words.slice(halfWords).join(' ');
    if (firstHalfWords.toLowerCase() === secondHalfWords.toLowerCase()) {
      name = firstHalfWords;
    }
  } else {
    // 3. Fallback character-level half-check
    const len = name.length;
    const mid = Math.floor(len / 2);
    for (let offset = -2; offset <= 2; offset++) {
      const splitIdx = mid + offset;
      if (splitIdx >= 3 && splitIdx < len - 2) {
        const p1 = name.substring(0, splitIdx).trim();
        const p2 = name.substring(splitIdx).trim();
        if (p1.length >= 3 && p1.toLowerCase() === p2.toLowerCase()) {
          name = p1;
          break;
        }
      }
    }
  }

  return name.trim();
};

