import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Search, Filter, Calendar, User, Layers, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { apiRequest } from '../services/dbService';

interface Operation {
  id: string;
  customer_id: string;
  customer_name: string;
  category_id: string;
  description: string;
  date: string;
  status: string;
  created_at: string;
  [key: string]: any; // For dynamic fields
}

interface OperationField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  is_required: boolean;
  options: string[] | null;
}

interface Category {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
}

export function Operations() {
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [dynamicFields, setDynamicFields] = useState<OperationField[]>([]);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  
  const [formData, setFormData] = useState<any>({
    customer_id: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pending'
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchFields(selectedCategory);
    } else {
      setDynamicFields([]);
    }
  }, [selectedCategory]);

  const fetchInitialData = async () => {
    try {
      const companyId = user?.company_id || '';
      const [ops, cats, custs] = await Promise.all([
        dbService.list<Operation>('operations', companyId),
        dbService.list<Category>('operation_categories', companyId),
        dbService.list<Customer>('customers', companyId)
      ]);
      setOperations(ops);
      setCategories(cats);
      setCustomers(custs);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (categoryId: string) => {
    try {
      const data = await apiRequest<OperationField[]>(`/operation_fields/by-category/${categoryId}`);
      setDynamicFields(data);
    } catch (error) {
      console.error('Failed to fetch fields:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const customer = customers.find(c => c.id === formData.customer_id);
    const payload = {
      ...formData,
      company_id: user.company_id,
      customer_name: customer?.name || '',
      category_id: selectedCategory
    };

    try {
      if (editingOperation) {
        await dbService.update('operations', editingOperation.id, payload);
        toast.success(t('common.updated_successfully'));
      } else {
        await dbService.create('operations', payload);
        toast.success(t('common.created_successfully'));
      }
      setIsModalOpen(false);
      resetForm();
      fetchInitialData();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const resetForm = () => {
    setEditingOperation(null);
    setSelectedCategory('');
    setFormData({
      customer_id: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      status: 'pending'
    });
  };

  const renderDynamicField = (field: OperationField) => {
    const value = formData[field.name] || '';
    const onChange = (val: any) => setFormData({ ...formData, [field.name]: val });

    const inputClass = "w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold";

    switch (field.type) {
      case 'number':
        return <input type="number" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />;
      case 'date':
        return <input type="date" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />;
      case 'select':
        return (
          <select className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required}>
            <option value="">{t('common.select')}</option>
            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="w-5 h-5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
            <span className="text-sm text-zinc-600 font-bold">{field.label}</span>
          </div>
        );
      default:
        return <input type="text" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">إدارة العمليات والخدمات</h1>
          <p className="text-zinc-500">متابعة كافة العمليات الخدمية والتشغيلية</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
        >
          <Plus size={20} />
          <span>عملية جديدة</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {operations.map((op) => (
            <motion.div
              layout
              key={op.id}
              className="bg-white border border-zinc-200 rounded-3xl p-6 hover:shadow-xl hover:border-emerald-200 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl">
                  <Layers size={24} />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingOperation(op);
                      setFormData(op);
                      setSelectedCategory(op.category_id);
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button className="p-2 text-zinc-400 hover:text-rose-600 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-right" dir="rtl">
                <div className="font-bold text-lg text-zinc-900">{op.customer_name}</div>
                <div className="inline-flex px-2 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-xs font-medium mb-2">
                  {categories.find(c => c.id === op.category_id)?.name || 'بدون تصنيف'}
                </div>
                <p className="text-sm text-zinc-500 line-clamp-2 min-h-[2.5rem]">
                  {op.description || 'لا يوجد وصف...'}
                </p>

                <div className="pt-4 border-t border-zinc-50 flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>{new Date(op.date).toLocaleDateString(dir === 'rtl' ? 'ar-EG' : 'en-US')}</span>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    op.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    op.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                    'bg-zinc-100 text-zinc-600'
                  }`}>
                    {op.status}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-zinc-50 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative my-8"
            >
              <div className="p-8 bg-white border-b border-zinc-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">
                    {editingOperation ? 'تعديل بيانات العملية' : 'تسجيل عملية جديدة'}
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">أدخل البيانات المطلوبة بدقة للحفاظ على جودة السجلات</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:bg-zinc-50 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 text-right" dir="rtl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">العميل المستفيد</label>
                    <select
                      required
                      value={formData.customer_id}
                      onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                      className="w-full p-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[position:left_1rem_center] bg-no-repeat"
                    >
                      <option value="">اختر العميل...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">نوع العملية (التصنيف)</label>
                    <select
                      required
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="w-full p-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[position:left_1rem_center] bg-no-repeat"
                    >
                      <option value="">حدد نوع العملية...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">تاريخ العملية</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full p-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">حالة التنفيذ</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full p-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                    >
                      <option value="pending">قيد الانتظار</option>
                      <option value="in_progress">جاري العمل</option>
                      <option value="completed">مكتملة</option>
                      <option value="cancelled">ملغاة</option>
                    </select>
                  </div>
                </div>

                {/* DYNAMIC FIELDS SECTION */}
                <AnimatePresence>
                  {dynamicFields.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100"
                    >
                      <div className="flex items-center gap-2 mb-4 text-emerald-800">
                        <Info size={16} />
                        <span className="text-sm font-bold">حقول بيانات مخصصة لهذا التصنيف:</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dynamicFields.map(field => (
                          <div key={field.id}>
                            <label className="block text-[11px] font-bold text-emerald-700 mb-1 ml-1 uppercase">{field.label}</label>
                            {renderDynamicField(field)}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">ملاحظات إضافية (اختياري)</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full p-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="اكتب أي تفاصيل أخرى هنا..."
                  />
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-emerald-600 text-white h-14 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 active:scale-[0.98]"
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-zinc-200 text-zinc-600 h-14 rounded-2xl font-bold hover:bg-zinc-300 transition-all active:scale-[0.98]"
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
