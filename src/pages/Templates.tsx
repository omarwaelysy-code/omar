import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, Copy, ArrowDownLeft, ArrowUpRight, X, Search, SlidersHorizontal, Settings, FileText, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface PaperSize {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: string;
  is_system: boolean;
  company_id: string | null;
}

interface Template {
  id: string;
  company_id: string;
  name: string;
  description: string;
  paper_size_id: string;
  orientation: 'portrait' | 'landscape';
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface TemplatesProps {
  initialView?: 'list' | 'create';
}

export function Templates({ initialView = 'list' }: TemplatesProps) {
  const { dir, language } = useLanguage();
  const { user } = useAuth();
  const [view, setView] = useState<'list' | 'create' | 'edit'>(initialView);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sizeFilter, setSizeFilter] = useState('all');

  // Form State
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    paper_size_id: 'a4',
    orientation: 'portrait' as 'portrait' | 'landscape',
    margin_top: 10,
    margin_bottom: 10,
    margin_left: 10,
    margin_right: 10,
    is_active: true,
    // Custom paper size fields (when paper_size_id is 'custom')
    customWidth: 210,
    customHeight: 297,
    customUnit: 'mm'
  });

  // Sync view state when initialView prop changes
  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [allTemplates, allSizes] = await Promise.all([
        dbService.list<Template>('templates', user?.company_id || ''),
        dbService.list<PaperSize>('paper_sizes', user?.company_id || '')
      ]);
      setTemplates(allTemplates);
      setPaperSizes(allSizes);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(language === 'ar' ? 'فشل تحميل البيانات' : 'Failed to fetch templates data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    
    // Check if the paper size linked is custom
    const selectedSize = paperSizes.find(p => p.id === template.paper_size_id);
    const isCustom = selectedSize && !selectedSize.is_system;

    setFormData({
      name: template.name,
      description: template.description || '',
      paper_size_id: isCustom ? 'custom' : template.paper_size_id,
      orientation: template.orientation,
      margin_top: Number(template.margin_top),
      margin_bottom: Number(template.margin_bottom),
      margin_left: Number(template.margin_left),
      margin_right: Number(template.margin_right),
      is_active: template.is_active,
      customWidth: isCustom ? Number(selectedSize.width) : 210,
      customHeight: isCustom ? Number(selectedSize.height) : 297,
      customUnit: isCustom ? selectedSize.unit : 'mm'
    });
    setView('edit');
  };

  const handleCopy = (template: Template) => {
    const selectedSize = paperSizes.find(p => p.id === template.paper_size_id);
    const isCustom = selectedSize && !selectedSize.is_system;

    setFormData({
      name: `${template.name} - ${language === 'ar' ? 'نسخة' : 'Copy'}`,
      description: template.description || '',
      paper_size_id: isCustom ? 'custom' : template.paper_size_id,
      orientation: template.orientation,
      margin_top: Number(template.margin_top),
      margin_bottom: Number(template.margin_bottom),
      margin_left: Number(template.margin_left),
      margin_right: Number(template.margin_right),
      is_active: template.is_active,
      customWidth: isCustom ? Number(selectedSize.width) : 210,
      customHeight: isCustom ? Number(selectedSize.height) : 297,
      customUnit: isCustom ? selectedSize.unit : 'mm'
    });
    setEditingTemplate(null); // It is a new template, not editing an existing one
    setView('create');
    toast.success(language === 'ar' ? 'تم نسخ بيانات القالب بنجاح' : 'Template copied successfully');
  };

  const handleDelete = async (id: string) => {
    const confirmMsg = language === 'ar' 
      ? 'هل أنت متأكد من حذف هذا القالب؟' 
      : 'Are you sure you want to delete this template?';
      
    if (!window.confirm(confirmMsg)) return;

    try {
      await dbService.delete('templates', id);
      toast.success(language === 'ar' ? 'تم حذف القالب بنجاح' : 'Template deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(language === 'ar' ? 'فشل حذف القالب' : 'Failed to delete template');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم القالب' : 'Please enter template name');
      return;
    }

    try {
      let finalPaperSizeId = formData.paper_size_id;

      // Handle Custom Paper Size
      if (formData.paper_size_id === 'custom') {
        if (editingTemplate) {
          // If we are editing, see if the template already had a custom size
          const originalTemplate = templates.find(t => t.id === editingTemplate.id);
          const originalSize = originalTemplate ? paperSizes.find(p => p.id === originalTemplate.paper_size_id) : null;
          
          if (originalSize && !originalSize.is_system) {
            // Update the existing custom size
            await dbService.update('paper_sizes', originalSize.id, {
              name: `Custom ${formData.customWidth}x${formData.customHeight} ${formData.customUnit}`,
              width: Number(formData.customWidth),
              height: Number(formData.customHeight),
              unit: formData.customUnit
            });
            finalPaperSizeId = originalSize.id;
          } else {
            // Create a new custom size
            const newSize = await dbService.create<PaperSize>('paper_sizes', {
              name: `Custom ${formData.customWidth}x${formData.customHeight} ${formData.customUnit}`,
              width: Number(formData.customWidth),
              height: Number(formData.customHeight),
              unit: formData.customUnit,
              is_system: false,
              company_id: user.company_id
            });
            finalPaperSizeId = newSize;
          }
        } else {
          // Create new custom size for new template
          const newSize = await dbService.create<PaperSize>('paper_sizes', {
            name: `Custom ${formData.customWidth}x${formData.customHeight} ${formData.customUnit}`,
            width: Number(formData.customWidth),
            height: Number(formData.customHeight),
            unit: formData.customUnit,
            is_system: false,
            company_id: user.company_id
          });
          finalPaperSizeId = newSize;
        }
      }

      const templatePayload = {
        name: formData.name,
        description: formData.description,
        paper_size_id: finalPaperSizeId,
        orientation: formData.orientation,
        margin_top: Number(formData.margin_top),
        margin_bottom: Number(formData.margin_bottom),
        margin_left: Number(formData.margin_left),
        margin_right: Number(formData.margin_right),
        is_active: formData.is_active,
        company_id: user.company_id
      };

      if (view === 'edit' && editingTemplate) {
        await dbService.update('templates', editingTemplate.id, templatePayload);
        toast.success(language === 'ar' ? 'تم تعديل القالب بنجاح' : 'Template updated successfully');
      } else {
        await dbService.create('templates', templatePayload);
        toast.success(language === 'ar' ? 'تم إنشاء القالب بنجاح' : 'Template created successfully');
      }

      setView('list');
      setEditingTemplate(null);
      fetchData();
    } catch (error) {
      console.error('Submit failed:', error);
      toast.error(language === 'ar' ? 'فشلت العملية' : 'Operation failed');
    }
  };

  const triggerImportPlaceholder = () => {
    const msg = language === 'ar' 
      ? 'ستتوفر ميزة استيراد القوالب في المرحلة الثانية قريباً!' 
      : 'Import Template feature will be available in Phase 2 soon!';
    toast(msg, { icon: '📥', duration: 4000 });
  };

  const triggerExportPlaceholder = () => {
    const msg = language === 'ar' 
      ? 'ستتوفر ميزة تصدير القوالب في المرحلة الثانية قريباً!' 
      : 'Export Template feature will be available in Phase 2 soon!';
    toast(msg, { icon: '📤', duration: 4000 });
  };

  // Filter templates list
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && t.is_active) || 
                          (statusFilter === 'inactive' && !t.is_active);

    const matchesSize = sizeFilter === 'all' || t.paper_size_id === sizeFilter;

    return matchesSearch && matchesStatus && matchesSize;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col overflow-hidden text-zinc-800" dir={dir}>
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex flex-col space-y-6 overflow-hidden"
          >
            {/* Header */}
            <div className={`flex flex-col md:flex-row items-center justify-between gap-4 border-b border-zinc-100 pb-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-zinc-900 flex items-center gap-2">
                  <Settings className="text-emerald-600 animate-spin-slow" size={26} />
                  <span>{language === 'ar' ? 'إدارة قوالب الطباعة' : 'Print Templates Management'}</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-100/50">
                    {templates.length} {language === 'ar' ? 'قوالب' : 'Templates'}
                  </span>
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                  {language === 'ar' 
                    ? 'قم بإدارة وتكوين قوالب الطباعة وأحجام الورق والهوامش المخصصة.' 
                    : 'Manage and configure printing template layouts, paper sizes, and customized margins.'}
                </p>
              </div>

              {/* Top Action Buttons */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={triggerImportPlaceholder}
                  className="flex items-center gap-2 px-4 py-2 text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all font-semibold text-sm shadow-sm"
                >
                  <ArrowDownLeft size={16} className="text-zinc-500" />
                  <span>{language === 'ar' ? 'استيراد قالب' : 'Import Template'}</span>
                </button>
                <button
                  type="button"
                  onClick={triggerExportPlaceholder}
                  className="flex items-center gap-2 px-4 py-2 text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all font-semibold text-sm shadow-sm"
                >
                  <ArrowUpRight size={16} className="text-zinc-500" />
                  <span>{language === 'ar' ? 'تصدير قالب' : 'Export Template'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      name: '',
                      description: '',
                      paper_size_id: 'a4',
                      orientation: 'portrait',
                      margin_top: 10,
                      margin_bottom: 10,
                      margin_left: 10,
                      margin_right: 10,
                      is_active: true,
                      customWidth: 210,
                      customHeight: 297,
                      customUnit: 'mm'
                    });
                    setEditingTemplate(null);
                    setView('create');
                  }}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/25"
                >
                  <Plus size={18} />
                  <span>{language === 'ar' ? 'إنشاء قالب جديد' : 'Create New Template'}</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white border border-zinc-200/80 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-3 text-zinc-400`} size={18} />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'بحث باسم القالب أو الوصف...' : 'Search template name or description...'}
                  className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-500">{language === 'ar' ? 'تصفية:' : 'Filters:'}</span>
                </div>
                
                {/* Status Filter */}
                <select
                  className="bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                >
                  <option value="all">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
                  <option value="active">{language === 'ar' ? 'نشط فقط' : 'Active Only'}</option>
                  <option value="inactive">{language === 'ar' ? 'غير نشط فقط' : 'Inactive Only'}</option>
                </select>

                {/* Size Filter */}
                <select
                  className="bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={sizeFilter}
                  onChange={(e: any) => setSizeFilter(e.target.value)}
                >
                  <option value="all">{language === 'ar' ? 'جميع الأحجام' : 'All Paper Sizes'}</option>
                  {paperSizes.map(size => (
                    <option key={size.id} value={size.id}>{size.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* List Table */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-zinc-500 text-sm font-semibold">{language === 'ar' ? 'جاري التحميل...' : 'Loading templates...'}</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="bg-white border border-dashed border-zinc-200/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                <FileText size={48} className="text-zinc-300" />
                <h3 className="text-base font-bold text-zinc-700">{language === 'ar' ? 'لا يوجد قوالب' : 'No Templates Found'}</h3>
                <p className="text-zinc-500 text-xs max-w-sm">
                  {language === 'ar' 
                    ? 'لم يتم العثور على أي قوالب مطابقة لمعايير البحث الحالية.' 
                    : 'No print layouts matched your current search filters.'}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex-1 overflow-y-auto">
                <table className="w-full text-sm border-collapse text-left" dir={dir}>
                  <thead>
                    <tr className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-700 font-bold">
                      <th className={`px-6 py-4 text-xs font-extrabold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {language === 'ar' ? 'اسم القالب' : 'Template Name'}
                      </th>
                      <th className={`px-6 py-4 text-xs font-extrabold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {language === 'ar' ? 'حجم الورق' : 'Paper Size'}
                      </th>
                      <th className={`px-6 py-4 text-xs font-extrabold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {language === 'ar' ? 'الاتجاه' : 'Orientation'}
                      </th>
                      <th className={`px-6 py-4 text-xs font-extrabold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {language === 'ar' ? 'الهوامش (مم)' : 'Margins (mm)'}
                      </th>
                      <th className={`px-6 py-4 text-xs font-extrabold text-center`}>
                        {language === 'ar' ? 'حالة القالب' : 'Status'}
                      </th>
                      <th className={`px-6 py-4 text-xs font-extrabold text-center`}>
                        {language === 'ar' ? 'إجراءات' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {filteredTemplates.map((template) => {
                      const sizeObj = paperSizes.find(p => p.id === template.paper_size_id);
                      return (
                        <tr key={template.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <div className="font-bold text-zinc-950">{template.name}</div>
                            {template.description && (
                              <div className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{template.description}</div>
                            )}
                          </td>
                          <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            {sizeObj ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-zinc-800">{sizeObj.name}</span>
                                <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                                  {sizeObj.width} × {sizeObj.height} {sizeObj.unit}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-400 text-xs">—</span>
                            )}
                          </td>
                          <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} capitalize`}>
                            <span className="font-medium text-zinc-700">
                              {template.orientation === 'portrait'
                                ? (language === 'ar' ? 'رأسي (Portrait)' : 'Portrait')
                                : (language === 'ar' ? 'أفقي (Landscape)' : 'Landscape')}
                            </span>
                          </td>
                          <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} text-xs font-medium text-zinc-600`}>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 max-w-[160px]">
                              <span>{language === 'ar' ? 'أعلى:' : 'Top:'} {template.margin_top}</span>
                              <span>{language === 'ar' ? 'أسفل:' : 'Bottom:'} {template.margin_bottom}</span>
                              <span>{language === 'ar' ? 'يمين:' : 'Right:'} {template.margin_right}</span>
                              <span>{language === 'ar' ? 'يسار:' : 'Left:'} {template.margin_left}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                              template.is_active
                                ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/50'
                                : 'bg-zinc-50 text-zinc-500 border-zinc-200/50'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${template.is_active ? 'bg-emerald-600' : 'bg-zinc-400'}`}></span>
                              {template.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEdit(template)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title={language === 'ar' ? 'تعديل القالب' : 'Edit Template'}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(template)}
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title={language === 'ar' ? 'نسخ القالب' : 'Copy Template'}
                              >
                                <Copy size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(template.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title={language === 'ar' ? 'حذف القالب' : 'Delete Template'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        ) : (
          /* Create / Edit Form View */
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 flex flex-col space-y-6 overflow-y-auto"
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b border-zinc-100 pb-5 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <div>
                <h1 className="text-2xl font-black text-zinc-900">
                  {view === 'create'
                    ? (language === 'ar' ? 'إنشاء قالب طباعة جديد' : 'Create New Print Template')
                    : (language === 'ar' ? 'تعديل قالب الطباعة' : 'Edit Print Template')}
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                  {language === 'ar' 
                    ? 'قم بإدخال بيانات القالب وتحديد أبعاد الورق والهوامش.' 
                    : 'Fill in print layout parameters, paper size, and margins specifications.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setView('list')}
                className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-8">
              
              {/* Core Information Section */}
              <div className="space-y-5">
                <h3 className={`text-base font-bold text-zinc-900 border-l-4 border-emerald-600 ${dir === 'rtl' ? 'pr-3 border-r-4 border-l-0' : 'pl-3'} py-0.5`}>
                  {language === 'ar' ? 'المعلومات الأساسية' : 'Core Information'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'اسم القالب *' : 'Template Name *'}</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                      placeholder={language === 'ar' ? 'مثال: قالب فواتير المبيعات الافتراضي' : 'e.g., Default Sales Invoice Template'}
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'الوصف' : 'Description'}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                      placeholder={language === 'ar' ? 'تفاصيل إضافية عن القالب واستخداماته' : 'Additional details regarding this print layout'}
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Layout Specifications Section */}
              <div className="space-y-5 pt-2">
                <h3 className={`text-base font-bold text-zinc-900 border-l-4 border-emerald-600 ${dir === 'rtl' ? 'pr-3 border-r-4 border-l-0' : 'pl-3'} py-0.5`}>
                  {language === 'ar' ? 'إعدادات حجم واتجاه الصفحة' : 'Page Size & Orientation'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Paper Size Select */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'حجم الورق' : 'Paper Size'}</label>
                    <select
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-semibold"
                      value={formData.paper_size_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, paper_size_id: e.target.value }))}
                    >
                      {paperSizes.map(size => (
                        <option key={size.id} value={size.id}>
                          {size.name} ({size.width} × {size.height} {size.unit})
                        </option>
                      ))}
                      <option value="custom">{language === 'ar' ? 'أبعاد مخصصة (Custom)' : 'Custom Dimensions'}</option>
                    </select>
                  </div>

                  {/* Orientation Select */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'الاتجاه' : 'Orientation'}</label>
                    <div className="flex gap-4">
                      <label className="flex-1 flex items-center justify-center gap-2 border border-zinc-200 bg-zinc-50/50 p-3 rounded-xl cursor-pointer hover:bg-zinc-50 transition-all">
                        <input
                          type="radio"
                          name="orientation"
                          value="portrait"
                          checked={formData.orientation === 'portrait'}
                          onChange={() => setFormData(prev => ({ ...prev, orientation: 'portrait' }))}
                          className="accent-emerald-600"
                        />
                        <span className="text-xs font-bold text-zinc-800">{language === 'ar' ? 'رأسي (Portrait)' : 'Portrait'}</span>
                      </label>
                      
                      <label className="flex-1 flex items-center justify-center gap-2 border border-zinc-200 bg-zinc-50/50 p-3 rounded-xl cursor-pointer hover:bg-zinc-50 transition-all">
                        <input
                          type="radio"
                          name="orientation"
                          value="landscape"
                          checked={formData.orientation === 'landscape'}
                          onChange={() => setFormData(prev => ({ ...prev, orientation: 'landscape' }))}
                          className="accent-emerald-600"
                        />
                        <span className="text-xs font-bold text-zinc-800">{language === 'ar' ? 'أفقي (Landscape)' : 'Landscape'}</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Custom Dimensions Form Fields */}
                <AnimatePresence>
                  {formData.paper_size_id === 'custom' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-emerald-50/30 border border-emerald-100 p-5 rounded-2xl space-y-4 overflow-hidden"
                    >
                      <h4 className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        {language === 'ar' ? 'أبعاد الورق المخصص' : 'Custom Dimensions Specifications'}
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-600">{language === 'ar' ? 'العرض' : 'Width'}</label>
                          <input
                            required
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm"
                            value={formData.customWidth}
                            onChange={(e) => setFormData(prev => ({ ...prev, customWidth: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-600">{language === 'ar' ? 'الارتفاع' : 'Height'}</label>
                          <input
                            required
                            type="number"
                            step="0.01"
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm"
                            value={formData.customHeight}
                            onChange={(e) => setFormData(prev => ({ ...prev, customHeight: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-600">{language === 'ar' ? 'الوحدة' : 'Unit'}</label>
                          <select
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-semibold"
                            value={formData.customUnit}
                            onChange={(e) => setFormData(prev => ({ ...prev, customUnit: e.target.value }))}
                          >
                            <option value="mm">mm (مليمتر)</option>
                            <option value="in">in (بوصة)</option>
                            <option value="px">px (بكسل)</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Margins Section */}
              <div className="space-y-5 pt-2">
                <h3 className={`text-base font-bold text-zinc-900 border-l-4 border-emerald-600 ${dir === 'rtl' ? 'pr-3 border-r-4 border-l-0' : 'pl-3'} py-0.5`}>
                  {language === 'ar' ? 'إعدادات الهوامش (مليمتر)' : 'Margins Settings (mm)'}
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'الهامش العلوي' : 'Top Margin'}</label>
                    <input
                      required
                      type="number"
                      step="0.1"
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                      value={formData.margin_top}
                      onChange={(e) => setFormData(prev => ({ ...prev, margin_top: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'الهامش السفلي' : 'Bottom Margin'}</label>
                    <input
                      required
                      type="number"
                      step="0.1"
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                      value={formData.margin_bottom}
                      onChange={(e) => setFormData(prev => ({ ...prev, margin_bottom: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'الهامش الأيسر' : 'Left Margin'}</label>
                    <input
                      required
                      type="number"
                      step="0.1"
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                      value={formData.margin_left}
                      onChange={(e) => setFormData(prev => ({ ...prev, margin_left: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'الهامش الأيمن' : 'Right Margin'}</label>
                    <input
                      required
                      type="number"
                      step="0.1"
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                      value={formData.margin_right}
                      onChange={(e) => setFormData(prev => ({ ...prev, margin_right: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="space-y-4 pt-2">
                <h3 className={`text-base font-bold text-zinc-900 border-l-4 border-emerald-600 ${dir === 'rtl' ? 'pr-3 border-r-4 border-l-0' : 'pl-3'} py-0.5`}>
                  {language === 'ar' ? 'حالة النشاط' : 'Active Status'}
                </h3>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500/20"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-800 group-hover:text-zinc-950 transition-colors">
                      {language === 'ar' ? 'قالب نشط' : 'Active Template'}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {language === 'ar' 
                        ? 'تفعيل أو إلغاء تفعيل استخدام القالب للعمليات.' 
                        : 'Enable or disable the usage of this layout for prints.'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Footer Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-5 py-2.5 text-sm font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20"
                >
                  {view === 'create'
                    ? (language === 'ar' ? 'إنشاء القالب' : 'Create Template')
                    : (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
