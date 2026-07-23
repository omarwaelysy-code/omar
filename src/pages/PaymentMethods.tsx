import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, CreditCard, History, ChevronRight, ChevronLeft, 
  Wallet, Layers, Hash, Box, AlertCircle, Calendar, LayoutGrid, List, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { PaymentMethod, Account } from '../types';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { formatNumber } from '../utils/formatUtils';

export const PaymentMethods: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'card' | 'table'>('card');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [isBalanceFocused, setIsBalanceFocused] = useState(false);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: '',
    counter_account_id: '',
    type: 'cash'
  });

  useEffect(() => {
    if (user?.company_id) {
      const unsub = dbService.subscribe<PaymentMethod>('payment_methods', user.company_id, setMethods);
      const unsubscribeAccounts = dbService.subscribe<Account>('accounts', user.company_id, (data) => {
        setAccounts(data);
      });
      setLoading(false);
      return () => {
        unsub();
        unsubscribeAccounts();
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

  const resetForm = () => {
    setEditingMethod(null);
    setFormData({
      code: '',
      name: '',
      opening_balance: 0,
      opening_balance_date: new Date().toISOString().slice(0, 10),
      account_id: '',
      counter_account_id: '',
      type: 'cash'
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
        type: method.type || 'cash'
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

  const filteredMethods = methods.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-700 overflow-hidden" dir={dir}>
      <AnimatePresence mode="wait">
        {!isModalOpen ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden max-w-7xl mx-auto w-full p-4"
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-6 border-b border-slate-100">
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-3 leading-none italic serif">
                  {language === 'ar' ? 'طرق السداد' : 'Payment Methods'}
                </h1>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">
                  {language === 'ar' ? 'إدارة الخزائن والحسابات البنكية' : 'Manage cash & bank accounts'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setIsActivityLogOpen(true)} className="w-14 h-14 bg-white text-slate-400 border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-95">
                  <History size={24} />
                </button>
                <button 
                  onClick={() => openModal()}
                  className="group relative px-8 py-4 bg-zinc-900 text-white rounded-[1.5rem] shadow-xl overflow-hidden transition-all hover:bg-zinc-800 active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10 flex items-center gap-3 font-black uppercase tracking-widest text-sm">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    {language === 'ar' ? 'طريقة جديدة' : 'New Method'}
                  </div>
                </button>
              </div>
            </div>

            {/* List Control */}
            <div className="flex-1 bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col transition-all duration-500">
              <div className="p-8 border-b border-slate-50 flex items-center justify-between gap-4 bg-slate-50/20">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors pointer-events-none`} size={24} />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'البحث بالاسم أو الكود...' : 'Search by name or code...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-16 pl-6' : 'pl-16 pr-6'} py-4 bg-white border border-slate-100 rounded-[2rem] outline-none font-bold text-slate-900 placeholder:text-slate-300 focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all shadow-inner`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50 shadow-inner w-fit">
                  <button
                    onClick={() => setView('table')}
                    className={`p-2 px-3 rounded-xl transition-all flex items-center gap-2 font-bold text-sm ${view === 'table' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
                    title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
                  >
                    <List size={18} />
                    <span className="hidden md:inline">{language === 'ar' ? 'مسرد' : 'Table'}</span>
                  </button>
                  <button
                    onClick={() => setView('card')}
                    className={`p-2 px-3 rounded-xl transition-all flex items-center gap-2 font-bold text-sm ${view === 'card' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100/50' : 'text-zinc-500 hover:text-zinc-700'}`}
                    title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
                  >
                    <LayoutGrid size={18} />
                    <span className="hidden md:inline">{language === 'ar' ? 'بطاقات' : 'Cards'}</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                {loading ? (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  </div>
                ) : view === 'card' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {filteredMethods.map((method) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -5 }}
                        key={method.id}
                        onClick={() => openModal(method)}
                        className="p-8 space-y-6 rounded-[3rem] border bg-white border-slate-100 hover:border-indigo-200 hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                           <div className="w-20 h-20 bg-slate-50 rounded-[2rem] shadow-inner border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-indigo-600 transition-all duration-500">
                             <CreditCard size={32} />
                           </div>
                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(t('common.confirm_delete'))) {
                                  await dbService.delete('payment_methods', method.id);
                                  showNotification(t('common.deleted_successfully'), 'success');
                                }
                              }} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={20} /></button>
                           </div>
                        </div>

                        <div className="space-y-2">
                           <h3 className="text-2xl font-black text-slate-900 line-clamp-1 italic serif tracking-tighter group-hover:text-indigo-700 transition-colors uppercase">{method.name}</h3>
                           <span className="inline-block px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">{method.code}</span>
                        </div>

                        <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</p>
                              <p className="font-black text-3xl text-indigo-600 tracking-tighter leading-none">{formatNumber(method.opening_balance || 0)} <span className="text-xs font-normal text-slate-300 italic serif">{t('invoices.currency')}</span></p>
                           </div>
                           <div className="p-3 bg-slate-50 rounded-2xl text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                              {dir === 'rtl' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
                           </div>
                        </div>
                      </motion.div>
                    ))}
                    {filteredMethods.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-400 font-bold">{language === 'ar' ? 'لا توجد طرق سداد حالياً' : 'No methods found.'}</div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-3xl border border-slate-150">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                          <th className="px-6 py-4">{language === 'ar' ? 'كود طريقة السداد' : 'Code'}</th>
                          <th className="px-6 py-4">{language === 'ar' ? 'طريقة السداد' : 'Name'}</th>
                          <th className="px-6 py-4">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</th>
                          <th className="px-6 py-4 text-left">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredMethods.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">{language === 'ar' ? 'لا توجد طرق سداد حالياً' : 'No methods found.'}</td>
                          </tr>
                        ) : filteredMethods.map((method) => (
                          <tr 
                            key={method.id} 
                            className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                            onClick={() => openModal(method)}
                          >
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold border border-slate-200">{method.code}</span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-900">{method.name}</td>
                            <td className="px-6 py-4">
                              <span className="font-black text-indigo-600">{formatNumber(method.opening_balance || 0)} ج.م</span>
                            </td>
                            <td className="px-6 py-4 text-left" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => openModal(method)}
                                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                  title={language === 'ar' ? 'تعديل' : 'Edit'}
                                >
                                  <FileText size={18} />
                                </button>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm(t('common.confirm_delete'))) {
                                      await dbService.delete('payment_methods', method.id);
                                      showNotification(t('common.deleted_successfully'), 'success');
                                    }
                                  }}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                  title={language === 'ar' ? 'حذف' : 'Delete'}
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
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden max-w-7xl mx-auto w-full p-4"
          >
            <div className="bg-white flex-1 rounded-[3.5rem] shadow-xl shadow-slate-200/40 flex flex-col md:flex-row overflow-hidden border border-slate-100 transition-all duration-500">
              {/* Form Side */}
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                <div className="p-10 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20">
                  <div className={`flex items-center gap-6 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className="w-16 h-16 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-500/20">
                       <CreditCard size={32} />
                    </div>
                    <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                       <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1 font-serif italic">
                         {editingMethod ? (language === 'ar' ? 'تعديل طريقة سداد' : 'Edit Method') : (language === 'ar' ? 'إضافة طريقة سداد' : 'New Method')}
                       </h3>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none">{editingMethod?.code || 'FINANCE FLOW : NEW'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button type="submit" form="method-form" className="px-10 py-5 bg-zinc-900 text-white rounded-[1.5rem] font-black hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">
                       {editingMethod ? t('common.save') : t('common.add')}
                    </button>
                    <button onClick={closeModal} className="w-14 h-14 flex items-center justify-center bg-slate-50 text-slate-400 rounded-[1.5rem] hover:bg-rose-50 hover:text-rose-500 transition-all">
                       <X size={28} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-14">
                  <form id="method-form" onSubmit={handleSubmit} className="space-y-16" dir={dir}>
                     {/* Base Info Section */}
                     <div className="space-y-10">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                           <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <CreditCard size={24} />
                           </div>
                           <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                              {language === 'ar' ? 'المعلومات الأساسية' : 'Primary Information'}
                           </h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                           <div className="md:col-span-2 space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'اسم الطريقة / الخزينة' : 'Method Name'}</label>
                              <input required type="text" placeholder="..." className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                           </div>
                           <div className="space-y-4">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'نوع طريقة السداد' : 'Payment Method Type'}</label>
                               <div className="relative group">
                                 <select required className="w-full pr-16 pl-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value, account_id: '' })}>
                                   <option value="cash">{language === 'ar' ? 'نقدية (Cash)' : 'Cash'}</option>
                                   <option value="bank">{language === 'ar' ? 'بنك (Bank)' : 'Bank'}</option>
                                   <option value="wallet">{language === 'ar' ? 'محفظة إلكترونية (Wallet)' : 'Wallet'}</option>
                                 </select>
                               </div>
                            </div>
                            <div className="space-y-4">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'كود الطريقة' : 'Method Code'}</label>
                               <div className="relative group">
                                 <Hash className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors`} size={24} />
                                 <input required type="text" placeholder="CASH-01" className="w-full pr-16 pl-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] font-mono text-xl font-black text-slate-900 outline-none shadow-inner tracking-widest" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                               </div>
                            </div>
                            <div className="md:col-span-2 space-y-4">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'الحساب المحاسبي' : 'Linked Account'}</label>
                               <div className="relative group">
                                 <Box className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors`} size={24} />
                                 <select required className="w-full pr-16 pl-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner" value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}>
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
                     </div>

                     {/* Opening Balance Section */}
                     <div className="space-y-12">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                           <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <Wallet size={24} />
                           </div>
                           <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                              {language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Setup'}
                           </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-right">{language === 'ar' ? 'الرصيد الحالي' : 'Opening Balance'}</label>
                              <div className="relative group">
                                <Wallet className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-emerald-400`} size={24} />
                                <input
                                  type={isBalanceFocused ? "number" : "text"}
                                  step="0.01"
                                  className="w-full pr-16 pl-6 py-5 bg-white border border-emerald-100 rounded-[2.5rem] text-4xl font-black text-emerald-600 outline-none focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-sm"
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
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-right">{language === 'ar' ? 'تاريخ الرصيد' : 'As of Date'}</label>
                              <div className="relative group">
                                <Calendar className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300`} size={24} />
                                <input type="date" className="w-full pr-16 pl-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner" value={formData.opening_balance_date} onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })} />
                              </div>
                           </div>

                           {formData.opening_balance !== 0 && (
                              <div className="md:col-span-2 p-12 bg-slate-50/50 rounded-[3.5rem] border border-slate-100 space-y-10 animate-in slide-in-from-top-4 shadow-inner">
                                 <h4 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase text-right">{language === 'ar' ? 'إعدادات قيد الموازنة' : 'Journal Settings'}</h4>
                                 <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 text-right">{language === 'ar' ? 'حساب الطرف الآخر للقيد' : 'Counter Account'}</label>
                                    <select required className="w-full px-8 py-5 bg-white border border-slate-200 rounded-[2.5rem] text-xl font-black appearance-none outline-none focus:ring-8 focus:ring-indigo-500/5 transition-all" value={formData.counter_account_id} onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}>
                                      <option value="">{language === 'ar' ? 'اختر حساب الطرف الآخر...' : 'Select counter account...'}</option>
                                      {accounts
                                        .filter(acc => ['opening_balance', 'capital', 'equity', 'retained_earnings', 'other'].includes(acc.account_usage || ''))
                                        .map(acc => (
                                          <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                 </div>
                                 {formData.counter_account_id && (
                                    <div className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm">
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
                <div className="hidden lg:flex w-[400px] flex-col bg-slate-50 border-s border-slate-100 overflow-hidden shadow-inner">
                  <div className="p-10 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 text-right">
                     <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                           <History size={24} />
                         </div>
                         <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">النشاط الأخير</span>
                            <h3 className="font-black text-slate-900 text-lg">سجل التعديلات</h3>
                         </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <InlineActivityLog category="payment_methods" documentId={editingMethod.id} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageActivityLog category="payment_methods" isOpen={isActivityLogOpen} onClose={() => setIsActivityLogOpen(false)} />
    </div>
  );
};
