import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  RefreshCw,
  Search,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Eye,
  SlidersHorizontal,
  X,
  ArrowDownToLine,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Globe,
  ChevronDown,
  FileSpreadsheet,
  Download,
  Printer,
  Share2,
  Link2,
  FileDown,
  List,
  LayoutGrid,
  Layers
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { apiRequest } from '../services/dbService';
import { exportToExcel } from '../utils/excelUtils';
import { ExportButtons } from '../components/ExportButtons';
import { exportToPDF, printElement } from '../utils/pdfUtils';
import { formatMoney } from '../utils/formatUtils';

export interface DetailedInvoiceLine {
  rowKey: string;
  uuid: string;
  internalId: string;
  direction: 'Sent' | 'Received';
  typeName: string;
  documentTypeName: string;
  partnerName: string;
  taxId: string;
  address: string;
  dateTimeIssued: string;
  dateTimeReceived: string;
  currency: string;
  status: string;
  longId?: string;

  // Item details
  itemCodeName: string;
  itemCode: string;
  itemType: string;
  description: string;
  quantity: number;
  unitType: string;
  unitPrice: number;
  salesTotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

const defaultVisibleColumns: Record<string, boolean> = {
  internal_id: true,
  direction: true,
  type: true,
  partner_name: true,
  tax_id: true,
  address: true,
  date_issued: true,
  date_received: true,
  currency: true,
  item_code_name: true,
  item_code: true,
  item_type: true,
  item_description: true,
  item_quantity: true,
  item_unit: true,
  item_unit_price: true,
  item_sales_total: true,
  item_discount: true,
  item_tax: true,
  item_total: true,
  status: true,
  uuid: true
};

const columnLabels: Record<string, { ar: string; en: string }> = {
  internal_id: { ar: 'رقم الفاتورة', en: 'Invoice ID' },
  direction: { ar: 'الاتجاه', en: 'Direction' },
  type: { ar: 'نوع الوثيقة', en: 'Document Type' },
  partner_name: { ar: 'المورد / العميل', en: 'Partner Name' },
  tax_id: { ar: 'الرقم الضريبي', en: 'Tax ID' },
  address: { ar: 'العنوان', en: 'Address' },
  date_issued: { ar: 'تاريخ الإصدار', en: 'Issue Date' },
  date_received: { ar: 'تاريخ الاستلام', en: 'Received Date' },
  currency: { ar: 'العملة', en: 'Currency' },
  item_code_name: { ar: 'اسم الكود', en: 'Code Name' },
  item_code: { ar: 'كود الصنف', en: 'Item Code' },
  item_type: { ar: 'نوع الكود', en: 'Code Type' },
  item_description: { ar: 'الوصف', en: 'Description' },
  item_quantity: { ar: 'الكمية', en: 'Quantity' },
  item_unit: { ar: 'الوحدة', en: 'Unit' },
  item_unit_price: { ar: 'سعر الوحدة', en: 'Unit Price' },
  item_sales_total: { ar: 'قيمة المبيعات', en: 'Sales Total' },
  item_discount: { ar: 'الخصم', en: 'Discount' },
  item_tax: { ar: 'الضرائب', en: 'Taxes' },
  item_total: { ar: 'إجمالي المبلغ', en: 'Total Amount' },
  status: { ar: 'الحالة', en: 'Status' },
  uuid: { ar: 'UUID', en: 'UUID' }
};

export function EtaDetailedInvoices() {
  const { language, dir } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { openTab } = useNavigation();

  // Selection & Views
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnSelectorRef = useRef<HTMLDivElement>(null);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = user?.id ? localStorage.getItem(`eta_detailed_visible_columns_${user.id}`) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        delete parsed.actions;
        if (parsed.item_quantity_unit !== undefined) {
          parsed.item_quantity = parsed.item_quantity ?? parsed.item_quantity_unit;
          parsed.item_unit = parsed.item_unit ?? parsed.item_quantity_unit;
          delete parsed.item_quantity_unit;
        }
        return { ...defaultVisibleColumns, ...parsed };
      } catch (e) {
        console.error(e);
      }
    }
    return defaultVisibleColumns;
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setIsColumnSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Date filters: default to last 29 days
  const defaultDates = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
    return {
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0]
    };
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [statusFilter, setStatusFilter] = useState('all');
  const [docTypeFilter, setDocTypeFilter] = useState('all');
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [showDocTypeDropdown, setShowDocTypeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'Received' | 'Sent'>('all');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<'all_portal' | 'period'>('all_portal');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Amount filter state
  const [amountField, setAmountField] = useState<'line_total' | 'sales_total' | 'tax_amount' | 'unit_price'>('line_total');
  const [amountOperator, setAmountOperator] = useState<'all' | 'eq' | 'between' | 'gt' | 'lt'>('all');
  const [amountValueFrom, setAmountValueFrom] = useState<string>('');
  const [amountValueTo, setAmountValueTo] = useState<string>('');

  // Months definition
  const MONTHS_LIST = useMemo(() => [
    { id: '01', nameAr: 'شهر 01 - يناير', nameEn: 'Month 01 - January' },
    { id: '02', nameAr: 'شهر 02 - فبراير', nameEn: 'Month 02 - February' },
    { id: '03', nameAr: 'شهر 03 - مارس', nameEn: 'Month 03 - March' },
    { id: '04', nameAr: 'شهر 04 - أبريل', nameEn: 'Month 04 - April' },
    { id: '05', nameAr: 'شهر 05 - مايو', nameEn: 'Month 05 - May' },
    { id: '06', nameAr: 'شهر 06 - يونيو', nameEn: 'Month 06 - June' },
    { id: '07', nameAr: 'شهر 07 - يوليو', nameEn: 'Month 07 - July' },
    { id: '08', nameAr: 'شهر 08 - أغسطس', nameEn: 'Month 08 - August' },
    { id: '09', nameAr: 'شهر 09 - سبتمبر', nameEn: 'Month 09 - September' },
    { id: '10', nameAr: 'شهر 10 - أكتوبر', nameEn: 'Month 10 - October' },
    { id: '11', nameAr: 'شهر 11 - نوفمبر', nameEn: 'Month 11 - November' },
    { id: '12', nameAr: 'شهر 12 - ديسمبر', nameEn: 'Month 12 - December' },
  ], []);

  const DOC_TYPES_LIST = useMemo(() => [
    { id: 'i', nameAr: 'فاتورة (Invoice)', nameEn: 'Invoice' },
    { id: 'ii', nameAr: 'فاتورة استيراد (Import Invoice)', nameEn: 'Import Invoice' },
    { id: 'ei', nameAr: 'فاتورة تصدير (Export Invoice)', nameEn: 'Export Invoice' },
    { id: 'c', nameAr: 'إشعار دائن (Credit Note)', nameEn: 'Credit Note' },
    { id: 'd', nameAr: 'إشعار مدين (Debit Note)', nameEn: 'Debit Note' },
    { id: 'ec', nameAr: 'إشعار دائن تصدير (Export Credit Note)', nameEn: 'Export Credit Note' },
    { id: 'ed', nameAr: 'إشعار مدين تصدير (Export Debit Note)', nameEn: 'Export Debit Note' }
  ], []);

  const STATUSES_LIST = useMemo(() => [
    { id: 'Valid', nameAr: 'صحيحة (Valid)', nameEn: 'Valid' },
    { id: 'Invalid', nameAr: 'غير صالحة (Invalid)', nameEn: 'Invalid' },
    { id: 'Rejected', nameAr: 'مرفوضة (Rejected)', nameEn: 'Rejected' },
    { id: 'Cancelled', nameAr: 'ملغاة (Cancelled)', nameEn: 'Cancelled' },
    { id: 'Submitted', nameAr: 'مقدمة (Submitted)', nameEn: 'Submitted' }
  ], []);

  // Data & State
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detailedLines, setDetailedLines] = useState<DetailedInvoiceLine[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(10);
  const [isConfigured, setIsConfigured] = useState(true);
  const [environment, setEnvironment] = useState<'preprod' | 'production'>('preprod');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Details Modal & ETA Portal View
  const [selectedInvoiceUuid, setSelectedInvoiceUuid] = useState<string | null>(null);
  const [fullInvoiceDetails, setFullInvoiceDetails] = useState<any | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'summary' | 'details' | 'signatures'>('summary');
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);
  const [modalDetailsLoading, setModalDetailsLoading] = useState(false);

  // Top & Table synchronized horizontal scrollbar refs
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const isSyncingTop = useRef(false);
  const isSyncingTable = useRef(false);

  const handleTopScroll = () => {
    if (isSyncingTop.current) {
      isSyncingTop.current = false;
      return;
    }
    if (topScrollRef.current && tableContainerRef.current) {
      isSyncingTable.current = true;
      tableContainerRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (isSyncingTable.current) {
      isSyncingTable.current = false;
      return;
    }
    if (topScrollRef.current && tableContainerRef.current) {
      isSyncingTop.current = true;
      topScrollRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    const updateScrollWidth = () => {
      if (tableContainerRef.current) {
        setTableScrollWidth(tableContainerRef.current.scrollWidth);
      }
    };
    updateScrollWidth();
    const timer = setTimeout(updateScrollWidth, 150);
    window.addEventListener('resize', updateScrollWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateScrollWidth);
    };
  }, [detailedLines, clientPage, clientPageSize, viewMode]);

  // Load modal details when selectedInvoiceUuid is set
  useEffect(() => {
    if (!selectedInvoiceUuid) {
      setModalDetailsLoading(false);
      setFullInvoiceDetails(null);
      return;
    }

    let isMounted = true;
    setModalDetailsLoading(true);
    setFullInvoiceDetails(null);
    setModalActiveTab('summary');

    apiRequest<{ success: boolean; data: any }>(`/eta/invoices/${encodeURIComponent(selectedInvoiceUuid)}/details`)
      .then(res => {
        if (!isMounted || !res?.data) return;
        setFullInvoiceDetails(res.data);
      })
      .catch(err => {
        console.warn('Could not load invoice details from ETA:', err);
      })
      .finally(() => {
        if (isMounted) setModalDetailsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedInvoiceUuid]);

  // Fetch detailed lines from backend
  const fetchDetailedData = useCallback(async (isRefresh = false) => {
    if (!user?.company_id) {
      setLoading(false);
      setAllLoading(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      }
      setAllLoading(true);
      setErrorMessage(null);

      const queryParams = new URLSearchParams();
      if (isRefresh) queryParams.set('refresh', 'true');

      const res = await apiRequest<{
        success: boolean;
        isConfigured: boolean;
        environment: 'preprod' | 'production';
        data: DetailedInvoiceLine[];
        totalCount: number;
        lastSyncedAt?: string | null;
      }>(`/eta/invoices/detailed?${queryParams.toString()}`, 'GET', undefined, 180000);

      setIsConfigured(res.isConfigured !== false);
      if (res.environment) setEnvironment(res.environment);
      if (res.lastSyncedAt) setLastSyncedAt(res.lastSyncedAt);

      if (res.success && Array.isArray(res.data)) {
        setDetailedLines(res.data);
        if (isRefresh) {
          showNotification(
            language === 'ar'
              ? `تم تحديث ومزامنة بنود الوثائق بنجاح (${res.data.length} بند).`
              : `Successfully synced detailed document lines (${res.data.length} items).`,
            'success'
          );
        }
      }
    } catch (err: any) {
      console.error('Failed to load detailed lines:', err);
      const msg = err.message || 'تعذر تحميل بنود الوثائق الإلكترونية المفصلة.';
      setErrorMessage(msg);
      if (isRefresh) {
        showNotification(msg, 'error');
      }
    } finally {
      setAllLoading(false);
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.company_id, language, showNotification]);

  useEffect(() => {
    fetchDetailedData(false);
  }, [fetchDetailedData]);

  // Counts for direction tabs
  const directionCounts = useMemo(() => {
    let received = 0;
    let sent = 0;
    for (const line of detailedLines) {
      if (line.direction === 'Sent') sent++;
      else received++;
    }
    return { all: detailedLines.length, received, sent };
  }, [detailedLines]);

  // Dynamic counts per year
  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const line of detailedLines) {
      const yr = (line.dateTimeIssued || '').slice(0, 4);
      if (yr) counts[yr] = (counts[yr] || 0) + 1;
    }
    return counts;
  }, [detailedLines]);

  // Dynamic counts per month
  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const line of detailedLines) {
      const yr = (line.dateTimeIssued || '').slice(0, 4);
      const mo = (line.dateTimeIssued || '').slice(5, 7);
      if (selectedYears.length === 0 || selectedYears.includes(yr)) {
        if (mo) counts[mo] = (counts[mo] || 0) + 1;
      }
    }
    return counts;
  }, [detailedLines, selectedYears]);

  // Dynamic counts per document type
  const docTypeCounts = useMemo(() => {
    const counts: Record<string, number> = { i: 0, ii: 0, ei: 0, c: 0, d: 0, ec: 0, ed: 0 };
    for (const line of detailedLines) {
      const code = String(line.typeName || '').toLowerCase();
      if (counts[code] !== undefined) {
        counts[code] = (counts[code] || 0) + 1;
      }
    }
    return counts;
  }, [detailedLines]);

  // Dynamic counts per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Valid: 0, Invalid: 0, Rejected: 0, Cancelled: 0, Submitted: 0 };
    for (const line of detailedLines) {
      if (line.status && counts[line.status] !== undefined) {
        counts[line.status] = (counts[line.status] || 0) + 1;
      }
    }
    return counts;
  }, [detailedLines]);

  const allSystemYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const detected = Object.keys(yearCounts);
    const set = new Set<string>();
    for (let y = currentYear + 1; y >= 2020; y--) {
      set.add(String(y));
    }
    detected.forEach(y => set.add(y));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [yearCounts]);

  // Amount match helper
  const matchesAmountFilter = useCallback((line: DetailedInvoiceLine) => {
    if (amountOperator === 'all') return true;
    const fromVal = amountValueFrom.trim() !== '' ? Number(amountValueFrom.replace(/,/g, '')) : null;
    const toVal = amountValueTo.trim() !== '' ? Number(amountValueTo.replace(/,/g, '')) : null;

    const amt = amountField === 'sales_total'
      ? (Number(line.salesTotal) || 0)
      : amountField === 'tax_amount'
      ? (Number(line.taxAmount) || 0)
      : amountField === 'unit_price'
      ? (Number(line.unitPrice) || 0)
      : (Number(line.lineTotal) || 0);

    if (amountOperator === 'eq') {
      if (fromVal === null || isNaN(fromVal)) return true;
      return Math.abs(amt - fromVal) < 0.01;
    }
    if (amountOperator === 'gt') {
      if (fromVal === null || isNaN(fromVal)) return true;
      return amt > fromVal;
    }
    if (amountOperator === 'lt') {
      if (fromVal === null || isNaN(fromVal)) return true;
      return amt < fromVal;
    }
    if (amountOperator === 'between') {
      if (fromVal !== null && !isNaN(fromVal) && toVal !== null && !isNaN(toVal)) {
        return amt >= Math.min(fromVal, toVal) && amt <= Math.max(fromVal, toVal);
      }
      if (fromVal !== null && !isNaN(fromVal)) return amt >= fromVal;
      if (toVal !== null && !isNaN(toVal)) return amt <= toVal;
      return true;
    }
    return true;
  }, [amountField, amountOperator, amountValueFrom, amountValueTo]);

  // Filtered detailed lines
  const filteredLines = useMemo(() => {
    let list = detailedLines;

    // Filter by period mode if period mode is active
    if (viewMode === 'period') {
      if (dateFrom) {
        list = list.filter(l => (l.dateTimeIssued || '').slice(0, 10) >= dateFrom);
      }
      if (dateTo) {
        list = list.filter(l => (l.dateTimeIssued || '').slice(0, 10) <= dateTo);
      }
    } else {
      if (selectedYears.length > 0) {
        const yrSet = new Set(selectedYears);
        list = list.filter(l => yrSet.has((l.dateTimeIssued || '').slice(0, 4)));
      }
      if (selectedMonths.length > 0) {
        const moSet = new Set(selectedMonths);
        list = list.filter(l => moSet.has((l.dateTimeIssued || '').slice(5, 7)));
      }
    }

    if (directionFilter === 'Received') {
      list = list.filter(l => l.direction !== 'Sent');
    } else if (directionFilter === 'Sent') {
      list = list.filter(l => l.direction === 'Sent');
    }

    if (selectedDocTypes.length > 0) {
      const lowerSelected = selectedDocTypes.map(s => s.toLowerCase());
      list = list.filter(l => lowerSelected.includes(String(l.typeName || '').toLowerCase()));
    } else if (docTypeFilter !== 'all') {
      list = list.filter(l => String(l.typeName || '').toLowerCase() === docTypeFilter.toLowerCase());
    }
    if (selectedStatuses.length > 0) {
      list = list.filter(l => selectedStatuses.includes(l.status));
    } else if (statusFilter !== 'all') {
      list = list.filter(l => l.status === statusFilter);
    }
    if (amountOperator !== 'all') {
      list = list.filter(matchesAmountFilter);
    }

    if (!appliedSearch.trim()) return list;
    const q = appliedSearch.trim().toLowerCase();
    return list.filter(l =>
      l.internalId.toLowerCase().includes(q) ||
      l.partnerName.toLowerCase().includes(q) ||
      l.taxId.toLowerCase().includes(q) ||
      l.uuid.toLowerCase().includes(q) ||
      (l.description && l.description.toLowerCase().includes(q)) ||
      (l.itemCode && l.itemCode.toLowerCase().includes(q)) ||
      (l.itemCodeName && l.itemCodeName.toLowerCase().includes(q))
    );
  }, [detailedLines, viewMode, dateFrom, dateTo, selectedYears, selectedMonths, directionFilter, docTypeFilter, statusFilter, selectedDocTypes, selectedStatuses, amountOperator, matchesAmountFilter, appliedSearch]);

  const totalPages = Math.ceil(filteredLines.length / clientPageSize) || 1;
  const paginatedLines = useMemo(() => {
    const start = (clientPage - 1) * clientPageSize;
    return filteredLines.slice(start, start + clientPageSize);
  }, [filteredLines, clientPage, clientPageSize]);

  // Summary totals for all filtered lines
  const summaryTotals = useMemo(() => {
    return filteredLines.reduce(
      (acc, l) => {
        acc.lineTotal += Number(l.lineTotal) || 0;
        acc.discountAmount += Number(l.discountAmount) || 0;
        acc.salesTotal += Number(l.salesTotal) || 0;
        acc.taxAmount += Number(l.taxAmount) || 0;
        return acc;
      },
      { lineTotal: 0, discountAmount: 0, salesTotal: 0, taxAmount: 0 }
    );
  }, [filteredLines]);

  // Summary totals for selected rows
  const selectedTotals = useMemo(() => {
    const list = filteredLines.filter(l => selectedRowKeys.includes(l.rowKey));
    return list.reduce(
      (acc, l) => {
        acc.lineTotal += Number(l.lineTotal) || 0;
        acc.discountAmount += Number(l.discountAmount) || 0;
        acc.salesTotal += Number(l.salesTotal) || 0;
        acc.taxAmount += Number(l.taxAmount) || 0;
        return acc;
      },
      { lineTotal: 0, discountAmount: 0, salesTotal: 0, taxAmount: 0 }
    );
  }, [filteredLines, selectedRowKeys]);

  const isAllSelected = useMemo(() => {
    if (paginatedLines.length === 0) return false;
    return paginatedLines.every(l => selectedRowKeys.includes(l.rowKey));
  }, [paginatedLines, selectedRowKeys]);

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedRowKeys(prev => prev.filter(k => !paginatedLines.some(l => l.rowKey === k)));
    } else {
      const newKeys = paginatedLines.map(l => l.rowKey);
      setSelectedRowKeys(prev => Array.from(new Set([...prev, ...newKeys])));
    }
  }, [isAllSelected, paginatedLines]);

  const handleToggleSelect = useCallback((key: string) => {
    setSelectedRowKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchQuery);
    setClientPage(1);
  };

  const handleRefresh = () => {
    fetchDetailedData(true);
  };

  const formatAmount = (val: number) => {
    const num = Number(val) || 0;
    return num.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const renderDocTypeBadge = (typeName?: string, docTypeName?: string) => {
    const t = String(typeName || '').toLowerCase();
    const dtName = String(docTypeName || '');

    if (t === 'ii' || dtName.includes('استيراد') || dtName.toLowerCase().includes('import')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs">
          {language === 'ar' ? 'فاتورة استيراد' : 'Import Invoice'}
        </span>
      );
    }
    if (t === 'ei' || dtName.includes('تصدير') || dtName.toLowerCase().includes('export invoice')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 shadow-2xs">
          {language === 'ar' ? 'فاتورة تصدير' : 'Export Invoice'}
        </span>
      );
    }
    if (t === 'c' || t === 'ec' || dtName.includes('دائن') || dtName.toLowerCase().includes('credit')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          {t === 'ec' ? (language === 'ar' ? 'إشعار دائن تصدير' : 'Export Credit Note') : (language === 'ar' ? 'إشعار دائن' : 'Credit Note')}
        </span>
      );
    }
    if (t === 'd' || t === 'ed' || dtName.includes('مدين') || dtName.toLowerCase().includes('debit')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
          {t === 'ed' ? (language === 'ar' ? 'إشعار مدين تصدير' : 'Export Debit Note') : (language === 'ar' ? 'إشعار مدين' : 'Debit Note')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
        {language === 'ar' ? 'فاتورة' : 'Invoice'}
      </span>
    );
  };

  const renderDirectionBadge = (dir?: 'Sent' | 'Received') => {
    if (dir === 'Sent') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200" title={language === 'ar' ? 'وثيقة صادرة' : 'Sent Document'}>
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'صادرة' : 'Sent'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={language === 'ar' ? 'وثيقة واردة' : 'Received Document'}>
        <ArrowDownLeft className="w-3.5 h-3.5" />
        <span>{language === 'ar' ? 'واردة' : 'Received'}</span>
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'valid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          {language === 'ar' ? 'صحيحة' : 'Valid'}
        </span>
      );
    }
    if (s === 'invalid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          {language === 'ar' ? 'غير صالحة' : 'Invalid'}
        </span>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          {language === 'ar' ? 'ملغاة' : 'Cancelled'}
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <XCircle className="w-3.5 h-3.5 text-red-600" />
          {language === 'ar' ? 'مرفوضة' : 'Rejected'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        {status}
      </span>
    );
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUuid(id);
    setTimeout(() => setCopiedUuid(null), 2000);
  };

  // Export to Excel (.xlsx) with flattened items
  const handleExportExcel = useCallback((onlySelected = false) => {
    const listToExport = onlySelected
      ? filteredLines.filter(l => selectedRowKeys.includes(l.rowKey))
      : filteredLines;

    if (!listToExport || listToExport.length === 0) {
      showNotification(language === 'ar' ? 'لا توجد بنود لتصديرها' : 'No lines to export', 'warning');
      return;
    }

    const exportData = listToExport.map((line, idx) => ({
      '#': idx + 1,
      [language === 'ar' ? 'رقم الفاتورة' : 'Invoice ID']: line.internalId || '',
      [language === 'ar' ? 'الاتجاه' : 'Direction']:
        line.direction === 'Sent'
          ? (language === 'ar' ? 'صادرة' : 'Sent')
          : (language === 'ar' ? 'واردة' : 'Received'),
      [language === 'ar' ? 'نوع الوثيقة' : 'Document Type']: line.documentTypeName || line.typeName || '',
      [language === 'ar' ? 'المورد / العميل' : 'Partner Name']: line.partnerName || '',
      [language === 'ar' ? 'الرقم الضريبي' : 'Tax ID']: line.taxId || '-',
      [language === 'ar' ? 'العنوان' : 'Address']: line.address || '-',
      [language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date']: line.dateTimeIssued
        ? new Date(line.dateTimeIssued).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')
        : '-',
      [language === 'ar' ? 'تاريخ الاستلام' : 'Received Date']: line.dateTimeReceived
        ? new Date(line.dateTimeReceived).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')
        : '-',
      [language === 'ar' ? 'العملة' : 'Currency']: line.currency || 'EGP',
      [language === 'ar' ? 'اسم الكود' : 'Code Name']: line.itemCodeName || '---',
      [language === 'ar' ? 'كود الصنف' : 'Item Code']: line.itemCode || '---',
      [language === 'ar' ? 'نوع الكود' : 'Code Type']: line.itemType || 'EGS',
      [language === 'ar' ? 'الوصف' : 'Description']: line.description || '---',
      [language === 'ar' ? 'الكمية' : 'Quantity']: line.quantity ?? 1,
      [language === 'ar' ? 'الوحدة' : 'Unit']: line.unitType || '',
      [language === 'ar' ? 'سعر الوحدة' : 'Unit Price']: line.unitPrice ?? 0,
      [language === 'ar' ? 'قيمة المبيعات' : 'Sales Total']: line.salesTotal ?? 0,
      [language === 'ar' ? 'الخصم' : 'Discount']: line.discountAmount ?? 0,
      [language === 'ar' ? 'الضرائب' : 'Taxes']: line.taxAmount ?? 0,
      [language === 'ar' ? 'إجمالي المبلغ' : 'Total Amount']: line.lineTotal ?? 0,
      [language === 'ar' ? 'الحالة' : 'Status']: line.status || '',
      'UUID': line.uuid || ''
    }));

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    exportToExcel(exportData, {
      filename: onlySelected ? `eta_detailed_lines_selected_${dateStr}` : `eta_detailed_lines_${dateStr}`,
      sheetName: 'الوثائق الإلكترونية بالتفصيل'
    });

    showNotification(
      language === 'ar'
        ? `تم تصدير ${listToExport.length} بند بنجاح إلى ملف إكسيل`
        : `Successfully exported ${listToExport.length} lines to Excel`,
      'success'
    );
  }, [filteredLines, selectedRowKeys, language, showNotification]);

  // Export to PDF
  const handleExportPDF = useCallback(async (onlySelected = false) => {
    const tableEl = tableContainerRef.current;
    if (!tableEl) return;
    try {
      if (onlySelected) {
        const cloned = tableEl.cloneNode(true) as HTMLElement;
        const rows = Array.from(cloned.querySelectorAll('tbody tr'));
        rows.forEach(r => {
          const rKey = r.getAttribute('data-rowkey');
          if (rKey && !selectedRowKeys.includes(rKey)) {
            r.remove();
          }
        });
        await exportToPDF(cloned, {
          filename: `eta_detailed_selected_${Date.now()}`,
          reportTitle: language === 'ar' ? 'الوثائق الإلكترونية بالتفصيل - المحددة' : 'Selected Detailed Electronic Documents',
          orientation: 'landscape'
        });
      } else {
        await exportToPDF(tableEl, {
          filename: `eta_detailed_documents_${Date.now()}`,
          reportTitle: language === 'ar' ? 'الوثائق الإلكترونية بالتفصيل' : 'Detailed Electronic Documents',
          orientation: 'landscape'
        });
      }
    } catch (err) {
      console.error('PDF export error:', err);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء تصدير PDF' : 'Error exporting PDF', 'error');
    }
  }, [selectedRowKeys, language, showNotification]);

  const handlePrintSelected = useCallback(() => {
    if (selectedRowKeys.length === 0) return;
    const tableEl = tableContainerRef.current;
    if (!tableEl) return;
    const cloned = tableEl.cloneNode(true) as HTMLElement;
    const rows = Array.from(cloned.querySelectorAll('tbody tr'));
    rows.forEach(r => {
      const rKey = r.getAttribute('data-rowkey');
      if (rKey && !selectedRowKeys.includes(rKey)) {
        r.remove();
      }
    });
    printElement(cloned, language === 'ar' ? 'الوثائق الإلكترونية بالتفصيل - المحددة' : 'Selected Detailed Documents');
  }, [selectedRowKeys, language]);

  const renderDocTypeFilter = () => {
    const isFiltered = selectedDocTypes.length > 0 || docTypeFilter !== 'all';
    return (
      <div className="relative">
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-indigo-600" />
            <span>{language === 'ar' ? 'نوع الوثيقة' : 'Document Type'}</span>
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={() => { setSelectedDocTypes([]); setDocTypeFilter('all'); setClientPage(1); }}
              className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
            </button>
          )}
        </label>

        <button
          type="button"
          onClick={() => {
            setShowDocTypeDropdown(p => !p);
            setShowStatusDropdown(false);
            setShowYearDropdown(false);
            setShowMonthDropdown(false);
          }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs md:text-sm font-semibold text-slate-800 transition-all text-start cursor-pointer"
        >
          <span className="truncate">
            {selectedDocTypes.length === 0
              ? (docTypeFilter !== 'all'
                  ? (DOC_TYPES_LIST.find(x => x.id === docTypeFilter)?.[language === 'ar' ? 'nameAr' : 'nameEn'] || docTypeFilter)
                  : (language === 'ar' ? 'الكل (وثائق وإشعارات)' : 'All Documents'))
              : selectedDocTypes.length === 1
              ? (() => {
                  const dt = DOC_TYPES_LIST.find(x => x.id === selectedDocTypes[0]);
                  return language === 'ar' ? dt?.nameAr : dt?.nameEn;
                })()
              : (language === 'ar' ? `${selectedDocTypes.length} أنواع محددة` : `${selectedDocTypes.length} Types Selected`)}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDocTypeDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDocTypeDropdown && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowDocTypeDropdown(false)} />
            <div className="absolute top-full right-0 mt-1.5 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-2 space-y-1 max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 px-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => { setSelectedDocTypes([]); setDocTypeFilter('all'); setClientPage(1); }}
                  className={`font-bold cursor-pointer ${selectedDocTypes.length === 0 && docTypeFilter === 'all' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {language === 'ar' ? 'تحديد كافة الأنواع' : 'Select All Types'}
                </button>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => { setSelectedDocTypes([]); setDocTypeFilter('all'); setClientPage(1); }}
                    className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
                  >
                    {language === 'ar' ? 'مسح' : 'Clear'}
                  </button>
                )}
              </div>

              {DOC_TYPES_LIST.map(dt => {
                const count = docTypeCounts[dt.id] || 0;
                const isChecked = selectedDocTypes.length > 0 ? selectedDocTypes.includes(dt.id) : (docTypeFilter === dt.id);
                return (
                  <label
                    key={dt.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs select-none transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          let newSelected = selectedDocTypes.length > 0
                            ? [...selectedDocTypes]
                            : (docTypeFilter !== 'all' ? [docTypeFilter] : []);
                          if (e.target.checked) {
                            if (!newSelected.includes(dt.id)) newSelected.push(dt.id);
                          } else {
                            newSelected = newSelected.filter(x => x !== dt.id);
                          }
                          setSelectedDocTypes(newSelected);
                          setDocTypeFilter(newSelected.length === 1 ? newSelected[0] : 'all');
                          setClientPage(1);
                        }}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-800">{language === 'ar' ? dt.nameAr : dt.nameEn}</span>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      count > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {count} {language === 'ar' ? 'بند' : (count === 1 ? 'line' : 'lines')}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderStatusFilter = () => {
    const isFiltered = selectedStatuses.length > 0 || statusFilter !== 'all';
    return (
      <div className="relative">
        <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>{language === 'ar' ? 'حالة الفاتورة' : 'Status'}</span>
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={() => { setSelectedStatuses([]); setStatusFilter('all'); setClientPage(1); }}
              className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
            >
              {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
            </button>
          )}
        </label>

        <button
          type="button"
          onClick={() => {
            setShowStatusDropdown(p => !p);
            setShowDocTypeDropdown(false);
            setShowYearDropdown(false);
            setShowMonthDropdown(false);
          }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs md:text-sm font-semibold text-slate-800 transition-all text-start cursor-pointer"
        >
          <span className="truncate">
            {selectedStatuses.length === 0
              ? (statusFilter !== 'all'
                  ? (STATUSES_LIST.find(x => x.id === statusFilter)?.[language === 'ar' ? 'nameAr' : 'nameEn'] || statusFilter)
                  : (language === 'ar' ? 'الكل (جميع الحالات)' : 'All Statuses'))
              : selectedStatuses.length === 1
              ? (() => {
                  const st = STATUSES_LIST.find(x => x.id === selectedStatuses[0]);
                  return language === 'ar' ? st?.nameAr : st?.nameEn;
                })()
              : (language === 'ar' ? `${selectedStatuses.length} حالات محددة` : `${selectedStatuses.length} Statuses Selected`)}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showStatusDropdown && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowStatusDropdown(false)} />
            <div className="absolute top-full right-0 mt-1.5 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-2 space-y-1 max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 px-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => { setSelectedStatuses([]); setStatusFilter('all'); setClientPage(1); }}
                  className={`font-bold cursor-pointer ${selectedStatuses.length === 0 && statusFilter === 'all' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {language === 'ar' ? 'تحديد كافة الحالات' : 'Select All Statuses'}
                </button>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={() => { setSelectedStatuses([]); setStatusFilter('all'); setClientPage(1); }}
                    className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
                  >
                    {language === 'ar' ? 'مسح' : 'Clear'}
                  </button>
                )}
              </div>

              {STATUSES_LIST.map(st => {
                const count = statusCounts[st.id] || 0;
                const isChecked = selectedStatuses.length > 0 ? selectedStatuses.includes(st.id) : (statusFilter === st.id);
                return (
                  <label
                    key={st.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs select-none transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          let newSelected = selectedStatuses.length > 0
                            ? [...selectedStatuses]
                            : (statusFilter !== 'all' ? [statusFilter] : []);
                          if (e.target.checked) {
                            if (!newSelected.includes(st.id)) newSelected.push(st.id);
                          } else {
                            newSelected = newSelected.filter(x => x !== st.id);
                          }
                          setSelectedStatuses(newSelected);
                          setStatusFilter(newSelected.length === 1 ? newSelected[0] : 'all');
                          setClientPage(1);
                        }}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-800">{language === 'ar' ? st.nameAr : st.nameEn}</span>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      count > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {count} {language === 'ar' ? 'بند' : (count === 1 ? 'line' : 'lines')}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1700px] mx-auto text-slate-800" dir={dir}>
      {/* ========================================================================= */}
      {/* 1. PAGE HEADER */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0 mt-0.5">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                {language === 'ar' ? 'الوثائق الإلكترونية بالتفصيل' : 'Detailed Electronic Documents'}
              </h1>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                environment === 'production'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {environment === 'production' ? 'ETA Production' : 'ETA PreProd'}
              </span>
              {lastSyncedAt && (
                <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>
                    {language === 'ar'
                      ? `آخر مزامنة: ${new Date(lastSyncedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })} - ${new Date(lastSyncedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                      : `Last Synced: ${new Date(lastSyncedAt).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              {language === 'ar'
                ? 'استعراض تفصيلي لكافة بنود وأصناف الوثائق (الواردة والصادرة) مكررة مع كل صف بدون صفوف إجمالية بينية'
                : 'Detailed view of document line items (Incoming & Outgoing) flattened per row with repeated document metadata'}
            </p>

            {/* Financial Badges */}
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold shadow-2xs">
                  {language === 'ar' ? 'إجمالي المبالغ' : 'Total Amount'}: {formatMoney(summaryTotals.lineTotal)} EGP
                </span>
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 font-bold shadow-2xs">
                  {language === 'ar' ? 'قيمة المبيعات' : 'Sales Total'}: {formatMoney(summaryTotals.salesTotal)} EGP
                </span>
                <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100 font-bold shadow-2xs">
                  {language === 'ar' ? 'إجمالي الخصومات' : 'Total Discounts'}: {formatMoney(summaryTotals.discountAmount)} EGP
                </span>
                <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100 font-bold shadow-2xs">
                  {language === 'ar' ? 'إجمالي الضرائب' : 'Total Tax'}: {formatMoney(summaryTotals.taxAmount)} EGP
                </span>
              </div>

              {/* Selected Items Calculation Bar */}
              {selectedRowKeys.length > 0 && (
                <div className="flex items-center gap-3 text-xs sm:text-sm animate-in slide-in-from-top-1 duration-200">
                  <span className="bg-zinc-100 text-zinc-700 px-3.5 py-1.5 rounded-full border border-zinc-200 font-bold flex flex-wrap items-center gap-1.5 shadow-xs">
                    <span>{language === 'ar' ? `مجموع المحدد (${selectedRowKeys.length} بند):` : `Selected (${selectedRowKeys.length} items):`}</span>
                    <span className="text-emerald-700">{language === 'ar' ? 'الإجمالي: ' : 'Total: '}{formatMoney(selectedTotals.lineTotal)}</span>
                    <span className="text-zinc-300 font-normal">/</span>
                    <span className="text-blue-700">{language === 'ar' ? 'المبيعات: ' : 'Sales: '}{formatMoney(selectedTotals.salesTotal)}</span>
                    <span className="text-zinc-300 font-normal">/</span>
                    <span className="text-red-650">{language === 'ar' ? 'الخصم: ' : 'Discount: '}{formatMoney(selectedTotals.discountAmount)}</span>
                    <span className="text-zinc-300 font-normal">/</span>
                    <span className="text-amber-700">{language === 'ar' ? 'الضريبة: ' : 'Tax: '}{formatMoney(selectedTotals.taxAmount)}</span>
                    <span className="text-zinc-500 font-mono text-[10px]">EGP</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedRowKeys([])}
                    className="text-xs text-rose-500 hover:text-rose-700 underline font-semibold cursor-pointer"
                  >
                    {language === 'ar' ? 'إلغاء التحديد' : 'Deselect'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Header Action Buttons: Export Buttons + Sync Button */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
          <ExportButtons 
            onExportExcel={() => handleExportExcel(false)} 
            onExportPDF={() => handleExportPDF(false)} 
            onPrint={() => printElement(tableContainerRef.current, language === 'ar' ? 'الوثائق الإلكترونية بالتفصيل' : 'Detailed Electronic Documents')}
            onExportExcelSelected={() => handleExportExcel(true)}
            onExportPDFSelected={() => handleExportPDF(true)}
            onPrintSelected={() => handlePrintSelected()}
            selectedCount={selectedRowKeys.length}
          />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || allLoading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
            title={language === 'ar' ? 'مزامنة وحفظ تفاصيل الوثائق والبنود من المنظومة' : 'Sync & Save documents and items from ETA'}
          >
            <RefreshCw className={`w-4 h-4 text-white ${refreshing || allLoading ? 'animate-spin' : ''}`} />
            <span>{language === 'ar' ? 'تحديث ومزامنة' : 'Refresh & Sync'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. VIEW MODE & DIRECTION TABS */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* View Mode: All Portal vs Period */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setViewMode('all_portal'); setClientPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
              viewMode === 'all_portal'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'ar' ? 'بحث في كافة الوثائق (كل ما على البوابة)' : 'All Portal Documents'}</span>
            {detailedLines.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                viewMode === 'all_portal' ? 'bg-indigo-800 text-white' : 'bg-slate-300 text-slate-800'
              }`}>
                {filteredLines.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setViewMode('period'); setClientPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
              viewMode === 'period'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{language === 'ar' ? 'بحث حسب الفترة / الشهر' : 'Search by Period'}</span>
          </button>
        </div>

        {/* Direction Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => { setDirectionFilter('all'); setClientPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              directionFilter === 'all'
                ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{language === 'ar' ? 'الكل' : 'All'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] text-slate-700">
              {directionCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setDirectionFilter('Received'); setClientPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              directionFilter === 'Received'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'الوثائق المستلمة' : 'Received'}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              directionFilter === 'Received' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {directionCounts.received}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setDirectionFilter('Sent'); setClientPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              directionFilter === 'Sent'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'الوثائق المرسلة' : 'Sent'}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              directionFilter === 'Sent' ? 'bg-sky-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {directionCounts.sent}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. FILTER BAR */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        {viewMode === 'period' ? (
          /* Period Mode Date Pickers */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'من تاريخ الإصدار' : 'From Issue Date'}</span>
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setClientPage(1); }}
                className="w-full text-xs md:text-sm px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'إلى تاريخ الإصدار' : 'To Issue Date'}</span>
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setClientPage(1); }}
                className="w-full text-xs md:text-sm px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
              />
            </div>

            {/* Document Type Filter */}
            {renderDocTypeFilter()}

            {/* Status Filter */}
            {renderStatusFilter()}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'بحث لحظي' : 'Quick Search'}</span>
              </label>
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setAppliedSearch(e.target.value);
                    setClientPage(1);
                  }}
                  placeholder={language === 'ar' ? 'رقم الفاتورة، الطرف، الصنف، الكود، UUID...' : 'ID, Partner, Item, Code, UUID...'}
                  className="w-full text-xs md:text-sm px-3.5 py-2 pr-9 pl-9 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
                />
                <button type="submit" className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-indigo-600">
                  <Search className="w-4 h-4" />
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setAppliedSearch(''); setClientPage(1); }}
                    className="absolute inset-y-0 left-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>
            </div>
          </div>
        ) : (
          /* All Portal Mode Filters */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            {/* Fiscal Years */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'ar' ? 'السنوات المالية' : 'Fiscal Years'}</span>
                </span>
                {selectedYears.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedYears([]); setClientPage(1); }}
                    className="text-[10px] text-indigo-600 hover:underline font-bold"
                  >
                    {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
                  </button>
                )}
              </label>

              <button
                type="button"
                onClick={() => { setShowYearDropdown(p => !p); setShowMonthDropdown(false); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs md:text-sm font-semibold text-slate-800 transition-all text-start cursor-pointer"
              >
                <span className="truncate">
                  {selectedYears.length === 0
                    ? (language === 'ar' ? 'كافة الأعوام' : 'All Years')
                    : selectedYears.length === 1
                    ? (language === 'ar' ? `عام ${selectedYears[0]}` : `Year ${selectedYears[0]}`)
                    : (language === 'ar' ? `${selectedYears.length} أعوام محددة` : `${selectedYears.length} Years`)}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showYearDropdown && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowYearDropdown(false)} />
                  <div className="absolute top-full right-0 mt-1.5 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-2 space-y-1 max-h-72 overflow-y-auto">
                    <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 px-2 pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => { setSelectedYears([]); setClientPage(1); }}
                        className={`font-bold ${selectedYears.length === 0 ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                      >
                        {language === 'ar' ? 'تحديد كافة الأعوام' : 'Select All Years'}
                      </button>
                      {selectedYears.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setSelectedYears([]); setClientPage(1); }}
                          className="text-[11px] text-rose-500 hover:underline font-semibold"
                        >
                          {language === 'ar' ? 'مسح' : 'Clear'}
                        </button>
                      )}
                    </div>
                    {allSystemYears.map(yr => {
                      const count = yearCounts[yr] || 0;
                      const isChecked = selectedYears.includes(yr);
                      return (
                        <label key={yr} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs select-none transition-colors">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedYears(prev => [...prev, yr]);
                                else setSelectedYears(prev => prev.filter(y => y !== yr));
                                setClientPage(1);
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span className="font-semibold text-slate-800">{yr}</span>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            count > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {count} {language === 'ar' ? 'بند' : 'lines'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Months */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'ar' ? 'الشهور' : 'Months'}</span>
                </span>
                {selectedMonths.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedMonths([]); setClientPage(1); }}
                    className="text-[10px] text-indigo-600 hover:underline font-bold"
                  >
                    {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
                  </button>
                )}
              </label>

              <button
                type="button"
                onClick={() => { setShowMonthDropdown(p => !p); setShowYearDropdown(false); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs md:text-sm font-semibold text-slate-800 transition-all text-start cursor-pointer"
              >
                <span className="truncate">
                  {selectedMonths.length === 0
                    ? (language === 'ar' ? 'كافة الشهور' : 'All Months')
                    : selectedMonths.length === 1
                    ? (() => {
                        const m = MONTHS_LIST.find(x => x.id === selectedMonths[0]);
                        return language === 'ar' ? m?.nameAr : m?.nameEn;
                      })()
                    : (language === 'ar' ? `${selectedMonths.length} شهور محددة` : `${selectedMonths.length} Months Selected`)}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showMonthDropdown && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowMonthDropdown(false)} />
                  <div className="absolute top-full right-0 mt-1.5 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-2 space-y-1 max-h-72 overflow-y-auto">
                    <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 px-2 pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => { setSelectedMonths([]); setClientPage(1); }}
                        className={`font-bold ${selectedMonths.length === 0 ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                      >
                        {language === 'ar' ? 'تحديد كافة الشهور' : 'Select All Months'}
                      </button>
                      {selectedMonths.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setSelectedMonths([]); setClientPage(1); }}
                          className="text-[11px] text-rose-500 hover:underline font-semibold"
                        >
                          {language === 'ar' ? 'مسح' : 'Clear'}
                        </button>
                      )}
                    </div>
                    {MONTHS_LIST.map(mo => {
                      const count = monthCounts[mo.id] || 0;
                      const isChecked = selectedMonths.includes(mo.id);
                      return (
                        <label key={mo.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs select-none transition-colors">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedMonths(prev => [...prev, mo.id]);
                                else setSelectedMonths(prev => prev.filter(m => m !== mo.id));
                                setClientPage(1);
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span className="font-semibold text-slate-800">{language === 'ar' ? mo.nameAr : mo.nameEn}</span>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            count > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {count} {language === 'ar' ? 'بند' : 'lines'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Document Type Filter */}
            {renderDocTypeFilter()}

            {/* Status Filter */}
            {renderStatusFilter()}

            {/* Quick Search */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'بحث لحظي في البنود' : 'Quick Search Lines'}</span>
              </label>
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setAppliedSearch(e.target.value);
                    setClientPage(1);
                  }}
                  placeholder={language === 'ar' ? 'رقم الفاتورة، الطرف، الصنف، الكود، الوصف...' : 'ID, Partner, Item, Code, Desc...'}
                  className="w-full text-xs md:text-sm px-3.5 py-2 pr-9 pl-9 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
                />
                <button type="submit" className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-indigo-600">
                  <Search className="w-4 h-4" />
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setAppliedSearch(''); setClientPage(1); }}
                    className="absolute inset-y-0 left-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3.1 ADVANCED AMOUNT SEARCH (البحث في القيمة المالية) */}
        {/* ========================================================================= */}
        <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span>{language === 'ar' ? 'البحث في القيمة:' : 'Search by Amount:'}</span>
            </div>

            {/* Field selection */}
            <div className="flex items-center gap-1">
              <select
                value={amountField}
                onChange={(e) => { setAmountField(e.target.value as any); setClientPage(1); }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-hidden shadow-2xs cursor-pointer"
              >
                <option value="line_total">{language === 'ar' ? 'إجمالي المبلغ' : 'Total Amount'}</option>
                <option value="sales_total">{language === 'ar' ? 'قيمة المبيعات' : 'Sales Total'}</option>
                <option value="tax_amount">{language === 'ar' ? 'الضرائب' : 'Taxes'}</option>
                <option value="unit_price">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</option>
              </select>
            </div>

            {/* Operator selection */}
            <div className="flex items-center gap-1">
              <select
                value={amountOperator}
                onChange={(e) => { setAmountOperator(e.target.value as any); setClientPage(1); }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-hidden shadow-2xs cursor-pointer"
              >
                <option value="all">{language === 'ar' ? 'بدون تصفية بالمبلغ' : 'No Amount Filter'}</option>
                <option value="eq">{language === 'ar' ? 'يساوي (=)' : 'Equals (=)'}</option>
                <option value="between">{language === 'ar' ? 'من - إلى (نطاق)' : 'Between (Range)'}</option>
                <option value="gt">{language === 'ar' ? 'أكبر من (>)' : 'Greater Than (>)'}</option>
                <option value="lt">{language === 'ar' ? 'أصغر من (<)' : 'Less Than (<)'}</option>
              </select>
            </div>

            {/* Amount Inputs */}
            {amountOperator !== 'all' && (
              <div className="flex items-center gap-2 flex-wrap animate-in fade-in duration-150">
                {amountOperator === 'between' ? (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500 font-medium">{language === 'ar' ? 'من:' : 'From:'}</span>
                      <input
                        type="number"
                        step="any"
                        value={amountValueFrom}
                        onChange={(e) => { setAmountValueFrom(e.target.value); setClientPage(1); }}
                        placeholder="0.00"
                        className="w-28 px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-hidden shadow-2xs"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500 font-medium">{language === 'ar' ? 'إلى:' : 'To:'}</span>
                      <input
                        type="number"
                        step="any"
                        value={amountValueTo}
                        onChange={(e) => { setAmountValueTo(e.target.value); setClientPage(1); }}
                        placeholder="0.00"
                        className="w-28 px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-hidden shadow-2xs"
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 font-medium">{language === 'ar' ? 'المبلغ:' : 'Amount:'}</span>
                    <input
                      type="number"
                      step="any"
                      value={amountValueFrom}
                      onChange={(e) => { setAmountValueFrom(e.target.value); setClientPage(1); }}
                      placeholder="0.00"
                      className="w-32 px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-hidden shadow-2xs"
                    />
                  </div>
                )}

                {(amountValueFrom || amountValueTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmountValueFrom('');
                      setAmountValueTo('');
                      setAmountOperator('all');
                      setClientPage(1);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 hover:underline font-semibold cursor-pointer px-1.5 py-1"
                    title={language === 'ar' ? 'إلغاء تصفية القيمة' : 'Clear amount filter'}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'إلغاء الفلتر' : 'Clear'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {amountOperator !== 'all' && (amountValueFrom || amountValueTo) && (
            <div className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 self-start lg:self-center">
              {language === 'ar'
                ? `تصفية حسب: ${amountField === 'sales_total' ? 'قيمة المبيعات' : amountField === 'tax_amount' ? 'الضرائب' : amountField === 'unit_price' ? 'سعر الوحدة' : 'إجمالي المبلغ'}`
                : `Filtering by amount`}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. INVOICE LINES TABLE */}
      {/* ========================================================================= */}
      {(() => {
        const renderPaginationBar = (position: 'top' | 'bottom') => {
          if (allLoading || filteredLines.length === 0) return null;

          const renderViewAndColumnControls = () => {
            if (position !== 'top') return null;
            return (
              <>
                {/* View Switcher: Table vs Cards */}
                <div className="flex bg-slate-200/70 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setView('table')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      view === 'table' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title={language === 'ar' ? 'عرض الجدول' : 'Table View'}
                  >
                    <List size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('card')}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      view === 'card' ? 'bg-white text-indigo-600 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title={language === 'ar' ? 'عرض الكروت' : 'Card View'}
                  >
                    <LayoutGrid size={16} />
                  </button>
                </div>

                {/* Column Customization Dropdown */}
                {view === 'table' && (
                  <div 
                    className="relative" 
                    ref={columnSelectorRef}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsColumnSelectorOpen(prev => !prev);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-2xs active:scale-95 cursor-pointer"
                    >
                      <Eye size={14} className="text-slate-400" />
                      <span>{language === 'ar' ? 'أعمدة الجدول' : 'Table Columns'}</span>
                      <ChevronDown size={14} className="text-slate-400" />
                    </button>

                    {isColumnSelectorOpen && (
                      <div 
                        className="absolute top-full mt-1.5 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 min-w-[260px] max-h-[340px] overflow-y-auto space-y-1 animate-in fade-in slide-in-from-top-2 duration-150 scrollbar-thin"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider pb-1.5 mb-1 border-b border-slate-100 flex items-center justify-between">
                          <span>{language === 'ar' ? 'تخصيص الأعمدة' : 'Customize Columns'}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVisibleColumns(defaultVisibleColumns);
                              if (user?.id) localStorage.setItem(`eta_detailed_visible_columns_${user.id}`, JSON.stringify(defaultVisibleColumns));
                            }}
                            className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
                          >
                            {language === 'ar' ? 'استعادة الافتراضي' : 'Reset'}
                          </button>
                        </div>
                        {Object.keys(defaultVisibleColumns).map((colKey) => (
                          <label 
                            key={colKey} 
                            className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100/80 p-2 rounded-xl transition-colors select-none"
                          >
                            <input
                              type="checkbox"
                              checked={visibleColumns[colKey] !== false}
                              onChange={() => {
                                const updated = {
                                  ...visibleColumns,
                                  [colKey]: !visibleColumns[colKey]
                                };
                                setVisibleColumns(updated);
                                if (user?.id) {
                                  localStorage.setItem(`eta_detailed_visible_columns_${user.id}`, JSON.stringify(updated));
                                }
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                            />
                            <span>{language === 'ar' ? columnLabels[colKey]?.ar : columnLabels[colKey]?.en}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          };

          return (
            <div className={`p-3.5 bg-slate-50/75 flex items-center justify-between gap-3 flex-wrap text-xs md:text-sm ${
              position === 'top' ? 'border-b border-slate-200/80' : 'border-t border-slate-200/80'
            }`}>
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <span className="font-bold text-slate-800 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-200/60">
                  {language === 'ar' ? `البنود: ${filteredLines.length}` : `Lines: ${filteredLines.length}`}
                </span>
                <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                  <span>{language === 'ar' ? 'النتائج لكل صفحة:' : 'Per page:'}</span>
                  <select
                    value={clientPageSize >= 99999 ? 'all' : clientPageSize}
                    onChange={e => {
                      const val = e.target.value;
                      setClientPageSize(val === 'all' ? 999999 : Number(val));
                      setClientPage(1);
                    }}
                    className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-hidden text-slate-800 cursor-pointer shadow-2xs"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000</option>
                    <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
                  </select>
                </div>

                {renderViewAndColumnControls()}

                {/* Export Excel Button */}
                <button
                  type="button"
                  onClick={() => handleExportExcel(false)}
                  disabled={filteredLines.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title={language === 'ar' ? 'تصدير كافة بنود الوثائق الحالية إلى إكسيل' : 'Export current lines to Excel'}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}</span>
                </button>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setClientPage(1)}
                  disabled={clientPage === 1}
                  className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 font-bold transition-all shadow-2xs cursor-pointer"
                  title={language === 'ar' ? 'الصفحة الأولى' : 'First'}
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setClientPage(p => Math.max(1, p - 1))}
                  disabled={clientPage === 1}
                  className="px-3 py-1 rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 font-bold transition-all shadow-2xs cursor-pointer"
                >
                  ‹
                </button>

                <div className="flex items-center gap-1">
                  {(() => {
                    const pages: (number | string)[] = [];
                    const maxButtons = 5;
                    let start = Math.max(1, clientPage - Math.floor(maxButtons / 2));
                    let end = Math.min(totalPages, start + maxButtons - 1);
                    if (end - start + 1 < maxButtons) {
                      start = Math.max(1, end - maxButtons + 1);
                    }
                    if (start > 1) {
                      pages.push(1);
                      if (start > 2) pages.push('...');
                    }
                    for (let p = start; p <= end; p++) pages.push(p);
                    if (end < totalPages) {
                      if (end < totalPages - 1) pages.push('...');
                      pages.push(totalPages);
                    }
                    return pages.map((p, idx) => {
                      if (typeof p === 'string') {
                        return <span key={`dots-${idx}`} className="px-1.5 text-slate-400 font-bold">...</span>;
                      }
                      return (
                        <button
                          key={`pg-${p}`}
                          type="button"
                          onClick={() => setClientPage(p)}
                          className={`w-8 h-8 rounded-xl font-bold text-xs transition-all shadow-2xs cursor-pointer ${
                            clientPage === p
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    });
                  })()}
                </div>

                <button
                  type="button"
                  onClick={() => setClientPage(p => Math.min(totalPages, p + 1))}
                  disabled={clientPage === totalPages}
                  className="px-3 py-1 rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 font-bold transition-all shadow-2xs cursor-pointer"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => setClientPage(totalPages)}
                  disabled={clientPage === totalPages}
                  className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 font-bold transition-all shadow-2xs cursor-pointer"
                  title={language === 'ar' ? 'الصفحة الأخيرة' : 'Last'}
                >
                  »
                </button>
              </div>
            </div>
          );
        };

        return (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {renderPaginationBar('top')}

            {allLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-slate-500">
                  {language === 'ar'
                    ? 'جاري جلب ومزامنة بنود الوثائق الإلكترونية المفصلة...'
                    : 'Loading detailed electronic document lines...'}
                </p>
              </div>
            ) : filteredLines.length === 0 ? (
              <div className="py-16 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
                  <Receipt className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-slate-800">
                  {detailedLines.length === 0 && !appliedSearch && !dateFrom && !dateTo
                    ? (language === 'ar' ? 'لا توجد بنود وثائق إلكترونية محفوظة حاليًا.' : 'No saved document lines found.')
                    : (language === 'ar' ? 'لا توجد بنود مطابقة' : 'No items found')}
                </h3>
                <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                  {detailedLines.length === 0 && !appliedSearch && !dateFrom && !dateTo
                    ? (language === 'ar'
                        ? 'اضغط على زر "تحديث" لبدء المزامنة وجلب الوثائق الإلكترونية من منظومة مصلحة الضرائب المصرية وحفظها محليًا.'
                        : 'Click "Refresh" to sync electronic documents from ETA into local storage.')
                    : (language === 'ar'
                        ? 'لم يتم العثور على بنود وثائق إلكترونية مطابقة للفلاتر المحددة. يمكنك تغيير خيارات البحث أو إعادة المحاولة.'
                        : 'No document lines found matching filters.')}
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {language === 'ar' ? 'تحديث' : 'Refresh'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* TOP SYNCHRONIZED SCROLLBAR */}
                {view === 'table' && (
                  <div
                    ref={topScrollRef}
                    onScroll={handleTopScroll}
                    dir={dir}
                    className="overflow-x-auto border-b border-slate-200/90 bg-slate-100/70 select-none scrollbar-thin"
                    style={{ height: '14px', minHeight: '14px' }}
                  >
                    <div style={{ width: `${tableScrollWidth}px`, minWidth: '100%', height: '1px' }} />
                  </div>
                )}

                {/* CARD VIEW */}
                {view === 'card' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-slate-50/50">
                    {paginatedLines.map((line) => {
                      const isSelected = selectedRowKeys.includes(line.rowKey);
                      return (
                        <div
                          key={line.rowKey}
                          data-rowkey={line.rowKey}
                          className={`bg-white rounded-2xl border p-4 transition-all shadow-2xs hover:shadow-md flex flex-col justify-between gap-3 ${
                            isSelected ? 'border-indigo-500 bg-indigo-50/20 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(line.rowKey)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                              />
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                <span>{line.internalId}</span>
                                {renderDocTypeBadge(line.typeName, line.documentTypeName)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {renderDirectionBadge(line.direction)}
                              {renderStatusBadge(line.status)}
                            </div>
                          </div>

                          {/* Item Details */}
                          <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                            <div className="font-bold text-slate-900 text-sm line-clamp-2" title={line.description}>
                              {line.description}
                            </div>
                            <div className="flex items-center justify-between text-slate-600 text-[11px]">
                              <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                                {line.itemType}: {line.itemCode}
                              </span>
                              <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                {line.quantity} {line.unitType}
                              </span>
                            </div>
                          </div>

                          {/* Partner & Date */}
                          <div className="space-y-1 text-xs text-slate-600">
                            <div className="flex justify-between">
                              <span className="text-slate-400">{language === 'ar' ? 'الطرف:' : 'Partner:'}</span>
                              <span className="font-semibold text-slate-800 truncate max-w-[170px]">{line.partnerName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">{language === 'ar' ? 'التاريخ:' : 'Date:'}</span>
                              <span>{formatDateTime(line.dateTimeIssued)}</span>
                            </div>
                          </div>

                          {/* Amounts */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-slate-400 block text-[10px]">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</span>
                              <span className="font-semibold text-slate-700">{formatAmount(line.unitPrice)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">{language === 'ar' ? 'الضرائب' : 'Tax'}</span>
                              <span className="font-semibold text-slate-600">{formatAmount(line.taxAmount)}</span>
                            </div>
                            <div className="text-end">
                              <span className="text-slate-400 block text-[10px] flex items-center justify-end gap-1">
                                <span>{language === 'ar' ? 'إجمالي البند' : 'Line Total'}</span>
                                <span className="text-indigo-600 font-mono font-bold">({line.currency || 'EGP'})</span>
                              </span>
                              <span className="font-bold text-slate-900 text-sm">{formatAmount(line.lineTotal)}</span>
                            </div>
                          </div>

                          {/* Footer UUID */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded">
                              <span className="truncate max-w-[80px]">{line.uuid.slice(0, 8)}...</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(line.uuid, line.rowKey)}
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                                title="Copy UUID"
                              >
                                {copiedUuid === line.rowKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceUuid(line.uuid)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'تفاصيل الوثيقة' : 'Document'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* TABLE VIEW */}
                <div ref={tableContainerRef} onScroll={handleTableScroll} dir={dir} className={`overflow-x-auto ${view !== 'table' ? 'hidden' : ''}`}>
                  <table className="w-full text-start border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/75 text-slate-600 font-bold">
                        <th className="py-3 px-4 text-center w-12 no-pdf whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                          />
                        </th>
                        {visibleColumns.internal_id && <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'رقم الفاتورة' : 'Invoice ID'}</th>}
                        {visibleColumns.direction && <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'الاتجاه' : 'Direction'}</th>}
                        {visibleColumns.type && <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'النوع' : 'Type'}</th>}
                        {visibleColumns.partner_name && <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'المورد / العميل' : 'Partner Name'}</th>}
                        {visibleColumns.tax_id && <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'الرقم الضريبي' : 'Tax ID'}</th>}
                        {visibleColumns.address && <th className="py-3 px-4 text-start whitespace-nowrap min-w-[150px]">{language === 'ar' ? 'العنوان' : 'Address'}</th>}
                        {visibleColumns.date_issued && <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</th>}
                        {visibleColumns.date_received && <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'تاريخ الاستلام' : 'Received Date'}</th>}
                        {visibleColumns.currency && <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'العملة' : 'Currency'}</th>}
                        {visibleColumns.item_code_name && <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'اسم الكود' : 'Code Name'}</th>}
                        {visibleColumns.item_code && <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'كود الصنف' : 'Item Code'}</th>}
                        {visibleColumns.item_type && <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'نوع الكود' : 'Code Type'}</th>}
                        {visibleColumns.item_description && <th className="py-3 px-4 text-start whitespace-nowrap min-w-[200px]">{language === 'ar' ? 'الوصف' : 'Description'}</th>}
                        {visibleColumns.item_quantity && <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'الكمية' : 'Quantity'}</th>}
                        {visibleColumns.item_unit && <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'الوحدة' : 'Unit'}</th>}
                        {visibleColumns.item_unit_price && <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>}
                        {visibleColumns.item_sales_total && <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'قيمة المبيعات' : 'Sales Total'}</th>}
                        {visibleColumns.item_discount && <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'الخصم' : 'Discount'}</th>}
                        {visibleColumns.item_tax && <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'الضرائب' : 'Taxes'}</th>}
                        {visibleColumns.item_total && <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'إجمالي المبلغ' : 'Total Amount'}</th>}
                        {visibleColumns.status && <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'الحالة' : 'Status'}</th>}
                        {visibleColumns.uuid && <th className="py-3 px-4 text-center whitespace-nowrap">UUID</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedLines.map((line) => {
                        const isSelected = selectedRowKeys.includes(line.rowKey);
                        return (
                          <tr
                            key={line.rowKey}
                            data-rowkey={line.rowKey}
                            className={`hover:bg-slate-50/80 transition-colors group ${isSelected ? 'bg-indigo-50/40' : ''}`}
                          >
                            {/* Checkbox */}
                            <td className="py-3.5 px-4 text-center no-pdf whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(line.rowKey)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                              />
                            </td>

                            {/* Internal ID */}
                            {visibleColumns.internal_id && (
                              <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                                {line.internalId}
                              </td>
                            )}

                            {/* Direction */}
                            {visibleColumns.direction && (
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                {renderDirectionBadge(line.direction)}
                              </td>
                            )}

                            {/* Document Type */}
                            {visibleColumns.type && (
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                {renderDocTypeBadge(line.typeName, line.documentTypeName)}
                              </td>
                            )}

                            {/* Partner Name */}
                            {visibleColumns.partner_name && (
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-slate-900 max-w-[180px] truncate" title={line.partnerName}>
                                  {line.partnerName}
                                </div>
                              </td>
                            )}

                            {/* Tax ID */}
                            {visibleColumns.tax_id && (
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-700">
                                  {line.taxId}
                                </span>
                              </td>
                            )}

                            {/* Address */}
                            {visibleColumns.address && (
                              <td className="py-3.5 px-4 text-slate-600 text-xs max-w-[170px] truncate" title={line.address}>
                                {line.address}
                              </td>
                            )}

                            {/* Issue Date */}
                            {visibleColumns.date_issued && (
                              <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                                {formatDateTime(line.dateTimeIssued)}
                              </td>
                            )}

                            {/* Received Date */}
                            {visibleColumns.date_received && (
                              <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                                {formatDateTime(line.dateTimeReceived)}
                              </td>
                            )}

                            {/* Currency */}
                            {visibleColumns.currency && (
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-700">
                                  {line.currency || 'EGP'}
                                </span>
                              </td>
                            )}

                            {/* Item Code Name (اسم الكود) */}
                            {visibleColumns.item_code_name && (
                              <td className="py-3.5 px-4 text-slate-700 max-w-[170px] truncate" title={line.itemCodeName}>
                                {line.itemCodeName || '---'}
                              </td>
                            )}

                            {/* Item Code (كود الصنف) */}
                            {visibleColumns.item_code && (
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 font-mono text-xs font-semibold text-slate-800">
                                  <span>{line.itemCode}</span>
                                </span>
                              </td>
                            )}

                            {/* Item Code Type (نوع الكود) */}
                            {visibleColumns.item_type && (
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/60 font-mono text-[11px] font-bold text-indigo-700">
                                  {line.itemType || 'EGS'}
                                </span>
                              </td>
                            )}

                            {/* Description (الوصف) */}
                            {visibleColumns.item_description && (
                              <td className="py-3.5 px-4 font-medium text-slate-900 max-w-[240px] truncate" title={line.description}>
                                {line.description}
                              </td>
                            )}

                            {/* Quantity (الكمية) */}
                            {visibleColumns.item_quantity && (
                              <td className="py-3.5 px-4 text-center whitespace-nowrap font-semibold text-slate-800">
                                <span className="font-mono text-indigo-700">{line.quantity}</span>
                              </td>
                            )}

                            {/* Unit (الوحدة) */}
                            {visibleColumns.item_unit && (
                              <td className="py-3.5 px-4 text-center whitespace-nowrap text-slate-600 font-medium">
                                {line.unitType ? (
                                  <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono text-xs text-slate-700">
                                    {line.unitType}
                                  </span>
                                ) : '-'}
                              </td>
                            )}

                            {/* Unit Price (سعر الوحدة) */}
                            {visibleColumns.item_unit_price && (
                              <td className="py-3.5 px-4 text-end font-medium text-slate-700 whitespace-nowrap">
                                {formatAmount(line.unitPrice)}
                              </td>
                            )}

                            {/* Sales Total (قيمة المبيعات) */}
                            {visibleColumns.item_sales_total && (
                              <td className="py-3.5 px-4 text-end font-medium text-slate-700 whitespace-nowrap">
                                {formatAmount(line.salesTotal)}
                              </td>
                            )}

                            {/* Discount (الخصم) */}
                            {visibleColumns.item_discount && (
                              <td className="py-3.5 px-4 text-end font-medium text-red-600 whitespace-nowrap">
                                {formatAmount(line.discountAmount)}
                              </td>
                            )}

                            {/* Taxes (الضرائب) */}
                            {visibleColumns.item_tax && (
                              <td className="py-3.5 px-4 text-end font-medium text-amber-700 whitespace-nowrap">
                                {formatAmount(line.taxAmount)}
                              </td>
                            )}

                            {/* Total Amount (إجمالي المبلغ) */}
                            {visibleColumns.item_total && (
                              <td className="py-3.5 px-4 text-end font-bold text-slate-900 whitespace-nowrap">
                                {formatAmount(line.lineTotal)}
                              </td>
                            )}

                            {/* Status Badge */}
                            {visibleColumns.status && (
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                {renderStatusBadge(line.status)}
                              </td>
                            )}

                            {/* UUID with click to open & copy */}
                            {visibleColumns.uuid && (
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg px-2.5 py-1 text-[11px] font-mono transition-all">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceUuid(line.uuid)}
                                    className="text-indigo-600 hover:text-indigo-800 font-bold underline decoration-indigo-300 hover:decoration-indigo-600 cursor-pointer flex items-center gap-1"
                                    title={language === 'ar' ? 'عرض تفاصيل المستند بالكامل كما بالمنظومة' : 'View full document'}
                                  >
                                    <FileText className="w-3.5 h-3.5 opacity-70" />
                                    <span className="truncate max-w-[95px]">{line.uuid.slice(0, 10)}...</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopy(line.uuid, line.rowKey);
                                    }}
                                    className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors cursor-pointer"
                                    title={language === 'ar' ? 'نسخ UUID' : 'Copy UUID'}
                                  >
                                    {copiedUuid === line.rowKey ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {renderPaginationBar('bottom')}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 5. DETAILS MODAL — ETA FULL DOCUMENT VIEW */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedInvoiceUuid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>{language === 'ar' ? 'مستند إلكتروني رقم:' : 'Document ID:'}</span>
                      <span className="font-mono text-indigo-600">
                        {fullInvoiceDetails?.internalId || fullInvoiceDetails?.document?.internalId || selectedInvoiceUuid.slice(0, 10)}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-md">
                      UUID: {selectedInvoiceUuid}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setSelectedInvoiceUuid(null); setFullInvoiceDetails(null); }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs md:text-sm">
                {modalDetailsLoading ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                    <p className="text-sm font-medium text-slate-500">
                      {language === 'ar' ? 'جاري جلب تفاصيل المستند من منظومة مصلحة الضرائب...' : 'Loading document details from ETA...'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Share URL Banner */}
                    <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        <span className="text-xs font-semibold text-indigo-900">
                          {language === 'ar' ? 'رابط مشاركة المستند المعتمد على بوابة مصلحة الضرائب' : 'Official ETA Document Portal Share Link'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const url = fullInvoiceDetails?.shareUrl || `https://invoicing.eta.gov.eg/documents/${selectedInvoiceUuid}`;
                            navigator.clipboard.writeText(url);
                            setCopiedShareUrl(true);
                            setTimeout(() => setCopiedShareUrl(false), 2000);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedShareUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedShareUrl ? (language === 'ar' ? 'تم النسخ!' : 'Copied!') : (language === 'ar' ? 'نسخ الرابط' : 'Copy Link')}</span>
                        </button>
                        {fullInvoiceDetails?.shareUrl && (
                          <a
                            href={fullInvoiceDetails.shareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>{language === 'ar' ? 'فتح بالبوابة' : 'Open in Portal'}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Issuer & Receiver Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Issuer */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {language === 'ar' ? 'بيانات المصدّر (البائع / المورد)' : 'Issuer Details'}
                        </div>
                        <div className="font-bold text-slate-900 text-sm">
                          {fullInvoiceDetails?.issuer?.name || fullInvoiceDetails?.rawDocument?.issuer?.name || '---'}
                        </div>
                        <div className="text-xs text-slate-600 font-mono">
                          {language === 'ar' ? 'الرقم الضريبي: ' : 'Tax ID: '}
                          {fullInvoiceDetails?.issuer?.id || fullInvoiceDetails?.rawDocument?.issuer?.id || '---'}
                        </div>
                      </div>

                      {/* Receiver */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {language === 'ar' ? 'بيانات المستلم (المشتري / العميل)' : 'Receiver Details'}
                        </div>
                        <div className="font-bold text-slate-900 text-sm">
                          {fullInvoiceDetails?.receiver?.name || fullInvoiceDetails?.rawDocument?.receiver?.name || '---'}
                        </div>
                        <div className="text-xs text-slate-600 font-mono">
                          {language === 'ar' ? 'الرقم الضريبي: ' : 'Tax ID: '}
                          {fullInvoiceDetails?.receiver?.id || fullInvoiceDetails?.rawDocument?.receiver?.id || '---'}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => { setSelectedInvoiceUuid(null); setFullInvoiceDetails(null); }}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
