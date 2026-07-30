import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/dbService';
import { Search, Calendar, Eye, Download, Printer, RefreshCw, ChevronDown, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatNumber, formatMoney, formatDate } from '../utils/formatUtils';
import { PaginationControls } from '../components/PaginationControls';
import { useNavigation } from '../contexts/NavigationContext';
import { exportToExcel } from '../utils/excelUtils';

interface DetailedLine {
  line_id: string;
  debit: number;
  credit: number;
  line_description: string;
  account_id: string;
  account_name: string;
  customer_id: string;
  supplier_id: string;
  customer_name: string;
  supplier_name: string;
  sub_account_id: string;
  sub_account_type: string;
  journal_entry_id: string;
  entry_number: string;
  date: string;
  entry_description: string;
  reference_type: string;
  reference_number: string;
  reference_id: string;
  currency_id: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  exchange_rate: number | null;
  foreign_amount: number | null;
  operation_id: string | null;
  operation_number: string | null;
  department_id: string | null;
  department_name: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  cost_center_code: string | null;
  product_names: string | null;
  parent_account_name?: string | null;
  account_type_name?: string | null;
  account_code?: string | null;
}

/**
 * Groups lines into pages such that no journal entry (journal_entry_id)
 * is split across page boundaries.
 * If adding a journal entry to the current page would exceed targetLimit 
 * and the page is not empty, the entry is shifted to the next page.
 */
