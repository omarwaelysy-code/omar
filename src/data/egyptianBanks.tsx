import React from 'react';

export interface EgyptianBank {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  swift: string;
  brandColor: string;
  accentColor: string;
  category: 'public' | 'commercial' | 'islamic' | 'international';
  categoryAr: string;
  categoryEn: string;
  hotline: string;
  website: string;
  foundedYear?: number;
  branchesCount?: string;
  notes?: string;
}

export const EGYPTIAN_BANKS_DATA: EgyptianBank[] = [
  {
    id: 1,
    code: 'NBE',
    nameAr: 'البنك الأهلي المصري',
    nameEn: 'National Bank of Egypt',
    swift: 'NBEGEGCX',
    brandColor: '#008244',
    accentColor: '#DAA520',
    category: 'public',
    categoryAr: 'قطاع عام / وطني',
    categoryEn: 'Public Sector',
    hotline: '19623',
    website: 'https://www.nbe.com.eg',
    foundedYear: 1898,
    notes: 'أكبر وأقدم بنك تجاري في مصر'
  },
  {
    id: 2,
    code: 'BM',
    nameAr: 'بنك مصر',
    nameEn: 'Banque Misr',
    swift: 'BMISEGCX',
    brandColor: '#9B2735',
    accentColor: '#D4AF37',
    category: 'public',
    categoryAr: 'قطاع عام / وطني',
    categoryEn: 'Public Sector',
    hotline: '19888',
    website: 'https://www.banquemisr.com',
    foundedYear: 1920,
    notes: 'تأسس على يد رائد الاقتصاد المصري طلعت حرب'
  },
  {
    id: 3,
    code: 'BDC',
    nameAr: 'بنك القاهرة',
    nameEn: 'Banque du Caire',
    swift: 'BCAIEGCX',
    brandColor: '#005A9C',
    accentColor: '#E6A100',
    category: 'public',
    categoryAr: 'قطاع عام / وطني',
    categoryEn: 'Public Sector',
    hotline: '16990',
    website: 'https://www.bdc.com.eg',
    foundedYear: 1952,
    notes: 'أحد البنوك الوطنية الكبرى الرائدة في تمويل المشروعات'
  },
  {
    id: 4,
    code: 'BOA',
    nameAr: 'بنك الإسكندرية',
    nameEn: 'Bank of Alexandria',
    swift: 'ALEXEGCX',
    brandColor: '#E30613',
    accentColor: '#333333',
    category: 'commercial',
    categoryAr: 'تجاري خاص (مجموعة إنتيسا سان باولو)',
    categoryEn: 'Commercial (Intesa Sanpaolo)',
    hotline: '19033',
    website: 'https://www.alexbank.com',
    foundedYear: 1957,
    notes: 'عضو مجموعة إنتيسا سان باولو الإيطالية'
  },
  {
    id: 5,
    code: 'CIB',
    nameAr: 'البنك التجاري الدولي',
    nameEn: 'Commercial International Bank',
    swift: 'CIBE EG CX',
    brandColor: '#004B87',
    accentColor: '#F58220',
    category: 'commercial',
    categoryAr: 'تجاري خاص',
    categoryEn: 'Private Commercial',
    hotline: '19666',
    website: 'https://www.cibeg.com',
    foundedYear: 1975,
    notes: 'أكبر بنك قطاع خاص في مصر مدرج بالبورصة المصرية'
  },
  {
    id: 6,
    code: 'QNB',
    nameAr: 'بنك قطر الوطني الأهلي',
    nameEn: 'QNB Alahli',
    swift: 'QNBAEGCX',
    brandColor: '#800020',
    accentColor: '#005696',
    category: 'commercial',
    categoryAr: 'تجاري خاص / دولي',
    categoryEn: 'Commercial Bank',
    hotline: '19700',
    website: 'https://www.qnbalahli.com',
    foundedYear: 1978,
    notes: 'إحدى أكبر المؤسسات المصرفية في السوق المصري'
  },
  {
    id: 7,
    code: 'AAIB',
    nameAr: 'البنك العربي الأفريقي الدولي',
    nameEn: 'Arab African International Bank',
    swift: 'ARAIEGCX',
    brandColor: '#A37B35',
    accentColor: '#0D2240',
    category: 'commercial',
    categoryAr: 'تجاري استثماري',
    categoryEn: 'Commercial / Investment',
    hotline: '19555',
    website: 'https://www.aaib.com',
    foundedYear: 1964,
    notes: 'شراكة بين البنك المركزي المصري والهيئة العامة للاستثمار بالكويت'
  },
  {
    id: 8,
    code: 'EGB',
    nameAr: 'البنك المصري الخليجي',
    nameEn: 'Egyptian Gulf Bank',
    swift: 'EGBKEGCX',
    brandColor: '#1A365D',
    accentColor: '#00A86B',
    category: 'commercial',
    categoryAr: 'تجاري خاص (EG Bank)',
    categoryEn: 'Commercial Bank',
    hotline: '19342',
    website: 'https://www.eg-bank.com',
    foundedYear: 1981,
    notes: 'معروف تجارياً باسم EG Bank'
  },
  {
    id: 9,
    code: 'SAIB',
    nameAr: 'بنك الشركة المصرفية العربية الدولية',
    nameEn: 'Societe Arabe Internationale de Banque',
    swift: 'SAEGEGCX',
    brandColor: '#0D2240',
    accentColor: '#C5A059',
    category: 'commercial',
    categoryAr: 'تجاري خاص',
    categoryEn: 'Commercial Bank',
    hotline: '16668',
    website: 'https://www.saib.com.eg',
    foundedYear: 1976,
    notes: 'يقدم خدمات مصرفية للأفراد والمؤسسات وخدمات متوافقة مع الشريعة'
  },
  {
    id: 10,
    code: 'ARAB',
    nameAr: 'البنك العربي',
    nameEn: 'Arab Bank',
    swift: 'ARBKEGCX',
    brandColor: '#00509E',
    accentColor: '#990000',
    category: 'international',
    categoryAr: 'فرع بنك عربي / دولي',
    categoryEn: 'Arab / Regional Bank',
    hotline: '19100',
    website: 'https://www.arabbank.com.eg',
    foundedYear: 1930,
    notes: 'إحدى أعرق المؤسسات المصرفية العربية'
  },
  {
    id: 11,
    code: 'EBE',
    nameAr: 'البنك المصري لتنمية الصادرات',
    nameEn: 'Export Development Bank of Egypt',
    swift: 'EXDEEGCX',
    brandColor: '#0072CE',
    accentColor: '#FFB81C',
    category: 'commercial',
    categoryAr: 'تجاري وتنمية صادرات (EBank)',
    categoryEn: 'Export Development Bank',
    hotline: '16710',
    website: 'https://www.ebank.com.eg',
    foundedYear: 1983,
    notes: 'معروف بالعلامة التجارية EBank'
  },
  {
    id: 12,
    code: 'AIB',
    nameAr: 'المصرف العربي الدولي',
    nameEn: 'Arab International Bank',
    swift: 'ARIBEGCX',
    brandColor: '#7A1B28',
    accentColor: '#C5A059',
    category: 'commercial',
    categoryAr: 'مصرف استثماري وتجاري',
    categoryEn: 'International Commercial',
    hotline: '19604',
    website: 'https://www.aib.com.eg',
    foundedYear: 1974,
    notes: 'تأسس باتفاقية دولية بين مصر وليبيا والإمارات وسلطنة عمان وقطر'
  },
  {
    id: 13,
    code: 'FIBE',
    nameAr: 'بنك فيصل الإسلامي المصري',
    nameEn: 'Faisal Islamic Bank of Egypt',
    swift: 'FIEGEGCX',
    brandColor: '#0A6836',
    accentColor: '#C89D3C',
    category: 'islamic',
    categoryAr: 'مصرف إسلامي متكامل',
    categoryEn: 'Islamic Bank',
    hotline: '19851',
    website: 'https://www.faisalbank.com.eg',
    foundedYear: 1979,
    notes: 'أول بنك إسلامي وتجاري متكامل في مصر'
  },
  {
    id: 14,
    code: 'ABRK',
    nameAr: 'بنك البركة مصر',
    nameEn: 'Al Baraka Bank Egypt',
    swift: 'ABRKEGCX',
    brandColor: '#114B3F',
    accentColor: '#DAA520',
    category: 'islamic',
    categoryAr: 'مصرف إسلامي',
    categoryEn: 'Islamic Bank',
    hotline: '19520',
    website: 'https://www.albaraka.com.eg',
    foundedYear: 1980,
    notes: 'عضو مجموعة البركة المصرفية العالمية'
  },
  {
    id: 15,
    code: 'AWE',
    nameAr: 'التجاري وفا بنك مصر',
    nameEn: 'Attijariwafa Bank Egypt',
    swift: 'BCMREGCX',
    brandColor: '#E69E00',
    accentColor: '#333333',
    category: 'commercial',
    categoryAr: 'تجاري خاص / مجموعة دولية',
    categoryEn: 'Commercial Bank',
    hotline: '16222',
    website: 'https://www.attijariwafabank.com.eg',
    foundedYear: 1977,
    notes: 'تابع لمجموعة التجاري وفا بنك الرائدة في شمال وغرب أفريقيا'
  },
  {
    id: 16,
    code: 'ADIB',
    nameAr: 'مصرف أبو ظبي الإسلامي – مصر',
    nameEn: 'Abu Dhabi Islamic Bank Egypt',
    swift: 'ABDIEGCX',
    brandColor: '#008A90',
    accentColor: '#C59B27',
    category: 'islamic',
    categoryAr: 'مصرف إسلامي شامل',
    categoryEn: 'Islamic Bank',
    hotline: '19951',
    website: 'https://www.adib.eg',
    foundedYear: 2007,
    notes: 'حائز على جوائز متعددة في الصيرفة الإسلامية والرقمية'
  },
  {
    id: 17,
    code: 'ABK',
    nameAr: 'البنك الأهلي الكويتي – مصر',
    nameEn: 'Al Ahli Bank of Kuwait Egypt',
    swift: 'ABKAEGCX',
    brandColor: '#0047BA',
    accentColor: '#EAAA00',
    category: 'commercial',
    categoryAr: 'تجاري خاص',
    categoryEn: 'Commercial Bank',
    hotline: '19322',
    website: 'https://www.abkegypt.com',
    foundedYear: 2016,
    notes: 'عضو مجموعة البنك الأهلي الكويتي'
  },
  {
    id: 18,
    code: 'HDB',
    nameAr: 'بنك التعمير والإسكان',
    nameEn: 'Housing and Development Bank',
    swift: 'HDBKEGCX',
    brandColor: '#0B6E4F',
    accentColor: '#F58220',
    category: 'commercial',
    categoryAr: 'تجاري وعقاري',
    categoryEn: 'Commercial / Housing',
    hotline: '19995',
    website: 'https://www.hdb-egy.com',
    foundedYear: 1979,
    notes: 'رائد التمويل العقاري والخدمات المصرفية الشاملة'
  },
  {
    id: 19,
    code: 'NBK',
    nameAr: 'بنك الكويت الوطني – مصر',
    nameEn: 'National Bank of Kuwait Egypt',
    swift: 'NBKEEGCX',
    brandColor: '#002D62',
    accentColor: '#C59B27',
    category: 'commercial',
    categoryAr: 'تجاري إقليمي / دولي',
    categoryEn: 'Commercial Bank',
    hotline: '19336',
    website: 'https://www.nbk.com/egypt',
    foundedYear: 2007,
    notes: 'فرع مجموعة بنك الكويت الوطني في مصر'
  },
  {
    id: 20,
    code: 'EALB',
    nameAr: 'البنك العقاري المصري العربي',
    nameEn: 'Egyptian Arab Land Bank',
    swift: 'EALBEGCX',
    brandColor: '#005696',
    accentColor: '#C59B27',
    category: 'public',
    categoryAr: 'قطاع عام / عقاري وتجاري',
    categoryEn: 'Public / Real Estate',
    hotline: '19932',
    website: 'https://www.ealbank.com.eg',
    foundedYear: 1880,
    notes: 'من أقدم البنوك المتخصصة في مصر والعالم العربي'
  },
  {
    id: 21,
    code: 'SCB',
    nameAr: 'بنك قناة السويس',
    nameEn: 'Suez Canal Bank',
    swift: 'SUCBEGCX',
    brandColor: '#003865',
    accentColor: '#0096D6',
    category: 'commercial',
    categoryAr: 'تجاري خاص',
    categoryEn: 'Commercial Bank',
    hotline: '19093',
    website: 'https://www.scbank.com.eg',
    foundedYear: 1978,
    notes: 'مؤسسة مصرفية كبرى تخدم المشروعات التنموية والشركات'
  },
  {
    id: 22,
    code: 'UBE',
    nameAr: 'المصرف المتحد',
    nameEn: 'The United Bank',
    swift: 'DEIBEGCX',
    brandColor: '#0A2540',
    accentColor: '#00B4D8',
    category: 'commercial',
    categoryAr: 'تجاري وإسلامي',
    categoryEn: 'Commercial & Islamic',
    hotline: '19200',
    website: 'https://www.theubeg.com',
    foundedYear: 2006,
    notes: 'مملوك للبنك المركزي المصري ويقدم صيرفة تقليدية ومتوافقة مع الشريعة'
  },
  {
    id: 23,
    code: 'AUB',
    nameAr: 'البنك الأهلي المتحد – مصر',
    nameEn: 'Ahli United Bank Egypt',
    swift: 'AUBEEGCX',
    brandColor: '#002B49',
    accentColor: '#9C824A',
    category: 'commercial',
    categoryAr: 'تجاري خاص',
    categoryEn: 'Commercial Bank',
    hotline: '19072',
    website: 'https://www.ahliunited.com/eg',
    foundedYear: 2006,
    notes: 'عضو مجموعة بيت التمويل الكويتي (KFH)'
  },
  {
    id: 24,
    code: 'HSBC',
    nameAr: 'إتش إس بي سي مصر',
    nameEn: 'HSBC Bank Egypt',
    swift: 'EBBKEGCX',
    brandColor: '#DB0011',
    accentColor: '#FFFFFF',
    category: 'international',
    categoryAr: 'بنك دولي متعدد الجنسيات',
    categoryEn: 'International Bank',
    hotline: '19007',
    website: 'https://www.hsbc.com.eg',
    foundedYear: 1982,
    notes: 'أحد أكبر البنوك الدولية العاملة في مصر'
  },
  {
    id: 25,
    code: 'ADCB',
    nameAr: 'بنك أبوظبي التجاري – مصر',
    nameEn: 'Abu Dhabi Commercial Bank Egypt',
    swift: 'ADCBEGCX',
    brandColor: '#E01E2B',
    accentColor: '#1E232B',
    category: 'commercial',
    categoryAr: 'تجاري خاص / مجموعة خليجية',
    categoryEn: 'Commercial Bank',
    hotline: '16862',
    website: 'https://www.adcb.com.eg',
    foundedYear: 2020,
    notes: 'عضو مجموعة بنك أبوظبي التجاري الرائدة'
  },
  {
    id: 26,
    code: 'FAB',
    nameAr: 'بنك أبوظبي الأول مصر',
    nameEn: 'First Abu Dhabi Bank Misr',
    swift: 'NBAD EGCX',
    brandColor: '#00205B',
    accentColor: '#E31B23',
    category: 'commercial',
    categoryAr: 'تجاري خاص / دولي (FABMisr)',
    categoryEn: 'Commercial Bank (FABMISR)',
    hotline: '19551',
    website: 'https://www.fabmisr.com.eg',
    foundedYear: 2021,
    notes: 'ناتج اندماج بنك أبوظبي الأول وبنك عوده مصر'
  },
  {
    id: 27,
    code: 'CITI',
    nameAr: 'سيتي بنك مصر',
    nameEn: 'Citibank Egypt',
    swift: 'CITE EGCX',
    brandColor: '#003B70',
    accentColor: '#E51937',
    category: 'international',
    categoryAr: 'فرع بنك دولي (أمريكي)',
    categoryEn: 'International Bank (US)',
    hotline: '16644',
    website: 'https://www.citigroup.com',
    foundedYear: 1975,
    notes: 'متخصص في الخدمات المصرفية للشركات الكبرى والمؤسسات المالية'
  },
  {
    id: 28,
    code: 'CAE',
    nameAr: 'بنك كريدي أجريكول مصر',
    nameEn: 'Crédit Agricole Egypt',
    swift: 'AGRIEGCX',
    brandColor: '#007A53',
    accentColor: '#E2001A',
    category: 'commercial',
    categoryAr: 'تجاري خاص (مجموعة كريدي أجريكول فرنسا)',
    categoryEn: 'Commercial (Crédit Agricole)',
    hotline: '19191',
    website: 'https://www.ca-egypt.com',
    foundedYear: 2006,
    notes: 'تابع لواحدة من أضخم المجموعات المصرفية الأوروبية'
  },
  {
    id: 29,
    code: 'MASHREQ',
    nameAr: 'بنك المشرق مصر',
    nameEn: 'Mashreq Bank Egypt',
    swift: 'BOMLEGCX',
    brandColor: '#FF5E00',
    accentColor: '#1A1A1A',
    category: 'commercial',
    categoryAr: 'تجاري خاص / بنك رقمي رائد',
    categoryEn: 'Commercial / Digital',
    hotline: '19677',
    website: 'https://www.mashreq.com/egypt',
    foundedYear: 1977,
    notes: 'رائد في الابتكار والخدمات المصرفية الرقمية'
  },
  {
    id: 30,
    code: 'ENBD',
    nameAr: 'بنك الإمارات دبي الوطني مصر',
    nameEn: 'Emirates NBD Egypt',
    swift: 'EBILEGCX',
    brandColor: '#0B2265',
    accentColor: '#7DBA00',
    category: 'commercial',
    categoryAr: 'تجاري إقليمي كبير',
    categoryEn: 'Commercial Bank',
    hotline: '16664',
    website: 'https://www.emiratesnbd.com.eg',
    foundedYear: 2013,
    notes: 'عضو مجموعة الإمارات دبي الوطني الرائدة إقليمياً'
  },
  {
    id: 31,
    code: 'NXT',
    nameAr: 'بنك نكست',
    nameEn: 'Bank NXT',
    swift: '—',
    brandColor: '#6C2BD9',
    accentColor: '#00E5FF',
    category: 'commercial',
    categoryAr: 'تجاري حديث (بنك الاستثمار العربي سابقاً)',
    categoryEn: 'Commercial (Formerly aiBANK)',
    hotline: '16697',
    website: 'https://www.banknxt.com',
    foundedYear: 1974,
    notes: 'الهوية الحديثة لبنك الاستثمار العربي بعد الاستحواذ والتطوير'
  },
  {
    id: 32,
    code: 'ABC',
    nameAr: 'بنك المؤسسة العربية المصرفية',
    nameEn: 'Arab Banking Corporation',
    swift: 'ABCEEGCX',
    brandColor: '#003366',
    accentColor: '#A62923',
    category: 'commercial',
    categoryAr: 'تجاري إقليمي (Bank ABC Egypt)',
    categoryEn: 'Commercial Bank',
    hotline: '19123',
    website: 'https://www.bank-abc.com/ar/Egypt',
    foundedYear: 1982,
    notes: 'معروف تجارياً باسم Bank ABC Egypt بعد دمجه مع بلوم مصر'
  },
  {
    id: 33,
    code: 'MIDB',
    nameAr: 'ميدبنك',
    nameEn: 'MIDBANK',
    swift: 'MIDBEGCX',
    brandColor: '#1C1C1C',
    accentColor: '#A3E635',
    category: 'commercial',
    categoryAr: 'تجاري شامل (مصر إيران سابقاً)',
    categoryEn: 'Commercial Bank',
    hotline: '19182',
    website: 'https://www.midbank.com.eg',
    foundedYear: 1975,
    notes: 'الهوية الجديدة لبنك مصر إيران للتنمية تحت شعار نعمل لمستقبلك'
  },
  {
    id: 34,
    code: 'IDB',
    nameAr: 'بنك التنمية الصناعية',
    nameEn: 'Industrial Development Bank',
    swift: 'IDBIEGCX',
    brandColor: '#00529B',
    accentColor: '#E65100',
    category: 'public',
    categoryAr: 'تنموي وتجاري',
    categoryEn: 'Industrial Development',
    hotline: '19374',
    website: 'https://www.idb.com.eg',
    foundedYear: 1947,
    notes: 'رائد تمويل المشروعات الصناعية والشركات الصغيرة والمتوسطة'
  },
  {
    id: 35,
    code: 'ABE',
    nameAr: 'البنك الزراعي المصري',
    nameEn: 'Agricultural Bank of Egypt',
    swift: 'ABEGEGCX',
    brandColor: '#2E7D32',
    accentColor: '#DAA520',
    category: 'public',
    categoryAr: 'قطاع عام / زراعي وتجاري',
    categoryEn: 'Agricultural / Public',
    hotline: '19080',
    website: 'https://www.abe.com.eg',
    foundedYear: 1930,
    notes: 'أوسع البنوك انتشاراً في الريف والمحافظات المصرية لدعم التنمية الزراعية'
  }
];

