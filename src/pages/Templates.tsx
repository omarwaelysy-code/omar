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
import { useNotification } from '../contexts/NotificationContext';
import { validateTemplate, ValidationError } from '../utils/templateValidation';
import { VARIABLE_REGISTRY } from '../components/VariableRegistry';
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
    mode?: 'table' | 'repeater';
    height?: number;
    elements?: TemplateElement[];
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
  document_type?: string;
  is_default?: boolean;
  print_profile_id?: string;
}

interface PrintProfile {
  id: string;
  company_id: string;
  name: string;
  paper_size_id: string;
  custom_width?: number;
  custom_height?: number;
  orientation: 'portrait' | 'landscape';
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  dpi: number;
  print_settings?: any;
  created_at?: string;
  updated_at?: string;
}

interface TemplateVersion {
  id: string;
  template_id: string;
  company_id: string;
  version_number: number;
  layout: TemplateLayout;
  change_notes: string;
  created_by: string;
  created_at: string;
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

const DOCUMENT_TYPES = [
  { id: 'invoices', ar: 'فاتورة مبيعات / Sales Invoice', en: 'Sales Invoice' },
  { id: 'purchase_invoices', ar: 'فاتورة مشتريات / Purchase Invoice', en: 'Purchase Invoice' },
  { id: 'returns', ar: 'مرتجع مبيعات / Sales Return', en: 'Sales Return' },
  { id: 'purchase_returns', ar: 'مرتجع مشتريات / Purchase Return', en: 'Purchase Return' },
  { id: 'sales_orders', ar: 'أمر بيع / Sales Order', en: 'Sales Order' },
  { id: 'purchase_orders', ar: 'أمر شراء / Purchase Order', en: 'Purchase Order' },
  { id: 'receipt_vouchers', ar: 'سند قبض / Receipt Voucher', en: 'Receipt Voucher' },
  { id: 'payment_vouchers', ar: 'سند صرف / Payment Voucher', en: 'Payment Voucher' },
  { id: 'journal_entries', ar: 'قيد يومية / Journal Entry', en: 'Journal Entry' }
];

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
  const { showNotification } = useNotification();

