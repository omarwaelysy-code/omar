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
  X,
  FileSpreadsheet,
  Check
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
    const netDiff = sentTotals.netAmount - receivedTotals.netAmount;
    const vatDiff = sentTotals.vatAmount - receivedTotals.vatAmount;
    const totalAmountDiff = sentTotals.totalAmount - receivedTotals.totalAmount;
    const countDiff = sentTotals.count - receivedTotals.count;

    const marginPct = sentTotals.netAmount > 0 
      ? Math.round((netDiff / sentTotals.netAmount) * 1000) / 10 
      : 0;

    const combinedNet = (sentTotals.netAmount + receivedTotals.netAmount) || 1;
    const sentNetRatio = Math.round((sentTotals.netAmount / combinedNet) * 100);
    const receivedNetRatio = Math.round((receivedTotals.netAmount / combinedNet) * 100);

    return {
      netDiff,
      vatDiff,
      totalAmountDiff,
      countDiff,
      marginPct,
      sentNetRatio,
      receivedNetRatio
    };
  }, [sentTotals, receivedTotals]);

  // 12. Monthly Timeline Schedule (Transposed: Months are columns across the top header)
  const monthlyDataMap = useMemo(() => {
    const map: Record<string, {
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

    Object.keys(map).forEach(key => {
      map[key].netDiff = map[key].sentNet - map[key].receivedNet;
      map[key].vatDiff = map[key].sentVat - map[key].receivedVat;
    });

    return map;
  }, [filteredInvoices, MONTHS_LIST]);

  // 13. Export to Excel (both summary and monthly matrix)
  const handleExportExcel = () => {
    // 1. Executive Summary Sheet
    const summaryData = [
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'الوثائق الصادرة (المبيعات)' : 'Issued Documents (Sales)',
        [language === 'ar' ? 'عدد الوثائق' : 'Count']: sentTotals.count,
        [language === 'ar' ? 'صافي القيمة' : 'Net Amount']: sentTotals.netAmount,
        [language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT Amount']: sentTotals.vatAmount,
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total Amount']: sentTotals.totalAmount
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'الوثائق المستلمة (المشتريات)' : 'Received Documents (Purchases)',
        [language === 'ar' ? 'عدد الوثائق' : 'Count']: receivedTotals.count,
        [language === 'ar' ? 'صافي القيمة' : 'Net Amount']: receivedTotals.netAmount,
        [language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT Amount']: receivedTotals.vatAmount,
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total Amount']: receivedTotals.totalAmount
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'صافي الفروق (الصادر - المستلم)' : 'Net Difference (Sent - Received)',
        [language === 'ar' ? 'عدد الوثائق' : 'Count']: diffMetrics.countDiff,
        [language === 'ar' ? 'صافي القيمة' : 'Net Amount']: diffMetrics.netDiff,
        [language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT Amount']: diffMetrics.vatDiff,
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total Amount']: diffMetrics.totalAmountDiff
      }
    ];

    // 2. Transposed Monthly Matrix Sheet
    const matrixRows = [
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'المبيعات الصادرة - عدد الوثائق' : 'Sales - Docs Count',
        ...MONTHS_LIST.reduce((acc, m) => ({ ...acc, [m.shortAr]: monthlyDataMap[m.id]?.sentCount || 0 }), {}),
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total']: sentTotals.count
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'المبيعات الصادرة - صافي القيمة' : 'Sales - Net Amount',
        ...MONTHS_LIST.reduce((acc, m) => ({ ...acc, [m.shortAr]: monthlyDataMap[m.id]?.sentNet || 0 }), {}),
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total']: sentTotals.netAmount
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'المبيعات الصادرة - ضريبة المخرجات 14%' : 'Sales - Output VAT',
        ...MONTHS_LIST.reduce((acc, m) => ({ ...acc, [m.shortAr]: monthlyDataMap[m.id]?.sentVat || 0 }), {}),
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total']: sentTotals.vatAmount
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'المبيعات الصادرة - الإجمالي شامل الضريبة' : 'Sales - Grand Total',
        ...MONTHS_LIST.reduce((acc, m) => ({ ...acc, [m.shortAr]: monthlyDataMap[m.id]?.sentTotal || 0 }), {}),
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total']: sentTotals.totalAmount
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'المشتريات المستلمة - عدد الوثائق' : 'Purchases - Docs Count',
        ...MONTHS_LIST.reduce((acc, m) => ({ ...acc, [m.shortAr]: monthlyDataMap[m.id]?.receivedCount || 0 }), {}),
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total']: receivedTotals.count
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'المشتريات المستلمة - صافي القيمة' : 'Purchases - Net Amount',
        ...MONTHS_LIST.reduce((acc, m) => ({ ...acc, [m.shortAr]: monthlyDataMap[m.id]?.receivedNet || 0 }), {}),
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total']: receivedTotals.netAmount
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'المشتريات المستلمة - ضريبة المدخلات 14%' : 'Purchases - Input VAT',
        ...MONTHS_LIST.reduce((acc, m) => ({ ...acc, [m.shortAr]: monthlyDataMap[m.id]?.receivedVat || 0 }), {}),
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total']: receivedTotals.vatAmount
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'المشتريات المستلمة - الإجمالي شامل الضريبة' : 'Purchases - Grand Total',
        ...MONTHS_LIST.reduce((acc, m) => ({ ...acc, [m.shortAr]: monthlyDataMap[m.id]?.receivedTotal || 0 }), {}),
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total']: receivedTotals.totalAmount
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'صافي فرق القيمة (مبيعات - مشتريات)' : 'Net Margin (Sales - Purchases)',
        ...MONTHS_LIST.reduce((acc, m) => ({ ...acc, [m.shortAr]: monthlyDataMap[m.id]?.netDiff || 0 }), {}),
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total']: diffMetrics.netDiff
      },
      {
        [language === 'ar' ? 'البيان' : 'Metric']: language === 'ar' ? 'موقف ضريبة القيمة المضافة (سداد/دائن)' : 'VAT Position (Payable/Credit)',
        ...MONTHS_LIST.reduce((acc, m) => ({ ...acc, [m.shortAr]: monthlyDataMap[m.id]?.vatDiff || 0 }), {}),
        [language === 'ar' ? 'الإجمالي الكلي' : 'Total']: diffMetrics.vatDiff
      }
    ];

    exportToExcel(matrixRows, {
      filename: `ETA_Dashboard_Matrix_${selectedYears.join('_') || 'All'}`,
      sheetName: language === 'ar' ? 'جدول الشهور الضريبي' : 'Monthly Tax Matrix'
    });

    showNotification(
      language === 'ar' ? 'تم تصدير جدول الشهور والمؤشرات إلى إكسيل بنجاح.' : 'Exported ETA Matrix to Excel successfully.',
      'success'
    );
  };

  // 14. Print Report
  const handlePrint = () => {
    if (dashboardRef.current) {
      printElement(dashboardRef.current, language === 'ar' ? 'لوحة مؤشرات الفاتورة الإلكترونية (ETA)' : 'ETA e-Invoicing Dashboard');
    }
  };

  return (
    <div className="space-y-6 w-full text-slate-800 pb-16" dir={dir} ref={dashboardRef}>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CONTROLS (Clean, Light, Elegant) */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 text-white flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0 mt-0.5">
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
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
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
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
                  className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
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
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs font-bold text-slate-800 transition-all text-start cursor-pointer"
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
                      className={`font-bold cursor-pointer ${selectedYears.length === 0 ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {language === 'ar' ? 'تحديد كافة الأعوام' : 'Select All Years'}
                    </button>
                    {selectedYears.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedYears([])}
                        className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
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
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
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
                  className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
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
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs font-bold text-slate-800 transition-all text-start cursor-pointer"
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
                      className={`font-bold cursor-pointer ${selectedMonths.length === 0 ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {language === 'ar' ? 'تحديد كافة الشهور' : 'Select All Months'}
                    </button>
                    {selectedMonths.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedMonths([])}
                        className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
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
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
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
                  className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
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
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 text-xs font-bold text-slate-800 transition-all text-start cursor-pointer"
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
                      className={`font-bold cursor-pointer ${selectedStatuses.length === 0 ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {language === 'ar' ? 'كافة الحالات' : 'Select All'}
                    </button>
                    {selectedStatuses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setSelectedStatuses([]); setQuickStatusPreset('all'); }}
                        className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
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
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
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
                  className="text-[10px] text-indigo-600 hover:underline font-bold cursor-pointer"
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
      {/* 3. THREE MASTER PILLARS IN ONE ROW: SENT, RECEIVED, AND DIFFERENCES */}
      {/* (خلى المستلم اكبر فى صف واحد وكذلك الصادر والفرق - بدون أسود) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ========================================================= */}
        {/* PILLAR 1: الوثائق الصادرة (المبيعات) - Sky/Blue Theme */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl p-5 border-2 border-sky-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-sky-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-black shadow-xs">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-black text-slate-900 leading-tight">
                    {language === 'ar' ? 'الوثائق الصادرة (المبيعات)' : 'Issued Documents (Sales)'}
                  </h2>
                  <span className="text-[11px] text-sky-700 font-bold">
                    {sentTotals.count} {language === 'ar' ? 'وثيقة صادرة مسجلة' : 'docs issued'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage('eta_received_invoices')}
                className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>{language === 'ar' ? 'السجل' : 'View'}</span>
                <ChevronRight className={`w-3 h-3 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Big Headline Number */}
            <div className="bg-gradient-to-br from-sky-50/70 to-blue-50/40 p-4 rounded-2xl border border-sky-100/80">
              <span className="text-xs font-bold text-slate-500 block mb-1">
                {language === 'ar' ? 'إجمالي المبيعات شامل الضريبة' : 'Grand Total Sales (with Tax)'}
              </span>
              <div className="text-2xl md:text-3xl font-black text-sky-950 font-mono tracking-tight">
                {formatMoney(sentTotals.totalAmount)} <span className="text-xs font-bold text-slate-500">EGP</span>
              </div>
            </div>

            {/* Breakdown Sub-metrics */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{language === 'ar' ? 'صافي المبيعات' : 'Net Sales'}</span>
                <span className="text-sm font-black text-slate-900 font-mono">{formatMoney(sentTotals.netAmount)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100">
                <span className="text-[10px] font-bold text-sky-800 block mb-0.5">{language === 'ar' ? 'ضريبة المخرجات (T1)' : 'Output VAT (T1)'}</span>
                <span className="text-sm font-black text-sky-900 font-mono">{formatMoney(sentTotals.vatAmount)}</span>
              </div>
            </div>
          </div>

          {/* Types breakdown inside this pillar */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <span className="text-[11px] font-bold text-slate-600 block">{language === 'ar' ? 'تفصيل أنواع الصادر:' : 'Issued Types:'}</span>
            <div className="space-y-1.5">
              {sentTotals.typesList.length === 0 ? (
                <span className="text-[11px] text-slate-400 block py-1">{language === 'ar' ? 'لا توجد وثائق صادرة مطابقة' : 'No docs'}</span>
              ) : (
                sentTotals.typesList.map(t => (
                  <div key={t.key} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 hover:bg-sky-50/50 transition-colors">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-sky-100 text-sky-800 uppercase">{t.key}</span>
                      <span>{language === 'ar' ? t.nameAr : t.nameEn} ({t.count})</span>
                    </span>
                    <span className="font-mono font-black text-slate-900">{formatMoney(t.totalAmount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PILLAR 2: الوثائق المستلمة (المشتريات) - Emerald/Green Theme */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl p-5 border-2 border-emerald-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black shadow-xs">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-black text-slate-900 leading-tight">
                    {language === 'ar' ? 'الوثائق المستلمة (المشتريات)' : 'Received Documents (Purchases)'}
                  </h2>
                  <span className="text-[11px] text-emerald-700 font-bold">
                    {receivedTotals.count} {language === 'ar' ? 'وثيقة مستلمة مسجلة' : 'docs received'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage('eta_received_invoices')}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>{language === 'ar' ? 'السجل' : 'View'}</span>
                <ChevronRight className={`w-3 h-3 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Big Headline Number */}
            <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/40 p-4 rounded-2xl border border-emerald-100/80">
              <span className="text-xs font-bold text-slate-500 block mb-1">
                {language === 'ar' ? 'إجمالي المشتريات شامل الضريبة' : 'Grand Total Purchases (with Tax)'}
              </span>
              <div className="text-2xl md:text-3xl font-black text-emerald-950 font-mono tracking-tight">
                {formatMoney(receivedTotals.totalAmount)} <span className="text-xs font-bold text-slate-500">EGP</span>
              </div>
            </div>

            {/* Breakdown Sub-metrics */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{language === 'ar' ? 'صافي المشتريات' : 'Net Purchases'}</span>
                <span className="text-sm font-black text-slate-900 font-mono">{formatMoney(receivedTotals.netAmount)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-800 block mb-0.5">{language === 'ar' ? 'ضريبة المدخلات (T1)' : 'Input VAT (T1)'}</span>
                <span className="text-sm font-black text-emerald-900 font-mono">{formatMoney(receivedTotals.vatAmount)}</span>
              </div>
            </div>
          </div>

          {/* Types breakdown inside this pillar */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <span className="text-[11px] font-bold text-slate-600 block">{language === 'ar' ? 'تفصيل أنواع المستلم:' : 'Received Types:'}</span>
            <div className="space-y-1.5">
              {receivedTotals.typesList.length === 0 ? (
                <span className="text-[11px] text-slate-400 block py-1">{language === 'ar' ? 'لا توجد وثائق مستلمة مطابقة' : 'No docs'}</span>
              ) : (
                receivedTotals.typesList.map(t => (
                  <div key={t.key} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50/50 transition-colors">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        t.key === 'ii' ? 'bg-teal-100 text-teal-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>{t.key}</span>
                      <span>{language === 'ar' ? t.nameAr : t.nameEn} ({t.count})</span>
                    </span>
                    <span className="font-mono font-black text-slate-900">{formatMoney(t.totalAmount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PILLAR 3: صافي الفروق والموقف الضريبي - Purple/Amber Theme */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl p-5 border-2 border-indigo-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shadow-xs">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-black text-slate-900 leading-tight">
                    {language === 'ar' ? 'صافي الفروق والموقف الضريبي' : 'Net Differences & Tax Clearance'}
                  </h2>
                  <span className="text-[11px] text-indigo-700 font-bold">
                    {language === 'ar' ? 'المقاصة الضريبية والمالية' : 'Financial Reconciliation'}
                  </span>
                </div>
              </div>
              <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg border ${
                diffMetrics.vatDiff >= 0
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-teal-50 text-teal-800 border-teal-300'
              }`}>
                {diffMetrics.vatDiff >= 0 ? (language === 'ar' ? '⚡ سداد للضرائب' : 'Tax Payable') : (language === 'ar' ? '🛡️ رصيد دائن' : 'Tax Credit')}
              </span>
            </div>

            {/* Big Headline Number for VAT Position */}
            <div className={`p-4 rounded-2xl border transition-all ${
              diffMetrics.vatDiff >= 0 
                ? 'bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 border-amber-200' 
                : 'bg-gradient-to-br from-teal-50/80 via-white to-teal-50/40 border-teal-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'ar' ? 'صافي ضريبة القيمة المضافة 14%' : 'Net VAT Clearance (14%)'}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {diffMetrics.vatDiff >= 0 ? (language === 'ar' ? 'مستحق السداد' : 'Payable') : (language === 'ar' ? 'رصيد مرحل' : 'Credit')}
                </span>
              </div>
              <div className="text-2xl md:text-3xl font-black text-slate-900 font-mono tracking-tight">
                {formatMoney(Math.abs(diffMetrics.vatDiff))} <span className="text-xs font-bold text-slate-500">EGP</span>
              </div>
              <p className="text-[11px] font-bold mt-1.5 text-slate-600">
                {diffMetrics.vatDiff >= 0
                  ? (language === 'ar' ? '🟢 ضريبة المبيعات تفوق المشتريات بمقدار هذا المبلغ' : 'Output VAT exceeds Input VAT')
                  : (language === 'ar' ? '🔵 ضريبة المشتريات تفوق المبيعات (رصيد مسترد/يرحل)' : 'Input VAT exceeds Output VAT')}
              </p>
            </div>

            {/* Breakdown Sub-metrics */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{language === 'ar' ? 'فرق صافي القيمة' : 'Net Sales Margin'}</span>
                <span className={`text-sm font-black font-mono ${diffMetrics.netDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {diffMetrics.netDiff > 0 ? '+' : ''}{formatMoney(diffMetrics.netDiff)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">{language === 'ar' ? 'فرق الإجمالي الكلي' : 'Cash Total Diff'}</span>
                <span className={`text-sm font-black font-mono ${diffMetrics.totalAmountDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {diffMetrics.totalAmountDiff > 0 ? '+' : ''}{formatMoney(diffMetrics.totalAmountDiff)}
                </span>
              </div>
            </div>
          </div>

          {/* Distribution Ratio Bar */}
          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span>{language === 'ar' ? 'نسبة الصادر إلى المستلم:' : 'Sales vs Purchases Ratio:'}</span>
              <span>{diffMetrics.sentNetRatio}% صادر / {diffMetrics.receivedNetRatio}% مستلم</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div style={{ width: `${diffMetrics.sentNetRatio}%` }} className="bg-sky-500 transition-all duration-500" />
              <div style={{ width: `${diffMetrics.receivedNetRatio}%` }} className="bg-emerald-500 transition-all duration-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. THE MONTHLY TIMELINE TABLE (الشهور من فوق - HORIZONTAL MATRIX) */}
      {/* (الجدول اللي تحت خلى الشهور من فوق) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-900">
                {language === 'ar' ? 'الجدول المالي والضريبي الشهري (شهور السنة في الأعمدة العليا)' : 'Monthly Financial & Tax Matrix (Months Across Columns)'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {language === 'ar' ? 'عرض مصفوفي متكامل لشهور السنة الـ 12 مطابق لنموذج 10 ضريبة القيمة المضافة' : '12-Month Matrix matching Egyptian VAT Return Model 10'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تصدير جدول الشهور لإكسيل' : 'Export Matrix Excel'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Matrix Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 custom-scrollbar">
          <table className="w-full text-xs border-collapse text-center">
            {/* Header: Months Across The Top */}
            <thead>
              <tr className="bg-slate-100/90 text-slate-800 border-b border-slate-200">
                <th className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-slate-100 py-3 px-3.5 text-start font-black text-xs border-x border-slate-200 min-w-[210px]`}>
                  {language === 'ar' ? 'البيان / البند المالي والضريبي' : 'Financial Metric'}
                </th>
                {MONTHS_LIST.map(m => (
                  <th key={m.id} className="py-3 px-2 text-center font-black text-xs border-r border-slate-200 min-w-[95px] whitespace-nowrap">
                    {language === 'ar' ? m.shortAr : m.shortEn}
                  </th>
                ))}
                <th className={`py-3 px-3 text-center font-black text-xs bg-indigo-100 text-indigo-950 border-r border-slate-200 min-w-[130px] whitespace-nowrap`}>
                  {language === 'ar' ? 'الإجمالي الكلي' : 'Total'}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 font-mono text-[11px] bg-white">
              {/* ------------------------------------------------------------- */}
              {/* GROUP 1: الوثائق الصادرة (المبيعات) */}
              {/* ------------------------------------------------------------- */}
              <tr className="bg-sky-100/60 font-sans font-black text-sky-950 text-xs">
                <td colSpan={14} className={`py-2 px-3 text-start border-y border-sky-200 ${dir === 'rtl' ? 'pr-4' : 'pl-4'} flex items-center gap-2`}>
                  <ArrowUpRight className="w-4 h-4 text-sky-700" />
                  <span>{language === 'ar' ? 'أولاً: الوثائق الصادرة (المبيعات والإيرادات - Sales)' : '1. Issued Documents (Sales)'}</span>
                </td>
              </tr>

              <tr className="hover:bg-sky-50/30 transition-colors">
                <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-white font-sans font-bold text-slate-700 py-2.5 px-3 text-start border-x border-slate-200`}>
                  {language === 'ar' ? '• عدد الفواتير الصادرة' : '• Issued Docs Count'}
                </td>
                {MONTHS_LIST.map(m => (
                  <td key={m.id} className="py-2 px-2 border-r border-slate-200 text-slate-700">
                    {monthlyDataMap[m.id]?.sentCount || '—'}
                  </td>
                ))}
                <td className="py-2 px-2 border-r border-slate-200 font-bold bg-sky-50/50 text-sky-900">
                  {sentTotals.count}
                </td>
              </tr>

              <tr className="hover:bg-sky-50/30 transition-colors">
                <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-white font-sans font-bold text-slate-700 py-2.5 px-3 text-start border-x border-slate-200`}>
                  {language === 'ar' ? '• صافي المبيعات (الوعاء الضريبي)' : '• Net Sales Amount'}
                </td>
                {MONTHS_LIST.map(m => (
                  <td key={m.id} className="py-2 px-2 border-r border-slate-200 text-slate-800">
                    {monthlyDataMap[m.id]?.sentNet ? formatMoney(monthlyDataMap[m.id].sentNet) : '—'}
                  </td>
                ))}
                <td className="py-2 px-2 border-r border-slate-200 font-bold bg-sky-50/50 text-sky-900">
                  {formatMoney(sentTotals.netAmount)}
                </td>
              </tr>

              <tr className="hover:bg-sky-50/30 transition-colors bg-sky-50/20">
                <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-white font-sans font-black text-sky-800 py-2.5 px-3 text-start border-x border-slate-200`}>
                  {language === 'ar' ? '• ضريبة المخرجات 14% (T1)' : '• Output VAT 14% (T1)'}
                </td>
                {MONTHS_LIST.map(m => (
                  <td key={m.id} className="py-2 px-2 border-r border-slate-200 font-bold text-sky-800">
                    {monthlyDataMap[m.id]?.sentVat ? formatMoney(monthlyDataMap[m.id].sentVat) : '—'}
                  </td>
                ))}
                <td className="py-2 px-2 border-r border-slate-200 font-black bg-sky-100/60 text-sky-950">
                  {formatMoney(sentTotals.vatAmount)}
                </td>
              </tr>

              <tr className="hover:bg-sky-50/30 transition-colors">
                <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-white font-sans font-bold text-slate-900 py-2.5 px-3 text-start border-x border-slate-200`}>
                  {language === 'ar' ? '• إجمالي الصادر شامل الضريبة' : '• Total Sales with Tax'}
                </td>
                {MONTHS_LIST.map(m => (
                  <td key={m.id} className="py-2 px-2 border-r border-slate-200 font-semibold text-slate-900">
                    {monthlyDataMap[m.id]?.sentTotal ? formatMoney(monthlyDataMap[m.id].sentTotal) : '—'}
                  </td>
                ))}
                <td className="py-2 px-2 border-r border-slate-200 font-black bg-sky-50/50 text-sky-900">
                  {formatMoney(sentTotals.totalAmount)}
                </td>
              </tr>

              {/* ------------------------------------------------------------- */}
              {/* GROUP 2: الوثائق المستلمة (المشتريات) */}
              {/* ------------------------------------------------------------- */}
              <tr className="bg-emerald-100/60 font-sans font-black text-emerald-950 text-xs">
                <td colSpan={14} className={`py-2 px-3 text-start border-y border-emerald-200 ${dir === 'rtl' ? 'pr-4' : 'pl-4'} flex items-center gap-2`}>
                  <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
                  <span>{language === 'ar' ? 'ثانياً: الوثائق المستلمة (المشتريات والمصروفات - Purchases)' : '2. Received Documents (Purchases)'}</span>
                </td>
              </tr>

              <tr className="hover:bg-emerald-50/30 transition-colors">
                <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-white font-sans font-bold text-slate-700 py-2.5 px-3 text-start border-x border-slate-200`}>
                  {language === 'ar' ? '• عدد الفواتير المستلمة' : '• Received Docs Count'}
                </td>
                {MONTHS_LIST.map(m => (
                  <td key={m.id} className="py-2 px-2 border-r border-slate-200 text-slate-700">
                    {monthlyDataMap[m.id]?.receivedCount || '—'}
                  </td>
                ))}
                <td className="py-2 px-2 border-r border-slate-200 font-bold bg-emerald-50/50 text-emerald-900">
                  {receivedTotals.count}
                </td>
              </tr>

              <tr className="hover:bg-emerald-50/30 transition-colors">
                <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-white font-sans font-bold text-slate-700 py-2.5 px-3 text-start border-x border-slate-200`}>
                  {language === 'ar' ? '• صافي المشتريات (الوعاء الضريبي)' : '• Net Purchases Amount'}
                </td>
                {MONTHS_LIST.map(m => (
                  <td key={m.id} className="py-2 px-2 border-r border-slate-200 text-slate-800">
                    {monthlyDataMap[m.id]?.receivedNet ? formatMoney(monthlyDataMap[m.id].receivedNet) : '—'}
                  </td>
                ))}
                <td className="py-2 px-2 border-r border-slate-200 font-bold bg-emerald-50/50 text-emerald-900">
                  {formatMoney(receivedTotals.netAmount)}
                </td>
              </tr>

              <tr className="hover:bg-emerald-50/30 transition-colors bg-emerald-50/20">
                <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-white font-sans font-black text-emerald-800 py-2.5 px-3 text-start border-x border-slate-200`}>
                  {language === 'ar' ? '• ضريبة المدخلات 14% (T1)' : '• Input VAT 14% (T1)'}
                </td>
                {MONTHS_LIST.map(m => (
                  <td key={m.id} className="py-2 px-2 border-r border-slate-200 font-bold text-emerald-800">
                    {monthlyDataMap[m.id]?.receivedVat ? formatMoney(monthlyDataMap[m.id].receivedVat) : '—'}
                  </td>
                ))}
                <td className="py-2 px-2 border-r border-slate-200 font-black bg-emerald-100/60 text-emerald-950">
                  {formatMoney(receivedTotals.vatAmount)}
                </td>
              </tr>

              <tr className="hover:bg-emerald-50/30 transition-colors">
                <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-white font-sans font-bold text-slate-900 py-2.5 px-3 text-start border-x border-slate-200`}>
                  {language === 'ar' ? '• إجمالي المستلم شامل الضريبة' : '• Total Purchases with Tax'}
                </td>
                {MONTHS_LIST.map(m => (
                  <td key={m.id} className="py-2 px-2 border-r border-slate-200 font-semibold text-slate-900">
                    {monthlyDataMap[m.id]?.receivedTotal ? formatMoney(monthlyDataMap[m.id].receivedTotal) : '—'}
                  </td>
                ))}
                <td className="py-2 px-2 border-r border-slate-200 font-black bg-emerald-50/50 text-emerald-900">
                  {formatMoney(receivedTotals.totalAmount)}
                </td>
              </tr>

              {/* ------------------------------------------------------------- */}
              {/* GROUP 3: صافي الفروق والموقف الضريبي (المقاصة) */}
              {/* ------------------------------------------------------------- */}
              <tr className="bg-indigo-100/70 font-sans font-black text-indigo-950 text-xs">
                <td colSpan={14} className={`py-2 px-3 text-start border-y border-indigo-200 ${dir === 'rtl' ? 'pr-4' : 'pl-4'} flex items-center gap-2`}>
                  <Scale className="w-4 h-4 text-indigo-700" />
                  <span>{language === 'ar' ? 'ثالثاً: صافي الفروق والمقاصة الضريبية (Differences & Tax Clearance)' : '3. Net Differences & VAT Clearance'}</span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50 transition-colors bg-slate-50/30">
                <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-white font-sans font-black text-slate-900 py-2.5 px-3 text-start border-x border-slate-200`}>
                  {language === 'ar' ? '• فرق صافي القيمة (مبيعات - مشتريات)' : '• Net Value Margin (Sales - Purchases)'}
                </td>
                {MONTHS_LIST.map(m => {
                  const val = monthlyDataMap[m.id]?.netDiff || 0;
                  return (
                    <td key={m.id} className={`py-2 px-2 border-r border-slate-200 font-bold ${
                      val > 0 ? 'text-emerald-700' : val < 0 ? 'text-rose-700' : 'text-slate-400'
                    }`}>
                      {val !== 0 ? (val > 0 ? `+${formatMoney(val)}` : formatMoney(val)) : '—'}
                    </td>
                  );
                })}
                <td className={`py-2 px-2 border-r border-slate-200 font-black bg-indigo-50/70 ${
                  diffMetrics.netDiff >= 0 ? 'text-emerald-800' : 'text-rose-800'
                }`}>
                  {diffMetrics.netDiff > 0 ? `+${formatMoney(diffMetrics.netDiff)}` : formatMoney(diffMetrics.netDiff)}
                </td>
              </tr>

              <tr className="hover:bg-slate-50 transition-colors bg-amber-50/30">
                <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-10 bg-white font-sans font-black text-amber-900 py-3 px-3 text-start border-x border-slate-200`}>
                  {language === 'ar' ? '• موقف ضريبة القيمة المضافة (سداد / دائن)' : '• Net VAT Clearance (Payable / Credit)'}
                </td>
                {MONTHS_LIST.map(m => {
                  const vat = monthlyDataMap[m.id]?.vatDiff || 0;
                  return (
                    <td key={m.id} className="py-2.5 px-1.5 border-r border-slate-200 font-sans font-bold">
                      {vat > 0 ? (
                        <div className="flex flex-col items-center">
                          <span className="text-amber-800 font-mono font-bold">+{formatMoney(vat)}</span>
                          <span className="text-[9px] bg-amber-100 text-amber-900 px-1 rounded">{language === 'ar' ? 'سداد' : 'Pay'}</span>
                        </div>
                      ) : vat < 0 ? (
                        <div className="flex flex-col items-center">
                          <span className="text-teal-800 font-mono font-bold">{formatMoney(vat)}</span>
                          <span className="text-[9px] bg-teal-100 text-teal-900 px-1 rounded">{language === 'ar' ? 'دائن' : 'Credit'}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="py-3 px-2 border-r border-slate-200 font-sans font-black bg-indigo-100/80">
                  <div className="flex flex-col items-center">
                    <span className={`font-mono text-xs ${diffMetrics.vatDiff >= 0 ? 'text-amber-950' : 'text-teal-950'}`}>
                      {formatMoney(Math.abs(diffMetrics.vatDiff))}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                      diffMetrics.vatDiff >= 0 ? 'bg-amber-200 text-amber-950' : 'bg-teal-200 text-teal-950'
                    }`}>
                      {diffMetrics.vatDiff >= 0 ? (language === 'ar' ? 'صافي سداد' : 'Total Payable') : (language === 'ar' ? 'رصيد دائن' : 'Total Credit')}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EtaDashboard;
