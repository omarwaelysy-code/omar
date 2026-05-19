import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, CreditCard, History, ChevronRight, ChevronLeft, 
  Wallet, Layers, Hash, Box, AlertCircle, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
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
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().slice(0, 10),
    account_id: '',
    counter_account_id: ''
  });

  useEffect(() => {
    if (user) {
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
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const selectedAccount = accounts.find(a => a.id === formData.account_id);
      const dataToSave = {
        ...formData,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };

      let id = '';
      if (editingMethod) {
        await dbService.update('payment_methods', editingMethod.id, dataToSave);
        id = editingMethod.id;
        toast.success(t('common.updated_successfully'));
      } else {
        id = await dbService.add('payment_methods', dataToSave);
        toast.success(t('common.created_successfully'));
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
              description: 'رصيد افتتاحي'
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
      toast.error('حدث خطأ أثناء حفظ البيانات');
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
      counter_account_id: ''
    });
  };

  const openModal = (method?: PaymentMethod) => {
    if (method) {
      setEditingMethod(method);
      setFormData({
        code: method.code,
        name: method.name,
        opening_balance: method.opening_balance,
        opening_balance_date: method.opening_balance_date || new Date().toISOString().slice(0, 10),
        account_id: method.account_id || '',
        counter_account_id: method.counter_account_id || ''
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
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500 overflow-hidden" dir={dir}>
      <AnimatePresence mode="wait">
        {!isModalOpen ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col space-y-6 overflow-hidden"
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
                  <CreditCard size={28} />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900 italic serif">{language === 'ar' ? 'طرق السداد' : 'Payment Methods'}</h2>
                  <p className="text-slate-500 font-medium">{language === 'ar' ? 'إدارة الخزائن والحسابات البنكية' : 'Manage cash & bank accounts'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => setIsActivityLogOpen(true)} className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
                  <History size={20} />
                  <span className="hidden md:inline">{t('common.activity_log')}</span>
                </button>
                <button onClick={() => openModal()} className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 border border-indigo-500/50">
                  <Plus size={20} />
                  {language === 'ar' ? 'طريقة جديدة' : 'New Method'}
                </button>
              </div>
            </div>

            {/* List Control */}
            <div className="flex-1 flex flex-col h-full bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden transition-all duration-500">
              <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/30">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none`} size={20} />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'البحث بالاسم أو الكود...' : 'Search by name or code...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 outline-none font-bold text-slate-900 placeholder:text-slate-400 shadow-sm`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {loading ? (
                    <div className="col-span-full py-20 text-center text-indigo-500">
                      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <span className="font-black text-xs uppercase tracking-widest">Loading...</span>
                    </div>
                  ) : filteredMethods.map((method) => (
                    <motion.div
                      layout
                      key={method.id}
                      onClick={() => openModal(method)}
                      className="bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-8 hover:shadow-2xl hover:border-indigo-200 hover:bg-white transition-all group relative cursor-pointer overflow-hidden"
                    >
                      <div className="flex items-start justify-between mb-8">
                         <div className="w-16 h-16 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-all duration-500">
                           <CreditCard size={28} />
                         </div>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(t('common.confirm_delete'))) {
                                await dbService.delete('payment_methods', method.id);
                                toast.success(t('common.deleted_successfully'));
                              }
                            }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-indigo-700 transition-colors line-clamp-1">{method.name}</h3>
                         <div className="flex items-center gap-2">
                           <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">{method.code}</span>
                         </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</p>
                            <p className="font-black text-2xl text-indigo-600 tracking-tighter leading-none">{formatNumber(method.opening_balance || 0)} <span className="text-xs font-normal text-slate-300 italic">{t('invoices.currency')}</span></p>
                         </div>
                         <div className="p-3 bg-white rounded-xl text-slate-300 group-hover:text-indigo-600 shadow-sm border border-slate-100 transition-all">
                            {dir === 'rtl' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                         </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-white flex flex-col md:flex-row overflow-hidden h-full w-full"
          >
            {/* Form Side */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
              <div className="p-10 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20">
                <div className={`flex items-center gap-6 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="w-16 h-16 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/30">
                     <CreditCard size={32} />
                  </div>
                  <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                     <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2 font-serif italic">
                       {editingMethod ? (language === 'ar' ? 'تعديل طريقة سداد' : 'Edit Method') : (language === 'ar' ? 'إضافة طريقة سداد' : 'New Method')}
                     </h3>
                     <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none">{editingMethod?.code || 'FINANCE FLOW : NEW'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button type="submit" form="method-form" className="px-10 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-500/20 active:scale-95 border border-indigo-500/50">
                     {editingMethod ? t('common.save') : t('common.add')}
                  </button>
                  <button onClick={closeModal} className="w-14 h-14 flex items-center justify-center bg-slate-100 text-slate-400 rounded-[1.5rem] hover:bg-rose-50 hover:text-rose-500 transition-all active:rotate-90">
                     <X size={28} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <form id="method-form" onSubmit={handleSubmit} className="p-8 md:p-16 space-y-16" dir={dir}>
                   {/* Base Info Section */}
                   <div className="space-y-10">
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-8 bg-indigo-600 rounded-full" />
                         <h4 className="text-xl font-black text-slate-900 tracking-tight uppercase">{language === 'ar' ? 'المعلومات الأساسية' : 'Primary Information'}</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 text-right">
                         <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{language === 'ar' ? 'اسم الطريقة / الخزينة' : 'Method Name'}</label>
                            <input required type="text" placeholder={language === 'ar' ? 'مثال: الخزينة الرئيسية' : 'e.g. Main Safe'} className="w-full px-8 py-5 bg-white border border-slate-100 rounded-[1.5rem] text-xl font-black text-slate-900 shadow-sm transition-all outline-none" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                         </div>
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{language === 'ar' ? 'كود الطريقة' : 'Method Code'}</label>
                            <div className="relative group">
                              <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors`} size={20} />
                              <input required type="text" placeholder="CASH-01" className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] font-mono text-lg font-black text-slate-900 shadow-sm ps-14 tracking-widest" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                            </div>
                         </div>
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{language === 'ar' ? 'الحساب المحاسبي' : 'Linked Account'}</label>
                            <div className="relative group">
                              <Box className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors`} size={20} />
                              <select required className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm ps-14 appearance-none" value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}>
                                <option value="">Select Account...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                              </select>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Opening Balance Section */}
                   <div className="space-y-10 pt-10 border-t border-slate-50">
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-8 bg-amber-500 rounded-full" />
                         <h4 className="text-xl font-black text-slate-900 tracking-tight uppercase">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Setup'}</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1 text-right">{language === 'ar' ? 'الرصيد الحالي' : 'Opening Balance'}</label>
                            <div className="relative group">
                              <Wallet className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-emerald-400`} size={20} />
                              <input type="number" step="0.01" className="w-full px-8 py-5 bg-white border border-emerald-100 rounded-[1.5rem] text-3xl font-black text-emerald-600 ps-14" value={formData.opening_balance} onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })} />
                            </div>
                         </div>
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1 text-right">{language === 'ar' ? 'تاريخ الرصيد' : 'As of Date'}</label>
                            <div className="relative group">
                              <Calendar className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300`} size={20} />
                              <input type="date" className="w-full px-8 py-5 bg-white border border-slate-200 rounded-[1.5rem] text-lg font-black text-slate-900 ps-14" value={formData.opening_balance_date} onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })} />
                            </div>
                         </div>

                         {formData.opening_balance !== 0 && (
                            <div className="md:col-span-2 p-10 bg-slate-50 rounded-[3rem] border border-slate-100 space-y-8 animate-in slide-in-from-top-4">
                               <h4 className="text-xl font-black text-slate-900">{language === 'ar' ? 'إعدادات قيد الموازنة' : 'Journal Settings'}</h4>
                               <div>
                                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{language === 'ar' ? 'حساب الطرف الآخر للقيد' : 'Counter Account'}</label>
                                  <select required className="w-full px-8 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-lg font-black appearance-none" value={formData.counter_account_id} onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}>
                                    <option value="">Select counter account...</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                                  </select>
                               </div>
                               {formData.counter_account_id && (
                                  <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm">
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
              <div className="hidden lg:flex w-[450px] flex-col bg-slate-50 border-s border-white overflow-hidden shadow-2xl">
                <div className="p-10 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 text-right">
                   <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                         <History size={24} />
                       </div>
                       <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block leading-none mb-1">Audit Trail</span>
                          <span className="font-black text-slate-900 text-lg uppercase tracking-wider">{t('common.activity_log')}</span>
                       </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                   <InlineActivityLog category="payment_methods" documentId={editingMethod.id} />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <PageActivityLog category="payment_methods" isOpen={isActivityLogOpen} onClose={() => setIsActivityLogOpen(false)} />
    </div>
  );
};
