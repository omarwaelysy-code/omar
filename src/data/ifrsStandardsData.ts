// IFRS Complete Practical Guide — 2026 Master Dataset
// Official Authoritative Sources: IFRS Foundation, International Accounting Standards Board (IASB),
// and International Sustainability Standards Board (ISSB).

export interface IfrsJournalEntryLine {
  accountAr: string;
  accountEn: string;
  debit?: string | number;
  credit?: string | number;
  notesAr: string;
  notesEn: string;
}

export interface IfrsStandardItem {
  code: string;
  family: 'IAS' | 'IFRS' | 'ISSB' | 'IFRIC';
  titleAr: string;
  titleEn: string;
  category: 
    | 'presentation' 
    | 'assets' 
    | 'liabilities_equity' 
    | 'revenue' 
    | 'financial_instruments' 
    | 'group' 
    | 'specialized' 
    | 'sustainability';
  effectiveDate: string;
  status: 'active' | 'new_2026' | 'amended';
  is2026Highlight?: boolean;
  officialSource: string;
  officialLink: string;
  
  // 1. Overview & Scope
  objectiveAr: string;
  objectiveEn: string;
  scopeAr: string;
  scopeEn: string;

  // 2. Recognition & Measurement
  recognitionAr: string;
  recognitionEn: string;
  measurementInitialAr: string;
  measurementInitialEn: string;
  measurementSubsequentAr: string;
  measurementSubsequentEn: string;

  // 3. ERP & Practical Business Workflow
  erpImplementationAr: string;
  erpImplementationEn: string;
  erpModules: string[];

  // 4. Practical Numerical Example
  numericalExample: {
    titleAr: string;
    titleEn: string;
    scenarioAr: string;
    scenarioEn: string;
    calculationAr: string;
    calculationEn: string;
  };

  // 5. Accounting Journal Entries
  journalEntries: IfrsJournalEntryLine[];

  // 6. Disclosure Checklist
  disclosuresAr: string[];
  disclosuresEn: string[];

  // 7. Pitfalls & IASB 2026 Insights
  commonPitfallsAr: string[];
  commonPitfallsEn: string[];
}

export const IFRS_CATEGORIES = [
  { id: 'all', nameAr: 'جميع المعايير', nameEn: 'All Standards' },
  { id: 'presentation', nameAr: 'العرض والقوائم المالية', nameEn: 'Presentation & Disclosure' },
  { id: 'assets', nameAr: 'الأصول والتقييم والإهلاك', nameEn: 'Assets & Depreciation' },
  { id: 'revenue', nameAr: 'الإيرادات والعقود', nameEn: 'Revenue & Contracts' },
  { id: 'financial_instruments', nameAr: 'الأدوات المالية والتمويل', nameEn: 'Financial Instruments' },
  { id: 'liabilities_equity', nameAr: 'الالتزامات وحقوق الملكية', nameEn: 'Liabilities & Equity' },
  { id: 'group', nameAr: 'القوائم الموحدة والشركات التابعة', nameEn: 'Consolidation & Group' },
  { id: 'specialized', nameAr: 'المجالات المتخصصة', nameEn: 'Specialized Standards' },
  { id: 'sustainability', nameAr: 'معايير الاستدامة (ISSB)', nameEn: 'Sustainability (ISSB)' }
];

