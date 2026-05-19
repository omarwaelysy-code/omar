import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, History, ChevronRight, ChevronLeft, 
  Wallet, Layers, MapPin, Camera, FileUp, Smartphone, Globe, User, Calendar, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';
import QRCode from 'react-qr-code';
import Barcode from 'react-barcode';
import { toast } from 'react-hot-toast';
import { apiRequest } from '../services/dbService';
import { Operation, OperationField, OperationCategory, Customer, Department, CostCenter } from '../types';
import { PaginationControls } from '../components/PaginationControls';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { PageActivityLog } from '../components/PageActivityLog';
import { InlineActivityLog } from '../components/InlineActivityLog';

export const Operations: React.FC = () => {
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  
  const [operations, setOperations] = useState<Operation[]>([]);
  const [categories, setCategories] = useState<OperationCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(21);
  const [sortBy, setSortBy] = useState('operation_date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [dynamicFields, setDynamicFields] = useState<OperationField[]>([]);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  
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
  }, [user, page, limit, sortBy, sortOrder, searchTerm]);

  useEffect(() => {
    if (selectedCategory) {
      fetchFields(selectedCategory);
    } else {
      setDynamicFields([]);
    }
  }, [selectedCategory]);

  const fetchInitialData = async () => {
    if (!user) return;
    try {
      const companyId = user.company_id || '';
      
      const [cats, custs, depts, ccs, opsResult] = await Promise.all([
        dbService.list<OperationCategory>('operation_categories', companyId),
        dbService.list<Customer>('customers', companyId),
        dbService.list<Department>('departments', companyId),
        dbService.list<CostCenter>('cost_centers', companyId),
        apiRequest<any>(`/operations?company_id=${companyId}&_page=${page}&_limit=${limit}&_sortBy=${sortBy}&_sortOrder=${sortOrder}&_search=${searchTerm}`)
      ]);
      
      setOperations(opsResult.data);
      setTotalRecords(opsResult.total);
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
    let value = rawValue || '';
    
    if (field.type === 'date' && value) {
      try { value = new Date(value).toISOString().split('T')[0]; } catch (e) { value = ''; }
    } else if (field.type === 'datetime' && value) {
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
      setFormData((prev: any) => ({ ...prev, [field.id]: val, [field.name]: val }));
    };

    const inputClass = "w-full p-4 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all font-black text-slate-900 placeholder:text-slate-200 shadow-sm";

    switch (field.type) {
      case 'textarea':
      case 'rich_text':
        return <textarea className={`${inputClass} min-h-[120px]`} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} placeholder={field.description || `أدخل ${field.label}...`} />;
      case 'number':
      case 'currency':
      case 'percentage':
        return (
          <div className="relative group">
            <input type="number" step="0.01" className={`${inputClass} ps-14`} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} placeholder="0.00" />
            <div className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-emerald-400`}><Wallet size={20} /></div>
            {(field.unit || field.type === 'percentage') && (
              <span className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-4 text-slate-400 text-[10px] font-black uppercase tracking-widest`}>{field.unit || (field.type === 'percentage' ? '%' : '')}</span>
            )}
          </div>
        );
      case 'email': return <input type="email" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} placeholder="example@domain.com" />;
      case 'phone': return <input type="tel" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} placeholder="+966 5x xxx xxxx" />;
      case 'date': return <input type="date" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />;
      case 'time': return <input type="time" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />;
      case 'datetime': return <input type="datetime-local" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} />;
      case 'select':
        return (
          <div className="relative group">
            <select className={`${inputClass} appearance-none ps-14`} value={value} onChange={e => onChange(e.target.value)} required={field.is_required}>
              <option value="">اختر...</option>
              {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <div className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors`}><Layers size={20} /></div>
          </div>
        );
      case 'boolean':
      case 'checkbox':
        return (
          <label className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl cursor-pointer hover:bg-emerald-50 transition-all group shadow-sm">
            <div className={`w-12 h-7 flex items-center rounded-full p-1 transition-all ${value ? 'bg-emerald-600' : 'bg-slate-200'}`}>
              <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${value ? (dir === 'rtl' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-black text-slate-700">{field.label}</span>
          </label>
        );
      case 'image':
      case 'file':
        return (
          <div className="space-y-4">
             <div className="flex flex-col items-center justify-center p-8 border-[3px] border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50 cursor-pointer hover:bg-slate-100 hover:border-emerald-200 transition-all group relative">
                {field.type === 'image' ? <Camera size={32} className="text-slate-300 group-hover:text-emerald-500 mb-4" /> : <FileUp size={32} className="text-slate-300 group-hover:text-emerald-500 mb-4" />}
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-600">
                  {value ? (language === 'ar' ? 'تغيير الملف' : 'Change File') : (language === 'ar' ? `رفع ${field.label}` : `Upload ${field.label}`)}
                </span>
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  accept={field.type === 'image' ? "image/*" : "*/*"}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => onChange(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
             </div>
             {value && field.type === 'image' && <img src={value as string} className="max-h-40 mx-auto rounded-2xl shadow-xl border border-slate-100" alt="Preview" />}
          </div>
        );
      case 'qr':
      case 'barcode':
        return (
          <div className="space-y-4">
            <div className="flex gap-3">
              <input type="text" className={inputClass} value={value as string} onChange={e => onChange(e.target.value)} required={field.is_required} placeholder={field.type === 'qr' ? "رابط أو نص..." : "أدخل كود..."} />
              <button 
                type="button" 
                onClick={() => onChange(Math.random().toString(36).substring(7).toUpperCase())}
                className="px-6 bg-slate-100 text-slate-400 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-200 shadow-sm"
              >
                <Smartphone size={20} />
              </button>
            </div>
            {value && (
              <div className="flex justify-center p-6 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl">
                 {field.type === 'qr' ? <QRCode value={value as string} size={150} /> : <Barcode value={value as string} height={60} width={1.8} fontSize={14} />}
              </div>
            )}
          </div>
        );
      case 'signature':
        return (
          <div className="space-y-4">
             <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden group shadow-sm p-4">
                {value ? (
                  <div className="relative h-[180px] flex items-center justify-center bg-slate-50 rounded-[2rem]">
                    <img src={value as string} alt="Signature" className="max-h-full max-w-full mix-blend-multiply" />
                    <button onClick={() => onChange('')} className="absolute top-4 right-4 p-3 bg-white text-emerald-600 rounded-full shadow-lg hover:scale-110 transition-all"><X size={18} /></button>
                  </div>
                ) : (
                  <div className="relative rounded-[2rem] bg-slate-50 border-2 border-slate-100 overflow-hidden">
                    <SignatureCanvas 
                      penColor='black' 
                      canvasProps={{ className: 'w-full h-[180px] cursor-crosshair' }} 
                      ref={(ref: any) => { if (ref) (window as any)[`sigpad_${field.id}`] = ref; }} 
                    />
                    <div className="absolute bottom-4 left-4 right-4 flex gap-3">
                       <button type="button" onClick={() => { const canvas = (window as any)[`sigpad_${field.id}`]; if (canvas && !canvas.isEmpty()) onChange(canvas.toDataURL()); }} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 uppercase tracking-widest">{t('common.save')}</button>
                       <button type="button" onClick={() => { const canvas = (window as any)[`sigpad_${field.id}`]; if (canvas) canvas.clear(); }} className="px-6 py-3 bg-white text-slate-400 rounded-xl font-black text-xs border border-slate-100 uppercase tracking-widest shadow-sm active:scale-95">{t('common.cancel')}</button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        );
      case 'gps':
        return (
          <div className="flex gap-3">
            <input type="text" readOnly className={`${inputClass} bg-slate-50 cursor-default font-mono text-[10px] ps-14`} value={value as string} placeholder="LAT, LNG" />
            <div className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-4 text-emerald-400`}><MapPin size={20} /></div>
            <button 
              type="button" 
              onClick={() => {
                if (navigator.geolocation) {
                  const id = toast.loading('Locating...');
                  navigator.geolocation.getCurrentPosition((pos) => {
                    toast.dismiss(id);
                    onChange(`${pos.coords.latitude}, ${pos.coords.longitude}`);
                    toast.success('Location Captured');
                  }, () => { toast.dismiss(id); toast.error('Failed to locate'); });
                }
              }}
              className="px-6 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95"
            >
              <Globe size={20} />
            </button>
          </div>
        );
      default:
        return <input type="text" className={inputClass} value={value} onChange={e => onChange(e.target.value)} required={field.is_required} placeholder={field.description || `أدخل ${field.label}...`} />;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-700 overflow-hidden" dir={dir}>
      <AnimatePresence mode="wait">
        {!isModalOpen ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden max-w-7xl mx-auto w-full p-4"
          >
            {/* Header - Styled like Discount Settings */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-6 border-b border-slate-100">
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-3 leading-none italic serif">
                  {t('operations.title') || 'نظام العمليات المرن'}
                </h1>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">
                  إدارة المشروعات والعمليات التشغيلية الذكية
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setIsActivityLogOpen(true)} className="w-14 h-14 bg-white text-slate-400 border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-95">
                  <History size={24} />
                </button>
                <button 
                  onClick={() => { resetForm(); setIsModalOpen(true); }}
                  className="group relative px-8 py-4 bg-zinc-900 text-white rounded-[1.5rem] shadow-xl overflow-hidden transition-all hover:bg-zinc-800 active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10 flex items-center gap-3 font-black uppercase tracking-widest text-sm">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    {t('operations.add') || 'عملية جديدة'}
                  </div>
                </button>
              </div>
            </div>

            {/* List Table View - Clean & Spacious */}
            <div className="flex-1 bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col transition-all duration-500">
              <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/20">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors pointer-events-none`} size={24} />
                  <input
                    type="text"
                    placeholder={t('operations.search_placeholder') || 'بحث في العمليات...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-16 pl-6' : 'pl-16 pr-6'} py-4 bg-white border border-slate-100 rounded-[2rem] outline-none font-bold text-slate-900 placeholder:text-slate-300 focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all shadow-inner`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-500">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-black text-[10px] uppercase tracking-[0.3em]">Loading Operations</span>
                  </div>
                ) : operations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-6">
                    <Layers size={64} className="opacity-20" />
                    <p className="font-black uppercase tracking-widest text-sm">No operations found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-10">
                    {operations.map((op) => (
                      <motion.div
                        layout
                        key={op.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -5 }}
                        onClick={async () => {
                          setEditingOperation(op);
                          setFormData({ ...op });
                          setSelectedCategory(op.category_id);
                          const values = await apiRequest<any[]>(`/operations/${op.id}/values`);
                          const extraFormData: any = {};
                          values.forEach(v => { extraFormData[v.field_id] = v.value; });
                          setFormData((prev: any) => ({ ...prev, ...extraFormData }));
                          setIsModalOpen(true);
                        }}
                        className="p-8 space-y-6 rounded-[3rem] border bg-white border-slate-100 hover:border-indigo-200 hover:shadow-2xl transition-all group cursor-pointer relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                           <div className="w-20 h-20 bg-slate-50 rounded-[2rem] shadow-inner border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-indigo-600 transition-all duration-500">
                             <Layers size={32} />
                           </div>
                           <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                             op.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                             op.status === 'in_progress' ? 'bg-amber-50 text-amber-700' :
                             'bg-slate-100 text-slate-400'
                           }`}>
                             {t(`common.status_${op.status}`) || op.status}
                           </span>
                        </div>

                        <div className="space-y-3">
                           <h3 className="text-2xl font-black text-slate-900 italic serif tracking-tighter group-hover:text-indigo-700 transition-colors uppercase line-clamp-1">{op.customer_name || 'Individual Client'}</h3>
                           <div className="flex flex-wrap gap-2">
                              <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-100">
                                 {categories.find(c => c.id === op.category_id)?.name || 'General Operation'}
                              </span>
                           </div>
                           <p className="text-sm text-slate-500 font-medium line-clamp-2 leading-relaxed min-h-[40px]">
                              {op.description || '...'}
                           </p>
                        </div>

                        <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                           <div className="flex items-center gap-2 text-slate-300">
                              <Calendar size={18} />
                              <span className="text-[10px] font-black uppercase tracking-widest">{new Date(op.operation_date || op.date).toLocaleDateString()}</span>
                           </div>
                           <div className="p-3 bg-slate-50 rounded-2xl text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                              {dir === 'rtl' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
                           </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-50 bg-white sticky bottom-0">
                <PaginationControls page={page} limit={limit} total={totalRecords} onPageChange={setPage} onLimitChange={setLimit} />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col space-y-8 overflow-hidden max-w-7xl mx-auto w-full p-4"
          >
            <div className="bg-white flex-1 rounded-[3.5rem] shadow-xl shadow-slate-200/40 flex flex-col md:flex-row overflow-hidden border border-slate-100 transition-all duration-500">
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="p-10 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20">
                  <div className={`flex items-center gap-6 ${dir === 'rtl' ? 'flex-row' : 'flex-row'}`}>
                    <div className="w-16 h-16 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-500/20">
                       <Layers size={32} />
                    </div>
                    <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                       <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1 font-serif italic">
                         {editingOperation ? (language === 'ar' ? 'تعديل العملية' : 'Edit Operation') : (language === 'ar' ? 'عملية جديدة' : 'New Operation')}
                       </h3>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none">{editingOperation?.operation_number || 'SYSTEM FLOW : NEW'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button type="submit" form="op-form" className="px-10 py-5 bg-zinc-900 text-white rounded-[1.5rem] font-black hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">
                       {editingOperation ? t('common.save') : t('common.add')}
                    </button>
                    <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="w-14 h-14 flex items-center justify-center bg-slate-50 text-slate-400 rounded-[1.5rem] hover:bg-rose-50 hover:text-rose-500 transition-all">
                       <X size={28} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-14">
                  <form id="op-form" onSubmit={handleSubmit} className="space-y-16" dir={dir}>
                     {/* Section: Primary */}
                     <div className="space-y-12">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                           <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <User size={24} />
                           </div>
                           <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                              {language === 'ar' ? 'المعلومات الأساسية' : 'Primary Information'}
                           </h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                           <div className="md:col-span-2 space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('common.customer')}</label>
                              <div className="relative group">
                                 <User className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors pointer-events-none`} size={24} />
                                 <select 
                                   value={formData.customer_id} 
                                   onChange={e => setFormData({ ...formData, customer_id: e.target.value })} 
                                   className="w-full pr-16 pl-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all shadow-inner"
                                 >
                                   <option value="">{language === 'ar' ? 'اختر العميل...' : 'Select Customer...'}</option>
                                   {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                 </select>
                              </div>
                           </div>

                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'الإدارة' : 'Department'}</label>
                              <select required value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })} className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-lg font-black appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner">
                                <option value="">Select Department...</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                           </div>

                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'مركز التكلفة' : 'Cost Center'}</label>
                              <select required value={formData.cost_center_id} onChange={e => setFormData({ ...formData, cost_center_id: e.target.value })} className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-lg font-black appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner">
                                <option value="">Select Cost Center...</option>
                                {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                              </select>
                           </div>
                        </div>
                     </div>

                     {/* Section: Category & Date */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                        <div className="space-y-4">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'تصنيف العملية' : 'Category'}</label>
                           <select required value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-lg font-black appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner">
                             <option value="">Select Category...</option>
                             {categories.sort((a,b) => (a.full_path || a.name).localeCompare(b.full_path || b.name)).map(c => (
                               <option key={c.id} value={c.id} disabled={!c.is_final}>{c.full_path || c.name}</option>
                             ))}
                           </select>
                        </div>

                        <div className="space-y-4">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'تاريخ التنفيذ' : 'Operation Date'}</label>
                           <input type="date" required value={formData.operation_date} onChange={e => setFormData({ ...formData, operation_date: e.target.value, date: e.target.value })} className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-lg font-black outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner" />
                        </div>
                     </div>

                     {/* Section: Dynamic */}
                     {dynamicFields.length > 0 && (
                        <div className="space-y-12">
                           <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                                 <Layers size={24} />
                              </div>
                              <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                                 {language === 'ar' ? 'المواصفات الديناميكية' : 'Dynamic Specifications'}
                              </h2>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                              {dynamicFields.map(field => (
                                <div key={field.id} className={['textarea', 'rich_text', 'image', 'file', 'signature', 'qr', 'barcode'].includes(field.type) ? "md:col-span-2" : ""}>
                                  <label className="block text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1">
                                    {field.label} {field.is_required && <span className="text-rose-500">*</span>}
                                  </label>
                                  {renderDynamicField(field)}
                                  {field.description && <p className="mt-3 text-[10px] text-slate-300 font-bold italic px-1 opacity-70 leading-relaxed">{field.description}</p>}
                                </div>
                              ))}
                           </div>
                        </div>
                     )}

                     {/* Section: Status & Notes */}
                     <div className="space-y-12">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                           <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <AlertCircle size={24} />
                           </div>
                           <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                              {language === 'ar' ? 'الحالة والملاحظات' : 'Status & Notes'}
                           </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                           <div className="md:col-span-2 space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'ملاحظات إضافية' : 'Details'}</label>
                              <textarea 
                                value={formData.description} 
                                onChange={e => setFormData({ ...formData, description: e.target.value })} 
                                rows={4} 
                                className="w-full p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] outline-none font-medium text-slate-800 placeholder:text-slate-300 focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner" 
                                placeholder="..." 
                              />
                           </div>
                           <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{language === 'ar' ? 'الحالة الحالية' : 'Execution Status'}</label>
                              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-lg font-black appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-inner">
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                           </div>
                        </div>
                     </div>
                  </form>
                </div>
              </div>

              {/* Activity Log Panel for editing */}
              {editingOperation && (
                <div className="hidden lg:flex w-[400px] flex-col bg-slate-50 border-s border-slate-100 overflow-hidden shadow-inner">
                  <div className="p-10 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 text-right">
                     <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                           <History size={24} />
                         </div>
                         <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">النشاط الأخير</span>
                            <h3 className="font-black text-slate-900 text-lg">سجل التعديلات</h3>
                         </div>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                     <InlineActivityLog category="operations" documentId={editingOperation.id} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageActivityLog category="operations" isOpen={isActivityLogOpen} onClose={() => setIsActivityLogOpen(false)} />
    </div>
  );
};
