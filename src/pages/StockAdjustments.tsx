import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Warehouse, Product, StockAdjustment, StockAdjustmentItem, Account } from '../types';
import { 
  Search, Plus, Trash2, X, Sliders, Pencil, 
  Eye, FileText, History, Printer, Calendar, Hash, Layers, Save, FileSpreadsheet, Copy,
  ChevronRight, ChevronLeft, LayoutGrid, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AttachmentsManager, AttachmentItem } from '../components/common/AttachmentsManager';
import { dbService } from '../services/dbService';
import { formatNumber, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { PaginationControls } from '../components/PaginationControls';
import { useNavigation } from '../contexts/NavigationContext';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { ExportButtons } from '../components/ExportButtons';
import { useRef } from 'react';


interface AdjItemInput {
  product_id: string;
  warehouse_id: string;
  quantity: number;
  unit_cost: number;
}

export const StockAdjustments: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir, language } = useLanguage();
  const { setPendingViewDoc, setCurrentPage } = useNavigation();

  // Data states
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleExportExcel = () => {
    const headers = {
      'adjustment_number': 'رقم التسوية',
      'date': 'التاريخ',
      'account_name': 'الحساب المقابل',
      'description': 'ملاحظات'
    };
    const formattedData = formatDataForExcel(adjustments, headers);
    exportToExcel(formattedData, { filename: 'Stock_Adjustments', sheetName: 'تسويات المخزون' });
  };

  const handleExportPDF = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, {
        filename: 'Stock_Adjustments',
        reportTitle: 'جدول تسويات كميات وأسعار المخزون'
      });
    }
  };


  // Filter/Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [totalRecords, setTotalRecords] = useState(0);

  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdj, setEditingAdj] = useState<StockAdjustment | null>(null);
  const [viewAdj, setViewAdj] = useState<StockAdjustment | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [adjToDelete, setAdjToDelete] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    account_id: '',
    description: ''
  });
  const [items, setItems] = useState<AdjItemInput[]>([]);
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
      };

      const unsubAdjs = dbService.subscribePaginated('stock_adjustments', filters, (result: any) => {
        setAdjustments(result.data || []);
        setTotalRecords(result.total || 0);
        setLoading(false);
      });

      const unsubWarehouses = dbService.subscribe<Warehouse>('warehouses', user.company_id, setWarehouses);
      
      const unsubProducts = dbService.subscribe<Product>('products', user.company_id, (data) => {
        // Exclude service products (non-physical)
        setProducts((data || []).filter(p => p.type !== 'service'));
      });

      const unsubAccounts = dbService.subscribe<Account>('accounts', user.company_id, setAccounts);

      return () => {
        unsubAdjs();
        unsubWarehouses();
        unsubProducts();
        unsubAccounts();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm, dateFrom, dateTo]);

  // Reset form
  const resetForm = () => {
    // Attempt to auto-find default adjustment accounts (expenses or costing discrepancy)
    const discrepancyAcc = accounts.find(a => a.name.includes('تسوية') || a.name.toLowerCase().includes('discrepancy') || a.name.toLowerCase().includes('adjustment'));
    
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      account_id: discrepancyAcc?.id || '',
      description: ''
    });
    setItems([]);
    setAttachments([]);
    setEditingAdj(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (adj: StockAdjustment) => {
    try {
      const fullAdj = await dbService.get<any>('stock_adjustments', adj.id);
      if (fullAdj) {
        setEditingAdj(fullAdj);
        setFormData({
          date: fullAdj.date ? fullAdj.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          account_id: fullAdj.account_id,
          description: fullAdj.description || ''
        });
        setItems(
          (fullAdj.items || []).map((item: StockAdjustmentItem) => ({
            product_id: item.product_id,
            warehouse_id: item.warehouse_id,
            quantity: Number(item.quantity),
            unit_cost: Number(item.unit_cost)
          }))
        );
        setAttachments(Array.isArray(fullAdj.attachments) ? fullAdj.attachments : []);
        setIsModalOpen(true);
      } else {
        showNotification(language === 'ar' ? 'عذراً، تعذر العثور على التفاصيل' : 'Failed to retrieve document details', 'error');
      }
    } catch (e: any) {
      showNotification(e.message || 'Error loading document details', 'error');
    }
  };

  const handleOpenViewModal = async (adj: StockAdjustment) => {
    try {
      const fullAdj = await dbService.get<any>('stock_adjustments', adj.id);
      if (fullAdj) {
        setViewAdj(fullAdj);
      } else {
        showNotification(language === 'ar' ? 'عذراً، تعذر العثور على التفاصيل' : 'Failed to retrieve document details', 'error');
      }
    } catch (e: any) {
      showNotification(e.message || 'Error loading document details', 'error');
    }
  };

  const handleOpenDeleteModal = (id: string) => {
    setAdjToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!adjToDelete) return;
    try {
      await dbService.delete('stock_adjustments', adjToDelete);
      showNotification(language === 'ar' ? 'تم حذف التسوية وإعادة احتساب تكلفة المخازن والقيود بنجاح' : 'Stock adjustment deleted successfully', 'success');
      setIsDeleteModalOpen(false);
      setAdjToDelete(null);
    } catch (e: any) {
      showNotification(e.message || 'Failed to delete stock adjustment', 'error');
    }
  };

  const handleAddItem = () => {
    setItems([...items, { product_id: '', warehouse_id: warehouses[0]?.id || '', quantity: 1, unit_cost: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof AdjItemInput, value: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: field === 'product_id' || field === 'warehouse_id' ? value : Number(value)
    };

    // If product is changed, we can autofill the product's current cost price as a guideline!
    if (field === 'product_id') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        updated[index].unit_cost = prod.cost_price || 0;
      }
    }

    setItems(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.account_id) {
      showNotification(language === 'ar' ? 'يجب اختيار حساب التسوية المقابل' : 'Adjustment counter account is required', 'error');
      return;
    }

    if (items.length === 0) {
      showNotification(language === 'ar' ? 'يجب إضافة صنف واحد على الأقل' : 'At least one item is required', 'error');
      return;
    }

    const invalidItem = items.find(item => !item.product_id || !item.warehouse_id || item.quantity === 0);
    if (invalidItem) {
      showNotification(
        language === 'ar' 
          ? 'الرجاء اختيار الصنف والمستودع والتحقق من أن كمية التسوية لا تساوي الصفر' 
          : 'Please select product/warehouse and ensure adjustment quantities are not zero', 
        'error'
      );
      return;
    }

    const adjAcc = accounts.find(a => a.id === formData.account_id);

    const payload = {
      ...formData,
      account_name: adjAcc?.name || '',
      attachments,
      items: items.map(item => {
        const prod = products.find(p => p.id === item.product_id);
        const wh = warehouses.find(w => w.id === item.warehouse_id);
        return {
          ...item,
          product_name: prod?.name || '',
          product_code: prod?.code || '',
          warehouse_name: wh?.name || ''
        };
      })
    };

    try {
      if (editingAdj) {
        await dbService.update('stock_adjustments', editingAdj.id, payload);
        showNotification(language === 'ar' ? 'تم تعديل سند التسوية وإعادة احتساب تكلفة المخازن والقيود بنجاح' : 'Stock adjustment updated successfully', 'success');
      } else {
        await dbService.create('stock_adjustments', payload);
        showNotification(language === 'ar' ? 'تم حفظ سند التسوية بنجاح وتحديث قيود اليومية وتكلفة الأصناف' : 'Stock adjustment saved and costing/JEs updated successfully', 'success');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (e: any) {
      showNotification(e.message || 'Failed to save stock adjustment', 'error');
    }
  };

  const handleSort = (field: string) => {
    const isAsc = sortBy === field && sortOrder === 'ASC';
    setSortOrder(isAsc ? 'DESC' : 'ASC');
    setSortBy(field);
    setPage(1);
  };

  const handlePrint = (adj: StockAdjustment) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${language === 'ar' ? `تسوية مخزنية - ${adj.adjustment_number}` : `Stock Adjustment - ${adj.adjustment_number}`}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: ${dir}; padding: 30px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px; }
            .info-item { font-size: 14px; }
            .info-label { font-weight: bold; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; text-align: ${dir === 'rtl' ? 'right' : 'left'}; }
            th, td { border: 1px solid #ddd; padding: 12px; font-size: 14px; }
            th { bg-color: #f5f5f5; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${language === 'ar' ? 'سند تسوية كميات وأسعار مخزنية' : 'Inventory Stock Adjustment Receipt'}</div>
            <div><strong>${adj.adjustment_number}</strong></div>
          </div>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">${language === 'ar' ? 'التاريخ:' : 'Date:'}</span> ${formatDate(adj.date)}</div>
            <div class="info-item"><span class="info-label">${language === 'ar' ? 'حساب التسوية المقابل:' : 'Adjustment Account:'}</span> ${adj.account_name || '-'}</div>
            <div class="info-item" style="grid-column: span 2;"><span class="info-label">${language === 'ar' ? 'البيان/الملاحظات:' : 'Notes:'}</span> ${adj.description || '-'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>${language === 'ar' ? 'رمز الصنف' : 'Code'}</th>
                <th>${language === 'ar' ? 'اسم الصنف' : 'Product'}</th>
                <th>${language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                <th>${language === 'ar' ? 'فرق الكمية' : 'Qty Difference'}</th>
                <th>${language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
                <th>${language === 'ar' ? 'إجمالي الفرق' : 'Total Diff'}</th>
              </tr>
            </thead>
            <tbody>
              ${(adj.items || []).map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.product_code || ''}</td>
                  <td>${item.product_name || ''}</td>
                  <td>${item.warehouse_name || ''}</td>
                  <td style="color: ${Number(item.quantity) < 0 ? '#e11d48' : '#10b981'}; font-weight: bold;">
                    ${Number(item.quantity) > 0 ? '+' : ''}${formatNumber(item.quantity)}
                  </td>
                  <td>${formatNumber(item.unit_cost)}</td>
                  <td style="color: ${Number(item.total_cost || 0) < 0 ? '#e11d48' : '#10b981'}; font-weight: bold;">
                    ${Number(item.total_cost || 0) > 0 ? '+' : ''}${formatNumber(item.total_cost || 0)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportDocPDF = (adj: StockAdjustment) => {
    const columns = [
      { id: 'product_code', label: language === 'ar' ? 'رمز الصنف' : 'Code', width: 20 },
      { id: 'product_name', label: language === 'ar' ? 'اسم الصنف' : 'Product', width: 35 },
      { id: 'warehouse_name', label: language === 'ar' ? 'المستودع' : 'Warehouse', width: 20 },
      { id: 'quantity', label: language === 'ar' ? 'الكمية' : 'Qty', width: 10 },
      { id: 'unit_cost', label: language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost', width: 15 }
    ];

    const rows = (adj.items || []).map(item => ({
      product_code: item.product_code || '-',
      product_name: item.product_name || '-',
      warehouse_name: item.warehouse_name || '-',
      quantity: formatNumber(item.quantity),
      unit_cost: formatNumber(item.unit_cost)
    }));

    exportToPDFUtil(tableRef.current || document.body, {
      filename: `Stock_Adjustment_${adj.adjustment_number}`,
      reportTitle: `${language === 'ar' ? 'تسوية كميات وأسعار المخزون' : 'Stock Adjustment'} - ${adj.adjustment_number}`,
      columns,
      rows
    });
  };

  const handleExportDocExcel = (adj: StockAdjustment) => {
    const items = (adj.items || []).map((item, idx) => ({
      '#': idx + 1,
      [language === 'ar' ? 'رقم المستند' : 'Document Number']: adj.adjustment_number,
      [language === 'ar' ? 'التاريخ' : 'Date']: formatDate(adj.date),
      [language === 'ar' ? 'رمز الصنف' : 'Product Code']: item.product_code || '-',
      [language === 'ar' ? 'اسم الصنف' : 'Product Name']: item.product_name || '-',
      [language === 'ar' ? 'المستودع' : 'Warehouse']: item.warehouse_name || '-',
      [language === 'ar' ? 'الكمية' : 'Quantity']: item.quantity,
      [language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost']: item.unit_cost
    }));

    exportToExcel(items, `Stock_Adjustment_${adj.adjustment_number}`);
  };

  const handleCopyAdj = (adj: StockAdjustment) => {
    setViewAdj(null);
    setEditingAdj(null);
    const today = new Date().toISOString().slice(0, 10);
    setFormData({
      date: today,
      account_id: adj.account_id || '',
      description: adj.description ? `${adj.description} (${language === 'ar' ? 'نسخة' : 'Copy'})` : ''
    });
    setItems((adj.items || []).map(item => ({
      product_id: item.product_id || '',
      warehouse_id: item.warehouse_id || warehouses[0]?.id || '',
      quantity: item.quantity || 1,
      unit_cost: item.unit_cost || 0
    })));
    setIsModalOpen(true);
    showNotification(
      language === 'ar' ? 'تم نسخ المستند كمسودة جديدة' : 'Document copied as new draft',
      'success'
    );
  };

  return (
    <div className={`p-3 space-y-3 ${dir === 'rtl' ? 'rtl' : 'ltr'}`} dir={dir}>
      {viewAdj ? (
        /* View Adjustment Inline Screen */
        <div className="space-y-3">
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewAdj(null)}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                title={language === 'ar' ? 'الرجوع للقائمة' : 'Back to list'}
              >
                {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[10px] uppercase">
                    {language === 'ar' ? 'تسوية الأصناف والمخزون' : 'Stock Adjustment'}
                  </span>
                  <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1">
                    <Sliders className="text-emerald-500" size={16} />
                    {viewAdj.adjustment_number}
                  </h1>
                </div>
                <p className="text-slate-500 font-medium text-[11px] mt-0.5">
                  {language === 'ar' ? `بتاريخ: ${formatDate(viewAdj.date)}` : `Date: ${formatDate(viewAdj.date)}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => handleCopyAdj(viewAdj)}
                className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-all font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95"
                title={language === 'ar' ? 'نسخ المستند كمسودة جديدة' : 'Copy Document'}
              >
                <Copy size={13} />
                <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
              </button>
              <button
                onClick={() => handleExportDocPDF(viewAdj)}
                className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg transition-all font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95"
                title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
              >
                <FileText size={13} />
                <span>{language === 'ar' ? 'تصدير PDF' : 'Export PDF'}</span>
              </button>
              <button
                onClick={() => handleExportDocExcel(viewAdj)}
                className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95"
                title={language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
              >
                <FileSpreadsheet size={13} />
                <span>{language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}</span>
              </button>
              <button
                onClick={() => handlePrint(viewAdj)}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-all shadow-sm active:scale-95"
                title={language === 'ar' ? 'طباعة' : 'Print'}
              >
                <Printer size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewAdj(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-all"
              >
                {t('common.close')}
              </button>
            </div>
          </div>

          {/* Details Content */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-2.5 bg-slate-50 rounded-xl text-xs">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'حساب التسوية المقابل:' : 'Offset Account:'}</span>
                <span className="text-slate-800 font-bold block mt-0.5">{viewAdj.account_name || '-'}</span>
              </div>
              {viewAdj.entry_number && (
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'رقم القيد:' : 'Journal Entry:'}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewAdj(null);
                      setPendingViewDoc({ type: 'journal', idOrNumber: viewAdj.entry_number! });
                      setCurrentPage('journal_entries');
                    }}
                    className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50 mt-0.5 block"
                  >
                    {viewAdj.entry_number}
                  </button>
                </div>
              )}
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">{language === 'ar' ? 'البيان والملاحظات:' : 'Notes:'}</span>
                <span className="text-slate-700 font-normal block mt-0.5">{viewAdj.description || '-'}</span>
              </div>
            </div>

            {/* Items Grid */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-slate-700">{language === 'ar' ? 'أصناف التسوية المحققة' : 'Adjusted Items'}</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                      <th className="px-2.5 py-1.5">{language === 'ar' ? 'رمز الصنف' : 'Code'}</th>
                      <th className="px-2.5 py-1.5">{language === 'ar' ? 'اسم الصنف' : 'Product'}</th>
                      <th className="px-2.5 py-1.5">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                      <th className="px-2.5 py-1.5 w-28 text-center">{language === 'ar' ? 'فرق الكمية' : 'Qty Diff'}</th>
                      <th className="px-2.5 py-1.5 w-28 text-center">{language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
                      <th className="px-2.5 py-1.5 w-28 text-center">{language === 'ar' ? 'قيمة الفرق' : 'Diff Value'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewAdj.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-2.5 py-1 font-mono font-bold text-slate-600">{item.product_code || ''}</td>
                        <td className="px-2.5 py-1 font-bold text-slate-800">{item.product_name || ''}</td>
                        <td className="px-2.5 py-1 font-medium text-slate-600">{item.warehouse_name || ''}</td>
                        <td 
                          className="px-2.5 py-1 text-center font-bold"
                          style={{ color: Number(item.quantity) < 0 ? '#e11d48' : '#10b981' }}
                        >
                          {Number(item.quantity) > 0 ? '+' : ''}{formatNumber(item.quantity)}
                        </td>
                        <td className="px-2.5 py-1 text-center font-mono font-bold text-slate-700">{formatNumber(item.unit_cost)}</td>
                        <td 
                          className="px-2.5 py-1 text-center font-mono font-bold"
                          style={{ color: Number(item.total_cost || 0) < 0 ? '#e11d48' : '#10b981' }}
                        >
                          {Number(item.total_cost || 0) > 0 ? '+' : ''}{formatNumber(item.total_cost || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Net Total */}
            <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-600 font-bold">{language === 'ar' ? 'صافي أثر فروق القيمة:' : 'Net Discrepancy Impact:'}</span>
              <span 
                className="text-sm font-black font-mono"
                style={{
                  color: (viewAdj.items || []).reduce((sum, item) => sum + Number(item.total_cost || 0), 0) < 0 ? '#e11d48' : '#10b981'
                }}
              >
                {((viewAdj.items || []).reduce((sum, item) => sum + Number(item.total_cost || 0), 0) > 0 ? '+' : '') + 
                  formatNumber(
                    (viewAdj.items || []).reduce((sum, item) => sum + Number(item.total_cost || 0), 0)
                  )
                }
              </span>
            </div>

            {/* Attachments */}
            {viewAdj.attachments && viewAdj.attachments.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <AttachmentsManager
                  attachments={viewAdj.attachments}
                  readOnly={true}
                  title={language === 'ar' ? 'المرفقات والمستندات المؤيدة' : 'Supporting Attachments'}
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
                onClick={() => { setIsModalOpen(false); setEditingAdj(null); }}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                title={language === 'ar' ? 'الرجوع للقائمة' : 'Back to list'}
              >
                {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <div>
                <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <Sliders className="text-emerald-500" size={18} />
                  {editingAdj
                    ? (language === 'ar' ? `تعديل سند تسوية الأصناف: ${editingAdj.adjustment_number}` : `Edit Stock Adjustment: ${editingAdj.adjustment_number}`)
                    : (language === 'ar' ? 'إنشاء سند تسوية الأصناف' : 'Create Stock Adjustment')}
                </h1>
                <p className="text-slate-500 font-medium mt-0.5 text-[11px]">
                  {language === 'ar' ? 'أدخل أصناف التسوية وفروقات الكمية أو التكلفة' : 'Specify adjustment items and changes in quantity or cost'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingAdj(null); }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                form="stock-adjustment-form"
                className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm"
              >
                <Save size={14} />
                <span>{editingAdj ? t('common.save') : (language === 'ar' ? 'حفظ وترحيل' : 'Save & Post')}</span>
              </button>
            </div>
          </div>

          {/* Form Content */}
          <form id="stock-adjustment-form" onSubmit={handleSave} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className={`grid grid-cols-1 md:grid-cols-2 ${editingAdj?.entry_number ? 'lg:grid-cols-3' : ''} gap-2.5`}>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 px-0.5">
                  {language === 'ar' ? 'تاريخ التسوية *' : 'Adjustment Date *'}
                </label>
                <div className="relative">
                  <Calendar className="absolute right-2.5 top-2 text-slate-400" size={15} />
                  <input
                    type="date"
                    required
                    className="w-full pr-8 pl-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>

              {editingAdj?.entry_number && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 px-0.5">
                    {language === 'ar' ? 'رقم القيد المرتبط' : 'Linked Journal Entry'}
                  </label>
                  <div className="relative">
                    <Layers className="absolute right-2.5 top-2 text-emerald-500" size={15} />
                    <input
                      readOnly
                      type="text"
                      className="w-full pr-8 pl-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg outline-none font-bold text-emerald-800 text-xs"
                      value={editingAdj.entry_number}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 px-0.5">
                  {language === 'ar' ? 'حساب التسوية المقابل (دائن / مدين) *' : 'Counter Account *'}
                </label>
                <select
                  required
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-bold text-xs appearance-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                >
                  <option value="">{language === 'ar' ? 'اختر حساب تسوية الفروقات...' : 'Select counter account...'}</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 px-0.5">
                {language === 'ar' ? 'سبب التسوية / الملاحظات' : 'Reason for Adjustment / Notes'}
              </label>
              <textarea
                rows={2}
                placeholder={language === 'ar' ? 'مثل: معالجة فروق جرد مستودعي لعام 2026...' : 'e.g., discrepancies resolved from warehouse audit...'}
                className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 font-normal text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Items Section */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers size={14} className="text-emerald-500" />
                  {language === 'ar' ? 'الأصناف المراد تسويتها' : 'Adjusted Products Grid'}
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-xs rounded-lg transition-all"
                >
                  <Plus size={13} />
                  <span>{language === 'ar' ? 'إضافة صنف' : 'Add Item'}</span>
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-5 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-xs">
                    {language === 'ar' ? 'لم تقم بإضافة أي أصناف للتسوية بعد. انقر على إضافة صنف.' : 'No items added. Click Add Item to begin.'}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full border-collapse text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                        <th className="px-2.5 py-1.5">{language === 'ar' ? 'الصنف *' : 'Product *'}</th>
                        <th className="px-2.5 py-1.5">{language === 'ar' ? 'المستودع *' : 'Warehouse *'}</th>
                        <th className="px-2.5 py-1.5 w-32 text-center">{language === 'ar' ? 'فرق الكمية (+ / -) *' : 'Qty Diff *'}</th>
                        <th className="px-2.5 py-1.5 w-32 text-center">{language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
                        <th className="px-2.5 py-1.5 w-32 text-center">{language === 'ar' ? 'قيمة الفرق' : 'Diff Value'}</th>
                        <th className="px-2.5 py-1.5 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-2.5 py-1">
                            <select
                              required
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none font-bold text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 transition-all appearance-none"
                              value={item.product_id}
                              onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                            >
                              <option value="">{language === 'ar' ? 'اختر الصنف...' : 'Select product...'}</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2.5 py-1">
                            <select
                              required
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none font-bold text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 transition-all appearance-none"
                              value={item.warehouse_id}
                              onChange={(e) => handleItemChange(idx, 'warehouse_id', e.target.value)}
                            >
                              {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2.5 py-1">
                            <input
                              type="number"
                              required
                              step="any"
                              placeholder="+/- Qty"
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none font-bold text-xs text-slate-800 text-center"
                              value={item.quantity || ''}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            />
                          </td>
                          <td className="px-2.5 py-1">
                            <input
                              type="number"
                              required
                              step="any"
                              placeholder="Cost"
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none font-bold text-xs text-slate-800 text-center"
                              value={item.unit_cost === 0 ? '0' : (item.unit_cost || '')}
                              onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                            />
                          </td>
                          <td className="px-2.5 py-1 text-xs font-mono font-bold text-slate-800 text-center">
                            {formatNumber((item.quantity || 0) * (item.unit_cost || 0))}
                          </td>
                          <td className="px-2.5 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div className="pt-2 border-t border-slate-100">
              <AttachmentsManager
                attachments={attachments}
                onChange={setAttachments}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingAdj(null); }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm"
              >
                <Save size={14} />
                <span>{editingAdj ? t('common.save') : (language === 'ar' ? 'حفظ وترحيل' : 'Save & Post')}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Main List / Table Screen */
        <>
          {/* Header controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <Sliders className="text-emerald-500" size={18} />
                {language === 'ar' ? 'تسوية الأصناف والمخزون' : 'Stock Adjustments'}
              </h1>
              <p className="text-slate-500 font-medium mt-0.5 text-[11px]">
                {language === 'ar' 
                  ? 'معالجة فروقات الجرد بالزيادة (+) أو النقصان (-) وتعديل التكاليف مع إنشاء القيود المقابلة' 
                  : 'Record inventory discrepancies positive (+) or negative (-) and adjust values/ledger entries'}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <ExportButtons
                onExportExcel={handleExportExcel}
                onExportPDF={handleExportPDF}
                onPrint={() => printElement(tableRef.current, 'جدول تسويات كميات وأسعار المخزون')}
              />
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg font-bold text-xs shadow-sm hover:shadow hover:scale-[1.01] active:scale-[0.98] transition-all"
              >
                <Plus size={15} />
                <span>{language === 'ar' ? 'إنشاء سند تسوية' : 'Create Stock Adjustment'}</span>
              </button>
            </div>
          </div>

          {/* Filter panel */}
          <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="relative col-span-2">
                <Search className={`absolute ${dir === 'rtl' ? 'right-2.5' : 'left-2.5'} top-2 text-slate-400`} size={15} />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'البحث برقم التسوية أو البيان...' : 'Search by adjustment number or description...'}
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
            </div>
          </div>

          {/* Main Grid / Table Representation */}
          {loading ? (
            <div className="flex items-center justify-center h-40 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold text-xs">{t('common.loading')}</p>
              </div>
            </div>
          ) : adjustments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-white rounded-xl border border-slate-200 shadow-sm text-center space-y-1.5">
              <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
                <Sliders size={20} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-700">{t('common.no_data')}</h3>
                <p className="text-slate-400 text-[11px]">
                  {language === 'ar' ? 'لم يتم تسجيل أي سندات تسوية مخزنية مطابقة.' : 'No stock adjustments found.'}
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
                        onClick={() => handleSort('adjustment_number')}
                        className="px-2 py-1.5 font-bold text-slate-600 uppercase cursor-pointer hover:text-emerald-600 transition-colors text-[11px]"
                      >
                        {language === 'ar' ? 'رقم التسوية' : 'Adj Number'}
                      </th>
                      <th 
                        onClick={() => handleSort('date')}
                        className="px-2 py-1.5 font-bold text-slate-600 uppercase cursor-pointer hover:text-emerald-600 transition-colors text-[11px]"
                      >
                        {language === 'ar' ? 'التاريخ' : 'Date'}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-[11px]">
                        {language === 'ar' ? 'حساب التسوية المقابل' : 'Offset Account'}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-[11px]">
                        {language === 'ar' ? 'الأصناف المتأثرة' : 'Items Affected'}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-[11px]">
                        {language === 'ar' ? 'رقم القيد' : 'Journal Entry'}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-[11px]">
                        {language === 'ar' ? 'البيان / الملاحظات' : 'Description'}
                      </th>
                      <th className="px-2 py-1.5 font-bold text-slate-600 uppercase text-center w-24 text-[11px]">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-2 py-1 font-mono font-bold text-slate-900 text-xs">
                          {adj.adjustment_number}
                        </td>
                        <td className="px-2 py-1 font-medium text-slate-500 whitespace-nowrap text-xs">
                          {formatDate(adj.date)}
                        </td>
                        <td className="px-2 py-1 font-bold text-slate-700 text-xs">
                          {adj.account_name || '-'}
                        </td>
                        <td className="px-2 py-1 font-bold text-slate-700 text-xs">
                          {(adj as any).items_count || (adj.items ? adj.items.length : 1)}
                        </td>
                        <td className="px-2 py-1 font-mono text-slate-700 text-xs">
                          {adj.entry_number ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingViewDoc({ type: 'journal', idOrNumber: adj.entry_number! });
                                setCurrentPage('journal_entries');
                              }}
                              className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/50 transition-all active:scale-95"
                            >
                              {adj.entry_number}
                            </button>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1 font-normal text-slate-500 max-w-[200px] truncate text-xs" title={adj.description}>
                          {adj.description || '-'}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenViewModal(adj)}
                              title={language === 'ar' ? 'عرض السند' : 'View Adjustment'}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(adj)}
                              title={language === 'ar' ? 'تعديل السند' : 'Edit Adjustment'}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteModal(adj.id)}
                              title={language === 'ar' ? 'حذف السند' : 'Delete Adjustment'}
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

              {totalRecords > limit && (
                <div className="p-3 border-t border-slate-100">
                  <PaginationControls
                    page={page}
                    limit={limit}
                    total={totalRecords}
                    onPageChange={setPage}
                    onLimitChange={(l) => { setLimit(l); setPage(1); }}
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
                <h3 className="text-base font-bold text-slate-800">{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</h3>
                <p className="text-slate-400 text-xs">
                  {language === 'ar' 
                    ? 'هل أنت متأكد من رغبتك في حذف هذا المستند وعكس قيوده؟' 
                    : 'Are you sure you want to delete this adjustment?'}
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
