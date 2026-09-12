import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, CreditCard, History, ChevronRight, ChevronLeft, 
  Wallet, Layers, Hash, Box, AlertCircle, Calendar, LayoutGrid, List, FileText, FileUp,
  Building2, Landmark, Phone, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { PaymentMethod, Account, JournalEntry } from '../types';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { formatNumber } from '../utils/formatUtils';
import { ExcelImportWizard } from '../components/ExcelImportWizard';

export const PaymentMethods: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [receiptVouchers, setReceiptVouchers] = useState<any[]>([]);
  const [paymentVouchers, setPaymentVouchers] = useState<any[]>([]);
  const [cashTransfers, setCashTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'card' | 'table'>('card');
  const [showImportWizard, setShowImportWizard] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [isBalanceFocused, setIsBalanceFocused] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: '',
    counter_account_id: '',
    type: 'cash',
    bank_name: '',
    branch_name: '',
    account_number: '',
    swift_code: '',
    iban: '',
    contact_person: '',
    contact_phone: ''
  });

  useEffect(() => {
    if (user?.company_id) {
      const unsub = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setMethods);
      const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, (data) => {
        setAccounts(data);
      });
      const unsubJournals = dbService.subscribe<JournalEntry>('journal_entries', user.company_id, setJournalEntries);
      const unsubReceipts = dbService.subscribe<any>('receipt_vouchers', user.company_id, setReceiptVouchers);
      const unsubPayments = dbService.subscribe<any>('payment_vouchers', user.company_id, setPaymentVouchers);
      const unsubTransfers = dbService.subscribe<any>('cash_transfers', user.company_id, setCashTransfers);

      setLoading(false);
      return () => {
        unsub();
        unsubscribeAccounts();
        unsubJournals();
        unsubReceipts();
        unsubPayments();
        unsubTransfers();
      };
    }
  }, [user?.company_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const selectedAccount = accounts.find(a => a.id === formData.account_id);
      const validCashUsages = ['cash', 'petty_cash', 'bank', 'wallet', 'credit_card', 'debit_card', 'main_cash'];

      if (!selectedAccount || !validCashUsages.includes(selectedAccount.account_usage || '')) {
        showNotification('خطأ: يجب أن يكون الحساب المحاسبي لطريقة السداد من قسم (النقدية والبنوك والوسائل المالية)', 'error');
        return;
      }

      const dataToSave = {
        ...formData,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };

      let id = '';
      if (editingMethod) {
        await dbService.update('payment_methods', editingMethod.id, dataToSave);
        id = editingMethod.id;
        showNotification(t('common.updated_successfully'), 'success');
      } else {
        id = await dbService.add('payment_methods', dataToSave);
        showNotification(t('common.created_successfully'), 'success');
      }

      setIsModalOpen(false);
      resetForm();

      if (formData.opening_balance !== 0) {
        await dbService.deleteJournalEntryByReference(id, user.company_id);
        const absBalance = Math.abs(formData.opening_balance);
        const isNegative = formData.opening_balance < 0;
        const counterAccount = accounts.find(a => a.id === formData.counter_account_id);

        await dbService.add('journal_entries', {
          company_id: user.company_id,
          date: formData.opening_balance_date,
          description: `رصيد افتتاحي لطريقة السداد: ${formData.name}`,
          reference_id: id,
          reference_type: 'opening_balance',
          items: [
            {
              account_id: formData.account_id,
              account_name: selectedAccount?.name || '',
              debit: isNegative ? 0 : absBalance,
              credit: isNegative ? absBalance : 0,
              description: 'رصيد افتتاحي',
              sub_account_id: id,
              sub_account_type: 'payment_method'
            },
            {
              account_id: formData.counter_account_id,
              account_name: counterAccount?.name || 'حساب الميزانية الافتتاحية',
              debit: isNegative ? absBalance : 0,
              credit: isNegative ? 0 : absBalance,
              description: `رصيد افتتاحي لطريقة السداد: ${formData.name}`
            }
          ],
          total_debit: absBalance,
          total_credit: absBalance,
          created_at: new Date().toISOString(),
          created_by: user.id
        });
      }
    } catch (e) {
      showNotification('حدث خطأ أثناء حفظ البيانات', 'error');
    }
  };

  const handleDeleteClick = (method: PaymentMethod) => {
    setMethodToDelete(method);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!methodToDelete || !user) return;
    setIsDeleting(true);
    try {
      // 1. Check in invoices
      const invCheck = await dbService.getDocsByFilter<any>('invoices', user.company_id, [
        { field: 'payment_method_id', operator: '==', value: methodToDelete.id }
      ]);
      if (invCheck && invCheck.length > 0) {
        showNotification(
          language === 'ar' 
            ? 'لا يمكن حذف طريقة السداد لوجود فواتير مبيعات مسجلة بها.' 
            : 'Cannot delete payment method because sales invoices are linked to it.',
          'error'
        );
        setIsDeleteModalOpen(false);
        setMethodToDelete(null);
        setIsDeleting(false);
        return;
      }

      // 2. Check in purchase invoices
      const purCheck = await dbService.getDocsByFilter<any>('purchase_invoices', user.company_id, [
        { field: 'payment_method_id', operator: '==', value: methodToDelete.id }
      ]);
      if (purCheck && purCheck.length > 0) {
        showNotification(
          language === 'ar' 
            ? 'لا يمكن حذف طريقة السداد لوجود فواتير مشتريات مسجلة بها.' 
            : 'Cannot delete payment method because purchase invoices are linked to it.',
          'error'
        );
        setIsDeleteModalOpen(false);
        setMethodToDelete(null);
        setIsDeleting(false);
        return;
      }

      // 3. Check in receipt vouchers
      const rvCheck = await dbService.getDocsByFilter<any>('receipt_vouchers', user.company_id, [
        { field: 'payment_method_id', operator: '==', value: methodToDelete.id }
      ]);
      if (rvCheck && rvCheck.length > 0) {
        showNotification(
          language === 'ar' 
            ? 'لا يمكن حذف طريقة السداد لوجود سندات قبض مسجلة بها.' 
            : 'Cannot delete payment method because receipt vouchers are linked to it.',
          'error'
        );
        setIsDeleteModalOpen(false);
        setMethodToDelete(null);
        setIsDeleting(false);
        return;
      }

      // 4. Check in payment vouchers
      const pvCheck = await dbService.getDocsByFilter<any>('payment_vouchers', user.company_id, [
        { field: 'payment_method_id', operator: '==', value: methodToDelete.id }
      ]);
      if (pvCheck && pvCheck.length > 0) {
        showNotification(
          language === 'ar' 
            ? 'لا يمكن حذف طريقة السداد لوجود سندات صرف مسجلة بها.' 
            : 'Cannot delete payment method because payment vouchers are linked to it.',
          'error'
        );
        setIsDeleteModalOpen(false);
        setMethodToDelete(null);
        setIsDeleting(false);
        return;
      }

      // 5. Check in cash transfers
      try {
        const fromCt = await dbService.getDocsByFilter<any>('cash_transfers', user.company_id, [
          { field: 'from_payment_method_id', operator: '==', value: methodToDelete.id }
        ]);
        const toCt = await dbService.getDocsByFilter<any>('cash_transfers', user.company_id, [
          { field: 'to_payment_method_id', operator: '==', value: methodToDelete.id }
        ]);
        if ((fromCt && fromCt.length > 0) || (toCt && toCt.length > 0)) {
          showNotification(
            language === 'ar' 
              ? 'لا يمكن حذف طريقة السداد لوجود تحويلات نقدية مرتبطة بها.' 
              : 'Cannot delete payment method because cash transfers are linked to it.',
            'error'
          );
          setIsDeleteModalOpen(false);
          setMethodToDelete(null);
          setIsDeleting(false);
          return;
        }
      } catch (e) {}

      // Delete opening balance journal entry
      await dbService.deleteJournalEntryByReference(methodToDelete.id, user.company_id);

      // Perform delete
      await dbService.delete('payment_methods', methodToDelete.id);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف طريقة سداد', `حذف طريقة السداد: ${methodToDelete.name}`, 'payment_methods');
      showNotification(t('common.deleted_successfully'), 'success');
      setIsDeleteModalOpen(false);
      setMethodToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حذف طريقة السداد', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    const defaultCashAccount = accounts.find(a => ['cash', 'petty_cash', 'bank', 'wallet', 'credit_card', 'debit_card', 'main_cash'].includes(a.account_usage || ''));
    setEditingMethod(null);
    setFormData({
      code: '',
      name: '',
      opening_balance: 0,
      opening_balance_date: new Date().toISOString().slice(0, 10),
      account_id: defaultCashAccount?.id || '',
      counter_account_id: '',
      type: 'cash',
      bank_name: '',
      branch_name: '',
      account_number: '',
      swift_code: '',
      iban: '',
      contact_person: '',
      contact_phone: ''
    });
  };

  const openModal = (method?: PaymentMethod) => {
    if (method) {
      setEditingMethod(method);
      setFormData({
        code: method.code,
        name: method.name,
        opening_balance: Number(method.opening_balance) || 0,
        opening_balance_date: method.opening_balance_date ? new Date(method.opening_balance_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        account_id: method.account_id || '',
        counter_account_id: method.counter_account_id || '',
        type: method.type || 'cash',
        bank_name: method.bank_name || '',
        branch_name: method.branch_name || '',
        account_number: method.account_number || '',
        swift_code: method.swift_code || '',
        iban: method.iban || '',
        contact_person: method.contact_person || '',
        contact_phone: method.contact_phone || ''
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const getMethodCurrentBalance = (method: PaymentMethod): number => {
    let delta = 0;
    journalEntries.forEach(je => {
      // Skip opening balance entries to avoid double counting with method.opening_balance
      if (je.reference_type === 'opening_balance') return;

      je.items?.forEach((item: any) => {
        let isMatch = false;

        // 1. Direct sub_account match
        if (item.sub_account_type === 'payment_method' && item.sub_account_id === method.id) {
          isMatch = true;
        }
        // 2. Receipt Voucher lookup
        else if (je.reference_type === 'receipt' && je.reference_id && item.account_id === method.account_id) {
          const rv = receiptVouchers.find(v => v.id === je.reference_id);
          if (rv && rv.payment_method_id === method.id) {
            isMatch = true;
          }
        }
        // 3. Payment Voucher lookup
        else if (je.reference_type === 'payment' && je.reference_id && item.account_id === method.account_id) {
          const pv = paymentVouchers.find(v => v.id === je.reference_id);
          if (pv && pv.payment_method_id === method.id) {
            isMatch = true;
          }
        }
        // 4. Cash Transfer lookup
        else if ((je.reference_type === 'transfer' || je.reference_type === 'cash_transfer') && je.reference_id && item.account_id === method.account_id) {
          const ct = cashTransfers.find(v => v.id === je.reference_id);
          if (ct) {
            const d = Number(item.debit) || 0;
            const pmId = d > 0 ? ct.to_payment_method_id : ct.from_payment_method_id;
            if (pmId === method.id) {
              isMatch = true;
            }
          }
        }

        if (isMatch) {
          delta += (Number(item.debit) || 0) - (Number(item.credit) || 0);
        }
      });
    });

    return (Number(method.opening_balance) || 0) + delta;
  };

  const filteredMethods = methods.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-2 animate-in fade-in duration-500 overflow-hidden w-full px-1 sm:px-3 py-1" dir={dir}>
      <AnimatePresence mode="wait">
        {!isModalOpen ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col space-y-2 overflow-hidden w-full"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                  <CreditCard size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black tracking-tight text-slate-900 leading-none">
                      {language === 'ar' ? 'طرق السداد' : 'Payment Methods'}
                    </h2>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                      {methods.length} {language === 'ar' ? 'طريقة' : 'methods'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                    {language === 'ar' ? 'إدارة الخزائن والحسابات البنكية' : 'Manage cash & bank accounts'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setIsActivityLogOpen(true)} 
                  className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg font-bold text-xs hover:bg-slate-50 transition-all active:scale-95 shadow-xs"
                  title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
                >
                  <History size={14} />
                  <span className="hidden sm:inline">{language === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
                </button>
                <button
                  onClick={() => setShowImportWizard(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-emerald-700 border border-emerald-300 rounded-lg font-bold text-xs hover:bg-emerald-50 transition-all active:scale-95 shadow-xs"
                  title="استيراد من Excel"
                >
                  <FileUp size={14} />
                  <span className="hidden sm:inline">استيراد Excel</span>
                </button>
                <button 
                  onClick={() => openModal()}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-lg font-bold text-xs hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                >
                  <Plus size={15} />
                  <span>{language === 'ar' ? 'طريقة جديدة' : 'New Method'}</span>
                </button>
              </div>
            </div>

            {/* List Control */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col transition-all duration-300">
              <div className="p-2 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/30">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none`} size={15} />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'البحث بالاسم أو الكود...' : 'Search by name or code...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 bg-white border border-slate-200 rounded-lg outline-none font-bold text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner w-fit">
                  <button
                    onClick={() => setView('table')}
                    className={`p-1 px-2 rounded-md transition-all flex items-center gap-1 font-bold text-xs ${view === 'table' ? 'bg-white text-indigo-600 shadow-xs border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                    title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
                  >
                    <List size={14} />
                    <span className="hidden sm:inline">{language === 'ar' ? 'مسرد' : 'Table'}</span>
                  </button>
                  <button
                    onClick={() => setView('card')}
                    className={`p-1 px-2 rounded-md transition-all flex items-center gap-1 font-bold text-xs ${view === 'card' ? 'bg-white text-indigo-600 shadow-xs border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                    title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
                  >
                    <LayoutGrid size={14} />
                    <span className="hidden sm:inline">{language === 'ar' ? 'بطاقات' : 'Cards'}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="py-12 text-center">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  </div>
                ) : view === 'card' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 p-3">
                    {filteredMethods.map((method) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={method.id}
                        onClick={() => openModal(method)}
                        className="p-3 space-y-2 rounded-xl border bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                           <div className="w-8 h-8 bg-slate-50 rounded-lg shadow-inner border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all">
                             <CreditCard size={16} />
                           </div>
                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(method);
                                }} 
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title={language === 'ar' ? 'حذف' : 'Delete'}
                              >
                                <Trash2 size={14} />
                              </button>
                           </div>
                        </div>

                        <div className="space-y-1">
                           <div className="flex items-center gap-1.5 flex-wrap">
                             <h3 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-700 transition-colors">{method.name}</h3>
                             {method.type === 'bank' && (
                               <span className="inline-block px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold border border-indigo-100">
                                 {language === 'ar' ? 'بنك' : 'Bank'}
                               </span>
                             )}
                           </div>
                           <div className="flex items-center gap-1 flex-wrap">
                             <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded text-[10px] font-bold border border-slate-200 font-mono">{method.code}</span>
                             {method.type === 'bank' && method.account_number && (
                               <span className="inline-block px-1.5 py-0.2 bg-slate-50 text-slate-600 rounded text-[10px] font-mono font-bold border border-slate-200">
                                 #{method.account_number}
                               </span>
                             )}
                             {method.type === 'bank' && method.bank_name && (
                               <span className="inline-block px-1.5 py-0.2 bg-slate-50 text-slate-500 rounded text-[10px] font-medium border border-slate-200">
                                 {method.bank_name}
                               </span>
                             )}
                           </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                           <div className="flex items-center gap-3">
                             <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</p>
                               <p className="font-bold text-xs text-slate-600 tracking-tight leading-none mt-0.5">{formatNumber(method.opening_balance || 0)} <span className="text-[9px] font-normal text-slate-400">{t('invoices.currency')}</span></p>
                             </div>
                             <div className="h-6 w-[1px] bg-slate-100" />
                             <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}</p>
                               {(() => {
                                 const currentBal = getMethodCurrentBalance(method);
                                 const isPositive = currentBal > 0;
                                 const isNegative = currentBal < 0;
                                 return (
                                   <p className={`font-black text-sm tracking-tight leading-none mt-0.5 ${
                                     isNegative ? 'text-rose-600' : isPositive ? 'text-emerald-600' : 'text-slate-800'
                                   }`}>
                                     {formatNumber(currentBal)} <span className="text-[9px] font-normal text-slate-400">{t('invoices.currency')}</span>
                                   </p>
                                 );
                               })()}
                             </div>
                           </div>
                           <div className="p-1 bg-slate-50 rounded-md text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                              {dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                           </div>
                        </div>
                      </motion.div>
                    ))}
                    {filteredMethods.length === 0 && (
                      <div className="col-span-full py-8 text-center text-slate-400 font-bold text-xs">{language === 'ar' ? 'لا توجد طرق سداد حالياً' : 'No methods found.'}</div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto h-full">
                    <table className="w-full text-right border-collapse">
                      <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-slate-100">
                        <tr className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                          <th className="px-4 py-2">{language === 'ar' ? 'كود طريقة السداد' : 'Code'}</th>
                          <th className="px-4 py-2">{language === 'ar' ? 'طريقة السداد' : 'Name'}</th>
                          <th className="px-4 py-2">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</th>
                          <th className="px-4 py-2">{language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}</th>
                          <th className="px-4 py-2 text-left">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredMethods.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs italic">{language === 'ar' ? 'لا توجد طرق سداد حالياً' : 'No methods found.'}</td>
                          </tr>
                        ) : filteredMethods.map((method) => {
                          const currentBal = getMethodCurrentBalance(method);
                          const isPositive = currentBal > 0;
                          const isNegative = currentBal < 0;
                          return (
                            <tr 
                              key={method.id} 
                              className="hover:bg-slate-50/50 transition-colors group cursor-pointer text-xs"
                              onClick={() => openModal(method)}
                            >
                              <td className="px-4 py-2">
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold border border-slate-200">{method.code}</span>
                              </td>
                              <td className="px-4 py-2 font-bold text-slate-900">{method.name}</td>
                              <td className="px-4 py-2">
                                <span className="font-bold text-slate-600">{formatNumber(method.opening_balance || 0)} ج.م</span>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`font-black ${
                                  isNegative ? 'text-rose-600' : isPositive ? 'text-emerald-600' : 'text-slate-800'
                                }`}>
                                  {formatNumber(currentBal)} ج.م
                                </span>
                              </td>
                              <td className="px-4 py-2 text-left" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => openModal(method)}
                                    className="p-1 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                    title={language === 'ar' ? 'تعديل' : 'Edit'}
                                  >
                                    <FileText size={14} />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(method);
                                    }}
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                    title={language === 'ar' ? 'حذف' : 'Delete'}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col space-y-2 overflow-hidden w-full"
          >
            <div className="bg-white flex-1 rounded-2xl shadow-sm flex flex-col md:flex-row overflow-hidden border border-slate-200 transition-all duration-300">
              {/* Form Side */}
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-xs">
                       <CreditCard size={15} />
                    </div>
                    <div>
                       <h3 className="text-sm font-black text-slate-900 tracking-tight leading-none">
                         {editingMethod ? (language === 'ar' ? 'تعديل طريقة سداد' : 'Edit Method') : (language === 'ar' ? 'إضافة طريقة سداد' : 'New Method')}
                       </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={closeModal} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-200 transition-all active:scale-95 border border-slate-200">
                       {t('common.cancel')}
                    </button>
                    <button type="submit" form="method-form" className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg font-bold text-xs hover:bg-zinc-800 transition-all active:scale-95 shadow-xs">
                       {editingMethod ? t('common.save') : t('common.add')}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4">
                  <form id="method-form" onSubmit={handleSubmit} className="space-y-2.5" dir={dir}>
                     {/* Base Info Section */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-right">
                        <div className="sm:col-span-2">
                           <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'اسم الطريقة / الخزينة' : 'Method Name'}</label>
                           <input required type="text" placeholder="اسم طريقة السداد" className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'نوع طريقة السداد' : 'Type'}</label>
                            <select required className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value, account_id: '' })}>
                              <option value="cash">{language === 'ar' ? 'نقدية (Cash)' : 'Cash'}</option>
                              <option value="bank">{language === 'ar' ? 'بنك (Bank)' : 'Bank'}</option>
                              <option value="wallet">{language === 'ar' ? 'محفظة إلكترونية (Wallet)' : 'Wallet'}</option>
                            </select>
                         </div>
                         <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'كود الطريقة' : 'Code'}</label>
                            <div className="relative group">
                              <Hash className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={13} />
                              <input required type="text" placeholder="CASH-01" className="w-full pr-7 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                            </div>
                         </div>
                         <div className="sm:col-span-2 lg:col-span-4">
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'الحساب المحاسبي' : 'Linked Account'}</label>
                            <div className="relative group">
                              <Box className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400 pointer-events-none`} size={13} />
                              <select required className="w-full pr-7 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 appearance-none outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs" value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}>
                                <option value="">{language === 'ar' ? 'اختر الحساب المحاسبي...' : 'Select Account...'}</option>
                                {accounts
                                  .filter(acc => {
                                    if (formData.type === 'cash') {
                                      return ['cash', 'main_cash', 'petty_cash'].includes(acc.account_usage || '');
                                    }
                                    if (formData.type === 'bank') {
                                      return ['bank', 'credit_card', 'debit_card', 'cheque', 'post_dated_cheque'].includes(acc.account_usage || '');
                                    }
                                    if (formData.type === 'wallet') {
                                      return acc.account_usage === 'wallet';
                                    }
                                    return true;
                                  })
                                  .map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                  ))}
                              </select>
                            </div>
                         </div>
                     </div>

                     {/* Bank Specific Details Section */}
                     {formData.type === 'bank' && (
                       <div className="p-2.5 bg-indigo-50/40 rounded-xl border border-indigo-100/80 space-y-2">
                         <div className="flex items-center gap-2">
                           <div className="w-6 h-6 bg-indigo-600 text-white rounded-md flex items-center justify-center shadow-xs">
                             <Building2 size={13} />
                           </div>
                           <h4 className="text-xs font-black text-slate-900">
                             {language === 'ar' ? 'بيانات الحساب البنكي (اختياري)' : 'Bank Account Details'}
                           </h4>
                         </div>
                         
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-right">
                           <div>
                             <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">
                               {language === 'ar' ? 'اسم البنك' : 'Bank Name'}
                             </label>
                             <input 
                               type="text" 
                               placeholder="مثال: CIB"
                               className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                               value={formData.bank_name || ''} 
                               onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} 
                             />
                           </div>

                           <div>
                             <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">
                               {language === 'ar' ? 'الفرع' : 'Branch'}
                             </label>
                             <input 
                               type="text" 
                               placeholder="الفرع"
                               className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                               value={formData.branch_name || ''} 
                               onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })} 
                             />
                           </div>

                           <div>
                             <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">
                               {language === 'ar' ? 'رقم الحساب' : 'Account #'}
                             </label>
                             <input 
                               type="text" 
                               placeholder="100012345678"
                               className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                               value={formData.account_number || ''} 
                               onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} 
                             />
                           </div>

                           <div>
                             <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">
                               {language === 'ar' ? 'SWIFT' : 'SWIFT'}
                             </label>
                             <input 
                               type="text" 
                               placeholder="CIBEEGCX"
                               className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs uppercase"
                               value={formData.swift_code || ''} 
                               onChange={(e) => setFormData({ ...formData, swift_code: e.target.value.toUpperCase() })} 
                             />
                           </div>

                           <div className="sm:col-span-2">
                             <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">
                               {language === 'ar' ? 'رقم الآيبان (IBAN)' : 'IBAN'}
                             </label>
                             <input 
                               type="text" 
                               placeholder="EG380002000100000012345678"
                               className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs uppercase"
                               value={formData.iban || ''} 
                               onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })} 
                             />
                           </div>

                           <div>
                             <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">
                               {language === 'ar' ? 'مسؤول الاتصال' : 'Contact Person'}
                             </label>
                             <input 
                               type="text" 
                               placeholder="الاسم"
                               className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                               value={formData.contact_person || ''} 
                               onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} 
                             />
                           </div>

                           <div>
                             <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">
                               {language === 'ar' ? 'تليفون المسؤول' : 'Phone'}
                             </label>
                             <input 
                               type="tel" 
                               placeholder="01xxxxxxxxx"
                               className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                               value={formData.contact_phone || ''} 
                               onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} 
                             />
                           </div>
                         </div>
                       </div>
                     )}

                     {/* Opening Balance Section */}
                     <div className="p-2.5 bg-slate-50/60 rounded-xl border border-slate-200/60 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-amber-500 text-white rounded-md flex items-center justify-center shadow-xs">
                            <Wallet size={13} />
                          </div>
                          <h4 className="text-xs font-black text-slate-900">
                            {language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Setup'}
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-right">
                           <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'الرصيد الحالي' : 'Opening Balance'}</label>
                              <div className="relative group">
                                <Wallet className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-emerald-500 pointer-events-none`} size={13} />
                                <input
                                  type={isBalanceFocused ? "number" : "text"}
                                  step="0.01"
                                  className="w-full pr-7 pl-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-black text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
                                  style={{ direction: 'ltr', textAlign: 'right' }}
                                  value={
                                    isBalanceFocused
                                      ? (formData.opening_balance === 0 ? '' : formData.opening_balance)
                                      : (formData.opening_balance < 0 ? '-' : '') + formatNumber(Math.abs(formData.opening_balance))
                                  }
                                  onFocus={() => setIsBalanceFocused(true)}
                                  onBlur={() => setIsBalanceFocused(false)}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setFormData({ ...formData, opening_balance: isNaN(val) ? 0 : val });
                                  }}
                                />
                              </div>
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'تاريخ الرصيد' : 'As of Date'}</label>
                              <div className="relative group">
                                <Calendar className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400 pointer-events-none`} size={13} />
                                <input type="date" className="w-full pr-7 pl-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs" value={formData.opening_balance_date} onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })} />
                              </div>
                           </div>

                           {formData.opening_balance !== 0 && (
                              <div className="sm:col-span-2 p-2 bg-white rounded-lg border border-slate-200 space-y-2 shadow-xs">
                                 <h5 className="text-xs font-black text-slate-900 leading-none">{language === 'ar' ? 'إعدادات قيد الموازنة' : 'Journal Settings'}</h5>
                                 <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'حساب الطرف الآخر للقيد' : 'Counter Account'}</label>
                                    <select required className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" value={formData.counter_account_id} onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}>
                                      <option value="">{language === 'ar' ? 'اختر حساب الطرف الآخر...' : 'Select counter account...'}</option>
                                      {accounts
                                        .filter(acc => ['opening_balance', 'capital', 'equity', 'retained_earnings', 'other'].includes(acc.account_usage || ''))
                                        .map(acc => (
                                          <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                 </div>
                                 {formData.counter_account_id && (
                                    <div className="rounded-lg overflow-hidden border border-slate-100 shadow-xs">
                                       <JournalEntryPreview 
                                         title="معاينة قيد الافتتاح"
                                         items={[
                                            {
                                               account_name: accounts.find(a => a.id === formData.account_id)?.name || 'حساب المصرف',
                                               debit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                               credit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                               description: 'رصيد افتتاحي'
                                            },
                                            {
                                               account_name: accounts.find(a => a.id === formData.counter_account_id)?.name || 'حساب الموازنة',
                                               debit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                               credit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                               description: `رصيد افتتاحي: ${formData.name}`
                                            }
                                         ]}
                                       />
                                    </div>
                                 )}
                              </div>
                           )}
                        </div>
                     </div>
                  </form>
                </div>
              </div>

              {/* Activity Side */}
              {editingMethod && (
                <div className="hidden lg:flex w-72 flex-col bg-slate-50/70 border-s border-slate-100 overflow-hidden">
                  <div className="p-2.5 border-b border-slate-100 bg-white/60 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-2">
                     <div className="w-6 h-6 bg-white rounded-md shadow-xs flex items-center justify-center text-slate-400">
                       <History size={13} />
                     </div>
                     <span className="font-bold text-slate-900 text-xs">سجل التعديلات</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                     <InlineActivityLog category="payment_methods" documentId={editingMethod.id} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageActivityLog category="payment_methods" isOpen={isActivityLogOpen} onClose={() => setIsActivityLogOpen(false)} />

      {showImportWizard && (
        <ExcelImportWizard
          module="payment_methods"
          moduleNameAr="طرق السداد"
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => setShowImportWizard(false)}
        />
      )}
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && methodToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6 text-center"
              dir={dir}
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle size={40} />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight font-serif italic">
                  {language === 'ar' ? 'تأكيد حذف طريقة السداد' : 'Confirm Delete Payment Method'}
                </h3>
                <p className="text-sm font-bold text-slate-500 leading-relaxed">
                  {language === 'ar' 
                    ? `هل أنت متأكد من رغبتك في حذف طريقة السداد "${methodToDelete.name}" (${methodToDelete.code})؟`
                    : `Are you sure you want to delete payment method "${methodToDelete.name}" (${methodToDelete.code})?`}
                </p>
                <p className="text-xs font-semibold text-rose-600 bg-rose-50/80 p-3 rounded-2xl border border-rose-100">
                  {language === 'ar'
                    ? 'تنبيه: لن يسمح النظام بحذف طريقة السداد إذا كانت مرتبطة بأي معاملات مالية، فواتير مبيعات، فواتير مشتريات، سندات قبض أو سندات صرف.'
                    : 'Notice: The system will not allow deletion if there are linked financial transactions, sales invoices, purchase invoices, or vouchers.'}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setMethodToDelete(null);
                  }}
                  className="flex-1 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl hover:bg-slate-200 transition-all text-sm cursor-pointer disabled:opacity-50"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDelete}
                  className="flex-1 py-4 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 active:scale-95 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                  <span>{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