export const IFRS_STANDARDS_DATA: IfrsStandardItem[] = [
  // ==========================================
  // IFRS 18 — NEW / 2026/2027 MILESTONE
  // ==========================================
  {
    code: 'IFRS 18',
    family: 'IFRS',
    titleAr: 'العرض والإفصاح في القوائم المالية (بديل معيار المحاسبة الدولي IAS 1)',
    titleEn: 'Presentation and Disclosure in Financial Statements',
    category: 'presentation',
    effectiveDate: '01/01/2027 (التطبيق المبكر متاح وموصى به لعام 2026)',
    status: 'new_2026',
    is2026Highlight: true,
    officialSource: 'IFRS Foundation / IASB (Issued April 2024, Mandatory 2027)',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-18-presentation-and-disclosure-in-financial-statements/',
    objectiveAr: 'إعادة هيكلة شاملة لقائمة الأرباح أو الخسائر بتحديد فئات إلزامية محددة للدخل والمصروفات، وإلزام الشركات بالإفصاح عن مقاييس الأداء المحددة من الإدارة (MPMs).',
    objectiveEn: 'Comprehensive overhaul of statement of profit or loss by introducing defined categories for income and expenses, and requiring disclosure of Management-defined Performance Measures (MPMs).',
    scopeAr: 'ينطبق على جميع المنشآت التي تعد قوائم مالية وفقاً لمعايير التقرير المالي الدولية، ويحل محل معيار المحاسبة الدولي IAS 1.',
    scopeEn: 'Applies to all entities preparing financial statements under IFRS Accounting Standards, superseding IAS 1.',
    recognitionAr: 'يتطلب تصنيف كافة الإيرادات والمصروفات داخل قائمة الدخل في ثلاث فئات إلزامية رئيسية: تشغيلية (Operating)، استثمارية (Investing)، وتمويلية (Financing).',
    recognitionEn: 'Requires all income and expenses in the income statement to be classified into three distinct categories: Operating, Investing, and Financing.',
    measurementInitialAr: 'يفرض عرض مجاميع فرعية إلزامية جديدة: الربح التشغيلي (Operating Profit)، والربح قبل التمويل وضريبة الدخل.',
    measurementInitialEn: 'Mandates specific subtotals: Operating profit, and Profit before financing and income taxes.',
    measurementSubsequentAr: 'الإفصاح في إيضاح منفصل وموحد عن أي مقاييس أداء إدارية (MPMs) تستخدمها الإدارة خارج القوائم مع تسويتها مع أقرب رقم IFRS.',
    measurementSubsequentEn: 'Requires a single, dedicated note disclosing all Management-defined Performance Measures (MPMs) with full reconciliations to the nearest IFRS subtotal.',
    erpImplementationAr: 'تحديث شجرة الحسابات (COA) وإعادة ربط بنود المصروفات والإيرادات بالفئات الثلاث (تشغيلي، استثماري، تمويلي) لإنتاج قائمة الدخل التلقائية وفق IFRS 18.',
    erpImplementationEn: 'Update Chart of Accounts (COA) mapping to assign revenue and expense accounts into Operating, Investing, and Financing categories for automated compliant reporting.',
    erpModules: ['chart_of_accounts', 'journal_entries', 'income_statement'],
    numericalExample: {
      titleAr: 'تصنيف بنود قائمة الدخل وإظهار الربح التشغيلي',
      titleEn: 'Statement of Profit or Loss Classification under IFRS 18',
      scenarioAr: 'شركة حققت مبيعات 2,000,000 ج.م، تكلفة مبيعات 1,200,000 ج.م، مصروفات تشغيلية 300,000 ج.م، دخل توزيعات أرباح من استثمارات 50,000 ج.م، وفوائد قروض 80,000 ج.م.',
      scenarioEn: 'Company reported Sales of 2,000,000 EGP, Cost of Sales of 1,200,000 EGP, Operating Expenses of 300,000 EGP, Dividend Income from investments of 50,000 EGP, and Interest Expense of 80,000 EGP.',
      calculationAr: 'الربح التشغيلي = 2,000,000 - 1,200,000 - 300,000 = 500,000 ج.م. فئة الاستثمار = +50,000 ج.م. فئة التمويل = -80,000 ج.م. الربح قبل الضريبة = 470,000 ج.م.',
      calculationEn: 'Operating Profit = 2,000,000 - 1,200,000 - 300,000 = 500,000 EGP. Investing Category = +50,000 EGP. Financing Category = -80,000 EGP. Profit Before Tax = 470,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ تكلفة المبيعات (فئة تشغيلية)',
        accountEn: 'Cost of Goods Sold (Operating Category)',
        debit: '1,200,000',
        credit: '-',
        notesAr: 'تصنيف تشغيلي إلزامي للوصول للربح التشغيلي',
        notesEn: 'Mandatory operating category'
      },
      {
        accountAr: 'حـ/ المخزون',
        accountEn: 'Inventories',
        debit: '-',
        credit: '1,200,000',
        notesAr: 'صرف تكلفة البضاعة المباعة',
        notesEn: 'Inventory issue credit'
      },
      {
        accountAr: 'حـ/ مصروف الفوائد التمويلية (فئة التمويل)',
        accountEn: 'Finance Costs (Financing Category)',
        debit: '80,000',
        credit: '-',
        notesAr: 'يُعرض بعد الربح التشغيلي وتحت بند التمويل',
        notesEn: 'Presented after Operating Profit under Financing'
      },
      {
        accountAr: 'حـ/ فوائد مستحقة الدفع',
        accountEn: 'Interest Payable',
        debit: '-',
        credit: '80,000',
        notesAr: 'إثبات التزام الفائدة التمويلية',
        notesEn: 'Accrued financing liability'
      }
    ],
    disclosuresAr: [
      'تسوية كاملة لجميع مقاييس الأداء المحددة من الإدارة (MPMs) مع البنود الإلزامية في IFRS.',
      'الإفصاح عن تصنيف المصروفات التشغيلية حسب طبيعتها أو حسب وظيفتها مع تقديم تفاصيل الأجور والإهلاك.',
      'بيان مبالغ الإيرادات والمصروفات غير العادية أو المنفردة وتأثيرها على الأداء المستمر.'
    ],
    disclosuresEn: [
      'Full reconciliation of Management-defined Performance Measures (MPMs) to corresponding IFRS subtotals.',
      'Disclose operating expenses either by nature or by function with mandatory granular details on employee benefits and depreciation.',
      'Explanation of items categorized in investing and financing categories.'
    ],
    commonPitfallsAr: [
      'الخلط بين فوائد القروض التشغيلية وعرضها ضمن النشاط التشغيلي، حيث يتطلب IFRS 18 فصلها الصارم تحت فئة التمويل.',
      'إغفال الإفصاح عن مقاييس الأداء غير المتوافقة مع المعايير (مثل Adjusted EBITDA) دون تقديم تسوية مدققة.'
    ],
    commonPitfallsEn: [
      'Mixing interest expense into operating expenses; IFRS 18 strictly mandates separating financing costs.',
      'Omitting audited reconciliations for non-IFRS performance metrics used in investor presentations.'
    ]
  },

  // ==========================================
  // IFRS 15 — REVENUE FROM CONTRACTS WITH CUSTOMERS
  // ==========================================
  {
    code: 'IFRS 15',
    family: 'IFRS',
    titleAr: 'الإيراد من العقود مع العملاء (النموذج الخماسي)',
    titleEn: 'Revenue from Contracts with Customers (5-Step Model)',
    category: 'revenue',
    effectiveDate: '01/01/2018 (محدث بالتفسيرات المستمرة 2026)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/',
    objectiveAr: 'وضع إطار شامل ومتكامل للاعتراف بالإيراد يصور انتقال السلع أو الخدمات الموعودة للعملاء بمبلغ يعكس العوض المستحق للمنشأة.',
    objectiveEn: 'Establish a comprehensive framework for recognizing revenue to depict the transfer of promised goods or services to customers at an amount reflecting expected consideration.',
    scopeAr: 'يطبق على كافة العقود مع العملاء باستثناء عقود الإيجار (IFRS 16)، عقود التأمين (IFRS 17)، والأدوات المالية (IFRS 9).',
    scopeEn: 'Applies to all contracts with customers except leases (IFRS 16), insurance contracts (IFRS 17), and financial instruments (IFRS 9).',
    recognitionAr: 'الاعتراف عبر 5 خطوات: 1. تحديد العقد، 2. تحديد التزامات الأداء المنفصلة، 3. تحديد سعر المعاملة، 4. تخصيص السعر على التزامات الأداء بنسبة السعر المنفرد، 5. الاعتراف عند الوفاء بالتزام الأداء.',
    recognitionEn: 'Recognized via 5-step model: 1. Identify contract, 2. Identify performance obligations, 3. Determine transaction price, 4. Allocate transaction price, 5. Recognize revenue when obligation satisfied.',
    measurementInitialAr: 'يقاس الإيراد بسعر المعاملة الصافي المستحق (مع استبعاد المبالغ المحصلة نيابة عن أطراف ثالثة مثل ضريبة القيمة المضافة)، وأخذ العوض المتغير بعين الاعتبار.',
    measurementInitialEn: 'Measured at the transaction price allocated to the satisfied obligation, excluding third-party collections (e.g. VAT), taking variable consideration into account.',
    measurementSubsequentAr: 'تعديل سعر المعاملة عند وجود حسومات أو مردودات محتملة مع تطبيق قيد الحد من تقديرات العوض المتغير (Constraint on Variable Consideration).',
    measurementSubsequentEn: 'Adjust transaction price for volume rebates, discounts, or return rights with constraints against revenue reversal.',
    erpImplementationAr: 'ربط فواتير المبيعات والعقود المؤجلة بحسابات "التزامات العقود / إيرادات مؤجلة" وحسابات "أصول العقود / إيرادات مستحقة"، والاعتراف التلقائي مع تسليم البضاعة أو نسبة الإنجاز.',
    erpImplementationEn: 'Configure sales orders and milestone contracts to generate Contract Liabilities (Unearned Revenue) and Contract Assets, releasing to Revenue upon fulfillment.',
    erpModules: ['invoices', 'sales_orders', 'customers', 'receipts'],
    numericalExample: {
      titleAr: 'بيع أجهزة مع خدمة صيانة مجانية لمدة سنتين',
      titleEn: 'Bundled Sale: Hardware + 2-Year Maintenance Service',
      scenarioAr: 'باعت المنشأة خادم حاسوبي مع صيانة لسنتين بقيمة إجمالية 120,000 ج.م نقداً. السعر المنفرد للخادم 100,000 ج.م، والسعر المنفرد للصيانة 50,000 ج.م.',
      scenarioEn: 'Company sells a server bundled with 2-year maintenance for a total price of 120,000 EGP cash. Standalone prices: Server 100,000 EGP, Maintenance 50,000 EGP.',
      calculationAr: 'إجمالي الأسعار المنفردة = 150,000 ج.م. نسبة الخادم = 66.67% ← حصة الخادم = 80,000 ج.م (يُعترف به فوراً). حصة الصيانة = 33.33% ← 40,000 ج.م (تُقيد التزام عقد وتُستهلك على 24 شهراً بواقع 1,666.67 ج.م شهرياً).',
      calculationEn: 'Total standalone prices = 150,000 EGP. Server allocation = 100k/150k = 80,000 EGP (immediate revenue). Maintenance allocation = 50k/150k = 40,000 EGP (Contract Liability deferred over 24 months).'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ الصندوق / البنك',
        accountEn: 'Cash / Bank',
        debit: '120,000',
        credit: '-',
        notesAr: 'استلام كامل قيمة العقد المجمع من العميل',
        notesEn: 'Total cash received from customer'
      },
      {
        accountAr: 'حـ/ إيراد مبيعات الأجهزة (فور التسليم)',
        accountEn: 'Hardware Revenue (Point in time)',
        debit: '-',
        credit: '80,000',
        notesAr: 'اعتراف فوري بالوفاء بتسليم الخادم للعميل',
        notesEn: 'Recognized at point in time upon server delivery'
      },
      {
        accountAr: 'حـ/ التزامات العقود (إيراد صيانة مؤجل)',
        accountEn: 'Contract Liabilities (Deferred Maintenance)',
        debit: '-',
        credit: '40,000',
        notesAr: 'التزام أداء يُعترف به على مدى فترة الصيانة (Over time)',
        notesEn: 'Performance obligation satisfied over 24 months'
      }
    ],
    disclosuresAr: [
      'تفكيك الإيرادات حسب الفئات الرئيسية (خطوط الإنتاج، المناطق الجغرافية، توقيت التحويل).',
      'أرصدة بداية ونهاية الفترة لأصول العقود والتزامات العقود والذمم المدينة التجارية.',
      'الأحكام والتقديرات الجوهرية المتبعة في تحديد الأسعار المنفردة وتوقيت استيفاء التزامات الأداء.'
    ],
    disclosuresEn: [
      'Disaggregation of revenue into categories depicting timing and economic nature.',
      'Opening and closing balances of contract assets, contract liabilities, and receivables.',
      'Significant judgements in allocating transaction price and determining timing of satisfaction.'
    ],
    commonPitfallsAr: [
      'الاعتراف بكامل مبلغ العقد كإيراد فوري في تاريخ الفاتورة رغم اشتماله على خدمات مستقبلية غير مؤداة.',
      'تجاهل تأثير حق الارتجاع أو الخصومات الحجمية المشروطة في تقدير سعر المعاملة الأولي.'
    ],
    commonPitfallsEn: [
      'Recognizing total contract consideration immediately upon invoicing when future services remain unperformed.',
      'Failing to estimate and constrain variable consideration such as retrospective volume rebates.'
    ]
  },

  // ==========================================
  // IFRS 16 — LEASES
  // ==========================================
  {
    code: 'IFRS 16',
    family: 'IFRS',
    titleAr: 'عقود الإيجار (نموذج أصل حق الاستخدام والتزام الإيجار)',
    titleEn: 'Leases (Right-of-Use Asset & Lease Liability Model)',
    category: 'liabilities_equity',
    effectiveDate: '01/01/2019 (محدث بتعديلات بيع وإعادة استئجار 2024/2026)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-16-leases/',
    objectiveAr: 'إلغاء التمييز بين الإيجار التشغيلي والتمويلي لدى المستأجر، وإلزام المستأجرين بإثبات جميع عقود الإيجار داخل الميزانية العمومية كأصل حق استخدام والتزام إيجار.',
    objectiveEn: 'Eliminate classification of operating vs finance leases for lessees; mandate on-balance-sheet recognition of Right-of-Use (ROU) assets and lease liabilities for virtually all leases.',
    scopeAr: 'ينطبق على جميع عقود الإيجار بما في ذلك عقود الأصول المؤجرة، مع إعفاءات اختيارية لعقود الإيجار قصيرة الأجل (أقل من 12 شهراً) وعقود الأصول منخفضة القيمة.',
    scopeEn: 'Applies to all lease contracts with optional practical expedients for short-term leases (<= 12 months) and low-value assets.',
    recognitionAr: 'يثبت المستأجر في تاريخ البدء: أصل حق استخدام (ROU Asset) والتزام عقد إيجار (Lease Liability) محسوباً بالقيمة الحالية للمدفوعات المستقبلية.',
    recognitionEn: 'Lessee recognizes a Right-of-Use (ROU) asset and a Lease Liability measured at the present value of future lease payments at commencement date.',
    measurementInitialAr: 'التزام الإيجار = القيمة الحالية للدفعات الإيجارية مخصومة بمعدل الفائدة الضمني أو معدل الاقتراض الإضافي للمستأجر (IBR). أصل حق الاستخدام = التزام الإيجار + الدفعات المقدمة + تكاليف مباشرة أولية + تكاليف التفكيك.',
    measurementInitialEn: 'Lease liability = PV of future lease payments discounted at incremental borrowing rate (IBR). ROU Asset = Lease Liability + Initial direct costs + prepayments + restoration estimates.',
    measurementSubsequentAr: 'يُستهلك أصل حق الاستخدام بطريقة القسط الثابت، ويُزاد التزام الإيجار بمصروف الفائدة ويُنقص بالدفعات المسددة.',
    measurementSubsequentEn: 'Depreciate ROU asset over lease term or useful life; accrue interest expense on lease liability and reduce by lease payments made.',
    erpImplementationAr: 'إدراج أصل حق الاستخدام في وحدة الأصول الثابتة وحساب إهلاكه شهرياً، وجدولة التزام الإيجار في الحسابات الدائنة مع فصل مصروف الفائدة عن القسط المسدد.',
    erpImplementationEn: 'Integrate ROU asset into Fixed Assets register with monthly depreciation run; schedule lease amortization splitting interest expense from liability principal reduction.',
    erpModules: ['fixed_assets', 'journal_entries', 'payment_vouchers', 'accounts'],
    numericalExample: {
      titleAr: 'استئجار مبنى إداري لمدة 3 سنوات',
      titleEn: 'Lease of Administrative Building for 3 Years',
      scenarioAr: 'استأجرت المنشأة مبنى إداري بقسط سنوي 200,000 ج.م يدفع في نهاية كل سنة لمدة 3 سنوات. معدل الاقتراض الإضافي للمستأجر (IBR) هو 10% سنوياً.',
      scenarioEn: 'Entity leases headquarters for 3 years at 200,000 EGP payable annually in arrears. Incremental borrowing rate = 10%.',
      calculationAr: 'معامل القيمة الحالية لدفعات متساوية (3 سنوات، 10%) = 2.48685 ← القيمة الحالية = 200,000 × 2.48685 = 497,370 ج.م. إهلاك الأصل السنوي = 497,370 ÷ 3 = 165,790 ج.م. فائدة السنة الأولى = 497,370 × 10% = 49,737 ج.م.',
      calculationEn: 'PV of lease payments = 200,000 x 2.48685 = 497,370 EGP. Annual ROU depreciation = 497,370 / 3 = 165,790 EGP. Year 1 interest expense = 497,370 x 10% = 49,737 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ أصل حق الاستخدام - مباني (ROU)',
        accountEn: 'Right-of-Use Asset - Buildings',
        debit: '497,370',
        credit: '-',
        notesAr: 'إثبات أصل حق الاستخدام بالقيمة الحالية للدفعات',
        notesEn: 'Initial recognition of ROU Asset at commencement'
      },
      {
        accountAr: 'حـ/ التزامات عقود الإيجار (طويلة وقصيرة الأجل)',
        accountEn: 'Lease Liabilities (Current & Non-Current)',
        debit: '-',
        credit: '497,370',
        notesAr: 'إثبات التزام الإيجار المخصوم بمعدل الفائدة',
        notesEn: 'Initial PV of future lease obligations'
      },
      {
        accountAr: 'حـ/ مصروف فائدة عقد الإيجار (السنة الأولى)',
        accountEn: 'Finance Cost - Lease Interest Expense',
        debit: '49,737',
        credit: '-',
        notesAr: 'فائدة السنة الأولى محسوبة بمعدل 10%',
        notesEn: 'Year 1 unwinding of interest at 10%'
      },
      {
        accountAr: 'حـ/ التزامات عقود الإيجار (سداد أصل الالتزام)',
        accountEn: 'Lease Liabilities (Principal Reduction)',
        debit: '150,263',
        credit: '-',
        notesAr: 'تخفيض التزام الإيجار بصافي السداد (200,000 - 49,737)',
        notesEn: 'Reduction of lease liability principal'
      },
      {
        accountAr: 'حـ/ البنك / حساب السداد',
        accountEn: 'Bank Account',
        debit: '-',
        credit: '200,000',
        notesAr: 'سداد القسط الإيجاري السنوي الأول',
        notesEn: 'Annual cash lease payment'
      }
    ],
    disclosuresAr: [
      'جدول تحليلي لأعمار التزامات عقود الإيجار (أقل من سنة، من 1 إلى 5 سنوات، أكثر من 5 سنوات).',
      'إجمالي مبالغ إهلاك أصل حق الاستخدام حسب فئة الأصل ومصروفات الفائدة المنفصلة.',
      'المصروفات المتعلقة بعقود الإيجار قصيرة الأجل وعقود الأصول منخفضة القيمة المعفاة.'
    ],
    disclosuresEn: [
      'Maturity analysis of undiscounted lease commitments (<=1 yr, 1-5 yrs, >5 yrs).',
      'Depreciation charge for ROU assets by class of underlying asset and total finance costs.',
      'Expense relating to short-term and low-value leases exempted from capitalization.'
    ],
    commonPitfallsAr: [
      'تسجيل الإيجار كمصروف إيجار تشغيلي تقليدي في قائمة الدخل دون رسملة أصل حق الاستخدام والتزام الإيجار.',
      'استخدام معدل خصم غير موثق أو إغفال فترات التجديد المعقولة التأكيد في حساب مدة العقد.'
    ],
    commonPitfallsEn: [
      'Treating long-term facility leases as simple operating rent expense, bypassing balance sheet capitalization.',
      'Ignoring reasonably certain extension options when calculating total lease term.'
    ]
  },

  // ==========================================
  // IFRS 9 — FINANCIAL INSTRUMENTS
  // ==========================================
  {
    code: 'IFRS 9',
    family: 'IFRS',
    titleAr: 'الأدوات المالية (التصنيف، والقياس، ونموذج الخسائر الائتمانية المتوقعة ECL)',
    titleEn: 'Financial Instruments (Classification, Measurement & Expected Credit Loss ECL)',
    category: 'financial_instruments',
    effectiveDate: '01/01/2018 (محدث بإرشادات وتطبيقات 2026)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-9-financial-instruments/',
    objectiveAr: 'وضع أسس إعداد التقارير المالية للأصول والالتزامات المالية، مع تطبيق نموذج الخسائر الائتمانية المتوقعة (ECL) الاستباقي بدلاً من نموذج الخسائر المحققة.',
    objectiveEn: 'Establish principles for financial assets and liabilities, introducing forward-looking Expected Credit Loss (ECL) model over incurred loss model.',
    scopeAr: 'يطبق على جميع الأدوات المالية، بما فيها الذمم المدينة التجارية، أوراق القبض، القروض، الاستثمارات، والالتزامات المالية.',
    scopeEn: 'Applies to all types of financial instruments: trade receivables, notes receivable, debt and equity investments, and financial liabilities.',
    recognitionAr: 'تصنيف الأصول المالية وفق نموذج أعمال المنشأة واختبار خصائص التدفقات النقدية التعاقدية (SPPI): التكلفة المطفأة، القيمة العادلة من خلال الدخل الشامل الآخر (FVOCI)، القيمة العادلة من خلال الأرباح أو الخسائر (FVTPL).',
    recognitionEn: 'Classify financial assets based on Business Model and SPPI test: Amortised Cost, FVOCI, or FVTPL.',
    measurementInitialAr: 'القياس الأولي بالقيمة العادلة مضافاً إليها تكاليف المعاملة (للأصول غير المقاسة بـ FVTPL). الذمم المدينة التجارية تقاس بسعر المعاملة وفق IFRS 15.',
    measurementInitialEn: 'Measured initially at fair value plus transaction costs (unless FVTPL). Trade receivables measured at IFRS 15 transaction price.',
    measurementSubsequentAr: 'تطبيق النموذج المبسط لمخصص الخسائر الائتمانية المتوقعة (Simplified ECL) على الذمم المدينة التجارية باستخدام مصفوفة المخصصات (Provision Matrix) استناداً إلى البيانات التاريخية والتوقعات المستقبلية.',
    measurementSubsequentEn: 'Apply simplified lifetime ECL approach to trade receivables using a provision matrix incorporating historical default rates and macroeconomic forward-looking data.',
    erpImplementationAr: 'بناء مصفوفة أعمار الديون وحساب مخصص خسائر الائتمان المتوقعة آلياً في شاشة العملاء والذمم المدينة، وترحيل قيد مخصص الديون المشكوك فيها دورياً.',
    erpImplementationEn: 'Automate aging buckets and lifetime ECL computation matrix inside Customer Accounts & Receivables module, auto-posting bad debt provision journal entries.',
    erpModules: ['customers', 'customer_balances', 'journal_entries', 'received_cheques'],
    numericalExample: {
      titleAr: 'حساب مخصص الخسائر الائتمانية المتوقعة (ECL) لمصفوفة العملاء',
      titleEn: 'Provision Matrix Lifetime ECL on Trade Receivables',
      scenarioAr: 'شركة لديها ذمم مدينة تجارية بقيمة 1,000,000 ج.م موزعة على فترات تأخير: جارية 600,000 ج (معدل تعثر 1%)، متأخرة 1-30 يوم 250,000 ج (معدل 3%)، متأخرة 31-90 يوم 100,000 ج (معدل 10%)، متأخرة أكثر من 90 يوم 50,000 ج (معدل 30%).',
      scenarioEn: 'Entity has 1,000,000 EGP trade receivables across aging buckets: Current 600k (1%), 1-30 days past due 250k (3%), 31-90 days 100k (10%), >90 days 50k (30%).',
      calculationAr: 'المخصص = (600,000 × 1%) + (250,000 × 3%) + (100,000 × 10%) + (50,000 × 30%) = 6,000 + 7,500 + 10,000 + 15,000 = 38,500 ج.م.',
      calculationEn: 'ECL Provision = (600k x 1%) + (250k x 3%) + (100k x 10%) + (50k x 30%) = 6,000 + 7,500 + 10,000 + 15,000 = 38,500 EGP total allowance.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصروف خسائر ائتمانية متوقعة (قائمة الدخل)',
        accountEn: 'Impairment Loss on Financial Assets (ECL)',
        debit: '38,500',
        credit: '-',
        notesAr: 'تحميل قائمة الدخل بمصروف مخصص الديون المتوقعة',
        notesEn: 'Recognize forward-looking credit loss in P&L'
      },
      {
        accountAr: 'حـ/ مخصص الخسائر الائتمانية المتوقعة (مقابل العملاء)',
        accountEn: 'Allowance for Expected Credit Losses',
        debit: '-',
        credit: '38,500',
        notesAr: 'حساب مقابل للأصول لتخفيض القيمة الدفترية للعملاء',
        notesEn: 'Contra-asset account reducing trade receivables'
      }
    ],
    disclosuresAr: [
      'مصفوفة مخصصات أعمار الديون ومعدلات التعثر المطبقة ومعدل الخسارة عند التعثر.',
      'حركة مخصص الخسائر الائتمانية خلال الفترة (رصيد أول، مضاف، مسترد، إعدامات، رصيد آخر).',
      'سياسات إدارة المخاطر الائتمانية ومخاطر السيولة ومخاطر أسعار الفائدة والعملات.'
    ],
    disclosuresEn: [
      'Provision matrix showing gross carrying amounts, ECL rates, and credit risk exposure.',
      'Reconciliation of opening to closing balance of loss allowance showing additions and write-offs.',
      'Credit risk, liquidity risk, and market risk management policies and stress indicators.'
    ],
    commonPitfallsAr: [
      'الانتظار حتى تعثر العميل الفعلي لتكوين المخصص، وتجاهل المتطلب الإلزامي باحتساب مخصص استباقي للديون الجارية.',
      'عدم تحديث معدلات الخسائر التاريخية بالتوقعات الاقتصادية الكلية الحالية والمستقبلية (Forward-looking).'
    ],
    commonPitfallsEn: [
      'Delaying allowance creation until an actual default occurs, breaching the mandatory forward-looking ECL model.',
      'Failing to adjust historical loss rates with forward-looking macroeconomic conditions.'
    ]
  },

  // ==========================================
  // IAS 16 — PROPERTY, PLANT AND EQUIPMENT (PPE)
  // ==========================================
  {
    code: 'IAS 16',
    family: 'IAS',
    titleAr: 'العقارات والآلات والمعدات (الأصول الثابتة والإهلاك)',
    titleEn: 'Property, Plant and Equipment (PPE & Depreciation)',
    category: 'assets',
    effectiveDate: '01/01/2005 (محدث بتعديلات العائدات قبل الاستخدام المقصود 2022/2026)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-16-property-plant-and-equipment/',
    objectiveAr: 'تحديد المعالجة المحاسبية للعقارات والآلات والمعدات بما يضمن التعرف على استثمار المنشأة في أصولها الثابتة والتغيرات فيها وقواعد إهلاكها.',
    objectiveEn: 'Prescribe the accounting treatment for property, plant and equipment so users can recognize information about an entity’s investment in tangible fixed assets and changes.',
    scopeAr: 'يطبق على جميع الأصول الثابتة الملموسة المحتفظ بها للاستخدام في الإنتاج أو تقديم السلع والخدمات أو التأجير للغير أو للأغراض الإدارية لأكثر من فترة.',
    scopeEn: 'Applies to all tangible fixed assets held for use in production, supply of goods/services, rental to others, or administrative purposes for >1 period.',
    recognitionAr: 'يُعترف بالأصل عندما يكون من المحتمل تدفق منافع اقتصادية مستقبلية منه، ويمكن قياس تكلفته بموثوقية.',
    recognitionEn: 'Recognized as an asset when it is probable future economic benefits will flow to entity and cost can be measured reliably.',
    measurementInitialAr: 'يقاس بالتكلفة الإجمالية: سعر الشراء + الرسوم الجمركية والضرائب غير المستردة + تكاليف النقل والتركيب المباشرة + التقدير الأولي لتكاليف التفكيك والإزالة.',
    measurementInitialEn: 'Measured initially at cost: purchase price + non-refundable import duties/taxes + directly attributable installation/site preparation costs + dismantling provision.',
    measurementSubsequentAr: 'الاختيار بين نموذج التكلفة (التكلفة ناقص مجمع الإهلاك ومجمع الانخفاض) أو نموذج إعادة التقييم (القيمة العادلة مع ترحيل الفائض إلى الدخل الشامل الآخر OCI). مع إهلاك كل جزء جوهري منفصلاً (Component Depreciation).',
    measurementSubsequentEn: 'Choice between Cost Model (Cost less accumulated depreciation & impairment) and Revaluation Model (Fair value with gains to OCI Revaluation Surplus). Component depreciation required.',
    erpImplementationAr: 'إدارة كاملة عبر موديول الأصول الثابتة: تسجيل بطاقة الأصل، حساب الإهلاك الشهري الآلي وفق طرق (القسط الثابت، الرصيد المتناقص، وحدات الإنتاج)، وتسجيل حركات الاستبعاد والإهلاك والتخريد.',
    erpImplementationEn: 'Managed in Fixed Assets module: asset register, barcode/tag tracking, automated monthly depreciation runs, disposals, transfers, and impairment adjustments.',
    erpModules: ['fixed_assets', 'asset_categories', 'asset_depreciation', 'journal_entries'],
    numericalExample: {
      titleAr: 'شراء خط إنتاج وتكاليف تشغيله وتفكيكه وإهلاكه',
      titleEn: 'Acquisition, Installation, Dismantling and Component Depreciation',
      scenarioAr: 'اشترت المنشأة خط إنتاج بسعر 500,000 ج.م، ودفعت تكاليف نقل وتركيب 50,000 ج.م، وقدرت القيمة الحالية لتكلفة إزالة وتفكيك الخط بعد 5 سنوات بمبلغ 20,000 ج.م. القيمة التخريدية المتوقعة 30,000 ج.م. العمر الإنتاجي 5 سنوات.',
      scenarioEn: 'Entity purchased production line for 500,000 EGP, paid 50,000 EGP freight & installation, and estimated dismantling PV at 20,000 EGP. Residual value = 30,000 EGP. Useful life = 5 years.',
      calculationAr: 'التكلفة الإجمالية للأصل = 500,000 + 50,000 + 20,000 = 570,000 ج.م. الوعاء القابل للإهلاك = 570,000 - 30,000 = 540,000 ج.م. الإهلاك السنوي = 540,000 ÷ 5 = 108,000 ج.م (9,000 ج.م شهرياً).',
      calculationEn: 'Total capital cost = 500k + 50k + 20k = 570,000 EGP. Depreciable base = 570,000 - 30,000 = 540,000 EGP. Annual straight-line depreciation = 108,000 EGP (9,000 EGP/month).'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ الآلات والمعدات (الأصول الثابتة)',
        accountEn: 'Property, Plant and Equipment - Machinery',
        debit: '570,000',
        credit: '-',
        notesAr: 'رسملة ثمن الشراء ومصاريف التجهيز ومخصص التفكيك',
        notesEn: 'Capitalize purchase, setup costs, and dismantling asset'
      },
      {
        accountAr: 'حـ/ البنك / الموردين',
        accountEn: 'Bank / Accounts Payable',
        debit: '-',
        credit: '550,000',
        notesAr: 'المبالغ المسددة والمستحقة عن الشراء والتركيب',
        notesEn: 'Cash paid and accrued for acquisition & setup'
      },
      {
        accountAr: 'حـ/ مخصص تكاليف التفكيك وإعادة الموقع (IAS 37)',
        accountEn: 'Provision for Site Restoration / Decommissioning',
        debit: '-',
        credit: '20,000',
        notesAr: 'التزام غير متداول بالقيمة الحالية للتفكيك',
        notesEn: 'PV of decommissioning liability'
      },
      {
        accountAr: 'حـ/ مصروف إهلاك الآلات والمعدات (سنوي)',
        accountEn: 'Depreciation Expense - Machinery',
        debit: '108,000',
        credit: '-',
        notesAr: 'إثبات القسط السنوي لإهلاك الأصل',
        notesEn: 'Annual depreciation charge to P&L'
      },
      {
        accountAr: 'حـ/ مجمع إهلاك الآلات والمعدات',
        accountEn: 'Accumulated Depreciation - Machinery',
        debit: '-',
        credit: '108,000',
        notesAr: 'حساب مقابل للأصول يجمع مبالغ الإهلاك',
        notesEn: 'Contra-asset accumulated depreciation'
      }
    ],
    disclosuresAr: [
      'أسس القياس المستخدمة وطرق الإهلاك والأعمار الإنتاجية أو معدلات الإهلاك المطبقة.',
      'مطابقة كاملة لإجمالي القيمة الدفترية ومجمع الإهلاك في بداية ونهاية الفترة (إضافات، استبعادات، إهلاك، انخفاض).',
      'وجود وقيود الرهونات على الأصول الثابتة الضامنة لالتزامات أو قروض.'
    ],
    disclosuresEn: [
      'Measurement bases, depreciation methods, and useful lives/depreciation rates used.',
      'Full reconciliation of gross carrying amount and accumulated depreciation (additions, disposals, transfers, impairment).',
      'Pledged assets and capital expenditure commitments contracted but not yet recognized.'
    ],
    commonPitfallsAr: [
      'تحميل تكاليف الصيانة الدورية البسيطة على الأصل ورسملتها بالخطأ، بدلاً من إثباتها كمصروف صيانة دوري في قائمة الدخل.',
      'تجاهل إهلاك أجزاء الأصل ذات الأعمار المختلفة بشكل منفصل (مثل محرك الطائرة وجسم الطائرة).'
    ],
    commonPitfallsEn: [
      'Capitalizing routine repairs and operating maintenance instead of expensing in P&L.',
      'Failing to apply component depreciation for significant asset parts with differing useful lives.'
    ]
  },

  // ==========================================
  // IAS 2 — INVENTORIES
  // ==========================================
  {
    code: 'IAS 2',
    family: 'IAS',
    titleAr: 'المخزون (التكلفة وصافي القيمة القابلة للتحقق NRV)',
    titleEn: 'Inventories (Cost vs Net Realizable Value NRV)',
    category: 'assets',
    effectiveDate: '01/01/2005 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/',
    objectiveAr: 'تحديد المعالجة المحاسبية للمخزون، وتحديد مقدار التكلفة التي يتم الاعتراف بها كأصل وترحيلها حتى يتحقق الإيراد المقابل، وأسس القياس بصافي القيمة القابلة للتحقق.',
    objectiveEn: 'Prescribe the accounting treatment for inventories: determination of cost to be recognized as an asset and carried forward until revenue is recognized, and write-down to NRV.',
    scopeAr: 'يطبق على جميع أنواع المخزون (بضاعة تامة، مواد خام، إنتاج تحت التشغيل)، باستثناء الأدوات المالية (IFRS 9) والأصول الحيوية والزراعية (IAS 41).',
    scopeEn: 'Applies to all inventories (finished goods, raw materials, work-in-progress), except financial instruments (IFRS 9) and biological assets (IAS 41).',
    recognitionAr: 'يقاس المخزون بالتكلفة أو صافي القيمة القابلة للتحقق (Net Realizable Value - NRV) أيهما أقل. ويحظر المعيار استخدام طريقة الوارد أخيراً صادر أولاً (LIFO).',
    recognitionEn: 'Inventories measured at the lower of Cost and Net Realizable Value (NRV). LIFO method is strictly prohibited under IFRS; only FIFO or Weighted Average Cost (WAC) allowed.',
    measurementInitialAr: 'تكلفة الشراء (الثمن، الرسوم، النقل المباشر، ناقص الخصومات) + تكاليف التحويل والتشكيل (العمالة والتكاليف غير المباشرة الصناعية الثابتة والمتغيرة المخصصة بناءً على الطاقة الإنتاجية الطبيعية).',
    measurementInitialEn: 'Purchase cost (price, import duties, handling, net of trade discounts) + conversion costs (direct labor + systematic allocation of fixed/variable production overheads based on normal capacity).',
    measurementSubsequentAr: 'في تاريخ القوائم المالية: تقارن التكلفة مع صافي القيمة القابلة للتحقق (سعر البيع التقديري - تكاليف الإتمام والبيع المقدرة). إذا كانت NRV أقل، يتم إثبات هبوط المخزون فوراً كمصروف.',
    measurementSubsequentEn: 'At reporting date: compare cost with NRV (estimated selling price less costs of completion and sale). Write-down difference to P&L immediately.',
    erpImplementationAr: 'دعم طرق التقييم المعتمدة (المتوسط المرجح المتحرك WAC أو الوارد أولاً صادر أولاً FIFO)، مع شاشة تسوية الجرد وهبوط المخزون (Stock Adjustment & Write-down).',
    erpImplementationEn: 'Strict adherence to Moving Weighted Average or FIFO valuation modes, automated landed cost distribution on Goods Receipts, and periodic NRV write-down screen.',
    erpModules: ['inventory_movements', 'goods_receipts', 'stock_adjustments', 'products'],
    numericalExample: {
      titleAr: 'تقييم المخزون وخفضه إلى صافي القيمة القابلة للتحقق (NRV)',
      titleEn: 'Lower of Cost and Net Realizable Value (NRV) Adjustment',
      scenarioAr: 'شركة لديها 1,000 وحدة مخزون تكلفة الوحدة الدفترية 100 ج.م (الإجمالي 100,000 ج.م). انخفض الطلب في السوق وأصبح سعر البيع المتوقع للوحدة 85 ج.م، وتتطلب بيع كل وحدة مصاريف تعبئة ونقل 5 ج.م.',
      scenarioEn: 'Entity holds 1,000 inventory units with carrying cost of 100 EGP/unit (100,000 EGP). Due to market shift, selling price dropped to 85 EGP, with 5 EGP selling cost per unit.',
      calculationAr: 'صافي القيمة القابلة للتحقق (NRV) = 85 - 5 = 80 ج.م للوحدة. إجمالي NRV = 80,000 ج.م. بما أن NRV (80,000) أقل من التكلفة (100,000) ← يجب تخفيض المخزون بمبلغ 20,000 ج.م كمصروف فوراً.',
      calculationEn: 'NRV per unit = 85 - 5 = 80 EGP. Total NRV = 80,000 EGP. Write-down required = 100,000 - 80,000 = 20,000 EGP charged directly to cost of sales/P&L.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصروف هبوط مخزون (أو تكلفة المبيعات)',
        accountEn: 'Inventory Write-down Expense (Cost of Sales)',
        debit: '20,000',
        credit: '-',
        notesAr: 'تحميل خسارة الهبوط إلى صافي القيمة البيعية على قائمة الدخل',
        notesEn: 'Recognize write-down to NRV in profit or loss'
      },
      {
        accountAr: 'حـ/ مخصص هبوط أسعار المخزون (أو المخزون مباشرة)',
        accountEn: 'Allowance for Inventory Write-Down',
        debit: '-',
        credit: '20,000',
        notesAr: 'تخفيض القيمة الدفترية للمخزون بالقوائم المالية',
        notesEn: 'Direct or contra-inventory balance reduction'
      }
    ],
    disclosuresAr: [
      'السياسات المحاسبية المتبعة في تقييم المخزون وصيغة التكلفة المستخدمة (FIFO أو WAC).',
      'إجمالي القيمة الدفترية للمخزون وتحليلها حسب الفئات (بضاعة تامة، إنتاج تحت التشغيل، خامات).',
      'مقدار أي تخفيض للمخزون معترف به كمصروف في الفترة، ومقدار أي رد لتخفيض سابق مع بيان الأسباب.'
    ],
    disclosuresEn: [
      'Accounting policies adopted, including cost measurement formula (FIFO or WAC).',
      'Carrying amount of inventories by sub-classification (raw materials, WIP, finished goods).',
      'Amount of any inventory write-down recognized as expense, and reversals of previous write-downs.'
    ],
    commonPitfallsAr: [
      'استخدام طريقة LIFO الممنوعة دولياً تحت معايير IFRS، أو إدراج تكاليف التخزين الفاقد غير الطبيعي ضمن تكلفة المخزون.',
      'إجراء تقييم NRV على مستوى إجمالي المخزون بالكامل ككتلة واحدة بدلاً من إجرائه بنداً ببند (Item-by-item).'
    ],
    commonPitfallsEn: [
      'Using prohibited LIFO valuation method or capitalizing abnormal storage/waste into inventory cost.',
      'Assessing NRV on a global company-wide basis rather than item-by-item or category-by-category.'
    ]
  },

  // ==========================================
  // IAS 7 — STATEMENT OF CASH FLOWS
  // ==========================================
  {
    code: 'IAS 7',
    family: 'IAS',
    titleAr: 'قائمة التدفقات النقدية (الأنشطة التشغيلية، الاستثمارية، التمويلية)',
    titleEn: 'Statement of Cash Flows (Operating, Investing, Financing Activities)',
    category: 'presentation',
    effectiveDate: '01/01/1994 (محدث بإفصاحات التمويل والموردين 2024/2026)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-7-statement-of-cash-flows/',
    objectiveAr: 'توفير معلومات تاريخية عن التغيرات في النقد وما في حكمه عبر تصنيف التدفقات النقدية الصادرة والواردة إلى ثلاثة أنشطة رئيسية.',
    objectiveEn: 'Require the provision of information about historical changes in cash and cash equivalents categorized into operating, investing, and financing activities.',
    scopeAr: 'إلزامي على جميع المنشآت التي تعد قوائم مالية وفق معايير IFRS تقديم قائمة تدفقات نقدية كجزء لا يتجزأ من القوائم.',
    scopeEn: 'Mandatory component of complete financial statements under IFRS for all reporting entities.',
    recognitionAr: 'تصنيف التدفقات إلى: 1. أنشطة تشغيلية (Operating - من الأنشطة الرئيسية المنتجة للإيراد)، 2. أنشطة استثمارية (Investing - شراء وبيع الأصول طويلة الأجل)، 3. أنشطة تمويلية (Financing - التغيرات في حقوق الملكية والقروض).',
    recognitionEn: 'Classify flows into: 1. Operating (principal revenue-generating activities), 2. Investing (acquisition/disposal of long-term assets), 3. Financing (equity capital & debt borrowings).',
    measurementInitialAr: 'يسمح بعرض الأنشطة التشغيلية بإحدى طريقتين: الطريقة المباشرة (Direct Method - موصى بها) أو الطريقة غير المباشرة (Indirect Method - تعديل صافي الربح).',
    measurementInitialEn: 'Operating activities presented using either Direct Method (recommended by IASB) or Indirect Method (reconciling net profit for non-cash items and working capital).',
    measurementSubsequentAr: 'الإفصاح المنفصل عن الفوائد المستلمة والمدفوعة وتوزيعات الأرباح وضرائب الدخل المدفوعة نقدياً.',
    measurementSubsequentEn: 'Mandatory separate disclosure of cash flows from interest, dividends, and income taxes paid.',
    erpImplementationAr: 'تصنيف سندات القبض والصرف وحركات الخزينة والبنوك وفق الأنشطة الثلاثة، لتوليد قائمة التدفقات النقدية التلقائية بالطريقتين المباشرة وغير المباشرة.',
    erpImplementationEn: 'Tag receipt/payment vouchers, cash transfers, and bank operations to auto-generate direct and indirect cash flow statements with cash-equivalent reconciliation.',
    erpModules: ['receipts', 'payment_vouchers', 'cash_transfers', 'journal_entries'],
    numericalExample: {
      titleAr: 'إعداد التدفقات النقدية التشغيلية بالطريقة غير المباشرة',
      titleEn: 'Indirect Method Operating Cash Flow Reconciliation',
      scenarioAr: 'صافي ربح الفترة 400,000 ج.م. تضمن إهلاك أصول 60,000 ج.م، زيادة في العملاء 50,000 ج.م، انخفاض في المخزون 20,000 ج.م، وزيادة في الموردين 30,000 ج.م.',
      scenarioEn: 'Net profit = 400,000 EGP. Depreciation = 60,000 EGP, increase in receivables = 50,000 EGP, decrease in inventory = 20,000 EGP, increase in payables = 30,000 EGP.',
      calculationAr: 'صافي التدفق التشغيلي = 400,000 (صافي الربح) + 60,000 (الإهلاك) - 50,000 (زيادة العملاء) + 20,000 (نقص المخزون) + 30,000 (زيادة الموردين) = 460,000 ج.م.',
      calculationEn: 'Operating Cash Flow = 400k (Net Profit) + 60k (Depreciation non-cash) - 50k (Receivables outflow) + 20k (Inventory inflow) + 30k (Payables inflow) = 460,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ النقدية وما في حكمها (البنك)',
        accountEn: 'Cash and Cash Equivalents (Bank)',
        debit: '460,000',
        credit: '-',
        notesAr: 'صافي الأثر النقدي المحقق من الأنشطة التشغيلية',
        notesEn: 'Net operational cash inflow generated'
      },
      {
        accountAr: 'حـ/ الأنشطة التشغيلية ورأس المال العامل',
        accountEn: 'Operating Activities / Working Capital Net',
        debit: '-',
        credit: '460,000',
        notesAr: 'التسوية الإجمالية المقابلة لقائمة التدفقات النقدية',
        notesEn: 'Counterpart operational cash flow reconciliation'
      }
    ],
    disclosuresAr: [
      'مكونات النقد وما في حكمه ومطابقتها مع بنود الميزانية العمومية.',
      'تسوية التغيرات في الالتزامات الناشئة عن الأنشطة التمويلية (IAS 7.44A Reconciliation of Liabilities from Financing Activities).',
      'المعاملات الاستثمارية والتمويلية غير النقدية (مثل اقتناء أصول عبر عقود إيجار تمويلي IFRS 16).'
    ],
    disclosuresEn: [
      'Components of cash and cash equivalents and reconciliation to balance sheet.',
      'Reconciliation of changes in liabilities arising from financing activities (cash vs non-cash).',
      'Non-cash investing and financing transactions (e.g. lease asset acquisitions).'
    ],
    commonPitfallsAr: [
      'إدراج السحب على المكشوف غير المؤهل كجزء من النقدية بدلاً من تصنيفه كالتزام تمويلي.',
      'إغفال تقديم تسوية الالتزامات التمويلية الإلزامية التي يركز عليها المدققون والمحللون الماليون.'
    ],
    commonPitfallsEn: [
      'Incorrectly presenting bank overdrafts as financing cash flow instead of integral cash equivalents.',
      'Omitting the mandatory IAS 7.44A reconciliation of financing debt movements.'
    ]
  },

  // ==========================================
  // IAS 12 — INCOME TAXES & DEFERRED TAXES
  // ==========================================
  {
    code: 'IAS 12',
    family: 'IAS',
    titleAr: 'ضرائب الدخل (الضريبة الجارية والمؤجلة وقاعدة الركيزة الثانية Pillar Two)',
    titleEn: 'Income Taxes (Current Tax, Deferred Tax & OECD Pillar Two Model)',
    category: 'specialized',
    effectiveDate: '01/01/1998 (محدث بتعديلات ضريبة الشركات العالمية 2024/2026)',
    status: 'amended',
    is2026Highlight: true,
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-12-income-taxes/',
    objectiveAr: 'تحديد المعالجة المحاسبية لضرائب الدخل، وتحديد كيفية معالجة الآثار الضريبية الحالية والمستقبلية للتعافي المستقبلي للقيمة الدفترية للأصول والالتزامات.',
    objectiveEn: 'Prescribe accounting for income taxes: how to account for the current and future tax consequences of the future recovery of carrying amounts of assets and liabilities.',
    scopeAr: 'يطبق على جميع الضرائب المحلية والأجنبية المفروضة على الأرباح الخاضعة للضريبة، والضرائب المستقطعة من المنبع.',
    scopeEn: 'Applies to all domestic and foreign taxes based on taxable profits and withholding taxes.',
    recognitionAr: 'الاعتراف بالضريبة الجارية كالتزام (أو أصل)، والاعتراف بأصول/التزامات الضريبة المؤجلة الناتجة عن الفروق المؤقتة (Temporary Differences) بين القيمة الدفترية والقاعدة الضريبية.',
    recognitionEn: 'Recognize current tax liability/asset, and deferred tax liabilities/assets arising from temporary differences between accounting carrying amounts and tax bases.',
    measurementInitialAr: 'تقاس الضريبة المؤجلة بمعدلات الضرائب المتوقع تطبيقها في الفترة التي يتحقق فيها الأصل أو يسوى فيها الالتزام (القوانين الضريبية الصادرة أو السارية فعلياً). ولا تخصم مبالغ الضريبة المؤجلة.',
    measurementInitialEn: 'Measured at the tax rates enacted or substantively enacted at balance sheet date. Deferred tax balances must NOT be discounted.',
    measurementSubsequentAr: 'مراجعة أصل الضريبة المؤجلة سنوياً والاعتراف به فقط بقدر ما يكون من المحتمل وجود أرباح ضريبية مستقبلية كافية لاستيعابه.',
    measurementSubsequentEn: 'Reassess carrying amount of deferred tax assets at each balance sheet date; reduce if no longer probable that sufficient taxable profit will be available.',
    erpImplementationAr: 'إثبات مخصص ضريبة الدخل السنوية الجارية، وحساب الفروق المؤقتة للإهلاك المحاسبي مقابل الضريبي لحساب أصل/التزام الضريبة المؤجلة آلياً.',
    erpImplementationEn: 'Automate tax provision calculation comparing accounting net profit with taxable profit, tracking temporary differences for accounting vs tax depreciation.',
    erpModules: ['journal_entries', 'income_statement', 'balance_sheet'],
    numericalExample: {
      titleAr: 'حساب الضريبة المؤجلة الناتجة عن فرق الإهلاك المحاسبي والضريبي',
      titleEn: 'Deferred Tax Liability on Accelerated Tax Depreciation',
      scenarioAr: 'أصل ثابت قيمته 100,000 ج.م. الإهلاك المحاسبي 20,000 ج.م (القيمة الدفترية = 80,000 ج.م). الإهلاك الضريبي المعجل 40,000 ج.م (القاعدة الضريبية = 60,000 ج.م). معدل الضريبة 22.5%.',
      scenarioEn: 'Asset cost = 100,000 EGP. Accounting depreciation = 20k (carrying amount = 80k). Tax depreciation = 40k (tax base = 60k). Corporate tax rate = 22.5%.',
      calculationAr: 'الفرق المؤقت الخاضع للضريبة = 80,000 - 60,000 = 20,000 ج.م. التزام الضريبة المؤجلة (DTL) = 20,000 × 22.5% = 4,500 ج.م.',
      calculationEn: 'Taxable temporary difference = 80k - 60k = 20,000 EGP. Deferred Tax Liability (DTL) = 20,000 x 22.5% = 4,500 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصروف ضريبة الدخل المؤجلة (قائمة الدخل)',
        accountEn: 'Deferred Tax Expense (P&L)',
        debit: '4,500',
        credit: '-',
        notesAr: 'تحميل قائمة الدخل بعبء الضريبة المؤجلة للفترة',
        notesEn: 'Charge deferred tax expense to income statement'
      },
      {
        accountAr: 'حـ/ التزام الضريبة المؤجلة (الخصوم غير المتداولة)',
        accountEn: 'Deferred Tax Liability (DTL)',
        debit: '-',
        credit: '4,500',
        notesAr: 'التزام ضريبي مؤجل يسدد في فترات مستقبلية',
        notesEn: 'Non-current liability for future tax cash outflows'
      }
    ],
    disclosuresAr: [
      'التسوية الرقمية بين مصروف الضريبة المحاسبي والربح المحاسبي مضروباً في سعر الضريبة المطبق (Tax Reconciliation).',
      'مبالغ الفروق المؤقتة والخسائر الضريبية المرحلة غير المعترف بها كأصول ضريبية مؤجلة.',
      'الإفصاحات الخاصة بتشريعات الركيزة الثانية للحد الأدنى العالمي للضريبة (OECD Pillar Two).'
    ],
    disclosuresEn: [
      'Numerical tax reconciliation between tax expense and accounting profit multiplied by statutory tax rate.',
      'Amount of deductible temporary differences and unused tax losses for which no deferred tax asset is recognized.',
      'Mandatory disclosures regarding OECD Pillar Two global minimum tax exposure.'
    ],
    commonPitfallsAr: [
      'خصم مبالغ أصول والالتزامات الضريبية المؤجلة للقيمة الحالية، وهو ما يحظره المعيار صراحة.',
      'الاعتراف بأصل ضريبة مؤجلة ناتج عن خسائر ضريبية مرحلة دون وجود أدلة قوية ومقنعة على تحقيق أرباح مستقبلية.'
    ],
    commonPitfallsEn: [
      'Discounting deferred tax assets and liabilities to present value, which is explicitly forbidden by IAS 12.',
      'Recognizing deferred tax assets on carried-forward tax losses without convincing evidence of future taxable profits.'
    ]
  },

  // ==========================================
  // IAS 21 — THE EFFECTS OF CHANGES IN FOREIGN EXCHANGE RATES
  // ==========================================
  {
    code: 'IAS 21',
    family: 'IAS',
    titleAr: 'آثار التغيرات في أسعار صرف العملات الأجنبية (العملة الوظيفية والترجمة)',
    titleEn: 'The Effects of Changes in Foreign Exchange Rates (Functional & Presentation Currency)',
    category: 'specialized',
    effectiveDate: '01/01/2005 (محدث بتعديل عدم قابلية الصرف المالي 2025/2026)',
    status: 'amended',
    is2026Highlight: true,
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/',
    objectiveAr: 'تحديد كيفية إدراج معاملات العملات الأجنبية والعمليات الأجنبية في القوائم المالية، وكيفية ترجمة القوائم المالية إلى عملة العرض.',
    objectiveEn: 'Prescribe how to include foreign currency transactions and foreign operations in financial statements and translate into a presentation currency.',
    scopeAr: 'يطبق على المحاسبة عن المعاملات والأرصدة بالعملات الأجنبية، وترجمة نتائج ومراكز العمليات الأجنبية.',
    scopeEn: 'Applies to accounting for foreign currency transactions and balances, and translating foreign operations.',
    recognitionAr: 'تحديد العملة الوظيفية (Functional Currency) بناء على البيئة الاقتصادية الأساسية التي تولد وتنفق فيها المنشأة النقد. المعاملات تقيد أولياً بسعر الصرف الفوري (Spot Rate) في تاريخ المعاملة.',
    recognitionEn: 'Determine Functional Currency based on primary economic environment. Record transactions initially at spot exchange rate on transaction date.',
    measurementInitialAr: 'إثبات المعاملة بالعملة الأجنبية محولة إلى العملة الوظيفية بسعر الصرف في تاريخ نشوء المعاملة.',
    measurementInitialEn: 'Record foreign transaction in functional currency using spot rate at transaction execution date.',
    measurementSubsequentAr: 'في تاريخ كل ميزانية: إعادة تقييم البنود النقدية (Monetary Items مثل النقدية، العملاء، الموردين) بسعر الإقفال (Closing Rate) وإثبات فروق الصرف في الأرباح أو الخسائر. أما البنود غير النقدية المقاسة بالتكلفة التاريخية فلا يعاد تقييمها.',
    measurementSubsequentEn: 'At each balance sheet date: retranslate monetary items at closing spot rate with gains/losses in P&L. Non-monetary items measured at historical cost are not retranslated.',
    erpImplementationAr: 'إدارة العملات وسعر الصرف التلقائي، إعادة تقييم الحسابات النقدية بالعملات الأجنبية في نهاية كل شهر آلياً وترحيل قيد "أرباح/خسائر فروق العملة".',
    erpImplementationEn: 'Multi-currency engine with automated live FX sync, monthly FX revaluation of open foreign bank accounts and unpaid invoices, auto-posting realized & unrealized FX gains/losses.',
    erpModules: ['currencies', 'invoices', 'payment_vouchers', 'receipts', 'journal_entries'],
    numericalExample: {
      titleAr: 'إعادة تقييم رصيد مورد بالدولار الأمريكي عند إقفال الفترة',
      titleEn: 'Period-End Retranslation of Foreign Currency Accounts Payable',
      scenarioAr: 'قيدت المنشأة فاتورة مورد بمبلغ 10,000 دولار بسعر صرف 48.00 ج.م (الرصيد الدفتري 480,000 ج.م). في تاريخ إقفال الميزانية ارتفع سعر الصرف إلى 52.00 ج.م لكل دولار.',
      scenarioEn: 'Entity recorded supplier invoice of $10,000 at spot rate of 48.00 EGP ($480,000 EGP). At balance sheet date, spot rate rose to 52.00 EGP/$1.',
      calculationAr: 'الرصيد الواجب إثباته في الميزانية = 10,000 $ × 52.00 = 520,000 ج.م. الفرق = 520,000 - 480,000 = 40,000 ج.م (خسائر فروق عملة غير محققة تحمل على الأرباح أو الخسائر).',
      calculationEn: 'Balance at closing rate = $10,000 x 52.00 = 520,000 EGP. Unrealized foreign exchange loss = 520,000 - 480,000 = 40,000 EGP recognized in P&L.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ خسائر فروق تقييم عملة غير محققة (قائمة الدخل)',
        accountEn: 'Unrealized Foreign Exchange Loss (P&L)',
        debit: '40,000',
        credit: '-',
        notesAr: 'إثبات خسارة انخفاض قيمة العملة المحلية أمام الدولار',
        notesEn: 'Recognize unrealized currency revaluation loss'
      },
      {
        accountAr: 'حـ/ الموردين (رصيد العملة الأجنبية - دولار)',
        accountEn: 'Accounts Payable - USD Supplier',
        debit: '-',
        credit: '40,000',
        notesAr: 'تعديل الرصيد الدفتري ليعادل 520,000 ج.م بسعر الإقفال',
        notesEn: 'Increase payable liability to reflect closing rate'
      }
    ],
    disclosuresAr: [
      'مقدار فروق الصرف المعترف بها في الأرباح أو الخسائر خلال الفترة.',
      'تحديد العملة الوظيفية وعملة العرض، وأسباب أي تغيير في العملة الوظيفية.',
      'الإفصاحات الجديدة لعام 2025/2026 عند غياب قابلية صرف العملة ومعدلات التقدير المستخدمة.'
    ],
    disclosuresEn: [
      'Amount of exchange differences recognized in profit or loss.',
      'Functional currency and presentation currency, with justification if different.',
      'New 2025/2026 disclosures regarding lack of exchangeability and estimated spot rates.'
    ],
    commonPitfallsAr: [
      'إعادة تقييم الأصول غير النقدية (مثل المخزون أو الأصول الثابتة) بسعر إقفال العملة، وهو خطأ فادح؛ حيث تظل بالتكلفة التاريخية بسعر يوم الشراء.',
      'تأجيل إثبات فروق الصرف الناتجة عن المعاملات النقدية إلى حين السداد الفعلي بدلاً من إعادة تقييمها في كل نهاية فترة مالية.'
    ],
    commonPitfallsEn: [
      'Retranslating non-monetary items like inventory or equipment at closing FX rates; they must remain at historical spot rate.',
      'Deferring unrealized FX differences until actual settlement instead of accruing at period-end.'
    ]
  },

  // ==========================================
  // IAS 36 — IMPAIRMENT OF ASSETS
  // ==========================================
  {
    code: 'IAS 36',
    family: 'IAS',
    titleAr: 'انخفاض قيمة الأصول (اختبار التدني والمبلغ القابل للاسترداد)',
    titleEn: 'Impairment of Assets (Recoverable Amount & Impairment Testing)',
    category: 'assets',
    effectiveDate: '01/01/2004 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-36-impairment-of-assets/',
    objectiveAr: 'ضمان عدم قيد أصول المنشأة بقيمة دفترية تزيد عن مبلغها القابل للاسترداد (Recoverable Amount)، وتحديد أسس قياس ورد خسائر الانخفاض.',
    objectiveEn: 'Ensure assets are carried at no more than their recoverable amount, and prescribe how recoverable amount is calculated and impairment losses recognized.',
    scopeAr: 'يطبق على جميع الأصول الملموسة وغير الملموسة والشهرة (Goodwill)، باستثناء المخزون (IAS 2)، الأصول الضريبية المؤجلة (IAS 12)، والأدوات المالية (IFRS 9).',
    scopeEn: 'Applies to all tangible, intangible assets and goodwill, excluding inventories, deferred tax, and financial instruments.',
    recognitionAr: 'يتم تقييم وجود مؤشرات انخفاض في كل تاريخ تقرير. وتختبر الشهرة والأصول غير الملموسة ذات العمر غير المحدد سنوياً دون الحاجة لوجود مؤشر.',
    recognitionEn: 'Assess for impairment indicators at each reporting date. Goodwill and indefinite-lived intangibles tested annually regardless of indicators.',
    measurementInitialAr: 'المبلغ القابل للاسترداد = الأعلى بين القيمة العادلة ناقصاً تكاليف التصرف (FVLCOD) والقيمة قيد الاستخدام (Value in Use - VIU).',
    measurementInitialEn: 'Recoverable Amount = Higher of Fair Value Less Costs of Disposal (FVLCOD) and Value in Use (VIU - discounted cash flows).',
    measurementSubsequentAr: 'إذا كانت القيمة الدفترية للأصل أكبر من المبلغ القابل للاسترداد، يتم إثبات خسارة انخفاض فوراً في قائمة الدخل. يحظر رد انخفاض قيمة الشهرة مطلقاً في الفترات اللاحقة.',
    measurementSubsequentEn: 'If carrying amount exceeds recoverable amount, reduce to recoverable amount and recognize impairment loss in P&L. Goodwill impairment reversal is strictly prohibited.',
    erpImplementationAr: 'شاشة اختبار هبوط الأصول الثابتة وإثبات مجمع الانخفاض، وإعادة جدولة الإهلاك المستقبلي على أساس القيمة المخفضة المتبقية.',
    erpImplementationEn: 'Asset impairment adjustment screen linked to Fixed Assets register, recording accumulated impairment and resetting future depreciation schedule over revised base.',
    erpModules: ['fixed_assets', 'asset_depreciation', 'journal_entries'],
    numericalExample: {
      titleAr: 'اختبار انخفاض قيمة آلة صناعية وحساب الخسارة',
      titleEn: 'Impairment Loss Calculation on Production Machinery',
      scenarioAr: 'آلة قيمتها الدفترية 300,000 ج.م. ظهرت مؤشرات تقادم تكنولوجي. القيمة العادلة ناقصاً تكاليف البيع = 220,000 ج.م. القيمة قيد الاستخدام (التدفقات النقدية المخصومة) = 240,000 ج.م.',
      scenarioEn: 'Machinery carrying amount = 300,000 EGP. Indicators observed. Fair value less disposal cost = 220,000 EGP. Value in Use (VIU) = 240,000 EGP.',
      calculationAr: 'المبلغ القابل للاسترداد = الأعلى بين (220,000 و 240,000) = 240,000 ج.م. خسارة الانخفاض = القيمة الدفترية (300,000) - المبلغ القابل للاسترداد (240,000) = 60,000 ج.م.',
      calculationEn: 'Recoverable amount = Max(220k, 240k) = 240,000 EGP. Impairment loss = 300,000 - 240,000 = 60,000 EGP recognized in P&L.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ خسائر انخفاض قيمة أصول ثابتة (قائمة الدخل)',
        accountEn: 'Impairment Loss on PPE (P&L)',
        debit: '60,000',
        credit: '-',
        notesAr: 'إثبات هبوط قيمة الأصل إلى مبلغه القابل للاسترداد',
        notesEn: 'Recognize impairment expense in profit or loss'
      },
      {
        accountAr: 'حـ/ مجمع خسائر انخفاض قيمة الآلات',
        accountEn: 'Accumulated Impairment Loss - Machinery',
        debit: '-',
        credit: '60,000',
        notesAr: 'حساب مقابل يخفض القيمة الدفترية للأصل الثابت',
        notesEn: 'Contra-asset accumulated impairment account'
      }
    ],
    disclosuresAr: [
      'مقدار خسائر الانخفاض المعترف بها في الأرباح أو الخسائر والأحداث التي أدت إليها.',
      'الافتراضات الجوهرية ومعدلات الخصم ومعدلات النمو المستخدمة في حساب القيمة قيد الاستخدام (VIU).',
      'تحليل الحساسية (Sensitivity Analysis) للمتغيرات الرئيسية لاختبارات هبوط الشهرة.'
    ],
    disclosuresEn: [
      'Amount of impairment losses recognized by asset class and main triggering events.',
      'Key assumptions, discount rates, and long-term growth rates used for Value in Use (VIU).',
      'Sensitivity analysis showing impact of reasonable changes in key assumptions for CGUs with goodwill.'
    ],
    commonPitfallsAr: [
      'مقارنة القيمة الدفترية مع القيمة العادلة فقط وتجاهل حساب القيمة قيد الاستخدام التي قد تكون أعلى بكثير.',
      'رد خسارة هبوط الشهرة في فترات لاحقة عند تحسن الأداء، وهو مخالف صريح لنص المعيار.'
    ],
    commonPitfallsEn: [
      'Comparing book value only against liquidation/fair value while omitting Value in Use calculation.',
      'Reversing goodwill impairment in subsequent years, which is explicitly forbidden.'
    ]
  },

  // ==========================================
  // IAS 37 — PROVISIONS, CONTINGENT LIABILITIES
  // ==========================================
  {
    code: 'IAS 37',
    family: 'IAS',
    titleAr: 'المخصصات، والالتزامات المحتملة، والأصول المحتملة',
    titleEn: 'Provisions, Contingent Liabilities and Contingent Assets',
    category: 'liabilities_equity',
    effectiveDate: '01/07/1999 (محدث بتعديل العقود المرهقة 2022/2026)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-37-provisions-contingent-liabilities-and-contingent-assets/',
    objectiveAr: 'وضع معايير دقيقة للاعتراف بالمخصصات وقياسها والتأكد من إدراج المخصصات الحقيقية فقط ومنع تكوين مخصصات عامة وهمية لتمهيد الأرباح (Profit Smoothing).',
    objectiveEn: 'Ensure that appropriate recognition criteria and measurement bases are applied to provisions, contingent liabilities, and contingent assets, preventing creative profit-smoothing provisions.',
    scopeAr: 'يطبق على جميع المخصصات والالتزامات غير محددة التوقيت أو القيمة، باستثناء ما تغطيه معايير أخرى (مثل IFRS 9 أو IFRS 15 أو IFRS 16).',
    scopeEn: 'Applies to all provisions and contingencies except those covered by other standards (e.g. IFRS 9, IFRS 15, IFRS 16, IAS 12).',
    recognitionAr: 'يعترف بالمخصص فقط عند توافر 3 شروط مجتمعة: 1. وجود التزام حالي (قانوني أو حكمي/استدلالي) ناتج عن حدث سابق، 2. احتمال تدفق موارد خارجة لسداد الالتزام (> 50%)، 3. إمكانية تقدير المبلغ بموثوقية.',
    recognitionEn: 'Recognized only when: 1. Present obligation (legal or constructive) exists as result of past event, 2. Probable outflow of economic resources (>50%), 3. Reliable estimate can be made.',
    measurementInitialAr: 'يقاس بأفضل تقدير للمبلغ اللازم لتسوية الالتزام الحالي في تاريخ التقرير، مع خصم المبلغ للقيمة الحالية إذا كان الأثر الزمني للنقود جوهرياً.',
    measurementInitialEn: 'Measured at the best estimate of the expenditure required to settle the present obligation at balance sheet date, discounted to present value if time value of money is material.',
    measurementSubsequentAr: 'مراجعة المخصص في كل تاريخ تقرير وإعادة تسويته ليعكس أفضل تقدير حالي، أو إلغاؤه في حال لم يعد تدفق الموارد محتملاً.',
    measurementSubsequentEn: 'Review and adjust provisions at each balance sheet date; reverse to P&L if outflow is no longer probable.',
    erpImplementationAr: 'إدارة مخصصات الضمان، القضايا القانونية، وإعادة الهيكلة، وجدولة مراجعتها وإقفالها عند السداد الفعلي أو انتهاء الالتزام.',
    erpImplementationEn: 'Provisions register for product warranties, legal claims, and decommissioning with automated present value unwinding and periodic reversal entries.',
    erpModules: ['journal_entries', 'balance_sheet', 'income_statement'],
    numericalExample: {
      titleAr: 'تكوين مخصص ضمان المنتجات المباعة استناداً للاحتمالات',
      titleEn: 'Product Warranty Provision Based on Probability Matrix',
      scenarioAr: 'باعت المنشأة بضائع بقيمة 5,000,000 ج.م بضمان مجاني لمدة عام. تشير الخبرة التاريخية إلى: 90% بدون عيوب، 7% عيوب طفيفة (تكلفة إصلاحها 100,000 ج.م)، 3% عيوب جسيمة (تكلفة إصلاحها 400,000 ج.م).',
      scenarioEn: 'Entity sold 5,000,000 EGP goods with 1-year warranty. Historical data shows: 90% no defects, 7% minor defects (repair 100k), 3% major defects (repair 400k).',
      calculationAr: 'المخصص المطلوب = (90% × 0) + (7% × 100,000) + (3% × 400,000) = 0 + 7,000 + 12,000 = 19,000 ج.م.',
      calculationEn: 'Required warranty provision = (90% x 0) + (7% x 100k) + (3% x 400k) = 7,000 + 12,000 = 19,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصروف ضمان المنتجات (قائمة الدخل)',
        accountEn: 'Warranty Expense (P&L)',
        debit: '19,000',
        credit: '-',
        notesAr: 'تحميل قائمة الدخل بتقدير تكاليف الضمان المتوقعة',
        notesEn: 'Recognize expected warranty obligation'
      },
      {
        accountAr: 'حـ/ مخصص تكاليف الضمان (الالتزامات المتداولة)',
        accountEn: 'Provision for Warranty Claims',
        debit: '-',
        credit: '19,000',
        notesAr: 'إثبات التزام الضمان في الميزانية العمومية',
        notesEn: 'Current liability provision on balance sheet'
      }
    ],
    disclosuresAr: [
      'جدول حركة المخصصات: رصيد أول الفترة، مبالغ إضافية، مبالغ مستخدمة، مبالغ مردودة، رصيد آخر الفترة.',
      'وصف موجز لطبيعة الالتزام والتوقيت المتوقع للتدفقات النقدية الخارجة.',
      'الالتزامات المحتملة (Contingent Liabilities): إفصاح في الإيضاحات فقط دون إثبات في الميزانية إذا كان الاحتمال ممكناً وليس مرجحاً.'
    ],
    disclosuresEn: [
      'Movement table for each class of provision: opening balance, additions, used, reversed, closing balance.',
      'Brief description of nature of obligation and expected timing of economic outflows.',
      'Disclosure of contingent liabilities where outflow is possible but not probable.'
    ],
    commonPitfallsAr: [
      'إثبات مخصصات لخسائر تشغيلية مستقبلية متوقعة، وهو ما يحظره المعيار تماماً لأنها ليست ناتجة عن التزام حالي.',
      'إثبات أصل محتمل (Contingent Asset) في الميزانية قبل أن يصبح التدفق النقدي مؤكداً بشكل تام (Virtually Certain).'
    ],
    commonPitfallsEn: [
      'Recognizing provisions for future operating losses, which is explicitly forbidden by IAS 37.',
      'Recognizing contingent assets on balance sheet before cash realization is virtually certain.'
    ]
  },

  // ==========================================
  // IAS 38 — INTANGIBLE ASSETS
  // ==========================================
  {
    code: 'IAS 38',
    family: 'IAS',
    titleAr: 'الأصول غير الملموسة (تكاليف التطوير، البرمجيات، وبراءات الاختراع)',
    titleEn: 'Intangible Assets (R&D, Software, Patents & Trademarks)',
    category: 'assets',
    effectiveDate: '01/04/2004 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-38-intangible-assets/',
    objectiveAr: 'تحديد المعايير الصارمة للاعتراف بالأصول غير الملموسة وقياسها وإطفائها، والتمييز الجوهري بين مرحلة البحث ومرحلة التطوير.',
    objectiveEn: 'Prescribe criteria for recognizing and measuring intangible assets, differentiating strictly between research phase (expensed) and development phase (capitalized).',
    scopeAr: 'يطبق على كافة الأصول غير الملموسة محددة الهوية وغير النقدية وليس لها جوهر مادي (مثل البرمجيات، تراخيص التشغيل، العلامات التجارية المشتراة، براءات الاختراع).',
    scopeEn: 'Applies to identifiable non-monetary assets without physical substance (software, patents, licenses, acquired trademarks).',
    recognitionAr: 'الاعتراف بالأصل يتطلب: قابلية التحديد (Identifiability)، السيطرة (Control)، وتوقع منافع مستقبلية. يحظر تماماً رسملة تكاليف مرحلة البحث (Research). يسمح برسملة مرحلة التطوير (Development) فقط عند استيفاء المعايير الستة الصارمة.',
    recognitionEn: 'Requires identifiability, control, and probable future economic benefits. All research costs MUST be expensed. Development costs capitalized ONLY if 6 criteria met (PIRATE).',
    measurementInitialAr: 'يقاس بالتكلفة. الأصول غير الملموسة المولدة داخلياً مثل العلامات التجارية وقوائم العملاء وشهرة المحل يحظر رسملتها تماماً وتعد مصاريف.',
    measurementInitialEn: 'Measured at cost. Internally generated brands, mastheads, publishing titles, customer lists, and goodwill must NEVER be capitalized.',
    measurementSubsequentAr: 'الأصول ذات العمر المحدد تطفأ على مدار عمرها الإنتاجي بطريقة القسط الثابت. الأصول ذات العمر غير المحدد (Indefinite) لا تطفأ بل تخضع لاختبار انخفاض القيمة سنوياً وفق IAS 36.',
    measurementSubsequentEn: 'Finite-life intangibles amortized over useful life; indefinite-life intangibles are NOT amortized but tested annually for impairment under IAS 36.',
    erpImplementationAr: 'تسجيل الأصول غير الملموسة والبرمجيات في سجل الأصول وتشغيل الإطفاء الشهري الآلي، وفصل مشاريع البحث والتطوير في مراكز التكلفة.',
    erpImplementationEn: 'Dedicated intangible assets register in ERP with automated monthly amortization and R&D cost-center expense vs capitalization segregation.',
    erpModules: ['fixed_assets', 'journal_entries', 'cost_centers'],
    numericalExample: {
      titleAr: 'رسملة تكاليف تطوير نظام برمجي ERP وإطفاؤه',
      titleEn: 'Capitalization of Software Development Phase and Amortization',
      scenarioAr: 'أنفقت الشركة 150,000 ج.م على مرحلة أبحاث السوق واختبار الفكرة الأولية، ثم استوفت الشروط الستة وأنفقت 350,000 ج.م على مرحلة التطوير والبرمجة. العمر الإنتاجي 5 سنوات.',
      scenarioEn: 'Company spent 150k on initial market research, then met capitalization criteria and spent 350k on programming/development. Useful life = 5 years.',
      calculationAr: 'تكاليف البحث (150,000 ج.م) ← مصروفات فورية في قائمة الدخل. تكاليف التطوير (350,000 ج.م) ← ترسمل كأصل غير ملموس. الإطفاء السنوي = 350,000 ÷ 5 = 70,000 ج.م.',
      calculationEn: 'Research phase (150k) = Expensed in P&L. Development phase (350k) = Capitalized as Intangible Asset. Annual amortization = 350k / 5 = 70,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصاريف أبحاث وتطوير (قائمة الدخل - مرحلة البحث)',
        accountEn: 'Research Expense (P&L)',
        debit: '150,000',
        credit: '-',
        notesAr: 'تكاليف مرحلة البحث واجبة الإثبات كمصروف فوراً',
        notesEn: 'Mandatory expense for research phase'
      },
      {
        accountAr: 'حـ/ أصول غير ملموسة - برمجيات قيد التطوير',
        accountEn: 'Intangible Assets - Capitalized Development',
        debit: '350,000',
        credit: '-',
        notesAr: 'رسملة تكاليف مرحلة التطوير المستوفية للشروط',
        notesEn: 'Capitalization of qualified development costs'
      },
      {
        accountAr: 'حـ/ البنك / الأجور المستحقة',
        accountEn: 'Bank / Payroll Accruals',
        debit: '-',
        credit: '500,000',
        notesAr: 'إجمالي المبالغ والرواتب المصروفة على المشروع',
        notesEn: 'Total expenditure disbursed'
      },
      {
        accountAr: 'حـ/ مصروف إطفاء أصول غير ملموسة (سنوي)',
        accountEn: 'Amortization Expense - Software',
        debit: '70,000',
        credit: '-',
        notesAr: 'إثبات قسط الإطفاء السنوي للبرمجيات',
        notesEn: 'Annual software amortization charge'
      },
      {
        accountAr: 'حـ/ مجمع إطفاء برمجيات',
        accountEn: 'Accumulated Amortization - Software',
        debit: '-',
        credit: '70,000',
        notesAr: 'حساب مقابل لتخفيض القيمة الدفترية للأصل',
        notesEn: 'Contra-asset accumulated amortization'
      }
    ],
    disclosuresAr: [
      'الأعمار الإنتاجية وطرق الإطفاء المتبعة لكل فئة من الأصول غير الملموسة.',
      'مطابقة تفصيلية لحركة الأصول غير الملموسة بين أول وآخر الفترة (إضافات، إطفاء، انخفاض).',
      'إجمالي مبالغ مصروفات الأبحاث والتطوير المحملة على قائمة الدخل خلال الفترة.'
    ],
    disclosuresEn: [
      'Useful lives and amortization methods used for each class of intangible assets.',
      'Gross carrying amounts and accumulated amortization reconciliation at start and end of period.',
      'Total research and development costs recognized as an expense during the period.'
    ],
    commonPitfallsAr: [
      'رسملة العلامات التجارية أو أسماء النطاقات أو قوائم العملاء المولدة داخلياً، وهو أمر محظور صراحة بموجب IAS 38.',
      'الاستمرار في إطفاء أصل غير ملموس بعد أن تقرر الإدارة التوقف عن استخدامه دون فحص تدني قيمته بالكامل.'
    ],
    commonPitfallsEn: [
      'Capitalizing internally generated brand names or customer lists; strictly forbidden by IAS 38.',
      'Failing to expense training costs incurred on employees to operate new software.'
    ]
  },

  // ==========================================
  // IAS 40 — INVESTMENT PROPERTY
  // ==========================================
  {
    code: 'IAS 40',
    family: 'IAS',
    titleAr: 'العقارات الاستثمارية (الأراضي والمباني المؤجرة أو المحتفظ بها لارتفاع القيمة)',
    titleEn: 'Investment Property (Rental Yield vs Capital Appreciation)',
    category: 'assets',
    effectiveDate: '01/01/2005 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-40-investment-property/',
    objectiveAr: 'تحديد المعالجة المحاسبية للعقارات المحتفظ بها لكسب إيجارات أو لارتفاع قيمتها الرأسمالية (وليس للاستخدام الذاتي أو البيع ضمن النشاط المعتاد).',
    objectiveEn: 'Prescribe the accounting treatment for investment property and related disclosure requirements, differentiating from owner-occupied property (IAS 16).',
    scopeAr: 'الأراضي والمباني (أو جزء منها) المحتفظ بها لتأجيرها للغير أو لكسب أرباح رأسمالية من ارتفاع قيمتها السوقية.',
    scopeEn: 'Land or buildings held to earn rentals or for capital appreciation, rather than use in production/admin or sale in ordinary course.',
    recognitionAr: 'يعترف بالعقار الاستثماري كأصل عند توقع منافع مستقبلية وإمكانية قياس التكلفة بموثوقية.',
    recognitionEn: 'Recognized when future economic benefits are probable and cost can be measured reliably.',
    measurementInitialAr: 'يقاس مبدئياً بالتكلفة شاملاً تكاليف المعاملة ورسوم التسجيل.',
    measurementInitialEn: 'Measured initially at cost, including transaction costs and registration fees.',
    measurementSubsequentAr: 'الاختيار بين: 1. نموذج القيمة العادلة (Fair Value Model - التغيرات تثبت فوراً في قائمة الأرباح أو الخسائر دون إهلاك)، أو 2. نموذج التكلفة (Cost Model - وفق IAS 16 مع إهلاك وإفصاح عن القيمة العادلة في الإيضاحات).',
    measurementSubsequentEn: 'Policy choice between: 1. Fair Value Model (changes recognized directly in P&L, no depreciation), or 2. Cost Model (depreciated under IAS 16 rules with fair value disclosure in notes).',
    erpImplementationAr: 'تصنيف العقارات الاستثمارية في شجرة الحسابات وفصلها عن الأصول الثابتة التشغيلية، ومعالجة إيرادات الإيجار وإعادة التقييم الدوري.',
    erpImplementationEn: 'Dedicated Investment Property asset account in Chart of Accounts, automating rental revenue recognition and annual fair-value revaluation adjustments to P&L.',
    erpModules: ['fixed_assets', 'chart_of_accounts', 'journal_entries'],
    numericalExample: {
      titleAr: 'تطبيق نموذج القيمة العادلة لعقار استثماري',
      titleEn: 'Fair Value Model Gain on Commercial Property',
      scenarioAr: 'اشترت الشركة مبنى تجاري بغرض تأجيره بمبلغ 2,000,000 ج.م في 1 يناير. في 31 ديسمبر قدرت القيمة العادلة للمبنى بواسطة خبير عقاري معتمد بمبلغ 2,300,000 ج.م.',
      scenarioEn: 'Entity purchased commercial building for rental yield at 2,000,000 EGP on Jan 1. On Dec 31, independent appraisal determined fair value at 2,300,000 EGP.',
      calculationAr: 'بموجب نموذج القيمة العادلة: لا يوجد إهلاك. مكاسب تقييم القيمة العادلة = 2,300,000 - 2,000,000 = 300,000 ج.م تُقيد كإيراد أرباح غير محققة في قائمة الدخل.',
      calculationEn: 'Under Fair Value model: no depreciation charge. Gain on fair value = 2,300,000 - 2,000,000 = 300,000 EGP recognized directly in P&L.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ العقارات الاستثمارية - مباني تجارية',
        accountEn: 'Investment Property - Commercial Buildings',
        debit: '300,000',
        credit: '-',
        notesAr: 'زيادة القيمة الدفترية للعقار الاستثماري لتعكس قيمته العادلة',
        notesEn: 'Uplift asset carrying amount to fair value'
      },
      {
        accountAr: 'حـ/ أرباح تقييم عقارات استثمارية (قائمة الدخل)',
        accountEn: 'Gain on Investment Property Fair Value (P&L)',
        debit: '-',
        credit: '300,000',
        notesAr: 'إثبات أرباح القيمة العادلة مباشرة في الأرباح أو الخسائر',
        notesEn: 'Fair value adjustment gain recognized directly in profit or loss'
      }
    ],
    disclosuresAr: [
      'النموذج المطبق (القيمة العادلة أو التكلفة) وطرق وافتراضات تحديد القيمة العادلة.',
      'إيرادات الإيجار ومصروفات التشغيل المباشرة الناشئة عن العقارات الاستثمارية.',
      'إذا طبق نموذج التكلفة: الإفصاح الإلزامي عن القيمة العادلة للعقار في الإيضاحات.'
    ],
    disclosuresEn: [
      'Model applied (Fair Value or Cost) and valuation techniques and inputs used.',
      'Rental income and direct operating expenses arising from investment properties.',
      'If Cost Model is used, mandatory disclosure of fair value in note disclosures.'
    ],
    commonPitfallsAr: [
      'تحويل أرباح تقييم العقارات الاستثمارية إلى الدخل الشامل الآخر (OCI) بالخلط مع نموذج إعادة تقييم الأصول الثابتة IAS 16؛ حيث يتطلب IAS 40 قيدها في الأرباح أو الخسائر (P&L).',
      'إهلاك العقار الاستثماري عند اختيار نموذج القيمة العادلة، وهو أمر ممنوع في المعيار.'
    ],
    commonPitfallsEn: [
      'Posting fair value gains to OCI (confusing with IAS 16 revaluation surplus); IAS 40 strictly routes fair value gains to P&L.',
      'Depreciating investment property when using the Fair Value Model.'
    ]
  },

  // ==========================================
  // IFRS 19 — NEW / 2026/2027 SUBSIDIARIES WITHOUT PUBLIC ACCOUNTABILITY
  // ==========================================
  {
    code: 'IFRS 19',
    family: 'IFRS',
    titleAr: 'المنشآت التابعة التي لا تخضع للمساءلة العامة: الإفصاحات الميسرة',
    titleEn: 'Subsidiaries without Public Accountability: Disclosures',
    category: 'group',
    effectiveDate: '01/01/2027 (متاح للتطبيق المبكر في 2026)',
    status: 'new_2026',
    is2026Highlight: true,
    officialSource: 'IFRS Foundation / IASB (Issued May 2024)',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-19-subsidiaries-without-public-accountability-disclosures/',
    objectiveAr: 'السماح للشركات التابعة المؤهلة بتطبيق متطلبات الاعتراف والقياس الكاملة لمعايير IFRS مع الاستفادة من إفصاحات مخفضة وميسرة بدرجة كبيرة توفيراً للوقت والتكاليف.',
    objectiveEn: 'Permit eligible subsidiaries to apply full IFRS recognition and measurement requirements while providing significantly reduced and streamlined disclosures.',
    scopeAr: 'الشركات التابعة التي لا تخضع للمساءلة العامة (ليست مدرجة بالبورصة وليست مؤسسة مالية قابلة للودائع) وتعد شركتها الأم قوائم موحدة وفق معايير IFRS.',
    scopeEn: 'Eligible non-publicly accountable subsidiaries whose parent prepares consolidated financial statements under full IFRS.',
    recognitionAr: 'تطبيق نفس مبادئ الاعتراف والقياس الكاملة في كافة معايير IFRS (IFRS 15, IFRS 16, IFRS 9, IAS 16, etc.) دون أي تنازل في أسس المحاسبة.',
    recognitionEn: 'Apply identical recognition and measurement principles of all IFRS standards without alteration.',
    measurementInitialAr: 'تتبع المنشأة نفس قياسات الشركة الأم، ما يسهل التوحيد المحاسبي المباشر وتفادي إعداد دفاتر محاسبية مزدوجة.',
    measurementInitialEn: 'Same measurement rules as parent group, eliminating the need for dual accounting ledgers and complex consolidation reconciliations.',
    measurementSubsequentAr: 'تخفيض متطلبات الإفصاح في الإيضاحات بنسبة تزيد عن 50% مقارنة بالمعايير الكاملة، مع التركيز على احتياجات مستخدمي القوائم المالية غير المدرجة.',
    measurementSubsequentEn: 'Over 50% reduction in disclosure burden compared to full IFRS, tailored to information needs of non-listed subsidiary users.',
    erpImplementationAr: 'إمكانية تشغيل تقارير الإفصاح الميسرة للشركات التابعة داخل نفس قاعدة بيانات الـ ERP مع التوافق الكامل مع توحيد المجموعة.',
    erpImplementationEn: 'Consolidation-ready subsidiary accounts with streamlined disclosure generation directly from ERP data warehouse.',
    erpModules: ['chart_of_accounts', 'journal_entries', 'balance_sheet'],
    numericalExample: {
      titleAr: 'تطبيق إفصاحات IFRS 19 الميسرة على شركة تابعة لمجموعة',
      titleEn: 'Streamlined Subsidiary Disclosures under IFRS 19',
      scenarioAr: 'شركة تابعة تطبق IFRS 16 و IFRS 15. بموجب المعايير الكاملة تتطلب الإفصاحات جداول مطولة تتجاوز 40 صفحة إيضاحات، بينما يقلص IFRS 19 متطلبات الإفصاح مع الحفاظ على نفس أرقام الميزانية وقائمة الدخل.',
      scenarioEn: 'Subsidiary applies IFRS 16 and IFRS 15. Full IFRS requires extensive quantitative matrices, whereas IFRS 19 permits concise disclosures preserving identical ledger balances.',
      calculationAr: 'الأرقام المحاسبية (الأصول، الالتزامات، الأرباح) تظل متطابقة 100% مع حسابات التوحيد في الشركة الأم، مع تقليص مئات البنود الإفصاحية التفصيلية.',
      calculationEn: 'Ledger recognition is 100% consistent with parent group; only disclosure volume is streamlined.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ حسابات التوحيد مع الشركة الأم',
        accountEn: 'Intercompany Group Account',
        debit: '100,000',
        credit: '-',
        notesAr: 'اتساق كامل في المعالجة المحاسبية بين التابعة والأم',
        notesEn: 'Seamless alignment with group consolidation accounting'
      },
      {
        accountAr: 'حـ/ رأس المال وحقوق الملكية',
        accountEn: 'Share Capital & Equity',
        debit: '-',
        credit: '100,000',
        notesAr: 'تطبيق نفس أسس قياس حقوق الملكية IFRS',
        notesEn: 'Identical IFRS measurement base'
      }
    ],
    disclosuresAr: [
      'بيان تطبيق المنشأة لمعيار IFRS 19 واسم الشركة الأم التي تعد قوائم موحدة متاحة للجمهور.',
      'إفصاحات موجزة عن السياسات المحاسبية والأحكام الهامة.',
      'إفصاحات مبسطة عن المخاطر الائتمانية والأدوات المالية والمعاملات مع الأطراف ذات العلاقة.'
    ],
    disclosuresEn: [
      'Statement of compliance with IFRS 19 and name of parent producing publicly available consolidated financials.',
      'Concise summary of significant accounting policies and critical estimates.',
      'Simplified disclosures on financial instruments, credit exposure, and related-party transactions.'
    ],
    commonPitfallsAr: [
      'محاولة تطبيق IFRS 19 من قبل شركات مدرجة أو بنوك تخضع للمساءلة العامة، وهو محظور لأن المعيار مخصص للشركات التابعة غير الخاضعة للمساءلة العامة.',
      'الاعتقاد بأن IFRS 19 يغير طرق القياس أو الاعتراف، بينما هو معيار إفصاحات ميسرة فقط.'
    ],
    commonPitfallsEn: [
      'Attempting to apply IFRS 19 by listed companies or banks with public accountability.',
      'Mistaking IFRS 19 for a recognition/measurement change; it alters disclosures only.'
    ]
  },

  // ==========================================
  // IFRS S1 & S2 — SUSTAINABILITY & CLIMATE (ISSB)
  // ==========================================
  {
    code: 'IFRS S1 / S2',
    family: 'ISSB',
    titleAr: 'معايير الإفصاح عن الاستدامة والمناخ (ISSB S1 المتطلبات العامة & S2 المناخ)',
    titleEn: 'Sustainability & Climate-related Financial Disclosures (ISSB S1 & S2)',
    category: 'sustainability',
    effectiveDate: '01/01/2024 (إلزامي وتطبيقي متسارع لعام 2026)',
    status: 'new_2026',
    is2026Highlight: true,
    officialSource: 'International Sustainability Standards Board (ISSB) / IFRS Foundation',
    officialLink: 'https://www.ifrs.org/issued-standards/sustainability-disclosures/',
    objectiveAr: 'إلزام المنشآت بالإفصاح عن المخاطر والفرص المتعلقة بالاستدامة والمناخ التي يتوقع أن تؤثر على التدفقات النقدية للمنشأة وقدرتها على الوصول للتمويل على المدى القصير والمتوسط والطويل.',
    objectiveEn: 'Require disclosure of information about sustainability and climate-related risks and opportunities that could reasonably be expected to affect the entity’s cash flows, access to finance or cost of capital.',
    scopeAr: 'تنطبق على المنشآت التي تعد تقارير مالية عامة الغرض وترغب في تلبية متطلبات المستثمرين وجهات التمويل الدولية والجهات التنظيمية.',
    scopeEn: 'Applies to entities providing general purpose financial reports to meet capital market and regulatory ESG requirements.',
    recognitionAr: 'هيكلة الإفصاح عبر 4 ركائز أساسية (TCFD Pillars): 1. الحوكمة (Governance)، 2. الاستراتيجية (Strategy)، 3. إدارة المخاطر (Risk Management)، 4. المقاييس والمستهدفات (Metrics & Targets).',
    recognitionEn: 'Structured across 4 core pillars: 1. Governance, 2. Strategy, 3. Risk Management, 4. Metrics and Targets.',
    measurementInitialAr: 'قياس انبعاثات غازات الاحتباس الحراري (GHG Emissions) بالنطاقات الثلاثة: النطاق 1 (انبعاثات مباشرة)، النطاق 2 (انبعاثات الطاقة المشتراة)، النطاق 3 (انبعاثات سلسلة القيمة).',
    measurementInitialEn: 'Measurement of Scope 1, Scope 2, and Scope 3 greenhouse gas (GHG) emissions in accordance with the GHG Protocol.',
    measurementSubsequentAr: 'الربط المالي بين المخاطر المناخية (مخاطر التحول ومخاطر مادية) ومخصصات انخفاض قيمة الأصول وتقادم المعدات في القوائم المالية.',
    measurementSubsequentEn: 'Connect climate risks (transition and physical) with balance sheet asset impairments, provisions, and capital expenditures.',
    erpImplementationAr: 'تتبع استهلاك الطاقة والوقود والمواد في أوامر الشغل ومراكز التكلفة لحساب مؤشرات الاستدامة وانبعاثات الكربون تلقائياً.',
    erpImplementationEn: 'Track energy and material consumption across operations and logistics modules for automated Scope 1 & 2 carbon footprint reporting.',
    erpModules: ['cost_centers', 'operations', 'reports'],
    numericalExample: {
      titleAr: 'تحديد الأثر المالي لمخاطر التحول المناخي على القيمة الدفترية للأصول',
      titleEn: 'Quantifying Financial Impact of Climate Transition on Asset Life',
      scenarioAr: 'تمتلك المنشأة محطة توليد طاقة ديزل تكلفتها 1,000,000 ج.م متبقي من عمرها 10 سنوات. صدور تشريعات بيعية تفرض التحول للطاقة النظيفة يقلص عمرها الإنتاجي إلى 4 سنوات.',
      scenarioEn: 'Entity owns diesel power generator carrying value 1,000,000 EGP with 10 years remaining life. New climate carbon pricing regulations shorten economic life to 4 years.',
      calculationAr: 'تعديل العمر الإنتاجي كتغير في التقديرات المحاسبية (IAS 8) ← زيادة قسط الإهلاك السنوي من 100,000 ج.م إلى 250,000 ج.م سنوياً مع فحص هبوط القيمة وفق IAS 36.',
      calculationEn: 'Useful life shortened under IAS 8 prospective estimate change: annual depreciation rises from 100k to 250k EGP with IAS 36 impairment assessment.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصروف إهلاك معدات الطاقة (معدل بعد الأثر المناخي)',
        accountEn: 'Depreciation Expense - Climate Adjusted Life',
        debit: '250,000',
        credit: '-',
        notesAr: 'تسريع الإهلاك السنوي استجابة لمخاطر التحول البيئي',
        notesEn: 'Accelerated depreciation reflecting climate transition risk'
      },
      {
        accountAr: 'حـ/ مجمع إهلاك معدات الطاقة',
        accountEn: 'Accumulated Depreciation - Power Equipment',
        debit: '-',
        credit: '250,000',
        notesAr: 'زيادة مجمع الإهلاك لتخفيض العمر المتبقي للأصل',
        notesEn: 'Increased accumulated depreciation balance'
      }
    ],
    disclosuresAr: [
      'إفصاح كامل عن انبعاثات غازات الاحتباس الحراري النطاق 1 و 2 و 3 وفق معايير بروتوكول GHG.',
      'تحليل مرونة استراتيجية المنشأة في ظل سيناريوهات مناخية مختلفة (Climate Scenario Analysis).',
      'تحديد أهداف الاستدامة وخطة الانتقال المناخي (Climate Transition Plan).'
    ],
    disclosuresEn: [
      'Disclosure of gross Scope 1, Scope 2, and Scope 3 GHG emissions.',
      'Climate scenario analysis evaluating resilience of business model.',
      'Entity climate transition plan and internal carbon price targets.'
    ],
    commonPitfallsAr: [
      'تقديم تقارير استدامة معزولة في تقرير تسويقي منفصل دون ربط أرقامها بالقوائم المالية المعتمدة وأثرها على مخصصات الأصول والالتزامات.',
      'تجاهل انبعاثات النطاق 3 (سلسلة التوريد والعملاء) التي تشكل عادة أكثر من 70% من الأثر البيئي.'
    ],
    commonPitfallsEn: [
      'Issuing disconnected sustainability PR reports without reconciling financial impacts to audited balance sheet figures.',
      'Ignoring Scope 3 value chain emissions, which often represent the majority of corporate footprint.'
    ]
  },

  // ==========================================
  // IAS 1 — PRESENTATION OF FINANCIAL STATEMENTS
  // ==========================================
  {
    code: 'IAS 1',
    family: 'IAS',
    titleAr: 'عرض القوائم المالية (المكونات الأساسية والفروض المحاسبية)',
    titleEn: 'Presentation of Financial Statements (General Requirements & Assumptions)',
    category: 'presentation',
    effectiveDate: '01/01/2005 (يحل محله IFRS 18 تدريجياً لعام 2026/2027)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-1-presentation-of-financial-statements/',
    objectiveAr: 'تحديد أسس عرض القوائم المالية ذات الغرض العام لضمان قابليتها للمقارنة مع القوائم المالية للمنشأة لفترات سابقة ومع قوائم المنشآت الأخرى.',
    objectiveEn: 'Set out overall requirements for financial statement presentation, guidelines for structure, and minimum content requirements.',
    scopeAr: 'ينطبق على جميع القوائم المالية ذات الغرض العام المعدة والمعروضة وفقاً لمعايير التقرير المالي الدولية.',
    scopeEn: 'Applies to all general purpose financial statements prepared and presented under IFRS.',
    recognitionAr: 'تتكون القوائم الكاملة من: المركز المالي، الربح أو الخسارة والدخل الشامل الآخر، التغيرات في حقوق الملكية، التدفقات النقدية، والإيضاحات المتممة.',
    recognitionEn: 'Complete set comprises: Statement of Financial Position, P&L and OCI, Changes in Equity, Cash Flows, and Accounting Policies/Notes.',
    measurementInitialAr: 'تطبيق الفروض الجوهرية: الاستمرارية (Going Concern)، أساس الاستحقاق (Accrual Basis)، الأهمية النسبية والتجميع (Materiality & Aggregation)، وعدم المقاصة (No Offsetting) إلا إذا سمح معيار بذلك.',
    measurementInitialEn: 'Core principles: Going concern, Accrual basis of accounting, Materiality and aggregation, and No offsetting unless explicitly permitted.',
    measurementSubsequentAr: 'الفصل الصارم بين الأصول والالتزامات المتداولة وغير المتداولة استناداً إلى دورة التشغيل العادية (12 شهراً).',
    measurementSubsequentEn: 'Strict separation of current and non-current assets and liabilities based on 12-month normal operating cycle.',
    erpImplementationAr: 'توليد القوائم المالية المعتمدة (الميزانية، قائمة الدخل، ميزان المراجعة) آلياً مع الترتيب والتبويب المتوافق مع متطلبات العرض.',
    erpImplementationEn: 'Automated reporting engine generating balance sheet, profit & loss, and trial balance adhering strictly to current/non-current presentation.',
    erpModules: ['balance_sheet', 'income_statement', 'chart_of_accounts'],
    numericalExample: {
      titleAr: 'تصنيف الالتزامات المتداولة وغير المتداولة لقرض طويل الأجل',
      titleEn: 'Current vs Non-Current Portions of Long-Term Debt',
      scenarioAr: 'حصلت الشركة على قرض بنكي بقيمة 1,000,000 ج.م يسدد على 5 أقساط سنوية متساوية بقيمة 200,000 ج.م في نهاية كل سنة.',
      scenarioEn: 'Entity secured 1,000,000 EGP bank loan repayable in 5 equal annual installments of 200,000 EGP at year-end.',
      calculationAr: 'في الميزانية العمومية: القسط المستحق خلال 12 شهراً القادمة (200,000 ج.م) يصنف "التزامات متداولة". باقي رصيد القرض (800,000 ج.م) يصنف "التزامات غير متداولة".',
      calculationEn: 'On balance sheet: Current portion due within 12 months = 200,000 EGP. Non-current debt balance = 800,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ قروض طويلة الأجل (التزامات غير متداولة)',
        accountEn: 'Long-term Bank Loan (Non-Current Liability)',
        debit: '200,000',
        credit: '-',
        notesAr: 'إعادة تبويب الجزء الجاري المستحق خلال العام',
        notesEn: 'Reclassify current portion of long-term debt'
      },
      {
        accountAr: 'حـ/ الجزء المتداول من القروض طويلة الأجل (التزامات متداولة)',
        accountEn: 'Current Portion of Long-term Debt',
        debit: '-',
        credit: '200,000',
        notesAr: 'التزام متداول يستحق السداد خلال 12 شهراً',
        notesEn: 'Current liability due within operating cycle'
      }
    ],
    disclosuresAr: [
      'ملخص السياسات المحاسبية الهامة ومصادر عدم التيقن في التقديرات.',
      'معلومات عن رأس المال المصرح به والمصدر والمدفوع والاحتياطيات.',
      'أي شكوك جوهرية تتعلق بقدرة المنشأة على الاستمرار (Going concern uncertainties).'
    ],
    disclosuresEn: [
      'Summary of material accounting policy information and key sources of estimation uncertainty.',
      'Information regarding share capital authorized, issued, and reserves.',
      'Disclosures of any material uncertainties regarding going concern.'
    ],
    commonPitfallsAr: [
      'إجراء مقاصة غير مبررة بين الأصول والالتزامات (مثل مقاصة رصيد مدين لعميل مع رصيد دائن لنفس العميل كمورد) دون وجود حق قانوني ملزم.',
      'تصنيف التزام طويل الأجل بالكامل كغير متداول دون استقطاع الجزء الذي يستحق السداد خلال العام الحالي.'
    ],
    commonPitfallsEn: [
      'Inappropriate offsetting of assets against liabilities without enforceable legal right.',
      'Failing to separate the current portion of long-term liabilities into current liabilities.'
    ]
  },

  // ==========================================
  // IAS 8 — ACCOUNTING POLICIES, CHANGES IN ESTIMATES & ERRORS
  // ==========================================
  {
    code: 'IAS 8',
    family: 'IAS',
    titleAr: 'السياسات المحاسبية، والتغييرات في التقديرات المحاسبية، والأخطاء',
    titleEn: 'Accounting Policies, Changes in Accounting Estimates and Errors',
    category: 'presentation',
    effectiveDate: '01/01/2005 (محدث بتعريف التقديرات المحاسبية 2023/2026)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-8-accounting-policies-changes-in-accounting-estimates-and-errors/',
    objectiveAr: 'تحديد معايير اختيار السياسات المحاسبية وتعديلها، والمعالجة المحاسبية للتغير في السياسات والتغير في التقديرات وتصحيح الأخطاء السابقة.',
    objectiveEn: 'Prescribe criteria for selecting and changing accounting policies, together with the accounting treatment and disclosure of changes in policies, estimates, and errors.',
    scopeAr: 'يطبق في اختيار وتطبيق السياسات المحاسبية، والمحاسبة عن التغيرات فيها والتغير في التقديرات وتصحيح أخطاء الفترات السابقة.',
    scopeEn: 'Applies in selecting and applying accounting policies, accounting for changes in policies and estimates, and correcting prior period errors.',
    recognitionAr: 'التغير في السياسة المحاسبية: يطبق بأثر رجعي (Retrospectively). التغير في التقدير المحاسبي: يطبق بأثر مستقبلي (Prospectively). تصحيح الأخطاء الجوهرية: يعالج بأثر رجعي بتعديل الأرباح المبقاة وأرقام المقارنة.',
    recognitionEn: 'Change in policy = Retrospective application. Change in estimate = Prospective application in current and future periods. Prior period material errors = Retrospective restatement.',
    measurementInitialAr: 'إعادة صياغة أرقام المقارنة في أول فترة معروضة عند التطبيق بأثر رجعي مع تعديل رصيد أول المدة للأرباح المبقاة.',
    measurementInitialEn: 'Restate comparative amounts for prior periods presented, adjusting opening retained earnings.',
    measurementSubsequentAr: 'التمييز بين التقدير المحاسبي (مثل العمر الإنتاجي، مخصص الديون، القيمة التخريدية) وبين السياسة (مثل التحول من التكلفة إلى القيمة العادلة).',
    measurementSubsequentEn: 'Differentiate between accounting estimate (e.g. depreciation life, ECL allowance) and accounting policy (e.g. Cost vs Fair Value).',
    erpImplementationAr: 'إغلاق الفترات المحاسبية ومنع التعديل في القيود المرحلة السابقة إلا عبر قيود تسوية نظامية مؤرخة وموثقة في سجل التدقيق.',
    erpImplementationEn: 'Period closing controls preventing retroactive mutation of posted entries, forcing compliant adjustment entries with full audit trail logging.',
    erpModules: ['journal_entries', 'audit_logs', 'settings'],
    numericalExample: {
      titleAr: 'تعديل العمر الإنتاجي لأصل ثابت (تغير في التقدير بأثر مستقبلي)',
      titleEn: 'Prospective Change in Asset Depreciation Estimate',
      scenarioAr: 'آلة تكلفتها 200,000 ج.م أهلكت على مدار سنتين بواقع 20,000 ج.م سنوياً (مجمع الإهلاك = 40,000 ج.م، القيمة الدفترية = 160,000 ج.م). قررت الإدارة تعديل العمر المتبقي ليصبح 4 سنوات بدلاً من 8 سنوات.',
      scenarioEn: 'Machine cost 200k, depreciated for 2 years at 20k/yr (carrying value 160k). Management revises remaining useful life to 4 years instead of 8 years.',
      calculationAr: 'التعديل يطبق بأثر مستقبلي: القيمة الدفترية المتبقية (160,000 ج.م) تقسم على العمر الجديد المتبقي (4 سنوات) = قسط الإهلاك الجديد 40,000 ج.م سنوياً (دون تعديل أرباح السنوات السابقة).',
      calculationEn: 'Prospective calculation: Remaining book value (160,000 EGP) / new remaining life (4 years) = 40,000 EGP new annual depreciation. No prior period restatement.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصروف إهلاك الآلات (بالقسط الجديد)',
        accountEn: 'Depreciation Expense - Revised Estimate',
        debit: '40,000',
        credit: '-',
        notesAr: 'تحميل السنة الحالية بالإهلاك الجديد وفق التقدير المعدل',
        notesEn: 'Recognize prospective revised depreciation charge'
      },
      {
        accountAr: 'حـ/ مجمع إهلاك الآلات',
        accountEn: 'Accumulated Depreciation - Machinery',
        debit: '-',
        credit: '40,000',
        notesAr: 'إثبات مجمع الإهلاك السنوي الجديد',
        notesEn: 'Record updated accumulated depreciation'
      }
    ],
    disclosuresAr: [
      'طبيعة ومبلغ التغير في التقدير المحاسبي وأثره على الفترة الحالية والفترات المستقبلية.',
      'طبيعة التغير في السياسة المحاسبية والأسباب التي تجعل السياسة الجديدة توفر معلومات أكثر ملاءمة وموثوقية.',
      'طبيعة ومبالغ تصحيح أخطاء الفترات السابقة وتأثيرها على كل بند من بنود القوائم المالية.'
    ],
    disclosuresEn: [
      'Nature and amount of change in an accounting estimate affecting current and future periods.',
      'Reason why new accounting policy provides reliable and more relevant information.',
      'Nature of prior period errors and amount of correction for each financial statement line item.'
    ],
    commonPitfallsAr: [
      'معالجة التغير في العمر الإنتاجي أو القيمة التخريدية بأثر رجعي، وهو مخالف تماماً لأنها تغيرات في تقديرات وليست أخطاء.',
      'تصحيح خطأ حسابي في السنوات السابقة عبر قيده في مصروفات السنة الحالية دون تعديل الأرباح المبقاة وأرقام المقارنة.'
    ],
    commonPitfallsEn: [
      'Treating changes in useful life or salvage values as retrospective policy changes instead of prospective estimate adjustments.',
      'Burying prior-period error corrections in current year operating expenses without restating opening retained earnings.'
    ]
  },

  // ==========================================
  // IFRS 3 — BUSINESS COMBINATIONS & GOODWILL
  // ==========================================
  {
    code: 'IFRS 3',
    family: 'IFRS',
    titleAr: 'تجميع الأعمال (الاستحواذ، الشهرة، والقيمة العادلة للأصول المشتراة)',
    titleEn: 'Business Combinations (Acquisition Method, Purchase Price & Goodwill)',
    category: 'group',
    effectiveDate: '01/07/2009 (محدث بإرشادات الأصول والالتزامات المحتملة 2026)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-3-business-combinations/',
    objectiveAr: 'تحسين الملاءمة وقابلية المقارنة للمعلومات المالية المقدمة حول تجميع الأعمال وآثارها من خلال تطبيق طريقة الاستحواذ (Acquisition Method).',
    objectiveEn: 'Improve the relevance and comparability of information that a reporting entity provides about a business combination and its effects by applying the acquisition method.',
    scopeAr: 'يطبق على المعاملات التي تنطبق عليها شروط تجميع الأعمال (السيطرة على شركة أو عمل تجاري متكامل).',
    scopeEn: 'Applies to transactions meeting definition of a business combination (acquiring control of one or more businesses).',
    recognitionAr: 'تطبيق طريقة الاستحواذ: 1. تحديد المشتري، 2. تحديد تاريخ الاستحواذ، 3. إثبات وقياس الأصول المستحوذ عليها والالتزامات بالقيمة العادلة، 4. إثبات الشهرة (Goodwill) أو مكاسب الشراء بسعر تفاوضي (Bargain Purchase).',
    recognitionEn: 'Acquisition method steps: 1. Identify acquirer, 2. Determine acquisition date, 3. Recognize and measure identifiable assets and liabilities at fair value, 4. Recognize goodwill or bargain purchase gain.',
    measurementInitialAr: 'الشهرة = مقابل الانتقال المحول (Consideration transferred) + حقوق الأقلية غير المسيطرة (NCI) - صافي القيمة العادلة للأصول المحددة المقتناة.',
    measurementInitialEn: 'Goodwill = Consideration transferred + Non-controlling interest (NCI) - Net identifiable assets acquired at fair value.',
    measurementSubsequentAr: 'الشهرة لا تطفأ، بل تخضع لاختبار انخفاض القيمة السنوي الإلزامي وفق IAS 36. أما إذا كان الناتج مكاسب شراء بسعر تفاوضي (سالب) فتثبت فوراً كربح في قائمة الدخل.',
    measurementSubsequentEn: 'Goodwill is capitalized and never amortized; subject to annual mandatory impairment testing under IAS 36. Bargain purchase gain recognized in P&L.',
    erpImplementationAr: 'إدارة توحيد الحسابات والاستحواذات وقيود التسوية وتتبع رصيد الشهرة وحقوق الأقلية في موديول الشركات القابضة والمجموعات.',
    erpImplementationEn: 'Consolidation module tracking purchase price allocations, fair value adjustments, NCI, and goodwill impairment tracking across subsidiary entities.',
    erpModules: ['chart_of_accounts', 'journal_entries', 'balance_sheet'],
    numericalExample: {
      titleAr: 'حساب الشهرة الناتجة عن الاستحواذ على شركة',
      titleEn: 'Goodwill Calculation on Acquisition of 100% Equity',
      scenarioAr: 'استحوذت المنشأة على 100% من أسهم شركة أخرى بسعر 1,500,000 ج.م نقداً. كانت القيمة العادلة للأصول المحددة 1,800,000 ج.م والالتزامات 600,000 ج.م (صافي الأصول = 1,200,000 ج.م).',
      scenarioEn: 'Entity acquired 100% of target company for 1,500,000 EGP cash. Fair value of identifiable assets = 1,800,000 EGP, liabilities = 600,000 EGP (Net Assets = 1,200,000 EGP).',
      calculationAr: 'صافي القيمة العادلة للأصول = 1,800,000 - 600,000 = 1,200,000 ج.م. الشهرة = الثمن المدفوع (1,500,000) - صافي الأصول (1,200,000) = 300,000 ج.م ترسمل كأصل غير ملموس (شهرة).',
      calculationEn: 'Net identifiable assets = 1.8M - 600k = 1,200,000 EGP. Goodwill = 1,500,000 - 1,200,000 = 300,000 EGP capitalized on balance sheet.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ الأصول المحددة المستحوذ عليها (بالقيمة العادلة)',
        accountEn: 'Identifiable Assets Acquired (Fair Value)',
        debit: '1,800,000',
        credit: '-',
        notesAr: 'إثبات أصول الشركة المستحوذ عليها بقيمتها العادلة',
        notesEn: 'Recognize acquired tangible/intangible assets at fair value'
      },
      {
        accountAr: 'حـ/ الشهرة الناتجة عن الاستحواذ (أصل غير ملموس)',
        accountEn: 'Goodwill on Acquisition',
        debit: '300,000',
        credit: '-',
        notesAr: 'الفرق الموجب بين مقابل الاستحواذ وصافي الأصول',
        notesEn: 'Excess of consideration transferred over net assets'
      },
      {
        accountAr: 'حـ/ الالتزامات المستحوذ عليها (بالقيمة العادلة)',
        accountEn: 'Liabilities Assumed (Fair Value)',
        debit: '-',
        credit: '600,000',
        notesAr: 'إثبات الالتزامات الفعلية والمحتملة للشركة المستحوذ عليها',
        notesEn: 'Fair value of obligations assumed'
      },
      {
        accountAr: 'حـ/ البنك (مقابل الاستحواذ المسدد)',
        accountEn: 'Bank Account (Purchase Consideration)',
        debit: '-',
        credit: '1,500,000',
        notesAr: 'النقدية المسددة في صفقة الاستحواذ',
        notesEn: 'Cash consideration paid to vendors'
      }
    ],
    disclosuresAr: [
      'اسم ووصف المنشأة المستحوذ عليها وتاريخ الاستحواذ والنسبة المئوية لأسهم التصويت المقتناة.',
      'القيمة العادلة في تاريخ الاستحواذ للمقابل المحول ولكل فئة رئيسية من الأصول والالتزامات.',
      'وصف العوامل التي تشكل الشهرة المعترف بها مثل المزايا التنافسية والقوى العاملة الماهرة.'
    ],
    disclosuresEn: [
      'Name and description of acquiree, acquisition date, and percentage of voting equity acquired.',
      'Fair value of consideration transferred and major classes of assets acquired and liabilities assumed.',
      'Qualitative description of factors that make up goodwill recognized (e.g. synergies, workforce).'
    ],
    commonPitfallsAr: [
      'إدراج مصاريف الاستشارات القانونية والمالية للصفقة ضمن تكلفة الشهرة، بينما يوجب المعيار قيدها كمصروفات فورية في قائمة الدخل.',
      'إطفاء الشهرة على مدار سنوات كإهلاك دوري، وهو أمر ممنوع في IFRS حيث لا تطفأ الشهرة بل تختبر سنوياً للهبوط.'
    ],
    commonPitfallsEn: [
      'Capitalizing acquisition-related advisory and legal fees into goodwill instead of expensing immediately in P&L.',
      'Amortizing goodwill over arbitrary useful life; IFRS requires annual impairment testing only.'
    ]
  },

  // ==========================================
  // IFRS 10 — CONSOLIDATED FINANCIAL STATEMENTS
  // ==========================================
  {
    code: 'IFRS 10',
    family: 'IFRS',
    titleAr: 'القوائم المالية الموحدة (نموذج السيطرة Control Model وحقوق الأقلية)',
    titleEn: 'Consolidated Financial Statements (Single Control Model & NCI)',
    category: 'group',
    effectiveDate: '01/01/2013 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-10-consolidated-financial-statements/',
    objectiveAr: 'وضع مبادئ لعرض وإعداد القوائم المالية الموحدة عندما تسيطر منشأة على منشأة أو أكثر من المنشآت الأخرى.',
    objectiveEn: 'Establish principles for the presentation and preparation of consolidated financial statements when an entity controls one or more other entities.',
    scopeAr: 'يلزم الشركة الأم بإعداد قوائم مالية موحدة لجميع الشركات التابعة التي تسيطر عليها.',
    scopeEn: 'Mandates that a parent entity presenting consolidated financial statements must consolidate all subsidiaries it controls.',
    recognitionAr: 'تعريف موحد للسيطرة (Control) يرتكز على 3 أركان: 1. السلطة على المنشأة المستثمر فيها (Power)، 2. التعرض لحقوق متغيرة في العوائد (Variable returns)، 3. القدرة على استخدام السلطة للتأثير على تلك العوائد.',
    recognitionEn: 'Single control model based on 3 elements: 1. Power over investee, 2. Exposure or rights to variable returns, 3. Ability to use power to affect those returns.',
    measurementInitialAr: 'توحيد بنود الأصول والالتزامات وحقوق الملكية والإيرادات والمصروفات سطراً بسطر (Line-by-line)، وإلغاء كامل المعاملات والأرصدة والأرباح غير المحققة المتبادلة بين شركات المجموعة.',
    measurementInitialEn: 'Combine like items of assets, liabilities, equity, income, expenses line-by-line; fully eliminate intercompany balances, transactions, and unrealized intra-group profits.',
    measurementSubsequentAr: 'عرض حقوق الأقلية غير المسيطرة (Non-Controlling Interests - NCI) بشكل منفصل داخل حقوق الملكية في الميزانية العمومية الموحدة.',
    measurementSubsequentEn: 'Present non-controlling interests (NCI) within consolidated equity, separately from equity of parent owners.',
    erpImplementationAr: 'إدارة شجرة الحسابات متعددة الكيانات (Multi-Entity)، وتشغيل قيود التوحيد وإلغاء حسابات المعاملات البينية (Intercompany Eliminations) بضغطة زر.',
    erpImplementationEn: 'Multi-entity ledger structure supporting automated intercompany matching, currency translation, and elimination journal generations for group consolidation.',
    erpModules: ['chart_of_accounts', 'journal_entries', 'balance_sheet'],
    numericalExample: {
      titleAr: 'إلغاء مبيعات وأرباح غير محققة بين شركات المجموعة',
      titleEn: 'Elimination of Intercompany Sales and Unrealized Inventory Profit',
      scenarioAr: 'باعت الشركة الأم بضاعة لشركتها التابعة بمبلغ 200,000 ج.م بتكلفة 150,000 ج.م (هامش ربح 50,000 ج.م). في نهاية العام، ما زالت نصف البضاعة (100,000 ج.م) في مخازن التابعة لم تبع لأطراف خارجية.',
      scenarioEn: 'Parent sold goods to subsidiary for 200k at cost of 150k (50k intercompany profit). At year-end, 50% of the goods (100k) remain unsold in subsidiary warehouse.',
      calculationAr: 'إلغاء المبيعات وتكلفة المبيعات البينية بمبلغ 200,000 ج.م. الربح غير المحقق المحتجز في المخزون = 50,000 × 50% = 25,000 ج.م يجب إلغاؤه من المخزون والأرباح الموحدة.',
      calculationEn: 'Eliminate total intercompany sales & COGS of 200k. Eliminate unrealized intra-group inventory profit of 25,000 EGP (50k profit x 50% unsold) from inventory and profit.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ إيراد المبيعات (المعاملات البينية للمجموعة)',
        accountEn: 'Intercompany Sales Revenue',
        debit: '200,000',
        credit: '-',
        notesAr: 'إلغاء إجمالي المبيعات المتبادلة بين الأم والتابعة',
        notesEn: 'Eliminate 100% of intercompany sales transaction'
      },
      {
        accountAr: 'حـ/ تكلفة المبيعات (المجموعة)',
        accountEn: 'Cost of Goods Sold (Intercompany)',
        debit: '-',
        credit: '175,000',
        notesAr: 'تعديل تكلفة المبيعات باستبعاد التكلفة البينية والربح المحقق',
        notesEn: 'Adjust consolidated COGS'
      },
      {
        accountAr: 'حـ/ المخزون (الأرباح البينية غير المحققة)',
        accountEn: 'Inventories (Unrealized Profit Elimination)',
        debit: '-',
        credit: '25,000',
        notesAr: 'تخفيض قيمة المخزون بالربح غير المحقق للوصول للتكلفة الأصلية للمجموعة',
        notesEn: 'Reduce inventory carrying value to original group cost'
      }
    ],
    disclosuresAr: [
      'قائمة بجميع الشركات التابعة الهامة، ونسبة الملكية وحقوق التصويت.',
      'الأحكام والافتراضات الجوهرية المتبعة في تحديد وجود السيطرة عند امتلاك أقل من نصف حقوق التصويت.',
      'طبيعة ومدى القيود المفروضة على قدرة التابعة على تحويل أموال إلى الشركة الأم.'
    ],
    disclosuresEn: [
      'List of significant subsidiaries, country of incorporation, and voting interest held.',
      'Significant judgements in determining control where parent holds <= 50% of voting rights.',
      'Nature and extent of significant restrictions on ability to transfer cash or assets to parent.'
    ],
    commonPitfallsAr: [
      'عدم إلغاء الأرباح غير المحققة للمخزون المتبادل بين شركات المجموعة، مما يضخم أرباح الميزانية الموحدة.',
      'عرض حصة الأقلية (NCI) كالتزام دائن بدلاً من عرضها بشكل صحيح ومستقل داخل قسم حقوق الملكية.'
    ],
    commonPitfallsEn: [
      'Failing to eliminate unrealized profit in ending inventory from intra-group sales.',
      'Presenting non-controlling interests as debt or liability rather than integral equity component.'
    ]
  },

  // ==========================================
  // IAS 19 — EMPLOYEE BENEFITS (END OF SERVICE)
  // ==========================================
  {
    code: 'IAS 19',
    family: 'IAS',
    titleAr: 'منافع الموظفين (مكافأة نهاية الخدمة، المزايا محددة المنافع DBO)',
    titleEn: 'Employee Benefits (End-of-Service Gratuity & Defined Benefit Obligations DBO)',
    category: 'liabilities_equity',
    effectiveDate: '01/01/2013 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-19-employee-benefits/',
    objectiveAr: 'تحديد المعالجة المحاسبية والإفصاح عن منافع الموظفين بما في ذلك المنافع قصيرة الأجل ومنافع ما بعد انتهاء الخدمة (مثل مكافأة نهاية الخدمة الإلزامية بالقوانين العمالية).',
    objectiveEn: 'Prescribe the accounting and disclosure for employee benefits: short-term benefits, post-employment benefits (defined contribution & defined benefit schemes like End of Service Indmenity).',
    scopeAr: 'يطبق على جميع أشكال العوض الممنوح من المنشأة للموظفين مقابل خدماتهم.',
    scopeEn: 'Applies to all employee compensation, short-term benefits, bonuses, and post-employment obligations.',
    recognitionAr: 'المنافع قصيرة الأجل (الأجور، الإجازات): تثبت كمصروف فور تقديم الخدمة. مكافأة نهاية الخدمة (End-of-Service): تصنف كخطط منافع محددة (Defined Benefit Obligation) تتطلب تقييماً اكتوارياً (Actuarial Valuation).',
    recognitionEn: 'Short-term benefits expensed as incurred. End-of-service indemnity categorized as defined benefit plan requiring actuarial valuation using Projected Unit Credit Method.',
    measurementInitialAr: 'استخدام طريقة وحدة الائتمان المقدرة (Projected Unit Credit Method) لحساب القيمة الحالية للالتزام باستخدام افتراضات اكتوارية (معدل الخصم، معدل نمو الرواتب، معدل دوران العمالة).',
    measurementInitialEn: 'Measured using Projected Unit Credit Method discounting expected benefits using high quality corporate bond or government bond yields.',
    measurementSubsequentAr: 'تكلفة الخدمة الحالية وتكلفة الفائدة تثبت في قائمة الأرباح أو الخسائر (P&L). أما الأرباح أو الخسائر الاكتوارية (Remeasurements) الناتجة عن تعديل الافتراضات فتثبت فوراً في الدخل الشامل الآخر (OCI) ولا يعاد تدويرها.',
    measurementSubsequentEn: 'Current service cost and net interest recognized in P&L. Actuarial remeasurement gains/losses recognized immediately in OCI and never recycled.',
    erpImplementationAr: 'إدارة استحقاقات الإجازات وتذاكر السفر ومكافأة نهاية الخدمة في موديول الرواتب وشؤون الموظفين وترحيل القيود الشهرية.',
    erpImplementationEn: 'Payroll & HR module accruals for leaves, annual bonuses, and end-of-service liability provision entries linked directly to General Ledger.',
    erpModules: ['payroll', 'journal_entries', 'balance_sheet'],
    numericalExample: {
      titleAr: 'إثبات مصروف مكافأة نهاية الخدمة السنوية والأرباح الاكتوارية',
      titleEn: 'End of Service Current Service Cost & Actuarial Remeasurement',
      scenarioAr: 'أظهر التقرير الاكتواري السنوي لمكافأة نهاية الخدمة: تكلفة الخدمة الحالية 80,000 ج.م، وتكلفة الفائدة الصافية 20,000 ج.م، وربح اكتواري ناتج عن تغير معدل الخصم قدره 15,000 ج.م.',
      scenarioEn: 'Actuarial valuation for End of Service Gratutity reports: Current service cost 80k, Net interest 20k, Actuarial gain from discount rate change 15k.',
      calculationAr: 'مصروف قائمة الدخل (P&L) = 80,000 + 20,000 = 100,000 ج.م. الدخل الشامل الآخر (OCI) = ربح اكتواري دائن 15,000 ج.م. صافي الزيادة في التزام نهاية الخدمة = 100,000 - 15,000 = 85,000 ج.م.',
      calculationEn: 'P&L expense = 80k + 20k = 100,000 EGP. OCI actuarial gain = 15,000 EGP. Net increase in End of Service Obligation liability = 85,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصروف منافع الموظفين - نهاية الخدمة (قائمة الدخل P&L)',
        accountEn: 'Employee Benefits Expense - Service & Interest (P&L)',
        debit: '100,000',
        credit: '-',
        notesAr: 'تكلفة الخدمة الحالية والفائدة التمويلية للالتزام',
        notesEn: 'Current service cost plus net interest component'
      },
      {
        accountAr: 'حـ/ التزام مكافأة نهاية الخدمة للموظفين (الخصوم غير المتداولة)',
        accountEn: 'End of Service Indemnity Obligation (DBO)',
        debit: '-',
        credit: '85,000',
        notesAr: 'صافي الزيادة في التزام مكافأة نهاية الخدمة بالميزانية',
        notesEn: 'Net increase in post-employment obligation'
      },
      {
        accountAr: 'حـ/ أرباح اكتوارية لإعادة قياس منافع الموظفين (OCI)',
        accountEn: 'Actuarial Remeasurement Gain (OCI)',
        debit: '-',
        credit: '15,000',
        notesAr: 'تثبت في الدخل الشامل الآخر ولا تدور للأرباح أو الخسائر',
        notesEn: 'Recognized in other comprehensive income not reclassified'
      }
    ],
    disclosuresAr: [
      'شرح لخصائص خطط المنافع المحددة والمخاطر المرتبطة بها.',
      'مطابقة تفصيلية لأرصدة بداية ونهاية الفترة لالتزام المنافع المحددة.',
      'الافتراضات الاكتوارية الرئيسية (معدل الخصم، معدل التضخم، زيادة الرواتب) وتحليل الحساسية لها.'
    ],
    disclosuresEn: [
      'Description of plan characteristics and regulatory risks.',
      'Detailed reconciliation of opening to closing balances of defined benefit obligation.',
      'Key actuarial assumptions (discount rates, salary escalations, turnover) and sensitivity analysis.'
    ],
    commonPitfallsAr: [
      'حساب مكافأة نهاية الخدمة بطريقة حسابية مبسطة (الراتب الأخير × السنوات) دون تطبيق نموذج القيمة الحالية الاكتواري وفق IAS 19.',
      'إدراج الأرباح والخسائر الاكتوارية في قائمة الأرباح أو الخسائر العادية بدلاً من حصرها في الدخل الشامل الآخر (OCI).'
    ],
    commonPitfallsEn: [
      'Calculating end-of-service liability based on undiscounted last salary times tenure, ignoring mandatory actuarial present value.',
      'Recycling actuarial OCI gains or losses into profit and loss in future years.'
    ]
  },

  // ==========================================
  // IFRS 13 — FAIR VALUE MEASUREMENT
  // ==========================================
  {
    code: 'IFRS 13',
    family: 'IFRS',
    titleAr: 'قياس القيمة العادلة (هيكل المستويات الثلاثة Level 1, 2, 3)',
    titleEn: 'Fair Value Measurement (3-Level Hierarchy & Valuation Framework)',
    category: 'specialized',
    effectiveDate: '01/01/2013 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-13-fair-value-measurement/',
    objectiveAr: 'تحديد إطار موحد لقياس القيمة العادلة وتوحيد تعريفها ووضع متطلبات الإفصاح عن قياسات القيمة العادلة عبر معايير IFRS.',
    objectiveEn: 'Define fair value, set out a single framework for measuring fair value, and require disclosures about fair value measurements across all standards.',
    scopeAr: 'يطبق عند طلب أو سماح أي معيار من معايير IFRS الأخرى بقياس القيمة العادلة (مثل IFRS 9, IAS 16, IAS 40, IFRS 3).',
    scopeEn: 'Applies when another IFRS standard requires or permits fair value measurements or disclosures.',
    recognitionAr: 'تعريف القيمة العادلة: "السعر الذي سيتم استلامه لبيع أصل أو دفعه لنقل التزام في معاملة نظامية بين مشاركين في السوق في تاريخ القياس (سعر الخروج Exit Price)".',
    recognitionEn: 'Defined as: "The price that would be received to sell an asset or paid to transfer a liability in an orderly transaction between market participants at the measurement date (exit price)".',
    measurementInitialAr: 'تحديد السوق الرئيسي (Principal Market) أو السوق الأكثر فائدة، وتحديد أعلى وأفضل استخدام (Highest and Best Use) للأصول غير المالية.',
    measurementInitialEn: 'Based on principal or most advantageous market, and highest and best use for non-financial assets.',
    measurementSubsequentAr: 'تصنيف المدخلات إلى 3 مستويات: المستوى 1 (أسعار معلنة في أسواق نشطة)، المستوى 2 (مدخلات يمكن ملاحظتها بخلاف المستوى 1)، المستوى 3 (مدخلات غير قابلة للملاحظة في السوق وتعتمد على نماذج وتقديرات).',
    measurementSubsequentEn: 'Fair value hierarchy: Level 1 (quoted prices in active markets), Level 2 (observable inputs), Level 3 (unobservable internal inputs & DCF models).',
    erpImplementationAr: 'تسجيل مستويات القيمة العادلة ومصادر التسعير المعتمدة للأوراق المالية والاستثمارات والأصول المعاد تقييمها.',
    erpImplementationEn: 'Audit-ready hierarchy tagging for investments, derivative financial instruments, and property valuations.',
    erpModules: ['chart_of_accounts', 'fixed_assets', 'journal_entries'],
    numericalExample: {
      titleAr: 'تصنيف استثمارات مالية وعقارات وفق مستويات القيمة العادلة',
      titleEn: 'Fair Value Hierarchy Allocation Example',
      scenarioAr: 'تمتلك المنشأة: أسهم مدرجة بالبورصة بقيمة 500,000 ج.م، سندات غير مدرجة يتم تسعيرها استناداً لمنحنيات العائد السوقية 300,000 ج.م، وحصة في شركة مغلقة قدرت بنموذج التدفقات المخصومة 200,000 ج.م.',
      scenarioEn: 'Entity owns: Listed shares 500k, unlisted bonds priced via observable yield curves 300k, and private equity stake valued via DCF model 200k.',
      calculationAr: 'الأسهم المدرجة = المستوى 1 (Level 1). السندات المسعرة بمنحنيات العائد = المستوى 2 (Level 2). حصة الشركة المغلقة بنموذج التدفقات = المستوى 3 (Level 3).',
      calculationEn: 'Listed shares = Level 1 (quoted). Unlisted bonds = Level 2 (observable model). Private equity stake = Level 3 (unobservable inputs).'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ استثمارات مالية بالقيمة العادلة (المستوى 1)',
        accountEn: 'Financial Assets at Fair Value (Level 1)',
        debit: '50,000',
        credit: '-',
        notesAr: 'إثبات الزيادة السوقية في الأسهم المتداولة بالبورصة',
        notesEn: 'Recognize mark-to-market gain on Level 1 shares'
      },
      {
        accountAr: 'حـ/ أرباح تقييم أدوات مالية بالقيمة العادلة (قائمة الدخل)',
        accountEn: 'Fair Value Gain on Investments (P&L)',
        debit: '-',
        credit: '50,000',
        notesAr: 'إثبات الأرباح السوقية المحققة من إعادة التقييم',
        notesEn: 'Fair value adjustment gain recognized in P&L'
      }
    ],
    disclosuresAr: [
      'تبويب القياسات بالقيمة العادلة حسب المستويات الثلاثة في تسلسل القيمة العادلة.',
      'طرق التقييم والمدخلات المستخدمة للقياسات في المستويين 2 و 3.',
      'تسوية حركة الأرصدة للمستوى 3 من أول الفترة لآخرها مع تحليل حساسية المدخلات غير القابلة للملاحظة.'
    ],
    disclosuresEn: [
      'Fair value measurement disclosure by hierarchy level (Level 1, 2, 3).',
      'Valuation techniques and observable/unobservable inputs for Levels 2 and 3.',
      'Reconciliation of beginning to ending balances for Level 3 measurements with sensitivity testing.'
    ],
    commonPitfallsAr: [
      'تصنيف استثمارات غير مدرجة ضمن المستوى 1 لمجرد وجود تقرير تقييم من خبير، بينما تندرج حكماً تحت المستوى 2 أو 3.',
      'عدم الإفصاح عن تحليل الحساسية لمدخلات المستوى 3 غير القابلة للملاحظة.'
    ],
    commonPitfallsEn: [
      'Misclassifying private unquoted instruments as Level 1.',
      'Omitting quantitative sensitivity disclosures for significant unobservable Level 3 inputs.'
    ]
  }
