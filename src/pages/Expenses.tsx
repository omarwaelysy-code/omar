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
                  {t('expenses.title') || 'بنود المصروفات'}
                </h1>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">
                  {t('expenses.subtitle') || 'تنظيم وتصنيف النفقات التشغيلية'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setIsActivityLogOpen(true)} className="w-14 h-14 bg-white text-slate-400 border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm hover:text-rose-600 hover:border-rose-100 transition-all active:scale-95">
                  <History size={24} />
                </button>
                <button 
                  onClick={() => openModal()}
                  className="group relative px-8 py-4 bg-zinc-900 text-white rounded-[1.5rem] shadow-xl overflow-hidden transition-all hover:bg-zinc-800 active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10 flex items-center gap-3 font-black uppercase tracking-widest text-sm">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    {t('expenses.add') || 'بند جديد'}
                  </div>
                </button>
              </div>
            </div>

            {/* List Control */}
            <div className="flex-1 bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col transition-all duration-500">
              <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/20">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-4 text-slate-300 group-focus-within:text-rose-500 transition-colors pointer-events-none`} size={24} />
                  <input
                    type="text"
                    placeholder={t('expenses.search_placeholder') || 'البحث باسم البند أو الكود...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-16 pl-6' : 'pl-16 pr-6'} py-4 bg-white border border-slate-100 rounded-[2rem] outline-none font-bold text-slate-900 placeholder:text-slate-300 focus:ring-8 focus:ring-rose-500/5 focus:border-rose-500/50 transition-all shadow-inner`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {loading ? (
                    <div className="col-span-full py-20 text-center">
                      <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    </div>
                  ) : filteredCategories.map((category) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ y: -5 }}
                      key={category.id}
                      onClick={() => openModal(category)}
                      className="p-8 space-y-6 rounded-[3rem] border bg-white border-slate-100 hover:border-rose-200 hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between">
                         <div className="w-20 h-20 bg-slate-50 rounded-[2rem] shadow-inner border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-rose-600 transition-all duration-500">
                           <Wallet size={32} />
                         </div>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(t('common.confirm_delete'))) {
                                await dbService.delete('expense_categories', category.id);
                                toast.success(t('common.deleted_successfully'));
                              }
                            }} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={20} /></button>
                         </div>
                      </div>

                      <div className="space-y-3">
                         <h3 className="text-2xl font-black text-slate-900 italic serif tracking-tighter group-hover:text-rose-700 transition-colors uppercase line-clamp-1">{category.name}</h3>
                         <span className="inline-block px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">{category.code}</span>
                         <p className="text-sm text-slate-500 font-medium line-clamp-2 leading-relaxed h-[40px]">
                            {category.description || 'لا يوجد وصف متاح لهذا البند...'}
                         </p>
                      </div>

                      <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'ar' ? 'الحساب المطبق' : 'Linked Account'}</p>
                            <p className="text-xs font-black text-slate-600 uppercase tracking-tighter truncate max-w-[150px]">{category.account_name}</p>
                         </div>
                         <div className="p-3 bg-slate-50 rounded-2xl text-slate-300 group-hover:bg-rose-600 group-hover:text-white transition-all">
                            {dir === 'rtl' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
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
                  <div className={`flex items-center gap-6 ${dir === 'rtl' ? 'flex-row' : 'flex-row'}`}>
                    <div className="w-16 h-16 bg-rose-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-rose-500/20">
                       <Wallet size={32} />
                    </div>
                    <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                       <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1 font-serif italic">
                         {editingCategory ? (language === 'ar' ? 'تعديل بند المصروف' : 'Edit Expense') : (language === 'ar' ? 'إضافة بند مصروف' : 'New Expense')}
                       </h3>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none">{editingCategory?.code || 'EXPENSE FLOW : NEW'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button type="submit" form="expense-form" className="px-10 py-5 bg-zinc-900 text-white rounded-[1.5rem] font-black hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">
                       {editingCategory ? t('common.save') : t('common.add')}
                    </button>
                    <button onClick={closeModal} className="w-14 h-14 flex items-center justify-center bg-slate-50 text-slate-400 rounded-[1.5rem] hover:bg-rose-50 hover:text-rose-500 transition-all">
                       <X size={28} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-14">
                  <form id="expense-form" onSubmit={handleSubmit} className="space-y-16" dir={dir}>
                     {/* Base Info Section */}
                     <div className="space-y-12">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                           <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <Layers size={24} />
                           </div>
                           <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                              {language === 'ar' ? 'المعلومات الأساسية' : 'Primary Information'}
                           </h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                           <div className="md:col-span-2 space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'اسم البند' : 'Expense Name'}</label>
                              <input required type="text" placeholder="..." className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-rose-500/5 transition-all shadow-inner" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                           </div>
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'كود البند' : 'Expense Code'}</label>
                              <div className="relative group">
                                <Hash className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300 group-focus-within:text-rose-500 transition-colors`} size={24} />
                                <input required type="text" placeholder="EXP-01" className="w-full pr-16 pl-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] font-mono text-xl font-black text-slate-900 outline-none shadow-inner tracking-widest" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                              </div>
                           </div>
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'الحساب المحاسبي' : 'Linked Account'}</label>
                              <div className="relative group">
                                <Box className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300 group-focus-within:text-rose-500 transition-colors`} size={24} />
                                <select required className="w-full pr-16 pl-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-rose-500/5 transition-all shadow-inner" value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}>
                                  <option value="">Select Account...</option>
                                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                                </select>
                              </div>
                           </div>
                           <div className="md:col-span-2 space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'الوصف' : 'Description'}</label>
                              <textarea placeholder="..." className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black outline-none focus:bg-white focus:ring-8 focus:ring-rose-500/5 transition-all shadow-inner min-h-[150px]" rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                           </div>
                        </div>
                     </div>
                  </form>
                </div>
              </div>

              {/* Activity Side */}
              {editingCategory && (
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
                     <InlineActivityLog category="expense_categories" documentId={editingCategory.id} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageActivityLog category="expense_categories" isOpen={isActivityLogOpen} onClose={() => setIsActivityLogOpen(false)} />
    </div>
  );
};
