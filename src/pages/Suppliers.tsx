import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Supplier, Account, JournalEntry } from '../types';
import { 
  Search, Plus, Trash2, Edit2, X, Truck, Phone, Mail, MapPin, 
  Wallet, Calendar, History, FileText, User, Hash, Box,
  LayoutGrid, List, ChevronRight, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { ExportButtons } from '../components/ExportButtons';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfUtils';
import { formatNumber } from '../utils/formatUtils';
import { useRef } from 'react';
import { useViewPreference } from '../hooks/useViewPreference';

export const Suppliers: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const tableRef = useRef<HTMLTableElement>(null);
  const [view, setView] = useViewPreference('suppliers', 'table');

  const handleExportExcel = () => {
    const headers = {
      'code': t('suppliers.column_code'),
      'name': t('suppliers.column_name'),
      'mobile': t('suppliers.form_mobile'),
      'email': t('suppliers.form_email'),
      'address': t('suppliers.form_address'),
      'opening_balance': t('suppliers.form_opening_balance')
    };
    const formattedData = formatDataForExcel(suppliers, headers);
    exportToExcel(formattedData, { filename: 'Suppliers_List', sheetName: t('suppliers.title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, { 
        filename: 'Suppliers_List',
        reportTitle: t('suppliers.list_title')
      });
    }
  };

  // Form State
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
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      const unsubscribe = dbService.subscribe<Supplier>('suppliers', user.company_id, (data) => {
        setSuppliers(data);
        setLoading(false);
      });

      const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, (data) => {
        setAccounts(data);
      });

      const unsubscribeEntries = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, setEntries);
      const unsubscribeInvoices = dbService.subscribe<any>('purchase_invoices', user.company_id, setInvoices);
      const unsubscribeReturns = dbService.subscribe<any>('purchase_returns', user.company_id, setReturns);
      const unsubscribeVouchers = dbService.subscribe<any>('payment_vouchers', user.company_id, setVouchers);
      const unsubscribeDiscounts = dbService.subscribe<any>('supplier_discounts', user.company_id, setDiscounts);

      return () => {
        unsubscribe();
        unsubscribeAccounts();
        unsubscribeEntries();
        unsubscribeInvoices();
        unsubscribeReturns();
        unsubscribeVouchers();
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
        showNotification('يجب اختيار الحساب المحاسبي للمورد', 'error');
        return;
      }
      const selectedAccount = accounts.find(a => a.id === formData.account_id);
      const dataToSave = {
        ...formData,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };

      let id: string;
      if (editingSupplier) {
        const fieldsToTrack = [
          { field: 'name', label: 'اسم المورد' },
          { field: 'mobile', label: 'رقم الهاتف' },
          { field: 'email', label: 'البريد الإلكتروني' },
          { field: 'address', label: 'العنوان' },
          { field: 'opening_balance', label: 'الرصيد الافتتاحي' },
          { field: 'opening_balance_date', label: 'تاريخ الرصيد' },
          { field: 'account_name', label: 'الحساب المحاسبي' },
          { field: 'counter_account_id', label: 'حساب الطرف الآخر' }
        ];
        await dbService.updateWithLog(
          'suppliers', 
          editingSupplier.id, 
          dataToSave,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل مورد',
          'suppliers',
          fieldsToTrack
        );
        id = editingSupplier.id;
      } else {
        // Generate sequential code: supp 00001
        const maxCodeNum = suppliers.reduce((max, s) => {
          if (!s.code) return max;
          const match = s.code.match(/supp (\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            return Math.max(max, num);
          }
          return max;
        }, 0);
        const nextNumber = maxCodeNum + 1;
        const code = `supp ${nextNumber.toString().padStart(5, '0')}`;

        id = await dbService.add('suppliers', { 
          ...dataToSave, 
          code,
          company_id: user.company_id 
        });
      }

      // Success notification and modal close early
      showNotification(editingSupplier ? 'تم تحديث بيانات المورد بنجاح' : 'تم إضافة المورد بنجاح', 'success');
      closeModal();

      // Background post-save hooks
      try {
        if (editingSupplier) {
          // Always handle journal entry to ensure consistency
          await dbService.deleteJournalEntryByReference(id, user.company_id);
        } else {
          await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة مورد', `إضافة مورد جديد: ${formData.name}`, 'suppliers', id);
        }

        // Create Journal Entry if balance is not zero
        if (formData.opening_balance !== 0) {
          const counterAccount = accounts.find(a => a.id === formData.counter_account_id);
          const absBalance = Math.abs(formData.opening_balance);
          const isNegative = formData.opening_balance < 0;

          await dbService.add('journal_entries', {
            company_id: user.company_id,
            date: formData.opening_balance_date,
            description: `رصيد افتتاحي للمورد: ${formData.name}`,
            reference_id: id,
            reference_type: 'opening_balance',
            items: [
              {
                account_id: formData.account_id,
                account_name: selectedAccount?.name || '',
                debit: isNegative ? absBalance : 0,
                credit: isNegative ? 0 : absBalance,
                description: `رصيد افتتاحي: ${formData.name}`,
                supplier_id: id,
                supplier_name: formData.name
              },
              {
                account_id: formData.counter_account_id,
                account_name: counterAccount?.name || '',
                debit: isNegative ? 0 : absBalance,
                credit: isNegative ? absBalance : 0,
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
    setSupplierToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete || !user) return;
    try {
      const supplier = suppliers.find(s => s.id === supplierToDelete);
      
      // Check for associated transactions to prevent foreign key errors
      const hasInvoices = invoices.some(i => i.supplier_id === supplierToDelete);
      const hasReturns = returns.some(r => r.supplier_id === supplierToDelete);
      const hasVouchers = vouchers.some(v => v.supplier_id === supplierToDelete);
      const hasDiscounts = discounts.some(d => d.supplier_id === supplierToDelete);

      if (hasInvoices || hasReturns || hasVouchers || hasDiscounts) {
        showNotification(
          language === 'ar' 
            ? 'لا يمكن حذف المورد لوجود معاملات مالية (فواتير، مرتجعات، أو سندات) مرتبطة به.' 
            : 'Cannot delete supplier because there are associated transactions (invoices, returns, or vouchers).',
          'error'
        );
        setIsDeleteModalOpen(false);
        setSupplierToDelete(null);
        return;
      }
      
      // Delete associated journal entry first
      await dbService.deleteJournalEntryByReference(supplierToDelete, user.company_id);
      
      await dbService.delete('suppliers', supplierToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف مورد', `حذف المورد: ${supplier?.name}`, 'suppliers');
      showNotification('تم حذف المورد بنجاح', 'success');
      setIsDeleteModalOpen(false);
      setSupplierToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حذف المورد', 'error');
    }
  };

  const openModal = async (supplier?: Supplier) => {
    if (supplier) {
      console.log('[EDIT] Opening edit modal for supplier ID:', supplier.id);
      try {
        const fullData = await dbService.get<Supplier>('suppliers', supplier.id);
        console.log('[EDIT] Supplier details from API:', fullData);
        
        if (!fullData) throw new Error('Supplier not found');

        setEditingSupplier(fullData);
        setFormData({
          name: fullData.name,
          mobile: fullData.mobile,
          email: fullData.email || '',
          address: fullData.address || '',
          opening_balance: fullData.opening_balance,
          opening_balance_date: (fullData.opening_balance_date || new Date().toISOString()).slice(0, 10),
          account_id: fullData.account_id || '',
          account_name: fullData.account_name || '',
          counter_account_id: fullData.counter_account_id || ''
        });
        console.log('[EDIT] Form updated with supplier:', fullData.id);
      } catch (error: any) {
        console.error('[EDIT] Error loading supplier:', error);
        showNotification('فشل تحميل بيانات المورد', 'error');
        return;
      }
    } else {
      setEditingSupplier(null);
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
    setEditingSupplier(null);
  };

  const getSupplierBalance = (supplierId: string) => {
    let balance = 0;
    entries.forEach((je: any) => {
      je.items?.forEach((item: any) => {
        if (item.supplier_id === supplierId) {
          balance += (item.credit || 0) - (item.debit || 0);
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

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.mobile.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('suppliers.title')}</h2>
          <p className="text-zinc-500">{t('suppliers.subtitle')}</p>
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
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-2xl font-bold hover:from-emerald-700 hover:to-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-200 border border-emerald-400/20"
          >
            <Plus size={20} />
            {t('suppliers.add')}
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-zinc-400`} size={20} />
          <input 
            type="text" 
            placeholder={t('suppliers.search_placeholder')}
            className={`w-full ${dir === 'rtl' ? 'pl-10 pr-4' : 'pr-10 pl-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-xl">
          <button
            onClick={() => setView('table')}
            className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
          >
            <List size={20} />
          </button>
          <button
            onClick={() => setView('card')}
            className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
          >
            <LayoutGrid size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        {view === 'table' ? (
          <div className="overflow-x-auto hidden md:block">
            <table ref={tableRef} className="w-full">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_code')}</th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_name')}</th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_mobile')}</th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_email')}</th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_address')}</th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_opening_balance')}</th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_current_balance')}</th>
                  <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded text-zinc-600">{supplier.code}</span>
                    </td>
                    <td className={`px-6 py-4 font-bold text-zinc-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{supplier.name}</td>
                    <td className={`px-6 py-4 text-zinc-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{supplier.mobile}</td>
                    <td className={`px-6 py-4 text-zinc-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{supplier.email}</td>
                    <td className={`px-6 py-4 text-zinc-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{supplier.address}</td>
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <span className={`font-medium ${supplier.opening_balance >= 0 ? 'text-zinc-600' : 'text-emerald-500'}`}>
                        {formatBalance(supplier.opening_balance || 0)}
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                      <span className={`font-black ${getSupplierBalance(supplier.id) >= 0 ? 'text-emerald-600' : 'text-emerald-600'}`}>
                        {formatBalance(getSupplierBalance(supplier.id))}
                      </span>
                    </td>
                    <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                      <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-2 opacity-0 group-hover:opacity-100 transition-opacity no-pdf`}>
                        <button 
                          onClick={() => {
                            setActivityLogDocumentId(supplier.id);
                            setIsActivityLogOpen(true);
                          }}
                          className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                          title="سجل النشاط"
                        >
                          <History size={18} />
                        </button>
                        <button 
                          onClick={() => openModal(supplier)}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(supplier.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSuppliers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">لا يوجد موردين.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="p-6 bg-zinc-50/50 rounded-3xl border border-zinc-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group relative overflow-hidden">
                <div className="absolute top-4 left-4 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => openModal(supplier)}
                    className="p-2 bg-white text-emerald-500 rounded-xl border border-emerald-50 shadow-sm hover:bg-emerald-50 transition-all font-bold"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(supplier.id)}
                    className="p-2 bg-white text-red-500 rounded-xl border border-red-50 shadow-sm hover:bg-red-50 transition-all font-bold"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] bg-white px-2 py-1 rounded text-zinc-600 font-bold w-fit border border-zinc-200">{supplier.code}</span>
                    <h4 className="font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors text-xl mt-1 tracking-tight">{supplier.name}</h4>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200/50 mt-4">
                  <div className="space-y-1">
                    <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">رقم الهاتف</p>
                    <p className="text-zinc-900 font-bold text-sm tracking-tight">{supplier.mobile || '---'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">رصيد أول</p>
                    <p className={`font-bold text-sm ${supplier.opening_balance >= 0 ? 'text-zinc-600' : 'text-emerald-500'}`}>
                      {formatBalance(supplier.opening_balance || 0)}
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1 mt-1 pt-3 border-t border-zinc-200/50 flex justify-between items-end">
                    <div>
                      <p className="text-zinc-400 text-[10px] uppercase font-black tracking-widest">الرصيد الحالي</p>
                      <p className={`font-black text-2xl tracking-tighter ${getSupplierBalance(supplier.id) >= 0 ? 'text-emerald-600' : 'text-emerald-600'}`}>
                        {formatBalance(getSupplierBalance(supplier.id))}
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setActivityLogDocumentId(supplier.id);
                        setIsActivityLogOpen(true);
                      }}
                      className="p-2 text-zinc-400 hover:text-emerald-500 bg-white border border-zinc-100 rounded-xl transition-all"
                      title="سجل النشاط"
                    >
                      <History size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredSuppliers.length === 0 && !loading && (
              <div className="col-span-full p-12 text-center text-zinc-500 font-bold italic">لا يوجد موردين حالياً</div>
            )}
          </div>
        )}

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-zinc-50">
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] bg-zinc-100 px-2 py-1 rounded text-zinc-600 font-bold w-fit">{supplier.code}</span>
                  <h4 className="font-bold text-zinc-900 text-lg">{supplier.name}</h4>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openModal(supplier)}
                    className="p-3 text-emerald-500 bg-emerald-50 rounded-2xl border border-emerald-100 active:scale-95 transition-transform"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(supplier.id)}
                    className="p-3 text-red-500 bg-red-50 rounded-2xl border border-red-100 active:scale-95 transition-transform"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">رقم الهاتف</p>
                  <p className="text-zinc-700 font-medium">{supplier.mobile || '---'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">رصيد أول</p>
                  <p className={`font-bold ${supplier.opening_balance >= 0 ? 'text-zinc-600' : 'text-emerald-500'}`}>
                    {formatBalance(supplier.opening_balance || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">الرصيد الحالي</p>
                  <p className={`font-black ${getSupplierBalance(supplier.id) >= 0 ? 'text-emerald-600' : 'text-emerald-600'}`}>
                    {formatBalance(getSupplierBalance(supplier.id))}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {filteredSuppliers.length === 0 && !loading && (
            <div className="p-8 text-center text-zinc-500 italic">لا يوجد موردين حالياً</div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-0 md:p-6" dir={dir}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-white shadow-2xl md:rounded-[2.5rem] h-full md:h-[min(850px,90vh)] flex flex-col md:flex-row overflow-hidden border border-slate-200"
            >
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className={`p-6 md:p-10 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-50">
                       <Truck size={28} />
                    </div>
                    <div>
                       <h3 className="text-3xl font-black text-slate-900 tracking-tight">{editingSupplier ? t('suppliers.edit') : t('suppliers.add')}</h3>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">إدارة بيانات الموردين • ملف المورد</p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="text-slate-400 hover:text-slate-900 p-3 hover:bg-slate-50 rounded-2xl transition-all"><X size={24} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <form onSubmit={handleSubmit} className="p-6 md:p-12 space-y-10 pb-32" dir={dir}>
                    <div className="grid grid-cols-1 gap-10">
                      <div className="space-y-4">
                        <label className={`block text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          بيانات المورد الأساسية
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="md:col-span-1">
                            <label className={`block text-[10px] font-bold text-slate-500 mb-2 uppercase px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_name')}</label>
                            <div className="relative group">
                              <User className="absolute start-4 top-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                              <input
                                required
                                type="text"
                                placeholder="اسم المورد / الشركة"
                                className="premium-input ps-12 font-bold text-lg h-14"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label className={`block text-[10px] font-bold text-slate-500 mb-2 uppercase px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_code')}</label>
                            <div className="relative group">
                              <Hash className="absolute start-4 top-4 text-slate-400" size={20} />
                              <input
                                disabled
                                type="text"
                                className="premium-input ps-12 bg-slate-50 text-slate-400 cursor-not-allowed font-mono font-black h-14"
                                value={editingSupplier?.code || '---'}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className={`block text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          بيانات التواصل
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className={`block text-[10px] font-bold text-slate-500 mb-2 uppercase px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_mobile')}</label>
                            <div className="relative group">
                              <Phone className="absolute start-4 top-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                              <input
                                required
                                type="tel"
                                maxLength={11}
                                placeholder="01234567890"
                                className="premium-input ps-12 font-bold tracking-widest h-14"
                                value={formData.mobile}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '');
                                  setFormData({ ...formData, mobile: value });
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <label className={`block text-[10px] font-bold text-slate-500 mb-2 uppercase px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_email')}</label>
                            <div className="relative group">
                              <Mail className="absolute start-4 top-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                              <input
                                type="email"
                                placeholder="supplier@example.com"
                                className="premium-input ps-12 font-bold h-14"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <label className={`block text-[10px] font-bold text-slate-500 mb-2 uppercase px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_address')}</label>
                            <div className="relative group">
                              <MapPin className="absolute start-4 top-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                              <textarea
                                placeholder="العنوان التفصيلي للمورد"
                                className="premium-input ps-12 font-bold min-h-[100px] py-4"
                                rows={2}
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className={`block text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                          الحسابات والأرصدة
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
                          <div>
                            <label className={`block text-[10px] font-bold text-slate-500 mb-2 uppercase px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_opening_balance')}</label>
                            <div className="relative group">
                              <Wallet className="absolute start-4 top-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                              <input 
                                type="number" 
                                className="premium-input ps-12 font-black h-14"
                                value={formData.opening_balance}
                                onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                              />
                            </div>
                          </div>
      
                          <div>
                            <label className={`block text-[10px] font-bold text-slate-500 mb-2 uppercase px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_balance_date')}</label>
                            <div className="relative group">
                              <Calendar className="absolute start-4 top-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                              <input 
                                type="date" 
                                className="premium-input ps-12 font-bold h-14"
                                value={formData.opening_balance_date}
                                onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="md:col-span-2">
                             <label className={`block text-[10px] font-bold text-slate-500 mb-2 uppercase px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_account')}</label>
                             <div className="relative group">
                                <Box className="absolute start-4 top-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                <select
                                 required
                                 className="premium-input ps-12 font-bold appearance-none h-14"
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
                        </div>
                      </div>
                    </div>
                  </form>
                </div>

                <div className="p-6 md:p-10 bg-white border-t border-slate-50 flex gap-4 sticky bottom-0 z-20">
                  <button 
                    onClick={handleSubmit}
                    className="flex-1 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xl hover:bg-slate-800 transition-all shadow-2xl active:scale-95 border border-slate-800"
                  >
                    {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
                  </button>
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="px-10 py-5 bg-slate-50 text-slate-500 rounded-[1.5rem] font-black text-lg hover:bg-slate-100 transition-all active:scale-95 border border-slate-200"
                  >
                    تجاهل
                  </button>
                </div>
              </div>

              {editingSupplier && (
                <div className="hidden xl:block w-[400px] border-s border-slate-100 bg-slate-50/20 overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
                          <History size={20} />
                       </div>
                       <div>
                          <h4 className="text-lg font-black text-slate-900 tracking-tight">سجل الرقابة</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">تتبع التغييرات والنشاط</p>
                       </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    <InlineActivityLog category="suppliers" documentId={editingSupplier.id} />
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" dir={dir}>
            <h3 className="text-xl font-bold text-zinc-900 mb-4">{t('common.delete_confirm')}</h3>
            <p className="text-zinc-500 mb-6">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا المورد؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this supplier? This action cannot be undone.'}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSupplierToDelete(null);
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
        category="suppliers" 
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
