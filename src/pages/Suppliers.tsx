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
      const defaultAccount = accounts.find(a => a.name.includes('موردين') || a.name.includes('الموردين'));
      const defaultCounterAccount = accounts.find(a => a.name.includes('رصيد أول') || a.name.includes('رصيد اول') || a.name.includes('ميزانية افتتاحي') || a.name.includes('رأس المال') || a.name.includes('راس المال'));
      setEditingSupplier(null);
      setFormData({
        name: '',
        mobile: '',
        email: '',
        address: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: defaultAccount?.id || '',
        account_name: defaultAccount?.name || '',
        counter_account_id: defaultCounterAccount?.id || ''
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
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500 overflow-hidden" dir={dir}>
      {!isModalOpen && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <Truck size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 italic serif">{t('suppliers.title')}</h2>
              <p className="text-slate-500 font-medium">{t('suppliers.subtitle')}</p>
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
            <button 
              onClick={() => openModal()}
              className={`flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50 ${isModalOpen ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Plus size={20} />
              {t('suppliers.add')}
            </button>
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
                  placeholder={t('suppliers.search_placeholder')}
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
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_code')}</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_name')}</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>الرصيد الحالي</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredSuppliers.map((supplier) => (
                        <tr 
                          key={supplier.id} 
                          onClick={() => openModal(supplier)}
                          className={`hover:bg-emerald-50/40 transition-all group cursor-pointer border-transparent border-x-4 ${editingSupplier?.id === supplier.id ? 'bg-emerald-50 border-emerald-500' : ''}`}
                        >
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <span className="font-mono text-[10px] bg-slate-100 px-3 py-1 rounded-lg text-slate-500 font-black border border-slate-200 group-hover:border-emerald-200 group-hover:text-emerald-600 transition-all">{supplier.code}</span>
                          </td>
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                             <div className="flex flex-col">
                                <span className={`font-black text-slate-900 group-hover:text-emerald-700 transition-colors ${editingSupplier?.id === supplier.id ? 'text-emerald-700' : ''}`}>{supplier.name}</span>
                                <span className="text-[10px] text-slate-400 font-bold tracking-tight">{supplier.mobile}</span>
                             </div>
                          </td>
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <span className={`font-black text-xs px-3 py-1.5 rounded-full ${getSupplierBalance(supplier.id) >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} shadow-sm border border-emerald-200/20`}>
                              {formatBalance(getSupplierBalance(supplier.id))}
                            </span>
                          </td>
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                            <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-1 opacity-0 group-hover:opacity-100 transition-all`}>
                               <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(supplier.id); }}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                  title="حذف"
                                >
                                  <Trash2 size={18} />
                                </button>
                              <div className="p-2 text-emerald-400 bg-emerald-50 rounded-xl">
                                 {dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredSuppliers.length === 0 && !loading && (
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
                  {filteredSuppliers.map((supplier) => (
                    <div 
                      key={supplier.id} 
                      onClick={() => openModal(supplier)}
                      className={`p-8 space-y-6 rounded-[2.5rem] border transition-all cursor-pointer group relative overflow-hidden ${editingSupplier?.id === supplier.id ? 'bg-emerald-50 border-emerald-200 shadow-xl shadow-emerald-500/10' : 'bg-slate-50/40 border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 hover:bg-white'}`}
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <div className="flex flex-col gap-2">
                          <span className="font-mono text-[10px] bg-white px-3 py-1 rounded-lg text-slate-500 font-black w-fit border border-slate-200 group-hover:border-emerald-200 transition-all">{supplier.code}</span>
                          <h4 className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors text-2xl tracking-tighter leading-none">{supplier.name}</h4>
                          <span className="text-xs text-slate-400 font-bold tracking-[0.1em]">{supplier.mobile}</span>
                        </div>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${getSupplierBalance(supplier.id) >= 0 ? 'bg-emerald-600 shadow-emerald-500/20 text-white' : 'bg-rose-600 shadow-rose-500/20 text-white'}`}>
                           <Wallet size={24} />
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-slate-200/50 flex justify-between items-end relative z-10">
                        <div>
                          <p className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em] mb-2 px-1">الرصيد الحالي</p>
                          <p className={`font-black text-4xl tracking-tighter leading-none ${getSupplierBalance(supplier.id) >= 0 ? 'text-emerald-600' : 'text-emerald-600'}`}>
                            {formatBalance(getSupplierBalance(supplier.id))}
                          </p>
                        </div>
                        <div className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-300 group-hover:text-emerald-500 group-hover:border-emerald-100 transition-all shadow-sm">
                           {dir === 'rtl' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredSuppliers.length === 0 && !loading && (
                    <div className="col-span-full py-20 text-center text-slate-400 font-black italic tracking-tighter">لم يتم العثور على أية نتائج</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      <AnimatePresence mode="wait">
        {isModalOpen && (
          <motion.div 
            initial={{ x: dir === 'rtl' ? -500 : 500, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir === 'rtl' ? -500 : 500, opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            className="w-full flex flex-col h-full bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden relative z-[40]"
          >
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className={`p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-emerald-500/20">
                       <Truck size={28} />
                    </div>
                    <div>
                       <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">{editingSupplier ? t('suppliers.edit') : t('suppliers.add')}</h3>
                       <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('suppliers.subtitle')}</p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-50 rounded-full transition-all">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                      <div className="md:col-span-2">
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_name')}</label>
                        <input
                          required
                          type="text"
                          placeholder="اسم المورد / الشركة"
                          className="w-full px-8 py-5 bg-white border border-slate-100 rounded-[1.5rem] text-xl font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none placeholder:text-slate-300"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>

                      {editingSupplier && (
                        <div>
                          <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.column_code')}</label>
                          <div className="relative group">
                            <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                            <input
                              required
                              readOnly
                              type="text"
                              className="w-full px-8 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-mono text-lg font-black text-slate-400 cursor-not-allowed ps-14 tracking-widest"
                              value={editingSupplier.code}
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_mobile')}</label>
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
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_email')}</label>
                        <div className="relative group">
                          <Mail className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                          <input
                            type="email"
                            placeholder="supplier@example.com"
                            className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_address')}</label>
                        <div className="relative group">
                          <MapPin className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                          <textarea
                            placeholder="العنوان التفصيلي للمورد"
                            className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14 min-h-[100px]"
                            rows={2}
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2 p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div>
                          <label className={`block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_opening_balance')}</label>
                          <div className="relative group">
                            <Wallet className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-emerald-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                            <input
                              type="number"
                              className="w-full px-8 py-5 bg-white border border-emerald-100 rounded-[1.5rem] text-3xl font-black text-emerald-600 shadow-sm transition-all focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14"
                              value={formData.opening_balance}
                              onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                            />
                            <p className="text-[11px] font-bold text-slate-400 mt-4 italic leading-relaxed px-1">
                               {language === 'ar' 
                                 ? 'المبلغ الموجب (+) يعني أنك دائن للمورد بمال، والسالب (-) يعني أن للمورد مال عندك.' 
                                 : 'Positive (+) means you have credit with supplier, Negative (-) means you owe supplier.'}
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className={`block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_balance_date')}</label>
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
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_account')}</label>
                        <div className="relative group">
                          <Box className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                          <select
                            required
                            className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14 appearance-none"
                            value={formData.account_id}
                            onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                          >
                            <option value="">{language === 'ar' ? 'اختر الحساب المحاسبي المرتبط...' : 'Select associated account...'}</option>
                            {accounts.map(account => (
                              <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {formData.opening_balance !== 0 && (
                        <div className="md:col-span-2 p-10 bg-white rounded-[3rem] border border-slate-200 shadow-sm space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                           <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
                                 <Wallet size={28} />
                              </div>
                              <div>
                                 <h4 className="text-xl font-black text-slate-900 leading-none mb-1">{language === 'ar' ? 'إعدادات الرصيد الافتتاحي' : 'Opening Balance Settings'}</h4>
                                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">تحميل القيمة الافتتاحية للمورد</p>
                              </div>
                           </div>

                           <div className="space-y-6">
                              <div>
                                <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('suppliers.form_counter_account')}</label>
                                <div className="relative group">
                                   <Plus className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                                   <select
                                    required
                                    className="w-full px-8 py-4 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 shadow-sm focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-14 appearance-none"
                                    value={formData.counter_account_id}
                                    onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}
                                  >
                                    <option value="">{language === 'ar' ? 'اختر حساب الطرف الآخر...' : 'Select counter account...'}</option>
                                    {accounts.map(account => (
                                      <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              {formData.counter_account_id && (
                                 <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
                                    <JournalEntryPreview 
                                      title={language === 'ar' ? 'معاينة قيد الرصيد' : 'Entry Preview'}
                                      items={[
                                        {
                                          account_name: accounts.find(a => a.id === formData.account_id)?.name || '',
                                          debit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                          credit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                          description: language === 'ar' ? `رصيد أول: ${formData.name}` : `Opening: ${formData.name}`
                                        },
                                        {
                                          account_name: accounts.find(a => a.id === formData.counter_account_id)?.name || '',
                                          debit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                          credit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                          description: language === 'ar' ? `الطرف المقابل: ${formData.name}` : `Counter: ${formData.name}`
                                        }
                                      ]}
                                    />
                                 </div>
                              )}
                           </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-12 pb-6 flex gap-6 sticky bottom-0 bg-white/95 backdrop-blur-md z-30">
                      <button 
                        type="submit"
                        className="flex-1 py-6 bg-zinc-900 text-white rounded-[2rem] font-black text-2xl hover:bg-zinc-800 transition-all shadow-2xl active:scale-[0.98] border border-white/10"
                      >
                        {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
                      </button>
                      <button 
                        type="button"
                        onClick={closeModal}
                        className="px-12 py-6 bg-slate-50 text-slate-400 rounded-[2rem] font-black text-xl hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-[0.98] border border-slate-200"
                      >
                        تجاهل
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {editingSupplier && (
                <div className="hidden xl:block w-[450px] border-s border-slate-100 bg-white overflow-hidden flex flex-col">
                  <div className="p-8 border-b border-slate-50 bg-white">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                          <History size={24} />
                       </div>
                       <div>
                          <h4 className="text-xl font-black text-slate-900 tracking-tight">سجل الرقابة</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">تتبع التغييرات لهذا المورد</p>
                       </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <InlineActivityLog category="suppliers" documentId={editingSupplier.id} />
                  </div>
                </div>
              )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>

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
