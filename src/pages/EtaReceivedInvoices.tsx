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
  Building2,
  AlertTriangle,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Eye,
  SlidersHorizontal,
  X,
  ShieldAlert,
  ArrowDownToLine,
  Receipt,
  ExternalLink,
  Info,
  ArrowUpRight,
  ArrowDownLeft,
  Globe,
  ChevronDown,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { apiRequest } from '../services/dbService';
import { exportToExcel } from '../utils/excelUtils';

export interface EtaReceivedInvoice {
  uuid: string;
  submissionUuid?: string;
  longId?: string;
  internalId: string;
  typeName: string;
  documentTypeName: string;
  typeVersionName?: string;
  direction?: 'Sent' | 'Received';
  issuerId: string;
  issuerName: string;
  receiverId: string;
  receiverName: string;
  dateTimeIssued: string;
  dateTimeReceived: string;
  totalSales: number;
  totalDiscount: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: string;
  cancelRequestDate?: string | null;
  rejectRequestDate?: string | null;
  address?: string;
  issuerAddress?: string;
  receiverAddress?: string;
}

interface EtaSearchApiResponse {
  success: boolean;
  isConfigured: boolean;
  environment: 'preprod' | 'production';
  data: EtaReceivedInvoice[];
  pagination: {
    pageSize: number;
    continuationToken?: string | null;
    totalPages?: number;
    totalCount?: number;
  };
  filterSummary?: {
    direction: 'Received';
    documentType: string;
    issueDateFrom: string;
    issueDateTo: string;
  };
  error?: string;
  code?: string;
}

