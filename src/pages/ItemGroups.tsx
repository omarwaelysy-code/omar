import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Folder, Layers, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

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
  const { language, t } = useLanguage();
  const { user } = useAuth();
  
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Modal states
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

  useEffect(() => {
    fetchData();
  }, [user?.company_id]);

  const fetchData = async () => {
    if (!user?.company_id) return;
    try {
      setLoading(true);
      const data = await dbService.list<ItemGroup>('item_groups', { company_id: user.company_id });
      setItemGroups(data || []);
    } catch (error) {
      console.error('Failed to fetch item groups:', error);
      toast.error(language === 'ar' ? 'فشل تحميل مجموعات الأصناف' : 'Failed to fetch item groups');
    } finally {
      setLoading(false);
    }
  };

  // Helper translations for types
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'finished_product':
        return language === 'ar' ? 'منتج تام' : 'Finished Product';
      case 'service':
        return language === 'ar' ? 'خدمة' : 'Service';
      case 'raw_material':
        return language === 'ar' ? 'مواد خام' : 'Raw Material';
      case 'commodity':
        return language === 'ar' ? 'سلعة' : 'Commodity';
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
    // Only auto-generate standard pattern if user has not loaded an editing group, or if they are changing the editing fields
    const typeAcronym = getTypeAcronym(formData.type);
    const sanitizedLetters = formData.letter_code.toUpperCase().replace(/[^A-Z0-9\u0600-\u06FF]/g, '');
    
    let nextNum = formData.sequence_number;
    if (!editingGroup) {
      // Calculate next index based on matching types
      const matching = itemGroups.filter(g => g.type === formData.type);
      nextNum = matching.length > 0 
        ? Math.max(...matching.map(g => g.sequence_number || 0)) + 1 
        : 1;
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
  }, [formData.type, formData.letter_code, itemGroups, editingGroup]);

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
    
    // Parse the letter letters from their code if possible, or leave blank to recalculate
    // Standard code is like: TAM-ABC-001
    const parts = group.code.split('-');
    let parsedLetters = '';
    if (parts.length === 3) {
      parsedLetters = parts[1];
    } else if (parts.length === 2 && isNaN(Number(parts[0]))) {
      // Could be prefix-number pattern
      parsedLetters = '';
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
        await dbService.create('item_groups', payload);
        toast.success(language === 'ar' ? 'تمت إضافة المجموعة بنجاح' : 'Group created successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving item groups:', error);
      toast.error(language === 'ar' ? 'فشل حفظ المجموعة' : 'Failed to save group');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmMsg = language === 'ar'
      ? 'هل أنت متأكد من رغبتك في حذف هذه المجموعة؟'
      : 'Are you sure you want to delete this group?';
    
    if (window.confirm(confirmMsg)) {
      try {
        await dbService.delete('item_groups', id);
        toast.success(language === 'ar' ? 'تم حذف المجموعة بنجاح' : 'Group deleted successfully');
        fetchData();
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
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            {language === 'ar' ? 'إدارة مجموعات الأصناف' : 'Item Groups Management'}
          </h1>
          <p className="text-xs md:text-sm text-zinc-500 mt-1">
            {language === 'ar' 
              ? 'تصنيف وتعريف مجموعات الأصناف حسب الأنواع الأساسية لتسهيل جردها وتصنيفها' 
              : 'Classify and define commodity groups based on core types to ease classification and tracking.'}
          </p>
        </div>
        
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition duration-150 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'ar' ? 'مجموعة جديدة' : 'New Group'}</span>
        </button>
      </div>

      {/* Grid of filtering & search tool indicators */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-xs flex flex-col md:flex-row gap-4 items-center mb-6">
        <div className="relative w-full md:flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
          <input
            type="text"
            placeholder={language === 'ar' ? 'بحث عن مجموعة...' : 'Search groups...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full md:w-48 px-3 py-2 border border-zinc-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="all">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
            <option value="finished_product">{language === 'ar' ? 'منتج تام' : 'Finished Product'}</option>
            <option value="service">{language === 'ar' ? 'خدمة' : 'Service'}</option>
            <option value="raw_material">{language === 'ar' ? 'مواد خام' : 'Raw Material'}</option>
            <option value="commodity">{language === 'ar' ? 'سلعة' : 'Commodity'}</option>
          </select>
        </div>
      </div>

      {/* Primary items table */}
      <div className="flex-1 overflow-auto bg-white border border-zinc-100 rounded-2xl shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center p-20 text-zinc-400 text-sm">
            {language === 'ar' ? 'جاري تحميل المجموعات...' : 'Loading groups...'}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center text-zinc-400">
            <Folder className="w-12 h-12 text-zinc-200 mb-3" />
            <span className="text-sm font-medium">
              {language === 'ar' ? 'لا توجد مجموعات أصناف للاستعراض' : 'No Item Groups Found'}
            </span>
            <p className="text-xs text-zinc-400 max-w-sm mt-1">
              {language === 'ar' 
                ? 'اضغط على زر "مجموعة جديدة" في الأعلى لبدء تعريف مجموعات الأصناف والسلع والخدمات.' 
                : 'Click "New Group" above to start defining product groups, material categories and active services.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-xs text-zinc-500 font-semibold uppercase">
                <th className="px-6 py-4 text-right">{language === 'ar' ? 'كود المجموعة المبرمج' : 'Autogen Group Code'}</th>
                <th className="px-6 py-4 text-right">{language === 'ar' ? 'اسم المجموعة' : 'Group Name'}</th>
                <th className="px-6 py-4 text-right">{language === 'ar' ? 'نوع الصنف' : 'Type'}</th>
                <th className="px-6 py-4 text-right">{language === 'ar' ? 'توصيف المجموعة' : 'Description'}</th>
                <th className="px-6 py-4 text-center w-28">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 text-sm">
              <AnimatePresence>
                {filteredGroups.map((group) => (
                  <motion.tr
                    key={group.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-zinc-50/50 transition duration-150"
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-zinc-900 bg-zinc-100 px-2 py-1 rounded-md font-semibold">
                        {group.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-900">{group.name}</td>
                    <td className="px-6 py-4 text-zinc-600">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-50 text-zinc-700">
                        <Layers className="w-3 h-3 text-zinc-400" />
                        <span>{getTypeLabel(group.type)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 max-w-xs truncate" title={group.description}>
                      {group.description || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(group)}
                          title={language === 'ar' ? 'تعديل' : 'Edit'}
                          className="p-1 px-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(group.id)}
                          title={language === 'ar' ? 'حذف' : 'Delete'}
                          className="p-1 px-1.5 rounded-lg text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Beautiful slider drawer modal for creation/edition */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100">
                <h2 className="text-lg font-bold text-zinc-900">
                  {editingGroup 
                    ? (language === 'ar' ? 'تعديل مجموعة أصناف' : 'Edit Item Group')
                    : (language === 'ar' ? 'إضافة مجموعة جديدة' : 'Add Item Group')}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-zinc-100 transition text-zinc-400"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">
                    {language === 'ar' ? 'اسم المجموعة *' : 'Group Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    placeholder={language === 'ar' ? 'مثال: قطع غيار المحركات' : 'e.g. Engine Spare Parts'}
                  />
                </div>

                {/* Type Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">
                    {language === 'ar' ? 'نوع الأصناف للمجموعة *' : 'Group Commodity Type *'}
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="finished_product">{language === 'ar' ? 'منتج تام (TAM)' : 'Finished Product (TAM)'}</option>
                    <option value="service">{language === 'ar' ? 'خدمة (SRV)' : 'Service (SRV)'}</option>
                    <option value="raw_material">{language === 'ar' ? 'مواد خام (RAW)' : 'Raw Material (RAW)'}</option>
                    <option value="commodity">{language === 'ar' ? 'سلعة (COM)' : 'Commodity (COM)'}</option>
                  </select>
                </div>

                {/* Letters Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">
                    {language === 'ar' ? 'حروف كود المجموعة المميزة (حروف إنجليزية) *' : 'Short Identifier Letters (A-Z) *'}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formData.letter_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, letter_code: e.target.value.toUpperCase() }))}
                    className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono tracking-wider text-left"
                    placeholder="e.g. ENG, ELEC, SER"
                  />
                  <p className="text-[10px] text-zinc-400">
                    {language === 'ar' 
                      ? 'يتم استخدام هذه الأحروف لتشكيل الكود النهائي للمجموعة.'
                      : 'These letters distinguish the generated group code.'}
                  </p>
                </div>

                {/* Readonly combined code */}
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    {language === 'ar' ? 'كود المجموعة النهائي المقترح (تلقائي)' : 'Program Autogenerated Code (Read-Only)'}
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={formData.code}
                    className="bg-transparent border-none text-zinc-900 font-mono text-sm font-bold focus:outline-none p-0 cursor-not-allowed select-none"
                    title={language === 'ar' ? 'كود النظام لا يمكن كتابته في الحفظ' : 'Autogenerated system code - cannot be modified directly'}
                  />
                  <span className="text-[9px] text-zinc-400 mt-0.5">
                    {language === 'ar'
                      ? 'يحتوي على: اسم الاختصار، وحروف الكود، والترقيم التسلسلي.'
                      : 'Contains the type acronym, your code letters, and sequential index.'}
                  </span>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">
                    {language === 'ar' ? 'توصيف ووصف المجموعة' : 'Description'}
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    placeholder={language === 'ar' ? 'اكتب بيانات إضافية حول أنواع البضائع لتسهيل تصنيفها...' : 'Optional details or remarks...'}
                  />
                </div>

                {/* Buttons block */}
                <div className="flex gap-3 mt-auto pt-4 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 border border-zinc-200 text-zinc-700 font-medium text-sm rounded-xl hover:bg-zinc-50 transition"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-zinc-900 text-white font-medium text-sm rounded-xl hover:bg-zinc-800 transition"
                  >
                    {language === 'ar' ? 'حفظ المجموعة' : 'Save Group'}
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
