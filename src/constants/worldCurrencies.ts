export interface WorldCurrency {
  code: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  flag: string;
}

export const WORLD_CURRENCIES: WorldCurrency[] = [
  { code: 'USD', name_ar: 'دولار أمريكي', name_en: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name_ar: 'يورو', name_en: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'EGP', name_ar: 'جنيه مصري', name_en: 'Egyptian Pound', symbol: 'ج.م', flag: '🇪🇬' },
  { code: 'SAR', name_ar: 'ريال سعودي', name_en: 'Saudi Riyal', symbol: 'ر.س', flag: '🇸🇦' },
  { code: 'AED', name_ar: 'درهم إماراتي', name_en: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'QAR', name_ar: 'ريال قطري', name_en: 'Qatari Riyal', symbol: 'ر.ق', flag: '🇶🇦' },
  { code: 'KWD', name_ar: 'دينار كويتي', name_en: 'Kuwaiti Dinar', symbol: 'د.ك', flag: '🇰🇼' },
  { code: 'BHD', name_ar: 'دينار بحريني', name_en: 'Bahraini Dinar', symbol: 'د.ب', flag: '🇧🇭' },
  { code: 'OMR', name_ar: 'ريال عماني', name_en: 'Omani Rial', symbol: 'ر.ع.', flag: '🇴🇲' },
  { code: 'JOD', name_ar: 'دينار أردني', name_en: 'Jordanian Dinar', symbol: 'د.أ', flag: '🇯🇴' },
  { code: 'LYD', name_ar: 'دينار ليبي', name_en: 'Libyan Dinar', symbol: 'د.ل', flag: '🇱🇾' },
  { code: 'DZD', name_ar: 'دينار جزائري', name_en: 'Algerian Dinar', symbol: 'د.ج', flag: '🇩🇿' },
  { code: 'MAD', name_ar: 'درهم مغربي', name_en: 'Moroccan Dirham', symbol: 'د.م.', flag: '🇲🇦' },
  { code: 'TND', name_ar: 'دينار تونسي', name_en: 'Tunisian Dinar', symbol: 'د.ت', flag: '🇹🇳' },
  { code: 'GBP', name_ar: 'جنيه إسترليني', name_en: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', name_ar: 'لين ياباني', name_en: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CHF', name_ar: 'فرنك سويسري', name_en: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭' },
  { code: 'CAD', name_ar: 'دولار كندي', name_en: 'Canadian Dollar', symbol: 'CA$', flag: '🇨🇦' },
  { code: 'AUD', name_ar: 'دولار أسترالي', name_en: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'TRY', name_ar: 'ليرة تركية', name_en: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'CNY', name_ar: 'يوان صيني', name_en: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'RUB', name_ar: 'روبل روسي', name_en: 'Russian Ruble', symbol: '₽', flag: '🇷🇺' },
  { code: 'INR', name_ar: 'روبية هندية', name_en: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'BRL', name_ar: 'ريال برازيلي', name_en: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'SDG', name_ar: 'جنيه سوداني', name_en: 'Sudanese Pound', symbol: 'ج.س', flag: '🇸🇩' },
  { code: 'IQD', name_ar: 'دينار عراقي', name_en: 'Iraqi Dinar', symbol: 'د.ع', flag: '🇮🇶' },
  { code: 'LBP', name_ar: 'ليرة لبنانية', name_en: 'Lebanese Pound', symbol: 'ل.ل', flag: '🇱🇧' },
  { code: 'YER', name_ar: 'ريال يمني', name_en: 'Yemeni Rial', symbol: 'ر.ي', flag: '🇾🇪' },
  { code: 'SYP', name_ar: 'ليرة سورية', name_en: 'Syrian Pound', symbol: 'ل.س', flag: '🇸🇾' },
];
