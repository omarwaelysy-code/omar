import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  Search,
  FileSpreadsheet,
  Printer,
  Calculator,
  Layers,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Percent,
  Coins
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { exportToExcel } from '../utils/excelUtils';
import { printElement } from '../utils/pdfUtils';

export interface EtaTaxTypeItem {
  code: string;
  nameAr: string;
  nameEn: string;
  categoryAr: string;
  categoryEn: string;
  entersVatBase: 'yes' | 'no' | 'wht';
  subtypes: string[];
  exampleAr: string;
  exampleEn: string;
  descriptionAr: string;
}

export const ETA_TAX_TYPES_DATA: EtaTaxTypeItem[] = [
  {
    code: 'T1',
    nameAr: 'ضريبة القيمة المضافة',
    nameEn: 'Value Added Tax (VAT)',
    categoryAr: 'ضريبة أساسية عامة',
    categoryEn: 'Standard Tax',
    entersVatBase: 'yes',
    subtypes: ['V001 (14%)', 'V009 (معفى 0%)', 'V010 (سعر صفر 0%)'],
    exampleAr: 'توريد بضاعة صافي 10,000 ج خاضعة للسعر العام 14% ← ضريبة القيمة المضافة = 1,400 ج.',
    exampleEn: 'Goods with net 10,000 EGP at 14% VAT ← VAT Amount = 1,400 EGP.',
    descriptionAr: 'الضريبة العامة المطبقة على كافة السلع والخدمات وتُحسب على الوعاء المجمع الشامل للصافي والرسوم الخاضعة وضريبة الجدول.'
  },
  {
    code: 'T2',
    nameAr: 'ضريبة الجدول (نسبية)',
    nameEn: 'Table Tax (Percentage)',
    categoryAr: 'ضريبة جدول',
    categoryEn: 'Schedule Tax',
    entersVatBase: 'yes',
    subtypes: ['Ttax01 (8% مياه غازية)', 'Ttax02 (تكييفات)', 'Ttax03 (سيارات)'],
    exampleAr: 'مياه غازية صافي 1,000 ج خاضعة لجدول 8% (80 ج) ← تدخل في الوعاء ليصبح 1,080 ج ويُحسب عليه 14% VAT (151.2 ج).',
    exampleEn: 'Soft drinks net 1,000 EGP with 8% table tax (80 EGP) ← Enters VAT base (1,080 EGP) for 14% VAT (151.2 EGP).',
    descriptionAr: 'ضريبة خاصة بنسبة مئوية على سلع محددة بالقانون رقم 67 لسنة 2016 وتضاف إلى الوعاء الخاضع لضريبة القيمة المضافة T1.'
  },
  {
    code: 'T3',
    nameAr: 'ضريبة الجدول (قطعية / نوعية)',
    nameEn: 'Table Tax (Fixed Amount)',
    categoryAr: 'ضريبة جدول',
    categoryEn: 'Schedule Tax',
    entersVatBase: 'yes',
    subtypes: ['Ttax01 (سجائر/وحدة)', 'Ttax02 (محروقات)'],
    exampleAr: 'علبة سجائر أو منتج خاضع لمبلغ قطعي 4.50 ج لكل علبة ← تضاف القيمة القطعية للوعاء وتخضع لضريبة الـ 14%.',
    exampleEn: 'Fixed schedule tax 4.50 EGP per pack ← Added to base and subjected to 14% VAT.',
    descriptionAr: 'ضريبة جدول محددة بمبلغ مالي مقطوع لكل وحدة قياس (كجم، علبة، لتر) وتدخل إلزامياً في وعاء ضريبة القيمة المضافة.'
  },
  {
    code: 'T4',
    nameAr: 'الخصم والتحصيل تحت حساب الضريبة',
    nameEn: 'Withholding Tax (WHT)',
    categoryAr: 'استقطاع من المنبع',
    categoryEn: 'Withholding Tax',
    entersVatBase: 'wht',
    subtypes: ['W001 (1% توريدات)', 'W002 (3% خدمات)', 'W003 (5% استشارات ومهن حرة)'],
    exampleAr: 'فاتورة توريدات بقيمة 50,000 ج ← خصم أرباح تجارية 1% (500 ج) يُستقطع من مستحقات المورد ويورد لمصلحة الضرائب.',
    exampleEn: 'Supply invoice of 50,000 EGP ← 1% WHT (500 EGP) withheld from supplier and paid to tax authority.',
    descriptionAr: 'مبالغ تُخصم من مستحقات المورد لحساب ضرائب الدخل وتُقلل المبلغ النهائي المسدد ولا تدخل في وعاء الـ 14%.'
  },
  {
    code: 'T5',
    nameAr: 'رسم دمغة (نسبي - يدخل في الوعاء)',
    nameEn: 'Stamping Tax (Percentage - Taxable)',
    categoryAr: 'رسوم تدخل في الوعاء',
    categoryEn: 'Taxable Fees',
    entersVatBase: 'yes',
    subtypes: ['ST001 (دمغة نسبية 0.6%)', 'ST002 (دمغة إعلانات)'],
    exampleAr: 'عقد مقاولات أو نشر إعلان بقيمة 20,000 ج + دمغة 0.6% (120 ج) ← يدخل الـ 120 ج في وعاء الـ 14% لتصبح الضريبة على 20,120 ج.',
    exampleEn: 'Contract 20,000 EGP + 0.6% stamp (120 EGP) ← 120 EGP enters 14% base, VAT computed on 20,120 EGP.',
    descriptionAr: 'رسم دمغة نسبي منصوص قانوناً على إدراجه ضمن الوعاء الخاضع لضريبة القيمة المضافة.'
  },
  {
    code: 'T6',
    nameAr: 'رسم دمغة (قطعي - يدخل في الوعاء)',
    nameEn: 'Stamping Tax (Fixed - Taxable)',
    categoryAr: 'رسوم تدخل في الوعاء',
    categoryEn: 'Taxable Fees',
    entersVatBase: 'yes',
    subtypes: ['ST001 (دمغة إيصال 5 ج)', 'ST002 (دمغة محررات)'],
    exampleAr: 'خدمة شحن أو تحرير مستند بقيمة 500 ج + دمغة قطعية 10 ج ← يصبح وعاء ضريبة الـ 14% = 510 ج.',
    exampleEn: 'Service 500 EGP + 10 EGP fixed stamp ← VAT 14% base becomes 510 EGP.',
    descriptionAr: 'رسم دمغة بمبلغ ثابت يُضاف لقيمة الخدمة ويدخل في وعاء احتساب ضريبة القيمة المضافة.'
  },
  {
    code: 'T7',
    nameAr: 'رسم التنمية (نسبي - يدخل في الوعاء)',
    nameEn: 'Development Fee (Percentage - Taxable)',
    categoryAr: 'رسوم تدخل في الوعاء',
    categoryEn: 'Taxable Fees',
    entersVatBase: 'yes',
    subtypes: ['RD001 (رسم تنمية 2%)', 'RD002 (رسم تنمية 5%)'],
    exampleAr: 'تذكرة عرض ترفيهي بقيمة 200 ج + رسم تنمية 5% (10 ج) ← يدخل في وعاء الـ 14% ليصبح الوعاء 210 ج.',
    exampleEn: 'Entertainment ticket 200 EGP + 5% dev fee (10 EGP) ← Enters VAT base: 210 EGP.',
    descriptionAr: 'رسم تنمية الموارد المالية للدولة المفروض بنسبة مئوية على خدمات وأنشطة وتدخل قيمته في وعاء الـ VAT.'
  },
  {
    code: 'T8',
    nameAr: 'رسم التنمية (قطعي - يدخل في الوعاء)',
    nameEn: 'Development Fee (Fixed - Taxable)',
    categoryAr: 'رسوم تدخل في الوعاء',
    categoryEn: 'Taxable Fees',
    entersVatBase: 'yes',
    subtypes: ['RD001 (رسم تنمية ثابت 20 ج)', 'RD002 (رسم تنمية ثابت 50 ج)'],
    exampleAr: 'خدمة حكومية أو استشارية بقيمة 1,000 ج + رسم تنمية قطعي 50 ج ← وعاء ضريبة الـ 14% = 1,050 ج.',
    exampleEn: 'Service 1,000 EGP + 50 EGP fixed dev fee ← 14% base = 1,050 EGP.',
    descriptionAr: 'مبلغ مقطوع ثابت لرسوم التنمية يضاف للفاتورة ويدخل في وعاء الضريبة على القيمة المضافة.'
  },
  {
    code: 'T9',
    nameAr: 'رسم خدمة (نسبة - تدخل في الوعاء)',
    nameEn: 'Service Charge (Percentage - Taxable)',
    categoryAr: 'رسوم تدخل في الوعاء',
    categoryEn: 'Taxable Fees',
    entersVatBase: 'yes',
    subtypes: ['SC001 (12% خدمة مطاعم وفنادق)', 'SC002 (رسم خدمة مرافق)'],
    exampleAr: 'فاتورة مطعم: طعام 1,000 ج + خدمة 12% (120 ج) ← وعاء الـ 14% = 1,120 ج ← ضريبة الـ 14% = 156.80 ج.',
    exampleEn: 'Restaurant bill: Food 1,000 EGP + 12% service (120 EGP) ← 14% base = 1,120 EGP ← VAT 14% = 156.80 EGP.',
    descriptionAr: 'رسم الخدمة الشائع بنسبة 12% في المنشآت السياحية والمطاعم؛ ويدخل إلزامياً في وعاء ضريبة القيمة المضافة طبقاً للقانون.'
  },
  {
    code: 'T10',
    nameAr: 'رسم خدمة (قطعي - يدخل في الوعاء)',
    nameEn: 'Service Charge (Fixed - Taxable)',
    categoryAr: 'رسوم تدخل في الوعاء',
    categoryEn: 'Taxable Fees',
    entersVatBase: 'yes',
    subtypes: ['SC001 (خدمة توصيل مقننة ثابتة)', 'SC002 (مصاريف معاينة ثابتة)'],
    exampleAr: 'صيانة جهاز 400 ج + رسم خدمة ثابت 25 ج ← وعاء احتساب ضريبة الـ 14% = 425 ج.',
    exampleEn: 'Maintenance 400 EGP + 25 EGP fixed service charge ← 14% base = 425 EGP.',
    descriptionAr: 'مقابل خدمة بمبلغ مقطوع يدخل ضمن وعاء ضريبة القيمة المضافة.'
  },
  {
    code: 'T11',
    nameAr: 'رسوم إدارية (نسبية - تدخل في الوعاء)',
    nameEn: 'Administrative Fees (Percentage - Taxable)',
    categoryAr: 'رسوم تدخل في الوعاء',
    categoryEn: 'Taxable Fees',
    entersVatBase: 'yes',
    subtypes: ['AF001 (1.5% مصاريف إدارية)', 'AF002 (إشراف هندسي)'],
    exampleAr: 'أعمال مدنية 100,000 ج + رسوم إدارية 2% (2,000 ج) ← وعاء ضريبة الـ 14% = 102,000 ج.',
    exampleEn: 'Works 100,000 EGP + 2% admin fee (2,000 EGP) ← 14% base = 102,000 EGP.',
    descriptionAr: 'مصروفات ونفقات إدارية بنسبة مئوية تضاف للوعاء قبل احتساب ضريبة القيمة المضافة.'
  },
  {
    code: 'T12',
    nameAr: 'رسوم إدارية (قطعية - تدخل في الوعاء)',
    nameEn: 'Administrative Fees (Fixed - Taxable)',
    categoryAr: 'رسوم تدخل في الوعاء',
    categoryEn: 'Taxable Fees',
    entersVatBase: 'yes',
    subtypes: ['AF001 (رسم فتح ملف 100 ج)', 'AF002 (استمارة طلب)'],
    exampleAr: 'طلب اشتراك 500 ج + رسم إداري قطعي 50 ج ← وعاء ضريبة الـ 14% = 550 ج.',
    exampleEn: 'Application 500 EGP + 50 EGP fixed admin fee ← 14% base = 550 EGP.',
    descriptionAr: 'مبالغ قطعية للمصروفات الإدارية الملحقة بالفاتورة وتخضع للـ 14% ضريبة القيمة المضافة.'
  },
  {
    code: 'T13',
    nameAr: 'رسم دمغة (نسبي - لا يدخل في الوعاء)',
    nameEn: 'Stamping Tax (Percentage - Non-Taxable)',
    categoryAr: 'رسوم لا تدخل في الوعاء',
    categoryEn: 'Non-Taxable Fees',
    entersVatBase: 'no',
    subtypes: ['NST001 (دمغة توريد غير خاضعة)', 'NST002 (دمغة نوعية بنص خاص)'],
    exampleAr: 'توريد صافي 10,000 ج + دمغة معفاة من الوعاء 0.5% (50 ج) ← ضريبة الـ 14% تُحسب على 10,000 ج فقط (1,400 ج) وتضاف الـ 50 ج للقيمة النهائية.',
    exampleEn: 'Supply 10,000 EGP + 0.5% non-taxable stamp (50 EGP) ← 14% VAT computed on 10,000 EGP only (1,400 EGP), 50 EGP added to grand total.',
    descriptionAr: 'رسم دمغة نسبي منصوص قانوناً على عدم خضوعه لضريبة القيمة المضافة فيضاف بعد حساب الـ 14%.'
  },
  {
    code: 'T14',
    nameAr: 'رسم دمغة (قطعي - لا يدخل في الوعاء)',
    nameEn: 'Stamping Tax (Fixed - Non-Taxable)',
    categoryAr: 'رسوم لا تدخل في الوعاء',
    categoryEn: 'Non-Taxable Fees',
    entersVatBase: 'no',
    subtypes: ['NST001 (دمغة نقابة مهندسين/أطباء 20 ج)', 'NST002 (دمغة محاماة)'],
    exampleAr: 'استشارة هندسية 5,000 ج + دمغة نقابة قطعية 30 ج ← الـ 14% تُحسب على 5,000 ج (700 ج) وتضاف الـ 30 ج للقيمة النهائية.',
    exampleEn: 'Engineering 5,000 EGP + 30 EGP syndicate stamp ← 14% VAT on 5,000 EGP (700 EGP), 30 EGP added to total.',
    descriptionAr: 'دمغات نقابية ومحررات قطعية لا تخضع لضريبة القيمة المضافة قانوناً.'
  },
  {
    code: 'T15',
    nameAr: 'رسم التنمية (نسبي - لا يدخل في الوعاء)',
    nameEn: 'Development Fee (Percentage - Non-Taxable)',
    categoryAr: 'رسوم لا تدخل في الوعاء',
    categoryEn: 'Non-Taxable Fees',
    entersVatBase: 'no',
    subtypes: ['NRD001 (رسم تنمية غير خاضع 1%)', 'NRD002 (رسم تنمية تراخيص)'],
    exampleAr: 'مشتريات خاضعة لرسم تنمية بنص صريح لا يخضع للـ VAT ← يُحسب الرسم بنسبته ويُضاف مباشرة للإجمالي النهائي دون دخول في وعاء الـ 14%.',
    exampleEn: 'Purchase with development fee legally exempt from VAT base ← Added directly to final total.',
    descriptionAr: 'رسم تنمية نسبي مستثنى بنص تشريعي صريح من وعاء الضريبة على القيمة المضافة.'
  },
  {
    code: 'T16',
    nameAr: 'رسم التنمية (قطعي - لا يدخل في الوعاء)',
    nameEn: 'Development Fee (Fixed - Non-Taxable)',
    categoryAr: 'رسوم لا تدخل في الوعاء',
    categoryEn: 'Non-Taxable Fees',
    entersVatBase: 'no',
    subtypes: ['NRD001 (رسم تنمية قطعي أجهزة محمول)', 'NRD002 (رسم تنمية سيارات)'],
    exampleAr: 'شراء سيارة أو معدة + رسم تنمية قطعي 3,000 ج لا يخضع للـ VAT ← يُضاف مباشرة إلى القيمة النهائية دون زيادة وعاء الـ 14%.',
    exampleEn: 'Vehicle purchase + 3,000 EGP fixed dev fee ← Added directly to grand total without inflating 14% base.',
    descriptionAr: 'رسم تنمية قطعي منصوص على عدم دخوله في وعاء الـ VAT.'
  },
  {
    code: 'T17',
    nameAr: 'رسم خدمة (نسبة - لا تدخل في الوعاء)',
    nameEn: 'Service Charge (Percentage - Non-Taxable)',
    categoryAr: 'رسوم لا تدخل في الوعاء',
    categoryEn: 'Non-Taxable Fees',
    entersVatBase: 'no',
    subtypes: ['NSC001 (خدمة لوجستية بنص معفى)', 'NSC002 (خدمة شحن خارجي)'],
    exampleAr: 'خدمة نولون شحن دولي أو معفى بنسبة 3% ← لا تُضاف لوعاء الـ 14% وتُدرج في الفاتورة كبند رسوم غير خاضعة.',
    exampleEn: 'Exempt freight charge 3% ← Not added to 14% base, listed as non-taxable fee.',
    descriptionAr: 'مقابل خدمات بنسبة مئوية غير خاضعة لضريبة القيمة المضافة.'
  },
  {
    code: 'T18',
    nameAr: 'رسم خدمة (قطعي - لا يدخل في الوعاء)',
    nameEn: 'Service Charge (Fixed - Non-Taxable)',
    categoryAr: 'رسوم لا تدخل في الوعاء',
    categoryEn: 'Non-Taxable Fees',
    entersVatBase: 'no',
    subtypes: ['NSC001 (رسم خدمة قطعي معفى)', 'NSC002 (رسوم موازين وموانئ)'],
    exampleAr: 'رسوم موازين أو موانئ قطعية 150 ج على شحنة ← لا تدخل في وعاء الـ 14% بل تضاف مباشرة لإجمالي الفاتورة.',
    exampleEn: 'Fixed port/scale fee 150 EGP ← Bypasses 14% base and joins grand total directly.',
    descriptionAr: 'رسوم خدمات بمبالغ قطعية لا تخضع لضريبة القيمة المضافة.'
  },
  {
    code: 'T19',
    nameAr: 'رسوم أخرى (نسبية - لا تدخل في الوعاء)',
    nameEn: 'Other Non-Taxable Fees (Percentage)',
    categoryAr: 'رسوم لا تدخل في الوعاء',
    categoryEn: 'Non-Taxable Fees',
    entersVatBase: 'no',
    subtypes: ['OF001 (0.25% التأمين الصحي الشامل - مساهمة تكافلية)', 'OF002 (صندوق رعاية الشهداء)'],
    exampleAr: 'فاتورة إيرادات إجمالية 100,000 ج خاضعة لـ 0.25% مساهمة تكافلية (250 ج) ← لا تدخل إطلاقاً في وعاء ضريبة الـ 14%.',
    exampleEn: 'Invoice 100,000 EGP with 0.25% universal health insurance fee (250 EGP) ← Strictly excluded from 14% VAT base.',
    descriptionAr: 'الرسوم والمساهمات النسبية المقررة بقوانين خاصة كالمساهمة التكافلية للتأمين الصحي الشامل 0.25% ولا تخضع للـ VAT.'
  },
  {
    code: 'T20',
    nameAr: 'رسوم أخرى (قطعية - لا تدخل في الوعاء)',
    nameEn: 'Other Non-Taxable Fees (Fixed)',
    categoryAr: 'رسوم لا تدخل في الوعاء',
    categoryEn: 'Non-Taxable Fees',
    entersVatBase: 'no',
    subtypes: ['OF001 (رسوم تصديق غرف تجارية)', 'OF002 (رسوم توثيق وفحص)'],
    exampleAr: 'رسوم تصديق غرفة تجارية أو معاينة قطعية 100 ج ← تضاف كبند رسم لا يدخل في الوعاء إلى القيمة النهائية للفاتورة.',
    exampleEn: 'Chamber of commerce certification fee 100 EGP ← Added as non-taxable fee to final invoice value.',
    descriptionAr: 'رسوم نوعية ومقطوعة منصوص قانوناً على تحصيلها دون إخضاعها لضريبة القيمة المضافة.'
  }
];

