import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  ArrowRight,
  Filter,
  DollarSign,
  Briefcase,
  Building2,
  FileText,
  Clock,
  ShieldCheck,
  Zap,
  X,
  HelpCircle,
  TrendingUp,
  Landmark,
  Scale
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { exportToExcel } from '../utils/excelUtils';
import { printElement } from '../utils/pdfUtils';
import {
  IFRS_STANDARDS_DATA,
  IFRS_CATEGORIES,
  IfrsStandardItem,
  IfrsJournalEntryLine
} from '../data/ifrsStandardsData';

export default function IfrsGuide() {
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFamily, setSelectedFamily] = useState<'all' | 'IFRS' | 'IAS' | 'ISSB' | 'IFRIC'>('all');
  const [only2026Highlights, setOnly2026Highlights] = useState(false);
  const [selectedStandard, setSelectedStandard] = useState<IfrsStandardItem | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'measurement' | 'erp' | 'example' | 'disclosures'>('overview');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Filtered Standards
  const filteredStandards = useMemo(() => {
    return IFRS_STANDARDS_DATA.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Family filter
      if (selectedFamily !== 'all' && item.family !== selectedFamily) {
        return false;
      }
      // 2026 highlight filter
      if (only2026Highlights && !item.is2026Highlight && item.status !== 'new_2026') {
        return false;
      }
      // Search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesCode = item.code.toLowerCase().includes(query);
        const matchesTitleAr = item.titleAr.toLowerCase().includes(query);
        const matchesTitleEn = item.titleEn.toLowerCase().includes(query);
        const matchesObjAr = item.objectiveAr.toLowerCase().includes(query);
        const matchesObjEn = item.objectiveEn.toLowerCase().includes(query);
        const matchesExample = item.numericalExample.scenarioAr.toLowerCase().includes(query) ||
                               item.numericalExample.scenarioEn.toLowerCase().includes(query);
        const matchesAccounts = item.journalEntries.some(
          (j) => j.accountAr.toLowerCase().includes(query) || j.accountEn.toLowerCase().includes(query)
        );
        return matchesCode || matchesTitleAr || matchesTitleEn || matchesObjAr || matchesObjEn || matchesExample || matchesAccounts;
      }
      return true;
    });
  }, [searchTerm, selectedCategory, selectedFamily, only2026Highlights]);

  // Statistics
  const stats = useMemo(() => {
    const total = IFRS_STANDARDS_DATA.length;
    const ifrsCount = IFRS_STANDARDS_DATA.filter(s => s.family === 'IFRS').length;
    const iasCount = IFRS_STANDARDS_DATA.filter(s => s.family === 'IAS').length;
    const issbCount = IFRS_STANDARDS_DATA.filter(s => s.family === 'ISSB').length;
    const highlightsCount = IFRS_STANDARDS_DATA.filter(s => s.is2026Highlight || s.status === 'new_2026').length;
    return { total, ifrsCount, iasCount, issbCount, highlightsCount };
  }, []);

  // Copy Journal Entries
  const handleCopyJournal = (entries: IfrsJournalEntryLine[], idx: number) => {
    const text = entries
      .map((entry) => {
        const debitStr = entry.debit && entry.debit !== '-' ? `من حـ/ ${entry.accountAr} (${entry.accountEn}) | مدين: ${entry.debit}` : '';
        const creditStr = entry.credit && entry.credit !== '-' ? `إلى حـ/ ${entry.accountAr} (${entry.accountEn}) | دائن: ${entry.credit}` : '';
        return (debitStr || creditStr) + ` [ملاحظة: ${entry.notesAr}]`;
      })
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const rows = filteredStandards.map((item) => ({
      'كود المعيار (Code)': item.code,
      'العائلة (Family)': item.family,
      'عنوان المعيار (عربي)': item.titleAr,
      'Standard Title (English)': item.titleEn,
      'التصنيف (Category)': item.category,
      'تاريخ السريان (Effective)': item.effectiveDate,
      'الحالة (Status)': item.status,
      'الهدف (Objective Ar)': item.objectiveAr,
      'القياس الأولي (Initial Measurement)': item.measurementInitialAr,
      'القياس اللاحق (Subsequent Measurement)': item.measurementSubsequentAr,
      'التطبيق في ERP (ERP Implementation)': item.erpImplementationAr,
      'مثال رقمي (Scenario)': item.numericalExample.scenarioAr,
      'حسبة المثال (Calculation)': item.numericalExample.calculationAr,
      'المصدر الرسمي (Source)': item.officialSource
    }));

    exportToExcel(rows, `IFRS_Complete_Practical_Guide_2026_${new Date().toISOString().slice(0, 10)}`);
  };

  // Print PDF
  const handlePrint = () => {
    const el = document.getElementById('ifrs-guide-printable-content');
    printElement(el, language === 'ar' ? 'دليل معايير IFRS الشامل — 2026' : 'IFRS Complete Practical Guide — 2026');
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-800/40">
        <div className="absolute top-0 end-0 -mt-10 -me-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 start-1/3 -mb-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>{language === 'ar' ? 'الإصدار المعتمد والشامل — 2026' : 'Authoritative & Comprehensive Edition — 2026'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>IFRS Foundation & IASB Official</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400 shrink-0" />
              <span>
                {language === 'ar'
                  ? 'دليل معايير التقرير المالي الدولية الشامل — IFRS 2026'
                  : 'IFRS Complete Practical Guide — 2026'}
              </span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-3xl">
              {language === 'ar'
                ? 'مرجع IFRS ثنائي اللغة (عربي / إنجليزي) قائم بالكامل على المصادر الرسمية الموثقة لمؤسسة IFRS ومجلس IASB ومجلس ISSB. يشمل معايير IFRS 18 الجديدة وقوائم الدخل المعاد هيكلتها، IFRS 19 للشركات التابعة، معايير الاستدامة IFRS S1/S2، مع شرح كل معيار، شروط الاعتراف، القياس الأولي واللاحق، التطبيق في نظام الـ ERP، حالات عملية رقمية، قيود يومية جاهزة للنسخ، الإفصاحات الإلزامية، وأبرز المحاذير المهنية.'
                : 'Bilingual authoritative reference (Arabic / English) grounded directly in official IFRS Foundation, IASB, and ISSB documentation. Covers newly issued IFRS 18, IFRS 19, sustainability IFRS S1/S2, with recognition criteria, initial & subsequent measurement, ERP workflows, numerical scenarios, copyable journal entries, disclosure checklists, and common pitfalls.'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto shrink-0">
            <button
              onClick={handleExportExcel}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg shadow-emerald-950/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{language === 'ar' ? 'تصدير إكسيل' : 'Excel Export'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-lg transition-all hover:scale-[1.02] active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'ar' ? 'طباعة / PDF' : 'Print / PDF'}</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-3 pt-6 mt-6 border-t border-indigo-800/40">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-300 font-medium">{language === 'ar' ? 'إجمالي المعايير' : 'Total Standards'}</div>
            <div className="text-xl font-black text-white mt-1 flex items-center gap-2">
              <span>{stats.total}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-200">100% مغطى</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-300 font-medium">{language === 'ar' ? 'معايير IFRS السارية' : 'IFRS Standards'}</div>
            <div className="text-xl font-black text-amber-300 mt-1">{stats.ifrsCount}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-300 font-medium">{language === 'ar' ? 'معايير المحاسبة IAS' : 'IAS Standards'}</div>
            <div className="text-xl font-black text-emerald-300 mt-1">{stats.iasCount}</div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
            <div className="text-[11px] text-slate-300 font-medium">{language === 'ar' ? 'معايير الاستدامة ISSB' : 'ISSB Standards'}</div>
            <div className="text-xl font-black text-teal-300 mt-1">{stats.issbCount} (S1 / S2)</div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-2xl p-3 border border-purple-400/30">
            <div className="text-[11px] text-purple-200 font-medium">{language === 'ar' ? 'تحديثات 2026/2027' : '2026/2027 Updates'}</div>
            <div className="text-xl font-black text-pink-300 mt-1 flex items-center gap-1.5">
              <span>{stats.highlightsCount}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/30 text-pink-200">IFRS 18 / 19</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls & Search Filter Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                language === 'ar'
                  ? 'ابحث برقم المعيار، الاسم، الكلمات الدلالية، أو اسم الحساب في قيود اليومية (مثال: IFRS 18, مخزون, عقود إيجار, قياس...)'
                  : 'Search standard code, title, keywords, or journal account (e.g., IFRS 18, Leases, Revenue, Impairment, Fair Value...)'
              }
              className="w-full ps-11 pe-10 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-sm text-slate-800 transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Family & Highlight Filters */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Family Buttons */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
              {(['all', 'IFRS', 'IAS', 'ISSB', 'IFRIC'] as const).map((fam) => (
                <button
                  key={fam}
                  onClick={() => setSelectedFamily(fam)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedFamily === fam
                      ? 'bg-white text-blue-700 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {fam === 'all' ? (language === 'ar' ? 'الكل' : 'All') : fam}
                </button>
              ))}
            </div>

            {/* 2026 Highlight toggle */}
            <button
              onClick={() => setOnly2026Highlights(!only2026Highlights)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                only2026Highlights
                  ? 'bg-purple-50 text-purple-700 border-purple-300 ring-2 ring-purple-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>{language === 'ar' ? 'معايير 2026 الجديدة فقط' : '2026 Highlights Only'}</span>
            </button>

            {/* View Mode */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg transition-all font-semibold ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {language === 'ar' ? 'بطاقات' : 'Cards'}
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg transition-all font-semibold ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {language === 'ar' ? 'جدول مقارن' : 'Table'}
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
          {IFRS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-semibold transition-all shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
              }`}
            >
              {language === 'ar' ? cat.nameAr : cat.nameEn}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div id="ifrs-guide-printable-content">
        {filteredStandards.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              {language === 'ar' ? 'لم يتم العثور على معايير مطابقة' : 'No matching standards found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {language === 'ar'
                ? 'جرب البحث بكلمات مختلفة أو إزالة الفلاتر المحددة للوصول إلى كافة المعايير'
                : 'Try adjusting your search terms or clearing selected category filters'}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setSelectedFamily('all');
                setOnly2026Highlights(false);
              }}
              className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              {language === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredStandards.map((standard) => {
              const is2026 = standard.is2026Highlight || standard.status === 'new_2026';
              return (
                <div
                  key={standard.code}
                  className={`group relative bg-white rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 ${
                    is2026
                      ? 'border-purple-300 ring-1 ring-purple-400/30 hover:border-purple-500'
                      : 'border-slate-200/90 hover:border-blue-400'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs px-2.5 py-1 rounded-xl font-black ${
                            standard.family === 'IFRS'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : standard.family === 'IAS'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : standard.family === 'ISSB'
                              ? 'bg-teal-50 text-teal-700 border border-teal-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {standard.code}
                        </span>

                        {is2026 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 text-[10px] font-bold animate-pulse">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>{language === 'ar' ? 'تحديث 2026/2027' : '2026/2027 Milestone'}</span>
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                        {standard.family}
                      </span>
                    </div>

                    {/* Titles */}
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                        {language === 'ar' ? standard.titleAr : standard.titleEn}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5 line-clamp-1">
                        {language === 'ar' ? standard.titleEn : standard.titleAr}
                      </p>
                    </div>

                    {/* Objective Snippet */}
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {language === 'ar' ? standard.objectiveAr : standard.objectiveEn}
                    </p>

                    {/* ERP Implementation Highlight */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>{language === 'ar' ? 'التطبيق العملي في الـ ERP:' : 'ERP Implementation:'}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                        {language === 'ar' ? standard.erpImplementationAr : standard.erpImplementationEn}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {standard.erpModules.map((mod, mIdx) => (
                          <span
                            key={mIdx}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200"
                          >
                            {mod}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Numerical Example Teaser */}
                    <div className="bg-blue-50/50 rounded-2xl p-3 border border-blue-100 text-[11px] space-y-1">
                      <div className="font-bold text-blue-900 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                        <span>{language === 'ar' ? standard.numericalExample.titleAr : standard.numericalExample.titleEn}</span>
                      </div>
                      <p className="text-slate-600 text-[10px] line-clamp-2 leading-relaxed">
                        {language === 'ar' ? standard.numericalExample.scenarioAr : standard.numericalExample.scenarioEn}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedStandard(standard);
                        setActiveTab('overview');
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold shadow transition-all active:scale-95"
                    >
                      <span>{language === 'ar' ? 'عرض الدليل الكامل والقيود' : 'Full Guide & Journal Entries'}</span>
                      {language === 'ar' ? <ChevronRight className="w-3.5 h-3.5 rotate-180" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    <a
                      href={standard.officialLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={language === 'ar' ? 'المصدر الرسمي في مؤسسة IFRS' : 'Official IFRS Foundation Source'}
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Detailed Table View */
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 text-start">{language === 'ar' ? 'المعيار' : 'Code'}</th>
                    <th className="py-3 px-4 text-start">{language === 'ar' ? 'اسم المعيار' : 'Title'}</th>
                    <th className="py-3 px-4 text-start">{language === 'ar' ? 'الهدف الرئيسي' : 'Objective'}</th>
                    <th className="py-3 px-4 text-start">{language === 'ar' ? 'القياس الأولي واللاحق' : 'Measurement'}</th>
                    <th className="py-3 px-4 text-start">{language === 'ar' ? 'التطبيق بنظام ERP' : 'ERP Workflow'}</th>
                    <th className="py-3 px-4 text-start">{language === 'ar' ? 'سريان المعيار' : 'Effective'}</th>
                    <th className="py-3 px-4 text-center">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStandards.map((item, idx) => (
                    <tr
                      key={item.code}
                      className={`hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                    >
                      <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 text-blue-700 border border-slate-200">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-900">{language === 'ar' ? item.titleAr : item.titleEn}</div>
                        <div className="text-[10px] text-slate-400">{language === 'ar' ? item.titleEn : item.titleAr}</div>
                      </td>
                      <td className="py-3 px-4 max-w-sm text-slate-600 leading-relaxed">
                        <p className="line-clamp-2">{language === 'ar' ? item.objectiveAr : item.objectiveEn}</p>
                      </td>
                      <td className="py-3 px-4 max-w-xs text-slate-600 leading-relaxed">
                        <span className="font-bold text-slate-800">{language === 'ar' ? 'اللاحق: ' : 'Subsequent: '}</span>
                        <span className="line-clamp-2">{language === 'ar' ? item.measurementSubsequentAr : item.measurementSubsequentEn}</span>
                      </td>
                      <td className="py-3 px-4 max-w-xs text-slate-600 leading-relaxed">
                        <p className="line-clamp-2">{language === 'ar' ? item.erpImplementationAr : item.erpImplementationEn}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-500">
                        {item.effectiveDate}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedStandard(item);
                            setActiveTab('overview');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-bold text-[11px] transition-all"
                        >
                          {language === 'ar' ? 'التفاصيل والقيود' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Comprehensive Standard Detail Modal / Drawer */}
      {selectedStandard && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-5 sm:p-6 relative">
              <button
                onClick={() => setSelectedStandard(null)}
                className="absolute top-5 end-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-2 pe-10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm px-3 py-1 rounded-xl bg-blue-500/30 text-blue-200 border border-blue-400/40 font-black">
                    {selectedStandard.code}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 font-medium">
                    {selectedStandard.family}
                  </span>
                  {(selectedStandard.is2026Highlight || selectedStandard.status === 'new_2026') && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/40 text-purple-200 font-bold border border-purple-400/50 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'معيار 2026/2027 الجديد' : 'New 2026/2027 Standard'}</span>
                    </span>
                  )}
                  <span className="text-xs text-slate-300">
                    <Clock className="w-3.5 h-3.5 inline me-1" />
                    {selectedStandard.effectiveDate}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white leading-snug">
                  {language === 'ar' ? selectedStandard.titleAr : selectedStandard.titleEn}
                </h2>
                <p className="text-xs text-slate-300 font-medium">
                  {language === 'ar' ? selectedStandard.titleEn : selectedStandard.titleAr}
                </p>

                <div className="flex items-center gap-3 pt-1 text-xs text-slate-400">
                  <span>
                    <ShieldCheck className="w-3.5 h-3.5 inline me-1 text-emerald-400" />
                    {selectedStandard.officialSource}
                  </span>
                  <a
                    href={selectedStandard.officialLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-white underline inline-flex items-center gap-1"
                  >
                    <span>{language === 'ar' ? 'رابط المعيار الرسمي' : 'Official Standard URL'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex items-center gap-1 overflow-x-auto pt-6 border-t border-white/10 mt-5 no-scrollbar text-xs font-bold">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
                    activeTab === 'overview'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {language === 'ar' ? '1. النظرة العامة والنطاق' : '1. Overview & Scope'}
                </button>
                <button
                  onClick={() => setActiveTab('measurement')}
                  className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
                    activeTab === 'measurement'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {language === 'ar' ? '2. شروط الاعتراف والقياس' : '2. Recognition & Measurement'}
                </button>
                <button
                  onClick={() => setActiveTab('erp')}
                  className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
                    activeTab === 'erp'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {language === 'ar' ? '3. التطبيق في الـ ERP' : '3. ERP Workflow'}
                </button>
                <button
                  onClick={() => setActiveTab('example')}
                  className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
                    activeTab === 'example'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {language === 'ar' ? '4. مثال رقمي وقيود اليومية' : '4. Scenario & Journal Entries'}
                </button>
                <button
                  onClick={() => setActiveTab('disclosures')}
                  className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
                    activeTab === 'disclosures'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {language === 'ar' ? '5. الإفصاحات والمحاذير' : '5. Disclosures & Pitfalls'}
                </button>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-800 text-sm">
              {/* Tab 1: Overview & Scope */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Objective */}
                    <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100 space-y-2">
                      <div className="flex items-center gap-2 text-blue-900 font-bold">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        <span>{language === 'ar' ? 'الهدف من المعيار (Objective)' : 'Standard Objective'}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
                        {language === 'ar' ? selectedStandard.objectiveAr : selectedStandard.objectiveEn}
                      </p>
                    </div>

                    {/* Scope */}
                    <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold">
                        <Layers className="w-5 h-5 text-emerald-600" />
                        <span>{language === 'ar' ? 'نطاق التطبيق والاستثناءات (Scope)' : 'Scope & Inclusions'}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
                        {language === 'ar' ? selectedStandard.scopeAr : selectedStandard.scopeEn}
                      </p>
                    </div>
                  </div>

                  {/* Standard Metadata Summary */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'تاريخ السريان الإلزامي: ' : 'Mandatory Effective Date: '}</span>
                      <span className="font-bold text-slate-900">{selectedStandard.effectiveDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'التصنيف المحاسبي: ' : 'Category: '}</span>
                      <span className="font-bold text-slate-900">{selectedStandard.category}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">{language === 'ar' ? 'الجهة المصدرة: ' : 'Issuing Body: '}</span>
                      <span className="font-bold text-slate-900">{selectedStandard.officialSource}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Recognition & Measurement */}
              {activeTab === 'measurement' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Recognition Criteria */}
                  <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 space-y-2">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold">
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                      <span>{language === 'ar' ? 'شروط وأسس الاعتراف المحاسبي (Recognition Criteria)' : 'Recognition Criteria'}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
                      {language === 'ar' ? selectedStandard.recognitionAr : selectedStandard.recognitionEn}
                    </p>
                  </div>

                  {/* Initial & Subsequent Measurement */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-2 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-900 font-bold">
                        <DollarSign className="w-5 h-5 text-blue-600" />
                        <span>{language === 'ar' ? 'القياس الأولي (Initial Measurement)' : 'Initial Measurement'}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                        {language === 'ar' ? selectedStandard.measurementInitialAr : selectedStandard.measurementInitialEn}
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-2 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-900 font-bold">
                        <Scale className="w-5 h-5 text-purple-600" />
                        <span>{language === 'ar' ? 'القياس اللاحق (Subsequent Measurement)' : 'Subsequent Measurement'}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                        {language === 'ar' ? selectedStandard.measurementSubsequentAr : selectedStandard.measurementSubsequentEn}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: ERP Implementation */}
              {activeTab === 'erp' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-2xl p-5 border border-blue-150 space-y-4">
                    <div className="flex items-center gap-2 text-blue-950 font-bold text-base">
                      <Zap className="w-5 h-5 text-amber-500" />
                      <span>{language === 'ar' ? 'مسار التهيئة والتطبيق في نظام الـ ERP' : 'ERP Workflow & Setup Guide'}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
                      {language === 'ar' ? selectedStandard.erpImplementationAr : selectedStandard.erpImplementationEn}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                      <span>{language === 'ar' ? 'الشاشات والوحدات المتأثرة في نظام الـ ERP:' : 'Impacted ERP Modules & Ledgers:'}</span>
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {selectedStandard.erpModules.map((mod, mIdx) => (
                        <div
                          key={mIdx}
                          className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-center gap-2.5"
                        >
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                          <span className="font-mono text-xs text-slate-800 font-semibold">{mod}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Numerical Example & Journal Entries */}
              {activeTab === 'example' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Scenario & Calculation Box */}
                  <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-950 font-bold text-base">
                        <TrendingUp className="w-5 h-5 text-amber-600" />
                        <span>{language === 'ar' ? selectedStandard.numericalExample.titleAr : selectedStandard.numericalExample.titleEn}</span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-200/60 text-amber-900">
                        {language === 'ar' ? 'حالة عملية واقعية' : 'Realistic Case'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="font-bold text-xs text-amber-900">{language === 'ar' ? 'السيناريو المحاسبي: ' : 'Scenario: '}</span>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {language === 'ar' ? selectedStandard.numericalExample.scenarioAr : selectedStandard.numericalExample.scenarioEn}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-amber-200/60">
                      <span className="font-bold text-xs text-amber-900">{language === 'ar' ? 'الحسبة المحاسبية بالخطوات: ' : 'Step-by-step Calculation: '}</span>
                      <p className="text-xs font-mono text-slate-800 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-amber-100">
                        {language === 'ar' ? selectedStandard.numericalExample.calculationAr : selectedStandard.numericalExample.calculationEn}
                      </p>
                    </div>
                  </div>

                  {/* Detailed Journal Entries Table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>{language === 'ar' ? 'قيود اليومية المحاسبية المعتمدة وفق المعيار:' : 'Authoritative Accounting Journal Entries:'}</span>
                      </h4>

                      <button
                        onClick={() => handleCopyJournal(selectedStandard.journalEntries, 999)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-xs font-bold transition-all"
                      >
                        {copiedIndex === 999 ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{language === 'ar' ? 'تم النسخ بنجاح!' : 'Copied!'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{language === 'ar' ? 'نسخ القيود' : 'Copy Entries'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <table className="w-full text-start text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white text-[11px] font-semibold">
                            <th className="py-2.5 px-3 text-start w-28">{language === 'ar' ? 'مدين (Debit)' : 'Debit'}</th>
                            <th className="py-2.5 px-3 text-start w-28">{language === 'ar' ? 'دائن (Credit)' : 'Credit'}</th>
                            <th className="py-2.5 px-3 text-start">{language === 'ar' ? 'اسم الحساب في شجرة الحسابات' : 'Account Name (COA)'}</th>
                            <th className="py-2.5 px-3 text-start">{language === 'ar' ? 'الشرح والملاحظات' : 'Notes'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedStandard.journalEntries.map((line, lIdx) => (
                            <tr key={lIdx} className={lIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                                {line.debit !== '-' && line.debit ? line.debit : '-'}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                                {line.credit !== '-' && line.credit ? line.credit : '-'}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                <div>{language === 'ar' ? line.accountAr : line.accountEn}</div>
                                <div className="text-[10px] text-slate-400 font-normal">
                                  {language === 'ar' ? line.accountEn : line.accountAr}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px] leading-relaxed">
                                {language === 'ar' ? line.notesAr : line.notesEn}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Mandatory Disclosures & Pitfalls */}
              {activeTab === 'disclosures' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Disclosures Checklist */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>{language === 'ar' ? 'قائمة التحقق من الإفصاحات الإلزامية (Mandatory Disclosures):' : 'Mandatory Disclosures Checklist:'}</span>
                    </div>

                    <div className="space-y-2">
                      {(language === 'ar' ? selectedStandard.disclosuresAr : selectedStandard.disclosuresEn).map(
                        (disc, dIdx) => (
                          <div key={dIdx} className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-[10px]">
                              {dIdx + 1}
                            </span>
                            <span className="text-slate-700 leading-relaxed">{disc}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Common Pitfalls & Audit Watch-outs */}
                  <div className="bg-rose-50/50 rounded-2xl p-5 border border-rose-200 space-y-3">
                    <div className="flex items-center gap-2 text-rose-950 font-bold">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      <span>{language === 'ar' ? 'أبرز الأخطاء والمحاذير المهنية الشائعة (Common Pitfalls & Watch-outs):' : 'Common Pitfalls & Practical Watch-outs:'}</span>
                    </div>

                    <div className="space-y-2">
                      {(language === 'ar' ? selectedStandard.commonPitfallsAr : selectedStandard.commonPitfallsEn).map(
                        (pitfall, pIdx) => (
                          <div key={pIdx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-rose-100 text-xs">
                            <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 text-[10px]">
                              !
                            </span>
                            <span className="text-rose-900 leading-relaxed font-medium">{pitfall}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                <span>{language === 'ar' ? 'المعيار: ' : 'Standard: '}</span>
                <span className="font-bold text-slate-800">{selectedStandard.code}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedStandard(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors"
                >
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