export function EtaReceivedInvoices() {
  const { language, dir } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { openTab } = useNavigation();

  // Date filters: default to last 29 days (ETA Search Documents API requires maximum 30 days interval)
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
  const [directionFilter, setDirectionFilter] = useState<'all' | 'Received' | 'Sent'>('all');
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<'all_portal' | 'period'>('all_portal');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

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

  // Data & State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<EtaReceivedInvoice[]>([]);
  const [allPortalInvoices, setAllPortalInvoices] = useState<EtaReceivedInvoice[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allFetched, setAllFetched] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(10);
  const [isConfigured, setIsConfigured] = useState(true);
  const [environment, setEnvironment] = useState<'preprod' | 'production'>('preprod');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pagination tokens history
  const [currentToken, setCurrentToken] = useState<string | undefined>(undefined);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [tokenHistory, setTokenHistory] = useState<string[]>([]);
  const [pageNumber, setPageNumber] = useState(1);

  // Details Modal
  const [selectedInvoice, setSelectedInvoice] = useState<EtaReceivedInvoice | null>(null);
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

  // Sync scroll width on updates and window resize
  useEffect(() => {
    const updateScrollWidth = () => {
      if (tableContainerRef.current) {
        setTableScrollWidth(tableContainerRef.current.scrollWidth);
      }
    };
    updateScrollWidth();
    const timer = setTimeout(updateScrollWidth, 120);
    window.addEventListener('resize', updateScrollWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateScrollWidth);
    };
  }, [invoices, allPortalInvoices, clientPage, clientPageSize, viewMode]);

  // When an invoice is opened in the modal, fetch full ETA details to enrich partner address live
  useEffect(() => {
    if (!selectedInvoice?.uuid) {
      setModalDetailsLoading(false);
      return;
    }

    let isMounted = true;
    setModalDetailsLoading(true);

    apiRequest<{ success: boolean; data: any }>(`/api/erp/eta/invoices/${encodeURIComponent(selectedInvoice.uuid)}/details`)
      .then(res => {
        if (!isMounted || !res?.data) return;

        const formatAddr = (addr: any) => {
          if (!addr) return '';
          if (typeof addr === 'string') return addr.trim();
          return [addr.buildingNumber, addr.street, addr.regionCity, addr.governate, addr.country].filter(Boolean).join('، ');
        };

        const issuerAddr = formatAddr(res.data.issuer?.address);
        const receiverAddr = formatAddr(res.data.receiver?.address);
        const resolvedAddr = (selectedInvoice.direction === 'Sent' ? receiverAddr : issuerAddr) || issuerAddr || receiverAddr;

        if (resolvedAddr) {
          setSelectedInvoice(prev => prev ? {
            ...prev,
            address: resolvedAddr,
            issuerAddress: issuerAddr,
            receiverAddress: receiverAddr
          } : null);

          const partnerTaxId = (selectedInvoice.direction === 'Sent' ? selectedInvoice.receiverId : selectedInvoice.issuerId) || selectedInvoice.issuerId;
          const updater = (list: EtaReceivedInvoice[]) =>
            list.map(inv => {
              const invPartner = (inv.direction === 'Sent' ? inv.receiverId : inv.issuerId) || inv.issuerId;
              if (invPartner === partnerTaxId || inv.uuid === selectedInvoice.uuid) {
                return {
                  ...inv,
                  address: resolvedAddr,
                  issuerAddress: issuerAddr,
                  receiverAddress: receiverAddr
                };
              }
              return inv;
            });
          setInvoices(updater);
          setAllPortalInvoices(updater);
        }
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
  }, [selectedInvoice?.uuid]);

  // Fetch all documents across the full portal history
  const fetchAllPortalInvoices = useCallback(async (isRefresh = false) => {
    if (!user?.company_id) return;
    try {
      setAllLoading(true);
      setErrorMessage(null);

      const queryParams = new URLSearchParams();
      if (directionFilter !== 'all') {
        queryParams.set('direction', directionFilter);
      }
      if (docTypeFilter !== 'all') {
        queryParams.set('documentType', docTypeFilter);
      }
      if (statusFilter !== 'all') {
        queryParams.set('status', statusFilter);
      }
      if (isRefresh) {
        queryParams.set('refresh', 'true');
      }

      const res = await apiRequest<{
        success: boolean;
        isConfigured: boolean;
        environment: 'preprod' | 'production';
        data: EtaReceivedInvoice[];
        totalCount: number;
      }>(`/eta/invoices/all?${queryParams.toString()}`, 'GET', undefined, 120000);

      if (res) {
        setIsConfigured(res.isConfigured !== false);
        setEnvironment(res.environment || 'production');
        setAllPortalInvoices(res.data || []);
        setAllFetched(true);
        setClientPage(1);
      }
    } catch (err: any) {
      console.error('Failed to load all portal invoices:', err);
      const msg = err.message || 'تعذر تحميل كافة وثائق البوابة.';
      setErrorMessage(msg);
      if (isRefresh) {
        showNotification(msg, 'error');
      }
    } finally {
      setAllLoading(false);
    }
  }, [user?.company_id, directionFilter, docTypeFilter, statusFilter, showNotification]);

  // Dynamic counts per year calculated directly from fetched documents
  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inv of allPortalInvoices) {
      const yr = (inv.dateTimeIssued || '').slice(0, 4);
      if (yr) {
        counts[yr] = (counts[yr] || 0) + 1;
      }
    }
    return counts;
  }, [allPortalInvoices]);

  // Dynamic counts per month
  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inv of allPortalInvoices) {
      const yr = (inv.dateTimeIssued || '').slice(0, 4);
      const mo = (inv.dateTimeIssued || '').slice(5, 7);
      if (selectedYears.length === 0 || selectedYears.includes(yr)) {
        if (mo) {
          counts[mo] = (counts[mo] || 0) + 1;
        }
      }
    }
    return counts;
  }, [allPortalInvoices, selectedYears]);

  // List of all system years (future upcoming down to 2020)
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

  // Filtered all portal invoices client-side
  const filteredAllInvoices = useMemo(() => {
    let list = allPortalInvoices;

    // Filter by selected years (if any chosen)
    if (selectedYears.length > 0) {
      const yrSet = new Set(selectedYears);
      list = list.filter(inv => yrSet.has((inv.dateTimeIssued || '').slice(0, 4)));
    }

    // Filter by selected months (if any chosen)
    if (selectedMonths.length > 0) {
      const moSet = new Set(selectedMonths);
      list = list.filter(inv => moSet.has((inv.dateTimeIssued || '').slice(5, 7)));
    }

    if (directionFilter !== 'all') {
      list = list.filter(inv => inv.direction === directionFilter);
    }
    if (docTypeFilter !== 'all') {
      list = list.filter(inv => inv.typeName === docTypeFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter(inv => inv.status === statusFilter);
    }
    if (!appliedSearch.trim()) return list;
    const q = appliedSearch.trim().toLowerCase();
    return list.filter(inv =>
      inv.internalId.toLowerCase().includes(q) ||
      inv.issuerName.toLowerCase().includes(q) ||
      inv.issuerId.toLowerCase().includes(q) ||
      inv.uuid.toLowerCase().includes(q) ||
      (inv.receiverName && inv.receiverName.toLowerCase().includes(q)) ||
      (inv.receiverId && inv.receiverId.toLowerCase().includes(q))
    );
  }, [allPortalInvoices, selectedYears, selectedMonths, directionFilter, docTypeFilter, statusFilter, appliedSearch]);

  const totalPagesAll = Math.ceil(filteredAllInvoices.length / clientPageSize) || 1;
  const paginatedAllInvoices = useMemo(() => {
    const start = (clientPage - 1) * clientPageSize;
    return filteredAllInvoices.slice(start, start + clientPageSize);
  }, [filteredAllInvoices, clientPage, clientPageSize]);

  // Fetch received invoices from Backend
  const fetchInvoices = useCallback(async (token?: string, isRefresh = false) => {
    if (!user?.company_id) {
      setLoading(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      const queryParams = new URLSearchParams();
      queryParams.set('pageSize', '20');
      if (directionFilter !== 'all') {
        queryParams.set('direction', directionFilter);
      }
      if (docTypeFilter && docTypeFilter !== 'all') {
        queryParams.set('documentType', docTypeFilter);
      }

      if (dateFrom) {
        queryParams.set('issueDateFrom', `${dateFrom}T00:00:00Z`);
      }
      if (dateTo) {
        queryParams.set('issueDateTo', `${dateTo}T23:59:59Z`);
      }
      if (statusFilter && statusFilter !== 'all') {
        queryParams.set('status', statusFilter);
      }
      if (token) {
        queryParams.set('continuationToken', token);
      }
      if (appliedSearch.trim()) {
        const cleanSearch = appliedSearch.trim();
        // Check if numeric (could be issuerId or internalId) or UUID format
        if (cleanSearch.length > 20 && cleanSearch.includes('-')) {
          queryParams.set('uuid', cleanSearch);
        } else if (/^\d+$/.test(cleanSearch)) {
          queryParams.set('issuerId', cleanSearch);
        } else {
          queryParams.set('internalId', cleanSearch);
        }
      }

      const res = await apiRequest<EtaSearchApiResponse>(
        `/eta/invoices/received?${queryParams.toString()}`,
        'GET'
      );

      if (res) {
        setIsConfigured(res.isConfigured !== false);
        setEnvironment(res.environment || 'preprod');

        if (res.isConfigured === false) {
          setInvoices([]);
          setNextToken(null);
        } else {
          setInvoices(res.data || []);
          setNextToken(res.pagination?.continuationToken || null);
        }
      }
    } catch (err: any) {
      console.error('Failed to load ETA received invoices:', err);
      const msg = err.message || 'تعذر الاتصال بمنظومة الفاتورة الإلكترونية ETA.';
      setErrorMessage(msg);
      if (isRefresh) {
        showNotification(msg, 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.company_id, dateFrom, dateTo, statusFilter, docTypeFilter, appliedSearch, showNotification]);

  // Initial ETA settings retrieval for environment accuracy
  useEffect(() => {
    if (!user?.company_id) return;
    apiRequest<any>('/company/eta-settings', 'GET')
      .then(settings => {
        if (settings) {
          if (settings.environment) {
            setEnvironment(settings.environment === 'production' ? 'production' : 'preprod');
          }
          if (settings.client_id && (settings.client_secret || settings.client_secret_configured)) {
            setIsConfigured(true);
          }
        }
      })
      .catch(err => console.warn('Could not load company ETA settings:', err));
  }, [user?.company_id]);

  // Fetch when in all_portal mode
  useEffect(() => {
    if (viewMode === 'all_portal') {
      fetchAllPortalInvoices(false);
    }
  }, [viewMode, fetchAllPortalInvoices]);

  // Filter changes for period mode
  useEffect(() => {
    if (viewMode === 'period') {
      setCurrentToken(undefined);
      setTokenHistory([]);
      setPageNumber(1);
      fetchInvoices(undefined, false);
    }
  }, [viewMode, dateFrom, dateTo, statusFilter, docTypeFilter, directionFilter, appliedSearch, fetchInvoices]);

  const handleRefresh = () => {
    if (viewMode === 'all_portal') {
      fetchAllPortalInvoices(true);
    } else {
      fetchInvoices(currentToken, true);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchQuery);
  };

  const handleNextPage = () => {
    if (nextToken) {
      setTokenHistory(prev => [...prev, currentToken || '']);
      setCurrentToken(nextToken);
      setPageNumber(prev => prev + 1);
      fetchInvoices(nextToken, false);
    }
  };

  const handlePrevPage = () => {
    if (tokenHistory.length > 0) {
      const newHistory = [...tokenHistory];
      const prevToken = newHistory.pop();
      setTokenHistory(newHistory);
      setCurrentToken(prevToken || undefined);
      setPageNumber(prev => Math.max(1, prev - 1));
      fetchInvoices(prevToken || undefined, false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUuid(id);
    showNotification(language === 'ar' ? 'تم نسخ الرمز إلى الحافظة' : 'Copied to clipboard', 'success');
    setTimeout(() => setCopiedUuid(null), 2000);
  };

  // Export invoices to Excel (.xlsx)
  const handleExportExcel = useCallback(() => {
    const listToExport = viewMode === 'all_portal' ? filteredAllInvoices : invoices;
    if (!listToExport || listToExport.length === 0) {
      showNotification(language === 'ar' ? 'لا توجد فواتير لتصديرها' : 'No invoices to export', 'warning');
      return;
    }

    const exportData = listToExport.map((inv, idx) => ({
      '#': idx + 1,
      [language === 'ar' ? 'رقم الفاتورة' : 'Invoice ID']: inv.internalId || '',
      [language === 'ar' ? 'الاتجاه' : 'Direction']:
        inv.direction === 'Sent'
          ? (language === 'ar' ? 'صادرة' : 'Sent')
          : (language === 'ar' ? 'واردة' : 'Received'),
      [language === 'ar' ? 'نوع الوثيقة' : 'Document Type']: inv.documentTypeName || inv.typeName || '',
      [language === 'ar' ? 'المورد / العميل' : 'Partner Name']:
        inv.direction === 'Sent'
          ? (inv.receiverName || inv.issuerName || '')
          : (inv.issuerName || inv.receiverName || ''),
      [language === 'ar' ? 'الرقم الضريبي' : 'Tax ID']:
        inv.direction === 'Sent'
          ? (inv.receiverId || inv.issuerId || '-')
          : (inv.issuerId || '-'),
      [language === 'ar' ? 'العنوان' : 'Address']: inv.address || inv.issuerAddress || inv.receiverAddress || '-',
      [language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date']: inv.dateTimeIssued
        ? new Date(inv.dateTimeIssued).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')
        : '-',
      [language === 'ar' ? 'تاريخ الاستلام' : 'Received Date']: inv.dateTimeReceived
        ? new Date(inv.dateTimeReceived).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')
        : '-',
      [language === 'ar' ? 'الصافي' : 'Net Amount']: inv.netAmount ?? 0,
      [language === 'ar' ? 'الضريبة' : 'Tax Amount']: inv.taxAmount ?? 0,
      [language === 'ar' ? 'الإجمالي' : 'Total Amount']: inv.totalAmount ?? 0,
      [language === 'ar' ? 'العملة' : 'Currency']: inv.currency || 'EGP',
      [language === 'ar' ? 'الحالة' : 'Status']: inv.status || '',
      'UUID': inv.uuid || ''
    }));

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    exportToExcel(exportData, {
      filename: `eta_invoices_${dateStr}`,
      sheetName: 'ETA Invoices'
    });

    showNotification(
      language === 'ar'
        ? `تم تصدير ${listToExport.length} فاتورة بنجاح إلى ملف إكسيل`
        : `Successfully exported ${listToExport.length} invoices to Excel`,
      'success'
    );
  }, [viewMode, filteredAllInvoices, invoices, language, showNotification]);

  // Status Badge Component
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
    if (s === 'submitted') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          {language === 'ar' ? 'مقدمة' : 'Submitted'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        {status}
      </span>
    );
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
    if (t === 'c' || (docTypeName && docTypeName.includes('دائن'))) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          {language === 'ar' ? 'إشعار دائن' : 'Credit Note'}
        </span>
      );
    }
    if (t === 'd' || (docTypeName && docTypeName.includes('مدين'))) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
          {language === 'ar' ? 'إشعار مدين' : 'Debit Note'}
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

  const formatCurrency = (val: number, curr = 'EGP') => {
    const num = Number(val) || 0;
    return `${num.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto text-slate-800" dir={dir}>
      {/* ========================================================================= */}
      {/* 1. PAGE HEADER */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0">
            <ArrowDownToLine className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                {language === 'ar' ? 'الفواتير الإلكترونية المستلمة' : 'Received Electronic Invoices'}
              </h1>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                environment === 'production'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {environment === 'production' ? 'ETA Production' : 'ETA PreProd'}
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              {language === 'ar'
                ? 'استعراض فوري ومباشر للفواتير الواردة للشركة على منظومة مصلحة الضرائب المصرية'
                : 'Live read-only view of incoming electronic invoices from Egyptian Tax Authority'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading || allLoading || !isConfigured}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 shadow-2xs"
            title={language === 'ar' ? 'تحديث البيانات من منظومة الضرائب' : 'Refresh from ETA'}
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${refreshing || allLoading ? 'animate-spin' : ''}`} />
            <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1.1 VIEW MODE & DIRECTION TABS (MATCHING ETA PORTAL) */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* View Mode: All Portal vs Period */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('all_portal')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
              viewMode === 'all_portal'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'ar' ? 'بحث في كافة الوثائق (كل ما على البوابة)' : 'All Portal Documents'}</span>
            {allPortalInvoices.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                viewMode === 'all_portal' ? 'bg-indigo-800 text-white' : 'bg-slate-300 text-slate-800'
              }`}>
                {filteredAllInvoices.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setViewMode('period')}
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

        {/* Direction Filter Tabs (الكل / الوثائق المستلمة / الوثائق المرسلة) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setDirectionFilter('all');
              setClientPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              directionFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'ar' ? 'الكل' : 'All'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDirectionFilter('Received');
              setClientPage(1);
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              directionFilter === 'Received'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'الوثائق المستلمة' : 'Received'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDirectionFilter('Sent');
              setClientPage(1);
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              directionFilter === 'Sent'
                ? 'bg-white text-sky-700 shadow-2xs'
                : 'text-slate-600 hover:text-sky-700'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'الوثائق المرسلة' : 'Sent'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. NOT CONFIGURED BANNER */}
      {/* ========================================================================= */}
      {!isConfigured && !loading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-base text-amber-950">
                {language === 'ar' ? 'لم يتم إعداد الربط مع منظومة ETA لهذه الشركة' : 'ETA Integration is not configured for this company'}
              </h3>
              <p className="text-xs md:text-sm text-amber-800 mt-1 leading-relaxed">
                {language === 'ar'
                  ? 'لعرض الفواتير المستلمة، يرجى إدخال بيانات الاعتماد (Client ID و Client Secret) واختيار البيئة من إعدادات الشركة.'
                  : 'To view incoming invoices, please provide ETA credentials (Client ID & Client Secret) in Company Settings.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openTab('company_settings', language === 'ar' ? 'إعدادات الشركة' : 'Company Settings')}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs md:text-sm font-bold shadow-sm transition-colors flex items-center gap-2 flex-shrink-0"
          >
            <Building2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'إعداد الربط الآن' : 'Configure ETA'}</span>
          </button>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* 3. ERROR MESSAGE BANNER */}
      {/* ========================================================================= */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex-shrink-0"
          >
            {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FILTERS & SEARCH BAR */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        {viewMode === 'period' ? (
          <>
            {/* Quick Period Presets */}
            <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'فترات سريعة:' : 'Quick Presets:'}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const end = new Date();
                  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
                  setDateFrom(start.toISOString().split('T')[0]);
                  setDateTo(end.toISOString().split('T')[0]);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  dateTo === defaultDates.to && dateFrom === defaultDates.from
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700'
                }`}
              >
                {language === 'ar' ? 'آخر 30 يوماً (الفترة الحالية)' : 'Last 30 Days'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateFrom('2026-07-01');
                  setDateTo('2026-07-30');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  dateFrom === '2026-07-01' && dateTo === '2026-07-30'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60'
                }`}
              >
                {language === 'ar' ? '📅 شهر يوليو 2026' : 'July 2026'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateFrom('2026-04-01');
                  setDateTo('2026-04-30');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  dateFrom === '2026-04-01' && dateTo === '2026-04-30'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700'
                }`}
              >
                {language === 'ar' ? 'شهر أبريل 2026' : 'April 2026'}
              </button>

              <span className="text-[11px] text-slate-400 mr-auto flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                {language === 'ar'
                  ? 'تسمح مصلحة الضرائب بالاستعلام في نطاق 30 يوماً كحد أقصى لكل عملية بحث.'
                  : 'ETA allows maximum 30 days window per search.'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
              {/* Issue Date From */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'ar' ? 'من تاريخ الإصدار' : 'From Issue Date'}</span>
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full text-xs md:text-sm px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
                />
              </div>

              {/* Issue Date To */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'ar' ? 'إلى تاريخ الإصدار' : 'To Issue Date'}</span>
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full text-xs md:text-sm px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
                />
              </div>

              {/* Document Type Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'ar' ? 'نوع الوثيقة' : 'Document Type'}</span>
                </label>
                <select
                  value={docTypeFilter}
                  onChange={e => setDocTypeFilter(e.target.value)}
                  className="w-full text-xs md:text-sm px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
                >
                  <option value="all">{language === 'ar' ? 'الكل (فواتير وإشعارات)' : 'All Documents'}</option>
                  <option value="i">{language === 'ar' ? 'فاتورة (Invoice)' : 'Invoice'}</option>
                  <option value="c">{language === 'ar' ? 'إشعار دائن (Credit Note)' : 'Credit Note'}</option>
                  <option value="d">{language === 'ar' ? 'إشعار مدين (Debit Note)' : 'Debit Note'}</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'ar' ? 'حالة الفاتورة' : 'Status'}</span>
                </label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full text-xs md:text-sm px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
                >
                  <option value="all">{language === 'ar' ? 'الكل (جميع الحالات)' : 'All Statuses'}</option>
                  <option value="Valid">{language === 'ar' ? 'صحيحة (Valid)' : 'Valid'}</option>
                  <option value="Invalid">{language === 'ar' ? 'غير صالحة (Invalid)' : 'Invalid'}</option>
                  <option value="Rejected">{language === 'ar' ? 'مرفوضة (Rejected)' : 'Rejected'}</option>
                  <option value="Cancelled">{language === 'ar' ? 'ملغاة (Cancelled)' : 'Cancelled'}</option>
                  <option value="Submitted">{language === 'ar' ? 'مقدمة (Submitted)' : 'Submitted'}</option>
                </select>
              </div>

              {/* Quick Search */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'ar' ? 'بحث برقم الفاتورة أو المورد' : 'Search by ID / Supplier'}</span>
                </label>
                <form onSubmit={handleSearchSubmit} className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={language === 'ar' ? 'رقم الفاتورة، الرقم الضريبي...' : 'Invoice ID, Tax ID...'}
                    className="w-full text-xs md:text-sm px-3.5 py-2 pr-9 pl-9 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
                  />
                  <button
                    type="submit"
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-indigo-600"
                    title={language === 'ar' ? 'بحث' : 'Search'}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setAppliedSearch('');
                      }}
                      className="absolute inset-y-0 left-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                      title={language === 'ar' ? 'مسح' : 'Clear'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </form>
              </div>
            </div>
          </>
        ) : (
          /* All Portal Mode Filters */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            {/* 1. قائمة الأعوام مع مربع صح */}
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
                onClick={() => {
                  setShowYearDropdown(p => !p);
                  setShowMonthDropdown(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs md:text-sm font-semibold text-slate-800 transition-all text-start"
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

              {/* Dropdown Menu */}
              {showYearDropdown && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowYearDropdown(false)} />
                  <div className="absolute top-full right-0 mt-1.5 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-2 space-y-1 max-h-72 overflow-y-auto">
                    {/* Header Controls */}
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
                        <label
                          key={yr}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs select-none transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedYears(prev => [...prev, yr]);
                                } else {
                                  setSelectedYears(prev => prev.filter(y => y !== yr));
                                }
                                setClientPage(1);
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span className="font-semibold text-slate-800">{yr}</span>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            count > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {count} {language === 'ar' ? 'وثيقة' : (count === 1 ? 'doc' : 'docs')}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* 2. قائمة الشهور مع مربع صح */}
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
                onClick={() => {
                  setShowMonthDropdown(p => !p);
                  setShowYearDropdown(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs md:text-sm font-semibold text-slate-800 transition-all text-start"
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

              {/* Dropdown Menu */}
              {showMonthDropdown && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowMonthDropdown(false)} />
                  <div className="absolute top-full right-0 mt-1.5 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-2 space-y-1 max-h-72 overflow-y-auto">
                    {/* Header Controls */}
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
                        <label
                          key={mo.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs select-none transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMonths(prev => [...prev, mo.id]);
                                } else {
                                  setSelectedMonths(prev => prev.filter(m => m !== mo.id));
                                }
                                setClientPage(1);
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span className="font-semibold text-slate-800">{language === 'ar' ? mo.nameAr : mo.nameEn}</span>
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            count > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {count} {language === 'ar' ? 'وثيقة' : (count === 1 ? 'doc' : 'docs')}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* 3. Document Type Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'نوع الوثيقة' : 'Document Type'}</span>
              </label>
              <select
                value={docTypeFilter}
                onChange={e => {
                  setDocTypeFilter(e.target.value);
                  setClientPage(1);
                }}
                className="w-full text-xs md:text-sm px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
              >
                <option value="all">{language === 'ar' ? 'الكل (فواتير وإشعارات)' : 'All Documents'}</option>
                <option value="i">{language === 'ar' ? 'فاتورة (Invoice)' : 'Invoice'}</option>
                <option value="c">{language === 'ar' ? 'إشعار دائن (Credit Note)' : 'Credit Note'}</option>
                <option value="d">{language === 'ar' ? 'إشعار مدين (Debit Note)' : 'Debit Note'}</option>
              </select>
            </div>

            {/* 4. Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'حالة الفاتورة' : 'Status'}</span>
              </label>
              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setClientPage(1);
                }}
                className="w-full text-xs md:text-sm px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
              >
                <option value="all">{language === 'ar' ? 'الكل (جميع الحالات)' : 'All Statuses'}</option>
                <option value="Valid">{language === 'ar' ? 'صحيحة (Valid)' : 'Valid'}</option>
                <option value="Invalid">{language === 'ar' ? 'غير صالحة (Invalid)' : 'Invalid'}</option>
                <option value="Rejected">{language === 'ar' ? 'مرفوضة (Rejected)' : 'Rejected'}</option>
                <option value="Cancelled">{language === 'ar' ? 'ملغاة (Cancelled)' : 'Cancelled'}</option>
                <option value="Submitted">{language === 'ar' ? 'مقدمة (Submitted)' : 'Submitted'}</option>
              </select>
            </div>

            {/* 5. Quick Search */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'بحث لحظي في كافة الوثائق' : 'Search All Documents'}</span>
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
                  placeholder={language === 'ar' ? 'رقم الفاتورة، اسم المورد، الرقم الضريبي، UUID...' : 'ID, Supplier, Tax ID, UUID...'}
                  className="w-full text-xs md:text-sm px-3.5 py-2 pr-9 pl-9 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
                />
                <button
                  type="submit"
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-indigo-600"
                  title={language === 'ar' ? 'بحث' : 'Search'}
                >
                  <Search className="w-4 h-4" />
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setAppliedSearch('');
                      setClientPage(1);
                    }}
                    className="absolute inset-y-0 left-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                    title={language === 'ar' ? 'مسح' : 'Clear'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. INVOICES TABLE */}
      {/* ========================================================================= */}
      {(() => {
        const currentDisplayInvoices = viewMode === 'all_portal' ? paginatedAllInvoices : invoices;
        const isCurrentLoading = viewMode === 'all_portal' ? allLoading : loading;
        const totalFound = viewMode === 'all_portal' ? filteredAllInvoices.length : invoices.length;

        const renderPaginationBar = (position: 'top' | 'bottom') => {
          if (isCurrentLoading || totalFound === 0) return null;

          return (
            <div className={`p-3.5 bg-slate-50/75 flex items-center justify-between gap-3 flex-wrap text-xs md:text-sm ${
              position === 'top' ? 'border-b border-slate-200/80' : 'border-t border-slate-200/80'
            }`}>
              {viewMode === 'all_portal' ? (
                <>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="font-bold text-slate-800 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-200/60">
                      {language === 'ar' ? `النتائج: ${filteredAllInvoices.length}` : `Results: ${filteredAllInvoices.length}`}
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

                    {/* Export to Excel Button */}
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      disabled={filteredAllInvoices.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title={language === 'ar' ? 'تصدير كافة النتائج الحالية إلى إكسيل' : 'Export current results to Excel'}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* First page button */}
                    <button
                      type="button"
                      onClick={() => setClientPage(1)}
                      disabled={clientPage === 1}
                      className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 font-bold transition-all shadow-2xs"
                      title={language === 'ar' ? 'الصفحة الأولى' : 'First'}
                    >
                      «
                    </button>
                    {/* Prev */}
                    <button
                      type="button"
                      onClick={() => setClientPage(p => Math.max(1, p - 1))}
                      disabled={clientPage === 1}
                      className="px-3 py-1 rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 font-bold transition-all shadow-2xs"
                    >
                      ‹
                    </button>

                    {/* Page numbers */}
                    {Array.from({ length: totalPagesAll }, (_, i) => i + 1)
                      .filter(p => Math.abs(p - clientPage) <= 2 || p === 1 || p === totalPagesAll)
                      .map((p, idx, arr) => (
                        <React.Fragment key={p}>
                          {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-slate-400">...</span>}
                          <button
                            type="button"
                            onClick={() => setClientPage(p)}
                            className={`w-7 h-7 rounded-xl text-xs font-bold transition-all ${
                              clientPage === p
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))}

                    {/* Next */}
                    <button
                      type="button"
                      onClick={() => setClientPage(p => Math.min(totalPagesAll, p + 1))}
                      disabled={clientPage >= totalPagesAll}
                      className="px-3 py-1 rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 font-bold transition-all shadow-2xs"
                    >
                      ›
                    </button>
                    {/* Last page button */}
                    <button
                      type="button"
                      onClick={() => setClientPage(totalPagesAll)}
                      disabled={clientPage >= totalPagesAll}
                      className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40 hover:bg-slate-50 font-bold transition-all shadow-2xs"
                      title={language === 'ar' ? 'الصفحة الأخيرة' : 'Last'}
                    >
                      »
                    </button>
                  </div>
                </>
              ) : (
                /* Period Mode Pagination */
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-slate-500 font-medium">
                      {language === 'ar'
                        ? `الصفحة ${pageNumber} — عرض ${invoices.length} فاتورة`
                        : `Page ${pageNumber} — showing ${invoices.length} invoices`}
                    </div>
                    {/* Export to Excel Button */}
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      disabled={invoices.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title={language === 'ar' ? 'تصدير كافة النتائج الحالية إلى إكسيل' : 'Export current results to Excel'}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrevPage}
                      disabled={tokenHistory.length === 0}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                      <span>{language === 'ar' ? 'السابق' : 'Previous'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextPage}
                      disabled={!nextToken}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>{language === 'ar' ? 'التالي' : 'Next'}</span>
                      <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        };

        return (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* 1. TOP PAGINATION BAR (المستطيل في أعلى الجدول) */}
            {renderPaginationBar('top')}

            {isCurrentLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-slate-500">
                  {viewMode === 'all_portal'
                    ? (language === 'ar' ? 'جاري جلب ومزامنة كافة وثائق البوابة عبر جميع الفترات...' : 'Loading all documents across all portal periods...')
                    : (language === 'ar' ? 'جاري جلب الفواتير الإلكترونية من منظومة مصلحة الضرائب...' : 'Loading invoices from ETA...')}
                </p>
              </div>
            ) : totalFound === 0 ? (
              <div className="py-16 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
                  <Receipt className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-slate-800">
                  {language === 'ar' ? 'لا توجد وثائق مطابقة' : 'No documents found'}
                </h3>
                <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                  {language === 'ar'
                    ? 'لم يتم العثور على وثائق إلكترونية مطابقة للفلاتر المحددة. يمكنك تغيير خيارات البحث أو إعادة المحاولة.'
                    : 'No documents found matching the filters. Try changing your search query or filters.'}
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="px-4 py-2 text-xs md:text-sm font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                  >
                    {language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* TOP SYNCHRONIZED SCROLLBAR (شريط التمرير الأفقي العلوي) */}
                <div
                  ref={topScrollRef}
                  onScroll={handleTopScroll}
                  dir={dir}
                  className="overflow-x-auto border-b border-slate-200/90 bg-slate-100/70 select-none scrollbar-thin"
                  style={{ height: '14px', minHeight: '14px' }}
                >
                  <div style={{ width: `${tableScrollWidth}px`, minWidth: '100%', height: '1px' }} />
                </div>

                <div ref={tableContainerRef} onScroll={handleTableScroll} dir={dir} className="overflow-x-auto">
                  <table className="w-full text-start border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/75 text-slate-600 font-bold">
                      <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'رقم الفاتورة' : 'Invoice ID'}</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'الاتجاه' : 'Direction'}</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'النوع' : 'Type'}</th>
                      <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'المورد / العميل' : 'Partner Name'}</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'الرقم الضريبي' : 'Tax ID'}</th>
                      <th className="py-3 px-4 text-start whitespace-nowrap min-w-[150px]">{language === 'ar' ? 'العنوان' : 'Address'}</th>
                      <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</th>
                      <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'تاريخ الاستلام' : 'Received Date'}</th>
                      <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'الصافي' : 'Net Amount'}</th>
                      <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'الضريبة' : 'Tax'}</th>
                      <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">UUID</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentDisplayInvoices.map((inv) => (
                      <tr key={inv.uuid} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Internal ID */}
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {inv.internalId}
                        </td>

                        {/* Direction */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {renderDirectionBadge(inv.direction)}
                        </td>

                        {/* Document Type */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {renderDocTypeBadge(inv.typeName, inv.documentTypeName)}
                        </td>

                        {/* Partner Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 max-w-[200px] truncate" title={inv.direction === 'Sent' ? (inv.receiverName || inv.issuerName) : inv.issuerName}>
                            {inv.direction === 'Sent' ? (inv.receiverName || 'عميل غير محدد') : (inv.issuerName || 'مورد غير محدد')}
                          </div>
                        </td>

                        {/* Tax ID */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-700">
                            {inv.direction === 'Sent' ? (inv.receiverId || inv.issuerId || '-') : (inv.issuerId || '-')}
                          </span>
                        </td>

                        {/* Address */}
                        <td className="py-3.5 px-4 text-slate-600 text-xs max-w-[180px] truncate" title={inv.address || inv.issuerAddress || inv.receiverAddress || '-'}>
                          {inv.address || inv.issuerAddress || inv.receiverAddress || '-'}
                        </td>

                        {/* Issue Date */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDateTime(inv.dateTimeIssued)}
                        </td>

                        {/* Received Date */}
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {formatDateTime(inv.dateTimeReceived)}
                        </td>

                    {/* Net Amount */}
                    <td className="py-3.5 px-4 text-end font-medium text-slate-700 whitespace-nowrap">
                      {formatCurrency(inv.netAmount, inv.currency)}
                    </td>

                    {/* Tax Amount */}
                    <td className="py-3.5 px-4 text-end font-medium text-slate-600 whitespace-nowrap">
                      {formatCurrency(inv.taxAmount, inv.currency)}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 text-end font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(inv.totalAmount, inv.currency)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {renderStatusBadge(inv.status)}
                    </td>

                    {/* UUID with copy */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg text-[11px] font-mono text-slate-600">
                        <span className="truncate max-w-[90px]">{inv.uuid.slice(0, 8)}...</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(inv.uuid, inv.uuid)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                          title={language === 'ar' ? 'نسخ UUID' : 'Copy UUID'}
                        >
                          {copiedUuid === inv.uuid ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors"
                        title={language === 'ar' ? 'عرض تفاصيل الفاتورة' : 'View Details'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'التفاصيل' : 'Details'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

            {/* BOTTOM PAGINATION BAR */}
            {renderPaginationBar('bottom')}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 7. DETAILS MODAL (READ-ONLY) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
              dir={dir}
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      {language === 'ar' ? 'تفاصيل الفاتورة الإلكترونية' : 'Electronic Invoice Details'}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-500 font-mono">
                        {selectedInvoice.internalId}
                      </p>
                      {modalDetailsLoading && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>{language === 'ar' ? 'جاري جلب تفاصيل العنوان...' : 'Loading address...'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Status and Type Banner */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-slate-400 block">{language === 'ar' ? 'نوع المستند' : 'Document Type'}</span>
                    <span className="font-bold text-sm text-slate-800">
                      {selectedInvoice.documentTypeName} (الإصدار {selectedInvoice.typeVersionName || '1.0'})
                    </span>
                  </div>
                  <div>{renderStatusBadge(selectedInvoice.status)}</div>
                </div>

                {/* Identification & UUID */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {language === 'ar' ? 'المعرفات الرسمية' : 'Official Identifiers'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-400 block mb-1">UUID</span>
                      <div className="font-mono text-slate-800 break-all flex items-center justify-between gap-2">
                        <span>{selectedInvoice.uuid}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedInvoice.uuid, 'modal_uuid')}
                          className="text-indigo-600 hover:text-indigo-800"
                          title="نسخ"
                        >
                          {copiedUuid === 'modal_uuid' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {selectedInvoice.submissionUuid && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                        <span className="text-slate-400 block mb-1">Submission UUID</span>
                        <div className="font-mono text-slate-800 break-all">
                          {selectedInvoice.submissionUuid}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Issuer and Receiver Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Issuer / Supplier */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-1">
                      {language === 'ar' ? 'المصدر (المورد)' : 'Issuer (Supplier)'}
                    </span>
                    <div className="font-bold text-sm text-slate-900">{selectedInvoice.issuerName}</div>
                    <div className="text-xs font-mono text-slate-600 mt-1">
                      {language === 'ar' ? 'الرقم الضريبي:' : 'Tax ID:'} {selectedInvoice.issuerId}
                    </div>
                    {(selectedInvoice.issuerAddress || selectedInvoice.address) && (
                      <div className="text-xs text-slate-600 mt-2 pt-2 border-t border-indigo-100 flex items-start gap-1">
                        <span className="font-semibold text-indigo-900 shrink-0">{language === 'ar' ? 'العنوان:' : 'Address:'}</span>
                        <span className="leading-relaxed">{selectedInvoice.issuerAddress || selectedInvoice.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Receiver / Our Company */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      {language === 'ar' ? 'المستلم (الشركة)' : 'Receiver (Recipient)'}
                    </span>
                    <div className="font-bold text-sm text-slate-900">
                      {selectedInvoice.receiverName || (user?.company_name || 'شركتنا')}
                    </div>
                    {selectedInvoice.receiverId && (
                      <div className="text-xs font-mono text-slate-600 mt-1">
                        {language === 'ar' ? 'الرقم الضريبي:' : 'Tax ID:'} {selectedInvoice.receiverId}
                      </div>
                    )}
                    {selectedInvoice.receiverAddress && (
                      <div className="text-xs text-slate-600 mt-2 pt-2 border-t border-slate-200/80 flex items-start gap-1">
                        <span className="font-semibold text-slate-700 shrink-0">{language === 'ar' ? 'العنوان:' : 'Address:'}</span>
                        <span className="leading-relaxed">{selectedInvoice.receiverAddress}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                    <span className="text-slate-500">{language === 'ar' ? 'تاريخ الإصدار:' : 'Issue Date:'}</span>
                    <span className="font-bold text-slate-800">{formatDateTime(selectedInvoice.dateTimeIssued)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                    <span className="text-slate-500">{language === 'ar' ? 'تاريخ الاستلام:' : 'Received Date:'}</span>
                    <span className="font-bold text-slate-800">{formatDateTime(selectedInvoice.dateTimeReceived)}</span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {language === 'ar' ? 'القيم المالية' : 'Financial Breakdown'}
                  </h4>
                  <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-xs">
                    {selectedInvoice.totalSales > 0 && (
                      <div className="flex justify-between text-slate-300">
                        <span>{language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</span>
                        <span>{formatCurrency(selectedInvoice.totalSales, selectedInvoice.currency)}</span>
                      </div>
                    )}
                    {selectedInvoice.totalDiscount > 0 && (
                      <div className="flex justify-between text-amber-300">
                        <span>{language === 'ar' ? 'إجمالي الخصم' : 'Total Discount'}</span>
                        <span>- {formatCurrency(selectedInvoice.totalDiscount, selectedInvoice.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-300">
                      <span>{language === 'ar' ? 'صافي المبلغ' : 'Net Amount'}</span>
                      <span>{formatCurrency(selectedInvoice.netAmount, selectedInvoice.currency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>{language === 'ar' ? 'إجمالي الضريبة' : 'Tax Amount'}</span>
                      <span>{formatCurrency(selectedInvoice.taxAmount, selectedInvoice.currency)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-700/80 flex justify-between font-bold text-base text-emerald-400">
                      <span>{language === 'ar' ? 'الإجمالي الكلي' : 'Total Amount'}</span>
                      <span>{formatCurrency(selectedInvoice.totalAmount, selectedInvoice.currency)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span>
                    {language === 'ar'
                      ? 'هذا المستند معروض للقراءة والمطابقة المباشرة من منظومة مصلحة الضرائب المصرية فقط (Read-Only).'
                      : 'This document is displayed in read-only mode directly from ETA servers.'}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs md:text-sm font-bold transition-colors"
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