export function EtaTaxTypesGuide() {
  const { language, dir } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'taxable' | 'non_taxable' | 'table_vat_wht'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const filteredData = useMemo(() => {
    return ETA_TAX_TYPES_DATA.filter((item) => {
      // Filter by category tab
      if (selectedFilter === 'taxable' && item.entersVatBase !== 'yes') return false;
      if (selectedFilter === 'taxable' && (item.code === 'T1' || item.code === 'T2' || item.code === 'T3')) return false;
      if (selectedFilter === 'non_taxable' && item.entersVatBase !== 'no') return false;
      if (selectedFilter === 'table_vat_wht' && !['T1', 'T2', 'T3', 'T4'].includes(item.code)) return false;

      // Filter by search query
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        item.code.toLowerCase().includes(q) ||
        item.nameAr.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q) ||
        item.categoryAr.toLowerCase().includes(q) ||
        item.exampleAr.toLowerCase().includes(q) ||
        item.descriptionAr.toLowerCase().includes(q) ||
        item.subtypes.some(s => s.toLowerCase().includes(q))
      );
    });
  }, [selectedFilter, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: ETA_TAX_TYPES_DATA.length,
      taxableFees: ETA_TAX_TYPES_DATA.filter(t => ['T5','T6','T7','T8','T9','T10','T11','T12'].includes(t.code)).length,
      nonTaxableFees: ETA_TAX_TYPES_DATA.filter(t => ['T13','T14','T15','T16','T17','T18','T19','T20'].includes(t.code)).length,
      coreTaxes: ETA_TAX_TYPES_DATA.filter(t => ['T1','T2','T3','T4'].includes(t.code)).length
    };
  }, []);

  const handleExportExcel = () => {
    const dataToExport = filteredData.map(item => ({
      'كود الضريبة': item.code,
      'المسمى العربي': item.nameAr,
      'المسمى الإنجليزي': item.nameEn,
      'التصنيف': item.categoryAr,
      'الأثر في وعاء الـ 14%': item.entersVatBase === 'yes' ? 'يدخل في الوعاء (Taxable)' : (item.entersVatBase === 'wht' ? 'خصم من المنبع (WHT)' : 'لا يدخل في الوعاء (Non-Taxable)'),
      'الأنواع الفرعية': item.subtypes.join(' | '),
      'مثال توضيحي عملي بالأرقام': item.exampleAr,
      'الوصف والملاحظات القانونية': item.descriptionAr
    }));
    exportToExcel(dataToExport, `ETA_Tax_Types_Guide_${new Date().toISOString().slice(0, 10)}`);
  };

  const handlePrint = () => {
    printElement(document.getElementById('eta-tax-guide-table-container'), language === 'ar' ? 'دليل أنواع الضرائب والرسوم (ETA)' : 'ETA Tax Types Guide');
  };

  return (
    <div className="px-1 sm:px-3 py-1 space-y-2.5 max-w-full overflow-hidden" dir={dir}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-3.5 shadow-md border border-indigo-800/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
            <Calculator className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span>{language === 'ar' ? 'دليل أنواع الضرائب والرسوم (ETA Tax Types)' : 'ETA Tax Types & Codes Guide'}</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono font-bold">
                T1 - T20 معتمد
              </span>
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              {language === 'ar'
                ? 'المرجع الرسمي الشامل لأكواد وتصنيفات الضرائب والرسوم في منظومة الفاتورة الإلكترونية مع الأمثلة العملية وأثرها على الوعاء الضريبي.'
                : 'Official Egyptian Tax Authority reference for tax types T1–T20 with practical examples and 14% VAT base impact.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Quick Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-slate-500 text-[11px] block">{language === 'ar' ? 'إجمالي الأكواد' : 'Total Types'}</span>
            <span className="text-lg font-bold text-slate-900 font-mono">{stats.total}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-slate-500 text-[11px] block">{language === 'ar' ? 'رسوم تدخل في الوعاء (T5–T12)' : 'Taxable Fees (T5–T12)'}</span>
            <span className="text-lg font-bold text-emerald-700 font-mono">{stats.taxableFees}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-slate-500 text-[11px] block">{language === 'ar' ? 'رسوم لا تدخل في الوعاء (T13–T20)' : 'Non-Taxable Fees (T13–T20)'}</span>
            <span className="text-lg font-bold text-slate-700 font-mono">{stats.nonTaxableFees}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <XCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-slate-500 text-[11px] block">{language === 'ar' ? 'الأساسية والجدول والخصم (T1–T4)' : 'VAT, Table & WHT (T1–T4)'}</span>
            <span className="text-lg font-bold text-amber-700 font-mono">{stats.coreTaxes}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <Percent className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Official ETA Mathematical Rule Notice */}
      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-2.5 text-xs text-indigo-950 flex items-start gap-2.5 shadow-xs">
        <Calculator className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <span className="font-bold text-indigo-900 block mb-0.5">
            {language === 'ar' ? 'معادلة احتساب الوعاء والقيمة النهائية حسب مصلحة الضرائب المصرية (ETA Core Validator):' : 'Official ETA Mathematical Formula:'}
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-slate-800">
            <span>
              <strong className="text-emerald-700">وعاء ضريبة الـ 14% (T1)</strong> = الصافي + ضرائب الجدول (T2 + T3) + رسوم تدخل في الوعاء (T5 إلى T12)
            </span>
            <span className="text-slate-400">|</span>
            <span>
              <strong className="text-indigo-700">القيمة النهائية للفاتورة</strong> = الصافي + جدول (T2,T3) + رسوم الوعاء (T5..T12) + 14% VAT (T1) + رسوم خارج الوعاء (T13..T20) - الخصم والتحصيل (T4)
            </span>
          </div>
        </div>
      </div>

      {/* Search and Tabs Filter Bar */}
      <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={language === 'ar' ? 'بحث بالكود أو الاسم أو التصنيف أو المثال...' : 'Search by code, name, category or example...'}
            className="w-full ps-8 pe-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-hidden transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-0.5 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'ar' ? `الكل (${stats.total})` : `All (${stats.total})`}
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('table_vat_wht')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              selectedFilter === 'table_vat_wht'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'ar' ? 'الأساسية والجدول (T1-T4)' : 'Core Taxes (T1-T4)'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('taxable')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              selectedFilter === 'taxable'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'ar' ? 'تدخل في الوعاء (T5-T12)' : 'Taxable Fees (T5-T12)'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('non_taxable')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              selectedFilter === 'non_taxable'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'ar' ? 'لا تدخل في الوعاء (T13-T20)' : 'Non-Taxable Fees (T13-T20)'}
          </button>
        </div>
      </div>

      {/* Main Dense Table */}
      <div id="eta-tax-guide-table-container" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/90 bg-slate-50/80 text-slate-700 font-bold">
                <th className="py-2.5 px-3 text-center w-16 whitespace-nowrap">
                  {language === 'ar' ? 'الكود' : 'Code'}
                </th>
                <th className="py-2.5 px-3 text-start min-w-[170px] whitespace-nowrap">
                  {language === 'ar' ? 'المسمى الضريبي (عربي / English)' : 'Tax Name'}
                </th>
                <th className="py-2.5 px-3 text-center w-36 whitespace-nowrap">
                  {language === 'ar' ? 'التصنيف الرسمي' : 'Category'}
                </th>
                <th className="py-2.5 px-3 text-center w-40 whitespace-nowrap">
                  {language === 'ar' ? 'الأثر في وعاء 14% VAT' : '14% VAT Base Impact'}
                </th>
                <th className="py-2.5 px-3 text-start min-w-[180px] whitespace-nowrap">
                  {language === 'ar' ? 'الأنواع الفرعية الشائعة (Subtypes)' : 'Common Subtypes'}
                </th>
                <th className="py-2.5 px-3 text-start min-w-[320px]">
                  {language === 'ar' ? 'مثال توضيحي عملي بالأرقام' : 'Practical Example with Numbers'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {language === 'ar' ? 'لا توجد أنواع مطابقة لبحثك.' : 'No matching tax types found.'}
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => {
                  const isCore = ['T1', 'T2', 'T3', 'T4'].includes(item.code);
                  const isTaxableFee = ['T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'].includes(item.code);

                  return (
                    <tr
                      key={item.code}
                      className={`hover:bg-slate-50/90 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      }`}
                    >
                      {/* Code Badge */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md border ${
                              item.code === 'T1'
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                : isCore
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : isTaxableFee
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {item.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.code)}
                            className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                            title="Copy Code"
                          >
                            {copiedCode === item.code ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Name Arabic & English */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 text-xs">{item.nameAr}</div>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5">{item.nameEn}</div>
                      </td>

                      {/* Official Category */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          {language === 'ar' ? item.categoryAr : item.categoryEn}
                        </span>
                      </td>

                      {/* Impact on VAT Base */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {item.entersVatBase === 'yes' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>{language === 'ar' ? 'يدخل في الوعاء' : 'Enters VAT Base'}</span>
                          </span>
                        ) : item.entersVatBase === 'wht' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                            <Coins className="w-3 h-3 shrink-0" />
                            <span>{language === 'ar' ? 'خصم تحت الحساب' : 'Withholding WHT'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
                            <XCircle className="w-3 h-3 shrink-0 text-slate-400" />
                            <span>{language === 'ar' ? 'لا يدخل في الوعاء' : 'Excluded from Base'}</span>
                          </span>
                        )}
                      </td>

                      {/* Subtypes */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {item.subtypes.map((sub, sIdx) => (
                            <span
                              key={sIdx}
                              className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Example Column (الأمثلة التوضيحية بالأرقام) */}
                      <td className="py-2.5 px-3">
                        <div className="bg-amber-50/60 rounded-lg p-1.5 border border-amber-200/60 text-[11px] text-slate-800 leading-relaxed">
                          <div className="font-semibold text-amber-950 flex items-center gap-1 mb-0.5">
                            <HelpCircle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{language === 'ar' ? item.exampleAr : item.exampleEn}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{item.descriptionAr}</div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
