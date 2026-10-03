import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Warehouse, Product, WarehouseTransfer, WarehouseTransferItem, AttachmentItem } from '../types';
import { 
  Search, Plus, Trash2, X, ArrowLeftRight, Pencil, 
  Download, Eye, FileText, History, Printer, FileSpreadsheet, Copy,
  Home, Calendar, Hash, Layers, Save, Paperclip,
  Maximize2, Minimize2, ChevronRight, ChevronLeft, RotateCcw, User, LayoutGrid, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { formatNumber, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { PaginationControls } from '../components/PaginationControls';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { ExportButtons } from '../components/ExportButtons';
import { AttachmentsManager } from '../components/common/AttachmentsManager';


interface TransferItemInput {
  product_id: string;
  quantity: number;
}

export const WarehouseTransfers: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir, language } = useLanguage();

  // Data states
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleExportExcel = () => {
    const headers = {
      'transfer_number': 'رقم التحويل',
      'date': 'التاريخ',
      'from_warehouse_name': 'من مخزن',
      'to_warehouse_name': 'إلى مخزن',
      'notes': 'ملاحظات'
    };
    const formattedData = formatDataForExcel(transfers, headers);
    exportToExcel(formattedData, { filename: 'Warehouse_Transfers', sheetName: 'تحويلات المخازن' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, {
        filename: 'Warehouse_Transfers',
        reportTitle: 'جدول تحويلات المخازن'
      });
    }
  };


  // Filter/Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterFromWh, setFilterFromWh] = useState('');
  const [filterToWh, setFilterToWh] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);

  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<WarehouseTransfer | null>(null);
  const [viewTransfer, setViewTransfer] = useState<WarehouseTransfer | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    from_warehouse_id: '',
    to_warehouse_id: '',
    description: ''
  });
  const [items, setItems] = useState<TransferItemInput[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  // Subscriptions
  useEffect(() => {
    if (user) {
      const filters = {
        company_id: user.company_id,
        _page: page,
        _limit: limit,
        _sortBy: sortBy,
        _sortOrder: sortOrder,
        _search: searchTerm,
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
        ...(filterFromWh && { from_warehouse_id: filterFromWh }),
        ...(filterToWh && { to_warehouse_id: filterToWh }),
      };

      const unsubTransfers = dbService.subscribePaginated('warehouse_transfers', filters, (result: any) => {
        setTransfers(result.data || []);
        setTotalRecords(result.total || 0);
        setLoading(false);
      });

      const unsubWarehouses = dbService.subscribe<Warehouse>('warehouses', user.company_id, setWarehouses);
      
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, (data) => {
        // Exclude service products (non-physical)
        setProducts((data || []).filter(p => p.type !== 'service'));
      });

      return () => {
        unsubTransfers();
        unsubWarehouses();
        unsubProducts();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm, dateFrom, dateTo, filterFromWh, filterToWh]);

  // Reset form
  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      from_warehouse_id: '',
      to_warehouse_id: '',
      description: ''
    });
    setItems([]);
    setAttachments([]);
    setEditingTransfer(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (transfer: WarehouseTransfer) => {
    try {
      const fullTransfer = await dbService.get<any>('warehouse_transfers', transfer.id);
      if (fullTransfer) {
        setEditingTransfer(fullTransfer);
        setFormData({
          date: fullTransfer.date ? fullTransfer.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          from_warehouse_id: fullTransfer.from_warehouse_id,
          to_warehouse_id: fullTransfer.to_warehouse_id,
          description: fullTransfer.description || ''
        });
        setItems(
          (fullTransfer.items || []).map((item: WarehouseTransferItem) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity)
          }))
        );
        setAttachments(fullTransfer.attachments || []);
        setIsModalOpen(true);
      } else {
        showNotification(language === 'ar' ? 'عذراً، تعذر العثور على تفاصيل عملية التحويل' : 'Failed to retrieve transfer details', 'error');
      }
    } catch (e: any) {
      showNotification(e.message || 'Error loading transfer details', 'error');
    }
  };

  const handleOpenViewModal = async (transfer: WarehouseTransfer) => {
    try {
      const fullTransfer = await dbService.get<any>('warehouse_transfers', transfer.id);
      if (fullTransfer) {
        setViewTransfer(fullTransfer);
      } else {
        showNotification(language === 'ar' ? 'عذراً، تعذر العثور على تفاصيل عملية التحويل' : 'Failed to retrieve transfer details', 'error');
      }
    } catch (e: any) {
      showNotification(e.message || 'Error loading transfer details', 'error');
    }
  };

  const handleOpenDeleteModal = (id: string) => {
    setTransferToDelete(id);
    setIsDeleteModalOpen(true);
  };

  // Item helpers
  const handleAddItemRow = () => {
    setItems([...items, { product_id: '', quantity: 1 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof TransferItemInput, value: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setItems(updated);
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.from_warehouse_id || !formData.to_warehouse_id) {
      showNotification(language === 'ar' ? 'يرجى اختيار المخزن المحول منه والمحول إليه' : 'Please select both source and destination warehouses', 'warning');
      return;
    }

    if (formData.from_warehouse_id === formData.to_warehouse_id) {
      showNotification(t('warehouse_transfers.same_warehouse_error') || 'Source and destination warehouses cannot be the same', 'warning');
      return;
    }

    if (items.length === 0) {
      showNotification(language === 'ar' ? 'يجب إضافة صنف واحد على الأكثر لإتمام عملية التحويل' : 'Please add at least one item to transfer', 'warning');
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_id) {
        showNotification(language === 'ar' ? 'يرجى اختيار صنف صحيح في السطر ' + (i + 1) : 'Please select a valid product on line ' + (i + 1), 'warning');
        return;
      }
      if (item.quantity <= 0) {
        showNotification(language === 'ar' ? 'يرجى إدخال كمية أكبر من صفر في السطر ' + (i + 1) : 'Quantity must be greater than 0 on line ' + (i + 1), 'warning');
        return;
      }
    }

    const payload = {
      date: formData.date,
      from_warehouse_id: formData.from_warehouse_id,
      to_warehouse_id: formData.to_warehouse_id,
      description: formData.description,
      attachments: attachments,
      items: items
    };

    try {
      if (editingTransfer) {
        await dbService.update('warehouse_transfers', editingTransfer.id, payload);
        showNotification(language === 'ar' ? 'تم تعديل التحويل بنجاح' : 'Transfer updated successfully', 'success');
      } else {
        await dbService.add('warehouse_transfers', payload);
        showNotification(language === 'ar' ? 'تم تسجيل عملية التحويل بنجاح' : 'Transfer created successfully', 'success');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      showNotification(error.message || 'Error processing transfer', 'error');
    }
  };

  const handleDelete = async () => {
    if (!transferToDelete || !user) return;
    try {
      await dbService.delete('warehouse_transfers', transferToDelete);
      showNotification(language === 'ar' ? 'تم حذف عملية التحويل بنجاح' : 'Transfer deleted successfully', 'success');
      setIsDeleteModalOpen(false);
      setTransferToDelete(null);
    } catch (error: any) {
      showNotification(error.message || 'Error deleting transfer', 'error');
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setPage(1);
  };

  const handleExportDocPDF = (transfer: WarehouseTransfer) => {
    const columns = [
      { id: 'product_code', label: language === 'ar' ? 'كود الصنف' : 'Code', width: 25 },
      { id: 'product_name', label: language === 'ar' ? 'اسم الصنف' : 'Product Name', width: 50 },
      { id: 'quantity', label: language === 'ar' ? 'الكمية' : 'Qty', width: 25 }
    ];

    const rows = ((transfer as any).items || []).map((item: any) => ({
      product_code: item.product_code || '-',
      product_name: item.product_name || '-',
      quantity: formatNumber(item.quantity)
    }));

    exportToPDFUtil(tableRef.current || document.body, {
      filename: `Warehouse_Transfer_${transfer.transfer_number}`,
      reportTitle: `${language === 'ar' ? 'سند تحويل مخزني' : 'Warehouse Transfer Document'} - ${transfer.transfer_number}`,
      columns,
      rows
    });
  };

  const handleExportDocExcel = (transfer: WarehouseTransfer) => {
    const items = ((transfer as any).items || []).map((item: any, idx: number) => ({
      '#': idx + 1,
      [language === 'ar' ? 'رقم التحويل' : 'Transfer Number']: transfer.transfer_number,
      [language === 'ar' ? 'التاريخ' : 'Date']: formatDate(transfer.date),
      [language === 'ar' ? 'من مخزن' : 'From Warehouse']: transfer.from_warehouse_name || '-',
      [language === 'ar' ? 'إلى مخزن' : 'To Warehouse']: transfer.to_warehouse_name || '-',
      [language === 'ar' ? 'رمز الصنف' : 'Product Code']: item.product_code || '-',
      [language === 'ar' ? 'اسم الصنف' : 'Product Name']: item.product_name || '-',
      [language === 'ar' ? 'الكمية' : 'Quantity']: item.quantity
    }));

    exportToExcel(items, `Warehouse_Transfer_${transfer.transfer_number}`);
  };

  const handleCopyTransfer = (transfer: WarehouseTransfer) => {
    setViewTransfer(null);
    setEditingTransfer(null);
    setAttachments([]);
    const today = new Date().toISOString().slice(0, 10);
    setFormData({
      date: today,
      from_warehouse_id: transfer.from_warehouse_id || '',
      to_warehouse_id: transfer.to_warehouse_id || '',
      description: transfer.description ? `${transfer.description} (${language === 'ar' ? 'نسخة' : 'Copy'})` : ''
    });
    setItems(((transfer as any).items || []).map((item: any) => ({
      product_id: item.product_id || '',
      quantity: item.quantity || 1
    })));
    setIsModalOpen(true);
    showNotification(
      language === 'ar' ? 'تم نسخ التحويل كمسودة جديدة' : 'Transfer copied as new draft',
      'success'
    );
  };

  return (
    <div className={`p-3 space-y-3 ${dir === 'rtl' ? 'rtl' : 'ltr'}`} dir={dir}>
      {viewTransfer ? (
        /* View Transfer Inline Screen */
        <div className="space-y-3">
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewTransfer(null)}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                title={language === 'ar' ? 'الرجوع للقائمة' : 'Back to list'}
              >
                {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[10px] uppercase">
                    {language === 'ar' ? 'سند تحويل مخزني' : 'Transfer Document'}
                  </span>
                  <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1">
                    <ArrowLeftRight className="text-emerald-500" size={16} />
                    {viewTransfer.transfer_number}
                  </h1>
                </div>
                <p className="text-slate-500 font-medium text-[11px] mt-0.5">
                  {language === 'ar' ? 'تفاصيل ومعاينة عملية التحويل بين المخازن' : 'Warehouse transfer details'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => handleCopyTransfer(viewTransfer)}
                className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-all font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95"
                title={language === 'ar' ? 'نسخ المستند كمسودة جديدة' : 'Copy Document'}
              >
                <Copy size={13} />
                <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
              </button>
              <button
                onClick={() => handleExportDocPDF(viewTransfer)}
                className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg transition-all font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95"
                title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
              >
                <FileText size={13} />
                <span>{language === 'ar' ? 'تصدير PDF' : 'Export PDF'}</span>
              </button>
              <button
                onClick={() => handleExportDocExcel(viewTransfer)}
                className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95"
                title={language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
              >
                <FileSpreadsheet size={13} />
                <span>{language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}</span>
              </button>
              <button
                onClick={() => printElement(document.getElementById('view-transfer-content') || document.body, `سند تحويل مخزني ${viewTransfer.transfer_number}`)}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-all shadow-sm active:scale-95"
                title={language === 'ar' ? 'طباعة' : 'Print'}
              >
                <Printer size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewTransfer(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all"
              >
                {t('common.close')}
              </button>
            </div>
          </div>

          {/* Details Content */}
          <div id="view-transfer-content" className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 p-2.5 bg-slate-50 rounded-xl text-xs">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">{t('warehouse_transfers.column_date')}</span>
                <span className="text-slate-800 font-bold block mt-0.5">{formatDate(viewTransfer.date)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">{t('warehouse_transfers.column_from_warehouse')}</span>
                <span className="text-rose-600 font-bold block mt-0.5">{viewTransfer.from_warehouse_name}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">{t('warehouse_transfers.column_to_warehouse')}</span>
                <span className="text-emerald-600 font-bold block mt-0.5">{viewTransfer.to_warehouse_name}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'رقم القيد' : 'Journal Entry'}</span>
                <span className="text-slate-400 font-mono block mt-0.5">-</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'بواسطة' : 'Created By'}</span>
                <span className="text-slate-800 font-bold block mt-0.5">{viewTransfer.created_by || '-'}</span>
              </div>
            </div>

            {viewTransfer.description && (
              <div className="space-y-0.5">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'ملاحظات / بيان' : 'Notes'}</span>
                <p className="text-slate-700 text-xs bg-slate-50/70 p-2 rounded-lg border border-slate-200">{viewTransfer.description}</p>
              </div>
            )}

            {/* Items Grid */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-slate-700">{language === 'ar' ? 'تفاصيل الأصناف المحولة' : 'Transferred Items'}</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px]">
                      <th className="px-2.5 py-1.5 font-bold text-slate-600 uppercase">{language === 'ar' ? 'كود الصنف' : 'Code'}</th>
                      <th className="px-2.5 py-1.5 font-bold text-slate-600 uppercase">{language === 'ar' ? 'اسم الصنف' : 'Product Name'}</th>
                      <th className="px-2.5 py-1.5 font-bold text-slate-600 uppercase text-center">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                      <th className="px-2.5 py-1.5 font-bold text-slate-600 uppercase">{language === 'ar' ? 'الوحدة' : 'Unit'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {((viewTransfer as any).items || []).map((item: WarehouseTransferItem) => {
                      const prod = products.find(p => p.id === item.product_id);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-2.5 py-1 font-mono font-bold text-slate-600">{item.product_code || '-'}</td>
                          <td className="px-2.5 py-1 font-bold text-slate-800">{item.product_name}</td>
                          <td className="px-2.5 py-1 font-bold text-slate-700 text-center">{formatNumber(item.quantity)}</td>
                          <td className="px-2.5 py-1 font-medium text-slate-500">{prod?.unit || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attachments */}
            {viewTransfer.attachments && viewTransfer.attachments.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <AttachmentsManager
                  attachments={viewTransfer.attachments}
                  onChange={() => {}}
                  readOnly={true}
                  title={language === 'ar' ? 'المستندات والمرفقات' : 'Documents & Attachments'}
                />
              </div>
            )}
          </div>
        </div>
      ) : isModalOpen ? (
        /* Create / Edit Inline Screen */
        <div className="space-y-3">
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingTransfer(null); }}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                title={language === 'ar' ? 'الرجوع للقائمة' : 'Back to list'}
              >
                {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <div>
                <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <ArrowLeftRight className="text-emerald-500" size={18} />
                  {editingTransfer ? t('warehouse_transfers.edit') : t('warehouse_transfers.add')}
                </h1>
                <p className="text-slate-500 font-medium mt-0.5 text-[11px]">
                  {editingTransfer 
                    ? (language === 'ar' ? 'تعديل تفاصيل التحويل المخزني رقم ' + editingTransfer.transfer_number : 'Modify details of transfer #' + editingTransfer.transfer_number) 
                    : (language === 'ar' ? 'إنشاء عملية تحويل جديدة' : 'Create a new warehouse transfer')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingTransfer(null); }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                form="warehouse-transfer-form"
                className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm"
              >
                <Save size={14} />
                {t('common.save')}
              </button>
            </div>
          </div>

          {/* Form Content */}
          <form id="warehouse-transfer-form" onSubmit={handleSubmit} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
            {/* Top row fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 px-0.5">
                  {t('warehouse_transfers.form_date')} <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute right-2.5 top-2 text-slate-400" size={15} />
                  <input
                    required
                    type="date"
                    className="w-full pr-8 pl-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 px-0.5">
                  {t('warehouse_transfers.form_from_warehouse')} <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Home className="absolute right-2.5 top-2 text-rose-500" size={15} />
                  <select
                    required
                    className="w-full pr-8 pl-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold text-xs appearance-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={formData.from_warehouse_id}
                    onChange={(e) => setFormData({ ...formData, from_warehouse_id: e.target.value })}
                  >
                    <option value="">{t('common.select_category')}</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 px-0.5">
                  {t('warehouse_transfers.form_to_warehouse')} <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Home className="absolute right-2.5 top-2 text-emerald-500" size={15} />
                  <select
                    required
                    className="w-full pr-8 pl-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold text-xs appearance-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={formData.to_warehouse_id}
                    onChange={(e) => setFormData({ ...formData, to_warehouse_id: e.target.value })}
                  >
                    <option value="">{t('common.select_category')}</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 px-0.5">
                {language === 'ar' ? 'ملاحظات / بيان' : 'Notes / Remarks'}
              </label>
              <textarea
                rows={2}
                className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-normal text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                placeholder={language === 'ar' ? 'اكتب أي ملاحظات إضافية هنا...' : 'Write any additional notes here...'}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Items Section */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers size={14} className="text-emerald-500" />
                  {t('warehouse_transfers.form_items')}
                </h3>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-xs rounded-lg transition-all"
                >
                  <Plus size={13} />
                  {language === 'ar' ? 'إضافة صنف' : 'Add Item'}
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-5 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-xs">
                    {language === 'ar' ? 'لا يوجد أي أصناف مضافة. انقر فوق إضافة صنف للبدء.' : 'No items added. Click Add Item to start.'}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full border-collapse text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                        <th className="px-2.5 py-1.5 w-10 text-center">#</th>
                        <th className="px-2.5 py-1.5">{language === 'ar' ? 'الصنف' : 'Product'}</th>
                        <th className="px-2.5 py-1.5 w-36">{language === 'ar' ? 'الكمية' : 'Quantity'}</th>
                        <th className="px-2.5 py-1.5 w-12 text-center">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, index) => {
                        const product = products.find(p => p.id === item.product_id);
                        return (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="px-2.5 py-1 text-center font-bold text-slate-400 text-xs">{index + 1}</td>
                            <td className="px-2.5 py-1">
                              <select
                                required
                                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none font-bold text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 transition-all appearance-none"
                                value={item.product_id}
                                onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                              >
                                <option value="">{language === 'ar' ? 'اختر صنف مخزني...' : 'Select product...'}</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.code} - {p.name} {p.stock !== undefined ? `(رصيد: ${p.stock})` : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2.5 py-1">
                              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2">
                                <input
                                  required
                                  type="number"
                                  min={0.01}
                                  step="any"
                                  placeholder={language === 'ar' ? 'الكمية' : 'Qty'}
                                  className="w-full py-1 outline-none font-bold text-xs text-slate-800"
                                  value={item.quantity || ''}
                                  onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                />
                                {product?.unit && (
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1 py-0.5 rounded shrink-0">
                                    {product.unit}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2.5 py-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(index)}
                                className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="pt-2 border-t border-slate-100">
              <AttachmentsManager
                attachments={attachments}
                onChange={setAttachments}
                title={language === 'ar' ? 'المستندات والمرفقات المؤيدة للتحويل المخزني' : 'Transfer Supporting Documents'}
                subtitle={language === 'ar' ? 'أذون الصرف/الاستلام، بوالص الشحن، أو ملفات PDF/أوفيس' : 'Waybills, delivery notes, or PDF/Office docs'}
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingTransfer(null); }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm"
              >
                <Save size={14} />
                {t('common.save')}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Main List / Table Screen */
        <>
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <ArrowLeftRight className="text-emerald-500" size={18} />
                {t('warehouse_transfers.title')}
              </h1>
              <p className="text-slate-500 font-medium mt-0.5 text-[11px]">{t('warehouse_transfers.subtitle')}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <ExportButtons
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                onPrint={() => printElement(tableRef.current, 'جدول تحويلات المخازن')}
              />
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg font-bold text-xs shadow-sm hover:shadow hover:scale-[1.01] active:scale-[0.98] transition-all"
              >
                <Plus size={15} />
                {t('warehouse_transfers.add')}
              </button>
            </div>
          </div>

          {/* Filter and search bar */}
          <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div className="relative col-span-1 md:col-span-2">
                <Search className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={15} />
                <input
                  type="text"
                  placeholder={t('warehouse_transfers.search_placeholder')}
                  className={`w-full ${dir === 'rtl' ? 'pr-7 pl-2.5' : 'pl-7 pr-2.5'} py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all`}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                />
              </div>
              
              <div>
                <input
                  type="date"
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                />
              </div>

              <div>
                <input
                  type="date"
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                />
              </div>

              <div className="flex gap-1.5">
                <select
                  className="w-1/2 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={filterFromWh}
                  onChange={(e) => { setFilterFromWh(e.target.value); setPage(1); }}
                >
                  <option value="">{language === 'ar' ? 'من مخزن...' : 'From warehouse...'}</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <select
                  className="w-1/2 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={filterToWh}
                  onChange={(e) => { setFilterToWh(e.target.value); setPage(1); }}
                >
                  <option value="">{language === 'ar' ? 'إلى مخزن...' : 'To warehouse...'}</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Main Table / Grid representation */}
          {loading ? (
            <div className="flex items-center justify-center h-40 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold text-xs">{t('common.loading')}</p>
              </div>
            </div>
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-white rounded-xl border border-slate-200 shadow-sm text-center space-y-1.5">
              <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
                <ArrowLeftRight size={20} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-700">{t('common.no_data')}</h3>
                <p className="text-slate-400 text-[11px]">
                  {language === 'ar' ? 'لم يتم العثور على أي عمليات تحويل مخزني مطابقة.' : 'No warehouse transfers found.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div ref={tableRef} className="overflow-x-auto">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200">
                      <th 
                        onClick={() => handleSort('transfer_number')}
                        className="px-2 py-1.5 font-bold text-slate-600 uppercase cursor-pointer hover:text-emerald-600 transition-colors text-[11px]"
                      >
                        {t('warehouse_transfers.column_number')}
                      </th>
                      <th 
                        onClick={() => handleSort('date')}
                        className="px-2 py-1.5 font-bold text-slate-600 uppercase cursor-pointer hover:text-emerald-600 transition-colors text-[11px]"
                      >
                        {t('warehouse_transfers.column_date')}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-[11px]">
                        {t('warehouse_transfers.column_from_warehouse')}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-[11px]">
                        {t('warehouse_transfers.column_to_warehouse')}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-[11px]">
                        {t('warehouse_transfers.column_items_count')}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-[11px]">
                        {language === 'ar' ? 'رقم القيد' : 'Journal Entry'}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-[11px]">
                        {language === 'ar' ? 'البيان' : 'Description'}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-center w-24 text-[11px]">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transfers.map((tItem) => (
                      <tr key={tItem.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-2 py-1 font-mono font-bold text-slate-900 text-xs">
                          {tItem.transfer_number}
                        </td>
                        <td className="px-2 py-1 font-medium text-slate-500 whitespace-nowrap text-xs">
                          {formatDate(tItem.date)}
                        </td>
                        <td className="px-2 py-1 font-bold text-rose-600 whitespace-nowrap text-xs">
                          {tItem.from_warehouse_name}
                        </td>
                        <td className="px-2 py-1 font-bold text-emerald-600 whitespace-nowrap text-xs">
                          {tItem.to_warehouse_name}
                        </td>
                        <td className="px-2 py-1 font-bold text-slate-700 text-xs">
                          {(tItem as any).items_count || 1}
                        </td>
                        <td className="px-2 py-1 font-mono text-slate-400 text-xs">
                          -
                        </td>
                        <td className="px-2 py-1 font-normal text-slate-500 max-w-[180px] truncate text-xs" title={tItem.description}>
                          {tItem.description || '-'}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenViewModal(tItem)}
                              title={language === 'ar' ? 'عرض التفاصيل' : 'View details'}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(tItem)}
                              title={language === 'ar' ? 'تعديل' : 'Edit'}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteModal(tItem.id)}
                              title={language === 'ar' ? 'حذف' : 'Delete'}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalRecords > limit && (
                <div className="p-3 border-t border-slate-100">
                  <PaginationControls
                    page={page}
                    limit={limit}
                    total={totalRecords}
                    onPageChange={setPage}
                    onLimitChange={setLimit}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-xl p-5 w-full max-w-sm text-center space-y-4"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Trash2 size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">{t('common.delete_confirm_title')}</h3>
                <p className="text-slate-400 text-xs">
                  {t('common.delete_confirm_msg')}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 rounded-xl text-xs transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  className="w-1/2 py-2 bg-rose-500 hover:bg-rose-600 font-bold text-white rounded-xl text-xs shadow-sm transition-all"
                >
                  {t('common.delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
