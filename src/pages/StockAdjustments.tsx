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
      filename: `Stock_Adjustment_${adj.document_number}`,
      reportTitle: `${language === 'ar' ? 'تسوية كميات وأسعار المخزون' : 'Stock Adjustment'} - ${adj.document_number}`,
      columns,
      rows
    });
  };

  const handleExportDocExcel = (adj: StockAdjustment) => {
    const items = (adj.items || []).map((item, idx) => ({
      '#': idx + 1,
      [language === 'ar' ? 'رقم المستند' : 'Document Number']: adj.document_number,
      [language === 'ar' ? 'التاريخ' : 'Date']: formatDate(adj.date),
      [language === 'ar' ? 'رمز الصنف' : 'Product Code']: item.product_code || '-',
      [language === 'ar' ? 'اسم الصنف' : 'Product Name']: item.product_name || '-',
      [language === 'ar' ? 'المستودع' : 'Warehouse']: item.warehouse_name || '-',
      [language === 'ar' ? 'الكمية' : 'Quantity']: item.quantity,
      [language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost']: item.unit_cost
    }));

    exportToExcel(items, `Stock_Adjustment_${adj.document_number}`);
  };

  const handleCopyAdj = (adj: StockAdjustment) => {
    setViewAdj(null);
    setEditingAdj(null);
    const today = new Date().toISOString().slice(0, 10);
    setFormData({
      date: today,
      adjustment_type: adj.adjustment_type || 'quantity_and_cost',
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
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            {language === 'ar' ? 'تسوية الأصناف والمخزون' : 'Stock Adjustments'}
          </h1>
          <p className="text-slate-500 font-bold mt-1 text-sm">
            {language === 'ar' 
              ? 'معالجة فروقات الجرد بالزيادة (+) أو النقصان (-) وتعديل التكاليف مع إنشاء القيود المقابلة' 
              : 'Record inventory discrepancies positive (+) or negative (-) and adjust values/ledger entries'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportButtons
            onExportExcel={handleExportExcel}
            onExportPDF={handleExportPDF}
            onPrint={() => printElement(tableRef.current, 'جدول تسويات كميات وأسعار المخزون')}
          />
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all text-sm"
          >
            <Plus size={20} />
            <span>{language === 'ar' ? 'إنشاء سند تسوية' : 'Create Stock Adjustment'}</span>
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white/40 backdrop-blur-xl border border-white/20 p-6 rounded-[2rem] shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative col-span-2">
            <Search className="absolute right-4 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={language === 'ar' ? 'البحث برقم التسوية أو البيان...' : 'Search by adjustment number or description...'}
              className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>

          <div>
            <input
              type="date"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
          </div>

          <div>
            <input
              type="date"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid / Table Representation */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-xl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold">{t('common.loading')}</p>
          </div>
        </div>
      ) : adjustments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-xl text-center space-y-4">
          <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
            <Sliders size={40} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-700">{t('common.no_data')}</h3>
            <p className="text-slate-400 font-bold mt-1 text-sm">
              {language === 'ar' ? 'لم يتم تسجيل أي سندات تسوية مخزنية مطابقة.' : 'No stock adjustments found.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/20 shadow-xl overflow-hidden">
          <div ref={tableRef} className="overflow-x-auto">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100">
                  <th 
                    onClick={() => handleSort('adjustment_number')}
                    className="px-6 py-5 text-sm font-black text-slate-600 uppercase cursor-pointer hover:text-emerald-600 transition-colors"
                  >
                    {language === 'ar' ? 'رقم التسوية' : 'Adj Number'}
                  </th>
                  <th 
                    onClick={() => handleSort('date')}
                    className="px-6 py-5 text-sm font-black text-slate-600 uppercase cursor-pointer hover:text-emerald-600 transition-colors"
                  >
                    {language === 'ar' ? 'التاريخ' : 'Date'}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase">
                    {language === 'ar' ? 'حساب التسوية المقابل' : 'Offset Account'}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase">
                    {language === 'ar' ? 'الأصناف المتأثرة' : 'Items Affected'}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase">
                    {language === 'ar' ? 'رقم القيد' : 'Journal Entry'}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase">
                    {language === 'ar' ? 'البيان / الملاحظات' : 'Description'}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase text-center w-36">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5 text-base font-black text-slate-800 tracking-wider">
                      {adj.adjustment_number}
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-slate-500">
                      {formatDate(adj.date)}
                    </td>
                    <td className="px-6 py-5 text-sm font-black text-slate-700">
                      {adj.account_name || '-'}
                    </td>
                    <td className="px-6 py-5 text-sm font-black text-slate-700">
                      {(adj as any).items_count || (adj.items ? adj.items.length : 1)}
                    </td>
                    <td className="px-6 py-5 text-sm font-black text-slate-700">
                      {adj.entry_number ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingViewDoc({ type: 'journal', idOrNumber: adj.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 transition-all active:scale-95"
                        >
                          {adj.entry_number}
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-slate-500 max-w-[240px] truncate">
                      {adj.description || '-'}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenViewModal(adj)}
                          title={language === 'ar' ? 'عرض السند' : 'View Adjustment'}
                          className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl hover:scale-105 active:scale-95 transition-all text-slate-600"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(adj)}
                          title={language === 'ar' ? 'تعديل السند' : 'Edit Adjustment'}
                          className="p-2.5 bg-sky-50 hover:bg-sky-100 border border-sky-100 rounded-xl hover:scale-105 active:scale-95 transition-all text-sky-600"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(adj.id)}
                          title={language === 'ar' ? 'حذف السند' : 'Delete Adjustment'}
                          className="p-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl hover:scale-105 active:scale-95 transition-all text-rose-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={page}
            limit={limit}
            total={totalRecords}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
          />
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 my-8"
            >
              <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">
                    {editingAdj
                      ? (language === 'ar' ? `تعديل سند تسوية الأصناف: ${editingAdj.adjustment_number}` : `Edit Stock Adjustment: ${editingAdj.adjustment_number}`)
                      : (language === 'ar' ? 'إنشاء سند تسوية الأصناف' : 'Create Stock Adjustment')}
                  </h2>
                  <p className="text-slate-400 font-bold text-xs mt-1">
                    {language === 'ar' ? 'أدخل أصناف التسوية وفروقات الكمية أو التكلفة' : 'Specify adjustment items and changes in quantity or cost'}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-3 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all active:scale-95"
                >
                  <X size={18} className="text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className={`grid grid-cols-1 md:grid-cols-2 ${editingAdj?.entry_number ? 'lg:grid-cols-3' : ''} gap-6`}>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">
                      {language === 'ar' ? 'تاريخ التسوية *' : 'Adjustment Date *'}
                    </label>
                    <div className="relative">
                      <Calendar className="absolute right-4 top-3.5 text-slate-400" size={18} />
                      <input
                        type="date"
                        required
                        className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>
                  </div>

                  {editingAdj?.entry_number && (
                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-2">
                        {language === 'ar' ? 'رقم القيد المرتبط' : 'Linked Journal Entry'}
                      </label>
                      <div className="relative">
                        <Layers className="absolute right-4 top-3.5 text-emerald-500" size={18} />
                        <input
                          readOnly
                          type="text"
                          className="w-full pr-11 pl-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl outline-none font-bold text-emerald-800 text-sm"
                          value={editingAdj.entry_number}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">
                      {language === 'ar' ? 'حساب التسوية المقابل (دائن / مدين) *' : 'Adjustment Counter Account *'}
                    </label>
                    <select
                      required
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm"
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

                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">
                    {language === 'ar' ? 'سبب التسوية / الملاحظات' : 'Reason for Adjustment / Notes'}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={language === 'ar' ? 'مثل: معالجة فروق جرد مستودعي لعام 2026...' : 'e.g., discrepancies resolved from annual warehouse audit...'}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Items Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-lg font-black text-slate-800">
                      {language === 'ar' ? 'الأصناف المراد تسويتها' : 'Adjusted Products Grid'}
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl font-bold transition-all text-xs"
                    >
                      <Plus size={14} />
                      <span>{language === 'ar' ? 'إضافة صنف' : 'Add Item'}</span>
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 font-bold text-sm bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      {language === 'ar' ? 'لم تقم بإضافة أي أصناف للتسوية بعد. انقر على إضافة صنف.' : 'No items added. Click Add Item to begin.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50/75 text-right border-b border-slate-100">
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">{language === 'ar' ? 'الصنف *' : 'Product *'}</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">{language === 'ar' ? 'المستودع *' : 'Warehouse *'}</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase w-36">{language === 'ar' ? 'فرق الكمية (+ / -) *' : 'Qty Difference *'}</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase w-36">{language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase w-36">{language === 'ar' ? 'قيمة الفرق' : 'Difference Value'}</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase text-center w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((item, idx) => (
                            <tr key={idx} className="group">
                              <td className="px-4 py-3">
                                <select
                                  required
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-700 font-bold focus:bg-white text-sm"
                                  value={item.product_id}
                                  onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                                >
                                  <option value="">{language === 'ar' ? 'اختر الصنف...' : 'Select product...'}</option>
                                  {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  required
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-700 font-bold focus:bg-white text-sm"
                                  value={item.warehouse_id}
                                  onChange={(e) => handleItemChange(idx, 'warehouse_id', e.target.value)}
                                >
                                  {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  required
                                  step="any"
                                  placeholder="+/- Qty"
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-700 font-bold text-center focus:bg-white text-sm"
                                  value={item.quantity || ''}
                                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  required
                                  step="any"
                                  placeholder="Cost"
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-700 font-bold text-center focus:bg-white text-sm"
                                  value={item.unit_cost === 0 ? '0' : (item.unit_cost || '')}
                                  onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                                />
                              </td>
                              <td className="px-4 py-3 text-base font-black text-slate-800 text-center">
                                {formatNumber((item.quantity || 0) * (item.unit_cost || 0))}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg hover:scale-105 transition-all"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all text-sm"
                  >
                    <Save size={18} />
                    <span>{editingAdj ? t('common.save') : (language === 'ar' ? 'حفظ وترحيل' : 'Save & Post')}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Details Modal */}
      <AnimatePresence>
        {viewAdj && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 my-8"
            >
              <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-xs">
                      {language === 'ar' ? 'تسوية الأصناف' : 'Stock Adjustment'}
                    </span>
                    <h2 className="text-2xl font-black text-slate-800">
                      {viewAdj.adjustment_number}
                    </h2>
                  </div>
                  <p className="text-slate-400 font-bold text-xs mt-1">
                    {language === 'ar' ? `بتاريخ: ${formatDate(viewAdj.date)}` : `Date: ${formatDate(viewAdj.date)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrint(viewAdj)}
                    className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 font-bold text-xs"
                    title={language === 'ar' ? 'طباعة' : 'Print'}
                  >
                    <Printer size={18} />
                  </button>

                  <button
                    onClick={() => handleCopyAdj(viewAdj)}
                    className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-2xl transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                    title={language === 'ar' ? 'نسخ المستند كمسودة جديدة' : 'Copy Document'}
                  >
                    <Copy size={16} />
                    <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => handleExportDocPDF(viewAdj)}
                    className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-2xl transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                    title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                  >
                    <FileText size={16} />
                    <span>{language === 'ar' ? 'تصدير PDF' : 'Export PDF'}</span>
                  </button>

                  <button
                    onClick={() => handleExportDocExcel(viewAdj)}
                    className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-2xl transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                    title={language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
                  >
                    <FileSpreadsheet size={16} />
                    <span>{language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}</span>
                  </button>

                  <button
                    onClick={() => setViewAdj(null)}
                    className="p-2.5 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 ml-1"
                  >
                    <X size={18} className="text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 font-bold">{language === 'ar' ? 'حساب التسوية المقابل:' : 'Offset Account:'}</span>
                      <span className="text-slate-800 font-black">{viewAdj.account_name || '-'}</span>
                    </div>
                    {viewAdj.entry_number && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-bold">{language === 'ar' ? 'رقم القيد:' : 'Journal Entry:'}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewAdj(null);
                            setPendingViewDoc({ type: 'journal', idOrNumber: viewAdj.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50"
                        >
                          {viewAdj.entry_number}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col text-sm">
                      <span className="text-slate-400 font-bold mb-1">{language === 'ar' ? 'البيان والملاحظات:' : 'Notes:'}</span>
                      <span className="text-slate-700 font-bold leading-relaxed">{viewAdj.description || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-black text-slate-800">{language === 'ar' ? 'أصناف التسوية المحققة' : 'Adjusted Items'}</h3>
                  <div className="overflow-hidden border border-slate-100 rounded-2xl">
                    <table className="w-full border-collapse text-right">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-xs font-black uppercase">
                          <th className="px-5 py-4">{language === 'ar' ? 'رمز الصنف' : 'Code'}</th>
                          <th className="px-5 py-4">{language === 'ar' ? 'اسم الصنف' : 'Product'}</th>
                          <th className="px-5 py-4">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                          <th className="px-5 py-4 w-32 text-center">{language === 'ar' ? 'فرق الكمية' : 'Qty Diff'}</th>
                          <th className="px-5 py-4 w-32 text-center">{language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
                          <th className="px-5 py-4 w-32 text-center">{language === 'ar' ? 'قيمة الفرق' : 'Diff Value'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(viewAdj.items || []).map((item, idx) => (
                          <tr key={idx} className="text-sm font-bold text-slate-700 hover:bg-slate-50/50">
                            <td className="px-5 py-4 font-black">{item.product_code || ''}</td>
                            <td className="px-5 py-4 text-slate-900">{item.product_name || ''}</td>
                            <td className="px-5 py-4 text-slate-600">{item.warehouse_name || ''}</td>
                            <td 
                              className="px-5 py-4 text-center font-black"
                              style={{ color: Number(item.quantity) < 0 ? '#e11d48' : '#10b981' }}
                            >
                              {Number(item.quantity) > 0 ? '+' : ''}{formatNumber(item.quantity)}
                            </td>
                            <td className="px-5 py-4 text-center font-black">{formatNumber(item.unit_cost)}</td>
                            <td 
                              className="px-5 py-4 text-center font-black"
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

                <div className="flex justify-between items-center bg-slate-50 px-6 py-4 rounded-2xl">
                  <span className="text-slate-600 font-black">{language === 'ar' ? 'صافي أثر فروق القيمة:' : 'Net Discrepancy Impact:'}</span>
                  <span 
                    className="text-2xl font-black"
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100"
            >
              <h2 className="text-xl font-black text-slate-800 mb-2">
                {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
              </h2>
              <p className="text-slate-500 font-bold text-sm mb-6 leading-relaxed">
                {language === 'ar' 
                  ? 'هل أنت متأكد من رغبتك في حذف هذا المستند؟ سيقوم النظام بحذف قيد اليومية المرتبط به وعكس العمليات على حركة وتكلفة الأصناف تلقائياً.' 
                  : 'Are you sure you want to delete this adjustment? This will automatically reverse the accounting entries and recalculate item values.'}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all text-sm"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-2xl shadow-lg shadow-rose-500/20 transition-all text-sm"
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
