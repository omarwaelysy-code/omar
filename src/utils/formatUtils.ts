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