/**
 * Bank Logo Visual Badges Component (High resolution SVG vectors with official brand tokens)
 */
export const BankLogoBadge: React.FC<{ bank: EgyptianBank; size?: 'sm' | 'md' | 'lg' }> = ({
  bank,
  size = 'md'
}) => {
  const dims = {
    sm: 'w-8 h-8 text-[9px]',
    md: 'w-11 h-11 text-xs',
    lg: 'w-14 h-14 text-sm'
  }[size];

  // Unique recognizable visual icon per bank
  const renderIcon = () => {
    switch (bank.code) {
      case 'NBE':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#008244" />
            <circle cx="18" cy="18" r="11" stroke="#DAA520" strokeWidth="2.2" />
            <path d="M12 18h12M18 12v12" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="18" cy="18" r="3.5" fill="#DAA520" />
          </svg>
        );
      case 'BM':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#9B2735" />
            <circle cx="18" cy="18" r="10" stroke="#D4AF37" strokeWidth="2" />
            <path d="M13 14l5-4 5 4v9h-10v-9z" fill="#D4AF37" />
            <circle cx="18" cy="14" r="2" fill="#9B2735" />
          </svg>
        );
      case 'CIB':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#004B87" />
            <path d="M9 18a9 9 0 0 1 9-9" stroke="#F58220" strokeWidth="3.5" strokeLinecap="round" />
            <text x="18" y="23" fill="#FFFFFF" fontSize="9.5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">CIB</text>
          </svg>
        );
      case 'BDC':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#005A9C" />
            <polygon points="18,8 28,26 8,26" fill="#E6A100" opacity="0.95" />
            <polygon points="18,14 24,25 12,25" fill="#005A9C" />
          </svg>
        );
      case 'BOA':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#E30613" />
            <rect x="8" y="15" width="20" height="6" rx="2" fill="#FFFFFF" />
            <rect x="15" y="8" width="6" height="20" rx="2" fill="#FFFFFF" />
          </svg>
        );
      case 'QNB':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#800020" />
            <circle cx="18" cy="18" r="10" stroke="#FFFFFF" strokeWidth="2.5" />
            <text x="18" y="22" fill="#FFFFFF" fontSize="8.5" fontWeight="900" textAnchor="middle">QNB</text>
          </svg>
        );
      case 'HSBC':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#FFFFFF" stroke="#E2E8F0" />
            <rect x="12" y="12" width="12" height="12" fill="#DB0011" />
            <polygon points="6,18 12,12 12,24" fill="#DB0011" />
            <polygon points="30,18 24,12 24,24" fill="#DB0011" />
            <polygon points="18,6 12,12 24,12" fill="#FFFFFF" stroke="#DB0011" />
            <polygon points="18,30 12,24 24,24" fill="#FFFFFF" stroke="#DB0011" />
          </svg>
        );
      case 'ADIB':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#008A90" />
            <path d="M10 24C10 14 18 10 26 10" stroke="#C59B27" strokeWidth="3" strokeLinecap="round" />
            <path d="M10 26C16 26 22 22 26 16" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );
      case 'FIBE':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#0A6836" />
            <circle cx="18" cy="18" r="10" stroke="#C89D3C" strokeWidth="2" />
            <path d="M14 18a6 6 0 1 0 8 0" stroke="#C89D3C" strokeWidth="2" fill="none" />
            <circle cx="18" cy="13" r="1.5" fill="#C89D3C" />
          </svg>
        );
      case 'NXT':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#6C2BD9" />
            <path d="M10 12l8 12 8-12" stroke="#00E5FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'AAIB':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#A37B35" />
            <circle cx="18" cy="18" r="11" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x="18" y="22" fill="#FFFFFF" fontSize="8" fontWeight="900" textAnchor="middle">AAIB</text>
          </svg>
        );
      case 'FAB':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#00205B" />
            <path d="M10 24L18 10l8 14" stroke="#E31B23" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="13" y1="20" x2="23" y2="20" stroke="#FFFFFF" strokeWidth="2" />
          </svg>
        );
      case 'MASHREQ':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#FF5E00" />
            <circle cx="18" cy="18" r="8" fill="#FFFFFF" />
            <circle cx="18" cy="18" r="5" fill="#FF5E00" />
          </svg>
        );
      case 'ENBD':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#0B2265" />
            <path d="M10 18h16M20 12l6 6-6 6" stroke="#7DBA00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'CITI':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#003B70" />
            <path d="M11 13c4-4 10-4 14 0" stroke="#E51937" strokeWidth="2.5" strokeLinecap="round" />
            <text x="18" y="24" fill="#FFFFFF" fontSize="9" fontWeight="900" textAnchor="middle">citi</text>
          </svg>
        );
      case 'CAE':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#007A53" />
            <path d="M12 24l6-12 6 12" stroke="#E2001A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="18" cy="12" r="2.5" fill="#FFFFFF" />
          </svg>
        );
      case 'EBE':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#0072CE" />
            <text x="18" y="23" fill="#FFB81C" fontSize="9" fontWeight="900" textAnchor="middle">EBank</text>
          </svg>
        );
      case 'ABE':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#2E7D32" />
            <path d="M18 10v16M14 14c2 0 4-2 4-2s2 2 4 2M14 20c2 0 4-2 4-2s2 2 4 2" stroke="#DAA520" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case 'HDB':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full" fill="none">
            <rect width="36" height="36" rx="8" fill="#0B6E4F" />
            <polygon points="18,10 26,24 10,24" stroke="#F58220" strokeWidth="2" fill="none" />
            <rect x="15" y="18" width="6" height="6" fill="#F58220" />
          </svg>
        );
      default:
        return (
          <div 
            className="w-full h-full rounded-lg flex flex-col items-center justify-center font-black tracking-tighter"
            style={{ backgroundColor: bank.brandColor, color: '#FFFFFF' }}
          >
            <span className="leading-none text-[10px] uppercase font-mono">{bank.code.slice(0, 4)}</span>
          </div>
        );
    }
  };

  return (
    <div 
      className={`${dims} rounded-xl shrink-0 flex items-center justify-center shadow-sm overflow-hidden border transition-transform hover:scale-105`}
      style={{ borderColor: `${bank.brandColor}40`, backgroundColor: `${bank.brandColor}10` }}
      title={`${bank.nameAr} (${bank.code})`}
    >
      {renderIcon()}
    </div>
  );
};
