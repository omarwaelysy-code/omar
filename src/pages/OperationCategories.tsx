import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Edit2, Trash2, Folder, ChevronRight, ChevronDown, 
  Layers, Hash, Info, ListTree, FolderPlus, CheckCircle2, 
  AlertCircle, Search, RefreshCcw, MoreVertical, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { OperationCategory } from '../types';

export function OperationCategories() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [categories, setCategories] = useState<OperationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<OperationCategory | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    parent_id: null as string | null,
    is_final: false,
    description: ''
  });

  useEffect(() => {
    fetchCategories();
  }, [user]);

  const fetchCategories = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await dbService.list<OperationCategory>('operation_categories', user.company_id);
      // Sort alphabetically for consistency
      setCategories(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      toast.error('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (id: string) => {
    const next = new Set(expandedNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNodes(next);
  };

  const expandAll = () => setExpandedNodes(new Set(categories.map(c => c.id)));
  const collapseAll = () => setExpandedNodes(new Set());

  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    return categories.find(c => c.id === parentId)?.name || '-';
  };

  const currentLevel = useMemo(() => {
    if (!formData.parent_id) return 0;
    const parent = categories.find(c => c.id === formData.parent_id);
    return parent ? (parent.level || 0) + 1 : 0;
  }, [formData.parent_id, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation: Cannot add parent to a child that is marked final (if we were re-parenting)
    // But mainly: if parent is final, cannot add children.
    const parent = categories.find(c => c.id === formData.parent_id);
    if (parent?.is_final) {
      toast.error('لا يمكن إضافة أبناء تحت مستوى نهائي');
      return;
    }

    try {
      const payload = {
        ...formData,
        level: currentLevel,
        company_id: user.company_id,
        // Optional: calculate full_path if needed
        full_path: parent ? `${parent.full_path || parent.name} > ${formData.name}` : formData.name
      };

      if (editingCategory) {
        await dbService.update('operation_categories', editingCategory.id, payload);
        toast.success(t('common.updated_successfully'));
      } else {
        await dbService.create('operation_categories', payload);
        toast.success(t('common.created_successfully'));
      }
      setIsModalOpen(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({ name: '', code: '', parent_id: null, is_final: false, description: '' });
  };

  const handleDelete = async (id: string) => {
    const hasChildren = categories.some(c => c.parent_id === id);
    if (hasChildren) {
      toast.error('لا يمكن حذف تصنيف يحتوي على أبناء. قم بحذف الأبناء أولاً.');
      return;
    }

    if (!window.confirm(t('common.confirm_delete'))) return;
    try {
      await dbService.delete('operation_categories', id);
      toast.success(t('common.deleted_successfully'));
      fetchCategories();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const renderTreeNode = (parentId: string | null = null, level = 0) => {
    const children = categories.filter(c => c.parent_id === parentId);
    
    // Apply search filter if searching
    const filteredChildren = searchTerm 
      ? children.filter(c => 
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          c.code?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : children;

    if (children.length === 0 && parentId !== null) return null;

    return (
      <div className={`${level > 0 ? "mr-4 md:mr-8 border-r-2 border-zinc-100 pr-2 md:pr-4" : ""} space-y-2`}>
        {children.map(category => {
          const isExpanded = expandedNodes.has(category.id);
          const hasChildren = categories.some(c => c.parent_id === category.id);
          
          return (
            <div key={category.id} className="group">
              <div className={`
                flex items-center justify-between p-3 rounded-2xl border transition-all duration-200
                ${category.is_final ? 'bg-emerald-50/30 border-emerald-100 font-bold' : 'bg-white border-zinc-100 hover:border-zinc-300 shadow-sm'}
              `}>
                <div className="flex items-center gap-3 overflow-hidden">
                  <button 
                    onClick={() => toggleNode(category.id)}
                    className={`p-1 rounded-lg transition-colors ${hasChildren ? 'text-zinc-600 hover:bg-zinc-100' : 'text-zinc-300 cursor-default'}`}
                  >
                    {hasChildren ? (isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />) : <div className="w-[18px]" />}
                  </button>
                  
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                    ${category.is_final ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-500'}
                  `}>
                    {category.is_final ? <CheckCircle2 size={20} /> : <Folder size={20} />}
                  </div>

                  <div className="flex flex-col truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 truncate tracking-tight">{category.name}</span>
                      {category.code && (
                        <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded text-[10px] font-mono font-bold uppercase tracking-wider">
                          {category.code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] font-mono text-zinc-400 font-bold">LVL {category.level || 0}</span>
                      {hasChildren && (
                        <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                          <ListTree size={10} />
                          {categories.filter(c => c.parent_id === category.id).length} أبناء
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!category.is_final && !searchTerm && (
                    <button
                      onClick={() => {
                        resetForm();
                        setFormData(prev => ({ ...prev, parent_id: category.id }));
                        setIsModalOpen(true);
                      }}
                      title="إضافة ابن"
                      className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                    >
                      <FolderPlus size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingCategory(category);
                      setFormData({ 
                        name: category.name, 
                        code: category.code || '', 
                        parent_id: category.parent_id,
                        is_final: category.is_final || false,
                        description: category.description || ''
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <AnimatePresence>
                {(isExpanded || (searchTerm && children.length > 0)) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-2"
                  >
                    {renderTreeNode(category.id, level + 1)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-600/20">
            <Layers size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-zinc-900 tracking-tighter">تصنيفات العمليات</h1>
            <p className="text-zinc-500 font-medium">الهيكل التنظيمي للخدمات والعمليات الفنية</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchCategories}
            className="p-3 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all"
            title="تحديث"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 font-bold"
          >
            <Plus size={20} />
            <span>إضافة تصنيف والدي</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-100/50 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="بحث في التصنيفات أو الأكواد..."
            className="w-full pr-10 pl-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button 
            onClick={expandAll}
            className="flex-1 md:flex-none px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 rounded-2xl border border-zinc-100 transition-all"
          >
            توسيع الكل
          </button>
          <button 
            onClick={collapseAll}
            className="flex-1 md:flex-none px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 rounded-2xl border border-zinc-100 transition-all"
          >
            طي الكل
          </button>
        </div>
      </div>

      <div className="bg-zinc-50/50 p-6 rounded-[2.5rem] border border-zinc-100">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-zinc-500 font-bold">جاري تحميل الهيكل التنظيمي...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-24 bg-white border-4 border-dashed border-zinc-100 rounded-[3rem]">
            <div className="w-24 h-24 bg-zinc-50 text-zinc-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Layers size={48} />
            </div>
            <h3 className="text-2xl font-black text-zinc-900">لا يوجد هيكل حالياً</h3>
            <p className="text-zinc-400 max-w-sm mx-auto mt-3 font-medium">ابدأ ببناء الشجرة التنظيمية لعملياتك وخدماتك لتنظيم بياناتك المحاسبية والفنية.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {renderTreeNode()}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 backdrop-blur-md p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 left-6 p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>

              <div className="p-10 border-b border-zinc-50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                    {editingCategory ? <Edit2 size={20} /> : <Plus size={20} />}
                  </div>
                  <h2 className="text-2xl font-black text-zinc-900">
                    {editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
                  </h2>
                </div>
                <p className="text-zinc-500 text-sm font-medium">أدخل البيانات الأساسية للتصنيف داخل الشجرة</p>
              </div>

              <form onSubmit={handleSubmit} className="p-10 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 px-1">
                      <Folder size={14} />
                      اسم التصنيف
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-right"
                      placeholder="مثل: خدمات الشحن"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 px-1">
                      <Hash size={14} />
                      الكود المرجعي
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono font-bold text-right"
                      placeholder="SH-001"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 px-1">
                    <ListTree size={14} />
                    التصنيف الأب
                  </label>
                  <select
                    value={formData.parent_id || ''}
                    onChange={e => setFormData({ ...formData, parent_id: e.target.value || null })}
                    className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-right"
                  >
                    <option value="">بدون (تصنيف والدي - Level 0)</option>
                    {categories
                      .filter(c => c.id !== editingCategory?.id && !c.is_final)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {'—'.repeat(cat.level || 0)} {cat.name} ({cat.code || 'بدون كود'})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-zinc-900 text-sm">مستوى نهائي (Final Level)</h4>
                      <p className="text-zinc-500 text-[10px] font-medium leading-tight">تفعيل هذا الخيار يمنع إضافة أي تصنيفات فرعية تحت هذا العنصر.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={formData.is_final}
                      onChange={(e) => setFormData({ ...formData, is_final: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 px-1">
                    <Info size={14} />
                    المستوى المطبق آلياً
                  </label>
                  <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-between">
                    <span className="font-bold text-zinc-600">المستوى: {currentLevel}</span>
                    <span className="text-xs text-zinc-400 italic">الأب: {getParentName(formData.parent_id)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 text-white h-14 rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20"
                  >
                    حفظ التعديلات
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-zinc-100 text-zinc-600 h-14 rounded-2xl font-black text-lg hover:bg-zinc-200 transition-all"
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
