import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Search, Filter, Calendar, User, Layers, Info, MapPin, Camera, FileUp, Smartphone, QrCode, Barcode as BarcodeIcon, PenTool, CheckCircle2, XCircle, Building2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { apiRequest } from '../services/dbService';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'react-qr-code';
import Barcode from 'react-barcode';

import { Operation, OperationField, OperationCategory, Customer, Department, CostCenter } from '../types';

export function Operations() {
  const { t, dir } = useLanguage();
  const { user } = useAuth();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [categories, setCategories] = useState<OperationCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [dynamicFields, setDynamicFields] = useState<OperationField[]>([]);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  
  const [formData, setFormData] = useState<any>({
    customer_id: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    operation_date: new Date().toISOString().split('T')[0],
    status: 'pending',
    department_id: '',
    cost_center_id: '',
    operation_number: ''
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
      const [ops, cats, custs, depts, ccs] = await Promise.all([
        dbService.list<Operation>('operations', companyId),
        dbService.list<OperationCategory>('operation_categories', companyId),
        dbService.list<Customer>('customers', companyId),
        dbService.list<Department>('departments', companyId),
        dbService.list<CostCenter>('cost_centers', companyId)
      ]);
      setOperations(ops);
      setCategories(cats);
      setCustomers(custs);
      setDepartments(depts);
      setCostCenters(ccs);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (categoryId: string) => {
    try {
      console.log('Fetching fields for category:', categoryId);
      const data = await apiRequest<OperationField[]>(`/operation_fields/by-category/${categoryId}`);
      console.log('Fields received from API:', data);
      setDynamicFields(data);
    } catch (error) {
      console.error('Failed to fetch fields:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const customer = customers.find(c => c.id === formData.customer_id);
    
    // Extract dynamic fields
    const field_values = dynamicFields.map(f => ({
      field_id: f.id,
      value: formData[f.id] || formData[f.name] || ''
    }));

    const payload = {
      ...formData,
      company_id: user.company_id,
      customer_name: customer?.name || '',
      category_id: selectedCategory,
      field_values
    };

    try {
      if (editingOperation) {
        await apiRequest(`/operations/complex/${editingOperation.id}`, 'PUT', payload);
        toast.success(t('common.updated_successfully'));
      } else {
        await apiRequest('/operations/complex', 'POST', payload);
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
      operation_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      department_id: '',
      cost_center_id: '',
      operation_number: ''
    });
  };

  const renderDynamicField = (field: OperationField) => {
    const rawValue = formData[field.id] || formData[field.name];
    
    // Normalize value based on type
    let value = rawValue || '';
    
    // Formatting values for specific inputs
    if (field.type === 'date' && value) {
      // Ensure YYYY-MM-DD
      try {
        value = new Date(value).toISOString().split('T')[0];
      } catch (e) { value = ''; }
    } else if (field.type === 'datetime' && value) {
      // Ensure YYYY-MM-DDTHH:mm
      try {
        const d = new Date(value);
        const pad = (n: number) => n.toString().padStart(2, '0');
        value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch (e) { value = ''; }
    } else if (field.type === 'boolean' || field.type === 'checkbox') {
      value = !!rawValue;
    } else if (field.type === 'multi_select' || field.type === 'multiselect') {
      value = Array.isArray(rawValue) ? rawValue : (typeof rawValue === 'string' && rawValue ? rawValue.split(',') : []);
    }

    const onChange = (val: any) => {
      console.log(`[DEBUG] Changing field ${field.name} (${field.type}) to:`, val);
      setFormData((prev: any) => ({ ...prev, [field.id]: val, [field.name]: val }));
    };

    const inputClass = "w-full p-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold text-zinc-900 placeholder:text-zinc-300";

    const labelClass = "block text-xs font-bold text-zinc-500 mb-1.5 ml-1";

    switch (field.type) {
      case 'textarea':
      case 'rich_text':
        return (
          <textarea 
            className={`${inputClass} min-h-[100px] font-medium`} 
            value={value} 
            onChange={e => onChange(e.target.value)} 
            required={field.is_required}
            placeholder={field.description || `أدخل ${field.label}...`}
          />
        );

      case 'number':
      case 'currency':
      case 'percentage':
        return (
          <div className="relative">
            <input 
              type="number" 
              className={inputClass} 
              value={value} 
              onChange={e => onChange(e.target.value)} 
              required={field.is_required} 
              placeholder="0.00"
            />
            {(field.unit || field.type === 'percentage') && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px] font-bold bg-zinc-100 px-2 py-1 rounded">
                {field.unit || (field.type === 'percentage' ? '%' : '')}
              </span>
            )}
          </div>
        );

      case 'email':
        return <input type="email" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} placeholder="example@domain.com" />;
      
      case 'phone':
        return <input type="tel" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} placeholder="+966 5x xxx xxxx" />;
      
      case 'url':
        return <input type="url" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} placeholder="https://..." />;

      case 'date':
        return <input type="date" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />;

      case 'time':
        return <input type="time" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />;

      case 'datetime':
        return <input type="datetime-local" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />;

      case 'select':
        return (
          <div className="relative">
            <select className={`${inputClass} appearance-none`} value={value} onChange={e => onChange(e.target.value)} required={field.is_required}>
              <option value="">اختر...</option>
              {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
              <Layers size={14} />
            </div>
          </div>
        );

      case 'multi_select':
      case 'multiselect':
        return (
          <div className="space-y-2 bg-white p-3 rounded-xl border border-zinc-200">
            {field.options?.map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={(value as string[]).includes(opt)}
                  onChange={e => {
                    const current = value as string[];
                    const next = e.target.checked ? [...current, opt] : current.filter(i => i !== opt);
                    onChange(next);
                  }}
                  className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-bold text-zinc-600 group-hover:text-emerald-700 transition-colors uppercase">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'radio':
        return (
          <div className="flex flex-wrap gap-4 p-2">
            {field.options?.map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="radio" 
                  name={field.id}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  className="w-4 h-4 border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-bold text-zinc-600 group-hover:text-emerald-700 transition-colors">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'boolean':
      case 'checkbox':
        return (
          <label className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors group select-none">
            <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${value ? 'bg-emerald-600' : 'bg-zinc-200'}`}>
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${value ? '-translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-bold text-zinc-700">{field.label}</span>
          </label>
        );

      case 'image':
      case 'file':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-200 rounded-2xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
                {field.type === 'image' ? <Camera className="text-zinc-400 group-hover:text-emerald-500 mb-2" /> : <FileUp className="text-zinc-400 group-hover:text-emerald-500 mb-2" />}
                <span className="text-xs font-bold text-zinc-500">انقر لرفع {field.type === 'image' ? 'صورة' : 'ملف'}</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept={field.type === 'image' ? "image/*" : "*/*"}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        onChange(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              {value && (
                <div className="w-24 h-24 relative group">
                  {field.type === 'image' ? (
                    <img src={value as string} className="w-full h-full object-cover rounded-2xl border border-zinc-100 shadow-sm" alt="Preview" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 rounded-2xl border border-zinc-200">
                      <FileUp size={24} className="text-zinc-400" />
                      <span className="text-[10px] font-bold mt-1 text-zinc-500">ملف مرفق</span>
                    </div>
                  )}
                  <button 
                    onClick={() => onChange('')}
                    className="absolute -top-2 -left-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      case 'qr':
      case 'barcode':
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                className={inputClass} 
                value={value as string} 
                onChange={e => onChange(e.target.value)} 
                required={field.is_required}
                placeholder={field.type === 'qr' ? "رابط أو نص للـ QR..." : "أدخل كود الباركود..."}
              />
              <button 
                type="button"
                onClick={() => {
                  const random = Math.random().toString(36).substring(7).toUpperCase();
                  onChange(random);
                }}
                className="p-3 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm"
              >
                <Smartphone size={20} />
              </button>
            </div>
            {value && (
              <div className="flex justify-center p-4 bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                {field.type === 'qr' ? (
                  <div className="p-3 bg-white">
                    <QRCode value={value as string} size={120} />
                  </div>
                ) : (
                  <Barcode value={value as string} height={50} width={1.5} fontSize={12} />
                )}
              </div>
            )}
          </div>
        );

      case 'signature':
        return (
          <div className="space-y-2">
            <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden group">
              {value ? (
                <div className="relative p-2 h-[150px] flex items-center justify-center">
                  <img src={value as string} alt="Signature" className="max-h-full max-w-full grayscale contrast-125" />
                  <button 
                    onClick={() => onChange('')}
                    className="absolute top-4 left-4 p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors font-bold text-xs"
                  >
                    إعادة التوقيع
                  </button>
                </div>
              ) : (
                <div className="relative overflow-hidden">
                  <SignatureCanvas 
                    penColor='black'
                    canvasProps={{ className: 'w-full h-[150px] cursor-crosshair' }}
                    onEnd={() => {
                      // This is a bit tricky since we need a ref. 
                      // I'll use a hack with a local ref or callback if possible.
                    }}
                    ref={(ref: any) => {
                      if (ref) {
                        (window as any)[`sigpad_${field.id}`] = ref;
                      }
                    }}
                  />
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    <button 
                      type="button"
                      onClick={() => {
                        const canvas = (window as any)[`sigpad_${field.id}`];
                        if (canvas && !canvas.isEmpty()) {
                          onChange(canvas.toDataURL());
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/20 font-bold text-xs hover:bg-emerald-700"
                    >
                      تأكيد
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const canvas = (window as any)[`sigpad_${field.id}`];
                        if (canvas) canvas.clear();
                      }}
                      className="px-4 py-2 bg-zinc-100 text-zinc-500 rounded-xl font-bold text-xs hover:bg-zinc-200"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'gps':
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly
                className={`${inputClass} bg-zinc-50 cursor-default font-mono text-[10px]`} 
                value={value as string} 
                placeholder="إحداثيات الموقع (Lat, Lng)"
              />
              <button 
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    toast.loading('جاري تحديد الموقع...');
                    navigator.geolocation.getCurrentPosition((pos) => {
                      toast.dismiss();
                      onChange(`${pos.coords.latitude}, ${pos.coords.longitude}`);
                      toast.success('تم تحديد الموقع بنجاح');
                    }, (err) => {
                      toast.dismiss();
                      toast.error('فشل تحديد الموقع');
                    });
                  }
                }}
                className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
              >
                <MapPin size={20} />
              </button>
            </div>
          </div>
        );

      case 'country':
      case 'city':
      case 'address':
        return (
          <div className="relative">
            <input 
              type="text" 
              className={inputClass} 
              value={value} 
              onChange={e => onChange(e.target.value)} 
              required={field.is_required} 
              placeholder={`أدخل ${field.label}...`}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300">
              {field.type === 'country' ? <Globe size={16} /> : <Building2 size={16} />}
            </div>
          </div>
        );

      default:
        return (
          <input 
            type="text" 
            className={inputClass} 
            value={value} 
            onChange={e => onChange(e.target.value)} 
            required={field.is_required}
            placeholder={field.description || `أدخل ${field.label}...`}
          />
        );
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">نظام العمليات المرن</h1>
          <p className="text-zinc-500">إدارة المشروعات والعمليات التشغيلية (Construction / Services / Trade)</p>
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
                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl flex flex-col items-center">
                  <Layers size={24} />
                  <span className="text-[10px] font-mono font-bold mt-1 uppercase">{op.operation_number}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={async () => {
                      setEditingOperation(op);
                      setFormData({ ...op });
                      setSelectedCategory(op.category_id);
                      // Fetch current values
                      const values = await apiRequest<any[]>(`/operations/${op.id}/values`);
                      const extraFormData: any = {};
                      values.forEach(v => {
                        extraFormData[v.field_id] = v.value;
                      });
                      setFormData((prev: any) => ({ ...prev, ...extraFormData }));
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={async () => {
                      if (window.confirm(t('common.confirm_delete'))) {
                        await dbService.delete('operations', op.id);
                        fetchInitialData();
                      }
                    }}
                    className="p-2 text-zinc-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-right" dir="rtl">
                <div className="font-bold text-lg text-zinc-900">{op.customer_name || 'بدون اسم عميل'}</div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-xs font-bold ring-1 ring-zinc-200">
                    {categories.find(c => c.id === op.category_id)?.name || 'بدون تصنيف'}
                  </span>
                  {op.department_id && (
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold ring-1 ring-emerald-100">
                      {departments.find(d => d.id === op.department_id)?.name}
                    </span>
                  )}
                  {op.cost_center_id && (
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold ring-1 ring-amber-100">
                      {costCenters.find(c => c.id === op.cost_center_id)?.name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-500 line-clamp-2 min-h-[2.5rem]">
                  {op.description || 'لا يوجد وصف...'}
                </p>

                <div className="pt-4 border-t border-zinc-50 flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-1 font-bold">
                    <Calendar size={14} />
                    <span>{new Date(op.operation_date || op.date).toLocaleDateString(dir === 'rtl' ? 'ar-EG' : 'en-US')}</span>
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
              className="bg-zinc-50 rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl relative my-8 flex flex-col"
            >
              <div className="p-8 bg-white border-b border-zinc-100 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">
                    {editingOperation ? `تعديل العملية: ${formData.operation_number}` : 'تسجيل عملية جديدة'}
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">نظام العمليات المرن المتكامل</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:bg-zinc-50 rounded-full transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <form onSubmit={handleSubmit} className="p-8 space-y-6 text-right" dir="rtl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">الإدارة المختصة</label>
                    <select
                      required
                      value={formData.department_id}
                      onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                      className="w-full p-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[position:left_1rem_center] bg-no-repeat"
                    >
                      <option value="">اختر الإدارة...</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">مركز التكلفة</label>
                    <select
                      required
                      value={formData.cost_center_id}
                      onChange={e => setFormData({ ...formData, cost_center_id: e.target.value })}
                      className="w-full p-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[position:left_1rem_center] bg-no-repeat"
                    >
                      <option value="">اختر مركز التكلفة...</option>
                      {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">العميل</label>
                    <select
                      value={formData.customer_id}
                      onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                      className="w-full p-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[position:left_1rem_center] bg-no-repeat"
                    >
                      <option value="">اختر العميل (اختياري)...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">تصنيف العملية</label>
                    <select
                      required
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="w-full p-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[position:left_1rem_center] bg-no-repeat"
                    >
                      <option value="">حدد نوع العملية لإظهار الحقول...</option>
                      {categories.sort((a,b) => (a.full_path || a.name).localeCompare(b.full_path || b.name)).map(c => (
                        <option key={c.id} value={c.id} disabled={!c.is_final} className={c.is_final ? "font-bold" : "text-zinc-400 italic"}>
                          {c.is_final ? '📄 ' : '📁 '} {c.full_path || c.name} {!c.is_final && '(مستوى رئيسي)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">تاريخ العملية</label>
                    <input
                      type="date"
                      required
                      value={formData.operation_date}
                      onChange={e => setFormData({ ...formData, operation_date: e.target.value, date: e.target.value })}
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
                {dynamicFields.length > 0 && (
                  <div className="bg-zinc-100 p-6 rounded-[2rem] border border-zinc-200">
                    <div className="flex items-center gap-2 mb-4 text-emerald-800">
                      <Info size={16} />
                      <span className="text-sm font-bold">الحقول الديناميكية (Dynamic Specification):</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {dynamicFields.map(field => {
                        try {
                          console.log('Rendering field type:', field.type, 'Field:', field.name);
                          console.log('Field value:', formData[field.id] || formData[field.name]);
                          return (
                            <div key={field.id} id={`field-container-${field.id}`} className={
                              ['textarea', 'rich_text', 'image', 'file', 'signature', 'qr', 'barcode'].includes(field.type) 
                              ? "col-span-full" 
                              : ""
                            }>
                              <label className="block text-xs font-black text-zinc-500 mb-2 mr-1">
                                {field.label} {field.is_required && <span className="text-rose-500">*</span>}
                              </label>
                              {renderDynamicField(field)}
                              {field.description && <p className="mt-1 text-[10px] text-zinc-400 font-medium mr-1">{field.description}</p>}
                            </div>
                          );
                        } catch (e) {
                          console.error('Error rendering dynamic field:', field.name, e);
                          return <div key={field.id} className="text-rose-500 text-xs font-bold p-2 bg-rose-50 rounded-lg">Error rendering {field.label}</div>;
                        }
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-2">وصف العملية / ملاحظات</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full p-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="اكتب وصفاً مفصلاً للعملية..."
                  />
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
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
            </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
