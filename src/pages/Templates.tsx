import React, { useState, useEffect, useRef } from 'react';
import { dbService, apiRequest } from '../services/dbService';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Edit2, Trash2, Copy, ArrowDownLeft, ArrowUpRight, X, Search, 
  SlidersHorizontal, Settings, FileText, AlertTriangle, Move, Maximize2, 
  Type, Image, Tag, Columns, Square, Circle, Minus, Table, QrCode, Barcode, 
  ZoomIn, ZoomOut, Save, Undo, Redo, RefreshCw, Lock, Unlock, Eye, EyeOff,
  ChevronUp, ChevronDown, Grid, Sparkles, Check, Layers, Paintbrush, Info,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import QRCode from 'react-qr-code';
import BarcodeComponent from 'react-barcode';

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
  x: number; // internally stored in mm
  y: number; // internally stored in mm
  width: number; // internally stored in mm
  height: number; // internally stored in mm
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
    rotation?: number; // 0-360 degrees
    opacity?: number;  // 0-1
    lineHeight?: number; // e.g. 1.2
    locked?: boolean;
    hidden?: boolean;
    padding?: number;
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
  bgImage?: string; // base64 or URL
  watermarkText?: string;
  watermarkImage?: string;
  watermarkOpacity?: number;
  watermarkRotation?: number;
  header: TemplateElement[];
  details: {
    columns: DetailsColumn[];
    properties: {
      fontSize?: number;
      borderColor?: string;
      boldHeader?: boolean;
      headerBgColor?: string;
      bodyBgColor?: string;
      borderWidth?: number;
      paddingX?: number; // mm
      paddingY?: number; // mm
      fontFamily?: string;
      rowHeight?: number; // mm
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
  watermarkOpacity: 0.15,
  watermarkRotation: -45,
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
        color: '#18181b',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'inv-num-label',
      type: 'text',
      x: 140,
      y: 10,
      width: 25,
      height: 6,
      properties: {
        text: 'رقم الفاتورة:',
        fontSize: 10,
        bold: true,
        align: 'left',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'inv-num-val',
      type: 'variable',
      x: 165,
      y: 10,
      width: 35,
      height: 6,
      properties: {
        fontSize: 10,
        align: 'left',
        fontFamily: 'Cairo'
      },
      binding: 'document_number'
    },
    {
      id: 'inv-date-label',
      type: 'text',
      x: 140,
      y: 18,
      width: 25,
      height: 6,
      properties: {
        text: 'تاريخ الفاتورة:',
        fontSize: 10,
        bold: true,
        align: 'left',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'inv-date-val',
      type: 'variable',
      x: 165,
      y: 18,
      width: 35,
      height: 6,
      properties: {
        fontSize: 10,
        align: 'left',
        fontFamily: 'Cairo'
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
        align: 'right',
        fontFamily: 'Cairo'
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
        align: 'right',
        fontFamily: 'Cairo'
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
      { id: 'product_code', label: 'كود الصنف / Code', field: 'product_code', width: 15 },
      { id: 'product_name', label: 'اسم الصنف / Item', field: 'product_name', width: 45 },
      { id: 'quantity', label: 'الكمية / Qty', field: 'quantity', width: 10 },
      { id: 'unit_price', label: 'السعر / Price', field: 'unit_price', width: 15 },
      { id: 'total', label: 'الإجمالي / Total', field: 'total', width: 15 }
    ],
    properties: {
      fontSize: 10,
      borderColor: '#e4e4e7',
      boldHeader: true,
      headerBgColor: '#f4f4f5',
      bodyBgColor: '#ffffff',
      borderWidth: 1,
      paddingX: 2,
      paddingY: 2,
      rowHeight: 8,
      fontFamily: 'Cairo'
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
        align: 'left',
        fontFamily: 'Cairo'
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
        align: 'left',
        fontFamily: 'Cairo'
      },
      binding: 'net_total'
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
        align: 'right',
        fontFamily: 'Cairo'
      }
    },
    {
      id: 'notes-val',
      type: 'text',
      x: 10,
      y: 18,
      width: 100,
      height: 20,
      properties: {
        text: 'تخضع هذه الفاتورة للشروط والأحكام العامة للبيع والضمان المعمول به.',
        fontSize: 8,
        align: 'right',
        fontFamily: 'Cairo',
        color: '#71717a'
      }
    }
  ]
};

const PAPER_SIZES_PRESETS = [
  { id: 'a3', name: 'A3 (297 x 420 mm)', width: 297, height: 420 },
  { id: 'a4', name: 'A4 (210 x 297 mm)', width: 210, height: 297 },
  { id: 'a5', name: 'A5 (148 x 210 mm)', width: 148, height: 210 },
  { id: 'letter', name: 'Letter (215.9 x 279.4 mm)', width: 215.9, height: 279.4 },
  { id: 'legal', name: 'Legal (215.9 x 355.6 mm)', width: 215.9, height: 355.6 },
  { id: 'receipt_58', name: 'Receipt 58mm', width: 58, height: 297 },
  { id: 'receipt_80', name: 'Receipt 80mm', width: 80, height: 297 },
  { id: 'receipt_112', name: 'Receipt 112mm', width: 112, height: 297 },
  { id: 'receipt_210', name: 'Receipt 210mm', width: 210, height: 297 },
];

const DYNAMIC_VARIABLES = {
  general: [
    { key: 'company_logo', arLabel: 'شعار الشركة', enLabel: 'Company Logo' },
    { key: 'company_name', arLabel: 'اسم الشركة', enLabel: 'Company Name' },
    { key: 'branch_name', arLabel: 'الفرع', enLabel: 'Branch' },
    { key: 'user_name', arLabel: 'المستخدم الحالي', enLabel: 'User' },
    { key: 'date', arLabel: 'التاريخ الحالي', enLabel: 'Date' },
    { key: 'time', arLabel: 'الوقت الحالي', enLabel: 'Time' },
  ],
  invoice: [
    { key: 'document_number', arLabel: 'رقم الفاتورة/المستند', enLabel: 'Invoice Number' },
    { key: 'customer_name', arLabel: 'اسم العميل', enLabel: 'Customer' },
    { key: 'supplier_name', arLabel: 'اسم المورد', enLabel: 'Supplier' },
    { key: 'currency_code', arLabel: 'العملة', enLabel: 'Currency' },
    { key: 'payment_method', arLabel: 'طريقة الدفع', enLabel: 'Payment Method' },
  ],
  totals: [
    { key: 'subtotal', arLabel: 'الإجمالي الفرعي', enLabel: 'Subtotal' },
    { key: 'discount_amount', arLabel: 'إجمالي الخصم', enLabel: 'Discount' },
    { key: 'vat_amount', arLabel: 'ضريبة القيمة المضافة', enLabel: 'VAT' },
    { key: 'net_total', arLabel: 'الإجمالي النهائي', enLabel: 'Net Total' },
    { key: 'paid_amount', arLabel: 'المبلغ المدفوع', enLabel: 'Paid' },
    { key: 'remaining_amount', arLabel: 'المبلغ المتبقي', enLabel: 'Remaining' },
  ]
};

const DETAILS_COLUMNS_PRESETS = [
  { id: 'product_code', arLabel: 'كود الصنف', enLabel: 'Item Code', field: 'product_code' },
  { id: 'product_name', arLabel: 'اسم الصنف', enLabel: 'Item Name', field: 'product_name' },
  { id: 'barcode', arLabel: 'الباركود', enLabel: 'Barcode', field: 'barcode' },
  { id: 'quantity', arLabel: 'الكمية', enLabel: 'Qty', field: 'quantity' },
  { id: 'unit', arLabel: 'الوحدة', enLabel: 'Unit', field: 'unit' },
  { id: 'unit_price', arLabel: 'سعر الوحدة', enLabel: 'Unit Price', field: 'unit_price' },
  { id: 'discount', arLabel: 'الخصم', enLabel: 'Discount', field: 'discount' },
  { id: 'vat_amount', arLabel: 'قيمة الضريبة', enLabel: 'VAT', field: 'vat_amount' },
  { id: 'total', arLabel: 'الإجمالي', enLabel: 'Total', field: 'total' },
];

// Unit conversions
const convertFromMM = (val: number, unit: 'mm' | 'cm' | 'inch' | 'px'): number => {
  if (unit === 'cm') return Number((val / 10).toFixed(2));
  if (unit === 'inch') return Number((val / 25.4).toFixed(3));
  if (unit === 'px') return Math.round(val * 3.7795); // 1mm = 3.7795px
  return val; // mm
};

const convertToMM = (val: number, unit: 'mm' | 'cm' | 'inch' | 'px'): number => {
  if (unit === 'cm') return val * 10;
  if (unit === 'inch') return val * 25.4;
  if (unit === 'px') return val / 3.7795;
  return val; // mm
};

