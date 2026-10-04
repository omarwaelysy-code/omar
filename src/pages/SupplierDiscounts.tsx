import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Supplier, Account, JournalEntry, JournalEntryItem, ActivityLog } from '../types';
import { Search, Plus, Trash2, X, Tag, Truck, Calendar, Save, Wallet, History, BookOpen, ChevronRight, ChevronLeft, RotateCcw, ChevronDown, LayoutGrid, List, Hash, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { TransactionManager } from '../services/TransactionManager';
import { DiscountSchema, JournalEntrySchema } from '../lib/schemas';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { PaginationControls } from '../components/PaginationControls';
import { ExportButtons } from '../components/ExportButtons';
import { AttachmentsManager, AttachmentItem } from '../components/common/AttachmentsManager';
import { ReversalModal } from '../components/common/ReversalModal';
import { ReversalBanner } from '../components/common/ReversalBanner';

export const SupplierDiscounts: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir, language } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reversingDiscount, setReversingDiscount] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
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
        await dbService.delete('supplier_discounts', id);
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
      'المورد': d.supplier_name || '-',
      'الحساب': accounts.find(a => a.id === d.account_id)?.name || d.account_name || '-',
      'التاريخ': formatDate(d.date),
      'المبلغ': d.amount,
      'البيان': d.notes || '-'
    }));
    exportToExcel(formattedData, { filename: onlySelected ? 'Selected_Supplier_Discounts' : 'Supplier_Discounts', sheetName: 'خصم الموردين' });
  };

  const handleExportPDF = async (onlySelected = false) => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, {
        filename: onlySelected ? 'Selected_Supplier_Discounts' : 'Supplier_Discounts',
        reportTitle: onlySelected ? 'إشعارات خصم الموردين المحددة' : 'إشعارات خصم الموردين'
      });
    }
  };

  const generateDiscountNumber = async (selectedDate: string) => {
    return await dbService.getNextSequence('supplier_discounts', selectedDate);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsSubmitting(false);
    setEditingDiscount(null);
    setAttachments([]);
    setIsAmountFocused(false);
    const defaultAcc = settings?.supplier_discount_account_id || accounts.find(a => a.account_usage === 'earned_discounts' || a.account_usage === 'purchase_discount')?.id || '';
    setAccountSource('discount');
    setDiscountAccountId(defaultAcc);
    setCustomAccountId('');
    setDiscountData({
      supplier_id: '',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      account_id: defaultAcc,
      notes: ''
    });
  };

  const openEditModal = (discount: any) => {
    setEditingDiscount(discount);
    setIsAmountFocused(false);
    let accId = discount.account_id || '';
    if (!accId && discount.account_name) {
      const matched = accounts.find(a => a.name === discount.account_name);
      if (matched) accId = matched.id;
    }
    const isDiscountAcc = accounts.some(a => a.id === accId && (a.account_usage === 'earned_discounts' || a.account_usage === 'purchase_discount' || a.name?.includes('خصم')));
    
    if (accId) {
      if (isDiscountAcc) {
        setAccountSource('discount');
        setDiscountAccountId(accId);
        setCustomAccountId('');
      } else {
        setAccountSource('custom');
        setCustomAccountId(accId);
        setDiscountAccountId(settings?.supplier_discount_account_id || accounts.find(a => a.account_usage === 'earned_discounts' || a.account_usage === 'purchase_discount')?.id || '');
      }
    } else {
      const defAcc = settings?.supplier_discount_account_id || accounts.find(a => a.account_usage === 'earned_discounts' || a.account_usage === 'purchase_discount')?.id || '';
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
      supplier_id: discount.supplier_id,
      amount: numAmount,
      date: discount.date ? discount.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      account_id: accId || settings?.supplier_discount_account_id || '',
      notes: discount.notes || discount.description || ''
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
  
  const [newSupplier, setNewSupplier] = useState({ 
    name: '', 
    mobile: '', 
    address: '', 
    email: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: ''
  });
  
  const [discountData, setDiscountData] = useState({
    supplier_id: '',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    account_id: '',
    notes: ''
  });

  useEffect(() => {
    if (user) {
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);
      const unsubDiscounts = dbService.subscribePaginated('supplier_discounts', {
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
          const defaultAcc = docs[0].supplier_discount_account_id || '';
          setDiscountAccountId(defaultAcc);
          setDiscountData(prev => ({ ...prev, account_id: defaultAcc }));
        }
      };

      fetchSettings();
      setLoading(false);
      return () => {
        unsubSuppliers();
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

    if (isModalOpen && !editingDiscount) {
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

      const supplier = suppliers.find(s => s.id === discountData.supplier_id);
      const selectedAccId = accountSource === 'discount' ? discountAccountId : customAccountId;
      const effectiveAccId = selectedAccId || discountData.account_id;
      const discount_number = editingDiscount?.number || discountNumber || 'SDISC-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة خصم مورد',
        details: `إضافة خصم جديد من المورد ${supplier?.name || '...'} بمبلغ ${formatNumber(discountData.amount)}`,
        created_at: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Supplier
      let debitAccountId = supplier?.account_id || '';
      let debitAccountName = supplier?.account_name || 'حساب الموردين';

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: discountData.amount,
        credit: 0,
        description: `خصم مكتسب رقم ${discount_number} - ${supplier?.name || '...'}`
      });

      // Credit: Selected Account (Earned Discount or Custom)
      const creditAccount = accounts.find(a => a.id === effectiveAccId);
      const creditAccountId = creditAccount?.id || effectiveAccId;
      const creditAccountName = creditAccount?.name || (accountSource === 'discount' ? 'حساب الخصم المكتسب' : 'حساب آخر');

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: discountData.amount,
        description: `خصم مكتسب رقم ${discount_number} - ${supplier?.name || '...'}`
      });

      setPreviewJournalEntry({
        id: 'preview',
        date: discountData.date,
        reference_number: discount_number,
        reference_id: 'preview',
        reference_type: 'supplier_discount',
        description: `قيد خصم مكتسب رقم ${discount_number}`,
        items: journalItems,
        total_debit: discountData.amount,
        total_credit: discountData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, discountData, user, suppliers, accounts, accountSource, discountAccountId, customAccountId, editingDiscount, discountNumber]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const code = `SUPP-${Date.now().toString().slice(-6)}`;
      const selectedAccount = accounts.find(a => a.id === newSupplier.account_id);
      const dataToSave = {
        ...newSupplier,
        code,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };
      const id = await dbService.add('suppliers', dataToSave);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مورد', `إضافة مورد جديد من شاشة الخصومات: ${newSupplier.name}`, ['suppliers', 'discounts']);
      
      setDiscountData({ ...discountData, supplier_id: id });
      setIsSupplierModalOpen(false);
      setNewSupplier({ 
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
    const supplier = suppliers.find(s => s.id === discountData.supplier_id);
    if (!supplier?.account_id) {
      showNotification(`لا يمكن حفظ الخصم — المورد "${supplier?.name || ''}" لا يملك حساباً محاسبياً مربوطاً. يرجى فتح بيانات المورد وتحديد الحساب المحاسبي.`, 'error');
      return;
    }
    const selectedAccId = accountSource === 'discount' ? discountAccountId : customAccountId;
    const effectiveAccountId = selectedAccId || discountData.account_id;
    if (!effectiveAccountId) {
      showNotification('لا يمكن حفظ الخصم — يرجى اختيار حساب الخصم المحاسبي.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const number = editingDiscount?.number || discountNumber;
      
      const discountAccount = accounts.find(a => a.id === effectiveAccountId);
      const creditAccountId = discountAccount?.id || effectiveAccountId;
      const creditAccountName = discountAccount?.name || (accountSource === 'discount' ? 'حساب الخصم المكتسب' : 'حساب آخر');

      const data = {
        supplier_id: discountData.supplier_id,
        supplier_name: supplier?.name || '',
        amount: discountData.amount,
        date: discountData.date,
        account_id: creditAccountId,
        account_name: creditAccountName,
        notes: discountData.notes,
        description: discountData.notes || '',
        attachments,
        number,
        type: 'supplier' as const,
        company_id: user.company_id,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      };

      if (!editingDiscount) {
        (data as any).created_at = new Date().toISOString();
        (data as any).created_by = user.id;
      }

      const journalItems: any[] = [];
      let debitAccountId = supplier?.account_id || '';
      let debitAccountName = supplier?.account_name || 'حساب الموردين';

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: discountData.amount,
        credit: 0,
        description: `خصم مكتسب من المورد: ${supplier?.name} - رقم ${number}`,
        supplier_id: discountData.supplier_id,
        supplier_name: supplier?.name
      });

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: discountData.amount,
        description: `خصم مكتسب رقم ${number}`
      });

      const journalEntryData = {
        date: discountData.date,
        reference_number: number,
        reference_type: 'supplier_discount',
        description: `قيد خصم مكتسب رقم ${number}`,
        items: journalItems,
        total_debit: discountData.amount,
        total_credit: discountData.amount,
        company_id: user.company_id,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      };

      if (!editingDiscount) {
        (journalEntryData as any).created_at = new Date().toISOString();
        (journalEntryData as any).created_by = user.id;
      }

      if (editingDiscount) {
        await TransactionManager.updateWithAccounting(
          'supplier_discounts',
          editingDiscount.id,
          data,
          DiscountSchema,
          journalEntryData,
          JournalEntrySchema
        );
        showNotification(t('discounts.toast_success'), 'success');
      } else {
        await TransactionManager.saveWithAccounting(
          'supplier_discounts',
          data,
          DiscountSchema,
          journalEntryData,
          JournalEntrySchema
        );
        showNotification(language === 'ar' ? 'تم حفظ الخصم بنجاح' : 'Discount added successfully', 'success');
      }

      closeModal();
      dbService.logActivity(user.id, user.username, user.company_id, editingDiscount ? 'تعديل خصم مورد' : 'إضافة خصم مورد', `${editingDiscount ? 'تعديل' : 'إضافة'} خصم للمورد: ${supplier?.name} بمبلغ: ${discountData.amount}`, 'supplier_discounts');

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

  const confirmDelete = async () => {
    if (!discountToDelete || !user) return;
    try {
      const disc = discounts.find(d => d.id === discountToDelete);
      
      // Delete associated journal entry
      await dbService.deleteJournalEntryByReference(discountToDelete, user.company_id);
      
      await dbService.delete('supplier_discounts', discountToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف خصم مورد', `حذف خصم للمورد: ${disc?.supplier_name} بمبلغ: ${disc?.amount}`);
      setIsDeleteModalOpen(false);
      setDiscountToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredDiscounts = discounts.filter(d => 
    d.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-3 animate-in fade-in duration-300" dir={dir}>
      {/* Compact Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200/60 shadow-xs">
            <Truck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                {t('discounts.supplier_title')}
              </h2>
              {serverSummary?.total_amount !== undefined && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {t('discounts.total_discounts')}: {formatNumber(serverSummary.total_amount)} ج.م
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t('discounts.supplier_subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button 
            onClick={() => {
              setEditingDiscount(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-all shadow-xs active:scale-95"
          >
            <Plus size={14} />
            <span>إضافة خصم لمورد</span>
          </button>

          <ExportButtons 
            onExportExcel={() => handleExportExcel(selectedIds.length > 0)} 
            onExportPDF={() => handleExportPDF(selectedIds.length > 0)} 
            onPrint={() => printElement(tableRef.current, 'إشعارات خصم الموردين')}
          />

          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-semibold text-xs transition-all"
            title={t('common.activity_log')}
          >
            <History size={14} />
            <span className="hidden sm:inline">{t('common.activity_log')}</span>
          </button>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 text-slate-400`} size={15} />
          <input
            type="text"
            placeholder={t('discounts.search_placeholder')}
            className={`w-full ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:bg-white outline-none transition-all`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 text-amber-700 text-xs font-bold">
              <span>{selectedIds.length} محدد</span>
              <button
                onClick={handleBatchDelete}
                className="text-rose-600 hover:text-rose-800 p-0.5"
                title="حذف المحدد"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setView('table')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 text-xs font-bold ${view === 'table' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              title="عرض مفرد (جدول)"
            >
              <List size={13} />
              <span>{t('discounts.tab_single')}</span>
            </button>
            <button
              onClick={() => setView('card')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 text-xs font-bold ${view === 'card' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              title="عرض بطاقات"
            >
              <LayoutGrid size={13} />
              <span>{t('discounts.tab_cards')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View: Table or Cards */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {view === 'table' ? (
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[11px] font-bold border-b border-slate-200 select-none">
                  <th className="w-10 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={filteredDiscounts.length > 0 && selectedIds.length === filteredDiscounts.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer align-middle"
                    />
                  </th>
                  <th className="px-3 py-1.5 font-bold">{language === 'ar' ? 'رقم المستند' : t('discounts.discount_number')}</th>
                  <th className="px-3 py-1.5 font-bold cursor-pointer hover:text-amber-600 transition-colors" onClick={() => handleSort('supplier_name')}>
                    <div className="flex items-center gap-1">
                      <span>{t('discounts.column_supplier')}</span>
                      <span className="text-[10px] text-slate-400">{sortBy === 'supplier_name' ? (sortOrder === 'ASC' ? '▲' : '▼') : '⇅'}</span>
                    </div>
                  </th>
                  <th className="px-3 py-1.5 font-bold">الحساب</th>
                  <th className="px-3 py-1.5 font-bold cursor-pointer hover:text-amber-600 transition-colors" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      <span>{t('discounts.column_date')}</span>
                      <span className="text-[10px] text-slate-400">{sortBy === 'date' ? (sortOrder === 'ASC' ? '▲' : '▼') : '⇅'}</span>
                    </div>
                  </th>
                  <th className="px-3 py-1.5 font-bold cursor-pointer hover:text-amber-600 transition-colors" onClick={() => handleSort('amount')}>
                    <div className="flex items-center gap-1">
                      <span>{t('discounts.column_amount')}</span>
                      <span className="text-[10px] text-slate-400">{sortBy === 'amount' ? (sortOrder === 'ASC' ? '▲' : '▼') : '⇅'}</span>
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
                        className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer align-middle"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-slate-900 text-xs">
                      {discount.number || '-'}
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-900 text-xs">
                      {discount.supplier_name}
                    </td>
                    <td className="px-3 py-2 text-slate-600 font-medium text-xs">
                      {accounts.find(a => a.id === discount.account_id)?.name || discount.account_name || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-500 font-medium text-xs">
                      {formatDate(discount.date)}
                    </td>
                    <td className="px-3 py-2 font-bold text-amber-600 text-xs">
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
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
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
                className="p-3.5 bg-white rounded-xl border border-slate-200/80 hover:border-amber-300 hover:shadow-md transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between space-y-2.5"
                onClick={() => openEditModal(discount)}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(discount.id)}
                      onChange={() => toggleSelectRow(discount.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded">
                      {discount.number || '-'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">{formatDate(discount.date)}</span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-[11px]">المورد:</span>
                    <span className="font-bold text-slate-800">{discount.supplier_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-[11px]">الحساب:</span>
                    <span className="text-slate-600 font-medium">
                      {accounts.find(a => a.id === discount.account_id)?.name || discount.account_name || '-'}
                    </span>
                  </div>
                  {discount.notes && (
                    <p className="text-[11px] text-slate-500 truncate pt-1 border-t border-slate-50">{discount.notes}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-600 font-mono">
                    {formatNumber(discount.amount)} ج.م
                  </span>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => openEditModal(discount)}
                      className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                      title="تعديل"
                    >
                      <Tag size={14} />
                    </button>
                    <button 
                      onClick={() => {
                        setActivityLogDocumentId(discount.id);
                        setIsActivityLogOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                      title="سجل النشاط"
                    >
                      <History size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(discount.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="حذف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredDiscounts.length === 0 && (
              <div className="col-span-full py-8 text-center text-slate-400 italic text-xs">لا توجد خصومات حالياً</div>
            )}
          </div>
        )}
      </div>

      {/* Main Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-50 w-full h-[95vh] max-w-6xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative">
            
            {/* Modal Header */}
            <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-2 z-10 flex-wrap">
              <div className="flex items-center gap-2">
                <button 
                  onClick={closeModal}
                  className="px-3 py-1.5 hover:bg-slate-100 rounded-xl transition-all text-slate-600 hover:text-slate-900 flex items-center gap-1.5 text-xs font-bold border border-slate-200/80 shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>عودة</span>
                </button>

                {editingDiscount && !editingDiscount.is_reversed && !editingDiscount.is_reversal_doc && (
                  <button
                    type="button"
                    onClick={() => setReversingDiscount(editingDiscount)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 shadow-xs"
                  >
                    <RotateCcw size={13} />
                    <span>عكس الإشعار</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    showSidePanel 
                      ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-transparent'
                  } border`}
                >
                  <History size={13} />
                  <span>قيد اليومية \ سجل التعديلات</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {editingDiscount && (
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
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

                {/* Top Action Buttons */}
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
                    form="supplier-discount-form"
                    disabled={isSubmitting || discountData.amount <= 0 || !discountData.supplier_id}
                    className="px-4 py-1.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                  >
                    <Save size={14} />
                    <span>{isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (editingDiscount ? (language === 'ar' ? 'تحديث الخصم' : t('common.save')) : (language === 'ar' ? 'حفظ البيانات' : t('discounts.save_button')))}</span>
                  </button>
                </div>

                <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                <h3 className="text-sm md:text-base font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-600" />
                  <span>{editingDiscount ? 'تعديل بيانات الخصم' : 'إضافة خصم من مورد'}</span>
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
                          category="supplier_discounts" 
                          previewJournalEntry={previewJournalEntry}
                          previewActivityLog={previewActivityLog}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form id="supplier-discount-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
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
                            className={`absolute ${dir === 'rtl' ? 'left-1.5' : 'right-1.5'} top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-amber-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-zinc-200 shadow-sm`}
                            title={language === 'ar' ? 'نسخ رقم المستند' : 'Copy'}
                          >
                            {copiedDocNumber ? <Check size={13} className="text-amber-600" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>

                      {/* Supplier Selection */}
                      <div>
                        <label className="block text-xs font-bold text-zinc-600 mb-1 px-1">
                          {t('discounts.column_supplier')}
                        </label>
                        <div className="relative group">
                          <Truck className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none`} />
                          <select 
                            required
                            className={`w-full ${dir === 'rtl' ? 'pr-8 pl-7' : 'pl-8 pr-7'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-xs cursor-pointer`}
                            value={discountData.supplier_id}
                            onChange={(e) => {
                              if (e.target.value === 'new') {
                                setIsSupplierModalOpen(true);
                              } else {
                                setDiscountData({...discountData, supplier_id: e.target.value});
                              }
                            }}
                          >
                            <option value="">{t('common.select_supplier')}</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                            <option value="new" className="font-bold text-amber-600">+ إضافة مورد جديد...</option>
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
                            className={`w-full ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-zinc-800 text-xs`}
                            value={discountData.date}
                            onChange={(e) => setDiscountData({...discountData, date: e.target.value})}
                          />
                        </div>
                      </div>

                      {/* Amount with 1,000.00 formatting */}
                      <div>
                        <div className="flex items-center justify-between mb-1 px-1">
                          <label className="block text-xs font-bold text-zinc-600">
                            {t('discounts.amount_label')}
                          </label>
                          {discountData.amount > 0 && !isAmountFocused && (
                            <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
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
                            className={`w-full ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-zinc-800 text-xs font-mono`}
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

                    {/* Dual Account Selection: Earned Discount vs Chart of Accounts */}
                    <div className="pt-2 border-t border-zinc-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 px-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-700">تحديد الحساب الدائن:</span>
                          <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                            <button
                              type="button"
                              onClick={() => {
                                setAccountSource('discount');
                                setDiscountData(prev => ({ ...prev, account_id: discountAccountId }));
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                                accountSource === 'discount'
                                  ? 'bg-amber-600 text-white shadow-sm'
                                  : 'text-zinc-600 hover:text-zinc-900'
                              }`}
                            >
                              <span>خصم الموردين (مكتسب)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAccountSource('custom');
                                setDiscountData(prev => ({ ...prev, account_id: customAccountId }));
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                                accountSource === 'custom'
                                  ? 'bg-amber-600 text-white shadow-sm'
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
                        {/* Cell 1: خصم الموردين (مكتسب) */}
                        <div 
                          className={`p-3 rounded-xl border transition-all ${
                            accountSource === 'discount' 
                              ? 'border-amber-400 bg-amber-50/20 ring-1 ring-amber-300' 
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
                              <BookOpen className={`w-3.5 h-3.5 ${accountSource === 'discount' ? 'text-amber-600' : 'text-zinc-400'}`} />
                              <span>خصم الموردين (مكتسب)</span>
                            </label>
                            {accountSource === 'discount' ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">✓ مفعّل</span>
                            ) : (
                              <span className="text-[10px] font-bold text-zinc-400">انقر للتبديل له</span>
                            )}
                          </div>

                          <div className="relative group">
                            <select 
                              disabled={accountSource !== 'discount'}
                              required={accountSource === 'discount'}
                              className={`w-full ${dir === 'rtl' ? 'pr-3 pl-7' : 'pl-3 pr-7'} py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-xs ${
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
                              {accounts.filter(acc => acc.account_usage === 'earned_discounts' || acc.account_usage === 'purchase_discount' || acc.name?.includes('خصم')).map(a => (
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
                              ? 'border-amber-400 bg-amber-50/20 ring-1 ring-amber-300' 
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
                              <BookOpen className={`w-3.5 h-3.5 ${accountSource === 'custom' ? 'text-amber-600' : 'text-zinc-400'}`} />
                              <span>حساب آخر (دليل الحسابات)</span>
                            </label>
                            {accountSource === 'custom' ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">✓ مفعّل</span>
                            ) : (
                              <span className="text-[10px] font-bold text-zinc-400">انقر للتبديل له</span>
                            )}
                          </div>

                          <div className="relative group">
                            <select 
                              disabled={accountSource !== 'custom'}
                              required={accountSource === 'custom'}
                              className={`w-full ${dir === 'rtl' ? 'pr-3 pl-7' : 'pl-3 pr-7'} py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-xs ${
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
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all resize-none font-bold text-xs text-zinc-800"
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
        </div>
      )}

      {/* Add Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-3 sm:p-4 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>إضافة مورد جديد</span>
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-1 hover:bg-zinc-100 rounded-lg transition-all">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddSupplier} className="p-3 sm:p-5 space-y-3.5 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-zinc-600 mb-1">اسم المورد</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-zinc-800"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-zinc-800 text-left"
                    value={newSupplier.mobile}
                    onChange={(e) => setNewSupplier({ ...newSupplier, mobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1">الحساب المحاسبي</label>
                  <select
                    required
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-zinc-800"
                    value={newSupplier.account_id}
                    onChange={(e) => setNewSupplier({ ...newSupplier, account_id: e.target.value })}
                  >
                    <option value="">اختر الحساب...</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-600 mb-1">العنوان</label>
                <textarea
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-zinc-800 resize-none"
                  rows={2}
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button 
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-3.5 py-1.5 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all text-xs"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-sm text-xs"
                >
                  حفظ المورد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 animate-in zoom-in-95 duration-200 space-y-4">
            <h3 className="text-base font-bold text-zinc-900">{t('common.delete_confirm_title')}</h3>
            <p className="text-xs text-zinc-500">{t('discounts.delete_confirm')}</p>
            <div className="flex gap-2 justify-end pt-2">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDiscountToDelete(null);
                }}
                className="px-3.5 py-1.5 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all text-xs"
              >
                إلغاء
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-1.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-sm text-xs"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reversal Modal */}
      {reversingDiscount && (
        <ReversalModal
          isOpen={!!reversingDiscount}
          onClose={() => setReversingDiscount(null)}
          onSuccess={() => {
            setReversingDiscount(null);
            window.dispatchEvent(new Event('db-change'));
          }}
          moduleName="supplier_discounts"
          docId={reversingDiscount.id}
          docNumber={reversingDiscount.number || reversingDiscount.id}
          docDate={reversingDiscount.date}
          docAmount={reversingDiscount.amount}
          entityName={reversingDiscount.supplier_name}
          entityType="supplier"
          moduleTitleAr="خصم مورد"
        />
      )}

      <PageActivityLog 
        isOpen={isActivityLogOpen}
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }}
        category="supplier_discounts"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
