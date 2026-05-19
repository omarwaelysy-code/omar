import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { PaymentMethod, Account } from '../types';
import { Search, Plus, Trash2, Edit2, X, CreditCard, Wallet, Calendar, Hash, History, Layers, Box, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { JournalEntryPreview } from '../components/JournalEntryPreview';
import { formatNumber } from '../utils/formatUtils';

export const PaymentMethods: React.FC = () => {
  const { user } = useAuth();
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">طرق السداد</h2>
          <p className="text-zinc-500">إدارة الخزائن، الحسابات البنكية، وطرق الدفع المختلفة.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setActivityLogDocumentId(undefined);
              setIsActivityLogOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-600 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all active:scale-95"
            title="سجل النشاط"
          >
            <History size={20} />
            <span className="hidden md:inline">سجل النشاط</span>
          </button>
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            إضافة طريقة سداد جديدة
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="البحث باسم الطريقة أو الكود..."
            className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-44 bg-zinc-100 animate-pulse rounded-3xl" />)
        ) : filteredMethods.map(method => (
          <div key={method.id} className="group bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-300 relative overflow-hidden">
            <div className="relative">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-emerald-500/20">
                  <CreditCard size={24} />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setActivityLogDocumentId(method.id);
                      setIsActivityLogOpen(true);
                    }}
                    className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                    title="سجل النشاط"
                  >
                    <History size={18} />
                  </button>
                  <button onClick={() => openModal(method)} className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(method.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-zinc-900">{method.name}</h3>
                <div className="flex items-center justify-between">
                  <span className="inline-block text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-wider">{method.code}</span>
                  {method.opening_balance_date && (
                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                      <Calendar size={10} />
                      <span>{method.opening_balance_date}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-zinc-900 font-bold pt-3 border-t border-zinc-50 mt-2">
                  <Wallet size={16} className="text-emerald-500" />
                  <span>الرصيد الافتتاحي: {formatNumber(method.opening_balance || 0)} ج.م</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-6" dir="rtl">
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
              className="relative w-full max-w-5xl bg-slate-50 shadow-2xl rounded-[3rem] overflow-hidden flex flex-col md:flex-row max-h-[95vh] border border-white"
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
                  <button onClick={closeModal} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-50 rounded-full transition-all">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10" dir="rtl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 text-right">اسم الطريقة / الخزينة</label>
                        <input
                          required
                          type="text"
                          placeholder="مثال: الخزينة الرئيسية، بنك مصر..."
                          className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none placeholder:text-slate-300"
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
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12 tracking-widest"
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
                            className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12 appearance-none"
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
                        <div className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div>
                                <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1 text-right">الرصيد الافتتاحي</label>
                                <div className="relative group">
                                  <Wallet className="absolute start-4 top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
                                  <input 
                                    type="number" 
                                    className="w-full px-6 py-5 bg-white border border-slate-200 rounded-2xl text-2xl font-black text-emerald-600 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12"
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
                                    className="w-full px-6 py-5 bg-white border border-slate-200 rounded-2xl text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12"
                                    value={formData.opening_balance_date}
                                    onChange={(e) => setFormData({ ...formData, opening_balance_date: e.target.value })}
                                  />
                                </div>
                              </div>
                           </div>
                        </div>

                        {formData.opening_balance !== 0 && (
                          <div className="p-8 bg-emerald-50 shadow-sm rounded-[2.5rem] border border-emerald-100/50 space-y-8 animate-in slide-in-from-top-4 duration-300">
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
                                    className="w-full px-6 py-4 bg-white border border-emerald-200 rounded-2xl text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12 appearance-none"
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
                                <div className="mt-4 flex items-center gap-3 p-4 bg-white/60 rounded-2xl border border-emerald-100">
                                   <AlertCircle size={18} className="text-emerald-500 flex-shrink-0" />
                                   <p className="text-[11px] font-bold text-emerald-800 leading-tight">سيتم إنشاء قيد يومية آلي لموازنة الرصيد الافتتاحي لهذه الطريقة عند الحفظ.</p>
                                </div>
                              </div>
                              {formData.counter_account_id && (
                                <div className="bg-white/80 rounded-[2rem] overflow-hidden border border-emerald-100 shadow-inner">
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

                    {/* Footer Actions */}
                    <div className="pt-12 pb-6 flex gap-4 sticky bottom-0 bg-white/90 backdrop-blur-md z-20">
                      <button 
                        type="submit"
                        className="flex-1 py-5 bg-zinc-900 text-white rounded-[1.5rem] font-black text-xl hover:bg-zinc-800 transition-all shadow-2xl active:scale-95 border border-white/10"
                      >
                        {editingMethod ? 'تحديث البيانات' : 'حفظ طريقة السداد'}
                      </button>
                      <button 
                        type="button"
                        onClick={closeModal}
                        className="px-10 py-5 bg-slate-100 text-slate-500 rounded-[1.5rem] font-black hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Activity Side */}
              {editingMethod && (
                <div className="hidden lg:flex w-[400px] flex-col bg-slate-50 border-s border-slate-200 overflow-hidden">
                  <div className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                     <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                           <History size={20} />
                         </div>
                         <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block leading-none mb-1 text-right">Audit Trail</span>
                            <span className="font-black text-slate-900">سجل نشاط الطريقة</span>
                         </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <InlineActivityLog category="payment_methods" documentId={editingMethod.id} />
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
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-4">تأكيد الحذف</h3>
            <p className="text-zinc-500 mb-6">هل أنت متأكد من رغبتك في حذف طريقة السداد هذه؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setMethodToDelete(null);
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