,
// ==========================================
  // IFRS 1 — First-time Adoption of IFRS
  // ==========================================
  {
    code: 'IFRS 1',
    family: 'IFRS',
    titleAr: 'تطبيق المعايير الدولية لإعداد التقارير المالية لأول مرة',
    titleEn: 'First-time Adoption of International Financial Reporting Standards',
    category: 'presentation',
    effectiveDate: '01/01/2004 (محدث باستمرار)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-1-first-time-adoption-of-international-financial-reporting-standards/',
    objectiveAr: 'ضمان أن أول قوائم مالية للمنشأة معدة وفقاً لمعايير IFRS تحتوي على معلومات عالية الجودة، شفافة وقابلة للمقارنة، وتوفر نقطة انطلاق مناسبة للمحاسبة بموجب المعايير الدولية بتكلفة لا تتجاوز المنافع.',
    objectiveEn: 'Ensure that an entity\'s first IFRS financial statements contain high-quality, transparent, comparable information and provide a suitable starting point at a cost not exceeding benefits.',
    scopeAr: 'يطبق عند أول قوائم مالية سنوية تصرح فيها المنشأة صراحة ودون تحفظ بالتوافق مع المعايير الدولية IFRS.',
    scopeEn: 'Applies to the first annual financial statements in which an entity adopts IFRSs with an explicit and unreserved statement of compliance.',
    recognitionAr: 'إعداد ميزانية افتتاحية وفق IFRS في تاريخ التحول (Transition Date)، والاعتراف بجميع الأصول والالتزامات المطلوبة وفق IFRS، واستبعاد ما لا تسمح به IFRS.',
    recognitionEn: 'Prepare an opening IFRS statement of financial position at the date of transition; recognize all required assets/liabilities and derecognize non-permitted items.',
    measurementInitialAr: 'إعادة تصنيف البنود وتطبيق قياسات IFRS بأثر رجعي مع إمكانية استخدام الإعفاءات الاختيارية (مثل القيمة العادلة كتكلفة مفترضة للأصول الثابتة). وتُسجل فروق التحول مباشرة في الأرباح المبقاة (Retained Earnings).',
    measurementInitialEn: 'Measure all recognized assets and liabilities under IFRS retrospectively, utilizing mandatory exceptions and optional exemptions (e.g., deemed cost for PPE). Transition adjustments go to retained earnings.',
    measurementSubsequentAr: 'تطبيق كافة معايير IFRS السارية في نهاية فترة التقرير الأولى بأثر رجعي.',
    measurementSubsequentEn: 'Apply full subsequent measurement under each individual IFRS standard continuously.',
    erpImplementationAr: 'إنشاء دفتر أستاذ موازي للتحول (Opening Balance Migration Journal)، وتسجيل قيود التسوية الافتتاحية في حساب الأرباح المبقاة IFRS Transition.',
    erpImplementationEn: 'Setup transition migration ledger, map local GAAP accounts to IFRS COA, and record opening adjustments directly to Retained Earnings reserve.',
    erpModules: ['chart_of_accounts', 'journal_entries', 'general_ledger'],
    numericalExample: {
      titleAr: 'تسويات التحول إلى المعايير الدولية وإثبات التكلفة المفترضة للأصول',
      titleEn: 'IFRS 1 Opening Balance Adjustment & Deemed Cost',
      scenarioAr: 'شركة تتحول لـ IFRS في 01/01/2025. كانت تظهر أصولاً ثابتة بقيمة دفترية محلية 1,000,000 ج.م، وبلغت قيمتها العادلة في تاريخ التحول 1,800,000 ج.م وقررت استخدامها كتكلفة مفترضة، مع وجود مخصصات غير متوافقة بـ 200,000 ج.م يجب استبعادها.',
      scenarioEn: 'Entity adopts IFRS on 01/01/2025. Local GAAP PPE carrying value 1,000,000 EGP, fair value at transition 1,800,000 EGP used as deemed cost. Non-compliant local provision of 200,000 EGP must be derecognized.',
      calculationAr: 'الزيادة في الأصول الثابتة = 800,000 ج.م. استبعاد المخصص = 200,000 ج.م. إجمالي أثر التسوية الموجب المحول للأرباح المبقاة = 800,000 + 200,000 = 1,000,000 ج.م.',
      calculationEn: 'PPE uplift = 800,000 EGP. Provision reversal = 200,000 EGP. Total opening transition adjustment credited to Retained Earnings = 1,000,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ الأصول الثابتة (تسوية القيمة المفترضة)',
        accountEn: 'Property, Plant and Equipment (Deemed Cost Uplift)',
        debit: '800,000',
        credit: '-',
        notesAr: 'رفع قيمة الأصول للقيمة العادلة المعتمدة كتكلفة مفترضة',
        notesEn: 'Record deemed cost fair value adjustment at transition'
      },
      {
        accountAr: 'حـ/ مخصصات عامة غير مستوفية لشروط IFRS',
        accountEn: 'Derecognition of Non-Compliant Provisions',
        debit: '200,000',
        credit: '-',
        notesAr: 'إلغاء مخصصات لا تستوفي شروط معيار IAS 37',
        notesEn: 'Derecognize local general reserves not meeting IAS 37'
      },
      {
        accountAr: 'حـ/ حقوق الملكية - تسويات التحول لمعايير IFRS (الأرباح المبقاة)',
        accountEn: 'Retained Earnings - IFRS Transition Reserve',
        debit: '-',
        credit: '1,000,000',
        notesAr: 'ترحيل صافي أثر تسويات الافتتاح لحقوق الملكية مباشرة',
        notesEn: 'Cumulative transition adjustments recognized in Retained Earnings'
      }
    ],
    disclosuresAr: [
      'تسوية حقوق الملكية المقررة وفق المعايير السابقة مع حقوق الملكية وفق IFRS في تاريخ التحول ونهاية آخر فترة سابقة.',
      'تسوية إجمالي الدخل الشامل للفترة المقارنة الأخيرة.',
      'شرح طبيعة التسويات المحاسبية التي طرأت على الأصول والالتزامات.',
      'الإفصاح عن استخدام الإعفاءات الاختيارية (كالقيم العادلة كتكلفة مفترضة).'
    ],
    disclosuresEn: [
      'Reconciliation of equity reported under previous GAAP to IFRS equity at transition date and end of latest comparative period.',
      'Reconciliation of total comprehensive income for the latest comparative period.',
      'Explanations of material adjustments to statement of cash flows.',
      'Disclosures on optional exemptions used (e.g., deemed cost fair valuations).'
    ],
    commonPitfallsAr: [
      'تسجيل فروق التحول في قائمة الأرباح والخسائر الجارية بدلاً من إدراجها مباشرة في الأرباح المبقاة بافتتاح الفترة.',
      'عدم إعداد قائمة المركز المالي الافتتاحية في تاريخ التحول (قبل عام من أول فترة عرض كاملة).'
    ],
    commonPitfallsEn: [
      'Recognizing transition adjustments in current P&L rather than directly in retained earnings.',
      'Failing to prepare the opening balance sheet as of the transition date (one full year prior to comparative period).'
    ]
  },

  // ==========================================
  // IFRS 2 — Share-based Payment
  // ==========================================
  {
    code: 'IFRS 2',
    family: 'IFRS',
    titleAr: 'المدفوعات على أساس الأسهم',
    titleEn: 'Share-based Payment',
    category: 'liabilities_equity',
    effectiveDate: '01/01/2005 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-2-share-based-payment/',
    objectiveAr: 'تحديد المعالجة المحاسبية عندما تمنح المنشأة أسهماً أو خيارات أسهم أو تسدد التزامات نقدية مبنية على قيمة أسهم الشركة للموظفين أو الموردين مقابل سلع أو خدمات.',
    objectiveEn: 'Specify the financial reporting when an entity undertakes a share-based payment transaction, including grants of shares or share options to employees.',
    scopeAr: 'جميع معاملات المدفوعات المسددة بحقوق ملكية (Equity-settled) أو المسددة نقداً (Cash-settled) مقابل خدمات موظفين أو بضائع وخدمات.',
    scopeEn: 'All equity-settled, cash-settled, or choice-of-settlement share-based payment transactions.',
    recognitionAr: 'الاعتراف بالمصروف أو الأصل عند استلام السلع أو الخدمات مع الاعتراف بزيادة مماثلة إما في حقوق الملكية (للمعاملات المسددة بأسهم) أو التزام (للمعاملات المسددة نقداً).',
    recognitionEn: 'Recognize an expense or asset when goods/services are received, with a corresponding increase in equity (equity-settled) or liability (cash-settled).',
    measurementInitialAr: 'للمعاملات المسددة بحقوق ملكية للموظفين: تقاس بالقيمة العادلة لأدوات حقوق الملكية في تاريخ المنح (Grant Date) دون تعديل لاحق لتغيرات السوق. للمعاملات المسددة نقداً: تقاس بالقيمة العادلة للالتزام ويعاد تقييمها في كل تاريخ تقرير.',
    measurementInitialEn: 'Equity-settled with employees measured at grant-date fair value (not remeasured). Cash-settled measured at fair value of liability and remeasured each period.',
    measurementSubsequentAr: 'توزيع المصروف على مدى فترة استحقاق الحقوق (Vesting Period) استناداً إلى أفضل تقدير لعدد الأدوات المتوقع استحقاقها.',
    measurementSubsequentEn: 'Expense recognized over the vesting period based on the best estimate of the number of equity instruments expected to vest.',
    erpImplementationAr: 'جدولة استحقاق خيارات الأسهم للموظفين، وتوزيع قيد الاستحقاق الشهري الآلي بين مصفوفة مصروف الرواتب واحتياطي مكافآت الأسهم.',
    erpImplementationEn: 'Vesting schedule tracking per employee cohort, automated monthly straight-line amortization from payroll expense into Share Options Reserve.',
    erpModules: ['payroll', 'journal_entries', 'chart_of_accounts'],
    numericalExample: {
      titleAr: 'منح خيارات أسهم لموظفين مع فترة استحقاق 3 سنوات',
      titleEn: 'Employee Share Option Plan (3-Year Vesting)',
      scenarioAr: 'منحت الشركة 1,000 خيار أسهم لـ 10 مديرين في 01/01/2024. القيمة العادلة للخيار في تاريخ المنح 30 ج.م. شرط البقاء في الخدمة 3 سنوات. تتوقع الشركة بقاء 9 مديرين حتى نهاية الفترة.',
      scenarioEn: 'Company grants 1,000 options to 10 managers on 01/01/2024. Grant-date fair value is 30 EGP per option. 3-year service condition. Expected retention: 9 managers.',
      calculationAr: 'إجمالي القيمة المقدرة = 9 مديرين × 1,000 × 30 = 270,000 ج.م. نصيب السنة الأولى (2024) = 270,000 ÷ 3 سنوات = 90,000 ج.م.',
      calculationEn: 'Total expected fair value = 9 x 1,000 x 30 = 270,000 EGP. Year 1 expense = 270,000 / 3 = 90,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصروف منافع الموظفين (مكافآت على أساس الأسهم)',
        accountEn: 'Employee Benefits Expense (Share-based Payment)',
        debit: '90,000',
        credit: '-',
        notesAr: 'إثبات حصة السنة الأولى من تكلفة خيارات الأسهم المستحقة',
        notesEn: 'Recognize Year 1 vesting expense'
      },
      {
        accountAr: 'حـ/ حقوق الملكية - احتياطي خيارات أسهم الموظفين',
        accountEn: 'Equity - Share Option Reserve',
        debit: '-',
        credit: '90,000',
        notesAr: 'إضافة المقابل لحساب احتياطي خاص بحقوق الملكية',
        notesEn: 'Credit to equity reserve for future share issue'
      }
    ],
    disclosuresAr: [
      'وصف لكل نوع من ترتيبات الدفع على أساس الأسهم القائمة خلال الفترة.',
      'عدد ومتوسط الأسعار المرجحة لممارسة خيارات الأسهم (القائمة، الممنوحة، الملغاة، الممارسة، المنتهية).',
      'طريقة تحديد القيمة العادلة والنموذج الرياضي المستخدم (مثل Black-Scholes أو Binomial) والمدخلات (التقلب، مدة الخيار، عائد التوزيعات، معدل الفائدة الخالي من المخاطر).'
    ],
    disclosuresEn: [
      'Description of each share-based payment arrangement existing during the period.',
      'Number and weighted average exercise prices of share options.',
      'Option pricing model used (e.g. Black-Scholes, Binomial) and key assumptions (volatility, expected term, dividend yield, risk-free rate).'
    ],
    commonPitfallsAr: [
      'إعادة تقييم القيمة العادلة لخيارات الأسهم المسددة بحقوق ملكية بعد تاريخ المنح، وهو خطأ شائع حيث يثبت السعر عند تاريخ المنح فقط.',
      'عدم تعديل تقديرات عدد الموظفين المتوقع بقاؤهم بنهاية كل فترة مالية.'
    ],
    commonPitfallsEn: [
      'Remeasuring equity-settled share options after grant date (only cash-settled SARs are remeasured).',
      'Failing to true-up the forfeiture rate based on actual and expected employee retention.'
    ]
  },

  // ==========================================
  // IFRS 5 — Non-current Assets Held for Sale and Discontinued Operations
  // ==========================================
  {
    code: 'IFRS 5',
    family: 'IFRS',
    titleAr: 'الأصول غير المتداولة المحتفظ بها برسم البيع والعمليات غير المستمرة',
    titleEn: 'Non-current Assets Held for Sale and Discontinued Operations',
    category: 'assets',
    effectiveDate: '01/01/2005 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-5-non-current-assets-held-for-sale-and-discontinued-operations/',
    objectiveAr: 'تحديد المحاسبة عن الأصول المحتفظ بها للبيع وعرض العمليات غير المستمرة والإفصاح عنها بشكل منفصل.',
    objectiveEn: 'Specify accounting for assets held for sale and presentation/disclosure of discontinued operations.',
    scopeAr: 'الأصول غير المتداولة أو مجموعات الاستبعاد التي ستسترد قيمتها الدفترية أساساً من خلال عملية بيع وليس من خلال الاستخدام المستمر.',
    scopeEn: 'Non-current assets or disposal groups whose carrying amount will be recovered principally through a sale transaction rather than through continuing use.',
    recognitionAr: 'يصنف الأصل كمحتفظ به للبيع إذا كان متاحاً للبيع الفوري بحالته الراهنة، وكان البيع محتملاً بدرجة عالية (Highly Probable) خلال 12 شهراً مع التزام الإدارة بخطة البيع.',
    recognitionEn: 'Classified as held for sale if available for immediate sale in present condition, sale is highly probable within 12 months, and management is committed to sell plan.',
    measurementInitialAr: 'يقاس بالأقل بين: القيمة الدفترية (Carrying Amount)، والقيمة العادلة ناقصاً تكاليف البيع (Fair Value less costs to sell).',
    measurementInitialEn: 'Measured at the lower of carrying amount and fair value less costs to sell.',
    measurementSubsequentAr: 'وقف إهلاك الأصول المصنفة برسم البيع فوراً! وإثبات أي خسارة انخفاض قيمة لاحقة أو استرداد في الأرباح والخسائر.',
    measurementSubsequentEn: 'Depreciation ceases immediately upon classification. Recognize any subsequent impairment loss or gain on recovery in P&L.',
    erpImplementationAr: 'نقل بطاقة الأصل الثابت إلى حساب أصول غير متداولة محتفظ بها للبيع، ووقف تشغيل معالج الإهلاك الشهري التلقائي للأصل.',
    erpImplementationEn: 'Reclassify fixed asset master to Held-for-Sale Asset code, automatically suspend depreciation schedule, and flag for separate balance sheet presentation.',
    erpModules: ['fixed_assets', 'chart_of_accounts', 'journal_entries'],
    numericalExample: {
      titleAr: 'تصنيف آلة إنتاجية محتفظ بها للبيع ووقف إهلاكها',
      titleEn: 'Classification and Impairment of Asset Held for Sale',
      scenarioAr: 'قررت إدارة الشركة في 01/10/2025 بيع خط إنتاج قيمته الدفترية 600,000 ج.م. قدرت القيمة العادلة بـ 520,000 ج.م وتكاليف البيع المقدرة 20,000 ج.م (الصافي = 500,000 ج.م).',
      scenarioEn: 'Management commits to sell an assembly line on 01/10/2025. Carrying value 600k EGP. Fair value 520k EGP, estimated selling costs 20k EGP (Net = 500k EGP).',
      calculationAr: 'القيمة القابلة للاسترداد = 520,000 - 20,000 = 500,000 ج.م. خسارة الهبوط الفورية عند التصنيف = 600,000 - 500,000 = 100,000 ج.م. يتوقف إهلاك الخط تماماً بعد 01/10/2025.',
      calculationEn: 'Fair value less costs to sell = 500k EGP. Impairment loss on classification = 600k - 500k = 100k EGP. Depreciation stops completely.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ أصول غير متداولة محتفظ بها برسم البيع',
        accountEn: 'Non-current Assets Held for Sale',
        debit: '500,000',
        credit: '-',
        notesAr: 'إثبات الأصل بالصافي (الأقل بين الدفتري والقيمة العادلة ناقصاً تكاليف البيع)',
        notesEn: 'Recognize at lower of carrying amount and FV less selling costs'
      },
      {
        accountAr: 'حـ/ خسائر هبوط أصول محتفظ بها للبيع (أرباح وخسائر)',
        accountEn: 'Impairment Loss on Held for Sale Classification (P&L)',
        debit: '100,000',
        credit: '-',
        notesAr: 'تحميل خسارة تخفيض الأصل لقيمته البيعية الصافية',
        notesEn: 'Recognize impairment write-down in P&L'
      },
      {
        accountAr: 'حـ/ الأصول الثابتة (الآلات والمعدات)',
        accountEn: 'Property, Plant and Equipment (Machinery)',
        debit: '-',
        credit: '600,000',
        notesAr: 'استبعاد الأصل من حسابات الأصول الثابتة التشغيلية',
        notesEn: 'Derecognize from operating fixed assets'
      }
    ],
    disclosuresAr: [
      'وصف تفصيلي للأصل غير المتداول أو مجموعة الاستبعاد والظروف المؤدية للبيع المتوقع.',
      'عرض الأصول والالتزامات المحتفظ بها للبيع في سطور منفصلة في قائمة المركز المالي.',
      'عرض نتائج العمليات غير المستمرة بعد خصم الضريبة في سطر وحيد منفصل بقائمة الدخل مع تفصيلها بالإيضاحات.'
    ],
    disclosuresEn: [
      'Detailed description of the asset/disposal group, facts, and circumstances of sale.',
      'Separate presentation on the face of the balance sheet for held for sale assets and liabilities.',
      'Single amount on the face of statement of profit or loss for total post-tax discontinued operations.'
    ],
    commonPitfallsAr: [
      'استمرار حساب الإهلاك بعد تصنيف الأصل كمحتفظ به للبيع، وهو ما يحظره المعيار صراحة.',
      'تصنيف أصول معطلة أو مهملة (Abandoned Assets) كمحتفظ بها للبيع دون وجود خطة بيع نشطة ومشترين محتملين.'
    ],
    commonPitfallsEn: [
      'Continuing to depreciate assets after classification as held for sale (depreciation must stop).',
      'Classifying abandoned or mothballed assets as held for sale without active marketing and committed buyer pool.'
    ]
  },

  // ==========================================
  // IFRS 7 — Financial Instruments: Disclosures
  // ==========================================
  {
    code: 'IFRS 7',
    family: 'IFRS',
    titleAr: 'الأدوات المالية: الإفصاحات',
    titleEn: 'Financial Instruments: Disclosures',
    category: 'financial_instruments',
    effectiveDate: '01/01/2007 (محدث مع IFRS 9)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-7-financial-instruments-disclosures/',
    objectiveAr: 'إلزام المنشآت بتقديم إفصاحات تمكّن مستخدمي القوائم المالية من تقييم مدى أهمية الأدوات المالية للمركز المالي والأداء، وطبيعة ومدى المخاطر الناشئة عنها (الائتمان، السيولة، والسوق) وكيفية إدارة تلك المخاطر.',
    objectiveEn: 'Require entities to provide disclosures enabling users to evaluate the significance of financial instruments, nature/extent of risks (credit, liquidity, market), and how risks are managed.',
    scopeAr: 'جميع الأدوات المالية المعترف بها وغير المعترف بها لدى كافة المنشآت، بما فيها البنوك والشركات التجارية.',
    scopeEn: 'All recognized and unrecognized financial instruments across all corporate and financial institutions.',
    recognitionAr: 'معيار إفصاحي لا ينشئ قيوداً محاسبية مباشرة، بل يحكم الجداول والشروح المرافقة لـ IFRS 9 و IAS 32.',
    recognitionEn: 'Disclosure standard; complements IFRS 9 and IAS 32 without generating primary journal entries directly.',
    measurementInitialAr: 'إفصاحات كمية ونوعية عن قياسات القيمة العادلة، والتكلفة المطفأة، ومخصصات الخسائر الائتمانية المتوقعة (ECL).',
    measurementInitialEn: 'Quantitative and qualitative disclosures regarding fair value hierarchy, amortized cost, and Expected Credit Loss (ECL) staging.',
    measurementSubsequentAr: 'تحليل آجال استحقاق الالتزامات المالية (جدول السيولة بالتدفقات غير المخصومة)، وتحليل حساسية مخاطر السوق (أسعار الصرف، الفائدة، والأسهم).',
    measurementSubsequentEn: 'Maturity analysis for financial liabilities (contractual undiscounted cash flows), and market risk sensitivity analyses (FX, interest rate, equity).',
    erpImplementationAr: 'استخراج تقرير أعمار الديون وجداول السيولة للالتزامات، وتوليد مصفوفة تركز الائتمان ومخاطر العملات الأجنبية.',
    erpImplementationEn: 'Automated aging schedules, contractual cash flow maturity reports, and currency exposure matrix generated from AP/AR subledgers.',
    erpModules: ['accounts_receivable', 'accounts_payable', 'treasury', 'reports'],
    numericalExample: {
      titleAr: 'جدول تحليل آجال استحقاق التدفقات النقدية التعاقدية للالتزامات المالية',
      titleEn: 'IFRS 7 Undiscounted Contractual Liquidity Maturity Analysis',
      scenarioAr: 'لدى شركة قروض بنكية بقيمة دفترية 1,000,000 ج.م، التزامات عقود إيجار 400,000 ج.م، وموردون 300,000 ج.م. إجمالي التدفقات التعاقدية غير المخصومة شاملة الفوائد 1,950,000 ج.م موزعة على فترات استحقاق.',
      scenarioEn: 'Entity has loans carried at 1,000,000 EGP, lease liabilities 400k EGP, trade payables 300k EGP. Total undiscounted contractual flows including interest are 1,950,000 EGP.',
      calculationAr: 'أقل من سنة: 500,000 ج.م. من سنة إلى 5 سنوات: 1,100,000 ج.م. أكثر من 5 سنوات: 350,000 ج.م. المجموع = 1,950,000 ج.م (مقابل رصيد دفتري 1,700,000 ج.م).',
      calculationEn: 'Within 1 yr: 500k EGP. 1 to 5 yrs: 1,100k EGP. Beyond 5 yrs: 350k EGP. Total undiscounted = 1,950k EGP (vs 1,700k carrying value).'
    },
    journalEntries: [
      {
        accountAr: 'ملاحظة: معيار IFRS 7 معيار إفصاح وعرض مالي تحليلي',
        accountEn: 'Note: IFRS 7 is an analytical disclosure standard',
        debit: '-',
        credit: '-',
        notesAr: 'القيود المحاسبية تسجل وفق IFRS 9 وتنعكس في جداول إفصاح IFRS 7',
        notesEn: 'Underlying accounting entries follow IFRS 9 and populate IFRS 7 tables'
      }
    ],
    disclosuresAr: [
      'مصفوفة مخصص خسائر الائتمان المتوقعة مقسمة حسب المراحل الثلاث (Stage 1, Stage 2, Stage 3).',
      'جدول آجال استحقاق الالتزامات المالية استناداً للتدفقات التعاقدية غير المخصومة.',
      'تحليل الحساسية لمخاطر أسعار الفائدة والعملات الأجنبية وأثرها على الربح أو حقوق الملكية.'
    ],
    disclosuresEn: [
      'Credit risk exposure & ECL reconciliation across the 3 stages.',
      'Liquidity risk contractual undiscounted cash flow maturity schedule.',
      'Market risk sensitivity analyses showing impact on P&L and equity.'
    ],
    commonPitfallsAr: [
      'عرض جدول السيولة بالقيم الدفترية المخصومة بدلاً من التدفقات النقدية التعاقدية الإجمالية غير المخصومة شاملة الفوائد المستقبلية.',
      'إغفال تحليل الحساسية لمخاطر صرف العملات الأجنبية وأسعار الفائدة.'
    ],
    commonPitfallsEn: [
      'Presenting discounted balance sheet amounts in liquidity table rather than undiscounted gross cash flows.',
      'Omitting quantitative sensitivity analyses for foreign currency and interest rate fluctuations.'
    ]
  },

  // ==========================================
  // IFRS 8 — Operating Segments
  // ==========================================
  {
    code: 'IFRS 8',
    family: 'IFRS',
    titleAr: 'القطاعات التشغيلية',
    titleEn: 'Operating Segments',
    category: 'presentation',
    effectiveDate: '01/01/2009 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-8-operating-segments/',
    objectiveAr: 'إلزام المنشآت بالإفصاح عن معلومات مالية تتيح تقييم طبيعة والآثار المالية للأنشطة الاقتصادية التي تمارسها والبيئات الاقتصادية التي تعمل فيها عبر "المدخل الإداري" (Management Approach).',
    objectiveEn: 'Require entities to disclose financial information enabling evaluation of business activities and economic environments via the "management approach".',
    scopeAr: 'المنشآت التي تتداول أدوات ديونها أو حقوق ملكيتها في سوق عام، أو تقدم قوائمها لهيئة أوراق مالية بغرض إصدار أدوات في سوق عام.',
    scopeEn: 'Entities whose debt or equity instruments are traded in a public market or filing to issue instruments in a public securities market.',
    recognitionAr: 'القطاع التشغيلي هو مكون يمارس أنشطة أعمال، وتراجع نتائجه بانتظام من قِبل "متخذ القرار التشغيلي الرئيسي" (CODM)، وتتوفر عنه معلومات مالية منفصلة.',
    recognitionEn: 'An operating segment is a component engaging in business activities whose operating results are regularly reviewed by the Chief Operating Decision Maker (CODM).',
    measurementInitialAr: 'يجب التقرير عن القطاع إذا استوفى حدود الـ 10%: مثل إيراداته >= 10% من إجمالي الإيرادات، أو ربحه/خسارته >= 10%، أو أصوله >= 10% من إجمالي الأصول.',
    measurementInitialEn: 'Reportable if meeting 10% thresholds: revenue >= 10% of total, absolute profit/loss >= 10% of greater segment total, or assets >= 10% of total assets.',
    measurementSubsequentAr: 'شرط تغطية الـ 75%: يجب أن تشكل إيرادات القطاعات الواجب التقرير عنها 75% على الأقل من إجمالي إيرادات المنشأة الموحدة.',
    measurementSubsequentEn: '75% coverage rule: Total external revenue of reportable segments must constitute at least 75% of total consolidated entity revenue.',
    erpImplementationAr: 'تفعيل أبعاد مراكز التكلفة ومراكز الربحية (Profit Centers / Segment Dimensions) وربط الفواتير والقيود بالقطاعات لإصدار تقرير قطاعي تلقائي.',
    erpImplementationEn: 'Enable multi-dimensional profit centers and business unit tags on all transaction lines for automated segment P&L generation.',
    erpModules: ['cost_centers', 'chart_of_accounts', 'reports', 'invoices'],
    numericalExample: {
      titleAr: 'تطبيق حدود الـ 10% والـ 75% لتحديد القطاعات الواجب الإبلاغ عنها',
      titleEn: 'IFRS 8 10% Quantitative Thresholds and 75% Rule',
      scenarioAr: 'شركة حققت إيرادات إجمالية قدرها 10,000,000 ج.م موزعة على 4 قطاعات: قطاع التجزئة 5,500,000 ج.م، المقاولات 2,500,000 ج.م، التصنيع 1,200,000 ج.م، وقطاع الخدمات 800,000 ج.م.',
      scenarioEn: 'Company total revenue is 10M EGP across 4 units: Retail 5.5M, Contracting 2.5M, Manufacturing 1.2M, Services 0.8M.',
      calculationAr: 'حد الـ 10% = 1,000,000 ج.م. القطاعات المستوفية للـ 10%: التجزئة (55%)، المقاولات (25%)، التصنيع (12%). مجموعها = 92%، وهو يتجاوز شرط الـ 75% الإجمالي، فيتم الإفصاح عن الـ 3 قطاعات وتجميع الخدمات في بند (أخرى).',
      calculationEn: '10% threshold = 1M EGP. Reportable: Retail (55%), Contracting (25%), Manufacturing (12%). Total = 92% (> 75% requirement). Services aggregated in "Other".'
    },
    journalEntries: [
      {
        accountAr: 'ملاحظة: معيار IFRS 8 يخص تبويب القيود حسب مراكز الربحية',
        accountEn: 'Note: IFRS 8 governs dimensional allocation of ledger entries',
        debit: '-',
        credit: '-',
        notesAr: 'يتم إسناد كل قيد لمركز ربحية/قطاع جغرافي أو تشغيلي في النظام',
        notesEn: 'Transactions tagged with segment dimension / profit center'
      }
    ],
    disclosuresAr: [
      'العوامل المستخدمة لتحديد القطاعات الواجب التقرير عنها وأنواع المنتجات والخدمات.',
      'مقياس ربح أو خسارة كل قطاع وإجمالي أصوله والتزاماته.',
      'تسوية إيرادات وأرباح وأصول القطاعات مع إجماليات القوائم المالية الموحدة للمنشأة.',
      'الإفصاح الجغرافي والاعتماد على العملاء الرئيسيين (أكثر من 10% من المبيعات).'
    ],
    disclosuresEn: [
      'Factors used to identify reportable segments and types of products/services.',
      'Measure of profit or loss, assets, and liabilities for each reportable segment.',
      'Reconciliations of segment revenues, profit/loss, and assets to consolidated totals.',
      'Geographical info and major customer reliance (>= 10% of total revenues).'
    ],
    commonPitfallsAr: [
      'إخفاء قطاعات تشغيلية يراجعها الرئيس التنفيذي بدعوى سريتها التنافسية، وهو ما يمنعه المعيار صراحة.',
      'عدم إجراء تسوية محاسبية واضحة ومطابقة بين مجموع أرباح القطاعات وأرباح القوائم المالية الموحدة.'
    ],
    commonPitfallsEn: [
      'Withholding operating segments reviewed by CODM under competitive secrecy claims.',
      'Omitting mandatory reconciliation between segment profit/loss and consolidated P&L.'
    ]
  },

  // ==========================================
  // IFRS 11 — Joint Arrangements
  // ==========================================
  {
    code: 'IFRS 11',
    family: 'IFRS',
    titleAr: 'الترتيبات المشتركة',
    titleEn: 'Joint Arrangements',
    category: 'group',
    effectiveDate: '01/01/2013 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-11-joint-arrangements/',
    objectiveAr: 'تحديد مبادئ التقرير المالي للأطراف في ترتيب يخضع لسيطرة مشتركة (Joint Control).',
    objectiveEn: 'Establish principles for financial reporting by entities that have an interest in arrangements that are controlled jointly.',
    scopeAr: 'جميع المنشآت التي تكون طرفاً في ترتيب مشترك يخضع لاتفاق تعاقدي للسيطرة المشتركة.',
    scopeEn: 'All entities that are a party to a joint arrangement governed by contractual joint control.',
    recognitionAr: 'تصنيف الترتيب المشترك إلى نوعين: 1) عملية مشتركة (Joint Operation): حقوق في الأصول والتزامات بالخصوم. 2) مشروع مشترك (Joint Venture): حقوق في صافي الأصول.',
    recognitionEn: 'Classify as either: 1) Joint Operation (rights to assets & obligations for liabilities), or 2) Joint Venture (rights to net assets).',
    measurementInitialAr: 'للعملية المشتركة: يثبت المشغل المشترك حصته المباشرة في الأصول، الالتزامات، الإيرادات، والمصروفات. للمشروع المشترك: يثبت المستثمر حصته وفق طريقة حقوق الملكية (Equity Method) استناداً لمعيار IAS 28، ويحظر تماماً التوحيد التناسبي (Proportionate Consolidation)!',
    measurementInitialEn: 'Joint Operation: recognize direct share of assets, liabilities, revenues, and expenses. Joint Venture: apply equity method under IAS 28 (proportionate consolidation is prohibited!).',
    measurementSubsequentAr: 'المشروع المشترك: تعديل قيمة الاستثمار بنصيب المنشأة من أرباح أو خسائر وتوزيعات المشروع المشترك سنوياً.',
    measurementSubsequentEn: 'Joint venture: adjust investment carrying amount by share of post-acquisition profits/losses and dividends received.',
    erpImplementationAr: 'إدارة حسابات العمليات المشتركة عبر دفاتر وسيطة، أو ربط الاستثمارات المشتركة ببطاقة الاستثمار المالي بحقوق الملكية.',
    erpImplementationEn: 'Direct proportional asset/expense ledger tagging for joint operations; equity-accounted subsidiary ledger for joint ventures.',
    erpModules: ['chart_of_accounts', 'journal_entries', 'general_ledger'],
    numericalExample: {
      titleAr: 'محاسبة عملية مشتركة في قطاع المقاولات بحصص متساوية 50%',
      titleEn: 'Joint Operation Accounting (50% Direct Share)',
      scenarioAr: 'اتفقت شركة أ مع شركة ب على بناء جسر بترتيب مشترك مصنف كعملية مشتركة (50% لكل منهما). تكبدت العملية تكاليف بناء 2,000,000 ج.م وحصلت إيرادات مستخلصة 3,000,000 ج.م.',
      scenarioEn: 'Company A enters 50/50 joint construction operation. Total construction costs 2,000,000 EGP, client billings 3,000,000 EGP.',
      calculationAr: 'تثبت شركة أ في قوائمها المستقلة: أصول/نقدية = 1,500,000 ج.م، مصروفات تكلفة = 1,000,000 ج.م، إيرادات مقاولات = 1,500,000 ج.م.',
      calculationEn: 'Company A recognizes directly: Cash/Receivables 1.5M EGP, Construction Cost 1.0M EGP, Revenue 1.5M EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ تكاليف عقود المقاولات (حصة 50% من العملية المشتركة)',
        accountEn: 'Construction Contract Costs (50% Joint Operation Share)',
        debit: '1,000,000',
        credit: '-',
        notesAr: 'إثبات الحصة المباشرة في المصروفات المتكبدة في المشروع',
        notesEn: 'Recognize direct 50% share of incurred costs'
      },
      {
        accountAr: 'حـ/ مدينو مستخلصات عملاء المشروع المشترك',
        accountEn: 'Joint Operation Contract Receivables',
        debit: '1,500,000',
        credit: '-',
        notesAr: 'إثبات الحصة في المستخلصات المستحقة على العميل',
        notesEn: 'Recognize direct 50% share of receivables'
      },
      {
        accountAr: 'حـ/ إيرادات المقاولات (العملية المشتركة)',
        accountEn: 'Contract Revenues (Joint Operation Share)',
        debit: '-',
        credit: '1,500,000',
        notesAr: 'إثبات الحصة المباشرة في الإيرادات',
        notesEn: 'Recognize 50% share of contract revenue'
      },
      {
        accountAr: 'حـ/ بنك / موردو العملية المشتركة',
        accountEn: 'Cash / Joint Operation Payables',
        debit: '-',
        credit: '1,000,000',
        notesAr: 'سداد أو استحقاق الالتزامات الخاصة بحصة الشركة',
        notesEn: 'Recognize direct obligations incurred'
      }
    ],
    disclosuresAr: [
      'وصف الترتيبات المشتركة الهامة وطبيعة السيطرة والاتفاقيات التعاقدية.',
      'تصنيف الترتيب المشترك (عملية مشتركة أو مشروع مشترك) وأسباب ذلك التصنيف.',
      'الالتزامات المحتملة والالتزامات الرأسمالية التي تعهدت بها المنشأة بالاشتراك مع الشركاء الآخرين.'
    ],
    disclosuresEn: [
      'Description of significant joint arrangements, structure, and contractual terms.',
      'Judgments made in determining whether arrangement is joint operation or joint venture.',
      'Contingent liabilities and capital commitments incurred jointly with partners.'
    ],
    commonPitfallsAr: [
      'استخدام طريقة التوحيد التناسبي (Proportionate Consolidation) للمشروعات المشتركة، وهو ملغى تماماً ويجب استخدام طريقة حقوق الملكية فقط.',
      'الاعتماد فقط على الشكل القانوني للكيان دون فحص الشروط التعاقدية لتحديد هل الترتيب عملية مشتركة أم مشروع مشترك.'
    ],
    commonPitfallsEn: [
      'Using proportionate consolidation for joint ventures (strictly prohibited; only equity method allowed).',
      'Relying solely on legal form rather than contractual substance to distinguish joint operations from joint ventures.'
    ]
  },

  // ==========================================
  // IFRS 12 — Disclosure of Interests in Other Entities
  // ==========================================
  {
    code: 'IFRS 12',
    family: 'IFRS',
    titleAr: 'الإفصاح عن الحصص في المنشآت الأخرى',
    titleEn: 'Disclosure of Interests in Other Entities',
    category: 'group',
    effectiveDate: '01/01/2013 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-12-disclosure-of-interests-in-other-entities/',
    objectiveAr: 'إلزام المنشأة بالإفصاح عن معلومات تمكن مستخدمي القوائم المالية من تقييم طبيعة الحصص في الشركات التابعة والترتيبات المشتركة والشركات الزميلة والمنشآت المهيكلة غير الموحدة والمخاطر المرتبطة بها وآثارها على المركز المالي.',
    objectiveEn: 'Require disclosures enabling users to evaluate nature of interests in subsidiaries, joint arrangements, associates, and unconsolidated structured entities, and associated financial risks.',
    scopeAr: 'يطبق من قبل أي منشأة تمتلك حصة في: شركات تابعة (IFRS 10)، ترتيبات مشتركة (IFRS 11)، شركات زميلة (IAS 28)، أو منشآت مهيكلة غير موحدة.',
    scopeEn: 'Applies to entities holding interests in subsidiaries, joint ventures, joint operations, associates, and unconsolidated structured entities.',
    recognitionAr: 'معيار إفصاحي شامل لا ينشئ قيوداً محاسبية خاصة بذاته، بل يحدد متطلبات العرض التفسيري للقوائم الموحدة والمستقلة.',
    recognitionEn: 'Comprehensive disclosure standard complementing IFRS 10, 11 and IAS 28; governs footnotes and tabular schedules.',
    measurementInitialAr: 'الإفصاح عن الأحكام والتقديرات الهامة التي استندت إليها الإدارة في تحديد وجود سيطرة (Control) أو سيطرة مشتركة أو نفوذ مؤثر (Significant Influence).',
    measurementInitialEn: 'Disclose significant judgments made in determining control, joint control, or significant influence.',
    measurementSubsequentAr: 'تقديم معلومات مالية ملخصة عن الشركات التابعة ذات الحصص غير المسيطرة (NCI) الهامة، وعن الشركات الزميلة والمشروعات المشتركة الرئيسية.',
    measurementSubsequentEn: 'Present summarized financial information for subsidiaries with material Non-Controlling Interests (NCI) and material associates/joint ventures.',
    erpImplementationAr: 'إعداد تقارير سجل الاستثمارات وحصص الملكية، ونسب الحصص غير المسيطرة، وتجميع القوائم المالية للمجموعة.',
    erpImplementationEn: 'Subsidiary registry reporting, NCI percentage monitoring, and automated group consolidation disclosure schedules.',
    erpModules: ['chart_of_accounts', 'reports', 'general_ledger'],
    numericalExample: {
      titleAr: 'إفصاح ملخص عن شركة تابعة بحصة غير مسيطرة هامة (NCI 30%)',
      titleEn: 'IFRS 12 Material Non-Controlling Interest Disclosure',
      scenarioAr: 'تمتلك الشركة 70% من شركة الصفا. بلغت أصول التابعة 5,000,000 ج.م، التزاماتها 2,000,000 ج.م، وصافي دخلها السنوي 800,000 ج.م. الحصة غير المسيطرة (30%) تمثل رصيداً هاماً للمجموعة.',
      scenarioEn: 'Parent owns 70% of Al-Safa. Subsidiary has Assets 5M, Liabilities 2M, Net Income 800k. NCI (30%) is material to group.',
      calculationAr: 'حقوق الملكية = 3,000,000 ج.م. نصيب الحصة غير المسيطرة من صافي الأصول = 900,000 ج.م. نصيبها من الأرباح السنوية = 240,000 ج.م.',
      calculationEn: 'Net Assets = 3M EGP. NCI share in net assets = 900k EGP. NCI share of profit = 240k EGP.'
    },
    journalEntries: [
      {
        accountAr: 'ملاحظة: معيار إفصاح يحكم جداول إيضاحات القوائم الموحدة',
        accountEn: 'Note: IFRS 12 governs disclosure tables for consolidated statements',
        debit: '-',
        credit: '-',
        notesAr: 'المعلومات تظهر في إيضاح "الشركات التابعة والحصص غير المسيطرة"',
        notesEn: 'Summarized data presented in group footnote disclosures'
      }
    ],
    disclosuresAr: [
      'الأحكام والافتراضات الهامة لتحديد السيطرة عندما تقل الملكية عن 50% أو عند تجاوزها 50% مع عدم وجود سيطرة فعلية.',
      'بيانات مالية ملخصة عن الشركات التابعة التي تتضمن حصصاً غير مسيطرة جوهرية (أصول، التزامات، إيرادات، تدفقات نقدية).',
      'القيود المفروضة على قدرة الشركة التابعة على تحويل أموال أو توزيع أرباح للشركة الأم.'
    ],
    disclosuresEn: [
      'Significant judgments in assessing control (e.g. de facto control below 50% or lack of control above 50%).',
      'Summarized financial data for subsidiaries with material NCI (dividends paid, assets, liabilities, revenue, cash flows).',
      'Nature and extent of significant restrictions on the transfer of funds or dividends.'
    ],
    commonPitfallsAr: [
      'عدم الإفصاح عن أسباب السيطرة الفعلية (De Facto Control) عندما تمتلك الأم أقل من 50% من حقوق التصويت لكنها تسيطر عملياً.',
      'إغفال تفاصيل المنشآت المهيكلة خارج الميزانية (Off-balance sheet structured entities).'
    ],
    commonPitfallsEn: [
      'Failing to disclose rationale for de facto control when ownership is under 50%.',
      'Omitting nature of risks from unconsolidated structured entities (SPEs).'
    ]
  },

  // ==========================================
  // IFRS 17 — Insurance Contracts
  // ==========================================
  {
    code: 'IFRS 17',
    family: 'IFRS',
    titleAr: 'عقود التأمين',
    titleEn: 'Insurance Contracts',
    category: 'specialized',
    effectiveDate: '01/01/2023 (حل محل IFRS 4)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-17-insurance-contracts/',
    objectiveAr: 'إرساء نموذج محاسبي شامل وموحد عالمياً لجميع أنواع عقود التأمين لضمان الشفافية وقابلية المقارنة في ربحية شركات التأمين والمخاطر.',
    objectiveEn: 'Establish a comprehensive, unified accounting model for all insurance contracts to ensure transparency and comparability in insurer profitability and risk.',
    scopeAr: 'عقود التأمين وعقود إعادة التأمين الصادرة والمحتفظ بها، وعقود الاستثمار ذات ميزة المشاركة التقديرية.',
    scopeEn: 'Insurance contracts, reinsurance contracts held, and investment contracts with discretionary participation features.',
    recognitionAr: 'الاعتراف بمجموعة عقود التأمين في الأبكر من: بداية فترة التغطية، أو تاريخ استحقاق أول دفعة من حامل الوثيقة، أو عندما تصبح المجموعة مرهقة (Onerous).',
    recognitionEn: 'Recognize an insurance group at earliest of: coverage period start, first premium due date, or when group becomes onerous.',
    measurementInitialAr: 'نموذج القياس العام (Building Block Approach - BBA): 1) التدفقات النقدية للوفاء بالعقد (PV of Cash Flows)، 2) تعديل المخاطر للمخاطر غير المالية (Risk Adjustment)، 3) هامش الخدمة التعاقدية (CSM) الذي يمثل الأرباح غير المكتسبة.',
    measurementInitialEn: 'General Measurement Model (BBA): 1) PV of future cash flows, 2) Risk Adjustment (RA) for non-financial risk, 3) Contractual Service Margin (CSM) representing unearned profit.',
    measurementSubsequentAr: 'إثبات إيرادات التأمين وإطلاق هامش الخدمة التعاقدية (CSM) تدريجياً في الأرباح والخسائر مع تقديم خدمات التغطية التأمينية، مع استخدام نموذج تخصيص الأقساط (PAA) للوثائق قصيرة الأجل (سنة أو أقل).',
    measurementSubsequentEn: 'Release CSM to insurance revenue over coverage period as insurance contract services are provided. Premium Allocation Approach (PAA) simplified for short-term policies (<= 1 yr).',
    erpImplementationAr: 'محرك حسابات اكتوارية، إدارة مجموعات الوثائق (Cohorts)، وتوليد قيود إطلاق هامش CSM واستهلاك تكاليف الاستحواذ التأمينية.',
    erpImplementationEn: 'Actuarial engine integration, cohort-based portfolio subledger, and automated monthly CSM release & acquisition cost amortization entries.',
    erpModules: ['chart_of_accounts', 'journal_entries', 'reports'],
    numericalExample: {
      titleAr: 'إثبات هامش الخدمة التعاقدية (CSM) لعقد تأمين وإطلاقه في السنة الأولى',
      titleEn: 'IFRS 17 Initial CSM Recognition and Year 1 Release',
      scenarioAr: 'أصدرت شركة تأمين محفظة وثائق مدتها 3 سنوات: أقساط محصلة 1,200,000 ج.م، القيمة الحالية للتعويضات المستقبلية 700,000 ج.م، وتعديل المخاطر 80,000 ج.م. هامش CSM = 420,000 ج.م.',
      scenarioEn: 'Insurer issues 3-year policy cohort: Premiums received 1.2M EGP, PV of future claims 700k EGP, Risk Adjustment 80k EGP. CSM = 420,000 EGP.',
      calculationAr: 'هامش CSM الأولي = 1,200,000 - (700,000 + 80,000) = 420,000 ج.م. إطلاق CSM للسنة الأولى (1 من 3 سنوات تغطية) = 420,000 ÷ 3 = 140,000 ج.م كإيراد تأميني.',
      calculationEn: 'Initial CSM = 1.2M - (700k + 80k) = 420,000 EGP. Year 1 CSM release = 420k / 3 = 140,000 EGP recognized in insurance service revenue.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ نقدية بالبنك (الأقساط المحصلة)',
        accountEn: 'Cash at Bank (Premiums Received)',
        debit: '1,200,000',
        credit: '-',
        notesAr: 'استلام أقساط التأمين من حاملي الوثائق',
        notesEn: 'Receive gross insurance premiums'
      },
      {
        accountAr: 'حـ/ التزامات عقود التأمين - التدفقات النقدية وتعديل المخاطر',
        accountEn: 'Insurance Contract Liabilities - Fulfilment Cash Flows & RA',
        debit: '-',
        credit: '780,000',
        notesAr: 'إثبات القيمة الحالية للمطالبات وتعديل المخاطر',
        notesEn: 'PV of future claims and risk adjustment'
      },
      {
        accountAr: 'حـ/ التزامات عقود التأمين - هامش الخدمة التعاقدية (CSM)',
        accountEn: 'Insurance Contract Liabilities - Contractual Service Margin (CSM)',
        debit: '-',
        credit: '420,000',
        notesAr: 'إثبات الأرباح غير المكتسبة كهامش CSM مؤجل في الالتزامات',
        notesEn: 'Defer unearned profit as CSM within liability'
      },
      {
        accountAr: 'حـ/ التزامات عقود التأمين - إطلاق هامش CSM (السنة الأولى)',
        accountEn: 'Insurance Contract Liabilities - CSM Release',
        debit: '140,000',
        credit: '-',
        notesAr: 'تخفيض التزام هامش الخدمة التعاقدية بمرور سنة التغطية',
        notesEn: 'Amortize CSM for coverage provided'
      },
      {
        accountAr: 'حـ/ إيرادات خدمات التأمين (قائمة الدخل)',
        accountEn: 'Insurance Revenue (P&L)',
        debit: '-',
        credit: '140,000',
        notesAr: 'الاعتراف بإيراد خدمات التأمين في الأرباح والخسائر',
        notesEn: 'Recognize insurance service revenue in P&L'
      }
    ],
    disclosuresAr: [
      'مطابقة حركة أرصدة التزامات عقود التأمين مفصلة بين: التدفقات النقدية للوفاء، تعديل المخاطر، وهامش الخدمة التعاقدية (CSM).',
      'إيرادات خدمات التأمين ومصروفات تمويل التأمين.',
      'منحنيات خصم الفائدة المستخدمة لتسعير التدفقات النقدية وأساليب تحديد تعديل المخاطر.',
      'جدول تطور المطالبات التأمينية (Claims Development Table) على مدار 10 سنوات.'
    ],
    disclosuresEn: [
      'Reconciliation of insurance contract liabilities showing Fulfilment Cash Flows, Risk Adjustment, and CSM.',
      'Insurance revenue breakdown and insurance finance income/expenses.',
      'Discount rate yield curves applied and methodology used for risk adjustment.',
      'Claims development table analyzing claims estimates versus actual settlements over a 10-year horizon.'
    ],
    commonPitfallsAr: [
      'الاعتراف بالأرباح غير المكتسبة مقدماً في الدخل عند استلام الأقساط بدلاً من ترحيلها كهامش CSM وإطلاقها تدريجياً.',
      'تجاهل مجموعات العقود المرهقة (Onerous Contracts) التي يجب إثبات خسائرها المتوقعة بالكامل فوراً في الأرباح والخسائر.'
    ],
    commonPitfallsEn: [
      'Front-loading unearned profit in P&L at inception instead of locking it into CSM and amortizing over coverage.',
      'Failing to recognize expected losses on onerous contracts immediately in profit or loss.'
    ]
  },

  // ==========================================
  // IAS 20 — Accounting for Government Grants and Disclosure of Government Assistance
  // ==========================================
  {
    code: 'IAS 20',
    family: 'IAS',
    titleAr: 'محاسبة المنح الحكومية والإفصاح عن المساعدات الحكومية',
    titleEn: 'Accounting for Government Grants and Disclosure of Government Assistance',
    category: 'liabilities_equity',
    effectiveDate: '01/01/1984 (محدث باستمرار)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-20-accounting-for-government-grants-and-disclosure-of-government-assistance/',
    objectiveAr: 'تحديد المعالجة المحاسبية للمنح الحكومية والإفصاح عن الأشكال الأخرى للمساعدات الحكومية.',
    objectiveEn: 'Prescribe accounting for government grants and disclosures of other forms of government assistance.',
    scopeAr: 'المنح والمساعدات الحكومية المقدمة للمنشآت، ويستثنى من ذلك المعاملات مع الحكومة بصفتها مالكاً في حقوق الملكية.',
    scopeEn: 'Government grants and assistance; excludes transactions where government acts as an equity owner.',
    recognitionAr: 'الاعتراف بالمنحة عند وجود تأكيد معقول (Reasonable Assurance) بأن المنشأة ستلتزم بالشروط المصاحبة لها، وبأن المنحة سيتم استلامها بالفعل.',
    recognitionEn: 'Recognized when there is reasonable assurance that the entity will comply with conditions and the grant will be received.',
    measurementInitialAr: 'تقاس بالقيمة العادلة للنقدية أو الأصل الممنوح. المنح المتعلقة بالأصول تعرض إما كإيراد مؤجل (Deferred Income) أو كخصم مباشر من القيمة الدفترية للأصل.',
    measurementInitialEn: 'Measured at fair value. Grants related to assets presented either as deferred income or deducted in arriving at the carrying amount of the asset.',
    measurementSubsequentAr: 'إثبات المنحة في الأرباح والخسائر على أساس منتظم وممنهج على مدى الفترات التي تعوض فيها المنشأة عن التكاليف ذات الصلة.',
    measurementSubsequentEn: 'Recognized in profit or loss on a systematic basis over the periods in which entity recognizes related costs.',
    erpImplementationAr: 'جدولة إيرادات المنح المؤجلة وربط الاستهلاك الشهري للمنحة مع قسط إهلاك الأصل ذي الصلة أو مصروف التشغيل المدعوم.',
    erpImplementationEn: 'Deferred grant revenue amortization schedule tied to matching fixed asset depreciation or subsidized payroll expenses.',
    erpModules: ['chart_of_accounts', 'fixed_assets', 'journal_entries'],
    numericalExample: {
      titleAr: 'منحة حكومية لشراء آلة صناعية صديقة للبيئة (طريقة الإيراد المؤجل)',
      titleEn: 'Government Grant for Green Machinery (Deferred Income Method)',
      scenarioAr: 'حصلت منشأة على منحة نقدية حكومية بقيمة 300,000 ج.م لشراء آلة تكلفتها 1,000,000 ج.م وعمرها الإنتاجي 5 سنوات دون خردة (الإهلاك السنوي 200,000 ج.م).',
      scenarioEn: 'Entity receives 300k EGP government grant towards purchase of 1M EGP machinery with 5-year life (annual depreciation 200k EGP).',
      calculationAr: 'المنحة تؤجل كالتزام. يثبت إيراد سنوي من المنحة = 300,000 ÷ 5 سنوات = 60,000 ج.م سنوياً لمقابلة قسط إهلاك الآلة (200,000 ج.م). الصافي على الدخل = -140,000 ج.م.',
      calculationEn: 'Deferred grant liability = 300k. Annual grant income recognized = 300k / 5 = 60,000 EGP matching 200k depreciation expense. Net P&L charge = 140k EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ البنك (استلام المنحة الحكومية)',
        accountEn: 'Cash at Bank (Grant Received)',
        debit: '300,000',
        credit: '-',
        notesAr: 'إيداع مبلغ المنحة الحكومية المعتمدة في الحساب البنكي',
        notesEn: 'Deposit received grant cash'
      },
      {
        accountAr: 'حـ/ التزامات - منح حكومية مؤجلة (أرصدة دائنة أخرى)',
        accountEn: 'Deferred Government Grant Liability',
        debit: '-',
        credit: '300,000',
        notesAr: 'تعليق المنحة كإيراد مؤجل لحين استهلاك الأصل',
        notesEn: 'Record unearned deferred grant balance'
      },
      {
        accountAr: 'حـ/ التزامات - منح حكومية مؤجلة (حصة السنة الأولى)',
        accountEn: 'Deferred Government Grant Liability (Year 1 Amortization)',
        debit: '60,000',
        credit: '-',
        notesAr: 'تخفيض التزام المنحة المؤجل بنصيب السنة الأولى',
        notesEn: 'Amortize Year 1 grant allocation'
      },
      {
        accountAr: 'حـ/ إيرادات منح حكومية (قائمة الدخل)',
        accountEn: 'Government Grant Income (P&L)',
        debit: '-',
        credit: '60,000',
        notesAr: 'الاعتراف بإيراد المنحة في الأرباح أو الخسائر',
        notesEn: 'Recognize systematic grant income in P&L'
      }
    ],
    disclosuresAr: [
      'السياسة المحاسبية المتبعة للمنح الحكومية وطريقة عرضها في القوائم المالية.',
      'طبيعة ومدى المنح الحكومية المعترف بها والمساعدات الحكومية غير المستردة.',
      'الشروط غير المستوفاة والالتزامات العارضة الأخرى المرتبطة بالمساعدات الحكومية.'
    ],
    disclosuresEn: [
      'Accounting policy adopted for government grants and methods of presentation in financial statements.',
      'Nature and extent of government grants recognized and direct government assistance received.',
      'Unfulfilled conditions and other contingencies attaching to government assistance.'
    ],
    commonPitfallsAr: [
      'الاعتراف بالمنحة الحكومية فوراً كإيراد في قائمة الدخل عند استلام النقدية بدلاً من تأجيلها وتوزيعها على عمر الأصل أو فترات التكلفة.',
      'إغفال شرط رد المنحة (Grant Repayment) والالتزامات المحتملة حال الإخلال بالشروط البيئية أو العمالية المصاحبة للمنحة.'
    ],
    commonPitfallsEn: [
      'Recognizing total grant as lump-sum revenue immediately upon receipt instead of matching to relevant costs.',
      'Omitting disclosures regarding potential grant clawback and repayment obligations if conditions are breached.'
    ]
  },

  // ==========================================
  // IAS 23 — Borrowing Costs
  // ==========================================
  {
    code: 'IAS 23',
    family: 'IAS',
    titleAr: 'تكاليف الاقتراض',
    titleEn: 'Borrowing Costs',
    category: 'assets',
    effectiveDate: '01/01/2009 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-23-borrowing-costs/',
    objectiveAr: 'تحديد المعالجة المحاسبية لتكاليف الاقتراض، وإلزام رسملة التكاليف التي تعزى مباشرة إلى حيازة أو إنشاء أو إنتاج أصل مؤهل (Qualifying Asset).',
    objectiveEn: 'Prescribe accounting for borrowing costs, requiring capitalization of costs directly attributable to acquisition, construction, or production of a qualifying asset.',
    scopeAr: 'تكاليف الاقتراض وتشمل الفوائد وتكاليف التمويل وفق سعر الفائدة الفعلي وفروق العملة الناتجة عن الاقتراض الأجنبي المعتبرة كتعديل لتكلفة الفائدة.',
    scopeEn: 'Borrowing costs including effective interest expense, finance charges, and foreign exchange differences to the extent regarded as interest adjustment.',
    recognitionAr: 'رسملة إجبارية! ترسمَل تكاليف الاقتراض كجزء من تكلفة الأصل المؤهل (الأصل الذي يتطلب حتماً فترة زمنية طويلة ليصبح جاهزاً للاستخدام المقصود أو البيع). أما تكاليف الاقتراض الأخرى فتعتمد كمصروف في فترة تكبدها.',
    recognitionEn: 'Mandatory capitalization for qualifying assets (assets taking substantial period of time to get ready for use/sale). All other borrowing costs expensed immediately.',
    measurementInitialAr: 'للاقتراض المحدد: الفائدة المتكبدة ناقصاً أي دخل استثماري ناتج عن الاستثمار المؤقت لتلك القروض. للاقتراض العام: يطبق معدل رسملة مرجح (Capitalization Rate) على النفقات الرأسمالية المتكبدة.',
    measurementInitialEn: 'Specific borrowings: actual borrowing costs less temporary investment income. General borrowings: weighted average capitalization rate applied to expenditures.',
    measurementSubsequentAr: 'بدء الرسملة عند استيفاء 3 شروط: تكبد نفقات الأصل، تكبد تكاليف اقتراض، وبدء أنشطة التجهيز الفعلية. تعليق الرسملة أثناء التوقف المطول غير المبرر، ووقفها نهائياً عند اكتمال الأصل جوهرياً.',
    measurementSubsequentEn: 'Commence capitalization when expenditures incurred, borrowing costs incurred, and preparatory activities underway. Suspend during extended pauses; cease when asset substantially complete.',
    erpImplementationAr: 'تفعيل حساب وسيط لمشروعات تحت التنفيذ مع معالج آلي لرسملة فوائد القروض المحددة للقروض البنكية.',
    erpImplementationEn: 'Capital work-in-progress (CWIP) project tracking, loan-to-project assignment, and automated interest capitalization schedule.',
    erpModules: ['fixed_assets', 'loans_financing', 'journal_entries'],
    numericalExample: {
      titleAr: 'رسملة فوائد قرض مخصص لإنشاء مصنع جديد وخصم دخل الاستثمار المؤقت',
      titleEn: 'Specific Borrowing Capitalization Net of Re-investment Income',
      scenarioAr: 'اقترضت شركة 2,000,000 ج.م بمعدل فائدة 12% سنوياً لإنشاء مبنى مصنع مؤهل. بلغت فوائد القرض السنوية 240,000 ج.م. استثمرت الشركة المبالغ غير المستغلة مؤقتاً وحققت فوائد دائنة 40,000 ج.م.',
      scenarioEn: 'Company borrowed 2M EGP at 12% to construct a qualifying factory building. Gross interest 240k EGP. Temporary idle funds earned interest of 40k EGP.',
      calculationAr: 'تكلفة الاقتراض المؤهلة للرسملة على تكلفة المصنع = 240,000 - 40,000 = 200,000 ج.م. ترسمَل بالكامل لحساب مشروعات تحت التنفيذ.',
      calculationEn: 'Net capitalizable borrowing cost added to CWIP = 240,000 - 40,000 = 200,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مشروعات تحت التنفيذ - مبنى المصنع الجديد (فوائد مرسملة)',
        accountEn: 'Capital Work-in-Progress (CWIP) - Capitalized Interest',
        debit: '200,000',
        credit: '-',
        notesAr: 'رسملة صافي فوائد القرض المخصص كجزء من تكلفة الأصل',
        notesEn: 'Capitalize net borrowing cost to asset under construction'
      },
      {
        accountAr: 'حـ/ البنك (دخل فوائد الاستثمار المؤقت للسيولة الفائضة)',
        accountEn: 'Cash at Bank (Temporary Idle Funds Interest)',
        debit: '40,000',
        credit: '-',
        notesAr: 'تحصيل عوائد الاستثمار المؤقت لأموال القرض',
        notesEn: 'Receive temporary deposit interest income'
      },
      {
        accountAr: 'حـ/ فوائد قروض مستحقة الدفع للبنك',
        accountEn: 'Accrued Loan Interest Payable',
        debit: '-',
        credit: '240,000',
        notesAr: 'استحقاق كامل فائدة القرض للبنك بنسبة 12%',
        notesEn: 'Recognize total gross interest payable to bank'
      }
    ],
    disclosuresAr: [
      'مبلغ تكاليف الاقتراض التي تمت رسملتها خلال الفترة المالية.',
      'معدل الرسملة المرجح المستخدم لتحديد مبالغ تكاليف الاقتراض المؤهلة للرسملة.',
      'طبيعة الأصول المؤهلة والمدد الزمنية المتوقعة للانتهاء منها.'
    ],
    disclosuresEn: [
      'Amount of borrowing costs capitalized during the period.',
      'Capitalization rate used to determine borrowing costs eligible for capitalization from general borrowings.',
      'Nature of qualifying assets and expected completion milestones.'
    ],
    commonPitfallsAr: [
      'رسملة الفوائد على أصول جاهزة للاستخدام أو أصول لا تتطلب فترة زمنية طويلة للتجهيز (Non-qualifying assets).',
      'الاستمرار في رسملة تكاليف الاقتراض أثناء فترات التوقف المطول غير المخطط له عن أعمال البناء الفعلية.'
    ],
    commonPitfallsEn: [
      'Capitalizing interest on assets ready for immediate use or not requiring substantial preparation.',
      'Continuing to capitalize interest during prolonged interruptions of active construction development.'
    ]
  },

  // ==========================================
  // IAS 24 — Related Party Disclosures
  // ==========================================
  {
    code: 'IAS 24',
    family: 'IAS',
    titleAr: 'الإفصاح عن الأطراف ذات العلاقة',
    titleEn: 'Related Party Disclosures',
    category: 'presentation',
    effectiveDate: '01/01/2011 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-24-related-party-disclosures/',
    objectiveAr: 'ضمان أن القوائم المالية تحتوي على الإفصاحات الضرورية للفت الانتباه إلى احتمالية تأثر المركز المالي والربح بوجود أطراف ذات علاقة وبالمعاملات والأرصدة القائمة معها.',
    objectiveEn: 'Ensure financial statements draw attention to the possibility that financial position and P&L have been affected by related parties, transactions, and outstanding balances.',
    scopeAr: 'علاقات الأطراف ذات العلاقة، المعاملات، والأرصدة القائمة معها بما في ذلك الالتزامات والارتباطات بين الشركة الأم، التوابع، الزملاء، الإدارة العليا، والملاك الرئيسيين.',
    scopeEn: 'Related party relationships, transactions, outstanding balances, and commitments between parent, subsidiaries, associates, KMP, and key owners.',
    recognitionAr: 'معيار إفصاح رقابي وتنظيمي صارم؛ لا يفرض معالجات محاسبية خاصة لكنه يمنع طمس المعاملات وتجميعها في بنود الموردين أو العملاء التجاريين المعتادين.',
    recognitionEn: 'Strict disclosure standard; transactions must be tracked distinctly and segregated from routine third-party trade accounts.',
    measurementInitialAr: 'الإفصاح عن حجم المعاملات، الأرصدة القائمة وشروطها (ضمانات، فوائد، آجال)، ومخصصات الديون المشكوك في تحصيلها المتعلقة بها.',
    measurementInitialEn: 'Disclose transaction amounts, outstanding balances and terms (security, interest, settlement), and bad debt provisions recorded against balances.',
    measurementSubsequentAr: 'الإفصاح الإلزامي المنفصل عن تعويضات ومكافآت كبار مسؤولي الإدارة (Key Management Personnel) مقسمة حسب الفئات.',
    measurementSubsequentEn: 'Mandatory segregated disclosure of Key Management Personnel compensation broken down by benefit categories.',
    erpImplementationAr: 'ترميز حسابات الأطراف ذات العلاقة في شجرة الحسابات بدليل منفصل (Intercompany / Related Party AR & AP) ومنع تداخلها مع العملاء العاديين.',
    erpImplementationEn: 'Dedicated chart of accounts sub-ranges for Related Party AR/AP, and automated extraction of intercompany volume and KMP compensation.',
    erpModules: ['chart_of_accounts', 'accounts_receivable', 'accounts_payable', 'payroll'],
    numericalExample: {
      titleAr: 'إفصاح المعاملات مع شركة شقيقة ومكافآت الإدارة العليا',
      titleEn: 'Related Party Transactions and KMP Compensation Footnote',
      scenarioAr: 'قامت الشركة ببيع بضائع لشركة شقيقة تابعة لنفس المالك بقيمة 1,500,000 ج.م بشروط سداد ميسرة (رصيد متبقٍ 400,000 ج.م). كما بلغت رواتب ومكافآت أعضاء مجلس الإدارة التنفيذيين 900,000 ج.م.',
      scenarioEn: 'Entity sold goods of 1.5M EGP to sister company owned by same shareholder (ending balance 400k EGP). Executive board compensation was 900k EGP.',
      calculationAr: 'الإفصاح في الإيضاح: إجمالي المبيعات للطرف ذي العلاقة 1,500,000 ج.م، رصيد المدينين 400,000 ج.م. تعويضات كبار مسؤولي الإدارة = 900,000 ج.م.',
      calculationEn: 'Disclosed in footnote: Total sister company sales 1.5M EGP, ending receivables 400k EGP. Key Management Personnel compensation = 900k EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ أطراف ذات علاقة مدينة (شركة الصفا الشقيقة)',
        accountEn: 'Due from Related Parties (Sister Entity Al-Safa)',
        debit: '1,500,000',
        credit: '-',
        notesAr: 'إثبات مبيعات تجارية لطرف ذي علاقة في حساب منفصل تماماً',
        notesEn: 'Record related party trade sales in segregated control account'
      },
      {
        accountAr: 'حـ/ إيرادات مبيعات لأطراف ذات علاقة',
        accountEn: 'Revenues from Related Party Sales',
        debit: '-',
        credit: '1,500,000',
        notesAr: 'تسجيل المبيعات في بند مستقل لتسهيل إعداد إيضاح IAS 24',
        notesEn: 'Credit related party sales revenue line'
      }
    ],
    disclosuresAr: [
      'طبيعة العلاقة بين الطرفين وأسماء الشركات الأم أو المالك النهائي المسيطر.',
      'مبالغ المعاملات، الأرصدة القائمة، وشروط التسوية وما إذا كانت بضمانات أو بدون ضمانات.',
      'تفصيل تعويضات مسؤولي الإدارة العليا: منافع قصيرة الأجل، منافع ما بعد الخدمة، منافع إنهاء الخدمة، ومدفوعات على أساس الأسهم.'
    ],
    disclosuresEn: [
      'Nature of relationships, controlling parent, and ultimate controlling party.',
      'Amount of transactions, outstanding balances, terms, interest rates, and guarantees.',
      'Detailed breakdown of Key Management Personnel compensation: short-term, post-employment, termination, and share-based benefits.'
    ],
    commonPitfallsAr: [
      'إدماج حسابات الأطراف ذات العلاقة ضمن حسابات العملاء أو الموردين التجاريين العاديين دون إظهارها في بند مستقل.',
      'التصريح بأن المعاملات تمت "وفق شروط السوق المحايدة العادلة" (Arm\'s Length) دون وجود أدلة وإثباتات موثقة تدعم ذلك.'
    ],
    commonPitfallsEn: [
      'Commiscing related party balances with standard trade AR/AP without distinct footnote disclosure.',
      'Stating that transactions were made on terms equivalent to arm\'s length transactions without substantiated evidence.'
    ]
  },

  // ==========================================
  // IAS 28 — Investments in Associates and Joint Ventures
  // ==========================================
  {
    code: 'IAS 28',
    family: 'IAS',
    titleAr: 'الاستثمارات في شركات زميلة ومشروعات مشتركة',
    titleEn: 'Investments in Associates and Joint Ventures',
    category: 'group',
    effectiveDate: '01/01/2013 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-28-investments-in-associates-and-joint-ventures/',
    objectiveAr: 'تحديد المحاسبة عن الاستثمارات في شركات زميلة وتوضيح متطلبات تطبيق طريقة حقوق الملكية (Equity Method) عند المحاسبة عن الاستثمارات في شركات زميلة ومشروعات مشتركة.',
    objectiveEn: 'Prescribe the accounting for investments in associates and set out requirements for the application of the equity method when accounting for associates and joint ventures.',
    scopeAr: 'المنشآت التي تمتلك نفوذاً مؤثراً (Significant Influence) على منشأة مستثمر فيها (عادة 20% فأكثر من حقوق التصويت دون سيطرة)، أو شريكاً في مشروع مشترك.',
    scopeEn: 'Entities having significant influence over an investee (presumed at 20% or more voting power without control) or joint ventures.',
    recognitionAr: 'الاعتراف بالاستثمار مبدئياً بالتكلفة (Cost).',
    recognitionEn: 'Recognized initially at cost.',
    measurementInitialAr: 'تتضمن التكلفة المبدئية الشهرة الضمنية (Implicit Goodwill) في تاريخ الاقتناء الناتجة عن الفرق بين تكلفة الشراء وحصة المستثمر في القيمة العادلة لصافي أصول الزميلة.',
    measurementInitialEn: 'Initial cost includes implicit goodwill arising from difference between acquisition cost and investor share of fair value of identifiable net assets.',
    measurementSubsequentAr: 'تطبيق طريقة حقوق الملكية: تعديل القيمة الدفترية للاستثمار لزيادة أو تخفيض رصيده بنصيب المستثمر في أرباح أو خسائر الزميلة بعد الاقتناء، وتخفيض رصيد الاستثمار بالتوزيعات النقدية المستلمة.',
    measurementSubsequentEn: 'Equity method applied: Carrying amount adjusted upward/downward by investor\'s share of post-acquisition profits/losses, and reduced by dividends received.',
    erpImplementationAr: 'إدارة بطاقة الاستثمار المالي، واحتساب نصيب الشركة الآلي من أرباح الشركة الزميلة السنوية مع معالجة التوزيعات.',
    erpImplementationEn: 'Investment subledger, automated share of associate P&L calculation, dividend cash application, and OCI tracking.',
    erpModules: ['chart_of_accounts', 'journal_entries', 'general_ledger'],
    numericalExample: {
      titleAr: 'تطبيق طريقة حقوق الملكية وإثبات حصة الأرباح واستلام التوزيعات',
      titleEn: 'Equity Method Accounting for 30% Associate Stake',
      scenarioAr: 'اشترت شركة 30% من أسهم شركة زميلة بتكلفة 1,000,000 ج.م. حققت الشركة الزميلة صافي ربح قدره 400,000 ج.م خلال العام، وأعلنت ووزعت أرباحاً نقدية بلغت 150,000 ج.م.',
      scenarioEn: 'Company acquired 30% associate stake for 1,000,000 EGP. Associate generated 400,000 EGP net profit, and paid dividends of 150,000 EGP.',
      calculationAr: 'نصيب الشركة من الربح = 400,000 × 30% = 120,000 ج.م (يزيد الاستثمار). نصيب الشركة من التوزيعات = 150,000 × 30% = 45,000 ج.م (يخفض الاستثمار). القيمة الدفترية الختامية = 1,000,000 + 120,000 - 45,000 = 1,075,000 ج.م.',
      calculationEn: 'Share of profit = 400k x 30% = 120k EGP (increases investment). Share of dividend = 150k x 30% = 45k EGP (reduces investment). Ending carrying amount = 1,075,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ الاستثمارات في شركات زميلة (طريقة حقوق الملكية)',
        accountEn: 'Investments in Associates (Equity Method)',
        debit: '120,000',
        credit: '-',
        notesAr: 'زيادة القيمة الدفترية للاستثمار بنصيب 30% من صافي ربح الزميلة',
        notesEn: 'Increase investment carrying value by 30% share of associate profit'
      },
      {
        accountAr: 'حـ/ إيرادات حصة من أرباح شركات زميلة (قائمة الدخل)',
        accountEn: 'Share of Profit of Associates (P&L)',
        debit: '-',
        credit: '120,000',
        notesAr: 'إثبات حصة الأرباح في قائمة الدخل',
        notesEn: 'Recognize investor share of post-acquisition profit in P&L'
      },
      {
        accountAr: 'حـ/ نقدية بالبنك (توزيعات أرباح محصلة من الزميلة)',
        accountEn: 'Cash at Bank (Dividends Received)',
        debit: '45,000',
        credit: '-',
        notesAr: 'استلام نصيب الشركة من التوزيعات النقدية المعلنة',
        notesEn: 'Receive cash dividend from associate'
      },
      {
        accountAr: 'حـ/ الاستثمارات في شركات زميلة (طريقة حقوق الملكية)',
        accountEn: 'Investments in Associates (Equity Method)',
        debit: '-',
        credit: '45,000',
        notesAr: 'تخفيض القيمة الدفترية للاستثمار بمبلغ التوزيعات المستلمة',
        notesEn: 'Reduce carrying amount of investment by dividends received'
      }
    ],
    disclosuresAr: [
      'قائمة بالشركات الزميلة والمشروعات المشتركة الهامة ونسب الملكية وحقوق التصويت.',
      'معلومات مالية ملخصة عن الشركات الزميلة (الموجودات، المطلوبات، الإيرادات، صافي الدخل).',
      'القيمة السوقية العادلة للاستثمارات في الشركات الزميلة إذا كانت أسهمها متداولة بالبورصة ومقارنتها بالقيمة الدفترية.'
    ],
    disclosuresEn: [
      'List of significant associates/joint ventures, ownership interest, and voting rights.',
      'Summarized financial information of material associates (assets, liabilities, revenues, net profit).',
      'Quoted market price of associate shares traded in active public markets compared to carrying amount.'
    ],
    commonPitfallsAr: [
      'الاعتراف بالتوزيعات النقدية المستلمة كإيراد استثماري في قائمة الدخل بدلاً من تخفيض القيمة الدفترية للاستثمار، وهو خطأ جسيم ينتهك طريقة حقوق الملكية.',
      'استمرار الاعتراف بالخسائر بعد انخفاض قيمة الاستثمار للصفر، ما لم تكن المنشأة قد كفلت التزامات قانونية عن الزميلة.'
    ],
    commonPitfallsEn: [
      'Recognizing cash dividends as income in P&L instead of reducing investment carrying amount under equity method.',
      'Continuing to recognize share of losses below zero without legal/constructive obligation to fund associate debts.'
    ]
  },

  // ==========================================
  // IAS 32 — Financial Instruments: Presentation
  // ==========================================
  {
    code: 'IAS 32',
    family: 'IAS',
    titleAr: 'الأدوات المالية: العرض',
    titleEn: 'Financial Instruments: Presentation',
    category: 'financial_instruments',
    effectiveDate: '01/01/2005 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-32-financial-instruments-presentation/',
    objectiveAr: 'إرساء مبادئ عرض الأدوات المالية كالتزامات أو حقوق ملكية والمقاصة بين الأصول والالتزامات المالية.',
    objectiveEn: 'Establish principles for presenting financial instruments as liabilities or equity, and for offsetting financial assets and liabilities.',
    scopeAr: 'تصنيف الأدوات الصادرة من المنشأة إلى التزامات مالية (Financial Liabilities) أو أدوات حقوق ملكية (Equity Instruments)، وأدوات التمويل المركبة (Compound Instruments).',
    scopeEn: 'Classification of issued financial instruments into liabilities or equity, compound instruments, and offset rules.',
    recognitionAr: 'التصنيف يستند إلى الجوهر الاقتصادي للترتيب التعاقدي وليس مجرد الشكل القانوني. إذا وجد التزام تعاقدي غير مشروط بتسليم نقدية أو أصل مالي آخر، تصنف الأداة كالتزام مالي حتماً (مثل الأسهم الممتازة القابلة للاسترداد).',
    recognitionEn: 'Substance over form rule: If there is an unconditional contractual obligation to deliver cash or another financial asset, instrument is a liability (e.g. redeemable preferred shares).',
    measurementInitialAr: 'فصل الأدوات المركبة (مثل السندات القابلة للتحويل إلى أسهم - Convertible Bonds) إلى مكون التزام (Liability Component) يقاس بالقيمة الحالية للتدفقات، ومكون حقوق ملكية (Equity Component) يمثل المتبقي.',
    measurementInitialEn: 'Split accounting for compound instruments (e.g. convertible debt): liability component at PV of contractual cash flows; residual assigned to equity component.',
    measurementSubsequentAr: 'الفائدة وأرباح الأسهم والمكاسب والخسائر المتعلقة بالتزام مالي تثبت في الأرباح أو الخسائر. أما التوزيعات على أدوات حقوق الملكية فتحمل مباشرة على حقوق الملكية.',
    measurementSubsequentEn: 'Interest and gains/losses related to financial liabilities recognized in P&L. Distributions to equity holders debited directly to equity.',
    erpImplementationAr: 'إدارة السندات المركبة، وجدولة استهلاك علاوة/خصم الإصدار، وفصل توزيعات الأرباح عن فوائد التمويل.',
    erpImplementationEn: 'Compound instrument split configuration, bond amortized cost schedules, and equity vs liability dividend routing.',
    erpModules: ['chart_of_accounts', 'loans_financing', 'journal_entries'],
    numericalExample: {
      titleAr: 'فصل سندات قابلة للتحويل لأسهم إلى مكون التزام ومكون حقوق ملكية',
      titleEn: 'Convertible Bond Split Accounting (IAS 32)',
      scenarioAr: 'أصدرت شركة سندات قابلة للتحويل إلى أسهم بقيمة اسمية 1,000,000 ج.م بفائدة سنوية 6% لمدة 3 سنوات. معدل الفائدة السوقي لسندات مماثلة غير قابلة للتحويل هو 9%. بلغت القيمة الحالية للفوائد وأصل الدين 924,000 ج.م.',
      scenarioEn: 'Company issues 1M EGP 3-year convertible bonds at 6% coupon. Market interest rate for similar debt without conversion rights is 9%. PV of debt flows = 924,000 EGP.',
      calculationAr: 'مكون الالتزام المالي = 924,000 ج.م. مكون حقوق الملكية (علاوة التحويل المتبقية) = 1,000,000 - 924,000 = 76,000 ج.م.',
      calculationEn: 'Liability component = 924,000 EGP. Equity conversion option component (residual) = 1,000,000 - 924,000 = 76,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ البنك (متحصلات إصدار السندات القابلة للتحويل)',
        accountEn: 'Cash at Bank (Convertible Bond Proceeds)',
        debit: '1,000,000',
        credit: '-',
        notesAr: 'استلام كامل القيمة الاسمية لإصدار السندات',
        notesEn: 'Receive gross proceeds of issuance'
      },
      {
        accountAr: 'حـ/ التزامات قروض - سندات قابلة للتحويل (مكون الالتزام)',
        accountEn: 'Bonds Payable (Liability Component)',
        debit: '-',
        credit: '924,000',
        notesAr: 'إثبات مكون الالتزام بالقيمة الحالية للتدفقات المخصومة بمعدل السوق',
        notesEn: 'Recognize financial liability component at market PV'
      },
      {
        accountAr: 'حـ/ حقوق الملكية - خيار تحويل السندات لأسهم',
        accountEn: 'Equity - Convertible Bond Option Reserve',
        debit: '-',
        credit: '76,000',
        notesAr: 'إثبات القيمة المتبقية كمكون حقوق ملكية لا يعاد تقييمه',
        notesEn: 'Recognize residual conversion option in equity'
      }
    ],
    disclosuresAr: [
      'شروط وأحكام الأدوات المالية التي قد تؤثر في مبالغ وتوقيت ومؤكدية التدفقات النقدية المستقبلية.',
      'سياسات إدارة رأس المال وأدوات التمويل المركبة المصدرة ومواعيد تحويلها أو استردادها.',
      'شروط المقاصة بين الأصول والالتزامات المالية والمبالغ المقاصة.'
    ],
    disclosuresEn: [
      'Terms and conditions of financial instruments that may affect amount, timing, and certainty of cash flows.',
      'Capital management policies and compound debt conversion terms.',
      'Gross and net offset amounts under legally enforceable netting agreements.'
    ],
    commonPitfallsAr: [
      'تصنيف أسهم ممتازة قابلة للاسترداد الإلزامي (Mandatorily Redeemable Preferred Shares) كحقوق ملكية، بينما هي التزام مالي صريح يحمل فوائد تمويلية في قائمة الدخل.',
      'إجراء مقاصة بين أرصدة العملاء والموردين دون وجود حق قانوني نافذ حالياً للمقاصة ونيّة صريحة للتسوية على أساس الصافي.'
    ],
    commonPitfallsEn: [
      'Classifying mandatorily redeemable preference shares as equity rather than financial debt liabilities.',
      'Offsetting assets and liabilities without a currently enforceable legal right and intent to settle net.'
    ]
  },

  // ==========================================
  // IAS 33 — Earnings per Share
  // ==========================================
  {
    code: 'IAS 33',
    family: 'IAS',
    titleAr: 'ربحية السهم',
    titleEn: 'Earnings per Share',
    category: 'presentation',
    effectiveDate: '01/01/2005 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-33-earnings-per-share/',
    objectiveAr: 'تحديد مبادئ احتساب وعرض ربحية السهم لتحسين مقارنة الأداء بين منشآت مختلفة في نفس الفترة وبين فترات محاسبية مختلفة لنفس المنشأة.',
    objectiveEn: 'Prescribe principles for determining and presenting earnings per share (EPS) to improve performance comparisons across entities and periods.',
    scopeAr: 'المنشآت التي تتداول أسهمها العادية علناً في البورصة أو تكون في مرحلة التسجيل لطرح أسهمها في سوق مالي عام.',
    scopeEn: 'Entities whose ordinary shares are publicly traded on an exchange or filing to issue ordinary shares publicly.',
    recognitionAr: 'حساب وعرض نوعين من ربحية السهم في صلب قائمة الدخل: 1) ربحية السهم الأساسية (Basic EPS)، 2) ربحية السهم المخفضة (Diluted EPS).',
    recognitionEn: 'Mandatory presentation on the face of income statement: 1) Basic EPS, and 2) Diluted EPS.',
    measurementInitialAr: 'ربحية السهم الأساسية = (صافي الربح المتاح للمساهمين العاديين بعد خصم أرباح الأسهم الممتازة) ÷ (المتوسط المرجح لعدد الأسهم العادية القائمة خلال الفترة).',
    measurementInitialEn: 'Basic EPS = (Profit attributable to ordinary equity holders) / (Weighted average number of ordinary shares outstanding).',
    measurementSubsequentAr: 'ربحية السهم المخفضة: تعديل البسط (إعادة إضافة فوائد السندات القابلة للتحويل بعد خصم الضريبة) والمقام (بإضافة الأسهم المحتملة المصدرة من الخيارات والسندات) إذا كانت ذات أثر مخفض (Dilutive).',
    measurementSubsequentEn: 'Diluted EPS: Adjust profit and share count for potential dilutive ordinary shares (options, warrants, convertible bonds). Anti-dilutive items ignored.',
    erpImplementationAr: 'محرك حساب المتوسط المرجح لحركة الأسهم (زيادات رأس المال، أسهم مجانية، أسهم خزينة) وعرض مؤشر EPS في تقارير المركز المالي.',
    erpImplementationEn: 'Weighted average share schedule engine taking into account bonus issues, splits, treasury stock, and automated EPS calculation.',
    erpModules: ['reports', 'chart_of_accounts', 'journal_entries'],
    numericalExample: {
      titleAr: 'احتساب ربحية السهم الأساسية بعد زيادة رأس المال وإصدار أسهم منحة',
      titleEn: 'Basic EPS Calculation with Mid-Year Share Issuance',
      scenarioAr: 'شركة حققت صافي ربح قدره 1,200,000 ج.م. كان لديها 500,000 سهم عادي قائم في 01/01. أصدرت 200,000 سهم جديد في 01/07 (6 أشهر).',
      scenarioEn: 'Entity earned 1.2M EGP net profit. 500k shares outstanding at start of year; 200k new shares issued on 1 July (6 months).',
      calculationAr: 'المتوسط المرجح لعدد الأسهم = 500,000 + (200,000 × 6 ÷ 12) = 600,000 سهم. ربحية السهم الأساسية = 1,200,000 ÷ 600,000 = 2.00 ج.م لكل سهم.',
      calculationEn: 'Weighted average shares = 500,000 + (200,000 x 6/12) = 600,000 shares. Basic EPS = 1,200,000 / 600,000 = 2.00 EGP per share.'
    },
    journalEntries: [
      {
        accountAr: 'ملاحظة: معيار IAS 33 معيار احتساب إحصائي وعرضي في صلب قائمة الدخل',
        accountEn: 'Note: IAS 33 is a metric presentation standard in the P&L statement',
        debit: '-',
        credit: '-',
        notesAr: 'يعرض رقم ربحية السهم أسفل صافي الربح في صلب قائمة الدخل والإيضاحات',
        notesEn: 'Presented directly on the face of statement of profit or loss'
      }
    ],
    disclosuresAr: [
      'مبالغ الأرباح المستخدمة كبسط في احتساب ربحية السهم الأساسية والمخفضة مع تسويتها لصافي دخل الفترة.',
      'المتوسط المرجح لعدد الأسهم العادية المستخدم كمقام مع تفصيل تأثير الأسهم المحتملة.',
      'الأدوات المالية التي قد تؤدي إلى تخفيض ربحية السهم مستقبلاً لكنها لم تدرج لكونها مضادة للتخفيض في الفترة الحالية.'
    ],
    disclosuresEn: [
      'Earnings figures used as numerators reconciled to profit/loss for the period.',
      'Weighted average number of ordinary shares used as denominators and reconciliation to basic count.',
      'Instruments that could potentially dilute basic EPS in the future but were antidilutive in periods presented.'
    ],
    commonPitfallsAr: [
      'عدم تعديل فترات المقارنة السابقة بأثر رجعي عند إجراء توزيع أسهم مجانية (Bonus Shares) أو تجزئة للأسهم (Stock Split).',
      'تضمين أدوات مضادة للتخفيض (Anti-dilutive) تؤدي إلى زيادة ربحية السهم في حساب الـ Diluted EPS.'
    ],
    commonPitfallsEn: [
      'Failing to adjust comparative prior periods retrospectively for bonus issues or share splits.',
      'Including anti-dilutive potential instruments that would falsely improve diluted EPS.'
    ]
  },

  // ==========================================
  // IAS 34 — Interim Financial Reporting
  // ==========================================
  {
    code: 'IAS 34',
    family: 'IAS',
    titleAr: 'التقارير المالية الأولية',
    titleEn: 'Interim Financial Reporting',
    category: 'presentation',
    effectiveDate: '01/01/1999 (محدث)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-34-interim-financial-reporting/',
    objectiveAr: 'تحديد الحد الأدنى من محتوى التقرير المالي الأولي وتحديد مبادئ الاعتراف والقياس في القوائم المالية الكاملة أو المختصرة لفترة أولية (ربع سنوية أو نصف سنوية).',
    objectiveEn: 'Prescribe the minimum content of an interim financial report and the principles for recognition and measurement in complete or condensed interim financial statements.',
    scopeAr: 'المنشآت المطالبة نظاماً أو التي تختار طوعاً نشر تقارير مالية أولية وفقاً لمعايير IFRS.',
    scopeEn: 'Applies if an entity is required or elects to publish an interim financial report in accordance with IFRS.',
    recognitionAr: 'تطبيق نفس السياسات المحاسبية المتبعة في القوائم السنوية (Integral Approach). يجب ألا تؤجل أو تقدم التكاليف التي يتم تكبدها موسمياً إلا إذا كان ذلك جائزاً في نهاية السنة.',
    recognitionEn: 'Apply the same accounting policies as in annual financial statements; seasonal costs must not be anticipated or deferred unless permitted at year-end.',
    measurementInitialAr: 'يتم احتساب مصروف ضريبة الدخل في الفترة الأولية استناداً إلى أفضل تقدير للمتوسط المرجح لمعدل ضريبة الدخل السنوي المتوقع (Estimated Average Annual Effective Tax Rate).',
    measurementInitialEn: 'Income tax expense recognized based on best estimate of the weighted-average annual effective income tax rate expected for full financial year.',
    measurementSubsequentAr: 'الإفصاح عن الأحداث والمعاملات الهامة لفهم التغيرات في المركز المالي والأداء منذ تاريخ آخر تقرير سنوي.',
    measurementSubsequentEn: 'Update for significant events and transactions since the end of the last annual reporting period.',
    erpImplementationAr: 'إقفال الفترات الربع سنوية وتوليد القوائم المالية المختصرة المقارنة ومطابقة حركات الأرباح والخسائر التراكمية.',
    erpImplementationEn: 'Automated quarterly close cycles, condensed comparative financial reporting, and cumulative year-to-date tracking.',
    erpModules: ['reports', 'general_ledger', 'chart_of_accounts'],
    numericalExample: {
      titleAr: 'حساب مخصص ضريبة الدخل للربع الأول بمعدل الضريبة الفعلي السنوي المقدر',
      titleEn: 'Interim Income Tax Expense Allocation (Effective Tax Rate Method)',
      scenarioAr: 'حققت شركة أرباحاً قبل الضريبة في الربع الأول قدرها 500,000 ج.م. تتوقع الشركة تحقيق ربح سنوي إجمالي قدره 2,000,000 ج.م بضريبة سنوية متوقعة قدرها 450,000 ج.م (معدل ضريبي سنوي فعال = 22.5%).',
      scenarioEn: 'Entity earned 500k EGP pre-tax profit in Q1. Full year pre-tax profit projected at 2M EGP with expected tax of 450k EGP (effective tax rate = 22.5%).',
      calculationAr: 'ضريبة الدخل المعتمدة للربع الأول = 500,000 × 22.5% = 112,500 ج.م (بغض النظر عن شرائح الدفع الفعلية الربع سنوية).',
      calculationEn: 'Q1 Income tax expense = 500,000 x 22.5% = 112,500 EGP applied evenly using estimated annual effective tax rate.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصروف ضريبة الدخل (التقرير الأولي - الربع الأول)',
        accountEn: 'Income Tax Expense (Interim Q1)',
        debit: '112,500',
        credit: '-',
        notesAr: 'تحميل الربع الأول بمصروف الضريبة استناداً للمعدل السنوي الفعال المتوقع',
        notesEn: 'Record Q1 tax expense at expected annual effective rate'
      },
      {
        accountAr: 'حـ/ مخصص ضرائب الدخل المستحقة',
        accountEn: 'Current Tax Payable Provision',
        debit: '-',
        credit: '112,500',
        notesAr: 'إثبات التزام الضريبة المستحقة للفترة الأولية',
        notesEn: 'Recognize accrued tax payable liability'
      }
    ],
    disclosuresAr: [
      'بيان صريح بالتوافق مع معيار IAS 34.',
      'طبيعة ومبالغ البنود غير المعتادة التي تؤثر في الأصول والالتزامات وصافي الدخل والتدفقات النقدية.',
      'التغيرات في التقديرات المحاسبية والإفصاح عن موسمية العمليات التشغيلية (Seasonality).',
      'توزيعات الأرباح المدفوعة أو المقترحة، والأحداث الهامة اللاحقة لنهاية الفترة الأولية.'
    ],
    disclosuresEn: [
      'Explicit statement of compliance with IAS 34.',
      'Explanatory comments about seasonality or cyclicality of interim operations.',
      'Nature and amount of unusual items affecting assets, liabilities, equity, net income, or cash flows.',
      'Dividends paid and significant events subsequent to the end of the interim period.'
    ],
    commonPitfallsAr: [
      'تأجيل نفقات الصيانة أو الإعلانات الدورية المتكبدة في ربع معين وتوزيعها على الفترات التالية رغم عدم استيفائها تعريف الأصل المؤجل.',
      'حساب ضريبة الدخل في الربع الأول وفق شرائح الضريبة التصاعدية المحلية بدلاً من تطبيق معدل الضريبة السنوي الفعال المتوقع.'
    ],
    commonPitfallsEn: [
      'Deferring routine operating expenses incurred in Q1 to future quarters without meeting asset criteria.',
      'Calculating interim income tax using discrete quarterly brackets instead of projected full-year effective tax rate.'
    ]
  },

  // ==========================================
  // IAS 41 — Agriculture
  // ==========================================
  {
    code: 'IAS 41',
    family: 'IAS',
    titleAr: 'الزراعة والأصول الحيوية',
    titleEn: 'Agriculture',
    category: 'specialized',
    effectiveDate: '01/01/2003 (محدث مع تعديلات النباتات المثمرة 2016)',
    status: 'active',
    officialSource: 'IFRS Foundation / IASB',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ias-41-agriculture/',
    objectiveAr: 'تحديد المعالجة المحاسبية والعرض والإفصاح المتعلق بالنشاط الزراعي وإدارة التحول الحيوي للأصول الحيوية.',
    objectiveEn: 'Prescribe accounting treatment and disclosures related to agricultural activity: biological transformation and harvest.',
    scopeAr: 'الأصول الحيوية (Biological Assets) باستثناء النباتات المثمرة (Bearer Plants)، والمنتجات الزراعية عند نقطة الحصاد، والمنح الحكومية الزراعية.',
    scopeEn: 'Biological assets (except bearer plants which fall under IAS 16), agricultural produce at point of harvest, and agricultural grants.',
    recognitionAr: 'الاعتراف بالأصل الحيوي عند سيطرة المنشأة عليه نتيجة أحداث سابقة، واحتمال تدفق منافع اقتصادية، وإمكانية قياس القيمة العادلة أو التكلفة بموثوقية.',
    recognitionEn: 'Recognized when entity controls asset as result of past event, future economic benefits probable, and fair value or cost reliably measurable.',
    measurementInitialAr: 'تقاس الأصول الحيوية عند الاعتراف الأولي وفي كل تاريخ تقرير بالقيمة العادلة ناقصاً تكاليف البيع (Fair Value less costs to sell).',
    measurementInitialEn: 'Measured on initial recognition and at each balance sheet date at fair value less costs to sell.',
    measurementSubsequentAr: 'تثبت الأرباح أو الخسائر الناتجة عن التغير في القيمة العادلة ناقصاً تكاليف البيع للأصل الحيوي في قائمة الأرباح أو الخسائر (P&L) للفترة التي نشأت فيها.',
    measurementSubsequentEn: 'Gains or losses arising on initial recognition and from changes in fair value less costs to sell recognized in P&L for period.',
    erpImplementationAr: 'إدارة بطاقات قطعان الماشية والمنتجات الزراعية، واحتساب فروق إعادة التقييم الدوري والوزن الحيوي في الأرباح والخسائر.',
    erpImplementationEn: 'Livestock herd and biological asset registry, growth and biological transformation tracking, and automated mark-to-market FV adjustments.',
    erpModules: ['inventory', 'fixed_assets', 'chart_of_accounts', 'journal_entries'],
    numericalExample: {
      titleAr: 'إثبات الزيادة في القيمة العادلة لقطيع مواشي نتيجة النمو الحيوي وتغيرات السوق',
      titleEn: 'Biological Asset Fair Value Revaluation (Livestock Herd)',
      scenarioAr: 'تمتلك مزرعة قطيع مواشي قيمته الدفترية في 01/01/2025 تبلغ 500,000 ج.م. في 31/12/2025 بلغت القيمة العادلة للقطيع في سوق المواشي 680,000 ج.م، وتكاليف النقل والبيع المقدرة 30,000 ج.م (الصافي = 650,000 ج.م).',
      scenarioEn: 'Dairy farm owns cattle herd with carrying amount of 500k EGP on 01/01/2025. At year-end, fair value is 680k EGP and selling/transport costs 30k EGP (Net = 650k EGP).',
      calculationAr: 'القيمة العادلة ناقصاً تكاليف البيع = 650,000 ج.م. مكاسب التحول الحيوي وتغير الأسعار المسجلة في الدخل = 650,000 - 500,000 = 150,000 ج.م.',
      calculationEn: 'Fair value less costs to sell = 650k EGP. Biological transformation gain recognized in P&L = 650k - 500k = 150,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ أصول حيوية - قطيع المواشي',
        accountEn: 'Biological Assets - Livestock Herd',
        debit: '150,000',
        credit: '-',
        notesAr: 'إثبات الزيادة في القيمة العادلة للقطيع نتيجة النمو وتغير الأسعار',
        notesEn: 'Recognize biological growth and market fair value uplift'
      },
      {
        accountAr: 'حـ/ مكاسب تقييم أصول حيوية بالقيمة العادلة (قائمة الدخل)',
        accountEn: 'Fair Value Gain on Biological Assets (P&L)',
        debit: '-',
        credit: '150,000',
        notesAr: 'تسجيل المكاسب الحيوية مباشرة في الأرباح والخسائر وفق معيار IAS 41',
        notesEn: 'Credit biological asset valuation gain to P&L'
      }
    ],
    disclosuresAr: [
      'وصف لكل مجموعة من الأصول الحيوية والكميات ومقاييس الطبيعة الحيوية.',
      'مطابقة حركة الأصول الحيوية بين أول الفترة ونهايتها (التغيرات الناتجة عن السعر والنمو والولادات والمبيعات).',
      'طرق وفرضيات تحديد القيمة العادلة للأصول الحيوية والمنتجات الزراعية.'
    ],
    disclosuresEn: [
      'Description of each group of biological assets and quantitative counts/metrics.',
      'Reconciliation of changes in carrying amount distinguishing price changes from physical growth/harvest.',
      'Methods and significant assumptions used in determining fair value less costs to sell.'
    ],
    commonPitfallsAr: [
      'معاملة النباتات المثمرة (مثل أشجار النخيل وأشجار الفاكهة) كأصول حيوية خاضعة لمعيار IAS 41، في حين أنها تعامل محاسبياً كأصول ثابتة وفق IAS 16 وتخضع للإهلاك.',
      'تسجيل أرباح تقييم الأصول الحيوية في الدخل الشامل الآخر (OCI) بدلاً من قائمة الدخل المباشرة (P&L).'
    ],
    commonPitfallsEn: [
      'Treating bearer plants (e.g. fruit orchards, palm trees) under IAS 41 instead of IAS 16 PPE with depreciation.',
      'Routing biological fair value gains through OCI instead of directly through profit or loss (P&L).'
    ]
  },

  // ==========================================
  // IFRIC 23 — Uncertainty over Income Tax Treatments
  // ==========================================
  {
    code: 'IFRIC 23',
    family: 'IFRIC',
    titleAr: 'عدم اليقين بشأن المعالجات الضريبية لدخل المنشأة',
    titleEn: 'Uncertainty over Income Tax Treatments',
    category: 'liabilities_equity',
    effectiveDate: '01/01/2019',
    status: 'active',
    officialSource: 'IFRS Foundation / IFRIC',
    officialLink: 'https://www.ifrs.org/issued-standards/list-of-standards/ifric-23-uncertainty-over-income-tax-treatments/',
    objectiveAr: 'توضيح كيفية تطبيق متطلبات الاعتراف والقياس الواردة في معيار IAS 12 عند وجود عدم يقين بشأن قبول مصلحة الضرائب للمعالجات الضريبية المطبقة.',
    objectiveEn: 'Clarify how to apply the recognition and measurement requirements in IAS 12 when there is uncertainty over income tax treatments by tax authorities.',
    scopeAr: 'تحديد الدخل الخاضع للضريبة، القواعد الضريبية، الخسائر الضريبية غير المستخدمة، والائتمانات الضريبية ومعدلات الضرائب عندما يكون هناك عدم يقين.',
    scopeEn: 'Determination of taxable profit (tax loss), tax bases, unused tax losses, tax credits and tax rates where uncertainty exists.',
    recognitionAr: 'افتراض فحص كامل: يجب افتراض أن مصلحة الضرائب ستفحص المبالغ ولديها كامل المعرفة بجميع المعلومات ذات الصلة. إذا كان محتملاً قبول المعالجة (Probable) تحسب الضريبة وفق الإقرار، وإذا لم يكن محتملاً، يجب أن تعكس المنشأة أثر عدم اليقين فوراً.',
    recognitionEn: 'Detection risk is zero: Assume tax authority will examine all amounts with full knowledge. If not probable authority will accept treatment, reflect uncertainty.',
    measurementInitialAr: 'يقاس عدم اليقين بأحد أسلوبين بناءً على أيهما يقدم تنبؤاً أفضل: 1) المبلغ الأكثر ترجيحاً (Most Likely Amount)، أو 2) القيمة المتوقعة (Expected Value - مجموع الاحتمالات المرجحة).',
    measurementInitialEn: 'Measured using either: 1) Most Likely Amount (single most likely outcome), or 2) Expected Value (probability-weighted sum of potential outcomes).',
    measurementSubsequentAr: 'إعادة تقييم التقديرات والأحكام عند حدوث تغيير في الحقائق والظروف (مثل انتهاء فحص ضريبي، تغيير تشريع، أو صدور حكم قضائي).',
    measurementSubsequentEn: 'Remeasure judgments and estimates whenever facts and circumstances change (e.g. tax audit closure or court precedents).',
    erpImplementationAr: 'إثبات مخصصات الضرائب غير المؤكدة في حسابات التزامات ضريبية محددة وربطها بملفات الفحص الضريبي.',
    erpImplementationEn: 'Uncertain tax position liability subledger, audit reserve provisioning, and integration with tax filing status.',
    erpModules: ['chart_of_accounts', 'journal_entries', 'reports'],
    numericalExample: {
      titleAr: 'تقدير التزام ضريبي غير مؤكد لخصم نفقات تطوير برمجيات',
      titleEn: 'Uncertain Tax Treatment Provisioning (Most Likely Amount)',
      scenarioAr: 'خصمت شركة نفقات تطوير برمجيات قدرها 1,000,000 ج.م في إقرارها الضريبي (وفر ضريبي 225,000 ج.م بمعدل 22.5%). يرى المستشار الضريبي أنه ليس من المحتمل قبول مصلحة الضرائب للخصم، والمبلغ الأكثر ترجيحاً للرفض هو كامل الوفر.',
      scenarioEn: 'Entity deducted 1M EGP software development expense in tax return (saving 225k EGP at 22.5%). Tax advisor concludes authority acceptance is not probable.',
      calculationAr: 'نظراً لأن قبول المعالجة غير محتمل، تثبت المنشأة التزاماً ضريبياً ومصروف ضريبة دخل إضافي بمبلغ 225,000 ج.م كأثر لعدم اليقين الضريبي.',
      calculationEn: 'Authority acceptance not probable -> Recognize additional tax liability and income tax expense of 225,000 EGP.'
    },
    journalEntries: [
      {
        accountAr: 'حـ/ مصروف ضرائب الدخل (أثر معالجات ضريبية غير مؤكدة - IFRIC 23)',
        accountEn: 'Income Tax Expense (Uncertain Tax Treatment - IFRIC 23)',
        debit: '225,000',
        credit: '-',
        notesAr: 'تحميل قائمة الدخل بالالتزام الضريبي المحتمل لمواجهة عدم اليقين',
        notesEn: 'Recognize uncertain tax position expense in P&L'
      },
      {
        accountAr: 'حـ/ التزامات ضرائب دخل غير مؤكدة مستحقة',
        accountEn: 'Uncertain Income Tax Liabilities Payable',
        debit: '-',
        credit: '225,000',
        notesAr: 'إثبات التزام ضريبي لمقابلة مطالبات الفحص المتوقعة',
        notesEn: 'Credit provision for uncertain tax liability'
      }
    ],
    disclosuresAr: [
      'الأحكام والافتراضات والتقديرات الهامة المستخدمة في تحديد المعالجات الضريبية غير المؤكدة.',
      'الإفصاح عن المخاطر والالتزامات المحتملة المتعلقة بالنزاعات الضريبية المفتوحة.',
      'تحديد ما إذا كانت المنشأة قد استخدمت طريقة القيمة المتوقعة أو المبلغ الأكثر ترجيحاً.'
    ],
    disclosuresEn: [
      'Judgments, assumptions, and estimates applied in assessing uncertain tax positions.',
      'Disclosures on tax examination contingencies and open disputes.',
      'Identification of measurement method used (Most Likely Amount vs Expected Value).'
    ],
    commonPitfallsAr: [
      'الاعتماد على افتراض أن مصلحة الضرائب لن تكتشف المعالجة الضريبية (Audit Lottery)، وهو ما يحظره المعيار حيث يلزم افتراض المعرفة الكاملة لمصلحة الضرائب.',
      'عدم تحديث مخصص الضرائب غير المؤكدة عند تغير سوابق لجان الطعن أو الأحكام الضريبية الصادرة في السوق.'
    ],
    commonPitfallsEn: [
      'Factoring in detection risk (assuming tax authority won\'t audit the issue) - IFRIC 23 strictly forbids this.',
      'Failing to update uncertain tax provisions when new tax rulings or court precedents emerge.'
    ]
  }
];
