import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Supplier, ExpenseCategory, PaymentMethod, JournalEntry, JournalEntryItem, Account } from '../types';
import { Search, Plus, Trash2, X, Wallet, User, CreditCard, Calendar, Hash, FileText, Save, Pencil, Eye, Download, History, Printer, Phone, Mail, MapPin, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { SmartAIInput } from '../components/SmartAIInput';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';
import { ActivityLog } from '../types';

export const PaymentVouchers: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewVoucher, setViewVoucher] = useState<any | null>(null);
  const voucherRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);

  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    address: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: '',
    counter_account_id: ''
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: ''
  });

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
  
  // Voucher State
  const [voucherData, setVoucherData] = useState({
    type: 'supplier' as 'supplier' | 'expense',
    supplier_id: '',
    expense_category_id: '',
    amount: 0,
    payment_method_id: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  useEffect(() => {
    if (user) {
      const unsubVouchers = dbService.subscribe<any>('payment_vouchers', user.company_id, setVouchers);
      const unsubSuppliers = dbService.subscribe<Supplier>('suppliers', user.company_id, setSuppliers);
      const unsubCategories = dbService.subscribe<ExpenseCategory>('expense_categories', user.company_id, setCategories);
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<any>('accounts', user.company_id, setAccounts);
      
      setLoading(false);
      return () => {
        unsubVouchers();
        unsubSuppliers();
        unsubCategories();
        unsubPM();
        unsubAccounts();
      };
    }
  }, [user]);

  // Real-time Preview Logic
  useEffect(() => {
    if (!isModalOpen || !user) {
      setPreviewJournalEntry(null);
      setPreviewActivityLog(null);
      return;
    }

    const generatePreview = () => {
      if (voucherData.amount <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const supplier = suppliers.find(s => s.id === voucherData.supplier_id);
      const category = categories.find(c => c.id === voucherData.expense_category_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === voucherData.payment_method_id);
      const voucher_number = 'PAY-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة سند صرف',
        details: `إضافة سند صرف جديد ${voucherData.type === 'supplier' ? `للمورد ${supplier?.name || '...'}` : `لمصروف ${category?.name || '...'}`} بمبلغ ${voucherData.amount.toLocaleString()}`,
        timestamp: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Supplier or Expense Account
      let debitAccountId = '';
      let debitAccountName = '';

      if (voucherData.type === 'supplier') {
        debitAccountId = supplier?.account_id || '';
        debitAccountName = supplier?.account_name || '';
        if (!debitAccountId) {
          const fallbackAccount = accounts.find(a => a.name.includes('موردين'));
          debitAccountId = fallbackAccount?.id || 'suppliers_account_default';
          debitAccountName = fallbackAccount?.name || 'حساب الموردين (افتراضي)';
        }
      } else {
        debitAccountId = category?.account_id || '';
        debitAccountName = category?.name || '';
        if (!debitAccountId) {
          const fallbackAccount = accounts.find(a => a.name.includes('مصروف'));
          debitAccountId = fallbackAccount?.id || 'expenses_account_default';
          debitAccountName = fallbackAccount?.name || 'حساب المصروفات (افتراضي)';
        }
      }

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: voucherData.amount,
        credit: 0,
        description: `سند صرف رقم ${voucher_number} - ${voucherData.type === 'supplier' ? (supplier?.name || '...') : (category?.name || '...')}`
      });

      // Credit: Payment Method (Cash/Bank)
      let creditAccountId = paymentMethod?.account_id || '';
      let creditAccountName = paymentMethod?.name || '';
      
      if (!creditAccountId) {
        const fallbackAccount = accounts.find(a => 
          a.name.includes('صندوق') || a.name.includes('بنك') || a.name.includes('خزينة')
        );
        creditAccountId = fallbackAccount?.id || 'cash_account_default';
        creditAccountName = fallbackAccount?.name || 'حساب الصندوق (افتراضي)';
      }

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: voucherData.amount,
        description: `سند صرف رقم ${voucher_number} - ${voucherData.type === 'supplier' ? (supplier?.name || '...') : (category?.name || '...')}`
      });

      setPreviewJournalEntry({
        id: 'preview',
        date: voucherData.date,
        reference_number: voucher_number,
        reference_id: 'preview',
        reference_type: 'payment',
        description: `قيد سند صرف رقم ${voucher_number}`,
        items: journalItems,
        total_debit: voucherData.amount,
        total_credit: voucherData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, voucherData, user, suppliers, categories, paymentMethods, accounts]);

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const code = `SUPP-${Date.now().toString().slice(-6)}`;
      const selectedAccount = accounts.find(a => a.id === supplierFormData.account_id);
      const newSupplier = {
        ...supplierFormData,
        code,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };
      const supplierId = await dbService.add('suppliers', newSupplier);

      // Create Journal Entry for Opening Balance if it's not zero
      if (supplierFormData.opening_balance !== 0 && supplierFormData.account_id && supplierFormData.counter_account_id) {
        const counterAccount = accounts.find(a => a.id === supplierFormData.counter_account_id);
        const journalItems: JournalEntryItem[] = [
          {
            account_id: supplierFormData.account_id,
            account_name: selectedAccount?.name || '',
            debit: supplierFormData.opening_balance < 0 ? Math.abs(supplierFormData.opening_balance) : 0,
            credit: supplierFormData.opening_balance > 0 ? supplierFormData.opening_balance : 0,
            description: `رصيد أول المدة - ${supplierFormData.name}`
          },
          {
            account_id: supplierFormData.counter_account_id,
            account_name: counterAccount?.name || '',
            debit: supplierFormData.opening_balance > 0 ? supplierFormData.opening_balance : 0,
            credit: supplierFormData.opening_balance < 0 ? Math.abs(supplierFormData.opening_balance) : 0,
            description: `رصيد أول المدة - ${supplierFormData.name}`
          }
        ];

        const journalEntry: Omit<JournalEntry, 'id'> = {
          date: supplierFormData.opening_balance_date,
          reference_number: `OB-${code}`,
          reference_id: supplierId,
          reference_type: 'opening_balance',
          description: `قيد رصيد أول المدة للمورد: ${supplierFormData.name}`,
          items: journalItems,
          total_debit: Math.abs(supplierFormData.opening_balance),
          total_credit: Math.abs(supplierFormData.opening_balance),
          company_id: user.company_id,
          created_at: new Date().toISOString(),
          created_by: user.id
        };
        await dbService.createJournalEntry(journalEntry);
      }

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مورد', `إضافة مورد جديد من سند الصرف: ${supplierFormData.name}`, ['suppliers', 'payment_vouchers']);
      
      setVoucherData({ ...voucherData, supplier_id: supplierId });
      setIsSupplierModalOpen(false);
      setSupplierFormData({
        name: '',
        mobile: '',
        email: '',
        address: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: '',
        counter_account_id: ''
      });
      showNotification('تم إضافة المورد بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة المورد', 'error');
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const code = `EXP-${Date.now().toString().slice(-6)}`;
      const newCategory = {
        ...categoryFormData,
        code,
        company_id: user.company_id
      };
      const categoryId = await dbService.add('expense_categories', newCategory);
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة بند مصروف', `إضافة بند مصروف جديد من سند الصرف: ${categoryFormData.name}`, ['expense_categories', 'payment_vouchers']);
      
      setVoucherData({ ...voucherData, expense_category_id: categoryId });
      setIsCategoryModalOpen(false);
      setCategoryFormData({
        name: '',
        description: ''
      });
      showNotification('تم إضافة بند المصروف بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة بند المصروف', 'error');
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
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من سند الصرف: ${paymentMethodFormData.name}`, ['payment_methods', 'payment_vouchers'], pmId);
      
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

      setVoucherData({ ...voucherData, payment_method_id: pmId });
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
      showNotification('تم إضافة طريقة الدفع بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة طريقة الدفع', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (voucherData.amount <= 0) {
      showNotification('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }

    try {
      const supplier = suppliers.find(s => s.id === voucherData.supplier_id);
      const category = categories.find(c => c.id === voucherData.expense_category_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === voucherData.payment_method_id);
      
      const voucher_number = editingVoucher 
        ? (editingVoucher.voucher_number || editingVoucher.number) 
        : `PAY-${Date.now().toString().slice(-6)}`;

      const data = {
        ...voucherData,
        voucher_number: editingVoucher?.voucher_number || voucher_number,
        supplier_name: supplier?.name || '',
        category_name: category?.name || '',
        payment_method_name: paymentMethod?.name || '',
        description: voucherData.notes,
        company_id: user.company_id
      };

      let id = '';
      if (editingVoucher) {
        const fieldsToTrack = [
          { field: 'type', label: 'النوع' },
          { field: 'supplier_id', label: 'المورد' },
          { field: 'expense_category_id', label: 'التصنيف' },
          { field: 'amount', label: 'المبلغ' },
          { field: 'payment_method_id', label: 'طريقة الدفع' },
          { field: 'date', label: 'التاريخ' },
          { field: 'notes', label: 'ملاحظات' }
        ];
        await dbService.updateWithLog(
          'payment_vouchers', 
          editingVoucher.id, 
          data,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل سند صرف',
          'payment_vouchers',
          fieldsToTrack
        );
        id = editingVoucher.id;
        // Delete old journal entry
        await dbService.deleteJournalEntryByReference(id, user.company_id);
      } else {
        id = await dbService.add('payment_vouchers', data);
      }
      
      // Create Journal Entry
      const journalItems: JournalEntryItem[] = [];
      const currentVoucherNumber = data.voucher_number;

        // Debit: Supplier or Expense Account
        let debitAccountId = '';
        let debitAccountName = '';

        if (voucherData.type === 'supplier') {
          debitAccountId = supplier?.account_id || '';
          debitAccountName = supplier?.account_name || '';
          
          if (!debitAccountId) {
            const fallbackAccount = accounts.find(a => a.name.includes('موردين'));
            debitAccountId = fallbackAccount?.id || 'suppliers_account_default';
            debitAccountName = fallbackAccount?.name || 'حساب الموردين (افتراضي)';
          }
        } else {
          debitAccountId = category?.account_id || '';
          debitAccountName = category?.account_name || '';
          
          if (!debitAccountId) {
            const fallbackAccount = accounts.find(a => a.name.includes('مصروف'));
            debitAccountId = fallbackAccount?.id || 'expenses_account_default';
            debitAccountName = fallbackAccount?.name || 'حساب المصروفات (افتراضي)';
          }
        }

        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: voucherData.amount,
          credit: 0,
          description: `سند صرف رقم ${voucher_number} - ${voucherData.notes}`,
          supplier_id: voucherData.type === 'supplier' ? voucherData.supplier_id : undefined,
          supplier_name: voucherData.type === 'supplier' ? supplier?.name : undefined
        });

        // Credit: Payment Method Account (Cash/Bank)
        let creditAccountId = paymentMethod?.account_id || '';
        let creditAccountName = paymentMethod?.account_name || '';

        if (!creditAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق') || a.name.includes('بنك')
          );
          creditAccountId = fallbackAccount?.id || 'cash_account_default';
          creditAccountName = fallbackAccount?.name || 'حساب النقدية (افتراضي)';
        }

        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          debit: 0,
          credit: voucherData.amount,
          description: `سند صرف رقم ${voucher_number} من حساب: ${paymentMethod?.name}`
        });

        if (journalItems.length > 0) {
          const journalEntry: Omit<JournalEntry, 'id'> = {
            date: voucherData.date,
            reference_number: voucher_number,
            reference_id: id,
            reference_type: 'payment',
            description: `قيد سند صرف رقم ${voucher_number}`,
            items: journalItems,
            total_debit: voucherData.amount,
            total_credit: voucherData.amount,
            company_id: user.company_id,
            created_at: new Date().toISOString(),
            created_by: user.id
          };
          await dbService.createJournalEntry(journalEntry);
        }

        await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة سند صرف', `إضافة سند صرف جديد رقم: ${voucher_number}`, 'payment_vouchers', id);

      showNotification(editingVoucher ? 'تم تعديل سند الصرف بنجاح' : 'تم حفظ سند الصرف بنجاح');
      setVoucherData({
        type: 'supplier',
        supplier_id: '',
        expense_category_id: '',
        amount: 0,
        payment_method_id: '',
        date: new Date().toISOString().slice(0, 10),
        notes: ''
      });
      setIsModalOpen(false);
      setEditingVoucher(null);
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء الاتصال بالخادم', 'error');
    }
  };

  const handleExportExcel = () => {
    const formattedData = formatDataForExcel(filteredVouchers, {
      'voucher_number': t('payments.column_number'),
      'entity_name': t('payments.column_recipient'),
      'date': t('payments.column_date'),
      'amount': t('payments.column_amount'),
      'description': t('payments.column_description')
    });
    exportToExcel(formattedData, { filename: 'PaymentVouchers_Report', sheetName: t('payments.title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { filename: 'PaymentVouchers_Report', orientation: 'landscape' });
    }
  };

  const handleDelete = async (id: string) => {
    setVoucherToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!voucherToDelete || !user) return;
    try {
      const voucher = vouchers.find(v => v.id === voucherToDelete);
      
      // Delete associated journal entry
      await dbService.deleteJournalEntryByReference(voucherToDelete, user.company_id);
      
      await dbService.delete('payment_vouchers', voucherToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف سند صرف', `حذف سند صرف رقم: ${voucher?.number}`, 'payment_vouchers');
      setIsDeleteModalOpen(false);
      setVoucherToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleViewVoucher = async (id: string) => {
    try {
      const data = await dbService.get<any>('payment_vouchers', id);
      if (data) setViewVoucher(data);
    } catch (e) {
      console.error(e);
    }
  };

  const exportToPDF = async (voucher: any) => {
    if (!voucherRef.current) return;
    try {
      await exportToPDFUtil(voucherRef.current, {
        filename: `Voucher-${voucher.id}.pdf`,
        margin: 10,
        orientation: 'portrait'
      });
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  const openEditModal = (voucher: any) => {
    setEditingVoucher(voucher);
    setVoucherData({
      type: voucher.type as 'supplier' | 'expense',
      supplier_id: voucher.supplier_id?.toString() || '',
      expense_category_id: voucher.expense_category_id?.toString() || '',
      amount: voucher.amount,
      payment_method_id: voucher.payment_method_id.toString(),
      date: voucher.date,
      notes: voucher.description || ''
    });
    setIsModalOpen(true);
  };

  const filteredVouchers = vouchers.filter(v => 
    v.voucher_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('payments.title')}</h2>
          <p className="text-zinc-500">{t('payments.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
            title={t('common.activity_log')}
          >
            <History size={20} />
            <span className="hidden md:inline">{t('common.activity_log')}</span>
          </button>
          <ExportButtons 
            onExportExcel={handleExportExcel} 
            onExportPDF={handleExportPDF} 
          />
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-200"
          >
            <Plus size={20} />
            {t('payments.add')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="البحث عن سندات..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-zinc-900 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="md:hidden divide-y divide-zinc-100">
          {filteredVouchers.map((voucher) => (
            <div key={voucher.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700 font-bold">{voucher.voucher_number}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      voucher.type === 'supplier' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                    }`}>
                      {voucher.type === 'supplier' ? 'مورد' : 'مصروف'}
                    </span>
                  </div>
                  <h4 className="font-bold text-zinc-900">
                    {voucher.type === 'supplier' ? voucher.supplier_name : voucher.category_name}
                  </h4>
                  <p className="text-xs text-zinc-500">{voucher.date}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold text-zinc-900">{voucher.amount.toLocaleString()} ج.م</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(voucher.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                  title="سجل النشاط"
                >
                  <History size={18} />
                </button>
                <button 
                  onClick={() => handleViewVoucher(voucher.id)}
                  className="p-2 text-emerald-500 bg-emerald-50 rounded-xl transition-all"
                >
                  <Eye size={18} />
                </button>
                <button 
                  onClick={() => openEditModal(voucher)}
                  className="p-2 text-blue-500 bg-blue-50 rounded-xl transition-all"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(voucher.id)}
                  className="p-2 text-red-500 bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {filteredVouchers.length === 0 && !loading && (
            <div className="p-8 text-center text-zinc-400 italic">لا توجد سندات صرف حالياً</div>
          )}
        </div>

        <div ref={tableRef} id="payment-vouchers-list-table" className="hidden md:block overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">رقم السند</th>
                <th className="px-6 py-4 font-bold">النوع</th>
                <th className="px-6 py-4 font-bold">المستفيد / الفئة</th>
                <th className="px-6 py-4 font-bold">التاريخ</th>
                <th className="px-6 py-4 font-bold">المبلغ</th>
                <th className="px-6 py-4 font-bold text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 italic">لا توجد سندات صرف حالياً</td>
                </tr>
              ) : filteredVouchers.map((voucher) => (
                <tr key={voucher.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded text-zinc-700 font-bold">{voucher.voucher_number}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      voucher.type === 'supplier' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                    }`}>
                      {voucher.type === 'supplier' ? 'مورد' : 'مصروف'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-zinc-900">
                    {voucher.type === 'supplier' ? voucher.supplier_name : voucher.category_name}
                  </td>
                  <td className="px-6 py-4 text-zinc-500">{voucher.date}</td>
                  <td className="px-6 py-4 font-bold text-zinc-900">{voucher.amount.toLocaleString()} ج.م</td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity no-pdf">
                      <button 
                        onClick={() => {
                          setActivityLogDocumentId(voucher.id);
                          setIsActivityLogOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                        title="سجل النشاط"
                      >
                        <History size={18} />
                      </button>
                      <button 
                        onClick={() => handleViewVoucher(voucher.id)}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => openEditModal(voucher)}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(voucher.id)}
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
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-6xl md:rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-bold text-zinc-900 italic serif">{editingVoucher ? 'تعديل سند صرف' : 'إنشاء سند صرف'}</h3>
                <button 
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${showSidePanel ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'}`}
                >
                  <History size={14} />
                  {showSidePanel ? 'إخفاء القيد والسجل' : 'قيد اليومية'}
                </button>
              </div>
              <button onClick={() => {
                setIsModalOpen(false);
                setEditingVoucher(null);
                setVoucherData({
                  type: 'supplier',
                  supplier_id: '',
                  expense_category_id: '',
                  amount: 0,
                  payment_method_id: '',
                  date: new Date().toISOString().slice(0, 10),
                  notes: ''
                });
              }} className="p-2 hover:bg-zinc-100 rounded-xl transition-all">
                <X size={24} />
              </button>
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
                    className="absolute inset-y-0 right-0 z-50 w-full lg:w-80 shadow-2xl lg:shadow-none lg:relative lg:inset-auto"
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
                          documentId={editingVoucher?.id || ''} 
                          category="payment_vouchers" 
                          previewJournalEntry={previewJournalEntry}
                          previewActivityLog={previewActivityLog}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
                <SmartAIInput 
                  onDataExtracted={(data) => {
                    if (data.supplierName) {
                      const supplier = suppliers.find(s => s.name.includes(data.supplierName!) || data.supplierName!.includes(s.name));
                      if (supplier) {
                        setVoucherData(prev => ({ ...prev, supplier_id: supplier.id, type: 'supplier' }));
                      }
                    }
                    if (data.amount) setVoucherData(prev => ({ ...prev, amount: data.amount! }));
                    if (data.date) setVoucherData(prev => ({ ...prev, date: data.date! }));
                    if (data.description || data.notes) setVoucherData(prev => ({ ...prev, notes: data.description || data.notes || '' }));
                    if (data.paymentMethod) {
                      const pm = paymentMethods.find(p => p.name.includes(data.paymentMethod!) || data.paymentMethod!.includes(p.name));
                      if (pm) setVoucherData(prev => ({ ...prev, payment_method_id: pm.id }));
                    }
                  }}
                  transactionType="payment_voucher"
                />
                <div className="flex bg-zinc-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setVoucherData({...voucherData, type: 'supplier', expense_category_id: ''})}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    voucherData.type === 'supplier' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  صرف لمورد
                </button>
                <button
                  type="button"
                  onClick={() => setVoucherData({...voucherData, type: 'expense', supplier_id: ''})}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    voucherData.type === 'expense' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  صرف مصروفات
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {voucherData.type === 'supplier' ? (
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">المورد</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <select 
                        required
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all appearance-none"
                        value={voucherData.supplier_id}
                        onChange={(e) => {
                          if (e.target.value === 'new_supplier') {
                            setIsSupplierModalOpen(true);
                          } else {
                            setVoucherData({...voucherData, supplier_id: e.target.value});
                          }
                        }}
                      >
                        <option value="">اختر المورد...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                        <option value="new_supplier" className="font-bold text-emerald-600">+ إضافة مورد جديد</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">بند المصروف</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <select 
                        required
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all appearance-none"
                        value={voucherData.expense_category_id}
                        onChange={(e) => {
                          if (e.target.value === 'new_category') {
                            setIsCategoryModalOpen(true);
                          } else {
                            setVoucherData({...voucherData, expense_category_id: e.target.value});
                          }
                        }}
                      >
                        <option value="">اختر البند...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                        <option value="new_category" className="font-bold text-emerald-600">+ إضافة بند مصروف جديد</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">التاريخ</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <input 
                      required
                      type="date" 
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                      value={voucherData.date}
                      onChange={(e) => setVoucherData({...voucherData, date: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">المبلغ</label>
                  <div className="relative">
                    <Wallet className="absolute left-3 top-3 text-emerald-500" size={18} />
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all font-bold text-lg"
                      placeholder="0.00"
                      value={voucherData.amount || ''}
                      onChange={(e) => setVoucherData({...voucherData, amount: Number(e.target.value)})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">طريقة الصرف (من خزينة/بنك)</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <select 
                      required
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all appearance-none"
                      value={voucherData.payment_method_id}
                      onChange={(e) => {
                        if (e.target.value === 'new_payment_method') {
                          setIsPaymentMethodModalOpen(true);
                        } else {
                          setVoucherData({...voucherData, payment_method_id: e.target.value});
                        }
                      }}
                    >
                      <option value="">اختر الطريقة...</option>
                      {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                      <option value="new_payment_method" className="font-bold text-emerald-600">+ إضافة طريقة دفع جديدة</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2 uppercase tracking-tighter">البيان / ملاحظات</label>
                <textarea 
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all resize-none"
                  placeholder="اكتب تفاصيل الصرف هنا..."
                  value={voucherData.notes}
                  onChange={(e) => setVoucherData({...voucherData, notes: e.target.value})}
                />
              </div>

              <div className="flex justify-end pt-6 border-t border-zinc-100">
                <button 
                  type="submit"
                  className="flex items-center gap-3 px-12 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 active:scale-95"
                >
                  <Save size={24} />
                  {editingVoucher ? 'تحديث سند الصرف' : 'حفظ سند الصرف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}

      {/* View Modal */}
      {viewVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <FileText size={24} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">سند صرف رقم {viewVoucher.id}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(viewVoucher.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                  title="سجل النشاط"
                >
                  <History size={20} />
                </button>
                <button 
                  onClick={() => exportToPDF(viewVoucher)}
                  className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title="تصدير PDF"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={() => setViewVoucher(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              {/* Side Panel for Activity Log and Journal Entry */}
              <TransactionSidePanel 
                documentId={viewVoucher.id} 
                category="payment_vouchers" 
              />

              <div className="flex-1 overflow-y-auto p-8" ref={voucherRef}>
                <div className="space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="text-right">
                      <h1 className="text-3xl font-black text-emerald-600 mb-2">سند صرف</h1>
                      <p className="text-zinc-500">التاريخ: {viewVoucher.date}</p>
                    </div>
                    <div className="text-left">
                      <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl">
                        LOGO
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div>
                      <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">يصرف للسيد / السادة</p>
                      <p className="text-lg font-bold text-zinc-900">{viewVoucher.supplier_name || viewVoucher.expense_category_name || '---'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">المبلغ</p>
                      <p className="text-2xl font-black text-emerald-600">{viewVoucher.amount.toLocaleString()} ج.م</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between py-3 border-b border-zinc-100">
                      <span className="text-zinc-500">وذلك عن:</span>
                      <span className="font-bold text-zinc-900">{viewVoucher.description || '---'}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-zinc-100">
                      <span className="text-zinc-500">طريقة الصرف:</span>
                      <span className="font-bold text-zinc-900">{viewVoucher.payment_method_name || '---'}</span>
                    </div>
                  </div>

                  <div className="pt-12 flex justify-between items-end">
                    <div className="text-center">
                      <div className="w-32 border-b-2 border-zinc-200 mb-2"></div>
                      <p className="text-xs text-zinc-400">توقيع المستلم</p>
                    </div>
                    <div className="text-center">
                      <div className="w-32 border-b-2 border-zinc-200 mb-2"></div>
                      <p className="text-xs text-zinc-400">الختم</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة مورد جديد</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleSupplierSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم المورد</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                        value={supplierFormData.name}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
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
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all text-left"
                        value={supplierFormData.mobile}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, mobile: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        type="email"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all text-left"
                        value={supplierFormData.email}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العنوان</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                      rows={2}
                      value={supplierFormData.address}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">رصيد أول</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="number" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                          value={supplierFormData.opening_balance}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">تاريخ الرصيد</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                        <input 
                          type="date" 
                          className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                          value={supplierFormData.opening_balance_date}
                          onChange={(e) => setSupplierFormData({ ...supplierFormData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                      value={supplierFormData.account_id}
                      onChange={(e) => setSupplierFormData({ ...supplierFormData, account_id: e.target.value })}
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {supplierFormData.opening_balance !== 0 && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">حساب مقابل رصيد أول المدة</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        value={supplierFormData.counter_account_id}
                        onChange={(e) => setSupplierFormData({ ...supplierFormData, counter_account_id: e.target.value })}
                      >
                        <option value="">اختر الحساب المقابل...</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-orange-600 mt-1 font-medium">يستخدم هذا الحساب لإنشاء قيد رصيد أول المدة (مثلاً: رأس المال أو الأرباح المرحلة)</p>
                    </div>
                  )}
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/20 active:scale-95"
                  >
                    حفظ المورد
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsSupplierModalOpen(false)}
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

      {/* Add Expense Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة بند مصروف جديد</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleCategorySubmit} className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto pb-32 md:pb-6">
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم البند</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الوصف</label>
                <textarea
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                />
              </div>
              <div className="pt-4 pb-8 md:pb-0">
                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/20 active:scale-95"
                >
                  حفظ البند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {isPaymentMethodModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة طريقة دفع جديدة</h3>
              <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handlePaymentMethodSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">كود الطريقة</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentMethodFormData.code}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, code: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم الطريقة</label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentMethodFormData.name}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">النوع</label>
                    <div className="relative">
                      <Layers className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <select
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none"
                        value={paymentMethodFormData.type}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, type: e.target.value as any })}
                      >
                        <option value="cash">نقدي (خزينة)</option>
                        <option value="bank">بنكي</option>
                        <option value="wallet">محفظة إلكترونية</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={paymentMethodFormData.account_id}
                      onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, account_id: e.target.value })}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الرصيد الافتتاحي</label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input 
                        type="number" 
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentMethodFormData.opening_balance}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">تاريخ الرصيد</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input 
                        type="date" 
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentMethodFormData.opening_balance_date}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, opening_balance_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {paymentMethodFormData.opening_balance !== 0 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">حساب الطرف الآخر (للرصيد الافتتاحي)</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all border-emerald-200 bg-emerald-50/30"
                        value={paymentMethodFormData.counter_account_id}
                        onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, counter_account_id: e.target.value })}
                      >
                        <option value="">اختر حساب الطرف الآخر...</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {paymentMethodFormData.counter_account_id && paymentMethodFormData.account_id && (
                      <JournalEntryPreview 
                        title="معاينة قيد الرصيد الافتتاحي"
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
                            description: `رصيد افتتاحي لطريقة الدفع: ${paymentMethodFormData.name}`
                          }
                        ]}
                      />
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">تفاصيل إضافية</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-zinc-400" size={18} />
                    <textarea
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={3}
                      value={paymentMethodFormData.details}
                      onChange={(e) => setPaymentMethodFormData({ ...paymentMethodFormData, details: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    حفظ الطريقة
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
              <div className="hidden md:block w-80 border-r border-zinc-100 bg-zinc-50/30">
                <InlineActivityLog category="payment_methods" documentId={undefined} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">تأكيد الحذف</h3>
            <p className="text-zinc-500 mb-6">هل أنت متأكد من رغبتك في حذف هذا السند؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setVoucherToDelete(null);
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
        category="payment_vouchers"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
