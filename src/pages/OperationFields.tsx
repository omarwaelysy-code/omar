import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Settings, List, CheckSquare, Type, Hash, Calendar, Layers, Search, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

import { OperationField, OperationCategory } from '../types';
import { FIELD_TYPES, FIELD_CATEGORIES } from '../lib/field-types';

export function OperationFields() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [fields, setFields] = useState<OperationField[]>([]);
  const [categories, setCategories] = useState<OperationCategory[]>([]);
  const [fieldMappings, setFieldMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<OperationField | null>(null);
  const [typeSearch, setTypeSearch] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    label: '',
    description: '',
    type: 'text' as OperationField['type'],
    category_id: '' as string | null, // Keeping for backward compatibility if any
    category_ids: [] as string[], // Multi-select
    sort_order: 0,
    is_required: false,
    options: '' as string,
    unit: '',
    default_value: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [fieldsData, catsData, mappingsData] = await Promise.all([
        dbService.list<OperationField>('operation_fields', user?.company_id || ''),
        dbService.list<OperationCategory>('operation_categories', user?.company_id || ''),
        dbService.list<any>('field_operation_categories', user?.company_id || '')
      ]);
      setFields(fieldsData);
      setCategories(catsData);
      setFieldMappings(mappingsData);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Helper to get categories for a field
  const getFieldCategories = (fieldId: string) => {
    const ids = fieldMappings.filter(m => m.field_id === fieldId).map(m => m.category_id);
    return categories.filter(c => ids.includes(c.id));
  };

  const finalCategories = categories.filter(c => c.is_final);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      ...formData,
      category_id: formData.category_ids[0] || null, // Primary category for old logic
      options: formData.type === 'select' ? formData.options.split(',').map(o => o.trim()).filter(Boolean) : null
    };

    // Remove category_ids from payload as it's not a direct column
    const { category_ids, ...directPayload } = payload;

    try {
      let fieldId = editingField?.id;
      if (editingField) {
        await dbService.update('operation_fields', editingField.id, directPayload);
        toast.success(t('common.updated_successfully'));
        
        // Update many-to-many links
        const oldLinks = fieldMappings.filter(m => m.field_id === editingField.id);
        for (const link of oldLinks) {
          await dbService.delete('field_operation_categories', link.id);
        }
      } else {
        fieldId = await dbService.create('operation_fields', {
          ...directPayload,
          company_id: user.company_id
        });
        toast.success(t('common.created_successfully'));
      }

      // Create new links
      if (fieldId && category_ids && category_ids.length > 0) {
        for (const catId of category_ids) {
          await dbService.create('field_operation_categories', {
            field_id: fieldId,
            category_id: catId,
            company_id: user.company_id
          });
        }
      }

      setIsModalOpen(false);
      setEditingField(null);
      fetchData();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const getFieldIcon = (type: string) => {
    const typeDef = FIELD_TYPES.find(f => f.id === type);
    if (typeDef) {
      const Icon = typeDef.icon;
      return <Icon size={16} />;
    }
    
    // Fallback for old types
    switch (type) {
      case 'text': return <Type size={16} />;
      case 'number': return <Hash size={16} />;
      case 'date': return <Calendar size={16} />;
      case 'select': return <List size={16} />;
      case 'boolean': return <CheckSquare size={16} />;
      case 'currency': return <Hash size={16} className="text-emerald-600" />;
      case 'percentage': return <Type size={16} className="text-amber-600" />;
      default: return <Settings size={16} />;
    }
  };

  const getFieldLabel = (type: string) => {
    const typeDef = FIELD_TYPES.find(f => f.id === type);
    return typeDef ? typeDef.label_ar : type;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">تعريف حقول العمليات</h1>
          <p className="text-zinc-500 dark:text-zinc-400">إدارة الحقول الديناميكية للنظام المرن</p>
        </div>
        <button
          onClick={() => {
            setEditingField(null);
            setFormData({
              code: '',
              name: '',
              label: '',
              description: '',
              type: 'text',
              category_id: null,
              category_ids: [],
              sort_order: 0,
              is_required: false,
              options: '',
              unit: '',
              default_value: ''
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
        >
          <Plus size={20} />
          <span>إضافة تعريف حقل</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 rounded-3xl overflow-hidden overflow-x-auto text-right shadow-premium" dir="rtl">
          <table className="w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-white/5">
              <tr>
                <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400 text-sm">كود/اسم</th>
                <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400 text-sm">العنوان</th>
                <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400 text-sm">النوع/الوحدة</th>
                <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400 text-sm text-center">مطلوب</th>
                <th className="px-6 py-4 font-medium text-zinc-500 dark:text-zinc-400 text-sm">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-white/5">
              {fields.sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0)).map((field) => (
                <tr key={field.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">{field.code || '-'}</div>
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono uppercase">{field.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">{field.label}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {getFieldCategories(field.id).map(cat => (
                        <span key={cat.id} className="text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium border border-blue-100 dark:border-blue-500/20">
                          {cat.full_path || cat.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-sm font-bold">
                      {getFieldIcon(field.type)}
                      <span>{getFieldLabel(field.type)} {field.unit && `(${field.unit})`}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {field.is_required ? (
                      <span className="text-rose-500 text-xs font-bold bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-full">إجباري</span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingField(field);
                          const linkedCatIds = fieldMappings
                            .filter(m => m.field_id === field.id)
                            .map(m => m.category_id);
                          
                          setFormData({
                            code: field.code || '',
                            name: field.name,
                            label: field.label,
                            description: field.description || '',
                            type: field.type,
                            category_id: field.category_id,
                            category_ids: linkedCatIds,
                            sort_order: field.sort_order || 0,
                            is_required: field.is_required || false,
                            options: Array.isArray(field.options) ? field.options.join(', ') : '',
                            unit: field.unit || '',
                            default_value: field.default_value || ''
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-emerald-600 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(t('common.confirm_delete'))) {
                            await dbService.delete('operation_fields', field.id);
                            fetchData();
                          }
                        }}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 md:p-4 transition-all">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[2rem] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {editingField ? 'تعديل تعريف الحقل' : 'إضافة حقل جديد للنظام'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-zinc-50/20 dark:bg-zinc-800/10">
                <form id="fieldForm" onSubmit={handleSubmit} className="space-y-8 text-right" dir="rtl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="block text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">كود الحقل (Unique Code)</label>
                      <input
                        type="text"
                        required
                        value={formData.code}
                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                        className="premium-input font-mono font-bold"
                        placeholder="e.g. F001"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">الاسم لغرض البرمجة (Slug)</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                        className="premium-input font-mono"
                        placeholder="e.g. construction_depth"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">التسمية العربية (Label)</label>
                    <input
                      type="text"
                      required
                      value={formData.label}
                      onChange={e => setFormData({ ...formData, label: e.target.value })}
                      className="premium-input text-lg font-black"
                      placeholder="مثال: المساحة الإجمالية"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">نوع البيانات المتقدم</label>
                      <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-bold">إلزامي</span>
                    </div>
                    
                    {/* Improved Advanced Field Type Selector */}
                    <div className="border border-zinc-200 dark:border-white/5 rounded-[2rem] overflow-hidden focus-within:ring-4 focus-within:ring-brand-primary/5 transition-all bg-white dark:bg-zinc-900 shadow-premium">
                      <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-100 dark:border-white/5 p-4">
                        <div className="relative group">
                          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-primary transition-colors" size={20} />
                          <input
                            type="text"
                            placeholder="ابحث عن نوع الحقل..."
                            value={typeSearch}
                            onChange={(e) => setTypeSearch(e.target.value)}
                            className="w-full pr-12 pl-5 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/5 rounded-2xl focus:outline-none focus:border-brand-primary transition-all text-sm font-bold dark:text-white dark:placeholder:text-zinc-600"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-8 p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {FIELD_CATEGORIES.map(category => {
                          const catTypes = FIELD_TYPES.filter(t => 
                            t.category === category.id && 
                            (t.label_ar.includes(typeSearch) || t.label_en.toLowerCase().includes(typeSearch.toLowerCase()))
                          );

                          if (catTypes.length === 0) return null;

                          return (
                            <div key={category.id} className="space-y-4">
                              <div className={`sticky top-0 z-[5] py-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] ${category.color} border-b border-current/10`}>
                                <category.icon size={16} />
                                <span>{category.label_ar}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                                {catTypes.map(fieldType => {
                                  const Icon = fieldType.icon;
                                  const isSelected = formData.type === fieldType.id;
                                  return (
                                    <button
                                      key={fieldType.id}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, type: fieldType.id as any })}
                                      className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-right group relative ${
                                        isSelected 
                                          ? 'border-brand-primary bg-brand-primary/5 shadow-lg shadow-brand-primary/10' 
                                          : 'border-zinc-50 dark:border-white/5 bg-white dark:bg-zinc-900/40 hover:border-zinc-200 dark:hover:border-white/20 hover:shadow-md'
                                      }`}
                                    >
                                      <div className={`w-12 h-12 flex items-center justify-center shrink-0 rounded-xl transition-all ${
                                        isSelected ? 'bg-brand-primary text-white shadow-glow' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 group-hover:bg-brand-primary/10 group-hover:text-brand-primary'
                                      }`}>
                                        <Icon size={22} />
                                      </div>
                                      <div className="flex-1 min-w-0 pt-1">
                                        <div className="flex items-center justify-between">
                                          <span className={`font-black text-sm tracking-tight ${isSelected ? 'text-brand-primary' : 'text-zinc-900 dark:text-white'}`}>{fieldType.label_ar}</span>
                                          {isSelected && (
                                            <motion.div layoutId="check" className="w-2 h-2 rounded-full bg-brand-primary shadow-glow" />
                                          )}
                                        </div>
                                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold line-clamp-1 mt-1 uppercase tracking-tighter opacity-60 group-hover:opacity-100 transition-opacity">{fieldType.description_ar}</div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Selected Field Type Info */}
                      <AnimatePresence mode="wait">
                        {formData.type && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-zinc-100 dark:border-white/5 p-6 bg-zinc-50/50 dark:bg-zinc-800/50"
                          >
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-[1.5rem] p-5 flex items-start gap-5 shadow-sm">
                              <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-xl shrink-0 flex items-center justify-center shadow-inner">
                                <Info size={24} />
                              </div>
                              <div className="min-w-0 pt-1">
                                <div className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                  مثال الاستخدام: 
                                  <span className="font-mono text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded-lg text-xs">
                                    {FIELD_TYPES.find(t => t.id === formData.type)?.example_ar}
                                  </span>
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-2 leading-relaxed">
                                  {FIELD_TYPES.find(t => t.id === formData.type)?.description_ar}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                      المستويات النهائية المرتبطة (Operation Categories)
                    </label>
                    <div className="p-1 bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/5 rounded-[2rem] overflow-hidden shadow-inner">
                      <div className="max-h-56 overflow-y-auto custom-scrollbar p-3 space-y-2">
                        {finalCategories.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 opacity-30 dark:opacity-10">
                            <Layers size={32} className="mb-2 dark:text-white" />
                            <p className="text-[10px] font-black uppercase tracking-widest dark:text-white">{t('common.no_data_available')}</p>
                          </div>
                        ) : (
                          finalCategories.sort((a, b) => (a.full_path || a.name).localeCompare(b.full_path || b.name)).map(cat => (
                            <label key={cat.id} className={`flex items-center gap-4 p-4 rounded-2xl transition-all cursor-pointer border-2 shadow-sm ${formData.category_ids.includes(cat.id) ? 'bg-brand-primary/5 border-brand-primary' : 'bg-white dark:bg-zinc-900 border-transparent hover:border-zinc-200 dark:hover:border-white/10'}`}>
                              <input 
                                type="checkbox"
                                checked={formData.category_ids.includes(cat.id)}
                                onChange={(e) => {
                                  const next = e.target.checked 
                                    ? [...formData.category_ids, cat.id]
                                    : formData.category_ids.filter(id => id !== cat.id);
                                  setFormData({ ...formData, category_ids: next });
                                }}
                                className="w-6 h-6 rounded-lg text-brand-primary focus:ring-brand-primary border-zinc-300 dark:border-white/10 dark:bg-zinc-800 transition-all cursor-pointer"
                              />
                               <div className="flex-1 min-w-0">
                                <span className="text-sm text-zinc-900 dark:text-white font-black block tracking-tight">
                                  {cat.name}
                                </span>
                                {cat.full_path && (
                                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-tighter block mt-0.5 opacity-60">{cat.full_path}</span>
                                )}
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="block text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">الوحدة (Unit)</label>
                      <input
                        type="text"
                        value={formData.unit}
                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                        className="premium-input font-bold"
                        placeholder="e.g. meter, kg, SAR"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">الترتيب (Sort Order)</label>
                      <input
                        type="number"
                        value={formData.sort_order}
                        onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                        className="premium-input font-mono font-black"
                      />
                    </div>
                  </div>

                  {formData.type === 'select' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1"
                    >
                      <label className="block text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">خيارات القائمة (مفصولة بفاصلة)</label>
                      <input
                        type="text"
                        required
                        value={formData.options}
                        onChange={e => setFormData({ ...formData, options: e.target.value })}
                        className="premium-input font-bold"
                        placeholder="خيار 1, خيار 2, ..."
                      />
                    </motion.div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">وصف الحقل / تعليمات المستخدم</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="premium-input min-h-[100px] resize-none"
                      placeholder="اشرح للموظف كيف يستخدم هذا الحقل..."
                    />
                  </div>

                  <div className="p-6 bg-rose-50/50 dark:bg-rose-500/5 border-2 border-rose-100 dark:border-rose-500/20 rounded-[2rem] group hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
                    <label className="flex items-center gap-4 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.is_required}
                          onChange={e => setFormData({ ...formData, is_required: e.target.checked })}
                          className="w-8 h-8 rounded-xl border-zinc-300 dark:border-white/10 dark:bg-zinc-800 text-rose-500 focus:ring-rose-500 transition-all cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-zinc-900 dark:text-white font-black block tracking-tight">إلزام المستخدم بالإدخال (Required)</span>
                        <span className="text-xs text-rose-600/70 dark:text-rose-400/60 font-bold">لن يسمح النظام بحفظ العملية بدون تعبئة هذا الحقل</span>
                      </div>
                    </label>
                  </div>
                </form>
              </div>

              <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-white/5 shrink-0 flex items-center gap-3">
                <button
                  type="submit"
                  form="fieldForm"
                  className="flex-1 bg-emerald-600 text-white h-14 rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 text-lg"
                >
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-[0.5] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 h-14 rounded-2xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
