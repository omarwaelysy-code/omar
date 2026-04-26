import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Customer, Account, JournalEntry } from '../types';
import { 
  Search, Plus, Edit2, Trash2, X, History, FileText, User, 
  Hash, Box, Wallet, Calendar, Phone, Mail, MapPin, Lock 
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

  const openModal = (customer: Customer | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({ 
        name: customer.name, 
        mobile: customer.mobile,
        email: customer.email || '',
        address: customer.address || '',
        opening_balance: customer.opening_balance || 0,
        opening_balance_date: customer.opening_balance_date || new Date().toISOString().slice(0, 10),
        account_id: customer.account_id || '',
        account_name: customer.account_name || '',
        counter_account_id: customer.counter_account_id || ''
      });
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
    const formatted = Math.abs(value).toLocaleString();
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('customers.title')}</h2>
          <p className="text-zinc-500">{t('customers.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
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
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-2xl font-bold hover:from-orange-700 hover:to-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-200 border border-orange-400/20"
            >
              <Plus size={20} />
              {t('customers.add')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-zinc-400`} size={18} />
            <input
              type="text"
              placeholder={t('customers.search_placeholder')}
              className={`w-full ${dir === 'rtl' ? 'pl-10 pr-4' : 'pr-10 pl-4'} py-2 bg-zinc-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto hidden md:block">
          <table ref={tableRef} className="w-full">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_code')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_name')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_mobile')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_email')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_address')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_opening_balance')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_current_balance')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded text-zinc-600">{customer.code}</span>
                  </td>
                  <td className={`px-6 py-4 font-bold text-zinc-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{customer.name}</td>
                  <td className={`px-6 py-4 text-zinc-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{customer.mobile}</td>
                  <td className={`px-6 py-4 text-zinc-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{customer.email}</td>
                  <td className={`px-6 py-4 text-zinc-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{customer.address}</td>
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <span className={`font-medium ${customer.opening_balance >= 0 ? 'text-zinc-600' : 'text-rose-500'}`}>
                      {formatBalance(customer.opening_balance || 0)}
                    </span>
                  </td>
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <span className={`font-black ${getCustomerBalance(customer.id) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatBalance(getCustomerBalance(customer.id))}
                    </span>
                  </td>
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                    <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity no-pdf`}>
                      <button 
                        onClick={() => {
                          setActivityLogDocumentId(customer.id);
                          setIsActivityLogOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                        title="سجل النشاط"
                      >
                        <History size={18} />
                      </button>
                      {canEdit && (
                        <button 
                          onClick={() => openModal(customer)}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => handleDelete(customer.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">لا يوجد عملاء.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-zinc-50">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] bg-zinc-100 px-2 py-1 rounded text-zinc-600 font-bold w-fit">{customer.code}</span>
                  <h4 className="font-bold text-zinc-900 text-lg">{customer.name}</h4>
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <button 
                      onClick={() => openModal(customer)}
                      className="p-3 text-emerald-500 bg-emerald-50 rounded-2xl border border-emerald-100 active:scale-95 transition-transform"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(customer.id)}
                      className="p-3 text-red-500 bg-red-50 rounded-2xl border border-red-100 active:scale-95 transition-transform"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">رقم الهاتف</p>
                  <p className="text-zinc-700 font-medium">{customer.mobile || '---'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">رصيد أول</p>
                  <p className={`font-bold ${customer.opening_balance >= 0 ? 'text-zinc-600' : 'text-rose-500'}`}>
                    {formatBalance(customer.opening_balance || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">الرصيد الحالي</p>
                  <p className={`font-black ${getCustomerBalance(customer.id) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatBalance(getCustomerBalance(customer.id))}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && !loading && (
            <div className="p-8 text-center text-zinc-500 italic">لا يوجد عملاء حالياً</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className={`p-4 md:p-6 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white z-10 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <h3 className="text-lg md:text-xl font-bold text-zinc-900">{editingCustomer ? t('customers.edit') : t('customers.add')}</h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleSubmit} className="p-4 md:p-8 space-y-5 flex-1 overflow-y-auto pb-32 md:pb-8" dir={dir}>
                <div className="space-y-5">
                  {editingCustomer && (
                    <div>
                      <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.column_code')}</label>
                      <div className="relative">
                        <Hash className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                        <input
                          disabled
                          type="text"
                          className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-500 cursor-not-allowed font-mono`}
                          value={editingCustomer.code}
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_name')}</label>
                    <div className="relative">
                      <User className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="text"
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_mobile')}</label>
                    <div className="relative">
                      <Phone className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        required
                        type="tel"
                        maxLength={11}
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                        value={formData.mobile}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, mobile: value });
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_email')}</label>
                    <div className="relative">
                      <Mail className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input
                        type="email"
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_address')}</label>
                    <div className="relative">
                      <MapPin className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <textarea
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        rows={2}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_opening_balance')}</label>
                      <div className="relative">
                        <Wallet className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                        <input 
                          type="number" 
                          className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                          value={formData.opening_balance}
                          onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_balance_date')}</label>
                      <div className="relative">
                        <Calendar className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                        <input 
                          type="date" 
                          className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                          value={formData.opening_balance_date}
                          onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {formData.opening_balance !== 0 && (
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      <p className="text-xs font-black text-emerald-800 uppercase tracking-widest">{language === 'ar' ? 'إعدادات الرصيد الافتتاحي' : 'Opening Balance Settings'}</p>
                      <div>
                        <label className={`block text-sm font-bold text-emerald-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_counter_account')}</label>
                        <select
                          required
                          className="w-full px-4 py-3 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                        <p className="text-[10px] text-emerald-600 mt-1 font-medium italic">{language === 'ar' ? 'سيتم إنشاء قيد يومية آلي لموازنة الرصيد الافتتاحي.' : 'An automatic journal entry will be created to balance the opening balance.'}</p>
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
                  )}
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('customers.form_account')}</label>
                    <select
                      required
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={formData.account_id}
                      onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                    >
                      <option value="">{language === 'ar' ? 'اختر الحساب...' : 'Select account...'}</option>
                      {accounts.map(account => (
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
                    {editingCustomer ? (language === 'ar' ? 'تحديث العميل' : 'Update Customer') : (language === 'ar' ? 'حفظ العميل' : 'Save Customer')}
                  </button>
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>

              {editingCustomer && (
                <div className="hidden md:block w-80 border-r border-zinc-100 bg-zinc-50/30">
                  <InlineActivityLog category="customers" documentId={editingCustomer.id} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" dir={dir}>
            <h3 className="text-xl font-bold text-zinc-900 mb-4">{t('common.delete_confirm')}</h3>
            <p className="text-zinc-500 mb-6">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this customer? This action cannot be undone.'}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCustomerToDelete(null);
                }}
                className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                {language === 'ar' ? 'حذف' : 'Delete'}
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
