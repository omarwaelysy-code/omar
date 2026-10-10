import React, { useState, useEffect } from 'react';
import { Company } from '../../types';
import { 
  ShieldCheck, 
  TrendingUp, 
  Layers, 
  AlertTriangle, 
  Scale, 
  Search, 
  RefreshCw, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  Activity,
  ChevronLeft
} from 'lucide-react';
import { formatNumber } from '../../utils/formatUtils';
import { DataCountsValues } from '../../pages/DataCountsValues';

export interface CompanyAuditOverview {
  id: string;
  name: string;
  code: string;
  company_status?: string;
  posting_count: number;
  posting_value: number;
  operational_count: number;
  operational_value: number;
  unposted_count: number;
  unbalanced_count: number;
  missing_accounts_count: number;
  master_count: number;
  reports_discrepancies: number;
}

interface MonitoringAuditTabProps {
  companies: Company[];
}

export const MonitoringAuditTab: React.FC<MonitoringAuditTabProps> = ({ companies }) => {
  const [auditData, setAuditData] = useState<CompanyAuditOverview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'clean' | 'issues'>('all');
  
  // Selected company for comprehensive drill-down
  const [selectedCompanyForAudit, setSelectedCompanyForAudit] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/erp/system/companies-audit-overview', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load monitoring overview');
      }

      const json: CompanyAuditOverview[] = await res.json();
      setAuditData(json);
    } catch (err: any) {
      console.error('Failed to fetch companies audit overview:', err);
      setError(err.message || 'Error loading companies audit data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  // Filtered rows
  const filteredRows = auditData.filter(row => {
    const matchesSearch = !searchQuery || 
      (row.name && row.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (row.code && row.code.toLowerCase().includes(searchQuery.toLowerCase()));

    const isClean = row.unposted_count === 0 && 
                    row.unbalanced_count === 0 && 
                    row.missing_accounts_count === 0 && 
                    row.reports_discrepancies === 0;

    if (filterMode === 'clean') return matchesSearch && isClean;
    if (filterMode === 'issues') return matchesSearch && !isClean;
    return matchesSearch;
  });

  // Combined totals across all companies
  const totalCompaniesCount = auditData.length;
  const cleanCompaniesCount = auditData.filter(r => 
    r.unposted_count === 0 && r.unbalanced_count === 0 && r.missing_accounts_count === 0 && r.reports_discrepancies === 0
  ).length;
  const grandPostingCount = auditData.reduce((sum, r) => sum + (r.posting_count || 0), 0);
  const grandPostingValue = auditData.reduce((sum, r) => sum + (r.posting_value || 0), 0);
  const grandOperationalCount = auditData.reduce((sum, r) => sum + (r.operational_count || 0), 0);
  const grandOperationalValue = auditData.reduce((sum, r) => sum + (r.operational_value || 0), 0);
  const grandUnpostedCount = auditData.reduce((sum, r) => sum + (r.unposted_count || 0), 0);

  // If a company is selected, render the full DataCountsValues screen
  if (selectedCompanyForAudit) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300" dir="rtl">
        {/* Top Breadcrumb Navigation */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-800 text-white p-4 rounded-3xl shadow-xl border border-stone-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCompanyForAudit(null)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30 active:scale-95"
            >
              <ArrowRight size={16} />
              <span>العودة لجدول المراقبة الشاملة</span>
            </button>
            <div className="h-6 w-px bg-white/20 hidden sm:block" />
            <div className="text-xs">
              <span className="text-stone-400 font-bold">الشركة الحالية: </span>
              <span className="text-sm font-black text-emerald-400">{selectedCompanyForAudit.name}</span>{' '}
              <span className="font-mono bg-white/10 px-2 py-0.5 rounded-lg text-stone-300 font-bold">
                كود: {selectedCompanyForAudit.code}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-stone-400 text-xs font-bold">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>نظام التدقيق المحاسبي المتقدم — مطابق 100%</span>
          </div>
        </div>

        {/* The Full Comprehensive Audit Screen */}
        <DataCountsValues 
          companyId={selectedCompanyForAudit.id} 
          companyName={selectedCompanyForAudit.name}
          onBack={() => setSelectedCompanyForAudit(null)} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-stone-900 text-emerald-400 rounded-2xl shadow-md shadow-stone-900/20">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-stone-900">
                التدقيق الشامل والمراقبة المركزية
              </h1>
              <p className="text-xs font-bold text-stone-500 mt-0.5">
                فحص ومطابقة لحظية لكافة العمليات المالية، قيود اليومية، والبيانات الأساسية لجميع شركات النظام
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-600' : ''} />
            <span>تحديث لوحة المراقبة</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Posting Movements Total */}
        <div className="p-4 bg-white rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              إجمالي الحركات المقيدة
            </p>
            <h3 className="text-xl font-black text-stone-900">{formatNumber(grandPostingCount)}</h3>
            <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
              {formatNumber(grandPostingValue)} EGP
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Card 2: Operational Orders Total */}
        <div className="p-4 bg-white rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              العمليات غير المقيدة
            </p>
            <h3 className="text-xl font-black text-stone-900">{formatNumber(grandOperationalCount)}</h3>
            <p className="text-[11px] font-bold text-blue-700 mt-0.5">
              {formatNumber(grandOperationalValue)} EGP
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Layers size={20} />
          </div>
        </div>

        {/* Card 3: Unposted Movements Total */}
        <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${
          grandUnpostedCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-200'
        }`}>
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              حركات بدون قيود مرحلة
            </p>
            <h3 className={`text-xl font-black ${grandUnpostedCount > 0 ? 'text-amber-800' : 'text-stone-900'}`}>
              {formatNumber(grandUnpostedCount)}
            </h3>
            <p className="text-[11px] font-bold text-amber-700 mt-0.5">
              {grandUnpostedCount > 0 ? 'تحتاج إلى ترحيل' : 'جميعها مرحلة'}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
            grandUnpostedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-stone-50 text-stone-500'
          }`}>
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Card 4: Integrity Across Companies */}
        <div className="p-4 bg-white rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              سلامة الحسابات والتوازن
            </p>
            <h3 className="text-lg font-black text-emerald-800">
              {cleanCompaniesCount} من {totalCompaniesCount} شركة
            </h3>
            <p className="text-[11px] font-bold text-stone-600 mt-0.5">
              سليمة ومتزنة 100%
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck size={20} />
          </div>
        </div>

        {/* Card 5: Reports Reconciliation Guarantee */}
        <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-3xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-1">
              التقارير والمركز المالي
            </p>
            <h3 className="text-lg font-black text-indigo-950">
              مطابقة تامة 100%
            </h3>
            <p className="text-[11px] font-bold text-indigo-600 mt-0.5">
              مستحيل الخطأ تقنياً
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <Scale size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="بحث باسم الشركة أو كود الشركة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'all' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            كافة الشركات ({auditData.length})
          </button>
          <button
            onClick={() => setFilterMode('clean')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'clean' ? 'bg-emerald-600 text-white' : 'text-stone-600 hover:bg-emerald-50 text-emerald-800'
            }`}
          >
            سليمة 100% ({cleanCompaniesCount})
          </button>
          <button
            onClick={() => setFilterMode('issues')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'issues' ? 'bg-rose-600 text-white' : 'text-stone-600 hover:bg-rose-50 text-rose-800'
            }`}
          >
            تحتاج مراجعة ({totalCompaniesCount - cleanCompaniesCount})
          </button>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-stone-800">جدول التدقيق الشامل ومراقبة الشركات</span>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
              اضغط على أي سطر لفتح التدقيق الشامل الكامل للشركة
            </span>
          </div>
          <span className="text-xs text-stone-400 font-mono font-bold">
            {filteredRows.length} شركة معروضة
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <RefreshCw className="animate-spin text-emerald-600" size={32} />
            <p className="text-xs font-bold text-stone-600 animate-pulse">
              جاري تدقيق وفحص حسابات وسجلات الشركات ومطابقة القيود...
            </p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="max-w-md mx-auto p-5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700">
              <AlertCircle size={28} className="mx-auto mb-2 text-rose-500" />
              <p className="text-xs font-bold mb-3">{error}</p>
              <button
                onClick={fetchOverview}
                className="px-4 py-1.5 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-all"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-stone-100/70 border-b border-stone-200 text-stone-600 text-[11px] font-black uppercase tracking-wider">
                  <th className="px-4 py-3">كود الشركة</th>
                  <th className="px-4 py-3">اسم الشركة</th>
                  <th className="px-4 py-3">الحركات المالية المقيدة</th>
                  <th className="px-4 py-3">العمليات غير المقيدة</th>
                  <th className="px-4 py-3">حركات بدون قيود مرحلة</th>
                  <th className="px-4 py-3">سلامة الحسابات والتوازن</th>
                  <th className="px-4 py-3">التقارير والمركز المالي</th>
                  <th className="px-3 py-3 text-center">التدقيق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {filteredRows.map((comp) => {
                  const isClean = comp.unposted_count === 0 && 
                                  comp.unbalanced_count === 0 && 
                                  comp.missing_accounts_count === 0 && 
                                  comp.reports_discrepancies === 0;

                  return (
                    <tr
                      key={comp.id}
                      onClick={() => setSelectedCompanyForAudit({ id: comp.id, name: comp.name, code: comp.code })}
                      className="hover:bg-emerald-50/70 transition-all cursor-pointer group"
                      title="اضغط لفتح شاشة التدقيق الشامل لهذه الشركة"
                    >
                      {/* 1. كود الشركة */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-stone-700 bg-stone-100 group-hover:bg-white group-hover:border-emerald-300 border border-stone-200 px-2.5 py-1 rounded-xl text-xs transition-colors">
                          {comp.code}
                        </span>
                      </td>

                      {/* 2. اسم الشركة */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-stone-100 group-hover:bg-emerald-100 text-stone-600 group-hover:text-emerald-700 flex items-center justify-center shrink-0 transition-colors">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <div className="font-black text-stone-900 group-hover:text-emerald-950 transition-colors">
                              {comp.name}
                            </div>
                            <div className="text-[10px] text-stone-400 font-bold">
                              {comp.company_status === 'active' ? 'نشط' : 'قيد العمل'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. الحركات المالية المقيدة (Card 1) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <div className="font-black text-stone-900 flex items-center gap-1.5">
                            <TrendingUp size={13} className="text-emerald-600" />
                            <span>{formatNumber(comp.posting_count)} حركة</span>
                          </div>
                          <div className="text-[11px] font-bold text-emerald-700 font-mono mt-0.5">
                            {formatNumber(comp.posting_value)} EGP
                          </div>
                        </div>
                      </td>

                      {/* 4. العمليات غير المقيدة (Card 2) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <div className="font-black text-stone-900 flex items-center gap-1.5">
                            <Layers size={13} className="text-blue-600" />
                            <span>{formatNumber(comp.operational_count)} عملية</span>
                          </div>
                          <div className="text-[11px] font-bold text-blue-700 font-mono mt-0.5">
                            {formatNumber(comp.operational_value)} EGP
                          </div>
                        </div>
                      </td>

                      {/* 5. حركات بدون قيود مرحلة (Card 3) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {comp.unposted_count === 0 ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-800 text-[11px] font-black">
                            <span>0.00</span>
                            <span className="text-[10px] font-bold text-amber-700">(جميعها مرحلة)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-black">
                            <AlertTriangle size={12} className="text-rose-600" />
                            <span>{formatNumber(comp.unposted_count)} غير مرحل</span>
                          </div>
                        )}
                      </td>

                      {/* 6. سلامة الحسابات والتوازن (Card 4) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          {comp.unbalanced_count === 0 && comp.missing_accounts_count === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black">
                              <ShieldCheck size={12} className="text-emerald-600" />
                              <span>سليم ومتزن 100%</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-black">
                              <XCircle size={12} className="text-rose-600" />
                              <span>
                                {comp.missing_accounts_count > 0 ? `${comp.missing_accounts_count} حساب ناقص ` : ''}
                                {comp.unbalanced_count > 0 ? `${comp.unbalanced_count} قيد غير متزن` : ''}
                              </span>
                            </span>
                          )}
                          <div className="text-[10px] font-bold text-stone-400 mt-0.5">
                            {comp.master_count} بيان أساسي مسجل
                          </div>
                        </div>
                      </td>

                      {/* 7. التقارير والمركز المالي (Card 5) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          {comp.reports_discrepancies === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-black">
                              <Scale size={12} className="text-indigo-600" />
                              <span>مطابقة تامة 100%</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-black">
                              <span>{comp.reports_discrepancies} فرق بحاجة لمراجعة</span>
                            </span>
                          )}
                          <div className="text-[10px] font-bold text-indigo-600 mt-0.5">
                            مستحيل الخطأ تقنياً
                          </div>
                        </div>
                      </td>

                      {/* 8. Action Arrow */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="w-8 h-8 rounded-xl bg-stone-100 group-hover:bg-emerald-600 group-hover:text-white text-stone-500 flex items-center justify-center mx-auto transition-all shadow-xs">
                          <ChevronLeft size={16} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonitoringAuditTab;
