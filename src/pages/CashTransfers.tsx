import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { TransactionManager } from '../services/TransactionManager';
import { CashTransferSchema, JournalEntrySchema } from '../lib/schemas';
import { CashTransfer, PaymentMethod, JournalEntry, JournalEntryItem, Account, ActivityLog } from '../types';
import { 
  Search, Plus, Trash2, X, ArrowLeftRight, Pencil, 
  Download, Eye, FileText, History, Printer, 
  Wallet, Calendar, Hash, Layers, Save,
  Maximize2, Minimize2, ChevronRight, ChevronLeft, RotateCcw, User, ChevronDown, LayoutGrid, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { SmartAIInput } from '../components/SmartAIInput';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { formatNumber, formatDate, formatMoney, parseNumber } from '../utils/formatUtils';
import { ExportButtons } from '../components/ExportButtons';
import { PaginationControls } from '../components/PaginationControls';
import { useNavigation } from '../contexts/NavigationContext';
import { useLanguage } from '../contexts/LanguageContext';

export const CashTransfers: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { setPendingViewDoc, setCurrentPage } = useNavigation();
  const [transfers, setTransfers] = useState<CashTransfer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<CashTransfer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState<string | null>(null);
  const [viewTransfer, setViewTransfer] = useState<CashTransfer | null>(null);
  const [view, setView] = useState<'table' | 'card'>('table');
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);
  const [serverSummary, setServerSummary] = useState<any>({});
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { t, language, dir } = useLanguage();

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTransfer(null);
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      from_payment_method_id: '',
      to_payment_method_id: '',
      description: '',
      transfer_number: ''
    });
  };

  const handlePrevTransfer = () => {
    if (!editingTransfer) return;
    const currentIndex = transfers.findIndex(t => t.id === editingTransfer.id);
    if (currentIndex > 0) {
      const prev = transfers[currentIndex - 1];
      setEditingTransfer(prev);
      setFormData({
        date: prev.date ? prev.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        amount: Number(prev.amount) || 0,
        from_payment_method_id: prev.from_payment_method_id,
        to_payment_method_id: prev.to_payment_method_id,
        description: prev.description,
        transfer_number: prev.transfer_number || ''
      });
    }
  };

  const handleNextTransfer = () => {
    if (!editingTransfer) return;
    const currentIndex = transfers.findIndex(t => t.id === editingTransfer.id);
    if (currentIndex < transfers.length - 1) {
      const next = transfers[currentIndex + 1];
      setEditingTransfer(next);
      setFormData({
        date: next.date ? next.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        amount: Number(next.amount) || 0,
        from_payment_method_id: next.from_payment_method_id,
        to_payment_method_id: next.to_payment_method_id,
        description: next.description,
        transfer_number: next.transfer_number || ''
      });
    }
  };
  const transferRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Add Payment Method Modal State
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [paymentMethodFormData, setPaymentMethodFormData] = useState({
    code: '',
    name: '',
    type: 'cash' as 'cash' | 'bank' | 'wallet',
    account_id: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    counter_account_id: '',
    details: ''
  });

  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    from_payment_method_id: '',
    to_payment_method_id: '',
    description: '',
    transfer_number: ''
  });

  const [isAmountFocused, setIsAmountFocused] = useState(false);

  useEffect(() => {
    if (user) {
      const unsubTransfers = dbService.subscribePaginated('cash_transfers', {
          company_id: user.company_id,
          _page: page,
          _limit: limit,
          _sortBy: sortBy,
          _sortOrder: sortOrder,
          _search: searchTerm
      }, (result: any) => {
        setTransfers(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
        setLoading(false);
      });
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      
      return () => {
        unsubTransfers();
        unsubPM();
        unsubAccounts();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

  // Real-time Preview Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
    }

    const generatePreview = () => {
      if (formData.amount <= 0 || !formData.from_payment_method_id || !formData.to_payment_method_id) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const fromPM = paymentMethods.find(pm => pm.id === formData.from_payment_method_id);
      const toPM = paymentMethods.find(pm => pm.id === formData.to_payment_method_id);

      if (!fromPM || !toPM) return;

      const journalItems: JournalEntryItem[] = [
        {
          account_id: toPM.account_id || '',
          account_name: toPM.account_name || toPM.name,
          debit: formData.amount,
          credit: 0,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${formData.description ? ': ' + formData.description : ''}`
        },
        {
          account_id: fromPM.account_id || '',
          account_name: fromPM.account_name || fromPM.name,
          debit: 0,
          credit: formData.amount,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${formData.description ? ': ' + formData.description : ''}`
        }
      ];

      setPreviewJournalEntry({
        id: 'preview',
        date: formData.date,
        description: `قيد تحويل نقدية${formData.description ? ': ' + formData.description : ''}`,
        reference_id: editingTransfer?.id || 'new',
        reference_type: 'cash_transfer',
        items: journalItems,
        total_debit: formData.amount,
        total_credit: formData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });

      setPreviewActivityLog({
        action: editingTransfer ? 'تعديل تحويل نقدية' : 'إضافة تحويل نقدية',
        details: `تحويل مبلغ ${formData.amount} من ${fromPM.name} إلى ${toPM.name}`,
        entity: ['cash_transfers', 'journal_entries']
      });
    };

    generatePreview();
  }, [isModalOpen, formData, user, paymentMethods, editingTransfer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.from_payment_method_id === formData.to_payment_method_id) {
      showNotification(language === 'ar' ? 'لا يمكن التحويل لنفس الخزينة' : 'Cannot transfer to the same safe', 'error');
      return;
    }

    if (formData.amount <= 0) {
      showNotification(language === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount', 'error');
      return;
    }

    try {
      const fromPM = paymentMethods.find(pm => pm.id === formData.from_payment_method_id);
      const toPM = paymentMethods.find(pm => pm.id === formData.to_payment_method_id);

      if (!fromPM || !toPM) {
        showNotification(language === 'ar' ? 'يرجى اختيار الخزائن بشكل صحيح' : 'Please select safes correctly', 'error');
        return;
      }

      const data = {
        date: formData.date,
        amount: formData.amount,
        description: formData.description,
        from_payment_method_id: formData.from_payment_method_id,
        to_payment_method_id: formData.to_payment_method_id,
        from_payment_method_name: fromPM?.name || '',
        to_payment_method_name: toPM?.name || '',
        company_id: user.company_id,
        created_at: editingTransfer ? editingTransfer.created_at : new Date().toISOString(),
        created_by: editingTransfer ? editingTransfer.created_by : user.id,
        transfer_number: formData.transfer_number
      };

      const journalItems = [
        {
          account_id: toPM.account_id || '',
          account_name: toPM.account_name || toPM.name || '',
          debit: formData.amount,
          credit: 0,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${formData.description ? ': ' + formData.description : ''}`,
          sub_account_id: toPM.id,
          sub_account_type: 'payment_method'
        },
        {
          account_id: fromPM.account_id || '',
          account_name: fromPM.account_name || fromPM.name || '',
          debit: 0,
          credit: formData.amount,
          description: `تحويل من ${fromPM.name} إلى ${toPM.name}${formData.description ? ': ' + formData.description : ''}`,
          sub_account_id: fromPM.id,
          sub_account_type: 'payment_method'
        }
      ];

      const journalEntryData = {
        date: formData.date,
        description: `قيد تحويل نقدية${formData.description ? ': ' + formData.description : ''}`,
        reference_type: 'cash_transfer',
        items: journalItems,
        total_debit: formData.amount,
        total_credit: formData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      if (editingTransfer) {
        await dbService.deleteJournalEntryByReference(editingTransfer.id, user.company_id);
        await TransactionManager.updateWithAccounting(
          'cash_transfers',
          editingTransfer.id,
          data,
          CashTransferSchema,
          journalEntryData,
          JournalEntrySchema
        );
      } else {
        await TransactionManager.saveWithAccounting(
          'cash_transfers',
          data,
          CashTransferSchema,
          journalEntryData,
          JournalEntrySchema
        );
      }

      setIsModalOpen(false);
      setEditingTransfer(null);
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        amount: 0,
        from_payment_method_id: '',
        to_payment_method_id: '',
        description: '',
        transfer_number: ''
      });
      showNotification(language === 'ar' ? (editingTransfer ? 'تم تحديث التحويل بنجاح' : 'تم إضافة التحويل بنجاح') : (editingTransfer ? 'Transfer updated successfully' : 'Transfer added successfully'), 'success');

      if (!editingTransfer) {
        dbService.logActivity(
          user.id,
          user.username,
          user.company_id,
          'إضافة تحويل نقدية',
          `تحويل مبلغ ${formData.amount} من ${fromPM.name} إلى ${toPM.name}`,
          ['cash_transfers', 'journal_entries']
        );
      }
    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || (language === 'ar' ? 'حدث خطأ أثناء حفظ التحويل' : 'An error occurred while saving transfer'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!transferToDelete || !user) return;
    try {
      await dbService.delete('cash_transfers', transferToDelete);
      await dbService.deleteJournalEntryByReference(transferToDelete, user.company_id);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف تحويل نقدية', `حذف عملية تحويل نقدية رقم ${transferToDelete}`, ['cash_transfers', 'journal_entries']);
      setIsDeleteModalOpen(false);
      setTransferToDelete(null);
      showNotification(language === 'ar' ? 'تم حذف التحويل بنجاح' : 'Transfer deleted successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء حذف التحويل' : 'An error occurred while deleting transfer', 'error');
    }
  };

  const handlePaymentMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const selectedAccount = accounts.find(a => a.id === paymentMethodFormData.account_id);
      const pmId = await dbService.add('payment_methods', {
        ...paymentMethodFormData,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      });
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من شاشة التحويلات: ${paymentMethodFormData.name}`, ['payment_methods', 'cash_transfers'], pmId);
      
      // Create journal entry for opening balance if not zero
      if (paymentMethodFormData.opening_balance !== 0 && paymentMethodFormData.account_id && paymentMethodFormData.counter_account_id) {
        const absBalance = Math.abs(paymentMethodFormData.opening_balance);
        const isNegative = paymentMethodFormData.opening_balance < 0;
        const counterAccount = accounts.find(a => a.id === paymentMethodFormData.counter_account_id);

        await dbService.add('journal_entries', {
          company_id: user.company_id,
          date: paymentMethodFormData.opening_balance_date,
          description: `رصيد افتتاحي لطريقة الدفع: ${paymentMethodFormData.name}`,
          reference_id: pmId,
          reference_type: 'opening_balance',
          items: [
            {
              account_id: paymentMethodFormData.account_id,
              account_name: selectedAccount?.name || '',
              debit: isNegative ? 0 : absBalance,
              credit: isNegative ? absBalance : 0,
              description: 'رصيد افتتاحي'
            },
            {
              account_id: paymentMethodFormData.counter_account_id,
              account_name: counterAccount?.name || 'حساب الميزانية الافتتاحية',
              debit: isNegative ? absBalance : 0,
              credit: isNegative ? 0 : absBalance,
              description: `رصيد افتتاحي لطريقة الدفع: ${paymentMethodFormData.name}`
            }
          ],
          total_debit: absBalance,
          total_credit: absBalance,
          created_at: new Date().toISOString(),
          created_by: user.id
        });
      }

      setIsPaymentMethodModalOpen(false);
      setPaymentMethodFormData({
        code: '',
        name: '',
        type: 'cash',
        account_id: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        counter_account_id: '',
        details: ''
      });
      showNotification(language === 'ar' ? 'تم إضافة الخزينة بنجاح' : 'Safe added successfully', 'success');
    } catch (e) {
      console.error(e);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء إضافة الخزينة' : 'An error occurred while adding safe', 'error');
    }
  };

  const filteredTransfers = transfers.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.from_payment_method_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.to_payment_method_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToPDF = async (transfer: CashTransfer) => {
    // Logic for single transfer PDF if needed
  };

  const handleExportExcel = () => {
    const headers = {
      'date': 'التاريخ',
      'from_payment_method_name': 'من خزينة',
      'to_payment_method_name': 'إلى خزينة',
      'amount': 'المبلغ',
      'description': 'الوصف'
    };
    const formattedData = formatDataForExcel(filteredTransfers, headers);
    exportToExcel(formattedData, { filename: 'Cash_Transfers', sheetName: language === 'ar' ? 'تحويلات النقدية' : 'Cash Transfers' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Cash_Transfers', 
        orientation: 'landscape',
        reportTitle: language === 'ar' ? 'تقرير تحويلات النقدية' : 'Cash Transfers Report'
      });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">جاري التحميل...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <ArrowLeftRight size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">{language === 'ar' ? 'التحويل بين الخزائن' : 'Cash Safe Transfers'}</h2>
            <p className="text-zinc-500 font-medium">{language === 'ar' ? 'إدارة عمليات تحويل النقدية بين الخزائن والحسابات البنكية' : 'Manage cash transfers between safes and bank accounts'}</p>
            {serverSummary.total_amount !== undefined && (
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                  {language === 'ar' ? 'إجمالي المحول:' : 'Total Transferred:'} {formatMoney(serverSummary.total_amount)} {t('common.currency')}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons 
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            onPrint={() => printElement(tableRef.current, 'سندات التحويل النقدي')}
          />
          <button 
            onClick={() => {
              setEditingTransfer(null);
              setFormData({
                date: new Date().toISOString().slice(0, 10),
                amount: 0,
                from_payment_method_id: '',
                to_payment_method_id: '',
                description: '',
                transfer_number: ''
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            <span>{language === 'ar' ? 'تحويل جديد' : 'New Transfer'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input 
              type="text" 
              placeholder={language === 'ar' ? 'بحث في التحويلات...' : 'Search transfers...'} 
              className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 shadow-inner w-fit">
            <button
              onClick={() => setView('table')}
              className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
              title="عرض الجدول"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setView('card')}
              className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
              title="عرض الكروت"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {view === 'table' ? (
          <div className="overflow-x-auto" ref={tableRef}>
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-zinc-50/50">
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100 cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      التاريخ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100 cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('transfer_number')}>
                    <div className="flex items-center gap-1">
                      رقم التحويل
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'transfer_number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100 cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('from_payment_method_name')}>
                    <div className="flex items-center gap-1">
                      من خزينة
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'from_payment_method_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100 cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('to_payment_method_name')}>
                    <div className="flex items-center gap-1">
                      إلى خزينة
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'to_payment_method_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100 cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('amount')}>
                    <div className="flex items-center gap-1">
                      المبلغ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100">{language === 'ar' ? 'رقم القيد' : 'Entry No.'}</th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100">{t('common.description')}</th>
                  <th className="px-6 py-4 text-sm font-bold text-zinc-700 uppercase tracking-tighter border-b border-zinc-100">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredTransfers.map((transfer) => (
                  <tr 
                    key={transfer.id} 
                    className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                    onClick={() => {
                      setEditingTransfer(transfer);
                      setFormData({
                        date: transfer.date ? transfer.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
                        amount: Number(transfer.amount) || 0,
                        from_payment_method_id: transfer.from_payment_method_id,
                        to_payment_method_id: transfer.to_payment_method_id,
                        description: transfer.description,
                        transfer_number: transfer.transfer_number || ''
                      });
                      setIsModalOpen(true);
                    }}
                  >
                    <td className="px-6 py-4 text-zinc-900 font-bold">{formatDate(transfer.date)}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-zinc-50 px-2 py-1 rounded text-zinc-600 font-bold border border-zinc-100">
                        {transfer.transfer_number || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                          <Wallet size={16} />
                        </div>
                        <span className="text-zinc-700 font-bold">{transfer.from_payment_method_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                          <Wallet size={16} />
                        </div>
                        <span className="text-zinc-700 font-bold">{transfer.to_payment_method_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-emerald-600 font-black">{formatNumber(transfer.amount)} {t('common.currency')}</span>
                    </td>
                    <td className="px-6 py-4">
                      {transfer.entry_number ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingViewDoc({ type: 'journal', idOrNumber: transfer.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 transition-all active:scale-95 animate-in fade-in"
                        >
                          {transfer.entry_number}
                        </button>
                      ) : (
                        <span className="text-zinc-400 font-mono text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-500 font-medium max-w-xs truncate">{transfer.description}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewTransfer(transfer);
                            setShowSidePanel(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                          title="عرض التفاصيل"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTransfer(transfer);
                            setFormData({
                              date: transfer.date ? transfer.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
                              amount: Number(transfer.amount) || 0,
                              from_payment_method_id: transfer.from_payment_method_id,
                              to_payment_method_id: transfer.to_payment_method_id,
                              description: transfer.description,
                              transfer_number: transfer.transfer_number || ''
                            });
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                          title="تعديل"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransferToDelete(transfer.id);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="حذف"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTransfers.map((transfer) => (
              <div 
                key={transfer.id} 
                className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between"
                onClick={() => {
                  setEditingTransfer(transfer);
                  setFormData({
                    date: transfer.date ? transfer.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
                    amount: Number(transfer.amount) || 0,
                    from_payment_method_id: transfer.from_payment_method_id,
                    to_payment_method_id: transfer.to_payment_method_id,
                    description: transfer.description,
                    transfer_number: transfer.transfer_number || ''
                  });
                  setIsModalOpen(true);
                }}
              >
                <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewTransfer(transfer);
                      setShowSidePanel(true);
                    }}
                    className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTransfer(transfer);
                      setFormData({
                        date: transfer.date ? transfer.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
                        amount: Number(transfer.amount) || 0,
                        from_payment_method_id: transfer.from_payment_method_id,
                        to_payment_method_id: transfer.to_payment_method_id,
                        description: transfer.description,
                        transfer_number: transfer.transfer_number || ''
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-2 bg-white text-blue-500 rounded-xl border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTransferToDelete(transfer.id);
                      setIsDeleteModalOpen(true);
                    }}
                    className="p-2 bg-white text-red-500 rounded-xl border border-red-50 shadow-sm hover:bg-red-50 transition-all font-bold"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="flex flex-col h-full justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-100/60 pb-2">
                      <div className="flex flex-col text-right">
                        <span className="text-xs text-zinc-400 font-semibold">{formatDate(transfer.date)}</span>
                        {transfer.transfer_number && (
                          <span className="font-mono text-[10px] text-emerald-700 font-bold mt-0.5">{transfer.transfer_number}</span>
                        )}
                      </div>
                      {transfer.entry_number && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingViewDoc({ type: 'journal', idOrNumber: transfer.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="font-mono text-[9px] bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded text-emerald-700 font-bold border border-emerald-100/50 transition-all active:scale-95 z-10"
                        >
                          {transfer.entry_number}
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 justify-between">
                        <span className="text-xs text-zinc-400">{language === 'ar' ? 'من خزينة:' : 'From Safe:'}</span>
                        <span className="text-xs font-semibold text-zinc-700 bg-zinc-100 rounded-lg px-2 py-1">{transfer.from_payment_method_name}</span>
                      </div>
                      <div className="flex items-center gap-2 justify-between">
                        <span className="text-xs text-zinc-400 font-bold text-emerald-600">{language === 'ar' ? 'إلى خزينة:' : 'To Safe:'}</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">{transfer.to_payment_method_name}</span>
                      </div>
                    </div>

                    {transfer.description && (
                      <p className="text-xs text-zinc-500 font-medium max-w-xs truncate border-t border-zinc-100/60 pt-2">{transfer.description}</p>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-zinc-500 text-xs font-bold">{language === 'ar' ? 'المبلغ المحول' : 'Transferred Amount'}</span>
                    <span className="font-black text-emerald-600 text-lg">
                      {formatNumber(transfer.amount)} ج.م
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
      </div>

      {/* Add/Edit Transfer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className={`fixed inset-0 bg-zinc-100 dark:bg-zinc-900 z-[100] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 ${isFullScreen ? 'm-0 rounded-none' : 'md:m-4 md:rounded-[2.5rem] shadow-2xl border border-white/20'}`}>
            {/* Header Block */}
            <div className="p-4 md:p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[90]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={closeModal}
                  className="p-3 hover:bg-zinc-100 rounded-2xl transition-all text-zinc-400 hover:text-zinc-900 group"
                >
                  <div className="flex items-center gap-2">
                     <RotateCcw className={`w-5 h-5 transition-transform group-hover:-rotate-45`} />
                    <span className="text-sm font-bold">عودة</span>
                  </div>
                </button>
                <div className="w-px h-6 bg-zinc-200 mx-2" />
                <button
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    showSidePanel 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' 
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 border-transparent'
                  } border`}
                >
                  <History size={18} />
                  <span>language === 'ar' ? 'قيد اليومية \\ سجل التعديلات' : 'Journal Entry \\ Activity Log'</span>
                </button>
              </div>

              <div className="flex items-center gap-4">
                {editingTransfer && (
                  <div className="hidden lg:flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl">
                    <button 
                      type="button"
                      onClick={handlePrevTransfer}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                      disabled={transfers.findIndex(t => t.id === editingTransfer.id) === 0}
                    >
                      <ChevronRight size={16} />
                      {language === 'ar' ? 'السابق' : 'Prev'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleNextTransfer}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                      disabled={transfers.findIndex(t => t.id === editingTransfer.id) === transfers.length - 1}
                    >
                      {language === 'ar' ? 'التالي' : 'Next'}
                      <ChevronLeft size={16} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-xl transition-all hidden md:block"
                  title={isFullScreen ? 'تصغير' : 'تكبير'}
                >
                  {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
                <h3 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                  {editingTransfer ? 'تعديل عملية تحويل' : 'عملية تحويل نقدية جديدة'}
                </h3>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
              {/* Side Panel for Activity Log and Journal Entry */}
              <AnimatePresence>
                {showSidePanel && (
                  <motion.div 
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="absolute inset-y-0 right-0 z-[80] w-full lg:w-[28rem] shadow-2xl lg:shadow-none lg:relative lg:inset-auto"
                  >
                    <div className="h-full bg-white border-l border-zinc-100 flex flex-col">
                      <div className="p-4 border-b border-zinc-100 flex items-center justify-between lg:hidden">
                        <h3 className="font-bold text-zinc-900 italic">{language === 'ar' ? 'سجل النشاط والقيد' : 'Activity & Journal Log'}</h3>
                        <button onClick={() => setShowSidePanel(false)} className="p-2 text-zinc-400 hover:text-zinc-600">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <TransactionSidePanel 
                          documentId={editingTransfer?.id} 
                          category="cash_transfers"
                          previewJournalEntry={previewJournalEntry}
                          previewActivityLog={previewActivityLog}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
                <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto w-full pb-32 md:pb-8">
                  <SmartAIInput 
                    onDataExtracted={(data) => {
                      if (data.amount) setFormData(prev => ({ ...prev, amount: data.amount! }));
                      if (data.date) setFormData(prev => ({ ...prev, date: data.date! }));
                      if (data.description) setFormData(prev => ({ ...prev, description: data.description! }));
                      if (data.fromAccount) {
                        const pm = paymentMethods.find(p => p.name.includes(data.fromAccount!) || data.fromAccount!.includes(p.name));
                        if (pm) setFormData(prev => ({ ...prev, from_payment_method_id: pm.id }));
                      }
                      if (data.toAccount) {
                        const pm = paymentMethods.find(p => p.name.includes(data.toAccount!) || data.toAccount!.includes(p.name));
                        if (pm) setFormData(prev => ({ ...prev, to_payment_method_id: pm.id }));
                      }
                    }}
                    transactionType="cash_transfer"
                  />
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Basic Details Card */}
                    <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-zinc-100 shadow-sm space-y-6 relative pt-12 overflow-hidden">
                      <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        <Calendar className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'التفاصيل الأساسية' : 'Basic Details'}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{language === 'ar' ? 'رقم التحويل' : 'Transfer No.'}</label>
                          <div className="relative group">
                            <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-emerald-500 pointer-events-none transition-colors`} />
                            <input 
                              readOnly
                              type="text" 
                              className="w-full ps-12 pe-4 py-3 bg-emerald-50/50 border border-transparent rounded-2xl outline-none transition-all font-mono font-bold text-emerald-800 text-sm"
                              value={formData.transfer_number || (language === 'ar' ? 'تلقائي' : 'Automatic')}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{language === 'ar' ? 'تاريخ التحويل' : 'Transfer Date'}</label>
                          <div className="relative group">
                            <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors`} />
                            <input 
                              required
                              type="date" 
                              className="w-full ps-12 pe-4 py-3 bg-zinc-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm"
                              value={formData.date}
                              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                          </div>
                        </div>

                        {editingTransfer?.entry_number && (
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{language === 'ar' ? 'رقم القيد المرتبط' : 'Linked Journal Entry'}</label>
                            <div className="relative group">
                              <Layers className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-emerald-500 pointer-events-none transition-colors`} />
                              <input 
                                readOnly
                                type="text"
                                className="w-full ps-12 pe-4 py-3 bg-emerald-50 border border-transparent rounded-2xl outline-none transition-all font-bold text-emerald-800 text-sm"
                                value={editingTransfer.entry_number}
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{t('common.amount')}</label>
                          <div className="relative group">
                            <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors`} />
                            <input 
                              required
                              type="text" 
                              placeholder="0.00"
                              className="w-full ps-12 pe-4 py-3 bg-zinc-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500 outline-none transition-all font-black text-emerald-600 text-lg"
                              value={isAmountFocused ? (formData.amount || '') : formatNumber(formData.amount)}
                              onFocus={() => setIsAmountFocused(true)}
                              onBlur={() => {
                                setIsAmountFocused(false);
                                const cleanVal = parseNumber(formData.amount);
                                setFormData({ ...formData, amount: cleanVal });
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^[0-9.,]*$/.test(val)) {
                                  setFormData({ ...formData, amount: val as any });
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">{t('common.notes')}</label>
                        <div className="relative group">
                          <FileText className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors`} />
                          <textarea 
                            className="w-full ps-12 pe-4 py-3 bg-zinc-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm min-h-[100px] resize-none"
                            rows={3}
                            placeholder={language === 'ar' ? 'وصف إضافي لعملية التحويل...' : 'Additional description for the transfer...'}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          />
                        </div>
                      </div>
                    </section>

                    {/* Treasury Selection Card */}
                    <div className="space-y-6">
                      <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-zinc-100 shadow-sm space-y-6 relative pt-12 overflow-hidden">
                        <div className="absolute top-4 right-4 flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                          <Wallet className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{language === 'ar' ? 'من خزينة (المصدر)' : 'From Safe (Source)'}</span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2 italic font-serif tracking-widest uppercase mb-1">{language === 'ar' ? 'اختر المصدر' : 'Select Source'}</label>
                            <button 
                              type="button"
                              onClick={() => setIsPaymentMethodModalOpen(true)}
                              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                            >
                              <Plus size={14} />
                              {language === 'ar' ? 'إضافة خزينة' : 'Add Safe'}
                            </button>
                          </div>
                          <div className="relative group">
                            <Wallet className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none group-focus-within:text-red-500 transition-colors`} />
                            <select
                              required
                              className="w-full ps-12 pe-10 py-3 bg-zinc-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:bg-white focus:border-red-500 outline-none transition-all appearance-none font-bold text-zinc-800"
                              value={formData.from_payment_method_id}
                              onChange={(e) => setFormData({ ...formData, from_payment_method_id: e.target.value })}
                            >
                              <option value="">{language === 'ar' ? 'اختر الخزينة المصدر...' : 'Select Source Safe...'}</option>
                              {paymentMethods.map(pm => (
                                <option key={pm.id} value={pm.id}>{pm.name}</option>
                              ))}
                            </select>
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 transition-transform group-focus-within:rotate-180`} />
                          </div>
                        </div>
                      </section>

                      <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-zinc-100 shadow-sm space-y-6 relative pt-12 overflow-hidden">
                        <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                          <Wallet className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest tracking-widest uppercase mb-1">{language === 'ar' ? 'إلى خزينة (الوجهة)' : 'To Safe (Destination)'}</span>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2 italic font-serif tracking-widest uppercase mb-1 px-2 italic font-serif tracking-widest uppercase mb-1 tracking-widest uppercase mb-1 px-2 italic font-serif tracking-widest uppercase mb-1">{language === 'ar' ? 'اختر الوجهة' : 'Select Destination'}</label>
                          <div className="relative group text-emerald-600">
                            <Wallet className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors`} />
                            <select
                              required
                              className="w-full ps-12 pe-10 py-3 bg-zinc-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500 outline-none transition-all appearance-none font-bold text-zinc-800"
                              value={formData.to_payment_method_id}
                              onChange={(e) => setFormData({ ...formData, to_payment_method_id: e.target.value })}
                            >
                              <option value="">{language === 'ar' ? 'اختر الخزينة الوجهة...' : 'Select Destination Safe...'}</option>
                              {paymentMethods.map(pm => (
                                <option key={pm.id} value={pm.id}>{pm.name}</option>
                              ))}
                            </select>
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 transition-transform group-focus-within:rotate-180 text-emerald-600`} />
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="flex gap-4 p-6 bg-transparent border-t border-zinc-100 sticky bottom-4 z-[90] mt-auto max-w-4xl mx-auto w-full">
                    <button 
                      type="button"
                      onClick={closeModal}
                      className="flex-1 py-4 bg-white text-zinc-600 rounded-[1.5rem] font-bold border border-zinc-200 hover:bg-zinc-100 transition-all active:scale-95 shadow-lg shadow-black/5"
                    >
                      {t('common.cancel')}
                    </button>
                    <button 
                      type="submit"
                      disabled={formData.amount <= 0 || !formData.from_payment_method_id || !formData.to_payment_method_id}
                      className="flex-[2] py-4 bg-emerald-500 text-white rounded-[1.5rem] font-black uppercase tracking-wider hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/30 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                    >
                      <Save className="w-6 h-6 animate-pulse" />
                      <span>{editingTransfer ? t('common.save') : (language === 'ar' ? 'إبرام التحويل' : 'Execute Transfer')}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">{language === 'ar' ? 'حذف التحويل؟' : 'Delete Transfer?'}</h3>
              <p className="text-zinc-500 mb-8 font-medium">{language === 'ar' ? 'هل أنت متأكد من حذف هذه العملية؟ سيتم حذف القيد المحاسبي المرتبط بها أيضاً.' : 'Are you sure you want to delete this transfer? The associated journal entry will also be deleted.'}</p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all active:scale-95"
                >
                  {language === 'ar' ? 'نعم، احذف' : 'Yes, Delete'}
                </button>
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Payment Method Modal (Treasury) */}
      <AnimatePresence>
        {isPaymentMethodModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-zinc-900">{language === 'ar' ? 'إضافة خزينة جديدة' : 'Add New Safe'}</h3>
                <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
              </div>
              
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                <form onSubmit={handlePaymentMethodSubmit} className="p-8 space-y-6 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'كود الخزينة' : 'Safe Code'}</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input
                          required
                          type="text"
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                          value={paymentMethodFormData.code}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, code: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'اسم الخزينة' : 'Safe Name'}</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input
                          required
                          type="text"
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                          value={paymentMethodFormData.name}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'النوع' : 'Type'}</label>
                      <div className="relative">
                        <Layers className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <select
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none font-bold"
                          value={paymentMethodFormData.type}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, type: e.target.value as any })}
                        >
                          <option value="cash">{language === 'ar' ? 'نقدي (خزينة)' : 'Cash Safe'}</option>
                          <option value="bank">{language === 'ar' ? 'بنكي' : 'Bank Account'}</option>
                          <option value="wallet">{language === 'ar' ? 'محفظة إلكترونية' : 'Electronic Wallet'}</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'الحساب المحاسبي' : 'Ledger Account'}</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                        value={paymentMethodFormData.account_id}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, account_id: e.target.value })}
                      >
                        <option value="">{language === 'ar' ? 'اختر الحساب...' : 'Select Account...'}</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                          value={paymentMethodFormData.opening_balance}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'تاريخ الرصيد' : 'Opening Date'}</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="date" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                          value={paymentMethodFormData.opening_balance_date}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {paymentMethodFormData.opening_balance !== 0 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-zinc-700 uppercase tracking-tighter">{language === 'ar' ? 'حساب الطرف الآخر (للرصيد الافتتاحي)' : 'Counter Account (Opening)'}</label>
                        <select
                          required
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all border-emerald-200 bg-emerald-50/30 font-bold"
                          value={paymentMethodFormData.counter_account_id}
                          onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, counter_account_id: e.target.value })}
                        >
                          <option value="">{language === 'ar' ? 'اختر حساب الطرف الآخر...' : 'Select Counter Account...'}</option>
                          {accounts.map(account => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {paymentMethodFormData.counter_account_id && paymentMethodFormData.account_id && (
                        <JournalEntryPreview 
                          title={language === 'ar' ? 'معاينة قيد الرصيد الافتتاحي' : 'Preview Opening Balance JE'}
                          items={[
                            {
                              account_name: accounts.find(a => a.id === paymentMethodFormData.account_id)?.name || 'حساب طريقة الدفع',
                              debit: paymentMethodFormData.opening_balance > 0 ? paymentMethodFormData.opening_balance : 0,
                              credit: paymentMethodFormData.opening_balance < 0 ? Math.abs(paymentMethodFormData.opening_balance) : 0,
                              description: 'رصيد افتتاحي'
                            },
                            {
                              account_name: accounts.find(a => a.id === paymentMethodFormData.counter_account_id)?.name || 'حساب الطرف الآخر',
                              debit: paymentMethodFormData.opening_balance < 0 ? Math.abs(paymentMethodFormData.opening_balance) : 0,
                              credit: paymentMethodFormData.opening_balance > 0 ? paymentMethodFormData.opening_balance : 0,
                              description: `رصيد افتتاحي للخزينة: ${paymentMethodFormData.name}`
                            }
                          ]}
                        />
                      )}
                    </div>
                  )}

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      حفظ الخزينة
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsPaymentMethodModalOpen(false)}
                      className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Side Panel for View */}
      <AnimatePresence>
        {showSidePanel && viewTransfer && (
          <div className="fixed inset-0 z-[110] flex justify-end bg-zinc-900/20 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">تفاصيل عملية التحويل</h3>
                <button onClick={() => setShowSidePanel(false)} className="p-2 hover:bg-zinc-100 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="flex items-center justify-between p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                  <div>
                    <p className="text-sm font-bold text-zinc-500 uppercase tracking-tighter mb-1">المبلغ المحول</p>
                    <p className="text-3xl font-black text-emerald-600">{formatNumber(viewTransfer.amount)} ج.م</p>
                  </div>
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                    <ArrowLeftRight size={32} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">من خزينة</p>
                    <p className="font-bold text-zinc-900">{viewTransfer.from_payment_method_name}</p>
                  </div>
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">إلى خزينة</p>
                    <p className="font-bold text-zinc-900">{viewTransfer.to_payment_method_name}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {viewTransfer.transfer_number && (
                    <div className="flex items-center gap-3 text-zinc-600">
                      <Hash size={18} className="text-zinc-400" />
                      <span className="font-bold">رقم التحويل:</span>
                      <span className="font-mono font-bold bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100">
                        {viewTransfer.transfer_number}
                      </span>
                    </div>
                  )}
                  {viewTransfer.entry_number && (
                    <div className="flex items-center gap-3 text-zinc-600">
                      <Layers size={18} className="text-zinc-400" />
                      <span className="font-bold">رقم القيد:</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSidePanel(false);
                          setPendingViewDoc({ type: 'journal', idOrNumber: viewTransfer.entry_number! });
                          setCurrentPage('journal_entries');
                        }}
                        className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50"
                      >
                        {viewTransfer.entry_number}
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-zinc-600">
                    <Calendar size={18} className="text-zinc-400" />
                    <span className="font-bold">التاريخ: {formatDate(viewTransfer.date)}</span>
                  </div>
                  <div className="flex items-start gap-3 text-zinc-600">
                    <FileText size={18} className="text-zinc-400 mt-1" />
                    <div className="flex-1">
                      <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">الوصف</p>
                      <p className="font-medium leading-relaxed">{viewTransfer.description}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-100">
                  <h4 className="text-sm font-black text-zinc-900 mb-4 flex items-center gap-2">
                    <History size={16} className="text-emerald-500" />
                    سجل الحركات المرتبطة
                  </h4>
                  <InlineActivityLog category="cash_transfers" documentId={viewTransfer.id} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
