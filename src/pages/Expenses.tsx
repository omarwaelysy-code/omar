import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ExpenseCategory, Account } from '../types';
import { Search, Plus, Trash2, Edit2, X, Wallet, FileText, Hash, History } from 'lucide-react';
import { dbService } from '../services/dbService';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogDocumentId, setActivityLogDocumentId] = useState<string | undefined>(undefined);

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-40 bg-zinc-100 animate-pulse rounded-3xl" />)
        ) : filteredCategories.map(category => (
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
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`bg-white w-full h-full md:h-auto ${editingCategory ? 'md:max-w-6xl' : 'md:max-w-lg'} md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col`}>
            <div className={`p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
              <h3 className="text-xl font-bold text-zinc-900">{editingCategory ? t('expenses.edit') : t('expenses.add')}</h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-600 p-2 hover:bg-zinc-100 rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <form onSubmit={handleSubmit} className="p-8 space-y-5 flex-1 overflow-y-auto" dir={dir}>
                <div className="space-y-5">
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_code')}</label>
                    <div className="relative">
                      <Hash className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                      <input 
                        required
                        type="text" 
                        className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                        placeholder={language === 'ar' ? 'مثال: EXP-001' : 'e.g., EXP-001'}
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_name')}</label>
                    <input 
                      required
                      type="text" 
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      placeholder={language === 'ar' ? 'مثال: إيجار، كهرباء، رواتب...' : 'e.g., Rent, Electricity, Salaries...'}
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_description')}</label>
                    <textarea 
                      rows={3}
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      placeholder={language === 'ar' ? 'وصف إضافي لبند المصروف...' : 'Additional description for the expense item...'}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-bold text-zinc-700 mb-1 uppercase tracking-tighter ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.form_account')}</label>
                    <select
                      required
                      className={`w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      value={formData.account_id}
                      onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                    >
                      <option value="">{language === 'ar' ? 'اختر الحساب...' : 'Select account...'}</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pt-4 pb-8 md:pb-0 flex flex-col md:flex-row gap-3">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    {editingCategory ? (language === 'ar' ? 'تحديث البيانات' : 'Update Data') : (language === 'ar' ? 'حفظ البند' : 'Save Item')}
                  </button>
                  <button 
                    type="button"
                    onClick={closeModal}
                    className="px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>

              {editingCategory && (
                <div className="hidden md:block w-80 border-r border-zinc-100 bg-zinc-50/30">
                  <InlineActivityLog category="expense_categories" documentId={editingCategory.id} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
