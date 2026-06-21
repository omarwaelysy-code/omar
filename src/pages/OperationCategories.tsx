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
import { useNotification } from '../contexts/NotificationContext';
import { OperationCategory } from '../types';

export function OperationCategories() {
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();
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
      showNotification('Failed to fetch categories', 'error');
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
      showNotification('لا يمكن إضافة أبناء تحت مستوى نهائي', 'error');
      return;
    }

    try {
      const payload = {
        ...formData,
        level: currentLevel,
        company_id: user.company_id,
        full_path: parent ? `${parent.full_path || parent.name} > ${formData.name}` : formData.name
      };

      if (editingCategory) {
        await dbService.update('operation_categories', editingCategory.id, payload);
        showNotification(t('common.updated_successfully'), 'success');
      } else {
        await dbService.create('operation_categories', payload);
        showNotification(t('common.created_successfully'), 'success');
      }
      setIsModalOpen(false);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      console.error('Category error:', error);
      showNotification(error.message || 'Operation failed', 'error');
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({ name: '', code: '', parent_id: null, is_final: false, description: '' });
  };

  const handleDelete = async (id: string) => {
    const hasChildren = categories.some(c => c.parent_id === id);
    if (hasChildren) {
      showNotification('لا يمكن حذف تصنيف يحتوي على أبناء. قم بحذف الأبناء أولاً.', 'error');
      return;
    }

    if (!window.confirm(t('common.confirm_delete'))) return;
    try {
      await dbService.delete('operation_categories', id);
      showNotification(t('common.deleted_successfully'), 'success');
      fetchCategories();
    } catch (error: any) {
      showNotification(error.message || 'Delete failed', 'error');
    }
  };

  const renderTreeNode = (parentId: string | null = null, level = 0) => {
    let children = categories.filter(c => c.parent_id === parentId);
    
    if (parentId === null && children.length === 0 && categories.length > 0) {
      children = categories.filter(c => !c.parent_id || !categories.some(pc => pc.id === c.parent_id));
    }

    const filteredChildren = searchTerm 
      ? children.filter(c => 
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          c.code?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : children;

    if (children.length === 0 && parentId !== null) return null;
    if (children.length === 0 && parentId === null && categories.length === 0) return null;

    return (
      <div className={`${level > 0 ? "mr-4 md:mr-8 border-r-2 border-slate-100 pr-2 md:pr-4" : ""} space-y-2`}>
        {(searchTerm ? filteredChildren : children).map(category => {
          const isExpanded = expandedNodes.has(category.id);
          const hasChildren = categories.some(c => c.parent_id === category.id);
          
          return (
            <div key={category.id} className="group">
              <div 
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
                className={`
                  flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 cursor-pointer
                  ${category.is_final ? 'bg-emerald-50/40 border-emerald-100 font-bold hover:bg-emerald-50' : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 shadow-sm'}
                `}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNode(category.id);
                    }}
                    className={`p-1 rounded-lg transition-colors ${hasChildren ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-300 cursor-default'}`}
                  >
                    {hasChildren ? (isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />) : <div className="w-[18px]" />}
                  </button>
                  
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                    ${category.is_final ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-400'}
                  `}>
                    {category.is_final ? <CheckCircle2 size={20} /> : <Folder size={20} />}
                  </div>

                  <div className="flex flex-col truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 truncate tracking-tight">{category.name}</span>
                      {category.code && (
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-[10px] font-mono font-bold uppercase tracking-wider border border-slate-100">
                          {category.code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">LVL {category.level || 0}</span>
                      {hasChildren && (
                        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <ListTree size={10} />
                          {categories.filter(c => c.parent_id === category.id).length} أبناء
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  {!category.is_final && !searchTerm && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resetForm();
                        setFormData(prev => ({ ...prev, parent_id: category.id }));
                        setIsModalOpen(true);
                      }}
                      title="إضافة ابن"
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                    >
                      <FolderPlus size={18} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
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
                    className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(category.id);
                    }}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
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
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-hidden animate-in fade-in duration-500" dir={dir}>
      <AnimatePresence mode="wait">
        {!isModalOpen ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
                  <Layers size={28} />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tighter">{t('operation_categories.title') || 'تصنيفات العمليات'}</h1>
                  <p className="text-slate-500 font-medium">{t('operation_categories.subtitle') || 'الهيكل التنظيمي للخدمات والعمليات الفنية'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={fetchCategories}
                  className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all"
                  title={language === 'ar' ? 'تحديث' : 'Refresh'}
                >
                  <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 font-bold active:scale-95"
                >
                  <Plus size={20} />
                  <span>{t('operation_categories.add_root') || 'إضافة تصنيف رئيسي'}</span>
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4 shrink-0" dir={dir}>
              <div className="relative flex-1 w-full">
                <Search className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
                <input 
                  type="text" 
                  placeholder={t('operation_categories.search_placeholder') || 'بحث في التصنيفات أو الأكواد...'}
                  className={`w-full ${dir === 'rtl' ? 'pr-11 pl-4' : 'pl-11 pr-4'} py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/50 outline-none transition-all font-bold text-slate-900 placeholder:text-slate-400`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button 
                  onClick={expandAll}
                  className="flex-1 md:flex-none px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all active:bg-slate-100"
                >
                  {language === 'ar' ? 'توسيع الكل' : 'Expand All'}
                </button>
                <button 
                  onClick={collapseAll}
                  className="flex-1 md:flex-none px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all active:bg-slate-100"
                >
                  {language === 'ar' ? 'طي الكل' : 'Collapse All'}
                </button>
              </div>
            </div>

            <div className="bg-slate-50/30 p-6 rounded-[2.5rem] border border-slate-100 overflow-y-auto flex-1 pr-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-500 font-bold">{language === 'ar' ? 'جاري تحميل الهيكل التنظيمي...' : 'Loading structure...'}</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-24 bg-white border-2 border-dashed border-slate-200 rounded-[3rem]">
                  <div className="w-24 h-24 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Layers size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">{language === 'ar' ? 'لا يوجد هيكل حالياً' : 'No structure found'}</h3>
                  <p className="text-slate-400 max-w-sm mx-auto mt-3 font-medium px-4">{language === 'ar' ? 'ابدأ ببناء الشجرة التنظيمية لعملياتك وخدماتك لتنظيم بياناتك المحاسبية والفنية.' : 'Start building the categories tree to organize your services and operations.'}</p>
                </div>
              ) : (
                <div className={`max-w-4xl mx-auto ${dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={dir}>
                  {renderTreeNode()}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden max-w-4xl mx-auto w-full p-4"
          >
            <div className="bg-white flex-1 rounded-3xl shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden border border-slate-100 transition-all duration-500">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    {editingCategory ? <Edit2 size={20} /> : <Plus size={20} />}
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {editingCategory ? (language === 'ar' ? 'تعديل التصنيف' : 'Edit Category') : (language === 'ar' ? 'إضافة تصنيف جديد' : 'Add New Category')}
                  </h2>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-955"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10">
                <form onSubmit={handleSubmit} className={`space-y-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={dir}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                        <Folder size={14} />
                        {language === 'ar' ? 'اسم التصنيف' : 'Category Name'}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="premium-input font-bold"
                        placeholder={language === 'ar' ? 'مثل: خدمات الشحن' : 'e.g. Shipping Services'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                        <Hash size={14} />
                        {language === 'ar' ? 'الكود المرجعي' : 'Reference Code'}
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                        className="premium-input font-mono font-bold"
                        placeholder="SH-001"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      <ListTree size={14} />
                      {language === 'ar' ? 'التصنيف الأب' : 'Parent Category'}
                    </label>
                    <select
                      value={formData.parent_id || ''}
                      onChange={e => setFormData({ ...formData, parent_id: e.target.value || null })}
                      className="premium-input font-bold appearance-none"
                    >
                      <option value="">{language === 'ar' ? 'بدون (تصنيف والدي - Level 0)' : 'None (Root Category - Level 0)'}</option>
                      {categories
                        .filter(c => c.id !== editingCategory?.id && !c.is_final)
                        .map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {'—'.repeat(cat.level || 0)} {cat.name} ({cat.code || (language === 'ar' ? 'بدون كود' : 'No Code')})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={20} />
                      </div>
                      <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                        <h4 className="font-bold text-slate-900 text-sm">{language === 'ar' ? 'مستوى نهائي (Final Level)' : 'Final Level'}</h4>
                        <p className="text-slate-500 text-[10px] font-medium leading-tight">{language === 'ar' ? 'تفعيل هذا الخيار يمنع إضافة أي تصنيفات فرعية تحت هذا العنصر.' : 'Activating this option prevents adding any sub-categories under this item.'}</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.is_final}
                        onChange={(e) => setFormData({ ...formData, is_final: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div className={`space-y-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      <Info size={14} />
                      {language === 'ar' ? 'المستوى المطبق آلياً' : 'Level Applied Automatically'}
                    </label>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{language === 'ar' ? `المستوى: ${currentLevel}` : `Level: ${currentLevel}`}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{language === 'ar' ? `الأب: ${getParentName(formData.parent_id)}` : `Parent: ${getParentName(formData.parent_id)}`}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 text-white h-12 rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                    >
                      {t('common.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 bg-zinc-100 text-zinc-600 h-12 rounded-2xl font-bold hover:bg-zinc-200 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
