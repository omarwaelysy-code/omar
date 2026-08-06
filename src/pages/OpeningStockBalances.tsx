import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Warehouse, Product, OpeningStockBalance, OpeningStockItem, Account } from '../types';
import { 
  Search, Plus, Trash2, X, ListPlus, Pencil, 
  Download, Upload, Eye, FileText, History, Printer, FileSpreadsheet, Copy,
  Calendar, Hash, Layers, Save, ChevronRight, ChevronLeft, LayoutGrid, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/dbService';
import { formatNumber, formatDate } from '../utils/formatUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { PaginationControls } from '../components/PaginationControls';
import * as XLSX from 'xlsx';
import { useNavigation } from '../contexts/NavigationContext';
import { exportToPDF as exportToPDFUtil, printElement } from '../utils/pdfUtils';
import { exportToExcel, formatDataForExcel } from '../utils/excelUtils';
import { ExportButtons } from '../components/ExportButtons';


interface ItemInput {
  product_id: string;
  warehouse_id: string;
  quantity: number;
  unit_cost: number;
}

export const OpeningStockBalances: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { t, dir, language } = useLanguage();
  const { setPendingViewDoc, setCurrentPage } = useNavigation();

  // Data states
  const [documents, setDocuments] = useState<OpeningStockBalance[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);

  const handleExportExcelList = () => {
    const headers = {
      'document_number': 'رقم السند',
      'date': 'التاريخ',
      'debit_account_name': 'الحساب المدين',
      'credit_account_name': 'الحساب الدائن',
      'description': 'ملاحظات'
    };
    const formattedData = formatDataForExcel(documents, headers);
    exportToExcel(formattedData, { filename: 'Opening_Stock_Balances', sheetName: 'أرصدة أولية مخزون' });
  };

  const handleExportPDFList = async () => {
    if (tableRef.current) {
      await exportToPDFUtil(tableRef.current, {
        filename: 'Opening_Stock_Balances',
        reportTitle: 'جدول أرصدة أول المدة للمخزون'
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
  const [editingDoc, setEditingDoc] = useState<OpeningStockBalance | null>(null);
  const [viewDoc, setViewDoc] = useState<OpeningStockBalance | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'card'>('table');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    debit_account_id: '',
    credit_account_id: '',
    description: ''
  });
  const [items, setItems] = useState<ItemInput[]>([]);

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

      const unsubDocs = dbService.subscribePaginated('opening_stock_balances', filters, (result: any) => {
        setDocuments(result.data || []);
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
        unsubDocs();
        unsubWarehouses();
        unsubProducts();
        unsubAccounts();
      };
    }
  }, [user, page, limit, sortBy, sortOrder, searchTerm, dateFrom, dateTo]);

  // Reset form
  const resetForm = () => {
    // Attempt to auto-find default accounts
    const invAcc = accounts.find(a => a.name.includes('مخزون') || a.name.toLowerCase().includes('inventory'));
    const opAcc = accounts.find(a => a.name.includes('افتتاحي') || a.name.toLowerCase().includes('opening'));
    
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      debit_account_id: invAcc?.id || '',
      credit_account_id: opAcc?.id || '',
      description: ''
    });
    setItems([]);
    setEditingDoc(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (doc: OpeningStockBalance) => {
    try {
      const fullDoc = await dbService.get<any>('opening_stock_balances', doc.id);
      if (fullDoc) {
        setEditingDoc(fullDoc);
        setFormData({
          date: fullDoc.date ? fullDoc.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          debit_account_id: fullDoc.debit_account_id,
          credit_account_id: fullDoc.credit_account_id,
          description: fullDoc.description || ''
        });
        setItems(
          (fullDoc.items || []).map((item: OpeningStockItem) => ({
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

  const handleOpenViewModal = async (doc: OpeningStockBalance) => {
    try {
      const fullDoc = await dbService.get<any>('opening_stock_balances', doc.id);
      if (fullDoc) {
        setViewDoc(fullDoc);
      } else {
        showNotification(language === 'ar' ? 'عذراً، تعذر العثور على التفاصيل' : 'Failed to retrieve document details', 'error');
      }
    } catch (e: any) {
      showNotification(e.message || 'Error loading document details', 'error');
    }
  };

  const handleOpenDeleteModal = (id: string) => {
    setDocToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      await dbService.delete('opening_stock_balances', docToDelete);
      showNotification(language === 'ar' ? 'تم حذف الرصيد الافتتاحي وتحديث التكلفة والقيد بنجاح' : 'Opening stock deleted and costing/entries updated successfully', 'success');
      setIsDeleteModalOpen(false);
      setDocToDelete(null);
    } catch (e: any) {
      showNotification(e.message || 'Failed to delete opening stock', 'error');
    }
  };

  const handleAddItem = () => {
    setItems([...items, { product_id: '', warehouse_id: warehouses[0]?.id || '', quantity: 1, unit_cost: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemInput, value: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: field === 'product_id' || field === 'warehouse_id' ? value : Number(value)
    };
    setItems(updated);
  };

  // Excel template export (Pre-filled with existing product/warehouse lists to prevent typing errors)
  const handleExportTemplate = () => {
    const wsData = [
      [
        language === 'ar' ? 'رمز الصنف' : 'Product Code',
        language === 'ar' ? 'اسم الصنف' : 'Product Name',
        language === 'ar' ? 'رمز المستودع' : 'Warehouse Code',
        language === 'ar' ? 'اسم المستودع' : 'Warehouse Name',
        language === 'ar' ? 'الكمية' : 'Quantity',
        language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost'
      ]
    ];

    // Pre-fill with available products to guide the user
    products.forEach(p => {
      wsData.push([
        p.code,
        p.name,
        warehouses[0]?.code || '',
        warehouses[0]?.name || '',
        '0',
        '0'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'OpeningStockTemplate.xlsx');
    showNotification(language === 'ar' ? 'تم تصدير قالب الإكسيل بنجاح' : 'Excel template exported successfully', 'success');
  };

  // Excel upload / parsing
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        if (rawData.length <= 1) {
          showNotification(language === 'ar' ? 'ملف الإكسيل فارغ' : 'Excel file is empty', 'error');
          return;
        }

        const headers = rawData[0] as string[];
        const codeIdx = headers.findIndex(h => String(h).includes('رمز الصنف') || String(h).toLowerCase().includes('product code'));
        const whIdx = headers.findIndex(h => String(h).includes('رمز المستودع') || String(h).toLowerCase().includes('warehouse code'));
        const qtyIdx = headers.findIndex(h => String(h).includes('الكمية') || String(h).toLowerCase().includes('quantity'));
        const costIdx = headers.findIndex(h => String(h).includes('تكلفة الوحدة') || String(h).toLowerCase().includes('unit cost'));

        if (codeIdx === -1 || whIdx === -1 || qtyIdx === -1 || costIdx === -1) {
          showNotification(
            language === 'ar' 
              ? 'الرجاء استخدام القالب المعتمد (أعمدة رمز الصنف، رمز المستودع، الكمية، وتكلفة الوحدة مطلوبة)' 
              : 'Please use the approved template with Product Code, Warehouse Code, Quantity, and Unit Cost columns', 
            'error'
          );
          return;
        }

        const importedItems: ItemInput[] = [];
        const warnings: string[] = [];

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          const pCode = String(row[codeIdx] || '').trim();
          const wCode = String(row[whIdx] || '').trim();
          const qtyVal = parseFloat(row[qtyIdx] || '0');
          const costVal = parseFloat(row[costIdx] || '0');

          if (!pCode) continue; // Skip blank lines

          const prod = products.find(p => p.code === pCode);
          const wh = warehouses.find(w => w.code === wCode);

          if (!prod) {
            warnings.push(language === 'ar' ? `رمز الصنف "${pCode}" غير موجود` : `Product code "${pCode}" not found`);
            continue;
          }

          if (!wh) {
            warnings.push(language === 'ar' ? `رمز المستودع "${wCode}" غير موجود` : `Warehouse code "${wCode}" not found`);
            continue;
          }

          if (qtyVal <= 0) {
            continue; // Skip items with zero or negative quantity for opening stocks
          }

          importedItems.push({
            product_id: prod.id,
            warehouse_id: wh.id,
            quantity: qtyVal,
            unit_cost: isNaN(costVal) || costVal < 0 ? 0 : costVal
          });
        }

        if (warnings.length > 0) {
          showNotification(
            language === 'ar'
              ? `تم الاستيراد مع تجاهل بعض الأخطاء: ${warnings.slice(0, 3).join(', ')}...`
              : `Imported with some skipped errors: ${warnings.slice(0, 3).join(', ')}...`,
            'warning'
          );
        }

        if (importedItems.length > 0) {
          setItems(importedItems);
          setIsModalOpen(true);
          showNotification(
            language === 'ar'
              ? `تم استيراد عدد ${importedItems.length} أصناف من إكسيل بنجاح`
              : `Successfully imported ${importedItems.length} items from Excel`,
            'success'
          );
        } else {
          showNotification(language === 'ar' ? 'لم يتم العثور على أي كميات صالحة للاستيراد' : 'No valid quantities found to import', 'error');
        }

      } catch (err: any) {
        showNotification(err.message || 'Error reading Excel file', 'error');
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input value so same file can be uploaded again
    if (e.target) e.target.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.debit_account_id || !formData.credit_account_id) {
      showNotification(language === 'ar' ? 'الحساب المدين والحساب الدائن مطلوبان' : 'Debit and Credit accounts are required', 'error');
      return;
    }

    if (items.length === 0) {
      showNotification(language === 'ar' ? 'يجب إضافة صنف واحد على الأقل' : 'At least one item is required', 'error');
      return;
    }

    const invalidItem = items.find(item => !item.product_id || !item.warehouse_id || item.quantity <= 0 || item.unit_cost < 0);
    if (invalidItem) {
      showNotification(
        language === 'ar' 
          ? 'الرجاء التحقق من صحة الأصناف (الكميات يجب أن تكون أكبر من 0 والتكلفة لا تقل عن 0)' 
          : 'Please check item details (Quantities must be > 0 and costs must be >= 0)', 
        'error'
      );
      return;
    }

    const debitAcc = accounts.find(a => a.id === formData.debit_account_id);
    const creditAcc = accounts.find(a => a.id === formData.credit_account_id);

    const payload = {
      ...formData,
      debit_account_name: debitAcc?.name || '',
      credit_account_name: creditAcc?.name || '',
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
      if (editingDoc) {
        await dbService.update('opening_stock_balances', editingDoc.id, payload);
        showNotification(language === 'ar' ? 'تم تعديل الرصيد الافتتاحي وتحديث القيود والتكلفة بنجاح' : 'Opening stock updated successfully', 'success');
      } else {
        await dbService.create('opening_stock_balances', payload);
        showNotification(language === 'ar' ? 'تم حفظ رصيد أول المدة وإنشاء القيد وتحديث تكلفة الأصناف بنجاح' : 'Opening stock balance saved successfully', 'success');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (e: any) {
      showNotification(e.message || 'Failed to save opening stock', 'error');
    }
  };

  const handleSort = (field: string) => {
    const isAsc = sortBy === field && sortOrder === 'ASC';
    setSortOrder(isAsc ? 'DESC' : 'ASC');
    setSortBy(field);
    setPage(1);
  };

  const handlePrint = (doc: OpeningStockBalance) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalVal = (doc.items || []).reduce((sum, item) => sum + Number(item.total_cost || 0), 0);

    printWindow.document.write(`
      <html>
        <head>
          <title>${language === 'ar' ? `رصيد أول المدة - ${doc.document_number}` : `Opening Stock - ${doc.document_number}`}</title>
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
            .total { text-align: ${dir === 'rtl' ? 'left' : 'right'}; font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${language === 'ar' ? 'سند رصيد أول المدة للمخزون' : 'Opening Stock Balance Receipt'}</div>
            <div><strong>${doc.document_number}</strong></div>
          </div>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">${language === 'ar' ? 'التاريخ:' : 'Date:'}</span> ${formatDate(doc.date)}</div>
            <div class="info-item"><span class="info-label">${language === 'ar' ? 'الحساب المدين:' : 'Debit Account:'}</span> ${doc.debit_account_name || '-'}</div>
            <div class="info-item"><span class="info-label">${language === 'ar' ? 'الحساب الدائن:' : 'Credit Account:'}</span> ${doc.credit_account_name || '-'}</div>
            <div class="info-item"><span class="info-label">${language === 'ar' ? 'البيان:' : 'Notes:'}</span> ${doc.description || '-'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>${language === 'ar' ? 'رمز الصنف' : 'Code'}</th>
                <th>${language === 'ar' ? 'اسم الصنف' : 'Product'}</th>
                <th>${language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                <th>${language === 'ar' ? 'الكمية' : 'Qty'}</th>
                <th>${language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
                <th>${language === 'ar' ? 'الإجمالي' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>
              ${(doc.items || []).map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.product_code || ''}</td>
                  <td>${item.product_name || ''}</td>
                  <td>${item.warehouse_name || ''}</td>
                  <td>${formatNumber(item.quantity)}</td>
                  <td>${formatNumber(item.unit_cost)}</td>
                  <td>${formatNumber(item.total_cost || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">
            ${language === 'ar' ? 'إجمالي القيمة الافتتاحية:' : 'Total Opening Value:'} ${formatNumber(totalVal)}
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportDocPDF = (doc: OpeningStockBalance) => {
    const columns = [
      { id: 'product_code', label: language === 'ar' ? 'رمز الصنف' : 'Code', width: 20 },
      { id: 'product_name', label: language === 'ar' ? 'اسم الصنف' : 'Product', width: 35 },
      { id: 'warehouse_name', label: language === 'ar' ? 'المستودع' : 'Warehouse', width: 20 },
      { id: 'quantity', label: language === 'ar' ? 'الكمية' : 'Qty', width: 10 },
      { id: 'unit_cost', label: language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost', width: 15 },
      { id: 'total_cost', label: language === 'ar' ? 'الإجمالي' : 'Total', width: 15 }
    ];

    const rows = (doc.items || []).map(item => ({
      product_code: item.product_code || '-',
      product_name: item.product_name || '-',
      warehouse_name: item.warehouse_name || '-',
      quantity: formatNumber(item.quantity),
      unit_cost: formatNumber(item.unit_cost),
      total_cost: formatNumber(item.total_cost)
    }));

    const totalVal = (doc.items || []).reduce((sum, i) => sum + Number(i.total_cost || 0), 0);

    exportToPDFUtil(tableRef.current || document.body, {
      filename: `Opening_Stock_${doc.document_number}`,
      reportTitle: `${language === 'ar' ? 'سند رصيد أول المدة للمخزون' : 'Opening Stock Balance Receipt'} - ${doc.document_number}`,
      columns,
      rows,
      totals: { total_cost: formatNumber(totalVal) }
    });
  };

  const handleExportDocExcel = (doc: OpeningStockBalance) => {
    const items = (doc.items || []).map((item, idx) => ({
      '#': idx + 1,
      [language === 'ar' ? 'رقم المستند' : 'Document Number']: doc.document_number,
      [language === 'ar' ? 'التاريخ' : 'Date']: formatDate(doc.date),
      [language === 'ar' ? 'رمز الصنف' : 'Product Code']: item.product_code || '-',
      [language === 'ar' ? 'اسم الصنف' : 'Product Name']: item.product_name || '-',
      [language === 'ar' ? 'المستودع' : 'Warehouse']: item.warehouse_name || '-',
      [language === 'ar' ? 'الكمية' : 'Quantity']: item.quantity,
      [language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost']: item.unit_cost,
      [language === 'ar' ? 'الإجمالي' : 'Total']: item.total_cost
    }));

    exportToExcel(items, `Opening_Stock_${doc.document_number}`);
  };

  const handleCopyDoc = (doc: OpeningStockBalance) => {
    setViewDoc(null);
    setEditingDoc(null);
    const today = new Date().toISOString().slice(0, 10);
    setFormData({
      date: today,
      debit_account_id: doc.debit_account_id || '',
      credit_account_id: doc.credit_account_id || '',
      description: doc.description ? `${doc.description} (${language === 'ar' ? 'نسخة' : 'Copy'})` : ''
    });
    setItems((doc.items || []).map(item => ({
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
      {/* Hidden file input for Excel upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportExcel} 
        accept=".xlsx, .xls" 
        className="hidden" 
      />

      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            {language === 'ar' ? 'أرصدة أول المدة للمخزون' : 'Opening Stock Balances'}
          </h1>
          <p className="text-slate-500 font-bold mt-1 text-sm">
            {language === 'ar' 
              ? 'إدخال الكميات والتكاليف الافتتاحية للمستودعات وإنشاء القيود المقابلة تلقائياً' 
              : 'Initialize inventory values and automatically post the balancing journal entries'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportTemplate}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-100 hover:border-slate-200 rounded-2xl shadow-sm text-slate-700 font-black hover:bg-slate-50 transition-all text-sm"
          >
            <Download size={18} className="text-slate-500" />
            <span>{language === 'ar' ? 'تصدير قالب إكسيل' : 'Export Excel Template'}</span>
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-100 hover:border-slate-200 rounded-2xl shadow-sm text-slate-700 font-black hover:bg-slate-50 transition-all text-sm"
          >
            <Upload size={18} className="text-slate-500" />
            <span>{language === 'ar' ? 'استيراد من إكسيل' : 'Import Excel'}</span>
          </button>

          <ExportButtons
            onExportExcel={handleExportExcelList}
            onExportPDF={handleExportPDFList}
            onPrint={() => printElement(tableRef.current, 'جدول أرصدة أول المدة للمخزون')}
          />

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all text-sm"
          >
            <Plus size={20} />
            <span>{language === 'ar' ? 'إضافة رصيد أول مدة' : 'Add Opening Stock'}</span>
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
              placeholder={language === 'ar' ? 'البحث برقم السند أو البيان...' : 'Search by document number or description...'}
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
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-xl text-center space-y-4">
          <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
            <ListPlus size={40} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-700">{t('common.no_data')}</h3>
            <p className="text-slate-400 font-bold mt-1 text-sm">
              {language === 'ar' ? 'لم يتم تسجيل أي سندات رصيد أول مدة حتى الآن.' : 'No opening stock documents found.'}
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
                    onClick={() => handleSort('document_number')}
                    className="px-6 py-5 text-sm font-black text-slate-600 uppercase cursor-pointer hover:text-emerald-600 transition-colors"
                  >
                    {language === 'ar' ? 'رقم السند' : 'Doc Number'}
                  </th>
                  <th 
                    onClick={() => handleSort('date')}
                    className="px-6 py-5 text-sm font-black text-slate-600 uppercase cursor-pointer hover:text-emerald-600 transition-colors"
                  >
                    {language === 'ar' ? 'التاريخ' : 'Date'}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase">
                    {language === 'ar' ? 'الحساب المدين' : 'Debit Account'}
                  </th>
                  <th className="px-6 py-5 text-sm font-black text-slate-600 uppercase">
                    {language === 'ar' ? 'الحساب الدائن' : 'Credit Account'}
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
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5 text-base font-black text-slate-800 tracking-wider">
                      {doc.document_number}
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-slate-500">
                      {formatDate(doc.date)}
                    </td>
                    <td className="px-6 py-5 text-sm font-black text-slate-700">
                      {doc.debit_account_name || '-'}
                    </td>
                    <td className="px-6 py-5 text-sm font-black text-slate-700">
                      {doc.credit_account_name || '-'}
                    </td>
                    <td className="px-6 py-5 text-sm font-black text-slate-700">
                      {doc.entry_number ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingViewDoc({ type: 'journal', idOrNumber: doc.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100/50 transition-all active:scale-95"
                        >
                          {doc.entry_number}
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm font-bold text-slate-500 max-w-[240px] truncate">
                      {doc.description || '-'}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenViewModal(doc)}
                          title={language === 'ar' ? 'عرض السند' : 'View Document'}
                          className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl hover:scale-105 active:scale-95 transition-all text-slate-600"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(doc)}
                          title={language === 'ar' ? 'تعديل السند' : 'Edit Document'}
                          className="p-2.5 bg-sky-50 hover:bg-sky-100 border border-sky-100 rounded-xl hover:scale-105 active:scale-95 transition-all text-sky-600"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(doc.id)}
                          title={language === 'ar' ? 'حذف السند' : 'Delete Document'}
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

      {/* Write/Edit Modal */}
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
                    {editingDoc 
                      ? (language === 'ar' ? `تعديل سند رصيد أول مدة: ${editingDoc.document_number}` : `Edit Opening Stock: ${editingDoc.document_number}`)
                      : (language === 'ar' ? 'إضافة رصيد أول مدة للمخازن' : 'Add Opening Stock Balance')}
                  </h2>
                  <p className="text-slate-400 font-bold text-xs mt-1">
                    {language === 'ar' ? 'قم بإدخال الحسابات والأصناف الملحقة بالسند الافتتاحي' : 'Enter accounts and products for the opening document'}
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
                <div className={`grid grid-cols-1 md:grid-cols-3 ${editingDoc?.entry_number ? 'lg:grid-cols-4' : ''} gap-6`}>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">
                      {language === 'ar' ? 'تاريخ السند *' : 'Document Date *'}
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

                  {editingDoc?.entry_number && (
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
                          value={editingDoc.entry_number}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">
                      {language === 'ar' ? 'الحساب المدين (المخزون) *' : 'Debit Account (Inventory) *'}
                    </label>
                    <select
                      required
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm"
                      value={formData.debit_account_id}
                      onChange={(e) => setFormData({ ...formData, debit_account_id: e.target.value })}
                    >
                      <option value="">{language === 'ar' ? 'اختر حساب المخزون المدين...' : 'Select inventory debit account...'}</option>
                      {accounts.filter(a => ['inventory', 'raw_materials', 'work_in_progress', 'finished_goods'].includes(a.account_usage || '')).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">
                      {language === 'ar' ? 'الحساب الدائن (مقابل أول المدة) *' : 'Credit Account (Opening Capital) *'}
                    </label>
                    <select
                      required
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm"
                      value={formData.credit_account_id}
                      onChange={(e) => setFormData({ ...formData, credit_account_id: e.target.value })}
                    >
                      <option value="">{language === 'ar' ? 'اختر حساب رأس المال/المقابل الدائن...' : 'Select credit capital account...'}</option>
                      {accounts.filter(a => ['opening_balance', 'capital', 'equity', 'retained_earnings', 'other'].includes(a.account_usage || '')).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">
                    {language === 'ar' ? 'البيان والملاحظات' : 'Description / Notes'}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={language === 'ar' ? 'ملاحظات إضافية حول القيد الافتتاحي...' : 'Additional notes regarding this opening entry...'}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-slate-700 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Items Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-lg font-black text-slate-800">
                      {language === 'ar' ? 'تفاصيل الأصناف والكميات' : 'Product Items & Initial Stock'}
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
                      {language === 'ar' ? 'لم تقم بإضافة أي أصناف بعد. يمكنك إضافة أصناف يدوياً أو استيرادها عبر ملف إكسيل.' : 'No items added. Add items manually or upload an Excel sheet.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50/75 text-right border-b border-slate-100">
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">{language === 'ar' ? 'الصنف *' : 'Product *'}</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">{language === 'ar' ? 'المستودع *' : 'Warehouse *'}</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase w-32">{language === 'ar' ? 'الكمية *' : 'Quantity *'}</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase w-36">{language === 'ar' ? 'تكلفة الوحدة *' : 'Unit Cost *'}</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase w-36">{language === 'ar' ? 'الإجمالي' : 'Total Cost'}</th>
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
                                  min="0.0001"
                                  step="any"
                                  placeholder="0.0"
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-700 font-bold text-center focus:bg-white text-sm"
                                  value={item.quantity || ''}
                                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  required
                                  min="0"
                                  step="any"
                                  placeholder="0.0"
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
                    <span>{editingDoc ? t('common.save') : (language === 'ar' ? 'حفظ وإدراج' : 'Save & Post')}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Details Modal */}
      <AnimatePresence>
        {viewDoc && (
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
                      {language === 'ar' ? 'رصيد أول المدة للمخزون' : 'Opening Stock'}
                    </span>
                    <h2 className="text-2xl font-black text-slate-800">
                      {viewDoc.document_number}
                    </h2>
                  </div>
                  <p className="text-slate-400 font-bold text-xs mt-1">
                    {language === 'ar' ? `بتاريخ: ${formatDate(viewDoc.date)}` : `Date: ${formatDate(viewDoc.date)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrint(viewDoc)}
                    className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 font-bold text-xs"
                    title={language === 'ar' ? 'طباعة' : 'Print'}
                  >
                    <Printer size={18} />
                  </button>

                  <button
                    onClick={() => handleCopyDoc(viewDoc)}
                    className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-2xl transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                    title={language === 'ar' ? 'نسخ المستند كمسودة جديدة' : 'Copy Document'}
                  >
                    <Copy size={16} />
                    <span>{language === 'ar' ? 'نسخ' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={() => handleExportDocPDF(viewDoc)}
                    className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-2xl transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                    title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                  >
                    <FileText size={16} />
                    <span>{language === 'ar' ? 'تصدير PDF' : 'Export PDF'}</span>
                  </button>

                  <button
                    onClick={() => handleExportDocExcel(viewDoc)}
                    className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-2xl transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                    title={language === 'ar' ? 'تصدير Excel' : 'Export Excel'}
                  >
                    <FileSpreadsheet size={16} />
                    <span>{language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}</span>
                  </button>

                  <button
                    onClick={() => setViewDoc(null)}
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
                      <span className="text-slate-400 font-bold">{language === 'ar' ? 'الحساب المدين:' : 'Debit Account:'}</span>
                      <span className="text-slate-800 font-black">{viewDoc.debit_account_name || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 font-bold">{language === 'ar' ? 'الحساب الدائن:' : 'Credit Account:'}</span>
                      <span className="text-slate-800 font-black">{viewDoc.credit_account_name || '-'}</span>
                    </div>
                    {viewDoc.entry_number && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-bold">{language === 'ar' ? 'رقم القيد:' : 'Journal Entry:'}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewDoc(null);
                            setPendingViewDoc({ type: 'journal', idOrNumber: viewDoc.entry_number! });
                            setCurrentPage('journal_entries');
                          }}
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/50"
                        >
                          {viewDoc.entry_number}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col text-sm">
                      <span className="text-slate-400 font-bold mb-1">{language === 'ar' ? 'البيان والملاحظات:' : 'Notes:'}</span>
                      <span className="text-slate-700 font-bold leading-relaxed">{viewDoc.description || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-black text-slate-800">{language === 'ar' ? 'تفاصيل الأصناف المدرجة' : 'Item Details'}</h3>
                  <div className="overflow-hidden border border-slate-100 rounded-2xl">
                    <table className="w-full border-collapse text-right">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-xs font-black uppercase">
                          <th className="px-5 py-4">{language === 'ar' ? 'رمز الصنف' : 'Code'}</th>
                          <th className="px-5 py-4">{language === 'ar' ? 'اسم الصنف' : 'Product'}</th>
                          <th className="px-5 py-4">{language === 'ar' ? 'المستودع' : 'Warehouse'}</th>
                          <th className="px-5 py-4 w-28">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                          <th className="px-5 py-4 w-32">{language === 'ar' ? 'تكلفة الوحدة' : 'Unit Cost'}</th>
                          <th className="px-5 py-4 w-32">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(viewDoc.items || []).map((item, idx) => (
                          <tr key={idx} className="text-sm font-bold text-slate-700 hover:bg-slate-50/50">
                            <td className="px-5 py-4 font-black">{item.product_code || ''}</td>
                            <td className="px-5 py-4 text-slate-900">{item.product_name || ''}</td>
                            <td className="px-5 py-4 text-slate-600">{item.warehouse_name || ''}</td>
                            <td className="px-5 py-4 font-black">{formatNumber(item.quantity)}</td>
                            <td className="px-5 py-4 font-black">{formatNumber(item.unit_cost)}</td>
                            <td className="px-5 py-4 font-black text-slate-900">{formatNumber(item.total_cost || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-50 px-6 py-4 rounded-2xl">
                  <span className="text-slate-600 font-black">{language === 'ar' ? 'إجمالي قيمة السند:' : 'Total Value:'}</span>
                  <span className="text-2xl font-black text-emerald-600">
                    {formatNumber(
                      (viewDoc.items || []).reduce((sum, item) => sum + Number(item.total_cost || 0), 0)
                    )}
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
                  ? 'هل أنت متأكد من رغبتك في حذف هذا الرصيد الافتتاحي؟ سيؤدي ذلك أيضاً لحذف القيد المحاسبي المرتبط به بالكامل وإعادة حساب متوسط تكلفة الأصناف.' 
                  : 'Are you sure you want to delete this document? This will permanently delete the associated journal entry and recalculate item costs.'}
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
