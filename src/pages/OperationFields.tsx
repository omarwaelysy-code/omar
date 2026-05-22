import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Settings, List, CheckSquare, Type, Hash, Calendar, Layers, Search, Info, X } from 'lucide-react';
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
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {!isModalOpen ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">تعريف حقول العمليات</h1>
                <p className="text-slate-500 font-medium">إدارة الحقول الديناميكية للنظام المرن</p>
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
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <Plus size={20} />
                <span className="font-bold">إضافة تعريف حقل</span>
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-y-auto pr-1 text-right shadow-sm" dir="rtl">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-[5]">
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">كود/اسم</th>
                      <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">العنوان</th>
                      <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider">النوع/الوحدة</th>
                      <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider text-center">مطلوب</th>
                      <th className="px-6 py-4 font-bold text-slate-500 text-xs uppercase tracking-wider mr-auto text-left">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fields.sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0)).map((field) => (
                      <tr 
                        key={field.id} 
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
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs text-emerald-600 font-bold">{field.code || '-'}</div>
                          <div className="text-[10px] text-slate-400 font-bold font-mono uppercase">{field.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{field.label}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {getFieldCategories(field.id).map(cat => (
                              <span key={cat.id} className="text-[9px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded font-bold border border-sky-100">
                                {cat.full_path || cat.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-600 text-sm font-bold">
                            {getFieldIcon(field.type)}
                            <span className="text-xs">{getFieldLabel(field.type)} {field.unit && `(${field.unit})`}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {field.is_required ? (
                            <span className="text-emerald-600 text-[10px] font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">إجباري</span>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-left">
                          <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
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
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(t('common.confirm_delete'))) {
                                  await dbService.delete('operation_fields', field.id);
                                  fetchData();
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
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
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingField ? 'تعديل تعريف الحقل' : 'إضافة حقل جديد للنظام'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-950"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <form id="fieldForm" onSubmit={handleSubmit} className="space-y-8 text-right" dir="rtl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">كود الحقل (Unique Code)</label>
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
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">الاسم لغرض البرمجة (Slug)</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                        className="premium-input font-mono text-xs"
                        placeholder="e.g. construction_depth"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">التسمية العربية (Label)</label>
                    <input
                      type="text"
                      required
                      value={formData.label}
                      onChange={e => setFormData({ ...formData, label: e.target.value })}
                      className="premium-input font-bold"
                      placeholder="مثال: المساحة الإجمالية"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">نوع البيانات المتقدم</label>
                      <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-bold">إلزامي</span>
                    </div>
                    
                    <div className="border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-4 focus-within:ring-brand-primary/5 transition-all bg-white shadow-sm">
                      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-100 p-4">
                        <div className="relative group">
                          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors" size={18} />
                          <input
                            type="text"
                            placeholder="ابحث عن نوع الحقل..."
                            value={typeSearch}
                            onChange={(e) => setTypeSearch(e.target.value)}
                            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary transition-all text-sm font-bold text-slate-900 placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6 p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {FIELD_CATEGORIES.map(category => {
                          const catTypes = FIELD_TYPES.filter(t => 
                            t.category === category.id && 
                            (t.label_ar.includes(typeSearch) || t.label_en.toLowerCase().includes(typeSearch.toLowerCase()))
                          );

                          if (catTypes.length === 0) return null;

                          return (
                            <div key={category.id} className="space-y-3">
                              <div className="sticky top-0 z-[5] py-2 bg-white/95 backdrop-blur-sm flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 border-b border-current/10">
                                <category.icon size={14} />
                                <span>{category.label_ar}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {catTypes.map(fieldType => {
                                  const Icon = fieldType.icon;
                                  const isSelected = formData.type === fieldType.id;
                                  return (
                                    <button
                                      key={fieldType.id}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, type: fieldType.id as any })}
                                      className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-right group relative ${
                                        isSelected 
                                          ? 'border-brand-primary bg-brand-primary/5' 
                                          : 'border-slate-50 bg-white hover:border-slate-200 hover:shadow-sm'
                                      }`}
                                    >
                                      <div className={`w-10 h-10 flex items-center justify-center shrink-0 rounded-lg transition-all ${
                                        isSelected ? 'bg-brand-primary text-white shadow-sm' : 'bg-slate-100 text-slate-400 group-hover:bg-brand-primary/10 group-hover:text-brand-primary'
                                      }`}>
                                        <Icon size={18} />
                                      </div>
                                      <div className="flex-1 min-w-0 pt-0.5">
                                        <div className="flex items-center justify-between">
                                          <span className={`font-bold text-xs tracking-tight ${isSelected ? 'text-brand-primary' : 'text-slate-900'}`}>{fieldType.label_ar}</span>
                                          {isSelected && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary shadow-sm" />
                                          )}
                                        </div>
                                        <div className="text-[9px] text-slate-400 font-medium line-clamp-1 mt-0.5 uppercase tracking-tight opacity-70 group-hover:opacity-100 transition-opacity">{fieldType.description_ar}</div>
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
                            className="border-t border-slate-100 p-6 bg-slate-50"
                          >
                            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-4 shadow-sm">
                              <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-lg shrink-0 flex items-center justify-center">
                                <Info size={20} />
                              </div>
                              <div className="min-w-0 pt-0.5">
                                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                  مثال الاستخدام: 
                                  <span className="font-mono text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded-md text-[10px]">
                                    {FIELD_TYPES.find(t => t.id === formData.type)?.example_ar}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium mt-1.5 leading-relaxed">
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
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      المستويات النهائية المرتبطة (Operation Categories)
                    </label>
                    <div className="p-1 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                      <div className="max-h-56 overflow-y-auto custom-scrollbar p-3 space-y-2">
                        {finalCategories.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 opacity-20">
                            <Layers size={32} className="mb-2 text-slate-400" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('common.no_data_available')}</p>
                          </div>
                        ) : (
                          finalCategories.sort((a, b) => (a.full_path || a.name).localeCompare(b.full_path || b.name)).map(cat => (
                            <label key={cat.id} className={`flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer border-2 shadow-sm ${formData.category_ids.includes(cat.id) ? 'bg-brand-primary/5 border-brand-primary' : 'bg-white border-transparent hover:border-slate-100'}`}>
                              <input 
                                type="checkbox"
                                checked={formData.category_ids.includes(cat.id)}
                                onChange={(e) => {
                                  const next = e.target.checked 
                                    ? [...formData.category_ids, cat.id]
                                    : formData.category_ids.filter(id => id !== cat.id);
                                  setFormData({ ...formData, category_ids: next });
                                }}
                                className="w-5 h-5 rounded-md text-brand-primary focus:ring-brand-primary border-slate-200 transition-all cursor-pointer"
                              />
                               <div className="flex-1 min-w-0">
                                <span className="text-sm text-slate-900 font-bold block tracking-tight">
                                  {cat.name}
                                </span>
                                {cat.full_path && (
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight block mt-0.5 opacity-70">{cat.full_path}</span>
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
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">الوحدة (Unit)</label>
                      <input
                        type="text"
                        value={formData.unit}
                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                        className="premium-input font-bold"
                        placeholder="e.g. meter, kg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">الترتيب (Sort Order)</label>
                      <input
                        type="number"
                        value={formData.sort_order}
                        onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                        className="premium-input font-mono font-bold"
                      />
                    </div>
                  </div>

                  {formData.type === 'select' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1"
                    >
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">خيارات القائمة (مفصولة بفاصلة)</label>
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
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">وصف الحقل / تعليمات المستخدم</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="premium-input min-h-[100px] resize-none text-sm"
                      placeholder="اشرح للموظف كيف يستخدم هذا الحقل..."
                    />
                  </div>

                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl group hover:bg-slate-100 transition-colors">
                    <label className="flex items-center gap-4 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.is_required}
                          onChange={e => setFormData({ ...formData, is_required: e.target.checked })}
                          className="w-6 h-6 rounded-lg border-slate-300 text-emerald-500 focus:ring-emerald-500 transition-all cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-slate-900 font-bold block text-sm tracking-tight">إلزام المستخدم بالإدخال (Required)</span>
                        <span className="text-[10px] text-slate-400 font-medium">لن يسمح النظام بحفظ العملية بدون تعبئة هذا الحقل</span>
                      </div>
                    </label>
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
                      إلغاء
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
