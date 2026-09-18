import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Filter, RefreshCw, Eye, Edit3, Trash2, CheckCircle2, 
  Clock, RotateCcw, Ban, Paperclip, Printer, FileSpreadsheet, ChevronLeft, 
  ChevronRight, Calendar, Building2, User, DollarSign, LayoutDashboard, 
  ListOrdered, BarChart3, AlertCircle, Check, ArrowDownLeft 
} from 'lucide-react';
import { ReceivedCheque, Customer, PaymentMethod, ReceivedChequeStats, Account } from '../types';
import { dbService } from '../services/dbService';
import { receivedChequeService } from '../services/receivedChequeService';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ReceivedChequeFormModal } from '../components/received-cheques/ReceivedChequeFormModal';
import { ReceivedChequeDetailsModal } from '../components/received-cheques/ReceivedChequeDetailsModal';
import { ReceivedChequeCollectModal } from '../components/received-cheques/ReceivedChequeCollectModal';
import { ReceivedChequePostponeModal } from '../components/received-cheques/ReceivedChequePostponeModal';
import { ReceivedChequeReturnModal } from '../components/received-cheques/ReceivedChequeReturnModal';
import { ReceivedChequeCancelModal } from '../components/received-cheques/ReceivedChequeCancelModal';
import { ReceivedChequesDashboardTab } from '../components/received-cheques/ReceivedChequesDashboardTab';
import { ReceivedChequesReportsTab } from '../components/received-cheques/ReceivedChequesReportsTab';
import { EGYPTIAN_BANKS_DATA, BankLogoBadge } from '../data/egyptianBanks';
import { AttachmentPreviewModal, ChequeAttachmentData } from '../components/common/AttachmentPreviewModal';

interface ReceivedChequesProps {
  initialTab?: 'dashboard' | 'all' | 'receive_customer' | 'receive_other' | 'due' | 'reports';
}

