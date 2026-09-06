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
  Download,
  Printer,
  Share2,
  Link2,
  FileDown,
  Ban,
  ShieldCheck,
  List,
  LayoutGrid
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
  net_amount: true,
  tax_amount: true,
  total_amount: true,
  status: true,
  uuid: true,
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
  net_amount: { ar: 'الصافي', en: 'Net Amount' },
  tax_amount: { ar: 'الضريبة', en: 'Tax Amount' },
  total_amount: { ar: 'الإجمالي', en: 'Total Amount' },
  status: { ar: 'الحالة', en: 'Status' },
  uuid: { ar: 'UUID', en: 'UUID' },
};

export function EtaReceivedInvoices() {
  const { language, dir } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { openTab } = useNavigation();

  // Selection, View (Table vs Cards), and Column Visibility
  const [selectedUuids, setSelectedUuids] = useState<string[]>([]);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const columnSelectorRef = useRef<HTMLDivElement>(null);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = user?.id ? localStorage.getItem(`eta_visible_columns_${user.id}`) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        delete parsed.actions;
        if (parsed.currency === undefined) parsed.currency = true;
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

  // Amount filter state (البحث في القيمة المالية)
  const [amountField, setAmountField] = useState<'total_amount' | 'net_amount' | 'tax_amount'>('total_amount');
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
  const [invoices, setInvoices] = useState<EtaReceivedInvoice[]>([]);
  const [allPortalInvoices, setAllPortalInvoices] = useState<EtaReceivedInvoice[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allFetched, setAllFetched] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(10);
  const [isConfigured, setIsConfigured] = useState(true);
  const [environment, setEnvironment] = useState<'preprod' | 'production'>('preprod');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Pagination tokens history
  const [currentToken, setCurrentToken] = useState<string | undefined>(undefined);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [tokenHistory, setTokenHistory] = useState<string[]>([]);
  const [pageNumber, setPageNumber] = useState(1);

  // Details Modal & ETA Portal View
  const [selectedInvoice, setSelectedInvoice] = useState<EtaReceivedInvoice | null>(null);
  const [fullInvoiceDetails, setFullInvoiceDetails] = useState<any | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'summary' | 'details' | 'signatures'>('summary');
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
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

  // When an invoice is opened in the modal, fetch full ETA details to enrich partner address and items
  useEffect(() => {
    if (!selectedInvoice?.uuid) {
      setModalDetailsLoading(false);
      setFullInvoiceDetails(null);
      return;
    }

    let isMounted = true;
    setModalDetailsLoading(true);
    setFullInvoiceDetails(null);
    setModalActiveTab('summary');

    apiRequest<{ success: boolean; data: any }>(`/eta/invoices/${encodeURIComponent(selectedInvoice.uuid)}/details`)
      .then(res => {
        if (!isMounted || !res?.data) return;

        setFullInvoiceDetails(res.data);

        const formatAddr = (addr: any) => {
          if (!addr) return '';
          if (typeof addr === 'string') return addr.trim();
          return [addr.buildingNumber, addr.street, addr.regionCity, addr.city, addr.governate, addr.governorate, addr.country].filter(Boolean).join('، ');
        };

        const issuerAddr = formatAddr(res.data.issuer?.address);
        const receiverAddr = formatAddr(res.data.receiver?.address);
        const resolvedAddr = (selectedInvoice.direction === 'Sent' ? receiverAddr : issuerAddr) || issuerAddr || receiverAddr;

        setSelectedInvoice(prev => prev ? {
          ...prev,
          address: resolvedAddr || prev.address,
          issuerAddress: issuerAddr || prev.issuerAddress,
          receiverAddress: receiverAddr || prev.receiverAddress,
          longId: res.data.longId || prev.longId
        } : null);

        if (resolvedAddr) {
          const partnerTaxId = (selectedInvoice.direction === 'Sent' ? selectedInvoice.receiverId : selectedInvoice.issuerId) || selectedInvoice.issuerId;
          const updater = (list: EtaReceivedInvoice[]) =>
            list.map(inv => {
              const invPartner = (inv.direction === 'Sent' ? inv.receiverId : inv.issuerId) || inv.issuerId;
              if (invPartner === partnerTaxId || inv.uuid === selectedInvoice.uuid) {
                return {
                  ...inv,
                  address: resolvedAddr,
                  issuerAddress: issuerAddr,
                  receiverAddress: receiverAddr,
                  longId: inv.uuid === selectedInvoice.uuid ? (res.data.longId || inv.longId) : inv.longId
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

  // External Share URL builder
  const getExternalShareUrl = useCallback(() => {
    if (!selectedInvoice) return '';
    const portalHost = fullInvoiceDetails?.portalHost || (environment === 'production' ? 'invoicing.eta.gov.eg' : 'preprod.invoicing.eta.gov.eg');
    const longId = fullInvoiceDetails?.longId || selectedInvoice.longId;
    if (fullInvoiceDetails?.shareUrl) return fullInvoiceDetails.shareUrl;
    if (fullInvoiceDetails?.publicUrl) return fullInvoiceDetails.publicUrl;
    if (longId) {
      return `https://${portalHost}/documents/${encodeURIComponent(selectedInvoice.uuid)}/share/${longId}`;
    }
    return `https://${portalHost}/documents/${encodeURIComponent(selectedInvoice.uuid)}`;
  }, [selectedInvoice, fullInvoiceDetails, environment]);

  // Copy official ETA external share link
  const handleCopyShareLink = () => {
    const shareUrl = getExternalShareUrl();
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareUrl(true);
    showNotification(
      language === 'ar' 
        ? 'تم نسخ الرابط الخارجي المعتمد من مصلحة الضرائب المصرية بنجاح.' 
        : 'Official ETA external document share link copied to clipboard.',
      'success'
    );
    setTimeout(() => setCopiedShareUrl(false), 3000);
  };

  // Official Print Handler
  const handlePrintInvoice = async () => {
    if (!selectedInvoice?.uuid) return;
    setIsPdfLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const activeCompanyId = user?.company_id || '';
      const pdfUrl = `/api/erp/eta/invoices/${encodeURIComponent(selectedInvoice.uuid)}/pdf`;
      const response = await fetch(pdfUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-company-id': activeCompanyId
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const printWindow = window.open(blobUrl, '_blank');
        if (!printWindow) {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `ETA_Invoice_${selectedInvoice.internalId || selectedInvoice.uuid.slice(0, 8)}.pdf`;
          link.click();
        }
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Could not stream PDF, falling back to window.print():', err);
      window.print();
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Download official ETA PDF
  const handleDownloadPdf = async () => {
    if (!selectedInvoice?.uuid) return;
    setIsPdfLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const activeCompanyId = user?.company_id || '';
      const pdfUrl = `/api/erp/eta/invoices/${encodeURIComponent(selectedInvoice.uuid)}/pdf`;
      const response = await fetch(pdfUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-company-id': activeCompanyId
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ETA_Invoice_${selectedInvoice.internalId || selectedInvoice.uuid.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showNotification(language === 'ar' ? 'تم بدء تحميل المستند بصيغة PDF' : 'Downloading PDF invoice', 'success');
      } else {
        showNotification(language === 'ar' ? 'تعذر جلب ملف PDF من منظومة الضرائب مباشرة، يمكنك استخدام زر الطباعة.' : 'PDF download failed, please use Print.', 'warning');
      }
    } catch (e) {
      showNotification(language === 'ar' ? 'حدث خطأ أثناء تحميل ملف PDF' : 'Error downloading PDF', 'error');
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Download raw ETA JSON
  const handleDownloadJson = () => {
    if (!selectedInvoice) return;
    const jsonSource = fullInvoiceDetails?.rawDocument || fullInvoiceDetails || selectedInvoice;
    const jsonStr = JSON.stringify(jsonSource, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ETA_Document_${selectedInvoice.internalId || selectedInvoice.uuid.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showNotification(language === 'ar' ? 'تم تحميل ملف JSON الخام للمستند' : 'Downloaded raw JSON', 'success');
  };

  // Official Reject Prompt on ETA Portal
  const handleRejectInvoicePrompt = () => {
    const shareUrl = getExternalShareUrl();
    if (window.confirm(
      language === 'ar'
        ? 'هل ترغب في فتح بوابة منظومة الوثائق الإلكترونية لمصلحة الضرائب المصرية لتسجيل رفض الوثيقة رسمياً؟'
        : 'Do you want to open the official ETA Taxpayer Portal to reject this document?'
    )) {
      window.open(shareUrl, '_blank');
    }
  };

  // Fetch all documents across the full portal history (Received + Sent)
  const fetchAllPortalInvoices = useCallback(async (isRefresh = false) => {
    if (!user?.company_id) return;
    try {
      setAllLoading(true);
      setErrorMessage(null);

      const queryParams = new URLSearchParams();
      // In all_portal mode, we always fetch the full portal dataset once
      // allowing instant 0ms client-side switching between All, Received, and Sent
      if (isRefresh) {
        queryParams.set('refresh', 'true');
      }

      const res = await apiRequest<{
        success: boolean;
        isConfigured: boolean;
        environment: 'preprod' | 'production';
        data: EtaReceivedInvoice[];
        totalCount: number;
        lastSyncedAt?: string | null;
        syncedCount?: number;
      }>(`/eta/invoices/all?${queryParams.toString()}`, 'GET', undefined, 180000);

      if (res) {
        setIsConfigured(res.isConfigured !== false);
        setEnvironment(res.environment || 'production');
        setAllPortalInvoices(res.data || []);
        setAllFetched(true);
        setClientPage(1);
        if (res.lastSyncedAt) {
          setLastSyncedAt(res.lastSyncedAt);
        }
        if (isRefresh) {
          showNotification(
            language === 'ar'
              ? `تمت مزامنة وحفظ ${res.data?.length || 0} وثيقة بنجاح من منظومة الضرائب`
              : `Successfully synced & saved ${res.data?.length || 0} documents from ETA`,
            'success'
          );
        }
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
  }, [user?.company_id, language, showNotification]);

  // Dynamic counts for direction tabs (All / Received / Sent)
  const directionCounts = useMemo(() => {
    let received = 0;
    let sent = 0;
    for (const inv of allPortalInvoices) {
      if (inv.direction === 'Sent') {
        sent++;
      } else {
        received++;
      }
    }
    return {
      all: allPortalInvoices.length,
      received,
      sent
    };
  }, [allPortalInvoices]);

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

  // Dynamic counts per document type
  const docTypeCounts = useMemo(() => {
    const counts: Record<string, number> = { i: 0, ii: 0, ei: 0, c: 0, d: 0, ec: 0, ed: 0 };
    const source = viewMode === 'all_portal' ? allPortalInvoices : invoices;
    for (const inv of source) {
      const code = String(inv.typeName || '').toLowerCase();
      if (counts[code] !== undefined) {
        counts[code] = (counts[code] || 0) + 1;
      }
    }
    return counts;
  }, [allPortalInvoices, invoices, viewMode]);

  // Dynamic counts per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Valid: 0, Invalid: 0, Rejected: 0, Cancelled: 0, Submitted: 0 };
    const source = viewMode === 'all_portal' ? allPortalInvoices : invoices;
    for (const inv of source) {
      if (inv.status && counts[inv.status] !== undefined) {
        counts[inv.status] = (counts[inv.status] || 0) + 1;
      }
    }
    return counts;
  }, [allPortalInvoices, invoices, viewMode]);

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

  // Helper to match financial amount filter
  const matchesAmountFilter = useCallback((inv: EtaReceivedInvoice) => {
    if (amountOperator === 'all') return true;
    const fromVal = amountValueFrom.trim() !== '' ? Number(amountValueFrom.replace(/,/g, '')) : null;
    const toVal = amountValueTo.trim() !== '' ? Number(amountValueTo.replace(/,/g, '')) : null;

    const amt = amountField === 'net_amount'
      ? (Number(inv.netAmount) || 0)
      : amountField === 'tax_amount'
      ? (Number(inv.taxAmount) || 0)
      : (Number(inv.totalAmount) || 0);

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

    if (directionFilter === 'Received') {
      list = list.filter(inv => inv.direction !== 'Sent');
    } else if (directionFilter === 'Sent') {
      list = list.filter(inv => inv.direction === 'Sent');
    }
    if (selectedDocTypes.length > 0) {
      const lowerSelected = selectedDocTypes.map(s => s.toLowerCase());
      list = list.filter(inv => lowerSelected.includes(String(inv.typeName || '').toLowerCase()));
    } else if (docTypeFilter !== 'all') {
      list = list.filter(inv => String(inv.typeName || '').toLowerCase() === docTypeFilter.toLowerCase());
    }
    if (selectedStatuses.length > 0) {
      list = list.filter(inv => selectedStatuses.includes(inv.status));
    } else if (statusFilter !== 'all') {
      list = list.filter(inv => inv.status === statusFilter);
    }
    if (amountOperator !== 'all') {
      list = list.filter(matchesAmountFilter);
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
  }, [allPortalInvoices, selectedYears, selectedMonths, directionFilter, docTypeFilter, statusFilter, selectedDocTypes, selectedStatuses, amountOperator, matchesAmountFilter, appliedSearch]);

  const totalPagesAll = Math.ceil(filteredAllInvoices.length / clientPageSize) || 1;
  const paginatedAllInvoices = useMemo(() => {
    const start = (clientPage - 1) * clientPageSize;
    return filteredAllInvoices.slice(start, start + clientPageSize);
  }, [filteredAllInvoices, clientPage, clientPageSize]);

  // Period mode invoices with client-side amount filtering applied
  const filteredPeriodInvoices = useMemo(() => {
    let list = invoices;
    if (selectedDocTypes.length > 0) {
      const lowerSelected = selectedDocTypes.map(s => s.toLowerCase());
      list = list.filter(inv => lowerSelected.includes(String(inv.typeName || '').toLowerCase()));
    } else if (docTypeFilter !== 'all') {
      list = list.filter(inv => String(inv.typeName || '').toLowerCase() === docTypeFilter.toLowerCase());
    }
    if (selectedStatuses.length > 0) {
      list = list.filter(inv => selectedStatuses.includes(inv.status));
    } else if (statusFilter !== 'all') {
      list = list.filter(inv => inv.status === statusFilter);
    }
    if (amountOperator !== 'all') {
      list = list.filter(matchesAmountFilter);
    }
    return list;
  }, [invoices, selectedDocTypes, selectedStatuses, docTypeFilter, statusFilter, amountOperator, matchesAmountFilter]);

  const currentDisplayInvoices = useMemo(() => {
    return viewMode === 'all_portal' ? paginatedAllInvoices : filteredPeriodInvoices;
  }, [viewMode, paginatedAllInvoices, filteredPeriodInvoices]);

  // Financial summary totals based on all currently filtered documents
  const summaryTotals = useMemo(() => {
    const list = viewMode === 'all_portal' ? filteredAllInvoices : filteredPeriodInvoices;
    return list.reduce(
      (acc, inv) => {
        acc.totalAmount += Number(inv.totalAmount) || 0;
        acc.totalDiscount += Number(inv.totalDiscount) || 0;
        acc.netAmount += Number(inv.netAmount) || 0;
        acc.taxAmount += Number(inv.taxAmount) || 0;
        return acc;
      },
      { totalAmount: 0, totalDiscount: 0, netAmount: 0, taxAmount: 0 }
    );
  }, [viewMode, filteredAllInvoices, filteredPeriodInvoices]);

  // Financial summary totals for selected items
  const selectedTotals = useMemo(() => {
    const list = viewMode === 'all_portal' ? filteredAllInvoices : filteredPeriodInvoices;
    const selectedList = list.filter(inv => selectedUuids.includes(inv.uuid));
    return selectedList.reduce(
      (acc, inv) => {
        acc.totalAmount += Number(inv.totalAmount) || 0;
        acc.totalDiscount += Number(inv.totalDiscount) || 0;
        acc.netAmount += Number(inv.netAmount) || 0;
        acc.taxAmount += Number(inv.taxAmount) || 0;
        return acc;
      },
      { totalAmount: 0, totalDiscount: 0, netAmount: 0, taxAmount: 0 }
    );
  }, [viewMode, filteredAllInvoices, filteredPeriodInvoices, selectedUuids]);

  const isAllSelected = useMemo(() => {
    if (currentDisplayInvoices.length === 0) return false;
    return currentDisplayInvoices.every(inv => selectedUuids.includes(inv.uuid));
  }, [currentDisplayInvoices, selectedUuids]);

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedUuids(prev => prev.filter(id => !currentDisplayInvoices.some(inv => inv.uuid === id)));
    } else {
      const newIds = currentDisplayInvoices.map(inv => inv.uuid);
      setSelectedUuids(prev => Array.from(new Set([...prev, ...newIds])));
    }
  }, [isAllSelected, currentDisplayInvoices]);

  const handleToggleSelect = useCallback((uuid: string) => {
    setSelectedUuids(prev =>
      prev.includes(uuid) ? prev.filter(id => id !== uuid) : [...prev, uuid]
    );
  }, []);

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
      if (isRefresh) {
        queryParams.set('refresh', 'true');
      }
      if (directionFilter !== 'all') {
        queryParams.set('direction', directionFilter);
      }
      if (selectedDocTypes.length === 1) {
        queryParams.set('documentType', selectedDocTypes[0]);
      } else if (docTypeFilter && docTypeFilter !== 'all') {
        queryParams.set('documentType', docTypeFilter);
      }

      if (dateFrom) {
        queryParams.set('issueDateFrom', `${dateFrom}T00:00:00Z`);
      }
      if (dateTo) {
        queryParams.set('issueDateTo', `${dateTo}T23:59:59Z`);
      }
      if (selectedStatuses.length === 1) {
        queryParams.set('status', selectedStatuses[0]);
      } else if (statusFilter && statusFilter !== 'all') {
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

        if (res.isConfigured === false && (!res.data || res.data.length === 0)) {
          setInvoices([]);
          setNextToken(null);
        } else {
          setInvoices(res.data || []);
          setNextToken(res.pagination?.continuationToken || null);
        }
      }
    } catch (err: any) {
      console.error('Failed to load ETA received invoices:', err);
      const msg = err.message || 'تعذر جلب الوثائق الإلكترونية من البيانات المحلية.';
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
  }, [viewMode, dateFrom, dateTo, statusFilter, docTypeFilter, selectedDocTypes, selectedStatuses, directionFilter, appliedSearch, fetchInvoices]);

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
  const handleExportExcel = useCallback((onlySelected = false) => {
    const currentList = viewMode === 'all_portal' ? filteredAllInvoices : invoices;
    const listToExport = onlySelected
      ? currentList.filter(inv => selectedUuids.includes(inv.uuid))
      : currentList;

    if (!listToExport || listToExport.length === 0) {
      showNotification(language === 'ar' ? 'لا توجد وثائق لتصديرها' : 'No documents to export', 'warning');
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
      filename: onlySelected ? `eta_documents_selected_${dateStr}` : `eta_documents_${dateStr}`,
      sheetName: 'الوثائق الإلكترونية'
    });

    showNotification(
      language === 'ar'
        ? `تم تصدير ${listToExport.length} وثيقة بنجاح إلى ملف إكسيل`
        : `Successfully exported ${listToExport.length} documents to Excel`,
      'success'
    );
  }, [viewMode, filteredAllInvoices, invoices, selectedUuids, language, showNotification]);

  // Export to PDF
  const handleExportPDF = useCallback(async (onlySelected = false) => {
    const tableEl = tableContainerRef.current;
    if (!tableEl) return;

    try {
      const currentList = viewMode === 'all_portal' ? filteredAllInvoices : invoices;
      const list = onlySelected
        ? currentList.filter(inv => selectedUuids.includes(inv.uuid))
        : currentList;

      if (list.length === 0) {
        showNotification(language === 'ar' ? 'لا توجد وثائق لتصديرها' : 'No documents to export', 'warning');
        return;
      }

      if (onlySelected) {
        const cloned = tableEl.cloneNode(true) as HTMLElement;
        const rows = Array.from(cloned.querySelectorAll('tbody tr'));
        rows.forEach(r => {
          const rowUuid = r.getAttribute('data-uuid');
          if (rowUuid && !selectedUuids.includes(rowUuid)) {
            r.remove();
          }
        });
        await exportToPDF(cloned, {
          filename: `eta_documents_selected_${Date.now()}`,
          reportTitle: language === 'ar' ? 'الوثائق الإلكترونية المحددة' : 'Selected Electronic Documents',
          orientation: 'landscape'
        });
      } else {
        await exportToPDF(tableEl, {
          filename: `eta_documents_${Date.now()}`,
          reportTitle: language === 'ar' ? 'كافة الوثائق الإلكترونية' : 'All Electronic Documents',
          orientation: 'landscape'
        });
      }
    } catch (err) {
      console.error('PDF export error:', err);
      showNotification(language === 'ar' ? 'حدث خطأ أثناء تصدير PDF' : 'Error exporting PDF', 'error');
    }
  }, [viewMode, filteredAllInvoices, invoices, selectedUuids, language, showNotification]);

  // Direct Print for Selected
  const handlePrintSelected = useCallback(() => {
    if (selectedUuids.length === 0) return;
    const tableEl = tableContainerRef.current;
    if (!tableEl) return;
    const cloned = tableEl.cloneNode(true) as HTMLElement;
    const rows = Array.from(cloned.querySelectorAll('tbody tr'));
    rows.forEach(r => {
      const rowUuid = r.getAttribute('data-uuid');
      if (rowUuid && !selectedUuids.includes(rowUuid)) {
        r.remove();
      }
    });
    printElement(cloned, language === 'ar' ? 'الوثائق الإلكترونية المحددة' : 'Selected Electronic Documents');
  }, [selectedUuids, language]);

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

  const formatAmount = (val: number) => {
    const num = Number(val) || 0;
    return num.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatCurrency = (val: number, curr = 'EGP') => {
    const num = Number(val) || 0;
    return `${num.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
  };

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
                      {count} {language === 'ar' ? 'وثيقة' : (count === 1 ? 'doc' : 'docs')}
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
                      {count} {language === 'ar' ? 'وثيقة' : (count === 1 ? 'doc' : 'docs')}
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
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto text-slate-800" dir={dir}>
      {/* ========================================================================= */}
      {/* 1. PAGE HEADER */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0 mt-0.5">
            <ArrowDownToLine className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                {language === 'ar' ? 'الوثائق الإلكترونية' : 'Electronic Documents'}
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
                ? 'استعراض ومزامنة وحفظ فوري لكافة الوثائق (الواردة والصادرة) للشركة على منظومة مصلحة الضرائب المصرية'
                : 'Live synchronization & persistent storage of electronic documents (Incoming & Outgoing) from ETA'}
            </p>

            {/* Top Financial Badges (Matching Invoices page) */}
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold shadow-2xs">
                  {language === 'ar' ? 'إجمالي الوثائق' : 'Total Documents'}: {formatMoney(summaryTotals.totalAmount)} EGP
                </span>
                <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100 font-bold shadow-2xs">
                  {language === 'ar' ? 'إجمالي الخصومات' : 'Total Discounts'}: {formatMoney(summaryTotals.totalDiscount)} EGP
                </span>
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 font-bold shadow-2xs">
                  {language === 'ar' ? 'الصافي' : 'Net'}: {formatMoney(summaryTotals.netAmount)} EGP
                </span>
                <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100 font-bold shadow-2xs">
                  {language === 'ar' ? 'إجمالي الضرائب' : 'Total Tax'}: {formatMoney(summaryTotals.taxAmount)} EGP
                </span>
              </div>

              {/* Selected Items Calculation Bar */}
              {selectedUuids.length > 0 && (
                <div className="flex items-center gap-3 text-xs sm:text-sm animate-in slide-in-from-top-1 duration-200">
                  <span className="bg-zinc-100 text-zinc-700 px-3.5 py-1.5 rounded-full border border-zinc-200 font-bold flex flex-wrap items-center gap-1.5 shadow-xs">
                    <span>{language === 'ar' ? `مجموع المحدد (${selectedUuids.length}):` : `Selected (${selectedUuids.length}):`}</span>
                    <span className="text-emerald-700">{language === 'ar' ? 'الإجمالي: ' : 'Total: '}{formatMoney(selectedTotals.totalAmount)}</span>
                    <span className="text-zinc-300 font-normal">/</span>
                    <span className="text-red-650">{language === 'ar' ? 'الخصم: ' : 'Discount: '}{formatMoney(selectedTotals.totalDiscount)}</span>
                    <span className="text-zinc-300 font-normal">/</span>
                    <span className="text-blue-700">{language === 'ar' ? 'الصافي: ' : 'Net: '}{formatMoney(selectedTotals.netAmount)}</span>
                    <span className="text-zinc-300 font-normal">/</span>
                    <span className="text-amber-700">{language === 'ar' ? 'الضريبة: ' : 'Tax: '}{formatMoney(selectedTotals.taxAmount)}</span>
                    <span className="text-zinc-500 font-mono text-[10px]">EGP</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedUuids([])}
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
            onPrint={() => printElement(tableContainerRef.current, language === 'ar' ? 'الوثائق الإلكترونية' : 'Electronic Documents')}
            onExportExcelSelected={() => handleExportExcel(true)}
            onExportPDFSelected={() => handleExportPDF(true)}
            onPrintSelected={() => handlePrintSelected()}
            selectedCount={selectedUuids.length}
          />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || allLoading || (viewMode === 'period' && loading)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
            title={language === 'ar' ? 'مزامنة وحفظ الوثائق من منظومة مصلحة الضرائب' : 'Sync & Save documents from ETA'}
          >
            <RefreshCw className={`w-4 h-4 text-white ${refreshing || allLoading || (viewMode === 'period' && loading) ? 'animate-spin' : ''}`} />
            <span>{language === 'ar' ? 'تحديث ومزامنة' : 'Refresh & Sync'}</span>
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
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setDirectionFilter('all');
              setClientPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              directionFilter === 'all'
                ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200 ring-1 ring-indigo-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>{language === 'ar' ? 'الكل' : 'All'}</span>
            {allFetched && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                directionFilter === 'all' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200/80 text-slate-700'
              }`}>
                {directionCounts.all}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setDirectionFilter('Received');
              setClientPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              directionFilter === 'Received'
                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200 ring-1 ring-emerald-200'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'ar' ? 'الوثائق المستلمة' : 'Received'}</span>
            {allFetched && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                directionFilter === 'Received' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/80 text-slate-700'
              }`}>
                {directionCounts.received}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setDirectionFilter('Sent');
              setClientPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              directionFilter === 'Sent'
                ? 'bg-white text-sky-700 shadow-sm border border-sky-200 ring-1 ring-sky-200'
                : 'text-slate-600 hover:text-sky-700'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-sky-600" />
            <span>{language === 'ar' ? 'الوثائق المرسلة' : 'Sent'}</span>
            {allFetched && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                directionFilter === 'Sent' ? 'bg-sky-100 text-sky-800' : 'bg-slate-200/80 text-slate-700'
              }`}>
                {directionCounts.sent}
              </span>
            )}
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
                {(allPortalInvoices.length > 0 || invoices.length > 0)
                  ? (language === 'ar' ? 'تم إلغاء الربط مع منظومة ETA (يتم استعراض البيانات المسجلة مسبقاً)' : 'ETA Integration Disconnected (Browsing previously recorded documents)')
                  : (language === 'ar' ? 'لم يتم إعداد الربط مع منظومة ETA لهذه الشركة' : 'ETA Integration is not configured for this company')}
              </h3>
              <p className="text-xs md:text-sm text-amber-800 mt-1 leading-relaxed">
                {(allPortalInvoices.length > 0 || invoices.length > 0)
                  ? (language === 'ar'
                      ? 'يتم الآن استعراض الوثائق والفواتير الإلكترونية المسجلة والمحفوظة مسبقاً. لإجراء المزامنة المباشرة مع مصلحة الضرائب، يرجى تفعيل مفاتيح الربط من إعدادات الشركة.'
                      : 'Displaying previously saved electronic documents. To perform live synchronization with ETA, please configure your credentials in Company Settings.')
                  : (language === 'ar'
                      ? 'لعرض الوثائق الإلكترونية المستلمة، يرجى إدخال بيانات الاعتماد (Client ID و Client Secret) واختيار البيئة من إعدادات الشركة.'
                      : 'To view incoming electronic documents, please provide ETA credentials (Client ID & Client Secret) in Company Settings.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openTab('company_settings', language === 'ar' ? 'إعدادات الشركة' : 'Company Settings')}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs md:text-sm font-bold shadow-sm transition-colors flex items-center gap-2 flex-shrink-0"
          >
            <Building2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'إعدادات الربط' : 'Configure ETA'}</span>
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
              {renderDocTypeFilter()}

              {/* Status Filter */}
              {renderStatusFilter()}

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
            {renderDocTypeFilter()}

            {/* 4. Status Filter */}
            {renderStatusFilter()}

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

        {/* ========================================================================= */}
        {/* 4.1 ADVANCED AMOUNT SEARCH (البحث في القيمة المالية) */}
        {/* ========================================================================= */}
        <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span>{language === 'ar' ? 'البحث في القيمة:' : 'Search by Amount:'}</span>
            </div>

            {/* اختيار نوع القيمة: الصافي - الضريبة - الإجمالي */}
            <div className="flex items-center gap-1">
              <select
                value={amountField}
                onChange={(e) => {
                  setAmountField(e.target.value as any);
                  setClientPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-hidden shadow-2xs cursor-pointer"
              >
                <option value="total_amount">{language === 'ar' ? 'الإجمالي (Total)' : 'Total Amount'}</option>
                <option value="net_amount">{language === 'ar' ? 'الصافي (Net)' : 'Net Amount'}</option>
                <option value="tax_amount">{language === 'ar' ? 'الضريبة (Tax)' : 'Tax Amount'}</option>
              </select>
            </div>

            {/* اختيار شرط المقارنة: يساوي - من إلى - أكبر من - أصغر من */}
            <div className="flex items-center gap-1">
              <select
                value={amountOperator}
                onChange={(e) => {
                  setAmountOperator(e.target.value as any);
                  setClientPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-hidden shadow-2xs cursor-pointer"
              >
                <option value="all">{language === 'ar' ? 'بدون تصفية بالمبلغ' : 'No Amount Filter'}</option>
                <option value="eq">{language === 'ar' ? 'يساوي (=)' : 'Equals (=)'}</option>
                <option value="between">{language === 'ar' ? 'من - إلى (نطاق)' : 'Between (Range)'}</option>
                <option value="gt">{language === 'ar' ? 'أكبر من (>)' : 'Greater Than (>)'}</option>
                <option value="lt">{language === 'ar' ? 'أصغر من (<)' : 'Less Than (<)'}</option>
              </select>
            </div>

            {/* حقول إدخال المبلغ */}
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
                        onChange={(e) => {
                          setAmountValueFrom(e.target.value);
                          setClientPage(1);
                        }}
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
                        onChange={(e) => {
                          setAmountValueTo(e.target.value);
                          setClientPage(1);
                        }}
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
                      onChange={(e) => {
                        setAmountValueFrom(e.target.value);
                        setClientPage(1);
                      }}
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
                ? `تصفية حسب: ${amountField === 'net_amount' ? 'الصافي' : amountField === 'tax_amount' ? 'الضريبة' : 'الإجمالي'}`
                : `Filtering by: ${amountField === 'net_amount' ? 'Net' : amountField === 'tax_amount' ? 'Tax' : 'Total'}`}
            </div>
          )}
        </div>
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

                {/* Column Customization Dropdown (أعمدة الجدول) */}
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
                        className="absolute top-full mt-1.5 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 min-w-[240px] max-h-[320px] overflow-y-auto space-y-1 animate-in fade-in slide-in-from-top-2 duration-150 scrollbar-thin"
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
                              if (user?.id) localStorage.setItem(`eta_visible_columns_${user.id}`, JSON.stringify(defaultVisibleColumns));
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
                                  localStorage.setItem(`eta_visible_columns_${user.id}`, JSON.stringify(updated));
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
              {viewMode === 'all_portal' ? (
                <>
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
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

                    {renderViewAndColumnControls()}

                    {/* Export to Excel Button */}
                    <button
                      type="button"
                      onClick={() => handleExportExcel(false)}
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

                    {renderViewAndColumnControls()}

                    {/* Export to Excel Button */}
                    <button
                      type="button"
                      onClick={() => handleExportExcel(false)}
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
                    ? (language === 'ar' ? 'جاري جلب الوثائق الإلكترونية المحفوظة...' : 'Loading saved electronic documents...')
                    : (language === 'ar' ? 'جاري جلب الوثائق الإلكترونية المحفوظة...' : 'Loading saved electronic documents...')}
                </p>
              </div>
            ) : totalFound === 0 ? (
              <div className="py-16 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
                  <Receipt className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-base text-slate-800">
                  {allPortalInvoices.length === 0 && !appliedSearch && !dateFrom && !dateTo
                    ? (language === 'ar' ? 'لا توجد وثائق إلكترونية مستلمة محفوظة حاليًا.' : 'No saved electronic documents found.')
                    : (language === 'ar' ? 'لا توجد وثائق مطابقة' : 'No documents found')}
                </h3>
                <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                  {allPortalInvoices.length === 0 && !appliedSearch && !dateFrom && !dateTo
                    ? (language === 'ar'
                        ? 'اضغط على زر "تحديث" لبدء المزامنة وجلب الوثائق الإلكترونية من منظومة مصلحة الضرائب المصرية وحفظها محليًا.'
                        : 'Click "Refresh" to sync electronic documents from ETA into local storage.')
                    : (language === 'ar'
                        ? 'لم يتم العثور على وثائق إلكترونية مطابقة للفلاتر المحددة. يمكنك تغيير خيارات البحث أو إعادة المحاولة.'
                        : 'No documents found matching the filters. Try changing your search query or filters.')}
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
                {/* TOP SYNCHRONIZED SCROLLBAR (شريط التمرير الأفقي العلوي) */}
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
                    {currentDisplayInvoices.map((inv) => {
                      const isSelected = selectedUuids.includes(inv.uuid);
                      return (
                        <div
                          key={inv.uuid}
                          data-uuid={inv.uuid}
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
                                onChange={() => handleToggleSelect(inv.uuid)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                              />
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                <span>{inv.internalId}</span>
                                {renderDocTypeBadge(inv.typeName, inv.documentTypeName)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {renderDirectionBadge(inv.direction)}
                              {renderStatusBadge(inv.status)}
                            </div>
                          </div>

                          {/* Card Details */}
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500">{language === 'ar' ? 'الطرف:' : 'Partner:'}</span>
                              <span className="font-bold text-slate-800 truncate max-w-[180px]" title={inv.direction === 'Sent' ? (inv.receiverName || inv.issuerName) : inv.issuerName}>
                                {inv.direction === 'Sent' ? (inv.receiverName || 'عميل غير محدد') : (inv.issuerName || 'مورد غير محدد')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500">{language === 'ar' ? 'الرقم الضريبي:' : 'Tax ID:'}</span>
                              <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                {inv.direction === 'Sent' ? (inv.receiverId || inv.issuerId || '-') : (inv.issuerId || '-')}
                              </span>
                            </div>
                            {(inv.address || inv.issuerAddress || inv.receiverAddress) && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500">{language === 'ar' ? 'العنوان:' : 'Address:'}</span>
                                <span className="text-slate-600 truncate max-w-[180px]">
                                  {inv.address || inv.issuerAddress || inv.receiverAddress}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-500">{language === 'ar' ? 'تاريخ الإصدار:' : 'Issue Date:'}</span>
                              <span className="text-slate-600">{formatDateTime(inv.dateTimeIssued)}</span>
                            </div>
                          </div>

                          {/* Card Amounts */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-slate-400 block text-[10px]">{language === 'ar' ? 'الصافي' : 'Net'}</span>
                              <span className="font-semibold text-slate-700">{formatAmount(inv.netAmount)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">{language === 'ar' ? 'الضريبة' : 'Tax'}</span>
                              <span className="font-semibold text-slate-600">{formatAmount(inv.taxAmount)}</span>
                            </div>
                            <div className="text-end">
                              <span className="text-slate-400 block text-[10px] flex items-center justify-end gap-1">
                                <span>{language === 'ar' ? 'الإجمالي' : 'Total'}</span>
                                <span className="text-indigo-600 font-mono font-bold">({inv.currency || 'EGP'})</span>
                              </span>
                              <span className="font-bold text-slate-900 text-sm">{formatAmount(inv.totalAmount)}</span>
                            </div>
                          </div>

                          {/* Card Footer Actions */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded">
                              <span className="truncate max-w-[80px]">{inv.uuid.slice(0, 8)}...</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(inv.uuid, inv.uuid)}
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                                title={language === 'ar' ? 'نسخ UUID' : 'Copy UUID'}
                              >
                                {copiedUuid === inv.uuid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice(inv)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{language === 'ar' ? 'التفاصيل' : 'Details'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* TABLE VIEW (always in DOM so tableContainerRef is available for PDF export & print) */}
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
                      {visibleColumns.net_amount && <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'الصافي' : 'Net Amount'}</th>}
                      {visibleColumns.tax_amount && <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'الضريبة' : 'Tax'}</th>}
                      {visibleColumns.total_amount && <th className="py-3 px-4 text-end whitespace-nowrap">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>}
                      {visibleColumns.status && <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'الحالة' : 'Status'}</th>}
                      {visibleColumns.uuid && <th className="py-3 px-4 text-center whitespace-nowrap">UUID</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentDisplayInvoices.map((inv) => (
                      <tr key={inv.uuid} data-uuid={inv.uuid} className={`hover:bg-slate-50/80 transition-colors group ${selectedUuids.includes(inv.uuid) ? 'bg-indigo-50/40' : ''}`}>
                        {/* Checkbox */}
                        <td className="py-3.5 px-4 text-center no-pdf whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedUuids.includes(inv.uuid)}
                            onChange={() => handleToggleSelect(inv.uuid)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                          />
                        </td>

                        {/* Internal ID */}
                        {visibleColumns.internal_id && (
                          <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {inv.internalId}
                          </td>
                        )}

                        {/* Direction */}
                        {visibleColumns.direction && (
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {renderDirectionBadge(inv.direction)}
                          </td>
                        )}

                        {/* Document Type */}
                        {visibleColumns.type && (
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {renderDocTypeBadge(inv.typeName, inv.documentTypeName)}
                          </td>
                        )}

                        {/* Partner Name */}
                        {visibleColumns.partner_name && (
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 max-w-[200px] truncate" title={inv.direction === 'Sent' ? (inv.receiverName || inv.issuerName) : inv.issuerName}>
                              {inv.direction === 'Sent' ? (inv.receiverName || 'عميل غير محدد') : (inv.issuerName || 'مورد غير محدد')}
                            </div>
                          </td>
                        )}

                        {/* Tax ID */}
                        {visibleColumns.tax_id && (
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-700">
                              {inv.direction === 'Sent' ? (inv.receiverId || inv.issuerId || '-') : (inv.issuerId || '-')}
                            </span>
                          </td>
                        )}

                        {/* Address */}
                        {visibleColumns.address && (
                          <td className="py-3.5 px-4 text-slate-600 text-xs max-w-[180px] truncate" title={inv.address || inv.issuerAddress || inv.receiverAddress || '-'}>
                            {inv.address || inv.issuerAddress || inv.receiverAddress || '-'}
                          </td>
                        )}

                        {/* Issue Date */}
                        {visibleColumns.date_issued && (
                          <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                            {formatDateTime(inv.dateTimeIssued)}
                          </td>
                        )}

                        {/* Received Date */}
                        {visibleColumns.date_received && (
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                            {formatDateTime(inv.dateTimeReceived)}
                          </td>
                        )}

                        {/* Currency */}
                        {visibleColumns.currency && (
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-700">
                              {inv.currency || 'EGP'}
                            </span>
                          </td>
                        )}

                        {/* Net Amount */}
                        {visibleColumns.net_amount && (
                          <td className="py-3.5 px-4 text-end font-medium text-slate-700 whitespace-nowrap">
                            {formatAmount(inv.netAmount)}
                          </td>
                        )}

                        {/* Tax Amount */}
                        {visibleColumns.tax_amount && (
                          <td className="py-3.5 px-4 text-end font-medium text-slate-600 whitespace-nowrap">
                            {formatAmount(inv.taxAmount)}
                          </td>
                        )}

                        {/* Total Amount */}
                        {visibleColumns.total_amount && (
                          <td className="py-3.5 px-4 text-end font-bold text-slate-900 whitespace-nowrap">
                            {formatAmount(inv.totalAmount)}
                          </td>
                        )}

                        {/* Status Badge */}
                        {visibleColumns.status && (
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {renderStatusBadge(inv.status)}
                          </td>
                        )}

                        {/* UUID with click to open & copy */}
                        {visibleColumns.uuid && (
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg px-2.5 py-1 text-[11px] font-mono transition-all">
                              <button
                                type="button"
                                onClick={() => setSelectedInvoice(inv)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold underline decoration-indigo-300 hover:decoration-indigo-600 cursor-pointer flex items-center gap-1"
                                title={language === 'ar' ? 'عرض تفاصيل المستند بالكامل كما بالمنظومة' : 'View full document'}
                              >
                                <FileText className="w-3.5 h-3.5 opacity-70" />
                                <span className="truncate max-w-[95px]">{inv.uuid.slice(0, 10)}...</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(inv.uuid, inv.uuid);
                                }}
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors cursor-pointer"
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
                        )}
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
      {/* 7. DETAILS MODAL — ETA PORTAL FULL DOCUMENT VIEW */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl overflow-hidden max-h-[94vh] flex flex-col my-auto"
              dir={dir}
            >
              {/* Modal Top Toolbar / Header (Matching ETA Portal) */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                {/* Right: Title, IDs and Status */}
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0 mt-0.5">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-lg sm:text-xl text-slate-900">
                        {selectedInvoice.documentTypeName || 'فاتورة'} v{selectedInvoice.typeVersionName || '1.0'}
                      </h3>
                      {renderStatusBadge(selectedInvoice.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-mono mt-1 flex-wrap">
                      <span className="font-sans text-slate-500 font-medium">{language === 'ar' ? 'الرقم الإلكتروني:' : 'UUID:'}</span>
                      <span className="font-bold text-slate-800">{selectedInvoice.uuid}</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-sans text-slate-500 font-medium">{language === 'ar' ? 'الرقم الداخلي:' : 'Internal ID:'}</span>
                      <span className="font-bold text-slate-800">{selectedInvoice.internalId}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap font-medium">
                      <span>{language === 'ar' ? 'تاريخ الإصدار:' : 'Issue Date:'} <strong className="text-slate-700">{formatDateTime(selectedInvoice.dateTimeIssued)}</strong></span>
                      <span>•</span>
                      <span>{language === 'ar' ? 'تاريخ التقديم:' : 'Submission Date:'} <strong className="text-slate-700">{formatDateTime(selectedInvoice.dateTimeReceived)}</strong></span>
                      {modalDetailsLoading && (
                        <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold ms-2">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>{language === 'ar' ? 'جاري جلب البنود من مصلحة الضرائب...' : 'Loading ETA lines...'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Left: Action Buttons (Print, Reject, Share, Download, Close) */}
                <div className="flex items-center gap-2 flex-wrap self-end md:self-center shrink-0">
                  {/* Print Button */}
                  <button
                    type="button"
                    onClick={handlePrintInvoice}
                    disabled={isPdfLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    title={language === 'ar' ? 'طباعة الفاتورة الرسمية' : 'Print Official Invoice'}
                  >
                    {isPdfLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <Printer className="w-3.5 h-3.5 text-slate-600" />}
                    <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
                  </button>

                  {/* Reject Button (if allowed) */}
                  <button
                    type="button"
                    onClick={handleRejectInvoicePrompt}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    title={language === 'ar' ? 'رفض المستند على منظومة الضرائب' : 'Reject on ETA Portal'}
                  >
                    <Ban className="w-3.5 h-3.5 text-red-600" />
                    <span>{language === 'ar' ? 'رفض' : 'Reject'}</span>
                  </button>

                  {/* External Share Link Button (High priority - circled in screenshot) */}
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    title={language === 'ar' ? 'الحصول على رابط خارجي معتمد للمشاركة' : 'Get External Share Link'}
                  >
                    {copiedShareUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5 text-indigo-600" />}
                    <span>{language === 'ar' ? 'الحصول على رابط خارجي' : 'External Share Link'}</span>
                  </button>

                  {/* Download As Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDownloadMenu(prev => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span>{language === 'ar' ? 'تحميل كـ' : 'Download as'}</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    {showDownloadMenu && (
                      <div className="absolute top-full mt-1 end-0 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-1 z-30 animate-in fade-in zoom-in-95">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDownloadMenu(false);
                            handleDownloadPdf();
                          }}
                          className="w-full text-start px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <FileDown className="w-4 h-4 text-red-600" />
                          <span>{language === 'ar' ? 'تحميل PDF رسمي' : 'Download Official PDF'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDownloadMenu(false);
                            handleDownloadJson();
                          }}
                          className="w-full text-start px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-indigo-600" />
                          <span>{language === 'ar' ? 'تحميل JSON خام' : 'Download Raw JSON'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Close Modal Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedInvoice(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors ms-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs Bar */}
              <div className="px-5 border-b border-slate-200 bg-white flex items-center gap-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setModalActiveTab('summary')}
                  className={`py-3 border-b-2 transition-all cursor-pointer ${
                    modalActiveTab === 'summary'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {language === 'ar' ? 'الملخص' : 'Summary'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalActiveTab('details')}
                  className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    modalActiveTab === 'details'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{language === 'ar' ? 'التفاصيل (الأصناف)' : 'Details (Items)'}</span>
                  {Array.isArray(fullInvoiceDetails?.invoiceLines) && fullInvoiceDetails.invoiceLines.length > 0 && (
                    <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px]">
                      {fullInvoiceDetails.invoiceLines.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
                {/* External Share Link Banner */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-600 font-bold block text-[11px] mb-0.5">
                        {language === 'ar' ? 'رابط المشاركة الخارجي المعتمد من مصلحة الضرائب المصرية:' : 'Official ETA External Share Link:'}
                      </span>
                      <span className="font-mono text-blue-800 break-all text-[11.5px] font-semibold select-all">
                        {getExternalShareUrl()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      {copiedShareUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{language === 'ar' ? 'نسخ الرابط' : 'Copy Link'}</span>
                    </button>
                    <a
                      href={getExternalShareUrl()}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-blue-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'فتح في المنظومة' : 'Open in ETA'}</span>
                    </a>
                  </div>
                </div>

                {/* Parties (Seller & Buyer) — ETA Portal Styled */}
                {(() => {
                  const formatPartnerType = (t: any) => {
                    if (t === null || t === undefined || t === '') return language === 'ar' ? 'شركة' : 'Company';
                    const s = String(t).trim().toUpperCase();
                    if (s === '0' || s === 'B' || s === 'C' || s === 'BUSINESS' || s === 'COMPANY' || s === 'شركة') {
                      return language === 'ar' ? 'شركة' : 'Company';
                    }
                    if (s === '1' || s === 'P' || s === 'PERSON' || s === 'INDIVIDUAL' || s === 'فرد') {
                      return language === 'ar' ? 'فرد' : 'Individual';
                    }
                    if (s === '2' || s === 'F' || s === 'FOREIGNER' || s === 'أجنبي') {
                      return language === 'ar' ? 'أجنبي' : 'Foreigner';
                    }
                    return language === 'ar' ? 'شركة' : 'Company';
                  };

                  const formatAddr = (addr: any) => {
                    if (!addr) return '';
                    if (typeof addr === 'string') return addr.trim();
                    const parts = [
                      addr.buildingNumber,
                      addr.street,
                      addr.regionCity,
                      addr.city,
                      addr.governate,
                      addr.governorate,
                      addr.country
                    ].map((p: any) => (p ? String(p).trim() : '')).filter(Boolean);
                    const uniqueParts: string[] = [];
                    for (const p of parts) {
                      if (!uniqueParts.includes(p)) uniqueParts.push(p);
                    }
                    return uniqueParts.join('، ');
                  };

                  const issuerTypeDisplay = formatPartnerType(fullInvoiceDetails?.issuerType || fullInvoiceDetails?.issuer?.type);
                  const receiverTypeDisplay = formatPartnerType(fullInvoiceDetails?.receiverType || fullInvoiceDetails?.receiver?.type);

                  const issuerAddressDisplay =
                    fullInvoiceDetails?.issuerAddress ||
                    formatAddr(fullInvoiceDetails?.issuer?.address) ||
                    selectedInvoice.issuerAddress ||
                    selectedInvoice.address ||
                    '---';

                  const receiverAddressDisplay =
                    fullInvoiceDetails?.receiverAddress ||
                    formatAddr(fullInvoiceDetails?.receiver?.address) ||
                    selectedInvoice.receiverAddress ||
                    '---';

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Seller / البائع */}
                      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-white">
                        <div className="bg-[#1e3a5f] text-white px-4 py-2 font-bold text-xs flex items-center justify-between">
                          <span>{language === 'ar' ? 'البائع' : 'Seller / Issuer'}</span>
                          <span className="text-[11px] opacity-90 font-medium bg-white/10 px-2 py-0.5 rounded">
                            {issuerTypeDisplay}
                          </span>
                        </div>
                        <div className="p-4 space-y-2.5 text-xs">
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-slate-400 font-medium">{language === 'ar' ? 'الاسم:' : 'Name:'}</span>
                            <span className="col-span-2 font-bold text-slate-900 leading-snug">
                              {fullInvoiceDetails?.issuer?.name || selectedInvoice.issuerName}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-slate-400 font-medium">{language === 'ar' ? 'رقم التسجيل:' : 'Tax ID:'}</span>
                            <span className="col-span-2 font-mono font-bold text-slate-800">
                              {fullInvoiceDetails?.issuer?.id || selectedInvoice.issuerId}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-slate-400 font-medium">{language === 'ar' ? 'كود النشاط:' : 'Activity Code:'}</span>
                            <span className="col-span-2 font-mono font-bold text-slate-800">
                              {fullInvoiceDetails?.taxpayerActivityCode || fullInvoiceDetails?.issuer?.activityCode || '---'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                            <span className="text-slate-400 font-medium">{language === 'ar' ? 'عنوان الفرع:' : 'Address:'}</span>
                            <span className="col-span-2 text-slate-700 leading-relaxed font-medium">
                              {issuerAddressDisplay}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Buyer / المشتري */}
                      <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-white">
                        <div className="bg-[#1e3a5f] text-white px-4 py-2 font-bold text-xs flex items-center justify-between">
                          <span>{language === 'ar' ? 'المشتري' : 'Buyer / Recipient'}</span>
                          <span className="text-[11px] opacity-90 font-medium bg-white/10 px-2 py-0.5 rounded">
                            {receiverTypeDisplay}
                          </span>
                        </div>
                        <div className="p-4 space-y-2.5 text-xs">
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-slate-400 font-medium">{language === 'ar' ? 'الاسم:' : 'Name:'}</span>
                            <span className="col-span-2 font-bold text-slate-900 leading-snug">
                              {fullInvoiceDetails?.receiver?.name || selectedInvoice.receiverName || (user?.company_name || 'شركتنا')}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-slate-400 font-medium">{language === 'ar' ? 'رقم التسجيل:' : 'Tax ID:'}</span>
                            <span className="col-span-2 font-mono font-bold text-slate-800">
                              {fullInvoiceDetails?.receiver?.id || selectedInvoice.receiverId || '---'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-slate-400 font-medium">{language === 'ar' ? 'النوع:' : 'Type:'}</span>
                            <span className="col-span-2 font-medium text-slate-800">
                              {receiverTypeDisplay}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                            <span className="text-slate-400 font-medium">{language === 'ar' ? 'العنوان:' : 'Address:'}</span>
                            <span className="col-span-2 text-slate-700 leading-relaxed font-medium">
                              {receiverAddressDisplay}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Line Items Table (الأصناف) */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs bg-white">
                  <div className="bg-[#2c4c70] text-white px-4 py-2.5 font-bold text-xs flex items-center justify-between">
                    <span className="text-sm">
                      {language === 'ar' ? 'الأصناف' : 'Invoice Items'} | {language === 'ar' ? 'إجمالي المبلغ' : 'Total'}: ({selectedInvoice.currency}) {formatCurrency(selectedInvoice.totalAmount, selectedInvoice.currency)}
                    </span>
                    {Array.isArray(fullInvoiceDetails?.invoiceLines) && (
                      <span className="text-xs opacity-90 font-mono">
                        {fullInvoiceDetails.invoiceLines.length} {language === 'ar' ? 'بند' : 'lines'}
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-start border-collapse">
                      <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-10">#</th>
                          <th className="py-2.5 px-3 text-start min-w-[130px]">{language === 'ar' ? 'اسم الكود' : 'Code Name'}</th>
                          <th className="py-2.5 px-3 text-start min-w-[130px]">{language === 'ar' ? 'كود الصنف' : 'Item Code'}</th>
                          <th className="py-2.5 px-3 text-start min-w-[180px]">{language === 'ar' ? 'الوصف' : 'Description'}</th>
                          <th className="py-2.5 px-3 text-center min-w-[90px]">{language === 'ar' ? 'الكمية / الوحدة' : 'Qty / Unit'}</th>
                          <th className="py-2.5 px-3 text-end min-w-[100px]">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                          <th className="py-2.5 px-3 text-end min-w-[100px]">{language === 'ar' ? 'قيمة المبيعات' : 'Sales Total'}</th>
                          <th className="py-2.5 px-3 text-end min-w-[80px]">{language === 'ar' ? 'الخصم' : 'Discount'}</th>
                          <th className="py-2.5 px-3 text-end min-w-[90px]">{language === 'ar' ? 'الضرائب' : 'Taxes'}</th>
                          <th className="py-2.5 px-3 text-end min-w-[110px]">{language === 'ar' ? 'إجمالي المبلغ' : 'Total Amount'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Array.isArray(fullInvoiceDetails?.invoiceLines) && fullInvoiceDetails.invoiceLines.length > 0 ? (
                          fullInvoiceDetails.invoiceLines.map((line: any, idx: number) => {
                            const codeName = line.itemCodeName || line.itemPrimaryName || line.description || '---';
                            const itemCode = line.itemCode || '---';
                            const description = line.description || line.itemCodeName || '---';
                            const unitPrice = Number(
                              line?.unitPrice ||
                              line?.unitValue?.amountEGP ||
                              line?.unitValue?.amountSold ||
                              0
                            );
                            const salesTotal = Number(line?.salesTotal ?? (line?.quantity * unitPrice) ?? 0);
                            const discountAmount = Number(
                              line?.discountAmount ??
                              line?.itemsDiscount ??
                              line?.discount?.amount ??
                              0
                            );
                            const taxAmount = Number(
                              line?.taxAmount ??
                              (Array.isArray(line?.lineTaxableItems)
                                ? line.lineTaxableItems.reduce((acc: number, t: any) => acc + (Number(t?.amount) || 0), 0)
                                : Array.isArray(line?.taxableItems)
                                ? line.taxableItems.reduce((acc: number, t: any) => acc + (Number(t?.amount) || 0), 0)
                                : 0)
                            );
                            const lineTotal = Number(
                              line?.lineTotal ??
                              line?.total ??
                              line?.netTotal ??
                              (salesTotal - discountAmount + taxAmount)
                            );

                            return (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-semibold">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800 leading-snug">{codeName}</td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                                  <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] text-slate-600 me-1">
                                    {line.itemType || 'EGS'}
                                  </span>
                                  <span>{itemCode}</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 leading-snug">{description}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                                  {line.quantity ?? 1} <span className="text-[10px] font-normal text-slate-500">{line.unitType || ''}</span>
                                </td>
                                <td className="py-2.5 px-3 text-end font-mono text-slate-800">{formatCurrency(unitPrice, selectedInvoice.currency)}</td>
                                <td className="py-2.5 px-3 text-end font-mono text-slate-800">{formatCurrency(salesTotal, selectedInvoice.currency)}</td>
                                <td className="py-2.5 px-3 text-end font-mono text-amber-700">
                                  {discountAmount > 0 ? `- ${formatCurrency(discountAmount, selectedInvoice.currency)}` : '0.00'}
                                </td>
                                <td className="py-2.5 px-3 text-end font-mono text-blue-700">
                                  {taxAmount > 0 ? formatCurrency(taxAmount, selectedInvoice.currency) : '0.00'}
                                </td>
                                <td className="py-2.5 px-3 text-end font-mono font-bold text-slate-900">{formatCurrency(lineTotal, selectedInvoice.currency)}</td>
                              </tr>
                            );
                          })
                        ) : modalDetailsLoading ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-400">
                              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                              <span>{language === 'ar' ? 'جاري جلب بنود الفاتورة الرسمية من منظومة الضرائب المصرية...' : 'Loading official invoice lines from ETA...'}</span>
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={10} className="py-6 text-center text-slate-500">
                              {language === 'ar' ? 'تم جلب ملخص الفاتورة بنجاح. لا توجد بنود تفصيلية معروضة.' : 'Invoice summary loaded.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary Breakdown (Matching ETA Portal) */}
                <div className="flex flex-col md:flex-row items-stretch justify-between gap-4">
                  {/* Left: Tax Details */}
                  <div className="flex-1 rounded-2xl border border-slate-200 p-4 bg-slate-50/60 space-y-2 text-xs">
                    <span className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      {language === 'ar' ? 'تفصيل الضرائب والرسوم' : 'Tax Breakdown'}
                    </span>
                    {Array.isArray(fullInvoiceDetails?.taxTotals) && fullInvoiceDetails.taxTotals.length > 0 ? (
                      <div className="space-y-1.5">
                        {fullInvoiceDetails.taxTotals.map((tax: any, tIdx: number) => (
                          <div key={tIdx} className="flex justify-between text-slate-600">
                            <span>{tax.taxType || (language === 'ar' ? 'ضريبة' : 'Tax')}:</span>
                            <span className="font-mono font-bold text-slate-800">{formatCurrency(Number(tax.amount || 0), selectedInvoice.currency)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex justify-between text-slate-600">
                        <span>{language === 'ar' ? 'إجمالي الضرائب:' : 'Total Taxes:'}</span>
                        <span className="font-mono font-bold text-slate-800">{formatCurrency(selectedInvoice.taxAmount, selectedInvoice.currency)}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Totals Box (Matching Screenshot 2) */}
                  <div className="w-full md:w-80 rounded-2xl bg-[#1e293b] text-white p-4 space-y-2.5 text-xs shadow-lg">
                    <div className="flex justify-between text-slate-300">
                      <span>{language === 'ar' ? 'إجمالي المبيعات (ج.م):' : 'Total Sales:'}</span>
                      <span className="font-mono font-bold text-slate-100">{formatCurrency(selectedInvoice.totalSales, selectedInvoice.currency)}</span>
                    </div>
                    {selectedInvoice.totalDiscount > 0 && (
                      <div className="flex justify-between text-amber-300">
                        <span>{language === 'ar' ? 'إجمالي الخصم (ج.م):' : 'Total Discount:'}</span>
                        <span className="font-mono font-bold">- {formatCurrency(selectedInvoice.totalDiscount, selectedInvoice.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-300">
                      <span>{language === 'ar' ? 'صافي المبيعات (ج.م):' : 'Net Amount:'}</span>
                      <span className="font-mono font-bold text-slate-100">{formatCurrency(selectedInvoice.netAmount, selectedInvoice.currency)}</span>
                    </div>
                    <div className="flex justify-between text-blue-300">
                      <span>{language === 'ar' ? 'إجمالي الضريبة (ج.م):' : 'Total Tax:'}</span>
                      <span className="font-mono font-bold">{formatCurrency(selectedInvoice.taxAmount, selectedInvoice.currency)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-700 flex justify-between font-extrabold text-sm sm:text-base text-emerald-400">
                      <span>{language === 'ar' ? 'إجمالي المبلغ (ج.م):' : 'Total Amount:'}</span>
                      <span className="font-mono">{formatCurrency(selectedInvoice.totalAmount, selectedInvoice.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{language === 'ar' ? 'بيانات معتمدة ومطابقة مباشرة مع خوادم مصلحة الضرائب المصرية.' : 'Directly certified & synchronized with ETA.'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
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
