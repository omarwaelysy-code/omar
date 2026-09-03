import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Info
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { apiRequest } from '../services/dbService';

export interface EtaReceivedInvoice {
  uuid: string;
  submissionUuid?: string;
  longId?: string;
  internalId: string;
  typeName: string;
  documentTypeName: string;
  typeVersionName?: string;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Data & State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<EtaReceivedInvoice[]>([]);
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

  // Initial and filter changes
  useEffect(() => {
    // Reset pagination token history on filter change
    setCurrentToken(undefined);
    setTokenHistory([]);
    setPageNumber(1);
    fetchInvoices(undefined, false);
  }, [dateFrom, dateTo, statusFilter, docTypeFilter, appliedSearch, fetchInvoices]);

  const handleRefresh = () => {
    fetchInvoices(currentToken, true);
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
            disabled={refreshing || loading || !isConfigured}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 shadow-2xs"
            title={language === 'ar' ? 'تحديث البيانات من منظومة الضرائب' : 'Refresh from ETA'}
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
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
            {language === 'ar' ? '📅 شهر يوليو 2026 (01/07 - 30/07)' : 'July 2026'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFrom('2026-08-01');
              setDateTo('2026-08-30');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              dateFrom === '2026-08-01' && dateTo === '2026-08-30'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700'
            }`}
          >
            {language === 'ar' ? 'شهر أغسطس 2026 (01/08 - 30/08)' : 'August 2026'}
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
      </div>

      {/* ========================================================================= */}
      {/* 5. INVOICES TABLE */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-medium text-slate-500">
              {language === 'ar' ? 'جاري جلب الفواتير الإلكترونية من منظومة مصلحة الضرائب...' : 'Loading invoices from ETA...'}
            </p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
              <Receipt className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-base text-slate-800">
              {language === 'ar' ? 'لا توجد فواتير إلكترونية مستلمة' : 'No received invoices found'}
            </h3>
            <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              {language === 'ar'
                ? 'لم يتم العثور على فواتير إلكترونية واردة خلال الفترة أو الفلاتر المحددة. يمكنك تغيير نطاق التاريخ أو إعادة المحاولة.'
                : 'No incoming invoices found for the selected date range and filters. Try adjusting the dates or status.'}
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
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/75 text-slate-600 font-bold">
                  <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'رقم الفاتورة' : 'Invoice ID'}</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">{language === 'ar' ? 'النوع' : 'Type'}</th>
                  <th className="py-3 px-4 text-start whitespace-nowrap">{language === 'ar' ? 'المورد (المصدر)' : 'Issuer / Supplier'}</th>
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
                {invoices.map((inv) => (
                  <tr key={inv.uuid} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Internal ID */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {inv.internalId}
                    </td>

                    {/* Document Type */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {renderDocTypeBadge(inv.typeName, inv.documentTypeName)}
                    </td>

                    {/* Issuer */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 max-w-[220px] truncate" title={inv.issuerName}>
                        {inv.issuerName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {inv.issuerId}
                      </div>
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
        )}

        {/* ========================================================================= */}
        {/* 6. PAGINATION FOOTER */}
        {/* ========================================================================= */}
        {!loading && invoices.length > 0 && (
          <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-3 flex-wrap text-xs md:text-sm">
            <div className="text-slate-500 font-medium">
              {language === 'ar'
                ? `الصفحة ${pageNumber} — عرض ${invoices.length} فاتورة`
                : `Page ${pageNumber} — showing ${invoices.length} invoices`}
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
          </div>
        )}
      </div>

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
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {selectedInvoice.internalId}
                    </p>
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
