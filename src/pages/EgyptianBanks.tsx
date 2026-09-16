import React, { useState, useMemo } from 'react';
import { 
  Building2, Search, Copy, Check, ExternalLink, Phone, 
  Filter, Grid, List, Landmark, ArrowUpRight, ShieldCheck, 
  Sparkles, FileText, Info
} from 'lucide-react';
import { EGYPTIAN_BANKS_DATA, BankLogoBadge, EgyptianBank } from '../data/egyptianBanks';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';

export const EgyptianBanks: React.FC = () => {
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';
  const { showSuccess } = useNotification();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    showSuccess(isAr ? `تم نسخ ${label}: ${text}` : `Copied ${label}: ${text}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered Banks
  const filteredBanks = useMemo(() => {
    return EGYPTIAN_BANKS_DATA.filter(bank => {
      const matchesCategory = 
        selectedCategory === 'all' || bank.category === selectedCategory;

      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = 
        !q ||
        bank.nameAr.toLowerCase().includes(q) ||
        bank.nameEn.toLowerCase().includes(q) ||
        bank.code.toLowerCase().includes(q) ||
        bank.swift.toLowerCase().includes(q) ||
        (bank.notes && bank.notes.toLowerCase().includes(q)) ||
        bank.hotline.includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [searchTerm, selectedCategory]);

  // Metric counts
  const stats = useMemo(() => {
    return {
      total: EGYPTIAN_BANKS_DATA.length,
      public: EGYPTIAN_BANKS_DATA.filter(b => b.category === 'public').length,
      commercial: EGYPTIAN_BANKS_DATA.filter(b => b.category === 'commercial').length,
      islamic: EGYPTIAN_BANKS_DATA.filter(b => b.category === 'islamic').length,
      international: EGYPTIAN_BANKS_DATA.filter(b => b.category === 'international').length,
    };
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full" dir={dir}>
      
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-emerald-600 border border-emerald-500/40 p-6 sm:p-8 text-white shadow-xl shadow-emerald-600/20">
        {/* Subtle Watermark Art */}
        <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 pointer-events-none rotate-12">
          <Building2 size={160} />
        </div>
        <div className="absolute -bottom-10 -left-10 opacity-10 pointer-events-none">
          <Landmark size={200} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-bold backdrop-blur-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
              <span>{isAr ? 'البنك المركزي المصري • CBE' : 'Central Bank of Egypt Reference'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {isAr ? 'دليل ومرجع البنوك المصرية' : 'Egyptian Banks Directory & SWIFT Reference'}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
              {isAr 
                ? 'الدليل المعتمد للبنوك العاملة في جمهورية مصر العربية، رموز السويفت (SWIFT/BIC)، الأكواد المصرفية، وخطوط خدمة العملاء المباشرة.' 
                : 'Official directory of operating commercial and Islamic banks in Egypt, SWIFT/BIC codes, bank identifiers, and direct hotlines.'}
            </p>
          </div>

          {/* Quick Nav Links */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => {
                const event = new CustomEvent('navigate-to', { detail: { page: 'issued_cheques' } });
                window.dispatchEvent(event);
              }}
              className="px-4 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Landmark className="w-4 h-4 text-emerald-700" />
              <span>{isAr ? 'شاشة الشيكات' : 'Cheques Screen'}</span>
            </button>
            <button
              onClick={() => {
                const event = new CustomEvent('navigate-to', { detail: { page: 'payment_methods' } });
                window.dispatchEvent(event);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 border border-emerald-400/40 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-xs active:scale-95 backdrop-blur-sm"
            >
              <Building2 className="w-4 h-4 text-emerald-200" />
              <span>{isAr ? 'طرق السداد والحسابات' : 'Payment Methods'}</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/20">
          <div className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-sm transition-colors">
            <span className="text-[11px] text-emerald-100 font-semibold block">{isAr ? 'إجمالي البنوك' : 'Total Banks'}</span>
            <span className="text-2xl font-black font-mono text-white">{stats.total}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-sm transition-colors">
            <span className="text-[11px] text-emerald-100 font-semibold block">{isAr ? 'بنوك وطنية / عامة' : 'Public Sector'}</span>
            <span className="text-2xl font-black font-mono text-white">{stats.public}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-sm transition-colors">
            <span className="text-[11px] text-emerald-100 font-semibold block">{isAr ? 'بنوك تجارية خاصة' : 'Private Commercial'}</span>
            <span className="text-2xl font-black font-mono text-white">{stats.commercial}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-sm transition-colors">
            <span className="text-[11px] text-emerald-100 font-semibold block">{isAr ? 'بنوك إسلامية' : 'Islamic Banks'}</span>
            <span className="text-2xl font-black font-mono text-white">{stats.islamic}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-sm transition-colors col-span-2 sm:col-span-1">
            <span className="text-[11px] text-emerald-100 font-semibold block">{isAr ? 'بنوك دولية وعربية' : 'International'}</span>
            <span className="text-2xl font-black font-mono text-white">{stats.international}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم، الكود، رمز السويفت، أو الهاتف...' : 'Search by name, code, SWIFT, or hotline...'}
              className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute top-1/2 -translate-y-1/2 left-3 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode & Count */}
          <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
              {isAr ? `النتائج (${filteredBanks.length})` : `Results (${filteredBanks.length})`}
            </span>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={isAr ? 'عرض بطاقات' : 'Cards view'}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={isAr ? 'عرض جدول' : 'Table view'}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', labelAr: 'جميع البنوك (35)', labelEn: 'All Banks (35)' },
            { id: 'public', labelAr: 'القطاع العام والوطني', labelEn: 'Public Sector' },
            { id: 'commercial', labelAr: 'القطاع التجاري الخاص', labelEn: 'Commercial' },
            { id: 'islamic', labelAr: 'البنوك الإسلامية', labelEn: 'Islamic Banks' },
            { id: 'international', labelAr: 'البنوك الدولية والعربية', labelEn: 'International' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isAr ? cat.labelAr : cat.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {filteredBanks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <Landmark className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {isAr ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching banks found'}
          </h3>
          <p className="text-xs text-slate-400">
            {isAr ? 'جرب البحث باسم آخر، كود البنك، أو رمز السويفت' : 'Try searching by a different name, code, or SWIFT'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        
        /* 1. CARDS GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBanks.map(bank => (
            <div
              key={bank.id}
              className="group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden"
            >
              {/* Subtle top accent border line with bank brand color */}
              <div 
                className="absolute top-0 left-0 right-0 h-1 transition-all group-hover:h-1.5"
                style={{ backgroundColor: bank.brandColor }}
              />

              <div className="space-y-3">
                {/* Bank Header: Logo Badge + Code + Category */}
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3">
                    <BankLogoBadge bank={bank} size="md" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          #{bank.id} • {bank.code}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1 leading-snug">
                        {isAr ? bank.nameAr : bank.nameEn}
                      </h3>
                      <span className="text-[11px] text-slate-400 block font-medium">
                        {isAr ? bank.nameEn : bank.nameAr}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SWIFT Box */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">SWIFT / BIC</span>
                    <span className="font-mono font-black text-xs text-emerald-800 dark:text-emerald-300 tracking-wider">
                      {bank.swift}
                    </span>
                  </div>
                  {bank.swift !== '—' && (
                    <button
                      onClick={() => handleCopy(bank.swift, 'سويفت كود')}
                      className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-600 transition-colors"
                      title={isAr ? 'نسخ رمز السويفت' : 'Copy SWIFT'}
                    >
                      {copiedCode === bank.swift ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Category & Description Note */}
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{isAr ? bank.categoryAr : bank.categoryEn}</span>
                  {bank.notes && (
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      • {bank.notes}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Actions Footer */}
              <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                {bank.hotline ? (
                  <a
                    href={`tel:${bank.hotline}`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600"
                    title={isAr ? 'الاتصال بالخط الساخن' : 'Call Hotline'}
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-mono">{bank.hotline}</span>
                  </a>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(bank.nameAr, 'اسم البنك')}
                    className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 p-1"
                    title={isAr ? 'نسخ اسم البنك' : 'Copy Bank Name'}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {bank.website && (
                    <a
                      href={bank.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-600 p-1"
                      title={isAr ? 'زيارة الموقع الرسمي' : 'Visit Website'}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>

      ) : (

        /* 2. TABLE VIEW (Exact reproduction of user's table with logo & actions) */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black">
                  <th className="p-3 text-center w-12">#</th>
                  <th className="p-3">{isAr ? 'الشعار' : 'Logo'}</th>
                  <th className="p-3 font-mono">{isAr ? 'الكود' : 'Code'}</th>
                  <th className="p-3">{isAr ? 'اسم البنك بالعربي' : 'Arabic Name'}</th>
                  <th className="p-3 text-left">{isAr ? 'English Name' : 'English Name'}</th>
                  <th className="p-3 font-mono">{isAr ? 'SWIFT / BIC' : 'SWIFT / BIC'}</th>
                  <th className="p-3">{isAr ? 'التصنيف' : 'Category'}</th>
                  <th className="p-3 font-mono text-center">{isAr ? 'الخط الساخن' : 'Hotline'}</th>
                  <th className="p-3 text-center">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBanks.map(bank => (
                  <tr 
                    key={bank.id} 
                    className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors"
                  >
                    <td className="p-3 text-center font-mono font-bold text-slate-400">
                      {bank.id}
                    </td>
                    <td className="p-3">
                      <BankLogoBadge bank={bank} size="sm" />
                    </td>
                    <td className="p-3 font-mono font-black text-slate-900 dark:text-white">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {bank.code}
                      </span>
                    </td>
                    <td className="p-3 font-black text-slate-900 dark:text-white">
                      {bank.nameAr}
                    </td>
                    <td className="p-3 text-left font-medium text-slate-600 dark:text-slate-300 font-sans">
                      {bank.nameEn}
                    </td>
                    <td className="p-3 font-mono font-black text-emerald-800 dark:text-emerald-400">
                      <div className="flex items-center gap-1.5">
                        <span>{bank.swift}</span>
                        {bank.swift !== '—' && (
                          <button
                            onClick={() => handleCopy(bank.swift, 'سويفت')}
                            className="p-1 hover:text-emerald-600 text-slate-400 transition-colors"
                            title="نسخ السويفت"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-500 font-medium">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px]">
                        {isAr ? bank.categoryAr : bank.categoryEn}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-center text-slate-700 dark:text-slate-300">
                      {bank.hotline ? (
                        <a href={`tel:${bank.hotline}`} className="hover:text-emerald-600 flex items-center justify-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>{bank.hotline}</span>
                        </a>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleCopy(bank.nameAr, 'اسم البنك')}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-600"
                          title="نسخ اسم البنك"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {bank.website && (
                          <a
                            href={bank.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-600"
                            title="الموقع الرسمي"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      )}

      {/* Regulatory Footer Information Box */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-700 dark:text-slate-300">
            {isAr ? 'ملاحظة تنظيمية ومصرفية:' : 'Regulatory & Banking Note:'}
          </p>
          <p className="leading-relaxed">
            {isAr 
              ? 'تخضع جميع البنوك الواردة أعلاه لرقابة وإشراف البنك المركزي المصري (CBE). يمكن استخدام أكواد السويفت (SWIFT/BIC) في التحويلات الدولية والمحلية، وتسجيل الحسابات البنكية في دليل الحسابات وسندات القبض والصرف والشيكات البنكية.' 
              : 'All listed banks operate under the supervision of the Central Bank of Egypt (CBE). SWIFT/BIC codes can be used for domestic and international wire transfers, bank account setup, and cheque issuance.'}
          </p>
        </div>
      </div>

    </div>
  );
};

export default EgyptianBanks;
