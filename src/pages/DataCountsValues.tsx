import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  RefreshCw, 
  Download, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  FileText, 
  Users, 
  Package, 
  Layers, 
  CreditCard, 
  Warehouse, 
  Building2, 
  Boxes, 
  History, 
  Wrench, 
  ChevronRight, 
  ExternalLink,
  Info,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigation } from '../contexts/NavigationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber } from '../utils/formatUtils';
import { exportToExcel } from '../utils/excelUtils';

interface MasterDataItem {
  key: string;
  name: string;
  count: number;
  total_value?: number;
}

interface OperationalDataItem {
  key: string;
  name: string;
  count: number;
  total_value: number;
  notes: string;
}

interface DocumentIssue {
  document_id: string;
  document_number: string;
  date: string;
  amount: number;
  party_name?: string;
  error_type: string;
  details: string;
}

interface PostingTransactionItem {
  key: string;
  name: string;
  count: number;
  total_value: number;
  journal_value: number;
  variance: number;
  unposted_count: number;
  unposted_value: number;
  unbalanced_entries_count: number;
  missing_accounts_count: number;
  issues: DocumentIssue[];
}

interface AuditData {
  company_id: string;
  timestamp: string;
  master_data: MasterDataItem[];
  operational_data: OperationalDataItem[];
  posting_transactions: PostingTransactionItem[];
}

