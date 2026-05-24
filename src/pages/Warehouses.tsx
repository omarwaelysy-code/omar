import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, MapPin, Phone, User, 
  ChevronRight, ChevronLeft, LayoutGrid, List, Home, Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Warehouse } from '../types';

export function Warehouses() {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'table' | 'card'>('table');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    address: '',
    phone: '',
    storekeeper: '',
    storekeeper_phone: ''
  });

  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (user?.company_id) {
      setLoading(true);
      const unsubscribe = dbService.subscribe<Warehouse>('warehouses', user.company_id, (data) => {
        setWarehouses(data || []);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const generateCode = () => {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `WHS-${randomSuffix}`;
  };

  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    setFormData({
      code: generateCode(),
      name: '',
      description: '',
      address: '',
      phone: '',
      storekeeper: '',
      storekeeper_phone: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setFormData({
      code: wh.code,
      name: wh.name,
      description: wh.description || '',
      address: wh.address || '',
      phone: wh.phone || '',
      storekeeper: wh.storekeeper || '',
      storekeeper_phone: wh.storekeeper_phone || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingWarehouse(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id) return;

    if (!formData.name.trim()) {
      toast.error(language === 'ar' ? 'اسم المخزن مطلوب' : 'Warehouse Name is required');
      return;
    }

    const payload = {
      company_id: user.company_id,
      code: formData.code,
      name: formData.name.trim(),
      description: formData.description.trim(),
      address: formData.address.trim(),
      phone: formData.phone.trim(),
      storekeeper: formData.storekeeper.trim(),
      storekeeper_phone: formData.storekeeper_phone.trim()
    };

    try {
      if (editingWarehouse) {
        await dbService.update('warehouses', editingWarehouse.id, payload);
        toast.success(language === 'ar' ? 'تم تحديث المخزن بنجاح' : 'Warehouse updated successfully');
      } else {
        await dbService.add('warehouses', payload);
        toast.success(language === 'ar' ? 'تمت إضافة المخزن بنجاح' : 'Warehouse created successfully');
      }
      closeModal();
    } catch (error: any) {
      console.error('Error saving warehouse:', error);
      toast.error(language === 'ar' ? 'فشل حفظ المخزن' : 'Failed to save warehouse');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = language === 'ar'
      ? 'هل أنت متأكد من رغبتك في حذف هذا المخزن؟'
      : 'Are you sure you want to delete this warehouse?';
    
    if (window.confirm(confirmMsg)) {
      try {
        await dbService.delete('warehouses', id);
        toast.success(language === 'ar' ? 'تم حذف المخزن بنجاح' : 'Warehouse deleted successfully');
      } catch (error) {
        console.error('Failed to delete warehouse:', error);
        toast.error(language === 'ar' ? 'فشل حذف المخزن' : 'Failed to delete warehouse');
      }
    }
  };

  const filteredWarehouses = warehouses.filter(w => {
    return (w.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
           (w.code || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

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
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-6 border-b border-slate-100">
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-3 leading-none italic serif">
                  {t('warehouses.title') || 'المخازن'}
                </h1>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">
                  {t('warehouses.subtitle') || 'إدارة المخازن'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleOpenCreate}
                  className="group relative px-8 py-4 bg-zinc-900 text-white rounded-[1.5rem] shadow-xl overflow-hidden transition-all hover:bg-zinc-800 active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10 flex items-center gap-3 font-black uppercase tracking-widest text-sm">
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    {t('warehouses.add') || 'إضافة مخزن'}
                  </div>
                </button>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col transition-all duration-500">
              <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/20">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={24} />
                  <input
                    type="text"
                    placeholder={t('warehouses.search_placeholder') || 'بحث بالاسم أو الكود...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-16 pl-6' : 'pl-16 pr-6'} py-4 bg-white border border-slate-100 rounded-[2rem] outline-none font-bold text-slate-900 placeholder:text-slate-300 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 transition-all shadow-inner`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                  <button onClick={() => setView('table')} className={`p-2.5 rounded-xl transition-all ${view === 'table' ? 'bg-zinc-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}><List size={22} /></button>
                  <button onClick={() => setView('card')} className={`p-2.5 rounded-xl transition-all ${view === 'card' ? 'bg-zinc-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={22} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {view === 'table' ? (
                  <div className="overflow-x-auto h-full p-8">
                    <table ref={tableRef} className="w-full">
                      <thead className="bg-slate-50/50 rounded-2xl">
                        <tr className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                          <th className={`px-8 py-6 rounded-s-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('warehouses.column_code') || 'الكود'}</th>
                          <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('warehouses.column_name') || 'اسم المخزن'}</th>
                          <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('warehouses.column_storekeeper') || 'أمين المخزن'}</th>
                          <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('warehouses.column_address') || 'العنوان'}</th>
                          <th className={`px-8 py-6 rounded-e-2xl ${dir === 'rtl' ? 'text-left' : 'text-right'}`}></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {loading ? (
                          <tr><td colSpan={5} className="py-20 text-center"><div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                        ) : filteredWarehouses.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-20 text-center text-slate-400 font-bold">
                              <Home className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                              {language === 'ar' ? 'لم يتم العثور على مخازن' : 'No Warehouses Found'}
                            </td>
                          </tr>
                        ) : (
                          filteredWarehouses.map((wh) => (
                            <tr 
                              key={wh.id} 
                              onClick={() => handleOpenEdit(wh)}
                              className="group cursor-pointer hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="px-8 py-6">
                                <div className="inline-block px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl font-mono text-xs font-bold border border-slate-200 shadow-sm">
                                  {wh.code}
                                </div>
                              </td>
                              <td className="px-8 py-6 font-bold text-slate-900">{wh.name}</td>
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                                  {wh.storekeeper ? (
                                    <>
                                      <User size={16} />
                                      {wh.storekeeper}
                                    </>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                                  {wh.address ? (
                                    <>
                                      <MapPin size={16} />
                                      {wh.address.length > 30 ? wh.address.substring(0, 30) + '...' : wh.address}
                                    </>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </div>
                              </td>
                              <td className={`px-8 py-6 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                                <div className={`flex items-center gap-2 ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
                                  <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(wh); }} className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 hover:shadow-md transition-all">
                                    <Edit size={16} />
                                  </button>
                                  <button onClick={(e) => handleDelete(wh.id, e)} className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-rose-500 flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 hover:shadow-md transition-all">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {loading ? (
                      <div className="col-span-full py-20 text-center"><div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
                    ) : filteredWarehouses.length === 0 ? (
                      <div className="col-span-full py-20 text-center text-slate-400 font-bold">
                        <Home className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        {language === 'ar' ? 'لم يتم العثور على مخازن' : 'No Warehouses Found'}
                      </div>
                    ) : (
                      filteredWarehouses.map((wh) => (
                        <div 
                          key={wh.id}
                          onClick={() => handleOpenEdit(wh)}
                          className="group relative bg-white border border-slate-100 rounded-3xl p-6 hover:shadow-2xl hover:shadow-emerald-900/5 hover:border-emerald-100 transition-all cursor-pointer flex flex-col min-h-[220px]"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="inline-block px-3 py-1.5 bg-slate-50 text-slate-500 rounded-xl font-mono text-xs font-bold border border-slate-200">
                              {wh.code}
                            </div>
                            <button onClick={(e) => handleDelete(wh.id, e)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </div>
                          
                          <h3 className="text-xl font-black text-slate-900 mb-2 truncate">{wh.name}</h3>
                          
                          {wh.description && (
                            <p className="text-slate-500 text-sm font-medium line-clamp-2 mb-4 leading-relaxed flex-1">
                              {wh.description}
                            </p>
                          )}
                          
                          <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-400">
                            {wh.storekeeper ? (
                              <div className="flex items-center gap-1.5">
                                <User size={14} className="text-emerald-500" />
                                <span className="truncate max-w-[120px]">{wh.storekeeper}</span>
                              </div>
                            ) : (
                              <span></span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col bg-white md:rounded-[3.5rem] border-0 md:border md:border-slate-100 shadow-2xl overflow-hidden max-w-5xl mx-auto w-full"
          >
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              <div className="px-10 py-8 bg-zinc-900 flex justify-between items-center relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="absolute -right-20 -top-40 w-80 h-80 bg-emerald-500/20 blur-3xl rounded-full"></div>
                
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-inner">
                    {editingWarehouse ? <Edit className="text-emerald-400" size={28} /> : <Home className="text-emerald-400" size={28} />}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white italic tracking-tighter">
                      {editingWarehouse ? t('warehouses.edit') : t('warehouses.add')}
                    </h2>
                    <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-1">
                      {editingWarehouse ? formData.name : (language === 'ar' ? 'إضافة مخزن جديد لنظام مبيعاتك' : 'Add a new warehouse')}
                    </p>
                  </div>
                </div>
                
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="relative z-10 p-3 rounded-2xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all group"
                >
                  <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 flex flex-col md:flex-row gap-10 custom-scrollbar">
                <div className="w-full md:w-3/5 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                        {t('warehouses.form_code')} <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required 
                        readOnly
                        value={formData.code}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-mono font-bold text-slate-500 cursor-not-allowed focus:outline-none" 
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                        {t('warehouses.form_name')} <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required 
                        value={formData.name} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                        className={`w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-lg font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`} 
                        placeholder={t('warehouses.form_name')}
                      />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                      {t('warehouses.form_description')}
                    </label>
                    <textarea 
                      value={formData.description} 
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                      className={`w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-base font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all min-h-[100px] resize-none ${dir === 'rtl' ? 'text-right' : 'text-left'}`} 
                      placeholder={t('warehouses.form_description')}
                    />
                  </div>
                </div>

                <div className="w-full md:w-2/5 space-y-6">
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                        {t('warehouses.form_address')}
                      </label>
                      <div className="relative">
                        <MapPin size={18} className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} />
                        <input 
                          type="text" 
                          value={formData.address} 
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
                          className={`w-full py-4 ${dir === 'rtl' ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'} bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all`} 
                          placeholder={t('warehouses.form_address')}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                        {t('warehouses.form_phone')}
                      </label>
                      <div className="relative">
                        <Phone size={18} className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} />
                        <input 
                          type="text" 
                          value={formData.phone} 
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                          className={`w-full py-4 ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all`} 
                          dir="ltr"
                          placeholder="e.g. 010..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-sm font-black text-slate-800 border-b border-slate-50 pb-4">
                      {language === 'ar' ? 'بيانات أمين المخزن' : 'Storekeeper Details'}
                    </h3>
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                        {t('warehouses.form_storekeeper')}
                      </label>
                      <div className="relative">
                        <User size={18} className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} />
                        <input 
                          type="text" 
                          value={formData.storekeeper} 
                          onChange={(e) => setFormData({ ...formData, storekeeper: e.target.value })} 
                          className={`w-full py-4 ${dir === 'rtl' ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'} bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all`} 
                          placeholder={t('warehouses.form_storekeeper')}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                        {t('warehouses.form_storekeeper_phone')}
                      </label>
                      <div className="relative">
                        <Phone size={18} className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} />
                        <input 
                          type="text" 
                          value={formData.storekeeper_phone} 
                          onChange={(e) => setFormData({ ...formData, storekeeper_phone: e.target.value })} 
                          className={`w-full py-4 ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all`} 
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-10 py-6 bg-white border-t border-slate-100 flex items-center justify-end gap-4 shrink-0 rounded-b-[3.5rem]">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="px-8 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-[1.5rem] transition-colors uppercase tracking-widest text-xs"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="px-10 py-4 bg-emerald-500 text-white font-black rounded-[1.5rem] shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 hover:shadow-emerald-600/30 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center gap-3"
                >
                  <Plus size={18} />
                  {language === 'ar' ? 'حفظ البيانات' : 'Save Details'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