export function Templates({ initialView = 'list' }: TemplatesProps) {
  const { dir, language } = useLanguage();
  const { user } = useAuth();
  
  const [view, setView] = useState<'list' | 'create' | 'edit'>(initialView);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>([]);
  const [categories, setCategories] = useState<OperationCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Undo/Redo Stacks
  const [history, setHistory] = useState<TemplateLayout[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Active Unit and Grid
  const [activeUnit, setActiveUnit] = useState<'mm' | 'cm' | 'inch' | 'px'>('mm');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [snapToObjects, setSnapToObjects] = useState<boolean>(true);
  const GRID_STEP = 5; // mm step
  const [snapGuides, setSnapGuides] = useState<{ x: number[]; y: number[] } | null>(null);

  // Copy / Paste Clipboard
  const [clipboard, setClipboard] = useState<TemplateElement | null>(null);

  // Sidebar controls
  const [leftSidebarTab, setLeftSidebarTab] = useState<'toolbox' | 'layers'>('toolbox');
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  // Dynamic Fields Categories and list
  const [headerCategoryId, setHeaderCategoryId] = useState<string>('');
  const [detailsCategoryId, setDetailsCategoryId] = useState<string>('');
  const [headerFields, setHeaderFields] = useState<OperationField[]>([]);
  const [detailsFields, setDetailsFields] = useState<OperationField[]>([]);

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sizeFilter, setSizeFilter] = useState('all');

  // Canvas selection & zoom
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'header' | 'footer' | 'details' | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // zoom scales: 0.25, 0.5, 0.75, 1.0, 1.5, 2.0
  const zoomScale = zoomLevel * 3.5; // pixels per mm

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

  // Visual Designer Layout
  const [designerLayout, setDesignerLayout] = useState<TemplateLayout>(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));

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

  // Sync view prop
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

  // History Tracker logic
  const updateLayoutWithHistory = (newLayout: TemplateLayout) => {
    const cloned = JSON.parse(JSON.stringify(newLayout));
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cloned);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setDesignerLayout(cloned);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setDesignerLayout(JSON.parse(JSON.stringify(history[prevIdx])));
      setSelectedElementId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setDesignerLayout(JSON.parse(JSON.stringify(history[nextIdx])));
      setSelectedElementId(null);
    }
  };

  // Keyboard events for Undo, Redo, Copy, Paste, Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyElement();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteElement();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateElement();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteElement();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, selectedSection, clipboard, designerLayout, historyIndex, history]);

  // Fetch all categories and paper sizes
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
    } else {
      const matched = PAPER_SIZES_PRESETS.find(p => p.id === formData.paper_size_id);
      if (matched) {
        width = matched.width;
        height = matched.height;
      } else if (sizeObj) {
        width = Number(sizeObj.width);
        height = Number(sizeObj.height);
      }
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
      width: type === 'line' ? 100 : type === 'qr' || type === 'circle' ? 30 : 50,
      height: type === 'line' ? 2 : type === 'qr' || type === 'circle' ? 30 : 10,
      properties: {
        text: label || (type === 'text' ? 'نص ثابت / Text' : ''),
        fontFamily: 'Cairo',
        fontSize: 10,
        align: dir === 'rtl' ? 'right' : 'left',
        color: '#000000',
        borderWidth: type === 'line' || type === 'rectangle' ? 1 : 0,
        borderColor: '#000000',
        opacity: 1,
        rotation: 0
      },
      binding
    };

    const updated = {
      ...designerLayout,
      [section]: [...designerLayout[section], newElement]
    };
    updateLayoutWithHistory(updated);
    setSelectedElementId(id);
    setSelectedSection(section);
  };

  // Drag and drop helper
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
      const x = Math.max(0, Math.min(printableWidth - 30, (e.clientX - rect.left) / zoomScale));
      const sectionHeight = section === 'header' ? designerLayout.headerHeight : designerLayout.footerHeight;
      const y = Math.max(0, Math.min(sectionHeight - 10, (e.clientY - rect.top) / zoomScale));

      const id = `${type}-${Date.now()}`;
      const newElement: TemplateElement = {
        id,
        type: type as TemplateElement['type'],
        x: Math.round(x),
        y: Math.round(y),
        width: type === 'line' ? 100 : type === 'qr' || type === 'circle' ? 30 : 50,
        height: type === 'line' ? 1.5 : type === 'qr' || type === 'circle' ? 30 : 10,
        properties: {
          text: label || (type === 'text' ? 'نص ثابت / Text' : ''),
          fontFamily: 'Cairo',
          fontSize: 10,
          align: dir === 'rtl' ? 'right' : 'left',
          color: '#000000',
          borderWidth: type === 'line' || type === 'rectangle' ? 1 : 0,
          borderColor: '#000000',
          opacity: 1,
          rotation: 0
        },
        binding
      };

      const updated = {
        ...designerLayout,
        [section]: [...designerLayout[section], newElement]
      };
      updateLayoutWithHistory(updated);
      setSelectedElementId(id);
      setSelectedSection(section);
    } catch (err) {
      console.error(err);
    }
  };

  // Drag and Resize handler
  const handleMouseDown = (
    e: React.MouseEvent, 
    elementId: string, 
    section: 'header' | 'footer', 
    action: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const elem = designerLayout[section].find(el => el.id === elementId);
    if (!elem || elem.properties.locked) return; // Do not move or resize if locked

    setSelectedElementId(elementId);
    setSelectedSection(section);

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

          let targetX = startLeft + deltaMM_X;
          let targetY = startTop + deltaMM_Y;

          // Object snapping guidelines
          const guideLinesX: number[] = [];
          const guideLinesY: number[] = [];

          if (snapToObjects) {
            const snapThreshold = 2; // mm
            const otherElements = elements.filter(el => el.id !== elem.id && !el.properties.hidden);

            for (const other of otherElements) {
              const otherLeft = other.x;
              const otherRight = other.x + other.width;
              const elemRight = targetX + elem.width;

              if (Math.abs(targetX - otherLeft) < snapThreshold) {
                targetX = otherLeft;
                guideLinesX.push(otherLeft);
              } else if (Math.abs(elemRight - otherRight) < snapThreshold) {
                targetX = otherRight - elem.width;
                guideLinesX.push(otherRight);
              } else if (Math.abs(targetX - otherRight) < snapThreshold) {
                targetX = otherRight;
                guideLinesX.push(otherRight);
              } else if (Math.abs(elemRight - otherLeft) < snapThreshold) {
                targetX = otherLeft - elem.width;
                guideLinesX.push(otherLeft);
              }

              const otherTop = other.y;
              const otherBottom = other.y + other.height;
              const elemBottom = targetY + elem.height;

              if (Math.abs(targetY - otherTop) < snapThreshold) {
                targetY = otherTop;
                guideLinesY.push(otherTop);
              } else if (Math.abs(elemBottom - otherBottom) < snapThreshold) {
                targetY = otherBottom - elem.height;
                guideLinesY.push(otherBottom);
              } else if (Math.abs(targetY - otherBottom) < snapThreshold) {
                targetY = otherBottom;
                guideLinesY.push(otherBottom);
              } else if (Math.abs(elemBottom - otherTop) < snapThreshold) {
                targetY = otherTop - elem.height;
                guideLinesY.push(otherTop);
              }
            }

            if (guideLinesX.length > 0 || guideLinesY.length > 0) {
              setSnapGuides({ x: guideLinesX, y: guideLinesY });
            } else {
              setSnapGuides(null);
            }
          }

          // Grid Snapping fallback
          if (snapToGrid && guideLinesX.length === 0) {
            targetX = Math.round(targetX / GRID_STEP) * GRID_STEP;
          }
          if (snapToGrid && guideLinesY.length === 0) {
            targetY = Math.round(targetY / GRID_STEP) * GRID_STEP;
          }

          elem.x = Math.round(Math.max(0, Math.min(maxLeft, targetX)));
          elem.y = Math.round(Math.max(0, Math.min(maxTop, targetY)));
        } else {
          // Resize
          let targetWidth = startWidth + deltaMM_X;
          let targetHeight = startHeight + deltaMM_Y;

          if (snapToGrid) {
            targetWidth = Math.round(targetWidth / GRID_STEP) * GRID_STEP;
            targetHeight = Math.round(targetHeight / GRID_STEP) * GRID_STEP;
          }

          elem.width = Math.round(Math.max(5, targetWidth));
          elem.height = Math.round(Math.max(1.5, targetHeight));
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
        setSnapGuides(null);
        // Push state to Undo stack on mouse up
        setHistory(prevHist => {
          const cloned = JSON.parse(JSON.stringify(designerLayout));
          const newHistory = prevHist.slice(0, historyIndex + 1);
          newHistory.push(cloned);
          setHistoryIndex(newHistory.length - 1);
          return newHistory;
        });
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
  }, [mouseDragState, zoomScale, printableWidth, designerLayout, historyIndex, snapToGrid, snapToObjects]);

  // Update properties of selected element
  const handleUpdateElementProperty = (key: string, value: any) => {
    if (!selectedElementId || !selectedSection || selectedSection === 'details') return;

    const elements = [...designerLayout[selectedSection]];
    const index = elements.findIndex(el => el.id === selectedElementId);
    if (index === -1) return;

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
    const updated = {
      ...designerLayout,
      [selectedSection]: elements
    };
    // Save to layout state and history
    setDesignerLayout(updated);
    // Debounce or directly push for instant properties update. We will push it directly:
    const cloned = JSON.parse(JSON.stringify(updated));
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(cloned);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Delete Element
  const handleDeleteElement = () => {
    if (!selectedElementId || !selectedSection || selectedSection === 'details') return;

    const updated = {
      ...designerLayout,
      [selectedSection]: designerLayout[selectedSection].filter(el => el.id !== selectedElementId)
    };
    updateLayoutWithHistory(updated);
    setSelectedElementId(null);
    toast.success(language === 'ar' ? 'تم حذف العنصر' : 'Element deleted');
  };

  // Duplicate Element
  const handleDuplicateElement = () => {
    if (!selectedElementId || !selectedSection || selectedSection === 'details') return;

    const source = designerLayout[selectedSection].find(el => el.id === selectedElementId);
    if (!source) return;

    const id = `${source.type}-${Date.now()}`;
    const clone: TemplateElement = JSON.parse(JSON.stringify(source));
    clone.id = id;
    clone.x = Math.min(printableWidth - clone.width, clone.x + 5);
    clone.y = clone.y + 5;

    const updated = {
      ...designerLayout,
      [selectedSection]: [...designerLayout[selectedSection], clone]
    };
    updateLayoutWithHistory(updated);
    setSelectedElementId(id);
    toast.success(language === 'ar' ? 'تم تكرار العنصر' : 'Element duplicated');
  };

  // Copy element
  const handleCopyElement = () => {
    if (!selectedElementId || !selectedSection || selectedSection === 'details') return;
    const source = designerLayout[selectedSection].find(el => el.id === selectedElementId);
    if (source) {
      setClipboard(JSON.parse(JSON.stringify(source)));
      toast.success(language === 'ar' ? 'تم نسخ العنصر' : 'Element copied');
    }
  };

  // Paste element
  const handlePasteElement = () => {
    if (!clipboard || !selectedSection || selectedSection === 'details') return;
    const clone: TemplateElement = JSON.parse(JSON.stringify(clipboard));
    clone.id = `${clone.type}-${Date.now()}`;
    clone.x = Math.min(printableWidth - clone.width, clone.x + 5);
    clone.y = clone.y + 5;

    const updated = {
      ...designerLayout,
      [selectedSection]: [...designerLayout[selectedSection], clone]
    };
    updateLayoutWithHistory(updated);
    setSelectedElementId(clone.id);
    toast.success(language === 'ar' ? 'تم لصق العنصر' : 'Element pasted');
  };

  // Depth ordering
  const handleMoveDepth = (direction: 'up' | 'down') => {
    if (!selectedElementId || !selectedSection || selectedSection === 'details') return;

    const elements = [...designerLayout[selectedSection]];
    const index = elements.findIndex(el => el.id === selectedElementId);
    if (index === -1) return;

    if (direction === 'up' && index < elements.length - 1) {
      const temp = elements[index];
      elements[index] = elements[index + 1];
      elements[index + 1] = temp;
    } else if (direction === 'down' && index > 0) {
      const temp = elements[index];
      elements[index] = elements[index - 1];
      elements[index - 1] = temp;
    }

    const updated = {
      ...designerLayout,
      [selectedSection]: elements
    };
    updateLayoutWithHistory(updated);
  };

  // Layer toggles
  const handleToggleLayerVisibility = (id: string, sec: 'header' | 'footer') => {
    const elements = designerLayout[sec].map(el => {
      if (el.id === id) {
        return {
          ...el,
          properties: { ...el.properties, hidden: !el.properties.hidden }
        };
      }
      return el;
    });

    const updated = { ...designerLayout, [sec]: elements };
    updateLayoutWithHistory(updated);
  };

  const handleToggleLayerLock = (id: string, sec: 'header' | 'footer') => {
    const elements = designerLayout[sec].map(el => {
      if (el.id === id) {
        return {
          ...el,
          properties: { ...el.properties, locked: !el.properties.locked }
        };
      }
      return el;
    });

    const updated = { ...designerLayout, [sec]: elements };
    updateLayoutWithHistory(updated);
  };

  // Custom Background / Watermark Image uploader
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'bgImage' | 'watermarkImage') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const updated = {
          ...designerLayout,
          [field]: reader.result as string
        };
        updateLayoutWithHistory(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  // Image Upload for Custom Image element
  const handleElementImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleUpdateElementProperty('imageUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Edit / Copy / Delete Template from list view
  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    const selectedSize = paperSizes.find(p => p.id === template.paper_size_id);
    const isCustomPreset = PAPER_SIZES_PRESETS.some(p => p.id === template.paper_size_id);
    const isCustom = selectedSize && !selectedSize.is_system && !isCustomPreset;

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

    const targetLayout = template.layout ? JSON.parse(JSON.stringify(template.layout)) : JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    setDesignerLayout(targetLayout);
    setHistory([JSON.parse(JSON.stringify(targetLayout))]);
    setHistoryIndex(0);
    setSelectedElementId(null);
    setSelectedSection(null);
    setPreviewMode(false);
    setView('edit');
  };

  const handleCopy = (template: Template) => {
    const selectedSize = paperSizes.find(p => p.id === template.paper_size_id);
    const isCustomPreset = PAPER_SIZES_PRESETS.some(p => p.id === template.paper_size_id);
    const isCustom = selectedSize && !selectedSize.is_system && !isCustomPreset;

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

    const targetLayout = template.layout ? JSON.parse(JSON.stringify(template.layout)) : JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    setDesignerLayout(targetLayout);
    setHistory([JSON.parse(JSON.stringify(targetLayout))]);
    setHistoryIndex(0);
    setEditingTemplate(null);
    setSelectedElementId(null);
    setSelectedSection(null);
    setPreviewMode(false);
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم القالب' : 'Please enter template name');
      return;
    }

    try {
      let finalPaperSizeId = formData.paper_size_id;

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
        layout: designerLayout, // Stored purely as JSON
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

  const getSelectedElement = () => {
    if (!selectedElementId || !selectedSection || selectedSection === 'details') return null;
    return designerLayout[selectedSection].find(el => el.id === selectedElementId) || null;
  };

  const activeElement = getSelectedElement();

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && t.is_active) || 
                          (statusFilter === 'inactive' && !t.is_active);
    const matchesSize = sizeFilter === 'all' || t.paper_size_id === sizeFilter;
    return matchesSearch && matchesStatus && matchesSize;
  });

  // Mock document data for Real Live Preview
  const previewDocData = {
    company_logo: 'LOGO',
    company_name: 'مجموعة التطور الرقمي المحدودة',
    branch_name: 'فرع الرياض الرئيسي',
    user_name: user?.username || 'المشرف العام',
    date: new Date().toLocaleDateString('ar-SA'),
    time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    document_number: 'INV-2026-90432',
    customer_name: 'شركة قمم الشرق للمقاولات العامة',
    supplier_name: 'مؤسسة الحلول البرمجية العالمية',
    currency_code: 'SAR',
    payment_method: 'مدى / Mada',
    subtotal: 5850.00,
    discount_amount: 350.00,
    vat_amount: 825.00,
    net_total: 6325.00,
    paid_amount: 6325.00,
    remaining_amount: 0.00,
    items: [
      { product_code: 'ITM-902', product_name: 'تراخيص سيرفر تداول مالي متقدم', barcode: '628045612378', quantity: 2, unit: 'رخصة', unit_price: 2500, discount: 250, vat_amount: 712.5, total: 5462.5 },
      { product_code: 'ITM-503', product_name: 'خدمة إعداد وبدء تشغيل قواعد البيانات', barcode: 'N/A', quantity: 1, unit: 'ساعة', unit_price: 850, discount: 100, vat_amount: 112.5, total: 862.5 }
    ]
  };

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

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
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
                    const targetLayout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
                    setDesignerLayout(targetLayout);
                    setHistory([JSON.parse(JSON.stringify(targetLayout))]);
                    setHistoryIndex(0);
                    setEditingTemplate(null);
                    setSelectedElementId(null);
                    setSelectedSection(null);
                    setPreviewMode(false);
                    setView('create');
                  }}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/25"
                >
                  <Plus size={18} />
                  <span>{language === 'ar' ? 'إنشاء قالب جديد' : 'Create New Template'}</span>
                </button>
              </div>
            </div>

            {/* Filters */}
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
                
                <select
                  className="bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                >
                  <option value="all">{language === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
                  <option value="active">{language === 'ar' ? 'نشط فقط' : 'Active Only'}</option>
                  <option value="inactive">{language === 'ar' ? 'غير نشط فقط' : 'Inactive Only'}</option>
                </select>

                <select
                  className="bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={sizeFilter}
                  onChange={(e: any) => setSizeFilter(e.target.value)}
                >
                  <option value="all">{language === 'ar' ? 'جميع الأحجام' : 'All Paper Sizes'}</option>
                  {paperSizes.map(size => (
                    <option key={size.id} value={size.id}>{size.name}</option>
                  ))}
                  {PAPER_SIZES_PRESETS.map(preset => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* List */}
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
                      <th className="px-6 py-4 text-xs font-extrabold text-center">
                        {language === 'ar' ? 'حالة القالب' : 'Status'}
                      </th>
                      <th className="px-6 py-4 text-xs font-extrabold text-center">
                        {language === 'ar' ? 'إجراءات' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {filteredTemplates.map((template) => {
                      const sizeObj = paperSizes.find(p => p.id === template.paper_size_id);
                      const presetObj = PAPER_SIZES_PRESETS.find(p => p.id === template.paper_size_id);
                      const sizeName = presetObj?.name || sizeObj?.name || template.paper_size_id;
                      const sizeWidth = presetObj?.width || sizeObj?.width || '—';
                      const sizeHeight = presetObj?.height || sizeObj?.height || '—';

                      return (
                        <tr key={template.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <div className="font-bold text-zinc-950">{template.name}</div>
                            {template.description && (
                              <div className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{template.description}</div>
                            )}
                          </td>
                          <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-800">{sizeName}</span>
                              <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                                {sizeWidth} × {sizeHeight} mm
                              </span>
                            </div>
                          </td>
                          <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} capitalize`}>
                            <span className="font-medium text-zinc-700">
                              {template.orientation === 'portrait'
                                ? (language === 'ar' ? 'طولي (Portrait)' : 'Portrait')
                                : (language === 'ar' ? 'عرضي (Landscape)' : 'Landscape')}
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
          /* DESIGNER INTERFACE */
          <motion.div
            key="designer"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            className="flex-1 flex flex-col space-y-4 overflow-hidden h-full"
          >
            {/* Top Workspace Bar */}
            <div className={`flex flex-col lg:flex-row items-center justify-between gap-4 border-b border-zinc-200 pb-3 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
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

              {/* Workspace controls */}
              <div className="flex flex-wrap items-center gap-3 justify-end w-full lg:w-auto">
                {/* Unit selection */}
                <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                  {(['mm', 'cm', 'inch', 'px'] as const).map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setActiveUnit(u)}
                      className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                        activeUnit === u ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>

                {/* Grid helper toggles */}
                <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setShowGrid(prev => !prev)}
                    className={`p-1.5 rounded-lg transition-all ${showGrid ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500'}`}
                    title={language === 'ar' ? 'عرض الشبكة' : 'Show Grid'}
                  >
                    <Grid size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnapToGrid(prev => !prev)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      snapToGrid ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500'
                    }`}
                    title={language === 'ar' ? 'محاذاة للشبكة' : 'Snap to Grid'}
                  >
                    Snap Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnapToObjects(prev => !prev)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      snapToObjects ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500'
                    }`}
                    title={language === 'ar' ? 'محاذاة للعناصر' : 'Snap to Objects'}
                  >
                    Snap Objects
                  </button>
                </div>

                {/* Undo / Redo controls */}
                <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="p-1.5 hover:bg-white rounded-lg text-zinc-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-1.5 hover:bg-white rounded-lg text-zinc-600 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
                    title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
                  >
                    <Redo size={16} />
                  </button>
                </div>

                {/* Zoom Levels */}
                <select
                  className="bg-zinc-100 border border-zinc-200 px-3 py-1.5 rounded-xl text-xs font-bold outline-none"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                >
                  <option value="0.25">25%</option>
                  <option value="0.5">50%</option>
                  <option value="0.75">75%</option>
                  <option value="1.0">100%</option>
                  <option value="1.5">150%</option>
                  <option value="2.0">200%</option>
                </select>

                {/* Preview Toggle */}
                <button
                  type="button"
                  onClick={() => setPreviewMode(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-xs transition-all ${
                    previewMode 
                      ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm'
                      : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  <Sparkles size={14} />
                  <span>{language === 'ar' ? 'معاينة المستند' : 'Live Preview'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  {language === 'ar' ? 'خروج' : 'Exit'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/25"
                >
                  <Save size={18} />
                  <span>{language === 'ar' ? 'حفظ التصميم' : 'Save Design'}</span>
                </button>
              </div>
            </div>

            {/* THREE COLUMN DESIGN WORKSPACE */}
            <div className="flex-1 flex overflow-hidden gap-4 h-full">
              
              {/* 1. LEFT SIDEBAR: TOOLBOX & LAYERS */}
              <div className="w-80 bg-white border border-zinc-200 rounded-2xl flex flex-col overflow-hidden shadow-sm h-full">
                {/* Tabs */}
                <div className="flex border-b border-zinc-100 bg-zinc-50/50 p-1">
                  <button
                    type="button"
                    onClick={() => setLeftSidebarTab('toolbox')}
                    className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      leftSidebarTab === 'toolbox' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    <SlidersHorizontal size={14} />
                    <span>{language === 'ar' ? 'العناصر' : 'Toolbox'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftSidebarTab('layers')}
                    className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      leftSidebarTab === 'layers' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    <Layers size={14} />
                    <span>{language === 'ar' ? 'الطبقات' : 'Layers'}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {leftSidebarTab === 'toolbox' ? (
                    <div className="space-y-6">
                      
                      {/* Static elements */}
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
                              className="flex items-center gap-2 p-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl cursor-grab active:cursor-grabbing text-xs font-bold transition-all"
                            >
                              <el.icon size={14} className="text-zinc-500" />
                              <span>{language === 'ar' ? el.label : el.type.toUpperCase()}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Dynamic system variables */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'متغيرات النظام الأساسية' : 'System Variables'}</h4>
                        <div className="space-y-4">
                          {/* General variables */}
                          <div>
                            <div className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase">{language === 'ar' ? 'عام / General' : 'General'}</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {DYNAMIC_VARIABLES.general.map(v => (
                                <div
                                  key={v.key}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, 'variable', v.key, language === 'ar' ? v.arLabel : v.enLabel)}
                                  onClick={() => handleAddElement('variable', v.key, language === 'ar' ? v.arLabel : v.enLabel)}
                                  className="p-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg cursor-grab text-[10px] font-semibold flex items-center justify-between"
                                >
                                  <span>{language === 'ar' ? v.arLabel : v.enLabel}</span>
                                  <Tag size={10} className="text-zinc-400" />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Invoice variables */}
                          <div>
                            <div className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase">{language === 'ar' ? 'المستند / Document' : 'Document'}</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {DYNAMIC_VARIABLES.invoice.map(v => (
                                <div
                                  key={v.key}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, 'variable', v.key, language === 'ar' ? v.arLabel : v.enLabel)}
                                  onClick={() => handleAddElement('variable', v.key, language === 'ar' ? v.arLabel : v.enLabel)}
                                  className="p-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg cursor-grab text-[10px] font-semibold flex items-center justify-between"
                                >
                                  <span>{language === 'ar' ? v.arLabel : v.enLabel}</span>
                                  <Tag size={10} className="text-zinc-400" />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Totals variables */}
                          <div>
                            <div className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase">{language === 'ar' ? 'الحسابات والإجماليات / Totals' : 'Totals'}</div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {DYNAMIC_VARIABLES.totals.map(v => (
                                <div
                                  key={v.key}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, 'variable', v.key, language === 'ar' ? v.arLabel : v.enLabel)}
                                  onClick={() => handleAddElement('variable', v.key, language === 'ar' ? v.arLabel : v.enLabel)}
                                  className="p-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg cursor-grab text-[10px] font-semibold flex items-center justify-between"
                                >
                                  <span>{language === 'ar' ? v.arLabel : v.enLabel}</span>
                                  <Tag size={10} className="text-zinc-400" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Header level dynamic fields */}
                      <div className="space-y-3 border-t border-zinc-100 pt-3">
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
                          <p className="text-[10px] text-zinc-400 text-center py-2">{language === 'ar' ? 'لا يوجد حقول لهذا التصنيف' : 'No fields found'}</p>
                        )}

                        {headerFields.length > 0 && (
                          <div className="max-h-40 overflow-y-auto border border-zinc-100 rounded-xl divide-y divide-zinc-50">
                            {headerFields.map(f => (
                              <div
                                key={f.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, 'field', f.code, f.label)}
                                onClick={() => handleAddElement('field', f.code, f.label)}
                                className="flex items-center justify-between p-2 hover:bg-zinc-50 cursor-grab text-[10px] font-semibold"
                              >
                                <span>{f.label}</span>
                                <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">{f.code}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Details level dynamic fields */}
                      <div className="space-y-3 border-t border-zinc-100 pt-3">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'حقول تفاصيل ديناميكية' : 'Dynamic Details Columns'}</h4>
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
                          <p className="text-[10px] text-zinc-400 text-center py-2">{language === 'ar' ? 'لا يوجد حقول للتفاصيل' : 'No details fields'}</p>
                        )}

                        {detailsFields.length > 0 && (
                          <div className="max-h-40 overflow-y-auto border border-zinc-100 rounded-xl divide-y divide-zinc-50">
                            {detailsFields.map(f => {
                              const isAdded = designerLayout.details.columns.some(col => col.field === f.code);
                              return (
                                <div
                                  key={f.id}
                                  className="flex items-center justify-between p-2 text-[10px] font-semibold"
                                >
                                  <span>{f.label}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isAdded) {
                                        const filtered = designerLayout.details.columns.filter(col => col.field !== f.code);
                                        updateLayoutWithHistory({
                                          ...designerLayout,
                                          details: { ...designerLayout.details, columns: filtered }
                                        });
                                      } else {
                                        const newCol = { id: `col-${Date.now()}`, label: f.label, field: f.code, width: 10 };
                                        updateLayoutWithHistory({
                                          ...designerLayout,
                                          details: { ...designerLayout.details, columns: [...designerLayout.details.columns, newCol] }
                                        });
                                      }
                                    }}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      isAdded ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                  >
                                    {isAdded ? (language === 'ar' ? 'حذف' : 'Remove') : (language === 'ar' ? 'إضافة' : 'Add')}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  ) : (
                    /* LAYERS PANEL */
                    <div className="space-y-6">
                      {/* Header layers */}
                      <div className="space-y-2">
                        <div className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'طبقات الهيدر' : 'Header Layers'}</div>
                        <div className="space-y-1 max-h-48 overflow-y-auto border border-zinc-100 p-1.5 rounded-xl divide-y divide-zinc-50">
                          {designerLayout.header.length === 0 ? (
                            <p className="text-[10px] text-zinc-400 text-center py-2">لا يوجد عناصر / Empty</p>
                          ) : (
                            designerLayout.header.map((el, idx) => (
                              <div
                                key={el.id}
                                onClick={() => {
                                  setSelectedElementId(el.id);
                                  setSelectedSection('header');
                                }}
                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                                  selectedElementId === el.id ? 'bg-emerald-50/50 border border-emerald-200' : 'hover:bg-zinc-50'
                                }`}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="text-[10px] font-mono text-zinc-400">#{idx + 1}</span>
                                  <span className="text-[11px] font-bold text-zinc-700 truncate">
                                    {el.properties.text ? `"${el.properties.text}"` : el.type.toUpperCase()}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLayerVisibility(el.id, 'header')}
                                    className={`p-1 rounded hover:bg-zinc-100 ${el.properties.hidden ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-600'}`}
                                  >
                                    {el.properties.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLayerLock(el.id, 'header')}
                                    className={`p-1 rounded hover:bg-zinc-100 ${el.properties.locked ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-600'}`}
                                  >
                                    {el.properties.locked ? <Lock size={12} /> : <Unlock size={12} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedElementId(el.id); setSelectedSection('header'); handleMoveDepth('up'); }}
                                    className="p-0.5 rounded hover:bg-zinc-100 text-zinc-400"
                                    title="Move Up (Z-index)"
                                  >
                                    <ChevronUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedElementId(el.id); setSelectedSection('header'); handleMoveDepth('down'); }}
                                    className="p-0.5 rounded hover:bg-zinc-100 text-zinc-400"
                                    title="Move Down (Z-index)"
                                  >
                                    <ChevronDown size={12} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Details table layers (simple list) */}
                      <div className="space-y-2">
                        <div className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'أعمدة جدول التفاصيل' : 'Details Table Columns'}</div>
                        <div className="space-y-1 max-h-48 overflow-y-auto border border-zinc-100 p-1.5 rounded-xl divide-y divide-zinc-50">
                          {designerLayout.details.columns.map((col, idx) => (
                            <div
                              key={col.id}
                              onClick={() => {
                                setSelectedSection('details');
                                setSelectedElementId(null);
                              }}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-zinc-400">#{idx + 1}</span>
                                <span className="text-[11px] font-bold text-zinc-700">{col.label}</span>
                              </div>
                              <span className="text-[9px] bg-zinc-100 text-zinc-500 font-mono px-1 rounded">{col.width}%</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Footer layers */}
                      <div className="space-y-2">
                        <div className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'طبقات الفوتر' : 'Footer Layers'}</div>
                        <div className="space-y-1 max-h-48 overflow-y-auto border border-zinc-100 p-1.5 rounded-xl divide-y divide-zinc-50">
                          {designerLayout.footer.length === 0 ? (
                            <p className="text-[10px] text-zinc-400 text-center py-2">لا يوجد عناصر / Empty</p>
                          ) : (
                            designerLayout.footer.map((el, idx) => (
                              <div
                                key={el.id}
                                onClick={() => {
                                  setSelectedElementId(el.id);
                                  setSelectedSection('footer');
                                }}
                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                                  selectedElementId === el.id ? 'bg-emerald-50/50 border border-emerald-200' : 'hover:bg-zinc-50'
                                }`}
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="text-[10px] font-mono text-zinc-400">#{idx + 1}</span>
                                  <span className="text-[11px] font-bold text-zinc-700 truncate">
                                    {el.properties.text ? `"${el.properties.text}"` : el.type.toUpperCase()}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLayerVisibility(el.id, 'footer')}
                                    className={`p-1 rounded hover:bg-zinc-100 ${el.properties.hidden ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-600'}`}
                                  >
                                    {el.properties.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLayerLock(el.id, 'footer')}
                                    className={`p-1 rounded hover:bg-zinc-100 ${el.properties.locked ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-600'}`}
                                  >
                                    {el.properties.locked ? <Lock size={12} /> : <Unlock size={12} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedElementId(el.id); setSelectedSection('footer'); handleMoveDepth('up'); }}
                                    className="p-0.5 rounded hover:bg-zinc-100 text-zinc-400"
                                    title="Move Up (Z-index)"
                                  >
                                    <ChevronUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedElementId(el.id); setSelectedSection('footer'); handleMoveDepth('down'); }}
                                    className="p-0.5 rounded hover:bg-zinc-100 text-zinc-400"
                                    title="Move Down (Z-index)"
                                  >
                                    <ChevronDown size={12} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>

              {/* 2. CENTER WORKSPACE: PAPER SHEET RENDERING */}
              <div className="flex-1 bg-zinc-100 border border-zinc-200 rounded-2xl overflow-auto p-8 flex items-start justify-center relative shadow-inner h-full">
                
                {previewMode ? (
                  /* LIVE PREVIEW CONTAINER */
                  <div
                    className="bg-white border border-zinc-300 shadow-2xl transition-all relative overflow-hidden"
                    style={{
                      width: `${printableWidth * zoomScale}px`,
                      paddingTop: `${formData.margin_top * zoomScale}px`,
                      paddingBottom: `${formData.margin_bottom * zoomScale}px`,
                      paddingLeft: `${formData.margin_left * zoomScale}px`,
                      paddingRight: `${formData.margin_right * zoomScale}px`,
                      backgroundImage: designerLayout.bgImage ? `url(${designerLayout.bgImage})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Watermark */}
                    {designerLayout.watermarkText && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
                        style={{
                          opacity: designerLayout.watermarkOpacity ?? 0.15,
                          transform: `rotate(${designerLayout.watermarkRotation ?? -45}deg)`,
                          fontSize: '5vw',
                          fontWeight: 'bold',
                          color: '#000000',
                        }}
                      >
                        {designerLayout.watermarkText}
                      </div>
                    )}
                    {designerLayout.watermarkImage && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
                        style={{
                          opacity: designerLayout.watermarkOpacity ?? 0.15,
                        }}
                      >
                        <img
                          src={designerLayout.watermarkImage}
                          alt="watermark"
                          style={{
                            transform: `rotate(${designerLayout.watermarkRotation ?? -45}deg)`,
                            maxWidth: '40%',
                            maxHeight: '40%'
                          }}
                        />
                      </div>
                    )}

                    {/* Header */}
                    <div style={{ height: `${designerLayout.headerHeight * zoomScale}px`, width: '100%' }} className="relative">
                      {designerLayout.header.filter(el => !el.properties.hidden).map(el => (
                        <div
                          key={el.id}
                          className="absolute flex items-center"
                          style={{
                            left: `${el.x * zoomScale}px`,
                            top: `${el.y * zoomScale}px`,
                            width: `${el.width * zoomScale}px`,
                            height: `${el.height * zoomScale}px`,
                            fontFamily: el.properties.fontFamily || 'Cairo',
                            fontSize: `${(el.properties.fontSize || 10) * (zoomScale / 3.5)}pt`,
                            fontWeight: el.properties.bold ? 'bold' : 'normal',
                            fontStyle: el.properties.italic ? 'italic' : 'normal',
                            textDecoration: el.properties.underline ? 'underline' : 'none',
                            color: el.properties.color || '#000000',
                            backgroundColor: el.properties.backgroundColor || 'transparent',
                            border: el.properties.borderWidth ? `${el.properties.borderWidth}px solid ${el.properties.borderColor || '#000'}` : 'none',
                            borderRadius: el.properties.borderRadius ? `${el.properties.borderRadius}px` : '0px',
                            textAlign: el.properties.align || 'left',
                            opacity: el.properties.opacity ?? 1,
                            transform: `rotate(${el.properties.rotation || 0}deg)`,
                            justifyContent: el.properties.align === 'center' ? 'center' : el.properties.align === 'right' ? 'flex-end' : 'flex-start',
                            padding: `${(el.properties.padding || 0) * zoomScale}px`
                          }}
                        >
                          {el.type === 'text' && el.properties.text}
                          {el.type === 'variable' && typeof previewDocData[el.binding as keyof typeof previewDocData] !== 'object' ? String(previewDocData[el.binding as keyof typeof previewDocData] ?? '') : ''}
                          {el.type === 'field' && 'حقل ديناميكي / Field Value'}
                          {el.type === 'logo' && (
                            <div className="w-full h-full border border-zinc-200 bg-zinc-50 rounded flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                              LOGO
                            </div>
                          )}
                          {el.type === 'image' && (
                            el.properties.imageUrl ? (
                              <img src={el.properties.imageUrl} alt="element" className="w-full h-full object-contain" />
                            ) : (
                              <div className="w-full h-full border border-dashed border-zinc-200 bg-zinc-50 rounded" />
                            )
                          )}
                          {el.type === 'line' && (
                            <div 
                              className="w-full h-full" 
                              style={{ 
                                borderTop: el.width >= el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none',
                                borderLeft: el.width < el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none'
                              }} 
                            />
                          )}
                          {el.type === 'rectangle' && <div className="w-full h-full" />}
                          {el.type === 'circle' && <div className="w-full h-full rounded-full border border-zinc-950" style={{ borderColor: el.properties.borderColor }} />}
                          {el.type === 'qr' && (
                            <div className="p-0.5 bg-white border border-zinc-100 flex items-center justify-center">
                              <QRCode value="Invoice: INV-2026-90432 Total: 6325.00 SAR Date: 2026-06-21" size={Math.min(el.width, el.height) * zoomScale - 4} />
                            </div>
                          )}
                          {el.type === 'barcode' && (
                            <div className="p-0.5 bg-white border border-zinc-100 flex items-center justify-center w-full h-full overflow-hidden">
                              <BarcodeComponent value="INV202690432" width={1.2} height={Math.min(el.height) * zoomScale - 10} displayValue={false} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Details Table */}
                    <div className="my-5 relative z-10">
                      <table
                        className="w-full border-collapse"
                        style={{
                          fontSize: `${(designerLayout.details.properties.fontSize || 10) * (zoomScale / 3.5)}pt`,
                          fontFamily: designerLayout.details.properties.fontFamily || 'Cairo',
                          borderColor: designerLayout.details.properties.borderColor || '#e4e4e7'
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              backgroundColor: designerLayout.details.properties.headerBgColor || '#f4f4f5',
                              borderColor: designerLayout.details.properties.borderColor || '#e4e4e7'
                            }}
                            className="border-b"
                          >
                            {designerLayout.details.columns.map(col => (
                              <th
                                key={col.id}
                                className={`border border-zinc-200 p-2 font-bold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                style={{
                                  width: `${col.width}%`,
                                  borderColor: designerLayout.details.properties.borderColor || '#e4e4e7',
                                  fontWeight: designerLayout.details.properties.boldHeader ? 'bold' : 'normal',
                                  padding: `${designerLayout.details.properties.paddingY ?? 2}px ${designerLayout.details.properties.paddingX ?? 2}px`
                                }}
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewDocData.items.map((item, rowIdx) => (
                            <tr
                              key={rowIdx}
                              style={{
                                backgroundColor: designerLayout.details.properties.bodyBgColor || '#ffffff',
                                borderColor: designerLayout.details.properties.borderColor || '#e4e4e7',
                                height: `${(designerLayout.details.properties.rowHeight || 8) * zoomScale}px`
                              }}
                              className="border-b"
                            >
                              {designerLayout.details.columns.map(col => (
                                <td
                                  key={col.id}
                                  className="border p-2 text-zinc-700"
                                  style={{
                                    borderColor: designerLayout.details.properties.borderColor || '#e4e4e7',
                                    padding: `${designerLayout.details.properties.paddingY ?? 2}px ${designerLayout.details.properties.paddingX ?? 2}px`
                                  }}
                                >
                                  {item[col.field as keyof typeof item] ?? `[${col.label}]`}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer */}
                    <div style={{ height: `${designerLayout.footerHeight * zoomScale}px`, width: '100%' }} className="relative">
                      {designerLayout.footer.filter(el => !el.properties.hidden).map(el => (
                        <div
                          key={el.id}
                          className="absolute flex items-center"
                          style={{
                            left: `${el.x * zoomScale}px`,
                            top: `${el.y * zoomScale}px`,
                            width: `${el.width * zoomScale}px`,
                            height: `${el.height * zoomScale}px`,
                            fontFamily: el.properties.fontFamily || 'Cairo',
                            fontSize: `${(el.properties.fontSize || 10) * (zoomScale / 3.5)}pt`,
                            fontWeight: el.properties.bold ? 'bold' : 'normal',
                            fontStyle: el.properties.italic ? 'italic' : 'normal',
                            textDecoration: el.properties.underline ? 'underline' : 'none',
                            color: el.properties.color || '#000000',
                            backgroundColor: el.properties.backgroundColor || 'transparent',
                            border: el.properties.borderWidth ? `${el.properties.borderWidth}px solid ${el.properties.borderColor || '#000'}` : 'none',
                            borderRadius: el.properties.borderRadius ? `${el.properties.borderRadius}px` : '0px',
                            textAlign: el.properties.align || 'left',
                            opacity: el.properties.opacity ?? 1,
                            transform: `rotate(${el.properties.rotation || 0}deg)`,
                            justifyContent: el.properties.align === 'center' ? 'center' : el.properties.align === 'right' ? 'flex-end' : 'flex-start',
                            padding: `${(el.properties.padding || 0) * zoomScale}px`
                          }}
                        >
                          {el.type === 'text' && el.properties.text}
                          {el.type === 'variable' && typeof previewDocData[el.binding as keyof typeof previewDocData] !== 'object' ? String(previewDocData[el.binding as keyof typeof previewDocData] ?? '') : ''}
                          {el.type === 'field' && 'حقل ديناميكي / Field Value'}
                          {el.type === 'logo' && (
                            <div className="w-full h-full border border-zinc-200 bg-zinc-50 rounded flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                              LOGO
                            </div>
                          )}
                          {el.type === 'image' && (
                            el.properties.imageUrl ? (
                              <img src={el.properties.imageUrl} alt="element" className="w-full h-full object-contain" />
                            ) : (
                              <div className="w-full h-full border border-dashed border-zinc-200 bg-zinc-50 rounded" />
                            )
                          )}
                          {el.type === 'line' && (
                            <div 
                              className="w-full h-full" 
                              style={{ 
                                borderTop: el.width >= el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none',
                                borderLeft: el.width < el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none'
                              }} 
                            />
                          )}
                          {el.type === 'rectangle' && <div className="w-full h-full" />}
                          {el.type === 'circle' && <div className="w-full h-full rounded-full border border-zinc-950" style={{ borderColor: el.properties.borderColor }} />}
                          {el.type === 'qr' && (
                            <div className="p-0.5 bg-white border border-zinc-100 flex items-center justify-center">
                              <QRCode value="Invoice: INV-2026-90432 Total: 6325.00 SAR Date: 2026-06-21" size={Math.min(el.width, el.height) * zoomScale - 4} />
                            </div>
                          )}
                          {el.type === 'barcode' && (
                            <div className="p-0.5 bg-white border border-zinc-100 flex items-center justify-center w-full h-full overflow-hidden">
                              <BarcodeComponent value="INV202690432" width={1.2} height={Math.min(el.height) * zoomScale - 10} displayValue={false} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                  </div>
                ) : (
                  /* VISUAL DESIGN EDIT MODE */
                  <div 
                    className="bg-white border border-zinc-300 shadow-xl relative overflow-hidden transition-all"
                    style={{
                      width: `${printableWidth * zoomScale}px`,
                      paddingTop: `${formData.margin_top * zoomScale}px`,
                      paddingBottom: `${formData.margin_bottom * zoomScale}px`,
                      paddingLeft: `${formData.margin_left * zoomScale}px`,
                      paddingRight: `${formData.margin_right * zoomScale}px`,
                      backgroundImage: designerLayout.bgImage ? `url(${designerLayout.bgImage})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                    onClick={() => {
                      setSelectedElementId(null);
                      setSelectedSection(null);
                    }}
                  >
                    
                    {/* Grid Lines Renderer */}
                    {showGrid && (
                      <div 
                        className="absolute inset-0 pointer-events-none z-0" 
                        style={{
                          backgroundImage: `radial-gradient(circle, #e4e4e7 1px, transparent 1px)`,
                          backgroundSize: `${GRID_STEP * zoomScale}px ${GRID_STEP * zoomScale}px`
                        }}
                      />
                    )}

                    {/* Watermark Mock Renderer */}
                    {(designerLayout.watermarkText || designerLayout.watermarkImage) && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 border border-dashed border-zinc-200">
                        {designerLayout.watermarkText && (
                          <span
                            className="font-bold"
                            style={{
                              fontSize: '5vw',
                              opacity: (designerLayout.watermarkOpacity ?? 0.15) * 1.5,
                              transform: `rotate(${designerLayout.watermarkRotation ?? -45}deg)`,
                              color: '#d4d4d8'
                            }}
                          >
                            {designerLayout.watermarkText}
                          </span>
                        )}
                        {designerLayout.watermarkImage && (
                          <img
                            src={designerLayout.watermarkImage}
                            alt="watermark_mock"
                            style={{
                              transform: `rotate(${designerLayout.watermarkRotation ?? -45}deg)`,
                              opacity: (designerLayout.watermarkOpacity ?? 0.15) * 1.5,
                              maxWidth: '30%',
                              maxHeight: '30%'
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* Snap Guide Lines Visualizer */}
                    {snapGuides && (
                      <div className="absolute inset-0 pointer-events-none z-20">
                        {snapGuides.x.map((xVal, index) => (
                          <div 
                            key={`x-${index}`} 
                            className="absolute top-0 bottom-0 border-l border-dashed border-red-500" 
                            style={{ left: `${(xVal + formData.margin_left) * zoomScale}px` }} 
                          />
                        ))}
                        {snapGuides.y.map((yVal, index) => (
                          <div 
                            key={`y-${index}`} 
                            className="absolute left-0 right-0 border-t border-dashed border-red-500" 
                            style={{ top: `${(yVal + formData.margin_top) * zoomScale}px` }} 
                          />
                        ))}
                      </div>
                    )}

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
                      className={`border border-dashed transition-all relative select-none z-10 ${
                        selectedSection === 'header' && !selectedElementId 
                          ? 'border-emerald-500 bg-emerald-50/10' 
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                      style={{
                        height: `${designerLayout.headerHeight * zoomScale}px`,
                        width: '100%'
                      }}
                    >
                      <div className="absolute top-1 right-2 text-[9px] font-bold text-zinc-400 uppercase pointer-events-none select-none">
                        Header / الهيدر ({designerLayout.headerHeight}mm)
                      </div>

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
                              ? 'ring-2 ring-emerald-500 ring-offset-1 bg-emerald-50/20' 
                              : 'hover:ring-1 hover:ring-zinc-300'
                          } ${el.properties.hidden ? 'opacity-30' : ''}`}
                          style={{
                            left: `${el.x * zoomScale}px`,
                            top: `${el.y * zoomScale}px`,
                            width: `${el.width * zoomScale}px`,
                            height: `${el.height * zoomScale}px`,
                            fontFamily: el.properties.fontFamily || 'Cairo',
                            fontSize: `${(el.properties.fontSize || 10) * (zoomScale / 3.5)}pt`,
                            fontWeight: el.properties.bold ? 'bold' : 'normal',
                            fontStyle: el.properties.italic ? 'italic' : 'normal',
                            textDecoration: el.properties.underline ? 'underline' : 'none',
                            color: el.properties.color || '#000000',
                            backgroundColor: el.properties.backgroundColor || 'transparent',
                            border: el.properties.borderWidth ? `${el.properties.borderWidth}px solid ${el.properties.borderColor || '#000'}` : 'none',
                            borderRadius: el.properties.borderRadius ? `${el.properties.borderRadius}px` : '0px',
                            textAlign: el.properties.align || 'left',
                            opacity: el.properties.opacity ?? 1,
                            transform: `rotate(${el.properties.rotation || 0}deg)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: el.properties.align === 'center' ? 'center' : el.properties.align === 'right' ? 'flex-end' : 'flex-start',
                            padding: `${(el.properties.padding || 0) * zoomScale}px`
                          }}
                        >
                          {el.properties.locked && (
                            <div className="absolute top-0.5 right-0.5 p-0.5 bg-amber-500 text-white rounded pointer-events-none">
                              <Lock size={8} />
                            </div>
                          )}

                          {el.type === 'text' && (el.properties.text || 'Text')}
                          {el.type === 'variable' && (
                            <span className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-1 py-0.5 rounded text-[10px] select-none font-bold">
                              {"{"}{el.binding}{"}"}
                            </span>
                          )}
                          {el.type === 'field' && (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.5 rounded text-[10px] select-none font-bold">
                              {"{"}{el.properties.text || el.binding}{"}"}
                            </span>
                          )}
                          {el.type === 'logo' && (
                            <div className="w-full h-full border border-dashed border-zinc-300 rounded flex items-center justify-center bg-zinc-50/50 text-[10px] font-extrabold text-zinc-400">
                              [ LOGO ]
                            </div>
                          )}
                          {el.type === 'image' && (
                            el.properties.imageUrl ? (
                              <img src={el.properties.imageUrl} alt="custom" className="w-full h-full object-contain pointer-events-none" />
                            ) : (
                              <div className="w-full h-full border border-dashed border-zinc-300 rounded flex items-center justify-center bg-zinc-50/50 text-[10px] font-extrabold text-zinc-400">
                                [ IMAGE ]
                              </div>
                            )
                          )}
                          {el.type === 'line' && (
                            <div 
                              className="w-full h-full pointer-events-none" 
                              style={{ 
                                borderTop: el.width >= el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none',
                                borderLeft: el.width < el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none'
                              }} 
                            />
                          )}
                          {el.type === 'rectangle' && <div className="w-full h-full" />}
                          {el.type === 'circle' && <div className="w-full h-full rounded-full border border-zinc-950" style={{ borderColor: el.properties.borderColor }} />}
                          {el.type === 'qr' && (
                            <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center border border-zinc-200 text-zinc-400">
                              <QrCode size={Math.min(el.width, el.height) * zoomScale * 0.7} />
                            </div>
                          )}
                          {el.type === 'barcode' && (
                            <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center border border-zinc-200 text-zinc-400">
                              <Barcode size={Math.min(el.width, el.height) * zoomScale * 0.7} />
                            </div>
                          )}

                          {/* Resize handles */}
                          {selectedElementId === el.id && !el.properties.locked && (
                            <div
                              onMouseDown={(e) => handleMouseDown(e, el.id, 'header', 'resize')}
                              className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-600 border border-white cursor-se-resize z-20 shadow-md rounded-full"
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
                      className={`border transition-all my-4 relative select-none z-10 ${
                        selectedSection === 'details' 
                          ? 'border-emerald-500 bg-emerald-50/10' 
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="absolute -top-4 right-2 text-[9px] font-bold text-zinc-400 uppercase pointer-events-none select-none">
                        Details Table / جدول التفاصيل
                      </div>

                      <table 
                        className="w-full border-collapse"
                        style={{
                          fontSize: `${(designerLayout.details.properties.fontSize || 10) * (zoomScale / 3.5)}pt`,
                          fontFamily: designerLayout.details.properties.fontFamily || 'Cairo',
                          borderColor: designerLayout.details.properties.borderColor || '#e4e4e7'
                        }}
                      >
                        <thead>
                          <tr 
                            style={{
                              backgroundColor: designerLayout.details.properties.headerBgColor || '#f4f4f5',
                              borderColor: designerLayout.details.properties.borderColor || '#e4e4e7'
                            }}
                            className="border-b"
                          >
                            {designerLayout.details.columns.map(col => (
                              <th 
                                key={col.id} 
                                className={`border border-zinc-200 p-2 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                                style={{
                                  width: `${col.width}%`,
                                  borderColor: designerLayout.details.properties.borderColor || '#e4e4e7',
                                  fontWeight: designerLayout.details.properties.boldHeader ? 'bold' : 'normal',
                                  padding: `${designerLayout.details.properties.paddingY ?? 2}px ${designerLayout.details.properties.paddingX ?? 2}px`
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
                              style={{
                                backgroundColor: designerLayout.details.properties.bodyBgColor || '#ffffff',
                                borderColor: designerLayout.details.properties.borderColor || '#e4e4e7',
                                height: `${(designerLayout.details.properties.rowHeight || 8) * zoomScale}px`
                              }}
                              className="border-b"
                            >
                              {designerLayout.details.columns.map(col => (
                                <td 
                                  key={col.id} 
                                  className="border p-2 text-zinc-400"
                                  style={{
                                    borderColor: designerLayout.details.properties.borderColor || '#e4e4e7',
                                    padding: `${designerLayout.details.properties.paddingY ?? 2}px ${designerLayout.details.properties.paddingX ?? 2}px`
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
                      className={`border border-dashed transition-all relative select-none z-10 ${
                        selectedSection === 'footer' && !selectedElementId 
                          ? 'border-emerald-500 bg-emerald-50/10' 
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                      style={{
                        height: `${designerLayout.footerHeight * zoomScale}px`,
                        width: '100%'
                      }}
                    >
                      <div className="absolute top-1 right-2 text-[9px] font-bold text-zinc-400 uppercase pointer-events-none select-none">
                        Footer / الفوتر ({designerLayout.footerHeight}mm)
                      </div>

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
                              ? 'ring-2 ring-emerald-500 ring-offset-1 bg-emerald-50/20' 
                              : 'hover:ring-1 hover:ring-zinc-300'
                          } ${el.properties.hidden ? 'opacity-30' : ''}`}
                          style={{
                            left: `${el.x * zoomScale}px`,
                            top: `${el.y * zoomScale}px`,
                            width: `${el.width * zoomScale}px`,
                            height: `${el.height * zoomScale}px`,
                            fontFamily: el.properties.fontFamily || 'Cairo',
                            fontSize: `${(el.properties.fontSize || 10) * (zoomScale / 3.5)}pt`,
                            fontWeight: el.properties.bold ? 'bold' : 'normal',
                            fontStyle: el.properties.italic ? 'italic' : 'normal',
                            textDecoration: el.properties.underline ? 'underline' : 'none',
                            color: el.properties.color || '#000000',
                            backgroundColor: el.properties.backgroundColor || 'transparent',
                            border: el.properties.borderWidth ? `${el.properties.borderWidth}px solid ${el.properties.borderColor || '#000'}` : 'none',
                            borderRadius: el.properties.borderRadius ? `${el.properties.borderRadius}px` : '0px',
                            textAlign: el.properties.align || 'left',
                            opacity: el.properties.opacity ?? 1,
                            transform: `rotate(${el.properties.rotation || 0}deg)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: el.properties.align === 'center' ? 'center' : el.properties.align === 'right' ? 'flex-end' : 'flex-start',
                            padding: `${(el.properties.padding || 0) * zoomScale}px`
                          }}
                        >
                          {el.properties.locked && (
                            <div className="absolute top-0.5 right-0.5 p-0.5 bg-amber-500 text-white rounded pointer-events-none">
                              <Lock size={8} />
                            </div>
                          )}

                          {el.type === 'text' && (el.properties.text || 'Text')}
                          {el.type === 'variable' && (
                            <span className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-1 py-0.5 rounded text-[10px] select-none font-bold">
                              {"{"}{el.binding}{"}"}
                            </span>
                          )}
                          {el.type === 'field' && (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.5 rounded text-[10px] select-none font-bold">
                              {"{"}{el.properties.text || el.binding}{"}"}
                            </span>
                          )}
                          {el.type === 'logo' && (
                            <div className="w-full h-full border border-dashed border-zinc-300 rounded flex items-center justify-center bg-zinc-50/50 text-[10px] font-extrabold text-zinc-400">
                              [ LOGO ]
                            </div>
                          )}
                          {el.type === 'image' && (
                            el.properties.imageUrl ? (
                              <img src={el.properties.imageUrl} alt="custom" className="w-full h-full object-contain pointer-events-none" />
                            ) : (
                              <div className="w-full h-full border border-dashed border-zinc-300 rounded flex items-center justify-center bg-zinc-50/50 text-[10px] font-extrabold text-zinc-400">
                                [ IMAGE ]
                              </div>
                            )
                          )}
                          {el.type === 'line' && (
                            <div 
                              className="w-full h-full pointer-events-none" 
                              style={{ 
                                borderTop: el.width >= el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none',
                                borderLeft: el.width < el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none'
                              }} 
                            />
                          )}
                          {el.type === 'rectangle' && <div className="w-full h-full" />}
                          {el.type === 'circle' && <div className="w-full h-full rounded-full border border-zinc-950" style={{ borderColor: el.properties.borderColor }} />}
                          {el.type === 'qr' && (
                            <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center border border-zinc-200 text-zinc-400">
                              <QrCode size={Math.min(el.width, el.height) * zoomScale * 0.7} />
                            </div>
                          )}
                          {el.type === 'barcode' && (
                            <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center border border-zinc-200 text-zinc-400">
                              <Barcode size={Math.min(el.width, el.height) * zoomScale * 0.7} />
                            </div>
                          )}

                          {/* Resize handles */}
                          {selectedElementId === el.id && !el.properties.locked && (
                            <div
                              onMouseDown={(e) => handleMouseDown(e, el.id, 'footer', 'resize')}
                              className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-600 border border-white cursor-se-resize z-20 shadow-md rounded-full"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                  </div>
                )}

              </div>

              {/* 3. RIGHT SIDEBAR: PROPERTIES PANEL */}
              <div className="w-80 bg-white border border-zinc-200 rounded-2xl flex flex-col overflow-hidden shadow-sm h-full">
                
                {activeElement ? (
                  /* ELEMENT PROPERTIES */
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
                      
                      {/* Dimensions in active unit */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                          {language === 'ar' ? `الأبعاد والموقع (${activeUnit})` : `Dimensions (${activeUnit})`}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">X (أفقي)</label>
                            <input
                              type="number"
                              step="any"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold"
                              value={convertFromMM(activeElement.x, activeUnit)}
                              onChange={(e) => handleUpdateElementProperty('x', convertToMM(parseFloat(e.target.value) || 0, activeUnit))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">Y (رأسي)</label>
                            <input
                              type="number"
                              step="any"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold"
                              value={convertFromMM(activeElement.y, activeUnit)}
                              onChange={(e) => handleUpdateElementProperty('y', convertToMM(parseFloat(e.target.value) || 0, activeUnit))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'العرض' : 'Width'}</label>
                            <input
                              type="number"
                              step="any"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold"
                              value={convertFromMM(activeElement.width, activeUnit)}
                              onChange={(e) => handleUpdateElementProperty('width', convertToMM(parseFloat(e.target.value) || 0, activeUnit))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الارتفاع' : 'Height'}</label>
                            <input
                              type="number"
                              step="any"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold"
                              value={convertFromMM(activeElement.height, activeUnit)}
                              onChange={(e) => handleUpdateElementProperty('height', convertToMM(parseFloat(e.target.value) || 0, activeUnit))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Content editor */}
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

                      {/* Custom image upload/link */}
                      {activeElement.type === 'image' && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-600">{language === 'ar' ? 'رابط الصورة' : 'Image URL'}</label>
                            <input
                              type="text"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={activeElement.properties.imageUrl || ''}
                              onChange={(e) => handleUpdateElementProperty('imageUrl', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-600">{language === 'ar' ? 'تحميل صورة' : 'Upload Image'}</label>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all">
                                <Upload size={12} />
                                <span>{language === 'ar' ? 'اختر ملف...' : 'Choose file...'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={handleElementImageUpload}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Typography editing */}
                      {['text', 'variable', 'field'].includes(activeElement.type) && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'تنسيق الخط' : 'Typography'}</h4>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'حجم الخط (pt)' : 'Font Size (pt)'}</label>
                              <input
                                type="number"
                                className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                                value={activeElement.properties.fontSize || 10}
                                onChange={(e) => handleUpdateElementProperty('fontSize', parseInt(e.target.value) || 10)}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'نوع الخط' : 'Font Family'}</label>
                              <select
                                className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold"
                                value={activeElement.properties.fontFamily || 'Cairo'}
                                onChange={(e) => handleUpdateElementProperty('fontFamily', e.target.value)}
                              >
                                <option value="Cairo">Cairo (عربي)</option>
                                <option value="Arial">Arial</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Courier New">Monospace</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex gap-1.5 bg-zinc-50 p-1.5 rounded-xl border border-zinc-200">
                            <button
                              type="button"
                              onClick={() => handleUpdateElementProperty('bold', !activeElement.properties.bold)}
                              className={`flex-1 py-1 rounded text-xs font-black transition-all ${
                                activeElement.properties.bold ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800'
                              }`}
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateElementProperty('italic', !activeElement.properties.italic)}
                              className={`flex-1 py-1 rounded text-xs font-bold italic transition-all ${
                                activeElement.properties.italic ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800'
                              }`}
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateElementProperty('underline', !activeElement.properties.underline)}
                              className={`flex-1 py-1 rounded text-xs font-bold underline transition-all ${
                                activeElement.properties.underline ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800'
                              }`}
                            >
                              U
                            </button>
                          </div>

                          {/* Line Height */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'ارتفاع السطر' : 'Line Height'}</label>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              max="3"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={activeElement.properties.lineHeight || 1.2}
                              onChange={(e) => handleUpdateElementProperty('lineHeight', parseFloat(e.target.value) || 1.2)}
                            />
                          </div>

                          {/* Alignment */}
                          <div className="flex gap-1.5 bg-zinc-50 p-1.5 rounded-xl border border-zinc-200">
                            {(['left', 'center', 'right', 'justify'] as const).map(align => (
                              <button
                                key={align}
                                type="button"
                                onClick={() => handleUpdateElementProperty('align', align)}
                                className={`flex-1 py-1 rounded text-xs font-bold capitalize transition-all ${
                                  activeElement.properties.align === align ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800'
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
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'لون العنصر' : 'Color'}</label>
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

                        {/* Borders & Opacity */}
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
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'زاوية انحناء الحد' : 'Border Radius'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={activeElement.properties.borderRadius || 0}
                              onChange={(e) => handleUpdateElementProperty('borderRadius', parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'لون الحدود' : 'Border Color'}</label>
                          <input
                            type="color"
                            className="w-full h-8 p-0.5 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                            value={activeElement.properties.borderColor || '#000000'}
                            onChange={(e) => handleUpdateElementProperty('borderColor', e.target.value)}
                          />
                        </div>

                        {/* Rotation */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-zinc-500">
                            <span>{language === 'ar' ? 'التدوير (درجة)' : 'Rotation (deg)'}</span>
                            <span>{activeElement.properties.rotation || 0}°</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                            value={activeElement.properties.rotation || 0}
                            onChange={(e) => handleUpdateElementProperty('rotation', parseInt(e.target.value) || 0)}
                          />
                        </div>

                        {/* Opacity */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-zinc-500">
                            <span>{language === 'ar' ? 'الشفافية' : 'Opacity'}</span>
                            <span>{Math.round((activeElement.properties.opacity ?? 1) * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                            value={activeElement.properties.opacity ?? 1}
                            onChange={(e) => handleUpdateElementProperty('opacity', parseFloat(e.target.value))}
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                ) : selectedSection === 'details' ? (
                  /* DETAILS TABLE DESIGNER */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                      <h3 className="text-sm font-black text-zinc-900 flex items-center gap-1.5">
                        <Paintbrush size={16} className="text-emerald-600" />
                        <span>{language === 'ar' ? 'مصمم جدول التفاصيل' : 'Details Table Designer'}</span>
                      </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                      
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-600">{language === 'ar' ? 'حجم خط الجدول' : 'Table Font Size'}</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                          value={designerLayout.details.properties.fontSize || 10}
                          onChange={(e) => updateLayoutWithHistory({
                            ...designerLayout,
                            details: {
                              ...designerLayout.details,
                              properties: { ...designerLayout.details.properties, fontSize: parseInt(e.target.value) || 10 }
                            }
                          })}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-600">{language === 'ar' ? 'ارتفاع الصفوف (مم)' : 'Row Height (mm)'}</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                          value={designerLayout.details.properties.rowHeight || 8}
                          onChange={(e) => updateLayoutWithHistory({
                            ...designerLayout,
                            details: {
                              ...designerLayout.details,
                              properties: { ...designerLayout.details.properties, rowHeight: parseInt(e.target.value) || 8 }
                            }
                          })}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-600">{language === 'ar' ? 'نوع خط الجدول' : 'Table Font Family'}</label>
                        <select
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold"
                          value={designerLayout.details.properties.fontFamily || 'Cairo'}
                          onChange={(e) => updateLayoutWithHistory({
                            ...designerLayout,
                            details: {
                              ...designerLayout.details,
                              properties: { ...designerLayout.details.properties, fontFamily: e.target.value }
                            }
                          })}
                        >
                          <option value="Cairo">Cairo (عربي)</option>
                          <option value="Arial">Arial</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Courier New">Monospace</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'خلفية رأس الجدول' : 'Header Background'}</label>
                          <input
                            type="color"
                            className="w-full h-8 p-0.5 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                            value={designerLayout.details.properties.headerBgColor || '#f4f4f5'}
                            onChange={(e) => updateLayoutWithHistory({
                              ...designerLayout,
                              details: {
                                ...designerLayout.details,
                                properties: { ...designerLayout.details.properties, headerBgColor: e.target.value }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'خلفية الصفوف' : 'Body Background'}</label>
                          <input
                            type="color"
                            className="w-full h-8 p-0.5 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                            value={designerLayout.details.properties.bodyBgColor || '#ffffff'}
                            onChange={(e) => updateLayoutWithHistory({
                              ...designerLayout,
                              details: {
                                ...designerLayout.details,
                                properties: { ...designerLayout.details.properties, bodyBgColor: e.target.value }
                              }
                            })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'سُمك الحدود' : 'Grid Border Width'}</label>
                          <input
                            type="number"
                            className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                            value={designerLayout.details.properties.borderWidth || 1}
                            onChange={(e) => updateLayoutWithHistory({
                              ...designerLayout,
                              details: {
                                ...designerLayout.details,
                                properties: { ...designerLayout.details.properties, borderWidth: parseInt(e.target.value) || 0 }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'لون الحدود' : 'Grid Border Color'}</label>
                          <input
                            type="color"
                            className="w-full h-8 p-0.5 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer"
                            value={designerLayout.details.properties.borderColor || '#e4e4e7'}
                            onChange={(e) => updateLayoutWithHistory({
                              ...designerLayout,
                              details: {
                                ...designerLayout.details,
                                properties: { ...designerLayout.details.properties, borderColor: e.target.value }
                              }
                            })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'هوامش الخلايا X (مم)' : 'Cell Padding X'}</label>
                          <input
                            type="number"
                            className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                            value={designerLayout.details.properties.paddingX || 2}
                            onChange={(e) => updateLayoutWithHistory({
                              ...designerLayout,
                              details: {
                                ...designerLayout.details,
                                properties: { ...designerLayout.details.properties, paddingX: parseInt(e.target.value) || 0 }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'هوامش الخلايا Y (مم)' : 'Cell Padding Y'}</label>
                          <input
                            type="number"
                            className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                            value={designerLayout.details.properties.paddingY || 2}
                            onChange={(e) => updateLayoutWithHistory({
                              ...designerLayout,
                              details: {
                                ...designerLayout.details,
                                properties: { ...designerLayout.details.properties, paddingY: parseInt(e.target.value) || 0 }
                              }
                            })}
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-zinc-50 rounded-xl">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500/20"
                          checked={designerLayout.details.properties.boldHeader || false}
                          onChange={(e) => updateLayoutWithHistory({
                            ...designerLayout,
                            details: {
                              ...designerLayout.details,
                              properties: { ...designerLayout.details.properties, boldHeader: e.target.checked }
                            }
                          })}
                        />
                        <span className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'رأس جدول عريض (Bold)' : 'Bold Headers'}</span>
                      </label>

                      {/* Details variables columns checkboxes */}
                      <div className="space-y-3 pt-3 border-t border-zinc-100">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'أعمدة التفاصيل القياسية' : 'Standard Detail Columns'}</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto border border-zinc-100 p-2 rounded-xl">
                          {DETAILS_COLUMNS_PRESETS.map(preset => {
                            const isAdded = designerLayout.details.columns.some(col => col.field === preset.field);
                            return (
                              <label key={preset.id} className="flex items-center justify-between text-xs font-semibold text-zinc-700 cursor-pointer p-1 hover:bg-zinc-50 rounded-lg">
                                <span className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded text-emerald-600"
                                    checked={isAdded}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const newCol = { id: preset.id, label: language === 'ar' ? preset.arLabel : preset.enLabel, field: preset.field, width: 10 };
                                        updateLayoutWithHistory({
                                          ...designerLayout,
                                          details: { ...designerLayout.details, columns: [...designerLayout.details.columns, newCol] }
                                        });
                                      } else {
                                        const filtered = designerLayout.details.columns.filter(col => col.field !== preset.field);
                                        updateLayoutWithHistory({
                                          ...designerLayout,
                                          details: { ...designerLayout.details, columns: filtered }
                                        });
                                      }
                                    }}
                                  />
                                  <span>{language === 'ar' ? preset.arLabel : preset.enLabel}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Adjust columns width range */}
                      <div className="space-y-3 pt-3 border-t border-zinc-100">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'تعديل عرض الأعمدة (%)' : 'Column Widths (%)'}</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto border border-zinc-100 p-2 rounded-xl">
                          {designerLayout.details.columns.map(col => (
                            <div key={col.id} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-700">
                                <span>{col.label}</span>
                                <span>{col.width}%</span>
                              </div>
                              <input
                                type="range"
                                min="5"
                                max="80"
                                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                value={col.width}
                                onChange={(e) => {
                                  const updatedCols = designerLayout.details.columns.map(c => 
                                    c.id === col.id ? { ...c, width: parseInt(e.target.value) || 5 } : c
                                  );
                                  // Just set state, push to history on mouseup/change end
                                  setDesignerLayout(prev => ({
                                    ...prev,
                                    details: { ...prev.details, columns: updatedCols }
                                  }));
                                }}
                                onMouseUp={() => {
                                  updateLayoutWithHistory(designerLayout);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                ) : (
                  /* GENERAL PAGE LAYOUT SETTINGS */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                      <h3 className="text-sm font-black text-zinc-900">{language === 'ar' ? 'إعدادات الصفحة العامة' : 'Page Layout Settings'}</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                      
                      {/* Paper preset */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'حجم الورقة' : 'Paper Size'}</label>
                        <select
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none"
                          value={formData.paper_size_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, paper_size_id: e.target.value }))}
                        >
                          {PAPER_SIZES_PRESETS.map(preset => (
                            <option key={preset.id} value={preset.id}>{preset.name}</option>
                          ))}
                          {paperSizes.map(size => (
                            <option key={size.id} value={size.id}>{size.name}</option>
                          ))}
                          <option value="custom">{language === 'ar' ? 'أبعاد مخصصة' : 'Custom Dimensions'}</option>
                        </select>
                      </div>

                      {formData.paper_size_id === 'custom' && (
                        <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'العرض (مم)' : 'Width (mm)'}</label>
                            <input
                              type="number"
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs"
                              value={formData.customWidth}
                              onChange={(e) => setFormData(prev => ({ ...prev, customWidth: parseInt(e.target.value) || 210 }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الارتفاع (مم)' : 'Height (mm)'}</label>
                            <input
                              type="number"
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs"
                              value={formData.customHeight}
                              onChange={(e) => setFormData(prev => ({ ...prev, customHeight: parseInt(e.target.value) || 297 }))}
                            />
                          </div>
                        </div>
                      )}

                      {/* Orientation */}
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

                      {/* Section heights */}
                      <div className="space-y-3 pt-2 border-t border-zinc-100">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'ارتفاع الأقسام (مم)' : 'Section Heights (mm)'}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'ارتفاع الهيدر' : 'Header Height'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={designerLayout.headerHeight}
                              onChange={(e) => updateLayoutWithHistory({ ...designerLayout, headerHeight: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'ارتفاع الفوتر' : 'Footer Height'}</label>
                            <input
                              type="number"
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                              value={designerLayout.footerHeight}
                              onChange={(e) => updateLayoutWithHistory({ ...designerLayout, footerHeight: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Margins */}
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

                      {/* Custom Background Image & Watermark */}
                      <div className="space-y-3 pt-2 border-t border-zinc-100">
                        <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">{language === 'ar' ? 'الخلفيات والعلامات المائية' : 'Background & Watermark'}</h4>
                        
                        {/* Bg Image */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'صورة خلفية القالب' : 'Background Image'}</label>
                          <input
                            type="file"
                            accept="image/*"
                            className="w-full text-xs"
                            onChange={(e) => handleBgImageUpload(e, 'bgImage')}
                          />
                          {designerLayout.bgImage && (
                            <button
                              type="button"
                              onClick={() => updateLayoutWithHistory({ ...designerLayout, bgImage: undefined })}
                              className="text-[9px] text-red-500 font-bold hover:underline"
                            >
                              {language === 'ar' ? 'حذف الخلفية' : 'Remove Background'}
                            </button>
                          )}
                        </div>

                        {/* Watermark text */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'العلامة المائية (نص)' : 'Watermark (Text)'}</label>
                          <input
                            type="text"
                            placeholder="CONFIDENTIAL"
                            className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                            value={designerLayout.watermarkText || ''}
                            onChange={(e) => updateLayoutWithHistory({ ...designerLayout, watermarkText: e.target.value })}
                          />
                        </div>

                        {/* Watermark image */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'العلامة المائية (صورة)' : 'Watermark (Image)'}</label>
                          <input
                            type="file"
                            accept="image/*"
                            className="w-full text-xs"
                            onChange={(e) => handleBgImageUpload(e, 'watermarkImage')}
                          />
                          {designerLayout.watermarkImage && (
                            <button
                              type="button"
                              onClick={() => updateLayoutWithHistory({ ...designerLayout, watermarkImage: undefined })}
                              className="text-[9px] text-red-500 font-bold hover:underline"
                            >
                              {language === 'ar' ? 'حذف صورة العلامة' : 'Remove Watermark Image'}
                            </button>
                          )}
                        </div>

                        {/* Watermark opacity */}
                        {(designerLayout.watermarkText || designerLayout.watermarkImage) && (
                          <>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-zinc-500">
                                <span>{language === 'ar' ? 'شفافية العلامة' : 'Watermark Opacity'}</span>
                                <span>{Math.round((designerLayout.watermarkOpacity ?? 0.15) * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                value={designerLayout.watermarkOpacity ?? 0.15}
                                onChange={(e) => updateLayoutWithHistory({ ...designerLayout, watermarkOpacity: parseFloat(e.target.value) })}
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-zinc-500">
                                <span>{language === 'ar' ? 'زاوية العلامة' : 'Watermark Rotation'}</span>
                                <span>{designerLayout.watermarkRotation ?? -45}°</span>
                              </div>
                              <input
                                type="range"
                                min="-180"
                                max="180"
                                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                value={designerLayout.watermarkRotation ?? -45}
                                onChange={(e) => updateLayoutWithHistory({ ...designerLayout, watermarkRotation: parseInt(e.target.value) })}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Active Status */}
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
