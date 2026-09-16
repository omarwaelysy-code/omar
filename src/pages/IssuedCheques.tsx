import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Filter, RefreshCw, Eye, Edit3, Trash2, CheckCircle2, 
  Clock, RotateCcw, Ban, Paperclip, Printer, FileSpreadsheet, ChevronLeft, 
  ChevronRight, Calendar, Building2, User, DollarSign, LayoutDashboard, 
  ListOrdered, BarChart3, AlertCircle, Check 
} from 'lucide-react';
import { IssuedCheque, Supplier, PaymentMethod, IssuedChequeStats, Account } from '../types';
import { dbService } from '../services/dbService';
import { issuedChequeService } from '../services/issuedChequeService';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ChequeFormModal } from '../components/issued-cheques/ChequeFormModal';
import { ChequeDetailsModal } from '../components/issued-cheques/ChequeDetailsModal';
import { ChequePaymentModal } from '../components/issued-cheques/ChequePaymentModal';
import { ChequePostponeModal } from '../components/issued-cheques/ChequePostponeModal';
import { ChequeReturnModal } from '../components/issued-cheques/ChequeReturnModal';
import { ChequeCancelModal } from '../components/issued-cheques/ChequeCancelModal';
import { ChequesDashboardTab } from '../components/issued-cheques/ChequesDashboardTab';
import { ChequesReportsTab } from '../components/issued-cheques/ChequesReportsTab';

