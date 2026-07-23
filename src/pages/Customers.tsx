import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Customer, Account, JournalEntry } from '../types';
import { 
  Search, Plus, Edit2, Trash2, X, History, FileText, User, 
  Hash, Box, Wallet, Calendar, Phone, Mail, MapPin, Lock,
  LayoutGrid, List, ChevronRight, ChevronLeft, AlertCircle, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { ExportButtons } from '../components/ExportButtons';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { useRef } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { formatNumber } from '../utils/formatUtils';
import { useViewPreference } from '../hooks/useViewPreference';
import { FormattedNumberInput } from '../components/FormattedNumberInput';

export const Customers: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const tableRef = useRef<HTMLTableElement>(null);
  const [view, setView] = useViewPreference('customers', 'table');

  const handleExportExcel = () => {
    const headers = {
      'code': t('customers.column_code'),
      'name': t('customers.column_name'),
      'mobile': t('customers.form_mobile'),
      'email': t('customers.form_email'),
      'address': t('customers.form_address'),
      'opening_balance': t('customers.form_opening_balance')
    };
    const formattedData = formatDataForExcel(customers, headers);
    exportToExcel(formattedData, { filename: 'Customers_List', sheetName: t('customers.title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Customers_List',
        reportTitle: t('customers.list_title')
      });
    }
  };
  const [formData, setFormData] = useState({ 
    name: '', 
    mobile: '', 
    email: '', 
    address: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: '',
    account_name: '',
    counter_account_id: '',
    payment_method: 'credit',
    credit_limit: 0,
    payment_terms: 'due_on_receipt',
    payment_terms_days: 0,
    advance_percentage: 0,
    is_active: true
  });

  const [invoices, setInvoices] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);

  useEffect(() => {
    if (user?.company_id) {
      const unsubscribe = dbService.subscribe<Customer>('customers', user.company_id, (data) => {
        setCustomers(data);
        setLoading(false);
      });

      const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, (data) => {
        setAccounts(data);
      });

      const unsubscribeEntries = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, setEntries);
      const unsubscribeInvoices = dbService.subscribe<any>('invoices', user.company_id, setInvoices);
      const unsubscribeReturns = dbService.subscribe<any>('returns', user.company_id, setReturns);
      const unsubscribeReceipts = dbService.subscribe<any>('receipt_vouchers', user.company_id, setReceipts);
      const unsubscribeDiscounts = dbService.subscribe<any>('customer_discounts', user.company_id, setDiscounts);

      return () => {
        unsubscribe();
        unsubscribeAccounts();
        unsubscribeEntries();
        unsubscribeInvoices();
        unsubscribeReturns();
        unsubscribeReceipts();
        unsubscribeDiscounts();
      };
    }
  }, [user?.company_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // Phone number validation: starts with 0 and exactly 11 digits
      const phoneRegex = /^0\d{10}$/;
      if (!phoneRegex.test(formData.mobile)) {
        showNotification('رقم الهاتف يجب أن يبدأ بـ 0 ويتكون من 11 رقم', 'error');
        return;
      }

      if (!formData.account_id) {
        showNotification('يجب اختيار الحساب المحاسبي للعميل', 'error');
        return;
      }

      let finalAccountId = formData.account_id;
      let finalCounterAccountId = formData.counter_account_id;

      const account1 = accounts.find(a => a.id === finalAccountId);
      const account2 = accounts.find(a => a.id === finalCounterAccountId);

      const isAccountCustomer = (acc: any) => acc && (acc.name.includes('عملاء') || acc.name.includes('العملاء') || acc.code?.startsWith('12'));
      const isAccountOpening = (acc: any) => acc && (acc.name.includes('رصيد') || acc.name.includes('ميزانية') || acc.name.includes('رأس') || acc.name.includes('راس') || acc.code?.startsWith('3'));

      if (isAccountOpening(account1) && isAccountCustomer(account2)) {
        finalAccountId = formData.counter_account_id;
        finalCounterAccountId = formData.account_id;
      }

      const selectedAccount = accounts.find(a => a.id === finalAccountId);
      const validCustomerUsages = ['customer', 'accounts_receivable'];

      if (!selectedAccount || !validCustomerUsages.includes(selectedAccount.account_usage || '')) {
        showNotification('خطأ: يجب أن يكون الحساب المحاسبي للعميل من قسم (أوراق القبض والعملاء) بـ استخدام (عملاء)', 'error');
        return;
      }

      const dataToSave = {
        ...formData,
        account_id: finalAccountId,
        counter_account_id: finalCounterAccountId,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };

      let id: string;
      if (editingCustomer) {
        const fieldsToTrack = [
          { field: 'name', label: 'اسم العميل' },
          { field: 'mobile', label: 'رقم الهاتف' },
          { field: 'email', label: 'البريد الإلكتروني' },
          { field: 'address', label: 'العنوان' },
          { field: 'opening_balance', label: 'رصيد أول' },
          { field: 'opening_balance_date', label: 'تاريخ الرصيد' },
          { field: 'account_name', label: 'الحساب المحاسبي' },
          { field: 'counter_account_id', label: 'حساب الطرف الآخر' },
          { field: 'payment_method', label: 'طريقة السداد' },
          { field: 'credit_limit', label: 'حد الائتمان' },
          { field: 'payment_terms', label: 'شروط السداد' },
          { field: 'payment_terms_days', label: 'أيام شروط السداد' },
          { field: 'advance_percentage', label: 'نسبة الدفعة المقدمة' },
          { field: 'is_active', label: 'نشط' }
        ];
        await dbService.updateWithLog(
          'customers', 
          editingCustomer.id, 
          dataToSave,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل عميل',
          'customers',
          fieldsToTrack
        );
        id = editingCustomer.id;
      } else {
        // Generate sequential code: cust 00001
        const maxCodeNum = customers.reduce((max, c) => {
          if (!c.code) return max;
          const match = c.code.match(/cust (\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            return Math.max(max, num);
          }
          return max;
        }, 0);
        const nextNumber = maxCodeNum + 1;
        const code = `cust ${nextNumber.toString().padStart(5, '0')}`;

        id = await dbService.add('customers', { 
          ...dataToSave, 
          code,
          company_id: user.company_id 
        });
      }

      // Success notification and modal close early
      showNotification(editingCustomer ? 'تم تحديث بيانات العميل بنجاح' : 'تم إضافة العميل بنجاح', 'success');
      closeModal();

      // Background post-save hooks
      try {
        if (editingCustomer) {
          // Always handle journal entry to ensure consistency
          await dbService.deleteJournalEntryByReference(id, user.company_id);
        } else {
          await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة عميل', `إضافة عميل جديد: ${formData.name}`, 'customers', id);
        }

        // Create Journal Entry if balance is not zero
        if (formData.opening_balance !== 0) {
          const counterAccount = accounts.find(a => a.id === finalCounterAccountId);
          const absBalance = Math.abs(formData.opening_balance);
          const isNegative = formData.opening_balance < 0;

          await dbService.add('journal_entries', {
            company_id: user.company_id,
            date: formData.opening_balance_date,
            description: `رصيد افتتاحي للعميل: ${formData.name}`,
            reference_id: id,
            reference_type: 'opening_balance',
            items: [
              {
                account_id: finalAccountId,
                account_name: selectedAccount?.name || '',
                debit: isNegative ? 0 : absBalance,
                credit: isNegative ? absBalance : 0,
                description: `رصيد افتتاحي: ${formData.name}`,
                customer_id: id,
                customer_name: formData.name
              },
              {
                account_id: finalCounterAccountId,
                account_name: counterAccount?.name || '',
                debit: isNegative ? absBalance : 0,
                credit: isNegative ? 0 : absBalance,
                description: `الطرف المقابل للرصيد الافتتاحي: ${formData.name}`
              }
            ],
            total_debit: absBalance,
            total_credit: absBalance,
            created_at: new Date().toISOString(),
            created_by: user.id
          });
        }
      } catch (postError) {
        console.error('Post-save operations failed:', postError);
      }
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حفظ البيانات', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setCustomerToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete || !user) return;
    try {
      const customer = customers.find(c => c.id === customerToDelete);
      
      // Check for associated transactions to prevent foreign key errors
      const hasInvoices = invoices.some(i => i.customer_id === customerToDelete);
      const hasReturns = returns.some(r => r.customer_id === customerToDelete);
      const hasReceipts = receipts.some(r => r.customer_id === customerToDelete);
      const hasDiscounts = discounts.some(d => d.customer_id === customerToDelete);

      if (hasInvoices || hasReturns || hasReceipts || hasDiscounts) {
        showNotification(
          language === 'ar' 
            ? 'لا يمكن حذف العميل لوجود معاملات مالية (فواتير، مرتجعات، أو سندات) مرتبطة به.' 
            : 'Cannot delete customer because there are associated transactions (invoices, returns, or vouchers).',
          'error'
        );
        setIsDeleteModalOpen(false);
        setCustomerToDelete(null);
        return;
      }
      
      // Delete associated journal entry first
      await dbService.deleteJournalEntryByReference(customerToDelete, user.company_id);
      
      await dbService.delete('customers', customerToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف عميل', `حذف العميل: ${customer?.name}`, 'customers');
      showNotification('تم حذف العميل بنجاح', 'success');
      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حذف العميل', 'error');
    }
  };

  const openModal = async (customer: Customer | null = null) => {
    if (customer) {

      try {
        const fullData = await dbService.get<Customer>('customers', customer.id);

        if (!fullData) throw new Error('Customer not found');

        setEditingCustomer(fullData);
        setFormData({ 
          name: fullData.name, 
          mobile: fullData.mobile,
          email: fullData.email || '',
          address: fullData.address || '',
          opening_balance: fullData.opening_balance || 0,
          opening_balance_date: (fullData.opening_balance_date || new Date().toISOString()).slice(0, 10),
          account_id: fullData.account_id || '',
          account_name: fullData.account_name || '',
          counter_account_id: fullData.counter_account_id || '',
          payment_method: fullData.payment_method || 'credit',
          credit_limit: fullData.credit_limit || 0,
          payment_terms: fullData.payment_terms || 'due_on_receipt',
          payment_terms_days: fullData.payment_terms_days || 0,
          advance_percentage: fullData.advance_percentage || 0,
          is_active: fullData.is_active !== false
        });

      } catch (error: any) {
        console.error('[EDIT] Error loading customer:', error);
        showNotification('فشل تحميل بيانات العميل', 'error');
        return;
      }
    } else {
      const defaultAccount = accounts.find(a => a.account_usage === 'accounts_receivable' || a.account_usage === 'customer');
      const defaultCounterAccount = accounts.find(a => a.account_usage === 'opening_balance');
      setEditingCustomer(null);
      setFormData({ 
        name: '', 
        mobile: '', 
        email: '', 
        address: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: defaultAccount?.id || '',
        account_name: defaultAccount?.name || '',
        counter_account_id: defaultCounterAccount?.id || '',
        payment_method: 'credit',
        credit_limit: 0,
        payment_terms: 'due_on_receipt',
        payment_terms_days: 0,
        advance_percentage: 0,
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const getCustomerBalance = (customerId: string) => {
    let balance = 0;
    entries.forEach((je: any) => {
      je.items?.forEach((item: any) => {
        // Only count lines that affect the customer's specific account
        if (item.customer_id === customerId) {
          balance += (item.debit || 0) - (item.credit || 0);
        }
      });
    });
    return balance;
  };

  const formatBalance = (value: number) => {
    const formatted = formatNumber(Math.abs(value));
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return '0';
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 gap-4" dir={dir}>
        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
          <Lock size={40} />
        </div>
        <h3 className="text-xl font-bold">{language === 'ar' ? 'عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة' : 'Sorry, you do not have permission to access this page'}</h3>
        <p className="text-sm">{language === 'ar' ? 'يرجى التواصل مع مدير النظام للحصول على الصلاحيات اللازمة.' : 'Please contact the system administrator to obtain the necessary permissions.'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500 overflow-hidden" dir={dir}>
      {!isModalOpen && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <User size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 italic serif">{t('customers.title')}</h2>
              <p className="text-slate-500 font-medium">{t('customers.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setIsActivityLogOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
              title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
            >
              <History size={20} />
              <span className="hidden md:inline">{language === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
            </button>
            <ExportButtons 
              onExportExcel={handleExportExcel} 
              onExportPDF={handleExportPDF} 
            />
            {canCreate && (
              <button 
                onClick={() => openModal()}
                className={`flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50 ${isModalOpen ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <Plus size={20} />
                {t('customers.add')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden pb-4">
        {/* Main List Column */}
        <div className={`flex-1 flex flex-col transition-all duration-700 ease-in-out ${isModalOpen ? 'hidden' : 'w-full'}`}>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/30">
              <div className="relative flex-1 group">
                <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={20} />
                <input
                  type="text"
                  placeholder={t('customers.search_placeholder')}
                  className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all font-bold text-slate-900 placeholder:text-slate-400 shadow-sm`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                <button
                  onClick={() => setView('table')}
                  className={`p-2 rounded-xl transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                  title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
                >
                  <List size={22} />
                </button>
                <button
                  onClick={() => setView('card')}
                  className={`p-2 rounded-xl transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                  title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
                >
                  <LayoutGrid size={22} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {view === 'table' ? (
                <div className="hidden md:block overflow-x-auto h-full">
                  <table ref={tableRef} className="w-full">
                    <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-100">
                      <tr className="text-slate-500 text-[10px] uppercase font-black tracking-[0.2em]">
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_code')}</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_name')}</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>الرصيد الحالي</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredCustomers.map((customer) => (
                        <tr 
                          key={customer.id} 
                          onClick={() => openModal(customer)}
                          className={`hover:bg-emerald-50/40 transition-all group cursor-pointer border-transparent border-x-4 ${editingCustomer?.id === customer.id ? 'bg-emerald-50 border-emerald-500' : ''}`}
                        >
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <span className="font-mono text-[10px] bg-slate-100 px-3 py-1 rounded-lg text-slate-500 font-black border border-slate-200 group-hover:border-emerald-200 group-hover:text-emerald-600 transition-all">{customer.code}</span>
                          </td>
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                             <div className="flex flex-col">
                                <span className={`font-black text-slate-900 group-hover:text-emerald-700 transition-colors ${editingCustomer?.id === customer.id ? 'text-emerald-700' : ''}`}>{customer.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-slate-400 font-bold tracking-tight">{customer.mobile}</span>
                                    {customer.payment_method && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                                        {customer.payment_method === 'cash' ? (language === 'ar' ? 'نقدي' : 'Cash') :
                                         customer.payment_method === 'credit' ? (language === 'ar' ? 'آجل' : 'Credit') :
                                         customer.payment_method === 'installments' ? (language === 'ar' ? 'دفعات' : 'Installments') : 
                                         (language === 'ar' ? 'أخرى' : 'Other')}
                                      </span>
                                    )}
                                    {customer.credit_limit > 0 && (
                                      <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200/20">
                                        {language === 'ar' ? 'حد: ' : 'Limit: '}{formatNumber(customer.credit_limit)}
                                      </span>
                                    )}
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${customer.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                      {customer.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                                    </span>
                                 </div>
                             </div>
                          </td>
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <span className={`font-black text-xs px-3 py-1.5 rounded-full ${getCustomerBalance(customer.id) >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} shadow-sm border border-emerald-200/20`}>
                              {formatBalance(getCustomerBalance(customer.id))}
                            </span>
                          </td>
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                            <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-1 opacity-0 group-hover:opacity-100 transition-all`}>
                               {canDelete && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                  title="حذف"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                              <div className="p-2 text-emerald-400 bg-emerald-50 rounded-xl">
                                 {dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredCustomers.length === 0 && !loading && (
                    <div className="p-20 text-center flex flex-col items-center gap-4">
                       <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center">
                          <Search size={40} />
                       </div>
                       <p className="text-slate-400 font-black text-lg italic tracking-tighter">لم يتم العثور على أية نتائج</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {filteredCustomers.map((customer) => (
                    <div 
                      key={customer.id} 
                      onClick={() => openModal(customer)}
                      className={`p-8 space-y-6 rounded-[2.5rem] border transition-all cursor-pointer group relative overflow-hidden ${editingCustomer?.id === customer.id ? 'bg-emerald-50 border-emerald-200 shadow-xl shadow-emerald-500/10' : 'bg-slate-50/40 border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 hover:bg-white'}`}
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <div className="flex flex-col gap-2">
                          <span className="font-mono text-[10px] bg-white px-3 py-1 rounded-lg text-slate-500 font-black w-fit border border-slate-200 group-hover:border-emerald-200 transition-all">{customer.code}</span>
                          <h4 className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors text-2xl tracking-tighter leading-none">{customer.name}</h4>
                          <span className="text-xs text-slate-400 font-bold tracking-[0.1em]">{customer.mobile}</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {customer.payment_method && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                {customer.payment_method === 'cash' ? (language === 'ar' ? 'نقدي' : 'Cash') :
                                 customer.payment_method === 'credit' ? (language === 'ar' ? 'آجل' : 'Credit') :
                                 customer.payment_method === 'installments' ? (language === 'ar' ? 'دفعات' : 'Installments') : 
                                 (language === 'ar' ? 'أخرى' : 'Other')}
                              </span>
                            )}
                            {customer.credit_limit > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200/20">
                                {language === 'ar' ? 'حد الائتمان: ' : 'Limit: '}{formatNumber(customer.credit_limit)}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${customer.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                              {customer.is_active !== false ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                            </span>
                          </div>
                        </div>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${getCustomerBalance(customer.id) >= 0 ? 'bg-emerald-600 shadow-emerald-500/20 text-white' : 'bg-rose-600 shadow-rose-500/20 text-white'}`}>
                           <Wallet size={24} />
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-slate-200/50 flex justify-between items-end relative z-10">
                        <div>
                          <p className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em] mb-2 px-1">الرصيد الحالي</p>
                          <p className={`font-black text-4xl tracking-tighter leading-none ${getCustomerBalance(customer.id) >= 0 ? 'text-emerald-600' : 'text-emerald-600'}`}>
                            {formatBalance(getCustomerBalance(customer.id))}
                          </p>
                        </div>
                        <div className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-300 group-hover:text-emerald-500 group-hover:border-emerald-100 transition-all shadow-sm">
                           {dir === 'rtl' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
                        </div>
                      </div>
                      
                      {/* Decorative Background Element */}
                      <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mb-10 -mr-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                  {filteredCustomers.length === 0 && !loading && (
                    <div className="col-span-full py-20 text-center text-slate-400 font-black italic tracking-tighter">لم يتم العثور على أية نتائج</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Integrated Side Panel Form */}
      <AnimatePresence mode="wait">
        {isModalOpen && (
          <motion.div 
            initial={{ x: dir === 'rtl' ? -500 : 500, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir === 'rtl' ? -500 : 500, opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            className="w-full flex flex-col h-full bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden relative z-[40]"
          >
              {/* Form Side */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className={`p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-emerald-500/20">
                       <User size={28} />
                    </div>
                    <div>
                       <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">{editingCustomer ? t('customers.edit') : t('customers.add')}</h3>
                       <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('customers.subtitle')}</p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-50 rounded-full transition-all">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                      {/* Name Section */}
                      <div className="md:col-span-2">
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_name')}</label>
                        <input
                          required
                          type="text"
                          placeholder="John Doe / شركة السلام"
                          className="w-full px-8 py-5 bg-white border border-slate-100 rounded-[1.5rem] text-xl font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none placeholder:text-slate-300"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>

                      {editingCustomer && (
                        <div>
                          <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_code')}</label>
                          <div className="relative group">
                            <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                            <input
                              required
                              readOnly
                              type="text"
                              className="w-full px-8 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-mono text-lg font-black text-slate-400 cursor-not-allowed ps-14 tracking-widest"
                              value={editingCustomer.code}
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_mobile')}</label>
                        <div className="relative group">
                          <Phone className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                          <input
                            required
                            type="tel"
                            maxLength={11}
                            placeholder="01234567890"
                            className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14 tracking-[0.2em]"
                            value={formData.mobile}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              setFormData({ ...formData, mobile: value });
                            }}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_email')}</label>
                        <div className="relative group">
                          <Mail className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                          <input
                            type="email"
                            placeholder="customer@example.com"
                            className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_address')}</label>
                        <div className="relative group">
                          <MapPin className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                          <textarea
                            placeholder={language === 'ar' ? 'العنوان التفصيلي للعميل' : 'Full Customer Address'}
                            className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14 min-h-[100px]"
                            rows={2}
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Financial Section */}
                      <div className="md:col-span-2 p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div>
                          <label className={`block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_opening_balance')}</label>
                          <div className="relative group">
                            <Wallet className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-emerald-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                            <FormattedNumberInput
                              required
                              className="w-full px-8 py-5 bg-white border border-emerald-100 rounded-[1.5rem] text-3xl font-black text-emerald-600 shadow-sm transition-all focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14"
                              value={formData.opening_balance}
                              onChange={(val) => setFormData({ ...formData, opening_balance: val })}
                              dir={dir === 'rtl' ? 'rtl' : 'ltr'}
                            />
                            <p className="text-[11px] font-bold text-slate-400 mt-4 italic leading-relaxed px-1">
                              {language === 'ar' 
                                ? 'المبلغ الموجب (+) يعني أن العميل مدين لك بمال، والسالب (-) يعني أن العميل له مال عندك.' 
                                : 'Positive (+) means customer owes you money, Negative (-) means you owe customer.'}
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className={`block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_balance_date')}</label>
                          <div className="relative group">
                            <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-slate-500 transition-colors`} size={20} />
                            <input
                              type="date"
                              className="w-full px-8 py-5 bg-white border border-slate-200 rounded-[1.5rem] text-xl font-black text-slate-900 shadow-sm transition-all focus:ring-8 focus:ring-slate-500/5 focus:border-slate-500/50 outline-none ps-14"
                              value={formData.opening_balance_date}
                              onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_account')}</label>
                        <div className="relative group">
                          <Box className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                          <select
                            required
                            className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14 appearance-none"
                            value={formData.account_id}
                            onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                          >
                            <option value="">{language === 'ar' ? 'اختر الحساب المحاسبي المرتبط...' : 'Select associated account...'}</option>
                            {accounts.filter(a => a.account_usage === 'accounts_receivable' || a.account_usage === 'customer').map(account => (
                              <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Payment & Credit Settings Section */}
                      <div className="md:col-span-2 p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 space-y-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-600/10 text-emerald-600 rounded-[1.25rem] flex items-center justify-center">
                            <CreditCard size={24} />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-slate-900 leading-none mb-1">
                              {language === 'ar' ? 'إعدادات السداد والائتمان' : 'Payment & Credit Settings'}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {language === 'ar' ? 'طرق السداد، حدود الائتمان، وشروط الاستحقاق' : 'Payment terms, credit limits, and due dates'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Payment Method / طريقة السداد */}
                          <div>
                            <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {language === 'ar' ? 'طريقة السداد الافتراضية' : 'Default Payment Method'}
                            </label>
                            <div className="relative group">
                              <Wallet className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 pointer-events-none`} size={20} />
                              <select
                                className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14 appearance-none"
                                value={formData.payment_method || 'credit'}
                                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                              >
                                <option value="cash">{language === 'ar' ? 'نقدي' : 'Cash'}</option>
                                <option value="credit">{language === 'ar' ? 'آجل' : 'Credit / Postpaid'}</option>
                                <option value="installments">{language === 'ar' ? 'دفعات' : 'Installments'}</option>
                                <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
                              </select>
                            </div>
                          </div>

                          {/* Credit Limit / حد الائتمان */}
                          <div>
                            <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {language === 'ar' ? 'حد الائتمان' : 'Credit Limit'}
                            </label>
                            <div className="relative group">
                              <span className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 font-black text-lg`}>$</span>
                              <FormattedNumberInput
                                className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14"
                                value={formData.credit_limit || 0}
                                onChange={(val) => setFormData({ ...formData, credit_limit: val })}
                                dir={dir === 'rtl' ? 'rtl' : 'ltr'}
                              />
                            </div>
                          </div>

                          {/* Payment Terms / شروط السداد */}
                          <div className="md:col-span-2">
                            <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              {language === 'ar' ? 'شروط السداد (Payment Terms)' : 'Payment Terms'}
                            </label>
                            <div className="relative group">
                              <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 pointer-events-none`} size={20} />
                              <select
                                className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14 appearance-none"
                                value={formData.payment_terms || 'due_on_receipt'}
                                onChange={(e) => {
                                  const term = e.target.value;
                                  let days = 0;
                                  let pct = 0;
                                  if (term === 'net_7') days = 7;
                                  else if (term === 'net_15') days = 15;
                                  else if (term === 'net_30') days = 30;
                                  else if (term === 'net_45') days = 45;
                                  else if (term === 'net_60') days = 60;
                                  else if (term === 'net_90') days = 90;
                                  else if (term === 'net_180') days = 180;
                                  else if (term === 'advance_50_50') pct = 50;
                                  else if (term === 'advance') pct = 100;
                                  
                                  setFormData({ 
                                    ...formData, 
                                    payment_terms: term,
                                    payment_terms_days: days,
                                    advance_percentage: pct
                                  });
                                }}
                              >
                                <option value="cash">{language === 'ar' ? 'نقدي عند التسليم (Cash)' : 'Cash on Delivery'}</option>
                                <option value="due_on_receipt">{language === 'ar' ? 'مستحق فور استلام الفاتورة (Due on Receipt)' : 'Due on Receipt'}</option>
                                <option value="net_7">{language === 'ar' ? 'خلال 7 أيام (Net 7)' : 'Net 7 Days'}</option>
                                <option value="net_15">{language === 'ar' ? 'خلال 15 يوماً (Net 15)' : 'Net 15 Days'}</option>
                                <option value="net_30">{language === 'ar' ? 'خلال 30 يوماً (Net 30)' : 'Net 30 Days'}</option>
                                <option value="net_45">{language === 'ar' ? 'خلال 45 يوماً (Net 45)' : 'Net 45 Days'}</option>
                                <option value="net_60">{language === 'ar' ? 'خلال 60 يوماً (Net 60)' : 'Net 60 Days'}</option>
                                <option value="net_90">{language === 'ar' ? 'خلال 90 يوماً (Net 90)' : 'Net 90 Days'}</option>
                                <option value="net_180">{language === 'ar' ? 'خلال 180 يوماً (Net 180)' : 'Net 180 Days'}</option>
                                <option value="eom">{language === 'ar' ? 'نهاية الشهر (EOM)' : 'End of Month (EOM)'}</option>
                                <option value="eom_30">{language === 'ar' ? 'السداد بعد 30 يوم من نهاية شهر الفاتورة (30 Days EOM)' : '30 Days EOM'}</option>
                                <option value="advance">{language === 'ar' ? 'دفعة مقدمة قبل التوريد (Advance Payment)' : 'Advance Payment (100%)'}</option>
                                <option value="advance_50_50">{language === 'ar' ? '50% مقدم والباقي عند التسليم' : '50% Advance / 50% on Delivery'}</option>
                                <option value="custom">{language === 'ar' ? 'مخصص (أيام / نسب مقدمة مخصصة)' : 'Custom Days & Percentage'}</option>
                              </select>
                            </div>
                          </div>

                          {/* Conditional Custom days and advance percentage */}
                          {formData.payment_terms === 'custom' && (
                            <>
                              <div>
                                <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  {language === 'ar' ? 'فترة السداد بالأيام' : 'Payment Terms (Days)'}
                                </label>
                                <div className="relative group">
                                  <input
                                    type="number"
                                    min={0}
                                    className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none"
                                    value={formData.payment_terms_days || 0}
                                    onChange={(e) => setFormData({ ...formData, payment_terms_days: Number(e.target.value) })}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  {language === 'ar' ? 'نسبة الدفعة المقدمة %' : 'Advance Percentage %'}
                                </label>
                                <div className="relative group">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none"
                                    value={formData.advance_percentage || 0}
                                    onChange={(e) => setFormData({ ...formData, advance_percentage: Number(e.target.value) })}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                          {/* Active / Inactive Status Toggle */}
                          <div className="md:col-span-2 pt-4 border-t border-slate-50 flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-black text-slate-900 leading-none mb-1">
                                {language === 'ar' ? 'حالة النشاط' : 'Active Status'}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {language === 'ar' ? 'تحديد ما إذا كان العميل نشطاً في النظام أم لا' : 'Specify if the customer is active in the system'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.is_active ? 'bg-emerald-600' : 'bg-slate-200'}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_active ? (dir === 'rtl' ? '-translate-x-6' : 'translate-x-6') : (dir === 'rtl' ? '-translate-x-1' : 'translate-x-1')}`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Opening Balance Settings */}
                      {formData.opening_balance !== 0 && (
                        <div className="md:col-span-2 p-10 bg-white rounded-[3rem] border border-slate-200 shadow-sm space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                           <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
                                 <Wallet size={28} />
                              </div>
                              <div>
                                 <h4 className="text-xl font-black text-slate-900 leading-none mb-1">{language === 'ar' ? 'إعدادات الرصيد الافتتاحي' : 'Opening Balance Settings'}</h4>
                                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">تحميل القيمة الافتتاحية للعميل</p>
                              </div>
                           </div>

                           <div className="space-y-6">
                              <div>
                                <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_counter_account')}</label>
                                <div className="relative group">
                                   <Plus className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                                   <select
                                    required
                                    className="w-full px-8 py-4 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 shadow-sm focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14 appearance-none"
                                    value={formData.counter_account_id}
                                    onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}
                                  >
                                    <option value="">{language === 'ar' ? 'اختر حساب الطرف الآخر...' : 'Select counter account...'}</option>
                                    {accounts.filter(a => ['opening_balance', 'capital', 'equity', 'retained_earnings', 'other'].includes(a.account_usage || '')).map(account => (
                                      <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                                   <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
                                   <p className="text-[11px] font-bold text-amber-900 leading-tight">
                                     {language === 'ar' 
                                       ? 'سيتم إنشاء قيد يومية مالي آلي لموازنة الرصيد الافتتاحي المدخل.' 
                                       : 'An automatic journal entry will be created to balance the entered opening balance.'}
                                   </p>
                                </div>
                              </div>

                              {formData.counter_account_id && (() => {
                                 let finalAccountId = formData.account_id;
                                 let finalCounterAccountId = formData.counter_account_id;

                                 const account1 = accounts.find(a => a.id === finalAccountId);
                                 const account2 = accounts.find(a => a.id === finalCounterAccountId);

                                 const isAccountCustomer = (acc: any) => acc && (acc.name.includes('عملاء') || acc.name.includes('العملاء') || acc.code?.startsWith('12'));
                                 const isAccountOpening = (acc: any) => acc && (acc.name.includes('رصيد') || acc.name.includes('ميزانية') || acc.name.includes('رأس') || acc.name.includes('راس') || acc.code?.startsWith('3'));

                                 if (isAccountOpening(account1) && isAccountCustomer(account2)) {
                                   finalAccountId = formData.counter_account_id;
                                   finalCounterAccountId = formData.account_id;
                                 }

                                 const customerAccount = accounts.find(a => a.id === finalAccountId);
                                 const counterAccount = accounts.find(a => a.id === finalCounterAccountId);

                                 return (
                                   <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
                                      <JournalEntryPreview 
                                        title={language === 'ar' ? 'معاينة قيد الرصيد' : 'Entry Preview'}
                                        items={[
                                          {
                                            account_name: customerAccount?.name || '',
                                            debit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                            credit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                            description: language === 'ar' ? `رصيد أول: ${formData.name}` : `Opening: ${formData.name}`
                                          },
                                          {
                                            account_name: counterAccount?.name || '',
                                            debit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                            credit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                            description: language === 'ar' ? `الطرف المقابل: ${formData.name}` : `Counter: ${formData.name}`
                                          }
                                        ]}
                                      />
                                   </div>
                                 );
                              })()}
                           </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-12 pb-6 flex gap-6 sticky bottom-0 bg-white/95 backdrop-blur-md z-30">
                      <button 
                        type="submit"
                        className="flex-1 py-6 bg-zinc-900 text-white rounded-[2rem] font-black text-2xl hover:bg-zinc-800 transition-all shadow-2xl active:scale-[0.98] border border-white/10"
                      >
                        {editingCustomer ? (language === 'ar' ? 'تحديث البيانات' : 'Update Customer') : (language === 'ar' ? 'حفظ العميل' : 'Save Customer')}
                      </button>
                      <button 
                        type="button"
                        onClick={closeModal}
                        className="px-14 py-6 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-lg hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Audit Side */}
              {editingCustomer && (
                <div className="hidden lg:flex w-[450px] flex-col bg-slate-50 border-s border-white overflow-hidden">
                  <div className="p-10 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                     <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                           <History size={24} />
                         </div>
                         <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block leading-none mb-1">Audit Trail</span>
                            <span className="font-black text-slate-900 text-lg">{language === 'ar' ? 'سجل نشاط العميل' : 'Activity Log'}</span>
                         </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <InlineActivityLog category="customers" documentId={editingCustomer.id} />
                  </div>
                </div>
              )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir={dir}>
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
               <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{t('common.delete_confirm')}</h3>
            <p className="text-slate-500 mb-8 font-medium leading-relaxed">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا العميل؟ سيتم إزالة كافة البيانات المرتبطة ولن نتمكن من التراجع.' : 'Are you sure you want to delete this customer? All associated data will be removed and this cannot be undone.'}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCustomerToDelete(null);
                }}
                className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all active:scale-95 border border-slate-200"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
              >
                {language === 'ar' ? 'تأكيد الحذف' : 'Delete Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageActivityLog 
        category="customers" 
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
