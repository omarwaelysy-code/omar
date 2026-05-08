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
          <h1 className="text-2xl font-bold text-zinc-900">تعريف حقول العمليات</h1>
          <p className="text-zinc-500">إدارة الحقول الديناميكية للنظام المرن</p>
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
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden overflow-x-auto text-right" dir="rtl">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="px-6 py-4 font-medium text-zinc-500 text-sm">كود/اسم</th>
                <th className="px-6 py-4 font-medium text-zinc-500 text-sm">العنوان</th>
                <th className="px-6 py-4 font-medium text-zinc-500 text-sm">النوع/الوحدة</th>
                <th className="px-6 py-4 font-medium text-zinc-500 text-sm text-center">مطلوب</th>
                <th className="px-6 py-4 font-medium text-zinc-500 text-sm">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {fields.sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0)).map((field) => (
                <tr key={field.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-mono text-xs text-emerald-600 font-bold">{field.code || '-'}</div>
                    <div className="text-[10px] text-zinc-400 font-mono uppercase">{field.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-zinc-900">{field.label}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {getFieldCategories(field.id).map(cat => (
                        <span key={cat.id} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium border border-blue-100">
                          {cat.full_path || cat.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-zinc-600 text-sm font-bold">
                      {getFieldIcon(field.type)}
                      <span>{getFieldLabel(field.type)} {field.unit && `(${field.unit})`}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {field.is_required ? (
                      <span className="text-rose-500 text-xs font-bold bg-rose-50 px-2 py-0.5 rounded-full">إجباري</span>
                    ) : (
                      <span className="text-zinc-300 text-xs">-</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8"
            >
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-xl font-bold text-zinc-900">
                  {editingField ? 'تعديل تعريف الحقل' : 'إضافة حقل جديد للنظام'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-right" dir="rtl">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">كود الحقل (Unique Code)</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono font-bold"
                      placeholder="e.g. F001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">الاسم لغرض البرمجة (Slug)</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                      placeholder="e.g. construction_depth"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">التسمية العربية (Label)</label>
                    <input
                      type="text"
                      required
                      value={formData.label}
                      onChange={e => setFormData({ ...formData, label: e.target.value })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                      placeholder="مثال: المساحة الإجمالية"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 mb-2">نوع البيانات</label>
                    
                    {/* Advanced Field Type Selector */}
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                          type="text"
                          placeholder="ابحث عن نوع الحقل (مثلاً: رقم، تاريخ، صورة)..."
                          value={typeSearch}
                          onChange={(e) => setTypeSearch(e.target.value)}
                          className="w-full pr-10 pl-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-1 custom-scrollbar">
                        {FIELD_CATEGORIES.map(category => {
                          const catTypes = FIELD_TYPES.filter(t => 
                            t.category === category.id && 
                            (t.label_ar.includes(typeSearch) || t.label_en.toLowerCase().includes(typeSearch.toLowerCase()))
                          );

                          if (catTypes.length === 0) return null;

                          return (
                            <div key={category.id} className="space-y-2">
                              <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${category.color}`}>
                                <category.icon size={14} />
                                <span>{category.label_ar}</span>
                              </div>
                              <div className="grid gap-2">
                                {catTypes.map(fieldType => {
                                  const Icon = fieldType.icon;
                                  const isSelected = formData.type === fieldType.id;
                                  return (
                                    <button
                                      key={fieldType.id}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, type: fieldType.id as any })}
                                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-right group ${
                                        isSelected 
                                          ? 'border-emerald-600 bg-emerald-50 shadow-sm' 
                                          : 'border-zinc-100 bg-white hover:border-emerald-200 hover:bg-zinc-50'
                                      }`}
                                    >
                                      <div className={`p-2 rounded-lg transition-colors ${
                                        isSelected ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'
                                      }`}>
                                        <Icon size={18} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-sm text-zinc-900">{fieldType.label_ar}</span>
                                          {isSelected && (
                                            <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{fieldType.description_ar}</div>
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
                      {formData.type && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-4"
                        >
                          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                            <Info size={20} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-emerald-900">
                              مثال الاستخدام: <span className="font-mono text-emerald-600">{FIELD_TYPES.find(t => t.id === formData.type)?.example_ar}</span>
                            </div>
                            <div className="text-xs text-emerald-700/80 mt-1">
                              {FIELD_TYPES.find(t => t.id === formData.type)?.description_ar}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      المستويات النهائية المرتبطة (Multi-Select Leaf Categories Only)
                    </label>
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl max-h-48 overflow-y-auto space-y-1">
                      {finalCategories.length === 0 ? (
                        <p className="text-zinc-400 text-xs text-center py-4 italic">لا يوجد تصنيفات نهائية متاحة. تأكد من تفعيل "مستوى نهائي" لبعض التصنيفات.</p>
                      ) : (
                        finalCategories.sort((a, b) => (a.full_path || a.name).localeCompare(b.full_path || b.name)).map(cat => (
                          <label key={cat.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-zinc-100">
                            <input 
                              type="checkbox"
                              checked={formData.category_ids.includes(cat.id)}
                              onChange={(e) => {
                                const next = e.target.checked 
                                  ? [...formData.category_ids, cat.id]
                                  : formData.category_ids.filter(id => id !== cat.id);
                                setFormData({ ...formData, category_ids: next });
                              }}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-zinc-700 font-medium">
                              {cat.full_path || cat.name}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">يتم اختيار التصنيفات النهائية فقط. التصنيفات الأب لا تظهر هنا.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">الوحدة (مثل: متر، كجم، $)</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">الترتيب</label>
                    <input
                      type="number"
                      value={formData.sort_order}
                      onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                    />
                  </div>
                </div>

                {formData.type === 'select' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">خيارات القائمة (مفصولة بفاصلة)</label>
                    <input
                      type="text"
                      required
                      value={formData.options}
                      onChange={e => setFormData({ ...formData, options: e.target.value })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                      placeholder="خيار 1, خيار 2..."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">وصف الحقل / تعليمات للمستخدم</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-3 mt-8">
                  <div className="flex-1">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.is_required}
                        onChange={e => setFormData({ ...formData, is_required: e.target.checked })}
                        className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500 transition-all"
                      />
                      <span className="text-zinc-700 font-bold group-hover:text-rose-600 transition-colors">هذا الحقل إجباري</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4">
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
