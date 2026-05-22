import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, Folder, Layers, Hash, 
  ChevronRight, ChevronLeft, LayoutGrid, List, Lock, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { PaginationControls } from '../components/PaginationControls';

interface ItemGroup {
  id: string;
  company_id: string;
  name: string;
  code: string;
  type: 'finished_product' | 'service' | 'raw_material' | 'commodity';
  sequence_number: number;
  description: string;
  created_at: string;
}

export function ItemGroups() {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [view, setView] = useState<'table' | 'card'>('table');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ItemGroup | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'finished_product' as 'finished_product' | 'service' | 'raw_material' | 'commodity',
    letter_code: '',
    description: '',
    sequence_number: 1,
    code: ''
  });

  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (user?.company_id) {
      setLoading(true);
      const unsubscribe = dbService.subscribe<ItemGroup>('item_groups', user.company_id, (data) => {
        setItemGroups(data || []);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // Helper translations for types
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'finished_product':
        return language === 'ar' ? 'منتج تام (TAM)' : 'Finished Product (TAM)';
      case 'service':
        return language === 'ar' ? 'خدمة (SRV)' : 'Service (SRV)';
      case 'raw_material':
        return language === 'ar' ? 'مواد خام (RAW)' : 'Raw Material (RAW)';
      case 'commodity':
        return language === 'ar' ? 'سلعة (COM)' : 'Commodity (COM)';
      default:
        return type;
    }
  };

  const getTypeAcronym = (type: string) => {
    switch (type) {
      case 'finished_product': return 'TAM';
      case 'service': return 'SRV';
      case 'raw_material': return 'RAW';
      case 'commodity': return 'COM';
      default: return 'GRP';
    }
  };

  // Run auto-generation of code during input changes
  useEffect(() => {
    if (isModalOpen) {
      const typeAcronym = getTypeAcronym(formData.type);
      const sanitizedLetters = formData.letter_code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      let nextNum = formData.sequence_number;
      if (!editingGroup) {
        const typeGroups = itemGroups.filter(g => g.type === formData.type);
        let maxNum = 0;
        typeGroups.forEach(g => {
          if (g.sequence_number && g.sequence_number > maxNum) {
            maxNum = g.sequence_number;
          }
        });
        nextNum = maxNum + 1;
      }

      const paddedNum = String(nextNum).padStart(3, '0');
      const combinedCode = sanitizedLetters 
        ? `${typeAcronym}-${sanitizedLetters}-${paddedNum}`
        : `${typeAcronym}-${paddedNum}`;

      setFormData(prev => ({
        ...prev,
        sequence_number: nextNum,
        code: combinedCode
      }));
    }
  }, [formData.type, formData.letter_code, itemGroups, editingGroup, isModalOpen]);

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      type: 'finished_product',
      letter_code: '',
      description: '',
      sequence_number: 1,
      code: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (group: ItemGroup) => {
    setEditingGroup(group);
    
    // Parse letters from code if has "TAM-ABC-001" pattern
    const parts = group.code.split('-');
    let parsedLetters = '';
    if (parts.length === 3) {
      parsedLetters = parts[1];
    }

    setFormData({
      name: group.name,
      type: group.type,
      letter_code: parsedLetters,
      description: group.description || '',
      sequence_number: group.sequence_number || 1,
      code: group.code
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGroup(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.company_id) return;

    if (!formData.name.trim()) {
      toast.error(language === 'ar' ? 'اسم المجموعة مطلوب' : 'Group Name is required');
      return;
    }

    if (!formData.letter_code.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال حروف الكود المميزة للمجموعة' : 'Please enter distinct letters for the code');
      return;
    }

    const payload = {
      company_id: user.company_id,
      name: formData.name.trim(),
      code: formData.code,
      type: formData.type,
      sequence_number: formData.sequence_number,
      description: formData.description.trim()
    };

    try {
      if (editingGroup) {
        await dbService.update('item_groups', editingGroup.id, payload);
        toast.success(language === 'ar' ? 'تم تحديث المجموعة بنجاح' : 'Group updated successfully');
      } else {
        await dbService.add('item_groups', payload);
        toast.success(language === 'ar' ? 'تمت إضافة المجموعة بنجاح' : 'Group created successfully');
      }
      closeModal();
    } catch (error: any) {
      console.error('Error saving item groups:', error);
      toast.error(language === 'ar' ? 'فشل حفظ المجموعة' : 'Failed to save group');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = language === 'ar'
      ? 'هل أنت متأكد من رغبتك في حذف هذه المجموعة؟'
      : 'Are you sure you want to delete this group?';
    
    if (window.confirm(confirmMsg)) {
      try {
        await dbService.delete('item_groups', id);
        toast.success(language === 'ar' ? 'تم حذف المجموعة بنجاح' : 'Group deleted successfully');
      } catch (error) {
        console.error('Failed to delete item group:', error);
        toast.error(language === 'ar' ? 'فشل حذف المجموعة' : 'Failed to delete group');
      }
    }
  };

  const filteredGroups = itemGroups.filter(g => {
    const matchesSearch = (g.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (g.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (g.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || g.type === typeFilter;
    
    return matchesSearch && matchesType;
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
            {/* Header - Styled like Products layout */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-6 border-b border-slate-100">
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-3 leading-none italic serif">
                  {language === 'ar' ? 'مجموعات الأصناف' : 'Item Groups'}
                </h1>
                <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">
                  {language === 'ar' ? 'تصنيف وتعريف المجموعات بناءً على الأنواع الأساسية' : 'Classify and index groups by core types'}
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
                    {language === 'ar' ? 'مجموعة جديدة' : 'New Group'}
                  </div>
                </button>
              </div>
            </div>

            {/* List Controls and View Settings */}
            <div className="flex-1 bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col transition-all duration-500">
              <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/20">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={24} />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'بحث عن مجموعة أصناف...' : 'Search item groups...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-16 pl-6' : 'pl-16 pr-6'} py-4 bg-white border border-slate-100 rounded-[2rem] outline-none font-bold text-slate-900 placeholder:text-slate-300 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 transition-all shadow-inner`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-6 py-4 border border-slate-100 bg-white rounded-[2rem] outline-none font-bold text-slate-900 focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-md text-sm"
                  >
                    <option value="all">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
                    <option value="finished_product">{language === 'ar' ? 'منتج تام (TAM)' : 'Finished Product'}</option>
                    <option value="service">{language === 'ar' ? 'خدمة (SRV)' : 'Service'}</option>
                    <option value="raw_material">{language === 'ar' ? 'مواد خام (RAW)' : 'Raw Material'}</option>
                    <option value="commodity">{language === 'ar' ? 'سلعة (COM)' : 'Commodity'}</option>
                  </select>
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
                          <th className={`px-8 py-6 rounded-s-2xl ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'كود المجموعة المبرمج' : 'Autogen Code'}</th>
                          <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'اسم المجموعة' : 'Group Name'}</th>
                          <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'نوع الصنف' : 'Classification Type'}</th>
                          <th className={`px-8 py-6 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'التوصيف' : 'Description'}</th>
                          <th className={`px-8 py-6 rounded-e-2xl ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {loading ? (
                          <tr><td colSpan={5} className="py-20 text-center"><div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                        ) : filteredGroups.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-20 text-center text-slate-400 font-bold">
                              <Folder className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                              {language === 'ar' ? 'لم يتم العثور على مجموعات أصناف' : 'No Item Groups Found'}
                            </td>
                          </tr>
                        ) : filteredGroups.map((group) => (
                          <tr 
                            key={group.id} 
                            onClick={() => handleOpenEdit(group)}
                            className="hover:bg-slate-50 transition-all group cursor-pointer"
                          >
                            <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <span className="font-mono text-xs bg-slate-100 px-3 py-1 rounded-lg text-slate-500 font-black border border-slate-200 group-hover:border-emerald-200 transition-all">{group.code}</span>
                            </td>
                            <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <span className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors">{group.name}</span>
                            </td>
                            <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-50 border border-slate-100 text-slate-600">
                                <Layers size={14} className="text-slate-400" />
                                <span>{getTypeLabel(group.type)}</span>
                              </span>
                            </td>
                            <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-right' : 'text-left'} text-slate-400 font-medium max-w-sm truncate`} title={group.description}>
                              {group.description || '-'}
                            </td>
                            <td className={`px-8 py-5 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                              <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-1 opacity-0 group-hover:opacity-100 transition-all`}>
                                <button 
                                  onClick={(e) => handleDelete(group.id, e)} 
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                >
                                  <Trash2 size={18} />
                                </button>
                                <div className="p-2 text-emerald-400 bg-white rounded-xl shadow-sm border border-slate-100">
                                  {dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {filteredGroups.length === 0 ? (
                      <div className="col-span-full py-20 text-center text-slate-400 font-bold">
                        <Folder className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        {language === 'ar' ? 'لم يتم العثور على مجموعات أصناف' : 'No Item Groups Found'}
                      </div>
                    ) : filteredGroups.map((group) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -5 }}
                        key={group.id} 
                        onClick={() => handleOpenEdit(group)} 
                        className="p-8 space-y-6 rounded-[3rem] border bg-white border-slate-100 hover:border-emerald-200 hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-2 text-right">
                            <span className="font-mono text-xs bg-slate-50 px-3 py-1 rounded-lg text-slate-400 font-black w-fit border border-slate-100 uppercase tracking-widest">{group.code}</span>
                            <h4 className="font-black text-slate-900 group-hover:text-emerald-700 transition-colors text-2xl tracking-tighter leading-none italic serif">{group.name}</h4>
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">{getTypeLabel(group.type)}</span>
                          </div>
                          <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 text-slate-300 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:scale-105 transition-all shadow-inner">
                            <Folder size={26} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                          </div>
                        </div>
                        {group.description && (
                          <p className="text-sm text-slate-400 italic line-clamp-2 mt-2">{group.description}</p>
                        )}
                        <div className="pt-6 border-t border-slate-50 flex justify-between items-end mt-4">
                          <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">
                            {language === 'ar' ? 'تعديل التفاصيل' : 'Edit details'}
                          </span>
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-300 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                            {dir === 'rtl' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-50 bg-white sticky bottom-0">
                <PaginationControls page={1} limit={100} total={filteredGroups.length} onPageChange={() => {}} onLimitChange={() => {}} />
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
            {/* The beautiful form layout replacing the screen, matching Products.tsx exactly */}
            <div className="bg-white flex-1 rounded-[3.5rem] shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden border border-slate-100 transition-all duration-500">
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                {/* Header panel */}
                <div className="p-10 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20">
                  <div className={`flex items-center gap-6 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className="w-16 h-16 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-emerald-500/20">
                      <Folder size={32} />
                    </div>
                    <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1 font-serif italic">
                        {editingGroup ? (language === 'ar' ? 'تعديل مجموعة الأصناف' : 'Edit Item Group') : (language === 'ar' ? 'إضافة مجموعة جديدة' : 'Add Item Group')}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none">
                        {editingGroup?.code || 'SYSTEM FLOW : NEW GROUP'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button type="submit" form="group-form" className="px-10 py-5 bg-zinc-900 text-white rounded-[1.5rem] font-black hover:bg-zinc-800 transition-all active:scale-95 shadow-xl">
                      {editingGroup ? (language === 'ar' ? 'حفظ' : 'Save') : (language === 'ar' ? 'إضافة' : 'Add')}
                    </button>
                    <button onClick={closeModal} className="w-14 h-14 flex items-center justify-center bg-slate-50 text-slate-400 rounded-[1.5rem] hover:bg-rose-50 hover:text-rose-500 transition-all">
                      <X size={28} />
                    </button>
                  </div>
                </div>

                {/* Content form fields */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 md:p-14 mb-[4rem]">
                  <form id="group-form" onSubmit={handleSubmit} className="space-y-16" dir={dir}>
                    <div className="space-y-10">
                      <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                          <Folder size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 leading-none tracking-tight uppercase">
                          {language === 'ar' ? 'المعلومات الأساسية للمجموعة' : 'Primary Group Information'}
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-right">
                        {/* Group Name input */}
                        <div className="md:col-span-2 space-y-4">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            {language === 'ar' ? 'اسم المجموعة *' : 'Group Name *'}
                          </label>
                          <input 
                            required 
                            type="text" 
                            placeholder={language === 'ar' ? 'مثال: قطع غيار المحركات' : 'e.g. Engine Spare Parts'} 
                            className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/50 transition-all shadow-inner" 
                            value={formData.name} 
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                          />
                        </div>

                        {/* Commodity Type select */}
                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            {language === 'ar' ? 'نوع الصنف للمجموعة *' : 'Group Commodity Classification *'}
                          </label>
                          <div className="relative group">
                            <Layers className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300`} size={24} />
                            <select 
                              required 
                              className="w-full pr-16 pl-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 appearance-none outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" 
                              value={formData.type} 
                              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                            >
                              <option value="finished_product">{language === 'ar' ? 'منتج تام (TAM)' : 'Finished Product (TAM)'}</option>
                              <option value="service">{language === 'ar' ? 'خدمة (SRV)' : 'Service (SRV)'}</option>
                              <option value="raw_material">{language === 'ar' ? 'مواد خام (RAW)' : 'Raw Material (RAW)'}</option>
                              <option value="commodity">{language === 'ar' ? 'سلعة (COM)' : 'Commodity (COM)'}</option>
                            </select>
                          </div>
                        </div>

                        {/* Unique distinctive letters of the items Group */}
                        <div className="space-y-4">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            {language === 'ar' ? 'الحروف المميزة للمجموعة (A-Z) *' : 'Short Distinctive Identifiers (A-Z) *'}
                          </label>
                          <input 
                            required 
                            type="text" 
                            maxLength={10} 
                            placeholder="e.g. ENG, ELEC, SER"
                            className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-xl font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner font-mono tracking-widest text-left uppercase" 
                            value={formData.letter_code} 
                            onChange={(e) => setFormData({ ...formData, letter_code: e.target.value.toUpperCase() })} 
                          />
                        </div>

                        {/* Automatic code (Read Only as requested) */}
                        <div className="space-y-4 md:col-span-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            {language === 'ar' ? 'كود المجموعة المبرمج (تلقائي لا يمكن تعديله)' : 'Autogenerated Group Code (Read-Only)'}
                          </label>
                          <div className="relative group">
                            <Lock className={`absolute ${dir === 'rtl' ? 'right-6' : 'left-6'} top-5 text-slate-300`} size={24} />
                            <input 
                              readOnly 
                              required
                              type="text" 
                              className="w-full pr-16 pl-6 py-5 bg-slate-100 border border-slate-200 rounded-[2rem] font-mono text-xl font-black text-slate-400 outline-none shadow-inner tracking-widest" 
                              value={formData.code} 
                            />
                          </div>
                          <span className="text-xs text-slate-400 font-bold tracking-tight block px-1 mt-1">
                            {language === 'ar' ? 'يتكون كود المجموعة تلقائياً من: [نوع الصنف] - [الحروف المميزة] - [الترقيم التسلسلي]' : 'The group code is automatically compiled of: [Type Acronym] - [Distinct Letters] - [Sequential Number]'}
                          </span>
                        </div>

                        {/* Description input */}
                        <div className="md:col-span-2 space-y-4">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            {language === 'ar' ? 'توصيف ووصف المجموعة' : 'Description & Scope'}
                          </label>
                          <textarea 
                            rows={3} 
                            placeholder="..."
                            className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-lg font-bold text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-emerald-500/5 transition-all shadow-inner" 
                            value={formData.description} 
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
