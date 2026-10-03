import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, MapPin, Phone, User, 
  ChevronRight, ChevronLeft, LayoutGrid, List, Home, Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../contexts/NotificationContext';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Warehouse } from '../types';

export function Warehouses() {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { showNotification } = useNotification();
  
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
      showNotification(language === 'ar' ? 'اسم المخزن مطلوب' : 'Warehouse Name is required', 'error');
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
        showNotification(language === 'ar' ? 'تم تحديث المخزن بنجاح' : 'Warehouse updated successfully', 'success');
      } else {
        await dbService.add('warehouses', payload);
        showNotification(language === 'ar' ? 'تمت إضافة المخزن بنجاح' : 'Warehouse created successfully', 'success');
      }
      closeModal();
    } catch (error: any) {
      console.error('Error saving warehouse:', error);
      showNotification(language === 'ar' ? 'فشل حفظ المخزن' : 'Failed to save warehouse', 'error');
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
        showNotification(language === 'ar' ? 'تم حذف المخزن بنجاح' : 'Warehouse deleted successfully', 'success');
      } catch (error) {
        console.error('Failed to delete warehouse:', error);
        showNotification(language === 'ar' ? 'فشل حذف المخزن' : 'Failed to delete warehouse', 'error');
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
            className="flex-1 flex flex-col space-y-5 overflow-hidden max-w-7xl mx-auto w-full p-4"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1">
                  {t('warehouses.title') || 'المخازن'}
                </h1>
                <p className="text-slate-500 font-medium text-xs">
                  {t('warehouses.subtitle') || 'إدارة المخازن'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleOpenCreate}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-xl shadow-md hover:bg-zinc-800 active:scale-95 transition-all text-xs font-bold flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>{t('warehouses.add') || 'إضافة مخزن'}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all duration-300">
              <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'} top-3 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={18} />
                  <input
                    type="text"
                    placeholder={t('warehouses.search_placeholder') || 'بحث بالاسم أو الكود...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setView('table')} className={`p-1.5 rounded-lg transition-all ${view === 'table' ? 'bg-white text-zinc-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><List size={18} /></button>
                  <button onClick={() => setView('card')} className={`p-1.5 rounded-lg transition-all ${view === 'card' ? 'bg-white text-zinc-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={18} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {view === 'table' ? (
                  <div className="overflow-x-auto h-full p-4">
                    <table ref={tableRef} className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr className="text-slate-500 text-xs font-bold">
                          <th className={`px-4 py-3 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('warehouses.column_code') || 'الكود'}</th>
                          <th className={`px-4 py-3 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('warehouses.column_name') || 'اسم المخزن'}</th>
                          <th className={`px-4 py-3 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('warehouses.column_storekeeper') || 'أمين المخزن'}</th>
                          <th className={`px-4 py-3 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{t('warehouses.column_address') || 'العنوان'}</th>
                          <th className={`px-4 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading ? (
                          <tr><td colSpan={5} className="py-12 text-center"><div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                        ) : filteredWarehouses.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 font-bold text-sm">
                              <Home className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                              {language === 'ar' ? 'لم يتم العثور على مخازن' : 'No Warehouses Found'}
                            </td>
                          </tr>
                        ) : (
                          filteredWarehouses.map((wh) => (
                            <tr 
                              key={wh.id} 
                              onClick={() => handleOpenEdit(wh)}
                              className="group cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-2.5">
                                <div className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-mono text-xs font-bold border border-slate-200">
                                  {wh.code}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-bold text-sm text-slate-900">{wh.name}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5 text-slate-600 font-medium text-xs">
                                  {wh.storekeeper ? (
                                    <>
                                      <User size={14} className="text-slate-400" />
                                      {wh.storekeeper}
                                    </>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5 text-slate-500 font-normal text-xs">
                                  {wh.address ? (
                                    <>
                                      <MapPin size={14} className="text-slate-400" />
                                      {wh.address.length > 30 ? wh.address.substring(0, 30) + '...' : wh.address}
                                    </>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </div>
                              </td>
                              <td className={`px-4 py-2.5 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                                <div className={`flex items-center gap-1.5 ${dir === 'rtl' ? 'justify-end' : 'justify-start'}`}>
                                  <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(wh); }} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-emerald-600 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-300 transition-all">
                                    <Edit size={14} />
                                  </button>
                                  <button onClick={(e) => handleDelete(wh.id, e)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-rose-500 flex items-center justify-center hover:bg-rose-50 hover:border-rose-300 transition-all">
                                    <Trash2 size={14} />
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
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {loading ? (
                      <div className="col-span-full py-12 text-center"><div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
                    ) : filteredWarehouses.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-slate-400 font-bold text-sm">
                        <Home className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        {language === 'ar' ? 'لم يتم العثور على مخازن' : 'No Warehouses Found'}
                      </div>
                    ) : (
                      filteredWarehouses.map((wh) => (
                        <div 
                          key={wh.id}
                          onClick={() => handleOpenEdit(wh)}
                          className="group relative bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer flex flex-col min-h-[190px]"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="inline-block px-2.5 py-1 bg-slate-50 text-slate-500 rounded font-mono text-xs font-bold border border-slate-200">
                              {wh.code}
                            </div>
                            <button onClick={(e) => handleDelete(wh.id, e)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                          
                          <h3 className="text-base font-bold text-slate-900 mb-1.5 truncate">{wh.name}</h3>
                          
                          {wh.description && (
                            <p className="text-slate-500 text-xs font-normal line-clamp-2 mb-3 leading-relaxed flex-1">
                              {wh.description}
                            </p>
                          )}
                          
                          <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-500">
                            {wh.storekeeper && (
                              <div className="flex items-center gap-1.5 truncate">
                                <User size={13} className="text-slate-400 shrink-0" />
                                <span className="truncate">{wh.storekeeper}</span>
                              </div>
                            )}
                            {wh.address && (
                              <div className="flex items-center gap-1.5 truncate">
                                <MapPin size={13} className="text-slate-400 shrink-0" />
                                <span className="truncate">{wh.address}</span>
                              </div>
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
            className="flex-1 flex flex-col bg-white md:rounded-2xl border-0 md:border md:border-slate-200 shadow-xl overflow-hidden max-w-4xl mx-auto w-full"
          >
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              <div className="px-6 py-4 bg-zinc-900 flex justify-between items-center relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="absolute -right-20 -top-40 w-80 h-80 bg-emerald-500/20 blur-3xl rounded-full"></div>
                
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-inner">
                    {editingWarehouse ? <Edit className="text-emerald-400" size={20} /> : <Home className="text-emerald-400" size={20} />}
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
                      {editingWarehouse ? t('warehouses.edit') : t('warehouses.add')}
                    </h2>
                    <p className="text-zinc-400 font-medium text-xs mt-0.5">
                      {editingWarehouse ? formData.name : (language === 'ar' ? 'إضافة مخزن جديد لنظام مبيعاتك' : 'Add a new warehouse')}
                    </p>
                  </div>
                </div>
                
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="relative z-10 p-2 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-all group"
                >
                  <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 flex flex-col md:flex-row gap-5 custom-scrollbar">
                <div className="w-full md:w-3/5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 px-0.5">
                        {t('warehouses.form_code')} <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required 
                        readOnly
                        value={formData.code}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-500 cursor-not-allowed focus:outline-none" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 px-0.5">
                        {t('warehouses.form_name')} <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required 
                        value={formData.name} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                        className={`w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${dir === 'rtl' ? 'text-right' : 'text-left'}`} 
                        placeholder={t('warehouses.form_name')}
                      />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                    <label className="block text-xs font-bold text-slate-700 px-0.5">
                      {t('warehouses.form_description')}
                    </label>
                    <textarea 
                      value={formData.description} 
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                      className={`w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-normal text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[80px] resize-none ${dir === 'rtl' ? 'text-right' : 'text-left'}`} 
                      placeholder={t('warehouses.form_description')}
                    />
                  </div>
                </div>

                <div className="w-full md:w-2/5 space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 px-0.5">
                        {t('warehouses.form_address')}
                      </label>
                      <div className="relative">
                        <MapPin size={16} className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
                        <input 
                          type="text" 
                          value={formData.address} 
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
                          className={`w-full py-2 ${dir === 'rtl' ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'} bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all`} 
                          placeholder={t('warehouses.form_address')}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 px-0.5">
                        {t('warehouses.form_phone')}
                      </label>
                      <div className="relative">
                        <Phone size={16} className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
                        <input 
                          type="text" 
                          value={formData.phone} 
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                          className={`w-full py-2 ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all`} 
                          dir="ltr"
                          placeholder="e.g. 010..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                      {language === 'ar' ? 'بيانات أمين المخزن' : 'Storekeeper Details'}
                    </h3>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 px-0.5">
                        {t('warehouses.form_storekeeper')}
                      </label>
                      <div className="relative">
                        <User size={16} className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
                        <input 
                          type="text" 
                          value={formData.storekeeper} 
                          onChange={(e) => setFormData({ ...formData, storekeeper: e.target.value })} 
                          className={`w-full py-2 ${dir === 'rtl' ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'} bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all`} 
                          placeholder={t('warehouses.form_storekeeper')}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 px-0.5">
                        {t('warehouses.form_storekeeper_phone')}
                      </label>
                      <div className="relative">
                        <Phone size={16} className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
                        <input 
                          type="text" 
                          value={formData.storekeeper_phone} 
                          onChange={(e) => setFormData({ ...formData, storekeeper_phone: e.target.value })} 
                          className={`w-full py-2 ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all`} 
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3.5 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 rounded-b-2xl">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors text-xs"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-md hover:bg-emerald-700 active:scale-95 transition-all text-xs flex items-center gap-2"
                >
                  <Plus size={16} />
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
