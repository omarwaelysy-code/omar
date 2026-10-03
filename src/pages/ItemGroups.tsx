import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Trash2, X, Folder, Layers, Hash, 
  ChevronRight, ChevronLeft, LayoutGrid, List, Lock, FileText, FileUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../contexts/NotificationContext';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { PaginationControls } from '../components/PaginationControls';
import { ExcelImportWizard } from '../components/ExcelImportWizard';

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
  const { showNotification } = useNotification();
  
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [view, setView] = useState<'table' | 'card'>('table');
  const [showImportWizard, setShowImportWizard] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ItemGroup | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'finished_product' as 'finished_product' | 'service' | 'raw_material' | 'commodity',
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
      
      // Extract the first 3 characters/letters of the group name (ignoring spaces)
      const sanitizedName = formData.name.trim().replace(/\s+/g, '');
      const distinctiveLetters = sanitizedName.substring(0, 3).toUpperCase();
      
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
      
      // Formula: [distinctive name letters] + [type acronym TAM, SRV, RAW, COM] + [index]
      const combinedCode = distinctiveLetters 
        ? `${distinctiveLetters}-${typeAcronym}-${paddedNum}`
        : `${typeAcronym}-${paddedNum}`;

      setFormData(prev => ({
        ...prev,
        sequence_number: nextNum,
        code: combinedCode
      }));
    }
  }, [formData.type, formData.name, itemGroups, editingGroup, isModalOpen]);

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      type: 'finished_product',
      description: '',
      sequence_number: 1,
      code: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (group: ItemGroup) => {
    setEditingGroup(group);
    
    setFormData({
      name: group.name,
      type: group.type,
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
      showNotification(language === 'ar' ? 'اسم المجموعة مطلوب' : 'Group Name is required', 'error');
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
        showNotification(language === 'ar' ? 'تم تحديث المجموعة بنجاح' : 'Group updated successfully', 'success');
      } else {
        await dbService.add('item_groups', payload);
        showNotification(language === 'ar' ? 'تمت إضافة المجموعة بنجاح' : 'Group created successfully', 'success');
      }
      closeModal();
    } catch (error: any) {
      console.error('Error saving item groups:', error);
      showNotification(language === 'ar' ? 'فشل حفظ المجموعة' : 'Failed to save group', 'error');
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
        showNotification(language === 'ar' ? 'تم حذف المجموعة بنجاح' : 'Group deleted successfully', 'success');
      } catch (error) {
        console.error('Failed to delete item group:', error);
        showNotification(language === 'ar' ? 'فشل حذف المجموعة' : 'Failed to delete group', 'error');
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
            className="flex-1 flex flex-col space-y-5 overflow-hidden max-w-7xl mx-auto w-full p-4"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1">
                  {language === 'ar' ? 'مجموعات الأصناف' : 'Item Groups'}
                </h1>
                <p className="text-slate-500 font-medium text-xs">
                  {language === 'ar' ? 'تصنيف وتعريف المجموعات بناءً على الأنواع الأساسية' : 'Classify and index groups by core types'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowImportWizard(true)}
                  className="flex items-center justify-center gap-2 px-3.5 py-2 bg-white text-emerald-700 border border-emerald-300 rounded-xl font-bold text-xs hover:bg-emerald-50 transition-all active:scale-95 shadow-sm"
                  title="استيراد من Excel"
                >
                  <FileUp size={16} />
                  <span className="hidden md:inline">استيراد Excel</span>
                </button>
                <button 
                  onClick={handleOpenCreate}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-xl shadow-md hover:bg-zinc-800 active:scale-95 transition-all text-xs font-bold flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>{language === 'ar' ? 'مجموعة جديدة' : 'New Group'}</span>
                </button>
              </div>
            </div>

            {/* List Controls and View Settings */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all duration-300">
              <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
                <div className="relative flex-1 group">
                  <Search className={`absolute ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'} top-3 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none`} size={18} />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'بحث عن مجموعة أصناف...' : 'Search item groups...'}
                    className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3.5 py-2 border border-slate-200 bg-white rounded-xl outline-none font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs shadow-sm"
                  >
                    <option value="all">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
                    <option value="finished_product">{language === 'ar' ? 'منتج تام (TAM)' : 'Finished Product'}</option>
                    <option value="service">{language === 'ar' ? 'خدمة (SRV)' : 'Service'}</option>
                    <option value="raw_material">{language === 'ar' ? 'مواد خام (RAW)' : 'Raw Material'}</option>
                    <option value="commodity">{language === 'ar' ? 'سلعة (COM)' : 'Commodity'}</option>
                  </select>
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
                          <th className={`px-4 py-3 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'كود المجموعة المبرمج' : 'Autogen Code'}</th>
                          <th className={`px-4 py-3 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'اسم المجموعة' : 'Group Name'}</th>
                          <th className={`px-4 py-3 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'نوع الصنف' : 'Classification Type'}</th>
                          <th className={`px-4 py-3 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{language === 'ar' ? 'التوصيف' : 'Description'}</th>
                          <th className={`px-4 py-3 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading ? (
                          <tr><td colSpan={5} className="py-12 text-center"><div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                        ) : filteredGroups.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 font-bold text-sm">
                              <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                              {language === 'ar' ? 'لم يتم العثور على مجموعات أصناف' : 'No Item Groups Found'}
                            </td>
                          </tr>
                        ) : filteredGroups.map((group) => (
                          <tr 
                            key={group.id} 
                            onClick={() => handleOpenEdit(group)}
                            className="hover:bg-slate-50 transition-colors group cursor-pointer"
                          >
                            <td className={`px-4 py-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold border border-slate-200 group-hover:border-emerald-300 transition-all">{group.code}</span>
                            </td>
                            <td className={`px-4 py-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">{group.name}</span>
                            </td>
                            <td className={`px-4 py-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600">
                                <Layers size={13} className="text-slate-400" />
                                <span>{getTypeLabel(group.type)}</span>
                              </span>
                            </td>
                            <td className={`px-4 py-2.5 ${dir === 'rtl' ? 'text-right' : 'text-left'} text-slate-500 text-xs font-normal max-w-sm truncate`} title={group.description}>
                              {group.description || '-'}
                            </td>
                            <td className={`px-4 py-2.5 ${dir === 'rtl' ? 'text-left' : 'text-right'}`}>
                              <div className={`flex items-center ${dir === 'rtl' ? 'justify-start' : 'justify-end'} gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                <button 
                                  onClick={(e) => handleDelete(group.id, e)} 
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <div className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                  {dir === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredGroups.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-slate-400 font-bold text-sm">
                        <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        {language === 'ar' ? 'لم يتم العثور على مجموعات أصناف' : 'No Item Groups Found'}
                      </div>
                    ) : filteredGroups.map((group) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ y: -3 }}
                        key={group.id} 
                        onClick={() => handleOpenEdit(group)} 
                        className="p-5 space-y-4 rounded-2xl border bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-1 text-right">
                            <span className="font-mono text-xs bg-slate-50 px-2 py-0.5 rounded text-slate-500 font-bold w-fit border border-slate-200 uppercase">{group.code}</span>
                            <h4 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors text-lg tracking-tight">{group.name}</h4>
                            <span className="text-xs text-slate-500 font-medium">{getTypeLabel(group.type)}</span>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-200 group-hover:text-emerald-600 transition-colors">
                            <Folder size={18} />
                          </div>
                        </div>
                        {group.description && (
                          <p className="text-xs text-slate-500 line-clamp-2">{group.description}</p>
                        )}
                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-[11px] font-bold text-slate-400">
                            {language === 'ar' ? 'تعديل التفاصيل' : 'Edit details'}
                          </span>
                          <div className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                            {dir === 'rtl' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0">
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
            className="flex-1 flex flex-col space-y-6 overflow-hidden max-w-4xl mx-auto w-full p-4"
          >
            <div className="bg-white flex-1 rounded-2xl shadow-md flex flex-col overflow-hidden border border-slate-200 transition-all duration-300">
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                {/* Header panel */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-20">
                  <div className={`flex items-center gap-3.5 ${dir === 'rtl' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20">
                      <Folder size={20} />
                    </div>
                    <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                      <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-tight">
                        {editingGroup ? (language === 'ar' ? 'تعديل مجموعة الأصناف' : 'Edit Item Group') : (language === 'ar' ? 'إضافة مجموعة جديدة' : 'Add Item Group')}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {editingGroup?.code || 'SYSTEM FLOW : NEW GROUP'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="submit" form="group-form" className="px-5 py-2 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all active:scale-95 text-xs shadow-sm">
                      {editingGroup ? (language === 'ar' ? 'حفظ' : 'Save') : (language === 'ar' ? 'إضافة' : 'Add')}
                    </button>
                    <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg hover:bg-rose-50 hover:text-rose-500 transition-all">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Content form fields */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
                  <form id="group-form" onSubmit={handleSubmit} className="space-y-6" dir={dir}>
                    <div className="space-y-5">
                      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shadow-inner">
                          <Folder size={16} />
                        </div>
                        <h2 className="text-sm md:text-base font-bold text-slate-900">
                          {language === 'ar' ? 'المعلومات الأساسية للمجموعة' : 'Primary Group Information'}
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-right">
                        {/* Group Name input */}
                        <div className="md:col-span-2 space-y-2">
                          <label className="block text-xs font-bold text-slate-700">
                            {language === 'ar' ? 'اسم المجموعة *' : 'Group Name *'}
                          </label>
                          <input 
                            required 
                            type="text" 
                            placeholder={language === 'ar' ? 'مثال: قطع غيار المحركات' : 'e.g. Engine Spare Parts'} 
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                            value={formData.name} 
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                          />
                        </div>

                        {/* Commodity Type select */}
                        <div className="md:col-span-2 space-y-2">
                          <label className="block text-xs font-bold text-slate-700">
                            {language === 'ar' ? 'نوع الصنف للمجموعة *' : 'Group Commodity Classification *'}
                          </label>
                          <div className="relative group">
                            <Layers className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-slate-400`} size={18} />
                            <select 
                              required 
                              className={`w-full ${dir === 'rtl' ? 'pr-9 pl-9' : 'pl-9 pr-9'} py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 appearance-none outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all`} 
                              value={formData.type} 
                              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                            >
                              <option value="finished_product">{language === 'ar' ? 'منتج تام (TAM)' : 'Finished Product (TAM)'}</option>
                              <option value="service">{language === 'ar' ? 'خدمة (SRV)' : 'Service (SRV)'}</option>
                              <option value="raw_material">{language === 'ar' ? 'مواد خام (RAW)' : 'Raw Material (RAW)'}</option>
                              <option value="commodity">{language === 'ar' ? 'سلعة (COM)' : 'Commodity (COM)'}</option>
                            </select>
                            <ChevronDown className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-3 text-slate-400 pointer-events-none`} size={18} />
                          </div>
                        </div>

                        {/* Automatic code (Read Only as requested) */}
                        <div className="space-y-2 md:col-span-2">
                          <label className="block text-xs font-bold text-slate-700">
                            {language === 'ar' ? 'كود المجموعة المبرمج (تلقائي لا يمكن تعديله)' : 'Autogenerated Group Code (Read-Only)'}
                          </label>
                          <div className="relative group flex items-center">
                            <Lock className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-emerald-500`} size={18} />
                            <input 
                              readOnly 
                              required
                              type="text" 
                              className={`w-full ${dir === 'rtl' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 bg-slate-50 border border-emerald-200 rounded-xl font-mono text-sm font-bold text-emerald-600 outline-none cursor-not-allowed`} 
                              value={formData.code} 
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium block px-1">
                            {language === 'ar' ? 'يتكون كود المجموعة تلقائياً في نفس اللحظة من: [أول 3 حروف من الاسم] - [نوع المجموعة المحاسبي] - [الترقيم التسلسلي]' : 'The group code is automatically compiled of: [First 3 Name Letters] - [Type Acronym] - [Sequential Number]'}
                          </span>
                        </div>

                        {/* Description input */}
                        <div className="md:col-span-2 space-y-2">
                          <label className="block text-xs font-bold text-slate-700">
                            {language === 'ar' ? 'توصيف ووصف المجموعة' : 'Description & Scope'}
                          </label>
                          <textarea 
                            rows={3} 
                            placeholder="..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none" 
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

      {showImportWizard && (
        <ExcelImportWizard
          module="item_groups"
          moduleNameAr="مجموعات الأصناف"
          onClose={() => setShowImportWizard(false)}
          onSuccess={() => setShowImportWizard(false)}
        />
      )}
    </div>
  );
}
