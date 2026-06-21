import React, { useState, useEffect, useRef } from 'react';
import { dbService, apiRequest } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Edit2, Trash2, Copy, ArrowDownLeft, ArrowUpRight, X, Search, 
  SlidersHorizontal, Settings, FileText, AlertTriangle, Move, Maximize2, 
  Type, Image, Tag, Columns, Square, Circle, Minus, Table, QrCode, Barcode, 
  ZoomIn, ZoomOut, Save, Undo, RefreshCw 
} from 'lucide-react';
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

interface TemplateElement {
  id: string;
  type: 'text' | 'image' | 'logo' | 'line' | 'rectangle' | 'circle' | 'barcode' | 'qr' | 'variable' | 'field';
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  properties: {
    text?: string;
    imageUrl?: string;
    fontFamily?: string;
    fontSize?: number; // pt
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
    backgroundColor?: string;
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
    rotation?: number;
    opacity?: number;
    padding?: number;
    margin?: number;
    visibility?: 'always' | 'conditional';
  };
  binding?: string;
}

interface DetailsColumn {
  id: string;
  label: string;
  field: string;
  width: number; // percentage
}

interface TemplateLayout {
  headerHeight: number; // mm
  footerHeight: number; // mm
  header: TemplateElement[];
  details: {
    columns: DetailsColumn[];
    properties: {
      fontSize?: number;
      borderColor?: string;
      boldHeader?: boolean;
      backgroundColor?: string;
      color?: string;
    };
  };
  footer: TemplateElement[];
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
  layout?: TemplateLayout;
  created_at?: string;
  updated_at?: string;
}

interface OperationCategory {
  id: string;
  name: string;
  code: string;
  company_id: string;
}

interface OperationField {
  id: string;
  name: string;
  label: string;
  code: string;
  type: string;
}

interface TemplatesProps {
  initialView?: 'list' | 'create';
}

const DEFAULT_LAYOUT: TemplateLayout = {
  headerHeight: 70,
  footerHeight: 50,
  header: [
    {
      id: 'logo-default',
      type: 'logo',
      x: 10,
      y: 10,
      width: 40,
      height: 20,
      properties: {
        align: 'center'
      }
    },
    {
      id: 'title-default',
      type: 'text',
      x: 75,
      y: 12,
      width: 60,
      height: 10,
      properties: {
        text: 'فاتورة مبيعات',
        fontSize: 18,
        bold: true,
        align: 'center',
        color: '#18181b'
      }
    },
    {
      id: 'inv-num-label',
      type: 'text',
      x: 140,
      y: 10,
      width: 30,
      height: 6,
      properties: {
        text: 'رقم الفاتورة:',
        fontSize: 10,
        bold: true,
        align: 'left'
      }
    },
    {
      id: 'inv-num-val',
      type: 'variable',
      x: 170,
      y: 10,
      width: 30,
      height: 6,
      properties: {
        fontSize: 10,
        align: 'left'
      },
      binding: 'document_number'
    },
    {
      id: 'inv-date-label',
      type: 'text',
      x: 140,
      y: 18,
      width: 30,
      height: 6,
      properties: {
        text: 'تاريخ الفاتورة:',
        fontSize: 10,
        bold: true,
        align: 'left'
      }
    },
    {
      id: 'inv-date-val',
      type: 'variable',
      x: 170,
      y: 18,
      width: 30,
      height: 6,
      properties: {
        fontSize: 10,
        align: 'left'
      },
      binding: 'date'
    },
    {
      id: 'customer-label',
      type: 'text',
      x: 10,
      y: 40,
      width: 25,
      height: 6,
      properties: {
        text: 'العميل الموقر:',
        fontSize: 10,
        bold: true,
        align: 'right'
      }
    },
    {
      id: 'customer-val',
      type: 'variable',
      x: 35,
      y: 40,
      width: 80,
      height: 6,
      properties: {
        fontSize: 10,
        align: 'right'
      },
      binding: 'customer_name'
    },
    {
      id: 'line-separator',
      type: 'line',
      x: 10,
      y: 55,
      width: 190,
      height: 1,
      properties: {
        borderWidth: 1,
        borderColor: '#e4e4e7'
      }
    }
  ],
  details: {
    columns: [
      { id: 'product_name', label: 'اسم الصنف / Item', field: 'product_name', width: 45 },
      { id: 'product_code', label: 'الكود / Code', field: 'product_code', width: 15 },
      { id: 'quantity', label: 'الكمية / Qty', field: 'quantity', width: 10 },
      { id: 'unit_price', label: 'السعر / Price', field: 'unit_price', width: 15 },
      { id: 'total', label: 'الإجمالي / Total', field: 'total', width: 15 }
    ],
    properties: {
      fontSize: 10,
      borderColor: '#e4e4e7',
      boldHeader: true
    }
  },
  footer: [
    {
      id: 'total-label',
      type: 'text',
      x: 130,
      y: 10,
      width: 35,
      height: 6,
      properties: {
        text: 'إجمالي المستند:',
        fontSize: 11,
        bold: true,
        align: 'left'
      }
    },
    {
      id: 'total-val',
      type: 'variable',
      x: 165,
      y: 10,
      width: 35,
      height: 6,
      properties: {
        fontSize: 11,
        bold: true,
        align: 'left'
      },
      binding: 'total_amount'
    },
    {
      id: 'notes-title',
      type: 'text',
      x: 10,
      y: 10,
      width: 30,
      height: 6,
      properties: {
        text: 'الشروط والأحكام:',
        fontSize: 9,
        bold: true,
        align: 'right'
      }
    },
    {
      id: 'notes-val',
      type: 'variable',
      x: 10,
      y: 18,
      width: 100,
      height: 20,
      properties: {
        fontSize: 8,
        align: 'right'
      },
      binding: 'notes'
    }
  ]
};

const SYSTEM_VARIABLES = [
  { id: 'document_number', label: 'رقم المستند / Doc No', key: 'document_number' },
  { id: 'date', label: 'التاريخ / Date', key: 'date' },
  { id: 'time', label: 'الوقت / Time', key: 'time' },
  { id: 'customer_name', label: 'اسم العميل / Customer', key: 'customer_name' },
  { id: 'supplier_name', label: 'اسم المورد / Supplier', key: 'supplier_name' },
  { id: 'warehouse_name', label: 'المخزن / Warehouse', key: 'warehouse_name' },
  { id: 'currency_code', label: 'العملة / Currency', key: 'currency_code' },
  { id: 'user_name', label: 'المستخدم / User', key: 'user_name' },
  { id: 'company_name', label: 'اسم الشركة / Company', key: 'company_name' },
  { id: 'tax_number', label: 'الرقم الضريبي / Tax No', key: 'tax_number' }
];

