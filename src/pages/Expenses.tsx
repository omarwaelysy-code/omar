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
    <div className="space-y-6 animate-in fade-in duration-500" dir={dir}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 italic serif">{t('expenses.title')}</h2>
          <p className="text-zinc-500">{t('expenses.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-900 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-all shadow-sm"
            title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
          >
            <History size={20} />
            <span className="hidden md:inline">{language === 'ar' ? 'سجل النشاط' : 'Activity Log'}</span>
          </button>
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus size={20} />
            {t('expenses.add')}
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-zinc-400`} size={20} />
          <input 
            type="text" 
            placeholder={t('expenses.search_placeholder')}
            className={`w-full ${dir === 'rtl' ? 'pl-10 pr-4' : 'pr-10 pl-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-zinc-100 p-1 rounded-xl">
          <button
            onClick={() => setView('table')}
            className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
          >
            <List size={20} />
          </button>
          <button
            onClick={() => setView('card')}
            className={`p-2 rounded-lg transition-all ${view === 'card' ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
          >
            <LayoutGrid size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-zinc-100 animate-pulse rounded-3xl" />)}
        </div>
      ) : view === 'table' ? (
        <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_code')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_name')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_account')}</th>
                <th className={`px-6 py-4 font-bold ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{t('invoices.column_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredCategories.map((category) => (
                <tr key={category.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded text-zinc-600">{category.code}</span>
                  </td>
                  <td className={`px-6 py-4 font-bold text-zinc-900 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{category.name}</td>
                  <td className={`px-6 py-4 text-zinc-500 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{category.account_name}</td>
                  <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                    <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setActivityLogDocumentId(category.id);
                          setIsActivityLogOpen(true);
                        }}
                        className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                      >
                        <History size={18} />
                      </button>
                      <button 
                        onClick={() => openModal(category)}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(category.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 italic">{language === 'ar' ? 'لا توجد تصنيفات.' : 'No categories found.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map(category => (
            <div key={category.id} className="group bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-300 relative overflow-hidden" dir={dir}>
              <div className="relative">
                <div className={`flex justify-between items-start mb-4 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-900 flex items-center justify-center font-bold text-lg shadow-sm">
                    <Wallet size={24} className="text-emerald-500" />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setActivityLogDocumentId(category.id);
                        setIsActivityLogOpen(true);
                      }}
                      className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                      title={language === 'ar' ? 'سجل النشاط' : 'Activity Log'}
                    >
                      <History size={18} />
                    </button>
                    <button onClick={() => openModal(category)} className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(category.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className={`space-y-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                  <h3 className="text-xl font-bold text-zinc-900">{category.name}</h3>
                  <span className="inline-block text-xs font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded-lg uppercase tracking-wider">{category.code}</span>
                  {category.description && (
                    <p className="text-sm text-zinc-500 line-clamp-2 pt-2">{category.description}</p>
                  )}
                  <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-50">{category.account_name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6" dir={dir}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white shadow-2xl md:rounded-[2.5rem] h-full md:h-auto max-h-[90vh] flex flex-col md:flex-row overflow-hidden border border-zinc-200"
            >
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className={`p-6 md:p-10 border-b border-zinc-50 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-50">
                       <Wallet size={28} />
                    </div>
                    <div>
                       <h3 className="text-3xl font-black text-zinc-900 tracking-tight">{editingCategory ? t('expenses.edit') : t('expenses.add')}</h3>
                       <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">إعدادات المصروفات • بند جديد</p>
                    </div>
                  </div>
                  <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-900 p-3 hover:bg-zinc-50 rounded-2xl transition-all"><X size={24} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <form onSubmit={handleSubmit} className="p-6 md:p-12 space-y-8" dir={dir}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="md:col-span-1">
                        <label className={`block text-[10px] font-black text-zinc-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_code')}</label>
                        <div className="relative group">
                          <Hash className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors`} size={20} />
                          <input 
                            required
                            type="text" 
                            className={`premium-input ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} font-mono font-black h-14`}
                            placeholder="EXP-001"
                            value={formData.code}
                            onChange={(e) => setFormData({...formData, code: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-1">
                        <label className={`block text-[10px] font-black text-zinc-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_name')}</label>
                        <input 
                          required
                          type="text" 
                          className="premium-input font-bold text-lg h-14"
                          placeholder="اسم بند المصروف"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className={`block text-[10px] font-black text-zinc-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_account')}</label>
                        <select
                          required
                          className="premium-input font-bold appearance-none h-14"
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

                      <div className="md:col-span-2">
                        <label className={`block text-[10px] font-black text-zinc-400 mb-2 uppercase tracking-widest px-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_description')}</label>
                        <textarea 
                          rows={3}
                          className="premium-input py-4 font-medium min-h-[100px]"
                          placeholder="تفاصيل إضافية عن نوع المصروف..."
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                        />
                      </div>
                    </div>
                  </form>
                </div>

                <div className="p-6 md:p-10 bg-white border-t border-zinc-50 flex gap-4 sticky bottom-0 z-20">
                  <button 
                    onClick={handleSubmit}
                    className="flex-1 py-5 bg-zinc-900 text-white rounded-[1.5rem] font-black text-xl hover:bg-zinc-800 transition-all shadow-2xl active:scale-95 border border-zinc-800"
                  >
                    {editingCategory ? 'تحديث البيانات' : 'حفظ البند'}
                  </button>
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="px-10 py-5 bg-zinc-50 text-zinc-500 rounded-[1.5rem] font-black text-lg hover:bg-zinc-200 transition-all active:scale-95 border border-zinc-200"
                  >
                    تجاهل
                  </button>
                </div>
              </div>

              {editingCategory && (
                <div className="hidden lg:block w-80 border-s border-zinc-100 bg-zinc-50/30 overflow-hidden flex flex-col">
                   <div className="p-8 border-b border-zinc-100 bg-white/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center shadow-lg">
                          <History size={20} />
                       </div>
                       <div>
                          <h4 className="text-lg font-black text-zinc-900 tracking-tight">سجل الرقابة</h4>
                       </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    <InlineActivityLog category="expense_categories" documentId={editingCategory.id} />
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
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200" dir={dir}>
            <h3 className="text-xl font-bold text-zinc-900 mb-4">{t('common.delete_confirm')}</h3>
            <p className="text-zinc-500 mb-6">{language === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا البند؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this item? This action cannot be undone.'}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCategoryToDelete(null);
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
