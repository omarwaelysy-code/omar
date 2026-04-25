import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ReceiptVoucher, Customer, PaymentMethod, JournalEntry, JournalEntryItem, Account } from '../types';
import { Search, Plus, Trash2, X, Receipt as ReceiptIcon, Pencil, CreditCard, Download, Eye, FileText, History, Printer, Phone, Mail, MapPin, Wallet, Calendar, Hash, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { TransactionSidePanel } from '../components/TransactionSidePanel';
import { ExportButtons } from '../components/ExportButtons';
import { SmartAIInput } from '../components/SmartAIInput';
import { ActivityLog } from '../types';

export const Receipts: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const [receipts, setReceipts] = useState<ReceiptVoucher[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptVoucher | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);
  const [viewReceipt, setViewReceipt] = useState<ReceiptVoucher | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [previewJournalEntry, setPreviewJournalEntry] = useState<JournalEntry | null>(null);
  const [previewActivityLog, setPreviewActivityLog] = useState<Partial<ActivityLog> | null>(null);
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    address: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: '',
    counter_account_id: ''
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
  const [formData, setFormData] = useState({ 
    customer_id: '', 
    date: new Date().toISOString().slice(0, 10), 
    amount: 0, 
    description: '',
    payment_method_id: ''
  });

  useEffect(() => {
    if (user) {
      const unsubReceipts = dbService.subscribe<ReceiptVoucher>('receipt_vouchers', user.company_id, setReceipts);
      const unsubCustomers = dbService.subscribe<Customer>('customers', user.company_id, setCustomers);
      const unsubPM = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setPaymentMethods);
      const unsubAccounts = dbService.subscribe<any>('accounts', user.company_id, setAccounts);
      
      setLoading(false);
      return () => {
        unsubReceipts();
        unsubCustomers();
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
      if (formData.amount <= 0) {
        setPreviewJournalEntry(null);
        setPreviewActivityLog(null);
        return;
      }

      const customer = customers.find(c => c.id === formData.customer_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === formData.payment_method_id);
      const receipt_number = 'REC-PREVIEW';

      // Preview Activity Log
      setPreviewActivityLog({
        action: 'إضافة سند قبض',
        details: `إضافة سند قبض جديد من العميل ${customer?.name || '...'} بمبلغ ${formData.amount.toLocaleString()}`,
        timestamp: new Date().toISOString()
      });

      // Preview Journal Entry
      const journalItems: JournalEntryItem[] = [];

      // Debit: Payment Method (Cash/Bank)
      let debitAccountId = paymentMethod?.account_id || '';
      let debitAccountName = paymentMethod?.name || '';
      
      if (!debitAccountId) {
        const fallbackAccount = accounts.find(a => 
          a.name.includes('صندوق') || a.name.includes('بنك') || a.name.includes('خزينة')
        );
        debitAccountId = fallbackAccount?.id || 'cash_account_default';
        debitAccountName = fallbackAccount?.name || 'حساب الصندوق (افتراضي)';
      }

      journalItems.push({
        account_id: debitAccountId,
        account_name: debitAccountName,
        debit: formData.amount,
        credit: 0,
        description: `سند قبض رقم ${receipt_number} - ${customer?.name || '...'}`
      });

      // Credit: Customer
      let creditAccountId = customer?.account_id || '';
      let creditAccountName = customer?.account_name || '';
      
      if (!creditAccountId) {
        const fallbackAccount = accounts.find(a => a.name.includes('عملاء'));
        creditAccountId = fallbackAccount?.id || 'customers_account_default';
        creditAccountName = fallbackAccount?.name || 'حساب العملاء (افتراضي)';
      }

      journalItems.push({
        account_id: creditAccountId,
        account_name: creditAccountName,
        debit: 0,
        credit: formData.amount,
        description: `سند قبض رقم ${receipt_number} - ${customer?.name || '...'}`
      });

      setPreviewJournalEntry({
        id: 'preview',
        date: formData.date,
        reference_number: receipt_number,
        reference_id: 'preview',
        reference_type: 'receipt',
        description: `قيد سند قبض رقم ${receipt_number}`,
        items: journalItems,
        total_debit: formData.amount,
        total_credit: formData.amount,
        company_id: user.company_id,
        created_at: new Date().toISOString(),
        created_by: user.id
      });
    };

    generatePreview();
  }, [isModalOpen, formData, user, customers, paymentMethods, accounts]);

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const code = `CUST-${Date.now().toString().slice(-6)}`;
      const selectedAccount = accounts.find(a => a.id === customerFormData.account_id);
      const newCustomer = {
        ...customerFormData,
        code,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };
      const customerId = await dbService.add('customers', newCustomer);

      // Create Journal Entry for Opening Balance if it's not zero
      if (customerFormData.opening_balance !== 0 && customerFormData.account_id && customerFormData.counter_account_id) {
        const counterAccount = accounts.find(a => a.id === customerFormData.counter_account_id);
        const journalItems: JournalEntryItem[] = [
          {
            account_id: customerFormData.account_id,
            account_name: selectedAccount?.name || '',
            debit: customerFormData.opening_balance > 0 ? customerFormData.opening_balance : 0,
            credit: customerFormData.opening_balance < 0 ? Math.abs(customerFormData.opening_balance) : 0,
            description: `رصيد أول المدة - ${customerFormData.name}`
          },
          {
            account_id: customerFormData.counter_account_id,
            account_name: counterAccount?.name || '',
            debit: customerFormData.opening_balance < 0 ? Math.abs(customerFormData.opening_balance) : 0,
            credit: customerFormData.opening_balance > 0 ? customerFormData.opening_balance : 0,
            description: `رصيد أول المدة - ${customerFormData.name}`
          }
        ];

        const journalEntry: Omit<JournalEntry, 'id'> = {
          date: customerFormData.opening_balance_date,
          reference_number: `OB-${code}`,
          reference_id: customerId,
          reference_type: 'opening_balance',
          description: `قيد رصيد أول المدة للعميل: ${customerFormData.name}`,
          items: journalItems,
          total_debit: Math.abs(customerFormData.opening_balance),
          total_credit: Math.abs(customerFormData.opening_balance),
          company_id: user.company_id,
          created_at: new Date().toISOString(),
          created_by: user.id
        };
        await dbService.createJournalEntry(journalEntry);
      }

      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة عميل', `إضافة عميل جديد من سند القبض: ${customerFormData.name}`, ['customers', 'receipt_vouchers']);
      
      setFormData({ ...formData, customer_id: customerId });
      setIsCustomerModalOpen(false);
      setCustomerFormData({
        name: '',
        mobile: '',
        email: '',
        address: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: '',
        counter_account_id: ''
      });
      showNotification('تم إضافة العميل بنجاح');
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء إضافة العميل', 'error');
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
      await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة من سند القبض: ${paymentMethodFormData.name}`, ['payment_methods', 'receipt_vouchers'], pmId);
      
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

      setFormData({ ...formData, payment_method_id: pmId });
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
    if (!user || !formData.customer_id) return;

    try {
      const customer = customers.find(c => c.id === formData.customer_id);
      const paymentMethod = paymentMethods.find(pm => pm.id === formData.payment_method_id);
      const voucher_number = editingReceipt 
        ? editingReceipt.voucher_number 
        : `RCPT-${Date.now().toString().slice(-6)}`;
      
      const receiptData = {
        ...formData,
        voucher_number,
        customer_name: customer?.name || '',
        payment_method_name: paymentMethod?.name || '',
        company_id: user.company_id
      };

      let id = '';
      if (editingReceipt) {
        const fieldsToTrack = [
          { field: 'customer_id', label: 'العميل' },
          { field: 'amount', label: 'المبلغ' },
          { field: 'payment_method_id', label: 'طريقة الدفع' },
          { field: 'date', label: 'التاريخ' },
          { field: 'description', label: 'البيان' }
        ];
        await dbService.updateWithLog(
          'receipt_vouchers', 
          editingReceipt.id, 
          receiptData,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل سند قبض',
          'receipt_vouchers',
          fieldsToTrack
        );
        id = editingReceipt.id;
      } else {
        id = await dbService.add('receipt_vouchers', receiptData);
      }

      // Success notification and modal close early
      showNotification(editingReceipt ? 'تم تحديث سند القبض بنجاح' : 'تم إضافة سند القبض بنجاح', 'success');
      closeModal();

      // Background post-save hooks
      try {
        if (editingReceipt) {
          // Always handle journal entry to ensure consistency
          await dbService.deleteJournalEntryByReference(id, user.company_id);
        }

        // Create Journal Entry
        const journalItems: JournalEntryItem[] = [];
        const receipt_number = voucher_number;

        // Debit: Payment Method Account (Cash/Bank)
        let debitAccountId = paymentMethod?.account_id || '';
        let debitAccountName = paymentMethod?.name || '';

        if (!debitAccountId) {
          const fallbackAccount = accounts.find(a => 
            a.name.includes('نقدية') || a.name.includes('خزينة') || a.name.includes('صندوق') || a.name.includes('بنك')
          );
          debitAccountId = fallbackAccount?.id || 'cash_account_default';
          debitAccountName = fallbackAccount?.name || 'حساب النقدية (افتراضي)';
        }

        journalItems.push({
          account_id: debitAccountId,
          account_name: debitAccountName,
          debit: formData.amount,
          credit: 0,
          description: `سند قبض رقم ${receipt_number} - ${formData.description}`
        });

        // Credit: Customer Account
        let creditAccountId = customer?.account_id || '';
        let creditAccountName = customer?.account_name || '';

        if (!creditAccountId) {
          const fallbackAccount = accounts.find(a => a.name.includes('عملاء'));
          creditAccountId = fallbackAccount?.id || 'customers_account_default';
          creditAccountName = fallbackAccount?.name || 'حساب العملاء (افتراضي)';
        }

        journalItems.push({
          account_id: creditAccountId,
          account_name: creditAccountName,
          debit: 0,
          credit: formData.amount,
          description: `سند قبض رقم ${receipt_number} من العميل: ${customer?.name}`,
          customer_id: formData.customer_id,
          customer_name: customer?.name
        });

        if (journalItems.length > 0) {
          const journalEntry: Omit<JournalEntry, 'id'> = {
            date: formData.date,
            reference_number: receipt_number,
            reference_id: id,
            reference_type: 'receipt',
            description: `قيد سند قبض رقم ${receipt_number}`,
            items: journalItems,
            total_debit: formData.amount,
            total_credit: formData.amount,
            company_id: user.company_id,
            created_at: new Date().toISOString(),
            created_by: user.id
          };
          await dbService.createJournalEntry(journalEntry);
        }

        if (!editingReceipt) {
          await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة سند قبض', `إضافة سند قبض جديد للعميل: ${customer?.name}`, 'receipt_vouchers', id);
        }
      } catch (postError) {
        console.error('Post-save operations failed:', postError);
      }
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء حفظ السند', 'error');
    }

  };

  const handleDelete = async (id: string) => {
    setReceiptToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!receiptToDelete || !user) return;
    try {
      const receipt = receipts.find(r => r.id === receiptToDelete);
      
      // Delete associated journal entry
      await dbService.deleteJournalEntryByReference(receiptToDelete, user.company_id);
      
      await dbService.delete('receipt_vouchers', receiptToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف سند قبض', `حذف سند قبض للعميل: ${receipt?.customer_name}`, 'receipt_vouchers');
      setIsDeleteModalOpen(false);
      setReceiptToDelete(null);
    } catch (e) {
      console.error(e);
    }
  };

  const openEditModal = (receipt: ReceiptVoucher) => {
    setEditingReceipt(receipt);
    setFormData({
      customer_id: receipt.customer_id,
      date: receipt.date,
      amount: receipt.amount,
      description: receipt.description,
      payment_method_id: receipt.payment_method_id || ''
    });
    setIsModalOpen(true);
  };

  const handleViewReceipt = (receipt: ReceiptVoucher) => {
    setViewReceipt(receipt);
  };

  const exportToPDF = async (receipt: ReceiptVoucher) => {
    if (!receiptRef.current) return;
    try {
      await exportToPDFUtil(receiptRef.current, {
        filename: `Receipt-${receipt.id}.pdf`,
        margin: 10,
        orientation: 'portrait'
      });
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  const handleExportExcel = () => {
    const formattedData = formatDataForExcel(filteredReceipts, {
      'receipt_number': t('receipts.column_number'),
      'customer_name': t('receipts.column_customer'),
      'date': t('receipts.column_date'),
      'amount': t('receipts.column_amount'),
      'description': t('receipts.column_description')
    });
    exportToExcel(formattedData, { filename: 'Receipts_Report', sheetName: t('receipts.title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { filename: 'Receipts_Report', orientation: 'landscape' });
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingReceipt(null);
    setFormData({ 
      customer_id: '', 
      date: new Date().toISOString().slice(0, 10), 
      amount: 0, 
      description: '',
      payment_method_id: ''
    });
  };

  const filteredReceipts = receipts.filter(r => 
    r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('receipts.title')}</h2>
          <p className="text-zinc-500">{t('receipts.subtitle')}</p>
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
            {t('receipts.add')}
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
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="md:hidden divide-y divide-zinc-100">
          {filteredReceipts.map((receipt) => (
            <div key={receipt.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-zinc-900">{receipt.customer_name}</h4>
                  <p className="text-xs text-zinc-500">{receipt.date}</p>
                  {receipt.payment_method_name && (
                    <p className="text-[10px] text-emerald-600 font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                      {receipt.payment_method_name}
                    </p>
                  )}
                </div>
                <div className="text-left">
                  <p className="font-bold text-emerald-600">{receipt.amount.toLocaleString()} ج.م</p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 line-clamp-2">{receipt.description}</p>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(receipt.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                  title="سجل النشاط"
                >
                  <History size={18} />
                </button>
                <button 
                  onClick={() => handleViewReceipt(receipt)}
                  className="p-2 text-emerald-500 bg-emerald-50 rounded-lg transition-all"
                >
                  <Eye size={18} />
                </button>
                <button 
                  onClick={() => openEditModal(receipt)}
                  className="p-2 text-blue-500 bg-blue-50 rounded-lg transition-all"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(receipt.id)}
                  className="p-2 text-red-500 bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {filteredReceipts.length === 0 && !loading && (
            <div className="p-8 text-center text-zinc-500 italic">لا توجد سندات قبض.</div>
          )}
        </div>

        <div ref={tableRef} id="receipts-list-table" className="hidden md:block overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">العميل</th>
                <th className="px-6 py-4 font-bold">التاريخ</th>
                <th className="px-6 py-4 font-bold">طريقة السداد</th>
                <th className="px-6 py-4 font-bold">المبلغ</th>
                <th className="px-6 py-4 font-bold">الوصف</th>
                <th className="px-6 py-4 font-bold text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-zinc-900">{receipt.customer_name}</td>
                  <td className="px-6 py-4 text-zinc-500">{receipt.date}</td>
                  <td className="px-6 py-4">
                    {receipt.payment_method_name ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        {receipt.payment_method_name}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-600">{receipt.amount.toLocaleString()} ج.م</td>
                  <td className="px-6 py-4 text-zinc-500 truncate max-w-xs">{receipt.description}</td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity no-pdf">
                      <button 
                        onClick={() => {
                          setActivityLogDocumentId(receipt.id);
                          setIsActivityLogOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                        title="سجل النشاط"
                      >
                        <History size={18} />
                      </button>
                      <button 
                        onClick={() => handleViewReceipt(receipt)}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => openEditModal(receipt)}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(receipt.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReceipts.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">لا توجد سندات قبض.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-w-5xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-6 border-b border-zinc-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-zinc-900">{editingReceipt ? 'تعديل سند قبض' : 'إضافة سند قبض'}</h3>
                <button 
                  type="button"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${showSidePanel ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200'}`}
                >
                  <History size={14} />
                  {showSidePanel ? 'إخفاء القيد والسجل' : 'قيد اليومية'}
                </button>
              </div>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-2"><X size={24} /></button>
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
                          documentId={editingReceipt?.id || ''} 
                          category="receipt_vouchers" 
                          previewJournalEntry={previewJournalEntry}
                          previewActivityLog={previewActivityLog}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-4 overflow-y-auto">
                <SmartAIInput 
                  onDataExtracted={(data) => {
                    if (data.customerName) {
                      const customer = customers.find(c => c.name.includes(data.customerName!) || data.customerName!.includes(c.name));
                      if (customer) {
                        setFormData(prev => ({ ...prev, customer_id: customer.id }));
                      }
                    }
                    if (data.amount) setFormData(prev => ({ ...prev, amount: data.amount! }));
                    if (data.date) setFormData(prev => ({ ...prev, date: data.date! }));
                    if (data.description) setFormData(prev => ({ ...prev, description: data.description! }));
                    if (data.paymentMethod) {
                      const pm = paymentMethods.find(p => p.name.includes(data.paymentMethod!) || data.paymentMethod!.includes(p.name));
                      if (pm) setFormData(prev => ({ ...prev, payment_method_id: pm.id }));
                    }
                  }}
                  transactionType="receipt_voucher"
                />
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العميل</label>
                <select 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={formData.customer_id}
                  onChange={(e) => {
                    if (e.target.value === 'new_customer') {
                      setIsCustomerModalOpen(true);
                    } else {
                      setFormData({ ...formData, customer_id: e.target.value });
                    }
                  }}
                >
                  <option value="">اختر العميل</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="new_customer" className="font-bold text-emerald-600">+ إضافة عميل جديد</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">طريقة السداد</label>
                <select 
                  required
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={formData.payment_method_id}
                  onChange={(e) => {
                    if (e.target.value === 'new_payment_method') {
                      setIsPaymentMethodModalOpen(true);
                    } else {
                      setFormData({ ...formData, payment_method_id: e.target.value });
                    }
                  }}
                >
                  <option value="">اختر طريقة السداد</option>
                  {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                  <option value="new_payment_method" className="font-bold text-emerald-600">+ إضافة طريقة دفع جديدة</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">التاريخ</label>
                  <input
                    required
                    type="date"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">المبلغ</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={isNaN(formData.amount) ? '' : formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الوصف</label>
                <textarea
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                >
                  {editingReceipt ? 'تحديث السند' : 'حفظ السند'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}

      {/* View Modal */}
      {viewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <FileText size={24} />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">سند قبض رقم {viewReceipt.id}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setActivityLogDocumentId(viewReceipt.id);
                    setIsActivityLogOpen(true);
                  }}
                  className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                  title="سجل النشاط"
                >
                  <History size={20} />
                </button>
                <button 
                  onClick={() => exportToPDF(viewReceipt)}
                  className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title="تصدير PDF"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={() => setViewReceipt(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row h-full">
              {/* Side Panel for Activity Log and Journal Entry */}
              <TransactionSidePanel 
                documentId={viewReceipt.id} 
                category="receipts" 
              />

              <div className="flex-1 overflow-y-auto p-8" ref={receiptRef} id="receipt-capture-area">
                <div className="space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="text-right">
                      <h1 className="text-3xl font-black text-emerald-600 mb-2">سند قبض</h1>
                      <p className="text-zinc-500">التاريخ: {viewReceipt.date}</p>
                    </div>
                    <div className="text-left">
                      <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl">
                        LOGO
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div>
                      <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">وصلنا من السيد / السادة</p>
                      <p className="text-lg font-bold text-zinc-900">{viewReceipt.customer_name}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">المبلغ</p>
                      <p className="text-2xl font-black text-emerald-600">{viewReceipt.amount.toLocaleString()} ج.م</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between py-3 border-b border-zinc-100">
                      <span className="text-zinc-500">وذلك عن:</span>
                      <span className="font-bold text-zinc-900">{viewReceipt.description || '---'}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-zinc-100">
                      <span className="text-zinc-500">طريقة السداد:</span>
                      <span className="font-bold text-zinc-900">{viewReceipt.payment_method_name || '---'}</span>
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

      {/* Add Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">إضافة عميل جديد</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleCustomerSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">اسم العميل</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-zinc-400" size={18} />
                      <input
                        required
                        type="text"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={customerFormData.name}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
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
                        value={customerFormData.mobile}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, mobile: e.target.value })}
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
                        value={customerFormData.email}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">العنوان</label>
                    <textarea
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      rows={2}
                      value={customerFormData.address}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
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
                          value={customerFormData.opening_balance}
                          onChange={(e) => setCustomerFormData({ ...customerFormData, opening_balance: Number(e.target.value) })}
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
                          value={customerFormData.opening_balance_date}
                          onChange={(e) => setCustomerFormData({ ...customerFormData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">الحساب المحاسبي</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={customerFormData.account_id}
                      onChange={(e) => setCustomerFormData({ ...customerFormData, account_id: e.target.value })}
                    >
                      <option value="">اختر الحساب...</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {customerFormData.opening_balance !== 0 && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter">حساب مقابل رصيد أول المدة</label>
                      <select
                        required
                        className="w-full px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        value={customerFormData.counter_account_id}
                        onChange={(e) => setCustomerFormData({ ...customerFormData, counter_account_id: e.target.value })}
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
                  setReceiptToDelete(null);
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
        category="receipts" 
        isOpen={isActivityLogOpen} 
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }} 
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
