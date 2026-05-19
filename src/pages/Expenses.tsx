import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ExpenseCategory, Account } from '../types';
import { Search, Plus, Trash2, Edit2, X, Wallet, FileText, Hash, History, LayoutGrid, List } from 'lucide-react';
import { dbService } from '../services/dbService';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';
import { useViewPreference } from '../hooks/useViewPreference';

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);
  const [view, setView] = useViewPreference('expenses', 'card');

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
        const fieldsToTrack = [
          { field: 'code', label: 'الكود' },
          { field: 'name', label: 'الاسم' },
          { field: 'description', label: 'الوصف' },
          { field: 'account_name', label: 'الحساب المحاسبي' }
        ];
        await dbService.updateWithLog(
          'expense_categories', 
          editingCategory.id, 
          dataToSave,
          { id: user.id, username: user.username, company_id: user.company_id },
          'تعديل تصنيف مصروفات',
          'expense_categories',
          fieldsToTrack
        );
        showNotification('تم تحديث بيانات تصنيف المصروفات بنجاح', 'success');
      } else {
        await dbService.add('expense_categories', dataToSave);
        await dbService.logActivity(user.id, user.username, user.company_id, 'إضافة تصنيف مصروفات', `إضافة تصنيف جديد: ${formData.name}`, 'expense_categories');
        showNotification('تم إضافة تصنيف المصروفات بنجاح', 'success');
      }
      closeModal();
    } catch (e) {
      console.error(e);
      showNotification('حدث خطأ أثناء حفظ البيانات', 'error');
    }
  };

  const handleDelete = (id: string) => {
    setCategoryToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete || !user) return;
    try {
      const category = categories.find(c => c.id === categoryToDelete);
      await dbService.delete('expense_categories', categoryToDelete);
      await dbService.logActivity(user.id, user.username, user.company_id, 'حذف تصنيف مصروفات', `حذف تصنيف: ${category?.name}`);
      showNotification('تم حذف تصنيف المصروفات بنجاح', 'success');
      setIsDeleteModalOpen(false);
      setCategoryToDelete(null);
    } catch (e: any) {
      console.error(e);
      showNotification(e.message || 'حدث خطأ أثناء حذف تصنيف المصروفات', 'error');
    }
  };

  const openModal = async (category?: ExpenseCategory) => {
    if (category) {
      console.log('[EDIT] Opening edit modal for expense category ID:', category.id);
      try {
        const fullData = await dbService.get<ExpenseCategory>('expense_categories', category.id);
        console.log('[EDIT] Expense category details from API:', fullData);
        
        if (!fullData) throw new Error('Category not found');

        setEditingCategory(fullData);
        setFormData({
          code: fullData.code,
          name: fullData.name,
          description: fullData.description || '',
          account_id: fullData.account_id || ''
        });
        console.log('[EDIT] Form updated with expense category:', fullData.id);
      } catch (error: any) {
        console.error('[EDIT] Error loading expense category:', error);
        showNotification('فشل تحميل بيانات بند المصروف', 'error');
        return;
      }
    } else {
      setEditingCategory(null);
      setFormData({
        code: '',
        name: '',
        description: '',
        account_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500 overflow-hidden" dir={dir}>
      {!isModalOpen && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <Wallet size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 italic serif">{t('expenses.title')}</h2>
              <p className="text-slate-500 font-medium">{t('expenses.subtitle')}</p>
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
            <button 
              onClick={() => openModal()}
              className={`flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50 ${isModalOpen ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Plus size={20} />
              {t('expenses.add')}
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
                  placeholder={t('expenses.search_placeholder')}
                  className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none font-bold text-slate-900 placeholder:text-slate-400 shadow-sm`}
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
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                  {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 animate-pulse rounded-[2.5rem]" />)}
                </div>
              ) : view === 'table' ? (
                <div className="hidden md:block overflow-x-auto h-full">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-100">
                      <tr className="text-slate-500 text-[10px] uppercase font-black tracking-[0.2em]">
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_code')}</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_name')}</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_account')}</th>
                        <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredCategories.map((category) => (
                        <tr 
                          key={category.id} 
                          onClick={() => openModal(category)}
                          className={`hover:bg-emerald-50/40 transition-all group cursor-pointer border-transparent border-x-4 ${editingCategory?.id === category.id ? 'bg-emerald-50 border-emerald-500' : ''}`}
                        >
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <span className="font-mono text-[10px] bg-slate-100 px-3 py-1 rounded-lg text-slate-500 font-black border border-slate-200 group-hover:border-emerald-200 group-hover:text-emerald-600 transition-all">{category.code}</span>
                          </td>
                          <td className={`px-8 py-5 font-black text-slate-900 group-hover:text-emerald-700 transition-colors ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{category.name}</td>
                          <td className={`px-8 py-5 text-slate-500 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{category.account_name}</td>
                          <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                            <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-1 opacity-0 group-hover:opacity-100 transition-all`}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(category.id); }}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                title="حذف"
                              >
                                <Trash2 size={18} />
                              </button>
                              <div className="p-2 text-emerald-400 bg-emerald-50 rounded-xl">
                                {dir === 'rtl' ? <List size={18} /> : <LayoutGrid size={18} />}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {filteredCategories.map(category => (
                    <div 
                      key={category.id} 
                      onClick={() => openModal(category)}
                      className={`p-8 space-y-6 rounded-[2.5rem] border transition-all cursor-pointer group relative overflow-hidden ${editingCategory?.id === category.id ? 'bg-emerald-50 border-emerald-200 shadow-xl shadow-emerald-500/10' : 'bg-slate-50/40 border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 hover:bg-white'}`}
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <div className="flex flex-col gap-2 text-right">
                          <span className="font-mono text-[10px] bg-white px-3 py-1 rounded-lg text-slate-500 font-black w-fit border border-slate-200 group-hover:border-emerald-200 transition-all ms-auto">{category.code}</span>
                          <h4 className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors text-2xl tracking-tighter leading-none">{category.name}</h4>
                        </div>
                        <div className="w-16 h-16 rounded-[1.25rem] bg-white text-emerald-600 flex items-center justify-center border border-slate-100 group-hover:border-emerald-100 group-hover:scale-105 transition-all shadow-sm">
                           <Wallet size={28} />
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-slate-200/50 flex flex-col gap-2 relative z-10 text-right">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{category.account_name}</p>
                         {category.description && (
                           <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{category.description}</p>
                         )}
                      </div>
                    </div>
                  ))}
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
              {/* Form Side */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className={`p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-emerald-500/20">
                       <Wallet size={28} />
                    </div>
                    <div>
                       <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">{editingCategory ? t('expenses.edit') : t('expenses.add')}</h3>
                       <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('expenses.subtitle')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      type="submit"
                      form="expense-form"
                      className="px-8 py-4 bg-emerald-600 text-white rounded-[1.25rem] font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 border border-emerald-500/50"
                    >
                      {editingCategory ? t('common.save') : t('common.add')}
                    </button>
                    <button onClick={closeModal} className="text-slate-300 hover:text-slate-900 p-3 hover:bg-slate-50 rounded-full transition-all">
                      <X size={24} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <form id="expense-form" onSubmit={handleSubmit} className="p-8 md:p-12 space-y-12" dir={dir}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                      <div className="md:col-span-2">
                        <label className={`block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_name')}</label>
                        <input 
                          required
                          type="text" 
                          className="w-full px-8 py-5 bg-white border border-slate-100 rounded-[1.5rem] text-xl font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none placeholder:text-slate-300"
                          placeholder="اسم بند المصروف (مثل: إيجار، رواتب، كهرباء...)"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                      </div>

                      <div className="md:col-span-1">
                        <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_code')}</label>
                        <div className="relative group">
                          <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                          <input 
                            required
                            type="text" 
                            className={`w-full px-8 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] font-mono text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12 tracking-widest`}
                            placeholder="EXP-001"
                            value={formData.code}
                            onChange={(e) => setFormData({...formData, code: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-1 text-right">
                        <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_account')}</label>
                         <div className="relative group">
                           <LayoutGrid className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                           <select
                            required
                            className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.25rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none ps-12 appearance-none"
                            value={formData.account_id}
                            onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                          >
                            <option value="">اختر الحساب المحاسبي المرتبط...</option>
                            {accounts.map(account => (
                              <option key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="md:col-span-2 text-right">
                        <label className={`block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_description')}</label>
                        <textarea 
                          rows={3}
                          className="w-full px-8 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-lg font-black text-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none min-h-[120px]"
                          placeholder="تفاصيل إضافية عن نوع المصروف..."
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                        />
                      </div>
                    </div>
                  </form>
                </div>
              </div>

              {/* Activity Side */}
              {editingCategory && (
                <div className="hidden lg:flex w-[450px] flex-col bg-slate-50 border-s border-slate-200 overflow-hidden">
                  <div className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                     <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                           <History size={20} />
                         </div>
                         <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block leading-none mb-1 text-right">Audit Trail</span>
                            <span className="font-black text-slate-900 text-right block">سجل نشاط البند</span>
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
              setCategoryToDelete(null);
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
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">حذف بند المصروف؟</h3>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف هذا التصنيف نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCategoryToDelete(null);
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
        category="expense_categories"
        documentId={activityLogDocumentId}
      />
    </div>
  );
};