export function Templates({ initialView = 'list' }: TemplatesProps) {
  const { dir, language } = useLanguage();
  const { user } = useAuth();
  const [view, setView] = useState<'list' | 'create' | 'edit'>(initialView);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>([]);
  const [categories, setCategories] = useState<OperationCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic Fields States
  const [headerCategoryId, setHeaderCategoryId] = useState<string>('');
  const [detailsCategoryId, setDetailsCategoryId] = useState<string>('');
  const [headerFields, setHeaderFields] = useState<OperationField[]>([]);
  const [detailsFields, setDetailsFields] = useState<OperationField[]>([]);

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sizeFilter, setSizeFilter] = useState('all');

  // Designer Canvas Configuration
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'header' | 'footer' | 'details' | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(3); // pixels per mm

  // Core Form State
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
    customWidth: 210,
    customHeight: 297,
    customUnit: 'mm'
  });

  // Visual Designer Layout State
  const [designerLayout, setDesignerLayout] = useState<TemplateLayout>(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));

  // Drag & drop mouse coordinates
  const canvasRefs = {
    header: useRef<HTMLDivElement>(null),
    footer: useRef<HTMLDivElement>(null)
  };
  const [mouseDragState, setMouseDragState] = useState<{
    elementId: string;
    section: 'header' | 'footer';
    action: 'move' | 'resize';
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Sync view when prop updates
  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch dynamic fields when category changes
  useEffect(() => {
    if (headerCategoryId) {
      fetchFields(headerCategoryId, 'header');
    } else {
      setHeaderFields([]);
    }
  }, [headerCategoryId]);

  useEffect(() => {
    if (detailsCategoryId) {
      fetchFields(detailsCategoryId, 'details');
    } else {
      setDetailsFields([]);
    }
  }, [detailsCategoryId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [allTemplates, allSizes, allCats] = await Promise.all([
        dbService.list<Template>('templates', user?.company_id || ''),
        dbService.list<PaperSize>('paper_sizes', user?.company_id || ''),
        dbService.list<OperationCategory>('operation_categories', user?.company_id || '')
      ]);
      setTemplates(allTemplates);
      setPaperSizes(allSizes);
      setCategories(allCats.filter(c => (c as any).is_final));
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(language === 'ar' ? 'فشل تحميل البيانات' : 'Failed to fetch templates data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (catId: string, type: 'header' | 'details') => {
    try {
      const data = await apiRequest<OperationField[]>(`/operation_fields/by-category/${catId}`);
      if (type === 'header') {
        setHeaderFields(data);
      } else {
        setDetailsFields(data);
      }
    } catch (e) {
      console.error('Failed to load fields:', e);
    }
  };

  // Helper to determine paper bounds in mm
  const getPaperBounds = () => {
    const sizeObj = paperSizes.find(p => p.id === formData.paper_size_id);
    let width = 210;
    let height = 297;
    
    if (formData.paper_size_id === 'custom') {
      width = formData.customWidth;
      height = formData.customHeight;
    } else if (sizeObj) {
      width = Number(sizeObj.width);
      height = Number(sizeObj.height);
    }

    if (formData.orientation === 'landscape') {
      return { width: height, height: width };
    }
    return { width, height };
  };

  const { width: paperWidth } = getPaperBounds();
  const printableWidth = paperWidth - formData.margin_left - formData.margin_right;

  // Add Element to Canvas
  const handleAddElement = (type: TemplateElement['type'], binding?: string, label?: string) => {
    const section = selectedSection === 'footer' ? 'footer' : 'header';
    const id = `${type}-${Date.now()}`;
    const newElement: TemplateElement = {
      id,
      type,
      x: 10,
      y: 10,
      width: type === 'line' ? 100 : 50,
      height: type === 'line' ? 2 : 10,
      properties: {
        text: label || (type === 'text' ? 'نص ثابت / Text' : ''),
        fontFamily: 'Cairo',
        fontSize: 10,
        align: dir === 'rtl' ? 'right' : 'left',
        color: '#000000',
        borderWidth: type === 'line' || type === 'rectangle' ? 1 : 0,
        borderColor: '#000000'
      },
      binding
    };

    setDesignerLayout(prev => ({
      ...prev,
      [section]: [...prev[section], newElement]
    }));
    setSelectedElementId(id);
    setSelectedSection(section);
  };

  // Drag-and-drop helper from sidebar toolbox
  const handleDragStart = (e: React.DragEvent, type: string, binding?: string, label?: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, binding, label }));
  };

  const handleCanvasDrop = (e: React.DragEvent, section: 'header' | 'footer') => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    try {
      const { type, binding, label } = JSON.parse(dataStr);
      const canvasRef = canvasRefs[section].current;
      if (!canvasRef) return;

      const rect = canvasRef.getBoundingClientRect();
      // Calculate coordinates in mm
      const x = Math.max(0, Math.min(printableWidth - 30, (e.clientX - rect.left) / zoomScale));
      const sectionHeight = section === 'header' ? designerLayout.headerHeight : designerLayout.footerHeight;
      const y = Math.max(0, Math.min(sectionHeight - 10, (e.clientY - rect.top) / zoomScale));

      const id = `${type}-${Date.now()}`;
      const newElement: TemplateElement = {
        id,
        type: type as TemplateElement['type'],
        x: Math.round(x),
        y: Math.round(y),
        width: type === 'line' ? 100 : 50,
        height: type === 'line' ? 1.5 : 10,
        properties: {
          text: label || (type === 'text' ? 'نص ثابت / Text' : ''),
          fontFamily: 'Cairo',
          fontSize: 10,
          align: dir === 'rtl' ? 'right' : 'left',
          color: '#000000',
          borderWidth: type === 'line' || type === 'rectangle' ? 1 : 0,
          borderColor: '#000000'
        },
        binding
      };

      setDesignerLayout(prev => ({
        ...prev,
        [section]: [...prev[section], newElement]
      }));
      setSelectedElementId(id);
      setSelectedSection(section);
    } catch (err) {
      console.error(err);
    }
  };

  // Native mouse drag handler
  const handleMouseDown = (
    e: React.MouseEvent, 
    elementId: string, 
    section: 'header' | 'footer', 
    action: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedElementId(elementId);
    setSelectedSection(section);

    const sectionElements = designerLayout[section];
    const elem = sectionElements.find(el => el.id === elementId);
    if (!elem) return;

    setMouseDragState({
      elementId,
      section,
      action,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: elem.x,
      startTop: elem.y,
      startWidth: elem.width,
      startHeight: elem.height
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseDragState) return;

      const { elementId, section, action, startX, startY, startLeft, startTop, startWidth, startHeight } = mouseDragState;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Convert delta pixel to mm
      const deltaMM_X = deltaX / zoomScale;
      const deltaMM_Y = deltaY / zoomScale;

      setDesignerLayout(prev => {
        const elements = [...prev[section]];
        const index = elements.findIndex(el => el.id === elementId);
        if (index === -1) return prev;

        const elem = { ...elements[index] };
        
        if (action === 'move') {
          const maxLeft = printableWidth - elem.width;
          const sectionHeight = section === 'header' ? prev.headerHeight : prev.footerHeight;
          const maxTop = sectionHeight - elem.height;

          elem.x = Math.round(Math.max(0, Math.min(maxLeft, startLeft + deltaMM_X)));
          elem.y = Math.round(Math.max(0, Math.min(maxTop, startTop + deltaMM_Y)));
        } else {
          // Resize
          elem.width = Math.round(Math.max(5, startWidth + deltaMM_X));
          elem.height = Math.round(Math.max(1.5, startHeight + deltaMM_Y));
        }

        elements[index] = elem;
        return {
          ...prev,
          [section]: elements
        };
      });
    };

    const handleMouseUp = () => {
      if (mouseDragState) {
        setMouseDragState(null);
      }
    };

    if (mouseDragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [mouseDragState, zoomScale, printableWidth]);

  // Edit individual properties of selected element
  const handleUpdateElementProperty = (key: string, value: any) => {
    if (!selectedElementId || !selectedSection || selectedSection === 'details') return;

    setDesignerLayout(prev => {
      const elements = [...prev[selectedSection]];
      const index = elements.findIndex(el => el.id === selectedElementId);
      if (index === -1) return prev;

      const elem = { ...elements[index] };
      if (['x', 'y', 'width', 'height', 'binding'].includes(key)) {
        (elem as any)[key] = value;
      } else {
        elem.properties = {
          ...elem.properties,
          [key]: value
        };
      }

      elements[index] = elem;
      return {
        ...prev,
        [selectedSection]: elements
      };
    });
  };

  // Delete selected element
  const handleDeleteElement = () => {
    if (!selectedElementId || !selectedSection || selectedSection === 'details') return;

    setDesignerLayout(prev => ({
      ...prev,
      [selectedSection]: prev[selectedSection].filter(el => el.id !== selectedElementId)
    }));
    setSelectedElementId(null);
  };

  // Duplicate/Clone element
  const handleDuplicateElement = () => {
    if (!selectedElementId || !selectedSection || selectedSection === 'details') return;

    const source = designerLayout[selectedSection].find(el => el.id === selectedElementId);
    if (!source) return;

    const id = `${source.type}-${Date.now()}`;
    const clone: TemplateElement = JSON.parse(JSON.stringify(source));
    clone.id = id;
    clone.x = Math.min(printableWidth - clone.width, clone.x + 5);
    clone.y = clone.y + 5;

    setDesignerLayout(prev => ({
      ...prev,
      [selectedSection]: [...prev[selectedSection], clone]
    }));
    setSelectedElementId(id);
  };

  // Forms submit logic
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

    if (template.layout) {
      setDesignerLayout(JSON.parse(JSON.stringify(template.layout)));
    } else {
      setDesignerLayout(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));
    }

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

    if (template.layout) {
      setDesignerLayout(JSON.parse(JSON.stringify(template.layout)));
    } else {
      setDesignerLayout(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));
    }

    setEditingTemplate(null);
    setView('create');
    toast.success(language === 'ar' ? 'تم نسخ بيانات القالب بنجاح' : 'Template design copied successfully');
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
          const originalTemplate = templates.find(t => t.id === editingTemplate.id);
          const originalSize = originalTemplate ? paperSizes.find(p => p.id === originalTemplate.paper_size_id) : null;
          
          if (originalSize && !originalSize.is_system) {
            await dbService.update('paper_sizes', originalSize.id, {
              name: `Custom ${formData.customWidth}x${formData.customHeight} ${formData.customUnit}`,
              width: Number(formData.customWidth),
              height: Number(formData.customHeight),
              unit: formData.customUnit
            });
            finalPaperSizeId = originalSize.id;
          } else {
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
        layout: designerLayout, // Save designer JSON layout
        company_id: user.company_id
      };

      if (view === 'edit' && editingTemplate) {
        await dbService.update('templates', editingTemplate.id, templatePayload);
        toast.success(language === 'ar' ? 'تم حفظ تعديلات القالب والتصميم بنجاح' : 'Template layout saved successfully');
      } else {
        await dbService.create('templates', templatePayload);
        toast.success(language === 'ar' ? 'تم إنشاء القالب والتصميم بنجاح' : 'Template layout created successfully');
      }

      setView('list');
      setEditingTemplate(null);
      setSelectedElementId(null);
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

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && t.is_active) || 
                          (statusFilter === 'inactive' && !t.is_active);

    const matchesSize = sizeFilter === 'all' || t.paper_size_id === sizeFilter;

    return matchesSearch && matchesStatus && matchesSize;
  });

  const getSelectedElement = () => {
    if (!selectedElementId || !selectedSection || selectedSection === 'details') return null;
    return designerLayout[selectedSection].find(el => el.id === selectedElementId) || null;
  };

  const activeElement = getSelectedElement();

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col overflow-hidden text-zinc-800" dir={dir}>
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
                  <span>{language === 'ar' ? 'مصمم قوالب الطباعة' : 'Visual Print Templates Designer'}</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-100/50">
                    {templates.length} {language === 'ar' ? 'قوالب' : 'Templates'}
                  </span>
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                  {language === 'ar' 
                    ? 'صمم قوالب طباعة الفواتير والسندات بالكامل بالسحب والإفلات وتغيير الخصائص.' 
                    : 'Design billing & vouchers template layouts dynamically with drag & drop mechanics.'}
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
                    setDesignerLayout(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));
                    setEditingTemplate(null);
                    setSelectedElementId(null);
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
                                title={language === 'ar' ? 'تعديل التصميم' : 'Edit Design'}
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
          /* CREATE / EDIT TEMPLATE DESIGNER WORKSPACE */
          <motion.div
            key="designer"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            className="flex-1 flex flex-col space-y-4 overflow-hidden h-full"
          >
            {/* Top Workspace Header */}
            <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-200 pb-3 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-zinc-900">
                    {view === 'create'
                      ? (language === 'ar' ? 'مصمم قوالب جديد' : 'New Template Designer')
                      : (language === 'ar' ? `تعديل القالب: ${formData.name}` : `Edit Designer: ${formData.name}`)}
                  </h1>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <input
                    required
                    type="text"
                    placeholder={language === 'ar' ? 'اسم القالب *' : 'Template Name *'}
                    className="px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-semibold outline-none focus:bg-white focus:border-emerald-600 transition-all w-60"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    type="text"
                    placeholder={language === 'ar' ? 'الوصف' : 'Description'}
                    className="px-3 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-sm outline-none focus:bg-white focus:border-emerald-600 transition-all w-80"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>

              {/* Workspace Action Buttons */}
              <div className="flex items-center gap-3">
                {/* Zoom Controls */}
                <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setZoomScale(prev => Math.max(1.5, prev - 0.25))}
                    className="p-1.5 hover:bg-white rounded-lg text-zinc-600 transition-all"
                    title={language === 'ar' ? 'تصغير' : 'Zoom Out'}
                  >
                    <ZoomOut size={16} />
                  </button>
                  <span className="text-xs font-bold px-2 text-zinc-500 w-16 text-center">
                    {Math.round((zoomScale / 3) * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomScale(prev => Math.min(6, prev + 0.25))}
                    className="p-1.5 hover:bg-white rounded-lg text-zinc-600 transition-all"
                    title={language === 'ar' ? 'تكبير' : 'Zoom In'}
                  >
                    <ZoomIn size={16} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  {language === 'ar' ? 'خروج' : 'Exit'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/25"
                >
                  <Save size={18} />
                  <span>{language === 'ar' ? 'حفظ التصميم' : 'Save Design'}</span>
                </button>
              </div>
            </div>

            {/* THREE-COLUMN WORKSPACE */}
            <div className="flex-1 flex overflow-hidden gap-4">
              
              {/* 1. LEFT SIDEBAR: TOOLBOX */}
              <div className="w-80 bg-white border border-zinc-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                  <h3 className="text-sm font-black text-zinc-900">{language === 'ar' ? 'لوحة العناصر (Toolbox)' : 'Element Toolbox'}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{language === 'ar' ? 'اسحب العنصر إلى مساحة العمل مباشرة.' : 'Drag any element onto the canvas layout.'}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Static Elements */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'عناصر ثابتة' : 'Static Elements'}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { type: 'text', label: 'نص ثابت', icon: Type },
                        { type: 'line', label: 'خط فاصل', icon: Minus },
                        { type: 'rectangle', label: 'مستطيل', icon: Square },
                        { type: 'circle', label: 'دائرة', icon: Circle },
                        { type: 'logo', label: 'شعار الشركة', icon: Image },
                        { type: 'image', label: 'صورة مخصصة', icon: Image },
                        { type: 'qr', label: 'QR Code', icon: QrCode },
                        { type: 'barcode', label: 'Barcode', icon: Barcode }
                      ].map(el => (
                        <div
                          key={el.type}
                          draggable
                          onDragStart={(e) => handleDragStart(e, el.type)}
                          onClick={() => handleAddElement(el.type as any)}
                          className="flex items-center gap-2 p-2.5 bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200/60 rounded-xl cursor-grab active:cursor-grabbing text-xs font-bold transition-all"
                        >
                          <el.icon size={15} className="text-zinc-500" />
                          <span>{language === 'ar' ? el.label : el.type.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* System Variables */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'متغيرات النظام الأساسية' : 'System Bindings'}</h4>
                    <div className="max-h-48 overflow-y-auto border border-zinc-100 rounded-xl divide-y divide-zinc-50">
                      {SYSTEM_VARIABLES.map(v => (
                        <div
                          key={v.key}
                          draggable
                          onDragStart={(e) => handleDragStart(e, 'variable', v.key, v.label)}
                          onClick={() => handleAddElement('variable', v.key, v.label)}
                          className="flex items-center justify-between p-2.5 hover:bg-zinc-50 cursor-grab active:cursor-grabbing text-xs transition-colors"
                        >
                          <span className="font-semibold text-zinc-800">{v.label}</span>
                          <Tag size={12} className="text-zinc-400" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Fields - Header Level */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'حقول ديناميكية للهيدر' : 'Dynamic Header Fields'}</h4>
                    <select
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none"
                      value={headerCategoryId}
                      onChange={(e) => setHeaderCategoryId(e.target.value)}
                    >
                      <option value="">{language === 'ar' ? 'اختر تصنيف العملية...' : 'Select Operation Category...'}</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    {headerCategoryId && headerFields.length === 0 && (
                      <p className="text-[11px] text-zinc-400 text-center py-2">{language === 'ar' ? 'لا يوجد حقول لهذا التصنيف' : 'No fields found'}</p>
                    )}

                    {headerFields.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border border-zinc-100 rounded-xl divide-y divide-zinc-50">
                        {headerFields.map(f => (
                          <div
                            key={f.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, 'field', f.code, f.label)}
                            onClick={() => handleAddElement('field', f.code, f.label)}
                            className="flex items-center justify-between p-2.5 hover:bg-zinc-50 cursor-grab active:cursor-grabbing text-xs transition-colors"
                          >
                            <span className="font-semibold text-zinc-800">{f.label}</span>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{f.code}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dynamic Fields - Details Level */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'أعمدة التفاصيل الإضافية' : 'Dynamic Detail Columns'}</h4>
                    <select
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none"
                      value={detailsCategoryId}
                      onChange={(e) => setDetailsCategoryId(e.target.value)}
                    >
                      <option value="">{language === 'ar' ? 'اختر تصنيف التفاصيل...' : 'Select Details Category...'}</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    {detailsCategoryId && detailsFields.length === 0 && (
                      <p className="text-[11px] text-zinc-400 text-center py-2">{language === 'ar' ? 'لا يوجد حقول للتفاصيل' : 'No details fields'}</p>
                    )}

                    {detailsFields.length > 0 && (
                      <div className="max-h-40 overflow-y-auto border border-zinc-100 rounded-xl divide-y divide-zinc-50">
                        {detailsFields.map(f => {
                          const isColumnAdded = designerLayout.details.columns.some(col => col.id === f.id);
                          return (
                            <div
                              key={f.id}
                              className="flex items-center justify-between p-2.5 hover:bg-zinc-50 text-xs transition-colors"
                            >
                              <span className="font-semibold text-zinc-800">{f.label}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isColumnAdded) {
                                    setDesignerLayout(prev => ({
                                      ...prev,
                                      details: {
                                        ...prev.details,
                                        columns: prev.details.columns.filter(col => col.id !== f.id)
                                      }
                                    }));
                                  } else {
                                    setDesignerLayout(prev => ({
                                      ...prev,
                                      details: {
                                        ...prev.details,
                                        columns: [...prev.details.columns, { id: f.id, label: f.label, field: f.code, width: 10 }]
                                      }
                                    }));
                                    toast.success(language === 'ar' ? 'تم إضافة العمود لجدول التفاصيل' : 'Column added to Details Table');
                                  }
                                }}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                  isColumnAdded 
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                {isColumnAdded ? (language === 'ar' ? 'حذف' : 'Remove') : (language === 'ar' ? 'إضافة' : 'Add')}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. CENTER WORKSPACE: DESIGNER CANVAS */}
              <div className="flex-1 bg-zinc-100 border border-zinc-200 rounded-2xl overflow-auto p-8 flex items-start justify-center relative shadow-inner">
                {/* Simulated Paper Sheets */}
                <div 
                  className="bg-white border border-zinc-300 shadow-xl transition-all relative overflow-hidden"
                  style={{
                    width: `${printableWidth * zoomScale}px`,
                    paddingTop: `${formData.margin_top * zoomScale}px`,
                    paddingBottom: `${formData.margin_bottom * zoomScale}px`,
                    paddingLeft: `${formData.margin_left * zoomScale}px`,
                    paddingRight: `${formData.margin_right * zoomScale}px`
                  }}
                  onClick={() => {
                    setSelectedElementId(null);
                    setSelectedSection(null);
                  }}
                >
                  
                  {/* SECTION 1: HEADER CANVAS */}
                  <div 
                    ref={canvasRefs.header}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleCanvasDrop(e, 'header')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSection('header');
                      setSelectedElementId(null);
                    }}
                    className={`border border-dashed transition-all relative select-none ${
                      selectedSection === 'header' && !selectedElementId 
                        ? 'border-emerald-500 bg-emerald-50/10' 
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                    style={{
                      height: `${designerLayout.headerHeight * zoomScale}px`,
                      width: '100%'
                    }}
                  >
                    {/* Header Section Badge */}
                    <div className="absolute top-1 right-2 text-[9px] font-bold text-zinc-400 uppercase pointer-events-none select-none">
                      Header / الهيدر ({designerLayout.headerHeight}mm)
                    </div>

                    {/* Render Header Elements */}
                    {designerLayout.header.map(el => (
                      <div
                        key={el.id}
                        onMouseDown={(e) => handleMouseDown(e, el.id, 'header', 'move')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(el.id);
                          setSelectedSection('header');
                        }}
                        className={`absolute group cursor-move select-none ${
                          selectedElementId === el.id 
                            ? 'ring-2 ring-emerald-500 ring-offset-1 bg-emerald-50/30' 
                            : 'hover:ring-1 hover:ring-zinc-300'
                        }`}
                        style={{
                          left: `${el.x * zoomScale}px`,
                          top: `${el.y * zoomScale}px`,
                          width: `${el.width * zoomScale}px`,
                          height: `${el.height * zoomScale}px`,
                          fontFamily: el.properties.fontFamily || 'Cairo',
                          fontSize: `${(el.properties.fontSize || 10) * (zoomScale / 3)}pt`,
                          fontWeight: el.properties.bold ? 'bold' : 'normal',
                          fontStyle: el.properties.italic ? 'italic' : 'normal',
                          textDecoration: el.properties.underline ? 'underline' : 'none',
                          color: el.properties.color || '#000000',
                          backgroundColor: el.properties.backgroundColor || 'transparent',
                          border: el.properties.borderWidth 
                            ? `${el.properties.borderWidth}px solid ${el.properties.borderColor || '#000'}` 
                            : 'none',
                          textAlign: el.properties.align || 'left',
                          opacity: el.properties.opacity !== undefined ? el.properties.opacity : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: el.properties.align === 'center' 
                            ? 'center' 
                            : el.properties.align === 'right' 
                              ? 'flex-end' 
                              : 'flex-start',
                          padding: `${(el.properties.padding || 0) * zoomScale}px`
                        }}
                      >
                        {/* Rendering element contents */}
                        {el.type === 'text' && (el.properties.text || 'Text')}
                        {el.type === 'variable' && (
                          <span className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-1 py-0.5 rounded text-[10px] select-none font-bold">
                            {"{"}{SYSTEM_VARIABLES.find(v => v.key === el.binding)?.label || el.binding}{"}"}
                          </span>
                        )}
                        {el.type === 'field' && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.5 rounded text-[10px] select-none font-bold">
                            {"{"}{el.properties.text || el.binding}{"}"}
                          </span>
                        )}
                        {el.type === 'logo' && (
                          <div className="w-full h-full border border-dashed border-zinc-300 rounded flex items-center justify-center bg-zinc-50/50 text-[10px] font-extrabold text-zinc-400">
                            [ COMPANY LOGO ]
                          </div>
                        )}
                        {el.type === 'image' && (
                          <div className="w-full h-full border border-dashed border-zinc-300 rounded flex items-center justify-center bg-zinc-50/50 text-[10px] font-extrabold text-zinc-400">
                            [ CUSTOM IMAGE ]
                          </div>
                        )}
                        {el.type === 'line' && (
                          <div className="w-full" style={{ borderTop: `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` }} />
                        )}
                        {el.type === 'rectangle' && <div className="w-full h-full" />}
                        {el.type === 'circle' && <div className="w-full h-full rounded-full border border-zinc-950" style={{ borderColor: el.properties.borderColor }} />}
                        {el.type === 'qr' && (
                          <div className="w-full h-full bg-zinc-100 flex flex-col items-center justify-center border border-zinc-200 text-zinc-400">
                            <QrCode size={Math.min(el.width, el.height) * zoomScale * 0.7} />
                          </div>
                        )}
                        {el.type === 'barcode' && (
                          <div className="w-full h-full bg-zinc-100 flex flex-col items-center justify-center border border-zinc-200 text-zinc-400">
                            <Barcode size={Math.min(el.width, el.height) * zoomScale * 0.7} />
                          </div>
                        )}

                        {/* Resize handle */}
                        {selectedElementId === el.id && (
                          <div
                            onMouseDown={(e) => handleMouseDown(e, el.id, 'header', 'resize')}
                            className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-600 border border-white cursor-se-resize z-10 shadow-sm rounded-full"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* SECTION 2: DETAILS TABLE CANVAS */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSection('details');
                      setSelectedElementId(null);
                    }}
                    className={`border transition-all my-4 relative select-none ${
                      selectedSection === 'details' 
                        ? 'border-emerald-500 bg-emerald-50/10' 
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="absolute -top-4 right-2 text-[9px] font-bold text-zinc-400 uppercase pointer-events-none select-none">
                      Details Table / جدول التفاصيل
                    </div>

                    <table 
                      className="w-full text-zinc-800 border-collapse"
                      style={{
                        fontSize: `${(designerLayout.details.properties.fontSize || 10) * (zoomScale / 3)}pt`
                      }}
                    >
                      <thead>
                        <tr 
                          className="bg-zinc-50 border-b border-zinc-200 font-bold"
                          style={{
                            borderColor: designerLayout.details.properties.borderColor || '#e4e4e7'
                          }}
                        >
                          {designerLayout.details.columns.map(col => (
                            <th 
                              key={col.id} 
                              className={`p-2 border-r last:border-r-0 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                              style={{
                                width: `${col.width}%`,
                                borderColor: designerLayout.details.properties.borderColor || '#e4e4e7',
                                fontWeight: designerLayout.details.properties.boldHeader ? 'bold' : 'normal'
                              }}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2].map(rowIdx => (
                          <tr 
                            key={rowIdx} 
                            className="border-b last:border-b-0"
                            style={{
                              borderColor: designerLayout.details.properties.borderColor || '#e4e4e7'
                            }}
                          >
                            {designerLayout.details.columns.map(col => (
                              <td 
                                key={col.id} 
                                className={`p-2 border-r last:border-r-0 text-zinc-400 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                style={{
                                  borderColor: designerLayout.details.properties.borderColor || '#e4e4e7'
                                }}
                              >
                                {col.field === 'product_name' && `صنف تجريبي رقم ${rowIdx}`}
                                {col.field === 'product_code' && `PRD-00${rowIdx}`}
                                {col.field === 'quantity' && `${rowIdx * 2}`}
                                {col.field === 'unit_price' && `${rowIdx * 100}`}
                                {col.field === 'total' && `${rowIdx * 200}`}
                                {!['product_name', 'product_code', 'quantity', 'unit_price', 'total'].includes(col.field) && `[${col.label}]`}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* SECTION 3: FOOTER CANVAS */}
                  <div 
                    ref={canvasRefs.footer}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleCanvasDrop(e, 'footer')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSection('footer');
                      setSelectedElementId(null);
                    }}
                    className={`border border-dashed transition-all relative select-none ${
                      selectedSection === 'footer' && !selectedElementId 
                        ? 'border-emerald-500 bg-emerald-50/10' 
                        : 'border-zinc-200 hover:border-zinc-300'
                    }`}
                    style={{
                      height: `${designerLayout.footerHeight * zoomScale}px`,
                      width: '100%'
                    }}
                  >
                    {/* Footer Section Badge */}
                    <div className="absolute top-1 right-2 text-[9px] font-bold text-zinc-400 uppercase pointer-events-none select-none">
                      Footer / الفوتر ({designerLayout.footerHeight}mm)
                    </div>

                    {/* Render Footer Elements */}
                    {designerLayout.footer.map(el => (
                      <div
                        key={el.id}
                        onMouseDown={(e) => handleMouseDown(e, el.id, 'footer', 'move')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(el.id);
                          setSelectedSection('footer');
                        }}
                        className={`absolute group cursor-move select-none ${
                          selectedElementId === el.id 
                            ? 'ring-2 ring-emerald-500 ring-offset-1 bg-emerald-50/30' 
                            : 'hover:ring-1 hover:ring-zinc-300'
                        }`}
                        style={{
                          left: `${el.x * zoomScale}px`,
                          top: `${el.y * zoomScale}px`,
                          width: `${el.width * zoomScale}px`,
                          height: `${el.height * zoomScale}px`,
                          fontFamily: el.properties.fontFamily || 'Cairo',
                          fontSize: `${(el.properties.fontSize || 10) * (zoomScale / 3)}pt`,
                          fontWeight: el.properties.bold ? 'bold' : 'normal',
                          fontStyle: el.properties.italic ? 'italic' : 'normal',
                          textDecoration: el.properties.underline ? 'underline' : 'none',
                          color: el.properties.color || '#000000',
                          backgroundColor: el.properties.backgroundColor || 'transparent',
                          border: el.properties.borderWidth 
                            ? `${el.properties.borderWidth}px solid ${el.properties.borderColor || '#000'}` 
                            : 'none',
                          textAlign: el.properties.align || 'left',
                          opacity: el.properties.opacity !== undefined ? el.properties.opacity : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: el.properties.align === 'center' 
                            ? 'center' 
                            : el.properties.align === 'right' 
                              ? 'flex-end' 
                              : 'flex-start',
                          padding: `${(el.properties.padding || 0) * zoomScale}px`
                        }}
                      >
                        {/* Rendering element contents */}
                        {el.type === 'text' && (el.properties.text || 'Text')}
                        {el.type === 'variable' && (
                          <span className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-1 py-0.5 rounded text-[10px] select-none font-bold">
                            {"{"}{SYSTEM_VARIABLES.find(v => v.key === el.binding)?.label || el.binding}{"}"}
                          </span>
                        )}
                        {el.type === 'field' && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.5 rounded text-[10px] select-none font-bold">
                            {"{"}{el.properties.text || el.binding}{"}"}
                          </span>
                        )}
                        {el.type === 'logo' && (
                          <div className="w-full h-full border border-dashed border-zinc-300 rounded flex items-center justify-center bg-zinc-50/50 text-[10px] font-extrabold text-zinc-400">
                            [ COMPANY LOGO ]
                          </div>
                        )}
                        {el.type === 'image' && (
                          <div className="w-full h-full border border-dashed border-zinc-300 rounded flex items-center justify-center bg-zinc-50/50 text-[10px] font-extrabold text-zinc-400">
                            [ CUSTOM IMAGE ]
                          </div>
                        )}
                        {el.type === 'line' && (
                          <div className="w-full" style={{ borderTop: `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` }} />
                        )}
                        {el.type === 'rectangle' && <div className="w-full h-full" />}
                        {el.type === 'circle' && <div className="w-full h-full rounded-full border border-zinc-950" style={{ borderColor: el.properties.borderColor }} />}
                        {el.type === 'qr' && (
                          <div className="w-full h-full bg-zinc-100 flex flex-col items-center justify-center border border-zinc-200 text-zinc-400">
                            <QrCode size={Math.min(el.width, el.height) * zoomScale * 0.7} />
                          </div>
                        )}
                        {el.type === 'barcode' && (
                          <div className="w-full h-full bg-zinc-100 flex flex-col items-center justify-center border border-zinc-200 text-zinc-400">
                            <Barcode size={Math.min(el.width, el.height) * zoomScale * 0.7} />
                          </div>
                        )}

                        {/* Resize handle */}
                        {selectedElementId === el.id && (
                          <div
                            onMouseDown={(e) => handleMouseDown(e, el.id, 'footer', 'resize')}
                            className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-600 border border-white cursor-se-resize z-10 shadow-sm rounded-full"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              </div>

              {/* 3. RIGHT SIDEBAR: PROPERTIES PANEL */}
              <div className="w-80 bg-white border border-zinc-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                
                {activeElement ? (
                  /* Element properties view */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-black text-zinc-900">{language === 'ar' ? 'خصائص العنصر' : 'Element Properties'}</h3>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDuplicateElement}
                          className="p-1 hover:bg-zinc-200 text-amber-600 rounded transition-colors"
                          title={language === 'ar' ? 'تكرار العنصر' : 'Duplicate'}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteElement}
                          className="p-1 hover:bg-zinc-200 text-red-600 rounded transition-colors"
                          title={language === 'ar' ? 'حذف العنصر' : 'Delete'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                      {/* Dimensions Settings */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'الأبعاد والموقع (مم)' : 'Dimensions (mm)'}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">X (أفقي)</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={activeElement.x}
                              onChange={(e) => handleUpdateElementProperty('x', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">Y (رأسي)</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={activeElement.y}
                              onChange={(e) => handleUpdateElementProperty('y', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'العرض' : 'Width'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={activeElement.width}
                              onChange={(e) => handleUpdateElementProperty('width', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الارتفاع' : 'Height'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={activeElement.height}
                              onChange={(e) => handleUpdateElementProperty('height', parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Content Settings */}
                      {activeElement.type === 'text' && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-600">{language === 'ar' ? 'النص المعروض' : 'Text Content'}</label>
                          <textarea
                            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-emerald-600"
                            rows={3}
                            value={activeElement.properties.text}
                            onChange={(e) => handleUpdateElementProperty('text', e.target.value)}
                          />
                        </div>
                      )}

                      {/* Typography Settings */}
                      {['text', 'variable', 'field'].includes(activeElement.type) && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'تنسيق الخط' : 'Typography'}</h4>
                          
                          <div className="grid grid-cols-2 gap-2">
                            {/* Font size */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'حجم الخط' : 'Font Size'}</label>
                              <input
                                type="number"
                                className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                                value={activeElement.properties.fontSize || 10}
                                onChange={(e) => handleUpdateElementProperty('fontSize', parseInt(e.target.value) || 0)}
                              />
                            </div>
                            {/* Font Family */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'نوع الخط' : 'Font Family'}</label>
                              <select
                                className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold"
                                value={activeElement.properties.fontFamily || 'Cairo'}
                                onChange={(e) => handleUpdateElementProperty('fontFamily', e.target.value)}
                              >
                                <option value="Cairo">Cairo (عربي)</option>
                                <option value="Arial">Arial</option>
                                <option value="Times New Roman">Times</option>
                                <option value="Courier New">Monospace</option>
                              </select>
                            </div>
                          </div>

                          {/* Font Styles */}
                          <div className="flex gap-2 bg-zinc-50 p-1.5 rounded-xl border border-zinc-200">
                            <button
                              type="button"
                              onClick={() => handleUpdateElementProperty('bold', !activeElement.properties.bold)}
                              className={`flex-1 py-1 rounded text-xs font-bold transition-all ${
                                activeElement.properties.bold ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                              }`}
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateElementProperty('italic', !activeElement.properties.italic)}
                              className={`flex-1 py-1 rounded text-xs font-bold italic transition-all ${
                                activeElement.properties.italic ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                              }`}
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateElementProperty('underline', !activeElement.properties.underline)}
                              className={`flex-1 py-1 rounded text-xs font-bold underline transition-all ${
                                activeElement.properties.underline ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                              }`}
                            >
                              U
                            </button>
                          </div>

                          {/* Alignment Settings */}
                          <div className="flex gap-2 bg-zinc-50 p-1.5 rounded-xl border border-zinc-200">
                            {(['left', 'center', 'right', 'justify'] as const).map(align => (
                              <button
                                key={align}
                                type="button"
                                onClick={() => handleUpdateElementProperty('align', align)}
                                className={`flex-1 py-1 rounded text-xs font-bold capitalize transition-all ${
                                  activeElement.properties.align === align ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                                }`}
                              >
                                {align}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Design & Colors */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'الألوان والتصميم' : 'Design & Styles'}</h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'لون العنصر' : 'Text/Line Color'}</label>
                            <input
                              type="color"
                              className="w-full h-8 p-0.5 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                              value={activeElement.properties.color || '#000000'}
                              onChange={(e) => handleUpdateElementProperty('color', e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'لون الخلفية' : 'Background'}</label>
                            <input
                              type="color"
                              className="w-full h-8 p-0.5 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                              value={activeElement.properties.backgroundColor || '#ffffff'}
                              onChange={(e) => handleUpdateElementProperty('backgroundColor', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Border Settings */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'سُمك الحد' : 'Border Width'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={activeElement.properties.borderWidth || 0}
                              onChange={(e) => handleUpdateElementProperty('borderWidth', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'لون الحد' : 'Border Color'}</label>
                            <input
                              type="color"
                              className="w-full h-8 p-0.5 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                              value={activeElement.properties.borderColor || '#000000'}
                              onChange={(e) => handleUpdateElementProperty('borderColor', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : selectedSection === 'details' ? (
                  /* Details Table section properties view */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                      <h3 className="text-sm font-black text-zinc-900">{language === 'ar' ? 'خصائص جدول التفاصيل' : 'Details Table Properties'}</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                      {/* Font settings */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-600">{language === 'ar' ? 'حجم الخط للمحتوى' : 'Content Font Size'}</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                          value={designerLayout.details.properties.fontSize || 10}
                          onChange={(e) => setDesignerLayout(prev => ({
                            ...prev,
                            details: {
                              ...prev.details,
                              properties: {
                                ...prev.details.properties,
                                fontSize: parseInt(e.target.value) || 10
                              }
                            }
                          }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-600">{language === 'ar' ? 'لون الحدود' : 'Grid Border Color'}</label>
                        <input
                          type="color"
                          className="w-full h-9 p-1 bg-zinc-50 border border-zinc-200 rounded-xl cursor-pointer"
                          value={designerLayout.details.properties.borderColor || '#e4e4e7'}
                          onChange={(e) => setDesignerLayout(prev => ({
                            ...prev,
                            details: {
                              ...prev.details,
                              properties: {
                                ...prev.details.properties,
                                borderColor: e.target.value
                              }
                            }
                          }))}
                        />
                      </div>

                      {/* Header Bold toggle */}
                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-zinc-50 rounded-xl">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500/20"
                          checked={designerLayout.details.properties.boldHeader || false}
                          onChange={(e) => setDesignerLayout(prev => ({
                            ...prev,
                            details: {
                              ...prev.details,
                              properties: {
                                ...prev.details.properties,
                                boldHeader: e.target.checked
                              }
                            }
                          }))}
                        />
                        <span className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'خط رأس الجدول عريض (Bold)' : 'Bold Headers'}</span>
                      </label>

                      {/* Current columns widths */}
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'أعمدة الجدول وحجمها (%)' : 'Column Widths (%)'}</h4>
                        <div className="space-y-3">
                          {designerLayout.details.columns.map(col => (
                            <div key={col.id} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-zinc-700">{col.label}</span>
                                <span className="text-zinc-500">{col.width}%</span>
                              </div>
                              <input
                                type="range"
                                min="5"
                                max="80"
                                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                value={col.width}
                                onChange={(e) => {
                                  const newWidth = parseInt(e.target.value) || 10;
                                  setDesignerLayout(prev => {
                                    const cols = prev.details.columns.map(c => 
                                      c.id === col.id ? { ...c, width: newWidth } : c
                                    );
                                    return {
                                      ...prev,
                                      details: {
                                        ...prev.details,
                                        columns: cols
                                      }
                                    };
                                  });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* GENERAL PAGE SETTINGS VIEW */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                      <h3 className="text-sm font-black text-zinc-900">{language === 'ar' ? 'إعدادات الصفحة العامة' : 'Page Layout Settings'}</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                      
                      {/* Paper size selection */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'حجم الورقة' : 'Paper Size'}</label>
                        <select
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none"
                          value={formData.paper_size_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, paper_size_id: e.target.value }))}
                        >
                          {paperSizes.map(size => (
                            <option key={size.id} value={size.id}>{size.name}</option>
                          ))}
                          <option value="custom">{language === 'ar' ? 'أبعاد مخصصة' : 'Custom Dimensions'}</option>
                        </select>
                      </div>

                      {formData.paper_size_id === 'custom' && (
                        <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'العرض' : 'Width'}</label>
                            <input
                              type="number"
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs"
                              value={formData.customWidth}
                              onChange={(e) => setFormData(prev => ({ ...prev, customWidth: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الارتفاع' : 'Height'}</label>
                            <input
                              type="number"
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs"
                              value={formData.customHeight}
                              onChange={(e) => setFormData(prev => ({ ...prev, customHeight: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>
                      )}

                      {/* Orientation settings */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'الاتجاه' : 'Orientation'}</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, orientation: 'portrait' }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                              formData.orientation === 'portrait' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            {language === 'ar' ? 'طولي (Portrait)' : 'Portrait'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, orientation: 'landscape' }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                              formData.orientation === 'landscape' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            {language === 'ar' ? 'عرضي (Landscape)' : 'Landscape'}
                          </button>
                        </div>
                      </div>

                      {/* Section heights settings */}
                      <div className="space-y-3 pt-2 border-t border-zinc-100">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'ارتفاع الأقسام (مم)' : 'Section Heights (mm)'}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'ارتفاع الهيدر' : 'Header Height'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={designerLayout.headerHeight}
                              onChange={(e) => setDesignerLayout(prev => ({ ...prev, headerHeight: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'ارتفاع الفوتر' : 'Footer Height'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={designerLayout.footerHeight}
                              onChange={(e) => setDesignerLayout(prev => ({ ...prev, footerHeight: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Margins Settings */}
                      <div className="space-y-3 pt-2 border-t border-zinc-100">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'هوامش الورقة (مم)' : 'Page Margins (mm)'}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الهامش العلوي' : 'Top Margin'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={formData.margin_top}
                              onChange={(e) => setFormData(prev => ({ ...prev, margin_top: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الهامش السفلي' : 'Bottom Margin'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={formData.margin_bottom}
                              onChange={(e) => setFormData(prev => ({ ...prev, margin_bottom: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الهامش الأيسر' : 'Left Margin'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={formData.margin_left}
                              onChange={(e) => setFormData(prev => ({ ...prev, margin_left: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الهامش الأيمن' : 'Right Margin'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={formData.margin_right}
                              onChange={(e) => setFormData(prev => ({ ...prev, margin_right: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Active Status checkbox */}
                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-zinc-50 rounded-xl pt-2 border-t border-zinc-100">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500/20"
                          checked={formData.is_active}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-zinc-800">{language === 'ar' ? 'قالب نشط' : 'Active Template'}</span>
                          <span className="text-[10px] text-zinc-400">{language === 'ar' ? 'السماح باستخدام القالب للطباعة' : 'Enable template for prints'}</span>
                        </div>
                      </label>

                    </div>
                  </div>
                )}

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