export const ReceivedCheques: React.FC<ReceivedChequesProps> = ({ initialTab = 'all' }) => {
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';

  // Attachment Preview Modal State
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState<ChequeAttachmentData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'all' | 'receive_customer' | 'receive_other' | 'due' | 'reports'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Data States
  const [cheques, setCheques] = useState<ReceivedCheque[]>([]);
  const [stats, setStats] = useState<ReceivedChequeStats | null>(null);
  const [upcomingCheques, setUpcomingCheques] = useState<ReceivedCheque[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [duePeriodFilter, setDuePeriodFilter] = useState<'all' | 'today' | '7days' | '30days' | 'overdue'>('all');

  // Modals & Action Targets
  const [selectedChequeForEdit, setSelectedChequeForEdit] = useState<ReceivedCheque | null>(null);
  const [selectedChequeForDetails, setSelectedChequeForDetails] = useState<ReceivedCheque | null>(null);
  const [selectedChequeForCollect, setSelectedChequeForCollect] = useState<ReceivedCheque | null>(null);
  const [selectedChequeForPostpone, setSelectedChequeForPostpone] = useState<ReceivedCheque | null>(null);
  const [selectedChequeForReturn, setSelectedChequeForReturn] = useState<ReceivedCheque | null>(null);
  const [selectedChequeForCancel, setSelectedChequeForCancel] = useState<ReceivedCheque | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [chequesData, statsData, upcomingData, custData, pmData, accData] = await Promise.all([
        receivedChequeService.list(),
        receivedChequeService.getDashboardStats().catch(() => null),
        receivedChequeService.getUpcomingCheques().catch(() => []),
        dbService.list<Customer>('customers'),
        dbService.list<PaymentMethod>('payment_methods'),
        dbService.list<Account>('accounts')
      ]);

      setCheques(chequesData || []);
      setStats(statsData);
      setUpcomingCheques(upcomingData || []);
      setCustomers(custData || []);
      setPaymentMethods(pmData || []);
      setAccounts(accData || []);
    } catch (err: any) {
      console.error('Error loading received cheques data:', err);
      showError(err.message || (isAr ? 'فشل في تحميل بيانات الشيكات الواردة' : 'Failed to load received cheques data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleDbRefresh = (e: any) => {
      if (e.detail?.collection === 'received_cheques') {
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
      if (activeTab === 'due' && !['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(c.status)) {
        return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNum = c.cheque_number?.toLowerCase().includes(term);
        const matchReceipt = c.receipt_number?.toLowerCase().includes(term);
        const matchCust = c.customer_name?.toLowerCase().includes(term) || c.payer_name?.toLowerCase().includes(term);
        const matchBank = c.drawee_bank?.toLowerCase().includes(term);
        const matchPurpose = c.purpose?.toLowerCase().includes(term);
        if (!matchNum && !matchReceipt && !matchCust && !matchBank && !matchPurpose) return false;
      }

      if (customerFilter && c.customer_id !== customerFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;

      if (c.due_date) {
        const dueStr = String(c.due_date).slice(0, 10);
        if (duePeriodFilter === 'today' && dueStr !== todayStr) return false;
        if (duePeriodFilter === '7days' && (dueStr < todayStr || dueStr > date7Days)) return false;
        if (duePeriodFilter === '30days' && (dueStr < todayStr || dueStr > date30Days)) return false;
        if (duePeriodFilter === 'overdue' && dueStr >= todayStr) return false;
      }

      return true;
    });
  }, [cheques, activeTab, searchTerm, customerFilter, statusFilter, duePeriodFilter]);

  const paginatedCheques = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCheques.slice(start, start + itemsPerPage);
  }, [filteredCheques, currentPage]);

  const totalPages = Math.ceil(filteredCheques.length / itemsPerPage) || 1;

  const handleDeleteCheque = async (cheque: ReceivedCheque) => {
    if (cheque.status !== 'RECEIVED') {
      showError(isAr ? 'لا يمكن حذف هذا الشيك بعد بدء معالجته أو تحصيله. يمكنك إلغاء الشيك بدلاً من ذلك.' : 'Cannot delete this cheque. You can cancel it instead.');
      return;
    }
    if (!window.confirm(isAr ? `هل أنت متأكد من حذف الشيك رقم (${cheque.cheque_number})؟` : `Are you sure you want to delete cheque #${cheque.cheque_number}?`)) return;

    try {
      await receivedChequeService.delete(cheque.id);
      showSuccess(isAr ? 'تم حذف الشيك الوارد بنجاح.' : 'Received cheque deleted successfully.');
      fetchData();
    } catch (err: any) {
      showError(err.message || (isAr ? 'فشل في حذف الشيك.' : 'Failed to delete cheque.'));
    }
  };

  const formatMoney = (val?: number) => {
    return Number(val || 0).toLocaleString(isAr ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const currencyLabel = isAr ? 'ج.م' : 'EGP';

  const getStatusBadge = (status: string, dueDateStr?: string) => {
    const isOverdue = dueDateStr && new Date(dueDateStr) < new Date() && ['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(status);

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <Clock className="w-3 h-3" />
          {isAr ? 'متأخر التحصيل' : 'Overdue'}
        </span>
      );
    }

    switch (status) {
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="w-3 h-3" />
            {isAr ? 'مستلم بالحافظة' : 'In Portfolio'}
          </span>
        );
      case 'UNDER_COLLECTION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            {isAr ? 'برسم التحصيل' : 'Under Collection'}
          </span>
        );
      case 'COLLECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            {isAr ? 'محصل بالبنك' : 'Collected'}
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
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl shadow-md shadow-blue-500/20">
              📥
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'إدارة الشيكات الواردة (أوراق القبض)' : 'Received Cheques Management (Notes Receivable)'}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAr 
                  ? 'استلام، تحصيل، تسوية، وإيداع شيكات وأوراق قبض العملاء والجهات المدينة بالبنوك' 
                  : 'Receive, collect, settle, and deposit customer notes receivable and cheques in banks'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 w-fit overflow-x-auto max-w-full">
        <button
          onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>{isAr ? `الشيكات الواردة (${cheques.length})` : `Received Cheques (${cheques.length})`}</span>
        </button>

        <button
          onClick={() => { setSelectedChequeForEdit(null); setActiveTab('receive_customer'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'receive_customer'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
          <span>{isAr ? 'استلام شيكات من عميل' : 'Receive Cheques from Customer'}</span>
        </button>

        <button
          onClick={() => { setSelectedChequeForEdit(null); setActiveTab('receive_other'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'receive_other'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Plus className="w-3.5 h-3.5 text-blue-600" />
          <span>{isAr ? 'استلام شيك' : 'Receive Other Cheque'}</span>
        </button>

        <button
          onClick={() => { setActiveTab('dashboard'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>{isAr ? 'لوحة التحكم' : 'Dashboard'}</span>
        </button>

        <button
          onClick={() => { setActiveTab('due'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'due'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{isAr ? 'الشيكات المستحقة واجبة التحصيل' : 'Due & Collectible Cheques'}</span>
        </button>

        <button
          onClick={() => { setActiveTab('reports'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>{isAr ? 'التقارير المالية والتحليلية للشيكات الواردة' : 'Financial & Analytical Reports'}</span>
        </button>
      </div>

      {/* Tab: Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <ReceivedChequesDashboardTab
          stats={stats}
          upcomingCheques={upcomingCheques}
          loading={loading}
          onRefresh={fetchData}
          onReceiveCustomer={() => { setSelectedChequeForEdit(null); setActiveTab('receive_customer'); }}
          onReceiveOther={() => { setSelectedChequeForEdit(null); setActiveTab('receive_other'); }}
          onViewCheque={cheque => setSelectedChequeForDetails(cheque)}
          onCollectCheque={cheque => setSelectedChequeForCollect(cheque)}
        />
      )}

      {/* Tab: استلام شيكات من عميل */}
      {activeTab === 'receive_customer' && (
        <ReceivedChequeFormModal
          isOpen={true}
          inline={true}
          mode="CUSTOMER"
          onClose={() => { setActiveTab('all'); setSelectedChequeForEdit(null); }}
          onSuccess={() => { fetchData(); setActiveTab('all'); setSelectedChequeForEdit(null); }}
          chequeToEdit={selectedChequeForEdit}
          customers={customers}
          paymentMethods={paymentMethods}
          accounts={accounts}
        />
      )}

      {/* Tab: استلام شيك (أوراق قبض أخرى) */}
      {activeTab === 'receive_other' && (
        <ReceivedChequeFormModal
          isOpen={true}
          inline={true}
          mode="OTHER"
          onClose={() => { setActiveTab('all'); setSelectedChequeForEdit(null); }}
          onSuccess={() => { fetchData(); setActiveTab('all'); setSelectedChequeForEdit(null); }}
          chequeToEdit={selectedChequeForEdit}
          customers={customers}
          paymentMethods={paymentMethods}
          accounts={accounts}
        />
      )}

      {/* Tab: All Cheques & Due Cheques Tables */}
      {(activeTab === 'all' || activeTab === 'due') && (
        <div className="space-y-3">
          
          {/* Filters Strip */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-2">
            
            <div className="relative flex-1 w-full">
              <Search className={`w-3.5 h-3.5 absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 text-slate-400`} />
              <input
                type="text"
                placeholder={isAr ? "البحث برقم الشيك، رقم الإيصال، اسم العميل، البنك، أو البيان..." : "Search by cheque #, receipt #, customer, bank, or memo..."}
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className={`w-full ${isAr ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500`}
              />
            </div>

            <select
              value={customerFilter}
              onChange={e => { setCustomerFilter(e.target.value); setCurrentPage(1); }}
              className="w-full md:w-44 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">{isAr ? 'جميع العملاء' : 'All Customers'}</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {activeTab === 'all' && (
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full md:w-36 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="RECEIVED">{isAr ? 'مستلم بالحافظة' : 'In Portfolio'}</option>
                <option value="UNDER_COLLECTION">{isAr ? 'برسم التحصيل' : 'Under Collection'}</option>
                <option value="COLLECTED">{isAr ? 'محصل بالبنك' : 'Collected'}</option>
                <option value="POSTPONED">{isAr ? 'مؤجل' : 'Postponed'}</option>
                <option value="RETURNED">{isAr ? 'مرتد' : 'Returned'}</option>
                <option value="CANCELLED">{isAr ? 'ملغى' : 'Cancelled'}</option>
              </select>
            )}

            <select
              value={duePeriodFilter}
              onChange={e => { setDuePeriodFilter(e.target.value as any); setCurrentPage(1); }}
              className="w-full md:w-36 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="all">{isAr ? 'كل الفترات' : 'All Dates'}</option>
              <option value="today">{isAr ? 'يستحق اليوم' : 'Due Today'}</option>
              <option value="7days">{isAr ? 'خلال 7 أيام' : 'Next 7 Days'}</option>
              <option value="30days">{isAr ? 'خلال 30 يوماً' : 'Next 30 Days'}</option>
              <option value="overdue">{isAr ? 'متأخر التحصيل' : 'Overdue'}</option>
            </select>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              title={isAr ? 'تحديث' : 'Refresh'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Table Container */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 whitespace-nowrap">
                  <tr>
                    <th className="px-3 py-2.5">{isAr ? 'رقم الشيك' : 'Cheque #'}</th>
                    <th className="px-3 py-2.5">{isAr ? 'رقم الإيصال' : 'Receipt #'}</th>
                    <th className="px-3 py-2.5">{isAr ? 'العميل / الساحب' : 'Customer / Payer'}</th>
                    <th className="px-3 py-2.5">{isAr ? 'حساب أوراق القبض' : 'Notes Rec. Account'}</th>
                    <th className="px-3 py-2.5">{isAr ? 'البنك المسحوب عليه' : 'Drawee Bank'}</th>
                    <th className="px-3 py-2.5 text-left">{isAr ? 'المبلغ' : 'Amount'}</th>
                    <th className="px-3 py-2.5">{isAr ? 'العملة' : 'Cur.'}</th>
                    <th className="px-3 py-2.5">{isAr ? 'تاريخ الاستلام' : 'Receipt Date'}</th>
                    <th className="px-3 py-2.5">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                    <th className="px-3 py-2.5 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="px-3 py-2.5 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 whitespace-nowrap">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>{isAr ? 'جاري تحميل الشيكات...' : 'Loading cheques...'}</span>
                      </td>
                    </tr>
                  ) : paginatedCheques.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                        {isAr ? 'لا توجد شيكات واردة مطابقة لمعايير البحث.' : 'No received cheques match your search.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedCheques.map(cheque => (
                      <tr key={cheque.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                          <button
                            onClick={() => setSelectedChequeForDetails(cheque)}
                            className="hover:text-blue-600 transition-colors cursor-pointer text-start block"
                          >
                            <span>{cheque.cheque_number}</span>
                            {cheque.serial_number && (
                              <span className="block text-[10px] font-mono text-slate-400 dark:text-slate-500 font-normal">
                                {cheque.serial_number}
                              </span>
                            )}
                          </button>
                          {cheque.attachments && cheque.attachments.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPreviewAttachment(cheque.attachments![0]);
                                setIsPreviewOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-sans font-bold bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/60 mt-1 cursor-pointer transition-colors"
                              title={isAr ? `معاينة المرفق (${cheque.attachments.length})` : `View Attachment (${cheque.attachments.length})`}
                            >
                              <Paperclip className="w-2.5 h-2.5" />
                              <span>{isAr ? 'مرفق' : 'Scan'}</span>
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {cheque.receipt_number || '-'}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                          <div>
                            <span className="font-bold">{cheque.customer_name || cheque.payer_name || '-'}</span>
                            {String(cheque.cheque_type).toUpperCase() === 'OTHER' && (
                              <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                                {isAr ? 'أوراق قبض أخرى' : 'Other Payer'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">
                          {cheque.debit_account_name || (isAr ? 'أوراق قبض' : 'Notes Receivable')}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {(() => {
                            const matchedBank = EGYPTIAN_BANKS_DATA.find(b => 
                              b.nameAr === cheque.drawee_bank || 
                              b.nameEn.toLowerCase() === (cheque.drawee_bank || '').toLowerCase() ||
                              (cheque.drawee_bank && b.nameAr && (cheque.drawee_bank.includes(b.nameAr) || b.nameAr.includes(cheque.drawee_bank)))
                            );
                            return (
                              <div className="flex items-center gap-2">
                                {matchedBank ? (
                                  <BankLogoBadge bank={matchedBank} size="sm" />
                                ) : (
                                  <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-400">🏦</span>
                                )}
                                <span>{cheque.drawee_bank || '-'}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">
                          <div>
                            <span>{formatMoney(cheque.amount)}</span>
                            {cheque.currency && cheque.currency !== 'EGP' && (
                              <span className="block text-[10px] font-normal text-blue-600 dark:text-blue-400">
                                ({formatMoney(Number(cheque.amount) * (Number(cheque.exchange_rate) || 1))} {currencyLabel})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {cheque.currency || 'EGP'}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500">
                          {String(cheque.receipt_date).slice(0, 10)}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {String(cheque.due_date).slice(0, 10)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {getStatusBadge(cheque.status, cheque.due_date)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            
                            <button
                              onClick={() => setSelectedChequeForDetails(cheque)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title={isAr ? 'عرض التفاصيل' : 'View Details'}
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Attachment Action Button */}
                            {cheque.attachments && cheque.attachments.length > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedPreviewAttachment(cheque.attachments![0]);
                                  setIsPreviewOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer relative"
                                title={isAr ? `معاينة وتحميل المرفق (${cheque.attachments.length})` : `View Attachment (${cheque.attachments.length})`}
                              >
                                <Paperclip className="w-4 h-4" />
                              </button>
                            )}

                            {/* Collect & Deposit */}
                            {['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(cheque.status) && (
                              <button
                                onClick={() => setSelectedChequeForCollect(cheque)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                                title={isAr ? 'تحصيل وإيداع في البنك' : 'Collect & Deposit'}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Postpone */}
                            {['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(cheque.status) && (
                              <button
                                onClick={() => setSelectedChequeForPostpone(cheque)}
                                className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                                title={isAr ? 'تأجيل الاستحقاق' : 'Postpone Due Date'}
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                            )}

                            {/* Return */}
                            {['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(cheque.status) && (
                              <button
                                onClick={() => setSelectedChequeForReturn(cheque)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                title={isAr ? 'تسجيل الارتداد' : 'Record Return'}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}

                            {/* Cancel */}
                            {['RECEIVED', 'UNDER_COLLECTION', 'POSTPONED'].includes(cheque.status) && (
                              <button
                                onClick={() => setSelectedChequeForCancel(cheque)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                title={isAr ? 'إلغاء الشيك' : 'Cancel Cheque'}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete if only RECEIVED and no clearance */}
                            {cheque.status === 'RECEIVED' && (
                              <button
                                onClick={() => handleDeleteCheque(cheque)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
                                title={isAr ? 'حذف الشيك' : 'Delete Cheque'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {isAr ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronRight className={`w-3.5 h-3.5 ${isAr ? '' : 'rotate-180'}`} />
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className={`w-3.5 h-3.5 ${isAr ? '' : 'rotate-180'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab: Reports Tab */}
      {activeTab === 'reports' && (
        <ReceivedChequesReportsTab
          cheques={cheques}
          customers={customers}
          paymentMethods={paymentMethods}
        />
      )}

      {/* Details Modal */}
      <ReceivedChequeDetailsModal
        isOpen={Boolean(selectedChequeForDetails)}
        onClose={() => setSelectedChequeForDetails(null)}
        cheque={selectedChequeForDetails}
        onCollect={cheque => setSelectedChequeForCollect(cheque)}
        onPostpone={cheque => setSelectedChequeForPostpone(cheque)}
        onReturn={cheque => setSelectedChequeForReturn(cheque)}
        onCancel={cheque => setSelectedChequeForCancel(cheque)}
      />

      {/* Collect Modal */}
      <ReceivedChequeCollectModal
        isOpen={Boolean(selectedChequeForCollect)}
        onClose={() => setSelectedChequeForCollect(null)}
        onSuccess={fetchData}
        cheque={selectedChequeForCollect}
        paymentMethods={paymentMethods}
        accounts={accounts}
      />

      {/* Postpone Modal */}
      <ReceivedChequePostponeModal
        isOpen={Boolean(selectedChequeForPostpone)}
        onClose={() => setSelectedChequeForPostpone(null)}
        onSuccess={fetchData}
        cheque={selectedChequeForPostpone}
      />

      {/* Return Modal */}
      <ReceivedChequeReturnModal
        isOpen={Boolean(selectedChequeForReturn)}
        onClose={() => setSelectedChequeForReturn(null)}
        onSuccess={fetchData}
        cheque={selectedChequeForReturn}
      />

      {/* Cancel Modal */}
      <ReceivedChequeCancelModal
        isOpen={Boolean(selectedChequeForCancel)}
        onClose={() => setSelectedChequeForCancel(null)}
        onSuccess={fetchData}
        cheque={selectedChequeForCancel}
      />

      {/* Attachment Preview & Download Modal */}
      <AttachmentPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        attachment={selectedPreviewAttachment}
      />

    </div>
  );
};
