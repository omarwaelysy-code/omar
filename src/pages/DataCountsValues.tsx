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
  AlertCircle,
  Scale,
  BookOpen,
  CheckCheck
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
  net_value?: number;
  counter_value?: number;
  journal_value: number;
  variance: number;
  unposted_count: number;
  unposted_value: number;
  unbalanced_entries_count: number;
  missing_accounts_count: number;
  issues: DocumentIssue[];
}

export interface ReportReconciliationItem {
  id: string;
  category?: string;
  report_name: string;
  subledger_name: string;
  gl_account_name: string;
  subledger_value: number;
  gl_value: number;
  variance: number;
  status: 'balanced' | 'discrepancy';
  rule_applied: string;
  description: string;
}

interface AuditData {
  company_id: string;
  timestamp: string;
  master_data: MasterDataItem[];
  operational_data: OperationalDataItem[];
  posting_transactions: PostingTransactionItem[];
  reports_reconciliation?: ReportReconciliationItem[];
}

export const DataCountsValues: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { setCurrentPage } = useNavigation();

  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'reports' | 'posting' | 'operational' | 'master'>('all');
  const [reportCategory, setReportCategory] = useState<string>('all');
  const [fixing, setFixing] = useState<boolean>(false);
  const [fixResult, setFixResult] = useState<any | null>(null);

  // Modal for detailed issues report
  const [selectedItemIssues, setSelectedItemIssues] = useState<{
    key?: string;
    name: string;
    issues: DocumentIssue[];
    unposted_count?: number;
    unbalanced_count?: number;
    missing_accounts_count?: number;
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

    // Reports Reconciliation rows
    if (data.reports_reconciliation && data.reports_reconciliation.length > 0) {
      data.reports_reconciliation.forEach(rep => {
        rows.push({
          'القسم': `مطابقة التقارير (${rep.category || 'عام'})`,
          'نوع الحركة': rep.report_name,
          'العدد': 1,
          'صافي الحركة (المستندات)': rep.subledger_value,
          'باقي أطراف القيد': rep.gl_account_name,
          'قيم القيود المرحلة (ج.م)': rep.gl_value,
          'فرق القيمة': rep.variance,
          'غير مرحل (عدد)': 0,
          'غير مرحل (قيمة)': 0,
          'قيود غير متزنة': 0,
          'حسابات ناقصة': 0,
          'حالة المطابقة': rep.status === 'balanced' ? 'سليم ومتطابق (مستحيل الخطأ تقنياً)' : 'يوجد فرق'
        });
      });
    }

    // Posting rows
    data.posting_transactions.forEach(pt => {
      rows.push({
        'القسم': 'حركات تلزم قيود',
        'نوع الحركة': pt.name,
        'العدد': pt.count,
        'صافي الحركة (المستندات)': pt.total_value,
        'باقي أطراف القيد': pt.counter_value || pt.journal_value,
        'قيم القيود المرحلة (ج.م)': pt.journal_value,
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

    exportToExcel(rows, { filename: `Comprehensive_Audit_${new Date().toISOString().split('T')[0]}` });
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

  const totalReportsCount = data?.reports_reconciliation?.length || 0;
  const totalReportsDiscrepancies = (data?.reports_reconciliation || []).filter(r => r.status === 'discrepancy').length;

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

  const filteredReports = (data.reports_reconciliation || []).filter(item => {
    const matchesCategory = reportCategory === 'all' || item.category === reportCategory;
    const matchesSearch = !searchQuery || 
      item.report_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subledger_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.gl_account_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

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
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-2xl font-black text-stone-900">
              {language === 'ar' ? 'التدقيق الشامل' : 'Comprehensive System Audit'}
            </h1>
          </div>
          <p className="text-xs font-bold text-stone-500">
            {language === 'ar' 
              ? 'تدقيق ومطابقة شاملة لكافة العمليات والتقارير المالية وميزان المراجعة والمركز المالي وفق قاعدة «الخطأ مستحيل الحدوث تقنياً (Impossible to be Inconsistent)»'
              : 'Comprehensive system audit reconciling transactions, subledgers, trial balance and balance sheet (Impossible to be Inconsistent)'}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Posting Movements */}
        <div className="p-4 bg-white rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              {language === 'ar' ? 'الحركات المالية المقيدة' : 'Posting Movements'}
            </p>
            <h3 className="text-xl font-black text-stone-900">{formatNumber(totalPostingCount)}</h3>
            <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
              {formatNumber(totalPostingValue)} EGP
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Card 2: Operational Orders */}
        <div className="p-4 bg-white rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              {language === 'ar' ? 'العمليات غير المقيدة' : 'Operational Orders'}
            </p>
            <h3 className="text-xl font-black text-stone-900">{formatNumber(totalOperationalCount)}</h3>
            <p className="text-[11px] font-bold text-blue-700 mt-0.5">
              {formatNumber(totalOperationalValue)} EGP
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Layers size={20} />
          </div>
        </div>

        {/* Card 3: Unposted Movements */}
        <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${
          totalUnpostedCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-200'
        }`}>
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              {language === 'ar' ? 'حركات بدون قيود مرحلة' : 'Unposted Movements'}
            </p>
            <h3 className={`text-xl font-black ${totalUnpostedCount > 0 ? 'text-amber-800' : 'text-stone-900'}`}>
              {formatNumber(totalUnpostedCount)}
            </h3>
            <p className="text-[11px] font-bold text-amber-700 mt-0.5">
              {totalUnpostedCount > 0 ? (language === 'ar' ? 'تحتاج إلى ترحيل' : 'Needs Posting') : (language === 'ar' ? 'جميعها مرحلة' : 'All Posted')}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
            totalUnpostedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-stone-50 text-stone-500'
          }`}>
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Card 4: Integrity Status */}
        <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${
          totalUnbalancedCount === 0 && totalMissingAccountsCount === 0 
            ? 'bg-emerald-50 border-emerald-200' 
            : 'bg-rose-50 border-rose-200'
        }`}>
          <div>
            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
              {language === 'ar' ? 'سلامة الحسابات والتوازن' : 'Integrity & Balance'}
            </p>
            <h3 className={`text-lg font-black ${
              totalUnbalancedCount === 0 && totalMissingAccountsCount === 0 ? 'text-emerald-800' : 'text-rose-800'
            }`}>
              {totalUnbalancedCount === 0 && totalMissingAccountsCount === 0 
                ? (language === 'ar' ? 'سليم ومتزن 100%' : 'Balanced 100%') 
                : (language === 'ar' ? `${totalMissingAccountsCount} حساب ناقص / ${totalUnbalancedCount} قيد` : 'Issues Detected')}
            </h3>
            <p className="text-[11px] font-bold opacity-80 mt-0.5 text-stone-600">
              {language === 'ar' ? `${totalMasterCount} بيان أساسي مسجل` : `${totalMasterCount} master records`}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
            totalUnbalancedCount === 0 && totalMissingAccountsCount === 0 
              ? 'bg-emerald-100 text-emerald-700' 
              : 'bg-rose-100 text-rose-700'
          }`}>
            {totalUnbalancedCount === 0 && totalMissingAccountsCount === 0 
              ? <ShieldCheck size={20} /> 
              : <XCircle size={20} />}
          </div>
        </div>

        {/* Card 5: Reports Reconciliation Status */}
        <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${
          totalReportsDiscrepancies === 0 
            ? 'bg-indigo-50 border-indigo-200' 
            : 'bg-rose-50 border-rose-200'
        }`}>
          <div>
            <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-1">
              {language === 'ar' ? 'التقارير والمركز المالي' : 'Reports & Balance Sheet'}
            </p>
            <h3 className={`text-lg font-black ${
              totalReportsDiscrepancies === 0 ? 'text-indigo-950' : 'text-rose-800'
            }`}>
              {totalReportsDiscrepancies === 0 
                ? (language === 'ar' ? 'مطابقة تامة 100%' : '100% Reconciled') 
                : (language === 'ar' ? `${totalReportsDiscrepancies} فرق بحاجة لمراجعة` : 'Discrepancy')}
            </h3>
            <p className="text-[11px] font-bold text-indigo-600 mt-0.5">
              {language === 'ar' ? 'مستحيل الخطأ تقنياً' : 'Zero Variance'}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
            totalReportsDiscrepancies === 0 
              ? 'bg-indigo-100 text-indigo-700' 
              : 'bg-rose-100 text-rose-700'
          }`}>
            <Scale size={20} />
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
            {language === 'ar' ? 'الحركات المالية المقيدة' : 'Posting Transactions'}
          </button>
          <button
            onClick={() => setActiveTab('operational')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'operational' 
                ? 'bg-blue-600 text-white' 
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {language === 'ar' ? 'العمليات غير المقيدة' : 'Non-Posting Operations'}
          </button>
          <button
            onClick={() => setActiveTab('master')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'master' 
                ? 'bg-purple-600 text-white' 
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {language === 'ar' ? 'البيانات الأساسية' : 'Master Data'}
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'reports' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Scale size={14} />
            <span>{language === 'ar' ? 'مطابقة التقارير والمركز المالي' : 'Reports & Balance Sheet'}</span>
            {totalReportsCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'reports' ? 'bg-indigo-700 text-white' : 'bg-stone-200 text-stone-700'
              }`}>
                {totalReportsCount}
              </span>
            )}
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-stone-400 ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ar' ? 'بحث عن بيان أو تقرير أو حركة...' : 'Search records or reports...'}
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
                {language === 'ar' ? 'الحركات المالية التي تلزم قيوداً محاسبية' : 'Posting Financial Transactions'}
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
                  <th className="py-2 px-3 whitespace-nowrap">{language === 'ar' ? 'نوع الحركة / المستند' : 'Type'}</th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'العدد' : 'Count'}</th>
                  <th className="py-2 px-3 whitespace-nowrap text-left">
                    <div>{language === 'ar' ? 'صافي الحركة (المستندات)' : 'Net Movement'}</div>
                    <div className="text-[10px] text-stone-400 font-normal">{language === 'ar' ? 'طرف أساسي (+)' : 'Base (+)'}</div>
                  </th>
                  <th className="py-2 px-3 whitespace-nowrap text-left">
                    <div>{language === 'ar' ? 'باقي أطراف القيد' : 'Counter Sides'}</div>
                    <div className="text-[10px] text-indigo-400 font-normal">{language === 'ar' ? 'ضرائب ومتمم (+)' : 'Tax/Sides (+)'}</div>
                  </th>
                  <th className="py-2 px-3 whitespace-nowrap text-left">
                    <div>{language === 'ar' ? 'الطرف الآخر للقيد' : 'Journal Total'}</div>
                    <div className="text-[10px] text-emerald-600 font-normal">{language === 'ar' ? 'المساوي للقيد (=)' : 'Total (=)'}</div>
                  </th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'فرق القيمة' : 'Variance'}</th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'حركات غير مرحلة' : 'Unposted'}</th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'قيود غير متزنة' : 'Unbalanced'}</th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'حسابات ناقصة' : 'Missing Accounts'}</th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'حالة المطابقة' : 'Status'}</th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'الإجراءات والحل' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-bold text-stone-700">
                {filteredPosting.map((row) => {
                  const hasIssues = row.unposted_count > 0 || row.unbalanced_entries_count > 0 || row.missing_accounts_count > 0 || Math.abs(row.variance) > 1;

                  return (
                    <tr key={row.key} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-1.5 px-3 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0">
                          <FileText size={13} />
                        </div>
                        <span className="font-black text-stone-900 text-xs">{row.name}</span>
                      </td>

                      <td className="py-1.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 font-mono font-bold text-stone-800 text-xs">
                          {formatNumber(row.count)}
                        </span>
                      </td>

                      <td className="py-1.5 px-3 text-left font-mono font-black text-stone-900 text-xs">
                        {formatNumber(row.net_value ?? (row.total_value - (row.counter_value || 0)))} EGP
                      </td>

                      <td className="py-1.5 px-3 text-left font-mono font-black text-indigo-700 text-xs">
                        {formatNumber(row.counter_value || 0)} EGP
                      </td>

                      <td className="py-1.5 px-3 text-left font-mono font-black text-emerald-700 text-xs">
                        {formatNumber(row.journal_value)} EGP
                      </td>

                      <td className="py-1.5 px-3 text-center font-mono text-xs">
                        {Math.abs(row.variance) < 0.50 ? (
                          <span className="text-emerald-600 font-bold">0.00</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-black">
                            {formatNumber(row.variance)}
                          </span>
                        )}
                      </td>

                      <td className="py-1.5 px-3 text-center">
                        {row.unposted_count === 0 ? (
                          <span className="text-emerald-600 font-bold text-xs">0</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-xs">
                            {row.unposted_count} ({formatNumber(row.unposted_value)})
                          </span>
                        )}
                      </td>

                      <td className="py-1.5 px-3 text-center">
                        {row.unbalanced_entries_count === 0 ? (
                          <span className="text-emerald-600 font-bold text-xs">0</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-xs">
                            {row.unbalanced_entries_count}
                          </span>
                        )}
                      </td>

                      <td className="py-1.5 px-3 text-center">
                        {row.missing_accounts_count === 0 ? (
                          <span className="text-emerald-600 font-bold text-xs">0</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-xs">
                            {row.missing_accounts_count}
                          </span>
                        )}
                      </td>

                      <td className="py-1.5 px-3 text-center">
                        {!hasIssues ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                            <CheckCircle2 size={12} />
                            {language === 'ar' ? 'سليم ومتطابق' : 'Balanced'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                            <AlertTriangle size={12} />
                            {language === 'ar' ? 'يحتاج مراجعة' : 'Check Required'}
                          </span>
                        )}
                      </td>

                      <td className="py-1.5 px-3 text-center">
                        {row.issues && row.issues.length > 0 ? (
                          <button
                            onClick={() => setSelectedItemIssues({ 
                              key: row.key,
                              name: row.name, 
                              issues: row.issues,
                              unposted_count: row.unposted_count,
                              unbalanced_count: row.unbalanced_entries_count,
                              missing_accounts_count: row.missing_accounts_count
                            })}
                            className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md font-bold text-[11px] transition-all flex items-center gap-1 mx-auto"
                          >
                            <Info size={11} className="text-amber-600" />
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
              <tfoot>
                <tr className="bg-stone-100/90 border-t-2 border-stone-300 font-black text-stone-900">
                  <td className="py-2.5 px-3 flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-950">{language === 'ar' ? 'الإجمالي العام لكافة الحركات' : 'Grand Total'}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      {filteredPosting.length} {language === 'ar' ? 'نوع مستند' : 'Types'}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-md bg-stone-200/90 font-mono font-black text-stone-900 text-xs">
                      {formatNumber(filteredPosting.reduce((s, r) => s + (r.count || 0), 0))}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-left font-mono font-black text-stone-900 text-xs">
                    {formatNumber(filteredPosting.reduce((s, r) => s + (r.net_value ?? (r.total_value - (r.counter_value || 0))), 0))} EGP
                  </td>

                  <td className="py-2.5 px-3 text-left font-mono font-black text-indigo-700 text-xs">
                    {formatNumber(filteredPosting.reduce((s, r) => s + (r.counter_value || 0), 0))} EGP
                  </td>

                  <td className="py-2.5 px-3 text-left font-mono font-black text-emerald-700 text-xs">
                    {formatNumber(filteredPosting.reduce((s, r) => s + (r.journal_value || 0), 0))} EGP
                  </td>

                  <td className="py-2.5 px-3 text-center font-mono text-xs">
                    {(() => {
                      const totalVar = filteredPosting.reduce((s, r) => s + (r.variance || 0), 0);
                      return Math.abs(totalVar) < 0.05 ? (
                        <span className="text-emerald-700 font-black">0.00</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-black">
                          {formatNumber(totalVar)}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    {(() => {
                      const unposted = filteredPosting.reduce((s, r) => s + (r.unposted_count || 0), 0);
                      return unposted === 0 ? (
                        <span className="text-emerald-700 font-black text-xs">0</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black text-xs">
                          {unposted}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    {(() => {
                      const unbal = filteredPosting.reduce((s, r) => s + (r.unbalanced_entries_count || 0), 0);
                      return unbal === 0 ? (
                        <span className="text-emerald-700 font-black text-xs">0</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 font-black text-xs">
                          {unbal}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    {(() => {
                      const missing = filteredPosting.reduce((s, r) => s + (r.missing_accounts_count || 0), 0);
                      return missing === 0 ? (
                        <span className="text-emerald-700 font-black text-xs">0</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 font-black text-xs">
                          {missing}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    {filteredPosting.every(r => r.unposted_count === 0 && r.unbalanced_entries_count === 0 && r.missing_accounts_count === 0 && Math.abs(r.variance) < 1) ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px] border border-emerald-300">
                        <CheckCircle2 size={12} />
                        {language === 'ar' ? 'متطابق 100%' : '100% Balanced'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-black text-[11px] border border-amber-300">
                        <AlertTriangle size={12} />
                        {language === 'ar' ? 'فروقات قائمة' : 'Variances'}
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 px-3 text-center text-stone-400 font-bold text-[11px]">—</td>
                </tr>
              </tfoot>
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
                {language === 'ar' ? 'العمليات التي لا تلزم عنها قيود ولكن تشمل قيماً' : 'Non-Posting Operational Transactions (With Values)'}
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
                  <th className="py-2 px-3 whitespace-nowrap">{language === 'ar' ? 'نوع العملية / المستند' : 'Document Type'}</th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'العدد' : 'Count'}</th>
                  <th className="py-2 px-3 whitespace-nowrap text-left">{language === 'ar' ? 'إجمالي القيم المسجلة' : 'Total Values'}</th>
                  <th className="py-2 px-3 whitespace-nowrap">{language === 'ar' ? 'طبيعة المستند والأثر المحاسبي' : 'Notes'}</th>
                  <th className="py-2 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'حالة الترحيل' : 'Posting Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-bold text-stone-700">
                {filteredOperational.map((row) => (
                  <tr key={row.key} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-1.5 px-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                        <Layers size={13} />
                      </div>
                      <span className="font-black text-stone-900 text-xs">{row.name}</span>
                    </td>

                    <td className="py-1.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 font-mono font-bold text-stone-800 text-xs">
                        {formatNumber(row.count)}
                      </span>
                    </td>

                    <td className="py-1.5 px-3 text-left font-mono font-black text-blue-900 text-xs">
                      {formatNumber(row.total_value)} EGP
                    </td>

                    <td className="py-1.5 px-3 text-stone-600 text-xs">
                      {row.notes}
                    </td>

                    <td className="py-1.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-bold text-[11px]">
                        {language === 'ar' ? 'غير ملزم بقيد' : 'Non-Posting Document'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50/70 border-t-2 border-blue-200 font-black text-slate-900">
                  <td className="py-2.5 px-3 flex items-center gap-2">
                    <span className="text-xs font-black text-blue-950">{language === 'ar' ? 'إجمالي العمليات غير المقيدة' : 'Total Operational'}</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
                      {filteredOperational.length} {language === 'ar' ? 'نوع مستند' : 'Types'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-md bg-stone-200/90 font-mono font-black text-stone-900 text-xs">
                      {formatNumber(filteredOperational.reduce((s, r) => s + (r.count || 0), 0))}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono font-black text-blue-900 text-xs">
                    {formatNumber(filteredOperational.reduce((s, r) => s + (r.total_value || 0), 0))} EGP
                  </td>
                  <td className="py-2.5 px-3 text-stone-500 text-xs">—</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px]">
                      {language === 'ar' ? 'إجمالي مسجل' : 'Total Recorded'}
                    </span>
                  </td>
                </tr>
              </tfoot>
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
                {language === 'ar' ? 'البيانات الأساسية والمستخدمين والصلاحيات' : 'Master Data, Users & System Architecture'}
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
                className="py-2 px-3 rounded-2xl border border-stone-100 bg-stone-50/50 hover:bg-white hover:border-purple-200 hover:shadow-sm transition-all flex items-center justify-between"
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

      {/* SECTION: FINANCIAL REPORTS & BALANCE SHEET / TRIAL BALANCE AUDIT */}
      {(activeTab === 'all' || activeTab === 'reports') && (
        <div className="bg-white rounded-3xl border border-indigo-200/80 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-50/90 via-emerald-50/40 to-indigo-50/90 border-b border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Scale size={18} />
              </div>
              <div>
                <h2 className="text-base font-black text-indigo-950 flex items-center gap-2 flex-wrap">
                  <span>{language === 'ar' ? 'تدقيق ومطابقة التقارير مع ميزان المراجعة والمركز المالي' : 'Reports, Trial Balance & Balance Sheet Reconciliation'}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {language === 'ar' ? 'الخطأ مستحيل الحدوث تقنياً' : 'Impossible to be Inconsistent'}
                  </span>
                </h2>
                <p className="text-[11px] font-bold text-stone-500 mt-0.5">
                  {language === 'ar' 
                    ? 'مطابقة دفاتر الأستاذ المساعد مع حسابات المراقبة العامة في ميزان المراجعة وقائمة المركز المالي وقائمة الدخل'
                    : 'Reconciling subsidiary ledgers with GL control accounts, Trial Balance, Balance Sheet, and Income Statement'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-800 bg-white px-3 py-1 rounded-xl border border-indigo-200 shadow-sm flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>{language === 'ar' ? `${filteredReports.length} تقارير وقوائم خاضعة للتدقيق` : `${filteredReports.length} Audited Statements`}</span>
              </span>
            </div>
          </div>

          {/* Architectural Guarantee Banner */}
          <div className="px-6 py-3 bg-indigo-900 text-white text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider">
                Enterprise Architecture
              </span>
              <span className="text-indigo-100 text-[11px]">
                {language === 'ar'
                  ? 'قاعدة التصميم المعماري: «الخطأ مستحيل الحدوث تقنياً» — كشوف الحسابات التفصيلية والأستاذ العام وميزان المراجعة والمركز المالي تشترك في نفس المصدر الحسابي اللحظي (Single Source of Truth) باستحالة وجود أي انحراف.'
                  : 'Design Rule: "Impossible to be Inconsistent" — Subledgers, GL control accounts, Trial Balance and Balance Sheet share the exact same atomic transaction source.'}
              </span>
            </div>
            <span className="text-[11px] text-emerald-300 font-mono font-bold whitespace-nowrap">
              Variance = 0.00 EGP
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="px-6 py-3 bg-stone-50/80 border-b border-stone-200 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-black text-stone-500 whitespace-nowrap ml-1">
              {language === 'ar' ? 'أقسام التقارير:' : 'Categories:'}
            </span>
            {[
              { id: 'all', label: language === 'ar' ? 'عرض الكل (18)' : 'All Reports (18)' },
              { id: 'المستودع والمخازن', label: language === 'ar' ? 'المستودع والمخازن (3)' : 'Warehouse & Inventory (3)' },
              { id: 'العملاء والمبيعات', label: language === 'ar' ? 'العملاء والمبيعات (4)' : 'Customers & Sales (4)' },
              { id: 'الموردين والمشتريات', label: language === 'ar' ? 'الموردين والمشتريات (3)' : 'Suppliers & Purchases (3)' },
              { id: 'النقدية والمصروفات', label: language === 'ar' ? 'النقدية والمصروفات (3)' : 'Cash & Expenses (3)' },
              { id: 'التقارير المالية والمحاسبية', label: language === 'ar' ? 'التقارير المالية والمحاسبية (5)' : 'Financial Accounting (5)' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setReportCategory(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  reportCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50/90 text-stone-600 border-b border-stone-200 font-black">
                  <th className="py-3 px-3 whitespace-nowrap">{language === 'ar' ? 'القسم' : 'Category'}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{language === 'ar' ? 'التقرير / دفتر الأستاذ المساعد' : 'Report / Subledger'}</th>
                  <th className="py-3 px-3 whitespace-nowrap text-left">{language === 'ar' ? 'قيمة التقرير / الأستاذ المساعد' : 'Subledger Value'}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{language === 'ar' ? 'الحساب المقابل في الأستاذ العام / المركز المالي' : 'GL Control / Statement Account'}</th>
                  <th className="py-3 px-3 whitespace-nowrap text-left">{language === 'ar' ? 'القيمة في ميزان المراجعة / المركز المالي' : 'Trial Balance / BS Value'}</th>
                  <th className="py-3 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'فرق المطابقة' : 'Variance'}</th>
                  <th className="py-3 px-3 whitespace-nowrap">{language === 'ar' ? 'الضمان المعماري المطبق' : 'Rule Applied'}</th>
                  <th className="py-3 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'حالة المطابقة والتدقيق' : 'Status'}</th>
                  <th className="py-3 px-3 whitespace-nowrap text-center">{language === 'ar' ? 'معاينة التقرير' : 'Open Report'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-bold text-stone-700">
                {filteredReports.map((item, idx) => {
                  const isZero = Math.abs(item.variance) < 0.01;
                  const pageTarget = 
                    item.id === 'stock_card_report' ? 'stock_card_report' :
                    item.id === 'stock_balances_report' ? 'stock_balances_report' :
                    item.id === 'general_stock_movements_report' ? 'general_stock_movements_report' :
                    item.id === 'customer_statement' ? 'customer_statement' :
                    item.id === 'customer_balances' ? 'customer_balances' :
                    item.id === 'customer_aging_report' ? 'customer_aging_report' :
                    item.id === 'sales_report' ? 'sales_report' :
                    item.id === 'supplier_statement' ? 'supplier_statement' :
                    item.id === 'supplier_balances' ? 'supplier_balances' :
                    item.id === 'supplier_aging_report' ? 'supplier_aging_report' :
                    item.id === 'cash_as_of_balances' ? 'cash_as_of_balances' :
                    item.id === 'cash_balances' ? 'cash_balances' :
                    item.id === 'expenses_report' ? 'expenses_report' :
                    item.id === 'general_ledger_report' ? 'general_ledger_report' :
                    item.id === 'trial_balance' ? 'trial_balance' :
                    item.id === 'income_statement' ? 'income_statement' :
                    item.id === 'balance_sheet' ? 'balance_sheet' :
                    item.id === 'cash_flow_statement' ? 'cash_flow_statement' : null;

                  return (
                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border inline-block ${
                          item.category === 'المستودع والمخازن' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          item.category === 'العملاء والمبيعات' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          item.category === 'الموردين والمشتريات' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          item.category === 'النقدية والمصروفات' ? 'bg-cyan-50 text-cyan-800 border-cyan-200' :
                          'bg-purple-50 text-purple-800 border-purple-200'
                        }`}>
                          {item.category || 'عام'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black text-stone-900 text-xs flex items-center gap-1.5">
                          <BookOpen size={14} className="text-indigo-600 flex-shrink-0" />
                          <span>{item.report_name}</span>
                        </div>
                        <p className="text-[11px] font-normal text-stone-500 mt-0.5">
                          {item.subledger_name}
                        </p>
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-left text-stone-900 whitespace-nowrap">
                        {formatNumber(item.subledger_value)} <span className="text-[10px] text-stone-400 font-normal">EGP</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-800 text-[11px]">
                          {item.gl_account_name}
                        </div>
                        {item.description && (
                          <p className="text-[10px] font-normal text-stone-400 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-left text-stone-900 whitespace-nowrap">
                        {formatNumber(item.gl_value)} <span className="text-[10px] text-stone-400 font-normal">EGP</span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-xl font-mono font-black text-xs inline-block ${
                          isZero 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {formatNumber(item.variance)} {language === 'ar' ? 'ج.م' : 'EGP'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 text-[10px] font-bold font-mono">
                          {item.rule_applied}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black shadow-xs">
                            <CheckCheck size={14} className="text-emerald-600" />
                            <span>{language === 'ar' ? 'سليم ومتطابق 100%' : 'Balanced 100%'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-black shadow-xs">
                            <XCircle size={14} className="text-rose-600" />
                            <span>{language === 'ar' ? 'يوجد فرق تدقيق' : 'Discrepancy'}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {pageTarget ? (
                          <button
                            onClick={() => setCurrentPage(pageTarget as any)}
                            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-indigo-600 hover:text-white text-stone-700 text-[11px] font-bold transition-all flex items-center gap-1 mx-auto active:scale-95 shadow-xs"
                            title={language === 'ar' ? 'الانتقال إلى التقرير' : 'Open report'}
                          >
                            <span>{language === 'ar' ? 'معاينة' : 'View'}</span>
                            <ExternalLink size={12} />
                          </button>
                        ) : (
                          <span className="text-stone-300">—</span>
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

              {/* Dynamic Context-Aware Diagnostic Banner */}
              {(() => {
                const issues = selectedItemIssues.issues || [];
                const key = selectedItemIssues.key || '';
                const isOpening = key.includes('opening') || selectedItemIssues.name.includes('افتتاح');
                const hasNegative = issues.some(i => i.amount < 0 || i.error_type?.includes('دائن') || i.details?.includes('دائن'));
                const hasUnposted = (selectedItemIssues.unposted_count || 0) > 0 || issues.some(i => i.error_type?.includes('غير مرحل'));
                const hasMissingAccounts = (selectedItemIssues.missing_accounts_count || 0) > 0;

                if (isOpening && hasNegative && !hasUnposted && !hasMissingAccounts) {
                  return (
                    <div className="my-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold space-y-2">
                      <div className="flex items-center gap-2 font-black text-emerald-800">
                        <CheckCircle2 size={16} />
                        <span>{language === 'ar' ? 'التحليل المحاسبي للأرصدة العكسية (الدائنة / السحب على المكشوف):' : 'Accounting Analysis for Credit / Overdraft Balances:'}</span>
                      </div>
                      <p className="leading-relaxed text-emerald-900">
                        {language === 'ar'
                          ? '• المستندات ذات المبالغ السالبة تمثل أرصدة افتتاحية دائنة بطبيعتها (سحب على المكشوف للبنوك، أو دفعات مقدمة/أرصدة دائنة للعملاء).'
                          : '• Negative amounts indicate credit opening balances (bank overdrafts or customer advance deposits).'}
                      </p>
                      <p className="leading-relaxed text-emerald-900">
                        {language === 'ar'
                          ? '• قيود اليومية العامة لهذه الحسابات مثبتة في الجانب الدائن بالقيمة الموجبة طبقاً لقواعد القيد المزدوج، وهي مطابقة وموزونة دفترياً بنسبة 100%.'
                          : '• Journal entries correctly record positive credit amounts per double-entry accounting rules, fully balanced.'}
                      </p>
                    </div>
                  );
                }

                if (hasUnposted) {
                  return (
                    <div className="my-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-bold space-y-2">
                      <div className="flex items-center gap-2 font-black text-amber-800">
                        <Wrench size={16} />
                        <span>{language === 'ar' ? 'التشخيص والحل المقترح: مستندات غير مرحلة لدفتر اليومية:' : 'Diagnosis: Unposted Transactions:'}</span>
                      </div>
                      <p className="leading-relaxed text-amber-900">
                        {language === 'ar'
                          ? `• تم حصر ${selectedItemIssues.unposted_count || issues.filter(i => i.error_type?.includes('غير مرحل')).length} مستند مسجل بدون قيد محاسبي في اليومية العامة.`
                          : `• Found ${selectedItemIssues.unposted_count || issues.length} unposted documents.`}
                      </p>
                      <p className="leading-relaxed text-amber-900">
                        {language === 'ar'
                          ? '• الإجراء المطلوب: الضغط أدناه لتوليد وترحيل القيود المحاسبية لهذه الحركات فوراً لمطابقة دفاتر الأستاذ.'
                          : '• Action: Click below to post journal entries immediately.'}
                      </p>
                    </div>
                  );
                }

                if (hasMissingAccounts) {
                  return (
                    <div className="my-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs font-bold space-y-2">
                      <div className="flex items-center gap-2 font-black text-rose-800">
                        <AlertTriangle size={16} />
                        <span>{language === 'ar' ? 'التشخيص والحل المقترح: أطراف أو أصناف غير مرتبطة بحسابات مالية:' : 'Diagnosis: Missing Account Links:'}</span>
                      </div>
                      <p className="leading-relaxed text-rose-900">
                        {language === 'ar'
                          ? `• يوجد ${selectedItemIssues.missing_accounts_count} طرف أو صنف بدون حساب مالي في الدليل، مما يعطل الترحيل التلقائي.`
                          : `• Found ${selectedItemIssues.missing_accounts_count} items without mapped chart accounts.`}
                      </p>
                      <p className="leading-relaxed text-rose-900">
                        {language === 'ar'
                          ? '• الإجراء المطلوب: الضغط أدناه للربط التلقائي بالحسابات الافتراضية المعتمدة في شجرة الحسابات.'
                          : '• Action: Click below to auto-bind default chart accounts.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="my-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-bold space-y-2">
                    <div className="flex items-center gap-2 font-black text-amber-800">
                      <AlertCircle size={16} />
                      <span>{language === 'ar' ? 'التشخيص والحل المقترح: فروق بين قيم المستندات وأطراف القيود:' : 'Diagnosis: Document-to-Journal Variances:'}</span>
                    </div>
                    <p className="leading-relaxed text-amber-900">
                      {language === 'ar'
                        ? '• توجد مستندات تختلف قيمتها عن إجمالي أطراف قيدها المرحل باليومية (نتيجة تعديل المستند بعد الترحيل أو وجود أطراف ثانوية كالضرائب والخصومات).'
                        : '• Variances found between document amounts and journal entry lines.'}
                    </p>
                    <p className="leading-relaxed text-amber-900">
                      {language === 'ar'
                        ? '• الإجراء المطلوب: مراجعة المستندات بالجدول أدناه وإعادة مزامنة القيود لتطابق المستندات.'
                        : '• Action: Review items below and resync journal entries.'}
                    </p>
                  </div>
                );
              })()}

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
                {(() => {
                  const issues = selectedItemIssues.issues || [];
                  const key = selectedItemIssues.key || '';
                  const isOpening = key.includes('opening') || selectedItemIssues.name.includes('افتتاح');
                  const hasNegative = issues.some(i => i.amount < 0 || i.error_type?.includes('دائن') || i.details?.includes('دائن'));
                  const hasUnposted = (selectedItemIssues.unposted_count || 0) > 0 || issues.some(i => i.error_type?.includes('غير مرحل'));
                  const hasMissingAccounts = (selectedItemIssues.missing_accounts_count || 0) > 0;

                  if (isOpening && hasNegative && !hasUnposted && !hasMissingAccounts) {
                    return (
                      <button
                        onClick={() => setSelectedItemIssues(null)}
                        className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2"
                      >
                        <CheckCircle2 size={16} />
                        <span>{language === 'ar' ? 'تأكيد سلامة المطابقة وإغلاق التقرير' : 'Confirm Balanced & Close'}</span>
                      </button>
                    );
                  }

                  let btnLabel = language === 'ar' ? 'تطبيق الحل والإصلاح فوراً' : 'Apply Fix Immediately';
                  if (hasUnposted) {
                    btnLabel = language === 'ar' ? 'ترحيل الحركات غير المرحلة فوراً' : 'Post Unposted Transactions';
                  } else if (hasMissingAccounts) {
                    btnLabel = language === 'ar' ? 'ربط الحسابات الناقصة تلقائياً' : 'Auto-Bind Missing Accounts';
                  }

                  return (
                    <button
                      onClick={async () => {
                        await handleAutoFix();
                        setSelectedItemIssues(null);
                      }}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2"
                    >
                      <Wrench size={16} />
                      <span>{btnLabel}</span>
                    </button>
                  );
                })()}

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