function buildUnsplitPages<T extends { journal_entry_id: string }>(
  lines: T[],
  targetLimit: number
): T[][] {
  if (!lines || lines.length === 0) return [];
  if (targetLimit >= 1000000) return [lines];

  const entryGroups: T[][] = [];
  let currentGroup: T[] = [];

  for (const line of lines) {
    if (currentGroup.length === 0) {
      currentGroup.push(line);
    } else if (currentGroup[0].journal_entry_id === line.journal_entry_id) {
      currentGroup.push(line);
    } else {
      entryGroups.push(currentGroup);
      currentGroup = [line];
    }
  }
  if (currentGroup.length > 0) {
    entryGroups.push(currentGroup);
  }

  const pages: T[][] = [];
  let currentPage: T[] = [];

  for (const group of entryGroups) {
    if (currentPage.length > 0 && currentPage.length + group.length > targetLimit) {
      pages.push(currentPage);
      currentPage = [...group];
    } else {
      currentPage.push(...group);
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

export const DetailedJournalEntries: React.FC = () => {
  const { user } = useAuth();
  const { dir, language } = useLanguage();
  const { setPendingViewDoc, setCurrentPage } = useNavigation();

  const [loading, setLoading] = useState(true);
  const [rawLines, setRawLines] = useState<DetailedLine[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [summary, setSummary] = useState({ total_debit: 0, total_credit: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [preset, setPreset] = useState('this_month');

  // Build unsplit pages: Ensure no journal entry is broken across page boundaries
  const pages = React.useMemo(() => buildUnsplitPages(rawLines, limit), [rawLines, limit]);
  const totalPages = pages.length || 1;
  const data = pages[page - 1] || [];
  const startRowIndex = React.useMemo(() => {
    return pages.slice(0, page - 1).reduce((sum, p) => sum + p.length, 0);
  }, [pages, page]);

  // Column definitions with visibility state
  const [columns, setColumns] = useState([
    { id: 'debit', labelAr: 'المدين', labelEn: 'Debit', visible: true },
    { id: 'credit', labelAr: 'الدائن', labelEn: 'Credit', visible: true },
    { id: 'date', labelAr: 'التاريخ', labelEn: 'Date', visible: true },
    { id: 'entry_number', labelAr: 'رقم القيد', labelEn: 'Entry No', visible: true },
    { id: 'account_name', labelAr: 'الحساب الرئيسي', labelEn: 'Main Account', visible: true },
    { id: 'account_code', labelAr: 'كود الحساب', labelEn: 'Account Code', visible: true },
    { id: 'account_type', labelAr: 'نوع الحساب', labelEn: 'Account Type', visible: true },
    { id: 'reference_type', labelAr: 'نوع الحركة', labelEn: 'Doc Type', visible: true },
    { id: 'reference_number', labelAr: 'رقم الحركة', labelEn: 'Doc Number', visible: true },
    { id: 'sub_account', labelAr: 'الحساب الفرعي', labelEn: 'Sub Account', visible: true },
    { id: 'client_supplier', labelAr: 'عميل - مورد', labelEn: 'Customer - Supplier', visible: true },
    { id: 'product_names', labelAr: 'صنف', labelEn: 'Product / Item', visible: true },
    { id: 'currency', labelAr: 'العملة', labelEn: 'Currency', visible: true },
    { id: 'foreign_amount', labelAr: 'قيمة العملة الأجنبية', labelEn: 'FC Amount', visible: true },
    { id: 'entry_desc', labelAr: 'بيان القيد', labelEn: 'Entry Description', visible: true },
    { id: 'line_desc', labelAr: 'بيان السطر', labelEn: 'Line Description', visible: true },
    { id: 'operation_number', labelAr: 'رقم العملية', labelEn: 'Operation No', visible: false },
    { id: 'department', labelAr: 'الإدارة', labelEn: 'Department', visible: false },
    { id: 'cost_center', labelAr: 'مركز التكلفة', labelEn: 'Cost Center', visible: false },
  ]);

  // Column Width Resizing State and Handler
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('detailed_je_column_widths');
    return saved ? JSON.parse(saved) : {};
  });

  const activeResizerRef = useRef<{ colId: string; edge: 'left' | 'right'; startX: number; startWidth: number } | null>(null);

  // Sync scrollbar refs
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableContainerRef.current) {
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    const updateWidth = () => {
      if (tableRef.current) {
        setTableWidth(tableRef.current.scrollWidth);
      }
    };
    const timer = setTimeout(updateWidth, 100);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [data, columns, loading]);

  const startResize = (e: React.MouseEvent, colId: string, edge: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    const thElement = (e.target as HTMLElement).parentElement;
    if (!thElement) return;

    activeResizerRef.current = {
      colId,
      edge,
      startX: e.clientX,
      startWidth: thElement.offsetWidth,
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!activeResizerRef.current) return;
    const { colId, edge, startX, startWidth } = activeResizerRef.current;
    const delta = edge === 'right' ? (e.clientX - startX) : (startX - e.clientX);
    const newWidth = Math.max(50, startWidth + delta);

    setColumnWidths(prev => {
      const updated = { ...prev, [colId]: newWidth };
      localStorage.setItem('detailed_je_column_widths', JSON.stringify(updated));
      return updated;
    });
  };

  const handleResizeEnd = () => {
    activeResizerRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  const handlePresetChange = (selectedPreset: string) => {
    setPreset(selectedPreset);
    const now = new Date();
    let start = '';
    let end = '';

    switch (selectedPreset) {
      case 'today':
        start = now.toISOString().split('T')[0];
        end = start;
        break;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        start = yesterday.toISOString().split('T')[0];
        end = start;
        break;
      }
      case 'this_week': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const startOfWeek = new Date(now.setDate(diff));
        start = startOfWeek.toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      }
      case 'last_week': {
        const day = now.getDay();
        const diff = now.getDate() - day - 6; // start of last week
        const startOfLastWeek = new Date(now.setDate(diff));
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        start = startOfLastWeek.toISOString().split('T')[0];
        end = endOfLastWeek.toISOString().split('T')[0];
        break;
      }
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'this_quarter': {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      }
      case 'last_quarter': {
        const q = Math.floor(now.getMonth() / 3) - 1;
        const year = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const quarter = q < 0 ? 3 : q;
        start = new Date(year, quarter * 3, 1).toISOString().split('T')[0];
        end = new Date(year, (quarter + 1) * 3, 0).toISOString().split('T')[0];
        break;
      }
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      case 'last_year':
        start = new Date(now.getFullYear() - 1, 0, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear() - 1, 11, 31).toISOString().split('T')[0];
        break;
      case 'all':
        start = '';
        end = '';
        break;
      default:
        return;
    }
    setDateRange({ start, end });
    setPage(1);
  };

  // Columns state moved to top

  // Load columns visibility from localStorage if exists
  useEffect(() => {
    const saved = localStorage.getItem('detailed_je_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setColumns(cols => cols.map(c => ({
          ...c,
          visible: parsed[c.id] !== undefined ? parsed[c.id] : c.visible
        })));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveColumnVisibility = (updatedCols: typeof columns) => {
    const state = updatedCols.reduce((acc, col) => {
      acc[col.id] = col.visible;
      return acc;
    }, {} as Record<string, boolean>);
    localStorage.setItem('detailed_je_columns', JSON.stringify(state));
  };

  const toggleColumn = (id: string) => {
    const updated = columns.map(c => c.id === id ? { ...c, visible: !c.visible } : c);
    setColumns(updated);
    saveColumnVisibility(updated);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const options = {
        company_id: user.company_id,
        _page: 1,
        _limit: 1000000,
        _search: searchTerm,
        date_from: dateRange.start,
        date_to: dateRange.end
      };
      const result = await dbService.listPaginated<DetailedLine>('detailed-journal-entries', options);
      setRawLines(result.data || []);
      setTotalRecords(result.total || (result.data ? result.data.length : 0));
      setSummary(result.summary || { total_debit: 0, total_credit: 0 });
    } catch (error) {
      console.error('Error loading detailed entries', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, searchTerm, dateRange]);

  const handleTransactionClick = (type: string | null | undefined, reference: string | null | undefined) => {
    if (!reference || reference === '-' || reference === '') return;
    
    let normType = type;
    if (!normType) {
      if (reference.startsWith('INV-')) normType = 'invoice';
      else if (reference.startsWith('PINV-')) normType = 'purchase_invoice';
      else if (reference.startsWith('RCT-')) normType = 'receipt';
      else if (reference.startsWith('PAY-')) normType = 'payment_voucher';
      else if (reference.startsWith('RET-')) normType = 'return';
      else if (reference.startsWith('PRET-')) normType = 'purchase_return';
      else normType = 'manual';
    }
    
    if (normType === 'invoice') {
      setPendingViewDoc({ type: 'invoice', idOrNumber: reference });
      setCurrentPage('invoices');
    } else if (normType === 'purchase_invoice') {
      setPendingViewDoc({ type: 'purchase_invoice', idOrNumber: reference });
      setCurrentPage('purchase_invoices');
    } else if (normType === 'receipt' || normType === 'receipt_voucher') {
      setPendingViewDoc({ type: 'receipt', idOrNumber: reference });
      setCurrentPage('receipts');
    } else if (normType === 'payment_voucher' || normType === 'payment') {
      setPendingViewDoc({ type: 'payment_voucher', idOrNumber: reference });
      setCurrentPage('payment_vouchers');
    } else if (normType === 'return') {
      setPendingViewDoc({ type: 'return', idOrNumber: reference });
      setCurrentPage('returns');
    } else if (normType === 'purchase_return') {
      setPendingViewDoc({ type: 'purchase_return', idOrNumber: reference });
      setCurrentPage('purchase_returns');
    } else {
      setPendingViewDoc({ type: 'manual', idOrNumber: reference });
      setCurrentPage('journal_entries');
    }
  };

  const getDocTypeLabel = (type: string | null) => {
    if (!type) return language === 'ar' ? 'قيد يدوي' : 'Manual Entry';
    switch (type.toLowerCase()) {
      case 'manual': return language === 'ar' ? 'قيد يدوي' : 'Manual Entry';
      case 'opening_balance': return language === 'ar' ? 'رصيد أول المدة' : 'Opening Balance';
      case 'opening_stock_balance': return language === 'ar' ? 'رصيد أول المدة للمخزون' : 'Opening Stock Balance';
      case 'invoice': return language === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice';
      case 'purchase_invoice': return language === 'ar' ? 'فاتورة مشتريات' : 'Purchase Invoice';
      case 'receipt':
      case 'receipt_voucher': return language === 'ar' ? 'سند قبض' : 'Receipt Voucher';
      case 'payment':
      case 'payment_voucher': return language === 'ar' ? 'سند صرف' : 'Payment Voucher';
      case 'return': return language === 'ar' ? 'مرتجع مبيعات' : 'Sales Return';
      case 'purchase_return': return language === 'ar' ? 'مرتجع مشتريات' : 'Purchase Return';
      case 'transfer':
      case 'cash_transfer': return language === 'ar' ? 'تحويل خزينة' : 'Cash Transfer';
      case 'opening_stock': return language === 'ar' ? 'أول الميزانية مخزون' : 'Opening Stock';
      case 'stock_adjustment': return language === 'ar' ? 'تسوية مخزنية' : 'Stock Adjustment';
      case 'warehouse_transfer': return language === 'ar' ? 'تحويل مخزني' : 'Warehouse Transfer';
      default: return type;
    }
  };

  const handleExportExcel = () => {
    const visibleCols = columns.filter(c => c.visible);
    const headers = visibleCols.map(c => language === 'ar' ? c.labelAr : c.labelEn);
    
    const rows = data.map(row => {
      const entry: Record<string, any> = {};
      visibleCols.forEach(col => {
        const header = language === 'ar' ? col.labelAr : col.labelEn;
        if (col.id === 'debit') entry[header] = row.debit;
        else if (col.id === 'credit') entry[header] = row.credit;
        else if (col.id === 'date') entry[header] = formatDate(row.date);
        else if (col.id === 'entry_number') entry[header] = row.entry_number;
        else if (col.id === 'account_name') entry[header] = row.parent_account_name || row.account_name;
        else if (col.id === 'account_code') entry[header] = row.account_code || '-';
        else if (col.id === 'account_type') entry[header] = row.account_type_name || '-';
        else if (col.id === 'reference_type') entry[header] = getDocTypeLabel(row.reference_type);
        else if (col.id === 'reference_number') entry[header] = row.reference_number || '-';
        else if (col.id === 'sub_account') entry[header] = row.parent_account_name ? row.account_name : (row.sub_account_id || '-');
        else if (col.id === 'client_supplier') entry[header] = row.customer_name || row.supplier_name || '-';
        else if (col.id === 'product_names') entry[header] = row.product_names || '-';
        else if (col.id === 'currency') entry[header] = row.currency_code || '-';
        else if (col.id === 'foreign_amount') entry[header] = row.foreign_amount ? formatNumber(row.foreign_amount) : '-';
        else if (col.id === 'entry_desc') entry[header] = row.entry_description || '-';
        else if (col.id === 'line_desc') entry[header] = row.line_description || '-';
        else if (col.id === 'operation_number') entry[header] = row.operation_number || '-';
        else if (col.id === 'department') entry[header] = row.department_name || '-';
        else if (col.id === 'cost_center') entry[header] = row.cost_center_name || '-';
      });
      return entry;
    });

    exportToExcel(rows, { filename: language === 'ar' ? 'قيود يومية تفصيلية' : 'Detailed_Journal_Entries' });
  };

  const handlePrint = () => {
    window.print();
  };

  const currentDebitTotal = data.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
  const currentCreditTotal = data.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto print:p-0 print:space-y-4" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            {language === 'ar' ? 'قيود يومية تفصيلية' : 'Detailed Journal Entries'}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {language === 'ar' ? 'استعراض الحسابات والقيود المحاسبية بالتفصيل على مستوى الأسطر والحركات' : 'View accounting journal details at line and movement level'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Column Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="flex items-center gap-2 px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors text-sm shadow-sm"
            >
              <Settings className="w-4 h-4" />
              <span>{language === 'ar' ? 'أعمدة الجدول' : 'Columns'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {showColumnDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute z-55 mt-2 w-64 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-2 max-h-[350px] overflow-y-auto left-0 right-auto rtl:right-0 rtl:left-auto"
                >
                  <div className="px-3 py-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-700 mb-1">
                    {language === 'ar' ? 'تخصيص الأعمدة المعروضة' : 'Choose Columns to Display'}
                  </div>
                  {columns.map(col => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-755 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => toggleColumn(col.id)}
                        className="rounded border-zinc-350 dark:border-zinc-650 text-emerald-650 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span>{language === 'ar' ? col.labelAr : col.labelEn}</span>
                    </label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors text-sm shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>{language === 'ar' ? 'تصدير إكسيل' : 'Excel Export'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors text-sm shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-755 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Filter, Pagination & Info Panel */}
      <div className="bg-white dark:bg-zinc-805 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 shadow-sm print:hidden">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-end">
          {/* Left Side: Preset, Date Filters & Page Switcher */}
          <div className="xl:col-span-7 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Period Preset Selector */}
              <div className="space-y-1.5 w-44">
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mr-1">
                  {language === 'ar' ? 'الفترة الزمنية' : 'Period'}
                </label>
                <select
                  value={preset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-800 dark:text-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm font-semibold transition-all shadow-sm cursor-pointer"
                >
                  <option value="today">{language === 'ar' ? 'اليوم الحالي' : 'Today'}</option>
                  <option value="yesterday">{language === 'ar' ? 'اليوم السابق' : 'Yesterday'}</option>
                  <option value="this_week">{language === 'ar' ? 'الأسبوع الحالي' : 'This Week'}</option>
                  <option value="last_week">{language === 'ar' ? 'الأسبوع السابق' : 'Last Week'}</option>
                  <option value="this_month">{language === 'ar' ? 'الشهر الحالي' : 'This Month'}</option>
                  <option value="last_month">{language === 'ar' ? 'الشهر السابق' : 'Last Month'}</option>
                  <option value="this_quarter">{language === 'ar' ? 'الربع الحالي' : 'This Quarter'}</option>
                  <option value="last_quarter">{language === 'ar' ? 'الربع السابق' : 'Last Quarter'}</option>
                  <option value="this_year">{language === 'ar' ? 'العام الحالي' : 'This Year'}</option>
                  <option value="last_year">{language === 'ar' ? 'العام السابق' : 'Last Year'}</option>
                  <option value="all">{language === 'ar' ? 'الكل (بدون تاريخ)' : 'All Time'}</option>
                </select>
              </div>

              {/* Date range start */}
              <div className="space-y-1.5 w-40">
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mr-1">
                  {language === 'ar' ? 'من تاريخ' : 'From Date'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none rtl:left-0 rtl:right-auto rtl:pl-3">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                  </span>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setPage(1); setPreset(''); }}
                    className="block w-full pr-10 pl-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all rtl:pl-10 rtl:pr-3 text-sm font-semibold shadow-sm"
                  />
                </div>
              </div>

              {/* Date range end */}
              <div className="space-y-1.5 w-40">
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mr-1">
                  {language === 'ar' ? 'إلى تاريخ' : 'To Date'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none rtl:left-0 rtl:right-auto rtl:pl-3">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                  </span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setPage(1); setPreset(''); }}
                    className="block w-full pr-10 pl-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all rtl:pl-10 rtl:pr-3 text-sm font-semibold shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Top Pagination Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Page Switcher Box */}
              <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 shadow-sm font-bold text-zinc-700 dark:text-zinc-300">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-40 transition-colors"
                >
                  {dir === 'rtl' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                <span className="text-sm select-none font-mono">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-700 rounded-lg disabled:opacity-40 transition-colors"
                >
                  {dir === 'rtl' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
              </div>

              {/* Items Per Page & Total Results Box */}
              <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 shadow-sm text-sm font-bold text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-500">
                  {language === 'ar' ? `إجمالي النتائج: ${totalRecords}` : `Total: ${totalRecords}`}
                </span>
                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
                <label className="flex items-center gap-2">
                  <span>{language === 'ar' ? 'عناصر الصفحة:' : 'Items per page:'}</span>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="px-2 py-1 bg-white dark:bg-zinc-805 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-transparent outline-none text-xs font-extrabold cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={1000000}>{language === 'ar' ? 'الكل' : 'All'}</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Right Side: Totals & Search */}
          <div className="xl:col-span-5 space-y-4">
            {/* Totals Cards (page-level visible totals only) */}
            <div className="flex items-center gap-4 justify-end">
              <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl px-5 py-3 shadow-sm flex flex-col items-end min-w-[150px]">
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  {language === 'ar' ? 'إجمالي المدين (الصفحة)' : 'Total Debit (Page)'}
                </span>
                <span className="text-base font-bold text-emerald-800 dark:text-emerald-305 mt-0.5">
                  {formatMoney(currentDebitTotal)} {language === 'ar' ? 'ج.م' : 'EGP'}
                </span>
              </div>

              <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl px-5 py-3 shadow-sm flex flex-col items-end min-w-[150px]">
                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                  {language === 'ar' ? 'إجمالي الدائن (الصفحة)' : 'Total Credit (Page)'}
                </span>
                <span className="text-base font-bold text-rose-800 dark:text-rose-305 mt-0.5">
                  {formatMoney(currentCreditTotal)} {language === 'ar' ? 'ج.م' : 'EGP'}
                </span>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none rtl:left-0 rtl:right-auto rtl:pl-3">
                <Search className="h-5 w-5 text-zinc-400" />
              </span>
              <input
                type="text"
                placeholder={language === 'ar' ? 'بحث برقم القيد، الحساب، البيان، العميل أو المورد...' : 'Search by entry no, account, narration...'}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="block w-full pr-10 pl-3 py-2.5 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all rtl:pl-10 rtl:pr-3 text-sm font-semibold shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Excel Sheet styled table with Top Scrollbar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden shadow-md animate-in fade-in duration-300">
        {/* Top Scrollbar helper */}
        <div 
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto overflow-y-hidden h-3 w-full bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-700 select-none print:hidden"
        >
          <div style={{ width: `${tableWidth}px`, height: '1px' }} />
        </div>

        <div 
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="overflow-x-auto max-w-full"
        >
          <table ref={tableRef} className="w-full border-collapse text-right select-all">
            {/* Excel Columns Header */}
            <thead>
              {/* Table labels */}
              <tr className="bg-zinc-100 dark:bg-zinc-805 border-b border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-350 select-none">
                <th className="px-3 py-2 border-l border-zinc-300 dark:border-zinc-700 w-12 text-center bg-zinc-200/50 dark:bg-zinc-800 select-none">#</th>
                
                {columns.map(col => col.visible && (
                  <th 
                    key={col.id} 
                    style={{ 
                      width: columnWidths[col.id] ? `${columnWidths[col.id]}px` : 'auto', 
                      minWidth: columnWidths[col.id] ? `${columnWidths[col.id]}px` : 'max-content' 
                    }}
                    className="relative px-3 py-2 border-l border-zinc-300 dark:border-zinc-700 font-semibold select-none text-center group/th"
                  >
                    <div className="flex items-center justify-center gap-1">
                      {language === 'ar' ? col.labelAr : col.labelEn}
                    </div>
                    {/* Left Resize Handle */}
                    <div
                      onMouseDown={(e) => startResize(e, col.id, 'left')}
                      className="absolute top-0 bottom-0 left-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-600 transition-colors z-10"
                    />
                    {/* Right Resize Handle */}
                    <div
                      onMouseDown={(e) => startResize(e, col.id, 'right')}
                      className="absolute top-0 bottom-0 right-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-600 transition-colors z-10"
                    />
                  </th>
                ))}

                <th className="px-3 py-2 text-center w-16 print:hidden bg-zinc-200/50 dark:bg-zinc-800 select-none">
                  {language === 'ar' ? 'انتقال' : 'Go'}
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-750 text-[13px] font-mono text-zinc-800 dark:text-zinc-250">
              {loading ? (
                <tr>
                  <td colSpan={columns.filter(c => c.visible).length + 2} className="px-6 py-20 text-center text-zinc-550">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                      <span>{language === 'ar' ? 'جاري تحميل قيود اليومية التفصيلية...' : 'Loading detailed entries...'}</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.filter(c => c.visible).length + 2} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    {language === 'ar' ? 'لا توجد بيانات تطابق الفلترة الحالية' : 'No records found matching filters'}
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => {
                  const nextRow = data[idx + 1];
                  const isLastLineOfEntry = !nextRow || nextRow.journal_entry_id !== row.journal_entry_id;

                  return (
                    <tr 
                      key={row.line_id}
                      className={`hover:bg-zinc-50/75 dark:hover:bg-zinc-800/35 transition-colors border-l border-r border-zinc-200 dark:border-zinc-700
                        ${isLastLineOfEntry ? 'border-b-[3px] border-b-zinc-800 dark:border-b-zinc-400' : 'border-b border-zinc-200 dark:border-zinc-700'}
                      `}
                    >
                      {/* Row Index */}
                      <td className="px-2 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-center bg-zinc-50/50 dark:bg-zinc-800/20 text-zinc-400 font-semibold select-none">
                        {startRowIndex + idx + 1}
                      </td>

                      {/* Debit (المدين) */}
                      {columns.find(c => c.id === 'debit')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['debit'] ? `${columnWidths['debit']}px` : 'auto',
                            minWidth: columnWidths['debit'] ? `${columnWidths['debit']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-emerald-750 dark:text-emerald-400 font-semibold text-left"
                        >
                          {row.debit > 0 ? formatNumber(row.debit) : '-'}
                        </td>
                      )}

                      {/* Credit (الدائن) */}
                      {columns.find(c => c.id === 'credit')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['credit'] ? `${columnWidths['credit']}px` : 'auto',
                            minWidth: columnWidths['credit'] ? `${columnWidths['credit']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-rose-750 dark:text-rose-400 font-semibold text-left"
                        >
                          {row.credit > 0 ? formatNumber(row.credit) : '-'}
                        </td>
                      )}

                      {/* Date (التاريخ) */}
                      {columns.find(c => c.id === 'date')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['date'] ? `${columnWidths['date']}px` : 'auto',
                            minWidth: columnWidths['date'] ? `${columnWidths['date']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-center text-zinc-650 dark:text-zinc-300 select-none"
                        >
                          {formatDate(row.date)}
                        </td>
                      )}

                      {/* Entry Number (رقم القيد) */}
                      {columns.find(c => c.id === 'entry_number')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['entry_number'] ? `${columnWidths['entry_number']}px` : 'auto',
                            minWidth: columnWidths['entry_number'] ? `${columnWidths['entry_number']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-center font-bold text-zinc-900 dark:text-zinc-150"
                        >
                          <span 
                            onClick={() => handleTransactionClick('manual', row.entry_number)}
                            className="cursor-pointer text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            {row.entry_number}
                          </span>
                        </td>
                      )}

                      {/* Main Account Name (الحساب الرئيسي) */}
                      {columns.find(c => c.id === 'account_name')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['account_name'] ? `${columnWidths['account_name']}px` : 'auto',
                            minWidth: columnWidths['account_name'] ? `${columnWidths['account_name']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-right select-all font-sans"
                        >
                          {row.parent_account_name || row.account_name}
                        </td>
                      )}

                      {/* Account Code (كود الحساب) */}
                      {columns.find(c => c.id === 'account_code')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['account_code'] ? `${columnWidths['account_code']}px` : 'auto',
                            minWidth: columnWidths['account_code'] ? `${columnWidths['account_code']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-center font-mono font-semibold"
                        >
                          {row.account_code || '-'}
                        </td>
                      )}

                      {/* Account Type (نوع الحساب) */}
                      {columns.find(c => c.id === 'account_type')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['account_type'] ? `${columnWidths['account_type']}px` : 'auto',
                            minWidth: columnWidths['account_type'] ? `${columnWidths['account_type']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-center font-sans"
                        >
                          {row.account_type_name || '-'}
                        </td>
                      )}

                      {/* Doc Type (نوع الحركة) */}
                      {columns.find(c => c.id === 'reference_type')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['reference_type'] ? `${columnWidths['reference_type']}px` : 'auto',
                            minWidth: columnWidths['reference_type'] ? `${columnWidths['reference_type']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-center font-sans"
                        >
                          {getDocTypeLabel(row.reference_type)}
                        </td>
                      )}

                      {/* Doc Number (رقم الحركة) */}
                      {columns.find(c => c.id === 'reference_number')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['reference_number'] ? `${columnWidths['reference_number']}px` : 'auto',
                            minWidth: columnWidths['reference_number'] ? `${columnWidths['reference_number']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-center"
                        >
                          {row.reference_number ? (
                            <span 
                              onClick={() => handleTransactionClick(row.reference_type, row.reference_number)}
                              className="cursor-pointer text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                            >
                              {row.reference_number}
                            </span>
                          ) : '-'}
                        </td>
                      )}

                      {/* Sub-account (الحساب الفرعي) */}
                      {columns.find(c => c.id === 'sub_account')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['sub_account'] ? `${columnWidths['sub_account']}px` : 'auto',
                            minWidth: columnWidths['sub_account'] ? `${columnWidths['sub_account']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-center font-sans font-semibold"
                        >
                          {row.parent_account_name ? row.account_name : (row.sub_account_id || '-')}
                        </td>
                      )}

                      {/* Client/Supplier (عميل - مورد) */}
                      {columns.find(c => c.id === 'client_supplier')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['client_supplier'] ? `${columnWidths['client_supplier']}px` : 'auto',
                            minWidth: columnWidths['client_supplier'] ? `${columnWidths['client_supplier']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-right font-sans"
                        >
                          {row.customer_name || row.supplier_name || '-'}
                        </td>
                      )}

                      {/* Products/Items (صنف) */}
                      {columns.find(c => c.id === 'product_names')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['product_names'] ? `${columnWidths['product_names']}px` : 'auto',
                            minWidth: columnWidths['product_names'] ? `${columnWidths['product_names']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-right font-sans max-w-[200px] truncate" 
                          title={row.product_names || ''}
                        >
                          {row.product_names || '-'}
                        </td>
                      )}

                      {/* Currency (العملة) */}
                      {columns.find(c => c.id === 'currency')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['currency'] ? `${columnWidths['currency']}px` : 'auto',
                            minWidth: columnWidths['currency'] ? `${columnWidths['currency']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-center select-none"
                        >
                          {row.currency_code ? `${row.currency_code} (${row.currency_symbol || ''})` : '-'}
                        </td>
                      )}

                      {/* FC Amount (قيمة العملة الأجنبية) */}
                      {columns.find(c => c.id === 'foreign_amount')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['foreign_amount'] ? `${columnWidths['foreign_amount']}px` : 'auto',
                            minWidth: columnWidths['foreign_amount'] ? `${columnWidths['foreign_amount']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-left"
                        >
                          {row.foreign_amount ? formatNumber(row.foreign_amount) : '-'}
                        </td>
                      )}

                      {/* Entry description (بيان القيد) */}
                      {columns.find(c => c.id === 'entry_desc')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['entry_desc'] ? `${columnWidths['entry_desc']}px` : 'auto',
                            minWidth: columnWidths['entry_desc'] ? `${columnWidths['entry_desc']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-right font-sans max-w-[250px] truncate" 
                          title={row.entry_description || ''}
                        >
                          {row.entry_description || '-'}
                        </td>
                      )}

                      {/* Line description (بيان السطر) */}
                      {columns.find(c => c.id === 'line_desc')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['line_desc'] ? `${columnWidths['line_desc']}px` : 'auto',
                            minWidth: columnWidths['line_desc'] ? `${columnWidths['line_desc']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-right font-sans max-w-[250px] truncate" 
                          title={row.line_description || ''}
                        >
                          {row.line_description || '-'}
                        </td>
                      )}

                      {/* Operation number (رقم العملية) */}
                      {columns.find(c => c.id === 'operation_number')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['operation_number'] ? `${columnWidths['operation_number']}px` : 'auto',
                            minWidth: columnWidths['operation_number'] ? `${columnWidths['operation_number']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-center"
                        >
                          {row.operation_number || '-'}
                        </td>
                      )}

                      {/* Department (الإدارة) */}
                      {columns.find(c => c.id === 'department')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['department'] ? `${columnWidths['department']}px` : 'auto',
                            minWidth: columnWidths['department'] ? `${columnWidths['department']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-right font-sans"
                        >
                          {row.department_name || '-'}
                        </td>
                      )}

                      {/* Cost Center (مركز التكلفة) */}
                      {columns.find(c => c.id === 'cost_center')?.visible && (
                        <td 
                          style={{ 
                            width: columnWidths['cost_center'] ? `${columnWidths['cost_center']}px` : 'auto',
                            minWidth: columnWidths['cost_center'] ? `${columnWidths['cost_center']}px` : 'max-content'
                          }}
                          className="px-3 py-1.5 border-l border-zinc-300 dark:border-zinc-700 text-right font-sans"
                        >
                          {row.cost_center_name ? `${row.cost_center_name} (${row.cost_center_code || ''})` : '-'}
                        </td>
                      )}

                      {/* Go transition icon */}
                      <td className="px-2 py-1.5 text-center print:hidden select-none">
                        <button
                          onClick={() => handleTransactionClick(row.reference_type || 'manual', row.reference_number || row.entry_number)}
                          className="p-1 text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                          title={language === 'ar' ? 'انتقال إلى المستند الأصلي' : 'Navigate to original document'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
