import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PaymentMethod, Account } from '../types';
import { Search, Plus, Trash2, Edit2, X, CreditCard, Wallet, Calendar, Hash, History, Layers, Box, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);

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
        const fieldsToTrack = [
          { field: 'code', label: 'الكود' },
          { field: 'name', label: 'الاسم' },
          { field: 'opening_balance', label: 'الرصيد الافتتاحي' },
          { field: 'opening_balance_date', label: 'تاريخ الرصيد' },
          { field: 'account_name', label: 'الحساب المحاسبي' },
          { field: 'counter_account_id', label: 'حساب الطرف الآخر' }
        ];
        await dbService.updateWithLog(
          'payment_methods', 
          editingMethod.id, 
          dataToSave,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل طريقة دفع',
          'payment_methods',
          fieldsToTrack
        );
        id = editingMethod.id;
      } else {
        id = await dbService.add('payment_methods', dataToSave);
      }

      // Success notification and modal close early
      showNotification(editingMethod ? 'تم تحديث بيانات طريقة الدفع بنجاح' : 'تم إضافة طريقة الدفع بنجاح', 'success');
      closeModal();

      // Background post-save hooks
      try {
        if (editingMethod) {
          // Always handle journal entry to ensure consistency
          await dbService.deleteJournalEntryByReference(id, user.company_id);
        } else {
          await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة طريقة دفع', `إضافة طريقة دفع جديدة: ${formData.name}`, 'payment_methods', id);
        }

        // Create initial opening balance entry
        if (formData.opening_balance !== 0) {
          const absBalance = Math.abs(formData.opening_balance);
          const isNegative = formData.opening_balance < 0;
          const counterAccount = accounts.find(a => a.id === formData.counter_account_id);

          await dbService.add('journal_entries', {
            company_id: user.company_id,
            date: formData.opening_balance_date,
            description: `رصيد افتتاحي لطريقة الدفع: ${formData.name}`,
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
                description: `رصيد افتتاحي لطريقة الدفع: ${formData.name}`
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
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء حفظ البيانات', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setMethodToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!methodToDelete || !user) return;
    try {
      const method = methods.find(m => m.id === methodToDelete);
      
      // Delete associated journal entry first
      await dbService.deleteJournalEntryByReference(methodToDelete, user.company_id);
      
      await dbService.delete('payment_methods', methodToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف طريقة دفع', `حذف طريقة دفع: ${method?.name}`, 'payment_methods', methodToDelete);
      showNotification('تم حذف طريقة الدفع بنجاح', 'success');
      setIsDeleteModalOpen(false);
      setMethodToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حذف طريقة الدفع', 'error');
    }
  };

  const openModal = async (method?: PaymentMethod) => {
    if (method) {
      console.log('[EDIT] Opening edit modal for payment method ID:', method.id);
      try {
        const fullData = await dbService.get<PaymentMethod>('payment_methods', method.id);
        console.log('[EDIT] Payment method details from API:', fullData);
        
        if (!fullData) throw new Error('Payment method not found');

        setEditingMethod(fullData);
        setFormData({
          code: fullData.code,
          name: fullData.name,
          opening_balance: fullData.opening_balance,
          opening_balance_date: fullData.opening_balance_date ? new Date(fullData.opening_balance_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          account_id: fullData.account_id || '',
          counter_account_id: fullData.counter_account_id || ''
        });
        console.log('[EDIT] Form updated with payment method:', fullData.id);
      } catch (error: any) {
        console.error('[EDIT] Error loading payment method:', error);
        showNotification('فشل تحميل بيانات طريقة السداد', 'error');
        return;
      }
    } else {
      setEditingMethod(null);
      setFormData({
        code: '',
        name: '',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        account_id: '',
        counter_account_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMethod(null);
  };

  const filteredMethods = methods.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500 overflow-hidden" dir="rtl">
      {!isModalOpen && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-4 text-right">
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <CreditCard size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 italic serif">طرق السداد</h2>
              <p className="text-slate-500 font-medium whitespace-nowrap">إدارة الخزائن، الحسابات البنكية، وطرق الدفع المختلفة.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => {
                setActivityLogDocumentId(undefined);
                setIsActivityLogOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
              title="سجل النشاط"
            >
              <History size={20} />
              <span className="hidden md:inline">سجل النشاط</span>
            </button>
            <button 
              onClick={() => openModal()}
              className={`flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50 ${isModalOpen ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Plus size={20} />
              إضافة طريقة سداد جديدة
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
                  <Search className="absolute right-4 top-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" size={20} />
                  <input 
                    type="text" 
                    placeholder="البحث باسم الطريقة أو الكود..."
                    className="w-full pr-12 pl-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none font-bold text-slate-900 placeholder:text-slate-400 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {loading ? (
                    [1,2,3].map(i => <div key={i} className="h-44 bg-slate-100 animate-pulse rounded-3xl" />)
                  ) : filteredMethods.map(method => (
                    <div 
                      key={method.id} 
                      onClick={() => openModal(method)}
                      className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-emerald-200 transition-all duration-500 cursor-pointer relative overflow-hidden"
                    >
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xl shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                            <CreditCard size={32} />
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivityLogDocumentId(method.id);
                                setIsActivityLogOpen(true);
                              }}
                              className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all"
                              title="سجل النشاط"
                            >
                              <History size={18} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(method.id);
                              }}
                              className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <h3 className="text-2xl font-black text-slate-900 mb-1 group-hover:text-emerald-700 transition-colors leading-none tracking-tight">{method.name}</h3>
                            <div className="flex items-center gap-2">
                               <span className="inline-block text-[10px] font-black text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg uppercase tracking-widest">{method.code}</span>
                               {method.opening_balance_date && (
                                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">{method.opening_balance_date}</span>
                               )}
                            </div>
                          </div>
                          
                          <div className="pt-6 border-t border-slate-50 flex items-end justify-between">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الرصيد الافتتاحي</p>
                              <p className="font-black text-3xl text-emerald-600 tracking-tighter tabular-nums leading-none">
                                {formatNumber(method.opening_balance || 0)} <span className="text-sm font-normal text-slate-300 italic">ج.م</span>
                              </p>
                            </div>
                            <div className="p-3 bg-slate-50 text-slate-300 group-hover:text-emerald-500 rounded-2xl group-hover:bg-emerald-50 transition-all border border-transparent group-hover:border-emerald-100 shadow-inner">
                               <Plus size={24} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
           </div>
         </div>

         <AnimatePresence mode="wait">
           {isModalOpen && (
             <motion.div 
               initial={{ x: -500, opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               exit={{ x: -500, opacity: 0 }}
               transition={{ type: 'spring', damping: 32, stiffness: 280 }}
               className="w-full flex flex-col h-full bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden relative z-[40]"
             >
               {/* Form Side */}
               <div className="flex-1 flex flex-col overflow-hidden bg-white">
                 <div className="p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10 flex-row">
                   <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-emerald-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-emerald-500/20">
                        <CreditCard size={28} />
                     </div>
                     <div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">{editingMethod ? 'تعديل طريقة سداد' : 'إضافة طريقة سداد'}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">إدارة الخزائن والحسابات البنكية</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <button 
                        type="submit"
                        form="payment-method-form"
                        className="px-8 py-4 bg-emerald-600 text-white rounded-[1.25rem] font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50"
                      >
                        {editingMethod ? 'تحديث البيانات' : 'حفظ البيانات'}
                      </button>
                      <button onClick={closeModal} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-50 rounded-full transition-all">
                        <X size={24} />
                      </button>
                   </div>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto custom-scrollbar">
                   <form id="payment-method-form" onSubmit={handleSubmit} className="p-8 md:p-12 space-y-12" dir="rtl">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                       <div className="md:col-span-2">
                         <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 text-right">اسم الطريقة / الخزينة</label>
                         <input
                           required
                           type="text"
                           placeholder="مثال: الخزينة الرئيسية، بنك مصر..."
                           className="w-full px-8 py-5 bg-white border border-slate-100 rounded-[1.5rem] text-xl font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none placeholder:text-slate-300"
                           value={formData.name}
                           onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                         />
                       </div>
 
                       <div>
                         <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 text-right">كود الطريقة / الخزينة</label>
                         <div className="relative group">
                           <Hash className="absolute start-4 top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                           <input
                             required
                             type="text"
                             placeholder="CASH-01"
                             className="w-full px-8 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-mono text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12 tracking-widest"
                             value={formData.code}
                             onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                           />
                         </div>
                       </div>
 
                       <div>
                         <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 text-right">الحساب المحاسبي المرتبط</label>
                         <div className="relative group">
                            <Box className="absolute start-4 top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                            <select
                             required
                             className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12 appearance-none"
                             value={formData.account_id}
                             onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
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
 
                       <div className="md:col-span-2 space-y-8">
                         <div className="p-10 bg-slate-50/50 rounded-[3rem] border border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                               <div>
                                 <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1 text-right">الرصيد الافتتاحي</label>
                                 <div className="relative group">
                                   <Wallet className="absolute start-4 top-4 text-emerald-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                   <input 
                                     type="number" 
                                     className="w-full px-8 py-5 bg-white border border-emerald-100 rounded-[1.5rem] text-3xl font-black text-emerald-600 shadow-sm transition-all focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12"
                                     value={formData.opening_balance}
                                     onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                                   />
                                 </div>
                               </div>
           
                               <div>
                                 <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1 text-right">تاريخ الرصيد</label>
                                 <div className="relative group">
                                   <Calendar className="absolute start-4 top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                   <input 
                                     type="date" 
                                     className="w-full px-8 py-5 bg-white border border-slate-200 rounded-[1.5rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12"
                                     value={formData.opening_balance_date}
                                     onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                                   />
                                 </div>
                               </div>
                            </div>
                         </div>
 
                         {formData.opening_balance !== 0 && (
                           <div className="p-10 bg-emerald-50/50 shadow-sm rounded-[3rem] border border-emerald-100/50 space-y-8 animate-in slide-in-from-top-4 duration-300">
                             <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-white text-emerald-600 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-emerald-500/5">
                                   <Wallet size={28} />
                                </div>
                                <div>
                                   <h4 className="text-xl font-black text-emerald-900 leading-none mb-1 text-right">إعدادات الرصيد الافتتاحي</h4>
                                   <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">موازنة الحساب آلياً</p>
                                </div>
                             </div>
       
                             <div className="space-y-6">
                               <div>
                                 <label className="block text-[10px] font-black text-emerald-700/60 mb-3 uppercase tracking-widest px-1 text-right">حساب الطرف الآخر</label>
                                 <div className="relative group">
                                    <Layers className="absolute start-4 top-4 text-emerald-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                    <select
                                     required
                                     className="w-full px-8 py-4 bg-white border border-emerald-200 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12 appearance-none"
                                     value={formData.counter_account_id}
                                     onChange={(e) => setFormData({ ...formData, counter_account_id: e.target.value })}
                                   >
                                     <option value="">اختر حساب الطرف الآخر...</option>
                                     {accounts.map(account => (
                                       <option key={account.id} value={account.id}>
                                         {account.code} - {account.name}
                                       </option>
                                     ))}
                                   </select>
                                 </div>
                                 <div className="mt-4 flex items-center gap-3 p-5 bg-white/60 rounded-2xl border border-emerald-100">
                                    <AlertCircle size={20} className="text-emerald-500 flex-shrink-0" />
                                    <p className="text-xs font-bold text-emerald-800 leading-tight">سيتم إنشاء قيد يومية آلي لموازنة الرصيد الافتتاحي لهذه الطريقة عند الحفظ.</p>
                                 </div>
                               </div>
                               {formData.counter_account_id && (
                                 <div className="bg-white/80 rounded-[2.5rem] overflow-hidden border border-emerald-100 shadow-inner">
                                   <JournalEntryPreview 
                                     title="معاينة القيد المحاسبي"
                                     items={[
                                       {
                                         account_name: accounts.find(a => a.id === formData.account_id)?.name || 'حساب المصرف/الخزينة',
                                         debit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                         credit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                         description: 'رصيد افتتاحي'
                                       },
                                       {
                                         account_name: accounts.find(a => a.id === formData.counter_account_id)?.name || 'حساب موازنة الرصيد',
                                         debit: formData.opening_balance < 0 ? Math.abs(formData.opening_balance) : 0,
                                         credit: formData.opening_balance > 0 ? formData.opening_balance : 0,
                                         description: `رصيد افتتاحي : ${formData.name}`
                                       }
                                     ]}
                                   />
                                 </div>
                               )}
                             </div>
                           </div>
                         )}
                       </div>
                     </div>
                   </form>
                 </div>
               </div>
 
               {/* Activity Side */}
               {editingMethod && (
                 <div className="hidden lg:flex w-[450px] flex-col bg-slate-50 border-s border-slate-200 overflow-hidden">
                   <div className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                            <History size={20} />
                          </div>
                          <div>
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block leading-none mb-1 text-right">Audit Trail</span>
                             <span className="font-black text-slate-900 text-right block">سجل نشاط الطريقة</span>
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
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setMethodToDelete(null);
            }}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-slate-100 text-center"
          >
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-500/10">
              <Trash2 size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">حذف طريقة السداد؟</h3>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف طريقة السداد هذه؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setMethodToDelete(null);
                }}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
              >
                إلغاء
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-xl shadow-rose-500/20 active:scale-95"
              >
                حذف
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <PageActivityLog 
        isOpen={isActivityLogOpen} 
        onClose={() => {
          setIsActivityLogOpen(false);
          setActivityLogDocumentId(undefined);
        }} 
        category="payment_methods"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
