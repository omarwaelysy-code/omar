import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  Filter,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Scale,
  Receipt,
  FileText,
  Percent,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ChevronDown,
  Building2,
  Printer,
  Download,
  ExternalLink,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  PieChart,
  ArrowRightLeft,
  ShieldCheck,
  Search,
  X
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { apiRequest } from '../services/dbService';
import { exportToExcel } from '../utils/excelUtils';
import { ExportButtons } from '../components/ExportButtons';
import { printElement } from '../utils/pdfUtils';
import { formatMoney } from '../utils/formatUtils';
import { EtaReceivedInvoice, getInvoiceTaxBreakdown } from './EtaReceivedInvoices';

export const EtaDashboard: React.FC = () => {
  const { dir, language } = useLanguage();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { setCurrentPage } = useNavigation();

  // Data states
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allInvoices, setAllInvoices] = useState<EtaReceivedInvoice[]>([]);
  const [isConfigured, setIsConfigured] = useState(true);
  const [environment, setEnvironment] = useState<'preprod' | 'production'>('production');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Filters
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickStatusPreset, setQuickStatusPreset] = useState<'all' | 'valid' | 'cancelled_rejected'>('all');

  // Dropdown menus
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Print ref
  const dashboardRef = useRef<HTMLDivElement>(null);

  // 1. Months Definition
  const MONTHS_LIST = useMemo(() => [
    { id: '01', nameAr: 'شهر 01 - يناير', nameEn: 'Month 01 - January', shortAr: 'يناير', shortEn: 'Jan' },
    { id: '02', nameAr: 'شهر 02 - فبراير', nameEn: 'Month 02 - February', shortAr: 'فبراير', shortEn: 'Feb' },
    { id: '03', nameAr: 'شهر 03 - مارس', nameEn: 'Month 03 - March', shortAr: 'مارس', shortEn: 'Mar' },
    { id: '04', nameAr: 'شهر 04 - أبريل', nameEn: 'Month 04 - April', shortAr: 'أبريل', shortEn: 'Apr' },
    { id: '05', nameAr: 'شهر 05 - مايو', nameEn: 'Month 05 - May', shortAr: 'مايو', shortEn: 'May' },
    { id: '06', nameAr: 'شهر 06 - يونيو', nameEn: 'Month 06 - June', shortAr: 'يونيو', shortEn: 'Jun' },
    { id: '07', nameAr: 'شهر 07 - يوليو', nameEn: 'Month 07 - July', shortAr: 'يوليو', shortEn: 'Jul' },
    { id: '08', nameAr: 'شهر 08 - أغسطس', nameEn: 'Month 08 - August', shortAr: 'أغسطس', shortEn: 'Aug' },
    { id: '09', nameAr: 'شهر 09 - سبتمبر', nameEn: 'Month 09 - September', shortAr: 'سبتمبر', shortEn: 'Sep' },
    { id: '10', nameAr: 'شهر 10 - أكتوبر', nameEn: 'Month 10 - October', shortAr: 'أكتوبر', shortEn: 'Oct' },
    { id: '11', nameAr: 'شهر 11 - نوفمبر', nameEn: 'Month 11 - November', shortAr: 'نوفمبر', shortEn: 'Nov' },
    { id: '12', nameAr: 'شهر 12 - ديسمبر', nameEn: 'Month 12 - December', shortAr: 'ديسمبر', shortEn: 'Dec' },
  ], []);

  // 2. Statuses Definition
  const STATUSES_LIST = useMemo(() => [
    { id: 'Valid', nameAr: 'صحيحة (معتمدة)', nameEn: 'Valid (Approved)', color: 'emerald' },
    { id: 'Cancelled', nameAr: 'ملغاة', nameEn: 'Cancelled', color: 'amber' },
    { id: 'Rejected', nameAr: 'مرفوضة', nameEn: 'Rejected', color: 'rose' },
    { id: 'Invalid', nameAr: 'غير صالحة', nameEn: 'Invalid', color: 'red' },
    { id: 'Submitted', nameAr: 'مقدمة', nameEn: 'Submitted', color: 'blue' }
  ], []);

  // 3. Fetch Documents (Local-First from Postgres with optional refresh from ETA)
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (!user?.company_id) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const url = `/eta/invoices/all${isRefresh ? '?refresh=true' : ''}`;
      const res = await apiRequest<{
        success: boolean;
        isConfigured: boolean;
        environment: 'preprod' | 'production';
        data: EtaReceivedInvoice[];
        totalCount: number;
        lastSyncedAt?: string | null;
      }>(url, 'GET', undefined, 180000);

      if (res) {
        setIsConfigured(res.isConfigured !== false);
        setEnvironment(res.environment || 'production');
        setAllInvoices(res.data || []);
        if (res.lastSyncedAt) {
          setLastSyncedAt(res.lastSyncedAt);
        }
        if (isRefresh) {
          showNotification(
            language === 'ar'
              ? 'تمت المزامنة والتحديث بنجاح من منظومة مصلحة الضرائب المصرية.'
              : 'Synchronized successfully from Egyptian Tax Authority.',
            'success'
          );
        }
      }
    } catch (err: any) {
      console.error('Failed to load ETA dashboard data:', err);
      showNotification(
        err.message || (language === 'ar' ? 'تعذر جلب بيانات الوثائق الإلكترونية.' : 'Failed to fetch ETA data.'),
        'error'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.company_id, language, showNotification]);

  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // 4. Available Fiscal Years from dataset
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const set = new Set<string>();
    set.add(String(currentYear));
    allInvoices.forEach(inv => {
      const yr = (inv.dateTimeIssued || '').slice(0, 4);
      if (yr && /^\d{4}$/.test(yr)) set.add(yr);
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [allInvoices]);

  // Set default year to current year if available and none selected yet
  useEffect(() => {
    if (selectedYears.length === 0 && availableYears.length > 0) {
      const currentYearStr = String(new Date().getFullYear());
      if (availableYears.includes(currentYearStr)) {
        setSelectedYears([currentYearStr]);
      } else {
        setSelectedYears([availableYears[0]]);
      }
    }
  }, [availableYears]);

  // 5. Counts per filter for dynamic badges
  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allInvoices.forEach(inv => {
      const yr = (inv.dateTimeIssued || '').slice(0, 4);
      if (yr) counts[yr] = (counts[yr] || 0) + 1;
    });
    return counts;
  }, [allInvoices]);

  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allInvoices.forEach(inv => {
      const yr = (inv.dateTimeIssued || '').slice(0, 4);
      const m = (inv.dateTimeIssued || '').slice(5, 7);
      if (selectedYears.length === 0 || selectedYears.includes(yr)) {
        if (m) counts[m] = (counts[m] || 0) + 1;
      }
    });
    return counts;
  }, [allInvoices, selectedYears]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allInvoices.forEach(inv => {
      const yr = (inv.dateTimeIssued || '').slice(0, 4);
      const m = (inv.dateTimeIssued || '').slice(5, 7);
      if ((selectedYears.length === 0 || selectedYears.includes(yr)) &&
          (selectedMonths.length === 0 || selectedMonths.includes(m))) {
        const st = inv.status || 'Valid';
        counts[st] = (counts[st] || 0) + 1;
      }
    });
    return counts;
  }, [allInvoices, selectedYears, selectedMonths]);

  // 6. Handle Quick Status Preset
  const handleQuickStatusChange = (preset: 'all' | 'valid' | 'cancelled_rejected') => {
    setQuickStatusPreset(preset);
    if (preset === 'all') {
      setSelectedStatuses([]);
    } else if (preset === 'valid') {
      setSelectedStatuses(['Valid']);
    } else if (preset === 'cancelled_rejected') {
      setSelectedStatuses(['Cancelled', 'Rejected']);
    }
  };

  // 7. Filtered Documents Dataset
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter(inv => {
      const yr = (inv.dateTimeIssued || '').slice(0, 4);
      const m = (inv.dateTimeIssued || '').slice(5, 7);
      const st = inv.status || 'Valid';

      if (selectedYears.length > 0 && !selectedYears.includes(yr)) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(m)) return false;

      if (selectedStatuses.length > 0) {
        const match = selectedStatuses.some(s => s.toLowerCase() === st.toLowerCase());
        if (!match) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const num = (inv.internalId || '').toLowerCase();
        const uuid = (inv.uuid || '').toLowerCase();
        const issuer = (inv.issuerName || '').toLowerCase();
        const receiver = (inv.receiverName || '').toLowerCase();
        const issuerId = (inv.issuerId || '').toLowerCase();
        const receiverId = (inv.receiverId || '').toLowerCase();
        if (!num.includes(q) && !uuid.includes(q) && !issuer.includes(q) && !receiver.includes(q) && !issuerId.includes(q) && !receiverId.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allInvoices, selectedYears, selectedMonths, selectedStatuses, searchQuery]);

  // 8. Segregate into Received and Sent
  const receivedInvoices = useMemo(() => {
    return filteredInvoices.filter(inv => inv.direction === 'Received');
  }, [filteredInvoices]);

  const sentInvoices = useMemo(() => {
    return filteredInvoices.filter(inv => inv.direction === 'Sent');
  }, [filteredInvoices]);

  // 9. Document Types Helper
  const getDocTypeCategory = (typeName?: string, docTypeName?: string) => {
    const t = String(typeName || '').toLowerCase().trim();
    const dt = String(docTypeName || '').toLowerCase();

    if (t === 'ii' || dt.includes('استيراد') || dt.includes('import')) {
      return { key: 'ii', nameAr: 'فاتورة استيراد', nameEn: 'Import Invoice', isCredit: false, isDebit: false };
    }
    if (t === 'ei' || dt.includes('تصدير') || dt.includes('export invoice')) {
      return { key: 'ei', nameAr: 'فاتورة تصدير', nameEn: 'Export Invoice', isCredit: false, isDebit: false };
    }
    if (t === 'c' || t === 'ec' || dt.includes('دائن') || dt.includes('credit')) {
      return { key: 'c', nameAr: 'إشعار دائن', nameEn: 'Credit Note', isCredit: true, isDebit: false };
    }
    if (t === 'd' || t === 'ed' || dt.includes('مدين') || dt.includes('debit')) {
      return { key: 'd', nameAr: 'إشعار مدين', nameEn: 'Debit Note', isCredit: false, isDebit: true };
    }
    return { key: 'i', nameAr: 'فاتورة', nameEn: 'Invoice', isCredit: false, isDebit: false };
  };

  // 10. Aggregation Calculation Engine
  const calculateTotals = (docs: EtaReceivedInvoice[]) => {
    let count = docs.length;
    let totalSales = 0;
    let totalDiscount = 0;
    let netAmount = 0;
    let vatAmount = 0;
    let whtAmount = 0;
    let totalAmount = 0;

    // Breakdown map by type key
    const typeMap: Record<string, {
      key: string;
      nameAr: string;
      nameEn: string;
      count: number;
      netAmount: number;
      vatAmount: number;
      totalAmount: number;
      isCredit: boolean;
      isDebit: boolean;
    }> = {};

    docs.forEach(inv => {
      const breakdown = getInvoiceTaxBreakdown(inv);
      const cat = getDocTypeCategory(inv.typeName, inv.documentTypeName);

      totalSales += breakdown.totalSales;
      totalDiscount += (Number(inv.totalDiscount) || 0);
      netAmount += breakdown.netAmount;
      vatAmount += breakdown.vatAmount;
      whtAmount += breakdown.whtAmount;
      totalAmount += breakdown.totalAmount;

      if (!typeMap[cat.key]) {
        typeMap[cat.key] = {
          key: cat.key,
          nameAr: cat.nameAr,
          nameEn: cat.nameEn,
          count: 0,
          netAmount: 0,
          vatAmount: 0,
          totalAmount: 0,
          isCredit: cat.isCredit,
          isDebit: cat.isDebit
        };
      }

      typeMap[cat.key].count += 1;
      typeMap[cat.key].netAmount += breakdown.netAmount;
      typeMap[cat.key].vatAmount += breakdown.vatAmount;
      typeMap[cat.key].totalAmount += breakdown.totalAmount;
    });

    const typesList = Object.values(typeMap).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      count,
      totalSales,
      totalDiscount,
      netAmount,
      vatAmount,
      whtAmount,
      totalAmount,
      typesList
    };
  };

  // Summary Metrics
  const receivedTotals = useMemo(() => calculateTotals(receivedInvoices), [receivedInvoices]);
  const sentTotals = useMemo(() => calculateTotals(sentInvoices), [sentInvoices]);

  // 11. The Difference / Financial Reconciliation (جزء الفرق)
  const diffMetrics = useMemo(() => {
    // Net Margin = Sent Net (Sales) - Received Net (Purchases)
    const netDiff = sentTotals.netAmount - receivedTotals.netAmount;
    
    // Net VAT = Output VAT (Sales Tax) - Input VAT (Purchase Tax)
    const vatDiff = sentTotals.vatAmount - receivedTotals.vatAmount;
    
    // Grand Total Diff
    const totalAmountDiff = sentTotals.totalAmount - receivedTotals.totalAmount;
    
    // Doc Count Diff
    const countDiff = sentTotals.count - receivedTotals.count;

    // Margin Percentage: (Sales - Purchases) / Sales * 100
    const marginPct = sentTotals.netAmount > 0 
      ? Math.round((netDiff / sentTotals.netAmount) * 1000) / 10 
      : 0;

    // Proportions for visual progress bars
    const combinedNet = (sentTotals.netAmount + receivedTotals.netAmount) || 1;
    const sentNetRatio = Math.round((sentTotals.netAmount / combinedNet) * 100);
    const receivedNetRatio = Math.round((receivedTotals.netAmount / combinedNet) * 100);

    const combinedVat = (sentTotals.vatAmount + receivedTotals.vatAmount) || 1;
    const sentVatRatio = Math.round((sentTotals.vatAmount / combinedVat) * 100);
    const receivedVatRatio = Math.round((receivedTotals.vatAmount / combinedVat) * 100);

    return {
      netDiff,
      vatDiff,
      totalAmountDiff,
      countDiff,
      marginPct,
      sentNetRatio,
      receivedNetRatio,
      sentVatRatio,
      receivedVatRatio
    };
  }, [sentTotals, receivedTotals]);

  // 12. Monthly Timeline Schedule (التوزيع الشهري للمبيعات والمشتريات والضرائب)
  const monthlyBreakdown = useMemo(() => {
    const map: Record<string, {
      monthId: string;
      nameAr: string;
      nameEn: string;
      sentCount: number;
      sentNet: number;
      sentVat: number;
      sentTotal: number;
      receivedCount: number;
      receivedNet: number;
      receivedVat: number;
      receivedTotal: number;
      netDiff: number;
      vatDiff: number;
    }> = {};

    MONTHS_LIST.forEach(m => {
      map[m.id] = {
        monthId: m.id,
        nameAr: m.shortAr,
        nameEn: m.shortEn,
        sentCount: 0,
        sentNet: 0,
        sentVat: 0,
        sentTotal: 0,
        receivedCount: 0,
        receivedNet: 0,
        receivedVat: 0,
        receivedTotal: 0,
        netDiff: 0,
        vatDiff: 0
      };
    });

    filteredInvoices.forEach(inv => {
      const m = (inv.dateTimeIssued || '').slice(5, 7);
      if (map[m]) {
        const b = getInvoiceTaxBreakdown(inv);
        if (inv.direction === 'Sent') {
          map[m].sentCount += 1;
          map[m].sentNet += b.netAmount;
          map[m].sentVat += b.vatAmount;
          map[m].sentTotal += b.totalAmount;
        } else {
          map[m].receivedCount += 1;
          map[m].receivedNet += b.netAmount;
          map[m].receivedVat += b.vatAmount;
          map[m].receivedTotal += b.totalAmount;
        }
      }
    });

    return Object.values(map).map(row => ({
      ...row,
      netDiff: row.sentNet - row.receivedNet,
      vatDiff: row.sentVat - row.receivedVat
    }));
  }, [filteredInvoices, MONTHS_LIST]);

  // 13. Export to Excel
  const handleExportExcel = () => {
    const summaryData = [
      {
        [language === 'ar' ? 'البند' : 'Metric']: language === 'ar' ? 'الوثائق الصادرة (المبيعات)' : 'Issued Documents (Sales)',
        [language === 'ar' ? 'عدد الوثائق' : 'Count']: sentTotals.count,
        [language === 'ar' ? 'صافي القيمة' : 'Net Amount']: sentTotals.netAmount,
        [language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT Amount']: sentTotals.vatAmount,
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total Amount']: sentTotals.totalAmount
      },
      {
        [language === 'ar' ? 'البند' : 'Metric']: language === 'ar' ? 'الوثائق المستلمة (المشتريات)' : 'Received Documents (Purchases)',
        [language === 'ar' ? 'عدد الوثائق' : 'Count']: receivedTotals.count,
        [language === 'ar' ? 'صافي القيمة' : 'Net Amount']: receivedTotals.netAmount,
        [language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT Amount']: receivedTotals.vatAmount,
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total Amount']: receivedTotals.totalAmount
      },
      {
        [language === 'ar' ? 'البند' : 'Metric']: language === 'ar' ? 'صافي الفروق (الصادر - المستلم)' : 'Net Difference (Sent - Received)',
        [language === 'ar' ? 'عدد الوثائق' : 'Count']: diffMetrics.countDiff,
        [language === 'ar' ? 'صافي القيمة' : 'Net Amount']: diffMetrics.netDiff,
        [language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT Amount']: diffMetrics.vatDiff,
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total Amount']: diffMetrics.totalAmountDiff
      }
    ];

    exportToExcel(summaryData, {
      filename: `ETA_Dashboard_Summary_${selectedYears.join('_') || 'All'}`,
      sheetName: language === 'ar' ? 'مؤشرات الضرائب' : 'ETA Dashboard'
    });

    showNotification(
      language === 'ar' ? 'تم تصدير تقرير المؤشرات إلى ملف إكسيل بنجاح.' : 'Exported ETA Dashboard to Excel successfully.',
      'success'
    );
  };

  // 14. Print Report
  const handlePrint = () => {
    if (dashboardRef.current) {
      printElement(dashboardRef.current, language === 'ar' ? 'تقرير مؤشرات الفاتورة الإلكترونية (ETA)' : 'ETA e-Invoicing Dashboard');
    }
  };

  return (
    <div className="space-y-6 w-full text-slate-800 pb-12" dir={dir} ref={dashboardRef}>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CONTROLS */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0 mt-0.5">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {language === 'ar' ? 'نظرة عامة (لوحة مؤشرات منظومة ETA)' : 'ETA e-Invoicing Dashboard'}
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
                      ? `آخر مزامنة: ${new Date(lastSyncedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date(lastSyncedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                      : `Last Synced: ${new Date(lastSyncedAt).toLocaleDateString('en-GB')} ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">
              {language === 'ar'
                ? 'تحليل مالي وضريبي متكامل للوثائق الإلكترونية الصادرة والمستلمة وموقف ضريبة القيمة المضافة والفروق'
                : 'Complete financial & tax analysis of issued and received documents and VAT positions'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-2xs"
            title={language === 'ar' ? 'تصدير إكسيل' : 'Export Excel'}
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'ar' ? 'تصدير إكسيل' : 'Excel'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-2xs"
            title={language === 'ar' ? 'طباعة التقرير' : 'Print Report'}
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" />
            <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
          </button>
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-black rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transition-all disabled:opacity-50 shadow-sm cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-white ${refreshing || loading ? 'animate-spin' : ''}`} />
            <span>{language === 'ar' ? 'تحديث ومزامنة من الضرائب' : 'Refresh & Sync'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FILTERS BAR (YEARS + MONTHS + STATUSES + SEARCH) */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              {language === 'ar' ? 'فلاتر التصفية المالية والضريبية' : 'Financial & Tax Filters'}
            </span>
          </div>

          {/* Quick Status Presets */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => handleQuickStatusChange('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                quickStatusPreset === 'all'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'ar' ? 'كافة الوثائق' : 'All Docs'}
            </button>
            <button
              type="button"
              onClick={() => handleQuickStatusChange('valid')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                quickStatusPreset === 'valid'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{language === 'ar' ? 'الصحيحة فقط (المعتمدة)' : 'Valid Only'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickStatusChange('cancelled_rejected')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                quickStatusPreset === 'cancelled_rejected'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              <XCircle className="w-3 h-3" />
              <span>{language === 'ar' ? 'الملغاة والمرفوضة' : 'Cancelled/Rejected'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Year Filter Dropdown */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'السنوات المالية' : 'Fiscal Years'}</span>
              </span>
              {selectedYears.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedYears([])}
                  className="text-[10px] text-indigo-600 hover:underline font-bold"
                >
                  {language === 'ar' ? 'الكل' : 'All'}
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => {
                setShowYearDropdown(p => !p);
                setShowMonthDropdown(false);
                setShowStatusDropdown(false);
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs font-bold text-slate-800 transition-all text-start"
            >
              <span className="truncate">
                {selectedYears.length === 0
                  ? (language === 'ar' ? 'كافة الأعوام' : 'All Years')
                  : selectedYears.length === 1
                  ? (language === 'ar' ? `عام ${selectedYears[0]}` : `Year ${selectedYears[0]}`)
                  : (language === 'ar' ? `${selectedYears.length} أعوام محددة` : `${selectedYears.length} Years Selected`)}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showYearDropdown && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowYearDropdown(false)} />
                <div className="absolute top-full right-0 mt-1.5 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-2 space-y-1 max-h-72 overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 px-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedYears([])}
                      className={`font-bold ${selectedYears.length === 0 ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {language === 'ar' ? 'تحديد كافة الأعوام' : 'Select All Years'}
                    </button>
                    {selectedYears.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedYears([])}
                        className="text-[11px] text-rose-500 hover:underline font-semibold"
                      >
                        {language === 'ar' ? 'مسح' : 'Clear'}
                      </button>
                    )}
                  </div>
                  {availableYears.map(yr => {
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
                              if (e.target.checked) setSelectedYears(prev => [...prev, yr]);
                              else setSelectedYears(prev => prev.filter(y => y !== yr));
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span className="font-bold text-slate-800">{yr}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          count > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 2. Month Filter Dropdown */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'الشهور' : 'Months'}</span>
              </span>
              {selectedMonths.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMonths([])}
                  className="text-[10px] text-indigo-600 hover:underline font-bold"
                >
                  {language === 'ar' ? 'الكل' : 'All'}
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => {
                setShowMonthDropdown(p => !p);
                setShowYearDropdown(false);
                setShowStatusDropdown(false);
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs font-bold text-slate-800 transition-all text-start"
            >
              <span className="truncate">
                {selectedMonths.length === 0
                  ? (language === 'ar' ? 'كافة الشهور' : 'All Months')
                  : selectedMonths.length === 1
                  ? (MONTHS_LIST.find(m => m.id === selectedMonths[0])?.[language === 'ar' ? 'nameAr' : 'nameEn'] || selectedMonths[0])
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
                      onClick={() => setSelectedMonths([])}
                      className={`font-bold ${selectedMonths.length === 0 ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {language === 'ar' ? 'تحديد كافة الشهور' : 'Select All Months'}
                    </button>
                    {selectedMonths.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedMonths([])}
                        className="text-[11px] text-rose-500 hover:underline font-semibold"
                      >
                        {language === 'ar' ? 'مسح' : 'Clear'}
                      </button>
                    )}
                  </div>
                  {MONTHS_LIST.map(m => {
                    const count = monthCounts[m.id] || 0;
                    const isChecked = selectedMonths.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs select-none transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedMonths(prev => [...prev, m.id]);
                              else setSelectedMonths(prev => prev.filter(x => x !== m.id));
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span className="font-bold text-slate-800">{language === 'ar' ? m.nameAr : m.nameEn}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          count > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 3. Status Filter Dropdown */}
          <div className="relative">
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'حالة الوثيقة' : 'Status'}</span>
              </span>
              {selectedStatuses.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setSelectedStatuses([]); setQuickStatusPreset('all'); }}
                  className="text-[10px] text-indigo-600 hover:underline font-bold"
                >
                  {language === 'ar' ? 'الكل' : 'All'}
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => {
                setShowStatusDropdown(p => !p);
                setShowYearDropdown(false);
                setShowMonthDropdown(false);
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs font-bold text-slate-800 transition-all text-start"
            >
              <span className="truncate">
                {selectedStatuses.length === 0
                  ? (language === 'ar' ? 'كافة الحالات' : 'All Statuses')
                  : selectedStatuses.length === 1
                  ? (STATUSES_LIST.find(s => s.id === selectedStatuses[0])?.[language === 'ar' ? 'nameAr' : 'nameEn'] || selectedStatuses[0])
                  : (language === 'ar' ? `${selectedStatuses.length} حالات محددة` : `${selectedStatuses.length} Statuses`)}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showStatusDropdown && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowStatusDropdown(false)} />
                <div className="absolute top-full right-0 mt-1.5 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-2 space-y-1 max-h-72 overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 px-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => { setSelectedStatuses([]); setQuickStatusPreset('all'); }}
                      className={`font-bold ${selectedStatuses.length === 0 ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {language === 'ar' ? 'كافة الحالات' : 'Select All'}
                    </button>
                    {selectedStatuses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setSelectedStatuses([]); setQuickStatusPreset('all'); }}
                        className="text-[11px] text-rose-500 hover:underline font-semibold"
                      >
                        {language === 'ar' ? 'مسح' : 'Clear'}
                      </button>
                    )}
                  </div>
                  {STATUSES_LIST.map(st => {
                    const count = statusCounts[st.id] || 0;
                    const isChecked = selectedStatuses.some(s => s.toLowerCase() === st.id.toLowerCase());
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
                              setQuickStatusPreset('all');
                              if (e.target.checked) setSelectedStatuses(prev => [...prev, st.id]);
                              else setSelectedStatuses(prev => prev.filter(x => x.toLowerCase() !== st.id.toLowerCase()));
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span className="font-bold text-slate-800">{language === 'ar' ? st.nameAr : st.nameEn}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          count > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 4. Search Query */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span>{language === 'ar' ? 'بحث سريع' : 'Search'}</span>
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[10px] text-indigo-600 hover:underline font-bold"
                >
                  {language === 'ar' ? 'مسح' : 'Clear'}
                </button>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'رقم الوثيقة، اسم الشريك، السجل...' : 'Doc ID, Partner, Tax ID...'}
                className="w-full text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 transition-all outline-hidden font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute inset-y-0 ${dir === 'rtl' ? 'left-2.5' : 'right-2.5'} flex items-center text-slate-400 hover:text-slate-600`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. EXECUTIVE DIFFERENCE SECTION (جزء الفرق) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        {/* Background decorative glows */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-6">
          {/* Header of Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                  <span>{language === 'ar' ? 'جزء الفروق والموقف الضريبي والمحاسبي' : 'Executive Differences & VAT Position'}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {language === 'ar' ? 'المقاصة الضريبية' : 'Tax Clearance'}
                  </span>
                </h2>
                <p className="text-xs text-indigo-200/70 mt-0.5">
                  {language === 'ar'
                    ? 'المقارنة المباشرة بين المبيعات الصادرة والمشتريات المستلمة وحساب صافي الضريبة المستحقة / الدائنة'
                    : 'Direct comparison between issued sales and received purchases for VAT filing position'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-indigo-200 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="text-slate-400">{language === 'ar' ? 'عدد الوثائق المدرجة:' : 'Docs Count:'}</span>
              <span className="text-white font-black">{filteredInvoices.length}</span>
              <span className="text-slate-500">|</span>
              <span className="text-sky-300">{sentTotals.count} {language === 'ar' ? 'صادرة' : 'Sent'}</span>
              <span className="text-slate-500">vs</span>
              <span className="text-emerald-300">{receivedTotals.count} {language === 'ar' ? 'مستلمة' : 'Recv'}</span>
            </div>
          </div>

          {/* Master 4 Difference KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Net Margin / Sales vs Purchases Difference */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-200/80 mb-2">
                <span>{language === 'ar' ? 'فرق صافي القيمة (المبيعات - المشتريات)' : 'Net Value Difference'}</span>
                <div className={`p-1.5 rounded-lg ${diffMetrics.netDiff >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {diffMetrics.netDiff >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </div>
              </div>
              <div className="text-xl md:text-2xl font-black tracking-tight text-white">
                {formatMoney(Math.abs(diffMetrics.netDiff))} <span className="text-xs font-bold text-slate-400">EGP</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs font-bold">
                <span className={`px-2 py-0.5 rounded-md ${diffMetrics.netDiff >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                  {diffMetrics.netDiff >= 0 ? (language === 'ar' ? '🟢 فائض مبيعات' : 'Sales Surplus') : (language === 'ar' ? '🔴 عجز / مشتريات أعلى' : 'Purchase Deficit')}
                </span>
                {diffMetrics.marginPct !== 0 && (
                  <span className="text-indigo-300/80 text-[11px]">
                    {diffMetrics.marginPct > 0 ? `+${diffMetrics.marginPct}%` : `${diffMetrics.marginPct}%`}
                  </span>
                )}
              </div>
            </div>

            {/* Card 2: VAT Position (ضريبة المخرجات - ضريبة المدخلات) */}
            <div className={`backdrop-blur-md rounded-2xl p-4 border transition-all ${
              diffMetrics.vatDiff >= 0 
                ? 'bg-gradient-to-br from-amber-500/15 via-white/5 to-white/5 border-amber-500/30 hover:border-amber-500/50' 
                : 'bg-gradient-to-br from-teal-500/15 via-white/5 to-white/5 border-teal-500/30 hover:border-teal-500/50'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold text-indigo-200/80 mb-2">
                <span className="flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-amber-400" />
                  <span>{language === 'ar' ? 'موقف ضريبة القيمة المضافة (14%)' : 'Net VAT Position (14%)'}</span>
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${diffMetrics.vatDiff >= 0 ? 'bg-amber-400 text-slate-950' : 'bg-teal-400 text-slate-950'}`}>
                  {diffMetrics.vatDiff >= 0 ? (language === 'ar' ? 'سداد' : 'Payable') : (language === 'ar' ? 'دائن' : 'Credit')}
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black tracking-tight text-white">
                {formatMoney(Math.abs(diffMetrics.vatDiff))} <span className="text-xs font-bold text-slate-400">EGP</span>
              </div>
              <div className="mt-2 text-xs font-bold">
                {diffMetrics.vatDiff >= 0 ? (
                  <span className="text-amber-300 flex items-center gap-1">
                    <span>⚡ {language === 'ar' ? 'صافي ضريبة مستحقة السداد للضرائب' : 'Net Tax Payable to ETA'}</span>
                  </span>
                ) : (
                  <span className="text-teal-300 flex items-center gap-1">
                    <span>🛡️ {language === 'ar' ? 'رصيد ضريبة دائن (مسترد / يرحل)' : 'Tax Credit / Refundable'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Card 3: Grand Total Cash Difference */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-200/80 mb-2">
                <span>{language === 'ar' ? 'فرق الإجمالي شامل الضريبة' : 'Grand Total Difference'}</span>
                <Receipt className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl md:text-2xl font-black tracking-tight text-white">
                {formatMoney(Math.abs(diffMetrics.totalAmountDiff))} <span className="text-xs font-bold text-slate-400">EGP</span>
              </div>
              <div className="mt-2 text-xs font-bold text-indigo-200/70">
                <span>{language === 'ar' ? 'صادر: ' : 'Sent: '}</span>
                <span className="text-sky-300 font-mono">{formatMoney(sentTotals.totalAmount)}</span>
                <span className="mx-1">/</span>
                <span>{language === 'ar' ? 'مستلم: ' : 'Recv: '}</span>
                <span className="text-emerald-300 font-mono">{formatMoney(receivedTotals.totalAmount)}</span>
              </div>
            </div>

            {/* Card 4: Volume & Transaction Counts Difference */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-200/80 mb-2">
                <span>{language === 'ar' ? 'فرق عدد المعاملات والوثائق' : 'Transaction Volume Difference'}</span>
                <ArrowRightLeft className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl md:text-2xl font-black tracking-tight text-white">
                {Math.abs(diffMetrics.countDiff)} <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'وثيقة' : 'Docs'}</span>
              </div>
              <div className="mt-2 text-xs font-bold text-indigo-200/70">
                <span className="text-sky-300">{sentTotals.count} {language === 'ar' ? 'مبيعات' : 'Sales'}</span>
                <span className="mx-1">مقابل</span>
                <span className="text-emerald-300">{receivedTotals.count} {language === 'ar' ? 'مشتريات' : 'Purchases'}</span>
              </div>
            </div>
          </div>

          {/* Visual Comparison Bars (Progress Ratio) */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-indigo-200 flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-indigo-400" />
                <span>{language === 'ar' ? 'النسبة المئوية للمبيعات الصادرة مقابل المشتريات المستلمة' : 'Sales vs Purchases Distribution'}</span>
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-sky-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                  <span>{language === 'ar' ? 'صادرة (مبيعات):' : 'Sent:'} {diffMetrics.sentNetRatio}%</span>
                </span>
                <span className="flex items-center gap-1 text-emerald-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  <span>{language === 'ar' ? 'مستلمة (مشتريات):' : 'Received:'} {diffMetrics.receivedNetRatio}%</span>
                </span>
              </div>
            </div>

            {/* Value Progress Bar */}
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${diffMetrics.sentNetRatio}%` }}
                className="bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-500"
                title={`${language === 'ar' ? 'صادرة:' : 'Sent:'} ${diffMetrics.sentNetRatio}%`}
              ></div>
              <div
                style={{ width: `${diffMetrics.receivedNetRatio}%` }}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                title={`${language === 'ar' ? 'مستلمة:' : 'Received:'} ${diffMetrics.receivedNetRatio}%`}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. TWO-COLUMN SECTIONS: RECEIVED (مستلم) & ISSUED (صادر) WITH TYPES */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* A. جزء المستلم - إظهار الأنواع (RECEIVED DOCUMENTS SECTION) */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>{language === 'ar' ? 'الوثائق المستلمة (المشتريات والمصروفات)' : 'Received Documents (Purchases)'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {language === 'ar' ? 'فواتير وإشعارات الموردين المسجلة بالضرائب' : 'Supplier invoices & notes from ETA'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage('eta_received_invoices')}
                className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <span>{language === 'ar' ? 'عرض السجل' : 'View Docs'}</span>
                <ChevronRight className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Received Metric 4-Card Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{language === 'ar' ? 'عدد الوثائق' : 'Docs Count'}</span>
                <span className="text-base font-black text-slate-900">{receivedTotals.count}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{language === 'ar' ? 'صافي المشتريات' : 'Net Purchases'}</span>
                <span className="text-xs font-black text-slate-900 font-mono">{formatMoney(receivedTotals.netAmount)}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-emerald-700 block mb-0.5">{language === 'ar' ? 'ضريبة المدخلات (T1)' : 'Input VAT (T1)'}</span>
                <span className="text-xs font-black text-emerald-700 font-mono">{formatMoney(receivedTotals.vatAmount)}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{language === 'ar' ? 'الإجمالي الكلي' : 'Total Amount'}</span>
                <span className="text-xs font-black text-slate-900 font-mono">{formatMoney(receivedTotals.totalAmount)}</span>
              </div>
            </div>

            {/* Types Breakdown Table / List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-700 px-1">
                <span>{language === 'ar' ? 'تفصيل الأنواع المستلمة (Types Breakdown):' : 'Received Types Breakdown:'}</span>
                <span className="text-[10px] text-slate-400 font-bold">{receivedTotals.typesList.length} {language === 'ar' ? 'أنواع مسجلة' : 'types'}</span>
              </div>

              {receivedTotals.typesList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  {language === 'ar' ? 'لا توجد وثائق مستلمة تطابق خيارات التصفية الحالية.' : 'No received documents match current filters.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {receivedTotals.typesList.map(typeItem => {
                    const ratio = receivedTotals.totalAmount > 0 
                      ? Math.round((typeItem.totalAmount / receivedTotals.totalAmount) * 100) 
                      : 0;

                    return (
                      <div key={typeItem.key} className="p-3 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            typeItem.isCredit 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : typeItem.isDebit 
                              ? 'bg-orange-100 text-orange-800 border border-orange-200'
                              : typeItem.key === 'ii'
                              ? 'bg-teal-100 text-teal-800 border border-teal-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {typeItem.key.toUpperCase()}
                          </span>
                          <div className="truncate">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {language === 'ar' ? typeItem.nameAr : typeItem.nameEn}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {typeItem.count} {language === 'ar' ? 'وثيقة' : 'docs'} ({ratio}%)
                            </span>
                          </div>
                        </div>

                        {/* Financials for this type */}
                        <div className="text-end flex-shrink-0">
                          <div className="text-xs font-black text-slate-900 font-mono">
                            {formatMoney(typeItem.totalAmount)} EGP
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium flex items-center justify-end gap-1.5">
                            <span>{language === 'ar' ? 'الصافي: ' : 'Net: '}{formatMoney(typeItem.netAmount)}</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-bold">{language === 'ar' ? 'ضريبة: ' : 'VAT: '}{formatMoney(typeItem.vatAmount)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* B. جزء الصادرة - إظهار الأنواع (SENT DOCUMENTS SECTION) */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>{language === 'ar' ? 'الوثائق الصادرة (المبيعات والإيرادات)' : 'Issued Documents (Sales & Revenue)'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {language === 'ar' ? 'فواتير وإشعارات المبيعات المصدرة للعملاء' : 'Customer sales invoices & notes on ETA'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage('eta_received_invoices')}
                className="flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <span>{language === 'ar' ? 'عرض السجل' : 'View Docs'}</span>
                <ChevronRight className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Sent Metric 4-Card Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{language === 'ar' ? 'عدد الوثائق' : 'Docs Count'}</span>
                <span className="text-base font-black text-slate-900">{sentTotals.count}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{language === 'ar' ? 'صافي المبيعات' : 'Net Sales'}</span>
                <span className="text-xs font-black text-slate-900 font-mono">{formatMoney(sentTotals.netAmount)}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-sky-700 block mb-0.5">{language === 'ar' ? 'ضريبة المخرجات (T1)' : 'Output VAT (T1)'}</span>
                <span className="text-xs font-black text-sky-700 font-mono">{formatMoney(sentTotals.vatAmount)}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{language === 'ar' ? 'الإجمالي الكلي' : 'Total Amount'}</span>
                <span className="text-xs font-black text-slate-900 font-mono">{formatMoney(sentTotals.totalAmount)}</span>
              </div>
            </div>

            {/* Types Breakdown Table / List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-700 px-1">
                <span>{language === 'ar' ? 'تفصيل الأنواع الصادرة (Types Breakdown):' : 'Issued Types Breakdown:'}</span>
                <span className="text-[10px] text-slate-400 font-bold">{sentTotals.typesList.length} {language === 'ar' ? 'أنواع مسجلة' : 'types'}</span>
              </div>

              {sentTotals.typesList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  {language === 'ar' ? 'لا توجد وثائق صادرة تطابق خيارات التصفية الحالية.' : 'No issued documents match current filters.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {sentTotals.typesList.map(typeItem => {
                    const ratio = sentTotals.totalAmount > 0 
                      ? Math.round((typeItem.totalAmount / sentTotals.totalAmount) * 100) 
                      : 0;

                    return (
                      <div key={typeItem.key} className="p-3 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            typeItem.isCredit 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : typeItem.isDebit 
                              ? 'bg-orange-100 text-orange-800 border border-orange-200'
                              : typeItem.key === 'ei'
                              ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                              : 'bg-sky-100 text-sky-800 border border-sky-200'
                          }`}>
                            {typeItem.key.toUpperCase()}
                          </span>
                          <div className="truncate">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {language === 'ar' ? typeItem.nameAr : typeItem.nameEn}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {typeItem.count} {language === 'ar' ? 'وثيقة' : 'docs'} ({ratio}%)
                            </span>
                          </div>
                        </div>

                        {/* Financials for this type */}
                        <div className="text-end flex-shrink-0">
                          <div className="text-xs font-black text-slate-900 font-mono">
                            {formatMoney(typeItem.totalAmount)} EGP
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium flex items-center justify-end gap-1.5">
                            <span>{language === 'ar' ? 'الصافي: ' : 'Net: '}{formatMoney(typeItem.netAmount)}</span>
                            <span>•</span>
                            <span className="text-sky-700 font-bold">{language === 'ar' ? 'ضريبة: ' : 'VAT: '}{formatMoney(typeItem.vatAmount)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MONTHLY TAX TIMELINE & RECONCILIATION TABLE (الجدول الشهري الشامل) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-slate-900">
                {language === 'ar' ? 'التوزيع الشهري للمبيعات والمشتريات والفروق الضريبية' : 'Monthly Sales, Purchases & Tax Breakdown'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {language === 'ar' ? 'متابعة شهرية تفصيلية مطابقة لنموذج 10 ضريبة القيمة المضافة' : 'Detailed monthly track matching Egyptian VAT Return Model 10'}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Responsive Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs text-center divide-y divide-slate-200">
            <thead className="bg-slate-50/90 text-slate-700 font-black text-[11px] select-none">
              <tr>
                <th className="py-3 px-3 border-r border-slate-200">{language === 'ar' ? 'الشهر' : 'Month'}</th>
                <th colSpan={3} className="py-2 px-3 border-r border-slate-200 bg-sky-50 text-sky-800">
                  {language === 'ar' ? 'المبيعات الصادرة (Sent)' : 'Issued Sales'}
                </th>
                <th colSpan={3} className="py-2 px-3 border-r border-slate-200 bg-emerald-50 text-emerald-800">
                  {language === 'ar' ? 'المشتريات المستلمة (Received)' : 'Received Purchases'}
                </th>
                <th colSpan={2} className="py-2 px-3 bg-indigo-50 text-indigo-900">
                  {language === 'ar' ? 'الفروق والموقف الضريبي (Differences)' : 'Net Differences'}
                </th>
              </tr>
              <tr className="bg-slate-100/70 text-[10px] text-slate-600 border-t border-slate-200">
                <th className="py-2 px-2 border-r border-slate-200">#</th>
                {/* Sent */}
                <th className="py-1.5 px-2 border-r border-slate-200">{language === 'ar' ? 'العدد' : 'Qty'}</th>
                <th className="py-1.5 px-2 border-r border-slate-200">{language === 'ar' ? 'صافي المبيعات' : 'Net Sales'}</th>
                <th className="py-1.5 px-2 border-r border-slate-200">{language === 'ar' ? 'ضريبة (14%)' : 'Output VAT'}</th>
                {/* Received */}
                <th className="py-1.5 px-2 border-r border-slate-200">{language === 'ar' ? 'العدد' : 'Qty'}</th>
                <th className="py-1.5 px-2 border-r border-slate-200">{language === 'ar' ? 'صافي المشتريات' : 'Net Purchases'}</th>
                <th className="py-1.5 px-2 border-r border-slate-200">{language === 'ar' ? 'ضريبة (14%)' : 'Input VAT'}</th>
                {/* Differences */}
                <th className="py-1.5 px-2 border-r border-slate-200">{language === 'ar' ? 'فرق القيمة (Net Diff)' : 'Net Margin'}</th>
                <th className="py-1.5 px-2">{language === 'ar' ? 'موقف الضريبة (VAT Net)' : 'Tax Position'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px] bg-white">
              {monthlyBreakdown.map(row => {
                const hasData = row.sentCount > 0 || row.receivedCount > 0;
                return (
                  <tr key={row.monthId} className={`hover:bg-slate-50/80 transition-colors ${!hasData ? 'opacity-45' : ''}`}>
                    <td className="py-2.5 px-3 font-sans font-black text-slate-800 border-r border-slate-200">
                      {language === 'ar' ? row.nameAr : row.nameEn}
                    </td>
                    {/* Sent columns */}
                    <td className="py-2.5 px-2 border-r border-slate-200 font-bold text-sky-900">{row.sentCount || '—'}</td>
                    <td className="py-2.5 px-2 border-r border-slate-200">{row.sentNet ? formatMoney(row.sentNet) : '—'}</td>
                    <td className="py-2.5 px-2 border-r border-slate-200 font-bold text-sky-700">{row.sentVat ? formatMoney(row.sentVat) : '—'}</td>
                    {/* Received columns */}
                    <td className="py-2.5 px-2 border-r border-slate-200 font-bold text-emerald-900">{row.receivedCount || '—'}</td>
                    <td className="py-2.5 px-2 border-r border-slate-200">{row.receivedNet ? formatMoney(row.receivedNet) : '—'}</td>
                    <td className="py-2.5 px-2 border-r border-slate-200 font-bold text-emerald-700">{row.receivedVat ? formatMoney(row.receivedVat) : '—'}</td>
                    {/* Differences */}
                    <td className={`py-2.5 px-2 border-r border-slate-200 font-bold ${
                      row.netDiff > 0 ? 'text-emerald-700' : row.netDiff < 0 ? 'text-rose-700' : 'text-slate-400'
                    }`}>
                      {row.netDiff !== 0 ? formatMoney(row.netDiff) : '—'}
                    </td>
                    <td className="py-2.5 px-2 font-bold font-sans">
                      {row.vatDiff > 0 ? (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono text-[10px]">
                          +{formatMoney(row.vatDiff)} ({language === 'ar' ? 'سداد' : 'Pay'})
                        </span>
                      ) : row.vatDiff < 0 ? (
                        <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-mono text-[10px]">
                          {formatMoney(row.vatDiff)} ({language === 'ar' ? 'دائن' : 'Credit'})
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-mono font-black text-xs border-t-2 border-slate-300">
              <tr>
                <td className="py-3 px-3 font-sans border-r border-slate-200 text-slate-900">{language === 'ar' ? 'المجموع الإجمالي' : 'Total'}</td>
                <td className="py-3 px-2 border-r border-slate-200 text-sky-900">{sentTotals.count}</td>
                <td className="py-3 px-2 border-r border-slate-200 text-sky-900">{formatMoney(sentTotals.netAmount)}</td>
                <td className="py-3 px-2 border-r border-slate-200 text-sky-900">{formatMoney(sentTotals.vatAmount)}</td>
                <td className="py-3 px-2 border-r border-slate-200 text-emerald-900">{receivedTotals.count}</td>
                <td className="py-3 px-2 border-r border-slate-200 text-emerald-900">{formatMoney(receivedTotals.netAmount)}</td>
                <td className="py-3 px-2 border-r border-slate-200 text-emerald-900">{formatMoney(receivedTotals.vatAmount)}</td>
                <td className={`py-3 px-2 border-r border-slate-200 ${diffMetrics.netDiff >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {formatMoney(diffMetrics.netDiff)}
                </td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-1 rounded text-xs ${diffMetrics.vatDiff >= 0 ? 'bg-amber-200/80 text-amber-950' : 'bg-teal-200/80 text-teal-950'}`}>
                    {formatMoney(diffMetrics.vatDiff)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EtaDashboard;
