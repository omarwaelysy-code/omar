import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, Wallet, History, ChevronRight, ChevronLeft, 
  Layers, Hash, Box, AlertCircle, LayoutGrid, List, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../contexts/NotificationContext';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ExpenseCategory, Account } from '../types';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'card' | 'table'>('card');
  
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
      const validExpenseUsages = ['operating_expense', 'administrative_expense', 'marketing_expense', 'selling_expense', 'financial_expense', 'depreciation_expense'];

      if (!selectedAccount || !validExpenseUsages.includes(selectedAccount.account_usage || '')) {
        showNotification('خطأ: حساب بند المصروف يلزم أن يكون من قسم (قائمة الدخل - مصروفات / إهلاك / فوائد)', 'error');
        return;
      }

      const dataToSave = {
        ...formData,
        account_name: selectedAccount?.name || '',
        company_id: user.company_id
      };

      if (editingCategory) {
        await dbService.update('expense_categories', editingCategory.id, dataToSave);
        showNotification(t('common.updated_successfully'), 'success');
      } else {
        await dbService.add('expense_categories', dataToSave);
        showNotification(t('common.created_successfully'), 'success');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (e) {
      showNotification('حدث خطأ أثناء حفظ البيانات', 'error');
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
                <div className="w-9 h-9 bg-rose-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
                  <Wallet size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black tracking-tight text-slate-900 leading-none">{t('expenses.title') || 'بنود المصروفات'}</h2>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                      {categories.length} {language === 'ar' ? 'بند' : 'items'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">{t('expenses.subtitle') || 'تنظيم وتصنيف النفقات التشغيلية'}</p>
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
                  onClick={() => openModal()}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-lg font-bold text-xs hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                >
                  <Plus size={15} />
                  <span>{t('expenses.add') || 'بند جديد'}</span>
                </button>
              </div>
            </div>

            {/* List Control */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col transition-all duration-300">
              <div className="p-2 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/30">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-2 text-slate-400 group-focus-within:text-rose-500 transition-colors pointer-events-none`} size={15} />
                  <input
                    type="text"
                    placeholder={t('expenses.search_placeholder') || 'البحث باسم البند أو الكود...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-1.5 bg-white border border-slate-200 rounded-lg outline-none font-bold text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-xs`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner w-fit">
                  <button
                    onClick={() => setView('table')}
                    className={`p-1 px-2 rounded-md transition-all flex items-center gap-1 font-bold text-xs ${view === 'table' ? 'bg-white text-rose-600 shadow-xs border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                    title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
                  >
                    <List size={14} />
                    <span className="hidden sm:inline">{language === 'ar' ? 'مسرد' : 'Table'}</span>
                  </button>
                  <button
                    onClick={() => setView('card')}
                    className={`p-1 px-2 rounded-md transition-all flex items-center gap-1 font-bold text-xs ${view === 'card' ? 'bg-white text-rose-600 shadow-xs border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
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
                    <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  </div>
                ) : view === 'card' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 p-3">
                    {filteredCategories.map((category) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={category.id}
                        onClick={() => openModal(category)}
                        className="p-3 space-y-2 rounded-xl border bg-white border-slate-100 hover:border-rose-200 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                           <div className="w-8 h-8 bg-slate-50 rounded-lg shadow-inner border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-rose-600 group-hover:bg-rose-50 transition-all">
                             <Wallet size={16} />
                           </div>
                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(t('common.confirm_delete'))) {
                                  await dbService.delete('expense_categories', category.id);
                                  showNotification(t('common.deleted_successfully'), 'success');
                                }
                              }} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                           </div>
                        </div>

                        <div className="space-y-1">
                           <h3 className="text-sm font-bold text-slate-900 group-hover:text-rose-700 transition-colors line-clamp-1">{category.name}</h3>
                           <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded text-[10px] font-bold border border-slate-200 font-mono">{category.code}</span>
                           <p className="text-[11px] text-slate-400 line-clamp-1 leading-tight">
                              {category.description || 'لا يوجد وصف متاح'}
                           </p>
                        </div>

                        <div className="pt-1.5 border-t border-slate-50 flex items-center justify-between">
                           <div className="space-y-0.5">
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'الحساب' : 'Account'}</p>
                              <p className="text-[11px] font-bold text-slate-700 truncate max-w-[130px]">{category.account_name}</p>
                           </div>
                           <div className="p-1 bg-slate-50 rounded-md text-slate-300 group-hover:bg-rose-600 group-hover:text-white transition-all">
                              {dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                           </div>
                        </div>
                      </motion.div>
                    ))}
                    {filteredCategories.length === 0 && (
                      <div className="col-span-full py-8 text-center text-slate-400 font-bold text-xs">{language === 'ar' ? 'لا توجد بنود مصاريف حالياً' : 'No expenses found.'}</div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto h-full">
                    <table className="w-full text-right border-collapse">
                      <thead className="sticky top-0 bg-white/90 backdrop-blur-md z-10 border-b border-slate-100">
                        <tr className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                          <th className="px-4 py-2">{language === 'ar' ? 'كود البند' : 'Code'}</th>
                          <th className="px-4 py-2">{language === 'ar' ? 'اسم البند' : 'Name'}</th>
                          <th className="px-4 py-2">{language === 'ar' ? 'الحساب المطبق' : 'Linked Account'}</th>
                          <th className="px-4 py-2">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                          <th className="px-4 py-2 text-left">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredCategories.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs italic">{language === 'ar' ? 'لا توجد بنود مصاريف حالياً' : 'No expenses found.'}</td>
                          </tr>
                        ) : filteredCategories.map((category) => (
                          <tr 
                            key={category.id} 
                            className="hover:bg-slate-50/50 transition-colors group cursor-pointer text-xs"
                            onClick={() => openModal(category)}
                          >
                            <td className="px-4 py-2">
                              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold border border-slate-200">{category.code}</span>
                            </td>
                            <td className="px-4 py-2 font-bold text-slate-900">{category.name}</td>
                            <td className="px-4 py-2 text-slate-600 font-medium">{category.account_name}</td>
                            <td className="px-4 py-2 text-slate-400 max-w-xs truncate">{category.description || '-'}</td>
                            <td className="px-4 py-2 text-left" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => openModal(category)}
                                  className="p-1 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                  title={language === 'ar' ? 'تعديل' : 'Edit'}
                                >
                                  <FileText size={14} />
                                </button>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm(t('common.confirm_delete'))) {
                                      await dbService.delete('expense_categories', category.id);
                                      showNotification(t('common.deleted_successfully'), 'success');
                                    }
                                  }}
                                  className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                  title={language === 'ar' ? 'حذف' : 'Delete'}
                                >
                                  <Trash2 size={14} />
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
                    <div className="w-7 h-7 bg-rose-600 text-white rounded-lg flex items-center justify-center shadow-xs">
                       <Wallet size={15} />
                    </div>
                    <div>
                       <h3 className="text-sm font-black text-slate-900 tracking-tight leading-none">
                         {editingCategory ? (language === 'ar' ? 'تعديل بند المصروف' : 'Edit Expense') : (language === 'ar' ? 'إضافة بند مصروف' : 'New Expense')}
                       </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={closeModal} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-200 transition-all active:scale-95 border border-slate-200">
                       {t('common.cancel')}
                    </button>
                    <button type="submit" form="expense-form" className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg font-bold text-xs hover:bg-zinc-800 transition-all active:scale-95 shadow-xs">
                       {editingCategory ? t('common.save') : t('common.add')}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4">
                  <form id="expense-form" onSubmit={handleSubmit} className="space-y-3" dir={dir}>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-right">
                        <div className="sm:col-span-2">
                           <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'اسم البند' : 'Expense Name'}</label>
                           <input required type="text" placeholder="اسم بند المصروف" className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-xs" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'كود البند' : 'Expense Code'}</label>
                           <div className="relative group">
                             <Hash className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={13} />
                             <input required type="text" placeholder="EXP-01" className="w-full pr-7 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-xs" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
                           </div>
                        </div>
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'الحساب المحاسبي' : 'Linked Account'}</label>
                           <div className="relative group">
                             <Box className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400 pointer-events-none`} size={13} />
                             <select required className="w-full pr-7 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 appearance-none outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-xs" value={formData.account_id} onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}>
                               <option value="">{language === 'ar' ? 'اختر الحساب...' : 'Select Account...'}</option>
                               {accounts.filter(a => ['operating_expense', 'administrative_expense', 'marketing_expense', 'selling_expense', 'financial_expense', 'depreciation_expense'].includes(a.account_usage || '')).map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                             </select>
                           </div>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-4">
                           <label className="block text-[10px] font-bold text-slate-500 mb-0.5 uppercase">{language === 'ar' ? 'الوصف' : 'Description'}</label>
                           <textarea placeholder="وصف تفصيلي للبند..." className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-xs min-h-[60px]" rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                     </div>
                  </form>
                </div>
              </div>

              {/* Activity Side */}
              {editingCategory && (
                <div className="hidden lg:flex w-72 flex-col bg-slate-50/70 border-s border-slate-100 overflow-hidden">
                  <div className="p-2.5 border-b border-slate-100 bg-white/60 backdrop-blur-sm sticky top-0 z-10 flex items-center gap-2">
                     <div className="w-6 h-6 bg-white rounded-md shadow-xs flex items-center justify-center text-slate-400">
                       <History size={13} />
                     </div>
                     <span className="font-bold text-slate-900 text-xs">سجل التعديلات</span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
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
