import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Customer, Account, JournalEntry } from '../types';
import { 
  Search, Plus, Edit2, Trash2, X, History, FileText, User, 
  Hash, Box, Wallet, Calendar, Phone, Mail, MapPin, Lock,
  LayoutGrid, List
} from 'lucide-react';
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
    counter_account_id: ''
  });

  const [invoices, setInvoices] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
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
  }, [user]);

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
      const selectedAccount = accounts.find(a => a.id === formData.account_id);
      const dataToSave = {
        ...formData,
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
          { field: 'counter_account_id', label: 'حساب الطرف الآخر' }
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
          const counterAccount = accounts.find(a => a.id === formData.counter_account_id);
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
                account_id: formData.account_id,
                account_name: selectedAccount?.name || '',
                debit: isNegative ? 0 : absBalance,
                credit: isNegative ? absBalance : 0,
                description: 'رصيد افتتاحي',
                customer_id: id,
                customer_name: formData.name
              },
              {
                account_id: formData.counter_account_id,
                account_name: counterAccount?.name || '',
                debit: isNegative ? absBalance : 0,
                credit: isNegative ? 0 : absBalance,
                description: `رصيد افتتاحي للعميل: ${formData.name}`
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
      console.log('[EDIT] Opening edit modal for customer ID:', customer.id);
      try {
        const fullData = await dbService.get<Customer>('customers', customer.id);
        console.log('[EDIT] Customer details from API:', fullData);
        
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
          counter_account_id: fullData.counter_account_id || ''
        });
        console.log('[EDIT] Form updated with customer:', fullData.id);
      } catch (error: any) {
        console.error('[EDIT] Error loading customer:', error);
        showNotification('فشل تحميل بيانات العميل', 'error');
        return;
      }
    } else {
      setEditingCustomer(null);
      setFormData({ 
        name: '', 
        mobile: '', 
        email: '', 
        address: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: '',
        account_name: '',
        counter_account_id: ''
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
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
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
              className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50"
            >
              <Plus size={20} />
              {t('customers.add')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/30">
          <div className="relative flex-1 group">
            <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors`} size={20} />
            <input
              type="text"
              placeholder={t('customers.search_placeholder')}
              className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all font-bold text-slate-900 placeholder:text-slate-400`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setView('table')}
              className={`p-2 rounded-xl transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
            >
              <List size={22} />
            </button>
            <button
              onClick={() => setView('card')}
              className={`p-2 rounded-xl transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
            >
              <LayoutGrid size={22} />
            </button>
          </div>
        </div>

        {view === 'table' ? (
          <div className="overflow-x-auto hidden md:block">
            <table ref={tableRef} className="w-full">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-100">
                  <th className={`px-6 py-5 font-black ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_code')}</th>
                  <th className={`px-6 py-5 font-black ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_name')}</th>
                  <th className={`px-6 py-5 font-black ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_mobile')}</th>
                  <th className={`px-6 py-5 font-black ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_email')}</th>
                  <th className={`px-6 py-5 font-black ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_address')}</th>
                  <th className={`px-6 py-5 font-black ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_opening_balance')}</th>
                  <th className={`px-6 py-5 font-black ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_current_balance')}</th>
                  <th className={`px-6 py-5 font-black ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <span className="font-mono text-[10px] bg-slate-100 px-2.5 py-1 rounded-lg text-slate-500 font-bold border border-slate-200">{customer.code}</span>
                    </td>
                    <td className={`px-6 py-4 font-bold text-slate-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{customer.name}</td>
                    <td className={`px-6 py-4 text-slate-500 font-medium ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{customer.mobile}</td>
                    <td className={`px-6 py-4 text-slate-400 text-xs truncate max-w-[150px] ${dir === 'rtl' ? 'text-right' : 'text-left'}`} title={customer.email || undefined}>{customer.email}</td>
                    <td className={`px-6 py-4 text-slate-400 text-xs truncate max-w-[200px] ${dir === 'rtl' ? 'text-right' : 'text-left'}`} title={customer.address || undefined}>{customer.address}</td>
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <span className={`font-bold text-sm ${customer.opening_balance >= 0 ? 'text-slate-600' : 'text-rose-500'}`}>
                        {formatBalance(customer.opening_balance || 0)}
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <span className={`font-black text-sm px-3 py-1 rounded-full ${getCustomerBalance(customer.id) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {formatBalance(getCustomerBalance(customer.id))}
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                      <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-all no-pdf`}>
                        <button 
                          onClick={() => {
                            setActivityLogDocumentId(customer.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                          title="سجل النشاط"
                        >
                          <History size={18} />
                        </button>
                        {canEdit && (
                          <button 
                            onClick={() => openModal(customer)}
                            className="p-2.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(customer.id)}
                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-2">
                            <User size={32} />
                        </div>
                        <p className="text-slate-400 font-bold">{language === 'ar' ? 'لا يوجد عملاء حالياً' : 'No customers found'}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="p-6 space-y-4 bg-slate-50/50 rounded-3xl border border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden">
                <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEdit && (
                    <button 
                      onClick={() => openModal(customer)}
                      className="p-2 bg-white text-sky-600 rounded-xl border border-sky-50 shadow-sm hover:bg-sky-50 transition-all font-bold"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(customer.id)}
                      className="p-2 bg-white text-rose-600 rounded-xl border border-rose-50 shadow-sm hover:bg-rose-50 transition-all font-bold"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="font-mono text-[10px] bg-white px-2.5 py-1 rounded-lg text-slate-500 font-black w-fit border border-slate-200">{customer.code}</span>
                    <h4 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors text-xl tracking-tight mt-1">{customer.name}</h4>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50">
                  <div className="space-y-1">
                    <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">رقم الهاتف</p>
                    <p className="text-slate-900 font-bold text-sm tracking-tight">{customer.mobile || '---'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">رصيد أول</p>
                    <p className={`font-bold text-sm ${customer.opening_balance >= 0 ? 'text-slate-600' : 'text-rose-500'}`}>
                      {formatBalance(customer.opening_balance || 0)}
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1 mt-1 pt-3 border-t border-slate-200/50 flex justify-between items-end">
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">الرصيد الحالي</p>
                      <p className={`font-black text-2xl tracking-tighter ${getCustomerBalance(customer.id) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatBalance(getCustomerBalance(customer.id))}
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setActivityLogDocumentId(customer.id);
                        setIsActivityLogOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-emerald-600 bg-white border border-slate-100 rounded-xl transition-all"
                      title="سجل النشاط"
                    >
                      <History size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredCustomers.length === 0 && !loading && (
              <div className="col-span-full p-12 text-center text-slate-400 font-bold italic tracking-tight">لا يوجد عملاء حالياً</div>
            )}
          </div>
        )}

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1 flex-1">
                  <span className="font-mono text-[10px] bg-slate-100 px-2.5 py-1 rounded-lg text-slate-500 font-black w-fit border border-slate-200">{customer.code}</span>
                  <h4 className="font-bold text-slate-900 text-xl tracking-tight mt-1">{customer.name}</h4>
                </div>
                <div className="flex gap-2 shrink-0">
                  {canEdit && (
                    <button 
                      onClick={() => openModal(customer)}
                      className="p-3 text-sky-600 bg-sky-50 rounded-2xl border border-sky-100 active:scale-95 transition-transform"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(customer.id)}
                      className="p-3 text-rose-600 bg-rose-50 rounded-2xl border border-rose-100 active:scale-95 transition-transform"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">رقم الهاتف</p>
                  <p className="text-slate-900 font-bold text-sm tracking-tight">{customer.mobile || '---'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">رصيد أول</p>
                  <p className={`font-bold text-sm ${customer.opening_balance >= 0 ? 'text-slate-600' : 'text-rose-500'}`}>
                    {formatBalance(customer.opening_balance || 0)}
                  </p>
                </div>
                <div className="col-span-2 space-y-1 mt-1 pt-3 border-t border-slate-200/50">
                  <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">الرصيد الحالي</p>
                  <p className={`font-black text-lg tracking-tighter ${getCustomerBalance(customer.id) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatBalance(getCustomerBalance(customer.id))}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && !loading && (
            <div className="p-12 text-center text-slate-400 font-bold italic tracking-tight">لا يوجد عملاء حالياً</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[95vh] md:max-w-6xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">
            <div className={`p-6 md:p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                   <User size={24} />
                </div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900 tracking-tight">{editingCustomer ? t('customers.edit') : t('customers.add')}</h3>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t('customers.subtitle')}</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-900 p-2.5 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50/10">
              <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6 flex-1 overflow-y-auto pb-32 md:pb-10 custom-scrollbar" dir={dir}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_name')}</label>
                    <div className="relative group">
                      <User className="absolute start-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                      <input
                        required
                        type="text"
                        placeholder="John Doe / شركة السلام"
                        className="premium-input ps-12 font-bold"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>

                  {editingCustomer && (
                    <div>
                      <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_code')}</label>
                      <div className="relative">
                        <Hash className="absolute start-4 top-3.5 text-slate-300" size={20} />
                        <input
                          disabled
                          type="text"
                          className="premium-input ps-12 bg-slate-50 text-slate-400 cursor-not-allowed font-mono font-black"
                          value={editingCustomer.code}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_mobile')}</label>
                    <div className="relative group">
                      <Phone className="absolute start-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                      <input
                        required
                        type="tel"
                        maxLength={11}
                        placeholder="01234567890"
                        className="premium-input ps-12 font-bold tracking-widest"
                        value={formData.mobile}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, mobile: value });
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_email')}</label>
                    <div className="relative group">
                      <Mail className="absolute start-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                      <input
                        type="email"
                        placeholder="customer@example.com"
                        className="premium-input ps-12 font-bold"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_address')}</label>
                    <div className="relative group">
                      <MapPin className="absolute start-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                      <textarea
                        placeholder="العنوان التفصيلي للعميل"
                        className="premium-input ps-12 font-bold min-h-[80px]"
                        rows={2}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_opening_balance')}</label>
                    <div className="relative group">
                      <Wallet className="absolute start-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                      <input 
                        type="number" 
                        className="premium-input ps-12 font-black"
                        value={formData.opening_balance}
                        onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                      />
                      <p className="text-[10px] text-slate-400 mt-1 italic px-1">
                        {language === 'ar' ? 'المبلغ الموجب (+) يعني أن العميل مدين لك، والسالب (-) يعني أنه دائن لك.' : 'Positive (+) means customer owes you, Negative (-) means you owe customer.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_balance_date')}</label>
                    <div className="relative group">
                      <Calendar className="absolute start-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                      <input 
                        type="date" 
                        className="premium-input ps-12 font-bold"
                        value={formData.opening_balance_date}
                        onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_account')}</label>
                    <div className="relative group">
                       <Box className="absolute start-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                       <select
                        required
                        className="premium-input ps-12 font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[8px_center] bg-[length:16px] bg-no-repeat"
                        value={formData.account_id}
                        onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                      >
                        <option value="">{language === 'ar' ? 'اختر الحساب المحاسبي المرتبط...' : 'Select associated account...'}</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {formData.opening_balance !== 0 && (
                    <div className="md:col-span-2 p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100/50 space-y-6 animate-in slide-in-from-top-4 duration-300">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Wallet size={20} />
                         </div>
                         <h4 className="text-sm font-black text-emerald-800 uppercase tracking-widest">{language === 'ar' ? 'إعدادات الرصيد الافتتاحي' : 'Opening Balance Settings'}</h4>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className={`block text-[10px] font-black text-emerald-700/60 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_counter_account')}</label>
                          <select
                            required
                            className="premium-input border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/10 font-bold"
                            value={formData.counter_account_id}
                            onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}
                          >
                            <option value="">{language === 'ar' ? 'اختر حساب الطرف الآخر...' : 'Select counter account...'}</option>
                            {accounts.map(account => (
                              <option key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-emerald-600/70 mt-2 font-bold italic bg-white/50 px-3 py-1.5 rounded-lg w-fit border border-emerald-100">{language === 'ar' ? 'سيتم إنشاء قيد يومية آلي لموازنة الرصيد الافتتاحي.' : 'An automatic journal entry will be created to balance the opening balance.'}</p>
                        </div>
                        {formData.counter_account_id && (
                          <JournalEntryPreview 
                            title={language === 'ar' ? 'معاينة قيد الرصيد الافتتاحي' : 'Opening Balance Entry Preview'}
                            items={[
                              {
                                account_name: accounts.find(a => a.id === formData.account_id)?.name || (language === 'ar' ? 'حساب العميل' : 'Customer Account'),
                                debit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                credit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                description: language === 'ar' ? 'رصيد افتتاحي' : 'Opening Balance'
                              },
                              {
                                account_name: accounts.find(a => a.id === formData.counter_account_id)?.name || (language === 'ar' ? 'حساب الطرف الآخر' : 'Counter Account'),
                                debit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                credit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                description: language === 'ar' ? `رصيد افتتاحي للعميل: ${formData.name}` : `Opening balance for customer: ${formData.name}`
                              }
                            ]}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-10 flex gap-4 sticky bottom-0 bg-white/80 backdrop-blur-md pb-4">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50"
                  >
                    {editingCustomer ? (language === 'ar' ? 'تحديث بيانات العميل' : 'Update Customer') : (language === 'ar' ? 'إضافة عميل جديد' : 'Add New Customer')}
                  </button>
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="px-8 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black hover:bg-slate-100 transition-all active:scale-95 border border-slate-200"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>

              {editingCustomer && (
                <div className="hidden md:block w-96 border-r border-slate-100 bg-slate-50/20 shadow-inner overflow-y-auto custom-scrollbar">
                  <div className="p-4 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                       <History size={16} className="text-slate-400" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">سجل نشاط العميل</span>
                    </div>
                  </div>
                  <InlineActivityLog category="customers" documentId={editingCustomer.id} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir={dir}>
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200 border border-slate-200 text-center">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
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
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-xl shadow-rose-500/20 active:scale-95"
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
