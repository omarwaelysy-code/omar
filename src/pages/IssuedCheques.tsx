import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Filter, RefreshCw, Eye, Edit3, Trash2, CheckCircle2, 
  Clock, RotateCcw, Ban, Paperclip, Printer, FileSpreadsheet, ChevronLeft, 
  ChevronRight, Calendar, Building2, User, DollarSign, LayoutDashboard, 
  ListOrdered, BarChart3, AlertCircle 
} from 'lucide-react';
import { IssuedCheque, Supplier, PaymentMethod, IssuedChequeStats } from '../types';
import { dbService } from '../services/dbService';
import { issuedChequeService } from '../services/issuedChequeService';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
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

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'all' | 'due' | 'reports'>('dashboard');

  // Data States
  const [cheques, setCheques] = useState<IssuedCheque[]>([]);
  const [stats, setStats] = useState<IssuedChequeStats | null>(null);
  const [upcomingCheques, setUpcomingCheques] = useState<IssuedCheque[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [duePeriodFilter, setDuePeriodFilter] = useState<'all' | 'today' | '7days' | '30days' | 'overdue'>('all');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
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
      const [chequesData, statsData, upcomingData, suppData, pmData] = await Promise.all([
        issuedChequeService.list(),
        issuedChequeService.getDashboardStats().catch(() => null),
        issuedChequeService.getUpcomingCheques().catch(() => []),
        dbService.list<Supplier>('suppliers'),
        dbService.list<PaymentMethod>('payment_methods')
      ]);

      setCheques(chequesData || []);
      setStats(statsData);
      setUpcomingCheques(upcomingData || []);
      setSuppliers(suppData || []);
      setPaymentMethods(pmData || []);
    } catch (err: any) {
      console.error('Error loading issued cheques data:', err);
      showError(err.message || 'فشل في تحميل بيانات الشيكات الصادرة');
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
      // Due tab specific constraint
      if (activeTab === 'due') {
        if (!['ISSUED', 'POSTPONED'].includes(c.status)) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const numMatch = (c.cheque_number || '').toLowerCase().includes(term);
        const suppMatch = (c.supplier_name || '').toLowerCase().includes(term);
        const payeeMatch = (c.payee_name || '').toLowerCase().includes(term);
        const bankMatch = (c.bank_name || '').toLowerCase().includes(term);
        const descMatch = (c.description || '').toLowerCase().includes(term);
        if (!numMatch && !suppMatch && !payeeMatch && !bankMatch && !descMatch) return false;
      }

      // Supplier filter
      if (supplierFilter && c.supplier_id !== supplierFilter) return false;

      // Bank filter
      if (bankFilter && c.bank_account_id !== bankFilter) return false;

      // Status filter
      if (statusFilter && c.status !== statusFilter) return false;

      // Due Period filter
      if (duePeriodFilter !== 'all') {
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
      showError('لا يمكن حذف هذا الشيك لأنه تم إصداره مسبقاً. يمكنك إلغاء الشيك بدلاً من ذلك.');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف مسودة الشيك رقم (${cheque.cheque_number})؟`)) return;

    try {
      await issuedChequeService.delete(cheque.id);
      showSuccess('تم حذف مسودة الشيك بنجاح.');
      fetchData();
    } catch (err: any) {
      showError(err.message || 'فشل في حذف الشيك.');
    }
  };

  const handlePrintCheque = (cheque: IssuedCheque) => {
    window.print();
  };

  const formatMoney = (val?: number) => {
    return Number(val || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusBadge = (status: string, dueDateStr?: string) => {
    const isOverdue = dueDateStr && new Date(dueDateStr) < new Date() && ['ISSUED', 'POSTPONED'].includes(status);

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <Clock className="w-3 h-3" />
          متأخر الصرف
        </span>
      );
    }

    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            مسودة
          </span>
        );
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="w-3 h-3" />
            صادر (برسم الدفع)
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            مدفوع ومصروف
          </span>
        );
      case 'POSTPONED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            مؤجل
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <RotateCcw className="w-3 h-3" />
            مرتد
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            <Ban className="w-3 h-3" />
            ملغى
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen" dir="rtl">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20">
              🏦
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                إدارة الشيكات الصادرة
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                إصدار، متابعة، تسوية، وتوثيق استحقاقات الشيكات الصادرة للموردين والجهات الدائنة
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={() => {
            setSelectedChequeForEdit(null);
            setIsFormOpen(true);
          }}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          <span>تحرير شيك صادر جديد</span>
        </button>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 w-fit overflow-x-auto max-w-full">
        <button
          onClick={() => { setActiveTab('dashboard'); setCurrentPage(1); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'dashboard'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>لوحة التحكم</span>
        </button>

        <button
          onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'all'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>كل الشيكات ({cheques.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('due'); setCurrentPage(1); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'due'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>الشيكات المستحقة واجبة الصرف</span>
        </button>

        <button
          onClick={() => { setActiveTab('reports'); setCurrentPage(1); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'reports'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>التقارير المالية والتحليلية</span>
        </button>
      </div>

      {/* Tab 1: Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <ChequesDashboardTab
          stats={stats}
          upcomingCheques={upcomingCheques}
          loading={loading}
          onRefresh={fetchData}
          onCreateNew={() => { setSelectedChequeForEdit(null); setIsFormOpen(true); }}
          onViewCheque={cheque => setSelectedChequeForDetails(cheque)}
          onPayCheque={cheque => setSelectedChequeForPay(cheque)}
        />
      )}

      {/* Tab 2 & 3: All Cheques & Due Cheques Tables */}
      {(activeTab === 'all' || activeTab === 'due') && (
        <div className="space-y-4">
          
          {/* Filters Strip */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="البحث برقم الشيك، اسم المورد، الحساب البنكي، أو البيان..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pr-10 pl-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Supplier Filter */}
            <select
              value={supplierFilter}
              onChange={e => { setSupplierFilter(e.target.value); setCurrentPage(1); }}
              className="w-full md:w-48 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">كل الموردين</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Bank Filter */}
            <select
              value={bankFilter}
              onChange={e => { setBankFilter(e.target.value); setCurrentPage(1); }}
              className="w-full md:w-48 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="">كل البنوك</option>
              {paymentMethods.filter(p => p.type === 'bank' || p.bank_name).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Status Filter (Only in All tab) */}
            {activeTab === 'all' && (
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full md:w-40 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="">كل الحالات</option>
                <option value="DRAFT">مسودة</option>
                <option value="ISSUED">صادر</option>
                <option value="PAID">مدفوع ومصروف</option>
                <option value="POSTPONED">مؤجل</option>
                <option value="RETURNED">مرتد</option>
                <option value="CANCELLED">ملغى</option>
              </select>
            )}

            {/* Due Period Filter */}
            <select
              value={duePeriodFilter}
              onChange={e => { setDuePeriodFilter(e.target.value as any); setCurrentPage(1); }}
              className="w-full md:w-40 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 outline-none"
            >
              <option value="all">كل المواعيد</option>
              <option value="today">مستحق اليوم</option>
              <option value="7days">خلال 7 أيام</option>
              <option value="30days">خلال 30 يوم</option>
              <option value="overdue">متأخر الصرف</option>
            </select>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Cheques Table */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            {paginatedCheques.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <AlertCircle className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-base font-bold text-slate-700 dark:text-slate-300">لم يتم العثور على أي شيكات مطابقة</p>
                <p className="text-xs text-slate-400 mt-1">جرب تغيير معايير البحث أو إضافة شيك صادر جديد</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-4">رقم الشيك</th>
                      <th className="px-5 py-4">المورد المستفيد</th>
                      <th className="px-5 py-4">الحساب البنكي</th>
                      <th className="px-5 py-4">المبلغ</th>
                      <th className="px-5 py-4">تاريخ التحرير</th>
                      <th className="px-5 py-4">تاريخ الاستحقاق</th>
                      <th className="px-5 py-4">الحالة</th>
                      <th className="px-5 py-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {paginatedCheques.map(cheque => (
                      <tr key={cheque.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          <button
                            onClick={() => setSelectedChequeForDetails(cheque)}
                            className="hover:text-emerald-600 transition-colors"
                          >
                            {cheque.cheque_number}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                          {cheque.supplier_name || cheque.payee_name || '-'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                          {cheque.bank_name || '-'}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-black text-slate-900 dark:text-white">
                          {formatMoney(cheque.amount)} ج.م
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-500">
                          {String(cheque.issue_date).slice(0, 10)}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {String(cheque.due_date).slice(0, 10)}
                        </td>
                        <td className="px-5 py-3.5">
                          {getStatusBadge(cheque.status, cheque.due_date)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-1">
                            
                            {/* View details */}
                            <button
                              onClick={() => setSelectedChequeForDetails(cheque)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Issue Draft */}
                            {cheque.status === 'DRAFT' && (
                              <>
                                <button
                                  onClick={async () => {
                                    if (window.confirm(`هل أنت متأكد من اعتماد وإصدار الشيك رقم (${cheque.cheque_number}) وترحيل قيد أوراق الدفع؟`)) {
                                      try {
                                        await issuedChequeService.issueCheque(cheque.id);
                                        showSuccess('تم إصدار الشيك بنجاح.');
                                        fetchData();
                                      } catch (err: any) {
                                        showError(err.message || 'فشل في إصدار الشيك');
                                      }
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold text-[11px] transition-colors"
                                  title="اعتماد وإصدار"
                                >
                                  إصدار
                                </button>
                                <button
                                  onClick={() => { setSelectedChequeForEdit(cheque); setIsFormOpen(true); }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="تعديل المسودة"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCheque(cheque)}
                                  className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                  title="حذف المسودة"
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
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] transition-colors"
                                  title="تسجيل الصرف والسداد"
                                >
                                  صرف
                                </button>
                                <button
                                  onClick={() => setSelectedChequeForPostpone(cheque)}
                                  className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                                  title="تأجيل الاستحقاق"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setSelectedChequeForReturn(cheque)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                  title="تسجيل ارتداد"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {/* Cancel */}
                            {['DRAFT', 'ISSUED', 'POSTPONED'].includes(cheque.status) && (
                              <button
                                onClick={() => setSelectedChequeForCancel(cheque)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                title="إلغاء الشيك"
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
                  عرض {((currentPage - 1) * itemsPerPage) + 1} إلى {Math.min(currentPage * itemsPerPage, filteredCheques.length)} من أصل {filteredCheques.length} شيك
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
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
      <ChequeFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setSelectedChequeForEdit(null); }}
        onSuccess={fetchData}
        chequeToEdit={selectedChequeForEdit}
        suppliers={suppliers}
        paymentMethods={paymentMethods}
      />

      <ChequeDetailsModal
        isOpen={!!selectedChequeForDetails}
        onClose={() => setSelectedChequeForDetails(null)}
        cheque={selectedChequeForDetails}
        onIssue={cheque => {
          setSelectedChequeForDetails(null);
          // Auto issue
          issuedChequeService.issueCheque(cheque.id).then(() => {
            showSuccess('تم إصدار الشيك بنجاح.');
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