  const toast = {
    success: (msg: string) => showNotification(msg, 'success'),
    error: (msg: string) => showNotification(msg, 'error'),
    info: (msg: string) => showNotification(msg, 'info'),
    warning: (msg: string) => showNotification(msg, 'warning')
  };
  
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
  const [leftSidebarTab, setLeftSidebarTab] = useState<'toolbox' | 'layers' | 'history'>('toolbox');
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
    customUnit: 'mm',
    document_type: 'invoices',
    is_default: false,
    print_profile_id: ''
  });

  const [printProfiles, setPrintProfiles] = useState<PrintProfile[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [subTab, setSubTab] = useState<'templates' | 'profiles' | 'assignments'>('templates');
  const [editingProfile, setEditingProfile] = useState<PrintProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: '',
    paper_size_id: 'a4',
    custom_width: 210,
    custom_height: 297,
    orientation: 'portrait' as 'portrait' | 'landscape',
    margin_top: 10,
    margin_bottom: 10,
    margin_left: 10,
    margin_right: 10,
    dpi: 300,
    print_settings: '' // Text representation for JSON input
  });

  // Visual Designer Layout
  const [designerLayout, setDesignerLayout] = useState<TemplateLayout>(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));

  // Validation and versioning states
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');
  const [templateVersions, setTemplateVersions] = useState<TemplateVersion[]>([]);
  
  // Pending document type changes & unsaved changes confirmation modal states
  const [pendingDocTypeChange, setPendingDocTypeChange] = useState<string | null>(null);
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [nextPendingDocType, setNextPendingDocType] = useState<string>('');

  const headerCanvasRef = useRef<HTMLDivElement>(null);
  const footerCanvasRef = useRef<HTMLDivElement>(null);

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

  const fetchVersions = async (templateId: string) => {
    try {
      const versions = await dbService.list<TemplateVersion>('template_versions', {
        where: { template_id: templateId },
        order: [['version_number', 'DESC']]
      });
      setTemplateVersions(versions);
    } catch (error) {
      console.error('Failed to fetch template versions:', error);
    }
  };

  useEffect(() => {
    if (editingTemplate) {
      fetchVersions(editingTemplate.id);
    } else {
      setTemplateVersions([]);
    }
  }, [editingTemplate]);

  const hasUnsavedChanges = (): boolean => {
    if (historyIndex > 0) return true;

    if (editingTemplate) {
      if (formData.name !== editingTemplate.name) return true;
      if (formData.description !== (editingTemplate.description || '')) return true;
      if (formData.is_active !== editingTemplate.is_active) return true;
      if (formData.is_default !== (editingTemplate.is_default || false)) return true;
    } else {
      if (formData.name.trim() !== '') return true;
      if (formData.description.trim() !== '') return true;
    }
    return false;
  };

  const matchCategoryForDocType = (docType: string): string => {
    // Try exact match on code
    let cat = categories.find(c => c.code === docType);
    if (cat) return cat.id;

    // Try mapping common variations
    const mappings: Record<string, string[]> = {
      'invoices': ['sales_invoice', 'invoice', 'invoices', 'sales_invoices'],
      'purchase_invoices': ['purchase_invoice', 'purchase_invoices'],
      'returns': ['sales_return', 'return', 'returns', 'sales_returns'],
      'purchase_returns': ['purchase_return', 'purchase_returns'],
      'sales_orders': ['sales_order', 'sales_orders'],
      'purchase_orders': ['purchase_order', 'purchase_orders'],
      'receipt_vouchers': ['receipt_voucher', 'receipt_vouchers', 'receipts'],
      'payment_vouchers': ['payment_voucher', 'payment_vouchers', 'payments'],
      'journal_entries': ['journal_entry', 'journal_entries', 'journals']
    };

    const targetCodes = mappings[docType] || [docType];
    cat = categories.find(c => c.code && targetCodes.includes(c.code));
    if (cat) return cat.id;

    // Fallback to name match
    cat = categories.find(c => {
      const nameLower = c.name.toLowerCase();
      return targetCodes.some(code => nameLower.includes(code.replace('_', ' ')));
    });
    
    return cat ? cat.id : '';
  };

  const changeDocumentType = async (newDocType: string) => {
    const matchedTemplates = templates.filter(t => t.document_type === newDocType);
    const defaultTemplate = matchedTemplates.find(t => t.is_default) || matchedTemplates[0];

    const catId = matchCategoryForDocType(newDocType);
    setHeaderCategoryId(catId);
    setDetailsCategoryId(catId);
    setPreviewMode(false);

    if (defaultTemplate) {
      setEditingTemplate(defaultTemplate);
      const selectedSize = paperSizes.find(p => p.id === defaultTemplate.paper_size_id);
      const isCustomPreset = PAPER_SIZES_PRESETS.some(p => p.id === defaultTemplate.paper_size_id);
      const isCustom = selectedSize && !selectedSize.is_system && !isCustomPreset;

      setFormData({
        name: defaultTemplate.name,
        description: defaultTemplate.description || '',
        paper_size_id: isCustom ? 'custom' : defaultTemplate.paper_size_id,
        orientation: defaultTemplate.orientation,
        margin_top: Number(defaultTemplate.margin_top),
        margin_bottom: Number(defaultTemplate.margin_bottom),
        margin_left: Number(defaultTemplate.margin_left),
        margin_right: Number(defaultTemplate.margin_right),
        is_active: defaultTemplate.is_active,
        customWidth: isCustom ? Number(selectedSize.width) : 210,
        customHeight: isCustom ? Number(selectedSize.height) : 297,
        customUnit: isCustom ? selectedSize.unit : 'mm',
        document_type: newDocType,
        is_default: defaultTemplate.is_default || false,
        print_profile_id: defaultTemplate.print_profile_id || ''
      });

      const targetLayout = defaultTemplate.layout ? JSON.parse(JSON.stringify(defaultTemplate.layout)) : JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
      setDesignerLayout(targetLayout);
      setHistory([JSON.parse(JSON.stringify(targetLayout))]);
      setHistoryIndex(0);
      setSelectedElementId(null);
      setSelectedSection(null);
      setView('edit');
    } else {
      setEditingTemplate(null);
      setFormData(prev => ({
        ...prev,
        name: '',
        description: '',
        document_type: newDocType,
        is_default: true
      }));

      const cleanLayout: TemplateLayout = {
        headerHeight: designerLayout.headerHeight || 70,
        footerHeight: designerLayout.footerHeight || 50,
        header: [],
        details: {
          mode: 'table',
          columns: [
            { id: 'product_code', label: language === 'ar' ? 'كود الصنف' : 'Item Code', field: 'product_code', width: 15 },
            { id: 'product_name', label: language === 'ar' ? 'اسم الصنف' : 'Item Name', field: 'product_name', width: 45 },
            { id: 'quantity', label: language === 'ar' ? 'الكمية' : 'Qty', field: 'quantity', width: 10 },
            { id: 'unit_price', label: language === 'ar' ? 'السعر' : 'Price', field: 'unit_price', width: 15 },
            { id: 'total', label: language === 'ar' ? 'الإجمالي' : 'Total', field: 'total', width: 15 }
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
        footer: []
      };

      setDesignerLayout(cleanLayout);
      setHistory([JSON.parse(JSON.stringify(cleanLayout))]);
      setHistoryIndex(0);
      setSelectedElementId(null);
      setSelectedSection(null);
      setView('create');
    }
  };

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
      const [allTemplates, allSizes, allCats, allProfiles, companyData] = await Promise.all([
        dbService.list<Template>('templates', user?.company_id || ''),
        dbService.list<PaperSize>('paper_sizes', user?.company_id || ''),
        dbService.list<OperationCategory>('operation_categories', user?.company_id || ''),
        dbService.list<PrintProfile>('print_profiles', user?.company_id || ''),
        user?.company_id ? dbService.get<any>('companies', user.company_id) : Promise.resolve(null)
      ]);
      setTemplates(allTemplates);
      setPaperSizes(allSizes);
      setCategories(allCats.filter(c => (c as any).is_final));
      setCompany(companyData);

      let activeProfiles = allProfiles;
      if (allProfiles.length === 0 && user?.company_id) {
        // Seed default profiles if none exist
        const defaultProfiles = [
          {
            name: language === 'ar' ? 'ملف طباعة A4 طولي' : 'A4 Portrait Profile',
            paper_size_id: 'a4',
            orientation: 'portrait',
            margin_top: 10,
            margin_bottom: 10,
            margin_left: 10,
            margin_right: 10,
            dpi: 300,
            print_settings: { copies: 1 }
          },
          {
            name: language === 'ar' ? 'ملف طباعة A5 طولي' : 'A5 Portrait Profile',
            paper_size_id: 'a5',
            orientation: 'portrait',
            margin_top: 10,
            margin_bottom: 10,
            margin_left: 10,
            margin_right: 10,
            dpi: 300,
            print_settings: { copies: 1 }
          },
          {
            name: language === 'ar' ? 'ملف طباعة حراري 80مم' : 'Thermal 80mm Profile',
            paper_size_id: 'thermal_80',
            orientation: 'portrait',
            margin_top: 2,
            margin_bottom: 2,
            margin_left: 2,
            margin_right: 2,
            dpi: 203,
            print_settings: { copies: 1 }
          },
          {
            name: language === 'ar' ? 'ملف طباعة حراري 58مم' : 'Thermal 58mm Profile',
            paper_size_id: 'thermal_58',
            orientation: 'portrait',
            margin_top: 2,
            margin_bottom: 2,
            margin_left: 2,
            margin_right: 2,
            dpi: 203,
            print_settings: { copies: 1 }
          }
        ];
        const seeded: PrintProfile[] = [];
        for (const preset of defaultProfiles) {
          const newId = 'profile-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
          const payload = {
            ...preset,
            orientation: preset.orientation as 'portrait' | 'landscape',
            company_id: user.company_id
          };
          await dbService.addWithId('print_profiles', newId, payload);
          seeded.push({ ...payload, id: newId });
        }
        activeProfiles = seeded;
      }
      setPrintProfiles(activeProfiles);
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
        setHeaderFields(data || []);
      } else {
        setDetailsFields(data || []);
      }
    } catch (e) {
      console.error('Failed to load fields:', e);
      if (type === 'header') {
        setHeaderFields([]);
      } else {
        setDetailsFields([]);
      }
    }
  };

  // Helper to determine paper bounds in mm
  const getPaperBounds = () => {
    const activeProfile = formData.print_profile_id 
      ? printProfiles.find(p => p.id === formData.print_profile_id) 
      : null;

    const paperSizeId = activeProfile ? activeProfile.paper_size_id : formData.paper_size_id;
    const orientation = activeProfile ? activeProfile.orientation : formData.orientation;

    const sizeObj = paperSizes.find(p => p.id === paperSizeId);
    let width = 210;
    let height = 297;
    
    if (paperSizeId === 'custom') {
      width = activeProfile ? Number(activeProfile.custom_width || 210) : formData.customWidth;
      height = activeProfile ? Number(activeProfile.custom_height || 297) : formData.customHeight;
    } else {
      const matched = PAPER_SIZES_PRESETS.find(p => p.id === paperSizeId);
      if (matched) {
        width = matched.width;
        height = matched.height;
      } else if (sizeObj) {
        width = Number(sizeObj.width);
        height = Number(sizeObj.height);
      }
    }

    if (orientation === 'landscape') {
      return { width: height, height: width, orientation };
    }
    return { width, height, orientation };
  };

  const getEffectiveMargins = () => {
    const activeProfile = formData.print_profile_id 
      ? printProfiles.find(p => p.id === formData.print_profile_id) 
      : null;
    if (activeProfile) {
      return {
        top: Number(activeProfile.margin_top),
        bottom: Number(activeProfile.margin_bottom),
        left: Number(activeProfile.margin_left),
        right: Number(activeProfile.margin_right)
      };
    }
    return {
      top: Number(formData.margin_top),
      bottom: Number(formData.margin_bottom),
      left: Number(formData.margin_left),
      right: Number(formData.margin_right)
    };
  };

  const { width: paperWidth } = getPaperBounds();
  const margins = getEffectiveMargins();
  const printableWidth = paperWidth - margins.left - margins.right;

  // Add Element to Canvas
  const handleAddElement = (type: TemplateElement['type'], binding?: string, label?: string) => {
    const section = selectedSection === 'footer' ? 'footer' : 'header';
    
    let width = 50;
    let height = 10;
    if (type === 'line') {
      width = 100;
      height = 1.5;
    } else if (type === 'qr' || type === 'circle' || type === 'logo' || type === 'image') {
      width = 30;
      height = 30;
    } else if (type === 'barcode') {
      width = 50;
      height = 15;
    } else if (type === 'rectangle') {
      width = 50;
      height = 20;
    }

    const sectionHeight = section === 'header' ? designerLayout.headerHeight : designerLayout.footerHeight;
    const x = Math.max(0, (printableWidth - width) / 2);
    const y = Math.max(0, (sectionHeight - height) / 2);

    const id = `${type}-${Date.now()}`;
    const newElement: TemplateElement = {
      id,
      type,
      x: Math.round(x),
      y: Math.round(y),
      width,
      height,
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
    const payload = JSON.stringify({ type, binding, label });
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.setData('text/plain', payload);
  };

  const handleCanvasDrop = (e: React.DragEvent, section: 'header' | 'footer') => {
    e.preventDefault();
    let dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) {
      dataStr = e.dataTransfer.getData('text/plain');
    }
    if (!dataStr) return;

    try {
      const { type, binding, label } = JSON.parse(dataStr);
      const canvasRef = section === 'header' ? headerCanvasRef.current : footerCanvasRef.current;
      if (!canvasRef) return;

      let width = 50;
      let height = 10;
      if (type === 'line') {
        width = 100;
        height = 1.5;
      } else if (type === 'qr' || type === 'circle' || type === 'logo' || type === 'image') {
        width = 30;
        height = 30;
      } else if (type === 'barcode') {
        width = 50;
        height = 15;
      } else if (type === 'rectangle') {
        width = 50;
        height = 20;
      }

      const rect = canvasRef.getBoundingClientRect();
      const x = Math.max(0, Math.min(printableWidth - width, (e.clientX - rect.left) / zoomScale));
      const sectionHeight = section === 'header' ? designerLayout.headerHeight : designerLayout.footerHeight;
      const y = Math.max(0, Math.min(sectionHeight - height, (e.clientY - rect.top) / zoomScale));

      const id = `${type}-${Date.now()}`;
      const newElement: TemplateElement = {
        id,
        type: type as TemplateElement['type'],
        x: Math.round(x),
        y: Math.round(y),
        width,
        height,
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
      customUnit: isCustom ? selectedSize.unit : 'mm',
      document_type: template.document_type || 'invoices',
      is_default: template.is_default || false,
      print_profile_id: template.print_profile_id || ''
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
      customUnit: isCustom ? selectedSize.unit : 'mm',
      document_type: template.document_type || 'invoices',
      is_default: false, // Do not copy the default template status automatically
      print_profile_id: template.print_profile_id || ''
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileFormData.name.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم ملف التعريف' : 'Please enter profile name');
      return;
    }
    
    let settingsObj = {};
    if (profileFormData.print_settings.trim()) {
      try {
        settingsObj = JSON.parse(profileFormData.print_settings);
      } catch (err) {
        toast.error(language === 'ar' ? 'صيغة إعدادات الطباعة (JSON) غير صالحة' : 'Invalid print settings JSON format');
        return;
      }
    }

    try {
      const payload = {
        company_id: user?.company_id || '',
        name: profileFormData.name,
        paper_size_id: profileFormData.paper_size_id,
        custom_width: profileFormData.paper_size_id === 'custom' ? Number(profileFormData.custom_width) : null,
        custom_height: profileFormData.paper_size_id === 'custom' ? Number(profileFormData.custom_height) : null,
        orientation: profileFormData.orientation,
        margin_top: Number(profileFormData.margin_top),
        margin_bottom: Number(profileFormData.margin_bottom),
        margin_left: Number(profileFormData.margin_left),
        margin_right: Number(profileFormData.margin_right),
        dpi: Number(profileFormData.dpi || 300),
        print_settings: settingsObj
      };

      if (editingProfile) {
        await dbService.update('print_profiles', editingProfile.id, payload);
        toast.success(language === 'ar' ? 'تم تحديث ملف تعريف الطباعة بنجاح' : 'Print profile updated successfully');
      } else {
        const newId = 'profile-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
        await dbService.addWithId('print_profiles', newId, { ...payload, id: newId });
        toast.success(language === 'ar' ? 'تم إضافة ملف تعريف الطباعة بنجاح' : 'Print profile created successfully');
      }
      setIsProfileModalOpen(false);
      setEditingProfile(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(language === 'ar' ? 'فشل حفظ ملف تعريف الطباعة' : 'Failed to save print profile');
    }
  };

  const handleCopyProfile = async (profile: PrintProfile) => {
    try {
      const newId = 'profile-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
      const payload = {
        ...profile,
        id: newId,
        name: `${profile.name} - ${language === 'ar' ? 'نسخة' : 'Copy'}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await dbService.addWithId('print_profiles', newId, payload);
      toast.success(language === 'ar' ? 'تم نسخ ملف تعريف الطباعة' : 'Print profile copied successfully');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(language === 'ar' ? 'فشل نسخ ملف تعريف الطباعة' : 'Failed to copy print profile');
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف ملف تعريف الطباعة هذا؟' : 'Are you sure you want to delete this print profile?')) {
      return;
    }
    try {
      await dbService.delete('print_profiles', id);
      toast.success(language === 'ar' ? 'تم حذف ملف تعريف الطباعة بنجاح' : 'Print profile deleted successfully');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(language === 'ar' ? 'فشل حذف ملف تعريف الطباعة' : 'Failed to delete print profile');
    }
  };

  const handleSetDefaultTemplate = async (templateId: string, docType: string) => {
    try {
      setLoading(true);
      const matched = templates.filter(t => t.document_type === docType);
      
      const promises = matched.map(t => {
        const isDefault = t.id === templateId;
        return dbService.update('templates', t.id, { is_default: isDefault });
      });
      
      await Promise.all(promises);
      toast.success(language === 'ar' ? 'تم تعيين القالب الافتراضي بنجاح' : 'Default template set successfully');
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error(language === 'ar' ? 'فشل تعيين القالب الافتراضي' : 'Failed to set default template');
    } finally {
      setLoading(false);
    }
  };


  const handleStartSaveProcess = () => {
    if (!formData.name.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال اسم القالب' : 'Please enter template name');
      return;
    }

    const selectedSize = paperSizes.find(p => p.id === formData.paper_size_id);
    const paperWidth = selectedSize ? Number(selectedSize.width) : (formData.paper_size_id === 'custom' ? Number(formData.customWidth) : 210);
    const paperHeight = selectedSize ? Number(selectedSize.height) : (formData.paper_size_id === 'custom' ? Number(formData.customHeight) : 297);
    const margin = {
      top: Number(formData.margin_top),
      bottom: Number(formData.margin_bottom),
      left: Number(formData.margin_left),
      right: Number(formData.margin_right)
    };

    const errors = validateTemplate(
      designerLayout,
      paperWidth,
      paperHeight,
      margin,
      detailsFields.map(f => f.code)
    );

    if (errors.length > 0) {
      setValidationErrors(errors);
      setIsValidationModalOpen(true);
    } else {
      setIsVersionModalOpen(true);
    }
  };

  const handleSubmit = async (notes: string = '') => {
    if (!user) return;

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

      if (formData.is_default) {
        const siblingTemplates = templates.filter(t => t.document_type === formData.document_type && t.id !== editingTemplate?.id && t.is_default);
        for (const sibling of siblingTemplates) {
          await dbService.update('templates', sibling.id, { is_default: false });
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
        company_id: user.company_id,
        document_type: formData.document_type,
        is_default: formData.is_default,
        print_profile_id: formData.print_profile_id || null
      };

      let savedTemplateId = '';
      if (view === 'edit' && editingTemplate) {
        await dbService.update('templates', editingTemplate.id, templatePayload);
        savedTemplateId = editingTemplate.id;
        toast.success(language === 'ar' ? 'تم حفظ تعديلات القالب والتصميم بنجاح' : 'Template layout saved successfully');
      } else {
        const newId = await dbService.create('templates', templatePayload);
        savedTemplateId = String(newId);
        toast.success(language === 'ar' ? 'تم إنشاء القالب والتصميم بنجاح' : 'Template layout created successfully');
      }

      // Create version record in database
      const existingVersions = await dbService.list<TemplateVersion>('template_versions', {
        where: { template_id: savedTemplateId }
      });
      const nextVersionNumber = existingVersions.reduce((max, v) => Math.max(max, v.version_number), 0) + 1;

      await dbService.create('template_versions', {
        template_id: savedTemplateId,
        company_id: user.company_id,
        version_number: nextVersionNumber,
        layout: designerLayout,
        change_notes: notes || (language === 'ar' ? `نسخة تلقائية رقم ${nextVersionNumber}` : `Auto-saved version ${nextVersionNumber}`),
        created_by: user.username
      });

      await fetchData();
      if (pendingDocTypeChange) {
        await changeDocumentType(pendingDocTypeChange);
        setPendingDocTypeChange(null);
      } else {
        setView('list');
        setEditingTemplate(null);
        setSelectedElementId(null);
      }
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
    company_logo: company?.logo_url || '',
    company_name: company?.name || 'مجموعة التطور الرقمي المحدودة',
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

  const getBindingValueForPreview = (binding?: string) => {
    if (!binding) return '';
    if (binding in previewDocData) {
      const val = previewDocData[binding as keyof typeof previewDocData];
      return val !== undefined && typeof val !== 'object' ? String(val) : '';
    }
    // Check if it exists in the first item
    const firstItem = previewDocData.items[0];
    if (firstItem && binding in firstItem) {
      const val = firstItem[binding as keyof typeof firstItem];
      return val !== undefined && typeof val !== 'object' ? String(val) : '';
    }
    return '';
  };

  const renderElementInnerContent = (el: TemplateElement, isPreview: boolean = false) => {
    switch (el.type) {
      case 'text':
        return el.properties.text || '';
      case 'variable': {
        const val = getBindingValueForPreview(el.binding);
        return isPreview ? (val || '') : (
          <span className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-1 py-0.5 rounded text-[10px] select-none font-bold">
            {"{"}{el.binding || 'Variable'}{"}"}
          </span>
        );
      }
      case 'field': {
        const val = getBindingValueForPreview(el.binding);
        return isPreview ? (val || '') : (
          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.5 rounded text-[10px] select-none font-bold">
            {"{"}{el.properties.text || el.binding || 'Field'}{"}"}
          </span>
        );
      }
      case 'logo': {
        const logoUrl = company?.logo_url;
        if (logoUrl) {
          return <img src={logoUrl} alt="logo" className="w-full h-full object-contain pointer-events-none" />;
        }
        return (
          <div className="w-full h-full border border-dashed border-zinc-300 rounded flex items-center justify-center bg-zinc-50/50 text-[10px] font-extrabold text-zinc-400">
            [ LOGO ]
          </div>
        );
      }
      case 'image':
        return el.properties.imageUrl ? (
          <img src={el.properties.imageUrl} alt="custom" className="w-full h-full object-contain pointer-events-none" />
        ) : (
          <div className="w-full h-full border border-dashed border-zinc-300 rounded flex items-center justify-center bg-zinc-50/50 text-[10px] font-extrabold text-zinc-400">
            [ IMAGE ]
          </div>
        );
      case 'line':
        return (
          <div 
            className="w-full h-full pointer-events-none" 
            style={{ 
              borderTop: el.width >= el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none',
              borderLeft: el.width < el.height ? `${el.properties.borderWidth || 1}px solid ${el.properties.borderColor || '#000'}` : 'none'
            }} 
          />
        );
      case 'rectangle':
      case 'circle':
        return <div className="w-full h-full" />;
      case 'qr': {
        const val = getBindingValueForPreview(el.binding);
        if (!val) {
          return (
            <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center border border-dashed border-zinc-300 text-zinc-400 rounded p-1 text-center">
              <QrCode size={Math.min(el.width, el.height) * zoomScale * 0.4} />
              <span className="text-[8px] font-bold mt-0.5">QR Code Placeholder</span>
            </div>
          );
        }
        return (
          <div className="p-0.5 bg-white border border-zinc-100 flex items-center justify-center w-full h-full">
            <QRCode value={val} size={Math.min(el.width, el.height) * zoomScale - 4} />
          </div>
        );
      }
      case 'barcode': {
        const val = getBindingValueForPreview(el.binding);
        if (!val) {
          return (
            <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center border border-dashed border-zinc-300 text-zinc-400 rounded p-1 text-center">
              <Barcode size={Math.min(el.width, el.height) * zoomScale * 0.4} />
              <span className="text-[8px] font-bold mt-0.5">Barcode Placeholder</span>
            </div>
          );
        }
        const isValidBarcode = /^[\x00-\x7F]*$/.test(val);
        if (!isValidBarcode) {
          return (
            <div className="w-full h-full bg-red-50 border border-red-250 text-red-500 rounded p-1 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] font-extrabold">{language === 'ar' ? 'رموز باركود غير صالحة' : 'Invalid Barcode'}</span>
              <span className="text-[7px] font-semibold break-all leading-tight max-w-full overflow-hidden truncate">{val}</span>
            </div>
          );
        }
        return (
          <div className="p-0.5 bg-white border border-zinc-100 flex items-center justify-center w-full h-full overflow-hidden">
            <BarcodeComponent value={val} width={1.1} height={Math.min(el.height) * zoomScale - 12} displayValue={false} />
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className={`h-full flex flex-col overflow-hidden text-zinc-800 transition-all ${
      view === 'list' ? 'p-6 max-w-[1600px] mx-auto' : 'p-3 w-full max-w-none'
    }`} dir={dir}>
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
                  <span>{language === 'ar' ? 'إدارة وقوالب الطباعة' : 'Visual Print Layout Manager'}</span>
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                  {language === 'ar' 
                    ? 'إدارة قوالب الطباعة، ملفات تعريف الطباعة (Print Profiles)، وربطها بالعمليات المختلفة.' 
                    : 'Manage visual document templates, print profiles, and direct operations routing.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                {subTab === 'templates' && (
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
                        customUnit: 'mm',
                        document_type: 'invoices',
                        is_default: false,
                        print_profile_id: ''
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
                )}
                {subTab === 'profiles' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(null);
                      setProfileFormData({
                        name: '',
                        paper_size_id: 'a4',
                        custom_width: 210,
                        custom_height: 297,
                        orientation: 'portrait',
                        margin_top: 10,
                        margin_bottom: 10,
                        margin_left: 10,
                        margin_right: 10,
                        dpi: 300,
                        print_settings: '{\n  "copies": 1\n}'
                      });
                      setIsProfileModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/25"
                  >
                    <Plus size={18} />
                    <span>{language === 'ar' ? 'إنشاء ملف تعريف جديد' : 'Create Print Profile'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-zinc-200 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSubTab('templates')}
                className={`px-5 py-3 text-xs md:text-sm font-extrabold border-b-2 transition-all ${
                  subTab === 'templates'
                    ? 'border-emerald-600 text-emerald-600 bg-emerald-50/5'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                }`}
              >
                {language === 'ar' ? 'قوالب الطباعة المصممة' : 'Print Templates'}
              </button>
              <button
                type="button"
                onClick={() => setSubTab('profiles')}
                className={`px-5 py-3 text-xs md:text-sm font-extrabold border-b-2 transition-all ${
                  subTab === 'profiles'
                    ? 'border-emerald-600 text-emerald-600 bg-emerald-50/5'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                }`}
              >
                {language === 'ar' ? 'ملفات تعريف الطباعة' : 'Print Profiles'}
              </button>
              <button
                type="button"
                onClick={() => setSubTab('assignments')}
                className={`px-5 py-3 text-xs md:text-sm font-extrabold border-b-2 transition-all ${
                  subTab === 'assignments'
                    ? 'border-emerald-600 text-emerald-600 bg-emerald-50/5'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                }`}
              >
                {language === 'ar' ? 'إعدادات قوالب العمليات' : 'Operation Assignments'}
              </button>
            </div>

            {subTab === 'templates' ? (
              <>
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
                                <div className="flex items-center gap-2">
                                  <div className="font-bold text-zinc-950">{template.name}</div>
                                  {template.is_default && (
                                    <span className="text-[9px] bg-amber-50 text-amber-700 font-extrabold px-1.5 py-0.5 rounded border border-amber-200/50">
                                      {language === 'ar' ? 'الافتراضي' : 'Default'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400 font-bold mt-0.5">
                                  {DOCUMENT_TYPES.find(d => d.id === template.document_type)?.ar || template.document_type || ''}
                                </div>
                                {template.description && (
                                  <div className="text-zinc-500 text-xs mt-1 line-clamp-1">{template.description}</div>
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
                              <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} uppercase font-medium text-zinc-700`}>
                                {template.orientation === 'portrait'
                                  ? (language === 'ar' ? 'طولي (Portrait)' : 'Portrait')
                                  : (language === 'ar' ? 'عرضي (Landscape)' : 'Landscape')}
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
              </>
            ) : subTab === 'profiles' ? (
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm flex-1 overflow-y-auto">
                <table className="w-full text-sm border-collapse text-left" dir={dir}>
                  <thead>
                    <tr className="bg-zinc-50/80 border-b border-zinc-200 text-zinc-700 font-bold">
                      <th className={`px-6 py-4 text-xs font-extrabold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {language === 'ar' ? 'اسم ملف التعريف' : 'Profile Name'}
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
                      <th className={`px-6 py-4 text-xs font-extrabold ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                        {language === 'ar' ? 'دقة الطباعة' : 'Resolution'}
                      </th>
                      <th className="px-6 py-4 text-xs font-extrabold text-center">
                        {language === 'ar' ? 'إجراءات' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {printProfiles.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-zinc-400 font-bold">
                          {language === 'ar' ? 'لا توجد ملفات تعريف طباعة مضافة بعد.' : 'No print profiles created yet.'}
                        </td>
                      </tr>
                    ) : (
                      printProfiles.map((profile) => {
                        const sizeObj = paperSizes.find(p => p.id === profile.paper_size_id);
                        const presetObj = PAPER_SIZES_PRESETS.find(p => p.id === profile.paper_size_id);
                        const sizeName = presetObj?.name || sizeObj?.name || profile.paper_size_id;
                        const sizeWidth = presetObj?.width || sizeObj?.width || profile.custom_width || '—';
                        const sizeHeight = presetObj?.height || sizeObj?.height || profile.custom_height || '—';

                        return (
                          <tr key={profile.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-bold text-zinc-950`}>
                              {profile.name}
                            </td>
                            <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-zinc-800 capitalize">{sizeName}</span>
                                <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                                  {sizeWidth} × {sizeHeight} mm
                                </span>
                              </div>
                            </td>
                            <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} capitalize font-medium text-zinc-700`}>
                              {profile.orientation === 'portrait'
                                ? (language === 'ar' ? 'طولي (Portrait)' : 'Portrait')
                                : (language === 'ar' ? 'عرضي (Landscape)' : 'Landscape')}
                            </td>
                            <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} text-xs font-medium text-zinc-600`}>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 max-w-[160px]">
                                <span>{language === 'ar' ? 'أعلى:' : 'Top:'} {profile.margin_top}</span>
                                <span>{language === 'ar' ? 'أسفل:' : 'Bottom:'} {profile.margin_bottom}</span>
                                <span>{language === 'ar' ? 'يمين:' : 'Right:'} {profile.margin_right}</span>
                                <span>{language === 'ar' ? 'يسار:' : 'Left:'} {profile.margin_left}</span>
                              </div>
                            </td>
                            <td className={`px-6 py-4 ${dir === 'rtl' ? 'text-right' : 'text-left'} font-semibold text-zinc-800`}>
                              {profile.dpi} DPI
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProfile(profile);
                                    setProfileFormData({
                                      name: profile.name,
                                      paper_size_id: profile.paper_size_id,
                                      custom_width: Number(profile.custom_width || 210),
                                      custom_height: Number(profile.custom_height || 297),
                                      orientation: profile.orientation,
                                      margin_top: Number(profile.margin_top),
                                      margin_bottom: Number(profile.margin_bottom),
                                      margin_left: Number(profile.margin_left),
                                      margin_right: Number(profile.margin_right),
                                      dpi: Number(profile.dpi || 300),
                                      print_settings: JSON.stringify(profile.print_settings || {}, null, 2)
                                    });
                                    setIsProfileModalOpen(true);
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title={language === 'ar' ? 'تعديل الملف' : 'Edit Profile'}
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyProfile(profile)}
                                  className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  title={language === 'ar' ? 'نسخ الملف' : 'Copy Profile'}
                                >
                                  <Copy size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProfile(profile.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title={language === 'ar' ? 'حذف الملف' : 'Delete Profile'}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : subTab === 'assignments' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto flex-1 pb-10">
                {DOCUMENT_TYPES.map((docType) => {
                  const matchedTemplates = templates.filter(t => t.document_type === docType.id);
                  const defaultTemplate = matchedTemplates.find(t => t.is_default);

                  return (
                    <div
                      key={docType.id}
                      className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 font-bold"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-black text-zinc-900 text-sm">
                            {language === 'ar' ? docType.ar.split(' / ')[0] : docType.en}
                          </h3>
                          <span className="text-[10px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full font-bold">
                            {matchedTemplates.length} {language === 'ar' ? 'قوالب' : 'Templates'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-semibold mt-1">
                          {language === 'ar' ? `تخصيص القوالب والطباعة لـ ${docType.ar.split(' / ')[0]}` : `Assign and configure print routing for ${docType.en}`}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] text-zinc-500 font-bold block">
                          {language === 'ar' ? 'القالب الافتراضي النشط:' : 'Active Default Template:'}
                        </label>
                        {matchedTemplates.length === 0 ? (
                          <div className="p-3 bg-amber-50/50 border border-dashed border-amber-200 rounded-2xl text-center">
                            <span className="text-[10px] text-amber-700 font-bold block">
                              {language === 'ar' ? 'لا يوجد أي قوالب مصممة لهذه العملية' : 'No templates designed for this operation'}
                            </span>
                          </div>
                        ) : (
                          <select
                            value={defaultTemplate?.id || ''}
                            onChange={(e) => handleSetDefaultTemplate(e.target.value, docType.id)}
                            className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2.5 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white transition-all"
                          >
                            <option value="">{language === 'ar' ? 'اختر قالب افتراضي...' : 'Select default template...'}</option>
                            {matchedTemplates.map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.paper_size_id.toUpperCase()})</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                        {matchedTemplates.length > 0 && (
                          <div className="text-[10px] text-zinc-500 font-semibold">
                            {defaultTemplate ? (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <Check size={12} />
                                <span>{language === 'ar' ? 'افتراضي: ' : 'Default: '}{defaultTemplate.name}</span>
                              </span>
                            ) : (
                              <span className="text-amber-600 font-bold">
                                {language === 'ar' ? 'لم يتم تحديد قالب افتراضي' : 'No default selected'}
                              </span>
                            )}
                          </div>
                        )}
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
                              customUnit: 'mm',
                              document_type: docType.id,
                              is_default: matchedTemplates.length === 0,
                              print_profile_id: ''
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
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-[10px] font-black transition-all ml-auto"
                        >
                          <Plus size={12} />
                          <span>{language === 'ar' ? 'إضافة قالب' : 'Add Template'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
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
                  onClick={handleStartSaveProcess}
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
                  <button
                    type="button"
                    onClick={() => setLeftSidebarTab('history')}
                    className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      leftSidebarTab === 'history' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    <RefreshCw size={14} />
                    <span>{language === 'ar' ? 'الإصدارات' : 'History'}</span>
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
                              <el.icon size={14} className="text-zinc-500 pointer-events-none" />
                              <span className="pointer-events-none">{language === 'ar' ? el.label : el.type.toUpperCase()}</span>
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
                                  <span className="pointer-events-none">{language === 'ar' ? v.arLabel : v.enLabel}</span>
                                  <Tag size={10} className="text-zinc-400 pointer-events-none" />
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
                                  <span className="pointer-events-none">{language === 'ar' ? v.arLabel : v.enLabel}</span>
                                  <Tag size={10} className="text-zinc-400 pointer-events-none" />
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
                                  <span className="pointer-events-none">{language === 'ar' ? v.arLabel : v.enLabel}</span>
                                  <Tag size={10} className="text-zinc-400 pointer-events-none" />
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
                                <span className="pointer-events-none">{f.label}</span>
                                <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-mono pointer-events-none">{f.code}</span>
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
                  ) : leftSidebarTab === 'layers' ? (
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
                  ) : (
                    /* HISTORY PANEL */
                    <div className="space-y-4 font-bold Cairo">
                      <div className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-2">
                        {language === 'ar' ? 'سجل إصدارات القالب' : 'Template Version History'}
                      </div>

                      {templateVersions.length === 0 ? (
                        <p className="text-xs text-zinc-400 text-center py-8">
                          {language === 'ar' ? 'لا يوجد إصدارات سابقة بعد.' : 'No previous versions found.'}
                        </p>
                      ) : (
                        <div className="relative border-l-2 border-zinc-100 pl-4 ml-2 space-y-5">
                          {templateVersions.map((ver) => (
                            <div key={ver.id} className="relative group space-y-1 text-xs">
                              {/* Dot */}
                              <div className="absolute -left-[23px] top-1.5 w-2.5 h-2.5 bg-zinc-200 border-2 border-white rounded-full group-hover:bg-emerald-500 transition-colors" />

                              <div className="flex items-center justify-between">
                                <span className="font-black text-zinc-800">
                                  {language === 'ar' ? `إصدار #${ver.version_number}` : `Version #${ver.version_number}`}
                                </span>
                                <span className="text-[10px] text-zinc-400">
                                  {new Date(ver.created_at).toLocaleDateString()}
                                </span>
                              </div>

                              <p className="text-[10px] text-zinc-500 font-semibold italic">
                                {ver.change_notes || (language === 'ar' ? 'لا توجد ملاحظات' : 'No notes')}
                              </p>

                              <div className="flex items-center justify-between pt-1 text-[10px]">
                                <span className="text-zinc-400">
                                  {language === 'ar' ? `بواسطة: ${ver.created_by}` : `By: ${ver.created_by}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(language === 'ar' ? 'هل أنت متأكد من استعادة هذا الإصدار؟' : 'Are you sure you want to restore this version?')) {
                                      const restoredLayout = JSON.parse(JSON.stringify(ver.layout));
                                      updateLayoutWithHistory(restoredLayout);
                                      toast.success(language === 'ar' ? 'تم استعادة الإصدار المختار بنجاح' : 'Selected version restored successfully');
                                    }
                                  }}
                                  className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline"
                                >
                                  {language === 'ar' ? 'استعادة' : 'Restore'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. CENTER WORKSPACE: PAPER SHEET RENDERING */}
              <div className="flex-1 bg-zinc-100 border border-zinc-200 rounded-2xl overflow-auto p-8 flex items-center justify-center relative shadow-inner h-full">
                
                {previewMode ? (
                  /* LIVE PREVIEW CONTAINER */
                  <div
                    className="bg-white border border-zinc-300 shadow-2xl transition-all relative overflow-hidden"
                    style={{
                      width: `${printableWidth * zoomScale}px`,
                      paddingTop: `${margins.top * zoomScale}px`,
                      paddingBottom: `${margins.bottom * zoomScale}px`,
                      paddingLeft: `${margins.left * zoomScale}px`,
                      paddingRight: `${margins.right * zoomScale}px`,
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
                            borderRadius: el.type === 'circle' ? '9999px' : el.properties.borderRadius ? `${el.properties.borderRadius}px` : '0px',
                            textAlign: el.properties.align || 'left',
                            opacity: el.properties.opacity ?? 1,
                            transform: `rotate(${el.properties.rotation || 0}deg)`,
                            justifyContent: el.properties.align === 'center' ? 'center' : el.properties.align === 'right' ? 'flex-end' : 'flex-start',
                            padding: `${(el.properties.padding || 0) * zoomScale}px`
                          }}
                        >
                          {renderElementInnerContent(el, true)}
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
                            borderRadius: el.type === 'circle' ? '9999px' : el.properties.borderRadius ? `${el.properties.borderRadius}px` : '0px',
                            textAlign: el.properties.align || 'left',
                            opacity: el.properties.opacity ?? 1,
                            transform: `rotate(${el.properties.rotation || 0}deg)`,
                            justifyContent: el.properties.align === 'center' ? 'center' : el.properties.align === 'right' ? 'flex-end' : 'flex-start',
                            padding: `${(el.properties.padding || 0) * zoomScale}px`
                          }}
                        >
                          {renderElementInnerContent(el, true)}
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
                      paddingTop: `${margins.top * zoomScale}px`,
                      paddingBottom: `${margins.bottom * zoomScale}px`,
                      paddingLeft: `${margins.left * zoomScale}px`,
                      paddingRight: `${margins.right * zoomScale}px`,
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
                            style={{ left: `${(xVal + margins.left) * zoomScale}px` }} 
                          />
                        ))}
                        {snapGuides.y.map((yVal, index) => (
                          <div 
                            key={`y-${index}`} 
                            className="absolute left-0 right-0 border-t border-dashed border-red-500" 
                            style={{ top: `${(yVal + margins.top) * zoomScale}px` }} 
                          />
                        ))}
                      </div>
                    )}

                    {/* SECTION 1: HEADER CANVAS */}
                    <div 
                      ref={headerCanvasRef}
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
                            borderRadius: el.type === 'circle' ? '9999px' : el.properties.borderRadius ? `${el.properties.borderRadius}px` : '0px',
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

                          {renderElementInnerContent(el, false)}

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
                      ref={footerCanvasRef}
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
                            borderRadius: el.type === 'circle' ? '9999px' : el.properties.borderRadius ? `${el.properties.borderRadius}px` : '0px',
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

                          {renderElementInnerContent(el, false)}

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

                      {['barcode', 'qr', 'variable', 'field'].includes(activeElement.type) && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-zinc-600">
                            {language === 'ar' ? 'مصدر القيمة (Value Source)' : 'Value Source'}
                          </label>
                          <select
                            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                            value={activeElement.binding || ''}
                            onChange={(e) => handleUpdateElementProperty('binding', e.target.value)}
                          >
                            <option value="">{language === 'ar' ? 'اختر مصدر بيانات...' : 'Choose data source...'}</option>
                            <optgroup label={language === 'ar' ? 'عام' : 'General'}>
                              {DYNAMIC_VARIABLES.general.map(v => (
                                <option key={v.key} value={v.key}>
                                  {language === 'ar' ? v.arLabel : v.enLabel}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label={language === 'ar' ? 'بيانات المستند' : 'Document Data'}>
                              {DYNAMIC_VARIABLES.invoice.map(v => (
                                <option key={v.key} value={v.key}>
                                  {language === 'ar' ? v.arLabel : v.enLabel}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label={language === 'ar' ? 'الإجماليات والمالية' : 'Totals & Financials'}>
                              {DYNAMIC_VARIABLES.totals.map(v => (
                                <option key={v.key} value={v.key}>
                                  {language === 'ar' ? v.arLabel : v.enLabel}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label={language === 'ar' ? 'أعمدة الفاتورة' : 'Details Columns'}>
                              {DETAILS_COLUMNS_PRESETS.map(c => (
                                <option key={c.field} value={c.field}>
                                  {language === 'ar' ? c.arLabel : c.enLabel}
                                </option>
                              ))}
                            </optgroup>
                            {headerFields.length > 0 && (
                              <optgroup label={language === 'ar' ? 'حقول الهيدر الديناميكية' : 'Dynamic Header Fields'}>
                                {headerFields.map(f => (
                                  <option key={f.id} value={f.code}>
                                    {f.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {detailsFields.length > 0 && (
                              <optgroup label={language === 'ar' ? 'حقول التفاصيل الديناميكية' : 'Dynamic Details Fields'}>
                                {detailsFields.map(f => (
                                  <option key={f.id} value={f.code}>
                                    {f.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
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
                      
                      {/* Details Mode Toggle */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-600">{language === 'ar' ? 'نمط التفاصيل' : 'Details Mode'}</label>
                        <div className="flex gap-1.5 bg-zinc-50 p-1.5 rounded-xl border border-zinc-200">
                          <button
                            type="button"
                            onClick={() => updateLayoutWithHistory({
                              ...designerLayout,
                              details: { ...designerLayout.details, mode: 'table' }
                            })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              (designerLayout.details.mode || 'table') === 'table' ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                          >
                            {language === 'ar' ? 'جدول' : 'Table'}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateLayoutWithHistory({
                              ...designerLayout,
                              details: { ...designerLayout.details, mode: 'repeater' }
                            })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              designerLayout.details.mode === 'repeater' ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200' : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                          >
                            {language === 'ar' ? 'مكرر تخطيط' : 'Repeater'}
                          </button>
                        </div>
                      </div>

                      {(designerLayout.details.mode || 'table') === 'table' ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-600">{language === 'ar' ? 'ارتفاع قسم التفاصيل المكرر (مم)' : 'Repeater Section Height (mm)'}</label>
                            <input
                              type="number"
                              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                              value={designerLayout.details.height || 20}
                              onChange={(e) => updateLayoutWithHistory({
                                ...designerLayout,
                                details: {
                                  ...designerLayout.details,
                                  height: parseInt(e.target.value) || 20
                                }
                              })}
                            />
                          </div>

                          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-xs text-emerald-800 space-y-1.5 leading-relaxed">
                            <p className="font-bold flex items-center gap-1.5">
                              <Paintbrush size={14} />
                              <span>{language === 'ar' ? 'مكرر التخطيط المرئي' : 'Visual Layout Repeater'}</span>
                            </p>
                            <p>
                              {language === 'ar' 
                                ? 'في نمط المكرر، سيتم تكرار جميع العناصر الموضوعة في قسم التفاصيل رأسياً لكل صف من صفوف الفاتورة/المستند، باستخدام الارتفاع المحدد أعلاه كإزاحة تباعد.'
                                : 'In Repeater mode, all elements placed inside the details section will be repeated vertically for each line item of the document, using the height specified above as the offset spacing.'
                              }
                            </p>
                          </div>
                        </>
                      )}

                    </div>
                  </div>
                ) : (
                  /* GENERAL PAGE LAYOUT SETTINGS */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                      <h3 className="text-sm font-black text-zinc-900">{language === 'ar' ? 'إعدادات الصفحة العامة' : 'Page Layout Settings'}</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                      
                      {/* Print Profile Select */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'ملف تعريف الطباعة (Print Profile)' : 'Print Profile'}</label>
                        <select
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          value={formData.print_profile_id || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, print_profile_id: e.target.value }))}
                        >
                          <option value="">{language === 'ar' ? 'مخصص بالقالب (None)' : 'Local Template Settings (None)'}</option>
                          {printProfiles.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {formData.print_profile_id && (
                          <div className="p-2.5 bg-emerald-50/50 text-[10px] text-emerald-700 font-bold rounded-xl border border-emerald-100 flex items-start gap-1.5 mt-1.5">
                            <Info size={12} className="mt-0.5 shrink-0" />
                            <span>{language === 'ar' ? 'أبعاد الصفحة والهوامش والاتجاه مقيدة وتدار بالكامل بواسطة ملف تعريف الطباعة المحدد.' : 'Page size, orientation, and margins are managed by the linked print profile.'}</span>
                          </div>
                        )}
                      </div>

                      {/* Paper preset */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'حجم الورقة' : 'Paper Size'}</label>
                        <select
                          disabled={!!formData.print_profile_id}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none disabled:opacity-60"
                          value={formData.print_profile_id ? (printProfiles.find(p => p.id === formData.print_profile_id)?.paper_size_id ?? 'a4') : formData.paper_size_id}
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

                      {((formData.print_profile_id ? (printProfiles.find(p => p.id === formData.print_profile_id)?.paper_size_id) : formData.paper_size_id) === 'custom') && (
                        <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'العرض (مم)' : 'Width (mm)'}</label>
                            <input
                              type="number"
                              disabled={!!formData.print_profile_id}
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs disabled:opacity-60"
                              value={formData.print_profile_id ? (printProfiles.find(p => p.id === formData.print_profile_id)?.custom_width ?? formData.customWidth) : formData.customWidth}
                              onChange={(e) => setFormData(prev => ({ ...prev, customWidth: parseInt(e.target.value) || 210 }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الارتفاع (مم)' : 'Height (mm)'}</label>
                            <input
                              type="number"
                              disabled={!!formData.print_profile_id}
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs disabled:opacity-60"
                              value={formData.print_profile_id ? (printProfiles.find(p => p.id === formData.print_profile_id)?.custom_height ?? formData.customHeight) : formData.customHeight}
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
                            disabled={!!formData.print_profile_id}
                            onClick={() => setFormData(prev => ({ ...prev, orientation: 'portrait' }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all disabled:opacity-60 ${
                              (formData.print_profile_id ? (printProfiles.find(p => p.id === formData.print_profile_id)?.orientation ?? 'portrait') : formData.orientation) === 'portrait' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold' 
                                : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            {language === 'ar' ? 'طولي (Portrait)' : 'Portrait'}
                          </button>
                          <button
                            type="button"
                            disabled={!!formData.print_profile_id}
                            onClick={() => setFormData(prev => ({ ...prev, orientation: 'landscape' }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all disabled:opacity-60 ${
                              (formData.print_profile_id ? (printProfiles.find(p => p.id === formData.print_profile_id)?.orientation ?? 'portrait') : formData.orientation) === 'landscape' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold' 
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
                              disabled={!!formData.print_profile_id}
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs disabled:opacity-60"
                              value={formData.print_profile_id ? (printProfiles.find(p => p.id === formData.print_profile_id)?.margin_top ?? formData.margin_top) : formData.margin_top}
                              onChange={(e) => setFormData(prev => ({ ...prev, margin_top: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الهامش السفلي' : 'Bottom Margin'}</label>
                            <input
                              type="number"
                              disabled={!!formData.print_profile_id}
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs disabled:opacity-60"
                              value={formData.print_profile_id ? (printProfiles.find(p => p.id === formData.print_profile_id)?.margin_bottom ?? formData.margin_bottom) : formData.margin_bottom}
                              onChange={(e) => setFormData(prev => ({ ...prev, margin_bottom: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الهامش الأيسر' : 'Left Margin'}</label>
                            <input
                              type="number"
                              disabled={!!formData.print_profile_id}
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs disabled:opacity-60"
                              value={formData.print_profile_id ? (printProfiles.find(p => p.id === formData.print_profile_id)?.margin_left ?? formData.margin_left) : formData.margin_left}
                              onChange={(e) => setFormData(prev => ({ ...prev, margin_left: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">{language === 'ar' ? 'الهامش الأيمن' : 'Right Margin'}</label>
                            <input
                              type="number"
                              disabled={!!formData.print_profile_id}
                              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs disabled:opacity-60"
                              value={formData.print_profile_id ? (printProfiles.find(p => p.id === formData.print_profile_id)?.margin_right ?? formData.margin_right) : formData.margin_right}
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

                      {/* Target Document type */}
                      <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                        <label htmlFor="document_type_select" className="text-xs font-bold text-zinc-700">{language === 'ar' ? 'نوع المستند / العملية' : 'Target Document / Operation'}</label>
                        <select
                          id="document_type_select"
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold outline-none"
                          value={formData.document_type}
                          onChange={(e) => {
                            const newDocType = e.target.value;
                            if (hasUnsavedChanges()) {
                              setNextPendingDocType(newDocType);
                              setIsUnsavedModalOpen(true);
                            } else {
                              changeDocumentType(newDocType);
                            }
                          }}
                        >
                          {DOCUMENT_TYPES.map(doc => (
                            <option key={doc.id} value={doc.id}>
                              {language === 'ar' ? doc.ar : doc.en}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Default template status toggle */}
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="flex items-center gap-3 p-2 hover:bg-zinc-50 rounded-xl pt-2 border-t border-zinc-100"
                      >
                        <input
                          id="is_default_checkbox"
                          type="checkbox"
                          className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                          checked={formData.is_default}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <label 
                          htmlFor="is_default_checkbox" 
                          className="flex flex-col cursor-pointer select-none flex-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs font-bold text-zinc-800">{language === 'ar' ? 'القالب الافتراضي' : 'Default Template'}</span>
                          <span className="text-[10px] text-zinc-400">{language === 'ar' ? 'استخدام هذا القالب تلقائياً للمستند' : 'Use this template by default for this document'}</span>
                        </label>
                      </div>

                      {/* Active Status */}
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="flex items-center gap-3 p-2 hover:bg-zinc-50 rounded-xl pt-2 border-t border-zinc-100"
                      >
                        <input
                          id="is_active_checkbox"
                          type="checkbox"
                          className="w-5 h-5 rounded-lg border-zinc-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                          checked={formData.is_active}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <label 
                          htmlFor="is_active_checkbox" 
                          className="flex flex-col cursor-pointer select-none flex-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs font-bold text-zinc-800">{language === 'ar' ? 'قالب نشط' : 'Active Template'}</span>
                          <span className="text-[10px] text-zinc-400">{language === 'ar' ? 'السماح باستخدام القالب للطباعة' : 'Enable template for prints'}</span>
                        </label>
                      </div>

                    </div>
                  </div>
                )}

              </div>

            </div>
            {/* Validation Errors & Warnings Modal */}
            <AnimatePresence>
              {isValidationModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-zinc-100 flex flex-col max-h-[80vh] font-bold Cairo"
                  >
                    {/* Header */}
                    <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-zinc-900">
                        <AlertTriangle className="text-amber-500" size={20} />
                        <h3 className="text-base font-black">
                          {language === 'ar' ? 'نتائج فحص وتدقيق القالب' : 'Template Audit & Validation'}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsValidationModalOpen(false)}
                        className="p-1 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
                      <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                        {language === 'ar'
                          ? 'يرجى مراجعة التنبيهات والأخطاء التالية للتأكد من جاهزية القالب للطباعة بشكل سليم.'
                          : 'Please review the following warnings and errors to ensure the template prints properly.'}
                      </p>

                      <div className="space-y-2">
                        {validationErrors.map((err) => {
                          const isError = err.type === 'error';
                          return (
                            <div
                              key={err.id}
                              className={`flex items-start gap-3 p-3.5 rounded-2xl border ${
                                isError
                                  ? 'bg-red-50/50 border-red-100 text-red-900'
                                  : 'bg-amber-50/50 border-amber-100 text-amber-900'
                              }`}
                            >
                              <div
                                className={`p-1.5 rounded-lg mt-0.5 ${
                                  isError ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                }`}
                              >
                                <AlertTriangle size={14} />
                              </div>
                              <div className="flex-1 space-y-0.5">
                                <p className="text-xs font-black">
                                  {isError ? (language === 'ar' ? 'خطأ حرج' : 'Critical Error') : (language === 'ar' ? 'تنبيه' : 'Warning')}
                                </p>
                                <p className="text-[11px] font-semibold leading-relaxed text-zinc-600">
                                  {language === 'ar' ? err.messageAr : err.messageEn}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-zinc-100 bg-zinc-50 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsValidationModalOpen(false)}
                        className="px-4 py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-bold transition-all"
                      >
                        {language === 'ar' ? 'إلغاء والعودة للتعديل' : 'Go Back & Edit'}
                      </button>

                      {!validationErrors.some((e) => e.type === 'error') && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsValidationModalOpen(false);
                            setIsVersionModalOpen(true);
                          }}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/25"
                        >
                          {language === 'ar' ? 'متابعة وحفظ القالب' : 'Proceed and Save'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Version Change Notes Modal */}
            <AnimatePresence>
              {isVersionModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-100 p-6 space-y-4 font-bold Cairo"
                  >
                    <div className="flex items-center gap-2.5 text-zinc-900 border-b border-zinc-100 pb-3">
                      <Info className="text-emerald-600" size={20} />
                      <h3 className="text-base font-black">
                        {language === 'ar' ? 'ملاحظات الإصدار الجديد' : 'Version Change Notes'}
                      </h3>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-600 font-bold">
                        {language === 'ar' ? 'ما هي التغييرات التي أجريتها؟' : 'What changes did you make?'}
                      </label>
                      <textarea
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none focus:bg-white focus:border-emerald-600 transition-all font-semibold"
                        rows={4}
                        placeholder={
                          language === 'ar'
                            ? 'مثال: تعديل مقاسات الهوامش وإضافة كود الصنف للجدول...'
                            : 'e.g., Adjusted margins and added item code to the table...'
                        }
                        value={changeNotes}
                        onChange={(e) => setChangeNotes(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsVersionModalOpen(false);
                          setChangeNotes('');
                        }}
                        className="px-4 py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-bold transition-all"
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmit(changeNotes)}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/25"
                      >
                        {language === 'ar' ? 'حفظ الإصدار والتصميم' : 'Save Version & Design'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Unsaved Changes Warning Modal */}
            <AnimatePresence>
              {isUnsavedModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-100 p-6 space-y-4 font-bold Cairo text-right"
                  >
                    <div className="flex items-center gap-2.5 text-zinc-900 border-b border-zinc-100 pb-3">
                      <AlertTriangle className="text-amber-500" size={20} />
                      <h3 className="text-base font-black">
                        {language === 'ar' ? 'تعديلات غير محفوظة' : 'Unsaved Changes'}
                      </h3>
                    </div>

                    <p className="text-xs font-semibold leading-relaxed text-zinc-600">
                      {language === 'ar' 
                        ? 'لقد أجريت تعديلات على القالب الحالي. هل ترغب في حفظ التعديلات قبل الانتقال لنوع مستند آخر؟' 
                        : 'You have unsaved changes on the current template. Do you want to save them before switching the document type?'}
                    </p>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUnsavedModalOpen(false);
                          setNextPendingDocType('');
                        }}
                        className="px-4 py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-bold transition-all"
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUnsavedModalOpen(false);
                          changeDocumentType(nextPendingDocType);
                          setNextPendingDocType('');
                        }}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all"
                      >
                        {language === 'ar' ? 'تجاهل التغييرات' : 'Discard Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDocTypeChange(nextPendingDocType);
                          setIsUnsavedModalOpen(false);
                          setNextPendingDocType('');
                          handleStartSaveProcess();
                        }}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/25"
                      >
                        {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Print Profile Edit/Create Modal */}
            <AnimatePresence>
              {isProfileModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-zinc-100 flex flex-col max-h-[90vh] font-bold Cairo"
                    dir={dir}
                  >
                    {/* Header */}
                    <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-zinc-900">
                        <Settings className="text-emerald-600 animate-spin-slow" size={20} />
                        <h3 className="text-base font-black">
                          {editingProfile 
                            ? (language === 'ar' ? 'تعديل ملف تعريف الطباعة' : 'Edit Print Profile')
                            : (language === 'ar' ? 'إنشاء ملف تعريف طباعة جديد' : 'New Print Profile')}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileModalOpen(false);
                          setEditingProfile(null);
                        }}
                        className="p-1 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 rounded-lg transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Form Body */}
                    <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-semibold text-zinc-700">
                      <div className="space-y-1.5">
                        <label className="text-zinc-600 font-bold">
                          {language === 'ar' ? 'اسم ملف التعريف *' : 'Profile Name *'}
                        </label>
                        <input
                          required
                          type="text"
                          className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white focus:border-emerald-600 transition-all font-semibold text-zinc-800"
                          value={profileFormData.name}
                          onChange={(e) => setProfileFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder={language === 'ar' ? 'مثال: طابعة الفواتير الحرارية الصيدلية' : 'e.g., Pharmacy Thermal Printer'}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-zinc-600 font-bold">{language === 'ar' ? 'حجم الورق' : 'Paper Size'}</label>
                          <select
                            className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white focus:border-emerald-600 transition-all font-semibold text-zinc-850"
                            value={profileFormData.paper_size_id}
                            onChange={(e) => setProfileFormData(prev => ({ ...prev, paper_size_id: e.target.value }))}
                          >
                            <option value="a4">A4 (210 x 297 mm)</option>
                            <option value="a5">A5 (148 x 210 mm)</option>
                            <option value="a6">A6 (105 x 148 mm)</option>
                            <option value="letter">Letter (8.5 x 11 in)</option>
                            <option value="legal">Legal (8.5 x 14 in)</option>
                            <option value="thermal_80">Thermal 80mm</option>
                            <option value="thermal_58">Thermal 58mm</option>
                            <option value="custom">{language === 'ar' ? 'حجم مخصص' : 'Custom Size'}</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-zinc-600 font-bold">{language === 'ar' ? 'الدقة (DPI)' : 'Resolution (DPI)'}</label>
                          <input
                            type="number"
                            className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white focus:border-emerald-600 transition-all font-semibold text-zinc-800"
                            value={profileFormData.dpi}
                            onChange={(e) => setProfileFormData(prev => ({ ...prev, dpi: Number(e.target.value) }))}
                            min={72}
                            max={1200}
                          />
                        </div>
                      </div>

                      {profileFormData.paper_size_id === 'custom' && (
                        <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-3 rounded-2xl border border-zinc-200/50">
                          <div className="space-y-1.5">
                            <label className="text-zinc-600 font-bold">{language === 'ar' ? 'العرض (مم) *' : 'Width (mm) *'}</label>
                            <input
                              required
                              type="number"
                              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg outline-none focus:border-emerald-600 transition-all font-semibold text-zinc-800"
                              value={profileFormData.custom_width}
                              onChange={(e) => setProfileFormData(prev => ({ ...prev, custom_width: Number(e.target.value) }))}
                              min={10}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-zinc-600 font-bold">{language === 'ar' ? 'الارتفاع (مم) *' : 'Height (mm) *'}</label>
                            <input
                              required
                              type="number"
                              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-lg outline-none focus:border-emerald-600 transition-all font-semibold text-zinc-800"
                              value={profileFormData.custom_height}
                              onChange={(e) => setProfileFormData(prev => ({ ...prev, custom_height: Number(e.target.value) }))}
                              min={10}
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-zinc-600 font-bold block">{language === 'ar' ? 'اتجاه الصفحة' : 'Orientation'}</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer font-semibold">
                            <input
                              type="radio"
                              name="profile_orientation"
                              checked={profileFormData.orientation === 'portrait'}
                              onChange={() => setProfileFormData(prev => ({ ...prev, orientation: 'portrait' }))}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>{language === 'ar' ? 'طولي (Portrait)' : 'Portrait'}</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer font-semibold">
                            <input
                              type="radio"
                              name="profile_orientation"
                              checked={profileFormData.orientation === 'landscape'}
                              onChange={() => setProfileFormData(prev => ({ ...prev, orientation: 'landscape' }))}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>{language === 'ar' ? 'عرضي (Landscape)' : 'Landscape'}</span>
                          </label>
                        </div>
                      </div>

                      {/* Margins */}
                      <div className="space-y-2">
                        <label className="text-zinc-600 font-bold block">{language === 'ar' ? 'الهوامش (مم)' : 'Margins (mm)'}</label>
                        <div className="grid grid-cols-4 gap-2 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/50 text-center">
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'أعلى' : 'Top'}</span>
                            <input
                              type="number"
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-center font-bold text-zinc-800"
                              value={profileFormData.margin_top}
                              onChange={(e) => setProfileFormData(prev => ({ ...prev, margin_top: Number(e.target.value) }))}
                              min={0}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'أسفل' : 'Bottom'}</span>
                            <input
                              type="number"
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-center font-bold text-zinc-800"
                              value={profileFormData.margin_bottom}
                              onChange={(e) => setProfileFormData(prev => ({ ...prev, margin_bottom: Number(e.target.value) }))}
                              min={0}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'يمين' : 'Right'}</span>
                            <input
                              type="number"
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-center font-bold text-zinc-800"
                              value={profileFormData.margin_right}
                              onChange={(e) => setProfileFormData(prev => ({ ...prev, margin_right: Number(e.target.value) }))}
                              min={0}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-400 block">{language === 'ar' ? 'يسار' : 'Left'}</span>
                            <input
                              type="number"
                              className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-center font-bold text-zinc-800"
                              value={profileFormData.margin_left}
                              onChange={(e) => setProfileFormData(prev => ({ ...prev, margin_left: Number(e.target.value) }))}
                              min={0}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Print settings JSON */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-zinc-600 font-bold">{language === 'ar' ? 'إعدادات طباعة إضافية (JSON)' : 'Additional Print Settings (JSON)'}</label>
                          <span className="text-[9px] text-zinc-400">Optional</span>
                        </div>
                        <textarea
                          className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white focus:border-emerald-600 transition-all font-mono text-[10px] font-semibold text-zinc-800"
                          rows={3}
                          value={profileFormData.print_settings}
                          onChange={(e) => setProfileFormData(prev => ({ ...prev, print_settings: e.target.value }))}
                          placeholder='{\n  "copies": 1,\n  "density": 10\n}'
                        />
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileModalOpen(false);
                            setEditingProfile(null);
                          }}
                          className="px-4 py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-xl text-xs font-bold transition-all"
                        >
                          {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/25"
                        >
                          {language === 'ar' ? 'حفظ ملف التعريف' : 'Save Profile'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