export const IssuedCheques: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'all' | 'create' | 'due' | 'reports'>('dashboard');

  // Data States
  const [cheques, setCheques] = useState<IssuedCheque[]>([]);
  const [stats, setStats] = useState<IssuedChequeStats | null>(null);
  const [upcomingCheques, setUpcomingCheques] = useState<IssuedCheque[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [duePeriodFilter, setDuePeriodFilter] = useState<'all' | 'today' | '7days' | '30days' | 'overdue'>('all');

  // Modals & Forms
  const [selectedChequeForEdit, setSelectedChequeForEdit] = useState<IssuedCheque | null>(null);
  const [selectedChequeForDetails, setSelectedChequeForDetails] = useState<IssuedCheque | null>(null);
  const [selectedChequeForPay, setSelectedChequeForPay] = useState<IssuedCheque | null>(null);
  const [selectedChequeForPostpone, setSelectedChequeForPostpone] = useState<IssuedCheque | null>(null);
  const [selectedChequeForReturn, setSelectedChequeForReturn] = useState<IssuedCheque | null>(null);
  const [selectedChequeForCancel, setSelectedChequeForCancel] = useState<IssuedCheque | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [chequesData, statsData, upcomingData, suppData, pmData, accData] = await Promise.all([
        issuedChequeService.list(),
        issuedChequeService.getDashboardStats().catch(() => null),
        issuedChequeService.getUpcomingCheques().catch(() => []),
        dbService.list<Supplier>('suppliers'),
        dbService.list<PaymentMethod>('payment_methods'),
        dbService.list<Account>('accounts')
      ]);

      setCheques(chequesData || []);
      setStats(statsData);
      setUpcomingCheques(upcomingData || []);
      setSuppliers(suppData || []);
      setPaymentMethods(pmData || []);
      setAccounts(accData || []);
    } catch (err: any) {
      console.error('Error loading issued cheques data:', err);
      showError(err.message || (isAr ? 'فشل في تحميل بيانات الشيكات الصادرة' : 'Failed to load issued cheques data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen to db-refresh events
    const handleDbRefresh = (e: any) => {
      if (e.detail?.collection === 'issued_cheques') {
        fetchData();
      }
    };
    window.addEventListener('db-refresh', handleDbRefresh);
    return () => window.removeEventListener('db-refresh', handleDbRefresh);
  }, []);

  // Filtered Cheques for All & Due tabs
  const filteredCheques = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const date7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const date30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return cheques.filter(c => {
      // If Due tab is selected, only show un-paid, un-cancelled cheques
      if (activeTab === 'due' && !['ISSUED', 'POSTPONED'].includes(c.status)) {
        return false;
      }

      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNum = c.cheque_number?.toLowerCase().includes(term);
        const matchSupp = c.supplier_name?.toLowerCase().includes(term) || c.payee_name?.toLowerCase().includes(term);
        const matchBank = c.bank_name?.toLowerCase().includes(term);
        const matchNotes = c.description?.toLowerCase().includes(term);
        if (!matchNum && !matchSupp && !matchBank && !matchNotes) return false;
      }

      // Supplier
      if (supplierFilter && c.supplier_id !== supplierFilter) return false;

      // Bank
      if (bankFilter && c.bank_account_id !== bankFilter) return false;

      // Status
      if (statusFilter && c.status !== statusFilter) return false;

      // Due Period
      if (c.due_date) {
        const dueStr = String(c.due_date).slice(0, 10);
        if (duePeriodFilter === 'today' && dueStr !== todayStr) return false;
        if (duePeriodFilter === '7days' && (dueStr < todayStr || dueStr > date7Days)) return false;
        if (duePeriodFilter === '30days' && (dueStr < todayStr || dueStr > date30Days)) return false;
        if (duePeriodFilter === 'overdue' && dueStr >= todayStr) return false;
      }

      return true;
    });
  }, [cheques, activeTab, searchTerm, supplierFilter, bankFilter, statusFilter, duePeriodFilter]);

  // Paginated records
  const paginatedCheques = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCheques.slice(start, start + itemsPerPage);
  }, [filteredCheques, currentPage]);

  const totalPages = Math.ceil(filteredCheques.length / itemsPerPage) || 1;

  const handleDeleteCheque = async (cheque: IssuedCheque) => {
    if (cheque.status !== 'DRAFT') {
      showError(isAr ? 'لا يمكن حذف هذا الشيك لأنه تم إصداره مسبقاً. يمكنك إلغاء الشيك بدلاً من ذلك.' : 'Cannot delete this cheque because it was already issued. You can cancel it instead.');
      return;
    }
    if (!window.confirm(isAr ? `هل أنت متأكد من حذف مسودة الشيك رقم (${cheque.cheque_number})؟` : `Are you sure you want to delete cheque draft #${cheque.cheque_number}?`)) return;

    try {
      await issuedChequeService.delete(cheque.id);
      showSuccess(isAr ? 'تم حذف مسودة الشيك بنجاح.' : 'Cheque draft deleted successfully.');
      fetchData();
    } catch (err: any) {
      showError(err.message || (isAr ? 'فشل في حذف الشيك.' : 'Failed to delete cheque.'));
    }
  };

  const handlePrintCheque = (cheque: IssuedCheque) => {
    window.print();
  };

  const formatMoney = (val?: number) => {
    return Number(val || 0).toLocaleString(isAr ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const currencyLabel = isAr ? 'ج.م' : 'EGP';

  const getStatusBadge = (status: string, dueDateStr?: string) => {
    const isOverdue = dueDateStr && new Date(dueDateStr) < new Date() && ['ISSUED', 'POSTPONED'].includes(status);

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <Clock className="w-3 h-3" />
          {isAr ? 'متأخر الصرف' : 'Overdue'}
        </span>
      );
    }

    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {isAr ? 'مسودة' : 'Draft'}
          </span>
        );
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="w-3 h-3" />
            {isAr ? 'صادر (برسم الدفع)' : 'Issued (Under Payment)'}
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            {isAr ? 'مدفوع ومصروف' : 'Paid / Cleared'}
          </span>
        );
      case 'POSTPONED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            {isAr ? 'مؤجل' : 'Postponed'}
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <RotateCcw className="w-3 h-3" />
            {isAr ? 'مرتد' : 'Returned'}
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            <Ban className="w-3 h-3" />
            {isAr ? 'ملغى' : 'Cancelled'}
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-5 space-y-3.5 max-w-[1600px] mx-auto min-h-screen" dir={dir}>
      
      {/* Top Header Bar - Compact */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center text-xl shadow-md shadow-emerald-500/20">
              🏦
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'إدارة الشيكات' : 'Cheques Management'}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAr 
                  ? 'إصدار، متابعة، تسوية، وتوثيق استحقاقات الشيكات البنكية للموردين والجهات الدائنة' 
                  : 'Issue, track, settle, and document bank cheque obligations for suppliers and creditors'}
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Button (hidden on dashboard to avoid duplicate button) */}
        {activeTab !== 'dashboard' && (
          <button
            onClick={() => {
              setSelectedChequeForEdit(null);
              setActiveTab('create');
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'تحرير شيك جديد' : 'Issue New Cheque'}</span>
          </button>
        )}
      </div>

      {/* Main Navigation Tabs - Compact */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 w-fit overflow-x-auto max-w-full">
        <button
          onClick={() => { setActiveTab('dashboard'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>{isAr ? 'لوحة التحكم' : 'Dashboard'}</span>
        </button>

        <button
          onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>{isAr ? `كل الشيكات (${cheques.length})` : `All Cheques (${cheques.length})`}</span>
        </button>

        <button
          onClick={() => { setActiveTab('create'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'create'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>
            {selectedChequeForEdit 
              ? (isAr ? 'تعديل مسودة الشيك' : 'Edit Cheque Draft') 
              : (isAr ? 'تحرير شيك صادر' : 'Issue Cheque')}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab('due'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'due'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{isAr ? 'الشيكات المستحقة واجبة الصرف' : 'Due & Payable Cheques'}</span>
        </button>

        <button
          onClick={() => { setActiveTab('reports'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>{isAr ? 'التقارير المالية والتحليلية' : 'Financial & Analytical Reports'}</span>
        </button>
      </div>

      {/* Tab 1: Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <ChequesDashboardTab
          stats={stats}
          upcomingCheques={upcomingCheques}
          loading={loading}
          onRefresh={fetchData}
          onCreateNew={() => { setSelectedChequeForEdit(null); setActiveTab('create'); }}
          onViewCheque={cheque => setSelectedChequeForDetails(cheque)}
          onPayCheque={cheque => setSelectedChequeForPay(cheque)}
        />
      )}

      {/* In-Page Form Tab: تحرير وإضافة شيك صادر في صلب الصفحة */}
      {activeTab === 'create' && (
        <ChequeFormModal
          isOpen={true}
          inline={true}
          onClose={() => { setActiveTab('all'); setSelectedChequeForEdit(null); }}
          onSuccess={() => { fetchData(); setActiveTab('all'); setSelectedChequeForEdit(null); }}
          chequeToEdit={selectedChequeForEdit}
          suppliers={suppliers}
          paymentMethods={paymentMethods}
          accounts={accounts}
        />
      )}

      {/* Tab 2 & 3: All Cheques & Due Cheques Tables */}
      {(activeTab === 'all' || activeTab === 'due') && (
        <div className="space-y-3">
          
          {/* Filters Strip - Compact */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-2">
            
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className={`w-3.5 h-3.5 absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} />
              <input
                type="text"
                placeholder={isAr ? "البحث برقم الشيك، اسم المورد، الحساب البنكي، أو البيان..." : "Search by cheque #, supplier, bank account, or memo..."}
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className={`w-full ${isAr ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
              />
            </div>

            {/* Supplier Filter */}
            <select
              value={supplierFilter}
              onChange={e => { setSupplierFilter(e.target.value); setCurrentPage(1); }}
              className="w-full md:w-44 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">{isAr ? 'كل الموردين' : 'All Suppliers'}</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Bank Filter */}
            <select
              value={bankFilter}
              onChange={e => { setBankFilter(e.target.value); setCurrentPage(1); }}
              className="w-full md:w-44 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">{isAr ? 'كل البنوك' : 'All Banks'}</option>
              {paymentMethods.filter(p => p.type === 'bank' || p.bank_name).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Status Filter (Only in All tab) */}
            {activeTab === 'all' && (
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full md:w-36 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
                <option value="DRAFT">{isAr ? 'مسودة' : 'Draft'}</option>
                <option value="ISSUED">{isAr ? 'صادر' : 'Issued'}</option>
                <option value="PAID">{isAr ? 'مدفوع ومصروف' : 'Paid / Cleared'}</option>
                <option value="POSTPONED">{isAr ? 'مؤجل' : 'Postponed'}</option>
                <option value="RETURNED">{isAr ? 'مرتد' : 'Returned'}</option>
                <option value="CANCELLED">{isAr ? 'ملغى' : 'Cancelled'}</option>
              </select>
            )}

            {/* Due Period Filter */}
            <select
              value={duePeriodFilter}
              onChange={e => { setDuePeriodFilter(e.target.value as any); setCurrentPage(1); }}
              className="w-full md:w-36 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="all">{isAr ? 'كل المواعيد' : 'All Due Dates'}</option>
              <option value="today">{isAr ? 'مستحق اليوم' : 'Due Today'}</option>
              <option value="7days">{isAr ? 'خلال 7 أيام' : 'Within 7 Days'}</option>
              <option value="30days">{isAr ? 'خلال 30 يوم' : 'Within 30 Days'}</option>
              <option value="overdue">{isAr ? 'متأخر الصرف' : 'Overdue'}</option>
            </select>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isAr ? 'تحديث' : 'Refresh'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Cheques Table - Compact Cells & Padding */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            {paginatedCheques.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <AlertCircle className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'لم يتم العثور على أي شيكات مطابقة' : 'No matching cheques found'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isAr ? 'جرب تغيير معايير البحث أو إضافة شيك صادر جديد' : 'Try adjusting search filters or issue a new cheque'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className={`w-full ${isAr ? 'text-right' : 'text-left'} text-xs`}>
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-[11px]">{isAr ? 'رقم الشيك' : 'Cheque #'}</th>
                      <th className="px-3 py-2 text-[11px]">{isAr ? 'المورد المستفيد' : 'Beneficiary / Supplier'}</th>
                      <th className="px-3 py-2 text-[11px]">{isAr ? 'الحساب الدائن' : 'Credit Account'}</th>
                      <th className="px-3 py-2 text-[11px]">{isAr ? 'الحساب البنكي' : 'Bank Account'}</th>
                      <th className="px-3 py-2 text-[11px]">{isAr ? 'المبلغ' : 'Amount'}</th>
                      <th className="px-3 py-2 text-[11px]">{isAr ? 'تاريخ التحرير' : 'Issue Date'}</th>
                      <th className="px-3 py-2 text-[11px]">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                      <th className="px-3 py-2 text-[11px]">{isAr ? 'الحالة' : 'Status'}</th>
                      <th className="px-3 py-2 text-[11px] text-center">{isAr ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedCheques.map(cheque => (
                      <tr key={cheque.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                          <button
                            onClick={() => setSelectedChequeForDetails(cheque)}
                            className="hover:text-emerald-600 transition-colors cursor-pointer"
                          >
                            {cheque.cheque_number}
                          </button>
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                          {cheque.supplier_name || cheque.payee_name || '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">
                          {cheque.credit_account_name || (isAr ? 'أوراق دفع' : 'Notes Payable')}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {cheque.bank_name || '-'}
                        </td>
                        <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">
                          <div>
                            <span>{formatMoney(cheque.amount)} {cheque.currency || currencyLabel}</span>
                            {cheque.currency && cheque.currency !== 'EGP' && (
                              <span className="block text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                                ({formatMoney(Number(cheque.amount) * (Number(cheque.exchange_rate) || 1))} {currencyLabel})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">
                          {String(cheque.issue_date).slice(0, 10)}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {String(cheque.due_date).slice(0, 10)}
                        </td>
                        <td className="px-3 py-2">
                          {getStatusBadge(cheque.status, cheque.due_date)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            
                            {/* View details */}
                            <button
                              onClick={() => setSelectedChequeForDetails(cheque)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title={isAr ? 'عرض التفاصيل' : 'View Details'}
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Issue Draft */}
                            {cheque.status === 'DRAFT' && (
                              <>
                                <button
                                  onClick={async () => {
                                    if (window.confirm(isAr ? `هل أنت متأكد من اعتماد وإصدار الشيك رقم (${cheque.cheque_number}) وترحيل قيد أوراق الدفع؟` : `Are you sure you want to approve and issue cheque #${cheque.cheque_number}?`)) {
                                      try {
                                        await issuedChequeService.issueCheque(cheque.id);
                                        showSuccess(isAr ? 'تم إصدار الشيك بنجاح.' : 'Cheque issued successfully.');
                                        fetchData();
                                      } catch (err: any) {
                                        showError(err.message || (isAr ? 'فشل في إصدار الشيك' : 'Failed to issue cheque'));
                                      }
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold text-[11px] transition-colors cursor-pointer"
                                  title={isAr ? 'اعتماد وإصدار' : 'Approve & Issue'}
                                >
                                  {isAr ? 'إصدار' : 'Issue'}
                                </button>
                                <button
                                  onClick={() => { setSelectedChequeForEdit(cheque); setActiveTab('create'); }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title={isAr ? 'تعديل المسودة' : 'Edit Draft'}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCheque(cheque)}
                                  className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                  title={isAr ? 'حذف المسودة' : 'Delete Draft'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {/* Pay / Clear */}
                            {['ISSUED', 'POSTPONED'].includes(cheque.status) && (
                              <>
                                <button
                                  onClick={() => setSelectedChequeForPay(cheque)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] transition-colors cursor-pointer"
                                  title={isAr ? 'تسجيل الصرف والسداد' : 'Record Clearance'}
                                >
                                  {isAr ? 'صرف' : 'Clear'}
                                </button>
                                <button
                                  onClick={() => setSelectedChequeForPostpone(cheque)}
                                  className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                                  title={isAr ? 'تأجيل الاستحقاق' : 'Postpone Due Date'}
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setSelectedChequeForReturn(cheque)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                  title={isAr ? 'تسجيل ارتداد' : 'Record Return'}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {/* Cancel */}
                            {['DRAFT', 'ISSUED', 'POSTPONED'].includes(cheque.status) && (
                              <button
                                onClick={() => setSelectedChequeForCancel(cheque)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                title={isAr ? 'إلغاء الشيك' : 'Cancel Cheque'}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {isAr 
                    ? `عرض ${((currentPage - 1) * itemsPerPage) + 1} إلى ${Math.min(currentPage * itemsPerPage, filteredCheques.length)} من أصل ${filteredCheques.length} شيك`
                    : `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, filteredCheques.length)} of ${filteredCheques.length} cheques`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                  <span className="px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* Tab 4: Financial & Analytical Reports */}
      {activeTab === 'reports' && (
        <ChequesReportsTab
          cheques={cheques}
          suppliers={suppliers}
          paymentMethods={paymentMethods}
        />
      )}

      {/* Modals Container */}
      <ChequeDetailsModal
        isOpen={!!selectedChequeForDetails}
        onClose={() => setSelectedChequeForDetails(null)}
        cheque={selectedChequeForDetails}
        onIssue={cheque => {
          setSelectedChequeForDetails(null);
          // Auto issue
          issuedChequeService.issueCheque(cheque.id).then(() => {
            showSuccess(isAr ? 'تم إصدار الشيك بنجاح.' : 'Cheque issued successfully.');
            fetchData();
          }).catch(err => showError(err.message));
        }}
        onPay={cheque => { setSelectedChequeForDetails(null); setSelectedChequeForPay(cheque); }}
        onPostpone={cheque => { setSelectedChequeForDetails(null); setSelectedChequeForPostpone(cheque); }}
        onReturn={cheque => { setSelectedChequeForDetails(null); setSelectedChequeForReturn(cheque); }}
        onCancel={cheque => { setSelectedChequeForDetails(null); setSelectedChequeForCancel(cheque); }}
        onPrint={handlePrintCheque}
      />

      <ChequePaymentModal
        isOpen={!!selectedChequeForPay}
        onClose={() => setSelectedChequeForPay(null)}
        onSuccess={fetchData}
        cheque={selectedChequeForPay}
        paymentMethods={paymentMethods}
        accounts={accounts}
      />

      <ChequePostponeModal
        isOpen={!!selectedChequeForPostpone}
        onClose={() => setSelectedChequeForPostpone(null)}
        onSuccess={fetchData}
        cheque={selectedChequeForPostpone}
      />

      <ChequeReturnModal
        isOpen={!!selectedChequeForReturn}
        onClose={() => setSelectedChequeForReturn(null)}
        onSuccess={fetchData}
        cheque={selectedChequeForReturn}
      />

      <ChequeCancelModal
        isOpen={!!selectedChequeForCancel}
        onClose={() => setSelectedChequeForCancel(null)}
        onSuccess={fetchData}
        cheque={selectedChequeForCancel}
      />

    </div>
  );
};
export default IssuedCheques;
