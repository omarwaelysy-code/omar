import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, Wallet, History, ChevronRight, ChevronLeft, 
  Layers, Hash, Box, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ExpenseCategory, Account } from '../types';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    account_id: ''
  });

  useEffect(() => {
    if (user) {
      const unsub = dbService.subscribe<ExpenseCategory>('expense_categories', user.company_id, setCategories);
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

      if (editingCategory) {
        await dbService.update('expense_categories', editingCategory.id, dataToSave);
        toast.success(t('common.updated_successfully'));
      } else {
        await dbService.add('expense_categories', dataToSave);
        toast.success(t('common.created_successfully'));
      }
      setIsModalOpen(false);
      resetForm();
    } catch (e) {
      toast.error('حدث خطأ أثناء حفظ البيانات');
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      account_id: ''
    });
  };

  const openModal = (category?: ExpenseCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        code: category.code,
        name: category.name,
        description: category.description || '',
        account_id: category.account_id || ''
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

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
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
                <div className="w-14 h-14 bg-rose-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-rose-500/20">
                  <Wallet size={28} />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900 italic serif">{t('expenses.title') || 'بنود المصروفات'}</h2>
                  <p className="text-slate-500 font-medium">{t('expenses.subtitle') || 'تنظيم وتصنيف النفقات التشغيلية'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => setIsActivityLogOpen(true)} className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
                  <History size={20} />
                  <span className="hidden md:inline">{t('common.activity_log')}</span>
                </button>
                <button onClick={() => openModal()} className="flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-xl shadow-rose-500/20 active:scale-95 border border-rose-500/50">
                  <Plus size={20} />
                  {t('expenses.add') || 'بند جديد'}
                </button>
              </div>
            </div>

            {/* List Control */}
            <div className="flex-1 flex flex-col h-full bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden transition-all duration-500">
              <div className="p-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/30">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-3.5 text-slate-400 group-focus-within:text-rose-500 transition-colors pointer-events-none`} size={20} />
                  <input
                    type="text"
                    placeholder={t('expenses.search_placeholder') || 'البحث باسم البند أو الكود...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500/50 outline-none font-bold text-slate-900 placeholder:text-slate-400 shadow-sm`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {loading ? (
                    <div className="col-span-full py-20 text-center text-rose-500">
                      <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <span className="font-black text-xs uppercase tracking-widest">Loading...</span>
                    </div>
                  ) : filteredCategories.map((category) => (
                    <motion.div
                      layout
                      key={category.id}
                      onClick={() => openModal(category)}
                      className="bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-8 hover:shadow-2xl hover:border-rose-200 hover:bg-white transition-all group relative cursor-pointer overflow-hidden"
                    >
                      <div className="flex items-start justify-between mb-8">
                         <div className="w-16 h-16 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-all duration-500">
                           <Wallet size={28} />
                         </div>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(t('common.confirm_delete'))) {
                                await dbService.delete('expense_categories', category.id);
                                toast.success(t('common.deleted_successfully'));
                              }
                            }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-rose-700 transition-colors line-clamp-1">{category.name}</h3>
                         <div className="flex items-center gap-2">
                           <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">{category.code}</span>
                         </div>
                         <p className="text-sm text-slate-500 font-medium line-clamp-2 min-h-[40px] leading-relaxed">
                            {category.description || 'لا يوجد وصف متاح لهذا البند...'}
                         </p>
                      </div>

                      <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الحساب المطبق</span>
                            <span className="text-xs font-bold text-slate-600">{category.account_name}</span>
                         </div>
                         <div className="p-3 bg-white rounded-xl text-slate-300 group-hover:text-rose-600 shadow-sm border border-slate-100 transition-all">
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
                  <div className="w-16 h-16 bg-rose-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-rose-500/30">
                     <Wallet size={32} />
                  </div>
                  <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                     <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2 font-serif italic">
                       {editingCategory ? (language === 'ar' ? 'تعديل بند المصروف' : 'Edit Expense') : (language === 'ar' ? 'إضافة بند مصروف' : 'New Expense')}
                     </h3>
                     <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none">{editingCategory?.code || 'EXPENSE FLOW : NEW'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button type="submit" form="expense-form" className="px-10 py-5 bg-rose-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-rose-700 transition-all shadow-2xl shadow-rose-500/20 active:scale-95 border border-rose-500/50">
                     {editingCategory ? t('common.save') : t('common.add')}
                  </button>
                  <button onClick={closeModal} className="w-14 h-14 flex items-center justify-center bg-slate-100 text-slate-400 rounded-[1.5rem] hover:bg-rose-50 hover:text-rose-500 transition-all active:rotate-90">
                     <X size={28} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <form id="expense-form" onSubmit={handleSubmit} className="p-8 md:p-16 space-y-16" dir={dir}>
                   {/* Base Info Section */}
                   <div className="space-y-10">
                      <div className="flex items-center gap-3">
                         <div className="w-2 h-8 bg-rose-600 rounded-full" />
                         <h4 className="text-xl font-black text-slate-900 tracking-tight uppercase">{language === 'ar' ? 'المعلومات الأساسية' : 'Primary Information'}</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 text-right">
                         <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{language === 'ar' ? 'اسم البند' : 'Expense Name'}</label>
                            <input required type="text" placeholder={language === 'ar' ? 'مثال: إيجار المقر، فواتير الكهرباء' : 'e.g. Rent, Electricity'} className="w-full px-8 py-5 bg-white border border-slate-100 rounded-[1.5rem] text-xl font-black text-slate-900 shadow-sm transition-all outline-none" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                         </div>
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{language === 'ar' ? 'كود البند' : 'Expense Code'}</label>
                            <div className="relative group">
                              <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-rose-500 transition-colors`} size={20} />
                              <input required type="text" placeholder="EXP-01" className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] font-mono text-lg font-black text-slate-900 shadow-sm ps-14 tracking-widest" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                            </div>
                         </div>
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{language === 'ar' ? 'الحساب المحاسبي' : 'Linked Account'}</label>
                            <div className="relative group">
                              <Box className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-rose-500 transition-colors`} size={20} />
                              <select required className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm ps-14 appearance-none" value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}>
                                <option value="">Select Account...</option>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                              </select>
                            </div>
                         </div>
                         <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1">{language === 'ar' ? 'الوصف' : 'Description'}</label>
                            <textarea placeholder={language === 'ar' ? 'أضف تفاصيل إضافية...' : 'Add details...'} className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-lg font-black min-h-[120px]" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                         </div>
                      </div>
                   </div>
                </form>
              </div>
            </div>

            {/* Activity Side */}
            {editingCategory && (
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
                   <InlineActivityLog category="expense_categories" documentId={editingCategory.id} />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <PageActivityLog category="expense_categories" isOpen={isActivityLogOpen} onClose={() => setIsActivityLogOpen(false)} />
    </div>
  );
};
