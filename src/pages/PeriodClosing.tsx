import React, { useState, useEffect } from 'react';
import { 
  Lock, Unlock, ShieldAlert, Calendar, KeyRound, CheckCircle2, 
  XCircle, Search, RefreshCw, AlertTriangle, ShieldCheck, Edit3, 
  FileText, Database as DatabaseIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService, apiRequest } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

interface PeriodClosingRecord {
  module_name: string;
  closing_date: string;
  is_closed: boolean;
}

const moduleLabels: Record<string, { ar: string; en: string }> = {
  invoices: { ar: 'فواتير المبيعات', en: 'Sales Invoices' },
  returns: { ar: 'مرتجع المبيعات', en: 'Sales Returns' },
  purchase_invoices: { ar: 'فواتير المشتريات', en: 'Purchase Invoices' },
  purchase_returns: { ar: 'مرتجع المشتريات', en: 'Purchase Returns' },
  journal_entries: { ar: 'قيود اليومية', en: 'Journal Entries' },
  sales_orders: { ar: 'أوامر البيع', en: 'Sales Orders' },
  purchase_orders: { ar: 'أوامر الشراء', en: 'Purchase Orders' },
  goods_receipts: { ar: 'إذن استلام المخزون', en: 'Goods Receipts' },
  warehouse_transfers: { ar: 'حوالات المستودعات', en: 'Warehouse Transfers' },
  opening_stock_balances: { ar: 'أرصدة أول المدة للمخزون', en: 'Opening Stock Balances' },
  stock_adjustments: { ar: 'تسويات المخزون', en: 'Stock Adjustments' },
  receipt_vouchers: { ar: 'سندات القبض', en: 'Receipt Vouchers' },
  payment_vouchers: { ar: 'سندات الصرف', en: 'Payment Vouchers' },
  cash_transfers: { ar: 'التحويل بين الخزائن', en: 'Cash Transfers' },
  customers: { ar: 'العملاء', en: 'Customers' },
  suppliers: { ar: 'الموردين', en: 'Suppliers' },
  products: { ar: 'الأصناف والمنتجات', en: 'Products' },
  item_groups: { ar: 'مجموعات الأصناف', en: 'Item Groups' },
  employees: { ar: 'الموظفين', en: 'Employees' },
  expenses: { ar: 'بنود المصروفات', en: 'Expenses' },
  expense_categories: { ar: 'تصنيفات المصروفات', en: 'Expense Categories' },
  payment_methods: { ar: 'طرق السداد', en: 'Payment Methods' },
  warehouses: { ar: 'المستودعات والمخازن', en: 'Warehouses' },
  account_types: { ar: 'أنواع الحسابات', en: 'Account Types' },
  accounts: { ar: 'دليل الحسابات', en: 'Accounts' },
  operations: { ar: 'حركات الحسابات الإدارية', en: 'Operation Transactions' },
  operation_categories: { ar: 'تصنيفات العمليات الإدارية', en: 'Operation Categories' },
  operation_fields: { ar: 'حقول العمليات الإدارية', en: 'Custom Operation Fields' },
  departments: { ar: 'الإدارات والهيكل', en: 'Departments' },
  cost_centers: { ar: 'مراكز التكلفة', en: 'Cost Centers' },
  currencies: { ar: 'العملات وأسعار الصرف', en: 'Currencies' },
  exchange_rates: { ar: 'أسعار صرف العملات', en: 'Exchange Rates' }
};

const isMasterDataModule = (name: string): boolean => {
  return [
    'customers', 'suppliers', 'products', 'item_groups', 'employees', 
    'warehouses', 'payment_methods', 'expense_categories', 'accounts', 
    'account_types', 'operation_categories', 'operation_fields', 
    'departments', 'cost_centers', 'currencies', 'exchange_rates'
  ].includes(name);
};

