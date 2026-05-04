import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Settings, List, CheckSquare, Type, Hash, Calendar, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface OperationField {
  id: string;
  company_id: string;
  code: string;
  name: string;
  label: string;
  description: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'select' | 'boolean';
  category_id: string | null;
  sort_order: number;
  is_required: boolean;
  options: string[] | null;
  unit: string;
  default_value: string;
}

interface Category {
  id: string;
  name: string;
}

export function OperationFields() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [fields, setFields] = useState<OperationField[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<OperationField | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    label: '',
    description: '',
    type: 'text' as OperationField['type'],
    category_id: '' as string | null,
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
      const [fieldsData, catsData] = await Promise.all([
        dbService.list<OperationField>('operation_fields', user?.company_id || ''),
        dbService.list<Category>('operation_categories', user?.company_id || '')
      ]);
      setFields(fieldsData);
      setCategories(catsData);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      ...formData,
      category_id: formData.category_id || null,
      options: formData.type === 'select' ? formData.options.split(',').map(o => o.trim()).filter(Boolean) : null
    };

    try {
      if (editingField) {
        await dbService.update('operation_fields', editingField.id, payload);
        toast.success(t('common.updated_successfully'));
      } else {
        await dbService.create('operation_fields', {
          ...payload,
          company_id: user.company_id
        });
        toast.success(t('common.created_successfully'));
      }
      setIsModalOpen(false);
      setEditingField(null);
      fetchData();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const getFieldIcon = (type: string) => {
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
                  <td className="px-6 py-4 font-bold text-zinc-900">{field.label}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-zinc-600 text-sm font-bold">
                      {getFieldIcon(field.type)}
                      <span>{field.type} {field.unit && `(${field.unit})`}</span>
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
                          setFormData({
                            code: field.code || '',
                            name: field.name,
                            label: field.label,
                            description: field.description || '',
                            type: field.type,
                            category_id: field.category_id,
                            sort_order: field.sort_order,
                            is_required: field.is_required,
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
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">نوع البيانات</label>
                    <select
                      required
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                    >
                      <option value="text">نص (Text)</option>
                      <option value="number">رقم (Number)</option>
                      <option value="date">تاريخ (Date)</option>
                      <option value="currency">عملة (Currency)</option>
                      <option value="percentage">نسبة مئوية (%)</option>
                      <option value="select">قائمة منسدلة (Dropdown)</option>
                      <option value="boolean">خيار نعم/لا</option>
                    </select>
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