export const DataCountsValues: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage } = useNavigation();

  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'posting' | 'operational' | 'master'>('all');
  const [fixing, setFixing] = useState<boolean>(false);
  const [fixResult, setFixResult] = useState<any | null>(null);

  // Modal for detailed issues report
  const [selectedItemIssues, setSelectedItemIssues] = useState<{
    name: string;
    issues: DocumentIssue[];
  } | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/erp/system/data-audit?company_id=${user.company_id}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch audit data');
      }
      const json: AuditData = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Audit fetch error:', err);
      setError(err.message || 'Error loading audit data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleAutoFix = async () => {
    if (!user) return;
    if (!window.confirm(language === 'ar' 
      ? 'هل ترغب في ربط الحسابات الناقصة بالحسابات الافتراضية للشركة تلقائياً؟' 
      : 'Do you want to automatically link missing accounts with company defaults?')) {
      return;
    }

    setFixing(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/erp/system/auto-fix-missing-accounts?company_id=${user.company_id}`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Fix failed');

      setFixResult(resJson);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Auto fix error');
    } finally {
      setFixing(false);
    }
  };

  const handleExportExcel = () => {
    if (!data) return;
    const rows: any[] = [];

    // Posting rows
    data.posting_transactions.forEach(pt => {
      rows.push({
        'القسم': 'حركات تلزم قيود',
        'نوع الحركة': pt.name,
        'العدد': pt.count,
        'إجمالي القيم (ج.م)': pt.total_value,
        'قيم القيود (ج.م)': pt.journal_value,
        'فرق القيمة': pt.variance,
        'غير مرحل (عدد)': pt.unposted_count,
        'غير مرحل (قيمة)': pt.unposted_value,
        'قيود غير متزنة': pt.unbalanced_entries_count,
        'حسابات ناقصة': pt.missing_accounts_count,
        'حالة المطابقة': pt.unposted_count === 0 && pt.unbalanced_entries_count === 0 && pt.missing_accounts_count === 0 ? 'سليم ومتطابق' : 'يحتاج مراجعة'
      });
    });

    // Operational rows
    data.operational_data.forEach(op => {
      rows.push({
        'القسم': 'عمليات لا تلزم قيود',
        'نوع الحركة': op.name,
        'العدد': op.count,
        'إجمالي القيم (ج.م)': op.total_value,
        'قيم القيود (ج.م)': 0,
        'فرق القيمة': 0,
        'غير مرحل (عدد)': 0,
        'غير مرحل (قيمة)': 0,
        'قيود غير متزنة': 0,
        'حسابات ناقصة': 0,
        'حالة المطابقة': op.notes
      });
    });

    // Master rows
    data.master_data.forEach(md => {
      rows.push({
        'القسم': 'البيانات الأساسية',
        'نوع الحركة': md.name,
        'العدد': md.count,
        'إجمالي القيم (ج.م)': md.total_value || 0,
        'قيم القيود (ج.م)': 0,
        'فرق القيمة': 0,
        'غير مرحل (عدد)': 0,
        'غير مرحل (قيمة)': 0,
        'قيود غير متزنة': 0,
        'حسابات ناقصة': 0,
        'حالة المطابقة': 'بيان أساسي'
      });
    });

    exportToExcel(rows, { filename: `Data_Audit_Summary_${new Date().toISOString().split('T')[0]}` });
  };

  // Aggregated KPI numbers
  const totalMasterCount = data?.master_data.reduce((acc, m) => acc + (m.count || 0), 0) || 0;
  const totalOperationalCount = data?.operational_data.reduce((acc, o) => acc + (o.count || 0), 0) || 0;
  const totalOperationalValue = data?.operational_data.reduce((acc, o) => acc + (o.total_value || 0), 0) || 0;
  
  const totalPostingCount = data?.posting_transactions.reduce((acc, p) => acc + (p.count || 0), 0) || 0;
  const totalPostingValue = data?.posting_transactions.reduce((acc, p) => acc + (p.total_value || 0), 0) || 0;
  const totalJournalValue = data?.posting_transactions.reduce((acc, p) => acc + (p.journal_value || 0), 0) || 0;
  
  const totalUnpostedCount = data?.posting_transactions.reduce((acc, p) => acc + (p.unposted_count || 0), 0) || 0;
  const totalUnbalancedCount = data?.posting_transactions.reduce((acc, p) => acc + (p.unbalanced_entries_count || 0), 0) || 0;
  const totalMissingAccountsCount = data?.posting_transactions.reduce((acc, p) => acc + (p.missing_accounts_count || 0), 0) || 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" dir={dir}>
        <RefreshCw className="animate-spin text-emerald-600" size={40} />
        <p className="font-bold text-stone-600 text-sm animate-pulse">
          {language === 'ar' ? 'جاري فحص وتدقيق كافة سجلات وبيانات الشركة...' : 'Auditing company data and records...'}
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center" dir={dir}>
        <div className="max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-3xl text-red-700">
          <AlertCircle size={36} className="mx-auto mb-3 text-red-500" />
          <h3 className="text-lg font-black mb-1">{language === 'ar' ? 'فشل فحص البيانات' : 'Audit Failed'}</h3>
          <p className="text-xs font-bold mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition-all shadow-md"
          >
            {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  const filteredPosting = data.posting_transactions.filter(item => 
    !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOperational = data.operational_data.filter(item => 
    !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMaster = data.master_data.filter(item => 
    !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-600/20">
              <BarChart3 size={24} />
            </div>
            <h1 className="text-2xl font-black text-stone-900">
              {language === 'ar' ? 'شاشة العدد وقيم البيانات' : 'Data Counts & Values Summary'}
            </h1>
          </div>
          <p className="text-xs font-bold text-stone-500">
            {language === 'ar' 
              ? 'تقرير تفصيلي شامل يوضح عدد البيانات المسجلة، قيمها المالية، ومطابقة القيود المحاسبية وكشف الحسابات الناقصة'
              : 'Comprehensive audit report displaying record counts, financial values, journal balance and missing accounts'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleAutoFix}
            disabled={fixing}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Wrench size={16} className={fixing ? 'animate-spin' : ''} />
            <span>{language === 'ar' ? 'إصلاح الحسابات الناقصة تلقائياً' : 'Auto-Fix Missing Accounts'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
          >
            <Download size={16} />
            <span>{language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl font-bold transition-all active:scale-95"
            title={language === 'ar' ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Auto fix notification */}
      {fixResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            <span>
              {fixResult.message} — تم تحديث {fixResult.fixed_products} صنف، {fixResult.fixed_customers} عميل، {fixResult.fixed_suppliers} مورد.
            </span>
          </div>
          <button onClick={() => setFixResult(null)} className="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Posting Movements */}
        <div className="p-5 bg-white rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              {language === 'ar' ? 'الحركات المالية المقيدة' : 'Posting Movements'}
            </p>
            <h3 className="text-2xl font-black text-stone-900">{formatNumber(totalPostingCount)}</h3>
            <p className="text-xs font-bold text-emerald-700 mt-1">
              {formatNumber(totalPostingValue)} EGP
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Card 2: Operational Orders */}
        <div className="p-5 bg-white rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              {language === 'ar' ? 'العمليات غير المقيدة' : 'Operational Orders'}
            </p>
            <h3 className="text-2xl font-black text-stone-900">{formatNumber(totalOperationalCount)}</h3>
            <p className="text-xs font-bold text-blue-700 mt-1">
              {formatNumber(totalOperationalValue)} EGP
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Layers size={24} />
          </div>
        </div>

        {/* Card 3: Unposted Movements */}
        <div className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between ${
          totalUnpostedCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-200'
        }`}>
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              {language === 'ar' ? 'حركات بدون قيود مرحلة' : 'Unposted Movements'}
            </p>
            <h3 className={`text-2xl font-black ${totalUnpostedCount > 0 ? 'text-amber-800' : 'text-stone-900'}`}>
              {formatNumber(totalUnpostedCount)}
            </h3>
            <p className="text-xs font-bold text-amber-700 mt-1">
              {totalUnpostedCount > 0 ? (language === 'ar' ? 'تحتاج إلى ترحيل' : 'Needs Posting') : (language === 'ar' ? 'جميعها مرحلة' : 'All Posted')}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
            totalUnpostedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-stone-50 text-stone-500'
          }`}>
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Card 4: Integrity Status */}
        <div className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between ${
          totalUnbalancedCount === 0 && totalMissingAccountsCount === 0 
            ? 'bg-emerald-50 border-emerald-200' 
            : 'bg-rose-50 border-rose-200'
        }`}>
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              {language === 'ar' ? 'سلامة الحسابات والتوازن' : 'Integrity & Balance'}
            </p>
            <h3 className={`text-xl font-black ${
              totalUnbalancedCount === 0 && totalMissingAccountsCount === 0 ? 'text-emerald-800' : 'text-rose-800'
            }`}>
              {totalUnbalancedCount === 0 && totalMissingAccountsCount === 0 
                ? (language === 'ar' ? 'سليم ومتزن 100%' : 'Balanced 100%') 
                : (language === 'ar' ? `${totalMissingAccountsCount} حساب ناقص / ${totalUnbalancedCount} قيد` : 'Issues Detected')}
            </h3>
            <p className="text-xs font-bold opacity-80 mt-1 text-stone-600">
              {language === 'ar' ? `${totalMasterCount} بيان أساسي مسجل` : `${totalMasterCount} master records`}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
            totalUnbalancedCount === 0 && totalMissingAccountsCount === 0 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-rose-100 text-rose-700'
          }`}>
            {totalUnbalancedCount === 0 && totalMissingAccountsCount === 0 
              ? <ShieldCheck size={24} /> 
              : <XCircle size={24} />}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all' 
                ? 'bg-stone-900 text-white' 
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {language === 'ar' ? 'عرض الكل' : 'All Sections'}
          </button>
          <button
            onClick={() => setActiveTab('posting')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'posting' 
                ? 'bg-emerald-600 text-white' 
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {language === 'ar' ? 'ثالثاً: الحركات المقيدة' : 'Posting Transactions'}
          </button>
          <button
            onClick={() => setActiveTab('operational')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'operational' 
                ? 'bg-blue-600 text-white' 
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {language === 'ar' ? 'ثانياً: العمليات غير المقيدة' : 'Non-Posting Operations'}
          </button>
          <button
            onClick={() => setActiveTab('master')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'master' 
                ? 'bg-purple-600 text-white' 
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {language === 'ar' ? 'أولاً: البيانات الأساسية' : 'Master Data'}
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-stone-400 ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ar' ? 'بحث عن بيان أو حركة...' : 'Search records...'}
            className={`w-full py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>
      </div>

      {/* SECTION 3: POSTING FINANCIAL TRANSACTIONS (الحركات التي تلزم قيود) */}
      {(activeTab === 'all' || activeTab === 'posting') && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <h2 className="text-base font-black text-emerald-950">
                {language === 'ar' ? 'ثالثاً: الحركات المالية التي تلزم قيوداً محاسبية' : 'Posting Financial Transactions'}
              </h2>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
              {filteredPosting.length} {language === 'ar' ? 'نوع مستند' : 'Types'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/80 text-stone-600 border-b border-stone-200 font-black">
                  <th className="p-3.5 whitespace-nowrap">{language === 'ar' ? 'نوع الحركة / المستند' : 'Type'}</th>
                  <th className="p-3.5 whitespace-nowrap text-center">{language === 'ar' ? 'العدد' : 'Count'}</th>
                  <th className="p-3.5 whitespace-nowrap text-left">{language === 'ar' ? 'إجمالي القيم' : 'Total Value'}</th>
                  <th className="p-3.5 whitespace-nowrap text-left">{language === 'ar' ? 'قيم القيود المرحلة' : 'Journal Value'}</th>
                  <th className="p-3.5 whitespace-nowrap text-center">{language === 'ar' ? 'فرق القيمة' : 'Variance'}</th>
                  <th className="p-3.5 whitespace-nowrap text-center">{language === 'ar' ? 'حركات غير مرحلة' : 'Unposted'}</th>
                  <th className="p-3.5 whitespace-nowrap text-center">{language === 'ar' ? 'قيود غير متزنة' : 'Unbalanced'}</th>
                  <th className="p-3.5 whitespace-nowrap text-center">{language === 'ar' ? 'حسابات ناقصة' : 'Missing Accounts'}</th>
                  <th className="p-3.5 whitespace-nowrap text-center">{language === 'ar' ? 'حالة المطابقة' : 'Status'}</th>
                  <th className="p-3.5 whitespace-nowrap text-center">{language === 'ar' ? 'الإجراءات والحل' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-bold text-stone-700">
                {filteredPosting.map((row) => {
                  const hasIssues = row.unposted_count > 0 || row.unbalanced_entries_count > 0 || row.missing_accounts_count > 0 || Math.abs(row.variance) > 1;

                  return (
                    <tr key={row.key} className="hover:bg-stone-50/60 transition-colors">
                      <td className="p-3.5 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0">
                          <FileText size={14} />
                        </div>
                        <span className="font-black text-stone-900">{row.name}</span>
                      </td>

                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-stone-100 font-mono font-bold text-stone-800">
                          {formatNumber(row.count)}
                        </span>
                      </td>

                      <td className="p-3.5 text-left font-mono font-black text-stone-900">
                        {formatNumber(row.total_value)} EGP
                      </td>

                      <td className="p-3.5 text-left font-mono font-black text-emerald-700">
                        {formatNumber(row.journal_value)} EGP
                      </td>

                      <td className="p-3.5 text-center font-mono">
                        {Math.abs(row.variance) < 0.05 ? (
                          <span className="text-emerald-600 font-bold">0.00</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-black">
                            {formatNumber(row.variance)}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {row.unposted_count === 0 ? (
                          <span className="text-emerald-600 font-bold">0</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black">
                            {row.unposted_count} ({formatNumber(row.unposted_value)})
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {row.unbalanced_entries_count === 0 ? (
                          <span className="text-emerald-600 font-bold">0</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black">
                            {row.unbalanced_entries_count}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {row.missing_accounts_count === 0 ? (
                          <span className="text-emerald-600 font-bold">0</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black">
                            {row.missing_accounts_count}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {!hasIssues ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                            <CheckCircle2 size={12} />
                            {language === 'ar' ? 'سليم ومتطابق' : 'Balanced'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                            <AlertTriangle size={12} />
                            {language === 'ar' ? 'يحتاج مراجعة' : 'Check Required'}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {row.issues && row.issues.length > 0 ? (
                          <button
                            onClick={() => setSelectedItemIssues({ name: row.name, issues: row.issues })}
                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 mx-auto"
                          >
                            <Info size={12} className="text-amber-600" />
                            <span>{language === 'ar' ? 'عرض التقرير والحل' : 'Details & Solution'}</span>
                          </button>
                        ) : (
                          <span className="text-stone-400 font-bold text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: NON-POSTING OPERATIONAL TRANSACTIONS (العمليات التي لا تلزم قيود ولكن تشمل قيماً) */}
      {(activeTab === 'all' || activeTab === 'operational') && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <h2 className="text-base font-black text-blue-950">
                {language === 'ar' ? 'ثانياً: العمليات التي لا تلزم عنها قيود ولكن تشمل قيماً' : 'Non-Posting Operational Transactions (With Values)'}
              </h2>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
              {filteredOperational.length} {language === 'ar' ? 'نوع مستند' : 'Types'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/80 text-stone-600 border-b border-stone-200 font-black">
                  <th className="p-3.5 whitespace-nowrap">{language === 'ar' ? 'نوع العملية / المستند' : 'Document Type'}</th>
                  <th className="p-3.5 whitespace-nowrap text-center">{language === 'ar' ? 'العدد' : 'Count'}</th>
                  <th className="p-3.5 whitespace-nowrap text-left">{language === 'ar' ? 'إجمالي القيم المسجلة' : 'Total Values'}</th>
                  <th className="p-3.5 whitespace-nowrap">{language === 'ar' ? 'طبيعة المستند والأثر المحاسبي' : 'Notes'}</th>
                  <th className="p-3.5 whitespace-nowrap text-center">{language === 'ar' ? 'حالة الترحيل' : 'Posting Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-bold text-stone-700">
                {filteredOperational.map((row) => (
                  <tr key={row.key} className="hover:bg-stone-50/60 transition-colors">
                    <td className="p-3.5 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                        <Layers size={14} />
                      </div>
                      <span className="font-black text-stone-900">{row.name}</span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-stone-100 font-mono font-bold text-stone-800">
                        {formatNumber(row.count)}
                      </span>
                    </td>

                    <td className="p-3.5 text-left font-mono font-black text-blue-900">
                      {formatNumber(row.total_value)} EGP
                    </td>

                    <td className="p-3.5 text-stone-600 text-xs">
                      {row.notes}
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 font-bold text-[11px]">
                        {language === 'ar' ? 'غير ملزم بقيد' : 'Non-Posting Document'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 1: MASTER DATA & USERS (البيانات الأساسية والمستخدمين والصلاحيات) */}
      {(activeTab === 'all' || activeTab === 'master') && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-purple-50/60 border-b border-purple-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
              <h2 className="text-base font-black text-purple-950">
                {language === 'ar' ? 'أولاً: البيانات الأساسية والمستخدمين والصلاحيات' : 'Master Data, Users & System Architecture'}
              </h2>
            </div>
            <span className="text-xs font-bold text-purple-700 bg-white px-2.5 py-1 rounded-lg border border-purple-200">
              {filteredMaster.length} {language === 'ar' ? 'كيان' : 'Entities'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {filteredMaster.map((row) => (
              <div 
                key={row.key} 
                className="p-3.5 rounded-2xl border border-stone-100 bg-stone-50/50 hover:bg-white hover:border-purple-200 hover:shadow-sm transition-all flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-black text-stone-800 mb-0.5">{row.name}</p>
                  <p className="text-[11px] font-bold text-stone-400">
                    {row.total_value && row.total_value > 0 ? `${formatNumber(row.total_value)} EGP` : 'سجلات أساسية'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-white border border-stone-200 font-mono font-black text-purple-700 text-xs shadow-sm">
                  {formatNumber(row.count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Comprehensive Issues Report & Proposed Solution */}
      <AnimatePresence>
        {selectedItemIssues && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-3xl w-full shadow-2xl border border-stone-200 max-h-[85vh] flex flex-col"
              dir={dir}
            >
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-stone-900">
                      {language === 'ar' ? `تقرير الملاحظات والحل المقترح: ${selectedItemIssues.name}` : `Issues Report: ${selectedItemIssues.name}`}
                    </h3>
                    <p className="text-xs font-bold text-stone-500">
                      {language === 'ar' 
                        ? `تم حصر ${selectedItemIssues.issues.length} حركة تتطلب المعالجة` 
                        : `Found ${selectedItemIssues.issues.length} items requiring resolution`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedItemIssues(null)}
                  className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Proposed Solution Banner */}
              <div className="my-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold space-y-1">
                <div className="flex items-center gap-2 font-black text-amber-800">
                  <Wrench size={16} />
                  <span>{language === 'ar' ? 'الحل المقترح من النظام:' : 'System Proposed Solution:'}</span>
                </div>
                <p className="leading-relaxed">
                  {language === 'ar'
                    ? '1. في حال نقص حسابات الأصناف أو العملاء: اضغط على زر «إصلاح الحسابات الناقصة تلقائياً» لربطها بالحساب الافتراضي في الدليل بنقرة واحدة.'
                    : '1. For missing product/customer accounts: Click "Auto-Fix Missing Accounts" to automatically bind default chart accounts.'}
                </p>
                <p className="leading-relaxed">
                  {language === 'ar'
                    ? '2. في حال وجود حركات غير مرحلة: سيقوم النظام بترحيل القيود تلقائياً بعد استكمال الحسابات لمطابقة أرصدة الدفاتر.'
                    : '2. For unposted transactions: The system will generate journal entries once accounts are linked.'}
                </p>
              </div>

              {/* Table of issues */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead className="sticky top-0 bg-stone-100 text-stone-600 font-black">
                    <tr>
                      <th className="p-2.5">{language === 'ar' ? 'رقم المستند' : 'Doc #'}</th>
                      <th className="p-2.5">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="p-2.5">{language === 'ar' ? 'الطرف / الصنف' : 'Party / Item'}</th>
                      <th className="p-2.5 text-left">{language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                      <th className="p-2.5">{language === 'ar' ? 'نوع المشكلة' : 'Issue Type'}</th>
                      <th className="p-2.5">{language === 'ar' ? 'التفاصيل والسبب' : 'Reason / Details'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-bold text-stone-700">
                    {selectedItemIssues.issues.map((iss, idx) => (
                      <tr key={idx} className="hover:bg-stone-50">
                        <td className="p-2.5 font-mono font-black text-stone-900">{iss.document_number}</td>
                        <td className="p-2.5 font-mono text-stone-500">{iss.date || '—'}</td>
                        <td className="p-2.5 text-stone-800">{iss.party_name || '—'}</td>
                        <td className="p-2.5 font-mono text-left">{formatNumber(iss.amount)}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-black text-[10px]">
                            {iss.error_type}
                          </span>
                        </td>
                        <td className="p-2.5 text-stone-600 leading-snug">{iss.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-3 mt-4">
                <button
                  onClick={async () => {
                    await handleAutoFix();
                    setSelectedItemIssues(null);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2"
                >
                  <Wrench size={16} />
                  <span>{language === 'ar' ? 'تطبيق الحل والإصلاح فوراً' : 'Apply Fix Immediately'}</span>
                </button>

                <button
                  onClick={() => setSelectedItemIssues(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-xs"
                >
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DataCountsValues;
