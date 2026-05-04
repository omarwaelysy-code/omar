import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  company_id: string;
}

export function OperationCategories() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parent_id: '' as string | null
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await dbService.list<Category>('operation_categories', user?.company_id || '');
      setCategories(data);
    } catch (error) {
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingCategory) {
        await dbService.update('operation_categories', editingCategory.id, {
          ...formData,
          parent_id: formData.parent_id || null
        });
        toast.success(t('common.updated_successfully'));
      } else {
        await dbService.create('operation_categories', {
          ...formData,
          parent_id: formData.parent_id || null,
          company_id: user.company_id
        });
        toast.success(t('common.created_successfully'));
      }
      setIsModalOpen(false);
      setEditingCategory(null);
      setFormData({ name: '', parent_id: null });
      fetchCategories();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('common.confirm_delete'))) return;
    try {
      await dbService.delete('operation_categories', id);
      toast.success(t('common.deleted_successfully'));
      fetchCategories();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const renderCategoryTree = (parentId: string | null = null, level = 0) => {
    const children = categories.filter(c => c.parent_id === parentId);
    if (children.length === 0) return null;

    return (
      <div className={level > 0 ? "mr-6 border-r border-zinc-100 pr-4 mt-2" : ""}>
        {children.map(category => (
          <div key={category.id} className="mb-2">
            <div className="flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-xl hover:border-emerald-300 transition-colors group">
              <div className="flex items-center gap-3">
                <Folder size={18} className="text-zinc-400" />
                <span className="font-medium text-zinc-900">{category.name}</span>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingCategory(category);
                    setFormData({ name: category.name, parent_id: category.parent_id });
                    setIsModalOpen(true);
                  }}
                  className="p-1.5 text-zinc-400 hover:text-emerald-600 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {renderCategoryTree(category.id, level + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">تصنيفات العمليات</h1>
          <p className="text-zinc-500">إدارة الهيكل التنظيمي للعمليات والخدمات</p>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null);
            setFormData({ name: '', parent_id: null });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
        >
          <Plus size={20} />
          <span>إضافة تصنيف</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-500">جاري تحميل التصنيفات...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-20 bg-white border-2 border-dashed border-zinc-200 rounded-3xl">
          <div className="w-16 h-16 bg-zinc-50 text-zinc-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Folder size={32} />
          </div>
          <h3 className="text-lg font-medium text-zinc-900">لا توجد تصنيفات</h3>
          <p className="text-zinc-500 max-w-sm mx-auto mt-2">ابدأ بإضافة تصنيفات لتنظيم عملياتك وحقول البيانات الخاصة بها</p>
        </div>
      ) : (
        renderCategoryTree()
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-xl font-bold text-zinc-900">
                  {editingCategory ? 'تعديل تصنيف' : 'إضافة تصنيف جديد'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">اسم التصنيف</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="مثال: هندسة مدنية، استشارات مالية..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">التصنيف الأب (اختياري)</label>
                  <select
                    value={formData.parent_id || ''}
                    onChange={e => setFormData({ ...formData, parent_id: e.target.value || null })}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="">بدون (تصنيف رئيسي)</option>
                    {categories
                      .filter(c => c.id !== editingCategory?.id)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                </div>
                <div className="flex items-center gap-3 mt-8">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 text-white h-12 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-zinc-100 text-zinc-600 h-12 rounded-xl font-bold hover:bg-zinc-200 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
