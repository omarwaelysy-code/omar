import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Customer, Account, JournalEntry, JournalEntryItem } from '../types';
import { Search, Plus, Trash2, X, Tag, User, Calendar, Save, Wallet, CreditCard, History, BookOpen, Phone, Mail, MapPin, Maximize2, Minimize2, ChevronRight, ChevronLeft, RotateCcw, ChevronDown, LayoutGrid, List, Hash, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { TransactionManager } from '../services/TransactionManager';
import { DiscountSchema, JournalEntrySchema } from '../lib/schemas';
import { ActivityLog } from '../types';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { PaginationControls } from '../components/PaginationControls';
import { ExportButtons } from '../components/ExportButtons';
import { AttachmentsManager, AttachmentItem } from '../components/common/AttachmentsManager';
import { ReversalModal } from '../components/common/ReversalModal';
import { ReversalBanner } from '../components/common/ReversalBanner';
import { useRef } from 'react';

export const CustomerDiscounts: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir, language } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reversingDiscount, setReversingDiscount] = useState<any | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const [discountToDelete, setDiscountToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'table' | 'card'>('table');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);
  const [serverSummary, setServerSummary] = useState<any>({});
  const [discountNumber, setDiscountNumber] = useState('');
  const [editingDiscount, setEditingDiscount] = useState<any | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [accountSource, setAccountSource] = useState<'discount' | 'custom'>('discount');
  const [discountAccountId, setDiscountAccountId] = useState('');
  const [customAccountId, setCustomAccountId] = useState('');
  const [copiedDocNumber, setCopiedDocNumber] = useState(false);
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleCopyDocNumber = () => {
    const num = editingDiscount?.number || discountNumber;
    if (num) {
      navigator.clipboard.writeText(num);
      setCopiedDocNumber(true);
      setTimeout(() => setCopiedDocNumber(false), 2000);
      showNotification(language === 'ar' ? 'تم نسخ رقم المستند بنجاح' : 'Document number copied', 'success');
    }
  };

  const toggleSelectAll = () => {
    if (filteredDiscounts.length > 0 && selectedIds.length === filteredDiscounts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDiscounts.map(d => d.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0 || !user) return;
    if (!window.confirm(language === 'ar' ? `هل أنت متأكد من حذف ${selectedIds.length} خصم محدد؟` : `Delete ${selectedIds.length} selected discounts?`)) return;
    try {
      for (const id of selectedIds) {
        await dbService.deleteJournalEntryByReference(id, user.company_id);
        await dbService.delete('customer_discounts', id);
      }
      setSelectedIds([]);
      showNotification(language === 'ar' ? 'تم حذف الخصومات المحددة بنجاح' : 'Selected discounts deleted successfully', 'success');
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || 'Error deleting discounts', 'error');
    }
  };

  const handleExportExcel = (onlySelected = false) => {
    const list = onlySelected ? discounts.filter(d => selectedIds.includes(d.id)) : discounts;
    const formattedData = list.map(d => ({
      'رقم المستند': d.number || '-',
      'العميل': d.customer_name || '-',
      'الحساب': accounts.find(a => a.id === d.account_id)?.name || d.account_name || '-',
      'التاريخ': formatDate(d.date),
      'المبلغ': d.amount,
      'البيان': d.notes || '-'
    }));
    exportToExcel(formattedData, { filename: onlySelected ? 'Selected_Customer_Discounts' : 'Customer_Discounts', sheetName: 'خصم العملاء' });
  };

  const handleExportPDF = async (onlySelected = false) => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, {
        filename: onlySelected ? 'Selected_Customer_Discounts' : 'Customer_Discounts',
        reportTitle: onlySelected ? 'إشعارات خصم العملاء المحددة' : 'إشعارات خصم العملاء'
      });
    }
  };

  const generateDiscountNumber = async (selectedDate: string) => {
    return await dbService.getNextSequence('customer_discounts', selectedDate);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsSubmitting(false);
    setEditingDiscount(null);
    setAttachments([]);
    setIsAmountFocused(false);
    const defaultAcc = settings?.customer_discount_account_id || accounts.find(a => a.account_usage === 'sales_discount' || a.account_usage === 'earned_discounts')?.id || '';
    setAccountSource('discount');
    setDiscountAccountId(defaultAcc);
    setCustomAccountId('');
    setDiscountData({
      customer_id: '',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      account_id: defaultAcc,
      notes: ''
    });
  };

  const openEditModal = (discount: any) => {
    setEditingDiscount(discount);
    setIsAmountFocused(false);
    const accId = discount.account_id || '';
    const isDiscountAcc = accounts.some(a => a.id === accId && (a.account_usage === 'earned_discounts' || a.account_usage === 'sales_discount' || a.name?.includes('خصم')));
    
    if (accId) {
      if (isDiscountAcc) {
        setAccountSource('discount');
        setDiscountAccountId(accId);
        setCustomAccountId('');
      } else {
        setAccountSource('custom');
        setCustomAccountId(accId);
        setDiscountAccountId(settings?.customer_discount_account_id || accounts.find(a => a.account_usage === 'sales_discount' || a.account_usage === 'earned_discounts')?.id || '');
      }
    } else {
      const defAcc = settings?.customer_discount_account_id || accounts.find(a => a.account_usage === 'sales_discount' || a.account_usage === 'earned_discounts')?.id || '';
      setAccountSource('discount');
      setDiscountAccountId(defAcc);
      setCustomAccountId('');
    }

    const docNum = discount.number || discount.discount_number || '';
    setDiscountNumber(docNum);
    if (!docNum && discount.date) {
      generateDiscountNumber(discount.date).then(num => {
        if (num) setDiscountNumber(num);
      });
    }

    const numAmount = parseFloat(String(discount.amount || 0));
    setDiscountData({
      customer_id: discount.customer_id,
      amount: numAmount,
      date: discount.date ? discount.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      account_id: accId || settings?.customer_discount_account_id || '',
      notes: discount.notes || ''
    });
    setAttachments(Array.isArray(discount.attachments) ? discount.attachments : []);
    setIsModalOpen(true);
  };

  const handlePrevDiscount = () => {
    if (!editingDiscount) return;
    const currentIndex = discounts.findIndex(d => d.id === editingDiscount.id);
    if (currentIndex > 0) {
      openEditModal(discounts[currentIndex - 1]);
    }
  };

  const handleNextDiscount = () => {
    if (!editingDiscount) return;
    const currentIndex = discounts.findIndex(d => d.id === editingDiscount.id);
    if (currentIndex < discounts.length - 1) {
      openEditModal(discounts[currentIndex + 1]);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };
  
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    mobile: '', 
    address: '', 
    email: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: ''
  });
  
  const [discountData, setDiscountData] = useState({
    customer_id: '',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    account_id: '',
    notes: ''
  });

  useEffect(() => {
    if (user) {
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubDiscounts = dbService.subscribePaginated('customer_discounts', {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm
      }, (result: any) => {
        setDiscounts(result.data);
        setTotalRecords(result.total);
        setServerSummary(result.summary);
      });
      
      const fetchSettings = async () => {
        const docs = await dbService.getDocsByFilter<any>('settings', user.company_id, [
          { field: 'type', operator: '==', value: 'discount_settings' }
        ]);
        if (docs.length > 0) {
          setSettings(docs[0]);
          const defAccount = docs[0].customer_discount_account_id || '';
          setDiscountAccountId(defAccount);
          setDiscountData(prev => ({ ...prev, account_id: prev.account_id || defAccount }));
        }
      };

      fetchSettings();
      setLoading(false);
      return () => {
        unsubCustomers();
        unsubAccounts();
        unsubDiscounts();
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

    if (isModalOpen) {
      const updateNum = async () => {
        const num = await generateDiscountNumber(discountData.date);
        setDiscountNumber(num);
      };
      updateNum();
    }

    const generatePreview = () => {
      if (discountData.amount <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const customer = customers.find(c => c.id === discountData.customer_id);
      const discount_number = 'CDISC-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة خصم عميل',
        details: `إضافة خصم جديد للعميل ${customer?.name || '...'} بمبلغ ${formatNumber(discountData.amount)}`,
        created_at: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Selected Account (or Sales Discount Account)
      const debitAccount = accounts.find(a => a.id === discountData.account_id);
      const debitAccountId = debitAccount?.id || '';
      const debitAccountName = debitAccount?.name || 'حساب الخصم المسموح به';

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: discountData.amount,
        credit: 0,
        description: `خصم مسموح به رقم ${discount_number} - ${customer?.name || '...'}`
      });

      // Credit: Customer
      let creditAccountId = customer?.account_id || '';
      let creditAccountName = customer?.account_name || 'حساب العملاء';

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: discountData.amount,
        description: `خصم مسموح به رقم ${discount_number} - ${customer?.name || '...'}`
      });

      setPreviewJournalEntry({
        id: 'preview',
        date: discountData.date,
        reference_number: discount_number,
        reference_id: 'preview',
        reference_type: 'customer_discount',
        description: `قيد خصم مسموح به رقم ${discount_number}`,
        items: journalItems,
        total_debit: discountData.amount,
        total_credit: discountData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, discountData, user, customers, accounts]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const code = `CUST-${Date.now().toString().slice(-6)}`;
      const selectedAccount = accounts.find(a => a.id === newCustomer.account_id);
      const dataToSave = {
        ...newCustomer,
        code,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };
      const id = await dbService.add('customers', dataToSave);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة عميل', `إضافة عميل جديد من شاشة الخصومات: ${newCustomer.name}`, ['customers', 'discounts']);
      
      setDiscountData({ ...discountData, customer_id: id });
      setIsCustomerModalOpen(false);
      setNewCustomer({ 
        name: '', 
        mobile: '', 
        address: '', 
        email: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: ''
      });
      showNotification(t('common.save_success'));
    } catch (e) {
      console.error(e);
      showNotification(t('common.error'), 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    const customer = customers.find(c => c.id === discountData.customer_id);
    if (!customer?.account_id) {
      showNotification(`لا يمكن حفظ الخصم — العميل "${customer?.name || ''}" لا يملك حساباً محاسبياً مربوطاً. يرجى فتح بيانات العميل وتحديد الحساب المحاسبي.`, 'error');
      return;
    }
    if (!discountData.account_id) {
      showNotification('لا يمكن حفظ الخصم — يرجى اختيار حساب الخصم المحاسبي.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find(c => c.id === discountData.customer_id);
      const number = editingDiscount?.number || discountNumber;
      
      const selectedAccId = accountSource === 'discount' ? discountAccountId : customAccountId;
      const effectiveAccountId = selectedAccId || discountData.account_id;
      const discountAccount = accounts.find(a => a.id === effectiveAccountId);
      const debitAccountId = discountAccount?.id || effectiveAccountId;
      const debitAccountName = discountAccount?.name || (accountSource === 'discount' ? 'حساب الخصم المسموح به' : 'حساب آخر');

      const data = {
        customer_id: discountData.customer_id,
        customer_name: customer?.name || '',
        amount: discountData.amount,
        date: discountData.date,
        account_id: debitAccountId,
        account_name: debitAccountName,
        notes: discountData.notes,
        attachments,
        number,
        type: 'customer',
        company_id: user.company_id,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      };

      if (!editingDiscount) {
        (data as any).created_at = new Date().toISOString();
        (data as any).created_by = user.id;
      }

      const journalItems: any[] = [];

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: discountData.amount,
        credit: 0,
        description: `خصم مسموح به للعميل: ${customer?.name} - رقم ${number}`
      });

      let creditAccountId = customer?.account_id || '';
      let creditAccountName = customer?.account_name || 'حساب العملاء';

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: discountData.amount,
        description: `خصم مسموح به رقم ${number}`,
        customer_id: discountData.customer_id,
        customer_name: customer?.name
      });

      const journalEntryData = {
        date: discountData.date,
        reference_number: number,
        reference_type: 'customer_discount',
        description: `قيد خصم مسموح به رقم ${number}`,
        items: journalItems,
        total_debit: discountData.amount,
        total_credit: discountData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      };

      if (editingDiscount) {
        await TransactionManager.updateWithAccounting(
          'customer_discounts',
          editingDiscount.id,
          data,
          DiscountSchema,
          journalEntryData,
          JournalEntrySchema
        );
        showNotification(t('discounts.toast_success'), 'success');
      } else {
        await TransactionManager.saveWithAccounting(
          'customer_discounts',
          data,
          DiscountSchema,
          journalEntryData,
          JournalEntrySchema
        );
        showNotification('تم إضافة الخصم بنجاح', 'success');
      }

      closeModal();
      dbService.logActivity(user.id, user.username, user.company_id, editingDiscount ? 'تعديل خصم عميل' : 'إضافة خصم عميل', `${editingDiscount ? 'تعديل' : 'إضافة'} خصم للعميل: ${customer?.name} بمبلغ: ${discountData.amount}`, 'customer_discounts');
    } catch (e: any) {
      console.error('Save failed:', e);
      showNotification(e.message || t('discounts.toast_error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDiscountToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const openAddModal = () => {
    setEditingDiscount(null);
    setDiscountData({
      customer_id: '',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      account_id: settings?.customer_discount_account_id || '',
      notes: ''
    });
    generateDiscountNumber(new Date().toISOString().slice(0, 10)).then(setDiscountNumber);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!discountToDelete || !user) return;
    try {
      const disc = discounts.find(d => d.id === discountToDelete);
      
      // Delete associated journal entry
      await dbService.deleteJournalEntryByReference(discountToDelete, user.company_id);
      
      await dbService.delete('customer_discounts', discountToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف خصم عميل', `حذف خصم للعميل: ${disc?.customer_name} بمبلغ: ${disc?.amount}`);
      setIsDeleteModalOpen(false);
      setDiscountToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredDiscounts = discounts.filter(d => 
    d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-3 animate-in fade-in duration-500" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2.5 border-b border-slate-200/80">
            <div>
              <h1 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <span>{t('discounts.customer_title')}</span>
                {serverSummary.total_amount !== undefined && (
                  <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-lg border border-emerald-100 text-xs font-bold">
                    {t('discounts.total_discounts')}: {formatMoney(serverSummary.total_amount)} {t('common.currency')}
                  </span>
                )}
              </h1>
              <p className="text-slate-400 text-xs font-medium mt-0.5">{t('discounts.customer_subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 justify-end">
              <button 
                onClick={openAddModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95"
              >
                <Plus size={14} />
                <span>{t('discounts.add_customer')}</span>
              </button>
              <ExportButtons 
                size="sm"
                onExportExcel={() => handleExportExcel(false)} 
                onExportPDF={() => handleExportPDF(false)} 
                onPrint={() => printElement(tableRef.current, 'إشعارات خصم العملاء')}
                onExportExcelSelected={() => handleExportExcel(true)}
                onExportPDFSelected={() => handleExportPDF(true)}
                onPrintSelected={() => printElement(tableRef.current, 'إشعارات خصم العملاء المحددة')}
                selectedCount={selectedIds.length}
              />
              <button 
                onClick={() => setIsActivityLogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95"
              >
                <History size={14} />
                <span>{t('common.activity_log')}</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-2 sm:p-2.5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="relative flex-1 w-full sm:max-w-md">
                <input
                  type="text"
                  placeholder={t('discounts.search_placeholder')}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {selectedIds.length > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold border border-rose-200 transition-all"
                  >
                    <Trash2 size={13} />
                    <span>حذف المحدد ({selectedIds.length})</span>
                  </button>
                )}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/70 w-fit">
                  <button
                    onClick={() => setView('table')}
                    className={`p-1.5 px-2.5 rounded-md transition-all flex items-center gap-1 font-bold text-xs ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    title="عرض الجدول"
                  >
                    <List size={14} />
                    <span className="hidden sm:inline">{t('discounts.tab_single')}</span>
                  </button>
                  <button
                    onClick={() => setView('card')}
                    className={`p-1.5 px-2.5 rounded-md transition-all flex items-center gap-1 font-bold text-xs ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    title="عرض الكروت"
                  >
                    <LayoutGrid size={14} />
                    <span className="hidden sm:inline">{t('discounts.tab_cards')}</span>
                  </button>
                </div>
              </div>
            </div>

            {view === 'table' ? (
              <div className="overflow-x-auto">
                <table ref={tableRef} className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold">
                      <th className="w-10 px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={filteredDiscounts.length > 0 && selectedIds.length === filteredDiscounts.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer align-middle"
                          title="تحديد الكل"
                        />
                      </th>
                      <th className="px-3 py-1.5 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('number')}>
                        <div className="flex items-center gap-1">
                          <span>رقم المستند</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'number' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className="px-3 py-1.5 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('customer_name')}>
                        <div className="flex items-center gap-1">
                          <span>{t('discounts.column_customer')}</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'customer_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className="px-3 py-1.5 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('account_id')}>
                        <div className="flex items-center gap-1">
                          <span>الحساب</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'account_id' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className="px-3 py-1.5 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('date')}>
                        <div className="flex items-center gap-1">
                          <span>{t('discounts.column_date')}</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className="px-3 py-1.5 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('amount')}>
                        <div className="flex items-center gap-1">
                          <span>{t('discounts.column_amount')}</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {sortBy === 'amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                          </span>
                        </div>
                      </th>
                      <th className="px-3 py-1.5 font-bold">{t('discounts.column_notes')}</th>
                      <th className="px-3 py-1.5 font-bold text-center w-28">{t('discounts.column_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {filteredDiscounts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">لا توجد خصومات حالياً</td>
                      </tr>
                    ) : filteredDiscounts.map((discount) => (
                      <tr key={discount.id} className="hover:bg-slate-50/70 transition-colors group cursor-pointer" onClick={() => openEditModal(discount)}>
                        <td className="w-10 px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(discount.id)}
                            onChange={() => toggleSelectRow(discount.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer align-middle"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 text-xs">
                          {discount.number || '-'}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900 text-xs">
                          {discount.customer_name}
                        </td>
                        <td className="px-3 py-2 text-slate-600 font-medium text-xs">
                          {accounts.find(a => a.id === discount.account_id)?.name || discount.account_name || '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-500 font-medium text-xs">
                          {formatDate(discount.date)}
                        </td>
                        <td className="px-3 py-2 font-bold text-emerald-600 text-xs">
                          {formatNumber(discount.amount)} ج.م
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-xs truncate max-w-xs">
                          {discount.notes || '-'}
                        </td>
                        <td className="px-3 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            {/* Reversal action */}
                            {discount.is_reversed ? (
                              <span
                                className="px-2 py-0.5 bg-amber-100/80 text-amber-800 rounded-md inline-flex items-center gap-1 text-[11px] font-bold cursor-help"
                                title={language === 'ar' ? `تم عكس هذا الخصم بالمستند: ${discount.reversed_by_doc_number || ''}` : `Reversed by: ${discount.reversed_by_doc_number || ''}`}
                              >
                                <RotateCcw size={12} className="text-amber-700" />
                                <span>معكوس</span>
                              </span>
                            ) : discount.is_reversal_doc ? (
                              <span
                                className="px-2 py-0.5 bg-indigo-100/80 text-indigo-800 rounded-md inline-flex items-center gap-1 text-[11px] font-bold cursor-help"
                                title={language === 'ar' ? `إشعار خصم عكسي للمستند: ${discount.original_doc_number || ''}` : `Reversal of: ${discount.original_doc_number || ''}`}
                              >
                                <RotateCcw size={12} className="text-indigo-700" />
                                <span>عكسي</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReversingDiscount(discount);
                                }}
                                className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                title={language === 'ar' ? 'عكس الخصم (Reverse)' : 'Reverse Discount'}
                              >
                                <RotateCcw size={15} />
                              </button>
                            )}
                            {!discount.is_reversed && !discount.is_reversal_doc && (
                              <button 
                                onClick={() => openEditModal(discount)}
                                className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="تعديل"
                              >
                                <Tag size={15} />
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setActivityLogDocumentId(discount.id);
                                setIsActivityLogOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                              title="سجل النشاط"
                            >
                              <History size={15} />
                            </button>
                            {!discount.is_reversed && !discount.is_reversal_doc && (
                              <button 
                                onClick={() => handleDelete(discount.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="حذف"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
              </div>
            ) : (
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredDiscounts.map((discount) => (
                  <div 
                    key={discount.id} 
                    className="p-3.5 bg-white rounded-xl border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between space-y-2.5"
                    onClick={() => openEditModal(discount)}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(discount.id)}
                          onChange={(e) => { e.stopPropagation(); toggleSelectRow(discount.id); }}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer align-middle"
                        />
                        <span className="text-[11px] font-mono font-bold text-slate-800 bg-slate-100 rounded-md px-1.5 py-0.5">{discount.number || '-'}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">{formatDate(discount.date)}</span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2 justify-between">
                        <span className="text-slate-400 text-[11px]">العميل:</span>
                        <span className="font-bold text-slate-800">{discount.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 justify-between">
                        <span className="text-slate-400 text-[11px]">الحساب:</span>
                        <span className="text-slate-600 font-medium">{accounts.find(a => a.id === discount.account_id)?.name || discount.account_name || '-'}</span>
                      </div>
                      {discount.notes && (
                        <p className="text-[11px] text-slate-500 truncate pt-1 border-t border-slate-50">{discount.notes}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(discount);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <Tag size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivityLogDocumentId(discount.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                        >
                          <History size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(discount.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <span className="font-bold text-emerald-600 text-sm">
                        {formatNumber(discount.amount)} ج.م
                      </span>
                    </div>
                  </div>
                ))}
                {filteredDiscounts.length === 0 && (
                  <div className="col-span-full py-8 text-center text-slate-400 italic">لا توجد خصومات حالياً</div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-200 flex flex-col min-h-[80vh] relative">
          {/* Header Block with Actions */}
          <div className="p-2.5 sm:p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 sticky top-0 bg-white/95 backdrop-blur-md z-[90]">
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={closeModal}
                className="px-2.5 py-1.5 hover:bg-slate-100 rounded-xl transition-all text-slate-600 hover:text-slate-900 group font-bold text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <RotateCcw className={`w-4 h-4 transition-transform group-hover:-rotate-45`} />
                  <span>عودة</span>
                </div>
              </button>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              {editingDiscount && !editingDiscount.is_reversed && !editingDiscount.is_reversal_doc && (
                <button
                  type="button"
                  onClick={() => {
                    const d = editingDiscount;
                    closeModal();
                    setReversingDiscount(d);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all"
                >
                  <RotateCcw size={13} className="text-amber-700" />
                  <span>{language === 'ar' ? 'عكس الإشعار' : 'Reverse'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSidePanel(!showSidePanel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  showSidePanel 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-transparent'
                } border`}
              >
                <History size={14} />
                <span>قيد اليومية \ سجل التعديلات</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {editingDiscount && (
                <div className="hidden lg:flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
                  <button 
                    type="button"
                    onClick={handlePrevDiscount}
                    className="flex items-center gap-1 px-2.5 py-1 hover:bg-white rounded-lg transition-all text-zinc-600 disabled:opacity-30 text-xs font-bold"
                    disabled={filteredDiscounts.findIndex(d => d.id === editingDiscount.id) === 0}
                  >
                    <ChevronRight size={14} />
                    السابق
                  </button>
                  <button 
                    type="button"
                    onClick={handleNextDiscount}
                    className="flex items-center gap-1 px-2.5 py-1 hover:bg-white rounded-lg transition-all text-zinc-600 disabled:opacity-30 text-xs font-bold"
                    disabled={filteredDiscounts.findIndex(d => d.id === editingDiscount.id) === filteredDiscounts.length - 1}
                  >
                    التالي
                    <ChevronLeft size={14} />
                  </button>
                </div>
              )}

              {/* Action Buttons Moved to Top (انقل الزيرار لفوق) */}
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all flex items-center gap-1.5 text-xs active:scale-95"
                >
                  <X size={14} />
                  <span>{t('common.cancel')}</span>
                </button>
                <button 
                  type="submit"
                  form="customer-discount-form"
                  disabled={isSubmitting || discountData.amount <= 0 || !discountData.customer_id || !discountData.account_id}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  <Save size={14} />
                  <span>{isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (editingDiscount ? (language === 'ar' ? 'تحديث الخصم' : t('common.save')) : (language === 'ar' ? 'حفظ البيانات' : t('discounts.save_button')))}</span>
                </button>
              </div>

              <div className="h-6 w-px bg-slate-200 hidden sm:block" />

              <h3 className="text-sm md:text-base font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>{editingDiscount ? t('discounts.edit_title') : t('discounts.add_new_title')}</span>
              </h3>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full relative">
            {/* Side Panel for Activity Log and Journal Entry */}
            <AnimatePresence>
              {showSidePanel && (
                <motion.div 
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute inset-y-0 right-0 z-[80] w-full lg:w-96 shadow-2xl lg:shadow-none lg:relative lg:inset-auto"
                >
                  <div className="h-full bg-white border-l border-zinc-100 flex flex-col">
                    <div className="p-4 border-b border-zinc-100 flex items-center justify-between lg:hidden">
                      <h3 className="font-bold text-zinc-900">سجل النشاط والقيد</h3>
                      <button onClick={() => setShowSidePanel(false)} className="p-2 text-zinc-400 hover:text-zinc-600">
                        <X size={20} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <TransactionSidePanel 
                        documentId={editingDiscount?.id || ''}
                        category="customer_discounts" 
                        previewJournalEntry={previewJournalEntry}
                        previewActivityLog={previewActivityLog}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form id="customer-discount-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
              {editingDiscount && (
                <ReversalBanner
                  isReversed={editingDiscount.is_reversed}
                  reversedAt={editingDiscount.reversed_at}
                  reversalReason={editingDiscount.reversal_reason}
                  reversedByDocNumber={editingDiscount.reversed_by_doc_number}
                  reversedByEntryNumber={editingDiscount.reversed_by_entry_number}
                  reversalSettlementNumber={editingDiscount.reversal_settlement_number}
                  isReversalDoc={editingDiscount.is_reversal_doc}
                  originalDocNumber={editingDiscount.original_doc_number}
                  originalEntryNumber={editingDiscount.original_entry_number}
                />
              )}

              <div className="space-y-4">
                {/* Card: Basic Info */}
                <section className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/90 shadow-sm space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Document Number with Copy Button */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 mb-1 px-1">
                        {language === 'ar' ? 'رقم المستند' : t('discounts.discount_number')}
                      </label>
                      <div className="relative flex items-center">
                        <Hash className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none`} />
                        <input 
                          readOnly
                          type="text"
                          className={`w-full ${dir === 'rtl' ? 'pr-8 pl-8' : 'pl-8 pr-8'} py-2 bg-zinc-100/80 border border-zinc-200 rounded-xl font-mono font-bold text-zinc-700 text-xs outline-none cursor-not-allowed`}
                          value={editingDiscount?.number || discountNumber || ''}
                        />
                        <button
                          type="button"
                          onClick={handleCopyDocNumber}
                          className={`absolute ${dir === 'rtl' ? 'left-1.5' : 'right-1.5'} top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-zinc-200 shadow-sm`}
                          title={language === 'ar' ? 'نسخ رقم المستند' : 'Copy'}
                        >
                          {copiedDocNumber ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Customer */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 mb-1 px-1">
                        {t('discounts.column_customer')}
                      </label>
                      <div className="relative group">
                        <User className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none`} />
                        <select 
                          required
                          className={`w-full ${dir === 'rtl' ? 'pr-8 pl-7' : 'pl-8 pr-7'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-xs cursor-pointer`}
                          value={discountData.customer_id}
                          onChange={(e) => {
                            if (e.target.value === 'new') {
                              setIsCustomerModalOpen(true);
                            } else {
                              setDiscountData({...discountData, customer_id: e.target.value});
                            }
                          }}
                        >
                          <option value="">{t('common.select_customer')}</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                          <option value="new" className="font-bold text-emerald-600">+ إضافة عميل جديد...</option>
                        </select>
                        <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none`} />
                      </div>
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 mb-1 px-1">
                        {t('discounts.date_label')}
                      </label>
                      <div className="relative group">
                        <Calendar className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none`} />
                        <input 
                          required
                          type="date" 
                          className={`w-full ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-xs`}
                          value={discountData.date}
                          onChange={(e) => setDiscountData({...discountData, date: e.target.value})}
                        />
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <div className="flex items-center justify-between mb-1 px-1">
                        <label className="block text-xs font-bold text-zinc-600">
                          {t('discounts.amount_label')}
                        </label>
                        {discountData.amount > 0 && !isAmountFocused && (
                          <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {formatNumber(discountData.amount)} ج.م
                          </span>
                        )}
                      </div>
                      <div className="relative group">
                        <Wallet className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none`} />
                        <input 
                          required
                          type="text" 
                          inputMode="decimal"
                          className={`w-full ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-xs font-mono`}
                          placeholder="0.00"
                          value={isAmountFocused ? (discountData.amount > 0 ? String(discountData.amount) : '') : (discountData.amount > 0 ? formatNumber(discountData.amount) : '')}
                          onFocus={() => setIsAmountFocused(true)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, '');
                            if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                              const num = parseFloat(raw) || 0;
                              setDiscountData(prev => ({ ...prev, amount: num }));
                            }
                          }}
                          onBlur={() => setIsAmountFocused(false)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Alternating Account Selection (خصم العملاء مسموح به vs حساب آخر من دليل الحسابات) */}
                  <div className="pt-3 border-t border-zinc-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-700">تحديد الحساب المدين:</span>
                        <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                          <button
                            type="button"
                            onClick={() => {
                              setAccountSource('discount');
                              setDiscountData(prev => ({ ...prev, account_id: discountAccountId }));
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                              accountSource === 'discount'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-zinc-600 hover:text-zinc-900'
                            }`}
                          >
                            <span>خصم العملاء (مسموح به)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAccountSource('custom');
                              setDiscountData(prev => ({ ...prev, account_id: customAccountId }));
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                              accountSource === 'custom'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-zinc-600 hover:text-zinc-900'
                            }`}
                          >
                            <span>حساب آخر من دليل الحسابات</span>
                          </button>
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-400 font-medium">خلية واحدة فقط مفعلة في المعاملة</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Cell 1: خصم العملاء (مسموح به) */}
                      <div 
                        className={`p-3 rounded-xl border transition-all ${
                          accountSource === 'discount' 
                            ? 'border-emerald-400 bg-emerald-50/20 ring-1 ring-emerald-300' 
                            : 'border-zinc-200 bg-zinc-50/70 opacity-60 hover:opacity-85 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (accountSource !== 'discount') {
                            setAccountSource('discount');
                            setDiscountData(prev => ({ ...prev, account_id: discountAccountId }));
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5 cursor-pointer">
                            <BookOpen className={`w-3.5 h-3.5 ${accountSource === 'discount' ? 'text-emerald-600' : 'text-zinc-400'}`} />
                            <span>خصم العملاء (مسموح به)</span>
                          </label>
                          {accountSource === 'discount' ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">✓ مفعّل</span>
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-400">انقر للتبديل له</span>
                          )}
                        </div>

                        <div className="relative group">
                          <select 
                            disabled={accountSource !== 'discount'}
                            required={accountSource === 'discount'}
                            className={`w-full ${dir === 'rtl' ? 'pr-3 pl-7' : 'pl-3 pr-7'} py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-xs ${
                              accountSource !== 'discount' ? 'cursor-not-allowed bg-zinc-100/70 text-zinc-400' : 'cursor-pointer'
                            }`}
                            value={discountAccountId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDiscountAccountId(val);
                              setDiscountData(prev => ({ ...prev, account_id: val }));
                            }}
                          >
                            <option value="">{t('discount_settings.select_account')}</option>
                            {accounts.filter(acc => acc.account_usage === 'earned_discounts' || acc.account_usage === 'sales_discount' || acc.name?.includes('خصم')).map(a => (
                              <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                            ))}
                          </select>
                          <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none`} />
                        </div>
                      </div>

                      {/* Cell 2: حساب آخر (دليل الحسابات) */}
                      <div 
                        className={`p-3 rounded-xl border transition-all ${
                          accountSource === 'custom' 
                            ? 'border-emerald-400 bg-emerald-50/20 ring-1 ring-emerald-300' 
                            : 'border-zinc-200 bg-zinc-50/70 opacity-60 hover:opacity-85 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (accountSource !== 'custom') {
                            setAccountSource('custom');
                            setDiscountData(prev => ({ ...prev, account_id: customAccountId }));
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5 cursor-pointer">
                            <BookOpen className={`w-3.5 h-3.5 ${accountSource === 'custom' ? 'text-emerald-600' : 'text-zinc-400'}`} />
                            <span>حساب آخر (دليل الحسابات)</span>
                          </label>
                          {accountSource === 'custom' ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">✓ مفعّل</span>
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-400">انقر للتبديل له</span>
                          )}
                        </div>

                        <div className="relative group">
                          <select 
                            disabled={accountSource !== 'custom'}
                            required={accountSource === 'custom'}
                            className={`w-full ${dir === 'rtl' ? 'pr-3 pl-7' : 'pl-3 pr-7'} py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-xs ${
                              accountSource !== 'custom' ? 'cursor-not-allowed bg-zinc-100/70 text-zinc-400' : 'cursor-pointer'
                            }`}
                            value={customAccountId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomAccountId(val);
                              setDiscountData(prev => ({ ...prev, account_id: val }));
                            }}
                          >
                            <option value="">-- اختر حساباً من دليل الحسابات --</option>
                            {accounts
                              .filter(a => a.is_active !== false)
                              .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
                              .map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.code ? `${a.code} - ` : ''}{a.name}
                                </option>
                              ))}
                          </select>
                          <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none`} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 mb-1 px-1">{t('discounts.column_notes')}</label>
                    <textarea 
                      rows={2}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none font-bold text-xs text-zinc-800"
                      placeholder={t('discounts.notes_placeholder')}
                      value={discountData.notes}
                      onChange={(e) => setDiscountData({...discountData, notes: e.target.value})}
                    />
                  </div>
                </section>

                {/* Attachments Section */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/90 shadow-sm">
                  <AttachmentsManager
                    attachments={attachments}
                    onChange={setAttachments}
                  />
                </div>


              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة عميل جديد</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleAddCustomer} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم العميل</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="tel"
                        pattern="[0-9]{11,}"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
                        value={newCustomer.mobile}
                        onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        type="email"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-left"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العنوان</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={2}
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رصيد أول</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={newCustomer.opening_balance}
                          onChange={(e) => setNewCustomer({ ...newCustomer, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">تاريخ الرصيد</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="date" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          value={newCustomer.opening_balance_date}
                          onChange={(e) => setNewCustomer({ ...newCustomer, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={newCustomer.account_id}
                      onChange={(e) => setNewCustomer({ ...newCustomer, account_id: e.target.value })}
                    >
                      <option value="">اختر الحساب...</option>
                       {accounts.filter(a => a.account_usage === 'accounts_receivable' || a.account_usage === 'customer').map(account => (
                         <option key={account.id} value={account.id}>
                           {account.code} - {account.name}
                         </option>
                       ))}
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    حفظ العميل
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
                    className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">{t('common.delete_confirm_title')}</h3>
            <p className="text-zinc-500 mb-6">{t('discounts.delete_confirm')}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDiscountToDelete(null);
                }}
                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                إلغاء
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      <PageActivityLog 
        isOpen={isActivityLogOpen}
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }}
        category="customer_discounts"
        documentId={activityLogDocumentId}
      />

      {reversingDiscount && (
        <ReversalModal
          isOpen={!!reversingDiscount}
          onClose={() => setReversingDiscount(null)}
          onSuccess={() => {
            setReversingDiscount(null);
            window.dispatchEvent(new Event('db-change'));
          }}
          moduleName="customer_discounts"
          docId={reversingDiscount.id}
          docNumber={reversingDiscount.number || reversingDiscount.id}
          docDate={reversingDiscount.date}
          docAmount={reversingDiscount.amount}
          entityName={reversingDiscount.customer_name}
          entityType="customer"
          moduleTitleAr="خصم عميل"
        />
      )}
    </div>
  );
};
