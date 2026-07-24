import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Customer, Account, JournalEntry, JournalEntryItem } from '../types';
import { Search, Plus, Trash2, X, Tag, User, Calendar, Save, Wallet, CreditCard, History, BookOpen, Phone, Mail, MapPin, Maximize2, Minimize2, ChevronRight, ChevronLeft, RotateCcw, ChevronDown, LayoutGrid, List, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { SmartAIInput } from '../components/SmartAIInput';
import { TransactionManager } from '../services/TransactionManager';
import { DiscountSchema, JournalEntrySchema } from '../lib/schemas';
import { ActivityLog } from '../types';
import { formatNumber, formatDate, formatMoney } from '../utils/formatUtils';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { ExportButtons } from '../components/ExportButtons';
import { useRef } from 'react';

export const CustomerDiscounts: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir, language } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
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
  const tableRef = useRef<HTMLTableElement>(null);

  const handleExportExcel = () => {
    const headers = {
      'number': 'رقم الإذن',
      'date': 'التاريخ',
      'customer_name': 'العميل',
      'amount': 'المبلغ',
      'notes': 'البيان'
    };
    const formattedData = formatDataForExcel(discounts, headers);
    exportToExcel(formattedData, { filename: 'Customer_Discounts', sheetName: 'خصم العملاء' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, {
        filename: 'Customer_Discounts',
        reportTitle: 'إشعارات خصم العملاء'
      });
    }
  };


  const generateDiscountNumber = async (selectedDate: string) => {
    return await dbService.getNextSequence('customer_discounts', selectedDate);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDiscount(null);
    setDiscountData({
      customer_id: '',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      account_id: settings?.customer_discount_account_id || '',
      notes: ''
    });
  };

  const openEditModal = (discount: any) => {
    setEditingDiscount(discount);
    setDiscountData({
      customer_id: discount.customer_id,
      amount: discount.amount,
      date: discount.date.slice(0, 10),
      account_id: discount.account_id || '',
      notes: discount.notes || ''
    });
    setDiscountNumber(discount.number || '');
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
          setDiscountData(prev => ({ ...prev, account_id: docs[0].customer_discount_account_id || '' }));
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
    if (!user) return;
    if (discountData.amount <= 0) {
      showNotification('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    try {
      const customer = customers.find(c => c.id === discountData.customer_id);
      const number = editingDiscount ? editingDiscount.number : discountNumber;
      
      const data = {
        customer_id: discountData.customer_id,
        customer_name: customer?.name || '',
        amount: discountData.amount,
        date: discountData.date,
        account_id: discountData.account_id,
        notes: discountData.notes,
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
      const discountAccount = accounts.find(a => a.id === discountData.account_id);
      const debitAccountId = discountAccount?.id || '';
      const debitAccountName = discountAccount?.name || 'حساب الخصم المسموح به';

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
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('discounts.customer_title')}</h2>
          <p className="text-zinc-500">{t('discounts.customer_subtitle')}</p>
          {serverSummary.total_amount !== undefined && (
            <div className="mt-2 flex items-center gap-4 text-sm">
               <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold">
                 {t('discounts.total_discounts')}: {formatMoney(serverSummary.total_amount)} {t('common.currency')}
               </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-zinc-200 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            <History size={20} />
            {t('common.activity_log')}
          </button>
          <ExportButtons 
            onExportExcel={handleExportExcel} 
            onExportPDF={handleExportPDF} 
            onPrint={() => printElement(tableRef.current, 'إشعارات خصم العملاء')}
          />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-[rgba(16,185,129,0.2)]"
          >
            <Plus size={20} />
            {t('discounts.add_customer')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder={t('discounts.search_placeholder')}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200/50 shadow-inner w-fit">
            <button
              onClick={() => setView('table')}
              className={`p-2 px-3 rounded-xl transition-all flex items-center gap-2 font-bold text-sm ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm border border-zinc-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
              title="عرض الجدول"
            >
              <List size={18} />
              <span className="hidden md:inline">{t('discounts.tab_single')}</span>
            </button>
            <button
              onClick={() => setView('card')}
              className={`p-2 px-3 rounded-xl transition-all flex items-center gap-2 font-bold text-sm ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm border border-zinc-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
              title="عرض الكروت"
            >
              <LayoutGrid size={18} />
              <span className="hidden md:inline">{t('discounts.tab_cards')}</span>
            </button>
          </div>
        </div>

        {view === 'table' ? (
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-right">
              <thead>
                <tr className="bg-[rgba(244,244,245,0.5)] text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('customer_name')}>
                    <div className="flex items-center gap-1">
                      العميل
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'customer_name' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      التاريخ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'date' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold cursor-pointer hover:text-emerald-600 transition-colors group" onClick={() => handleSort('amount')}>
                    <div className="flex items-center gap-1">
                      المبلغ
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === 'amount' ? (sortOrder === 'ASC' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold">{t('discounts.column_notes')}</th>
                  <th className="px-6 py-4 font-bold text-left">{t('discounts.column_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredDiscounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد خصومات حالياً</td>
                  </tr>
                ) : filteredDiscounts.map((discount) => (
                  <tr key={discount.id} className="hover:bg-[rgba(244,244,245,0.5)] transition-colors group">
                    <td className="px-6 py-4 font-bold text-zinc-900">{discount.customer_name}</td>
                    <td className="px-6 py-4 text-zinc-500">{formatDate(discount.date)}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">{formatNumber(discount.amount)} ج.م</td>
                    <td className="px-6 py-4 text-zinc-500 text-sm">{discount.notes || '-'}</td>
                    <td className="px-6 py-4 text-left">
                      <div className="flex items-center justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(discount)}
                          className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                          title="تعديل"
                        >
                          <Tag size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setActivityLogDocumentId(discount.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                          title="سجل النشاط"
                        >
                          <History size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(discount.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDiscounts.map((discount) => (
              <div 
                key={discount.id} 
                className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden cursor-pointer flex flex-col justify-between"
                onClick={() => openEditModal(discount)}
              >
                <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(discount);
                    }}
                    className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                  >
                    <Tag size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivityLogDocumentId(discount.id);
                      setIsActivityLogOpen(true);
                    }}
                    className="p-2 bg-white text-blue-500 rounded-xl border border-blue-50 shadow-sm hover:bg-blue-50 transition-all font-bold"
                  >
                    <History size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(discount.id);
                    }}
                    className="p-2 bg-white text-red-500 rounded-xl border border-red-50 shadow-sm hover:bg-red-50 transition-all font-bold"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="flex flex-col h-full justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-100/60 pb-2">
                      <span className="text-xs text-zinc-400 font-semibold">{formatDate(discount.date)}</span>
                      <span className="text-xs font-bold text-zinc-900 bg-zinc-100 rounded-lg px-2 py-1">{discount.number || '-'}</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 justify-between">
                        <span className="text-xs text-zinc-400">العميل:</span>
                        <span className="text-xs font-semibold text-zinc-700">{discount.customer_name}</span>
                      </div>
                    </div>

                    {discount.notes && (
                      <p className="text-xs text-zinc-500 font-medium max-w-xs truncate border-t border-zinc-100/60 pt-2">{discount.notes}</p>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between font-bold">
                    <span className="text-zinc-500 text-xs">مبلغ الخصم</span>
                    <span className="font-black text-emerald-600 text-lg">
                      {formatNumber(discount.amount)} ج.م
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filteredDiscounts.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-400 italic">لا توجد خصومات حالياً</div>
            )}
          </div>
        )}
      </div>
    </>
  ) : (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col min-h-[80vh] relative">
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
                <span>قيد اليومية \\ سجل التعديلات</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              {editingDiscount && (
                <div className="hidden lg:flex items-center gap-2 bg-zinc-100 p-1.5 rounded-2xl">
                  <button 
                    type="button"
                    onClick={handlePrevDiscount}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                    disabled={filteredDiscounts.findIndex(d => d.id === editingDiscount.id) === 0}
                  >
                    <ChevronRight size={16} />
                    السابق
                  </button>
                  <button 
                    type="button"
                    onClick={handleNextDiscount}
                    className="flex items-center gap-1 px-3 py-1.5 hover:bg-white rounded-xl transition-all text-zinc-600 disabled:opacity-30 text-xs font-black"
                    disabled={filteredDiscounts.findIndex(d => d.id === editingDiscount.id) === filteredDiscounts.length - 1}
                  >
                    التالي
                    <ChevronLeft size={16} />
                  </button>
                </div>
              )}
              <h3 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                {editingDiscount ? t('discounts.edit_title') : t('discounts.add_new_title')}
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

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32 md:pb-8">
              <SmartAIInput 
                onDataExtracted={(data) => {
                  if (data.customerName) {
                    const customer = customers.find(c => c.name.includes(data.customerName!) || data.customerName!.includes(c.name));
                    if (customer) {
                      setDiscountData(prev => ({ ...prev, customer_id: customer.id }));
                    }
                  }
                  if (data.amount) setDiscountData(prev => ({ ...prev, amount: data.amount! }));
                  if (data.date) setDiscountData(prev => ({ ...prev, date: data.date! }));
                  if (data.description || data.notes) setDiscountData(prev => ({ ...prev, notes: data.description || data.notes || '' }));
                }}
                transactionType="discount"
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 space-y-6">
                  {/* Card: Basic Info */}
                  <section className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-6 relative pt-12">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                      <Tag className="w-4 h-4" />
                      <span className="text-xs font-bold">{t('discounts.add_new_title')}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('discounts.discount_number')}</label>
                        <div className="relative">
                          <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            readOnly
                            type="text"
                            className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-100 border border-zinc-200 rounded-2xl font-bold text-zinc-500 text-sm outline-none cursor-not-allowed`}
                            value={editingDiscount ? editingDiscount.number : discountNumber}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase tracking-tighter uppercase mb-2 px-2 uppercase">{t('discounts.column_customer')}</label>
                        <div className="relative group">
                          <User className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <select 
                            required
                            className={`w-full ${dir === 'rtl' ? 'ps-10 pe-12' : 'pe-10 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-sm cursor-pointer`}
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
                          <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('discounts.date_label')}</label>
                        <div className="relative group">
                          <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            required
                            type="date" 
                            className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm`}
                            value={discountData.date}
                            onChange={(e) => setDiscountData({...discountData, date: e.target.value})}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase tracking-tighter uppercase mb-2 px-2 uppercase tracking-tighter uppercase mb-2 px-2 uppercase">{t('discounts.amount_label')}</label>
                        <div className="relative group">
                          <Wallet className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <input 
                            required
                            type="number" 
                            step="0.01"
                            className={`w-full ${dir === 'rtl' ? 'ps-4 pe-12' : 'pe-4 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 text-sm`}
                            placeholder="0.00"
                            value={discountData.amount || ''}
                            onChange={(e) => setDiscountData({...discountData, amount: Number(e.target.value)})}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('discount_settings.customer_discount_label')}</label>
                        <div className="relative group">
                          <BookOpen className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                          <select 
                            required
                            className={`w-full ${dir === 'rtl' ? 'ps-10 pe-12' : 'pe-10 ps-12'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-zinc-800 appearance-none text-sm cursor-pointer`}
                            value={discountData.account_id}
                            onChange={(e) => setDiscountData({...discountData, account_id: e.target.value})}
                          >
                            <option value="">{t('discount_settings.select_account')}</option>
                             {accounts.filter(acc => acc.account_usage === 'earned_discounts' || acc.account_usage === 'sales_discount').map(a => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                          </select>
                          <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-3.5 w-5 h-5 text-zinc-400 pointer-events-none`} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 tracking-tighter mb-2 px-2 uppercase">{t('discounts.column_notes')}</label>
                      <textarea 
                        rows={3}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-3xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none font-bold text-sm text-zinc-800"
                        placeholder={t('discounts.notes_placeholder')}
                        value={discountData.notes}
                        onChange={(e) => setDiscountData({...discountData, notes: e.target.value})}
                      />
                    </div>
                  </section>
                </div>
              </div>

              {/* Form Footer */}
              <div className="p-4 md:p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md sticky bottom-0 z-[70] flex items-center justify-between gap-4 mt-auto">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="flex-1 max-w-[200px] py-4 rounded-2xl bg-zinc-100 text-zinc-600 font-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <RotateCcw size={20} />
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={discountData.amount <= 0 || !discountData.customer_id}
                  className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={20} />
                  {editingDiscount ? t('common.save') : t('discounts.save_button')}
                </button>
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
    </div>
  );
};