export function PeriodClosing() {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  
  const [closings, setClosings] = useState<PeriodClosingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'transactions' | 'master_data'>('transactions');
  
  // Bulk Closing States
  const [txBulkDate, setTxBulkDate] = useState('');
  const [txBulkPassword, setTxBulkPassword] = useState('');
  
  const [mdBulkDate, setMdBulkDate] = useState('');
  const [mdBulkPassword, setMdBulkPassword] = useState('');
  
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  // Individual Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [modalDate, setModalDate] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const [modalIsClosed, setModalIsClosed] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClosings = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<PeriodClosingRecord[]>('/period_closings');
      setClosings(data || []);
    } catch (error: any) {
      showNotification(
        language === 'ar' ? 'فشل تحميل فترات الإغلاق' : 'Failed to load period closings', 
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.company_id) {
      fetchClosings();
    }
  }, [user]);

  const handleOpenModal = (record: PeriodClosingRecord) => {
    setActiveModule(record.module_name);
    setModalDate(record.closing_date || new Date().toISOString().slice(0, 10));
    setModalPassword('');
    setModalIsClosed(record.is_closed);
    setIsModalOpen(true);
  };

  const handleIndividualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModule) return;

    if (modalIsClosed && !modalPassword && !closings.find(c => c.module_name === activeModule)?.closing_date) {
      showNotification(
        language === 'ar' ? 'كلمة المرور مطلوبة لتهيئة الإغلاق' : 'Password is required to initialize closing', 
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/period_closings', 'POST', {
        module_name: activeModule,
        closing_date: modalDate,
        password: modalPassword || undefined,
        is_closed: modalIsClosed
      });

      showNotification(
        language === 'ar' ? 'تم تحديث إغلاق الفترة بنجاح' : 'Period closing updated successfully', 
        'success'
      );
      setIsModalOpen(false);
      fetchClosings();
    } catch (error: any) {
      showNotification(error.message || 'Error updating closing', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent, type: 'transactions' | 'master_data') => {
    e.preventDefault();
    const date = type === 'transactions' ? txBulkDate : mdBulkDate;
    const password = type === 'transactions' ? txBulkPassword : mdBulkPassword;

    if (!date || !password) {
      showNotification(
        language === 'ar' ? 'الرجاء إدخال التاريخ وكلمة المرور للإغلاق الجماعي' : 'Please provide date and password for bulk close', 
        'error'
      );
      return;
    }

    setIsBulkSubmitting(true);
    try {
      const moduleNameParam = type === 'transactions' ? 'all_transactions' : 'all_master_data';
      const response = await apiRequest<{ message?: string }>('/period_closings', 'POST', {
        module_name: moduleNameParam,
        closing_date: date,
        password: password,
        is_closed: true
      });

      showNotification(
        response.message || (language === 'ar' ? 'تم تطبيق الإغلاق الجماعي بنجاح' : 'Bulk closing applied successfully'), 
        'success'
      );
      if (type === 'transactions') {
        setTxBulkPassword('');
      } else {
        setMdBulkPassword('');
      }
      fetchClosings();
    } catch (error: any) {
      showNotification(error.message || 'Error in bulk closing', 'error');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleOpenPeriod = async (moduleName: string) => {
    const isAr = language === 'ar';
    const confirmMsg = isAr
      ? `هل أنت متأكد من فتح الفترة بالكامل لحركة "${moduleLabels[moduleName]?.ar || moduleName}"؟`
      : `Are you sure you want to completely open the period for "${moduleLabels[moduleName]?.en || moduleName}"?`;
      
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiRequest(`/period_closings/${moduleName}`, 'DELETE');
      showNotification(
        isAr ? 'تم فتح الفترة وإلغاء القيود بنجاح' : 'Period opened and restrictions cleared successfully', 
        'success'
      );
      fetchClosings();
    } catch (error: any) {
      showNotification(error.message || 'Error opening period', 'error');
    }
  };

  // Filter closings based on active tab and search term
  const displayedClosings = closings.filter(c => {
    const isMD = isMasterDataModule(c.module_name);
    if (activeTab === 'transactions' && isMD) return false;
    if (activeTab === 'master_data' && !isMD) return false;

    const label = moduleLabels[c.module_name];
    const nameAr = label ? label.ar : c.module_name;
    const nameEn = label ? label.en : c.module_name;
    return (
      nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.module_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10" dir={dir}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="text-emerald-600 animate-pulse" size={26} />
            <h2 className="text-3xl font-black tracking-tight text-zinc-900 serif italic">
              {language === 'ar' ? 'إغلاق الفترات المحاسبية' : 'Accounting Period Closing'}
            </h2>
          </div>
          <p className="text-zinc-500">
            {language === 'ar' 
              ? 'تأمين وحماية العمليات المالية والبيانات الأساسية من التعديل بكلمة مرور.' 
              : 'Secure and protect financial transactions and master data from editing with password.'}
          </p>
        </div>
        <button 
          onClick={fetchClosings}
          className="flex items-center gap-2 px-6 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl transition-all font-bold shadow-sm"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {language === 'ar' ? 'تحديث البيانات' : 'Refresh'}
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-zinc-200 gap-2">
        <button
          onClick={() => { setActiveTab('transactions'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'transactions'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <FileText size={16} />
          {language === 'ar' ? 'العمليات والمستندات المالية' : 'Transactions & Financials'}
        </button>
        <button
          onClick={() => { setActiveTab('master_data'); setSearchTerm(''); }}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === 'master_data'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <DatabaseIcon size={16} />
          {language === 'ar' ? 'البيانات الأساسية والتعريفات' : 'Master Data & Settings'}
        </button>
      </div>

      {/* Bulk Closing widget (Changes dynamically per tab) */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/5 p-6 rounded-[2rem] border border-emerald-100/50 shadow-md space-y-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="text-emerald-600" size={20} />
          <h3 className="text-sm font-black text-zinc-900">
            {activeTab === 'transactions' 
              ? (language === 'ar' ? 'إغلاق جماعي لجميع العمليات والمستندات المالية' : 'Bulk Close All Transactions & Financial Documents')
              : (language === 'ar' ? 'إغلاق جماعي لجميع البيانات الأساسية والتعريفات' : 'Bulk Close All Master Data & Lookups')}
          </h3>
        </div>
        
        {activeTab === 'transactions' ? (
          <form onSubmit={(e) => handleBulkSubmit(e, 'transactions')} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} />
                {language === 'ar' ? 'إغلاق الحركات حتى تاريخ' : 'Close transactions up to'}
              </label>
              <input 
                type="date"
                value={txBulkDate}
                onChange={(e) => setTxBulkDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-semibold text-sm"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                <KeyRound size={12} />
                {language === 'ar' ? 'كلمة مرور إغلاق الفترة' : 'Closing Password'}
              </label>
              <input 
                type="password"
                placeholder="••••••••"
                value={txBulkPassword}
                onChange={(e) => setTxBulkPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-mono"
                required
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isBulkSubmitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all font-bold text-sm shadow-md shadow-emerald-500/10 disabled:opacity-50"
              >
                {isBulkSubmitting ? (
                  <RefreshCw className="animate-spin" size={16} />
                ) : (
                  <Lock size={16} />
                )}
                {language === 'ar' ? 'إغلاق العمليات جماعياً' : 'Bulk Close Transactions'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => handleBulkSubmit(e, 'master_data')} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} />
                {language === 'ar' ? 'إغلاق البيانات حتى تاريخ' : 'Close master data up to'}
              </label>
              <input 
                type="date"
                value={mdBulkDate}
                onChange={(e) => setMdBulkDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-semibold text-sm"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                <KeyRound size={12} />
                {language === 'ar' ? 'كلمة مرور إغلاق البيانات' : 'Closing Password'}
              </label>
              <input 
                type="password"
                placeholder="••••••••"
                value={mdBulkPassword}
                onChange={(e) => setMdBulkPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-mono"
                required
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isBulkSubmitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all font-bold text-sm shadow-md shadow-emerald-500/10 disabled:opacity-50"
              >
                {isBulkSubmitting ? (
                  <RefreshCw className="animate-spin" size={16} />
                ) : (
                  <Lock size={16} />
                )}
                {language === 'ar' ? 'إغلاق البيانات جماعياً' : 'Bulk Close Master Data'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Main Table Container */}
      <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-100/50 space-y-4">
        
        {/* Search Toolbar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder={language === 'ar' ? 'بحث باسم الحركة أو المستند...' : 'Search by operations or document...'}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-black text-zinc-600 uppercase tracking-widest text-center w-14">#</th>
                <th className="px-6 py-4 text-xs font-black text-zinc-600 uppercase tracking-widest">{language === 'ar' ? 'اسم الحركة' : 'Operation / Document'}</th>
                <th className="px-6 py-4 text-xs font-black text-zinc-600 uppercase tracking-widest">{language === 'ar' ? 'تاريخ آخر إغلاق' : 'Closing Date'}</th>
                <th className="px-6 py-4 text-xs font-black text-zinc-600 uppercase tracking-widest text-center">{language === 'ar' ? 'حالة الإغلاق' : 'Status'}</th>
                <th className="px-6 py-4 text-xs font-black text-zinc-600 uppercase tracking-widest text-center">{language === 'ar' ? 'كلمة المرور' : 'Password Protection'}</th>
                <th className="px-6 py-4 text-xs font-black text-zinc-600 uppercase tracking-widest text-center w-48">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {loading ? (
                [1,2,3,4].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4.5 h-14 bg-zinc-50/10" />
                  </tr>
                ))
              ) : displayedClosings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-zinc-400 italic">
                    <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
                    <span>{language === 'ar' ? 'لا توجد حركات مطابقة للبحث' : 'No matching operations found'}</span>
                  </td>
                </tr>
              ) : displayedClosings.map((closing, idx) => {
                const label = moduleLabels[closing.module_name];
                const displayName = language === 'ar' ? (label ? label.ar : closing.module_name) : (label ? label.en : closing.module_name);
                
                return (
                  <tr key={closing.module_name} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono text-zinc-300 text-center">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-900 text-sm">{displayName}</span>
                        <span className="text-[10px] text-zinc-400 font-mono tracking-tight">{closing.module_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-sm text-zinc-700">
                      {closing.closing_date ? closing.closing_date : (
                        <span className="text-zinc-300 italic text-xs font-normal">{language === 'ar' ? 'لم تغلق بعد' : 'Not closed yet'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {closing.is_closed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border bg-red-50 text-red-700 border-red-200 uppercase tracking-wide">
                          <Lock size={10} />
                          {language === 'ar' ? 'مغلقة' : 'Closed'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border bg-emerald-50 text-emerald-700 border-emerald-200 uppercase tracking-wide">
                          <Unlock size={10} />
                          {language === 'ar' ? 'مفتوحة' : 'Open'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {closing.closing_date ? (
                        <span className="text-xs font-bold text-zinc-500 font-mono select-none">••••••••</span>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenModal(closing)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-zinc-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-zinc-600 rounded-xl transition-all font-bold text-xs shadow-sm"
                        >
                          <Edit3 size={12} />
                          {closing.closing_date ? (language === 'ar' ? 'تعديل الإغلاق' : 'Modify') : (language === 'ar' ? 'إغلاق الفترة' : 'Close Period')}
                        </button>
                        
                        {closing.closing_date && (
                          <button
                            onClick={() => handleOpenPeriod(closing.module_name)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all font-bold text-xs"
                          >
                            <Unlock size={12} />
                            {language === 'ar' ? 'فتح الفترة' : 'Open Period'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Modify Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] border border-zinc-100 shadow-2xl w-full max-w-md overflow-hidden relative z-10"
            >
              <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-base">
                      {language === 'ar' ? 'إعداد إغلاق الفترة' : 'Period Closing Setup'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {activeModule && (language === 'ar' ? (moduleLabels[activeModule]?.ar || activeModule) : (moduleLabels[activeModule]?.en || activeModule))}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={closeModal}
                  className="p-1.5 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 rounded-xl transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleIndividualSubmit} className="p-6 space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                    {language === 'ar' ? 'إغلاق الحركات حتى تاريخ' : 'Close transactions up to'}
                  </label>
                  <input 
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-semibold text-sm"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                    {language === 'ar' ? 'كلمة مرور الإغلاق (اكتبها لتحديثها/تعيينها)' : 'Closing Password (enter to set/update)'}
                  </label>
                  <input 
                    type="password"
                    placeholder="••••••••"
                    value={modalPassword}
                    onChange={(e) => setModalPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-mono"
                  />
                  <p className="text-[10px] text-zinc-400 font-medium">
                    {language === 'ar' 
                      ? 'اترك حقل كلمة المرور فارغاً للاحتفاظ بكلمة المرور الحالية.' 
                      : 'Leave blank to keep the existing password.'}
                  </p>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-zinc-50 rounded-2xl border border-zinc-150">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-800">{language === 'ar' ? 'حالة إغلاق الفترة' : 'Enable Closing restriction'}</span>
                    <span className="text-[10px] text-zinc-400">{language === 'ar' ? 'تفعيل منع تعديل وحفظ البيانات' : 'Prevent adding/editing data'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalIsClosed(!modalIsClosed)}
                    className={`w-11 h-6 rounded-full p-1 transition-all ${
                      modalIsClosed ? 'bg-red-500 flex justify-end' : 'bg-zinc-200 flex justify-start'
                    }`}
                  >
                    <motion.div 
                      layout
                      className="w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-2.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold rounded-xl transition-all text-xs"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all text-xs shadow-md shadow-emerald-500/10 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="animate-spin mx-auto" size={14} />
                    ) : (
                      language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );

  function closeModal() {
    setIsModalOpen(false);
    setActiveModule(null);
  }
}
