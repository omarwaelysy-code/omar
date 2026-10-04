import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Supplier, Product, Warehouse, Company, Currency, AttachmentItem } from '../types';
import { 
  Search, Plus, Trash2, X, Eye, Sparkles, FileText, Pencil, Printer, Download, 
  ChevronLeft, ChevronRight, Hash, Calendar, Package, Tag, ArrowUpRight, 
  Lock, LayoutGrid, List, ChevronDown, ChevronUp, History, Coins, CheckCheck, ExternalLink, RotateCcw, Save, Copy, Layers, Filter, FileSpreadsheet, Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { ExportButtons } from '../components/ExportButtons';
import { PaginationControls } from '../components/PaginationControls';
import { usePermissions } from '../hooks/usePermissions';
import { formatMoney, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { useViewPreference } from '../hooks/useViewPreference';
import { CompanyInvoiceHeader } from '../components/CompanyInvoiceHeader';
import { useNavigation } from '../contexts/NavigationContext';
import { printElement, exportToPDF } from '../utils/pdfUtils';
import { exportToExcel } from '../utils/excelUtils';
import { printDocument } from '../utils/printEngine';
import { AttachmentsManager } from '../components/common/AttachmentsManager';

interface GoodsReceiptItem {
  id?: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  unit?: string;
  quantity: number;
  unit_cost: number;
  total_cost?: number;
  batch_id?: string | null;
  serial_number?: string | null;
  notes?: string | null;
  billed_quantity?: number;
  remaining_quantity?: number;
  // UI helpers
  po_quantity?: number;
  previously_received?: number;
}

interface GoodsReceipt {
  id: string;
  receipt_number: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  warehouse_id: string;
  warehouse_name: string;
  date: string;
  notes?: string;
  status: 'draft' | 'posted';
  document_origin: string;
  created_automatically: boolean;
  source_document_type?: string | null;
  source_document_id?: string | null;
  source_document_number?: string | null;
  created_by?: string;
  billing_status?: string;
  created_at?: string;
  items?: GoodsReceiptItem[];
  attachments?: AttachmentItem[];
}

export const GoodsReceipts: React.FC = () => {
  const { t, dir, language } = useLanguage();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('goods_receipts');
  const { showNotification } = useNotification();
  const { openTab, setPendingViewDoc } = useNavigation();

  // Local translations helper
  const gt = (key: string): string => {
    const translations: Record<string, { ar: string; en: string }> = {
      title: { ar: 'استلام البضائع (Goods Receipts)', en: 'Goods Receipts' },
      subtitle: { ar: 'إدارة وإثبات استلام البضائع من الموردين وتحديث كميات المخزن ومتوسط التكلفة.', en: 'Manage supplier goods delivery, update warehouse stock and moving average costs.' },
      add_receipt: { ar: 'إضافة سند استلام', en: 'Add Goods Receipt' },
      edit_receipt: { ar: 'تعديل سند استلام', en: 'Edit Goods Receipt' },
      search_placeholder: { ar: 'البحث عن سند استلام برقم السند أو اسم المورد...', en: 'Search goods receipts by receipt number or supplier...' },
      column_number: { ar: 'رقم السند', en: 'Receipt No' },
      column_supplier: { ar: 'المورد', en: 'Supplier' },
      column_warehouse: { ar: 'المخزن', en: 'Warehouse' },
      column_date: { ar: 'التاريخ', en: 'Date' },
      column_origin: { ar: 'مصدر المستند', en: 'Document Origin' },
      column_status: { ar: 'الحالة', en: 'Status' },
      status_draft: { ar: 'مسودة', en: 'Draft' },
      status_posted: { ar: 'معتمد (Posted)', en: 'Posted' },
      form_supplier: { ar: 'المورد', en: 'Supplier' },
      form_warehouse: { ar: 'المخزن المستلم', en: 'Warehouse' },
      form_date: { ar: 'تاريخ الاستلام', en: 'Receipt Date' },
      form_notes: { ar: 'ملاحظات', en: 'Notes' },
      form_items: { ar: 'أصناف السند', en: 'Receipt Items' },
      add_item: { ar: 'إضافة صنف', en: 'Add Item' },
      column_product: { ar: 'الصنف', en: 'Product' },
      column_quantity: { ar: 'الكمية المستلمة', en: 'Received Qty' },
      column_po_qty: { ar: 'كمية الأمر', en: 'PO Qty' },
      column_prev_received: { ar: 'المستلم سابقاً', en: 'Prev Received' },
      column_cost: { ar: 'تكلفة الوحدة', en: 'Unit Cost' },
      column_total: { ar: 'الإجمالي', en: 'Total' },
      column_batch: { ar: 'رقم التشغيلة (Batch)', en: 'Batch ID' },
      column_serial: { ar: 'الرقم التسلسلي (Serial)', en: 'Serial No' },
      view_receipt: { ar: 'تفاصيل سند الاستلام', en: 'Goods Receipt Details' },
      receipt: { ar: 'سند استلام بضائع', en: 'Goods Receipt' },
      saved_success: { ar: 'تم حفظ سند الاستلام بنجاح', en: 'Goods receipt saved successfully' },
      updated_success: { ar: 'تم تعديل سند الاستلام بنجاح', en: 'Goods receipt updated successfully' },
      deleted_success: { ar: 'تم حذف سند الاستلام بنجاح', en: 'Goods receipt deleted successfully' },
      convert_to_invoice: { ar: 'إنشاء فاتورة شراء', en: 'Create Purchase Invoice' },
      auto_generated: { ar: 'توليد تلقائي', en: 'Auto Generated' },
      origin_manual: { ar: 'يدوي', en: 'Manual' },
      origin_po: { ar: 'أمر شراء', en: 'Purchase Order' },
      select_po: { ar: 'ربط بأمر شراء (اختياري)', en: 'Link Purchase Order (Optional)' },
      po_over_receive_warning: { ar: 'الكمية المستلمة تتجاوز الكمية المتبقية في أمر الشراء!', en: 'Received quantity exceeds the remaining PO quantity!' }
    };
    return translations[key]?.[language as 'ar' | 'en'] || key;
  };

  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [pendingPOs, setPendingPOs] = useState<any[]>([]);

  // Filtering & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('all');
  const [filterAuto, setFilterAuto] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<GoodsReceipt | null>(null);
  const [viewReceipt, setViewReceipt] = useState<GoodsReceipt | null>(null);
  const [linkedInvoices, setLinkedInvoices] = useState<any[]>([]);
  
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'draft' | 'posted'>('draft');
  const [items, setItems] = useState<GoodsReceiptItem[]>([]);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [view, setView] = useViewPreference('goods_receipts', 'table');
  const toggleViewPreference = () => {
    setView(view === 'table' ? 'card' : 'table');
  };
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  const handleExportExcel = () => {
    const formattedData = receipts.map(gr => ({
      [gt('column_number')]: gr.receipt_number,
      [gt('column_supplier')]: gr.supplier_name,
      [gt('column_warehouse')]: gr.warehouse_name,
      [gt('column_date')]: formatDate(gr.date),
      [gt('column_origin')]: gr.document_origin,
      [gt('column_status')]: gt(`status_${gr.status}`)
    }));
    exportToExcel(formattedData, { filename: 'Goods_Receipts_Report', sheetName: gt('title') });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDF(tableRef.current, { 
        filename: 'Goods_Receipts_Report', 
        orientation: 'landscape'
      });
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const filters: any = {
      company_id: user.company_id,
      _page: page,
      _limit: limit,
      _sort: 'date',
      _order: 'DESC'
    };

    if (searchQuery) filters.search = searchQuery;
    if (filterOrigin !== 'all') filters.document_origin = filterOrigin;
    if (filterAuto !== 'all') filters.created_automatically = filterAuto === 'true';
    if (filterSupplier) filters.supplier_id = filterSupplier;
    if (filterWarehouse) filters.warehouse_id = filterWarehouse;
    if (filterStatus !== 'all') filters.status = filterStatus;
    if (filterDateFrom) filters['date_gte'] = filterDateFrom;
    if (filterDateTo) filters['date_lte'] = filterDateTo;

    const unsubReceipts = dbService.subscribePaginated<GoodsReceipt>('goods_receipts', filters, (result) => {
      setReceipts(result.data);
      setTotalCount(result.total);
      setLoading(false);
    });

    // Load setup data
    dbService.list<Supplier>('suppliers', { company_id: user.company_id }).then(setSuppliers);
    dbService.list<Product>('products', { company_id: user.company_id }).then(setProducts);
    dbService.list<Warehouse>('warehouses', { company_id: user.company_id }).then(setWarehouses);
    dbService.list<Currency>('currencies', { company_id: user.company_id }).then(setCurrencies);
    dbService.get<Company>('companies', user.company_id).then(setCompanyData).catch(err => console.error('Failed to load company:', err));

    return () => {
      unsubReceipts();
    };
  }, [user, page, searchQuery, filterOrigin, filterAuto, filterSupplier, filterWarehouse, filterStatus, filterDateFrom, filterDateTo, limit]);

  useEffect(() => {
    if (viewReceipt && user) {
      dbService.list('purchase_invoice_goods_receipts', { goods_receipt_id: viewReceipt.id })
        .then(async (junctions) => {
          const invoiceIds = junctions.map((j: any) => j.purchase_invoice_id);
          if (invoiceIds.length > 0) {
            const invoices = await dbService.list('purchase_invoices', { company_id: user.company_id });
            const filtered = invoices.filter((inv: any) => invoiceIds.includes(inv.id));
            setLinkedInvoices(filtered);
          } else {
            setLinkedInvoices([]);
          }
        })
        .catch(err => {
          console.error('Error fetching linked invoices:', err);
          setLinkedInvoices([]);
        });
    } else {
      setLinkedInvoices([]);
    }
  }, [viewReceipt, user]);

  // Fetch pending POs when supplier changes in modal
  useEffect(() => {
    if (user && supplierId && isModalOpen) {
      dbService.list<any>('purchase_orders', {
        company_id: user.company_id,
        supplier_id: supplierId,
        receipt_status_ne: 'received'
      }).then(setPendingPOs).catch(err => console.error('Error fetching POs:', err));
    } else {
      setPendingPOs([]);
      setSelectedPOId('');
    }
  }, [supplierId, isModalOpen, user]);

  // Handle PO selection and auto-loading items
  const handlePOChange = async (poId: string) => {
    setSelectedPOId(poId);
    if (!poId) {
      setItems([]);
      return;
    }

    try {
      const po = await dbService.get<any>('purchase_orders', poId);
      if (po && po.items) {
        if (po.warehouse_id) setWarehouseId(po.warehouse_id);

        const mapped: GoodsReceiptItem[] = (po.items || []).map((item: any) => {
          const ordered = Number(item.quantity) || 0;
          const prevRec = Number(item.received_quantity) || 0;
          const remaining = Math.max(0, ordered - prevRec);

          return {
            product_id: item.product_id,
            product_name: item.product_name,
            product_code: item.product_code || '',
            unit: item.unit || 'default',
            quantity: remaining,
            unit_cost: Number(item.unit_price) || 0,
            po_quantity: ordered,
            previously_received: prevRec,
            batch_id: '',
            serial_number: '',
            notes: ''
          };
        });

        setItems(mapped.filter(i => i.quantity > 0));
      }
    } catch (err) {
      console.error('Failed to load PO details for receipt:', err);
    }
  };

  const handleOpenModal = (gr?: GoodsReceipt) => {
    if (gr) {
      setEditingReceipt(gr);
      setSupplierId(gr.supplier_id);
      setWarehouseId(gr.warehouse_id);
      setReceiptDate(gr.date ? gr.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setNotes(gr.notes || '');
      setStatus(gr.status);
      setSelectedPOId(gr.source_document_type === 'purchase_order' ? (gr.source_document_id || '') : '');
      setAttachments(gr.attachments || []);
      
      const mapped = (gr.items || []).map(i => ({
        ...i,
        po_quantity: i.po_quantity || 0,
        previously_received: i.previously_received || 0
      }));
      setItems(mapped);
    } else {
      setEditingReceipt(null);
      setSupplierId('');
      setWarehouseId('');
      setReceiptDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setStatus('draft');
      setSelectedPOId('');
      setAttachments([]);
      setItems([]);
    }
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, {
      product_id: '',
      quantity: 1,
      unit_cost: 0,
      batch_id: '',
      serial_number: '',
      notes: ''
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof GoodsReceiptItem, val: any) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };

      if (field === 'product_id') {
        const prod = products.find(p => p.id === val);
        if (prod) {
          next[index].product_name = prod.name;
          next[index].product_code = prod.code;
          next[index].unit = prod.unit || 'default';
          next[index].unit_cost = Number(prod.cost_price) || 0;
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    const validItems = items.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) {
      showNotification(language === 'ar' ? 'يرجى إضافة صنف واحد على الأقل بكمية صالحة' : 'Please add at least one valid item', 'error');
      return;
    }

    // Verify PO over-receipt limits
    if (selectedPOId) {
      let overReceived = false;
      for (const item of validItems) {
        if (item.po_quantity !== undefined && item.previously_received !== undefined) {
          const remaining = item.po_quantity - item.previously_received;
          if (item.quantity > remaining) {
            overReceived = true;
          }
        }
      }
      if (overReceived) {
        const proceed = window.confirm(gt('po_over_receive_warning') + (language === 'ar' ? ' هل تريد المتابعة على أي حال؟' : ' Do you want to proceed anyway?'));
        if (!proceed) return;
      }
    }

    setIsSubmitting(true);

    try {
      const supplier = suppliers.find(s => s.id === supplierId);
      const wh = warehouses.find(w => w.id === warehouseId);
      const po = pendingPOs.find(o => o.id === selectedPOId);

      const payload = {
        supplier_id: supplierId || null,
        supplier_name: supplier?.name || null,
        warehouse_id: warehouseId,
        warehouse_name: wh?.name || '',
        date: receiptDate,
        notes,
        status,
        document_origin: po ? `Purchase Order (${po.order_number})` : gt('origin_manual'),
        created_automatically: false,
        source_document_type: po ? 'purchase_order' : null,
        source_document_id: po ? po.id : null,
        source_document_number: po ? po.order_number : null,
        company_id: user.company_id,
        created_by: user.id,
        attachments: attachments,
        items: validItems.map(i => ({
          product_id: i.product_id,
          unit: i.unit || 'default',
          quantity: Number(i.quantity),
          unit_cost: Number(i.unit_cost),
          batch_id: i.batch_id || null,
          serial_number: i.serial_number || null,
          notes: i.notes || null,
          po_quantity: i.po_quantity || null,
          previously_received: i.previously_received || null
        }))
      };

      if (editingReceipt) {
        await dbService.update('goods_receipts', editingReceipt.id, payload);
        showNotification(gt('updated_success'), 'success');
      } else {
        await dbService.add('goods_receipts', payload);
        showNotification(gt('saved_success'), 'success');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || 'Error saving goods receipt', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الاستلام؟' : 'Are you sure you want to delete this receipt?')) return;
    try {
      await dbService.delete('goods_receipts', id);
      showNotification(gt('deleted_success'), 'success');
      setReceipts(prev => prev.filter(r => r.id !== id));
      if (viewReceipt?.id === id) setViewReceipt(null);
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || 'Error deleting goods receipt', 'error');
    }
  };

  const handleCopyDocument = (receipt: GoodsReceipt) => {
    setViewReceipt(null);
    setEditingReceipt(null);
    setAttachments([]);
    const today = new Date().toISOString().slice(0, 10);
    setReceiptDate(today);
    setSupplierId(receipt.supplier_id || '');
    setWarehouseId(receipt.warehouse_id || '');
    setNotes(receipt.notes ? `${receipt.notes} (${language === 'ar' ? 'نسخة' : 'Copy'})` : '');
    setStatus('draft');
    setSelectedPOId('');
    setItems((receipt.items || []).map((item: any) => ({
      product_id: item.product_id,
      product_code: item.product_code || '',
      product_name: item.product_name || '',
      quantity: item.quantity || 1,
      unit_cost: item.unit_cost || item.cost_price || item.unit_price || 0,
      cost_price: item.cost_price || item.unit_cost || item.unit_price || 0,
      total: item.total || (item.quantity * (item.cost_price || item.unit_price || 0)) || 0
    })));
    setIsModalOpen(true);
    showNotification(
      language === 'ar' ? 'تم نسخ المستند كمسودة جديدة' : 'Document copied as new draft',
      'success'
    );
  };

  const handleExportSingleReceiptExcel = (gr: any) => {
    const items = (gr.items || []).map((item: any, idx: number) => ({
      '#': idx + 1,
      [language === 'ar' ? 'رقم الإذن' : 'Receipt Number']: gr.receipt_number,
      [language === 'ar' ? 'التاريخ' : 'Date']: formatDate(gr.date),
      [language === 'ar' ? 'رمز الصنف' : 'Product Code']: item.product_code || '-',
      [language === 'ar' ? 'اسم الصنف' : 'Product Name']: item.product_name || '-',
      [language === 'ar' ? 'الكمية' : 'Quantity']: item.quantity,
      [language === 'ar' ? 'التكلفة' : 'Cost Price']: item.cost_price || item.unit_price || 0,
      [language === 'ar' ? 'الإجمالي' : 'Total']: item.total || (item.quantity * (item.cost_price || item.unit_price || 0)) || 0
    }));

    exportToExcel(items, `Goods_Receipt_${gr.receipt_number}`);
  };

  const handleConvertToInvoice = (receipt: GoodsReceipt) => {
    setPendingViewDoc({ type: 'convert_goods_receipt', idOrNumber: receipt.id });
    openTab('purchase_invoices', t('nav.purchase_invoices'));
    showNotification(language === 'ar' ? 'تم تجهيز السند للتحويل للفاتورة' : 'Receipt prepped for invoice conversion', 'info');
  };

  return (
    <div className="p-3 md:p-4 space-y-3" dir={dir}>
      {viewReceipt ? (
        /* ================= VIEW INLINE SCREEN ================= */
        <div className="space-y-3">
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewReceipt(null)}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                title={language === 'ar' ? 'الرجوع للقائمة' : 'Back to list'}
              >
                {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <div>
                <h1 className="text-base md:text-lg font-bold text-slate-900 tracking-tight flex flex-wrap items-center gap-2">
                  <Package className="text-indigo-600" size={18} />
                  <span>{gt('view_receipt')}</span>
                  <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {viewReceipt.receipt_number}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${viewReceipt.status === 'posted' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-650'}`}>
                    {gt(`status_${viewReceipt.status}`)}
                  </span>
                </h1>
                <p className="text-slate-400 font-medium mt-0.5 text-xs">
                  {formatDate(viewReceipt.date)} {viewReceipt.supplier_name ? `• ${viewReceipt.supplier_name}` : ''} • {viewReceipt.warehouse_name}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 justify-end">
              {viewReceipt.status === 'posted' && (
                <button
                  onClick={() => handleConvertToInvoice(viewReceipt)}
                  className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95"
                >
                  <ArrowUpRight size={14} />
                  <span>{gt('convert_to_invoice')}</span>
                </button>
              )}
              {canEdit && viewReceipt.status === 'draft' && (
                <button
                  onClick={() => {
                    const r = viewReceipt;
                    setViewReceipt(null);
                    handleOpenModal(r);
                  }}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg transition-all font-bold text-xs flex items-center gap-1 active:scale-95"
                >
                  <Pencil size={13} />
                  <span>{language === 'ar' ? 'تعديل' : 'Edit'}</span>
                </button>
              )}
              <button
                onClick={() => handleCopyDocument(viewReceipt)}
                className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-all font-bold text-xs flex items-center gap-1 active:scale-95"
                title={language === 'ar' ? 'نسخ المستند كمسودة جديدة' : 'Copy Document'}
              >
                <Copy size={13} />
                <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
              </button>
              <button
                onClick={() => exportToPDF(receiptPrintRef.current, { filename: `Goods_Receipt_${viewReceipt.receipt_number}`, reportTitle: `إذن إضافة ${viewReceipt.receipt_number}` })}
                className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg transition-all font-bold text-xs flex items-center gap-1 active:scale-95"
                title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
              >
                <FileText size={13} />
                <span>{language === 'ar' ? 'تصدير PDF' : 'Export PDF'}</span>
              </button>
              <button
                onClick={() => handleExportSingleReceiptExcel(viewReceipt)}
                className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all font-bold text-xs flex items-center gap-1 active:scale-95"
                title={language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
              >
                <FileSpreadsheet size={13} />
                <span>{language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}</span>
              </button>
              <button
                onClick={() => printElement(receiptPrintRef.current, `إذن إضافة ${viewReceipt.receipt_number}`)}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-all active:scale-95"
                title={language === 'ar' ? 'طباعة' : 'Print'}
              >
                <Printer size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewReceipt(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-all"
              >
                {t('common.close')}
              </button>
            </div>
          </div>

          {/* Details Content Card */}
          <div ref={receiptPrintRef} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 select-text">
            <CompanyInvoiceHeader 
              company={companyData} 
              documentNumber={viewReceipt.receipt_number} 
              documentDate={viewReceipt.date ? formatDate(viewReceipt.date) : ''} 
              title={gt('receipt')} 
            />

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">{gt('form_supplier')}</span>
                <span className="text-slate-800 font-bold">{viewReceipt.supplier_name || (language === 'ar' ? 'غير محدد' : 'Not Specified')}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">{gt('form_warehouse')}</span>
                <span className="text-slate-800 font-bold">{viewReceipt.warehouse_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">{gt('column_origin')}</span>
                <span className="text-indigo-650 font-bold">{viewReceipt.document_origin}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">{gt('column_status')}</span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${viewReceipt.status === 'posted' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-650'}`}>
                  {gt(`status_${viewReceipt.status}`)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">{language === 'ar' ? 'حالة الفوترة' : 'Billing Status'}</span>
                {(() => {
                  const bStatus = viewReceipt.billing_status || 'uninvoiced';
                  let label = language === 'ar' ? 'غير مفوتر' : 'Uninvoiced';
                  let colorClass = 'bg-slate-100 text-slate-600';
                  if (bStatus === 'partially_invoiced') {
                    label = language === 'ar' ? 'مفوتر جزئياً' : 'Partially Invoiced';
                    colorClass = 'bg-blue-50 text-blue-600';
                  } else if (bStatus === 'fully_invoiced') {
                    label = language === 'ar' ? 'مفوتر بالكامل' : 'Fully Invoiced';
                    colorClass = 'bg-emerald-50 text-emerald-600';
                  } else if (bStatus === 'supplier_assigned') {
                    label = language === 'ar' ? 'تم تعيين المورد' : 'Supplier Assigned';
                    colorClass = 'bg-indigo-50 text-indigo-600';
                  }
                  return (
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${colorClass}`}>
                      {label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Items */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-700 text-xs">{gt('form_items')}</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                      <th className="px-3 py-1.5">{gt('column_product')}</th>
                      <th className="px-3 py-1.5">{language === 'ar' ? 'المستلمة' : 'Received'}</th>
                      <th className="px-3 py-1.5">{language === 'ar' ? 'المفوترة' : 'Billed'}</th>
                      <th className="px-3 py-1.5">{language === 'ar' ? 'المتبقية' : 'Remaining'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {(viewReceipt.items || []).map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="px-3 py-1.5">
                          <span className="font-bold text-slate-800">{item.product_name}</span>
                          {item.product_code && <span className="text-[10px] text-slate-400 block">{item.product_code}</span>}
                        </td>
                        <td className="px-3 py-1.5 font-bold text-slate-800">
                          {item.quantity} <span className="text-slate-400 text-[10px]">{item.unit}</span>
                        </td>
                        <td className="px-3 py-1.5 font-bold text-blue-600">
                          {item.billed_quantity || 0} <span className="text-slate-400 text-[10px]">{item.unit}</span>
                        </td>
                        <td className="px-3 py-1.5 font-bold text-amber-600">
                          {item.remaining_quantity !== null && item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity} <span className="text-slate-400 text-[10px]">{item.unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            {viewReceipt.notes && (
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 font-medium">
                <span className="font-bold text-slate-700 block mb-1">{gt('form_notes')}</span>
                <p className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">{viewReceipt.notes}</p>
              </div>
            )}

            {/* Attachments */}
            {viewReceipt.attachments && viewReceipt.attachments.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <AttachmentsManager
                  attachments={viewReceipt.attachments}
                  onChange={() => {}}
                  readOnly={true}
                  title={language === 'ar' ? 'المستندات والمرفقات' : 'Documents & Attachments'}
                />
              </div>
            )}

            {/* Linked Invoices */}
            {linkedInvoices.length > 0 && (
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 font-medium">
                <span className="font-bold text-slate-700 block mb-1.5">
                  {language === 'ar' ? 'الفواتير المرتبطة' : 'Linked Invoices'}
                </span>
                <div className="space-y-1.5">
                  {linkedInvoices.map((inv: any) => (
                    <div 
                      key={inv.id}
                      className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200/80"
                    >
                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="font-bold text-slate-800 text-xs">
                          {inv.invoice_number}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(inv.date)} - {inv.supplier_name}
                        </span>
                      </div>
                      <div className="text-left font-bold text-slate-800 text-xs">
                        {formatMoney(inv.total_amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : isModalOpen ? (
        /* ================= INLINE CREATE / EDIT FORM SCREEN ================= */
        <div className="space-y-3">
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingReceipt(null); }}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                title={language === 'ar' ? 'الرجوع للقائمة' : 'Back to list'}
              >
                {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <div>
                <h1 className="text-base md:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <Package className="text-indigo-600" size={18} />
                  <span>{editingReceipt ? gt('edit_receipt') : gt('add_receipt')}</span>
                </h1>
                <p className="text-slate-400 font-medium mt-0.5 text-xs">
                  {editingReceipt 
                    ? (language === 'ar' ? `تعديل سند استلام رقم ${editingReceipt.receipt_number}` : `Edit Goods Receipt #${editingReceipt.receipt_number}`)
                    : (language === 'ar' ? 'إثبات استلام كميات المخزن وتحديث متوسط التكلفة' : 'Register warehouse goods receipt and update stock')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingReceipt(null); }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                form="goods-receipt-form"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-lg text-xs shadow-sm transition-all"
              >
                <Save size={14} />
                <span>{editingReceipt ? t('common.save') : t('common.add')}</span>
              </button>
            </div>
          </div>

          {/* Form Container */}
          <form id="goods-receipt-form" onSubmit={handleSubmit} className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {/* Supplier */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{gt('form_supplier')}</label>
                <select
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/20 transition-all text-xs cursor-pointer outline-none"
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                >
                  <option value="">{language === 'ar' ? 'اختر المورد' : 'Select Supplier'}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              {/* Purchase Order selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{gt('select_po')}</label>
                <select
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/20 transition-all text-xs cursor-pointer outline-none disabled:opacity-50"
                  disabled={!supplierId}
                  value={selectedPOId}
                  onChange={e => handlePOChange(e.target.value)}
                >
                  <option value="">{language === 'ar' ? 'استلام يدوي (بدون أمر شراء)' : 'Manual receipt (No PO)'}</option>
                  {pendingPOs.map(o => <option key={o.id} value={o.id}>{o.order_number} ({formatDate(o.date)})</option>)}
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{gt('form_warehouse')}*</label>
                <select
                  required
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/20 transition-all text-xs cursor-pointer outline-none"
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                >
                  <option value="">{language === 'ar' ? 'اختر المخزن المستلم' : 'Select Warehouse'}</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{gt('form_date')}*</label>
                <input
                  required
                  type="date"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/20 transition-all text-xs outline-none"
                  value={receiptDate}
                  onChange={e => setReceiptDate(e.target.value)}
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">{gt('column_status')}</label>
                <select
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/20 transition-all text-xs cursor-pointer outline-none"
                  value={status}
                  onChange={e => setStatus(e.target.value as 'draft' | 'posted')}
                >
                  <option value="draft">{gt('status_draft')}</option>
                  <option value="posted">{gt('status_posted')}</option>
                </select>
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700 text-xs">{gt('form_items')}</h3>
                {!selectedPOId && (
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Plus size={13} />
                    <span>{gt('add_item')}</span>
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                      <th className="px-2.5 py-1.5">{gt('column_product')}</th>
                      <th className="px-2.5 py-1.5">{gt('column_quantity')}</th>
                      {selectedPOId && <th className="px-2.5 py-1.5">{gt('column_po_qty')}</th>}
                      {selectedPOId && <th className="px-2.5 py-1.5">{gt('column_prev_received')}</th>}
                      <th className="px-2.5 py-1.5">{gt('column_batch')}</th>
                      <th className="px-2.5 py-1.5">{gt('column_serial')}</th>
                      <th className="px-2.5 py-1.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="px-2.5 py-1.5 w-1/3">
                          {selectedPOId ? (
                            <span className="font-bold text-slate-800 block text-xs">{item.product_name}</span>
                          ) : (
                            <select
                              required
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/20 outline-none text-xs"
                              value={item.product_id}
                              onChange={e => handleItemChange(index, 'product_id', e.target.value)}
                            >
                              <option value="">...</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                            </select>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input
                            required
                            type="number"
                            step="any"
                            min="0.01"
                            className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold focus:ring-1 focus:ring-indigo-500/20 outline-none text-xs"
                            value={item.quantity}
                            onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        {selectedPOId && (
                          <td className="px-2.5 py-1.5 text-slate-500 font-bold text-xs">{item.po_quantity}</td>
                        )}
                        {selectedPOId && (
                          <td className="px-2.5 py-1.5 text-slate-500 font-bold text-xs">{item.previously_received}</td>
                        )}
                        <td className="px-2.5 py-1.5">
                          <input
                            type="text"
                            placeholder={gt('column_batch')}
                            className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/20 outline-none text-xs"
                            value={item.batch_id || ''}
                            onChange={e => handleItemChange(index, 'batch_id', e.target.value)}
                          />
                        </td>
                        <td className="px-2.5 py-1.5">
                          <input
                            type="text"
                            placeholder={gt('column_serial')}
                            className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/20 outline-none text-xs"
                            value={item.serial_number || ''}
                            onChange={e => handleItemChange(index, 'serial_number', e.target.value)}
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          {!selectedPOId && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-500">{gt('form_notes')}</label>
              <textarea
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500/20 transition-all text-xs outline-none resize-none h-16"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Attachments */}
            <div className="pt-2 border-t border-slate-100">
              <AttachmentsManager
                attachments={attachments}
                onChange={setAttachments}
                title={language === 'ar' ? 'المستندات والمرفقات المؤيدة لإذن الاستلام' : 'Supporting Documents & Attachments'}
                subtitle={language === 'ar' ? 'صور البضاعة، فواتير المورد، أو مستندات PDF/أوفيس' : 'Delivery notes, photos, or PDF/Office docs'}
              />
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingReceipt(null); }}
                className="px-3.5 py-1.5 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition-colors text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-1.5 rounded-lg font-bold shadow-sm transition-all text-xs"
              >
                <Save size={14} />
                <span>{editingReceipt ? t('common.save') : t('common.add')}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ================= LIST SCREEN ================= */
        <div className="space-y-2.5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2.5 border-b border-slate-200/80">
            <div>
              <h1 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <span>{gt('title')}</span>
              </h1>
              <p className="text-slate-400 text-xs font-medium mt-0.5">{gt('subtitle')}</p>
            </div>
            {canCreate && (
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl font-bold shadow-sm transition-all text-xs active:scale-95"
              >
                <Plus size={14} />
                <span>{gt('add_receipt')}</span>
              </button>
            )}
          </div>

          {/* Control Bar */}
          <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-2 justify-between items-center">
            {/* Search */}
            <div className="relative w-full md:max-w-md">
              <input
                type="text"
                placeholder={gt('search_placeholder')}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all text-xs"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 w-full md:w-auto justify-end">
              <button
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold text-xs border transition-all ${
                  showFiltersPanel || filterOrigin !== 'all' || filterStatus !== 'all' || filterSupplier || filterWarehouse
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Filter size={13} />
                <span>{language === 'ar' ? 'تصفية متقدمة' : 'Filters'}</span>
              </button>

              <button
                onClick={toggleViewPreference}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg transition-all"
                title={language === 'ar' ? 'تغيير طريقة العرض' : 'Change View'}
              >
                {view === 'table' ? <LayoutGrid size={15} /> : <List size={15} />}
              </button>

              <ExportButtons
                size="sm"
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                onPrint={() => printElement(tableRef.current, 'أذون استلام البضاعة')}
              />
            </div>
          </div>

          {/* Advanced Filters Panel */}
          <AnimatePresence>
            {showFiltersPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm overflow-hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5"
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{gt('column_origin')}</label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/10 outline-none text-xs"
                    value={filterOrigin}
                    onChange={e => setFilterOrigin(e.target.value)}
                  >
                    <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
                    <option value={gt('origin_manual')}>{gt('origin_manual')}</option>
                    <option value="Purchase Order">{gt('origin_po')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{gt('form_supplier')}</label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/10 outline-none text-xs"
                    value={filterSupplier}
                    onChange={e => setFilterSupplier(e.target.value)}
                  >
                    <option value="">{language === 'ar' ? 'الكل' : 'All'}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{gt('form_warehouse')}</label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/10 outline-none text-xs"
                    value={filterWarehouse}
                    onChange={e => setFilterWarehouse(e.target.value)}
                  >
                    <option value="">{language === 'ar' ? 'الكل' : 'All'}</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{gt('column_status')}</label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-1 focus:ring-indigo-500/10 outline-none text-xs"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                  >
                    <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
                    <option value="draft">{gt('status_draft')}</option>
                    <option value="posted">{gt('status_posted')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{language === 'ar' ? 'من تاريخ' : 'From Date'}</label>
                  <input
                    type="date"
                    className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold outline-none text-xs"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</label>
                  <input
                    type="date"
                    className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold outline-none text-xs"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2 flex items-end justify-end">
                  <button
                    onClick={() => {
                      setFilterOrigin('all');
                      setFilterAuto('all');
                      setFilterSupplier('');
                      setFilterWarehouse('');
                      setFilterStatus('all');
                      setFilterDateFrom('');
                      setFilterDateTo('');
                    }}
                    className="px-3 py-1.5 text-rose-500 font-bold hover:bg-rose-50 rounded-lg transition-all text-xs"
                  >
                    {language === 'ar' ? 'إعادة تعيين الفلاتر' : 'Reset Filters'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Table / Card Content */}
          {loading ? (
            <div className="flex justify-center items-center py-16 bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="w-8 h-8 border-3 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="bg-white py-12 rounded-xl border border-slate-200/80 shadow-sm text-center flex flex-col items-center justify-center space-y-2.5">
              <Package className="w-12 h-12 text-slate-300" />
              <h3 className="font-bold text-slate-800 text-sm">{language === 'ar' ? 'لا يوجد استلامات بضائع' : 'No Goods Receipts'}</h3>
              <p className="text-slate-400 font-medium text-xs max-w-sm">
                {language === 'ar' ? 'ابدأ في تسجيل استلامات المخزن لتوثيق حركة الأصناف بدقة.' : 'Create your first goods receipt to log warehouse operations accurately.'}
              </p>
            </div>
          ) : view === 'table' ? (
            /* Table View with reduced padding on rows and columns */
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table ref={tableRef} className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                      <th className="px-3.5 py-2">{gt('column_number')}</th>
                      <th className="px-3.5 py-2">{gt('column_supplier')}</th>
                      <th className="px-3.5 py-2">{gt('column_warehouse')}</th>
                      <th className="px-3.5 py-2">{gt('column_date')}</th>
                      <th className="px-3.5 py-2">{gt('column_origin')}</th>
                      <th className="px-3.5 py-2">{gt('column_status')}</th>
                      <th className="px-3.5 py-2">{language === 'ar' ? 'حالة الفوترة' : 'Billing Status'}</th>
                      <th className="px-3.5 py-2 text-center w-28"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {receipts.map(gr => (
                      <tr
                        key={gr.id}
                        onClick={() => setViewReceipt(gr)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        <td className="px-3.5 py-2 font-bold text-slate-900 font-mono">{gr.receipt_number}</td>
                        <td className="px-3.5 py-2">{gr.supplier_name || '-'}</td>
                        <td className="px-3.5 py-2">{gr.warehouse_name}</td>
                        <td className="px-3.5 py-2 text-slate-500 font-medium">{formatDate(gr.date)}</td>
                        <td className="px-3.5 py-2">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${gr.created_automatically ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-650'}`}>
                            {gr.document_origin}
                          </span>
                        </td>
                        <td className="px-3.5 py-2">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${gr.status === 'posted' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-650'}`}>
                            {gt(`status_${gr.status}`)}
                          </span>
                        </td>
                        <td className="px-3.5 py-2">
                          {(() => {
                            const bStatus = gr.billing_status || 'uninvoiced';
                            let label = language === 'ar' ? 'غير مفوتر' : 'Uninvoiced';
                            let colorClass = 'bg-slate-100 text-slate-600';
                            if (bStatus === 'partially_invoiced') {
                              label = language === 'ar' ? 'مفوتر جزئياً' : 'Partially Invoiced';
                              colorClass = 'bg-blue-50 text-blue-600';
                            } else if (bStatus === 'fully_invoiced') {
                              label = language === 'ar' ? 'مفوتر بالكامل' : 'Fully Invoiced';
                              colorClass = 'bg-emerald-50 text-emerald-600';
                            } else if (bStatus === 'supplier_assigned') {
                              label = language === 'ar' ? 'تم تعيين المورد' : 'Supplier Assigned';
                              colorClass = 'bg-indigo-50 text-indigo-600';
                            }
                            return (
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${colorClass}`}>
                                {label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3.5 py-1.5 text-center">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            {gr.status === 'posted' && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleConvertToInvoice(gr);
                                }}
                                className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-all"
                                title={gt('convert_to_invoice')}
                              >
                                <ArrowUpRight size={15} />
                              </button>
                            )}
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setViewReceipt(gr);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                              title={language === 'ar' ? 'عرض' : 'View'}
                            >
                              <Eye size={15} />
                            </button>
                            {canEdit && gr.status === 'draft' && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleOpenModal(gr);
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                                title={language === 'ar' ? 'تعديل' : 'Edit'}
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleDelete(gr.id);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
                                title={language === 'ar' ? 'حذف' : 'Delete'}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls page={page} limit={limit} total={totalCount} onPageChange={setPage} onLimitChange={setLimit} />
            </div>
          ) : (
            /* Card View */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {receipts.map(gr => (
                  <div
                    key={gr.id}
                    onClick={() => setViewReceipt(gr)}
                    className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{formatDate(gr.date)}</span>
                        <h3 className="font-bold text-slate-800 text-sm font-mono">{gr.receipt_number}</h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${gr.status === 'posted' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-650'}`}>
                        {gt(`status_${gr.status}`)}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs font-semibold text-slate-500">
                      <div className="flex justify-between">
                        <span>{gt('form_supplier')}</span>
                        <span className="font-bold text-slate-700 text-right">{gr.supplier_name || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{gt('form_warehouse')}</span>
                        <span className="font-bold text-slate-700 text-right">{gr.warehouse_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{gt('column_origin')}</span>
                        <span className="font-bold text-indigo-600 text-right">{gr.document_origin}</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-1 pt-1.5 border-t border-slate-100">
                      {gr.status === 'posted' && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleConvertToInvoice(gr);
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title={gt('convert_to_invoice')}
                        >
                          <ArrowUpRight size={15} />
                        </button>
                      )}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setViewReceipt(gr);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                        title={language === 'ar' ? 'عرض' : 'View'}
                      >
                        <Eye size={15} />
                      </button>
                      {canEdit && gr.status === 'draft' && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenModal(gr);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                          title={language === 'ar' ? 'تعديل' : 'Edit'}
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDelete(gr.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title={language === 'ar' ? 'حذف' : 'Delete'}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <PaginationControls page={page} limit={limit} total={totalCount} onPageChange={setPage} onLimitChange={setLimit} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
